'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
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

interface PendingPick {
  tmdbId: number
  title: string
}

export default function SequencingPage() {
  const router = useRouter()
  const { t } = useI18n()
  const roundStartTime = useRef<number>(Date.now())
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const [pendingPick, setPendingPick] = useState<PendingPick | null>(null)
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
        router.replace('/sequencing/seed')
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

  useEffect(() => {
    setPendingPick(null)
  }, [currentPair?.round_number])

  // Redirect to complete page when done
  useEffect(() => {
    if (progress?.completed || currentPair?.completed) {
      router.replace('/sequencing/complete')
    }
  }, [progress?.completed, currentPair?.completed, router])

  function getResponseTime(): number {
    return Date.now() - roundStartTime.current
  }

  function getMovieTitle(tmdbId: number): string {
    if (!currentPair) return ''

    if (currentPair.movie_a.tmdb_id === tmdbId) {
      return currentPair.movie_a.title_zh || currentPair.movie_a.title_en
    }

    if (currentPair.movie_b.tmdb_id === tmdbId) {
      return currentPair.movie_b.title_zh || currentPair.movie_b.title_en
    }

    return ''
  }

  function handlePick(tmdbId: number) {
    setPendingPick({ tmdbId, title: getMovieTitle(tmdbId) })
  }

  function handlePickModeConfirm(pickMode: 'watched' | 'attracted') {
    if (!pendingPick) return

    submitPick(pendingPick.tmdbId, pickMode, getResponseTime())
    setPendingPick(null)
  }

  function handlePickModeSkip() {
    skip(getResponseTime())
    setPendingPick(null)
  }

  function handlePickModeCancel() {
    setPendingPick(null)
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
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>[ SEQUENCE_SESSION ]</p>
            <p className={styles.heroMeta}>ROUND {String(roundNumber).padStart(2, '0')} // PHASE {phase}</p>
          </div>
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

      <AnimatePresence>
        {pendingPick && (
          <motion.div
            className={styles.pickModeOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={handlePickModeCancel}
          >
            <motion.div
              className={styles.pickModeDialog}
              role="dialog"
              aria-modal="true"
              aria-label={t('seq.pickMode.prompt', { title: pendingPick.title })}
              initial={{ opacity: 0, y: 18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className={styles.pickModeEyebrow}>{t('seq.pickMode.eyebrow')}</p>
              <h2 className={styles.pickModeTitle}>{t('seq.pickMode.prompt', { title: pendingPick.title })}</h2>
              <p className={styles.pickModeBody}>{t('seq.pickMode.body')}</p>

              <div className={styles.pickModeActions}>
                <button
                  type="button"
                  className={`${styles.pickModeBtn} ${styles.pickModePrimary}`}
                  onClick={() => handlePickModeConfirm('watched')}
                >
                  {t('seq.pickMode.watched')}
                </button>
                <button
                  type="button"
                  className={styles.pickModeBtn}
                  onClick={() => handlePickModeConfirm('attracted')}
                >
                  {t('seq.pickMode.attracted')}
                </button>
                <button
                  type="button"
                  className={`${styles.pickModeBtn} ${styles.pickModeGhost}`}
                  onClick={handlePickModeSkip}
                >
                  {t('seq.pickMode.skip')}
                </button>
              </div>

              <button
                type="button"
                className={styles.pickModeCancel}
                onClick={handlePickModeCancel}
              >
                {t('common.cancel')}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}
