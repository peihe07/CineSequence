'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ApiError, api, apiUpload } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import type { FavoriteMovie, Profile } from '@/components/profile/types'
import { useDnaStore } from '@/stores/dnaStore'
import { useAuthStore } from '@/stores/authStore'

export function useProfile() {
  const { t } = useI18n()
  const router = useRouter()
  const logout = useAuthStore((state) => state.logout)
  const dnaResult = useDnaStore((state) => state.result)
  const fetchDna = useDnaStore((state) => state.fetchResult)

  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [isEditingBio, setIsEditingBio] = useState(false)
  const [editBio, setEditBio] = useState('')
  const [saving, setSaving] = useState(false)
  const [savingBio, setSavingBio] = useState(false)
  const [isEditingRegion, setIsEditingRegion] = useState(false)
  const [editRegion, setEditRegion] = useState('')
  const [savingRegion, setSavingRegion] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const topTags = dnaResult
    ? Object.entries(dnaResult.tag_labels ?? {})
        .sort(([, a], [, b]) => b - a)
        .slice(0, 8)
        .filter(([, v]) => v >= 0.3)
        .map(([k]) => k)
    : []

  const getGenderLabel = useCallback((value: string): string => {
    const map: Record<string, string> = {
      male: t('profile.genderMale'),
      female: t('profile.genderFemale'),
      other: t('profile.genderOther'),
      prefer_not_to_say: t('profile.genderSkip'),
    }
    return map[value] ?? value
  }, [t])

  const getPrefLabel = useCallback((value: string): string => {
    const map: Record<string, string> = {
      male: t('profile.genderMale'),
      female: t('profile.genderFemale'),
      other: t('profile.genderOther'),
      any: t('profile.prefAny'),
    }
    return map[value] ?? value
  }, [t])

  const getStatusLabel = useCallback((value: string): string => {
    const map: Record<string, string> = {
      not_started: t('profile.notStarted'),
      in_progress: t('profile.inProgress'),
      completed: t('profile.completed'),
    }
    return map[value] ?? value
  }, [t])

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

  const handleSave = useCallback(async () => {
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
  }, [editName, profile?.name])

  const handleBioSave = useCallback(async () => {
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
  }, [editBio, profile?.bio])

  const handleRegionSave = useCallback(async () => {
    if (editRegion === profile?.region) {
      setIsEditingRegion(false)
      return
    }

    setSavingRegion(true)
    try {
      const updated = await api<Profile>('/profile', {
        method: 'PATCH',
        body: JSON.stringify({ region: editRegion }),
      })
      setProfile(updated)
      setIsEditingRegion(false)
    } finally {
      setSavingRegion(false)
    }
  }, [editRegion, profile?.region])

  const handleLogout = useCallback(async () => {
    setShowLogoutConfirm(false)
    setIsLoggingOut(true)
    try {
      await logout()
      router.replace('/')
    } finally {
      setIsLoggingOut(false)
    }
  }, [logout, router])

  const handleDeleteAccount = useCallback(async () => {
    setShowDeleteConfirm(false)
    setIsDeletingAccount(true)
    try {
      await api('/profile', { method: 'DELETE' })
      await logout()
      router.replace('/login')
    } finally {
      setIsDeletingAccount(false)
    }
  }, [logout, router])

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
        setEditRegion(data.region)
        if (data.sequencing_status === 'completed') {
          fetchDna().catch(() => {})
        }
      })
      .catch(async (error) => {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          await logout()
          router.replace('/login')
        }
      })
      .finally(() => setIsLoading(false))
  }, [fetchDna, logout, router])

  const handleFavoriteMoviesUpdate = useCallback((movies: FavoriteMovie[]) => {
    if (!profile) return
    setProfile({ ...profile, favorite_movies: movies })
  }, [profile])

  return {
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
    isEditingRegion,
    setIsEditingRegion,
    editRegion,
    setEditRegion,
    savingRegion,
    handleRegionSave,
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
  }
}
