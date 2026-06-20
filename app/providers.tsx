"use client"

import { wagmiConfig } from "@/lib/wagmi"
import { RainbowKitProvider, lightTheme, darkTheme } from "@rainbow-me/rainbowkit"
import "@rainbow-me/rainbowkit/styles.css"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider, useTheme } from "next-themes"
import { useState, useEffect } from "react"
import { WagmiProvider } from "wagmi"

// Dynamic RainbowKit theme that follows our Light/Night system
function RainbowThemeProvider({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const rainbowTheme = mounted && resolvedTheme === 'dark'
    ? darkTheme({
        accentColor: '#c084fc', // refined electric purple for night
        accentColorForeground: '#111110',
        borderRadius: 'medium',
        overlayBlur: 'small',
      })
    : lightTheme({
        accentColor: '#7c3aed', // more refined purple for light
        accentColorForeground: '#ffffff',
        borderRadius: 'medium',
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
          disableTransitionOnChange
        >
          <RainbowThemeProvider>
            {children}
          </RainbowThemeProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
