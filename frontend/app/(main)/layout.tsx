'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'
import NavBar from '@/components/ui/NavBar'
import MuteToggle from '@/components/ui/MuteToggle'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, fetchProfile } = useAuthStore()
  const router = useRouter()
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false)

  useEffect(() => {
    fetchProfile().finally(() => {
      setHasCheckedAuth(true)
    })
  }, [fetchProfile])

  useEffect(() => {
    if (hasCheckedAuth && !isLoading && !isAuthenticated) {
      router.replace('/login')
    }
  }, [hasCheckedAuth, isAuthenticated, isLoading, router])

  if (!hasCheckedAuth || isLoading || !isAuthenticated) {
    return null
  }

  return (
    <>
      <MuteToggle />
      {children}
      <NavBar />
    </>
  )
}
