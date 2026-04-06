'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { logPerf } from '@/lib/perf'

interface PageTransitionProps {
  children: React.ReactNode
}

/**
 * Film-slide page transition — a brief shutter flash + vertical slide
 * on route change within the (main) layout group.
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

  return (
    <AnimatePresence initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
