import type { Metadata } from 'next'
import PricingClient from '@/app/pricing/PricingClient'

export const metadata: Metadata = {
  title: 'Pricing — CineSequence',
  description: 'Paid sequencing extensions, retests, restore-invite access, and support options.',
}

export default function PricingPage() {
  return <PricingClient />
}
