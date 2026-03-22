'use client'

import styles from '@/app/(main)/profile/page.module.css'
import type { Profile } from './types'

interface ProfilePreferencesCardProps {
  profile: Profile
  title: string
  lookingForLabel: string
  ageRangeLabel: string
  pureTasteLabel: string
  notSetLabel: string
  yesLabel: string
  noLabel: string
  getPrefLabel: (value: string) => string
}

export default function ProfilePreferencesCard({
  profile,
  title,
  lookingForLabel,
  ageRangeLabel,
  pureTasteLabel,
  notSetLabel,
  yesLabel,
  noLabel,
  getPrefLabel,
}: ProfilePreferencesCardProps) {
  return (
    <div className={styles.card}>
      <h2 className={styles.sectionTitle}>
        <i className="ri-heart-pulse-line" /> {title}
      </h2>

      <div className={styles.field}>
        <span className={styles.label}>{lookingForLabel}</span>
        <span className={styles.value}>
          {profile.match_gender_pref
            ? getPrefLabel(profile.match_gender_pref)
            : notSetLabel}
        </span>
      </div>

      {(profile.match_age_min || profile.match_age_max) && (
        <div className={styles.field}>
          <span className={styles.label}>{ageRangeLabel}</span>
          <span className={styles.value}>
            {profile.match_age_min || '?'} — {profile.match_age_max || '?'}
          </span>
        </div>
      )}

      <div className={styles.field}>
        <span className={styles.label}>{pureTasteLabel}</span>
        <span className={styles.value}>
          {profile.pure_taste_match ? yesLabel : noLabel}
        </span>
      </div>
    </div>
  )
}
