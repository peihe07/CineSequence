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
  const { progress, fetchProgress, extendSequencing } = useSequencingStore()
  const { buildDna } = useDnaStore()
  const [isPreparingDna, setIsPreparingDna] = useState(false)

  useEffect(() => {
    fetchProgress()
    soundManager.play('complete')
  }, [fetchProgress])

  const handleViewDna = async () => {
    setIsPreparingDna(true)
    const result = await buildDna()
    if (result) {
      router.replace('/dna')
      return
    }

    setIsPreparingDna(false)
  }

  const handleExtend = async () => {
    try {
      await extendSequencing()
      router.replace('/sequencing')
    } catch {
      // Store error state keeps the user on the completion page.
    }
  }

  const extensionBatches = progress?.extension_batches ?? 0
  const maxBatches = progress?.max_extension_batches ?? 3
  const canExtend = progress?.can_extend ?? false
  const totalRounds = progress?.total_rounds ?? 20
  const remaining = maxBatches - extensionBatches

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
            <div className={styles.stat}>
              <span className={styles.statValue}>{extensionBatches}/{maxBatches}</span>
              <span className={styles.statLabel}>{t('complete.extensions')}</span>
            </div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.actionsSection}`}>
          <div className={styles.actions}>
            <button className={styles.primaryBtn} onClick={handleViewDna} disabled={isPreparingDna}>
              <i className="ri-dna-line" /> {t('complete.viewDna')}
            </button>

            {canExtend && (
              <button className={styles.secondaryBtn} onClick={handleExtend}>
                <i className="ri-add-line" /> {t('complete.extend')}
              </button>
            )}
          </div>

          {isPreparingDna && (
            <p className={styles.hint}>
              {t('dna.analyzing')}
            </p>
          )}

          {canExtend && (
            <p className={styles.hint}>
              {t('complete.extendHint', { remaining })}
            </p>
          )}

          {!canExtend && extensionBatches > 0 && (
            <p className={styles.hint}>
              {t('complete.maxReached')}
            </p>
          )}
        </section>
      </motion.div>
    </div>
  )
}
