import { type Address } from 'viem';
import { publicClient, serializeBigInts } from '../client.js';
import { CONTRACTS, X402_FACILITATOR_URL } from '../config.js';
import { X402FeeRouterABI } from '../abis/X402FeeRouter.js';

const ROUTERS = {
  USDC: CONTRACTS.X402FeeRouter as Address,
  USDT0: CONTRACTS.X402USDT0FeeRouter as Address,
} as const;

export const x402Tools = [
  {
    name: 'x402_health',
    description: 'Read health/config status from the configured x402 Ink facilitator service. Requires X402_FACILITATOR_URL.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'x402_supported',
    description: 'Read supported x402 payment requirements from the configured Ink facilitator. Advertises USDC exact payments on Ink.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'x402_quote',
    description: 'Quote x402 facilitator fee split for a gross USDC amount in base units. Requires X402_FACILITATOR_URL.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        amount: { type: 'string', description: 'Gross USDC amount in base units (6 decimals).' },
        feeBps: { type: 'number', description: 'Optional requested fee bps.' },
      },
      required: ['amount'],
    },
  },
  {
    name: 'x402_verify',
    description: 'POST an x402 paymentPayload + paymentRequirements to the configured facilitator /verify endpoint.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        paymentPayload: { type: 'object', description: 'x402 v2 payment payload.' },
        paymentRequirements: { type: 'object', description: 'x402 v2 payment requirements.' },
      },
      required: ['paymentPayload', 'paymentRequirements'],
    },
  },
  {
    name: 'x402_settle',
    description: 'POST an x402 paymentPayload + paymentRequirements to the configured facilitator /settle endpoint. Facilitator sponsors gas and settles through X402FeeRouter.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        paymentPayload: { type: 'object', description: 'x402 v2 payment payload.' },
        paymentRequirements: { type: 'object', description: 'x402 v2 payment requirements.' },
      },
      required: ['paymentPayload', 'paymentRequirements'],
    },
  },
  {
    name: 'x402_router_info',
    description: 'Read X402FeeRouter immutable config from Ink for USDC or USDT0: payment token, fee recipient, max fee bps, and min fee.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        asset: { type: 'string', description: 'Payment asset router to inspect: USDC or USDT0. Defaults to USDC.' },
      },
    },
  },
];

function facilitatorBase(): string {
  if (!X402_FACILITATOR_URL) {
    throw new Error('X402_FACILITATOR_URL is required for x402 facilitator HTTP tools.');
  }
  return X402_FACILITATOR_URL.replace(/\/$/, '');
}

async function facilitatorJson(path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${facilitatorBase()}${path}`, init);
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    throw new Error(`x402 facilitator ${path} failed: HTTP ${res.status} ${JSON.stringify(body)}`);
  }
  return body;
}

export async function handleX402Tool(name: string, args: Record<string, unknown>) {
  switch (name) {
    case 'x402_health':
      return facilitatorJson('/health');

    case 'x402_supported':
      return facilitatorJson('/supported');

    case 'x402_quote': {
      const amount = args.amount as string;
      const params = new URLSearchParams({ amount });
      if (args.feeBps !== undefined) params.set('feeBps', String(args.feeBps));
      return facilitatorJson(`/quote?${params.toString()}`);
    }

    case 'x402_verify':
      return facilitatorJson('/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentPayload: args.paymentPayload,
          paymentRequirements: args.paymentRequirements,
        }),
      });

    case 'x402_settle':
      return facilitatorJson('/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentPayload: args.paymentPayload,
          paymentRequirements: args.paymentRequirements,
        }),
      });

    case 'x402_router_info': {
      const requested = String(args.asset ?? 'USDC').toUpperCase();
      if (requested !== 'USDC' && requested !== 'USDT0') {
        throw new Error(`Unsupported x402 asset "${requested}". Use USDC or USDT0.`);
      }
      const router = ROUTERS[requested];
      const [usdc, feeRecipient, maxFeeBps, minFee] = await Promise.all([
        publicClient.readContract({ address: router, abi: X402FeeRouterABI, functionName: 'USDC' }),
        publicClient.readContract({ address: router, abi: X402FeeRouterABI, functionName: 'FEE_RECIPIENT' }),
        publicClient.readContract({ address: router, abi: X402FeeRouterABI, functionName: 'MAX_FEE_BPS' }),
        publicClient.readContract({ address: router, abi: X402FeeRouterABI, functionName: 'MIN_FEE' }),
      ]);
      return serializeBigInts({
        asset: requested,
        router,
        paymentToken: usdc,
        feeRecipient,
        maxFeeBps,
        minFee,
        knownPaymentTokens: {
          USDC: CONTRACTS.USDC,
          USDT0: CONTRACTS.USDT0,
        },
      });
    }

    default:
      throw new Error(`Unknown x402 tool: ${name}`);
  }
}
