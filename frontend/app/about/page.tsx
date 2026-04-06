import type { Metadata } from 'next'
import AboutClient from './AboutClient'

export const metadata: Metadata = {
  title: 'About — CineSequence',
  description: 'Why CineSequence exists.',
}

export default function AboutPage() {
  return <AboutClient />
}
