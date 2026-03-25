'use client'

import { useRef } from 'react'
import { motion, useMotionValue, useTransform } from 'framer-motion'
import Image from 'next/image'
import { useI18n } from '@/lib/i18n'
import { getTagLabel } from '@/lib/tagLabels'
import { MatchItem } from '@/stores/matchStore'
import TearRitual from '@/components/match/TearRitual'
import styles from './TicketCard.module.css'

/**
 * TicketCard has two render modes:
 *
 * 1. Full cinema ticket (used by matches page carousel):
 *    Pass `match`, `ticketNumber`, `onInvite`, `onRespond`, and optionally `highlighted`.
 *
 * 2. Image display mode (used by TearRitual + ticket detail page — legacy API):
 *    Pass `ticketImageUrl`, `partnerName`, `similarityScore`.
 *
 * The discriminated union below routes between the two modes.
 */
type FullTicketProps = {
  match: MatchItem
  ticketNumber: number
  onInvite: () => void
  onRespond: (accept: boolean) => void
  highlighted?: boolean
  // Legacy props must NOT be present
  ticketImageUrl?: never
  partnerName?: never
  similarityScore?: never
}

type LegacyTicketProps = {
  ticketImageUrl: string | null
  partnerName: string
  similarityScore: number
  // Full-ticket props must NOT be present
  match?: never
  ticketNumber?: never
  onInvite?: never
  onRespond?: never
  highlighted?: never
}

type TicketCardProps = FullTicketProps | LegacyTicketProps

export default function TicketCard(props: TicketCardProps) {
  if (props.match !== undefined) {
    return <FullCinemaTicket {...(props as FullTicketProps)} />
  }
  return <LegacyImageTicket {...(props as LegacyTicketProps)} />
}

