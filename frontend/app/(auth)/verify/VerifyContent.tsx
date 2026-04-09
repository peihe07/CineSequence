'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { sanitizeNextPath } from '@/lib/authProtection'
import { useAuthStore } from '@/stores/authStore'
import { useSequencingStore } from '@/stores/sequencingStore'
import { useI18n } from '@/lib/i18n'
import styles from './page.module.css'

export function VerifyContent({
  token,
  nextPath,
}: {
  token: string | null
  nextPath: string | null
}) {
  const router = useRouter()
  const { verify, error } = useAuthStore()
  const fetchProgress = useSequencingStore((s) => s.fetchProgress)
  const { t } = useI18n()
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying')

  useEffect(() => {
    let isActive = true

    if (!token) {
      setStatus('error')
      return
    }

    void Promise.resolve(verify(token))
      .then(async () => {
        if (!isActive) {
          return
        }

        setStatus('success')
        const requestedPath = sanitizeNextPath(nextPath)

        // Admin 登入後直接進入 admin 頁面
        const user = useAuthStore.getState().user
        if (user?.is_admin && !requestedPath) {
          setTimeout(() => router.replace('/admin'), 1500)
          return
        }

        let destination = requestedPath || '/sequencing'

        if (!requestedPath) {
          try {
            const progress = await fetchProgress()
            if (!progress.seed_movie_tmdb_id && progress.round_number === 1) {
              destination = '/sequencing/seed'
            }
          } catch {
            // Fall back to sequencing bootstrap when progress is not yet available.
          }
        }

        setTimeout(() => router.replace(destination), 1500)
      })
      .catch(() => {
        if (isActive) {
          setStatus('error')
        }
      })

    return () => {
      isActive = false
    }
  }, [fetchProgress, nextPath, router, token, verify])

  return (
    <div className={styles.content}>
      <div className={styles.metaBlock}>
        <span className={styles.eyebrow}>[ TOKEN_VERIFY ]</span>
        <span className={styles.metaLine}>AUTH HANDSHAKE / SEQUENCE CHECK</span>
      </div>
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
  )
}
