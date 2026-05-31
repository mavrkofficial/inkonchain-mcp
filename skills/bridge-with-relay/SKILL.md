---
name: bridge-with-relay
description: Best-price token swap routing on Ink + cross-chain bridging across 60+ EVM chains, using Relay. Use when an agent needs the best route/quote for a token on Ink that ISN'T a Sentry-launched or Tsunami-native pair, to bridge ETH/tokens between chains, or to fund an Ink wallet from another chain. Triggers include "bridge to Ink", "cross-chain swap", "best route", "fund Ink from Base", "best price for <token>".
license: MIT
metadata:
  author: MAVRK
  version: "1.0.0"
  homepage: "https://github.com/mavrkofficial/inkonchain-mcp"
  network: "Ink mainnet (chain 57073) + 60+ EVM chains via Relay"
credentials:
  - name: EVM wallet key
    description: "EVM private key in the OS keychain (set via `npx inkonchain-mcp-setup`) or the EVM_PRIVATE_KEY env var. Required for write operations; read-only tools work without it. The same key signs on every EVM chain."
    required: false
    storage: keychain
requires:
  mcp: inkonchain
  tools: [relay_get_chains, relay_get_currencies, relay_get_price, relay_get_quote, relay_execute, relay_get_requests]
  env: []
  optionalEnv: [EVM_RPC_OVERRIDES]
---

# Best-price routing + bridging with Relay

Relay does two jobs here:

1. **Best-price swap routing on Ink.** For just about any token on Ink that is **not** a Sentry-launched token or a Tsunami-native pair, Relay finds the best price/route across Ink liquidity. (Sentry/Tsunami-native pairs aren't indexed by DEX aggregators — trade those with the `tsunami_*` tools; see [`trade-on-tsunami`](../trade-on-tsunami/SKILL.md).)
2. **Cross-chain bridging** across 60+ EVM chains.

The single locally-held EVM key signs on **every** EVM chain (addresses are deterministic), so one wallet routes and bridges anywhere.

## Division of labor on Ink

- **Sentry-launched token or Tsunami-native pair?** → `tsunami_*` tools.
- **Anything else on Ink (or any cross-chain move)?** → Relay finds the best route/quote.

## Prerequisites

- A funded wallet on the **origin** chain (gas + the token you're sending).
- Know the origin/destination chain IDs and token addresses.

## Common chain IDs

Ink `57073` · Ethereum `1` · Base `8453` · Arbitrum `42161` · Optimism `10` · Polygon `137`. Use `relay_get_chains` for the full list.

## Tools used

- `relay_get_chains` / `relay_get_currencies` — discover chains and token addresses.
- `relay_get_price` — fast estimate (no executable steps).
- `relay_get_quote` — full quote with executable steps + fees.
- `relay_execute` — sign and submit all steps of the route.
- `relay_get_requests` — check status/history.

## Steps (fund Ink with ETH from Base)

### 1. Estimate

`relay_get_price({ originChainId: 8453, destinationChainId: 57073, originCurrency: "0x0000000000000000000000000000000000000000", destinationCurrency: "0x0000000000000000000000000000000000000000", amount })`. Native gas token = the zero address. `amount` is in wei (ETH = 18 decimals).

### 2. Quote (optional, for detail)

`relay_get_quote({ ...same..., tradeType: "EXACT_INPUT" })` → fees + executable steps. `recipient` defaults to your wallet on the destination.

### 3. Execute

`relay_execute({ originChainId: 8453, destinationChainId: 57073, originCurrency, destinationCurrency, amount, slippageBps: 100 })`. This signs and submits every step using your key on the origin chain. `slippageBps` defaults to 100 (1%).

### 4. Track

`relay_get_requests({ hash })` or `{ user }` → confirm the bridge completed on the destination.

## Same-chain (Ink) best-route swap

`relay_execute` with `originChainId === destinationChainId === 57073` does a same-chain swap on Ink, routed for best price. Use it for any Ink token that isn't a Sentry-launched or Tsunami-native pair (e.g. **ETH ↔ USDT0**, or any aggregator-listed token). Quote with `relay_get_quote`/`relay_get_price` (both chain IDs `57073`) first to compare the route.

## Worked example — bridge 0.01 ETH from Base to Ink

Field values illustrative. `relay_execute`'s field names are verified; `relay_get_price` is a Relay API passthrough (shape representative). Native gas token = the zero address; `amount` in wei.

1. **Estimate**
   `relay_get_price({ originChainId: 8453, destinationChainId: 57073, originCurrency: "0x0000000000000000000000000000000000000000", destinationCurrency: "0x0000000000000000000000000000000000000000", amount: "10000000000000000" })`
   → `{ "currencyIn": { … }, "currencyOut": { "amount": "9970000000000000" }, "totalImpact": { "percent": "-0.3" }, "fees": { … } }`  (representative)

2. **Execute** (signs + submits every step with your key on the origin chain)
   `relay_execute({ originChainId: 8453, destinationChainId: 57073, originCurrency: "0x0000000000000000000000000000000000000000", destinationCurrency: "0x0000000000000000000000000000000000000000", amount: "10000000000000000", slippageBps: 100 })`
   → `{ "success": true, "requestId": "0x…", "txs": [{ "stepId": "deposit", "chainId": 8453, "hash": "0x…", "status": "success" }], "currencyIn": { … }, "currencyOut": { … }, "rate": "0.997", "totalImpact": { … }, "fees": { … }, "explorer": "https://explorer.inkonchain.com/tx/0x…", "statusCheck": "https://api.relay.link/intents/status?requestId=0x…" }`

3. **Track**
   `relay_get_requests({ hash: "0x…" })` → confirms the destination leg completed.

**Same-chain Ink swap** (e.g. ETH → USDT0): set both chain IDs to `57073` —
`relay_execute({ originChainId: 57073, destinationChainId: 57073, originCurrency: "0x0000000000000000000000000000000000000000", destinationCurrency: "0x0200c29006150606b650577bbe7b6248f58470c1", amount: "10000000000000000", slippageBps: 100 })`

## Gotchas

- **Origin funding**: you must hold the origin token + gas on the origin chain. `relay_execute` can't conjure funds.
- **Non-EVM origins (Solana/Bitcoin/etc.) aren't supported** by `relay_execute` — get a quote and submit the origin tx with that chain's wallet.
- **Custom RPCs**: override per-chain RPCs via the `EVM_RPC_OVERRIDES` env var (JSON `{chainId: url}`) for reliability/rate limits.
- **Decimals differ per chain/token** — always compute `amount` in the origin token's base units.

## Done when

`relay_get_requests` shows the request completed and `erc20_balance` on the destination chain reflects the received funds.
