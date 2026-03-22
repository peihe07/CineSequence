'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useI18n } from '@/lib/i18n'
import styles from './ConfirmDialog.module.css'

interface ConfirmDialogProps {
  open: boolean
  message: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({ open, message, onConfirm, onCancel }: ConfirmDialogProps) {
  const { t } = useI18n()

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={styles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onCancel}
        >
          <motion.div
            className={styles.dialog}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className={styles.message}>{message}</p>
            <div className={styles.actions}>
              <button className={`${styles.btn} ${styles.btnCancel}`} onClick={onCancel}>
                {t('common.cancel')}
              </button>
              <button className={`${styles.btn} ${styles.btnConfirm}`} onClick={onConfirm}>
                {t('common.confirm')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
