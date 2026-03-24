'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import LoginForm from '@/components/auth/LoginForm'

function LoginInner() {
  const searchParams = useSearchParams()
  return <LoginForm nextPath={searchParams.get('next') ?? undefined} />
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  )
}
