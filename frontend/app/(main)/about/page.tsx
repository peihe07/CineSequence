import type { Metadata } from 'next'
import AboutClient from '@/app/about/AboutClient'

export const metadata: Metadata = {
  title: 'About — CineSequence',
  description: 'Why CineSequence exists.',
}

export default function AboutPage() {
  return <AboutClient />
}
