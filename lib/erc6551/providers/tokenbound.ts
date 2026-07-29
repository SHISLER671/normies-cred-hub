/**
 * Tokenbound V3.1 ERC-6551 account provider.
 * Uses fixed singleton registry + Tokenbound Account Proxy as implementation.
 */

import type { PublicClient } from "viem"

import {
  TOKENBOUND_V3_DEFAULTS,
} from "../constants"
import {
  buildTokenBoundBinding,
  encodeCreateAccountCall,
  isSelfOwnershipCycle,
  resolveTokenBoundAccount,
} from "../registry"
import type {
  AccountProvider,
  ResolveAccountParams,
  TbaSecurityPolicy,
} from "../types"
import { DEFAULT_TBA_SECURITY_POLICY } from "../types"

export type TokenboundProviderOptions = {
  /** Override default security policy */
  security?: Partial<TbaSecurityPolicy>
  /**
   * Product enablement. Zulo ships `scaffold` — resolve/encode work,
   * but product UX should not claim live TBA control until flipped to live.
   */
  status?: AccountProvider["status"]
  /** Optional default PublicClient for resolveAccount when caller omits client */
  defaultClient?: PublicClient
}

export function createTokenboundAccountProvider(
  options: TokenboundProviderOptions = {},
): AccountProvider {
  const security: TbaSecurityPolicy = {
    ...DEFAULT_TBA_SECURITY_POLICY,
    ...options.security,
    notes: [
      ...DEFAULT_TBA_SECURITY_POLICY.notes,
      ...(options.security?.notes ?? []),
    ],
  }

  const status = options.status ?? "scaffold"

  return {
    id: "tokenbound-v3",
    version: TOKENBOUND_V3_DEFAULTS.version,
    status,
    security,

    async resolveAccount(params, client) {
      const c = client ?? options.defaultClient
      if (!c) {
        throw new Error(
          "TokenboundAccountProvider.resolveAccount requires a PublicClient",
        )
      }
      return resolveTokenBoundAccount(c, {
        ...params,
        implementation:
          params.implementation ?? TOKENBOUND_V3_DEFAULTS.implementation,
        salt: params.salt ?? TOKENBOUND_V3_DEFAULTS.salt,
        registry: params.registry ?? TOKENBOUND_V3_DEFAULTS.registry,
      })
    },

    encodeCreateAccount(params) {
      const binding = buildTokenBoundBinding(
        {
          ...params,
          implementation:
            params.implementation ?? TOKENBOUND_V3_DEFAULTS.implementation,
          salt: params.salt ?? TOKENBOUND_V3_DEFAULTS.salt,
          registry: params.registry ?? TOKENBOUND_V3_DEFAULTS.registry,
        },
        TOKENBOUND_V3_DEFAULTS.version,
      )
      return encodeCreateAccountCall(binding)
    },

    wouldCreateOwnershipCycle(input) {
      if (!security.blockSelfOwnershipCycle) return false
      return isSelfOwnershipCycle(input)
    },
  }
}
