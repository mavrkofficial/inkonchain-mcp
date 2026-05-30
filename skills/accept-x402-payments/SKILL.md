---
name: accept-x402-payments
description: Send and settle x402 stablecoin payments on Ink (USDT0 or USDC) — agent-to-agent payments, paying for metered services, and inspecting the fee routers/facilitator. Use when an agent needs to pay another address in stablecoins without holding ETH for gas, or to pay for a metered tool.
---

# Pay (and get paid) with x402 on Ink

x402 lets an agent pay in stablecoins by **signing** an EIP-3009 authorization — the facilitator submits the onchain settlement and **sponsors the gas**. So the payer needs no ETH and no prior ERC-20 approval. Payments route through an `X402FeeRouter` that forwards the net to the seller and a small protocol fee to the fee recipient.

Default asset: **USDT0** (USDC also supported).

## Prerequisites

- A wallet holding the stablecoin you're paying with (USDT0 or USDC). No ETH required for the payment itself.
- The facilitator URL is preconfigured (`https://x402.sentry.trading`); override with `X402_FACILITATOR_URL`.

## Tools used

- `x402_health` / `x402_supported` — confirm the facilitator is up and which assets/networks it accepts.
- `x402_router_info` — read a router's immutables (payment token, fee recipient, max fee bps, min fee).
- `x402_quote` — preview the fee/net split for a gross amount.
- `x402_pay` — build, sign, and settle a payment to a seller in one call.
- `x402_verify` / `x402_settle` — lower-level verify/settle if you already have a payment payload.

## Steps (pay a seller in USDT0)

### 1. Sanity-check the rails

- `x402_health` → should report `status: ok` with `ink` networks for USDC and USDT0.
- `x402_router_info({ asset: "USDT0" })` → fee recipient, max fee bps, min fee.

### 2. Preview the split (optional)

`x402_quote({ amount })` → gross/fee/net for that amount. `amount` is in **base units** (USDT0/USDC are 6 decimals, so 0.05 = `"50000"`).

### 3. Pay

`x402_pay({ seller: "0x...", amount: "50000", asset: "USDT0" })`. This signs an EIP-3009 `ReceiveWithAuthorization` (with `to` = the router, the required x402 pattern) and POSTs it to the facilitator `/settle`. Returns the settlement tx hash; the seller receives the net, the fee recipient gets the protocol fee.

## Important: the price must exceed the minimum fee

The router enforces `fee < gross`. The fee is `max(feeBps * amount, MIN_FEE)`. If you pay an amount at or below the min fee, settlement reverts. Check `x402_router_info` and keep the amount comfortably above `minFee`.

## Gotchas

- **`to` must be the router, not the seller** — `x402_pay` handles this; if you hand-build a payload for `x402_settle`, the signed `to` must equal the router or verification fails.
- **Asset selection** — defaults to USDT0; pass `asset: "USDC"` to pay in USDC.
- **Replay protection** — each payment uses a fresh random nonce; you can't re-settle the same authorization.
- **Gas** — the facilitator sponsors settlement gas, but keep a little ETH for any non-x402 fallbacks.

## Done when

`x402_pay` returns `success: true` with a `txHash`, and the seller's `erc20_balance` increased by the net amount.
