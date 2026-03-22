import type { Metadata } from 'next'
import localFont from 'next/font/local'
import 'remixicon/fonts/remixicon.css'
import './globals.css'
import { I18nProvider } from '@/lib/i18n'
import FloatingLocaleToggle from '@/components/ui/FloatingLocaleToggle'

const huninn = localFont({
  src: '../public/fonts/jf-openhuninn-2.1.ttf',
  variable: '--font-huninn',
  display: 'swap',
})
const properScript = localFont({
  src: '../public/fonts/ProperScript-Regular.ttf',
  variable: '--font-display-script',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Cine Sequence',
  description: 'Decode your cinematic DNA through movie choices',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <body className={`${huninn.variable} ${properScript.variable}`}>
        <I18nProvider>
          <FloatingLocaleToggle />
          {children}
        </I18nProvider>
      </body>
    </html>
  )
}
