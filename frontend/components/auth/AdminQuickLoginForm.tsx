'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { useI18n, type Locale } from '@/lib/i18n'
import styles from './AdminQuickLoginForm.module.css'

const COPY: Record<Locale, {
  title: string
  subtitle: string
  stepLabel: string
  emailLabel: string
  emailPlaceholder: string
  continue: string
  passcodeLabel: string
  passcodePlaceholder: string
  back: string
  submit: string
  submitting: string
}> = {
  zh: {
    title: '管理員快速登入',
    subtitle: '此入口不對一般使用者公開。輸入 allowlist email 與 admin passcode，直接進入管理台。',
    stepLabel: '先確認 admin email',
    emailLabel: 'Admin Email',
    emailPlaceholder: 'you@example.com',
    continue: '下一步',
    passcodeLabel: 'Admin Passcode',
    passcodePlaceholder: '輸入 passcode',
    back: '返回',
    submit: '進入管理台',
    submitting: '登入中...',
  },
  en: {
    title: 'Admin Quick Login',
    subtitle: 'This entry is not exposed to regular users. Use an allowlisted admin email and passcode to enter the dashboard directly.',
    stepLabel: 'Confirm your admin email first',
    emailLabel: 'Admin Email',
    emailPlaceholder: 'you@example.com',
    continue: 'Continue',
    passcodeLabel: 'Admin Passcode',
    passcodePlaceholder: 'Enter passcode',
    back: 'Back',
    submit: 'Open Dashboard',
    submitting: 'Signing in...',
  },
}

export default function AdminQuickLoginForm() {
  const router = useRouter()
  const { fetchProfile } = useAuthStore()
  const { t, locale } = useI18n()
  const copy = COPY[locale]
  const [email, setEmail] = useState('')
  const [passcode, setPasscode] = useState('')
  const [step, setStep] = useState<'email' | 'passcode'>('email')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!email.includes('@')) {
      setError(t('auth.invalidEmail'))
      return
    }
    if (step === 'email') {
      setStep('passcode')
      return
    }
    if (!passcode.trim()) {
      setError(locale === 'zh' ? '請輸入 admin passcode。' : 'Enter the admin passcode.')
      return
    }

    setIsSubmitting(true)
    try {
      await api('/auth/admin/session', {
        method: 'POST',
        body: JSON.stringify({ email, passcode }),
      })
      await fetchProfile()
      router.push('/admin')
      router.refresh()
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : t('common.error'),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className={styles.stack} onSubmit={handleSubmit}>
      <div className={styles.metaBlock}>
        <span className={styles.eyebrow}>[ ADMIN ACCESS ]</span>
        <span className={styles.metaLine}>ALLOWLIST EMAIL / PASSCODE</span>
      </div>
      <h1 className={styles.title}>{copy.title}</h1>
      <p className={styles.subtitle}>{copy.subtitle}</p>
      <p className={styles.stepLabel}>{copy.stepLabel}</p>

      <Input
        label={copy.emailLabel}
        type="email"
        placeholder={copy.emailPlaceholder}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />

      {step === 'passcode' && (
        <Input
          label={copy.passcodeLabel}
          type="password"
          placeholder={copy.passcodePlaceholder}
          value={passcode}
          onChange={(event) => setPasscode(event.target.value)}
        />
      )}

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.actions}>
        {step === 'passcode' && (
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={() => {
              setError(null)
              setPasscode('')
              setStep('email')
            }}
          >
            {copy.back}
          </Button>
        )}
        <Button type="submit" size="lg" loading={isSubmitting}>
          {isSubmitting ? copy.submitting : step === 'email' ? copy.continue : copy.submit}
        </Button>
      </div>
    </form>
  )
}
