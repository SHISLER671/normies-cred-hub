/**
 * ERC-6551 / token-bound account abstraction for Zulo.
 *
 * @example
 * ```ts
 * import { getZuloAccountPlane, resolveNormieTba } from "@/lib/erc6551"
 *
 * const plane = getZuloAccountPlane("scaffold")
 * const tba = await resolveNormieTba(7141, { status: "scaffold", enrich: true })
 * ```
 */

export {
  ERC6551_REGISTRY,
  ERC6551_DEFAULT_SALT,
  ERC6551_IS_VALID_SIGNER_MAGIC,
  ERC6551_REGISTRY_ABI,
  ERC6551_ACCOUNT_ABI,
  TOKENBOUND_ACCOUNT_PROXY,
  TOKENBOUND_ACCOUNT_IMPLEMENTATION,
  TOKENBOUND_V3_DEFAULTS,
  type Erc6551Version,
} from "./constants"

export {
  buildTokenBoundBinding,
  registryAccountAddress,
  isContractDeployed,
  readAccountToken,
  readAccountState,
  isValidTbaSigner,
  resolveTokenBoundAccount,
  encodeCreateAccountCall,
  isSelfOwnershipCycle,
  normalizeTokenId,
} from "./registry"

export {
  createTokenboundAccountProvider,
  type TokenboundProviderOptions,
} from "./providers/tokenbound"

export { createDisabledAccountProvider } from "./providers/disabled"

export {
  getZuloTbaProviderStatus,
  createZuloAccountProvider,
  getZuloAccountPlane,
  resolveNormieTba,
  resolveZuloTba,
  assertSafeTbaDeposit,
  type ZuloTbaEnablement,
} from "./zulo-account"

export type {
  AccountControlMode,
  TokenBoundBinding,
  ResolvedTokenBoundAccount,
  ResolveAccountParams,
  TbaSecurityPolicy,
  AccountProvider,
  ZuloAccountPlane,
} from "./types"

export { DEFAULT_TBA_SECURITY_POLICY } from "./types"
