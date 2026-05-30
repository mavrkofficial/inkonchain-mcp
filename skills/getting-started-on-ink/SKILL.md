---
name: getting-started-on-ink
description: Set up and orient an agent wallet on Ink — create or load a wallet, check ETH gas and token balances, and acquire ETH/USDT0 to start transacting. Use this first, before any other Ink skill, whenever an agent has no wallet, no gas, or is unsure of its onchain state.
---

# Getting started on Ink

The foundation skill: get a funded, working wallet on Ink (chain ID `57073`) so every other skill can run.

## Prerequisites

- The `inkonchain` MCP server configured in your client.
- Either a stored key (`npx inkonchain-mcp-setup`) **or** willingness to generate a fresh one with `wallet_create`.

## Tools used

- `wallet_address` — return the configured wallet address + native ETH balance.
- `wallet_create` — generate a fresh EVM wallet, store the key in the OS keychain.
- `erc20_balance` — check any token balance (use the zero address for native ETH).
- `relay_execute` — bring funds onto Ink from another chain, or swap ETH ↔ USDT0.

## Steps

### 1. Do I already have a wallet?

Call `wallet_address`.
- If it returns an address + balance → you have a wallet. Note the ETH balance.
- If it errors with "No EVM private key found" → create one (step 2).

### 2. Create a wallet (only if needed)

Call `wallet_create`. This generates a new EVM keypair and stores the private key in your OS keychain. It refuses to overwrite an existing key unless you pass `overwrite: true`.

> The same address works on every EVM chain (Ink, Base, Arbitrum, Ethereum, …) because the address is derived deterministically from the key. That matters for bridging in step 4.

### 3. Check balances

- Native ETH (for gas): `erc20_balance({ token: "0x0000000000000000000000000000000000000000" })`
- USDT0 (the agent-market base asset): `erc20_balance({ token: "0x0200c29006150606b650577bbe7b6248f58470c1" })`

You need a small amount of **ETH for gas** to do anything that isn't gas-sponsored.

### 4. Fund the wallet

If ETH is `0`, you must get ETH onto Ink. Options:

- **Bridge from another chain** you already hold funds on — see the [`bridge-with-relay`](../bridge-with-relay/SKILL.md) skill. Example: bridge Base ETH → Ink ETH with `relay_execute`.
- **Swap on Ink** once you have some ETH: use `relay_execute` (good for ETH ↔ USDT0 where Tsunami liquidity is thin) or the [`trade-on-tsunami`](../trade-on-tsunami/SKILL.md) skill.

## Gotchas

- **Decimals**: ETH is 18 decimals, USDT0/USDC are 6. `erc20_balance` returns raw + formatted; always read the formatted value when reasoning about "how much".
- **Gas**: keep a buffer of native ETH. Even gas-sponsored flows (x402) still benefit from a tiny ETH balance for fallbacks.
- **One key, many chains**: never assume "I'm on Ink" — `relay_execute` can sign on other chains with the same key. Double-check `originChainId`.

## Done when

`wallet_address` returns a non-zero ETH balance and `erc20_balance` shows the assets you intend to use.
