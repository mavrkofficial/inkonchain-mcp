// Library entry point for downstream MCP packages that want to compose
// individual tool modules instead of running the full inkonchain-mcp server.
//
// `inkonchain-mcp` itself is a binary (`bin: dist/index.js`) — running it
// stands up a stdio MCP server with all ~91 tools registered. Packages that
// want a tighter surface (e.g. `gm-mcp` which only ships the DailyGM family)
// should depend on this package and import from `inkonchain-mcp/lib` instead
// of spawning the binary, then register only the tool modules they want.
//
// Versioning policy: anything exported from this file is part of the public
// library API. Breaking changes here are major-version bumps. Tool names,
// schemas, and runtime behavior follow the same compatibility guarantees as
// the binary.

export {
  publicClient,
  getAccount,
  getWalletClient,
  sendTx,
  getChainByChainId,
  getPublicClientForChain,
  getWalletClientForChain,
  sendTxOnChain,
  serializeBigInts,
} from './client.js';

export {
  ink,
  CONTRACTS,
  SUBGRAPH_URL,
  SENTRY_API_BASE,
  DEFAULT_SLIPPAGE_BPS,
  DEFAULT_DEADLINE_MINUTES,
  FEE_TIERS,
  DAILY_GM_PLUS_FEE_WEI,
  DAILY_GM_SUBGRAPH_URL,
  DAILY_AGENT_GM_SUBGRAPH_URL,
  DAILY_GM_PLUS_SUBGRAPH_URL,
  X402_FACILITATOR_URL,
  DEFAULT_X402_ASSET,
  getDailyGmPlusMaxDailySpendWei,
} from './config.js';

export { getPrivateKey } from './keychain.js';

// ── Tool modules ──────────────────────────────────────────────────
//
// Each module exports `<name>Tools` (the array of MCP tool definitions
// suitable for ListToolsResult.tools) and `handle<Name>Tool(name, args)`
// (the switch handler that routes to the right implementation).

export { dailyGmTools,   handleDailyGmTool   } from './tools/dailygm.js';
export { erc20Tools,     handleErc20Tool     } from './tools/erc20.js';
export { identityTools,  handleIdentityTool  } from './tools/identity.js';
export { relayTools,     handleRelayTool     } from './tools/relay.js';
export { sentryTools,    handleSentryTool    } from './tools/sentry.js';
export { subgraphTools,  handleSubgraphTool  } from './tools/subgraph.js';
export { tsunamiTools,   handleTsunamiTool   } from './tools/tsunami.js';
export { znsTools,       handleZnsTool       } from './tools/zns.js';
export { walletTools,    handleWalletTool    } from './tools/wallet.js';
export { contractTools,  handleContractTool  } from './tools/contract.js';
export { x402Tools,      handleX402Tool      } from './tools/x402.js';
export { analyticsTools, handleAnalyticsTool } from './tools/analytics.js';

// ── ABIs (occasionally useful for downstream typing) ──────────────
export { DailyGMABI }       from './abis/DailyGM.js';
export { DailyAgentGMABI }  from './abis/DailyAgentGM.js';
export { DailyGMPlusABI }   from './abis/DailyGMPlus.js';
export { X402FeeRouterABI } from './abis/X402FeeRouter.js';
