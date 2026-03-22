'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'
import NavBar from '@/components/ui/NavBar'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, fetchProfile } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login')
    }
  }, [isAuthenticated, isLoading, router])

  if (isLoading || !isAuthenticated) {
    return null
  }

  return (
    <>
      {children}
      <NavBar />
    </>
  )
}
