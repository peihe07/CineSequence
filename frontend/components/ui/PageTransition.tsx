'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { logPerf } from '@/lib/perf'

interface PageTransitionProps {
  children: React.ReactNode
}

/**
 * Lightweight page transition — instant mount with a quick fade-in.
 * No exit animation to avoid black-screen delays between routes.
 */
export default function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname()
  const lastNavigationStartedAt = useRef<number | null>(null)

  useEffect(() => {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    if (lastNavigationStartedAt.current !== null) {
      logPerf(`route ${pathname}`, now - lastNavigationStartedAt.current)
    }
    lastNavigationStartedAt.current = now
  }, [pathname])

  return <div key={pathname}>{children}</div>
}
