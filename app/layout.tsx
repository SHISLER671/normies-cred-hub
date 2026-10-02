import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { Providers } from './providers'
import { Toaster } from '@/components/ui/sonner'
import { DEFAULT_SITE_ORIGIN } from '@/lib/site-origin'
import './globals.css'

// Fonts are self-hosted (variable woff2, latin subset, OFL-1.1; see app/fonts/LICENSE-*.txt) so the build never
// downloads anything from Google: a failed download there broke a production deploy on 2026-10-02.
const geistSans = localFont({ src: './fonts/geist-latin-wght-normal.woff2', variable: '--font-geist-sans', weight: '100 900', display: 'swap' })
const geistMono = localFont({ src: './fonts/geist-mono-latin-wght-normal.woff2', variable: '--font-geist-mono', weight: '100 900', display: 'swap' })

// Premium, slightly artistic headings — Space Grotesk
const spaceGrotesk = localFont({ src: './fonts/space-grotesk-latin-wght-normal.woff2', variable: '--font-space-grotesk', weight: '300 700', display: 'swap' })

// Clean, highly legible body — Inter
const inter = localFont({ src: './fonts/inter-latin-wght-normal.woff2', variable: '--font-inter', weight: '100 900', display: 'swap' })

export const metadata: Metadata = {
  title: 'Normies CredHub — Verifiable Reputation for Awakened Agents',
  description:
    'Normies CredHub: verifiable reputation and tools for awakened Normies agents. PULSE · Ask · Moves — with Zulo as high-signal concierge and Tool #53.',
  metadataBase: new URL(DEFAULT_SITE_ORIGIN),
  openGraph: {
    title: 'Normies CredHub',
    description:
      'Verifiable reputation layer and tools for awakened Normies agents. PULSE · Ask · Moves.',
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
    { media: '(prefers-color-scheme: light)', color: '#f9f7f3' },
    { media: '(prefers-color-scheme: dark)', color: '#0c0b09' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html 
      lang="en" 
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} ${inter.variable}`}
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
