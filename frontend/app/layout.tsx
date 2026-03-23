import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { Inter, Noto_Sans_TC } from 'next/font/google'
import 'remixicon/fonts/remixicon.css'
import './globals.css'
import { I18nProvider } from '@/lib/i18n'
import LocaleDocumentSync from '@/components/ui/LocaleDocumentSync'
import ToastContainer from '@/components/ui/Toast'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})
const notoSansTC = Noto_Sans_TC({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-noto',
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
      <body className={`${inter.variable} ${notoSansTC.variable} ${properScript.variable}`}>
        <I18nProvider>
          <LocaleDocumentSync />
          <ToastContainer />
          {children}
        </I18nProvider>
      </body>
    </html>
  )
}
