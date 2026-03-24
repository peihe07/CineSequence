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
    type: 'website',
  },
}

export default function Home() {
  return <LandingClient />
}
