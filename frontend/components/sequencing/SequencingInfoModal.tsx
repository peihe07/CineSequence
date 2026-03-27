'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useI18n } from '@/lib/i18n'
import styles from './SequencingInfoModal.module.css'

interface SequencingInfoModalProps {
  open: boolean
  onClose: () => void
}

export default function SequencingInfoModal({ open, onClose }: SequencingInfoModalProps) {
  const { t } = useI18n()

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={styles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          <motion.div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-label={t('seqInfo.title')}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.header}>
              <h2 className={styles.title}>{t('seqInfo.title')}</h2>
              <button className={styles.closeBtn} onClick={onClose} aria-label={t('seqInfo.close')}>
                <i className="ri-close-line" />
              </button>
            </div>

            <div className={styles.body}>
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>{t('seqInfo.overviewTitle')}</h3>
                <p className={styles.text}>{t('seqInfo.overviewBody')}</p>
              </section>

              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>{t('seqInfo.phasesTitle')}</h3>
                <div className={styles.phaseList}>
                  <div className={styles.phaseItem}>
                    <span className={styles.phaseTag}>P1</span>
                    <div>
                      <p className={styles.phaseName}>{t('seqInfo.phase1Name')}</p>
                      <p className={styles.phaseDesc}>{t('seqInfo.phase1Desc')}</p>
                    </div>
                  </div>
                  <div className={styles.phaseItem}>
                    <span className={styles.phaseTag}>P2</span>
                    <div>
                      <p className={styles.phaseName}>{t('seqInfo.phase2Name')}</p>
                      <p className={styles.phaseDesc}>{t('seqInfo.phase2Desc')}</p>
                    </div>
                  </div>
                  <div className={styles.phaseItem}>
                    <span className={styles.phaseTag}>P3</span>
                    <div>
                      <p className={styles.phaseName}>{t('seqInfo.phase3Name')}</p>
                      <p className={styles.phaseDesc}>{t('seqInfo.phase3Desc')}</p>
                    </div>
                  </div>
                </div>
              </section>

              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>{t('seqInfo.signalsTitle')}</h3>
                <ul className={styles.signalList}>
                  <li>
                    <span className={styles.signalLabel}>{t('seqInfo.signal1Label')}</span>
                    <span className={styles.signalDesc}>{t('seqInfo.signal1Desc')}</span>
                  </li>
                  <li>
                    <span className={styles.signalLabel}>{t('seqInfo.signal2Label')}</span>
                    <span className={styles.signalDesc}>{t('seqInfo.signal2Desc')}</span>
                  </li>
                  <li>
                    <span className={styles.signalLabel}>{t('seqInfo.signal3Label')}</span>
                    <span className={styles.signalDesc}>{t('seqInfo.signal3Desc')}</span>
                  </li>
                </ul>
              </section>

              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>{t('seqInfo.resultTitle')}</h3>
                <p className={styles.text}>{t('seqInfo.resultBody')}</p>
              </section>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
