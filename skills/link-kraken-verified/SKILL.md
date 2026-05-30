---
name: link-kraken-verified
description: Link a KYC'd Kraken exchange account to an Ink EVM address ("Kraken Verified") and understand what it unlocks — the Kraken-Verified launch paths (sentry_launch_kraken_verified, sentry_launch_gopumpme) and verified-only token trading. Use when a user or operator wants to become Kraken Verified on Ink, or to understand how verification differs from ERC-8004 agent identity.
---

# Link a Kraken Verified account to Ink

Ink is Kraken's Ethereum L2. **Kraken Verified** ties an Ink EVM address to a KYC'd Kraken exchange account, recorded in the Kraken Verified registry (`0x54C3405f388E1d9DFbF69e43330F9F73B8EfdB32`). It's the compliance/identity gate for the Kraken-Verified launch paths on Sentry.

> This is mainly used by AI agents indirectly (a verified operator deploys on their behalf), but **a human can absolutely link their own Kraken account** and use the verified paths directly.

## Two different gates — don't confuse them

| Gate | What it proves | How to get it | Unlocks |
|---|---|---|---|
| **ERC-8004 identity** | An onchain agent identity NFT (no KYC) | `identity_register` (see [`register-agent-identity`](../register-agent-identity/SKILL.md)) | `sentry_launch_agent` / `sentry_launch_agent_usdt0` |
| **Kraken Verified** | A KYC'd Kraken account linked to your Ink address | Link at [inkonchain.com/verify](https://inkonchain.com/verify) | `sentry_launch_kraken_verified`, `sentry_launch_gopumpme`, verified-only trading |

Agents that just want to launch a USDT0 agent token need **only** ERC-8004 identity. Kraken Verified is for the compliant / Kraken-account-backed launch types.

## How to link (the verification flow)

Linking is a **website action** — it requires signing in to a real Kraken account, so it can't be done through the MCP (the MCP never performs KYC):

1. Go to **[inkonchain.com/verify](https://inkonchain.com/verify)**.
2. Sign in with / connect your KYC'd **Kraken account**.
3. Connect (or sign with) the **Ink EVM address** you want to verify — the same address whose key you've configured in `inkonchain-mcp`.
4. Complete the link. Your address is now recorded in the Kraken Verified registry.

Once linked, that address passes the registry's `canLaunch` check and can transfer/receive Kraken-Verified restricted tokens.

## What it unlocks in the MCP

After your configured wallet is Kraken Verified:

- `sentry_launch_kraken_verified({ name, symbol, baseToken? })` — deploy a **restricted-transfer** token whose transfers are checked against the Kraken Verified registry (only verified addresses can hold/trade it).
- `sentry_launch_gopumpme({ name, symbol, baseToken? })` — verified **deployer**, but the token trades openly; 100% of base-side LP fees route to the creator. See [`launch-a-token`](../launch-a-token/SKILL.md).

You can read the registry the factory points at with `sentry_get_factory_config` (`krakenVerifiedRegistry` field). If you call a verified-gated launch from an unverified address, the launch reverts the registry `canLaunch` check.

## Pairing with kraken-cli

For the exchange side of the same Kraken account, see [`kraken-cli`](https://github.com/krakenfx/kraken-cli) — Kraken's AI-native trading CLI with its own MCP server (spot, futures, xStocks, forex). Same Kraken account, two surfaces: CEX trading via kraken-cli, onchain verified launches via `inkonchain-mcp`.

## Gotchas

- **No KYC through the MCP.** Verification must be done at [inkonchain.com/verify](https://inkonchain.com/verify) with a Kraken account. The MCP only *uses* the resulting onchain status.
- **Verify the right address.** Link the exact Ink address whose key is configured in the MCP, or the gated launches will revert.
- **Verified ≠ ERC-8004.** They're independent. Agent USDT0 launches need ERC-8004 identity, not Kraken Verified.
- **Restricted tokens stay restricted.** A `launch_kraken_verified` token can only move between verified addresses — don't expect open trading; use `launch_gopumpme` for that.

## Done when

Your Ink address is linked at [inkonchain.com/verify](https://inkonchain.com/verify) and a `sentry_launch_kraken_verified` / `sentry_launch_gopumpme` call from that wallet succeeds.
