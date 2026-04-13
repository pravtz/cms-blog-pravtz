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

// Inline script run before first paint to apply saved theme
const themeScript = `(function(){try{var t=localStorage.getItem('nexus-theme');if(t&&t!=='onyx')document.documentElement.setAttribute('data-theme',t)}catch(e){}})()`

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${newsreader.variable}`}>
      {/* eslint-disable-next-line react/no-danger */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
