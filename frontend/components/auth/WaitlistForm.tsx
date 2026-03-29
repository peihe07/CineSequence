'use client'

import { useState } from 'react'
import Link from 'next/link'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { api } from '@/lib/api'
import type { WaitlistResponse } from '@/lib/auth-types'
import { useI18n, type Locale } from '@/lib/i18n'
import styles from './WaitlistForm.module.css'

interface WaitlistFormProps {
  variant?: 'hero' | 'page'
  onSecondaryClick?: () => void
}

const COPY: Record<Locale, {
  eyebrow: string
  heroTitle: string
  pageTitle: string
  heroBody: string
  pageBody: string
  note: string
  emailLabel: string
  emailPlaceholder: string
  submit: string
  submitting: string
  success: (email: string) => string
  backHome: string
}> = {
  zh: {
    eyebrow: '[ WAITLIST ]',
    heroTitle: '加入候補名單',
    pageTitle: '註冊暫時關閉',
    heroBody: '我們正在進行新功能開發與系統維修，首頁註冊目前暫時改為 waitlist。',
    pageBody: '我們正在進行新功能開發與系統維修，目前不開放直接建立帳號。',
    note: '等系統開放後，我們會再次發信通知你。',
    emailLabel: 'Email',
    emailPlaceholder: 'you@example.com',
    submit: '通知我',
    submitting: '送出中...',
    success: (email) => `已收到 ${email} 的登記；系統重新開放後，我們會再次發信通知。`,
    backHome: '回到首頁',
  },
  en: {
    eyebrow: '[ WAITLIST ]',
    heroTitle: 'Join the waitlist',
    pageTitle: 'Registration is temporarily paused',
    heroBody: 'We are developing new features and performing maintenance, so sign-up is temporarily routed to the waitlist.',
    pageBody: 'We are developing new features and performing maintenance, so account creation is currently unavailable.',
    note: 'Once the system reopens, we will send another email notification.',
    emailLabel: 'Email',
    emailPlaceholder: 'you@example.com',
    submit: 'Notify me',
    submitting: 'Submitting...',
    success: (email) => `We have saved ${email}. We will email you again when access reopens.`,
    backHome: 'Back to home',
  },
}

export default function WaitlistForm({
  variant = 'hero',
  onSecondaryClick,
}: WaitlistFormProps) {
  const { t, locale } = useI18n()
  const copy = COPY[locale]
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)

    if (!email.includes('@')) {
      setError(t('auth.invalidEmail'))
      return
    }

    setIsSubmitting(true)
    try {
      await api<WaitlistResponse>('/auth/waitlist', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })
      setMessage(copy.success(email))
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
    <div className={`${styles.shell} ${variant === 'page' ? styles.page : styles.hero}`}>
      <div className={styles.copy}>
        <span className={styles.eyebrow}>{copy.eyebrow}</span>
        <h2 className={styles.title}>
          {variant === 'page' ? copy.pageTitle : copy.heroTitle}
        </h2>
        <p className={styles.body}>
          {variant === 'page' ? copy.pageBody : copy.heroBody}
        </p>
        <p className={styles.note}>{copy.note}</p>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <Input
          label={copy.emailLabel}
          type="email"
          placeholder={copy.emailPlaceholder}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={error ?? undefined}
        />
        <div className={styles.actions}>
          <Button type="submit" size="lg" loading={isSubmitting}>
            {isSubmitting ? copy.submitting : copy.submit}
          </Button>
          {variant === 'page' ? (
            <Link href="/" prefetch={false} className={styles.secondaryLink}>
              {copy.backHome}
            </Link>
          ) : (
            <button type="button" className={styles.secondaryButton} onClick={onSecondaryClick}>
              {t('landing.login')}
            </button>
          )}
        </div>
      </form>

      {message && <p className={styles.success}>{message}</p>}
    </div>
  )
}
