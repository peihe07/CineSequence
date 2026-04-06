'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDnaStore } from '@/stores/dnaStore'
import { useSequencingStore } from '@/stores/sequencingStore'
import { useToastStore } from '@/stores/toastStore'
import { useI18n } from '@/lib/i18n'
import { useAuthStore } from '@/stores/authStore'
import styles from './AuthGuard.module.css'

interface FlowGuardProps {
  require: 'sequencing' | 'dna'
  children: React.ReactNode
}

export default function FlowGuard({ require, children }: FlowGuardProps) {
  const router = useRouter()
  const { t } = useI18n()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const redirected = useRef(false)
  const [checked, setChecked] = useState(false)

  const fetchDnaResult = useDnaStore((s) => s.fetchResult)
  const hasHydratedDna = useDnaStore((s) => s.hasHydrated)
  const fetchProgress = useSequencingStore((s) => s.fetchProgress)
  const hasHydratedProgress = useSequencingStore((s) => s.hasHydratedProgress)
  const addToast = useToastStore((s) => s.addToast)

  useEffect(() => {
    if (!isAuthenticated) {
      setChecked(true)
      return
    }

    let cancelled = false

    async function check() {
      if (require === 'sequencing') {
        let p = useSequencingStore.getState().progress
        if (!p && !hasHydratedProgress) {
          try {
            p = await fetchProgress()
          } catch {
            if (!cancelled) setChecked(true)
            return
          }
        }
        if (!cancelled && p && !p.completed && !redirected.current) {
          redirected.current = true
          addToast('info', t('guard.needSequencing'))
          router.replace(
            !p.seed_movie_tmdb_id && p.round_number === 1
              ? '/sequencing/seed'
              : '/sequencing',
          )
          return
        }
      }

      if (require === 'dna') {
        let r = useDnaStore.getState().result
        if (!r && !hasHydratedDna) {
          try {
            r = await fetchDnaResult()
          } catch {
            if (!cancelled) setChecked(true)
            return
          }
        }
        if (!cancelled && !r && !redirected.current) {
          redirected.current = true
          addToast('info', t('guard.needDna'))
          router.replace('/dna')
          return
        }
      }

      if (!cancelled) setChecked(true)
    }

    check()
    return () => { cancelled = true }
  }, [
    require,
    fetchProgress,
    fetchDnaResult,
    hasHydratedDna,
    hasHydratedProgress,
    isAuthenticated,
    router,
    t,
    addToast,
  ])

  if (!checked) {
    return (
      <main className={styles.state}>
        <div className={styles.panel}>
          <i className={`ri-loader-4-line ri-spin ${styles.icon}`} aria-hidden="true" />
          <p>{t('common.loading')}</p>
        </div>
      </main>
    )
  }

  return <>{children}</>
}
