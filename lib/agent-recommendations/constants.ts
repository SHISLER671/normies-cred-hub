// lib/agent-recommendations/constants.ts
// Zulo identity baselines + UI copy for the standalone recommendations plugin.

/** Featured proof-of-concept agent: Normie #7141 → Zulo → ERC-8004 agentId 32626. */
export const ZULO_IDENTITY = {
  tokenId: 7141,
  agentId: 32626,
  name: "Zulo",
  hotWallet: "0xb8792E6516b88e73eD0723F8C1C8a92531A98767",
  ens: "32626.eth",
  delegatedTo: "0xFafd8Fb6b4E43ACE0E365553f1b9242384591031",
  chainId: 1,
} as const

export const ZULO_RECOMMENDATIONS_DYOR =
  "Informational only — not financial, legal, or security advice. DYOR before any on-chain action. Zulo never asks for keys, signatures, or approvals."

export const MAX_SESSION_HISTORY = 5
export const MAX_USER_QUERY_CHARS = 1000
