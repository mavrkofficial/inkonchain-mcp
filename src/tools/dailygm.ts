import { type Address, encodeFunctionData, formatEther, isAddress } from 'viem';
import { publicClient, getAccount, sendTx } from '../client.js';
import {
  CONTRACTS,
  DAILY_GM_PLUS_FEE_WEI,
  getDailyGmPlusMaxDailySpendWei,
} from '../config.js';
import { DailyGMABI } from '../abis/DailyGM.js';
import { DailyAgentGMABI } from '../abis/DailyAgentGM.js';
import { DailyGMPlusABI } from '../abis/DailyGMPlus.js';

const DAILY_GM       = CONTRACTS.DailyGM       as Address;
const DAILY_AGENT_GM = CONTRACTS.DailyAgentGM  as Address;
const DAILY_GM_PLUS  = CONTRACTS.DailyGMPlus   as Address;

const COOLDOWN_SECONDS = 86_400;

// ── Recipient resolver (address pass-through + .ink domain resolution) ───
//
// Lets every `*_to` tool accept either a 0x... address or a `.ink` domain
// (e.g. `deployerone.ink` or just `deployerone`). The bare-name path supports
// the way humans actually type these — most LLMs and humans say "send to
// deployerone.ink" and don't think about manually resolving it first.
//
// Resolved via the public ZNS API at https://zns.bio/api (the same source the
// gm.ink frontend uses). No extra dependency; uses native `fetch`.
//
// Returns a checksummed `Address`. Throws with a clear, agent-friendly error
// message on any failure (HTTP error, no resolver record, zero address) so
// the LLM gets actionable feedback instead of a silent fallback.

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const ZNS_API_BASE = 'https://zns.bio/api';
const INK_CHAIN_ID = 57073;

function looksLikeBareInkName(input: string): boolean {
  // Heuristic: not 0x-prefixed, no dots, has at least one char, only
  // alphanumeric / hyphen / underscore. Lets `deployerone` be treated as
  // `deployerone.ink` without forcing the agent to remember the suffix.
  return (
    !input.startsWith('0x') &&
    !input.includes('.') &&
    input.length > 0 &&
    /^[a-zA-Z0-9_-]+$/.test(input)
  );
}

