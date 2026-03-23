'use client'

import type { ChangeEvent, RefObject } from 'react'
import styles from '@/app/(main)/profile/page.module.css'
import type { Profile } from './types'

interface ProfileBasicsCardProps {
  profile: Profile
  nameLabel: string
  emailLabel: string
  genderLabel: string
  birthYearLabel: string
  regionLabel: string
  saveLabel: string
  cancelLabel: string
  changeAvatarLabel: string
  editNameLabel: string
  editName: string
  isEditing: boolean
  saving: boolean
  uploadingAvatar: boolean
  fileInputRef: RefObject<HTMLInputElement | null>
  onAvatarUpload: (e: ChangeEvent<HTMLInputElement>) => Promise<void>
  onEditNameChange: (value: string) => void
  onEditStart: () => void
  onEditCancel: () => void
  onSave: () => Promise<void>
  getGenderLabel: (value: string) => string
}

export default function ProfileBasicsCard({
  profile,
  nameLabel,
  emailLabel,
  genderLabel,
  birthYearLabel,
  regionLabel,
  saveLabel,
  cancelLabel,
  changeAvatarLabel,
  editNameLabel,
  editName,
  isEditing,
  saving,
  uploadingAvatar,
  fileInputRef,
  onAvatarUpload,
  onEditNameChange,
  onEditStart,
  onEditCancel,
  onSave,
  getGenderLabel,
}: ProfileBasicsCardProps) {
  return (
    <div className={styles.card}>
      <div className={styles.avatarSection}>
        <button
          className={styles.avatarBtn}
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingAvatar}
          aria-label={changeAvatarLabel}
        >
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" className={styles.avatarImg} />
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
      </div>

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
            <span className={styles.value}>{profile.name}</span>
            <button className={styles.editBtn} onClick={onEditStart} aria-label={editNameLabel}>
              <i className="ri-pencil-line" />
            </button>
          </div>
        )}
      </div>

      <div className={styles.field}>
        <span className={styles.label}>{emailLabel}</span>
        <span className={styles.value}>{profile.email}</span>
      </div>

      <div className={styles.field}>
        <span className={styles.label}>{genderLabel}</span>
        <span className={styles.value}>{getGenderLabel(profile.gender)}</span>
      </div>

      {profile.birth_year && (
        <div className={styles.field}>
          <span className={styles.label}>{birthYearLabel}</span>
          <span className={styles.value}>{profile.birth_year}</span>
        </div>
      )}

      <div className={styles.field}>
        <span className={styles.label}>{regionLabel}</span>
        <span className={styles.value}>{profile.region}</span>
      </div>
    </div>
  )
}
