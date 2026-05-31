---
name: safe-generic-contract-calls
description: Read from and write to known Ink protocol contracts through a guarded, allowlisted interface when no dedicated tool exists. Use when you need a specific function on a supported contract (erc20, sentry, tsunami factory/pool/position manager/quoter/router, identity) that the higher-level tools don't expose. Triggers include "call a contract function", "contract_read", "contract_write", "raw read on <contract>", "no dedicated tool for this".
license: MIT
metadata:
  author: MAVRK
  version: "1.0.0"
  homepage: "https://github.com/mavrkofficial/inkonchain-mcp"
  network: "Ink mainnet (chain 57073)"
credentials:
  - name: EVM wallet key
    description: "EVM private key in the OS keychain (set via `npx inkonchain-mcp-setup`) or the EVM_PRIVATE_KEY env var. Required for contract_write; contract_read works without it."
    required: false
    storage: keychain
requires:
  mcp: inkonchain
  tools: [contract_read, contract_write]
  env: []
---

# Safe generic contract calls

`contract_read` and `contract_write` are **guarded escape hatches**: they only work against known Ink protocol ABIs and only for explicitly allowlisted functions. They refuse arbitrary calldata. Prefer a dedicated tool when one exists; reach for these only for gaps.

## Allowlisted contracts (`contractKey`)

| Key | Reads (examples) | Writes |
|---|---|---|
| `erc20` | `name`, `symbol`, `decimals`, `totalSupply`, `balanceOf`, `allowance` | `approve`, `transfer` |
| `sentry` | `owner`, `treasury`, `creatorFeeBps`, `protocolFeeController`, `krakenVerifiedRegistry`, `getSupportedBaseTokens`, `getPoolManager`, `getCreatorNFTs`, `getTokenByNFT`, `isAgentPosition`, `isKrakenVerifiedPosition`, `isGoPumpMePosition` | `launch`, `launchAgent`, `launchKrakenVerified`, `launchGoPumpMe` |
| `tsunami_factory` | `owner`, `getPool`, `feeAmountTickSpacing` | — |
| `tsunami_pool` | `slot0`, `liquidity`, `token0`, `token1`, `fee`, `tickSpacing` | — |
| `tsunami_position_manager` | `positions`, `balanceOf`, `tokenOfOwnerByIndex`, `ownerOf` | — |
| `tsunami_quoter` | `quoteExactInputSingle`, `quoteExactInput`, `quoteExactOutputSingle`, `quoteExactOutput` | — |
| `tsunami_router` | — | `exactInputSingle`, `exactInput`, `exactOutputSingle`, `exactOutput`, `multicall` |
| `identity` | `balanceOf`, `ownerOf`, `agentURI`, `totalSupply`, `tokenOfOwnerByIndex` | `register`, `setAgentURI` |

## Tools

- `contract_read({ contractKey, functionName, args?, address? })` — call an allowlisted read. `address` override is only allowed for `erc20` and `tsunami_pool` (every other contract uses its canonical address).
- `contract_write({ contractKey, functionName, args?, address?, value? })` — call an allowlisted write. `address` override only for `erc20`. `value` is optional native ETH in wei.

## Steps

### Read a value

`contract_read({ contractKey: "tsunami_pool", functionName: "slot0", address: "0x<pool>" })` → raw `slot0` tuple.

### Write a function

`contract_write({ contractKey: "erc20", functionName: "approve", args: ["0x<spender>", "1000000"], address: "0x<token>" })`.

`args` must be in **ABI order** and correct types (addresses as strings, uint as decimal strings).

## Worked example — read a pool, then approve via the guarded interface

Field values illustrative; field names match the real tool output. Prefer dedicated tools (`tsunami_*`, `erc20_approve`) when they exist — these are for gaps only.

1. **Read** an allowlisted function (address override allowed for `tsunami_pool`)
   `contract_read({ contractKey: "tsunami_pool", functionName: "slot0", address: "0x<pool>" })`
   → `{ "contractKey": "tsunami_pool", "address": "0x<pool>", "functionName": "slot0", "result": ["<sqrtPriceX96>", 195120, "…"] }`

2. **Write** an allowlisted function (`args` in ABI order; uint as decimal strings)
   `contract_write({ contractKey: "erc20", functionName: "approve", args: ["0x<spender>", "1000000"], address: "0x<token>" })`
   → `{ "contractKey": "erc20", "address": "0x<token>", "functionName": "approve", "hash": "0x…", "status": "success" }`

## Gotchas

- **Allowlist only**: an unknown `contractKey` or a `functionName` not in that contract's allowlist is refused — by design. This is not a raw-calldata tool.
- **Address overrides are restricted**: only `erc20` (and `tsunami_pool` for reads) accept an `address`; everything else uses the configured canonical address from `src/config.ts`.
- **Prefer dedicated tools**: `tsunami_swap_*`, `sentry_launch_*`, `erc20_approve`, etc. handle approvals, slippage, and decoding for you. Use `contract_*` only when there's no purpose-built tool.
- **Writes move funds** — confirm `args` carefully before approving.

## Done when

`contract_read` returns the value you needed, or `contract_write` returns a successful tx hash.