async function resolveInkDomain(name: string): Promise<Address> {
  const bare = name.endsWith('.ink') ? name.slice(0, -4) : name;
  const url = `${ZNS_API_BASE}/resolveDomain?chain=${INK_CHAIN_ID}&domain=${encodeURIComponent(bare)}`;
  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Could not resolve .ink domain "${bare}.ink": network error talking to ZNS (${msg}).`,
    );
  }
  if (!res.ok) {
    throw new Error(
      `Could not resolve .ink domain "${bare}.ink": ZNS API returned HTTP ${res.status}.`,
    );
  }
  const data = (await res.json()) as { address?: string };
  const addr = data?.address;
  if (!addr || addr.toLowerCase() === ZERO_ADDRESS) {
    throw new Error(
      `Could not resolve .ink domain "${bare}.ink": no owner address registered. ` +
      `Check the spelling or use zns_check_domain to confirm registration.`,
    );
  }
  if (!isAddress(addr)) {
    throw new Error(
      `Could not resolve .ink domain "${bare}.ink": ZNS returned malformed address "${addr}".`,
    );
  }
  return addr as Address;
}

/**
 * Coerce a recipient input (raw address string OR .ink domain) into a
 * checksummed `Address`. Designed as the single resolver entrypoint for every
 * `dailygm_*_to` write tool — agents pass whatever the user gave them and we
 * handle resolution + clear-error reporting in one place.
 */
async function resolveRecipient(input: unknown): Promise<{
  address: Address;
  resolvedFrom: string | null;
}> {
  if (typeof input !== 'string' || input.length === 0) {
    throw new Error(
      `Recipient must be a non-empty string (0x... address or *.ink domain). Got ${JSON.stringify(input)}.`,
    );
  }
  const trimmed = input.trim();
  if (isAddress(trimmed)) {
    return { address: trimmed as Address, resolvedFrom: null };
  }
  if (trimmed.endsWith('.ink') || looksLikeBareInkName(trimmed)) {
    const address = await resolveInkDomain(trimmed);
    return { address, resolvedFrom: trimmed.endsWith('.ink') ? trimmed : `${trimmed}.ink` };
  }
  // .eth and other TLDs are not yet supported by the dailygm_*_to surface —
  // surface a clear hint instead of silently rejecting.
  if (trimmed.endsWith('.eth')) {
    throw new Error(
      `Recipient "${trimmed}" is an ENS name. ENS resolution is not yet supported by dailygm_*_to tools — ` +
      `resolve it to a 0x address first (e.g. via the gm.ink frontend or any ENS resolver) and pass that.`,
    );
  }
  throw new Error(
    `Unrecognized recipient format: "${trimmed}". Expected a 0x...-prefixed 40-char address or a .ink domain ` +
    `(e.g. "deployerone.ink" or just "deployerone").`,
  );
}

// ── Process-local daily spend tracking for DailyGMPlus ───────────────
// Counts only successful broadcasts (sent → returned a hash). Resets at the
// start of every UTC day. Persists across tool calls but NOT across MCP
// process restarts. Designed as a guardrail against runaway agent loops, not
// as a hardened audit trail — pair with onchain spend if you need that.
let spendCounter = { day: currentUtcDay(), spentWei: 0n };

function currentUtcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

function rollSpendCounterIfNewDay() {
  const today = currentUtcDay();
  if (spendCounter.day !== today) {
    spendCounter = { day: today, spentWei: 0n };
  }
}

/**
 * Throws if executing the supplied additional spend would push today's
 * cumulative DailyGMPlus spend over the configured cap. No-op when the
 * `DAILYGM_PLUS_MAX_DAILY_SPEND_WEI` env var is unset.
 */
function assertWithinDailySpendCap(additionalWei: bigint): void {
  const cap = getDailyGmPlusMaxDailySpendWei();
  if (cap === undefined) return;
  rollSpendCounterIfNewDay();
  const projected = spendCounter.spentWei + additionalWei;
  if (projected > cap) {
    throw new Error(
      `DailyGMPlus spend cap exceeded: this call would put today's spend at ` +
      `${formatEther(projected)} ETH (cap is ${formatEther(cap)} ETH). ` +
      `Already spent today: ${formatEther(spendCounter.spentWei)} ETH. ` +
      `Increase or unset DAILYGM_PLUS_MAX_DAILY_SPEND_WEI to allow this call.`,
    );
  }
}

function recordSpend(additionalWei: bigint): void {
  rollSpendCounterIfNewDay();
  spendCounter.spentWei += additionalWei;
}

// ── Read helpers ─────────────────────────────────────────────────────
function nextEligibleSummary(lastUnix: number) {
  const neverGmed = lastUnix === 0;
  const now = Math.floor(Date.now() / 1000);
  const canGmAgain = neverGmed || now >= lastUnix + COOLDOWN_SECONDS;
  return {
    lastGmTimestamp: lastUnix,
    lastGmDate: neverGmed ? null : new Date(lastUnix * 1000).toISOString(),
    neverGmed,
    canGmAgain,
    secondsUntilNextGm: canGmAgain ? 0 : (lastUnix + COOLDOWN_SECONDS) - now,
    nextEligibleAt: neverGmed ? now : lastUnix + COOLDOWN_SECONDS,
  };
}

// ── Tool Definitions ─────────────────────────────────────────────────

