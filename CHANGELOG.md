# Changelog

All notable changes to `inkonchain-mcp` are documented in this file.

## [1.0.0] — 2026-04-08

### Initial release

`inkonchain-mcp` is the curated Ink ecosystem MCP server — a focused rebrand and slim-down of the earlier `moltiverse-mcp` project, repositioned as the first layer of the Ink agent tooling stack alongside [`tydro-mcp`](https://www.npmjs.com/package/tydro-mcp) and [`@nadohq/nado-mcp`](https://www.npmjs.com/package/@nadohq/nado-mcp).

**What's included** (~54 tools across 8 modules):

- **Sentry Launch Factory** (7 tools) — permissionless + agent-gated token launches with single-sided LP locked in the factory
- **Tsunami V3 DEX** (13 tools) — concentrated liquidity DEX with full position management
- **ERC-8004 Agent Identity** (6 tools) — on-chain agent identity registry, gates `sentry_launch_agent`
- **ZNS `.ink` Domains** (6 tools) — Ink native domain name service
- **ERC-20 + WETH Utilities** (6 tools) — generic token balance/approve/transfer + native ETH wrapping
- **DailyGM** (3 tools) — on-chain "gm" social primitive
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
