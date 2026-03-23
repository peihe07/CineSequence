'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useMatchStore, MatchItem } from '@/stores/matchStore'
import { useI18n } from '@/lib/i18n'
import TicketCard from '@/components/match/TicketCard'
import Button from '@/components/ui/Button'
import styles from './page.module.css'

export default function TicketPage() {
  const { inviteId } = useParams<{ inviteId: string }>()
  const router = useRouter()
  const { t } = useI18n()
  const { fetchMatch } = useMatchStore()
  const [match, setMatch] = useState<MatchItem | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!inviteId) return

    setIsLoading(true)
    fetchMatch(inviteId).then((result) => {
      if (!result) {
        setError('notFound')
      } else if (result.status !== 'accepted') {
        setError('notAccepted')
      } else {
        setMatch(result)
      }
      setIsLoading(false)
    })
  }, [inviteId, fetchMatch])

  if (isLoading) {
    return (
      <main className={styles.container}>
        <div className={styles.loading}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            <i className="ri-ticket-2-line" style={{ fontSize: '2rem' }} />
          </motion.div>
        </div>
      </main>
    )
  }

  if (error || !match) {
    return (
      <main className={styles.container}>
        <div className={styles.error}>
          <i className="ri-ticket-2-line" style={{ fontSize: '2.5rem', opacity: 0.3 }} />
          <p className={styles.errorText}>
            {error === 'notAccepted' ? t('ticket.notAccepted') : t('ticket.notFound')}
          </p>
          <Button variant="secondary" onClick={() => router.push('/matches')}>
            {t('ticket.backToMatches')}
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main className={styles.container}>
      <motion.div
        className={styles.content}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <section className={`${styles.section} ${styles.heroSection}`}>
          <span className={styles.sideLabel}>FILE 07</span>
          <span className={styles.scriptWord} aria-hidden="true">Reveal</span>
          <h1 className={styles.title}>{t('ticket.title')}</h1>
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
            <div className={styles.stat}>
              <span className={styles.statLabel}>{t('ticket.similarity')}</span>
              <span className={styles.statValue}>
                {Math.round(match.similarity_score * 100)}%
              </span>
            </div>

            {match.shared_tags.length > 0 && (
              <div className={styles.sectionBlock}>
                <h3 className={styles.sectionTitle}>{t('ticket.sharedTags')}</h3>
                <div className={styles.tags}>
                  {match.shared_tags.map((tag) => (
                    <span key={tag} className={styles.tag}>{tag}</span>
                  ))}
                </div>
              </div>
            )}

            {match.ice_breakers.length > 0 && (
              <div className={styles.sectionBlock}>
                <h3 className={styles.sectionTitle}>{t('ticket.iceBreakers')}</h3>
                <ul className={styles.breakers}>
                  {match.ice_breakers.map((b, i) => (
                    <li key={i} className={styles.breaker}>{b}</li>
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
    </main>
  )
}
