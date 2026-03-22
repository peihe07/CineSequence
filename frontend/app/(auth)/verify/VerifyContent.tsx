'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/lib/i18n'
import styles from './page.module.css'

export function VerifyContent({
  token,
}: {
  token: string | null
}) {
  const router = useRouter()
  const { verify, error } = useAuthStore()
  const { t } = useI18n()
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      return
    }

    verify(token)
      .then(() => {
        setStatus('success')
        setTimeout(() => router.push('/sequencing'), 1500)
      })
      .catch(() => {
        setStatus('error')
      })
  }, [token, verify, router])

  return (
    <main className={styles.container}>
      <div className={styles.card}>
        {status === 'verifying' && (
          <>
            <i className="ri-loader-4-line ri-3x ri-spin" />
            <h1 className={styles.title}>{t('auth.verifying')}</h1>
          </>
        )}

        {status === 'success' && (
          <>
            <i className="ri-checkbox-circle-line ri-3x" style={{ color: '#2EC4B6' }} />
            <h1 className={styles.title}>{t('auth.verified')}</h1>
            <p className={styles.subtitle}>{t('auth.redirecting')}</p>
          </>
        )}

        {status === 'error' && (
          <>
            <i className="ri-error-warning-line ri-3x" style={{ color: 'var(--accent)' }} />
            <h1 className={styles.title}>{t('auth.verifyFailed')}</h1>
            <p className={styles.subtitle}>{error || t('auth.invalidLink')}</p>
            <a href="/login" className={styles.link}>
              {t('auth.newLink')}
            </a>
          </>
        )}
      </div>
    </main>
  )
}
