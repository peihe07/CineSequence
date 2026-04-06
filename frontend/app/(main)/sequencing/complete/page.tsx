'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ApiError } from '@/lib/api'
import PaymentModal from '@/components/ui/PaymentModal'
import { useSequencingStore } from '@/stores/sequencingStore'
import { useDnaStore } from '@/stores/dnaStore'
import { useI18n } from '@/lib/i18n'
import { soundManager } from '@/lib/sound'
import styles from './page.module.css'

export default function SequencingCompletePage() {
  const router = useRouter()
  const { t } = useI18n()
  const { progress, fetchProgress, extendSequencing } = useSequencingStore()
  const { buildDna, fetchResult } = useDnaStore()
  const [isPreparingDna, setIsPreparingDna] = useState(false)
  const [paymentContext, setPaymentContext] = useState<'extend' | 'retest' | null>(null)

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

  const handleExtend = async () => {
    try {
      await extendSequencing()
      router.replace('/sequencing')
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setPaymentContext('extend')
      }
    }
  }

  const extensionBatches = progress?.extension_batches ?? 0
  const maxBatches = progress?.max_extension_batches ?? 2
  const canExtend = progress?.can_extend ?? false
  const totalRounds = progress?.total_rounds ?? 30
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
            <button className={styles.secondaryBtn} onClick={() => setPaymentContext('retest')}>
              <i className="ri-refresh-line" /> {t('profile.retest')}
            </button>
          </div>

          <div className={styles.paymentPanel}>
            <p className={styles.hint}>{t('complete.paymentNote')}</p>
            <Link href="/pricing" className={styles.paymentLink}>
              {t('complete.viewPricing')}
            </Link>
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
      {paymentContext ? (
        <PaymentModal
          open
          context={paymentContext}
          onClose={() => setPaymentContext(null)}
        />
      ) : null}
    </div>
  )
}
