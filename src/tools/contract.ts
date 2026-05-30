import { encodeFunctionData, type Abi, type Address } from 'viem';
import { publicClient, sendTx } from '../client.js';
import { CONTRACTS } from '../config.js';
import { ERC20ABI } from '../abis/ERC20.js';
import { SentryLaunchFactoryABI } from '../abis/SentryLaunchFactory.js';
import { TsunamiV3FactoryABI } from '../abis/TsunamiV3Factory.js';
import { TsunamiV3PoolABI } from '../abis/TsunamiV3Pool.js';
import { TsunamiV3PositionManagerABI } from '../abis/TsunamiV3PositionManager.js';
import { TsunamiQuoterV2ABI } from '../abis/TsunamiQuoterV2.js';
import { TsunamiSwapRouter02ABI } from '../abis/TsunamiSwapRouter02.js';
import { IdentityRegistryABI } from '../abis/IdentityRegistry.js';

type KnownContract = keyof typeof ALLOWLIST;

const ALLOWLIST = {
  erc20: {
    abi: ERC20ABI,
    address: undefined as Address | undefined,
    reads: ['name', 'symbol', 'decimals', 'totalSupply', 'balanceOf', 'allowance'],
    writes: ['approve', 'transfer'],
  },
  sentry: {
    abi: SentryLaunchFactoryABI,
    address: CONTRACTS.SentryLaunchFactory as Address,
    reads: [
      'owner', 'treasury', 'npm', 'identityRegistry', 'krakenVerifiedRegistry',
      'protocolFeeController', 'creatorFeeBps', 'getSupportedBaseTokens',
      'getPoolManager', 'getCreator', 'getCreatorNFTs', 'getCreatorNFTCount',
      'getTokenByNFT', 'getTotalTokensDeployed', 'isAgentPosition',
      'isKrakenVerifiedPosition', 'isGoPumpMePosition',
    ],
    writes: ['launch', 'launchAgent', 'launchKrakenVerified', 'launchGoPumpMe'],
  },
  tsunami_factory: {
    abi: TsunamiV3FactoryABI,
    address: CONTRACTS.TsunamiV3Factory as Address,
    reads: ['owner', 'getPool', 'feeAmountTickSpacing'],
    writes: [],
  },
  tsunami_pool: {
    abi: TsunamiV3PoolABI,
    address: undefined as Address | undefined,
    reads: ['slot0', 'liquidity', 'token0', 'token1', 'fee', 'tickSpacing'],
    writes: [],
  },
  tsunami_position_manager: {
    abi: TsunamiV3PositionManagerABI,
    address: CONTRACTS.TsunamiV3PositionManager as Address,
    reads: ['positions', 'balanceOf', 'tokenOfOwnerByIndex', 'ownerOf'],
    writes: [],
  },
  tsunami_quoter: {
    abi: TsunamiQuoterV2ABI,
    address: CONTRACTS.TsunamiQuoterV2 as Address,
    reads: ['quoteExactInputSingle', 'quoteExactInput', 'quoteExactOutputSingle', 'quoteExactOutput'],
    writes: [],
  },
  tsunami_router: {
    abi: TsunamiSwapRouter02ABI,
    address: CONTRACTS.TsunamiSwapRouter02 as Address,
    reads: [],
    writes: ['exactInputSingle', 'exactInput', 'exactOutputSingle', 'exactOutput', 'multicall'],
  },
  identity: {
    abi: IdentityRegistryABI,
    address: CONTRACTS.IdentityRegistry as Address,
    reads: ['balanceOf', 'ownerOf', 'agentURI', 'totalSupply', 'tokenOfOwnerByIndex'],
    writes: ['register', 'setAgentURI'],
  },
} as const;

export const contractTools = [
  {
    name: 'contract_read',
    description: 'Guarded generic contract read for known Ink protocol ABIs only. Select contractKey and a read-allowlisted function; optional address is only allowed for erc20 and tsunami_pool.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        contractKey: { type: 'string', description: `One of: ${Object.keys(ALLOWLIST).join(', ')}` },
        functionName: { type: 'string', description: 'Read function name from that contract allowlist.' },
        args: { type: 'array', items: {}, description: 'Function arguments in ABI order.' },
        address: { type: 'string', description: 'Override address for erc20 or tsunami_pool only.' },
      },
      required: ['contractKey', 'functionName'],
    },
  },
  {
    name: 'contract_write',
    description: 'Guarded generic contract write for known Ink protocol ABIs only. Refuses arbitrary calldata and only allows explicitly allowlisted write functions.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        contractKey: { type: 'string', description: `One of: ${Object.keys(ALLOWLIST).join(', ')}` },
        functionName: { type: 'string', description: 'Write function name from that contract allowlist.' },
        args: { type: 'array', items: {}, description: 'Function arguments in ABI order.' },
        address: { type: 'string', description: 'Override address for erc20 only.' },
        value: { type: 'string', description: 'Optional native ETH value in wei.' },
      },
      required: ['contractKey', 'functionName'],
    },
  },
];

function getSpec(contractKey: unknown): (typeof ALLOWLIST)[KnownContract] {
  if (typeof contractKey !== 'string' || !(contractKey in ALLOWLIST)) {
    throw new Error(`Unsupported contractKey "${String(contractKey)}". Allowed: ${Object.keys(ALLOWLIST).join(', ')}`);
  }
  return ALLOWLIST[contractKey as KnownContract];
}

function getAddress(contractKey: unknown, address: unknown): Address {
  const spec = getSpec(contractKey);
  if (address !== undefined) {
    if (contractKey !== 'erc20' && contractKey !== 'tsunami_pool') {
      throw new Error(`Address override is only allowed for erc20 and tsunami_pool.`);
    }
    return address as Address;
  }
  if (!spec.address) throw new Error(`address is required for ${String(contractKey)}.`);
  return spec.address;
}

function assertAllowed(functionName: unknown, allowed: readonly string[], mode: 'read' | 'write') {
  if (typeof functionName !== 'string' || !allowed.includes(functionName)) {
    throw new Error(`${mode} function "${String(functionName)}" is not allowlisted. Allowed: ${allowed.join(', ')}`);
  }
}

export async function handleContractTool(name: string, args: Record<string, unknown>) {
  const spec = getSpec(args.contractKey);
  const address = getAddress(args.contractKey, args.address);
  const functionName = args.functionName as string;
  const fnArgs = (args.args as unknown[] | undefined) ?? [];

  switch (name) {
    case 'contract_read': {
      assertAllowed(functionName, spec.reads, 'read');
      const result = await publicClient.readContract({
        address,
        abi: spec.abi as Abi,
        functionName,
        args: fnArgs,
      });
      return { contractKey: args.contractKey, address, functionName, result };
    }
    case 'contract_write': {
      assertAllowed(functionName, spec.writes, 'write');
      const data = encodeFunctionData({
        abi: spec.abi as Abi,
        functionName,
        args: fnArgs,
      });
      const { hash } = await sendTx({
        to: address,
        data,
        value: args.value ? BigInt(args.value as string) : 0n,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      return { contractKey: args.contractKey, address, functionName, hash, status: receipt.status };
    }
    default:
      throw new Error(`Unknown contract tool: ${name}`);
  }
}
