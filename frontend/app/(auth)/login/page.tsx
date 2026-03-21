'use client'

import { type FormEvent, useState } from 'react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useAuthStore } from '@/stores/authStore'
import styles from './page.module.css'

export default function LoginPage() {
  const { login, isLoading, error, clearError } = useAuthStore()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [emailError, setEmailError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    clearError()
    setEmailError('')

    if (!email.includes('@')) {
      setEmailError('Please enter a valid email')
      return
    }

    try {
      await login(email)
      setSent(true)
    } catch {
      // Error is handled by the store
    }
  }

  if (sent) {
    return (
      <main className={styles.container}>
        <div className={styles.card}>
          <i className="ri-mail-check-line ri-3x" />
          <h1 className={styles.title}>Check your email</h1>
          <p className={styles.subtitle}>
            We sent a sign-in link to <strong>{email}</strong>
          </p>
          <Button variant="ghost" onClick={() => setSent(false)}>
            Try a different email
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main className={styles.container}>
      <form className={styles.card} onSubmit={handleSubmit}>
        <h1 className={styles.title}>Sign in</h1>
        <p className={styles.subtitle}>Enter your email to receive a magic link</p>

        <Input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={emailError}
        />

        {error && <p className={styles.error}>{error}</p>}

        <Button type="submit" size="lg" loading={isLoading}>
          Send magic link
        </Button>

        <p className={styles.footer}>
          Don&apos;t have an account?{' '}
          <a href="/register" className={styles.link}>
            Sign up
          </a>
        </p>
      </form>
    </main>
  )
}
