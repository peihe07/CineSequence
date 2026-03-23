'use client'

import styles from '@/app/(main)/profile/page.module.css'
import type { Profile } from './types'

interface ProfileSequencingCardProps {
  profile: Profile
  title: string
  archetypeLabel: string
  getStatusLabel: (value: string) => string
}

export default function ProfileSequencingCard({
  profile,
  title,
  archetypeLabel,
  getStatusLabel,
}: ProfileSequencingCardProps) {
  return (
    <div className={styles.card}>
      <h2 className={styles.sectionTitle}>
        <i className="ri-dna-line" /> {title}
      </h2>
      <span
        className={`${styles.statusBadge} ${
          profile.sequencing_status === 'completed' ? styles.statusCompleted : ''
        }`}
      >
        {getStatusLabel(profile.sequencing_status)}
      </span>

      {profile.archetype_id && (
        <div className={styles.field}>
          <span className={styles.label}>{archetypeLabel}</span>
          <span className={styles.value}>{profile.archetype_name || profile.archetype_id}</span>
        </div>
      )}
    </div>
  )
}
