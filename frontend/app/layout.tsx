import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { Inter, Noto_Sans_TC } from 'next/font/google'
import 'remixicon/fonts/remixicon.css'
import './globals.css'
import { I18nProvider } from '@/lib/i18n'
import LocaleDocumentSync from '@/components/ui/LocaleDocumentSync'
import ToastContainer from '@/components/ui/Toast'
import CookieConsent from '@/components/ui/CookieConsent'

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
  metadataBase: new URL('https://cinesequence.xyz'),
  title: {
    default: 'Cine Sequence',
    template: '%s',
  },
  description: 'Decode your cinematic DNA through movie choices',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
  openGraph: {
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'CineSequence — Decode Your Cinema DNA' }],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/og-image.png'],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${notoSansTC.variable} ${properScript.variable}`}>
        <I18nProvider>
          <LocaleDocumentSync />
          <ToastContainer />
          <CookieConsent />
          {children}
        </I18nProvider>
      </body>
    </html>
  )
}
