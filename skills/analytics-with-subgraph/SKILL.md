---
name: analytics-with-subgraph
description: Read Tsunami/Sentry analytics on Ink — free basic subgraph reads (protocol stats, pools, swaps, positions) and free composed premium reports (token dossier, pool health, top movers, new launches, creator dashboard, wallet PnL, risk score, search, leaderboards). Use when an agent needs market data, discovery, monitoring, or reporting. Triggers include "token report", "is this token safe", "top movers", "new launches", "pool health", "wallet PnL", "research a token".
license: MIT
metadata:
  author: MAVRK
  version: "1.0.0"
  homepage: "https://github.com/mavrkofficial/inkonchain-mcp"
  network: "Ink mainnet (chain 57073)"
credentials:
  - name: EVM wallet key
    description: "Not required — every tool in this skill is read-only. A configured wallet is only used to default the `wallet`/`creator`/`owner` argument to your own address when omitted."
    required: false
    storage: keychain
requires:
  mcp: inkonchain
  tools: [subgraph_protocol_stats, subgraph_pools, subgraph_recent_swaps, subgraph_user_positions, subgraph_user_transactions, subgraph_daily_data, analytics_token_report, analytics_pool_health, analytics_top_movers, analytics_new_launches, analytics_creator_dashboard, analytics_wallet_pnl, analytics_token_risk, analytics_search, analytics_leaderboard]
  env: []
  optionalEnv: [TSUNAMI_SUBGRAPH_URL]
---

# Analytics (subgraph + composed reports)

Two tiers, both free and read-only:
- **`subgraph_*`** — raw Goldsky subgraph reads.
- **`analytics_*`** — composed, high-value reports built on top of the subgraph + onchain reads.

## Basic tier — `subgraph_*`

| Tool | Returns |
|---|---|
| `subgraph_protocol_stats` | TVL, volume, fees, tx count (protocol-wide) |
| `subgraph_daily_data` | Historical daily volume/fees/TVL (`first` = days) |
| `subgraph_pools` | Pools sorted by `orderBy` (`totalValueLockedUSD`, `volumeUSD`, …) |
| `subgraph_recent_swaps` | Latest swaps across all pools |
| `subgraph_user_positions` | LP positions for `owner` |
| `subgraph_user_transactions` | Swaps/mints/burns for `origin` wallet |

Use these for cheap monitoring and dashboards.

## Premium tier — `analytics_*`

| Tool | Use it to… |
|---|---|
| `analytics_token_report({ token })` | Get a full token dossier: USD price, FDV, liquidity, 24h volume + price change, every pool, and Sentry launch type + creator. |
| `analytics_pool_health({ pool, sampleSizes? })` | Judge a pool: TVL, 7d volume/fees, estimated fee APR, and an onchain price-impact curve. |
| `analytics_top_movers({ window, first })` | Find what's pumping — top tokens by volume + price change over `24h`/`7d`. |
| `analytics_new_launches({ window, first })` | Discover newest Sentry launches with early traction (`24h`/`7d`/`all`). |
| `analytics_creator_dashboard({ creator })` | Roll up a creator's whole book: TVL/volume/fees + total creator fees paid out. |
| `analytics_wallet_pnl({ wallet })` | Estimate a wallet's LP PnL: deposited vs withdrawn + fees, realized PnL estimate. |
| `analytics_token_risk({ token })` | Get a heuristic 0-100 safety score: LP-lock status (Sentry LP is permanently locked), launch type, liquidity, age, drawdown. |
| `analytics_search({ query })` | Find tokens by symbol/name substring, ranked by volume. |
| `analytics_leaderboard({ by })` | Rank top creators by fees paid out, or top tokens by volume. |

## Steps (research a token before buying)

1. `analytics_token_report({ token })` — price, FDV, liquidity, 24h change, launch type.
2. If liquidity looks thin, `analytics_pool_health({ pool })` for the price-impact curve at your intended size.
3. `analytics_token_risk({ token })` for a quick safety read (LP-lock, age, drawdown).
4. Decide, then act via [`trade-on-tsunami`](../trade-on-tsunami/SKILL.md).

## Worked example — research a token before buying

These tools are read-only and compose subgraph + onchain data, so outputs are large; the fields below are **representative** (drawn from the tables above), not byte-exact.

1. **Token dossier**
   `analytics_token_report({ token: "0xC0FFEE…" })`
   → `{ "token": "0xC0FFEE…", "symbol": "MAC", "priceUSD": "0.0000051", "fdvUSD": "5100", "liquidityUSD": "4200", "volume24hUSD": "1800", "priceChange24h": "-0.12", "launchType": "agent", "creator": "0xA11ce…", "pools": [ … ] }`

2. **If liquidity looks thin — price-impact curve at your size**
   `analytics_pool_health({ pool: "0x…" })`
   → `{ "pool": "0x…", "tvlUSD": "4200", "volume7dUSD": "9100", "feeAprPct": "21.4", "priceImpact": [ { "sizeUSD": 100, "impactPct": "-1.8" }, … ] }`

3. **Quick safety read** (0–100 heuristic)
   `analytics_token_risk({ token: "0xC0FFEE…" })`
   → `{ "token": "0xC0FFEE…", "score": 72, "lpLocked": true, "launchType": "agent", "liquidityUSD": "4200", "ageDays": 3, "maxDrawdownPct": "-34" }`

Then decide and act via [`trade-on-tsunami`](../trade-on-tsunami/SKILL.md).

## Gotchas

- **PnL is an estimate** valued at current prices, not historical cost basis.
- **A token must be indexed** (have at least one pool) for `analytics_token_report` / `analytics_token_risk` to find it.
- **Risk scores are heuristics**, not financial advice — always verify independently.

## Done when

You have the data you need to make the decision.
