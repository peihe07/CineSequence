'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import { useI18n } from '@/lib/i18n'
import { useAuthStore } from '@/stores/authStore'
import styles from './AuthGuard.module.css'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, fetchProfile } = useAuthStore()
  const { t } = useI18n()
  const router = useRouter()
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false)
  const [authCheckError, setAuthCheckError] = useState<string | null>(null)

  const runAuthCheck = useCallback(async () => {
    setHasCheckedAuth(false)
    setAuthCheckError(null)
    try {
      await fetchProfile()
    } catch (err) {
      setAuthCheckError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setHasCheckedAuth(true)
    }
  }, [fetchProfile, t])

  useEffect(() => {
    void runAuthCheck()
  }, [runAuthCheck])

  useEffect(() => {
    if (hasCheckedAuth && !isLoading && !isAuthenticated && !authCheckError) {
      router.replace('/login')
    }
  }, [authCheckError, hasCheckedAuth, isAuthenticated, isLoading, router])

  if (authCheckError) {
    return (
      <main className={styles.state}>
        <div className={styles.panel}>
          <p>{authCheckError}</p>
          <Button variant="secondary" onClick={() => void runAuthCheck()}>
            {t('error.retry')}
          </Button>
        </div>
      </main>
    )
  }

  if (!hasCheckedAuth || isLoading) {
    return (
      <main className={styles.state}>
        <div className={styles.panel}>
          <i className={`ri-loader-4-line ri-spin ${styles.icon}`} aria-hidden="true" />
          <p>{t('common.loading')}</p>
        </div>
      </main>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return <>{children}</>
}
