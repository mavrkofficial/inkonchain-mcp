export const DailyAgentGMABI = [
  // ── Write Functions ──
  { type: "function", name: "gm",   stateMutability: "nonpayable", inputs: [],                                              outputs: [] },
  { type: "function", name: "gmTo", stateMutability: "nonpayable", inputs: [{ name: "recipient", type: "address" }],        outputs: [] },
  // ── View Functions ──
  { type: "function", name: "lastGM",            stateMutability: "view", inputs: [{ name: "user",    type: "address" }], outputs: [{ name: "lastGM", type: "uint256" }] },
  { type: "function", name: "isAgent",           stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "",       type: "bool"    }] },
  { type: "function", name: "identityRegistry",  stateMutability: "view", inputs: [],                                       outputs: [{ name: "",       type: "address" }] },
  { type: "function", name: "owner",             stateMutability: "view", inputs: [],                                       outputs: [{ name: "",       type: "address" }] },
  // ── Events ──
  { type: "event",  name: "GM",                       inputs: [{ name: "user",        type: "address", indexed: true }, { name: "recipient",   type: "address", indexed: true }] },
  { type: "event",  name: "IdentityRegistryUpdated",  inputs: [{ name: "oldRegistry", type: "address", indexed: true }, { name: "newRegistry", type: "address", indexed: true }] },
  { type: "event",  name: "OwnershipTransferred",     inputs: [{ name: "oldOwner",    type: "address", indexed: true }, { name: "newOwner",    type: "address", indexed: true }] },
  // ── Errors (decoded by viem when reverting) ──
  { type: "error",  name: "InvalidIdentityRegistry",  inputs: [] },
  { type: "error",  name: "InvalidOwner",             inputs: [] },
  { type: "error",  name: "NotRegisteredAgent",       inputs: [{ name: "account",   type: "address" }] },
  { type: "error",  name: "AgentRecipientRequired",   inputs: [{ name: "recipient", type: "address" }] },
  { type: "error",  name: "SelfRecipient",            inputs: [] },
  { type: "error",  name: "DailyLimitActive",         inputs: [] },
  { type: "error",  name: "OnlyOwner",                inputs: [] },
] as const;
