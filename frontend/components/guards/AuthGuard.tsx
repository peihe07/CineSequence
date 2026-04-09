'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import Button from '@/components/ui/Button'
import { useI18n } from '@/lib/i18n'
import { useAuthStore } from '@/stores/authStore'
import styles from './AuthGuard.module.css'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { isAuthenticated, isLoading, fetchProfile, hasHydrated } = useAuthStore()
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

  useEffect(() => {
    if (!hasCheckedAuth || !hasHydrated || authCheckError || isAuthenticated) {
      return
    }

    const query = searchParams.toString()
    const nextPath = query ? `${pathname}?${query}` : pathname
    router.replace(`/login?next=${encodeURIComponent(nextPath)}`)
  }, [
    authCheckError,
    hasCheckedAuth,
    hasHydrated,
    isAuthenticated,
    pathname,
    router,
    searchParams,
  ])

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

  if (!isAuthenticated) {
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
