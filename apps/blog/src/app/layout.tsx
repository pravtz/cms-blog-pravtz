import type { Metadata } from 'next'
import { Inter, Newsreader } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const newsreader = Newsreader({
  subsets: ['latin'],
  variable: '--font-newsreader',
  display: 'swap',
  style: ['normal', 'italic'],
})

const BLOG_URL = process.env.NEXT_PUBLIC_BLOG_URL ?? 'http://localhost:3000'

export const metadata: Metadata = {
  metadataBase: new URL(BLOG_URL),
  title: {
    default: 'Nexus Blog',
    template: '%s | Nexus Blog',
  },
  description: 'Powered by Nexus CMS',
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: BLOG_URL,
    siteName: 'Nexus Blog',
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: BLOG_URL,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${newsreader.variable}`}>
      <body>{children}</body>
    </html>
  )
}
