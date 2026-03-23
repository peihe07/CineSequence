'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import TearRitual from '@/components/match/TearRitual'
import { getTagLabel } from '@/lib/tagLabels'
import { useI18n } from '@/lib/i18n'
import styles from './page.module.css'

export default function TicketDemoPage() {
  const { t, locale } = useI18n()
  const [torn, setTorn] = useState(false)
  const [tearKey, setTearKey] = useState(0)

  const mock = {
    partnerName: t('demo.partnerName'),
    archetype: t('demo.archetype'),
    similarity: 0.87,
    tags: ['twist', 'mindfuck', 'dystopia', 'psychoThriller', 'existential'],
    iceBreakers: [
      t('demo.breaker1'),
      t('demo.breaker2'),
      t('demo.breaker3'),
    ],
  }

  const handleReset = () => {
    setTorn(false)
    setTearKey((k) => k + 1)
  }

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.title}>{t('demo.ticketTitle')}</h1>

        <TearRitual
          key={tearKey}
          ticketImageUrl={null}
          partnerName={mock.partnerName}
          similarityScore={mock.similarity}
          onTear={() => setTorn(true)}
        />

        <AnimatePresence>
          {torn && (
            <motion.div
              className={styles.details}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            >
              <div className={styles.header}>
                <div className={styles.partner}>
                  <span className={styles.partnerName}>{mock.partnerName}</span>
                  <span className={styles.archetype}>{mock.archetype}</span>
                </div>
                <div className={styles.score}>
                  <span className={styles.scoreValue}>
                    {Math.round(mock.similarity * 100)}%
                  </span>
                  <span className={styles.scoreLabel}>{t('demo.match')}</span>
                </div>
              </div>

              <div className={styles.dashes} />

              <div className={styles.block}>
                <span className={styles.blockTitle}>{t('ticket.sharedTags')}</span>
                <div className={styles.tags}>
                  {mock.tags.map((tag) => (
                    <span key={tag} className={styles.tag}>
                      {getTagLabel(tag, locale)}
                    </span>
                  ))}
                </div>
              </div>

              <div className={styles.dashes} />

              <div className={styles.block}>
                <span className={styles.blockTitle}>{t('ticket.iceBreakers')}</span>
                <ul className={styles.breakers}>
                  {mock.iceBreakers.map((breaker) => (
                    <li key={breaker} className={styles.breaker}>{breaker}</li>
                  ))}
                </ul>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {torn && (
          <button className={styles.resetBtn} onClick={handleReset}>
            {t('demo.reset')}
          </button>
        )}
      </div>
    </div>
  )
}
