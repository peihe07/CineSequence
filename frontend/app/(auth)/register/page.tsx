'use client'

import { type FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useAuthStore } from '@/stores/authStore'
import styles from './page.module.css'

const GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
]

export default function RegisterPage() {
  const router = useRouter()
  const { register, isLoading, error, clearError } = useAuthStore()
  const [sent, setSent] = useState(false)

  const [form, setForm] = useState({
    email: '',
    name: '',
    gender: '',
    region: 'TW',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!form.email.includes('@')) errs.email = 'Please enter a valid email'
    if (!form.name.trim()) errs.name = 'Name is required'
    if (!form.gender) errs.gender = 'Please select a gender'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: FormEvent) {
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
          <h1 className={styles.title}>Check your email</h1>
          <p className={styles.subtitle}>
            We sent a sign-in link to <strong>{form.email}</strong>
          </p>
          <Button variant="ghost" onClick={() => router.push('/login')}>
            Back to login
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main className={styles.container}>
      <form className={styles.card} onSubmit={handleSubmit}>
        <h1 className={styles.title}>Create your account</h1>
        <p className={styles.subtitle}>Start discovering your Movie DNA</p>

        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          error={errors.email}
        />

        <Input
          label="Name"
          placeholder="How should we call you?"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          error={errors.name}
        />

        <div className={styles.field}>
          <label className={styles.label}>Gender</label>
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

        {error && <p className={styles.error}>{error}</p>}

        <Button type="submit" size="lg" loading={isLoading}>
          Sign up
        </Button>

        <p className={styles.footer}>
          Already have an account?{' '}
          <a href="/login" className={styles.link}>
            Sign in
          </a>
        </p>
      </form>
    </main>
  )
}
