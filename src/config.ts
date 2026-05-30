import { defineChain } from 'viem';

// ── Ink Chain Definition ──────────────────────────────────────────────
export const ink = defineChain({
  id: 57073,
  name: 'Ink',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.RPC_URL ?? 'https://rpc-gel.inkonchain.com'] },
  },
  blockExplorers: {
    default: { name: 'Ink Explorer', url: 'https://explorer.inkonchain.com' },
  },
});

// ── Contract Addresses ────────────────────────────────────────────────
export const CONTRACTS = {
  TsunamiV3Factory: '0xD8B0826150B7686D1F56d6F10E31E58e1BCF1193',
  TsunamiV3PositionManager: '0x98b6267DA27c5A21Bd6e3edfBC2DA6b0428Fa9F7',
  TsunamiQuoterV2: '0x547D43a6F83A28720908537Aa25179ff8c6A6411',
  TsunamiSwapRouter02: '0x4415F2360bfD9B1bF55500Cb28fA41dF95CB2d2b',
  SentryLaunchFactory: '0xDc37e11B68052d1539fa23386eE58Ac444bf5BE1',
  SentryProtocolFeeController: '0x21be26C65a3E71d2756986D04FDf883F26D69e81',
  KrakenVerifiedRegistry: '0x54C3405f388E1d9DFbF69e43330F9F73B8EfdB32',
  WETH9: '0x4200000000000000000000000000000000000006',
  USDT0: '0x0200c29006150606b650577bbe7b6248f58470c1',
  USDC: '0x2D270e6886d130D724215A266106e6832161EAEd',
  X402FeeRouter: '0xa1aD9AE09d28C13CBB783e47C7d1B97F96C6711e',
  X402USDT0FeeRouter: '0x0d1e92c107bB315e425278CD999D90be804F39d6',
  // ERC-8004 Agent Identity
  IdentityRegistry: '0x7274e874CA62410a93Bd8bf61c69d8045E399c02',           // implementation (active)
  IdentityRegistryProxy: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',      // proxy (pending upgrade)
  ReputationRegistry: '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63',
  ValidationRegistry: '0x8004Cc8439f36fd5F9F049D9fF86523Df6dAAB58',
  // DailyGM family
  DailyGM:        '0x9F500d075118272B3564ac6Ef2c70a9067Fd2d3F',
  DailyAgentGM:   '0x2B9DD9Eede2AeCB095455ce45122101109E4AeC7',
  DailyGMPlus:    '0x3FB6088d7Bda27211DD9403DCC280B22249b73B3',
} as const;

// ── DailyGMPlus fee ────────────────────────────────────────────────────
// Mirrors `uint256 public constant GM_FEE = 0.0005 ether;` in DailyGMPlus.sol.
// All four payable functions (gm/gmTo/agentGm/agentGmTo) require msg.value to
// equal this exact amount or they revert with `IncorrectFee(sent, required)`.
export const DAILY_GM_PLUS_FEE_WEI = 500_000_000_000_000n; // 5 * 10^14 wei = 0.0005 ETH

// ── DailyGMPlus optional daily spend cap (safety guardrail) ────────────
// If set, the MCP will refuse to execute any `dailygm_plus_*` write tool that
// would push the calling process's *cumulative spend in the current UTC day*
// over this cap (denominated in wei). Defaults to unlimited so the operator
// has to opt in. The cap is process-local — it resets when the MCP restarts
// and is not persisted across runs. Pair with --max-old-space-size if you
// run a long-lived agent loop.
//
// Example: `DAILYGM_PLUS_MAX_DAILY_SPEND_WEI=5000000000000000` caps spend at
// 0.005 ETH per UTC day = 10 premium calls.
export function getDailyGmPlusMaxDailySpendWei(): bigint | undefined {
  const raw = process.env.DAILYGM_PLUS_MAX_DAILY_SPEND_WEI;
  if (!raw) return undefined;
  try {
    const parsed = BigInt(raw);
    return parsed >= 0n ? parsed : undefined;
  } catch {
    return undefined;
  }
}

// ── Subgraph ──────────────────────────────────────────────────────────
// Override via TSUNAMI_SUBGRAPH_URL env var when Goldsky republishes the subgraph.
export const SUBGRAPH_URL = process.env.TSUNAMI_SUBGRAPH_URL
  ?? 'https://api.goldsky.com/api/public/project_cmm7vh5xwsa8m01qmdr7w7u62/subgraphs/tsunami-v3/2.4.0/gn';

// ── GM Subgraphs ───────────────────────────────────────────────────────
// These are not required by the current direct-contract dailygm_* tools, but
// are exported for downstream analytics tools and future GM leaderboard reads.
export const DAILY_GM_SUBGRAPH_URL = process.env.DAILY_GM_SUBGRAPH_URL
  ?? 'https://api.goldsky.com/api/public/project_cmo0uv9q6okpf01zk5gmoaeao/subgraphs/DailyGM/1.1.1/gn';
export const DAILY_AGENT_GM_SUBGRAPH_URL = process.env.DAILY_AGENT_GM_SUBGRAPH_URL
  ?? 'https://api.goldsky.com/api/public/project_cmo0uv9q6okpf01zk5gmoaeao/subgraphs/DailyAgentGM/1.0.0/gn';
export const DAILY_GM_PLUS_SUBGRAPH_URL = process.env.DAILY_GM_PLUS_SUBGRAPH_URL
  ?? 'https://api.goldsky.com/api/public/project_cmo0uv9q6okpf01zk5gmoaeao/subgraphs/DailyGMPlus/1.0.0/gn';

// ── Sentry backend (token registration) ───────────────────────────────
// Anonymous POSTs are supported as of the backend change landed in SentryBot
// commit e8b4218. Users no longer need a MOLTING_API_KEY to have their
// Sentry-launched tokens show up in the public frontend — the MCP always
// posts the launch to this endpoint with the creator wallet address.
// Override `SENTRY_API_BASE` env var to point at a self-hosted backend.
export const SENTRY_API_BASE = process.env.SENTRY_API_BASE ?? 'https://web-production-7d3e.up.railway.app';

// ── x402 facilitator ──────────────────────────────────────────────────
// Optional Railway-hosted facilitator for USDC-denominated x402 payments
// on Ink. Tools that call the HTTP facilitator require this env var.
export const X402_FACILITATOR_URL = process.env.X402_FACILITATOR_URL ?? 'https://x402.sentry.trading';

// ── Constants ─────────────────────────────────────────────────────────
export const DEFAULT_SLIPPAGE_BPS = 50;
export const DEFAULT_DEADLINE_MINUTES = 20;
export const FEE_TIERS = [500, 3000, 10000] as const;
