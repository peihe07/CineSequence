import type { Metadata } from 'next'
import { Inconsolata } from 'next/font/google'
import 'remixicon/fonts/remixicon.css'
import './globals.css'

const inconsolata = Inconsolata({ subsets: ['latin'], variable: '--font-inconsolata' })

export const metadata: Metadata = {
  title: 'Cine Sequence',
  description: 'Decode your cinematic DNA through movie choices',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <body className={inconsolata.variable}>{children}</body>
    </html>
  )
}
