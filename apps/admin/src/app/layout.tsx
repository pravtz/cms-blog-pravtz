import type { Metadata } from 'next'
import { Inter, Newsreader } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans-var',
  display: 'swap',
})

const newsreader = Newsreader({
  subsets: ['latin'],
  variable: '--font-serif-var',
  display: 'swap',
  style: ['normal', 'italic'],
})

export const metadata: Metadata = {
  title: 'Nexus CMS',
  description: 'Self-hosted editorial CMS',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${newsreader.variable}`}>
      <body>{children}</body>
    </html>
  )
}
