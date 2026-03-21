'use client'

import { motion } from 'framer-motion'
import styles from './PhaseIndicator.module.css'

const PHASE_LABELS = [
  { phase: 1, label: 'Quadrant Scan', range: '1-5' },
  { phase: 2, label: 'Deep Dive', range: '6-12' },
  { phase: 3, label: 'Soul Tags', range: '13-20' },
]

interface PhaseIndicatorProps {
  phase: number
  round: number
  totalRounds: number
}

export default function PhaseIndicator({ phase, round, totalRounds }: PhaseIndicatorProps) {
  const progressPercent = Math.min(((round - 1) / totalRounds) * 100, 100)

  return (
    <div className={styles.container}>
      <div className={styles.phases}>
        {PHASE_LABELS.map((p) => (
          <div
            key={p.phase}
            className={`${styles.phase} ${phase === p.phase ? styles.phaseActive : ''} ${phase > p.phase ? styles.phaseDone : ''}`}
          >
            <span className={styles.phaseNum}>{p.phase}</span>
            <span className={styles.phaseLabel}>{p.label}</span>
          </div>
        ))}
      </div>

      <div className={styles.progressTrack}>
        <motion.div
          className={styles.progressFill}
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ type: 'spring', stiffness: 100, damping: 20 }}
        />
      </div>

      <span className={styles.roundLabel}>
        Round {Math.min(round, totalRounds)} / {totalRounds}
      </span>
    </div>
  )
}
