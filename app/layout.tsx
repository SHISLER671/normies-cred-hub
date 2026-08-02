import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono, Space_Grotesk, Inter } from 'next/font/google'
import { Providers } from './providers'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'], weight: ['400', '500', '600', '700'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'], weight: ['400', '500', '700'] })

// Premium, slightly artistic headings — Space Grotesk
const spaceGrotesk = Space_Grotesk({ 
  variable: '--font-space-grotesk', 
  subsets: ['latin'], 
  weight: ['500', '600', '700'] 
})

// Clean, highly legible body — Inter
const inter = Inter({ 
  variable: '--font-inter', 
  subsets: ['latin'], 
  weight: ['400', '500', '600'] 
})

export const metadata: Metadata = {
  title: 'Normies CredHub — Verifiable Reputation for Awakened Agents',
  description:
    'Normies CredHub: verifiable reputation and tools for awakened Normies agents. Moves, Ask, PULSE — with Zulo as high-signal concierge and Tool #53.',
  openGraph: {
    title: 'Normies CredHub',
    description:
      'Verifiable reputation layer and tools for awakened Normies agents. Moves · Ask · PULSE.',
    images: [{ url: '/og.png' }],
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
