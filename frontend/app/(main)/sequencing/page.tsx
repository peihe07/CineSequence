'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence } from 'framer-motion'
import { useSequencingStore } from '@/stores/sequencingStore'
import SwipePair from '@/components/sequencing/SwipePair'
import LiquidTube from '@/components/sequencing/LiquidTube'
import PhaseIndicator from '@/components/sequencing/PhaseIndicator'
import LiveTagCloud from '@/components/sequencing/LiveTagCloud'
import SkipActions from '@/components/sequencing/SkipActions'
import styles from './page.module.css'

export default function SequencingPage() {
  const router = useRouter()
  const roundStartTime = useRef<number>(Date.now())
  const {
    currentPair,
    progress,
    liveTags,
    isLoading,
    ambientColor,
    fetchPair,
    fetchProgress,
    submitPick,
    skip,
  } = useSequencingStore()

  useEffect(() => {
    fetchProgress().then(() => {
      const { progress } = useSequencingStore.getState()
      // Redirect to seed movie page if no seed movie is set and not started yet
      if (progress && !progress.seed_movie_tmdb_id && progress.round_number === 1) {
        router.push('/sequencing/seed')
        return
      }
      fetchPair()
    })
  }, [fetchProgress, fetchPair, router])

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

  const roundNumber = progress?.round_number ?? currentPair?.round_number ?? 1
  const phase = progress?.phase ?? currentPair?.phase ?? 1

  return (
    <main
      className={styles.container}
      style={{
        '--ambient-color': ambientColor || 'transparent',
      } as React.CSSProperties}
    >
      {/* Ambient background glow */}
      <div className={styles.ambientGlow} />

      {/* DNA liquid tube — fills as rounds progress */}
      <LiquidTube
        currentRound={roundNumber}
        totalRounds={progress?.total_rounds ?? 20}
        liquidColor={ambientColor || undefined}
      />

      <div className={styles.header}>
        <PhaseIndicator phase={phase} round={roundNumber} totalRounds={progress?.total_rounds ?? 20} />
      </div>

      <div className={styles.arena}>
        <AnimatePresence mode="wait">
          {currentPair && !currentPair.completed && (
            <SwipePair
              key={roundNumber}
              pair={currentPair}
              onPick={handlePick}
              isLoading={isLoading}
            />
          )}
        </AnimatePresence>
      </div>

      <div className={styles.footer}>
        <LiveTagCloud tags={liveTags} />
        <SkipActions onSkip={handleSkip} disabled={isLoading} />
      </div>
    </main>
  )
}
