---
name: trade-on-tsunami
description: Swap tokens on the Tsunami V3 DEX on Ink — quote, then execute exact-input or exact-output swaps with slippage control and correct fee tiers. Use when an agent or user wants to buy/sell a token, do a buyback of a launched token, or convert between Sentry/Tsunami-native pairs. Triggers include "swap on Ink", "buy <token>", "sell <token>", "buyback", "trade on Tsunami".
license: MIT
metadata:
  author: MAVRK
  version: "1.0.0"
  homepage: "https://github.com/mavrkofficial/inkonchain-mcp"
  network: "Ink mainnet (chain 57073)"
credentials:
  - name: EVM wallet key
    description: "EVM private key in the OS keychain (set via `npx inkonchain-mcp-setup`) or the EVM_PRIVATE_KEY env var. Required for swaps (writes); quotes and balance reads work without it."
    required: false
    storage: keychain
requires:
  mcp: inkonchain
  tools: [tsunami_get_pool, tsunami_quote_exact_input, tsunami_quote_exact_output, tsunami_swap_exact_input, tsunami_swap_exact_output, erc20_balance]
  env: []
---

# Trade on Tsunami (V3 DEX)

Tsunami is a Uniswap V3-style concentrated-liquidity DEX and an Ink-native product — the venue for **Sentry-launched tokens and Tsunami-native pairs**. Because Tsunami isn't indexed by DEX aggregators, agents need these dedicated `tsunami_*` tools to reach it. For any other token on Ink, use Relay for best-route swaps ([`bridge-with-relay`](../bridge-with-relay/SKILL.md)). Always **quote first, then swap**.

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

## Worked example — buy a Sentry-launched token with 5 USDT0

Replace `TOKEN` with the launched token's address. Sentry pools are always the 1% tier (`fee: 10000`). The field **values** below are illustrative; the field **names** match the real tool output.

1. **Confirm the pool exists**
   `tsunami_get_pool({ tokenA: "0x0200c29006150606b650577bbe7b6248f58470c1", tokenB: "TOKEN", fee: 10000 })`
   → `{ "poolAddress": "0x1a2b…", "exists": true, "token0": "0x0200…c1", "token1": "TOKEN", "sqrtPriceX96": "…", "tick": -34512, "liquidity": "…" }`

2. **Quote** — 5 USDT0 in (USDT0 is 6 decimals → `"5000000"`)
   `tsunami_quote_exact_input({ tokenIn: "0x0200c29006150606b650577bbe7b6248f58470c1", tokenOut: "TOKEN", amountIn: "5000000", fee: 10000 })`
   → `{ "amountOut": "987654321000000000000", "sqrtPriceX96After": "…", "ticksCrossed": 1, "gasEstimate": "210000" }`

3. **Swap** — 0.5% slippage (`slippageBps: 50`)
   `tsunami_swap_exact_input({ tokenIn: "0x0200c29006150606b650577bbe7b6248f58470c1", tokenOut: "TOKEN", amountIn: "5000000", fee: 10000, slippageBps: 50 })`
   → `{ "hash": "0xabc…", "status": "success", "expectedOut": "987654321000000000000", "amountOutMinimum": "982715549…" }`

4. **Confirm receipt**
   `erc20_balance({ token: "TOKEN" })`
   → `{ "balance": "987654321000000000000", "decimals": 18, "symbol": "TOKEN", "formatted": "987.65", "owner": "0x…" }`

**SENTRY exception** — the ecosystem `SENTRY` token trades as **WETH/SENTRY at the 2% tier** (`fee: 20000`), not USDT0 at 1%. To buy 1 ETH worth:
`tsunami_quote_exact_input({ tokenIn: "0x4200000000000000000000000000000000000006", tokenOut: "0xb3C4FB17a34925CA907EFF851FcD176e2801FdAA", amountIn: "1000000000000000000", fee: 20000 })`

## Exact-output variant

Want a precise output amount? Use `tsunami_quote_exact_output` / `tsunami_swap_exact_output` with `amountOut`.

## Native ETH

Use the **WETH address** (`0x4200000000000000000000000000000000000006`) as `tokenIn`/`tokenOut` — the swap tools auto-wrap/unwrap native ETH around the trade.

## Gotchas

- **Wrong fee tier = "pool not found"** or a bad route. Use `10000` for Sentry tokens.
- **Decimals**: USDT0/USDC are 6 decimals, most launched tokens and WETH are 18. Always compute `amountIn` in base units.
- **Not a Sentry/Tsunami-native token?** Don't force it through Tsunami — `relay_execute` ([`bridge-with-relay`](../bridge-with-relay/SKILL.md)) finds the best route for everything else on Ink (and helps when a Tsunami pair like ETH↔USDT0 is thin).
- **Slippage**: a quote is not a guarantee — set `slippageBps` sensibly and re-quote if the tx is delayed.

## Done when

The swap tx returns success and `erc20_balance` reflects the new holdings.
