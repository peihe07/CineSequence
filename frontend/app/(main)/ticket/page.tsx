'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { PreviewBanner, usePreviewAccess } from '@/components/preview/PreviewGate'
import { PREVIEW_TICKET_MATCH } from '@/lib/previewContent'
import { useAuthStore } from '@/stores/authStore'
import { useMatchStore, MatchItem } from '@/stores/matchStore'
import { useI18n } from '@/lib/i18n'
import TicketCard from '@/components/match/TicketCard'
import Button from '@/components/ui/Button'
import { getTagLabel } from '@/lib/tagLabels'
import { formatPercentileSummary } from '@/lib/matchPercentile'
import styles from './page.module.css'

export default function TicketPage() {
  const searchParams = useSearchParams()
  const inviteId = searchParams.get('inviteId')
  const router = useRouter()
  const { t, locale } = useI18n()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const { isPreview, previewModal } = usePreviewAccess('/ticket')
  const { fetchMatch } = useMatchStore()
  const [match, setMatch] = useState<MatchItem | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated) {
      setMatch(PREVIEW_TICKET_MATCH)
      setError(null)
      setIsLoading(false)
      return
    }

    if (!inviteId) {
      setError('notFound')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    void fetchMatch(inviteId).then((result) => {
      if (!result) {
        setError('notFound')
      } else if (result.status !== 'accepted') {
        setError('notAccepted')
      } else {
        setMatch(result)
      }
      setIsLoading(false)
    })
  }, [fetchMatch, inviteId, isAuthenticated])

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            <i className="ri-ticket-2-line" style={{ fontSize: '2rem' }} />
          </motion.div>
        </div>
      </div>
    )
  }

  if (error || !match) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <i className="ri-ticket-2-line" style={{ fontSize: '2.5rem', opacity: 0.3 }} />
          <p className={styles.errorText}>
            {error === 'notAccepted' ? t('ticket.notAccepted') : t('ticket.notFound')}
          </p>
          <Button variant="secondary" onClick={() => router.push('/matches')}>
            {t('ticket.backToMatches')}
          </Button>
        </div>
      </div>
    )
  }

  const percentileSummary = formatPercentileSummary(t, match.candidate_percentile)

  return (
    <div className={styles.container}>
      <motion.div
        className={styles.content}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <section className={`${styles.section} ${styles.heroSection}`}>
          <span className={styles.sideLabel}>{t('ticket.fileLabel')}</span>
          <p className={styles.eyebrow}>{t('ticket.eyebrow')}</p>
          <h1 className={styles.title}>{t('ticket.title')}</h1>
          <p className={styles.heroMeta}>{t('ticket.heroMeta')}</p>
          <PreviewBanner nextPath="/ticket" compact />
        </section>

        <section className={`${styles.section} ${styles.ticketSection}`}>
          <TicketCard
            ticketImageUrl={match.ticket_image_url}
            partnerName={match.partner_name}
            similarityScore={match.similarity_score}
          />
        </section>

        <section className={`${styles.section} ${styles.detailsSection}`}>
          <div className={styles.details}>
            {match.partner_email && (
              <div className={styles.sectionBlock}>
                <h3 className={styles.sectionTitle}>{t('ticket.contact')}</h3>
                <a href={`mailto:${match.partner_email}`} className={styles.contactLink}>
                  {match.partner_email}
                </a>
              </div>
            )}

            <div className={styles.stat}>
              <span className={styles.statLabel}>{t('ticket.similarity')}</span>
              <span className={styles.statValue}>
                {Math.round(match.similarity_score * 100)}%
              </span>
              {percentileSummary && (
                <>
                  <span className={styles.statBadge}>{percentileSummary.top}</span>
                  <span className={styles.statSubtext}>{percentileSummary.above}</span>
                </>
              )}
            </div>

            {match.shared_tags.length > 0 && (
              <div className={styles.sectionBlock}>
                <h3 className={styles.sectionTitle}>{t('ticket.sharedTags')}</h3>
                <div className={styles.tags}>
                  {match.shared_tags.map((tag) => (
                    <span key={tag} className={styles.tag}>{getTagLabel(tag, locale)}</span>
                  ))}
                </div>
              </div>
            )}

            {match.ice_breakers.length > 0 && (
              <div className={styles.sectionBlock}>
                <h3 className={styles.sectionTitle}>{t('ticket.iceBreakers')}</h3>
                <ul className={styles.breakers}>
                  {match.ice_breakers.map((breaker) => (
                    <li key={breaker} className={styles.breaker}>{breaker}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <Button variant="secondary" onClick={() => router.push('/matches')}>
            <i className="ri-arrow-left-line" /> {t('ticket.backToMatches')}
          </Button>
        </section>
      </motion.div>
      {previewModal}
    </div>
  )
}
