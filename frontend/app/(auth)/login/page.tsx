'use client'

import { useState } from 'react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/lib/i18n'
import styles from './page.module.css'

export default function LoginPage() {
  const { login, isLoading, error, clearError } = useAuthStore()
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [emailError, setEmailError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    clearError()
    setEmailError('')

    if (!email.includes('@')) {
      setEmailError(t('auth.invalidEmail'))
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
          <h1 className={styles.title}>{t('auth.checkEmail')}</h1>
          <p className={styles.subtitle}>
            {t('auth.checkEmailSent', { email })}
          </p>
          <Button variant="ghost" onClick={() => setSent(false)}>
            {t('auth.tryOther')}
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main className={styles.container}>
      <form className={styles.card} onSubmit={handleSubmit}>
        <h1 className={styles.title}>{t('auth.signIn')}</h1>
        <p className={styles.subtitle}>{t('auth.subtitle')}</p>

        <Input
          type="email"
          placeholder={t('auth.emailPlaceholder')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={emailError}
        />

        {error && <p className={styles.error}>{error}</p>}

        <Button type="submit" size="lg" loading={isLoading}>
          {isLoading ? t('auth.sending') : t('auth.sendLink')}
        </Button>

        <p className={styles.footer}>
          {t('auth.noAccount')}{' '}
          <a href="/register" className={styles.link}>
            {t('auth.signUp')}
          </a>
        </p>
      </form>
    </main>
  )
}