export const dailyGmTools = [
  // ── Free DailyGM (legacy) ────────────────────────────────────────
  {
    name: 'dailygm_gm',
    description: 'Say GM onchain via the legacy DailyGM contract. Free except gas. 24h cooldown shared with dailygm_gm_to.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'dailygm_gm_to',
    description: 'Say GM to a specific wallet via DailyGM. Free except gas. Shares the 24h cooldown with dailygm_gm. Cannot target self.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        recipient: { type: 'string', description: 'Wallet address (0x...) OR .ink domain (e.g. "deployerone.ink" or just "deployerone") to send your GM to. .ink domains are auto-resolved via the ZNS registry.' },
      },
      required: ['recipient'],
    },
  },
  {
    name: 'dailygm_last_gm',
    description: 'Read DailyGM.lastGM(user). Returns timestamp + computed cooldown status.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        user: { type: 'string', description: 'Wallet address to check' },
      },
      required: ['user'],
    },
  },

  // ── Free DailyAgentGM (agent-only, ERC-8004) ──────────────────────
  {
    name: 'dailygm_agent_gm',
    description: 'Say GM via DailyAgentGM. Free except gas. Caller MUST be a registered ERC-8004 agent (mint via identity_register first). 24h cooldown shared with dailygm_agent_gm_to. Tracked separately from DailyGM cooldowns.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'dailygm_agent_gm_to',
    description: 'Say GM to a specific agent via DailyAgentGM. Free except gas. BOTH sender and recipient must be registered ERC-8004 agents. Cannot target self. Shares the 24h cooldown with dailygm_agent_gm.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        recipient: { type: 'string', description: 'Wallet address (0x...) OR .ink domain of the recipient agent. Recipient must be a registered ERC-8004 agent. .ink domains are auto-resolved via the ZNS registry.' },
      },
      required: ['recipient'],
    },
  },
  {
    name: 'dailygm_agent_last_gm',
    description: 'Read DailyAgentGM.lastGM(user). Returns timestamp + computed cooldown status.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        user: { type: 'string', description: 'Wallet address to check' },
      },
      required: ['user'],
    },
  },
  {
    name: 'dailygm_agent_is_registered',
    description: 'Check whether a wallet is a registered ERC-8004 agent (holds ≥1 identity NFT). Convenience wrapper around DailyAgentGM.isAgent.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        account: { type: 'string', description: 'Wallet address to check' },
      },
      required: ['account'],
    },
  },

  // ── Paid DailyGMPlus (premium, 0.0005 ETH per call) ──────────────
  {
    name: 'dailygm_plus_gm',
    description: 'Premium GM via DailyGMPlus. Costs 0.0005 ETH (auto-attached as msg.value). 24h cooldown, tracked independently from DailyGM and DailyAgentGM. Counts as 2× on the leaderboard but does NOT contribute to streak. Subject to optional DAILYGM_PLUS_MAX_DAILY_SPEND_WEI env cap.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'dailygm_plus_gm_to',
    description: 'Premium GM to a specific wallet via DailyGMPlus. Costs 0.0005 ETH per call. UNLIMITED — no cooldown. Cannot target self. Subject to optional DAILYGM_PLUS_MAX_DAILY_SPEND_WEI env cap.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        recipient: { type: 'string', description: 'Wallet address (0x...) OR .ink domain (e.g. "deployerone.ink" or just "deployerone") to send your premium GM to. .ink domains are auto-resolved via the ZNS registry.' },
      },
      required: ['recipient'],
    },
  },
  {
    name: 'dailygm_plus_agent_gm',
    description: 'Premium agent GM via DailyGMPlus.agentGm. Costs 0.0005 ETH. Caller MUST be a registered ERC-8004 agent. 24h cooldown, tracked SEPARATELY from dailygm_plus_gm (uses lastAgentGM mapping).',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'dailygm_plus_agent_gm_to',
    description: 'Premium agent GM to a specific wallet via DailyGMPlus.agentGmTo. Costs 0.0005 ETH per call. UNLIMITED — no cooldown. Caller MUST be a registered agent; recipient is unrestricted. Cannot target self.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        recipient: { type: 'string', description: 'Wallet address (0x...) OR .ink domain to send your premium agent GM to. Caller must be a registered agent; recipient is unrestricted. .ink domains are auto-resolved via the ZNS registry.' },
      },
      required: ['recipient'],
    },
  },
  {
    name: 'dailygm_plus_last_gm',
    description: 'Read DailyGMPlus.lastGM(user) — the cooldown source for dailygm_plus_gm. Returns timestamp + computed cooldown status.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        user: { type: 'string', description: 'Wallet address to check' },
      },
      required: ['user'],
    },
  },
  {
    name: 'dailygm_plus_last_agent_gm',
    description: 'Read DailyGMPlus.lastAgentGM(user) — the cooldown source for dailygm_plus_agent_gm. Returns timestamp + computed cooldown status.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        user: { type: 'string', description: 'Wallet address to check' },
      },
      required: ['user'],
    },
  },
  {
    name: 'dailygm_plus_fee',
    description: 'Read the onchain DailyGMPlus.GM_FEE constant. Returns the per-call fee in wei and ETH. Always 0.0005 ETH unless the contract is upgraded.',
    inputSchema: { type: 'object' as const, properties: {} },
  },

  // ── Convenience: one-shot status snapshot for an agent loop ──────
  {
    name: 'dailygm_status',
    description: 'One-shot snapshot of every relevant cooldown + agent registration + GM_FEE for a given wallet. Single read covering DailyGM.lastGM, DailyAgentGM.lastGM + isAgent, DailyGMPlus.lastGM + lastAgentGM, and the configured spend cap (if any). Use this as the first call in an agent tick to decide which GM to send next.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        wallet: { type: 'string', description: 'Wallet address to summarize' },
      },
      required: ['wallet'],
    },
  },
];

