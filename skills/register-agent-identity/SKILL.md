---
name: register-agent-identity
description: Register an ERC-8004 onchain agent identity on Ink. Required before launching agent tokens via sentry_launch_agent / sentry_launch_agent_usdt0 and before using the agent-gated DailyAgentGM contracts. Use when an agent needs a verifiable onchain identity NFT.
---

# Register an ERC-8004 agent identity

ERC-8004 is the onchain agent identity standard. On Ink, holding an identity NFT is a **prerequisite** for agent-gated actions: `sentry_launch_agent`, `sentry_launch_agent_usdt0`, and `dailygm_agent_gm`.

## Prerequisites

- A funded wallet with a little ETH for gas ([`getting-started-on-ink`](../getting-started-on-ink/SKILL.md)).

## Tools used

- `identity_check_registered` — is this wallet already registered?
- `identity_register` — mint the identity NFT.
- `identity_get_owner_agents` — list the agent token IDs a wallet owns.
- `identity_get_agent` — read an agent's metadata.
- `identity_set_agent_uri` — update metadata later (owner only).

## Steps

### 1. Check first (idempotent)

Call `identity_check_registered` (defaults to your wallet). If it returns registered/true, you're done — skip to step 3.

### 2. Register

Call `identity_register` with:
- `name` (required) — e.g. `"my-trading-bot"`
- `description` (required) — what the agent does
- `metadata` (optional) — array of `{ key, value }` pairs, e.g. `{ key: "domain", value: "myagent.ink" }`, `{ key: "twitter", value: "@myhandle" }`

The `agentURI` is built automatically as a base64 data URI from these fields — you don't construct it yourself. This mints an identity NFT to your wallet.

### 3. Confirm

- `identity_get_owner_agents` → returns your agent token ID(s).
- `identity_get_agent({ agentId })` → returns the decoded metadata.

## Gotchas

- **One-time per wallet for the basic gate**: the agent-gated tools only check that you *hold* an identity NFT. You don't need to re-register.
- **Updating metadata**: use `identity_set_agent_uri({ agentId, name, description })` — must be called by the NFT owner.
- **Pair with a `.ink` domain** ([`ink-domains-zns`](../ink-domains-zns/SKILL.md)) and put it in `metadata.domain` for a cleaner identity.

## Done when

`identity_check_registered` returns true for your wallet. You can now launch agent tokens and use `dailygm_agent_*`.
