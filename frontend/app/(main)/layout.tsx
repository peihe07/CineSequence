'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import { useI18n } from '@/lib/i18n'
import { useAuthStore } from '@/stores/authStore'
import Header from '@/components/ui/Header'
import NavBar from '@/components/ui/NavBar'

export default function MainLayout({ children }: { children: React.ReactNode }) {
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
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
            textAlign: 'center',
            maxWidth: '24rem',
          }}
        >
          <p>{authCheckError}</p>
          <Button variant="secondary" onClick={() => void runAuthCheck()}>
            {t('error.retry')}
          </Button>
        </div>
      </main>
    )
  }

  if (!hasCheckedAuth || isLoading || !isAuthenticated) {
    return null
  }

  return (
    <>
      <Header />
      <main>{children}</main>
      <NavBar />
    </>
  )
}
