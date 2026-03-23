import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Your Cine DNA | Cine Sequence',
  description: 'Review your movie taste archetype, tags, and AI reading.',
}

export default function DnaLayout({ children }: { children: React.ReactNode }) {
  return children
}
