'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { ApiError, api, apiUpload } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import { useAuthStore } from '@/stores/authStore'
import ProfileBasicsCard from '@/components/profile/ProfileBasicsCard'
import ProfileCompletenessBar from '@/components/profile/ProfileCompletenessBar'
import ProfileDnaSnapshot from '@/components/profile/ProfileDnaSnapshot'
import FavoriteMoviesCard from '@/components/profile/FavoriteMoviesCard'
import ProfileHeader from '@/components/profile/ProfileHeader'
import ProfilePreferencesCard from '@/components/profile/ProfilePreferencesCard'
import ProfileSequencingCard from '@/components/profile/ProfileSequencingCard'
import ProfileTicketCard from '@/components/profile/ProfileTicketCard'
import type { FavoriteMovie, Profile } from '@/components/profile/types'
import { useDnaStore } from '@/stores/dnaStore'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import styles from './page.module.css'

export default function ProfilePage() {
  const { t } = useI18n()
  const router = useRouter()
  const logout = useAuthStore((state) => state.logout)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [isEditingBio, setIsEditingBio] = useState(false)
  const [editBio, setEditBio] = useState('')
  const [saving, setSaving] = useState(false)
  const [savingBio, setSavingBio] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dnaResult = useDnaStore((state) => state.result)
  const fetchDna = useDnaStore((state) => state.fetchResult)

  const handleAvatarUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    setAvatarError(null)
    try {
      const updated = await apiUpload<Profile>('/profile/avatar', file)
      setProfile(updated)
    } catch (error) {
      if (error instanceof ApiError) {
        setAvatarError(error.detail)
      } else {
        setAvatarError(t('common.error'))
      }
    } finally {
      setUploadingAvatar(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [t])

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

  const topTags = dnaResult
    ? Object.entries(dnaResult.tag_labels ?? {})
        .sort(([, a], [, b]) => b - a)
        .slice(0, 8)
        .filter(([, v]) => v >= 0.3)
        .map(([k]) => k)
    : []

  useEffect(() => {
    if (!isPreviewMode) return
    setIsEditing(false)
    setIsEditingBio(false)
    setEditName(profile?.name ?? '')
    setEditBio(profile?.bio ?? '')
  }, [isPreviewMode, profile?.bio, profile?.name])

  useEffect(() => {
    api<Profile>('/profile')
      .then((data) => {
        setProfile(data)
        setEditName(data.name)
        setEditBio(data.bio ?? '')
        if (data.sequencing_status === 'completed') {
          fetchDna().catch(() => {})
        }
      })
      .catch(async (error) => {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          await logout()
          router.replace('/login')
          return
        }
      })
      .finally(() => setIsLoading(false))
  }, [logout, router, fetchDna])

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

  const handleBioSave = async () => {
    const nextBio = editBio.trim()
    if (nextBio === (profile?.bio ?? '')) {
      setIsEditingBio(false)
      return
    }
    setSavingBio(true)
    try {
      const updated = await api<Profile>('/profile', {
        method: 'PATCH',
        body: JSON.stringify({ bio: nextBio || null }),
      })
      setProfile(updated)
      setEditBio(updated.bio ?? '')
      setIsEditingBio(false)
    } finally {
      setSavingBio(false)
    }
  }

  const handleLogout = async () => {
    setShowLogoutConfirm(false)
    setIsLoggingOut(true)
    try {
      await logout()
      router.replace('/')
    } finally {
      setIsLoggingOut(false)
    }
  }

  const handleDeleteAccount = async () => {
    setShowDeleteConfirm(false)
    setIsDeletingAccount(true)
    try {
      await api('/profile', { method: 'DELETE' })
      await logout()
      router.replace('/login')
    } finally {
      setIsDeletingAccount(false)
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
        <section className={`${styles.section} ${styles.heroSection}`}>
          <div className={styles.heroFrame}>
            <div className={styles.heroLead}>
              <div className={styles.kickerRow}>
                <span className={styles.kicker}>{t('profile.dossierLabel')}</span>
                <span className={styles.issueNo}>{t('profile.editionLabel')}</span>
              </div>
              <ProfileHeader
                title={t('profile.title')}
                logoutLabel={t('profile.logout')}
                loggingOutLabel={t('profile.loggingOut')}
                isLoggingOut={isLoggingOut}
                onLogout={async () => setShowLogoutConfirm(true)}
              >
                <button
                  className={`${styles.previewToggle} ${isPreviewMode ? styles.previewActive : ''}`}
                  onClick={() => setIsPreviewMode(!isPreviewMode)}
                >
                  {isPreviewMode ? t('profile.previewBack') : t('profile.previewMode')}
                </button>
              </ProfileHeader>
              <div className={styles.heroIdentity}>
                <p className={styles.heroName}>{profile.name}</p>
                <p className={styles.heroArchetype}>
                  {profile.archetype_name || profile.archetype_id || getStatusLabel(profile.sequencing_status)}
                </p>
              </div>
            </div>

            <div className={styles.heroMetaColumn}>
              <div className={styles.metaRow}>
                <span className={styles.metaChip}>{t('profile.archiveChip')}</span>
                <span className={styles.metaChip}>{profile.region}</span>
                <span className={styles.metaChip}>{getStatusLabel(profile.sequencing_status)}</span>
              </div>
              <p className={styles.deck}>{t('profile.deck')}</p>
              <dl className={styles.factGrid}>
                <div className={styles.factBlock}>
                  <dt className={styles.factLabel}>{t('profile.email')}</dt>
                  <dd className={styles.factValue}>{profile.email}</dd>
                </div>
                <div className={styles.factBlock}>
                  <dt className={styles.factLabel}>{t('profile.gender')}</dt>
                  <dd className={styles.factValue}>{getGenderLabel(profile.gender)}</dd>
                </div>
                <div className={styles.factBlock}>
                  <dt className={styles.factLabel}>{t('profile.region')}</dt>
                  <dd className={styles.factValue}>{profile.region}</dd>
                </div>
                <div className={styles.factBlock}>
                  <dt className={styles.factLabel}>{t('profile.matchPref')}</dt>
                  <dd className={styles.factValue}>
                    {profile.match_gender_pref ? getPrefLabel(profile.match_gender_pref) : t('profile.notSet')}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.editorialBody}`}>
          <div className={styles.featureRail}>
            <div className={styles.editorialNote}>
              <span className={styles.noteLabel}>{t('profile.featuredNoteLabel')}</span>
              <p className={styles.noteText}>
                {profile.bio?.trim() || t('profile.bioEmpty')}
              </p>
            </div>
            <div className={styles.snapshotSection}>
              {dnaResult ? (
                <ProfileTicketCard profile={profile} topTags={topTags} />
              ) : (
                <ProfileDnaSnapshot profile={profile} />
              )}
            </div>
          </div>

          <div className={styles.profileGrid}>
            <div className={styles.editorialColumn}>
              <div className={styles.columnHeading}>
                <span className={styles.columnEyebrow}>{t('profile.identityNotesLabel')}</span>
                <p className={styles.columnDeck}>{t('profile.identityNotesDeck')}</p>
              </div>

              <ProfileBasicsCard
                profile={profile}
                sectionLabel={t('profile.identityNotesLabel')}
                isPreview={isPreviewMode}
                nameLabel={t('profile.name')}
                bioLabel={t('profile.bio')}
                bioPlaceholder={t('profile.bioPlaceholder')}
                addBioLabel={t('profile.bioEmpty')}
                emailLabel={t('profile.email')}
                genderLabel={t('profile.gender')}
                birthYearLabel={t('profile.birthYear')}
                regionLabel={t('profile.region')}
                saveLabel={t('profile.save')}
                cancelLabel={t('profile.cancel')}
                changeAvatarLabel={t('profile.changeAvatar')}
                avatarHintLabel={t('profile.avatarHint')}
                avatarError={avatarError}
                editNameLabel={t('profile.editName')}
                editBioLabel={t('profile.editBio')}
                editName={editName}
                editBio={editBio}
                isEditing={isEditing}
                isEditingBio={isEditingBio}
                saving={saving}
                savingBio={savingBio}
                uploadingAvatar={uploadingAvatar}
                fileInputRef={fileInputRef}
                onAvatarUpload={handleAvatarUpload}
                onEditNameChange={setEditName}
                onEditBioChange={setEditBio}
                onEditStart={() => setIsEditing(true)}
                onEditCancel={() => setIsEditing(false)}
                onSave={handleSave}
                onBioEditStart={() => setIsEditingBio(true)}
                onBioEditCancel={() => {
                  setEditBio(profile.bio ?? '')
                  setIsEditingBio(false)
                }}
                onBioSave={handleBioSave}
                getGenderLabel={getGenderLabel}
              />
            </div>

            <div className={styles.editorialColumn}>
              <div className={styles.columnHeading}>
                <span className={styles.columnEyebrow}>{t('profile.matchingNotesLabel')}</span>
                <p className={styles.columnDeck}>{t('profile.matchingNotesDeck')}</p>
              </div>

              <div className={styles.stack}>
                <ProfilePreferencesCard
                  profile={profile}
                  title={t('profile.matchPref')}
                  lookingForLabel={t('profile.lookingFor')}
                  ageRangeLabel={t('profile.ageRange')}
                  pureTasteLabel={t('profile.pureTaste')}
                  birthYearLabel={t('profile.birthYear')}
                  notSetLabel={t('profile.notSet')}
                  yesLabel={t('profile.yes')}
                  noLabel={t('profile.no')}
                  editLabel={t('profile.editPref')}
                  saveLabel={t('profile.save')}
                  cancelLabel={t('profile.cancel')}
                  visibleLabel={t('profile.visible')}
                  emailNotifLabel={t('profile.emailNotif')}
                  editorIntro={t('profile.preferencesEditorIntro')}
                  summaryIntro={t('profile.preferencesSummaryIntro')}
                  pureTasteOnCopy={t('profile.pureTasteOnCopy')}
                  pureTasteOffCopy={t('profile.pureTasteOffCopy')}
                  isPreview={isPreviewMode}
                  getPrefLabel={getPrefLabel}
                  prefOptions={[
                    { value: 'male', label: t('profile.genderMale') },
                    { value: 'female', label: t('profile.genderFemale') },
                    { value: 'other', label: t('profile.genderOther') },
                    { value: 'any', label: t('profile.prefAny') },
                  ]}
                  onProfileUpdate={setProfile}
                />

                <FavoriteMoviesCard
                  favorites={profile.favorite_movies ?? []}
                  title={t('profile.favorites')}
                  hintLabel={t('profile.favoritesHint')}
                  searchLabel={t('profile.favoritesSearch')}
                  searchingLabel={t('profile.favoritesSearching')}
                  saveLabel={t('profile.save')}
                  cancelLabel={t('profile.cancel')}
                  editLabel={t('profile.edit')}
                  isPreview={isPreviewMode}
                  onUpdate={(movies: FavoriteMovie[]) =>
                    setProfile({ ...profile, favorite_movies: movies })
                  }
                />

                <ProfileSequencingCard
                  profile={profile}
                  title={t('profile.seqStatus')}
                  archetypeLabel={t('profile.archetype')}
                  intro={t('profile.sequencingIntro')}
                  getStatusLabel={getStatusLabel}
                />
              </div>
            </div>
          </div>
        </section>
      </motion.div>

      <ProfileCompletenessBar profile={profile} label={t('profile.completeness')} />

      {!isPreviewMode && (
        <section className={`${styles.section} ${styles.dangerSection}`}>
          <button
            className={styles.deleteAccountBtn}
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isDeletingAccount}
            aria-busy={isDeletingAccount}
          >
            {isDeletingAccount ? t('profile.deletingAccount') : t('profile.deleteAccount')}
          </button>
        </section>
      )}

      <ConfirmDialog
        open={showLogoutConfirm}
        message={t('confirm.logout')}
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />

      <ConfirmDialog
        open={showDeleteConfirm}
        message={t('confirm.deleteAccount')}
        onConfirm={handleDeleteAccount}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  )
}
