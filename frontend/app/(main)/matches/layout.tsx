import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Matches | Cine Sequence',
  description: 'Browse taste-based matches and invite the people who resonate.',
}

export default function MatchesLayout({ children }: { children: React.ReactNode }) {
  return children
}
