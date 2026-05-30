---
name: provide-liquidity
description: Provide and manage concentrated liquidity on Tsunami V3 — create/initialize pools, mint positions in a tick range, add/remove liquidity, and collect LP fees. Use when an agent or user wants to be a liquidity provider (not a Sentry launch, which locks LP automatically).
---

# Provide liquidity (Tsunami V3)

This is for **manual LP** on Tsunami. (Sentry launches mint and lock LP for you automatically — that's a different flow; see [`launch-a-token`](../launch-a-token/SKILL.md).)

## Prerequisites

- A funded wallet with both tokens of the pair (and ETH for gas).
- Token addresses, fee tier, and a target price range (tick bounds).

## Tools used

- `tsunami_get_pool` / `tsunami_get_pool_info` — find a pool and read tick/liquidity/prices.
- `tsunami_create_pool` — create + initialize a pool with a starting price.
- `tsunami_mint_position` — mint a new concentrated position.
- `tsunami_add_liquidity` / `tsunami_remove_liquidity` — adjust an existing position.
- `tsunami_collect_fees` — claim accrued fees.
- `tsunami_get_position` / `tsunami_get_user_positions` — inspect positions.

## Token ordering (important)

V3 pools order tokens by address: **`token0` is the lower address, `token1` the higher**. Sort the two addresses before calling `tsunami_create_pool` / `tsunami_mint_position`. Amounts and ticks are interpreted in that order.

## Steps

### 1. Does the pool exist?

`tsunami_get_pool({ tokenA, tokenB, fee })`. If it returns an address → read state with `tsunami_get_pool_info({ poolAddress })`. If not → create it (step 2).

### 2. Create + initialize (only if needed)

`tsunami_create_pool({ token0, token1, fee, sqrtPriceX96 })`. `sqrtPriceX96` is the initial price encoded as a uint160 — compute it for your target starting price (`sqrtPriceX96 = sqrt(price) * 2^96`, where `price = token1_per_token0` in raw units accounting for decimals).

### 3. Mint a position

`tsunami_mint_position({ token0, token1, fee, tickLower, tickUpper, amount0Desired, amount1Desired, slippageBps })`. Ticks must be multiples of the fee tier's tick spacing (e.g. 200 for the 1% tier). Approvals are handled automatically. A narrower range earns more fees but risks going out of range.

### 4. Manage

- `tsunami_add_liquidity({ tokenId, amount0Desired, amount1Desired })` — top up.
- `tsunami_remove_liquidity({ tokenId, liquidityPercent })` — withdraw 1–100% (burns the NFT at 100%).
- `tsunami_collect_fees({ tokenId })` — claim fees without removing liquidity.

## Premium insight

`analytics_pool_health({ pool })` (free) gives you fee APR and an onchain price-impact curve to size your range and expectations. See [`analytics-with-subgraph`](../analytics-with-subgraph/SKILL.md).

## Gotchas

- **Tick alignment**: `tickLower`/`tickUpper` must align to the pool's tick spacing or the mint reverts.
- **Out-of-range positions earn nothing** and sit 100% in one token. Monitor `tsunami_get_position`.
- **Amounts in base units**, respecting each token's decimals.
- **Sentry pools**: you generally can't LP into the locked Sentry position — manual LP is for ordinary Tsunami pools.

## Done when

`tsunami_get_user_positions` shows your position with non-zero liquidity, and `tsunami_collect_fees` works.
