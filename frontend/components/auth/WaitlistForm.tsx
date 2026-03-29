'use client'

import { useState } from 'react'
import Link from 'next/link'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { api } from '@/lib/api'
import type { WaitlistResponse } from '@/lib/auth-types'
import { useI18n } from '@/lib/i18n'
import styles from './WaitlistForm.module.css'

interface WaitlistFormProps {
  variant?: 'hero' | 'page'
  onSecondaryClick?: () => void
}

export default function WaitlistForm({
  variant = 'hero',
  onSecondaryClick,
}: WaitlistFormProps) {
  const { t } = useI18n()
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
      setMessage(t('landing.waitlistSuccess', { email }))
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
        <span className={styles.eyebrow}>{t('waitlist.closedEyebrow')}</span>
        <h2 className={styles.title}>
          {variant === 'page' ? t('waitlist.closedTitle') : t('landing.waitlistTitle')}
        </h2>
        <p className={styles.body}>
          {variant === 'page' ? t('waitlist.closedBody') : t('landing.waitlistBody')}
        </p>
        <p className={styles.note}>{t('waitlist.closedNotify')}</p>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <Input
          label={t('landing.waitlistEmailLabel')}
          type="email"
          placeholder={t('landing.waitlistEmailPlaceholder')}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={error ?? undefined}
        />
        <div className={styles.actions}>
          <Button type="submit" size="lg" loading={isSubmitting}>
            {isSubmitting ? t('landing.waitlistSubmitting') : t('landing.waitlistSubmit')}
          </Button>
          {variant === 'page' ? (
            <Link href="/" prefetch={false} className={styles.secondaryLink}>
              {t('waitlist.closedBackHome')}
            </Link>
          ) : (
            <button type="button" className={styles.secondaryButton} onClick={onSecondaryClick}>
              {t('landing.login')}
            </button>
          )}
        </div>
      </form>

      {message && <p className={styles.success}>{t('landing.waitlistSuccess', { email })}</p>}
    </div>
  )
}
