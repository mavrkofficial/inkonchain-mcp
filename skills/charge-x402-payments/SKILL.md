---
name: charge-x402-payments
description: Stand up your own x402-paywalled endpoint on Ink (the merchant/seller side) — gate a resource or API behind an HTTP 402 Payment Required, accept a client's signed EIP-3009 payment, and settle it through the Ink facilitator so you receive USDT0/USDC. Use when an agent or service wants to CHARGE for access, not pay for it. The payer-side counterpart is `accept-x402-payments`. Triggers include "charge for my API", "x402 paywall", "402 Payment Required", "monetize my endpoint", "get paid in USDT0".
license: MIT
metadata:
  author: MAVRK
  version: "1.0.0"
  homepage: "https://github.com/mavrkofficial/inkonchain-mcp"
  network: "Ink mainnet (chain 57073)"
credentials:
  - name: EVM wallet key
    description: "EVM private key in the OS keychain (set via `npx inkonchain-mcp-setup`) or the EVM_PRIVATE_KEY env var. The merchant side mostly calls read/settle facilitator tools; your receiving address goes in extra.seller. A key is only needed if your service also signs payments."
    required: false
    storage: keychain
requires:
  mcp: inkonchain
  tools: [x402_router_info, x402_supported, x402_verify, x402_settle]
  env: []
  optionalEnv: [X402_FACILITATOR_URL]
---

# Charge for a resource with x402 on Ink (merchant side)

[`accept-x402-payments`](../accept-x402-payments/SKILL.md) covers *paying*. This skill covers *getting paid for a specific resource* — i.e. running your own x402-paywalled endpoint. The pattern is the standard x402 HTTP `402 Payment Required` handshake, settled on Ink through an `X402FeeRouter` and the facilitator (which sponsors gas).

