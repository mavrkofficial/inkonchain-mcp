# Changelog

All notable changes to `inkonchain-mcp` are documented in this file.

## [1.3.0] — 2026-05-30

### x402 payments + premium analytics

- Added `x402_pay`: builds, signs (EIP-3009 `ReceiveWithAuthorization`), and settles an `exact` USDT0/USDC payment to a seller in one call. No prior ERC-20 approval and no ETH needed — the facilitator sponsors settlement gas. Reusable for agent-to-agent payments and paying for metered services. Defaults to USDT0.
- Added a **premium analytics module** (`analytics_*`) — composed, high-value reads that don't exist in the raw subgraph. All **free** and read-only, built on the public Tsunami subgraph + onchain reads. The basic `subgraph_*` reads remain free as well.
  - `analytics_token_report` — token dossier: price, FDV, liquidity, 24h volume/change, pools, Sentry launch type + creator.
  - `analytics_pool_health` — TVL, 7d volume/fees, fee APR, onchain price-impact curve via the Tsunami quoter.
  - `analytics_top_movers` — top tokens by volume + price change over 24h/7d.
  - `analytics_new_launches` — newest Sentry launches with early traction.
  - `analytics_creator_dashboard` — creator-wide TVL/volume/fees rollup + creator fees paid out.
  - `analytics_wallet_pnl` — LP positions with deposited/withdrawn/fees + realized PnL estimate.
  - `analytics_token_risk` — heuristic 0-100 safety score (LP-lock status, launch type, liquidity, age, drawdown).
  - `analytics_search` — search indexed tokens by symbol/name, ranked by volume.
  - `analytics_leaderboard` — top creators by fees paid out, or top tokens by volume.
