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
import SequencingInfoModal from '@/components/sequencing/SequencingInfoModal'
import styles from './page.module.css'

export default function SequencingPage() {
  const router = useRouter()
  const { t } = useI18n()
  const roundStartTime = useRef<number>(Date.now())
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const [showInfo, setShowInfo] = useState(false)
  const [resumeCheckpoint, setResumeCheckpoint] = useState<null | {
    roundNumber: number
    phase: number
    totalRounds: number
  }>(null)
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
    dislikeBoth,
    seenOneSide,
  } = useSequencingStore()

  const bootstrapSequencing = useCallback(async () => {
    setIsBootstrapping(true)
    try {
      const progress = await fetchProgress()
      if (progress && !progress.seed_movie_tmdb_id && progress.round_number === 1) {
        router.replace('/sequencing/seed')
        return
      }
      if (progress && !progress.completed && progress.round_number > 1) {
        setResumeCheckpoint({
          roundNumber: progress.round_number,
          phase: progress.phase,
          totalRounds: progress.total_rounds,
        })
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
      router.replace('/sequencing/complete')
    }
  }, [progress?.completed, currentPair?.completed, router])

  function getResponseTime(): number {
    return Date.now() - roundStartTime.current
  }

  function handlePick(tmdbId: number) {
    submitPick(tmdbId, 'watched', getResponseTime())
  }

  function handleSkip() {
    skip(getResponseTime())
  }

  function handleReroll() {
    void rerollPair()
  }

  function handleDislikeBoth() {
    void dislikeBoth(getResponseTime())
  }

  function handleSeenOneSide() {
    void seenOneSide(getResponseTime())
  }

  async function handleResume() {
    setIsBootstrapping(true)
    try {
      await fetchPair()
      setResumeCheckpoint(null)
    } finally {
      setIsBootstrapping(false)
    }
  }

  const roundNumber = progress?.round_number ?? currentPair?.round_number ?? 1
  const phase = progress?.phase ?? currentPair?.phase ?? 1

  if (error && !currentPair && !isBootstrapping) {
    return (
      <div className={styles.container}>
        <div className={styles.errorState}>
          <p>{error}</p>
          <Button variant="secondary" onClick={() => void bootstrapSequencing()}>
            {t('error.retry')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={styles.container}
      style={{
        '--ambient-color': ambientColor || 'transparent',
      } as React.CSSProperties}
    >
      <OnboardingOverlay />
      <SequencingInfoModal open={showInfo} onClose={() => setShowInfo(false)} />

      <div className={styles.ambientGlow} />

      <div className={styles.shell}>
        <section className={`${styles.section} ${styles.heroSection}`}>
          <span className={styles.sideLabel}>{t('landing.fileLabel', { id: '05' })}</span>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>{t('archive.sequencingCue')}</p>
            <p className={styles.heroMeta}>
              {t('seq.round', { round: String(roundNumber).padStart(2, '0'), total: progress?.total_rounds ?? 30 })}
              {' // '}
              {t('seq.phase', { phase })}
              <button
                className={styles.infoBtn}
                onClick={() => setShowInfo(true)}
                aria-label={t('seqInfo.title')}
              >
                <i className="ri-information-line" />
              </button>
            </p>
          </div>
          <div className={styles.header}>
            <PhaseIndicator phase={phase} round={roundNumber} totalRounds={progress?.total_rounds ?? 30} />
          </div>
        </section>

        <section className={`${styles.section} ${styles.stageSection}`}>
          <LiquidTube
            currentRound={roundNumber}
            totalRounds={progress?.total_rounds ?? 30}
            liquidColor={ambientColor || undefined}
          />

          <div className={styles.arena}>
            {resumeCheckpoint && !currentPair && !isBootstrapping ? (
              <div className={styles.resumeCard}>
                <p className={styles.resumeEyebrow}>{t('seq.resumeEyebrow')}</p>
                <h2 className={styles.resumeTitle}>
                  {t('seq.resumeTitle', { round: resumeCheckpoint.roundNumber })}
                </h2>
                <p className={styles.resumeBody}>
                  {t('seq.resumeBody', {
                    phase: resumeCheckpoint.phase,
                    remaining: resumeCheckpoint.totalRounds - resumeCheckpoint.roundNumber + 1,
                  })}
                </p>
                <Button variant="primary" onClick={() => void handleResume()}>
                  {t('seq.resumeCta')}
                </Button>
              </div>
            ) : currentPair && !currentPair.completed && (
              <SwipePair
                key={roundNumber}
                pair={currentPair}
                onPick={handlePick}
                isLoading={isLoading}
              />
            )}
          </div>

          <div className={styles.actionsDock}>
            <p className={styles.actionsHint}>{t('seq.skipPair')} / {t('seq.reroll')}</p>
            <SkipActions
              onSkip={handleSkip}
              onReroll={handleReroll}
              onDislikeBoth={handleDislikeBoth}
              onSeenOneSide={handleSeenOneSide}
              disabled={isLoading}
            />
          </div>
        </section>

        <section className={`${styles.section} ${styles.footerSection}`}>
          <LiveTagCloud tags={liveTags} />
        </section>
      </div>
    </div>
  )
}
