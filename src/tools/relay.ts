import { type Address, type Hash } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  getAccount,
  sendTxOnChain,
  getPublicClientForChain,
} from '../client.js';
import { getPrivateKey } from '../keychain.js';

const RELAY_API = 'https://api.relay.link';
const INK_CHAIN_ID = 57073;

// Solana / other non-EVM chain IDs are NOT supported as origin by
// inkonchain-mcp — we only hold an Ink/EVM wallet. Cross-chain bridges
// ORIGINATING from Solana, Bitcoin, Tron, Hyperliquid, etc. are out of
// scope; users should fetch a quote via relay_get_quote and submit the
// origin tx with the wallet on that chain. Destination can still be any
// EVM chain Relay supports — that's the Ink → anywhere flow.
const UNSUPPORTED_NON_EVM_ORIGINS = new Set<number>([
  792703809, // Solana mainnet
  9286185,   // Eclipse
  9286186,   // SOON
  1337,      // Hyperliquid
  3586256,   // Lighter
  8253038,   // Bitcoin
  728126428, // Tron
]);

async function relayFetch(path: string, method: 'GET' | 'POST' = 'GET', body?: unknown) {
  const url = method === 'GET' && body
    ? `${RELAY_API}${path}?${new URLSearchParams(body as Record<string, string>).toString()}`
    : `${RELAY_API}${path}`;

  const res = await fetch(url, {
    method,
    headers: body && method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
    body: method === 'POST' && body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Relay API ${res.status}: ${text}`);
  }
  return res.json();
}

/**
 * Resolve the default `user` address for a given Relay chain ID. Used by
 * read tools (relay_get_quote, relay_get_price, relay_get_requests) when the
 * caller omits an explicit user. For Ink-focused inkonchain-mcp this is
 * always the configured EVM wallet — non-EVM origins throw a clear error
 * asking the caller to either pass `user` explicitly or use a tool tailored
 * to that chain's VM.
 */
async function defaultUserForChain(chainId: number | undefined): Promise<string> {
  if (chainId !== undefined && UNSUPPORTED_NON_EVM_ORIGINS.has(chainId)) {
    throw new Error(
      `Chain ${chainId} is not an EVM chain and is not supported as an origin by inkonchain-mcp. ` +
      `Pass \`user\` explicitly with an address valid on that chain, or use a dedicated MCP for that ecosystem.`,
    );
  }
  // Any EVM chain (or chainId omitted entirely → assume Ink)
  return await getAccount();
}

