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
  title: 'NormiesCredHub — Awakened Normie Reputation Dashboard',
  description: 'View, verify, and build trust in your awakened ERC-8004 Normie agents. On-chain identity meets portable reputation.',
  openGraph: {
    title: 'NormiesCredHub',
    description: 'Your agent\'s on-chain reputation. Simple. Real. Awakened.',
    images: [{ url: '/og.png' }],
  },
  icons: {
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🌀</text></svg>',
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
