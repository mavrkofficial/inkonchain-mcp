---
description: Read a token report, risk score, or market data on Ink
argument-hint: "[token address or symbol]"
---

Ink analytics (read-only, no key needed). Request: $ARGUMENTS

1. Load the `analytics-with-subgraph` skill.
2. For a token: `analytics_token_report` (price, FDV, liquidity, 24h change, launch type), then `analytics_token_risk` for a quick safety read.
3. For discovery: `analytics_top_movers` / `analytics_new_launches` / `analytics_search`.
4. For a pool: `analytics_pool_health` for fee APR + an onchain price-impact curve.

If the user then wants to act on the data, hand off to `trade-on-tsunami`.
