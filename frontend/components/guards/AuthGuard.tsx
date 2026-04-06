'use client'

import { useCallback, useEffect, useState } from 'react'
import Button from '@/components/ui/Button'
import { useI18n } from '@/lib/i18n'
import { useAuthStore } from '@/stores/authStore'
import styles from './AuthGuard.module.css'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoading, fetchProfile, hasHydrated } = useAuthStore()
  const { t } = useI18n()
  const [hasCheckedAuth, setHasCheckedAuth] = useState(hasHydrated)
  const [authCheckError, setAuthCheckError] = useState<string | null>(null)

  const runAuthCheck = useCallback(async () => {
    if (hasHydrated) {
      setHasCheckedAuth(true)
      return
    }
    setHasCheckedAuth(false)
    setAuthCheckError(null)
    try {
      await fetchProfile()
    } catch (err) {
      setAuthCheckError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setHasCheckedAuth(true)
    }
  }, [fetchProfile, hasHydrated, t])

  useEffect(() => {
    void runAuthCheck()
  }, [runAuthCheck])

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

  if (!hasCheckedAuth || (!hasHydrated && isLoading)) {
    return (
      <main className={styles.state}>
        <div className={styles.panel}>
          <i className={`ri-loader-4-line ri-spin ${styles.icon}`} aria-hidden="true" />
          <p>{t('common.loading')}</p>
        </div>
      </main>
    )
  }

  return <>{children}</>
}
