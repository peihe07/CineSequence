'use client'

import Link from 'next/link'
import { useI18n } from '@/lib/i18n'
import styles from './error.module.css'

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { t } = useI18n()

  return (
    <div className={styles.container}>
      <i className={`ri-error-warning-line ${styles.icon}`} />
      <h1 className={styles.title}>{t('error.title')}</h1>
      <p className={styles.description}>{t('error.description')}</p>
      <div className={styles.actions}>
        <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={reset}>
          <i className="ri-refresh-line" />
          {t('error.retry')}
        </button>
        <Link href="/" prefetch={false} className={`${styles.btn} ${styles.btnSecondary}`}>
          {t('error.backHome')}
        </Link>
      </div>
    </div>
  )
}
