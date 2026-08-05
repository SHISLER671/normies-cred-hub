"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { useAccount } from "wagmi"

import { ZULO } from "@/constants/contracts"
import { useMyNormies } from "@/hooks/use-my-normies"
import {
  getLastSelectedNormie,
  setLastSelectedNormie,
} from "@/lib/last-selected-normie"
import type { OwnedNormie } from "@/lib/types"

type ActiveNormieContextValue = {
  /**
   * Selected Normie for the connected wallet.
   * null when disconnected — never fake #7141 as the visitor's Active Normie.
   * When connected with no holdings, falls back to featured Zulo (#7141) for showcase.
   */
  activeTokenId: number | null
  setActiveTokenId: (tokenId: number) => void
  /** Controlled + delegated Normies for the connected wallet. */
  controlledNormies: OwnedNormie[]
  isLoading: boolean
  isError: boolean
  hasWallet: boolean
  /** Active entry from controlled set, if present. */
  activeNormie: OwnedNormie | null
}

const ActiveNormieContext = createContext<ActiveNormieContextValue | null>(
  null,
)

export function ActiveNormieProvider({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount()
  const {
    data: controlledNormies = [],
    isLoading,
    isError,
  } = useMyNormies(isConnected ? address : undefined)

  /** Internal selection while connected; ignored for exposed value when disconnected. */
  const [selectedTokenId, setSelectedTokenId] = useState<number>(ZULO.tokenId)
  const restoredWalletRef = useRef<string | null>(null)
  const hasWallet = Boolean(isConnected && address)

  const setActiveTokenId = useCallback(
    (tokenId: number) => {
      if (!Number.isFinite(tokenId) || tokenId < 0 || tokenId > 9999) return
      setSelectedTokenId(tokenId)
      if (address) {
        setLastSelectedNormie(address, tokenId)
      }
    },
    [address],
  )

  // Restore last selection when wallet / controlled set is ready
  useEffect(() => {
    if (!isConnected || !address || isLoading) return

    const walletKey = address.toLowerCase()
    const ownedIds = new Set(controlledNormies.map((n) => n.tokenId))
    const saved = getLastSelectedNormie(address)

    if (restoredWalletRef.current !== walletKey) {
      restoredWalletRef.current = walletKey
      if (saved !== null && ownedIds.has(saved)) {
        setSelectedTokenId(saved)
        return
      }
      if (controlledNormies.length > 0) {
        setSelectedTokenId(controlledNormies[0].tokenId)
        setLastSelectedNormie(address, controlledNormies[0].tokenId)
        return
      }
      // No controlled Normies — featured demo id for connected showcase only
      setSelectedTokenId(ZULO.tokenId)
      return
    }

    // After restore: if current active is no longer controlled but user has others, keep selection
    // unless list is empty (fall back to featured)
    if (controlledNormies.length === 0) return
    if (
      !ownedIds.has(selectedTokenId) &&
      saved !== null &&
      ownedIds.has(saved)
    ) {
      setSelectedTokenId(saved)
    }
  }, [
    isConnected,
    address,
    isLoading,
    controlledNormies,
    selectedTokenId,
  ])

  useEffect(() => {
    if (!address) {
      restoredWalletRef.current = null
      // Clear internal selection on disconnect so reconnect re-restores cleanly
      setSelectedTokenId(ZULO.tokenId)
    }
  }, [address])

  // Disconnected: no active user subject (null). Connected: selection or featured.
  const activeTokenId = hasWallet ? selectedTokenId : null

  const activeNormie = useMemo(
    () =>
      activeTokenId != null
        ? controlledNormies.find((n) => n.tokenId === activeTokenId) ?? null
        : null,
    [controlledNormies, activeTokenId],
  )

  const value = useMemo<ActiveNormieContextValue>(
    () => ({
      activeTokenId,
      setActiveTokenId,
      controlledNormies,
      isLoading: isConnected ? isLoading : false,
      isError: Boolean(isError),
      hasWallet,
      activeNormie,
    }),
    [
      activeTokenId,
      setActiveTokenId,
      controlledNormies,
      isConnected,
      isLoading,
      isError,
      hasWallet,
      activeNormie,
    ],
  )

  return (
    <ActiveNormieContext.Provider value={value}>
      {children}
    </ActiveNormieContext.Provider>
  )
}

export function useActiveNormie(): ActiveNormieContextValue {
  const ctx = useContext(ActiveNormieContext)
  if (!ctx) {
    // Safe fallback if used outside provider (e.g. tests) — disconnected posture
    return {
      activeTokenId: null,
      setActiveTokenId: () => {},
      controlledNormies: [],
      isLoading: false,
      isError: false,
      hasWallet: false,
      activeNormie: null,
    }
  }
  return ctx
}
