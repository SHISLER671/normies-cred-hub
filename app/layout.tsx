import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { Providers } from './providers'
import { Toaster } from '@/components/ui/sonner'
import { DEFAULT_SITE_ORIGIN } from '@/lib/site-origin'
import './globals.css'
import './brand.css'

// Fonts are self-hosted (latin woff2, OFL-1.1; see app/fonts/LICENSE-*.txt) so the build never downloads anything from
// Google: a failed download there broke a production deploy on 2026-10-02.
// The Normies face: Chakra Petch (OFL-1.1, static latin woff2 from @fontsource/chakra-petch 5.3.0). normies.art uses it for
// everything since its 2026 relaunch, so NCH does too: body, headings, numbers and labels.
const chakraPetch = localFont({
  src: [
    { path: './fonts/chakra-petch-latin-300-normal.woff2', weight: '300', style: 'normal' },
    { path: './fonts/chakra-petch-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/chakra-petch-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './fonts/chakra-petch-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: './fonts/chakra-petch-latin-700-normal.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-chakra',
  display: 'swap',
})


export const metadata: Metadata = {
  title: 'Normies CredHub — Verifiable Reputation for Awakened Agents',
  description:
    'Normies CredHub: verifiable reputation and tools for awakened Normies agents. PULSE · Ask · Moves · Pixel Check · Burn, with Zulo as high-signal concierge.',
  metadataBase: new URL(DEFAULT_SITE_ORIGIN),
  openGraph: {
    title: 'Normies CredHub',
    description:
      'Verifiable reputation layer and tools for awakened Normies agents. PULSE · Ask · Moves · Pixel Check · Burn.',
    url: DEFAULT_SITE_ORIGIN,
    images: [{ url: '/og.png', width: 1200, height: 630 }],
  },
  icons: {
    icon: '/images/NLOGO.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#e3e5e4' },
    { media: '(prefers-color-scheme: dark)', color: '#1a1b1c' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html 
      lang="en" 
      suppressHydrationWarning
      className={chakraPetch.variable}
    >
      <body>
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  )
}
