---
name: trade-on-tsunami
description: Swap tokens on the Tsunami V3 DEX on Ink — quote, then execute exact-input or exact-output swaps with slippage control and correct fee tiers. Use when an agent or user wants to buy/sell a token, including buybacks of a launched token.
---

# Trade on Tsunami (V3 DEX)

Tsunami is a Uniswap V3-style concentrated-liquidity DEX — the main venue for Sentry-launched tokens. Always **quote first, then swap**.

## Prerequisites

- A funded wallet (ETH for gas; the input token you're selling).
- The token addresses and the correct **fee tier**.

## Fee tiers (critical)

Common tiers: `500`, `3000`, `10000` — and Tsunami also supports `20000` (2%). **Sentry-launched tokens always use `10000` (1%).** If you omit `fee`, the tools default to `3000`, which will miss a Sentry pool entirely. When in doubt, find the pool first with `tsunami_get_pool({ tokenA, tokenB, fee: 10000 })`.

> **Exception — SENTRY ecosystem token**: `SENTRY` (`0xb3C4FB17a34925CA907EFF851FcD176e2801FdAA`) was created outside the launchpad and trades as **WETH/SENTRY at the 2% tier** — use `fee: 20000` and the WETH base (`0x4200...0006`) for it. (Base may migrate to USDT0 later.)

## Tools used

- `tsunami_quote_exact_input` / `tsunami_quote_exact_output` — price a swap (read-only).
- `tsunami_swap_exact_input` / `tsunami_swap_exact_output` — execute (auto-approves input, auto-wraps/unwraps WETH).
- `tsunami_get_pool` — confirm a pool + fee tier exists.
- `erc20_balance` — check balances before/after.

## Steps (buy a token with USDT0 — common buyback)

### 1. Confirm balance and pool

- `erc20_balance({ token: "0x0200c29006150606b650577bbe7b6248f58470c1" })` → USDT0 balance.
- `tsunami_get_pool({ tokenA: USDT0, tokenB: TOKEN, fee: 10000 })` → confirm the pool exists.

### 2. Quote

`tsunami_quote_exact_input({ tokenIn: USDT0, tokenOut: TOKEN, amountIn, fee: 10000 })`. `amountIn` is in **base units** — USDT0 is 6 decimals, so 1 USDT0 = `"1000000"`. Returns expected `amountOut`.

### 3. Swap

`tsunami_swap_exact_input({ tokenIn: USDT0, tokenOut: TOKEN, amountIn, fee: 10000, slippageBps: 50 })`. `slippageBps` defaults to 50 (0.5%); raise it for thin pools. Approvals are handled automatically.

### 4. Confirm

`erc20_balance({ token: TOKEN })` → confirm you received the token.

## Exact-output variant

Want a precise output amount? Use `tsunami_quote_exact_output` / `tsunami_swap_exact_output` with `amountOut`.

## Native ETH

Use the **WETH address** (`0x4200000000000000000000000000000000000006`) as `tokenIn`/`tokenOut` — the swap tools auto-wrap/unwrap native ETH around the trade.

## Gotchas

- **Wrong fee tier = "pool not found"** or a bad route. Use `10000` for Sentry tokens.
- **Decimals**: USDT0/USDC are 6 decimals, most launched tokens and WETH are 18. Always compute `amountIn` in base units.
- **Thin liquidity**: for low-liquidity pairs (e.g. ETH↔USDT0), `relay_execute` ([`bridge-with-relay`](../bridge-with-relay/SKILL.md)) may give a better route than a direct Tsunami swap.
- **Slippage**: a quote is not a guarantee — set `slippageBps` sensibly and re-quote if the tx is delayed.

## Done when

The swap tx returns success and `erc20_balance` reflects the new holdings.
