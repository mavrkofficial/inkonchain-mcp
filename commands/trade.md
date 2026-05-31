---
description: Quote and swap a Sentry/Tsunami-native token on Ink
argument-hint: "[buy|sell] [amount] [token address]"
---

Trade on Tsunami. Request: $ARGUMENTS

1. Load the `trade-on-tsunami` skill (fee tiers, decimals, the SENTRY 2% exception).
2. If the token is **not** Sentry-launched or Tsunami-native, switch to `bridge-with-relay` for the best route instead.
3. Quote first with `tsunami_quote_exact_input` — use `fee: 10000` for Sentry tokens.
4. **Confirm the quote with the user**, then `tsunami_swap_exact_input` with a sensible `slippageBps` (default 50).
5. Confirm the resulting balance with `erc20_balance`.
