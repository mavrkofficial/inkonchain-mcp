# inkonchain-mcp

![version](https://img.shields.io/npm/v/inkonchain-mcp?color=blue)
![license](https://img.shields.io/npm/l/inkonchain-mcp?color=green)

**A curated Ink ecosystem MCP server** — gives AI agents direct access to the Ink-native products and ecosystem primitives on [Ink](https://inkonchain.com), the Kraken-backed Ethereum L2.

Bundles the [Sentry Launch Factory](https://sentry.trading), [Tsunami V3 DEX](https://nami.ink), ERC-8004 agent identity, ZNS `.ink` domains, the full DailyGM family (DailyGM + DailyAgentGM + DailyGMPlus), free Tsunami subgraph analytics, free composed premium analytics, Relay best-price swap routing + cross-chain bridging, x402 USDC/USDT0 payments, wallet utilities, guarded contract access, and generic ERC20/WETH utilities into a single MCP server with ~93 tools.

> **Tsunami + Sentry vs. Relay — which to use.** Tsunami and Sentry are Ink-native products (Sentry is multichain-capable but native to Ink) that **aren't indexed by any DEX aggregator** — that's exactly why this MCP ships first-class tools for them. Every Sentry-launched token, and every token natively paired on Tsunami, lives on the **Tsunami V3 DEX** — use the `tsunami_*` tools for those. For just about **everything else on Ink**, the **Relay** tools find the best token price and swap route (and bridge cross-chain). Rule of thumb: **Tsunami for Sentry launches + Tsunami-native pairs; Relay for best-route swaps on everything else.**

Designed to be installed alongside [`tydro-mcp`](https://www.npmjs.com/package/tydro-mcp) and [`@nadohq/nado-mcp`](https://www.npmjs.com/package/@nadohq/nado-mcp) as the **intro stack to agent tooling for Ink**:

```
┌─────────────────────────────────────────────────────────────┐
│                  Ink Agent Tooling Stack                    │
├─────────────────┬──────────────────┬────────────────────────┤
│  inkonchain-mcp │    tydro-mcp     │   @nadohq/nado-mcp     │
│                 │                  │                        │
│  Sentry / Tsu-  │  Tydro lending   │  NADO perpetuals +     │
│  nami / ZNS /   │  (Aave V3 on     │  spot DEX (Vertex on   │
│  ERC-8004 /     │  Ink)            │  Ink)                  │
│  DailyGM /      │                  │                        │
│  Relay / utils  │                  │                        │
└─────────────────┴──────────────────┴────────────────────────┘
```

Each MCP is maintained by the team behind the protocols it covers. Install any combination — they're designed to coexist with zero tool name collisions.

Want to contribute to `inkonchain-mcp` — add a protocol, a tool, or a skill? Reach out at [sergio@inkfnd.com](mailto:sergio@inkfnd.com).

> [!CAUTION]
> This is experimental software. It interacts with the live Ink blockchain and can execute real financial transactions. Read the risks below before using with real funds or AI agents.

## Table of Contents

- [Quick Start](#quick-start)
- [Tool Catalog](#tool-catalog)
- [MCP Client Setup](#mcp-client-setup)
- [Security & Key Management](#security--key-management)
- [Environment Variables](#environment-variables)
- [The Ink Agent Tooling Stack](#the-ink-agent-tooling-stack)
- [Development](#development)
- [Disclaimer](#disclaimer)

## Quick Start

### 1. Install (no manual install needed)

MCP clients like Claude Code, Cursor, and Claude Desktop resolve the package automatically via `npx` when you add it to your config — see [MCP Client Setup](#mcp-client-setup) below.

### 2. Store your EVM private key securely

```bash
npx inkonchain-mcp-setup
```

Paste your `0x`-prefixed EVM private key once. It's stored in your OS keychain:
- **macOS** → Keychain
- **Windows** → Credential Manager
- **Linux** → Secret Service (libsecret)

Never in plaintext on disk.

### 3. Add to your MCP client config

```json
{
  "mcpServers": {
    "inkonchain": {
      "command": "npx",
      "args": ["inkonchain-mcp"]
    }
  }
}
```

Restart your MCP client. ~93 tools become available to your agent.

### 4. (Optional) Set a custom Ink RPC

If you have a private Ink RPC (Gelato, Alchemy, QuickNode, etc.), set it via the `RPC_URL` env var for faster reads and higher rate limits:

```json
{
  "mcpServers": {
    "inkonchain": {
      "command": "npx",
      "args": ["inkonchain-mcp"],
      "env": {
        "RPC_URL": "https://rpc-gel.inkonchain.com/YOUR_API_KEY"
      }
    }
  }
}
```

## Tool Catalog

**~93 tools across 12 modules.** All operate on Ink mainnet (chain ID 57073).

### Sentry Launch Factory (14 tools)

Permissionless, agent-gated, Kraken Verified, and GoPumpMe token launches on Ink. Single-sided LP is held permanently inside the factory contract — only fee collection is supported (no withdraw, no remove-liquidity). Sentry-created pools auto-enable Tsunami protocol fees through the onchain protocol fee controller.

| Tool | Type | Description |
|---|---|---|
| `sentry_launch` | Write | Permissionless token launch. Defaults to WETH base. Deploys ERC20, creates Tsunami V3 pool (1% fee tier), mints single-sided LP locked in the factory. |
| `sentry_launch_agent` | Write | ERC-8004-gated agent launch. Always uses USDT0 base for agent markets (WETH/token agent pairs are not exposed). Register via `identity_register` first. |
| `sentry_launch_agent_usdt0` | Write | Convenience agent launch that always uses USDT0 as the base asset (~$5K starting FDV via the active USDT0 pool manager). |
| `sentry_launch_kraken_verified` | Write | Kraken Verified deployer launch. Deploys a registry-gated token whose transfers are checked by the Kraken verification registry. |
| `sentry_launch_gopumpme` | Write | Kraken Verified deployer launch with open trading. Base-side LP fees route 100% to creator; launched-token-side fees route to treasury. |
| `sentry_get_creator_nfts` | Read | Get all LP NFT IDs for a creator address. |
| `sentry_get_token_by_nft` | Read | Get the token address associated with an LP NFT ID. |
| `sentry_get_supported_base_tokens` | Read | List supported base tokens (currently WETH and USDT0). |
| `sentry_get_pool_manager` | Read | Get the pool manager contract for a supported base token. |
| `sentry_get_factory_config` | Read | Read factory owner, treasury, creator fee bps, registries, protocol fee controller, and supported bases. |
| `sentry_get_launch_type` | Read | Read agent / Kraken Verified / GoPumpMe flags for an LP NFT token ID. |
| `sentry_get_agent_launch_readiness` | Read | Check identity NFT, gas balance, base-token balance, base-token support, and pool manager for agent launches. |
| `sentry_get_creator_fee_status` | Read | List a creator's Sentry LP NFT IDs and current uncollected position fee counters. |
| `sentry_get_total_deployed` | Read | Total number of tokens deployed through the factory. |
| `sentry_collect_fees` | Write | Collect accrued trading fees from factory-held LP positions (owner only). |

Every successful launch is automatically registered in the public Ink ecosystem indexer (see [Token Registration Flow](#token-registration-flow) below). No API key required.

### Tsunami V3 DEX (13 tools)

Uniswap V3-style concentrated liquidity DEX on Ink. The main DEX for Sentry-launched tokens.

| Tool | Type | Description |
|---|---|---|
| `tsunami_quote_exact_input` | Read | Swap quote for exact input amount. |
| `tsunami_quote_exact_output` | Read | Swap quote for exact output amount. |
| `tsunami_swap_exact_input` | Write | Execute swap with exact input. Auto-approves token input. |
| `tsunami_swap_exact_output` | Write | Execute swap for exact output. Auto-approves token input. |
| `tsunami_get_pool` | Read | Pool address + state for a token pair and fee tier. |
| `tsunami_get_pool_info` | Read | Full pool state by address: tick, liquidity, prices. |
| `tsunami_create_pool` | Write | Create and initialize a new pool. |
| `tsunami_mint_position` | Write | Mint a new concentrated liquidity position. |
| `tsunami_add_liquidity` | Write | Add liquidity to an existing position. |
| `tsunami_remove_liquidity` | Write | Remove liquidity (burns NFT if 100%). |
| `tsunami_collect_fees` | Write | Collect accrued trading fees from a position. |
| `tsunami_get_position` | Read | Full position details by token ID. |
| `tsunami_get_user_positions` | Read | All positions owned by an address. |

**Note on fee tiers**: Sentry-launched pools always use the 1% fee tier (`fee: 10000`). Pass `fee: 10000` explicitly when swapping against any Sentry-launched token. Agent USDT0 markets use USDT0 (`0x0200...70c1`) as the base asset and launch around a $5K starting FDV.

> **Exception — the SENTRY ecosystem token**: `SENTRY` (`0xb3C4FB17a34925CA907EFF851FcD176e2801FdAA`) was created **outside** the Sentry launch factory, so it does not follow the launchpad defaults. Its main pool is **WETH/SENTRY at the 2% fee tier** (`fee: 20000`, pool `0xf18658007a00951793dfaba9490842f5d6b3c647`). Use `fee: 20000` and the WETH base when quoting/swapping SENTRY. (The base pairing may migrate to USDT0 in the future.)

### ERC-8004 Agent Identity (6 tools)

Onchain agent identity standard (EIP-8004) co-authored by MetaMask, Ethereum Foundation, Google, and Coinbase. On Ink, the IdentityRegistry is **required before launching tokens via `sentry_launch_agent()`**.

| Tool | Type | Description |
|---|---|---|
| `identity_register` | Write | Register an agent identity — mints an identity NFT. |
| `identity_check_registered` | Read | Check if a wallet holds an identity NFT. |
| `identity_get_agent` | Read | Get agentURI and decoded metadata for an agent ID. |
| `identity_set_agent_uri` | Write | Update identity metadata (owner only). |
| `identity_get_owner_agents` | Read | List all agent token IDs for a wallet. |
| `identity_total_registered` | Read | Total agent identities registered on Ink. |

### ZNS `.ink` Domains (6 tools)

Ink's native domain name service. Every wallet can own one or more `.ink` names that resolve to their address.

| Tool | Type | Description |
|---|---|---|
| `zns_check_domain` | Read | Check if a `.ink` domain is available. |
| `zns_get_price` | Read | Get the registration price for one or more domains. |
| `zns_register` | Write | Register one or more `.ink` domains. |
| `zns_resolve_domain` | Read | Resolve a domain to its owner address. |
| `zns_resolve_address` | Read | Reverse lookup: find the `.ink` name(s) owned by an address. |
| `zns_get_metadata` | Read | Get metadata for a registered `.ink` domain. |

### ERC-20 + WETH Utilities (6 tools)

Generic token tools. Universal utilities used by most other modules.

| Tool | Type | Description |
|---|---|---|
| `erc20_balance` | Read | Get token balance for an address. Use the zero address for native ETH. |
| `erc20_allowance` | Read | Get current allowance for a spender. |
| `erc20_approve` | Write | Approve a spender. Use `"max"` for unlimited. |
| `erc20_transfer` | Write | Transfer tokens (or native ETH via the zero address). |
| `weth_wrap` | Write | Wrap native ETH into WETH. Useful before `tydro_supply` (in tydro-mcp), `nado_deposit` (in nado-mcp), or any tool that needs WETH as input. |
| `weth_unwrap` | Write | Unwrap WETH back into native ETH. Accepts `"max"` for full balance. |

### Wallet Utilities (2 tools)

Local EVM wallet helpers. These use the same keychain entry as `inkonchain-mcp-setup`.

| Tool | Type | Description |
|---|---|---|
| `wallet_address` | Read | Return the configured wallet address and native Ink ETH balance. |
| `wallet_create` | Write | Generate a fresh EVM wallet and store its private key in the OS keychain. Refuses to overwrite unless `overwrite=true`. |

### Guarded Contract Access (2 tools)

Generic read/write helpers for known Ink protocol ABIs only. These are intentionally not arbitrary calldata tools.

| Tool | Type | Description |
|---|---|---|
| `contract_read` | Read | Call allowlisted read functions on known contracts (`erc20`, `sentry`, `tsunami_factory`, `tsunami_pool`, `tsunami_position_manager`, `tsunami_quoter`, `identity`). |
| `contract_write` | Write | Call allowlisted write functions on known contracts. Refuses arbitrary calldata and unsupported function names. |

### DailyGM Family (15 tools)

Full coverage of the three GM contracts powering [gm.ink](https://gm.ink) — Ink's onchain social primitive. The legacy free `DailyGM`, the agent-gated free `DailyAgentGM`, and the premium paid `DailyGMPlus`.

> **Strategy note for agent operators**: keep your daily streak alive with the free contracts (`DailyGM` + `DailyAgentGM`); they are the only ones that contribute to the streak multiplier on the gm.ink leaderboard. `DailyGMPlus` is a leverage amplifier — each premium GM counts as 2× on raw GM totals but does NOT contribute to the streak. Spend on GM+ once your streak math is in your favor. See <https://gm.ink/markdowndocs#scoring> for the full breakdown and <https://gm.ink/agent-gm-skill.md> for an agent-friendly operational reference.

> **Recipient input format**: every `*_to` write tool (`dailygm_gm_to`, `dailygm_agent_gm_to`, `dailygm_plus_gm_to`, `dailygm_plus_agent_gm_to`) accepts either a `0x...` address **or** a `.ink` domain. `deployerone.ink` and the bare name `deployerone` both resolve via the public ZNS API before the onchain call. ENS (`.eth`) is rejected with a clear hint — resolve it upstream first. Resolution failures throw with explicit messages; for `dailygm_plus_*_to` the resolution runs **before** the spend-cap check and the value transfer, so a bad domain never costs gas or counts against your daily cap.

#### Free DailyGM (legacy)

| Tool | Type | Description |
|---|---|---|
| `dailygm_gm` | Write | Say GM via DailyGM. Free except gas. 24h cooldown shared with `dailygm_gm_to`. |
| `dailygm_gm_to` | Write | Send GM to a specific wallet via DailyGM. Free except gas. Shares cooldown with `dailygm_gm`. Cannot self-target. |
| `dailygm_last_gm` | Read | Read `DailyGM.lastGM(user)` with computed cooldown status. |

#### Free DailyAgentGM (ERC-8004 agent-gated)

| Tool | Type | Description |
|---|---|---|
| `dailygm_agent_gm` | Write | Say GM via DailyAgentGM. Free except gas. Caller MUST be a registered ERC-8004 agent. 24h cooldown shared with `dailygm_agent_gm_to`. |
| `dailygm_agent_gm_to` | Write | Send GM to an agent via DailyAgentGM. **Both** sender and recipient must be registered agents. |
| `dailygm_agent_last_gm` | Read | Read `DailyAgentGM.lastGM(user)`. |
| `dailygm_agent_is_registered` | Read | Convenience wrapper around `DailyAgentGM.isAgent(account)` for quick eligibility checks. |

#### Premium DailyGMPlus (paid, 0.0005 ETH per call)

| Tool | Type | Description |
|---|---|---|
| `dailygm_plus_gm` | Write | `DailyGMPlus.gm()` — payable, 24h cooldown, tracked independently from DailyGM/DailyAgentGM. |
| `dailygm_plus_gm_to` | Write | `DailyGMPlus.gmTo(recipient)` — payable, **unlimited** (no cooldown). |
| `dailygm_plus_agent_gm` | Write | `DailyGMPlus.agentGm()` — payable, agent-gated, separate cooldown via `lastAgentGM`. |
| `dailygm_plus_agent_gm_to` | Write | `DailyGMPlus.agentGmTo(recipient)` — payable, agent-gated, unlimited. |
| `dailygm_plus_last_gm` | Read | Cooldown source for `dailygm_plus_gm`. |
| `dailygm_plus_last_agent_gm` | Read | Cooldown source for `dailygm_plus_agent_gm`. |
| `dailygm_plus_fee` | Read | Read the onchain `GM_FEE` constant. Always `0.0005 ETH` unless contract is upgraded. |

All four `dailygm_plus_*` write tools auto-attach `msg.value = 0.0005 ETH`. Optional process-local daily spend cap available via `DAILYGM_PLUS_MAX_DAILY_SPEND_WEI` (see Environment Variables below).

#### Convenience snapshot

| Tool | Type | Description |
|---|---|---|
| `dailygm_status` | Read | One-shot snapshot of every relevant cooldown + agent registration + GM_FEE for a wallet. Designed as the first call in an agent tick to decide which GM to send next. |

### Tsunami Subgraph Analytics (6 tools, free)

Read-only Goldsky subgraph queries against Tsunami V3. Always free. Useful for dashboards, portfolio agents, and reporting.

| Tool | Type | Description |
|---|---|---|
| `subgraph_protocol_stats` | Read | Aggregate protocol stats (TVL, volume, fees, tx count). |
| `subgraph_daily_data` | Read | Historical daily protocol metrics. |
| `subgraph_pools` | Read | List pools sorted by TVL, volume, or fees. |
| `subgraph_recent_swaps` | Read | Recent swaps across all pools. |
| `subgraph_user_positions` | Read | LP positions for a wallet. |
| `subgraph_user_transactions` | Read | Recent swaps/mints/burns for a wallet. |

The subgraph URL is overridable via `TSUNAMI_SUBGRAPH_URL` env var in case Goldsky republishes.

### Premium Analytics (9 tools, free)

Composed, high-value analytics that don't exist in the raw subgraph — token dossiers, pool health with onchain price impact, movers, fresh launches, creator rollups, wallet PnL, risk signals, search, and leaderboards. All **free**, read-only, and built on the public Tsunami subgraph + onchain reads.

| Tool | Type | Description |
|---|---|---|
| `analytics_token_report` | Read | Token dossier: price, FDV, liquidity, 24h volume/change, all pools, Sentry launch type + creator. |
| `analytics_pool_health` | Read | Pool TVL, 7d volume/fees, estimated fee APR, onchain price-impact curve. |
| `analytics_top_movers` | Read | Top tokens by volume + price change over 24h/7d. |
| `analytics_new_launches` | Read | Newest Sentry launches with early traction metrics. |
| `analytics_creator_dashboard` | Read | Creator-wide TVL/volume/fees rollup + creator fees paid out. |
| `analytics_wallet_pnl` | Read | A wallet's LP positions with deposited/withdrawn/fees + realized PnL estimate. |
| `analytics_token_risk` | Read | Heuristic 0-100 safety score: LP-lock status (Sentry LP is permanently locked), launch type, liquidity, age, drawdown. |
| `analytics_search` | Read | Search indexed tokens by symbol/name substring, ranked by volume. |
| `analytics_leaderboard` | Read | Top creators by fees paid out, or top tokens by volume. |

Default Tsunami subgraph:

`https://api.goldsky.com/api/public/project_cmm7vh5xwsa8m01qmdr7w7u62/subgraphs/tsunami-v3/2.4.0/gn`

### GM Subgraphs

The built-in `dailygm_*` tools read/write directly against the GM contracts. The package also exports the latest GM subgraph URLs for downstream analytics and future leaderboard tools:

| Subgraph | URL |
|---|---|
| DailyGM | `https://api.goldsky.com/api/public/project_cmo0uv9q6okpf01zk5gmoaeao/subgraphs/DailyGM/1.1.1/gn` |
| DailyAgentGM | `https://api.goldsky.com/api/public/project_cmo0uv9q6okpf01zk5gmoaeao/subgraphs/DailyAgentGM/1.0.0/gn` |
| DailyGMPlus | `https://api.goldsky.com/api/public/project_cmo0uv9q6okpf01zk5gmoaeao/subgraphs/DailyGMPlus/1.0.0/gn` |

### Relay Protocol (7 tools)

**Best-price swap routing and quotes on Ink**, plus cross-chain bridging, via [Relay](https://relay.link). Relay finds the best route/quote for just about any token on Ink that **isn't** a Sentry-launched or Tsunami-native pair (those go through the `tsunami_*` tools) — and it bridges across 60+ EVM chains from a single EVM key.

| Tool | Type | Description |
|---|---|---|
| `relay_get_chains` | Read | List all supported chains. |
| `relay_get_currencies` | Read | Search tokens/currencies on Relay. |
| `relay_get_quote` | Read | Full quote with executable steps. |
| `relay_get_price` | Read | Faster price estimate (no executable steps). |
| `relay_get_token_price` | Read | USD price of a token. |
| `relay_get_requests` | Read | Transaction status and history. |
| `relay_execute` | Write | Execute a swap or cross-chain bridge. Works on any EVM chain in `viem/chains` — the same EVM key signs for every EVM chain because addresses are deterministic. |

**Notable**: on Ink, reach for Relay for best-route swaps of any token that isn't a Sentry/Tsunami-native pair, and for cross-chain bridges (e.g. `Ink ETH → Base ETH`, `Arbitrum USDC → Ink USDT0`). The one EVM key you configure in the keychain signs for every EVM chain Relay supports.

### x402 Payments on Ink (7 tools)

USDC- and USDT0-denominated x402 v2 payments on Ink through the `X402FeeRouter` contracts and the Railway facilitator. The facilitator validates EIP-3009 stablecoin authorizations and can sponsor settlement gas through a self-relayer. Both assets are live: the facilitator advertises USDC and USDT0 payment networks via `/supported` and settles either through its asset-specific router.

| Tool | Type | Description |
|---|---|---|
| `x402_health` | Read | Health/config status from the configured facilitator. |
| `x402_supported` | Read | Supported x402 payment requirements (`scheme`, `network`, `asset`, `payTo`). |
| `x402_quote` | Read | Fee/net quote for a gross USDC amount. |
| `x402_verify` | Read | Verify an x402 payment payload + requirements. |
| `x402_settle` | Write | Settle a verified x402 payment through the facilitator and router. |
| `x402_pay` | Write | Build, sign (EIP-3009), and settle an `exact` USDC/USDT0 payment to a seller in one call. No prior approval and no ETH needed — the facilitator sponsors gas. Ideal for agent-to-agent payments and paying for metered services. |
| `x402_router_info` | Read | Read router immutables for USDC or USDT0: payment token, fee recipient, max fee bps, min fee. |

Current routers:

- USDC: `0xa1aD9AE09d28C13CBB783e47C7d1B97F96C6711e`
- USDT0: `0x0d1e92c107bB315e425278CD999D90be804F39d6`

## MCP Client Setup

### Claude Code

```json
{
  "mcpServers": {
    "inkonchain": {
      "command": "npx",
      "args": ["inkonchain-mcp"]
    }
  }
}
```

### Cursor

Add to `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project-level):

```json
{
  "mcpServers": {
    "inkonchain": {
      "command": "npx",
      "args": ["inkonchain-mcp"]
    }
  }
}
```

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "inkonchain": {
      "command": "npx",
      "args": ["inkonchain-mcp"]
    }
  }
}
```

### Running the full Ink stack

Want all the Ink tooling in one session? Add all three MCPs:

```json
{
  "mcpServers": {
    "inkonchain": {
      "command": "npx",
      "args": ["inkonchain-mcp"]
    },
    "tydro": {
      "command": "npx",
      "args": ["tydro-mcp"]
    },
    "nado": {
      "command": "npx",
      "args": ["@nadohq/nado-mcp"],
      "env": {
        "DATA_ENV": "nadoMainnet",
        "PRIVATE_KEY": "0xYOUR_LINKED_SIGNER_KEY",
        "SUBACCOUNT_OWNER": "0xYOUR_MAIN_WALLET"
      }
    }
  }
}
```

All three coexist with zero tool name collisions. Your agent gets ~93 + 7 + 38 = **~138 Ink ecosystem tools** in one session.

## Agent Strategy Examples

### Launch an ERC-8004 agent token on USDT0

1. `wallet_address` — confirm the agent wallet and ETH gas balance.
2. `identity_check_registered` — verify the wallet holds an ERC-8004 identity NFT.
3. `sentry_get_agent_launch_readiness` — confirm USDT0 base support and pool manager.
4. `sentry_launch_agent_usdt0` — launch the token against USDT0.
5. `sentry_get_launch_type` — confirm the LP NFT is marked as an agent launch.

### Monitor a newly launched pool

1. `sentry_get_token_by_nft` — get the token address from LP NFT ID.
2. `tsunami_get_pool` — find the TOKEN/USDT0 pool at fee tier `10000`.
3. `tsunami_get_pool_info` — read tick/liquidity/current pool state.
4. `subgraph_recent_swaps` — monitor trading activity.

### Buy back an agent token with USDT0

1. `erc20_balance` — check USDT0 balance.
2. `tsunami_quote_exact_input` — quote USDT0 → agent token.
3. `tsunami_swap_exact_input` — execute the buy.

### Check and collect creator rewards

1. `sentry_get_creator_fee_status` — inspect LP NFTs and uncollected fee counters (what's accrued to you).
2. `sentry_collect_fees` — collect. A creator may collect the tokens they created (paying their own gas); the factory owner may collect any IDs. Routing pays each creator their share automatically.
3. `erc20_balance` — confirm creator USDT0 balance after collection.
4. `analytics_creator_dashboard` — total creator fees already paid out across your tokens.

## Agent Skills Library

The package ships a [`skills/`](skills/) library — one `SKILL.md` playbook per capability (with YAML frontmatter, so it loads in Claude/Cursor skill loaders). The MCP gives an agent the **tools**; the skills give it the **playbooks** (when to use each tool, in what order, with which params, and the gotchas).

Start at [`skills/README.md`](skills/README.md). Highlights:

- `getting-started-on-ink` · `register-agent-identity` · `link-kraken-verified` · `launch-a-token` · `earn-and-collect-creator-fees`
- `trade-on-tsunami` · `provide-liquidity` · `bridge-with-relay`
- `accept-x402-payments` · `charge-x402-payments` · `analytics-with-subgraph` · `ink-domains-zns` · `daily-gm` · `safe-generic-contract-calls`

## Security & Key Management

MCP servers run **locally on your machine** as child processes spawned by the MCP client. Communication happens over stdio — no open ports, no network exposure. Environment variables like `EVM_PRIVATE_KEY` stay on your machine and are never sent to any AI provider; the model only sees tool definitions and tool results.

### Key storage: OS keychain (recommended)

Run `npx inkonchain-mcp-setup` and paste your private key once. It's stored in your OS keychain under service `inkonchain-mcp`, account `evm-private-key`. The MCP reads the key from the keychain at runtime — it never touches `.mcp.json`.

This also supports migrating from `moltiverse-mcp`: if no `inkonchain-mcp` keychain entry is found, the MCP falls back to the `moltiverse-mcp` keychain entry so existing moltiverse users can switch without re-running setup.

### Key storage: env var (for servers / CI)

For deployment contexts where OS keychains aren't available:

```json
{
  "mcpServers": {
    "inkonchain": {
      "command": "npx",
      "args": ["inkonchain-mcp"],
      "env": {
        "EVM_PRIVATE_KEY": "0x..."
      }
    }
  }
}
```

⚠️ The `.mcp.json` file is stored in plain text on disk, readable by any process running as your user. For local dev, **always prefer the OS keychain**. Env vars are a fallback for environments where keychains don't exist.

### Delete the stored key

```bash
npx inkonchain-mcp-setup delete
```

Removes the EVM private key from the OS keychain.

## Environment Variables

All optional unless noted.

| Variable | Default | Description |
|---|---|---|
| `EVM_PRIVATE_KEY` | — | Fallback when no OS keychain is available. 0x-prefixed 32-byte hex. |
| `RPC_URL` | `https://rpc-gel.inkonchain.com` | Custom Ink RPC endpoint. |
| `EVM_RPC_OVERRIDES` | — | JSON map from chainId → RPC URL. Overrides the default RPC for any EVM chain used by `relay_execute` cross-chain bridging (e.g. `{"8453":"https://base-mainnet.g.alchemy.com/v2/..."}`). |
| `TSUNAMI_SUBGRAPH_URL` | Latest known-good Goldsky URL | Override the Tsunami subgraph endpoint. Useful if Goldsky republishes. |
| `X402_FACILITATOR_URL` | `https://x402.sentry.trading` | Facilitator base URL for `x402_health`, `x402_supported`, `x402_quote`, `x402_verify`, `x402_settle`, and `x402_pay`. |
| `MOLTING_API_KEY` | — | Optional. If set, Sentry launches are registered with the indexer under the caller's MOLTING agent account in addition to the public Ink ecosystem indexer. Not required — anonymous launches are fully supported. |
| `SENTRY_API_BASE` | `https://web-production-7d3e.up.railway.app` | Override the backend URL used for token registration. |
| `DAILYGM_PLUS_MAX_DAILY_SPEND_WEI` | — | Optional safety cap for `dailygm_plus_*` write tools. When set, the MCP refuses to execute any premium GM that would push this process's cumulative spend in the current UTC day over the cap (denominated in wei). Defaults to unlimited. Example: `5000000000000000` = 0.005 ETH/day = 10 premium calls. The counter is process-local and resets on MCP restart. |

## Token Registration Flow

Every token launched via `sentry_launch` or `sentry_launch_agent` is automatically registered with the public Ink ecosystem indexer so it shows up on downstream frontends (nami.ink, sentry.trading, etc.).

- **No `MOLTING_API_KEY` required.** Anonymous registration is fully supported as of backend commit `e8b4218`.
- The MCP POSTs to `/api/molting/register-token` with the token name, symbol, contract address, deploy tx hash, and **creator wallet address** (automatically pulled from your configured EVM key).
- If `MOLTING_API_KEY` is set, the request is additionally authenticated and the token also lands in your internal MOLTING agent tracking tables.
- Registration is **non-fatal** — a backend failure is swallowed so a successful onchain launch is never reported as failed just because the indexer call hiccupped.

## The Ink Agent Tooling Stack

`inkonchain-mcp` is the **ecosystem primitives** layer. For full Ink coverage, pair it with:

### [tydro-mcp](https://www.npmjs.com/package/tydro-mcp)
Tydro is Aave V3 deployed on Ink. 12 supported assets (WETH, kBTC, USDC, USDT0, GHO, USDG, weETH, wrsETH, ezETH, sUSDe, USDe, SolvBTC). Maintained by MAVRK.

```json
{ "tydro": { "command": "npx", "args": ["tydro-mcp"] } }
```

### [@nadohq/nado-mcp](https://www.npmjs.com/package/@nadohq/nado-mcp)
Nado is a perpetuals and spot DEX on Ink, powered by the Vertex Protocol engine. Up to 20x leverage on a central limit order book. 38 tools including linked-signer support. Maintained by the Nado team (Ink Foundation).

```json
{
  "nado": {
    "command": "npx",
    "args": ["@nadohq/nado-mcp"],
    "env": {
      "DATA_ENV": "nadoMainnet",
      "PRIVATE_KEY": "0xYOUR_LINKED_SIGNER",
      "SUBACCOUNT_OWNER": "0xYOUR_MAIN_WALLET"
    }
  }
}
```

### [kraken-cli](https://github.com/krakenfx/kraken-cli) — CEX-level Kraken tooling

Ink is Kraken's Ethereum L2. For the **centralized-exchange** side of the same ecosystem, Kraken ships [`kraken-cli`](https://github.com/krakenfx/kraken-cli) — the first AI-native CLI for trading crypto, tokenized stocks (xStocks), forex, and derivatives, with a built-in MCP server (151 commands, 50 skills) that works with Cursor, Claude, Codex, Gemini, and more.

Pairing `inkonchain-mcp` (onchain Ink primitives) with `kraken-cli` (Kraken CEX trading) gives an agent coverage across **both** layers of the Kraken stack — onchain Sentry/Tsunami launches and DeFi on Ink, plus spot/futures/xStocks on the exchange.

```json
{
  "inkonchain": { "command": "npx", "args": ["inkonchain-mcp"] },
  "kraken": { "command": "kraken", "args": ["mcp", "-s", "all"] }
}
```

> Install kraken-cli via its one-line installer (see its README). Use least-privilege Kraken API keys; trade/funding tools are dangerous and gated.

### Future additions

New ecosystem protocols will be added over time as additional tool modules inside `inkonchain-mcp` rather than as separate MCPs. Expect periodic minor version bumps as new Ink DEXs, lending markets, and primitives come online.

## Development

```bash
git clone https://github.com/mavrkofficial/inkonchain-mcp.git
cd inkonchain-mcp
npm install
npm run build
```

```bash
npm run build  # Compile TypeScript to dist/
npm run start  # Run the built MCP server
npm run dev    # Build + run in one shot
```

### Contributing

1. Fork the repo
2. Create a feature branch
3. `npm run build` must pass
4. Open a PR against `main`

Tool additions should go in `src/tools/<module>.ts` and be wired into `src/index.ts`. Each tool module exports a tools array and a handler function following the existing pattern.

## Disclaimer

This software is experimental and interacts with the live Ink blockchain. It can execute real financial transactions including token swaps, token launches, LP position changes, cross-chain bridges, and ERC-8004 identity mints. These operations involve real funds.

- **No warranty.** MIT licensed, provided as-is.
- **No financial advice.** This is infrastructure tooling, not investment guidance.
- **Verify everything.** Always review tool call parameters before approving execution, especially for transactions that move funds.
- **Use a fresh dev wallet** for testing and demos, not your main holdings.
- **The authors are not responsible** for losses incurred through use of this software.

By installing and using `inkonchain-mcp`, you accept these risks.

## License

MIT © MAVRK
