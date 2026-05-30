import { type Address, type Hex, toHex } from 'viem';
import { publicClient, serializeBigInts, getWalletClient } from '../client.js';
import { CONTRACTS, X402_FACILITATOR_URL, DEFAULT_X402_ASSET } from '../config.js';
import { X402FeeRouterABI } from '../abis/X402FeeRouter.js';

const ROUTERS = {
  USDC: CONTRACTS.X402FeeRouter as Address,
  USDT0: CONTRACTS.X402USDT0FeeRouter as Address,
} as const;

const ASSET_TOKENS = {
  USDC: CONTRACTS.USDC as Address,
  USDT0: CONTRACTS.USDT0 as Address,
} as const;

export type X402Asset = keyof typeof ROUTERS;

const ERC20_DOMAIN_ABI = [
  { type: 'function', name: 'name', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'version', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
] as const;

const RECEIVE_WITH_AUTHORIZATION_TYPES = {
  ReceiveWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const;

function freshNonce(): Hex {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return toHex(bytes);
}

function normalizeAsset(value: unknown): X402Asset {
  const upper = String(value ?? DEFAULT_X402_ASSET).toUpperCase();
  if (upper !== 'USDC' && upper !== 'USDT0') {
    throw new Error(`Unsupported x402 asset "${upper}". Use USDC or USDT0.`);
  }
  return upper;
}

/**
 * Build, sign (EIP-3009 ReceiveWithAuthorization), and settle an x402 `exact`
 * stablecoin payment on Ink through the configured facilitator. The signed
 * `to` is the asset's X402FeeRouter (NOT the seller) — the router pulls the
 * funds, takes the protocol fee, and forwards the net to the seller. The
 * facilitator sponsors the settlement gas, so the payer needs no ETH and no
 * prior ERC-20 approval. Returns the parsed facilitator `/settle` response.
 */
export async function payExact(params: {
  asset: X402Asset;
  amount: bigint;
  seller: Address;
  feeBps?: number;
  timeoutSeconds?: number;
  resource?: string;
}): Promise<Record<string, unknown>> {
  const router = ROUTERS[params.asset];
  const token = ASSET_TOKENS[params.asset];
  const wc = await getWalletClient();
  const account = wc.account;
  if (!account) throw new Error('No wallet account available for x402 payment.');

  const [name, version] = await Promise.all([
    publicClient.readContract({ address: token, abi: ERC20_DOMAIN_ABI, functionName: 'name' }),
    publicClient.readContract({ address: token, abi: ERC20_DOMAIN_ABI, functionName: 'version' }),
  ]) as [string, string];

  const nowSec = Math.floor(Date.now() / 1000);
  const timeout = params.timeoutSeconds ?? 600;
  const validAfter = BigInt(nowSec - 60);
  const validBefore = BigInt(nowSec + timeout);
  const nonce = freshNonce();
  const value = params.amount;

  const signature = await wc.signTypedData({
    account,
    domain: { name, version, chainId: 57073, verifyingContract: token },
    types: RECEIVE_WITH_AUTHORIZATION_TYPES,
    primaryType: 'ReceiveWithAuthorization',
    message: { from: account.address, to: router, value, validAfter, validBefore, nonce },
  });

  const paymentPayload = {
    x402Version: 2,
    scheme: 'exact',
    network: 'ink',
    payload: {
      signature,
      authorization: {
        from: account.address,
        to: router,
        value: value.toString(),
        validAfter: validAfter.toString(),
        validBefore: validBefore.toString(),
        nonce,
      },
    },
  };

  const paymentRequirements = {
    scheme: 'exact',
    network: 'ink',
    maxAmountRequired: value.toString(),
    resource: params.resource ?? 'mcp://inkonchain/x402_pay',
    description: `x402 ${params.asset} payment via inkonchain-mcp`,
    payTo: router,
    maxTimeoutSeconds: timeout,
    asset: token,
    extra: {
      seller: params.seller,
      ...(params.feeBps !== undefined ? { feeBps: params.feeBps } : {}),
    },
  };

  const result = (await facilitatorJson('/settle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentPayload, paymentRequirements }),
  })) as Record<string, unknown>;

  return result;
}

export const x402Tools = [
  {
    name: 'x402_health',
    description: 'Read health/config status from the configured x402 Ink facilitator service. Requires X402_FACILITATOR_URL.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'x402_supported',
    description: 'Read supported x402 payment requirements from the configured Ink facilitator. Advertises USDC and USDT0 exact payments on Ink.',
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
        asset: { type: 'string', description: 'Payment asset router to inspect: USDT0 (default) or USDC.' },
      },
    },
  },
  {
    name: 'x402_pay',
    description: 'Build, sign, and settle an x402 "exact" stablecoin payment on Ink to a seller. Signs an EIP-3009 ReceiveWithAuthorization with the configured wallet (no prior ERC-20 approval and no ETH needed — the facilitator sponsors gas), then settles through the asset X402FeeRouter which forwards the net to the seller and the protocol fee to the fee recipient. Useful for agent-to-agent payments and paying for metered services.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        seller: { type: 'string', description: 'Recipient (seller) address that receives the net amount.' },
        amount: { type: 'string', description: 'Gross payment amount in base units of the asset (USDT0 and USDC both use 6 decimals, so 50000 = 0.05).' },
        asset: { type: 'string', description: 'Payment asset: USDT0 (default) or USDC.' },
        feeBps: { type: 'number', description: 'Optional requested protocol fee bps (clamped by the router maxFeeBps).' },
      },
      required: ['seller', 'amount'],
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

    case 'x402_pay': {
      const seller = args.seller as Address;
      if (!seller) throw new Error('seller address is required.');
      const amount = BigInt(args.amount as string);
      const asset = normalizeAsset(args.asset);
      const feeBps = args.feeBps !== undefined ? Number(args.feeBps) : undefined;
      const result = await payExact({ asset, amount, seller, feeBps });
      return serializeBigInts({ asset, seller, amount: amount.toString(), settle: result });
    }

    case 'x402_router_info': {
      const requested = normalizeAsset(args.asset);
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
