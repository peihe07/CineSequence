import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { localeState, dnaState } = vi.hoisted(() => ({
  localeState: {
    locale: 'zh' as 'zh' | 'en',
  },
  dnaState: {
    mirrorCharacters: [
      {
        id: 'chihiro_spirited_away',
        name: 'Chihiro',
        movie: 'Spirited Away',
        movie_zh: '神隱少女',
        tmdb_id: 129,
        score: 0.91,
        psych_labels: [],
        psych_framework: 'individuation',
        one_liner: "I remember you. You're the one who came looking for Yubaba.",
        mirror_reading: '你對未知的靠近方式，帶著一種被迫成熟後留下的敏銳。',
      },
    ],
    isMirrorLoading: false,
    mirrorError: null as string | null,
    fetchMirror: vi.fn(),
  },
}))

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    locale: localeState.locale,
    t: (key: string) => {
      const zh: Record<string, string> = {
        'dna.mirrorLabel': '[ 角色鏡像 ]',
        'dna.mirrorDeck': '與你產生共振的角色檔案。',
        'dna.mirrorLoading': '載入中',
        'dna.mirrorError': '錯誤',
        'dna.mirrorFramework': '心理框架',
        'dna.mirrorScore': '共振分數',
      }
      const en: Record<string, string> = {
        'dna.mirrorLabel': '[ CHARACTER MIRROR ]',
        'dna.mirrorDeck': 'Resonant character files.',
        'dna.mirrorLoading': 'Loading',
        'dna.mirrorError': 'Error',
        'dna.mirrorFramework': 'Framework',
        'dna.mirrorScore': 'Score',
      }
      return (localeState.locale === 'zh' ? zh : en)[key] ?? key
    },
  }),
}))

vi.mock('@/stores/dnaStore', () => ({
  useDnaStore: () => dnaState,
}))

import CharacterMirror from './CharacterMirror'

describe('CharacterMirror', () => {
  beforeEach(() => {
    localeState.locale = 'zh'
  })

  it('prefers chinese movie title and zh framework label in chinese locale', () => {
    render(<CharacterMirror />)

    expect(screen.getByText('神隱少女')).toBeTruthy()
    expect(screen.getByText('自性化歷程')).toBeTruthy()
    expect(
      screen.queryByText("I remember you. You're the one who came looking for Yubaba."),
    ).toBeNull()
  })

  it('shows original movie title and quote in english locale', () => {
    localeState.locale = 'en'

    render(<CharacterMirror />)

    expect(screen.getByText('Spirited Away')).toBeTruthy()
    expect(screen.getByText('Individuation')).toBeTruthy()
    expect(
      screen.getByText("“I remember you. You're the one who came looking for Yubaba.”"),
    ).toBeTruthy()
  })
})
