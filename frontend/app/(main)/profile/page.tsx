'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { api, apiUpload } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import { useAuthStore } from '@/stores/authStore'
import ProfileBasicsCard from '@/components/profile/ProfileBasicsCard'
import ProfileHeader from '@/components/profile/ProfileHeader'
import ProfilePreferencesCard from '@/components/profile/ProfilePreferencesCard'
import ProfileSequencingCard from '@/components/profile/ProfileSequencingCard'
import type { Profile } from '@/components/profile/types'
import styles from './page.module.css'

export default function ProfilePage() {
  const { t } = useI18n()
  const router = useRouter()
  const logout = useAuthStore((state) => state.logout)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleAvatarUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    try {
      const updated = await apiUpload<Profile>('/profile/avatar', file)
      setProfile(updated)
    } finally {
      setUploadingAvatar(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [])

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

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await logout()
      router.replace('/login')
    } finally {
      setIsLoggingOut(false)
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
        <ProfileHeader
          title={t('profile.title')}
          logoutLabel={t('profile.logout')}
          loggingOutLabel={t('profile.loggingOut')}
          isLoggingOut={isLoggingOut}
          onLogout={handleLogout}
        />

        <ProfileBasicsCard
          profile={profile}
          nameLabel={t('profile.name')}
          emailLabel={t('profile.email')}
          genderLabel={t('profile.gender')}
          birthYearLabel={t('profile.birthYear')}
          regionLabel={t('profile.region')}
          saveLabel={t('profile.save')}
          cancelLabel={t('profile.cancel')}
          changeAvatarLabel={t('profile.changeAvatar')}
          editName={editName}
          isEditing={isEditing}
          saving={saving}
          uploadingAvatar={uploadingAvatar}
          fileInputRef={fileInputRef}
          onAvatarUpload={handleAvatarUpload}
          onEditNameChange={setEditName}
          onEditStart={() => setIsEditing(true)}
          onEditCancel={() => setIsEditing(false)}
          onSave={handleSave}
          getGenderLabel={getGenderLabel}
        />

        <ProfilePreferencesCard
          profile={profile}
          title={t('profile.matchPref')}
          lookingForLabel={t('profile.lookingFor')}
          ageRangeLabel={t('profile.ageRange')}
          pureTasteLabel={t('profile.pureTaste')}
          notSetLabel={t('profile.notSet')}
          yesLabel={t('profile.yes')}
          noLabel={t('profile.no')}
          getPrefLabel={getPrefLabel}
        />

        <ProfileSequencingCard
          profile={profile}
          title={t('profile.seqStatus')}
          archetypeLabel={t('profile.archetype')}
          getStatusLabel={getStatusLabel}
        />
      </motion.div>
    </div>
  )
}
