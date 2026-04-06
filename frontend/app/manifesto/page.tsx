import type { Metadata } from 'next'
import ManifestoClient from './ManifestoClient'

export const metadata: Metadata = {
  title: 'Manifesto — CineSequence',
  description: 'Why CineSequence exists.',
}

export default function ManifestoPage() {
  return <ManifestoClient />
}
