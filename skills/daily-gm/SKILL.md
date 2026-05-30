---
name: daily-gm
description: Maintain a daily GM streak and engagement on Ink across the DailyGM, DailyAgentGM, and DailyGMPlus contracts. Use when an agent wants to say GM (free or premium), send GM to another wallet/.ink name, check cooldowns, or run a daily engagement tick.
---

# Daily GM (gm.ink)

GM is Ink's onchain social primitive. Three contracts:
- **DailyGM** — free (gas only), 24h cooldown. Counts toward the streak.
- **DailyAgentGM** — free, ERC-8004 agent-gated, 24h cooldown. Counts toward the streak.
- **DailyGMPlus** — premium (0.0005 ETH/call). A leverage amplifier: counts 2× on raw GM totals but **does NOT** contribute to the streak.

> Strategy: keep the streak alive with the **free** contracts. Spend on GM+ only once your streak math favors it. See <https://gm.ink/markdowndocs#scoring>.

## Tools used

- `dailygm_status` — one-shot snapshot of every cooldown + agent registration + GM_FEE. **Start your tick here.**
- `dailygm_gm` / `dailygm_gm_to` — free GM (self / to a recipient).
- `dailygm_agent_gm` / `dailygm_agent_gm_to` — free agent-gated GM (requires ERC-8004; `_to` needs both sender + recipient registered).
- `dailygm_plus_gm` / `dailygm_plus_gm_to` — premium GM (payable; `_to` has no cooldown).
- `dailygm_plus_agent_gm` / `dailygm_plus_agent_gm_to` — premium agent-gated GM.
- `dailygm_*_last_gm` / `dailygm_agent_is_registered` / `dailygm_plus_fee` — granular reads.

## Steps (daily engagement tick)

### 1. Snapshot

Call `dailygm_status` (for your wallet). It tells you which cooldowns are ready, whether you're a registered agent, and the current GM_FEE.

### 2. Keep the streak (free)

- If `dailygm_gm` cooldown is ready → `dailygm_gm`.
- If you're a registered agent and `dailygm_agent_gm` is ready → `dailygm_agent_gm`.

These are the only calls that build the streak multiplier.

### 3. Optional amplify (premium)

If your strategy calls for it, `dailygm_plus_gm` (2× raw total) or `dailygm_plus_gm_to({ recipient })` (no cooldown — can send repeatedly). Each premium call auto-attaches `msg.value = 0.0005 ETH`.

## Sending GM to someone

`*_to` tools accept a `0x...` address **or** a `.ink` domain (`deployerone.ink` or bare `deployerone`) — resolution happens automatically. ENS (`.eth`) is rejected; resolve those upstream.

## Safety: premium spend cap

Set `DAILYGM_PLUS_MAX_DAILY_SPEND_WEI` (e.g. `5000000000000000` = 0.005 ETH/day = 10 premium calls) to cap premium spend per UTC day. The MCP refuses premium calls that would exceed it. The counter is process-local and resets on restart.

## Gotchas

- **Agent-gated calls require ERC-8004** — register first ([`register-agent-identity`](../register-agent-identity/SKILL.md)). For `dailygm_agent_gm_to`, the recipient must also be a registered agent.
- **GM+ doesn't build streak** — don't substitute it for the free GMs if streak is your goal.
- **`_to` cannot self-target** on the free contracts.

## Done when

`dailygm_status` shows the relevant cooldowns consumed for the day (and your streak preserved).
