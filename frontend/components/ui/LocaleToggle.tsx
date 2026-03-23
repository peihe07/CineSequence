'use client'

import { useI18n } from '@/lib/i18n'
import styles from './LocaleToggle.module.css'

export default function LocaleToggle() {
  const { locale, setLocale, t } = useI18n()

  return (
    <div className={styles.pill}>
      <button
        className={`${styles.option} ${locale === 'zh' ? styles.active : ''}`}
        onClick={() => setLocale('zh')}
        aria-label={t('locale.switchZh')}
      >
        中
      </button>
      <button
        className={`${styles.option} ${locale === 'en' ? styles.active : ''}`}
        onClick={() => setLocale('en')}
        aria-label={t('locale.switchEn')}
      >
        EN
      </button>
    </div>
  )
}