// ── Handler ──────────────────────────────────────────────────────────

export async function handleDailyGmTool(name: string, args: Record<string, unknown>) {
  switch (name) {
    // ── Free DailyGM ─────────────────────────────────────────────
    case 'dailygm_gm': {
      const sender = await getAccount();
      const data = encodeFunctionData({ abi: DailyGMABI, functionName: 'gm' });
      const { hash } = await sendTx({ to: DAILY_GM, data });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      return {
        contract: 'DailyGM',
        function: 'gm',
        hash,
        status: receipt.status,
        sender,
        message: receipt.status === 'success'
          ? 'GM! Recorded onchain via DailyGM.'
          : 'GM failed — likely 24h cooldown still active. Read dailygm_last_gm for details.',
      };
    }

    case 'dailygm_gm_to': {
      const { address: recipient, resolvedFrom } = await resolveRecipient(args.recipient);
      const sender = await getAccount();
      const data = encodeFunctionData({ abi: DailyGMABI, functionName: 'gmTo', args: [recipient] });
      const { hash } = await sendTx({ to: DAILY_GM, data });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      return {
        contract: 'DailyGM',
        function: 'gmTo',
        hash,
        status: receipt.status,
        sender,
        recipient,
        ...(resolvedFrom ? { resolvedFrom } : {}),
        message: receipt.status === 'success'
          ? `GM sent to ${resolvedFrom ?? recipient} (${recipient}) via DailyGM!`
          : 'GM failed — likely 24h cooldown still active or self-send. Read dailygm_last_gm for details.',
      };
    }

    case 'dailygm_last_gm': {
      const user = args.user as Address;
      const timestamp = await publicClient.readContract({
        address: DAILY_GM, abi: DailyGMABI, functionName: 'lastGM', args: [user],
      }) as bigint;
      return { user, contract: 'DailyGM', ...nextEligibleSummary(Number(timestamp)) };
    }

    // ── Free DailyAgentGM ────────────────────────────────────────
    case 'dailygm_agent_gm': {
      const sender = await getAccount();
      const data = encodeFunctionData({ abi: DailyAgentGMABI, functionName: 'gm' });
      const { hash } = await sendTx({ to: DAILY_AGENT_GM, data });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      return {
        contract: 'DailyAgentGM',
        function: 'gm',
        hash,
        status: receipt.status,
        sender,
        message: receipt.status === 'success'
          ? 'Agent GM! Recorded onchain via DailyAgentGM.'
          : 'Agent GM failed — caller may not be a registered agent (NotRegisteredAgent) or 24h cooldown still active (DailyLimitActive).',
      };
    }

    case 'dailygm_agent_gm_to': {
      const { address: recipient, resolvedFrom } = await resolveRecipient(args.recipient);
      const sender = await getAccount();
      const data = encodeFunctionData({ abi: DailyAgentGMABI, functionName: 'gmTo', args: [recipient] });
      const { hash } = await sendTx({ to: DAILY_AGENT_GM, data });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      return {
        contract: 'DailyAgentGM',
        function: 'gmTo',
        hash,
        status: receipt.status,
        sender,
        recipient,
        ...(resolvedFrom ? { resolvedFrom } : {}),
        message: receipt.status === 'success'
          ? `Agent GM sent to ${resolvedFrom ?? recipient} (${recipient}) via DailyAgentGM!`
          : 'Agent GM to fren failed — sender + recipient must both be registered agents (NotRegisteredAgent / AgentRecipientRequired), or 24h cooldown still active, or self-send.',
      };
    }

    case 'dailygm_agent_last_gm': {
      const user = args.user as Address;
      const timestamp = await publicClient.readContract({
        address: DAILY_AGENT_GM, abi: DailyAgentGMABI, functionName: 'lastGM', args: [user],
      }) as bigint;
      return { user, contract: 'DailyAgentGM', ...nextEligibleSummary(Number(timestamp)) };
    }

    case 'dailygm_agent_is_registered': {
      const account = args.account as Address;
      const isAgent = await publicClient.readContract({
        address: DAILY_AGENT_GM, abi: DailyAgentGMABI, functionName: 'isAgent', args: [account],
      }) as boolean;
      return {
        account,
        isRegisteredAgent: isAgent,
        message: isAgent
          ? 'Account holds ≥1 ERC-8004 identity NFT and is eligible for agent-gated GM functions.'
          : 'Account is NOT a registered agent. Mint an identity NFT via identity_register before calling dailygm_agent_*  or dailygm_plus_agent_* functions.',
      };
    }

    // ── Paid DailyGMPlus ─────────────────────────────────────────
    case 'dailygm_plus_gm': {
      assertWithinDailySpendCap(DAILY_GM_PLUS_FEE_WEI);
      const sender = await getAccount();
      const data = encodeFunctionData({ abi: DailyGMPlusABI, functionName: 'gm' });
      const { hash } = await sendTx({ to: DAILY_GM_PLUS, data, value: DAILY_GM_PLUS_FEE_WEI });
      recordSpend(DAILY_GM_PLUS_FEE_WEI);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      return {
        contract: 'DailyGMPlus',
        function: 'gm',
        hash,
        status: receipt.status,
        sender,
        feeWei: DAILY_GM_PLUS_FEE_WEI.toString(),
        feeEth: formatEther(DAILY_GM_PLUS_FEE_WEI),
        spentTodayWei: spendCounter.spentWei.toString(),
        spentTodayEth: formatEther(spendCounter.spentWei),
        message: receipt.status === 'success'
          ? 'Premium GM! Recorded onchain via DailyGMPlus.gm.'
          : 'Premium GM failed — likely DailyLimitActive (24h cooldown) or IncorrectFee. Read dailygm_plus_last_gm for cooldown status.',
      };
    }

    case 'dailygm_plus_gm_to': {
      // Resolve BEFORE the spend-cap check so a bad domain doesn't even
      // count as an attempted spend, and the agent gets the resolution
      // error instead of a confusing cap message.
      const { address: recipient, resolvedFrom } = await resolveRecipient(args.recipient);
      assertWithinDailySpendCap(DAILY_GM_PLUS_FEE_WEI);
      const sender = await getAccount();
      const data = encodeFunctionData({ abi: DailyGMPlusABI, functionName: 'gmTo', args: [recipient] });
      const { hash } = await sendTx({ to: DAILY_GM_PLUS, data, value: DAILY_GM_PLUS_FEE_WEI });
      recordSpend(DAILY_GM_PLUS_FEE_WEI);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      return {
        contract: 'DailyGMPlus',
        function: 'gmTo',
        hash,
        status: receipt.status,
        sender,
        recipient,
        ...(resolvedFrom ? { resolvedFrom } : {}),
        feeWei: DAILY_GM_PLUS_FEE_WEI.toString(),
        feeEth: formatEther(DAILY_GM_PLUS_FEE_WEI),
        spentTodayWei: spendCounter.spentWei.toString(),
        spentTodayEth: formatEther(spendCounter.spentWei),
        message: receipt.status === 'success'
          ? `Premium GM sent to ${resolvedFrom ?? recipient} (${recipient}) via DailyGMPlus.gmTo (unlimited variant).`
          : 'Premium GM to fren failed — likely SelfRecipient or IncorrectFee.',
      };
    }

    case 'dailygm_plus_agent_gm': {
      assertWithinDailySpendCap(DAILY_GM_PLUS_FEE_WEI);
      const sender = await getAccount();
      const data = encodeFunctionData({ abi: DailyGMPlusABI, functionName: 'agentGm' });
      const { hash } = await sendTx({ to: DAILY_GM_PLUS, data, value: DAILY_GM_PLUS_FEE_WEI });
      recordSpend(DAILY_GM_PLUS_FEE_WEI);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      return {
        contract: 'DailyGMPlus',
        function: 'agentGm',
        hash,
        status: receipt.status,
        sender,
        feeWei: DAILY_GM_PLUS_FEE_WEI.toString(),
        feeEth: formatEther(DAILY_GM_PLUS_FEE_WEI),
        spentTodayWei: spendCounter.spentWei.toString(),
        spentTodayEth: formatEther(spendCounter.spentWei),
        message: receipt.status === 'success'
          ? 'Premium agent GM! Recorded onchain via DailyGMPlus.agentGm.'
          : 'Premium agent GM failed — caller may not be a registered agent, or 24h cooldown active, or IncorrectFee.',
      };
    }

    case 'dailygm_plus_agent_gm_to': {
      const { address: recipient, resolvedFrom } = await resolveRecipient(args.recipient);
      assertWithinDailySpendCap(DAILY_GM_PLUS_FEE_WEI);
      const sender = await getAccount();
      const data = encodeFunctionData({ abi: DailyGMPlusABI, functionName: 'agentGmTo', args: [recipient] });
      const { hash } = await sendTx({ to: DAILY_GM_PLUS, data, value: DAILY_GM_PLUS_FEE_WEI });
      recordSpend(DAILY_GM_PLUS_FEE_WEI);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      return {
        contract: 'DailyGMPlus',
        function: 'agentGmTo',
        hash,
        status: receipt.status,
        sender,
        recipient,
        ...(resolvedFrom ? { resolvedFrom } : {}),
        feeWei: DAILY_GM_PLUS_FEE_WEI.toString(),
        feeEth: formatEther(DAILY_GM_PLUS_FEE_WEI),
        spentTodayWei: spendCounter.spentWei.toString(),
        spentTodayEth: formatEther(spendCounter.spentWei),
        message: receipt.status === 'success'
          ? `Premium agent GM sent to ${resolvedFrom ?? recipient} (${recipient}) via DailyGMPlus.agentGmTo (unlimited).`
          : 'Premium agent GM to fren failed — caller may not be a registered agent, or SelfRecipient, or IncorrectFee.',
      };
    }

    case 'dailygm_plus_last_gm': {
      const user = args.user as Address;
      const timestamp = await publicClient.readContract({
        address: DAILY_GM_PLUS, abi: DailyGMPlusABI, functionName: 'lastGM', args: [user],
      }) as bigint;
      return { user, contract: 'DailyGMPlus', slot: 'lastGM', ...nextEligibleSummary(Number(timestamp)) };
    }

    case 'dailygm_plus_last_agent_gm': {
      const user = args.user as Address;
      const timestamp = await publicClient.readContract({
        address: DAILY_GM_PLUS, abi: DailyGMPlusABI, functionName: 'lastAgentGM', args: [user],
      }) as bigint;
      return { user, contract: 'DailyGMPlus', slot: 'lastAgentGM', ...nextEligibleSummary(Number(timestamp)) };
    }

    case 'dailygm_plus_fee': {
      const fee = await publicClient.readContract({
        address: DAILY_GM_PLUS, abi: DailyGMPlusABI, functionName: 'GM_FEE',
      }) as bigint;
      return {
        contract: 'DailyGMPlus',
        feeWei: fee.toString(),
        feeEth: formatEther(fee),
        constantInCode: DAILY_GM_PLUS_FEE_WEI.toString(),
        match: fee === DAILY_GM_PLUS_FEE_WEI,
      };
    }

    // ── Convenience snapshot ─────────────────────────────────────
    case 'dailygm_status': {
      const wallet = args.wallet as Address;
      rollSpendCounterIfNewDay();

      // viem doesn't ship a single multicall helper across these custom contracts,
      // so we fan out via Promise.all. All targets share the same Ink RPC so
      // these collapse into one HTTP batch when the transport supports it.
      const [
        dailyGmLast,
        agentGmLast,
        agentGmIsAgent,
        plusLast,
        plusAgentLast,
        plusFee,
      ] = await Promise.all([
        publicClient.readContract({ address: DAILY_GM,       abi: DailyGMABI,        functionName: 'lastGM',      args: [wallet] }) as Promise<bigint>,
        publicClient.readContract({ address: DAILY_AGENT_GM, abi: DailyAgentGMABI,   functionName: 'lastGM',      args: [wallet] }) as Promise<bigint>,
        publicClient.readContract({ address: DAILY_AGENT_GM, abi: DailyAgentGMABI,   functionName: 'isAgent',     args: [wallet] }) as Promise<boolean>,
        publicClient.readContract({ address: DAILY_GM_PLUS,  abi: DailyGMPlusABI,    functionName: 'lastGM',      args: [wallet] }) as Promise<bigint>,
        publicClient.readContract({ address: DAILY_GM_PLUS,  abi: DailyGMPlusABI,    functionName: 'lastAgentGM', args: [wallet] }) as Promise<bigint>,
        publicClient.readContract({ address: DAILY_GM_PLUS,  abi: DailyGMPlusABI,    functionName: 'GM_FEE'                       }) as Promise<bigint>,
      ]);

      const cap = getDailyGmPlusMaxDailySpendWei();

      return {
        wallet,
        slots: {
          'dailyGm.gm':          { contract: 'DailyGM',      sharedWith: ['dailyGm.gmTo'],                        ...nextEligibleSummary(Number(dailyGmLast)) },
          'dailyAgentGm.gm':     { contract: 'DailyAgentGM', sharedWith: ['dailyAgentGm.gmTo'], requiresAgent: true, ...nextEligibleSummary(Number(agentGmLast)) },
          'dailyGmPlus.gm':      { contract: 'DailyGMPlus',  paid: true,                                          ...nextEligibleSummary(Number(plusLast)) },
          'dailyGmPlus.agentGm': { contract: 'DailyGMPlus',  paid: true, requiresAgent: true,                     ...nextEligibleSummary(Number(plusAgentLast)) },
          'dailyGmPlus.gmTo':      { contract: 'DailyGMPlus', paid: true,                       cooldown: 'unlimited' },
          'dailyGmPlus.agentGmTo': { contract: 'DailyGMPlus', paid: true, requiresAgent: true,  cooldown: 'unlimited' },
        },
        agentRegistered: agentGmIsAgent,
        premiumFee: {
          feeWei: plusFee.toString(),
          feeEth: formatEther(plusFee),
        },
        spendCap: cap === undefined
          ? { configured: false }
          : {
              configured: true,
              capWei: cap.toString(),
              capEth: formatEther(cap),
              spentTodayWei: spendCounter.spentWei.toString(),
              spentTodayEth: formatEther(spendCounter.spentWei),
              remainingWei: (cap - spendCounter.spentWei).toString(),
              remainingEth: formatEther(cap - spendCounter.spentWei),
              utcDay: spendCounter.day,
            },
      };
    }

    default:
      throw new Error(`Unknown dailygm tool: ${name}`);
  }
}
