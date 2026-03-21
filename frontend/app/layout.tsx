import type { Metadata } from 'next'
import { Inconsolata, Silkscreen } from 'next/font/google'
import 'remixicon/fonts/remixicon.css'
import './globals.css'

const inconsolata = Inconsolata({ subsets: ['latin'], variable: '--font-inconsolata' })
const silkscreen = Silkscreen({ weight: ['400', '700'], subsets: ['latin'], variable: '--font-silkscreen' })

export const metadata: Metadata = {
  title: 'Cine Sequence',
  description: 'Decode your cinematic DNA through movie choices',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <body className={`${inconsolata.variable} ${silkscreen.variable}`}>{children}</body>
    </html>
  )
}
