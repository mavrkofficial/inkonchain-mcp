import { type Address, decodeEventLog, encodeFunctionData, formatUnits } from 'viem';
import { publicClient, getAccount, sendTx, serializeBigInts } from '../client.js';
import { CONTRACTS, SENTRY_API_BASE } from '../config.js';
import { SentryLaunchFactoryABI } from '../abis/SentryLaunchFactory.js';
import { IdentityRegistryABI } from '../abis/IdentityRegistry.js';
import { ERC20ABI } from '../abis/ERC20.js';
import { TsunamiV3PositionManagerABI } from '../abis/TsunamiV3PositionManager.js';

const FACTORY = CONTRACTS.SentryLaunchFactory as Address;
const WETH9 = CONTRACTS.WETH9 as Address;
const USDT0 = CONTRACTS.USDT0 as Address;
const IDENTITY_REGISTRY = CONTRACTS.IdentityRegistry as Address;
const NPM = CONTRACTS.TsunamiV3PositionManager as Address;

/**
 * Register a freshly-deployed Sentry token with the public Ink ecosystem
 * indexer so it shows up on downstream frontends (nami.ink, sentry.trading,
 * etc.). Anonymous-friendly as of the SentryBot backend change at commit
 * e8b4218 — no `MOLTING_API_KEY` is required, but if one is configured it
 * is forwarded as a bearer token so the token also lands in the caller's
 * authenticated internal tracking tables.
 *
 * Non-fatal: any network or backend error is swallowed so a successful
 * on-chain launch is never reported as failed just because the indexer
 * call hiccupped.
 */
async function registerTokenWithIndexer(params: {
  tokenName: string;
  symbol: string;
  tokenAddress: string;
  tokenId?: string;
  txHash: string;
  creator: string;
  deploymentOrigin?: 'autonomous' | 'owner-prompted';
}): Promise<void> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const apiKey = process.env.MOLTING_API_KEY;
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    await fetch(`${SENTRY_API_BASE}/api/molting/register-token`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: params.tokenName,
        symbol: params.symbol,
        contractAddress: params.tokenAddress,
        nftTokenId: params.tokenId,
        txHash: params.txHash,
        creator: params.creator,
        deploymentOrigin: params.deploymentOrigin ?? 'autonomous',
      }),
    });
  } catch (_) {
    /* non-fatal — on-chain launch already succeeded */
  }
}