export const relayTools = [
  {
    name: 'relay_get_chains',
    description: 'Get all supported chains on Relay with their IDs, names, native currencies, and RPC URLs.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'relay_get_currencies',
    description: 'Search for tokens/currencies available on Relay. Filter by chain, search term, or address.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        chainIds: { type: 'array', items: { type: 'number' }, description: 'Filter by chain IDs (e.g. [57073] for Ink)' },
        term: { type: 'string', description: 'Search term (e.g. "USDT", "WETH")' },
        address: { type: 'string', description: 'Token contract address' },
        verified: { type: 'boolean', description: 'Only return verified tokens (default true)' },
        limit: { type: 'number', description: 'Max results (default 20)' },
      },
    },
  },
  {
    name: 'relay_get_quote',
    description: 'Get a quote for a cross-chain bridge or swap via Relay. Returns fees, estimated output, and executable steps. The `user` field defaults to the configured Ink/EVM wallet; pass `user` explicitly if querying for a non-Ink address. The `recipient` field defaults to the Ink/EVM wallet for EVM destinations.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        originChainId: { type: 'number', description: 'Source chain ID. Defaults to 57073 (Ink). Any EVM chain (e.g. 8453 Base, 42161 Arbitrum, 1 Ethereum) works for quoting.' },
        destinationChainId: { type: 'number', description: 'Destination chain ID. Defaults to originChainId (same-chain swap).' },
        originCurrency: { type: 'string', description: 'Token address on origin chain (use 0x0000000000000000000000000000000000000000 for native ETH)' },
        destinationCurrency: { type: 'string', description: 'Token address on destination chain' },
        amount: { type: 'string', description: 'Amount in wei (smallest unit)' },
        tradeType: { type: 'string', description: 'EXACT_INPUT or EXACT_OUTPUT (default EXACT_INPUT)' },
        recipient: { type: 'string', description: 'Recipient address (defaults to user/wallet)' },
      },
      required: ['originChainId', 'destinationChainId', 'originCurrency', 'destinationCurrency', 'amount'],
    },
  },
  {
    name: 'relay_get_price',
    description: 'Get a price estimate for a cross-chain bridge or swap (faster than full quote, no executable steps).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        originChainId: { type: 'number', description: 'Source chain ID' },
        destinationChainId: { type: 'number', description: 'Destination chain ID' },
        originCurrency: { type: 'string', description: 'Token address on origin chain' },
        destinationCurrency: { type: 'string', description: 'Token address on destination chain' },
        amount: { type: 'string', description: 'Amount in wei' },
        tradeType: { type: 'string', description: 'EXACT_INPUT or EXACT_OUTPUT (default EXACT_INPUT)' },
      },
      required: ['originChainId', 'destinationChainId', 'originCurrency', 'destinationCurrency', 'amount'],
    },
  },
  {
    name: 'relay_get_token_price',
    description: 'Get the USD price of a token on a specific chain.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        chainId: { type: 'number', description: 'Chain ID' },
        address: { type: 'string', description: 'Token contract address (use 0x0000000000000000000000000000000000000000 for native)' },
      },
      required: ['chainId', 'address'],
    },
  },
  {
    name: 'relay_get_requests',
    description: 'Get Relay transaction status and history. Filter by hash, request ID, or user address.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        hash: { type: 'string', description: 'Transaction hash to look up' },
        id: { type: 'string', description: 'Relay request ID' },
        user: { type: 'string', description: 'User address (defaults to wallet)' },
        originChainId: { type: 'number', description: 'Filter by origin chain' },
        destinationChainId: { type: 'number', description: 'Filter by destination chain' },
      },
    },
  },
  {
    name: 'relay_execute',
    description: 'Execute a same-chain swap or cross-chain bridge via Relay Protocol routing. Fetches a Relay quote, then signs and submits every transaction in the returned quote.steps using the configured EVM wallet. Supported origins: any of the 60+ EVM chains in viem/chains (Ink, Base, Arbitrum, Optimism, Ethereum mainnet, Polygon, BNB, Avalanche, Linea, Scroll, zkSync, Blast, Berachain, Mantle, etc.) — the same locally-held EVM private key signs for every EVM chain because addresses are derived deterministically from the keypair. Destination can be any EVM chain Relay supports. Useful for: (a) same-chain swaps where local DEX liquidity is thin (e.g. ETH→USDT0 on Ink where Tsunami pools are shallow), (b) cross-chain bridges between any two EVM chains using a single private key. Per-chain RPC URLs default to viem\'s baked-in defaults but can be overridden via the EVM_RPC_OVERRIDES env var (JSON map from chainId to RPC URL). Cross-chain bridges originating from non-EVM chains (Solana, Bitcoin, Tron, Hyperliquid, Lighter) are not supported — fetch a quote via relay_get_quote and submit the origin tx with the wallet on that chain.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        originChainId: { type: 'number', description: 'Origin EVM chain ID. Defaults to 57073 (Ink). Any chain in viem/chains works (8453 Base, 42161 Arbitrum, 1 Ethereum, etc.).' },
        destinationChainId: { type: 'number', description: 'Destination chain ID. Defaults to same as originChainId (for single-chain swaps). Can be any Relay-supported EVM chain.' },
        originCurrency: { type: 'string', description: 'Token address on origin chain. Use 0x0000000000000000000000000000000000000000 for native gas token.' },
        destinationCurrency: { type: 'string', description: 'Token address on destination chain' },
        amount: { type: 'string', description: 'Input amount in wei' },
        slippageBps: { type: 'number', description: 'Slippage tolerance in basis points (default: 100 = 1%). Forwarded to Relay.' },
        recipient: { type: 'string', description: 'Recipient address on the destination chain. Defaults to the configured EVM wallet (same address across all EVM chains).' },
      },
      required: ['originCurrency', 'destinationCurrency', 'amount'],
    },
  },
];

