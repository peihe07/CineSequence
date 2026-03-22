'use client'

import Link from 'next/link'
import { useI18n } from '@/lib/i18n'
import styles from './error.module.css'

export default function NotFound() {
  const { t } = useI18n()

  return (
    <div className={styles.container}>
      <i className={`ri-film-line ${styles.icon}`} />
      <h1 className={styles.title}>{t('notFound.title')}</h1>
      <p className={styles.description}>{t('notFound.description')}</p>
      <div className={styles.actions}>
        <Link href="/" className={`${styles.btn} ${styles.btnPrimary}`}>
          {t('notFound.backHome')}
        </Link>
      </div>
    </div>
  )
}