export const sentryTools = [
  {
    name: 'sentry_launch',
    description: 'Permissionless token launch via Sentry. Defaults to WETH base. Deploys an ERC20 token, creates a Tsunami V3 pool (1% fee tier), mints a single-sided LP NFT held permanently inside the factory, and auto-enables Tsunami protocol fees on the pool.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Token name' },
        symbol: { type: 'string', description: 'Token symbol' },
        baseToken: { type: 'string', description: 'Base pair token address. Defaults to WETH.' },
      },
      required: ['name', 'symbol'],
    },
  },
  {
    name: 'sentry_launch_agent',
    description: 'Agent-only token launch via Sentry. Gated by an ERC-8004 identity NFT on Ink (register via identity_register first). Defaults to USDT0 base so agents launch USDT0-denominated markets (~$5K starting FDV via the current USDT0 pool manager). Creator rewards are paid from the base-token side.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Token name' },
        symbol: { type: 'string', description: 'Token symbol' },
        baseToken: { type: 'string', description: 'Base pair token address. Defaults to USDT0.' },
      },
      required: ['name', 'symbol'],
    },
  },
  {
    name: 'sentry_launch_agent_usdt0',
    description: 'Convenience tool for ERC-8004-gated agent launches using USDT0 as the base pair. Creates a USDT0-denominated agent token market (~$5K starting FDV) and pays creator rewards from the USDT0/base side.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Token name' },
        symbol: { type: 'string', description: 'Token symbol' },
      },
      required: ['name', 'symbol'],
    },
  },
  {
    name: 'sentry_launch_kraken_verified',
    description: 'Kraken Verified launch. Requires the caller to pass the Kraken verification registry canLaunch check, and deploys a restricted-transfer token whose transfers are checked by the Kraken verification registry.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Token name' },
        symbol: { type: 'string', description: 'Token symbol' },
        baseToken: { type: 'string', description: 'Base pair token address. Defaults to WETH.' },
      },
      required: ['name', 'symbol'],
    },
  },
  {
    name: 'sentry_launch_gopumpme',
    description: 'GoPumpMe launch. Requires a Kraken Verified deployer but creates an openly-tradable token. WETH/base-side LP fees route 100% to the creator; launched-token-side fees route to treasury.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Token name' },
        symbol: { type: 'string', description: 'Token symbol' },
        baseToken: { type: 'string', description: 'Base pair token address. Defaults to WETH.' },
      },
      required: ['name', 'symbol'],
    },
  },
  {
    name: 'sentry_get_creator_nfts',
    description: 'Get all LP NFT IDs for tokens launched by a specific creator address.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        creator: { type: 'string', description: 'Creator address (defaults to wallet)' },
      },
    },
  },
  {
    name: 'sentry_get_token_by_nft',
    description: 'Get the token address associated with an LP NFT ID.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        tokenId: { type: 'string', description: 'LP NFT token ID' },
      },
      required: ['tokenId'],
    },
  },
  {
    name: 'sentry_get_supported_base_tokens',
    description: 'Get list of supported base tokens for launches. Current supported bases include WETH and USDT0.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'sentry_get_pool_manager',
    description: 'Get the pool manager contract for a supported base token.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        baseToken: { type: 'string', description: 'Base token address (e.g. WETH or USDT0)' },
      },
      required: ['baseToken'],
    },
  },
  {
    name: 'sentry_get_factory_config',
    description: 'Read SentryLaunchFactory configuration: owner, treasury, creator fee bps, protocol fee controller, Kraken registry, identity registry, and supported base tokens.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'sentry_get_launch_type',
    description: 'Read launch type flags for an LP NFT token ID: agent, Kraken Verified, GoPumpMe, creator, and token address.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        tokenId: { type: 'string', description: 'LP NFT token ID' },
      },
      required: ['tokenId'],
    },
  },
  {
    name: 'sentry_get_agent_launch_readiness',
    description: 'Check whether a wallet is ready to launch an ERC-8004-gated USDT0 agent token: identity NFT, ETH gas balance, USDT0 balance, factory support, and active pool manager.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        wallet: { type: 'string', description: 'Wallet address to check. Defaults to configured wallet.' },
        baseToken: { type: 'string', description: 'Base token to check. Defaults to USDT0.' },
      },
    },
  },
  {
    name: 'sentry_get_creator_fee_status',
    description: 'Read a creator wallet’s Sentry LP NFT IDs and current uncollected position fee counters for each one. Useful before sentry_collect_fees.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        creator: { type: 'string', description: 'Creator address. Defaults to configured wallet.' },
      },
    },
  },
  {
    name: 'sentry_get_total_deployed',
    description: 'Get the total number of tokens deployed through SentryLaunchFactory.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'sentry_collect_fees',
    description: 'Collect trading fees from factory-held LP positions. Owner only. Launched-token-side fees go to treasury; base-token-side fees split by creatorFeeBps, except GoPumpMe positions where base-side fees route 100% to creator.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        tokenIds: { type: 'array', items: { type: 'string' }, description: 'Array of LP NFT token IDs' },
      },
      required: ['tokenIds'],
    },
  },
];

