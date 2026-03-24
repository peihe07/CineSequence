'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { VerifyContent } from './VerifyContent'

function VerifyInner() {
  const searchParams = useSearchParams()
  return <VerifyContent token={searchParams.get('token')} nextPath={searchParams.get('next')} />
}

// Outer wrapper provides the Suspense boundary required by useSearchParams
export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyInner />
    </Suspense>
  )
}
