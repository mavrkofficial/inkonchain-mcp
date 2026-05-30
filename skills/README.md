# inkonchain-mcp Skills Library

Operational playbooks for AI agents using the [`inkonchain-mcp`](https://www.npmjs.com/package/inkonchain-mcp) server. The MCP gives an agent the **tools**; these skills give it the **playbooks** — when to use each tool, in what order, with which parameters, and what to watch out for.

Each skill is a self-contained `SKILL.md` with YAML frontmatter (`name`, `description`) so it loads in Claude/Cursor skill loaders or can be read directly as Markdown.

## How to use

1. Make sure the `inkonchain` MCP server is configured in your client (see the package [README](../README.md)).
2. Store a wallet key once: `npx inkonchain-mcp-setup` (or generate one with `wallet_create`).
3. Pick the skill that matches your goal below and follow its steps.

## Skill index

| Goal | Skill | Key tools |
|---|---|---|
| Set up a wallet, gas, and orientation | [`getting-started-on-ink`](getting-started-on-ink/SKILL.md) | `wallet_address`, `wallet_create`, `erc20_balance`, `relay_execute` |
| Register an ERC-8004 agent identity | [`register-agent-identity`](register-agent-identity/SKILL.md) | `identity_register`, `identity_check_registered` |
| Link a KYC'd Kraken account (Kraken Verified) | [`link-kraken-verified`](link-kraken-verified/SKILL.md) | inkonchain.com/verify, `sentry_get_factory_config` |
| Launch a token (4 launch types) | [`launch-a-token`](launch-a-token/SKILL.md) | `sentry_launch*`, `sentry_get_agent_launch_readiness` |
| Check and collect the creator fees you earn | [`earn-and-collect-creator-fees`](earn-and-collect-creator-fees/SKILL.md) | `sentry_get_creator_fee_status`, `sentry_collect_fees` |
| Swap tokens on the DEX | [`trade-on-tsunami`](trade-on-tsunami/SKILL.md) | `tsunami_quote_*`, `tsunami_swap_*` |
| Provide concentrated liquidity | [`provide-liquidity`](provide-liquidity/SKILL.md) | `tsunami_create_pool`, `tsunami_mint_position`, `tsunami_collect_fees` |
| Bridge / swap across chains | [`bridge-with-relay`](bridge-with-relay/SKILL.md) | `relay_get_quote`, `relay_execute` |
| Pay (and get paid) in stablecoins | [`accept-x402-payments`](accept-x402-payments/SKILL.md) | `x402_pay`, `x402_settle`, `x402_router_info` |
| Charge for your own resource/API (merchant side) | [`charge-x402-payments`](charge-x402-payments/SKILL.md) | `x402_verify`, `x402_settle`, `x402_router_info` |
| Read protocol/pool/wallet analytics | [`analytics-with-subgraph`](analytics-with-subgraph/SKILL.md) | `subgraph_*`, `analytics_token_report` |
| Resolve / register `.ink` domains | [`ink-domains-zns`](ink-domains-zns/SKILL.md) | `zns_resolve_domain`, `zns_register` |
| Keep a GM streak alive | [`daily-gm`](daily-gm/SKILL.md) | `dailygm_status`, `dailygm_gm`, `dailygm_plus_*` |
| Read/write any known contract safely | [`safe-generic-contract-calls`](safe-generic-contract-calls/SKILL.md) | `contract_read`, `contract_write` |

## Shared conventions (read once)

These apply to every skill:

- **Network**: Ink mainnet, chain ID `57073`. Block explorer: `https://explorer.inkonchain.com`.
- **Amounts are base units** ("wei"), not decimal. ETH/WETH have **18 decimals**; **USDC and USDT0 have 6 decimals**. So `1 USDT0 = "1000000"`, `0.05 USDC = "50000"`, `1 ETH = "1000000000000000000"`.
- **Native ETH** is represented as the zero address `0x0000000000000000000000000000000000000000` in `erc20_balance` / `erc20_transfer`.
- **Sentry-launched pools always use the 1% fee tier** — pass `fee: 10000` to any Tsunami tool that touches a Sentry-launched token. **Exception:** the `SENTRY` ecosystem token (`0xb3C4FB17a34925CA907EFF851FcD176e2801FdAA`) was created outside the factory and trades as **WETH/SENTRY at the 2% tier** (`fee: 20000`) — base may move to USDT0 later.
- **Reads are free and safe.** Writes move real funds — always confirm parameters before approving.
- **The wallet key is local.** It lives in your OS keychain (or `EVM_PRIVATE_KEY`) and never leaves the machine; the model only sees tool results.

## Canonical Ink addresses

| Name | Address |
|---|---|
| WETH9 | `0x4200000000000000000000000000000000000006` |
| USDT0 | `0x0200c29006150606b650577bbe7b6248f58470c1` |
| USDC | `0x2D270e6886d130D724215A266106e6832161EAEd` |
| SENTRY (ecosystem token) | `0xb3C4FB17a34925CA907EFF851FcD176e2801FdAA` — WETH pair, **2% tier** (`fee: 20000`), not factory-launched |
| SentryLaunchFactory | `0xDc37e11B68052d1539fa23386eE58Ac444bf5BE1` |
| Tsunami V3 Factory | `0xD8B0826150B7686D1F56d6F10E31E58e1BCF1193` |
| Tsunami Position Manager | `0x98b6267DA27c5A21Bd6e3edfBC2DA6b0428Fa9F7` |
| ERC-8004 Identity Registry | `0x7274e874CA62410a93Bd8bf61c69d8045E399c02` |
| x402 USDC router | `0xa1aD9AE09d28C13CBB783e47C7d1B97F96C6711e` |
| x402 USDT0 router | `0x0d1e92c107bB315e425278CD999D90be804F39d6` |

> These mirror `src/config.ts`. If they ever drift, the config file is the source of truth.
