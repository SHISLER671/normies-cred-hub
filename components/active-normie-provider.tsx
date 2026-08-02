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
  /** Currently selected Normie token ID (always defined; defaults to featured Zulo). */
  activeTokenId: number
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

  const [activeTokenId, setActiveTokenIdState] = useState<number>(ZULO.tokenId)
  const restoredWalletRef = useRef<string | null>(null)

  const setActiveTokenId = useCallback(
    (tokenId: number) => {
      if (!Number.isFinite(tokenId) || tokenId < 0 || tokenId > 9999) return
      setActiveTokenIdState(tokenId)
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
        setActiveTokenIdState(saved)
        return
      }
      if (controlledNormies.length > 0) {
        setActiveTokenIdState(controlledNormies[0].tokenId)
        setLastSelectedNormie(address, controlledNormies[0].tokenId)
        return
      }
      // No controlled Normies — keep featured demo id
      setActiveTokenIdState(ZULO.tokenId)
      return
    }

    // After restore: if current active is no longer controlled but user has others, keep selection
    // unless list is empty (fall back to featured)
    if (controlledNormies.length === 0) return
    if (!ownedIds.has(activeTokenId) && saved !== null && ownedIds.has(saved)) {
      setActiveTokenIdState(saved)
    }
  }, [
    isConnected,
    address,
    isLoading,
    controlledNormies,
    activeTokenId,
  ])

  useEffect(() => {
    if (!address) {
      restoredWalletRef.current = null
      setActiveTokenIdState(ZULO.tokenId)
    }
  }, [address])

  const activeNormie = useMemo(
    () =>
      controlledNormies.find((n) => n.tokenId === activeTokenId) ?? null,
    [controlledNormies, activeTokenId],
  )

  const value = useMemo<ActiveNormieContextValue>(
    () => ({
      activeTokenId,
      setActiveTokenId,
      controlledNormies,
      isLoading: isConnected ? isLoading : false,
      isError: Boolean(isError),
      hasWallet: Boolean(isConnected && address),
      activeNormie,
    }),
    [
      activeTokenId,
      setActiveTokenId,
      controlledNormies,
      isConnected,
      isLoading,
      isError,
      address,
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
    // Safe fallback if used outside provider (e.g. tests)
    return {
      activeTokenId: ZULO.tokenId,
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
