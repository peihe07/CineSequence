'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useI18n } from '@/lib/i18n'
import styles from './OnboardingOverlay.module.css'

const STORAGE_KEY = 'cinesequence-onboarding-seen'

export default function OnboardingOverlay() {
  const { t } = useI18n()
  const [visible, setVisible] = useState(() => {
    if (typeof window === 'undefined') return false
    return !localStorage.getItem(STORAGE_KEY)
  })

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className={styles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className={styles.card}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.25 }}
          >
            <i className={`ri-film-line ${styles.icon}`} />
            <h2 className={styles.title}>{t('onboarding.title')}</h2>
            <div className={styles.steps}>
              <div className={styles.step}>
                <i className="ri-cursor-line" />
                <span>{t('onboarding.step1')}</span>
              </div>
              <div className={styles.step}>
                <i className="ri-flask-line" />
                <span>{t('onboarding.step2')}</span>
              </div>
              <div className={styles.step}>
                <i className="ri-skip-forward-line" />
                <span>{t('onboarding.step3')}</span>
              </div>
            </div>
            <button className={styles.startBtn} onClick={dismiss}>
              {t('onboarding.start')}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
