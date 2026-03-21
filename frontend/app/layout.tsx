import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import 'remixicon/fonts/remixicon.css'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Cine Sequence',
  description: 'Decode your cinematic DNA through movie choices',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
