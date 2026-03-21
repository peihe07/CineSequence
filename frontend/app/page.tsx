'use client'

import { useI18n } from '@/lib/i18n'
import styles from './page.module.css'

export default function Home() {
  const { t } = useI18n()

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>Cine Sequence</h1>
      <p className={styles.subtitle}>{t('auth.subtitle')}</p>
    </main>
  )
}
