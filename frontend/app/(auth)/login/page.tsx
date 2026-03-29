'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { sanitizeNextPath } from '@/lib/authProtection'
import LoginForm from '@/components/auth/LoginForm'
import { useAuthStore } from '@/stores/authStore'

function LoginInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = sanitizeNextPath(searchParams.get('next')) ?? '/sequencing'
  const { isAuthenticated, isLoading, fetchProfile } = useAuthStore()
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false)

  useEffect(() => {
    if (isAuthenticated) {
      setHasCheckedAuth(true)
      return
    }

    let cancelled = false

    async function checkAuth() {
      try {
        await fetchProfile()
      } catch {
        // Keep the login form available when session validation fails.
      } finally {
        if (!cancelled) {
          setHasCheckedAuth(true)
        }
      }
    }

    void checkAuth()

    return () => {
      cancelled = true
    }
  }, [fetchProfile, isAuthenticated])

  useEffect(() => {
    if (hasCheckedAuth && isAuthenticated) {
      router.replace(nextPath)
    }
  }, [hasCheckedAuth, isAuthenticated, nextPath, router])

  if (!hasCheckedAuth || isLoading || isAuthenticated) {
    return null
  }

  return <LoginForm nextPath={nextPath} />
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  )
}
