import type { Metadata } from 'next'
import LandingClient from './LandingClient'

export const metadata: Metadata = {
  title: 'CineSequence — Decode Your Cinema DNA',
  description:
    'Discover your unique cinema personality through AI-powered film taste analysis. Find your archetype, match with like-minded cinephiles.',
  openGraph: {
    title: 'CineSequence — Decode Your Cinema DNA',
    description:
      'Discover your unique cinema personality through AI-powered film taste analysis.',
    url: 'https://cinesequence.com',
    siteName: 'CineSequence',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CineSequence — Decode Your Cinema DNA',
    description:
      'Discover your unique cinema personality through AI-powered film taste analysis.',
  },
}

export default function Home() {
  return <LandingClient />
}
