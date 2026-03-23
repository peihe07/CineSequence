import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '配對 | Cine Sequence',
  description: '瀏覽以品味為基礎的配對，邀請與你產生共鳴的人。',
}

export default function MatchesLayout({ children }: { children: React.ReactNode }) {
  return children
}
