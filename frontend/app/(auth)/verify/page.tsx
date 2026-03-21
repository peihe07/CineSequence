'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'
import styles from './page.module.css'

export default function VerifyPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { verify, isLoading, error } = useAuthStore()
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying')

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) {
      setStatus('error')
      return
    }

    verify(token)
      .then(() => {
        setStatus('success')
        setTimeout(() => router.push('/sequencing'), 1500)
      })
      .catch(() => {
        setStatus('error')
      })
  }, [searchParams, verify, router])

  return (
    <main className={styles.container}>
      <div className={styles.card}>
        {status === 'verifying' && (
          <>
            <i className="ri-loader-4-line ri-3x ri-spin" />
            <h1 className={styles.title}>Verifying...</h1>
          </>
        )}

        {status === 'success' && (
          <>
            <i className="ri-checkbox-circle-line ri-3x" style={{ color: '#2EC4B6' }} />
            <h1 className={styles.title}>Verified</h1>
            <p className={styles.subtitle}>Redirecting to sequencing...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <i className="ri-error-warning-line ri-3x" style={{ color: 'var(--accent)' }} />
            <h1 className={styles.title}>Verification failed</h1>
            <p className={styles.subtitle}>{error || 'Invalid or expired link'}</p>
            <a href="/login" className={styles.link}>
              Request a new link
            </a>
          </>
        )}
      </div>
    </main>
  )
}
