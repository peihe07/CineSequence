'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import RegisterForm from '@/components/auth/RegisterForm'

function RegisterInner() {
  const searchParams = useSearchParams()
  return <RegisterForm nextPath={searchParams.get('next') ?? undefined} />
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterInner />
    </Suspense>
  )
}
