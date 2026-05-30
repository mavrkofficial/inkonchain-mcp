---
name: launch-a-token
description: Launch a token on Ink through the Sentry Launch Factory. Covers all four launch types (permissionless, agent, Kraken Verified, GoPumpMe), when to use each, base-asset choice (WETH vs USDT0), readiness checks, and what happens to the LP. Use whenever an agent or user wants to create/deploy a new token.
---

# Launch a token (Sentry Launch Factory)

Sentry launches deploy an ERC-20, create a Tsunami V3 pool at the **1% fee tier**, and mint a **single-sided LP that is locked permanently inside the factory** — you never get the LP NFT. As a creator you **earn** a share of trading fees, which is routed to you automatically when the factory owner runs a collection sweep (collection is owner-only; you don't self-collect). See [`earn-and-collect-creator-fees`](../earn-and-collect-creator-fees/SKILL.md). New pools auto-enable Tsunami protocol fees.

## The four launch types

| Tool | Who can deploy | Who can trade | Base default | Creator fee routing |
|---|---|---|---|---|
| `sentry_launch` | anyone | anyone | WETH | base-side LP fees split creator/treasury |
| `sentry_launch_agent` | ERC-8004 holders | anyone | **USDT0 (always)** | base-side LP fees split creator/treasury |
| `sentry_launch_agent_usdt0` | ERC-8004 holders | anyone | USDT0 (always) | base-side LP fees split creator/treasury |
| `sentry_launch_kraken_verified` | Kraken-verified deployer | Kraken-verified only | WETH | base-side LP fees split creator/treasury |
| `sentry_launch_gopumpme` | Kraken-verified deployer | anyone | WETH | **100% of base-side LP fees to creator** |

Pick by intent:
- **Just ship a token, open market** → `sentry_launch`.
- **Agent-owned token, earn USDT0 fees** → `sentry_launch_agent_usdt0` (the recommended agent path; ~$5K starting FDV, $0.000005/token).
- **Restricted/compliant market** → `sentry_launch_kraken_verified`.
- **Open market but capture all WETH-side fees** → `sentry_launch_gopumpme`.

## Prerequisites

- A funded wallet with ETH for gas.
- For agent launches: an ERC-8004 identity ([`register-agent-identity`](../register-agent-identity/SKILL.md)).
- For Kraken Verified / GoPumpMe: a Kraken-verified deployer address.

## Steps (agent USDT0 launch — the common case)

### 1. Confirm readiness

Call `sentry_get_agent_launch_readiness` (defaults to your wallet, USDT0 base). It checks: identity NFT present, ETH gas balance, USDT0 base support, and the active pool manager. Resolve any failures before launching.

### 2. Launch

Call `sentry_launch_agent_usdt0({ name, symbol })`. The factory deploys the ERC-20, creates the USDT0 pool at fee tier `10000`, and mints the locked LP. The token is auto-registered with the public Ink ecosystem indexer (shows up on nami.ink / sentry.trading) — no API key required.

### 3. Verify

- `sentry_get_creator_nfts` → your new LP NFT ID appears.
- `sentry_get_token_by_nft({ tokenId })` → the deployed token address.
- `sentry_get_launch_type({ tokenId })` → confirms agent / kraken / gopumpme flags.

## Steps (other launch types)

Same shape, different tool:
- `sentry_launch({ name, symbol, baseToken? })` — `baseToken` defaults to WETH.
- `sentry_launch_kraken_verified({ name, symbol, baseToken? })` — caller must pass the registry `canLaunch` check.
- `sentry_launch_gopumpme({ name, symbol, baseToken? })` — Kraken-verified deployer, open trading.

## Gotchas

- **Amounts/price are fixed by the pool manager**, not passed in — agent USDT0 launches start at ~$0.000005/token, ~$5K FDV.
- **Fee tier is always `10000` (1%)** for Sentry pools. Use that when quoting/swapping the new token.
- **You can't withdraw the LP** — liquidity is permanent by design. Only fees are collectable; you (the creator) or the factory owner can trigger collection, and your creator share routes to you automatically.
- **Base token support**: only WETH and USDT0 are supported bases right now (`sentry_get_supported_base_tokens`).

## Done when

`sentry_get_creator_nfts` lists the new LP NFT and `sentry_get_token_by_nft` returns a live token address. Next: monitor it ([`analytics-with-subgraph`](../analytics-with-subgraph/SKILL.md)) and track the fees you earn ([`earn-and-collect-creator-fees`](../earn-and-collect-creator-fees/SKILL.md)).
