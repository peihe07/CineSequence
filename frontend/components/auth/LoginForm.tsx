'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { ApiError, api } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/lib/i18n'
import styles from './LoginForm.module.css'

const DEV_ADMIN_EMAIL = 'y45076@gmail.com'
const SHOW_DEV_LOGIN = process.env.NODE_ENV !== 'production'

interface LoginFormProps {
  mode?: 'page' | 'modal'
  nextPath?: string
  onRegisterClick?: () => void
  onMagicLinkSent?: () => void
  onDevLoginSuccess?: () => void
}

export default function LoginForm({
  mode = 'page',
  nextPath,
  onRegisterClick,
  onMagicLinkSent,
  onDevLoginSuccess,
}: LoginFormProps) {
  const router = useRouter()
  const { login, fetchProfile, isLoading, error, clearError } = useAuthStore()
  const { t, locale } = useI18n()
  const [email, setEmail] = useState('')
  const [adminPasscode, setAdminPasscode] = useState('')
  const [sent, setSent] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [showRegisterPrompt, setShowRegisterPrompt] = useState(false)
  const [showAdminQuickLogin, setShowAdminQuickLogin] = useState(false)
  const [devLoading, setDevLoading] = useState(false)
  const waitlistLabel = locale === 'zh' ? '加入候補名單' : 'Join waitlist'
  const waitlistHint = locale === 'zh'
    ? '新帳號目前改為 waitlist 登記。留下 email，等重新開放後我們會再通知你。'
    : 'New accounts are currently routed to the waitlist. Leave your email and we will notify you when access reopens.'
  const adminPasscodeLabel = locale === 'zh' ? 'Admin Passcode' : 'Admin Passcode'
  const adminPasscodePlaceholder = locale === 'zh' ? '輸入 admin passcode' : 'Enter admin passcode'
  const adminContinueLabel = locale === 'zh' ? '下一步' : 'Continue'
  const adminOpenLabel = locale === 'zh' ? '直接進入管理台' : 'Open Dashboard'
  const adminHint = locale === 'zh'
    ? '偵測到管理員帳號。輸入 passcode 後可直接進入管理台，不會發送 magic link。'
    : 'Admin account detected. Enter the passcode to open the dashboard directly without sending a magic link.'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    clearError()
    setEmailError('')
    setShowRegisterPrompt(false)

    if (!email.includes('@')) {
      setEmailError(t('auth.invalidEmail'))
      return
    }

    if (showAdminQuickLogin) {
      if (!adminPasscode.trim()) {
        setEmailError(locale === 'zh' ? '請輸入 admin passcode。' : 'Enter the admin passcode.')
        return
      }

      try {
        await api<{ access_token: string }>('/auth/admin/session', {
          method: 'POST',
          body: JSON.stringify({
            email,
            passcode: adminPasscode,
          }),
        })
        await fetchProfile()
        router.push('/admin')
        router.refresh()
        return
      } catch (err) {
        setEmailError(
          err instanceof Error
            ? err.message
            : (locale === 'zh' ? '管理員登入失敗。' : 'Admin login failed.')
        )
        return
      }
    }

    try {
      const response = await login(email, nextPath)
      if (response.mode === 'admin_passcode_required') {
        setShowAdminQuickLogin(true)
        setAdminPasscode('')
        return
      }
      setSent(true)
      onMagicLinkSent?.()
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        clearError()
        setEmailError(t('auth.accountNotFound'))
        setShowRegisterPrompt(true)
        return
      }

      // Error is handled by the store
    }
  }

  async function handleDevAdminLogin() {
    clearError()
    setEmailError('')
    setDevLoading(true)

    try {
      await api<{ access_token: string }>('/auth/dev/session', {
        method: 'POST',
        body: JSON.stringify({
          email: DEV_ADMIN_EMAIL,
          name: t('auth.devName'),
          gender: 'other',
          region: 'TW',
        }),
      })
      await fetchProfile()
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
        onChange={(e) => {
          setEmail(e.target.value)
          setShowAdminQuickLogin(false)
          setAdminPasscode('')
          setEmailError('')
          if (showRegisterPrompt) {
            setShowRegisterPrompt(false)
          }
        }}
        error={emailError}
      />

      {showAdminQuickLogin && (
        <>
          <p className={styles.registerPromptText}>{adminHint}</p>
          <Input
            type="password"
            label={adminPasscodeLabel}
            placeholder={adminPasscodePlaceholder}
            value={adminPasscode}
            onChange={(e) => setAdminPasscode(e.target.value)}
          />
        </>
      )}

      {error && <p className={styles.error}>{error}</p>}
      {showRegisterPrompt && (
        <div className={styles.registerPrompt}>
          <p className={styles.registerPromptText}>{waitlistHint}</p>
          {onRegisterClick ? (
            <Button type="button" variant="secondary" onClick={onRegisterClick}>
              {waitlistLabel}
            </Button>
          ) : (
            <Link
              href={nextPath ? `/register?next=${encodeURIComponent(nextPath)}` : '/register'}
              prefetch={false}
              className={styles.registerPromptLink}
            >
              {waitlistLabel}
            </Link>
          )}
        </div>
      )}

      <Button type="submit" size="lg" loading={isLoading}>
        {isLoading ? t('auth.sending') : showAdminQuickLogin ? adminOpenLabel : adminContinueLabel}
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
            {waitlistLabel}
          </button>
        ) : (
          <Link
            href={nextPath ? `/register?next=${encodeURIComponent(nextPath)}` : '/register'}
            prefetch={false}
            className={styles.link}
          >
            {waitlistLabel}
          </Link>
        )}
      </p>
    </form>
  )
}
