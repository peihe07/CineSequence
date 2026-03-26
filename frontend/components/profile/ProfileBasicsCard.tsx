'use client'

import Image from 'next/image'
import type { ChangeEvent, RefObject } from 'react'
import styles from '@/app/(main)/profile/page.module.css'
import type { Profile } from './types'

interface ProfileBasicsCardProps {
  profile: Profile
  nameLabel: string
  bioLabel: string
  bioPlaceholder: string
  addBioLabel: string
  emailLabel: string
  genderLabel: string
  birthYearLabel: string
  regionLabel: string
  saveLabel: string
  cancelLabel: string
  changeAvatarLabel: string
  avatarHintLabel: string
  avatarError: string | null
  sectionLabel: string
  isPreview?: boolean
  editNameLabel: string
  editBioLabel: string
  editName: string
  editBio: string
  isEditing: boolean
  isEditingBio: boolean
  saving: boolean
  savingBio: boolean
  uploadingAvatar: boolean
  fileInputRef: RefObject<HTMLInputElement | null>
  onAvatarUpload: (e: ChangeEvent<HTMLInputElement>) => Promise<void>
  onEditNameChange: (value: string) => void
  onEditBioChange: (value: string) => void
  onEditStart: () => void
  onEditCancel: () => void
  onSave: () => Promise<void>
  onBioEditStart: () => void
  onBioEditCancel: () => void
  onBioSave: () => Promise<void>
  getGenderLabel: (value: string) => string
}

export default function ProfileBasicsCard({
  profile,
  nameLabel,
  bioLabel,
  bioPlaceholder,
  addBioLabel,
  emailLabel,
  genderLabel,
  birthYearLabel,
  regionLabel,
  saveLabel,
  cancelLabel,
  changeAvatarLabel,
  avatarHintLabel,
  avatarError,
  sectionLabel,
  isPreview = false,
  editNameLabel,
  editBioLabel,
  editName,
  editBio,
  isEditing,
  isEditingBio,
  saving,
  savingBio,
  uploadingAvatar,
  fileInputRef,
  onAvatarUpload,
  onEditNameChange,
  onEditBioChange,
  onEditStart,
  onEditCancel,
  onSave,
  onBioEditStart,
  onBioEditCancel,
  onBioSave,
  getGenderLabel,
}: ProfileBasicsCardProps) {
  return (
    <div className={styles.card}>
      <div className={styles.basicsHero}>
        <div className={styles.avatarSection}>
          <button
            className={styles.avatarBtn}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingAvatar || isPreview}
            aria-label={changeAvatarLabel}
          >
            {profile.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt=""
                fill
                sizes="80px"
                className={styles.avatarImg}
              />
            ) : (
              <i className="ri-user-line" />
            )}
            <span className={styles.avatarOverlay}>
              {uploadingAvatar ? (
                <i className="ri-loader-4-line ri-spin" />
              ) : (
                <i className="ri-camera-line" />
              )}
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onAvatarUpload}
            className={styles.fileInput}
          />
          <p className={styles.avatarHint}>{avatarHintLabel}</p>
          {avatarError && <p className={styles.avatarError}>{avatarError}</p>}
        </div>

        <div className={styles.identityBlock}>
          <span className={styles.sectionTitle}>{sectionLabel}</span>
          <div className={styles.field}>
            <span className={styles.label}>{nameLabel}</span>
            {isEditing ? (
              <div className={styles.editRow}>
                <input
                  className={styles.editInput}
                  value={editName}
                  onChange={(e) => onEditNameChange(e.target.value)}
                  maxLength={50}
                />
                <button className={styles.saveBtn} onClick={onSave} disabled={saving}>
                  {saving ? '...' : saveLabel}
                </button>
                <button className={styles.cancelBtn} onClick={onEditCancel}>
                  {cancelLabel}
                </button>
              </div>
            ) : (
              <div className={styles.valueRow}>
                <span className={styles.identityName}>{profile.name}</span>
                {!isPreview && (
                  <button className={styles.editBtn} onClick={onEditStart} aria-label={editNameLabel}>
                    <i className="ri-pencil-line" />
                  </button>
                )}
              </div>
            )}
          </div>

          <div className={styles.field}>
            <span className={styles.label}>{emailLabel}</span>
            <span className={styles.identityContact}>{profile.email}</span>
          </div>
        </div>
      </div>

      <div className={styles.quickFacts}>
        <div className={styles.factCard}>
          <span className={styles.label}>{genderLabel}</span>
          <span className={styles.factMetric}>{getGenderLabel(profile.gender)}</span>
        </div>
        {profile.birth_year && (
          <div className={styles.factCard}>
            <span className={styles.label}>{birthYearLabel}</span>
            <span className={styles.factMetric}>{profile.birth_year}</span>
          </div>
        )}
        <div className={styles.factCard}>
          <span className={styles.label}>{regionLabel}</span>
          <span className={styles.factMetric}>{profile.region}</span>
        </div>
      </div>

      <div className={styles.field}>
        <span className={styles.label}>{bioLabel}</span>
        {isEditingBio ? (
          <div className={styles.bioEditStack}>
            <textarea
              className={styles.editTextarea}
              value={editBio}
              onChange={(e) => onEditBioChange(e.target.value)}
              maxLength={280}
              rows={4}
              placeholder={bioPlaceholder}
            />
            <div className={styles.editRow}>
              <button className={styles.saveBtn} onClick={onBioSave} disabled={savingBio}>
                {savingBio ? '...' : saveLabel}
              </button>
              <button className={styles.cancelBtn} onClick={onBioEditCancel}>
                {cancelLabel}
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.bioDisplay}>
            <p className={styles.bioText}>
              {profile.bio?.trim() ? profile.bio : addBioLabel}
            </p>
            {!isPreview && (
              <button className={styles.editBtn} onClick={onBioEditStart} aria-label={editBioLabel}>
                <i className="ri-pencil-line" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
