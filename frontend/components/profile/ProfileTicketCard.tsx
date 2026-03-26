'use client'

import { useRef } from 'react'
import { motion, useMotionValue, useTransform } from 'framer-motion'
import { useI18n } from '@/lib/i18n'
import { getTagLabel } from '@/lib/tagLabels'
import type { Profile } from './types'
import styles from './ProfileTicketCard.module.css'

interface ProfileTicketCardProps {
  profile: Profile
  topTags: string[]
}

export default function ProfileTicketCard({ profile, topTags }: ProfileTicketCardProps) {
  const { t, locale } = useI18n()
  const ref = useRef<HTMLDivElement>(null)
  const rotateX = useMotionValue(0)
  const rotateY = useMotionValue(0)

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    rotateX.set(y * -4)
    rotateY.set(x * 4)
  }

  const handleMouseLeave = () => {
    rotateX.set(0)
    rotateY.set(0)
  }

  const rx = useTransform(rotateX, (v) => `${v}deg`)
  const ry = useTransform(rotateY, (v) => `${v}deg`)

  const archetypeName = profile.archetype_name ?? profile.archetype_id ?? ''
  const favoriteMovies = profile.favorite_movies ?? []

  return (
    <motion.div
      ref={ref}
      className={styles.frame}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ rotateX: rx, rotateY: ry, transformStyle: 'preserve-3d' }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <div className={styles.editorialMeta}>
        <span className={styles.frameLabel}>{t('profile.ticketInsertLabel')}</span>
        <span className={styles.frameIssue}>{t('profile.ticketIssueLabel')}</span>
      </div>

      <div className={styles.ticket}>
        <div className={styles.header}>
          <span className={styles.brand}>CINE SEQUENCE</span>
          <span className={styles.catalogNo}>{t('profile.ticketCatalogLabel')}</span>
        </div>

        <div className={styles.perforation} />

        <div className={styles.identity}>
          <div className={styles.identityTop}>
            <div className={styles.identityCopy}>
              <h2 className={styles.name}>{profile.name}</h2>
              <p className={styles.archetype}>{archetypeName}</p>
              <p className={styles.email}>{profile.email}</p>
            </div>
            {profile.avatar_url && (
              <img
                src={profile.avatar_url}
                alt={profile.name}
                className={styles.avatar}
              />
            )}
          </div>
          {profile.bio && <p className={styles.bio}>{profile.bio}</p>}
        </div>

        <div className={styles.perforation} />

        {topTags.length > 0 && (
          <div className={styles.section}>
            <span className={styles.sectionLabel}>{t('profile.ticketTasteLabel')}</span>
            <div className={styles.tags}>
              {topTags.map((tag) => (
                <span key={tag} className={styles.tag}>
                  {getTagLabel(tag, locale)}
                </span>
              ))}
            </div>
          </div>
        )}

        {favoriteMovies.length > 0 && (
          <div className={styles.section}>
            <span className={styles.sectionLabel}>{t('profile.ticketFavoritesLabel')}</span>
            <div className={styles.favorites}>
              {favoriteMovies.slice(0, 3).map((movie) => (
                <span key={movie.tmdb_id} className={styles.favorite}>
                  · {movie.title_zh || movie.title_en}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className={styles.perforation} />
        <div className={styles.footer}>
          <span>cinesequence.app</span>
          <span>{profile.ticket_style?.toUpperCase() ?? t('profile.ticketStyleFallback')}</span>
        </div>
      </div>
    </motion.div>
  )
}
