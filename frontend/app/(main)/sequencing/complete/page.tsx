'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useSequencingStore } from '@/stores/sequencingStore'
import { useDnaStore } from '@/stores/dnaStore'
import { useI18n } from '@/lib/i18n'
import { soundManager } from '@/lib/sound'
import styles from './page.module.css'

export default function SequencingCompletePage() {
  const router = useRouter()
  const { t } = useI18n()
  const { progress, fetchProgress } = useSequencingStore()
  const { buildDna, fetchResult } = useDnaStore()
  const [isPreparingDna, setIsPreparingDna] = useState(false)

  useEffect(() => {
    fetchProgress()
    soundManager.play('complete')
  }, [fetchProgress])

  const handleViewDna = async () => {
    setIsPreparingDna(true)
    const existingResult = await fetchResult()
    if (existingResult) {
      router.replace('/dna')
      return
    }

    const builtResult = await buildDna()
    if (builtResult) {
      router.replace('/dna')
      return
    }

    setIsPreparingDna(false)
  }

  const totalRounds = progress?.total_rounds ?? 30

  return (
    <div className={styles.container}>
      <motion.div
        className={styles.content}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <section className={`${styles.section} ${styles.heroSection}`}>
          <span className={styles.sideLabel}>{t('complete.fileLabel')}</span>
          <p className={styles.eyebrow}>{t('complete.eyebrow')}</p>
          <div className={styles.icon}>
            <i className="ri-dna-line ri-3x" />
          </div>
          <h1 className={styles.title}>{t('complete.title')}</h1>
          <p className={styles.subtitle}>
            {t('complete.subtitle', { total: totalRounds })}
          </p>
          <p className={styles.heroMeta}>{t('complete.heroMeta')}</p>
        </section>

        <section className={`${styles.section} ${styles.statsSection}`}>
          <div className={styles.stats}>
            <div className={styles.stat}>
              <span className={styles.statValue}>{totalRounds}</span>
              <span className={styles.statLabel}>{t('complete.rounds')}</span>
            </div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.actionsSection}`}>
          <div className={styles.actions}>
            <button className={styles.primaryBtn} onClick={handleViewDna} disabled={isPreparingDna}>
              <i className="ri-dna-line" /> {t('complete.viewDna')}
            </button>

          </div>

          {isPreparingDna && (
            <p className={styles.hint}>
              {t('dna.analyzing')}
            </p>
          )}
        </section>
      </motion.div>
    </div>
  )
}
