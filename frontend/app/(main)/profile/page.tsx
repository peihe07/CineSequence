'use client'

import { motion } from 'framer-motion'
import { useI18n } from '@/lib/i18n'
import ProfileBasicsCard from '@/components/profile/ProfileBasicsCard'
import ProfileCompletenessBar, { computeCompleteness } from '@/components/profile/ProfileCompletenessBar'
import ProfileDnaSnapshot from '@/components/profile/ProfileDnaSnapshot'
import FavoriteMoviesCard from '@/components/profile/FavoriteMoviesCard'
import ProfileHeader from '@/components/profile/ProfileHeader'
import ProfilePreferencesCard from '@/components/profile/ProfilePreferencesCard'
import ProfileSequencingCard from '@/components/profile/ProfileSequencingCard'
import ProfileTicketCard from '@/components/profile/ProfileTicketCard'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useProfile } from './useProfile'
import styles from './page.module.css'

export default function ProfilePage() {
  const { t } = useI18n()
  const {
    profile,
    isLoading,
    dnaResult,
    isEditing,
    setIsEditing,
    editName,
    setEditName,
    isEditingBio,
    setIsEditingBio,
    editBio,
    setEditBio,
    saving,
    savingBio,
    isLoggingOut,
    showLogoutConfirm,
    setShowLogoutConfirm,
    showDeleteConfirm,
    setShowDeleteConfirm,
    isDeletingAccount,
    uploadingAvatar,
    avatarError,
    isPreviewMode,
    setIsPreviewMode,
    fileInputRef,
    topTags,
    getGenderLabel,
    getPrefLabel,
    getStatusLabel,
    handleAvatarUpload,
    handleSave,
    handleBioSave,
    handleLogout,
    handleDeleteAccount,
    handleFavoriteMoviesUpdate,
    setProfile,
  } = useProfile()

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
    <div className={`${styles.container} ${isPreviewMode ? styles.previewCanvas : ''}`}>
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
              <div className={styles.clearanceBadge}>
                <span className={styles.clearanceLabel}>{t('profile.clearanceLabel')}</span>
                <span className={styles.clearanceRank}>
                  {computeCompleteness(profile).rank}
                </span>
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

        {!isPreviewMode && (
          <section className={styles.completenessSection}>
            <ProfileCompletenessBar profile={profile} label={t('profile.completeness')} />
          </section>
        )}

        <section className={`${styles.section} ${styles.editorialBody}`}>
          <div className={styles.featureRail}>
            <div className={styles.editorialNote}>
              <span className={styles.noteLabel}>{t('profile.featuredNoteLabel')}</span>
              <p className={styles.noteText}>
                {profile.bio?.trim() || t('profile.bioEmptyDisplay')}
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
                bioEmptyDisplayLabel={t('profile.bioEmptyDisplay')}
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
                  matchThresholdLabel={t('profile.matchThreshold')}
                  matchThresholdHint={t('profile.matchThresholdHint')}
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
                  emptyLabel={t('profile.favoritesEmpty')}
                  searchLabel={t('profile.favoritesSearch')}
                  searchingLabel={t('profile.favoritesSearching')}
                  saveLabel={t('profile.save')}
                  cancelLabel={t('profile.cancel')}
                  editLabel={t('profile.edit')}
                  isPreview={isPreviewMode}
                  onUpdate={handleFavoriteMoviesUpdate}
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
