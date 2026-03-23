'use client'

import { useState } from 'react'
import { api } from '@/lib/api'
import styles from '@/app/(main)/profile/page.module.css'
import type { Profile } from './types'

interface ProfilePreferencesCardProps {
  profile: Profile
  title: string
  lookingForLabel: string
  ageRangeLabel: string
  pureTasteLabel: string
  birthYearLabel: string
  notSetLabel: string
  yesLabel: string
  noLabel: string
  editLabel: string
  saveLabel: string
  cancelLabel: string
  getPrefLabel: (value: string) => string
  prefOptions: { value: string; label: string }[]
  onProfileUpdate: (updated: Profile) => void
}

export default function ProfilePreferencesCard({
  profile,
  title,
  lookingForLabel,
  ageRangeLabel,
  pureTasteLabel,
  birthYearLabel,
  notSetLabel,
  yesLabel,
  noLabel,
  editLabel,
  saveLabel,
  cancelLabel,
  getPrefLabel,
  prefOptions,
  onProfileUpdate,
}: ProfilePreferencesCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    match_gender_pref: profile.match_gender_pref ?? '',
    match_age_min: profile.match_age_min ?? '',
    match_age_max: profile.match_age_max ?? '',
    pure_taste_match: profile.pure_taste_match,
    birth_year: profile.birth_year ?? '',
  })

  function handleEditStart() {
    setForm({
      match_gender_pref: profile.match_gender_pref ?? '',
      match_age_min: profile.match_age_min ?? '',
      match_age_max: profile.match_age_max ?? '',
      pure_taste_match: profile.pure_taste_match,
      birth_year: profile.birth_year ?? '',
    })
    setIsEditing(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        pure_taste_match: form.pure_taste_match,
      }
      if (form.match_gender_pref) body.match_gender_pref = form.match_gender_pref
      if (form.match_age_min) body.match_age_min = Number(form.match_age_min)
      if (form.match_age_max) body.match_age_max = Number(form.match_age_max)
      if (form.birth_year) body.birth_year = Number(form.birth_year)

      const updated = await api<Profile>('/profile', {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
      onProfileUpdate(updated)
      setIsEditing(false)
    } finally {
      setSaving(false)
    }
  }

  if (isEditing) {
    return (
      <div className={styles.card}>
        <div className={styles.sectionTitleRow}>
          <h2 className={styles.sectionTitle}>
            <i className="ri-heart-pulse-line" /> {title}
          </h2>
        </div>

        <div className={styles.field}>
          <span className={styles.label}>{birthYearLabel}</span>
          <input
            type="number"
            className={styles.editInput}
            value={form.birth_year}
            onChange={(e) => setForm({ ...form, birth_year: e.target.value })}
            placeholder="1990"
            min={1920}
            max={new Date().getFullYear() - 18}
          />
        </div>

        <div className={styles.field}>
          <span className={styles.label}>{lookingForLabel}</span>
          <div className={styles.prefGrid}>
            {prefOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`${styles.prefOption} ${form.match_gender_pref === opt.value ? styles.prefActive : ''}`}
                onClick={() => setForm({ ...form, match_gender_pref: opt.value })}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <span className={styles.label}>{ageRangeLabel}</span>
          <div className={styles.editRow}>
            <input
              type="number"
              className={styles.editInput}
              value={form.match_age_min}
              onChange={(e) => setForm({ ...form, match_age_min: e.target.value })}
              placeholder="18"
              min={18}
              max={99}
            />
            <span className={styles.rangeDash}>—</span>
            <input
              type="number"
              className={styles.editInput}
              value={form.match_age_max}
              onChange={(e) => setForm({ ...form, match_age_max: e.target.value })}
              placeholder="99"
              min={18}
              max={99}
            />
          </div>
        </div>

        <div className={styles.field}>
          <span className={styles.label}>{pureTasteLabel}</span>
          <div className={styles.prefGrid}>
            <button
              type="button"
              className={`${styles.prefOption} ${form.pure_taste_match ? styles.prefActive : ''}`}
              onClick={() => setForm({ ...form, pure_taste_match: true })}
            >
              {yesLabel}
            </button>
            <button
              type="button"
              className={`${styles.prefOption} ${!form.pure_taste_match ? styles.prefActive : ''}`}
              onClick={() => setForm({ ...form, pure_taste_match: false })}
            >
              {noLabel}
            </button>
          </div>
        </div>

        <div className={styles.editRow} style={{ justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
          <button className={styles.cancelBtn} onClick={() => setIsEditing(false)}>
            {cancelLabel}
          </button>
          <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? '...' : saveLabel}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.card}>
      <div className={styles.sectionTitleRow}>
        <h2 className={styles.sectionTitle}>
          <i className="ri-heart-pulse-line" /> {title}
        </h2>
        <button className={styles.editBtn} onClick={handleEditStart} aria-label={editLabel}>
          <i className="ri-pencil-line" />
        </button>
      </div>

      {profile.birth_year && (
        <div className={styles.field}>
          <span className={styles.label}>{birthYearLabel}</span>
          <span className={styles.value}>{profile.birth_year}</span>
        </div>
      )}

      <div className={styles.field}>
        <span className={styles.label}>{lookingForLabel}</span>
        <span className={styles.value}>
          {profile.match_gender_pref
            ? getPrefLabel(profile.match_gender_pref)
            : notSetLabel}
        </span>
      </div>

      {(profile.match_age_min || profile.match_age_max) && (
        <div className={styles.field}>
          <span className={styles.label}>{ageRangeLabel}</span>
          <span className={styles.value}>
            {profile.match_age_min || '?'} — {profile.match_age_max || '?'}
          </span>
        </div>
      )}

      <div className={styles.field}>
        <span className={styles.label}>{pureTasteLabel}</span>
        <span className={styles.value}>
          {profile.pure_taste_match ? yesLabel : noLabel}
        </span>
      </div>
    </div>
  )
}
