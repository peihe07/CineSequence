'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import styles from './CookieConsent.module.css'

const CONSENT_KEY = 'cookie_consent'

export default function CookieConsent() {
  const { t } = useI18n()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(CONSENT_KEY) !== '1') {
      setVisible(true)
    }
  }, [])

  const handleAccept = () => {
    localStorage.setItem(CONSENT_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      className={styles.banner}
      role="banner"
      aria-label={t('cookie.message')}
    >
      <p className={styles.message}>{t('cookie.message')}</p>
      <button
        className={styles.acceptBtn}
        onClick={handleAccept}
        aria-label={t('cookie.accept')}
      >
        {t('cookie.accept')}
      </button>
    </div>
  )
}
