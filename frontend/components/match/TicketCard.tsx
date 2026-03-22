'use client'

import { useRef } from 'react'
import { motion, useMotionValue, useTransform } from 'framer-motion'
import { useI18n } from '@/lib/i18n'
import styles from './TicketCard.module.css'

interface TicketCardProps {
  ticketImageUrl: string | null
  partnerName: string
  similarityScore: number
}

export default function TicketCard({ ticketImageUrl, partnerName, similarityScore }: TicketCardProps) {
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
      className={styles.ticket}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX: rx,
        rotateY: ry,
      }}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <div className={styles.ticketInner}>
        {ticketImageUrl ? (
          <img
            src={ticketImageUrl}
            alt={`${t('matches.matched')} - ${partnerName}`}
            className={styles.ticketImage}
          />
        ) : (
          <div className={styles.placeholder}>
            <i className="ri-ticket-2-line" />
            <span>{partnerName} &middot; {Math.round(similarityScore * 100)}%</span>
          </div>
        )}
      </div>
    </motion.div>
  )
}
