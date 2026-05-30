---
name: bridge-with-relay
description: Move funds onto/off Ink and swap across 60+ EVM chains using Relay. Use when an agent needs to bridge ETH/tokens between chains, fund an Ink wallet from another chain, or get a better route than thin local DEX liquidity (e.g. ETH↔USDT0 on Ink).
---

# Bridge and cross-chain swap with Relay

Relay routes swaps and bridges across 60+ EVM chains. The single locally-held EVM key signs on **every** EVM chain (addresses are deterministic), so one wallet bridges anywhere.

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

## Same-chain swap use case

`relay_execute` with `originChainId === destinationChainId` does a same-chain swap — useful on Ink for **ETH ↔ USDT0** where direct Tsunami liquidity is thin. Set both to `57073`.

## Gotchas

- **Origin funding**: you must hold the origin token + gas on the origin chain. `relay_execute` can't conjure funds.
- **Non-EVM origins (Solana/Bitcoin/etc.) aren't supported** by `relay_execute` — get a quote and submit the origin tx with that chain's wallet.
- **Custom RPCs**: override per-chain RPCs via the `EVM_RPC_OVERRIDES` env var (JSON `{chainId: url}`) for reliability/rate limits.
- **Decimals differ per chain/token** — always compute `amount` in the origin token's base units.

## Done when

`relay_get_requests` shows the request completed and `erc20_balance` on the destination chain reflects the received funds.