/* ─────────────────────────────────────────────────────────
   Full cinema ticket — used by the matches page carousel
───────────────────────────────────────────────────────── */
function FullCinemaTicket({
  match,
  ticketNumber,
  onInvite,
  onRespond,
  highlighted,
}: FullTicketProps) {
  const { t, locale } = useI18n()
  const ref = useRef<HTMLDivElement>(null)
  const rotateX = useMotionValue(0)
  const rotateY = useMotionValue(0)

  const pct = Math.round(match.similarity_score * 100)
  const ticketNo = String(ticketNumber).padStart(3, '0')

  const today = new Date()
  const displayDate = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    rotateX.set(y * -6)
    rotateY.set(x * 6)
  }

  const handleMouseLeave = () => {
    rotateX.set(0)
    rotateY.set(0)
  }

  const rx = useTransform(rotateX, (v) => `${v}deg`)
  const ry = useTransform(rotateY, (v) => `${v}deg`)

  const statusClass = styles[match.status] ?? ''

  return (
    <motion.div
      id={`match-${match.id}`}
      ref={ref}
      className={`${styles.ticketWrapper} ${statusClass} ${highlighted ? styles.highlighted : ''}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ rotateX: rx, rotateY: ry, transformStyle: 'preserve-3d' }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
    >
      {/* ── STUB SECTION ─────────────────────────────── */}
      <div className={styles.stub}>
        <div className={styles.stubMeta}>
          <span className={styles.stubLabel}>STUB · NO.{ticketNo}</span>
          <span className={styles.stubDate}>{displayDate}</span>
        </div>

        <div className={styles.similarityBlock}>
          <span className={styles.similarityLabel}>{t('ticket.similarity')}</span>
          <span className={styles.similarityValue}>{pct}%</span>
          <div
            className={styles.progressBar}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className={styles.progressFill} style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      {/* ── PERFORATION LINE ─────────────────────────── */}
      <div className={styles.perforationRow} aria-hidden="true">
        <div className={styles.punchHole} />
        <div className={styles.dashedLine} />
        <div className={styles.punchHole} />
      </div>

      {/* ── MAIN SECTION ─────────────────────────────── */}
      <div className={styles.main}>
        <div className={styles.partnerHeader}>
          {match.partner_avatar_url && (
            <Image
              src={match.partner_avatar_url}
              alt={match.partner_name}
              width={40}
              height={40}
              className={styles.partnerAvatar}
              unoptimized
            />
          )}
          <div className={styles.partnerInfo}>
            <div className={styles.partnerName}>{match.partner_name}</div>
            {match.partner_archetype && (
              <div className={styles.partnerArchetype}>{match.partner_archetype}</div>
            )}
          </div>
        </div>

        {match.partner_bio && (
          <p className={styles.partnerBio}>{match.partner_bio}</p>
        )}

        {match.shared_tags.length > 0 && (
          <div className={styles.tags} aria-label={t('ticket.sharedTags')}>
            {match.shared_tags.slice(0, 4).map((tag) => (
              <span key={tag} className={styles.tag}>
                {getTagLabel(tag, locale)}
              </span>
            ))}
          </div>
        )}

        {match.ice_breakers.length > 0 && (
          <div className={styles.iceBreaker}>
            <i className="ri-chat-smile-2-line" aria-hidden="true" />
            <span>&ldquo;{match.ice_breakers[0]}&rdquo;</span>
          </div>
        )}

        {/* Action area */}
        <div className={styles.actionArea}>
          {match.status === 'discovered' && (
            <button
              className={styles.inviteBtn}
              onClick={onInvite}
              aria-label={`${t('matches.invite')} ${match.partner_name}`}
            >
              <i className="ri-mail-send-line" aria-hidden="true" />
              {t('matches.invite')}
            </button>
          )}

        {match.status === 'invited' && match.is_recipient && (
            <div className={styles.respondBtns}>
              <button
                className={styles.acceptBtn}
                onClick={() => onRespond(true)}
                aria-label={`${t('matches.accept')} ${match.partner_name}`}
              >
                <i className="ri-check-line" aria-hidden="true" />
                {t('matches.accept')}
              </button>
              <button
                className={styles.declineBtn}
                onClick={() => onRespond(false)}
                aria-label={`${t('matches.decline')} ${match.partner_name}`}
              >
                <i className="ri-close-line" aria-hidden="true" />
                {t('matches.decline')}
              </button>
            </div>
          )}

          {match.status === 'accepted' && (
            <div className={styles.tearSection}>
              <p className={styles.tearHint}>{t('matches.tearHint')}</p>
              <TearRitual
                ticketImageUrl={match.ticket_image_url}
                partnerName={match.partner_name}
                similarityScore={match.similarity_score}
              />
            </div>
          )}

          {match.status === 'declined' && (
            <span className={styles.declinedNote}>
              <i className="ri-close-circle-line" aria-hidden="true" />
              {t('matches.decline')}
            </span>
          )}
        </div>

        {/* Status footer */}
        <div className={`${styles.statusLine} ${statusClass}`}>
          <span className={styles.statusDot} aria-hidden="true" />
          <span className={styles.statusText}>{t(`matches.status.${match.status}`)}</span>
        </div>
      </div>
    </motion.div>
  )
}

/* ─────────────────────────────────────────────────────────
   Legacy image-display ticket — used by TearRitual + ticket detail page.
   Preserves the original three-prop API so callers need no changes.
───────────────────────────────────────────────────────── */
function LegacyImageTicket({ ticketImageUrl, partnerName, similarityScore }: LegacyTicketProps) {
  const { t } = useI18n()
  const ref = useRef<HTMLDivElement>(null)
  const rotateX = useMotionValue(0)
  const rotateY = useMotionValue(0)

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    rotateX.set(y * -8)
    rotateY.set(x * 8)
  }

  const handleMouseLeave = () => {
    rotateX.set(0)
    rotateY.set(0)
  }

  const rx = useTransform(rotateX, (v) => `${v}deg`)
  const ry = useTransform(rotateY, (v) => `${v}deg`)

  return (
    <motion.div
      ref={ref}
      className={styles.legacyTicket}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ rotateX: rx, rotateY: ry }}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <div className={styles.legacyInner}>
        {ticketImageUrl ? (
          <Image
            src={ticketImageUrl}
            alt={`${t('matches.matched')} - ${partnerName}`}
            fill
            sizes="100vw"
            className={styles.legacyImage}
          />
        ) : (
          <div className={styles.legacyPlaceholder}>
            <i className="ri-ticket-2-line" aria-hidden="true" />
            <span>{partnerName} &middot; {Math.round(similarityScore * 100)}%</span>
          </div>
        )}
      </div>
    </motion.div>
  )
}
