---
description: Best-route swap on Ink or cross-chain bridge via Relay
argument-hint: "[amount] [origin chain] [destination chain] [token]"
---

Route or bridge with Relay. Request: $ARGUMENTS

1. Load the `bridge-with-relay` skill (chain IDs, native token = the zero address, base units).
2. Estimate with `relay_get_price`, then optionally `relay_get_quote` for fees + executable steps.
3. **Confirm with the user**, then `relay_execute` (it signs on the origin chain; `slippageBps` defaults to 100).
4. Track with `relay_get_requests` and confirm the destination balance.

For a Sentry-launched or Tsunami-native pair, use `trade-on-tsunami` instead.
