'use client'

import styles from '@/app/(main)/profile/page.module.css'
import type { Profile } from './types'

interface ProfileCompletenessBarProps {
  profile: Profile
  label: string
}

function computeCompleteness(profile: Profile): { percent: number; hint: string } {
  let score = 0
  let hint = ''

  if (profile.name) score += 15
  else if (!hint) hint = 'name'

  if (profile.bio?.trim()) score += 10
  else if (!hint) hint = 'bio'

  if (profile.avatar_url) score += 15
  else if (!hint) hint = 'avatar'

  if (profile.birth_year) score += 10
  else if (!hint) hint = 'birth_year'

  if (profile.gender && profile.gender !== 'prefer_not_to_say') score += 10
  else if (!hint) hint = 'gender'

  if (profile.match_gender_pref) score += 10
  else if (!hint) hint = 'match_pref'

  if (profile.match_age_min != null && profile.match_age_max != null) score += 10
  else if (!hint) hint = 'age_range'

  if (profile.sequencing_status === 'completed') score += 20
  else if (!hint) hint = 'sequencing'

  return { percent: score, hint }
}

export default function ProfileCompletenessBar({ profile, label }: ProfileCompletenessBarProps) {
  const { percent } = computeCompleteness(profile)

  if (percent >= 100) return null

  return (
    <div className={styles.completenessBar}>
      <div className={styles.completenessHeader}>
        <span className={styles.label}>{label}</span>
        <span className={styles.completenessPercent}>{percent}%</span>
      </div>
      <div className={styles.completenessTrack}>
        <div
          className={styles.completenessFill}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
