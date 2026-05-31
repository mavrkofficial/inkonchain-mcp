---
name: ink-domains-zns
description: Resolve and register .ink domains (ZNS) on Ink. Use when an agent needs to turn a .ink name into an address (or vice versa), check availability, price, or register a name — e.g. to give an agent a human-readable identity or to resolve a recipient before sending. Triggers include "register a .ink domain", "resolve <name>.ink", "is <name> available", "domain price", "give my agent a name".
license: MIT
metadata:
  author: MAVRK
  version: "1.0.0"
  homepage: "https://github.com/mavrkofficial/inkonchain-mcp"
  network: "Ink mainnet (chain 57073)"
credentials:
  - name: EVM wallet key
    description: "EVM private key in the OS keychain (set via `npx inkonchain-mcp-setup`) or the EVM_PRIVATE_KEY env var. Required for registration (a write); resolution and price/availability reads work without it."
    required: false
    storage: keychain
requires:
  mcp: inkonchain
  tools: [zns_resolve_domain, zns_resolve_address, zns_check_domain, zns_get_price, zns_register, zns_get_metadata]
  env: []
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

## Worked example — register `myagent.ink`

Field values illustrative; field names match the real tool output.

1. **Available?**
   `zns_check_domain({ domain: "myagent" })`
   → `{ "domain": "myagent.ink", "available": true, "currentOwner": null }`

2. **Price it** (per-year × years)
   `zns_get_price({ domains: ["myagent"], years: 1 })`
   → `{ "domains": ["myagent.ink"], "years": 1, "prices": [{ "domain": "myagent.ink", "pricePerYearETH": "0.003000", "totalETH": "0.003000" }], "totalPriceETH": "0.003000", "totalPriceWei": "3000000000000000" }`

3. **Register** (to your wallet; a write, pays the fee in ETH)
   `zns_register({ domains: ["myagent"], years: 1 })`
   → `{ "domains": ["myagent.ink"], "owners": ["0xA11ce…"], "years": 1, "totalPriceETH": "0.003000", "txHash": "0x…", "status": "success" }`

4. **Resolve to confirm**
   `zns_resolve_domain({ domain: "myagent.ink" })` → `{ "domain": "myagent.ink", "address": "0xA11ce…", "found": true }`

## Gotchas

- **Minimum 1 year**: `zns_register` enforces `years >= 1`. The onchain registry technically accepts 0, but that domain would expire immediately — the tool refuses it.
- **TLD optional**: most tools accept the bare name or the `.ink` form.
- **ENS (`.eth`) is not ZNS** — those are different namespaces; resolve `.eth` upstream, not here.

## Done when

`zns_resolve_domain` returns the expected address (resolution), or `zns_resolve_address` lists your newly registered name (registration).
