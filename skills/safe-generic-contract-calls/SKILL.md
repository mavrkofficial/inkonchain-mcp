---
name: safe-generic-contract-calls
description: Read from and write to known Ink protocol contracts through a guarded, allowlisted interface when no dedicated tool exists. Use when you need a specific function on a supported contract (erc20, sentry, tsunami factory/pool/position manager/quoter/router, identity) that the higher-level tools don't expose.
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

## Gotchas

- **Allowlist only**: an unknown `contractKey` or a `functionName` not in that contract's allowlist is refused — by design. This is not a raw-calldata tool.
- **Address overrides are restricted**: only `erc20` (and `tsunami_pool` for reads) accept an `address`; everything else uses the configured canonical address from `src/config.ts`.
- **Prefer dedicated tools**: `tsunami_swap_*`, `sentry_launch_*`, `erc20_approve`, etc. handle approvals, slippage, and decoding for you. Use `contract_*` only when there's no purpose-built tool.
- **Writes move funds** — confirm `args` carefully before approving.

## Done when

`contract_read` returns the value you needed, or `contract_write` returns a successful tx hash.
