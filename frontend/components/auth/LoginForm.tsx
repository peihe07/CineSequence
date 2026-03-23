'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { api, setToken } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/lib/i18n'
import styles from './LoginForm.module.css'

const DEV_ADMIN_EMAIL = 'y450376@gmail.com'
const SHOW_DEV_LOGIN = process.env.NODE_ENV !== 'production'

interface LoginFormProps {
  mode?: 'page' | 'modal'
  onRegisterClick?: () => void
  onMagicLinkSent?: () => void
  onDevLoginSuccess?: () => void
}

export default function LoginForm({
  mode = 'page',
  onRegisterClick,
  onMagicLinkSent,
  onDevLoginSuccess,
}: LoginFormProps) {
  const router = useRouter()
  const { login, isLoading, error, clearError } = useAuthStore()
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [devLoading, setDevLoading] = useState(false)

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
      onMagicLinkSent?.()
    } catch {
      // Error is handled by the store
    }
  }

  async function handleDevAdminLogin() {
    clearError()
    setEmailError('')
    setDevLoading(true)

    try {
      const response = await api<{ access_token: string }>('/auth/dev/session', {
        method: 'POST',
        body: JSON.stringify({
          email: DEV_ADMIN_EMAIL,
          name: t('auth.devName'),
          gender: 'other',
          region: 'TW',
        }),
      })
      setToken(response.access_token)
      onDevLoginSuccess?.()
      router.push('/admin')
      router.refresh()
    } catch {
      // Error is surfaced by subsequent navigation or store-driven fetches.
    } finally {
      setDevLoading(false)
    }
  }

  if (sent) {
    return (
      <div className={`${styles.sentState} ${mode === 'modal' ? styles.modal : ''}`}>
        <i className={`ri-mail-check-line ${styles.sentIcon}`} />
        <h1 className={styles.title}>{t('auth.checkEmail')}</h1>
        <p className={styles.subtitle}>
          {t('auth.checkEmailSent', { email })}
        </p>
        <Button variant="ghost" onClick={() => setSent(false)}>
          {t('auth.tryOther')}
        </Button>
      </div>
    )
  }

  return (
    <form className={`${styles.stack} ${mode === 'modal' ? styles.modal : ''}`} onSubmit={handleSubmit}>
      <div className={styles.metaBlock}>
        <span className={styles.eyebrow}>[ LOGIN_PORTAL ]</span>
        <span className={styles.metaLine}>SESSION REQUEST / MAGIC LINK</span>
      </div>
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

      {SHOW_DEV_LOGIN && (
        <div className={styles.devCard}>
          <p className={styles.devTitle}>{t('auth.devTitle')}</p>
          <p className={styles.devText}>{t('auth.devHint')}</p>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            loading={devLoading}
            onClick={handleDevAdminLogin}
          >
            {t('auth.devLogin')}
          </Button>
        </div>
      )}

      <p className={styles.footer}>
        {t('auth.noAccount')}{' '}
        {onRegisterClick ? (
          <button type="button" className={styles.textButton} onClick={onRegisterClick}>
            {t('auth.signUp')}
          </button>
        ) : (
          <Link href="/register" className={styles.link}>
            {t('auth.signUp')}
          </Link>
        )}
      </p>
    </form>
  )
}
