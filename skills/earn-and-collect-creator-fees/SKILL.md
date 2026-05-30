---
name: earn-and-collect-creator-fees
description: Understand how creator trading fees work for Sentry-launched tokens — how fees route to the creator, how to check accrued/uncollected amounts, and who can actually trigger collection (the factory owner only, not the creator). Use when an agent or user wants to see or reason about the trading-fee revenue from tokens they launched.
---

# Earn (and get paid) creator fees

Every Sentry launch holds its LP permanently inside the factory. As people trade the token, the position accrues fees. The creator **earns** a share of those fees, and can **collect them directly** — collection routes each side automatically no matter who triggers it.

> **Key fact:** `collectFees` / `collectMultipleFees` are callable by the **factory owner** (any token IDs) **or by the token's creator** (only IDs they created — the creator pays the gas). `_routeFees` always sends the creator share to `nftCreators[tokenId]` and the rest to treasury, so it's safe regardless of caller. A non-owner trying to collect a token they didn't create reverts with `"Not owner or creator"`.

## How fees route (when the owner collects)

`_routeFees` runs inside the owner's collect call and splits each position's accrued fees:
- **Launched-token side** → 100% treasury.
- **Base-token side** (WETH or USDT0) → `creatorFeeBps` to the **creator** (`nftCreators[tokenId]`), remainder to treasury.
- **GoPumpMe** launches → **100% of the base side to the creator**.
- Unknown/legacy pair or unset creator → falls through to treasury (defensive, never reverts).

So an agent that launched a USDT0 market earns **USDT0**, deposited straight to its wallet whenever the owner runs a collection sweep.

## Who can collect

| Role | Can do |
|---|---|
| **Creator (any EOA/agent)** | Collect fees for **tokens they created** (pays own gas); check accrued amounts; confirm payouts. |
| **Factory owner / admin** | Collect **any** token IDs (e.g. an operator sweep across all creators). |

Either way, routing is identical: creator share → creator, remainder → treasury.

## Tools used

- `sentry_get_creator_nfts` — all LP NFT IDs for a creator.
- `sentry_get_creator_fee_status` — per-NFT uncollected fee counters (what's accrued and owed).
- `sentry_collect_fees` — collect + route. Owner can pass any IDs; a creator may only pass IDs they created.
- `erc20_balance` — confirm a payout landed.
- `analytics_creator_dashboard` — total creator fees **already paid out** (from the subgraph's `creatorFeePayments`), aggregated across all your tokens.

## Steps (collect your own fees as a creator)

### 1. Find your positions

`sentry_get_creator_nfts({ creator? })` (defaults to your wallet) → your LP NFT token IDs.

### 2. See what you've accrued

`sentry_get_creator_fee_status({ creator? })` → per-NFT uncollected fee counters.

### 3. Collect

`sentry_collect_fees({ tokenIds: ["111", "110", ...] })` — pass only IDs you created. The factory collects each position and routes your share to you (the rest to treasury). You pay the gas. For large batches, collect in chunks (~10 IDs per call) to avoid nonce/gas issues.

### 4. Confirm payout

`erc20_balance({ token: "0x0200c29006150606b650577bbe7b6248f58470c1" })` (USDT0 markets) → confirm your balance increased. Then `analytics_creator_dashboard({ creator })` to see your paid-out total over time.

## Gotchas

- **Creators can only collect their own tokens.** Passing a token ID you didn't create reverts with `"Not owner or creator"`. The owner can collect any ID.
- **You pay the gas** when you collect your own tokens — keep a little ETH around.
- **USD value ≠ token amount.** A low-volume token shows tiny counters; use `analytics_token_report` for volume context.
- **GoPumpMe vs others.** GoPumpMe creators get 100% of the base side; other launch types get the `creatorFeeBps` split.

## Done when

`sentry_collect_fees` confirms and `erc20_balance` shows your increased creator balance.
