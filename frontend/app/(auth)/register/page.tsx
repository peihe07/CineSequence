'use client'

import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import type { RegisterRequest } from '@/lib/auth-types'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/lib/i18n'
import styles from './page.module.css'

type RegisterFormState = Omit<RegisterRequest, 'birth_year'> & { birth_year: string }

const MIN_AGE = 18
const currentYear = new Date().getFullYear()

export default function RegisterPage() {
  const router = useRouter()
  const { register, isLoading, error, clearError } = useAuthStore()
  const { t } = useI18n()
  const [sent, setSent] = useState(false)
  const [policyRead, setPolicyRead] = useState(false)
  const policyRef = useRef<HTMLDivElement>(null)

  const [form, setForm] = useState<RegisterFormState>({
    email: '',
    name: '',
    gender: '',
    region: 'TW',
    birth_year: '',
    agreed_to_terms: false,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const GENDERS = [
    { value: 'male', label: t('register.genderMale') },
    { value: 'female', label: t('register.genderFemale') },
    { value: 'other', label: t('register.genderOther') },
    { value: 'prefer_not_to_say', label: t('register.genderSkip') },
  ]

  const handlePolicyScroll = useCallback(() => {
    const el = policyRef.current
    if (!el || policyRead) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 20
    if (atBottom) setPolicyRead(true)
  }, [policyRead])

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!form.email.includes('@')) errs.email = t('auth.invalidEmail')
    if (!form.name.trim()) errs.name = t('register.nameRequired')
    if (!form.gender) errs.gender = t('register.genderRequired')

    if (!form.birth_year) {
      errs.birthYear = t('register.birthYearRequired')
    } else {
      const year = Number(form.birth_year)
      if (year < 1920 || year > currentYear - MIN_AGE) {
        errs.birthYear = t('register.ageMinimum')
      }
    }

    if (!form.agreed_to_terms) errs.consent = t('register.consentRequired')
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    clearError()
    if (!validate()) return

    try {
      await register({
        ...form,
        birth_year: Number(form.birth_year),
      })
      setSent(true)
    } catch {
      // Error is handled by the store
    }
  }

  if (sent) {
    return (
      <div className={styles.stack}>
        <i className="ri-mail-check-line ri-3x" />
        <h1 className={styles.title}>{t('auth.checkEmail')}</h1>
        <p className={styles.subtitle}>
          {t('auth.checkEmailSent', { email: form.email })}
        </p>
        <Button variant="ghost" onClick={() => router.push('/login')}>
          {t('auth.backToLogin')}
        </Button>
      </div>
    )
  }

  return (
    <form className={styles.stack} onSubmit={handleSubmit}>
      <h1 className={styles.title}>{t('register.title')}</h1>
      <p className={styles.subtitle}>{t('register.subtitle')}</p>

      <Input
        label={t('auth.emailPlaceholder')}
        type="email"
        placeholder={t('auth.emailExample')}
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

      <Input
        label={t('register.birthYear')}
        type="number"
        placeholder="1990"
        value={form.birth_year}
        onChange={(e) => setForm({ ...form, birth_year: e.target.value })}
        error={errors.birthYear}
      />

      {/* Privacy policy inline scroll box */}
      <div className={styles.policySection}>
        <label className={styles.label}>{t('register.privacyLink')}</label>
        <div
          ref={policyRef}
          className={styles.policyBox}
          onScroll={handlePolicyScroll}
        >
          <p>{t('privacy.collectTitle')}</p>
          <p>{t('privacy.collectIntro')}</p>
          <ul>
            <li>{t('privacy.collectEmail')}</li>
            <li>{t('privacy.collectName')}</li>
            <li>{t('privacy.collectGender')}</li>
            <li>{t('privacy.collectRegion')}</li>
            <li>{t('privacy.collectPicks')}</li>
          </ul>
          <p>{t('privacy.sharedTitle')}</p>
          <p>{t('privacy.sharedIntro')}</p>
          <ul>
            <li>{t('privacy.sharedName')}</li>
            <li>{t('privacy.sharedArchetype')}</li>
            <li>{t('privacy.sharedTags')}</li>
            <li>{t('privacy.sharedIceBreakers')}</li>
            <li>{t('privacy.sharedSimilarity')}</li>
          </ul>
          <p>{t('privacy.notSharedTitle')}</p>
          <p>{t('privacy.notSharedIntro')}</p>
          <ul>
            <li>{t('privacy.notSharedEmail')}</li>
            <li>{t('privacy.notSharedBirthYear')}</li>
            <li>{t('privacy.notSharedGender')}</li>
          </ul>
          <p>{t('privacy.storageTitle')}</p>
          <p>{t('privacy.storageBody')}</p>
          <p>{t('privacy.thirdPartyTitle')}</p>
          <p>{t('privacy.thirdPartyBody')}</p>
          <p>{t('privacy.rightsTitle')}</p>
          <p>{t('privacy.rightsBody')}</p>
          <p>{t('privacy.contactTitle')}</p>
          <p>{t('privacy.contactBody')}</p>
        </div>
        {!policyRead && (
          <span className={styles.policyHint}>{t('register.scrollToRead')}</span>
        )}
      </div>

      <label className={`${styles.consent} ${!policyRead ? styles.consentDisabled : ''}`}>
        <input
          type="checkbox"
          checked={form.agreed_to_terms}
          onChange={(e) => {
            if (policyRead) setForm({ ...form, agreed_to_terms: e.target.checked })
          }}
          disabled={!policyRead}
          className={styles.checkbox}
        />
        <span>
          {t('register.agreePrefix')}{' '}
          <a href="/terms" target="_blank" rel="noopener noreferrer" className={styles.link}>
            {t('register.termsLink')}
          </a>
          {' '}{t('register.and')}{' '}
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className={styles.link}>
            {t('register.privacyLink')}
          </a>
        </span>
      </label>
      {errors.consent && <span className={styles.error}>{errors.consent}</span>}

      <p className={styles.disclaimer}>{t('register.disclaimer')}</p>

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
  )
}