async function launchToken(params: {
  functionName: 'launch' | 'launchAgent' | 'launchKrakenVerified' | 'launchGoPumpMe';
  tokenName: string;
  symbol: string;
  baseToken: Address;
  deploymentOrigin: 'autonomous' | 'owner-prompted';
}) {
  const data = encodeFunctionData({
    abi: SentryLaunchFactoryABI,
    functionName: params.functionName,
    args: [params.tokenName, params.symbol, params.baseToken],
  });
  const { hash } = await sendTx({ to: FACTORY, data });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  let tokenAddress: string | undefined;
  let tokenId: string | undefined;
  for (const log of receipt.logs) {
    try {
      const event = decodeEventLog({
        abi: SentryLaunchFactoryABI,
        data: log.data,
        topics: log.topics,
      });
      if (event.eventName === 'TokenDeployed') {
        const eventArgs = event.args as { token: Address; tokenId: bigint };
        tokenAddress = eventArgs.token;
        tokenId = eventArgs.tokenId.toString();
      }
    } catch {
      /* not our event */
    }
  }

  if (tokenAddress) {
    await registerTokenWithIndexer({
      tokenName: params.tokenName,
      symbol: params.symbol,
      tokenAddress,
      tokenId,
      txHash: hash,
      creator: await getAccount(),
      deploymentOrigin: params.deploymentOrigin,
    });
  }

  return {
    hash,
    status: receipt.status,
    tokenAddress,
    tokenId,
    baseToken: params.baseToken,
    launchFunction: params.functionName,
  };
}

