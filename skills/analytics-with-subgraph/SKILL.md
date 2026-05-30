---
name: analytics-with-subgraph
description: Read Tsunami/Sentry analytics on Ink — free basic subgraph reads (protocol stats, pools, swaps, positions) and free composed premium reports (token dossier, pool health, top movers, new launches, creator dashboard, wallet PnL, risk score, search, leaderboards). Use when an agent needs market data, discovery, monitoring, or reporting.
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

## Gotchas

- **PnL is an estimate** valued at current prices, not historical cost basis.
- **A token must be indexed** (have at least one pool) for `analytics_token_report` / `analytics_token_risk` to find it.
- **Risk scores are heuristics**, not financial advice — always verify independently.

## Done when

You have the data you need to make the decision.
