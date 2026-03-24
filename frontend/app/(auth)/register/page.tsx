'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { sanitizeNextPath } from '@/lib/authProtection'
import RegisterForm from '@/components/auth/RegisterForm'
import { useAuthStore } from '@/stores/authStore'

function RegisterInner() {
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
        // Keep the registration form available when session validation fails.
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

  return <RegisterForm nextPath={nextPath} />
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterInner />
    </Suspense>
  )
}