export async function handleRelayTool(name: string, args: Record<string, unknown>) {
  switch (name) {
    case 'relay_get_chains': {
      const data = await relayFetch('/chains');
      const chains = (data.chains ?? data).map((c: any) => ({
        id: c.id,
        name: c.displayName ?? c.name,
        nativeCurrency: c.currency?.symbol,
        depositEnabled: c.depositEnabled,
      }));
      return { count: chains.length, chains };
    }

    case 'relay_get_currencies': {
      const body: Record<string, unknown> = {};
      if (args.chainIds) body.chainIds = args.chainIds;
      if (args.term) body.term = args.term;
      if (args.address) body.address = args.address;
      if (args.verified !== undefined) body.verified = args.verified;
      else body.verified = true;
      body.limit = (args.limit as number) ?? 20;
      return relayFetch('/currencies/v1', 'POST', body);
    }

    case 'relay_get_quote': {
      const originChainId = args.originChainId as number | undefined;
      const destinationChainId = (args.destinationChainId as number | undefined) ?? originChainId;
      const user = (args.user as string) ?? await defaultUserForChain(originChainId);

      // Default recipient: EVM wallet for any EVM destination. For non-EVM
      // destinations (Solana, Bitcoin, etc.) require an explicit recipient
      // because inkonchain-mcp has no key for those chains.
      let recipient = args.recipient as string | undefined;
      if (!recipient && destinationChainId !== undefined) {
        if (UNSUPPORTED_NON_EVM_ORIGINS.has(destinationChainId)) {
          throw new Error(
            `Destination chain ${destinationChainId} is non-EVM. Pass \`recipient\` explicitly with an address valid on that chain.`,
          );
        }
        try { recipient = await getAccount(); } catch { /* no EVM key */ }
      }

      const body: Record<string, unknown> = {
        user,
        originChainId,
        destinationChainId,
        originCurrency: args.originCurrency,
        destinationCurrency: args.destinationCurrency,
        amount: args.amount,
        tradeType: (args.tradeType as string) ?? 'EXACT_INPUT',
      };
      if (recipient) body.recipient = recipient;
      return relayFetch('/quote', 'POST', body);
    }

    case 'relay_get_price': {
      const originChainId = args.originChainId as number | undefined;
      const destinationChainId = args.destinationChainId as number | undefined;
      const user = (args.user as string) ?? await defaultUserForChain(originChainId);

      // Same recipient-defaulting logic as relay_get_quote — Relay's /price
      // endpoint validates the user address against the destination chain,
      // so we need to pass a destination-appropriate recipient when the two
      // chains differ.
      let recipient: string | undefined;
      if (destinationChainId !== undefined) {
        if (UNSUPPORTED_NON_EVM_ORIGINS.has(destinationChainId)) {
          throw new Error(
            `Destination chain ${destinationChainId} is non-EVM. Pass a tool-specific recipient via relay_get_quote with explicit recipient instead.`,
          );
        }
        try { recipient = await getAccount(); } catch { /* no EVM key */ }
      }

      const body: Record<string, unknown> = {
        user,
        originChainId,
        destinationChainId,
        originCurrency: args.originCurrency,
        destinationCurrency: args.destinationCurrency,
        amount: args.amount,
        tradeType: (args.tradeType as string) ?? 'EXACT_INPUT',
      };
      if (recipient) body.recipient = recipient;
      return relayFetch('/price', 'POST', body);
    }

    case 'relay_get_token_price': {
      const chainId = args.chainId as number;
      const address = args.address as string;
      return relayFetch(`/currencies/token/price?chainId=${chainId}&address=${address}`);
    }

    case 'relay_get_requests': {
      const params: Record<string, string> = {};
      if (args.hash) params.hash = args.hash as string;
      if (args.id) params.id = args.id as string;
      if (args.user) {
        params.user = args.user as string;
      } else {
        const hintChainId = (args.originChainId as number | undefined) ?? (args.destinationChainId as number | undefined);
        try {
          params.user = await defaultUserForChain(hintChainId);
        } catch {
          /* no wallet for this chain — let Relay return all of them or 400 */
        }
      }
      if (args.originChainId) params.originChainId = String(args.originChainId);
      if (args.destinationChainId) params.destinationChainId = String(args.destinationChainId);
      return relayFetch('/requests/v2', 'GET', params);
    }

    case 'relay_execute': {
      // EVM-only signing path. Supported origins: any EVM chain in viem/chains.
      const originChainId = (args.originChainId as number) ?? INK_CHAIN_ID;
      const destinationChainId = (args.destinationChainId as number) ?? originChainId;

      if (UNSUPPORTED_NON_EVM_ORIGINS.has(originChainId)) {
        throw new Error(
          `Origin chain ${originChainId} is non-EVM and is not supported by relay_execute. ` +
          `Fetch a quote via relay_get_quote and submit the origin tx with the wallet on that chain.`,
        );
      }

      // Derive signer address from the local EVM key
      const pk = await getPrivateKey();
      if (!pk) {
        throw new Error('EVM origin requires a configured EVM private key. Set EVM_PRIVATE_KEY env or run `npx inkonchain-mcp-setup`.');
      }
      const user = privateKeyToAccount(pk as `0x${string}`).address;

      // Default recipient: configured EVM address (same across all EVM chains).
      // Non-EVM destinations require explicit recipient.
      let recipient = args.recipient as string | undefined;
      if (!recipient) {
        if (UNSUPPORTED_NON_EVM_ORIGINS.has(destinationChainId)) {
          throw new Error(
            `Destination chain ${destinationChainId} is non-EVM. Pass \`recipient\` explicitly with an address valid on that chain.`,
          );
        }
        recipient = user;
      }

      const quoteBody: Record<string, unknown> = {
        user,
        recipient,
        originChainId,
        destinationChainId,
        originCurrency: args.originCurrency,
        destinationCurrency: args.destinationCurrency,
        amount: args.amount,
        tradeType: 'EXACT_INPUT',
      };
      if (args.slippageBps !== undefined) {
        quoteBody.slippageTolerance = String(args.slippageBps);
      }

      const quote = await relayFetch('/quote', 'POST', quoteBody) as any;

      if (!quote?.steps || !Array.isArray(quote.steps)) {
        throw new Error(`Relay quote returned no executable steps: ${JSON.stringify(quote).slice(0, 500)}`);
      }

      // Execute every tx across all steps. Each item's chainId tells us
      // which chain to broadcast on — cached publicClient per chain ID.
      const submittedTxs: Array<{
        stepId: string;
        itemIndex: number;
        chainId: number;
        hash: Hash;
        status: string;
      }> = [];

      const publicClientCache = new Map<number, ReturnType<typeof getPublicClientForChain>>();
      for (const step of quote.steps) {
        if (!step.items || !Array.isArray(step.items)) continue;
        for (let i = 0; i < step.items.length; i++) {
          const item = step.items[i];
          if (item.status === 'complete') continue;
          const data = item.data;
          if (!data || !data.to || !data.data) {
            throw new Error(`Relay step "${step.id}" item ${i} has no executable data: ${JSON.stringify(item).slice(0, 300)}`);
          }
          const stepChainId = data.chainId !== undefined ? Number(data.chainId) : originChainId;
          const value = data.value ? BigInt(data.value) : 0n;

          const { hash } = await sendTxOnChain(stepChainId, {
            to: data.to as Address,
            data: data.data as `0x${string}`,
            value,
          });

          let pubClient = publicClientCache.get(stepChainId);
          if (!pubClient) {
            pubClient = getPublicClientForChain(stepChainId);
            publicClientCache.set(stepChainId, pubClient);
          }
          const receipt = await pubClient.waitForTransactionReceipt({ hash });

          submittedTxs.push({
            stepId: step.id,
            itemIndex: i,
            chainId: stepChainId,
            hash,
            status: receipt.status,
          });
          if (receipt.status !== 'success') {
            throw new Error(`Relay step "${step.id}" item ${i} reverted on chain ${stepChainId} (tx=${hash})`);
          }
        }
      }

      const details = quote.details ?? {};
      const fees = quote.fees ?? {};
      const lastTx = submittedTxs[submittedTxs.length - 1];
      let explorer: string | null = null;
      if (lastTx) {
        if (lastTx.chainId === INK_CHAIN_ID) {
          explorer = `https://explorer.inkonchain.com/tx/${lastTx.hash}`;
        } else {
          try {
            const chain = (await import('../client.js')).getChainByChainId(lastTx.chainId);
            const explorerUrl = chain.blockExplorers?.default?.url;
            if (explorerUrl) explorer = `${explorerUrl}/tx/${lastTx.hash}`;
          } catch {
            /* unknown chain, no explorer link */
          }
        }
      }

      return {
        success: true,
        requestId: (quote as any).request?.id ?? quote.id ?? null,
        txs: submittedTxs,
        currencyIn: details.currencyIn,
        currencyOut: details.currencyOut,
        rate: details.rate,
        totalImpact: details.totalImpact,
        fees,
        explorer,
        statusCheck: (quote as any).request?.id ? `${RELAY_API}/intents/status?requestId=${(quote as any).request.id}` : null,
      };
    }

    default:
      throw new Error(`Unknown relay tool: ${name}`);
  }
}
