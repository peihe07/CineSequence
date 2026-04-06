import type { Metadata } from 'next'
import PricingClient from './PricingClient'

export const metadata: Metadata = {
  title: 'Pricing — CineSequence',
  description: 'Paid sequencing extensions, retests, and invite unlocks.',
}

export default function PricingPage() {
  return <PricingClient />
}
