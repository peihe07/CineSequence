import type { Metadata } from 'next'
import LandingClient from './LandingClient'

export const metadata: Metadata = {
  title: 'CineSequence — Decode Your Cinema DNA',
  description:
    'Discover your unique cinema personality through AI-powered film taste analysis. Find your archetype, match with like-minded cinephiles.',
  alternates: {
    canonical: 'https://cinesequence.xyz',
  },
  openGraph: {
    title: 'CineSequence — Decode Your Cinema DNA',
    description:
      'Discover your unique cinema personality through AI-powered film taste analysis.',
    url: 'https://cinesequence.xyz',
    siteName: 'CineSequence',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'CineSequence — Decode Your Cinema DNA',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CineSequence — Decode Your Cinema DNA',
    description:
      'Discover your unique cinema personality through AI-powered film taste analysis.',
    images: ['/og-image.png'],
  },
}

export default function Home() {
  return <LandingClient />
}
