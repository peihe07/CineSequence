'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
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

const GENDER_LABELS: Record<string, string> = {
  male: '男性', female: '女性', other: '其他', prefer_not_to_say: '不透露',
}

const PREF_LABELS: Record<string, string> = {
  male: '男性', female: '女性', other: '其他', any: '不限',
}

const STATUS_LABELS: Record<string, string> = {
  not_started: '未開始', in_progress: '進行中', completed: '已完成',
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)

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
        <div className={styles.error}>無法載入個人資料</div>
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
        <h1 className={styles.title}>Profile</h1>

        <div className={styles.card}>
          <div className={styles.field}>
            <span className={styles.label}>NAME</span>
            {isEditing ? (
              <div className={styles.editRow}>
                <input
                  className={styles.editInput}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={50}
                />
                <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
                  {saving ? '...' : 'Save'}
                </button>
                <button className={styles.cancelBtn} onClick={() => setIsEditing(false)}>
                  Cancel
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
            <span className={styles.label}>EMAIL</span>
            <span className={styles.value}>{profile.email}</span>
          </div>

          <div className={styles.field}>
            <span className={styles.label}>GENDER</span>
            <span className={styles.value}>{GENDER_LABELS[profile.gender] || profile.gender}</span>
          </div>

          {profile.birth_year && (
            <div className={styles.field}>
              <span className={styles.label}>BIRTH YEAR</span>
              <span className={styles.value}>{profile.birth_year}</span>
            </div>
          )}

          <div className={styles.field}>
            <span className={styles.label}>REGION</span>
            <span className={styles.value}>{profile.region}</span>
          </div>
        </div>

        <div className={styles.card}>
          <h2 className={styles.sectionTitle}>
            <i className="ri-heart-pulse-line" /> MATCHING PREFERENCES
          </h2>

          <div className={styles.field}>
            <span className={styles.label}>LOOKING FOR</span>
            <span className={styles.value}>
              {profile.match_gender_pref ? PREF_LABELS[profile.match_gender_pref] || profile.match_gender_pref : '未設定'}
            </span>
          </div>

          {(profile.match_age_min || profile.match_age_max) && (
            <div className={styles.field}>
              <span className={styles.label}>AGE RANGE</span>
              <span className={styles.value}>
                {profile.match_age_min || '?'} — {profile.match_age_max || '?'}
              </span>
            </div>
          )}

          <div className={styles.field}>
            <span className={styles.label}>PURE TASTE MATCH</span>
            <span className={styles.value}>{profile.pure_taste_match ? '是' : '否'}</span>
          </div>
        </div>

        <div className={styles.card}>
          <h2 className={styles.sectionTitle}>
            <i className="ri-dna-line" /> SEQUENCING STATUS
          </h2>
          <span className={`${styles.statusBadge} ${profile.sequencing_status === 'completed' ? styles.statusCompleted : ''}`}>
            {STATUS_LABELS[profile.sequencing_status] || profile.sequencing_status}
          </span>

          {profile.archetype_id && (
            <div className={styles.field}>
              <span className={styles.label}>ARCHETYPE</span>
              <span className={styles.value}>{profile.archetype_id}</span>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
