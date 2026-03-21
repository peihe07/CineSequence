'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import styles from './page.module.css'

interface Profile {
  id: string
  email: string
  name: string
  avatar_url: string | null
  gender: string
  birth_year: number | null
  region: string
  match_gender_pref: string | null
  match_age_min: number | null
  match_age_max: number | null
  pure_taste_match: boolean
  sequencing_status: string
  archetype_id: string | null
  personality_reading: string | null
  ticket_style: string | null
}

export default function ProfilePage() {
  const { t } = useI18n()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)

  // Locale-aware label resolvers using t() — replaces hardcoded GENDER_LABELS / PREF_LABELS / STATUS_LABELS
  function getGenderLabel(value: string): string {
    const map: Record<string, string> = {
      male: t('profile.genderMale'),
      female: t('profile.genderFemale'),
      other: t('profile.genderOther'),
      prefer_not_to_say: t('profile.genderSkip'),
    }
    return map[value] ?? value
  }

  function getPrefLabel(value: string): string {
    const map: Record<string, string> = {
      male: t('profile.genderMale'),
      female: t('profile.genderFemale'),
      other: t('profile.genderOther'),
      any: t('profile.prefAny'),
    }
    return map[value] ?? value
  }

  function getStatusLabel(value: string): string {
    const map: Record<string, string> = {
      not_started: t('profile.notStarted'),
      in_progress: t('profile.inProgress'),
      completed: t('profile.completed'),
    }
    return map[value] ?? value
  }

  useEffect(() => {
    api<Profile>('/profile')
      .then((data) => {
        setProfile(data)
        setEditName(data.name)
      })
      .finally(() => setIsLoading(false))
  }, [])

  const handleSave = async () => {
    if (!editName.trim() || editName === profile?.name) {
      setIsEditing(false)
      return
    }
    setSaving(true)
    try {
      const updated = await api<Profile>('/profile', {
        method: 'PATCH',
        body: JSON.stringify({ name: editName.trim() }),
      })
      setProfile(updated)
      setIsEditing(false)
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <i className="ri-loader-4-line ri-spin ri-2x" />
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>{t('profile.loadError')}</div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <motion.div
        className={styles.content}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className={styles.title}>{t('profile.title')}</h1>

        <div className={styles.card}>
          <div className={styles.field}>
            <span className={styles.label}>{t('profile.name')}</span>
            {isEditing ? (
              <div className={styles.editRow}>
                <input
                  className={styles.editInput}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={50}
                />
                <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
                  {saving ? '...' : t('profile.save')}
                </button>
                <button className={styles.cancelBtn} onClick={() => setIsEditing(false)}>
                  {t('profile.cancel')}
                </button>
              </div>
            ) : (
              <div className={styles.valueRow}>
                <span className={styles.value}>{profile.name}</span>
                <button className={styles.editBtn} onClick={() => setIsEditing(true)}>
                  <i className="ri-pencil-line" />
                </button>
              </div>
            )}
          </div>

          <div className={styles.field}>
            <span className={styles.label}>{t('profile.email')}</span>
            <span className={styles.value}>{profile.email}</span>
          </div>

          <div className={styles.field}>
            <span className={styles.label}>{t('profile.gender')}</span>
            <span className={styles.value}>{getGenderLabel(profile.gender)}</span>
          </div>

          {profile.birth_year && (
            <div className={styles.field}>
              <span className={styles.label}>{t('profile.birthYear')}</span>
              <span className={styles.value}>{profile.birth_year}</span>
            </div>
          )}

          <div className={styles.field}>
            <span className={styles.label}>{t('profile.region')}</span>
            <span className={styles.value}>{profile.region}</span>
          </div>
        </div>

        <div className={styles.card}>
          <h2 className={styles.sectionTitle}>
            <i className="ri-heart-pulse-line" /> {t('profile.matchPref')}
          </h2>

          <div className={styles.field}>
            <span className={styles.label}>{t('profile.lookingFor')}</span>
            <span className={styles.value}>
              {profile.match_gender_pref
                ? getPrefLabel(profile.match_gender_pref)
                : t('profile.notSet')}
            </span>
          </div>

          {(profile.match_age_min || profile.match_age_max) && (
            <div className={styles.field}>
              <span className={styles.label}>{t('profile.ageRange')}</span>
              <span className={styles.value}>
                {profile.match_age_min || '?'} — {profile.match_age_max || '?'}
              </span>
            </div>
          )}

          <div className={styles.field}>
            <span className={styles.label}>{t('profile.pureTaste')}</span>
            <span className={styles.value}>
              {profile.pure_taste_match ? t('profile.yes') : t('profile.no')}
            </span>
          </div>
        </div>

        <div className={styles.card}>
          <h2 className={styles.sectionTitle}>
            <i className="ri-dna-line" /> {t('profile.seqStatus')}
          </h2>
          <span className={`${styles.statusBadge} ${profile.sequencing_status === 'completed' ? styles.statusCompleted : ''}`}>
            {getStatusLabel(profile.sequencing_status)}
          </span>

          {profile.archetype_id && (
            <div className={styles.field}>
              <span className={styles.label}>{t('profile.archetype')}</span>
              <span className={styles.value}>{profile.archetype_id}</span>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
