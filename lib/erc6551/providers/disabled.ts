/**
 * No-op account provider — Zulo's default until TBA product path is enabled.
 * Keeps identity plane (ERC-8004 / Normie) independent of any TBA address.
 */

import type { AccountProvider } from "../types"
import { DEFAULT_TBA_SECURITY_POLICY } from "../types"

export function createDisabledAccountProvider(
  reason = "ERC-6551 TBA not enabled for Zulo product surface",
): AccountProvider {
  return {
    id: "disabled",
    version: "none",
    status: "disabled",
    security: {
      ...DEFAULT_TBA_SECURITY_POLICY,
      notes: [...DEFAULT_TBA_SECURITY_POLICY.notes, reason],
    },

    async resolveAccount() {
      throw new Error(
        `[account-provider:disabled] ${reason}. Use createTokenboundAccountProvider() when enabling TBA.`,
      )
    },

    wouldCreateOwnershipCycle() {
      // No TBA — no cycle risk via this provider
      return false
    },
  }
}
