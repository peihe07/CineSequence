'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDnaStore } from '@/stores/dnaStore'
import { useSequencingStore } from '@/stores/sequencingStore'
import { useToastStore } from '@/stores/toastStore'
import { useI18n } from '@/lib/i18n'
import { useAuthStore } from '@/stores/authStore'

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
  const fetchProgress = useSequencingStore((s) => s.fetchProgress)
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
        if (!p) {
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
        if (!r) {
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
  }, [require, fetchProgress, fetchDnaResult, isAuthenticated, router, t, addToast])

  if (!checked) return null

  return <>{children}</>
}
