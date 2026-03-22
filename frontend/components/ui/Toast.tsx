'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useToastStore, ToastType } from '@/stores/toastStore'
import styles from './Toast.module.css'

const ICONS: Record<ToastType, string> = {
  success: 'ri-check-line',
  error: 'ri-error-warning-line',
  info: 'ri-information-line',
}

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore()

  return (
    <div className={styles.container} role="status" aria-live="polite">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            className={`${styles.toast} ${styles[toast.type]}`}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            onClick={() => removeToast(toast.id)}
          >
            <i className={`${ICONS[toast.type]} ${styles.icon}`} />
            <span>{toast.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
