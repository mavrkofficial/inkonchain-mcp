export const DailyGMPlusABI = [
  // ── Write Functions (all payable: msg.value MUST equal GM_FEE = 0.0005 ETH) ──
  { type: "function", name: "gm",         stateMutability: "payable", inputs: [],                                       outputs: [] },
  { type: "function", name: "gmTo",       stateMutability: "payable", inputs: [{ name: "recipient", type: "address" }], outputs: [] },
  { type: "function", name: "agentGm",    stateMutability: "payable", inputs: [],                                       outputs: [] },
  { type: "function", name: "agentGmTo",  stateMutability: "payable", inputs: [{ name: "recipient", type: "address" }], outputs: [] },
  // ── View Functions ──
  { type: "function", name: "GM_FEE",            stateMutability: "view", inputs: [],                                       outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "lastGM",            stateMutability: "view", inputs: [{ name: "user",    type: "address" }], outputs: [{ name: "lastGM",      type: "uint256" }] },
  { type: "function", name: "lastAgentGM",       stateMutability: "view", inputs: [{ name: "user",    type: "address" }], outputs: [{ name: "lastAgentGM", type: "uint256" }] },
  { type: "function", name: "isAgent",           stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "",            type: "bool"    }] },
  { type: "function", name: "identityRegistry",  stateMutability: "view", inputs: [],                                       outputs: [{ name: "",            type: "address" }] },
  { type: "function", name: "treasury",          stateMutability: "view", inputs: [],                                       outputs: [{ name: "",            type: "address" }] },
  { type: "function", name: "owner",             stateMutability: "view", inputs: [],                                       outputs: [{ name: "",            type: "address" }] },
  // ── Events ──
  { type: "event",  name: "GM",                       inputs: [{ name: "user",        type: "address", indexed: true }, { name: "recipient",   type: "address", indexed: true }, { name: "agent", type: "bool", indexed: false }] },
  { type: "event",  name: "FeeForwarded",             inputs: [{ name: "payer",       type: "address", indexed: true }, { name: "treasury",    type: "address", indexed: true }, { name: "amount", type: "uint256", indexed: false }] },
  { type: "event",  name: "IdentityRegistryUpdated",  inputs: [{ name: "oldRegistry", type: "address", indexed: true }, { name: "newRegistry", type: "address", indexed: true }] },
  { type: "event",  name: "TreasuryUpdated",          inputs: [{ name: "oldTreasury", type: "address", indexed: true }, { name: "newTreasury", type: "address", indexed: true }] },
  { type: "event",  name: "OwnershipTransferred",     inputs: [{ name: "oldOwner",    type: "address", indexed: true }, { name: "newOwner",    type: "address", indexed: true }] },
  // ── Errors (decoded by viem when reverting) ──
  { type: "error",  name: "InvalidIdentityRegistry",  inputs: [] },
  { type: "error",  name: "InvalidOwner",             inputs: [] },
  { type: "error",  name: "InvalidTreasury",          inputs: [] },
  { type: "error",  name: "NotRegisteredAgent",       inputs: [{ name: "account", type: "address" }] },
  { type: "error",  name: "SelfRecipient",            inputs: [] },
  { type: "error",  name: "DailyLimitActive",         inputs: [] },
  { type: "error",  name: "OnlyOwner",                inputs: [] },
  { type: "error",  name: "IncorrectFee",             inputs: [{ name: "sent", type: "uint256" }, { name: "required", type: "uint256" }] },
  { type: "error",  name: "FeeForwardFailed",         inputs: [] },
] as const;