- `sentry_collect_fees` now reflects the upgraded SentryLaunchFactory: collectable by the factory owner OR a token's creator (routing unchanged). New implementation `0xd5bceD4c43eef627eE0524368cABAfcb9f29CfF0`.
- Added skills: `link-kraken-verified` (link a KYC'd Kraken account via inkonchain.com/verify). Documented [`kraken-cli`](https://github.com/krakenfx/kraken-cli) as the CEX-level companion in the Ink agent tooling stack.
- x402 defaults to **USDT0** on Ink across `x402_pay` and `x402_router_info` (USDC remains selectable); exported `DEFAULT_X402_ASSET` from `inkonchain-mcp/lib`.
- Added an agent skills library under `skills/` (one `SKILL.md` per capability) bundled in the npm package.

## [1.2.1] — 2026-05-30

### Sentry Launch Factory expansion

- Added `sentry_launch_agent_usdt0` for ERC-8004-gated agent launches that default to USDT0 markets.
- Added `sentry_launch_kraken_verified` for Kraken Verified deployer launches with registry-gated token transfers.
- Added `sentry_launch_gopumpme` for Kraken Verified deployers with open trading and 100% base-side LP fees routed to the creator.
- Added read tools:
  - `sentry_get_pool_manager`
  - `sentry_get_factory_config`
  - `sentry_get_launch_type`
  - `sentry_get_agent_launch_readiness`
  - `sentry_get_creator_fee_status`
- Updated Sentry ABI for:
  - `launchKrakenVerified`
  - `launchGoPumpMe`
  - `creatorFeeBps`
  - `protocolFeeController`
  - `krakenVerifiedRegistry`
  - `isKrakenVerifiedPosition`
  - `isGoPumpMePosition`
  - `CreatorFeePaid`
  - `KrakenVerifiedTokenDeployed`
  - `GoPumpMeTokenDeployed`
- Added contract constants for USDT0, Kraken Verified registry, and Sentry protocol fee controller.
- Updated Sentry fee docs: base-token-side LP fees route to creator/treasury, launched-token-side fees route to treasury, and GoPumpMe base-side LP fees route 100% to creator.
- Updated the default Tsunami subgraph URL to `tsunami-v3/2.4.0`.
- Exported latest DailyGM, DailyAgentGM, and DailyGMPlus subgraph URLs for downstream analytics tooling.
- Added wallet utility tools:
  - `wallet_address`
  - `wallet_create`
- Added guarded generic contract tools:
  - `contract_read`
  - `contract_write`
- Added x402 payment tools for the Ink USDC facilitator/router:
  - `x402_health`
  - `x402_supported`
  - `x402_quote`
  - `x402_verify`
  - `x402_settle`
  - `x402_router_info`
- Defaulted `X402_FACILITATOR_URL` to the live multi-asset facilitator at `https://x402.sentry.trading`.
- Added the deployed USDT0 x402 router constant and `x402_router_info({ asset: "USDT0" })` support. The facilitator now advertises and settles both USDC and USDT0 payment networks via `/supported`, `/verify`, and `/settle`.
- Added README strategy examples for launching an agent token, monitoring a pool, buying back with USDT0, and checking/collecting creator rewards.

## [1.2.0] — 2026-04-21

### New: native `.ink` domain resolution in every `dailygm_*_to` tool

Every recipient-taking write tool in the DailyGM family — `dailygm_gm_to`, `dailygm_agent_gm_to`, `dailygm_plus_gm_to`, `dailygm_plus_agent_gm_to` — now accepts either a `0x...` address **or** a `.ink` domain (e.g. `deployerone.ink`, or just the bare name `deployerone`) as the `recipient`. Domains are resolved via the public ZNS API (`zns.bio/api/resolveDomain`) before the onchain call.

Why: agents using the focused `gmink-mcp` package (which ships only `dailygm_*` tools, no ZNS surface) had no way to resolve a `.ink` domain. They'd either fail silently, fall back to a hardcoded address, or send the GM to the wrong wallet. Now every `*_to` tool handles resolution itself, so an agent given "send a GM+ to deployerone.ink" can pass that string directly without chaining to a separate resolver.

Behavior:

- `0x`-prefixed 40-char addresses pass through unchanged (no extra HTTP call).
- Inputs ending in `.ink` are resolved via ZNS.
- Bare names matching `^[a-zA-Z0-9_-]+$` (no dots, no `0x` prefix) are treated as `.ink` shortcuts and resolved.
- ENS (`.eth`) inputs throw a clear, actionable error directing the caller to resolve them first (full ENS support is a follow-up — requires a mainnet RPC).
- All resolution failures (network, HTTP error, no record, zero address, malformed response) throw with explicit messages so the agent gets actionable feedback instead of a silent fallback.
- `dailygm_plus_*_to` tools resolve **before** consuming the spend-cap check and **before** sending value, so a bad domain never costs gas or counts against the cap.
- Successful responses include the resolved recipient address plus a `resolvedFrom` field with the original domain string when applicable.

No changes to read tools, no changes to non-`*_to` write tools, no breaking changes to address-based callers.

---

## [1.1.1] — 2026-04-21

### Fix: ZNS registration footgun + multi-year support

The ZNS registry contract accepts `expiries[i] = 0` on `registerDomains` — the tx succeeds, the NFT mints, the fee is collected, and the resulting domain is **immediately expired**. `zns_register` now refuses 0/negative/non-integer values for `years` at the tool boundary, before any onchain call, with a clear error explaining the footgun.

### New: `years` parameter on `zns_register` and `zns_get_price`

Previously `zns_register` was hardcoded to 1 year and `zns_get_price` returned per-year cost without indicating it was per-year. Both now accept an optional `years: integer >= 1` (default `1`).

- `zns_get_price` multiplies the per-year `priceToRegister(length)` quote by `years` and returns both the per-year and total figures, so the quoted total matches what `zns_register` will actually charge.
- `zns_register` validates `years >= 1` via a shared `coerceYears` helper and applies it uniformly to every domain in the batch.

The onchain payload shape is unchanged; only the input validation and pricing math are updated. Existing callers that omit `years` keep their previous behavior (1 year per domain).

---

## [1.1.0] — 2026-04-21

### DailyGM family expansion (3 → 15 tools)

The `dailygm` module now covers all three GM contracts that power [gm.ink](https://gm.ink) — the legacy free `DailyGM`, the agent-gated free `DailyAgentGM`, and the premium paid `DailyGMPlus`. Twelve new tools added under the existing `dailygm_` prefix; the three existing tools (`dailygm_gm`, `dailygm_gm_to`, `dailygm_last_gm`) are unchanged.

**New tools — DailyAgentGM (free, ERC-8004 agent-gated):**

- `dailygm_agent_gm` — call `DailyAgentGM.gm()`. Free except gas; caller must hold an ERC-8004 identity NFT. 24h cooldown.
- `dailygm_agent_gm_to` — call `DailyAgentGM.gmTo(recipient)`. **Both sender and recipient** must be registered agents. Cannot self-target.
- `dailygm_agent_last_gm` — read `DailyAgentGM.lastGM(user)` with computed cooldown status.
- `dailygm_agent_is_registered` — convenience wrapper around `DailyAgentGM.isAgent(account)` for quick eligibility checks.

**New tools — DailyGMPlus (paid, 0.0005 ETH per call):**

- `dailygm_plus_gm` — `DailyGMPlus.gm()`, payable, 24h cooldown (independent from DailyGM and DailyAgentGM).
- `dailygm_plus_gm_to` — `DailyGMPlus.gmTo(recipient)`, payable, **unlimited** (no cooldown).
- `dailygm_plus_agent_gm` — `DailyGMPlus.agentGm()`, payable, agent-gated, separate cooldown via `lastAgentGM` mapping.
- `dailygm_plus_agent_gm_to` — `DailyGMPlus.agentGmTo(recipient)`, payable, agent-gated, unlimited.
- `dailygm_plus_last_gm` — read `DailyGMPlus.lastGM(user)` (cooldown source for `dailygm_plus_gm`).
- `dailygm_plus_last_agent_gm` — read `DailyGMPlus.lastAgentGM(user)` (cooldown source for `dailygm_plus_agent_gm`).
- `dailygm_plus_fee` — read the onchain `GM_FEE` constant (always `0.0005 ETH` unless contract upgraded).

**New convenience tool:**

- `dailygm_status` — one-shot snapshot returning every relevant cooldown, agent registration status, GM_FEE, and current spend-cap state for a wallet. Designed as the first call in an agent tick to decide which GM to send next.

### Safety: optional daily spend cap for premium GM

New env var `DAILYGM_PLUS_MAX_DAILY_SPEND_WEI` — when set, the MCP refuses to execute any `dailygm_plus_*` write that would push the process's cumulative spend in the current UTC day over the cap. Defaults to unlimited so existing behavior is preserved. Designed as a guardrail against runaway agent loops; not a hardened audit trail.

### New `inkonchain-mcp/lib` library entry point

Downstream packages can now compose individual tool modules without spawning the full server:

```ts
import { dailyGmTools, handleDailyGmTool } from 'inkonchain-mcp/lib';
```

Exports include all `<name>Tools` arrays and `handle<Name>Tool` functions, plus the underlying `client.ts` helpers (`publicClient`, `getAccount`, `sendTx`), `config.ts` constants, and contract ABIs. This is what powers the focused [`gm-mcp`](https://www.npmjs.com/package/gm-mcp) package — a DailyGM-family-only MCP that depends on `inkonchain-mcp/lib` and re-registers just the `dailygm_*` subset.

### New contract addresses in `CONTRACTS`

```ts
DailyAgentGM:  '0x2B9DD9Eede2AeCB095455ce45122101109E4AeC7',
DailyGMPlus:   '0x3FB6088d7Bda27211DD9403DCC280B22249b73B3',
```

The pre-existing `DailyGM` entry is unchanged.

### Notes

- All 15 dailygm tools route through the existing `name.startsWith('dailygm_')` check in `index.ts` — no upgrades to MCP client configs required.
- Total tool count rises from ~54 to ~66.
- Strategy notes for an agent operator: keep your daily streak alive on the free contracts (`DailyGM` + `DailyAgentGM`); GM+ does NOT contribute to the streak score on the gm.ink leaderboard but does count as 2× on raw GM totals. See <https://gm.ink/markdowndocs#scoring> for the full breakdown.

---

## [1.0.0] — 2026-04-08

### Initial release

`inkonchain-mcp` is the curated Ink ecosystem MCP server — a focused rebrand and slim-down of the earlier `moltiverse-mcp` project, repositioned as the first layer of the Ink agent tooling stack alongside [`tydro-mcp`](https://www.npmjs.com/package/tydro-mcp) and [`@nadohq/nado-mcp`](https://www.npmjs.com/package/@nadohq/nado-mcp).

**What's included** (~54 tools across 8 modules):

- **Sentry Launch Factory** (7 tools) — permissionless + agent-gated token launches with single-sided LP locked in the factory
- **Tsunami V3 DEX** (13 tools) — concentrated liquidity DEX with full position management
- **ERC-8004 Agent Identity** (6 tools) — onchain agent identity registry, gates `sentry_launch_agent`
- **ZNS `.ink` Domains** (6 tools) — Ink native domain name service
- **ERC-20 + WETH Utilities** (6 tools) — generic token balance/approve/transfer + native ETH wrapping
- **DailyGM** (3 tools) — onchain "gm" social primitive
- **Tsunami Subgraph Analytics** (6 tools) — read-only Goldsky subgraph queries for protocol data
- **Relay Protocol** (7 tools) — cross-chain bridging and swap aggregation; `relay_execute` supports any of the 60+ EVM chains in `viem/chains` from a single private key

**What's intentionally NOT included** (maintained separately):

- **Tydro lending** — use [`tydro-mcp`](https://www.npmjs.com/package/tydro-mcp)
- **NADO perps/spot** — use [`@nadohq/nado-mcp`](https://www.npmjs.com/package/@nadohq/nado-mcp)
- **Citadel LP locker** — no longer auto-used by Sentry; if needed, interact with the contract directly
- **Solana-side tools** — `inkonchain-mcp` is Ink-focused by design

### Key features

- **Anonymous Sentry token registration** — every successful `sentry_launch` / `sentry_launch_agent` call automatically registers the deployed token in the public Ink ecosystem indexer so it shows up on downstream frontends. **No `MOLTING_API_KEY` required**. If a key is configured, the request is additionally authenticated and lands in the caller's internal MOLTING tracking tables too.
- **OS keychain key management** — `npx inkonchain-mcp-setup` stores your EVM private key securely in the OS keychain (macOS Keychain / Windows Credential Manager / Linux libsecret). Keys are never stored in plain text in `.mcp.json`.
- **Seamless moltiverse-mcp migration** — the keychain loader falls back to the legacy `moltiverse-mcp` keychain entry so existing users can migrate without re-running setup.
- **Multi-chain EVM signing via Relay** — `relay_execute` uses `viem/chains` dynamic chain resolution so the same EVM private key signs for every EVM chain Relay supports. Bridge `Ink ETH → Base ETH`, `Arbitrum USDC → Ink USDT0`, etc. from one wallet.
- **Configurable RPCs** — override the Ink RPC via `RPC_URL`, or override per-chain RPCs for cross-chain bridges via `EVM_RPC_OVERRIDES` (JSON map).
- **Env-configurable Tsunami subgraph URL** — override via `TSUNAMI_SUBGRAPH_URL` when Goldsky republishes the subgraph.

### Notes on lineage

Much of the code, tool schemas, and patterns in this release are carried over from the earlier `moltiverse-mcp` project (also by MAVRK), which at its peak shipped ~100 tools spanning both Ink and Solana. `inkonchain-mcp` represents a scope refinement: Ink-only, ecosystem-focused, and designed to coexist cleanly with the dedicated Tydro and Nado MCPs. Existing `moltiverse-mcp@1.14.5` installations continue to work — that package will remain on npm indefinitely — but new development and tool additions will happen in `inkonchain-mcp` going forward.
