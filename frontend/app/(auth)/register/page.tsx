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
  const { isAuthenticated, fetchProfile } = useAuthStore()
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)

  useEffect(() => {
    if (isAuthenticated) {
      setIsCheckingAuth(false)
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
          setIsCheckingAuth(false)
        }
      }
    }

    void checkAuth()

    return () => {
      cancelled = true
    }
  }, [fetchProfile, isAuthenticated])

  useEffect(() => {
    if (!isCheckingAuth && isAuthenticated) {
      router.replace(nextPath)
    }
  }, [isCheckingAuth, isAuthenticated, nextPath, router])

  if (isCheckingAuth || isAuthenticated) {
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
