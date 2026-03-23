'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import { useI18n } from '@/lib/i18n'
import { useSequencingStore } from '@/stores/sequencingStore'
import SwipePair from '@/components/sequencing/SwipePair'
import LiquidTube from '@/components/sequencing/LiquidTube'
import PhaseIndicator from '@/components/sequencing/PhaseIndicator'
import LiveTagCloud from '@/components/sequencing/LiveTagCloud'
import SkipActions from '@/components/sequencing/SkipActions'
import OnboardingOverlay from '@/components/sequencing/OnboardingOverlay'
import styles from './page.module.css'

export default function SequencingPage() {
  const router = useRouter()
  const { t } = useI18n()
  const roundStartTime = useRef<number>(Date.now())
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const {
    currentPair,
    progress,
    liveTags,
    isLoading,
    error,
    ambientColor,
    fetchPair,
    rerollPair,
    fetchProgress,
    submitPick,
    skip,
  } = useSequencingStore()

  const bootstrapSequencing = useCallback(async () => {
    setIsBootstrapping(true)
    try {
      const progress = await fetchProgress()
      if (progress && !progress.seed_movie_tmdb_id && progress.round_number === 1) {
        router.push('/sequencing/seed')
        return
      }
      await fetchPair()
    } catch {
      // Store state already captures the initialization error.
    } finally {
      setIsBootstrapping(false)
    }
  }, [fetchPair, fetchProgress, router])

  useEffect(() => {
    void bootstrapSequencing()
  }, [bootstrapSequencing])

  useEffect(() => {
    roundStartTime.current = Date.now()
  }, [currentPair])

  // Redirect to complete page when done
  useEffect(() => {
    if (progress?.completed || currentPair?.completed) {
      router.push('/sequencing/complete')
    }
  }, [progress?.completed, currentPair?.completed, router])

  function getResponseTime(): number {
    return Date.now() - roundStartTime.current
  }

  function handlePick(tmdbId: number, pickMode: 'watched' | 'attracted') {
    submitPick(tmdbId, pickMode, getResponseTime())
  }

  function handleSkip() {
    skip(getResponseTime())
  }

  function handleReroll() {
    void rerollPair()
  }

  const roundNumber = progress?.round_number ?? currentPair?.round_number ?? 1
  const phase = progress?.phase ?? currentPair?.phase ?? 1

  if (error && !currentPair && !isBootstrapping) {
    return (
      <main className={styles.container}>
        <div className={styles.errorState}>
          <p>{error}</p>
          <Button variant="secondary" onClick={() => void bootstrapSequencing()}>
            {t('error.retry')}
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main
      className={styles.container}
      style={{
        '--ambient-color': ambientColor || 'transparent',
      } as React.CSSProperties}
    >
      <OnboardingOverlay />

      <div className={styles.ambientGlow} />

      <div className={styles.shell}>
        <section className={`${styles.section} ${styles.heroSection}`}>
          <span className={styles.sideLabel}>FILE 05</span>
          <span className={styles.scriptWord} aria-hidden="true">Sequence</span>
          <div className={styles.header}>
            <PhaseIndicator phase={phase} round={roundNumber} totalRounds={progress?.total_rounds ?? 20} />
          </div>
        </section>

        <section className={`${styles.section} ${styles.stageSection}`}>
          <LiquidTube
            currentRound={roundNumber}
            totalRounds={progress?.total_rounds ?? 20}
            liquidColor={ambientColor || undefined}
          />

          <div className={styles.arena}>
            {currentPair && !currentPair.completed && (
              <SwipePair
                key={roundNumber}
                pair={currentPair}
                onPick={handlePick}
                isLoading={isLoading}
              />
            )}
          </div>
        </section>

        <section className={`${styles.section} ${styles.footerSection}`}>
          <LiveTagCloud tags={liveTags} />
          <SkipActions onSkip={handleSkip} onReroll={handleReroll} disabled={isLoading} />
        </section>
      </div>
    </main>
  )
}
