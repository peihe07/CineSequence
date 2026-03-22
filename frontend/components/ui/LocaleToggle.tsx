'use client'

import { useI18n } from '@/lib/i18n'
import styles from './LocaleToggle.module.css'

export default function LocaleToggle() {
  const { locale, setLocale } = useI18n()

  return (
    <div className={styles.pill}>
      <button
        className={`${styles.option} ${locale === 'zh' ? styles.active : ''}`}
        onClick={() => setLocale('zh')}
        aria-label="切換至中文"
      >
        中
      </button>
      <button
        className={`${styles.option} ${locale === 'en' ? styles.active : ''}`}
        onClick={() => setLocale('en')}
        aria-label="Switch to English"
      >
        EN
      </button>
    </div>
  )
}
