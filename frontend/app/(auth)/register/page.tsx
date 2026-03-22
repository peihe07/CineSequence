'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/lib/i18n'
import styles from './page.module.css'

export default function RegisterPage() {
  const router = useRouter()
  const { register, isLoading, error, clearError } = useAuthStore()
  const { t } = useI18n()
  const [sent, setSent] = useState(false)

  const [form, setForm] = useState({
    email: '',
    name: '',
    gender: '',
    region: 'TW',
    agreed_to_terms: false,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  // Gender options derived from i18n keys so labels are always locale-aware
  const GENDERS = [
    { value: 'male', label: t('register.genderMale') },
    { value: 'female', label: t('register.genderFemale') },
    { value: 'other', label: t('register.genderOther') },
    { value: 'prefer_not_to_say', label: t('register.genderSkip') },
  ]

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!form.email.includes('@')) errs.email = t('auth.invalidEmail')
    if (!form.name.trim()) errs.name = t('register.nameRequired')
    if (!form.gender) errs.gender = t('register.genderRequired')
    if (!form.agreed_to_terms) errs.consent = t('register.consentRequired')
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    clearError()
    if (!validate()) return

    try {
      await register(form)
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
            {t('auth.checkEmailSent', { email: form.email })}
          </p>
          <Button variant="ghost" onClick={() => router.push('/login')}>
            {t('auth.backToLogin')}
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main className={styles.container}>
      <form className={styles.card} onSubmit={handleSubmit}>
        <h1 className={styles.title}>{t('register.title')}</h1>
        <p className={styles.subtitle}>{t('register.subtitle')}</p>

        <Input
          label={t('auth.emailPlaceholder')}
          type="email"
          placeholder="you@example.com"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          error={errors.email}
        />

        <Input
          label={t('register.name')}
          placeholder={t('register.namePlaceholder')}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          error={errors.name}
        />

        <div className={styles.field}>
          <label className={styles.label}>{t('register.gender')}</label>
          <div className={styles.genderGrid}>
            {GENDERS.map((g) => (
              <button
                key={g.value}
                type="button"
                className={`${styles.genderOption} ${form.gender === g.value ? styles.genderActive : ''}`}
                onClick={() => setForm({ ...form, gender: g.value })}
              >
                {g.label}
              </button>
            ))}
          </div>
          {errors.gender && <span className={styles.error}>{errors.gender}</span>}
        </div>

        <label className={styles.consent}>
          <input
            type="checkbox"
            checked={form.agreed_to_terms}
            onChange={(e) => setForm({ ...form, agreed_to_terms: e.target.checked })}
            className={styles.checkbox}
          />
          <span>
            {t('register.agreePrefix')}{' '}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className={styles.link}>
              {t('register.privacyLink')}
            </a>
          </span>
        </label>
        {errors.consent && <span className={styles.error}>{errors.consent}</span>}

        {error && <p className={styles.error}>{error}</p>}

        <Button type="submit" size="lg" loading={isLoading}>
          {t('register.submit')}
        </Button>

        <p className={styles.footer}>
          {t('auth.hasAccount')}{' '}
          <a href="/login" className={styles.link}>
            {t('auth.signIn')}
          </a>
        </p>
      </form>
    </main>
  )
}
