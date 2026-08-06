"use client"

import { wagmiConfig } from "@/lib/wagmi"
import { RainbowKitProvider, lightTheme, darkTheme } from "@rainbow-me/rainbowkit"
import "@rainbow-me/rainbowkit/styles.css"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider, useTheme } from "next-themes"
import { useState, useEffect } from "react"
import { WagmiProvider } from "wagmi"
import { ActiveNormieProvider } from "@/components/active-normie-provider"
import { WalletGateProvider } from "@/components/wallet-gate"

// Dynamic RainbowKit theme that follows our Light/Night system
function RainbowThemeProvider({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Monochrome wallet chrome — matches CredHub invert palette (no accent invent)
  const rainbowTheme = mounted && resolvedTheme === 'dark'
    ? darkTheme({
        accentColor: '#e5e5e5',
        accentColorForeground: '#0d0d0d',
        borderRadius: 'none',
        overlayBlur: 'small',
      })
    : lightTheme({
        accentColor: '#1a1a1a',
        accentColorForeground: '#e5e5e5',
        borderRadius: 'none',
        overlayBlur: 'small',
      })

  return (
    <RainbowKitProvider theme={rainbowTheme} modalSize="compact">
      {children}
    </RainbowKitProvider>
  )
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  )

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          storageKey="credhub-theme"
          disableTransitionOnChange
        >
          <RainbowThemeProvider>
            <WalletGateProvider>
              <ActiveNormieProvider>{children}</ActiveNormieProvider>
            </WalletGateProvider>
          </RainbowThemeProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
