'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import TearRitual from '@/components/match/TearRitual'
import { getTagLabel } from '@/lib/tagLabels'
import styles from './page.module.css'

const MOCK = {
  partnerName: 'Alice Chen',
  archetype: '時空旅人 Time Traveler',
  similarity: 0.87,
  tags: ['twist', 'mindfuck', 'dystopia', 'psychoThriller', 'existential'],
  iceBreakers: [
    '你們都對「反轉結局」的敘事手法情有獨鍾',
    '推薦一起看 Dark（闇）— 時空穿越 × 存在主義的完美結合',
    'Both of you lean toward mind-bending narratives that question reality',
  ],
}

export default function TicketDemoPage() {
  const [torn, setTorn] = useState(false)
  const [tearKey, setTearKey] = useState(0)

  const handleReset = () => {
    setTorn(false)
    setTearKey((k) => k + 1)
  }

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.title}>Your Cinema Ticket</h1>

        <TearRitual
          key={tearKey}
          ticketImageUrl={null}
          partnerName={MOCK.partnerName}
          similarityScore={MOCK.similarity}
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
                  <span className={styles.partnerName}>{MOCK.partnerName}</span>
                  <span className={styles.archetype}>{MOCK.archetype}</span>
                </div>
                <div className={styles.score}>
                  <span className={styles.scoreValue}>
                    {Math.round(MOCK.similarity * 100)}%
                  </span>
                  <span className={styles.scoreLabel}>match</span>
                </div>
              </div>

              <div className={styles.dashes} />

              <div className={styles.block}>
                <span className={styles.blockTitle}>SHARED TASTE TAGS</span>
                <div className={styles.tags}>
                  {MOCK.tags.map((tag) => (
                    <span key={tag} className={styles.tag}>
                      {getTagLabel(tag, 'zh')}
                    </span>
                  ))}
                </div>
              </div>

              <div className={styles.dashes} />

              <div className={styles.block}>
                <span className={styles.blockTitle}>ICE BREAKERS</span>
                <ul className={styles.breakers}>
                  {MOCK.iceBreakers.map((b, i) => (
                    <li key={i} className={styles.breaker}>{b}</li>
                  ))}
                </ul>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {torn && (
          <button className={styles.resetBtn} onClick={handleReset}>
            Reset
          </button>
        )}
      </div>
    </div>
  )
}
