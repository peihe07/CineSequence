import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '觀影 DNA | Cine Sequence',
  description: '查看電影品味原型、標籤與 AI 解讀。',
}

export default function DnaLayout({ children }: { children: React.ReactNode }) {
  return children
}
