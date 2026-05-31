---
description: Pay in stablecoins on Ink with x402 (no gas needed)
argument-hint: "[amount] [USDT0|USDC] to [recipient]"
---

x402 payment. Request: $ARGUMENTS

1. Load the `accept-x402-payments` skill (base units; USDT0/USDC are 6 decimals, so 0.05 = `"50000"`).
2. `x402_router_info` to confirm the router and `minFee` — keep the amount above `minFee`.
3. **Confirm recipient, amount, and asset with the user.**
4. `x402_pay({ seller, amount, asset })` — signs an EIP-3009 authorization and settles via the facilitator (gas sponsored, no ETH or approval needed).

To CHARGE for your own endpoint instead of paying, load `charge-x402-payments`.
