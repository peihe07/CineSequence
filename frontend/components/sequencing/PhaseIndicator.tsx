'use client'

import { motion } from 'framer-motion'
import { useI18n } from '@/lib/i18n'
import styles from './PhaseIndicator.module.css'

const PHASE_LABELS = [
  { phase: 1, labelKey: 'seq.phase1' },
  { phase: 2, labelKey: 'seq.phase2' },
  { phase: 3, labelKey: 'seq.phase3' },
]

interface PhaseIndicatorProps {
  phase: number
  round: number
  totalRounds: number
}

export default function PhaseIndicator({ phase, round, totalRounds }: PhaseIndicatorProps) {
  const { t } = useI18n()
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
            <span className={styles.phaseLabel}>{t(p.labelKey)}</span>
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
        {t('seq.round', {
          round: Math.min(round, totalRounds),
          total: totalRounds,
        })}
      </span>
    </div>
  )
}
