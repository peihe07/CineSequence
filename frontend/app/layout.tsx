import type { Metadata } from 'next'
import localFont from 'next/font/local'
import 'remixicon/fonts/remixicon.css'
import './globals.css'
import { I18nProvider } from '@/lib/i18n'
import FloatingLocaleToggle from '@/components/ui/FloatingLocaleToggle'
import LocaleDocumentSync from '@/components/ui/LocaleDocumentSync'
import ToastContainer from '@/components/ui/Toast'

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
  title: {
    default: 'Cine Sequence',
    template: '%s',
  },
  description: 'Decode your cinematic DNA through movie choices',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${huninn.variable} ${properScript.variable}`}>
        <I18nProvider>
          <LocaleDocumentSync />
          <FloatingLocaleToggle />
          <ToastContainer />
          {children}
        </I18nProvider>
      </body>
    </html>
  )
}
