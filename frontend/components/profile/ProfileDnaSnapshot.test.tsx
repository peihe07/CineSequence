import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { localeState } = vi.hoisted(() => ({
  localeState: {
    locale: 'en' as 'en' | 'zh',
  },
}))

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
}))

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    locale: localeState.locale,
    t: (key: string) => {
      const en: Record<string, string> = {
        'profile.snapshotAriaLabel': 'DNA snapshot',
        'profile.snapshotTitle': 'Preference Matrix',
        'profile.snapshotVerified': 'Verified',
        'profile.snapshotArchetype': 'Archetype',
        'profile.snapshotScanComplete': 'Scan complete',
        'profile.snapshotScanning': 'Scanning...',
        'profile.snapshotResolving': 'Resolving profile signature',
        'profile.snapshotPending': 'Pending sequence',
        'profile.snapshotReadiness': 'Sequence readiness',
        'profile.snapshotMatchScope': 'Match scope',
        'profile.snapshotCurationStrictness': 'Curation strictness',
      }
      const zh: Record<string, string> = {
        'profile.snapshotAriaLabel': 'DNA 快照',
        'profile.snapshotTitle': '偏好矩陣',
        'profile.snapshotVerified': '已驗證',
        'profile.snapshotArchetype': '原型',
        'profile.snapshotScanComplete': '掃描完成',
        'profile.snapshotScanning': '掃描中...',
        'profile.snapshotResolving': '正在解析你的觀影特徵',
        'profile.snapshotPending': '等待定序',
        'profile.snapshotReadiness': '定序完成度',
        'profile.snapshotMatchScope': '配對範圍',
        'profile.snapshotCurationStrictness': '篩選嚴格度',
      }
      return (localeState.locale === 'zh' ? zh : en)[key] ?? key
    },
  }),
}))

import ProfileDnaSnapshot from './ProfileDnaSnapshot'
import type { FavoriteMovie } from './types'

const profile = {
  id: '1',
  email: 'user@test.com',
  name: 'Test User',
  gender: 'other',
  region: 'TW',
  birth_year: 1995,
  bio: null,
  avatar_url: null,
  sequencing_status: 'completed',
  archetype_id: 'time-traveler',
  archetype_name: 'Time Traveler',
  personality_reading: 'A profile reading',
  ticket_style: 'classic',
  personal_ticket_url: null,
  match_gender_pref: 'any',
  match_age_min: 24,
  match_age_max: 36,
  pure_taste_match: true,
  match_threshold: 0.85,
  is_visible: true,
  email_notifications_enabled: true,
  is_admin: false,
  favorite_movies: [] as FavoriteMovie[],
} as const

describe('ProfileDnaSnapshot', () => {
  beforeEach(() => {
    localeState.locale = 'en'
  })

  afterEach(() => {
    cleanup()
  })

  it('renders english snapshot copy', () => {
    render(<ProfileDnaSnapshot profile={profile} />)

    expect(screen.getByRole('heading', { name: 'Preference Matrix' })).toBeTruthy()
    expect(screen.getByText('Verified')).toBeTruthy()
    expect(screen.getByText('Archetype')).toBeTruthy()
    expect(screen.getByText('Sequence readiness')).toBeTruthy()
  })

  it('renders chinese snapshot copy when locale changes', () => {
    localeState.locale = 'zh'

    render(<ProfileDnaSnapshot profile={profile} />)

    expect(screen.getByRole('heading', { name: '偏好矩陣' })).toBeTruthy()
    expect(screen.getByText('已驗證')).toBeTruthy()
    expect(screen.getByText('原型')).toBeTruthy()
    expect(screen.getByText('定序完成度')).toBeTruthy()
  })
})
