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
      <div className={styles.sectionTitleRow}>
        <h2 className={styles.sectionTitle}>
          <i className="ri-dna-line" /> {title}
        </h2>
      </div>

      <p className={styles.cardIntro}>
        Sequencing stays as the profile backbone: current status first, then the archetype that the watch history resolves into.
      </p>

      <div className={styles.preferenceSummary}>
        <div className={styles.factCard}>
          <span className={styles.label}>{title}</span>
          <span
            className={`${styles.statusBadge} ${
              profile.sequencing_status === 'completed' ? styles.statusCompleted : ''
            }`}
          >
            {getStatusLabel(profile.sequencing_status)}
          </span>
        </div>

        {profile.archetype_id && (
          <div className={styles.factCard}>
            <span className={styles.label}>{archetypeLabel}</span>
            <span className={styles.factMetric}>{profile.archetype_name || profile.archetype_id}</span>
          </div>
        )}
      </div>
    </div>
  )
}
