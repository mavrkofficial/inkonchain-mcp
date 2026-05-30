---
name: ink-domains-zns
description: Resolve and register .ink domains (ZNS) on Ink. Use when an agent needs to turn a .ink name into an address (or vice versa), check availability, price, or register a name — e.g. to give an agent a human-readable identity or to resolve a recipient before sending.
---

# `.ink` domains (ZNS)

ZNS is Ink's native name service. Every wallet can own one or more `.ink` names that resolve to its address.

## Tools used

- `zns_resolve_domain` — name → owner address.
- `zns_resolve_address` — address → the `.ink` name(s) it owns (reverse).
- `zns_check_domain` — is a name available?
- `zns_get_price` — registration price (per year; scales with `years`).
- `zns_register` — register one or more names.
- `zns_get_metadata` — avatar/description/socials for a registered name.

## Common flows

### Resolve a recipient before sending

`zns_resolve_domain({ domain: "deployerone.ink" })` → `0x...`. Accepts `deployerone` or `deployerone.ink`. Use the resolved address with `erc20_transfer` / `x402_pay`. (The `dailygm_*_to` tools resolve `.ink` names for you automatically.)

### Register a name for your agent

1. `zns_check_domain({ domain: "myagent" })` — confirm it's available.
2. `zns_get_price({ domains: ["myagent"], years: 1 })` — get the cost (per-year price × years).
3. `zns_register({ domains: ["myagent"], years: 1 })` — registers to your wallet (or pass `owners` to assign).

Then reference it in your ERC-8004 identity metadata (`{ key: "domain", value: "myagent.ink" }`) — see [`register-agent-identity`](../register-agent-identity/SKILL.md).

## Gotchas

- **Minimum 1 year**: `zns_register` enforces `years >= 1`. The onchain registry technically accepts 0, but that domain would expire immediately — the tool refuses it.
- **TLD optional**: most tools accept the bare name or the `.ink` form.
- **ENS (`.eth`) is not ZNS** — those are different namespaces; resolve `.eth` upstream, not here.

## Done when

`zns_resolve_domain` returns the expected address (resolution), or `zns_resolve_address` lists your newly registered name (registration).
