'use client'

import { useState } from 'react'
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion'
import { useI18n } from '@/lib/i18n'
import { soundManager } from '@/lib/sound'
import TicketCard from './TicketCard'
import styles from './TearRitual.module.css'

interface TearRitualProps {
  ticketImageUrl: string | null
  partnerName: string
  similarityScore: number
}

const TEAR_THRESHOLD = 80

export default function TearRitual({ ticketImageUrl, partnerName, similarityScore }: TearRitualProps) {
  const { t } = useI18n()
  const [isTorn, setIsTorn] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const dragY = useMotionValue(0)

  // Top half slides up as user drags down
  const topY = useTransform(dragY, [0, TEAR_THRESHOLD], [0, -TEAR_THRESHOLD / 2])
  const topOpacity = useTransform(dragY, [0, TEAR_THRESHOLD], [1, 0])

  // Bottom half (stub) stays, slight reveal
  const bottomY = useTransform(dragY, [0, TEAR_THRESHOLD], [0, 8])

  // Perforation line gap widens as user drags
  const gapHeight = useTransform(dragY, [0, TEAR_THRESHOLD], [0, 24])

  const handleDragEnd = (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > TEAR_THRESHOLD) {
      soundManager.play('tear')
      setIsTorn(true)
    }
    dragY.set(0)
    setIsDragging(false)
  }

  // Once torn, show the full ticket directly
  if (isTorn) {
    return (
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <TicketCard
          ticketImageUrl={ticketImageUrl}
          partnerName={partnerName}
          similarityScore={similarityScore}
        />
      </motion.div>
    )
  }

  return (
    <div className={styles.wrapper}>
      {/* Top half — moves up when dragged */}
      <motion.div className={styles.topHalf} style={{ y: topY, opacity: topOpacity }}>
        <div className={styles.sealed}>
          <i className="ri-ticket-2-line" />
          <span className={styles.sealedName}>{partnerName}</span>
          <span className={styles.sealedPct}>{Math.round(similarityScore * 100)}%</span>
        </div>
        <div className={styles.perforation} />
      </motion.div>

      {/* Gap that opens as user drags */}
      <motion.div className={styles.tearGap} style={{ height: gapHeight }} />

      {/* Bottom half — drag handle */}
      <motion.div
        className={styles.bottomHalf}
        style={{ y: bottomY }}
        drag="y"
        dragConstraints={{ top: 0, bottom: TEAR_THRESHOLD + 20 }}
        dragElastic={0.3}
        dragSnapToOrigin
        onDragStart={() => setIsDragging(true)}
        onDragEnd={handleDragEnd}
        onUpdate={(latest) => {
          if (typeof latest.y === 'number') dragY.set(latest.y)
        }}
      >
        <div className={styles.stubContent}>
          <i className="ri-scissors-line" />
          <span className={styles.stubLabel}>{t('matches.matched')}</span>
        </div>
      </motion.div>

      {/* Drag hint */}
      {!isDragging && (
        <motion.div
          className={styles.hint}
          animate={{ y: [0, 4, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <i className="ri-arrow-down-s-line" />
          <span>{t('matches.tearHint')}</span>
        </motion.div>
      )}
    </div>
  )
}
