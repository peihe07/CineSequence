'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDnaStore } from '@/stores/dnaStore'
import { useSequencingStore } from '@/stores/sequencingStore'
import { useToastStore } from '@/stores/toastStore'
import { useI18n } from '@/lib/i18n'

interface FlowGuardProps {
  require: 'sequencing' | 'dna'
  children: React.ReactNode
}

export default function FlowGuard({ require, children }: FlowGuardProps) {
  const router = useRouter()
  const { t } = useI18n()
  const redirected = useRef(false)
  const [checked, setChecked] = useState(false)

  const dnaResult = useDnaStore((s) => s.result)
  const fetchDnaResult = useDnaStore((s) => s.fetchResult)
  const progress = useSequencingStore((s) => s.progress)
  const fetchProgress = useSequencingStore((s) => s.fetchProgress)
  const addToast = useToastStore((s) => s.addToast)

  useEffect(() => {
    let cancelled = false

    async function check() {
      if (require === 'sequencing') {
        // Check if sequencing is completed
        if (!progress) await fetchProgress()
        const p = useSequencingStore.getState().progress
        if (!cancelled && p && !p.completed && !redirected.current) {
          redirected.current = true
          addToast('info', t('guard.needSequencing'))
          router.replace('/sequencing/seed')
          return
        }
      }

      if (require === 'dna') {
        // Check if DNA is built
        if (!dnaResult) await fetchDnaResult()
        const r = useDnaStore.getState().result
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
  }, [require, progress, dnaResult, fetchProgress, fetchDnaResult, router, t, addToast])

  if (!checked) return null

  return <>{children}</>
}