You do **not** need anything new deployed to do this against the existing rail — you reuse the public facilitator (`https://x402.sentry.trading`) and the existing routers. You only deploy your own router/facilitator if you want to capture the protocol fee yourself (see [Running your own rail](#running-your-own-rail)).

## The flow

```
client                         your endpoint                 facilitator (Ink)
  | --- GET /resource --------> |                                  |
  | <-- 402 + paymentRequired - |                                  |
  | (sign EIP-3009 auth)        |                                  |
  | --- GET /resource --------> |                                  |
  |     + X-PAYMENT header      | --- POST /verify --------------> |
  |                             | <-- { isValid: true } ---------- |
  |                             | --- POST /settle --------------> | (settles onchain,
  |                             | <-- { success, txHash } -------- |  sponsors gas)
  | <-- 200 + resource -------- |                                  |
```

You receive the **net** (gross − protocol fee). The fee goes to the router's `FEE_RECIPIENT`.

## Critical Ink-specific detail: `payTo` is the router, seller goes in `extra`

On this rail the signed authorization pays the **`X402FeeRouter`**, which then forwards the net to you. So in your `paymentRequirements`:

- `payTo` = the **router address** for the asset (NOT your wallet).
- `extra.seller` = **your** receiving address.

The router pulls funds and forwards the net to `extra.seller`. If you put your own address in `payTo`, verification fails. Mirror the exact shape `x402_pay` produces.

| Asset | Router (`payTo`) | Token (`asset`) |
|---|---|---|
| USDT0 | `0x0d1e92c107bB315e425278CD999D90be804F39d6` | `0x0200c29006150606b650577bbe7b6248f58470c1` |
| USDC | `0xa1aD9AE09d28C13CBB783e47C7d1B97F96C6711e` | `0x2D270e6886d130D724215A266106e6832161EAEd` |

(Confirm live values with `x402_router_info({ asset })` and `x402_supported`.)

## Steps

### 1. Decide your price and inspect the router

- Pick a price in **base units** (USDT0/USDC are 6 decimals → `0.05 = "50000"`).
- `x402_router_info({ asset: "USDT0" })` → `feeRecipient`, `maxFeeBps`, `minFee`. Your price **must** exceed `minFee` (the router enforces `fee < gross`, else settlement reverts).

### 2. Return a 402 with payment requirements

When an unpaid request hits your endpoint, respond `402` with the `accepts` array describing how to pay. Build each entry like this (this is exactly what the facilitator expects):

```json
{
  "scheme": "exact",
  "network": "ink",
  "maxAmountRequired": "50000",
  "resource": "https://your-api.example/report/123",
  "description": "Premium token report",
  "payTo": "0x0d1e92c107bB315e425278CD999D90be804F39d6",
  "maxTimeoutSeconds": 600,
  "asset": "0x0200c29006150606b650577bbe7b6248f58470c1",
  "extra": { "seller": "0xYOUR_RECEIVING_ADDRESS" }
}
```

Optionally add `extra.feeBps` to request a specific protocol fee (the router clamps it to `maxFeeBps`).

### 3. Verify the client's payment

The client retries with an `X-PAYMENT` header containing the x402 v2 `paymentPayload` (a signed `ReceiveWithAuthorization` with `to` = the router). Before doing any work, verify it:

- `x402_verify({ paymentPayload, paymentRequirements })` → expect `{ isValid: true }`.
- Reject (`402` again) if invalid, expired, wrong `asset`/`network`/`payTo`, or amount below your price.

### 4. Settle, then serve

- `x402_settle({ paymentPayload, paymentRequirements })` → `{ success: true, txHash }`. The facilitator submits the onchain settlement and sponsors gas; the net lands at `extra.seller`.
- Only after `success: true`, return `200` with the resource (and ideally echo the `txHash` in an `X-PAYMENT-RESPONSE` header).

> Settle once. Each authorization has a unique nonce and the facilitator enforces replay protection, so a settled payment can't be reused — don't serve the resource until settlement succeeds.

## Verify-then-settle vs. settle-only

- **Cheap/idempotent resource:** `verify` → serve → `settle` is fine.
- **Expensive/one-shot resource:** `verify` → `settle` → serve. Never deliver before `settle` returns `success: true`, or a client can take the resource without paying.

## Running your own rail

Using the public facilitator + routers, the **protocol fee goes to the existing `FEE_RECIPIENT`** (you still get your net). To keep that fee yourself:

1. Deploy your own `X402FeeRouter` with your `FEE_RECIPIENT`.
2. Run your own facilitator instance (the `x402-ink` service) pointed at your router.
3. Point clients at it via `X402_FACILITATOR_URL`, and use your router address as `payTo`.

For most agents, the public rail is the right default — you only own the rail if fee capture matters.

## Worked example — verify then settle a client's payment

After you returned a 402 and the client retried with an `X-PAYMENT` header carrying the signed `paymentPayload`, run verify → settle. `x402_verify`/`x402_settle` return facilitator JSON (values illustrative).

1. **Verify the signed payload before doing any work**
   `x402_verify({ paymentPayload, paymentRequirements })`
   → `{ "isValid": true }`
   (Reject with another `402` if `isValid` is false, expired, or the amount/`asset`/`payTo` don't match.)

2. **Settle onchain** (facilitator submits + sponsors gas; the net lands at `extra.seller`)
   `x402_settle({ paymentPayload, paymentRequirements })`
   → `{ "success": true, "txHash": "0x…" }`

3. **Only after `success: true`**, return `200` with the resource — and echo the `txHash` in an `X-PAYMENT-RESPONSE` header.

## Gotchas

- **`payTo` = router, `extra.seller` = you.** The #1 mistake. Your address is never `payTo`.
- **Price > `minFee`.** Sub-min-fee charges revert at settlement. Check `x402_router_info`.
- **Match asset + network exactly.** `network: "ink"`, and `asset` must be the USDT0/USDC token address that matches your chosen router.
- **Don't deliver before settlement.** For valuable resources, settle first.
- **Base units, not decimals.** `"50000"` = 0.05 USDT0/USDC.

## Done when

A client's `X-PAYMENT` verifies, `x402_settle` returns `success: true` with a `txHash`, your `extra.seller` balance increased by the net, and your endpoint returned the gated resource.
