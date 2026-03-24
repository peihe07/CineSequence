'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useI18n } from '@/lib/i18n'
import type { Profile } from './types'
import styles from './ProfileDnaSnapshot.module.css'

interface ProfileDnaSnapshotProps {
  profile: Profile
}

type Metric = {
  label: string
  value: number
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function buildMetrics(profile: Profile, t: (key: string) => string): Metric[] {
  const readiness =
    profile.sequencing_status === 'completed'
      ? 96
      : profile.sequencing_status === 'in_progress'
        ? 58
        : 18

  const ageSpan =
    profile.match_age_min !== null && profile.match_age_max !== null
      ? clamp(profile.match_age_max - profile.match_age_min, 0, 30)
      : 24

  const genderScope =
    profile.match_gender_pref === 'any' || profile.match_gender_pref === null
      ? 92
      : profile.match_gender_pref === 'other'
        ? 74
        : 56

  const matchScope = clamp(
    Math.round((ageSpan / 30) * 55 + genderScope * 0.45 + (profile.pure_taste_match ? 10 : 0)),
    18,
    98,
  )

  const curationStrictness = clamp(
    Math.round(100 - matchScope * 0.62 + (profile.pure_taste_match ? -6 : 12)),
    12,
    94,
  )

  return [
    { label: t('profile.snapshotReadiness'), value: readiness },
    { label: t('profile.snapshotMatchScope'), value: matchScope },
    { label: t('profile.snapshotCurationStrictness'), value: curationStrictness },
  ]
}

export default function ProfileDnaSnapshot({ profile }: ProfileDnaSnapshotProps) {
  const { t } = useI18n()
  const [scanComplete, setScanComplete] = useState(false)
  const metrics = useMemo(() => buildMetrics(profile, t), [profile, t])

  useEffect(() => {
    setScanComplete(false)
    const timer = window.setTimeout(() => setScanComplete(true), 1100)
    return () => window.clearTimeout(timer)
  }, [profile.archetype_id, profile.sequencing_status, profile.match_gender_pref, profile.match_age_min, profile.match_age_max, profile.pure_taste_match])

  const archetypeName = profile.archetype_name || profile.archetype_id || t('profile.snapshotPending')
  const showVerifiedStamp = Boolean(
    profile.archetype_id
    || profile.archetype_name
    || profile.personality_reading,
  )

  return (
    <section className={styles.panel} aria-label={t('profile.snapshotAriaLabel')}>
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>[ DNA_SNAPSHOT ]</p>
          <h2 className={styles.title}>{t('profile.snapshotTitle')}</h2>
        </div>
        {showVerifiedStamp ? <span className={`${styles.stamp} ${styles.stampVerified}`}>{t('profile.snapshotVerified')}</span> : null}
      </div>

      <div className={styles.scanBlock}>
        <div className={styles.scanMeta}>
          <span className={styles.scanLabel}>{t('profile.snapshotArchetype')}</span>
          <span className={styles.scanState}>{scanComplete ? t('profile.snapshotScanComplete') : t('profile.snapshotScanning')}</span>
        </div>
        <div className={styles.scanValueWrap}>
          <motion.div
            className={styles.scanBeam}
            initial={{ x: '-105%' }}
            animate={{ x: scanComplete ? '105%' : ['-105%', '105%'] }}
            transition={scanComplete ? { duration: 0.45 } : { duration: 1.1, repeat: Infinity, ease: 'linear' }}
          />
          <div className={styles.scanValue}>{scanComplete ? archetypeName : t('profile.snapshotResolving')}</div>
        </div>
      </div>

      <div className={styles.metrics}>
        {metrics.map((metric, index) => (
          <div key={metric.label} className={styles.metricRow}>
            <div className={styles.metricHeader}>
              <span className={styles.metricLabel}>{metric.label}</span>
              <span className={styles.metricValue}>{metric.value}%</span>
            </div>
            <div className={styles.metricTrack}>
              <motion.div
                className={styles.metricFill}
                initial={{ width: 0 }}
                animate={{ width: `${metric.value}%` }}
                transition={{ duration: 0.55, delay: 0.2 + index * 0.1 }}
              />
            </div>
          </div>
        ))}
      </div>

      {profile.personality_reading && (
        <p className={styles.note}>
          {profile.personality_reading.slice(0, 120)}
          {profile.personality_reading.length > 120 ? '...' : ''}
        </p>
      )}
    </section>
  )
}
