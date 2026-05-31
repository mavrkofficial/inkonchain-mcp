---
description: Launch a token on Ink via the Sentry Launch Factory
argument-hint: "[name] [symbol] [type: agent|permissionless|kraken|gopumpme]"
---

Launch a token on Ink. Request: $ARGUMENTS

1. Load the `launch-a-token` skill for the four launch types, base-asset rules (WETH vs USDT0), and readiness checks.
2. Pick the launch type from the request. Default to the **agent USDT0 launch** (`sentry_launch_agent_usdt0`) for agent-owned, self-funding tokens — it requires an ERC-8004 identity, so check `register-agent-identity` first if needed.
3. Run `sentry_get_agent_launch_readiness` and resolve any failing field before launching.
4. **Confirm name, symbol, launch type, and base asset with the user**, then launch.
5. Verify with `sentry_get_creator_nfts` / `sentry_get_token_by_nft` and report the new token address.

If name or symbol aren't provided, ask for them.