export async function handleSentryTool(name: string, args: Record<string, unknown>) {
  switch (name) {
    case 'sentry_launch': {
      const tokenName = args.name as string;
      const symbol = args.symbol as string;
      const baseToken = (args.baseToken as Address | undefined) ?? WETH9;
      return launchToken({ functionName: 'launch', tokenName, symbol, baseToken, deploymentOrigin: 'owner-prompted' });
    }

    case 'sentry_launch_agent': {
      const tokenName = args.name as string;
      const symbol = args.symbol as string;
      const baseToken = (args.baseToken as Address | undefined) ?? USDT0;
      return launchToken({ functionName: 'launchAgent', tokenName, symbol, baseToken, deploymentOrigin: 'autonomous' });
    }

    case 'sentry_launch_agent_usdt0': {
      const tokenName = args.name as string;
      const symbol = args.symbol as string;
      return launchToken({ functionName: 'launchAgent', tokenName, symbol, baseToken: USDT0, deploymentOrigin: 'autonomous' });
    }

    case 'sentry_launch_kraken_verified': {
      const tokenName = args.name as string;
      const symbol = args.symbol as string;
      const baseToken = (args.baseToken as Address | undefined) ?? WETH9;
      return launchToken({ functionName: 'launchKrakenVerified', tokenName, symbol, baseToken, deploymentOrigin: 'owner-prompted' });
    }

    case 'sentry_launch_gopumpme': {
      const tokenName = args.name as string;
      const symbol = args.symbol as string;
      const baseToken = (args.baseToken as Address | undefined) ?? WETH9;
      return launchToken({ functionName: 'launchGoPumpMe', tokenName, symbol, baseToken, deploymentOrigin: 'owner-prompted' });
    }

    case 'sentry_get_creator_nfts': {
      const creator = (args.creator as Address) ?? await getAccount();
      const nfts = await publicClient.readContract({
        address: FACTORY, abi: SentryLaunchFactoryABI, functionName: 'getCreatorNFTs', args: [creator],
      });
      return { creator, nfts: (nfts as bigint[]).map(String) };
    }

    case 'sentry_get_token_by_nft': {
      const tokenId = BigInt(args.tokenId as string);
      const tokenAddress = await publicClient.readContract({
        address: FACTORY, abi: SentryLaunchFactoryABI, functionName: 'getTokenByNFT', args: [tokenId],
      });
      return { tokenId: tokenId.toString(), tokenAddress };
    }

    case 'sentry_get_supported_base_tokens': {
      const tokens = await publicClient.readContract({
        address: FACTORY, abi: SentryLaunchFactoryABI, functionName: 'getSupportedBaseTokens',
      });
      return { baseTokens: tokens };
    }

    case 'sentry_get_pool_manager': {
      const baseToken = args.baseToken as Address;
      const poolManager = await publicClient.readContract({
        address: FACTORY, abi: SentryLaunchFactoryABI, functionName: 'getPoolManager', args: [baseToken],
      });
      return { baseToken, poolManager };
    }

    case 'sentry_get_factory_config': {
      const [
        owner,
        treasury,
        npm,
        identityRegistry,
        krakenVerifiedRegistry,
        protocolFeeController,
        creatorFeeBps,
        supportedBaseTokens,
      ] = await Promise.all([
        publicClient.readContract({ address: FACTORY, abi: SentryLaunchFactoryABI, functionName: 'owner' }),
        publicClient.readContract({ address: FACTORY, abi: SentryLaunchFactoryABI, functionName: 'treasury' }),
        publicClient.readContract({ address: FACTORY, abi: SentryLaunchFactoryABI, functionName: 'npm' }),
        publicClient.readContract({ address: FACTORY, abi: SentryLaunchFactoryABI, functionName: 'identityRegistry' }),
        publicClient.readContract({ address: FACTORY, abi: SentryLaunchFactoryABI, functionName: 'krakenVerifiedRegistry' }),
        publicClient.readContract({ address: FACTORY, abi: SentryLaunchFactoryABI, functionName: 'protocolFeeController' }),
        publicClient.readContract({ address: FACTORY, abi: SentryLaunchFactoryABI, functionName: 'creatorFeeBps' }),
        publicClient.readContract({ address: FACTORY, abi: SentryLaunchFactoryABI, functionName: 'getSupportedBaseTokens' }),
      ]);
      return serializeBigInts({
        factory: FACTORY,
        owner,
        treasury,
        npm,
        identityRegistry,
        krakenVerifiedRegistry,
        protocolFeeController,
        creatorFeeBps,
        supportedBaseTokens,
        knownBaseTokens: {
          WETH9,
          USDT0,
        },
      });
    }

    case 'sentry_get_launch_type': {
      const tokenId = BigInt(args.tokenId as string);
      const [creator, tokenAddress, isAgent, isKrakenVerified, isGoPumpMe] = await Promise.all([
        publicClient.readContract({ address: FACTORY, abi: SentryLaunchFactoryABI, functionName: 'getCreator', args: [tokenId] }),
        publicClient.readContract({ address: FACTORY, abi: SentryLaunchFactoryABI, functionName: 'getTokenByNFT', args: [tokenId] }),
        publicClient.readContract({ address: FACTORY, abi: SentryLaunchFactoryABI, functionName: 'isAgentPosition', args: [tokenId] }),
        publicClient.readContract({ address: FACTORY, abi: SentryLaunchFactoryABI, functionName: 'isKrakenVerifiedPosition', args: [tokenId] }),
        publicClient.readContract({ address: FACTORY, abi: SentryLaunchFactoryABI, functionName: 'isGoPumpMePosition', args: [tokenId] }),
      ]);
      return { tokenId: tokenId.toString(), creator, tokenAddress, isAgent, isKrakenVerified, isGoPumpMe };
    }

    case 'sentry_get_agent_launch_readiness': {
      const wallet = (args.wallet as Address | undefined) ?? await getAccount();
      const baseToken = (args.baseToken as Address | undefined) ?? USDT0;
      const [
        identityBalance,
        ethBalance,
        baseBalance,
        baseDecimals,
        baseSymbol,
        poolManager,
        creatorFeeBps,
        protocolFeeController,
      ] = await Promise.all([
        publicClient.readContract({ address: IDENTITY_REGISTRY, abi: IdentityRegistryABI, functionName: 'balanceOf', args: [wallet] }),
        publicClient.getBalance({ address: wallet }),
        publicClient.readContract({ address: baseToken, abi: ERC20ABI, functionName: 'balanceOf', args: [wallet] }),
        publicClient.readContract({ address: baseToken, abi: ERC20ABI, functionName: 'decimals' }),
        publicClient.readContract({ address: baseToken, abi: ERC20ABI, functionName: 'symbol' }),
        publicClient.readContract({ address: FACTORY, abi: SentryLaunchFactoryABI, functionName: 'getPoolManager', args: [baseToken] }),
        publicClient.readContract({ address: FACTORY, abi: SentryLaunchFactoryABI, functionName: 'creatorFeeBps' }),
        publicClient.readContract({ address: FACTORY, abi: SentryLaunchFactoryABI, functionName: 'protocolFeeController' }),
      ]);
      const zero = '0x0000000000000000000000000000000000000000';
      return serializeBigInts({
        wallet,
        baseToken,
        baseSymbol,
        hasIdentity: (identityBalance as bigint) > 0n,
        identityCount: identityBalance,
        ethBalanceWei: ethBalance,
        ethBalanceFormatted: formatUnits(ethBalance, 18),
        baseBalance,
        baseBalanceFormatted: formatUnits(baseBalance as bigint, baseDecimals as number),
        poolManager,
        baseTokenSupported: String(poolManager).toLowerCase() !== zero,
        creatorFeeBps,
        protocolFeeController,
        ready: (identityBalance as bigint) > 0n && String(poolManager).toLowerCase() !== zero && ethBalance > 0n,
      });
    }

    case 'sentry_get_creator_fee_status': {
      const creator = (args.creator as Address | undefined) ?? await getAccount();
      const nfts = await publicClient.readContract({
        address: FACTORY, abi: SentryLaunchFactoryABI, functionName: 'getCreatorNFTs', args: [creator],
      }) as bigint[];
      const positions = await Promise.all(nfts.map(async (tokenId) => {
        const [tokenAddress, isAgent, isKrakenVerified, isGoPumpMe, position] = await Promise.all([
          publicClient.readContract({ address: FACTORY, abi: SentryLaunchFactoryABI, functionName: 'getTokenByNFT', args: [tokenId] }),
          publicClient.readContract({ address: FACTORY, abi: SentryLaunchFactoryABI, functionName: 'isAgentPosition', args: [tokenId] }),
          publicClient.readContract({ address: FACTORY, abi: SentryLaunchFactoryABI, functionName: 'isKrakenVerifiedPosition', args: [tokenId] }),
          publicClient.readContract({ address: FACTORY, abi: SentryLaunchFactoryABI, functionName: 'isGoPumpMePosition', args: [tokenId] }),
          publicClient.readContract({ address: NPM, abi: TsunamiV3PositionManagerABI, functionName: 'positions', args: [tokenId] }),
        ]);
        const pos = position as readonly unknown[];
        return {
          tokenId: tokenId.toString(),
          tokenAddress,
          isAgent,
          isKrakenVerified,
          isGoPumpMe,
          token0: pos[2],
          token1: pos[3],
          fee: pos[4],
          liquidity: pos[7],
          tokensOwed0: pos[10],
          tokensOwed1: pos[11],
        };
      }));
      return serializeBigInts({ creator, count: nfts.length, positions });
    }

    case 'sentry_get_total_deployed': {
      const count = await publicClient.readContract({
        address: FACTORY, abi: SentryLaunchFactoryABI, functionName: 'getTotalTokensDeployed',
      });
      return { totalDeployed: count.toString() };
    }

    case 'sentry_collect_fees': {
      const tokenIds = (args.tokenIds as string[]).map(BigInt);
      let data: `0x${string}`;
      if (tokenIds.length === 1) {
        data = encodeFunctionData({
          abi: SentryLaunchFactoryABI, functionName: 'collectFees',
          args: [tokenIds[0]],
        });
      } else {
        data = encodeFunctionData({
          abi: SentryLaunchFactoryABI, functionName: 'collectMultipleFees',
          args: [tokenIds],
        });
      }
      const { hash } = await sendTx({ to: FACTORY, data });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      return { hash, status: receipt.status, tokenIds: tokenIds.map(String) };
    }

    default:
      throw new Error(`Unknown sentry tool: ${name}`);
  }
}
