'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { useMatchStore, MatchItem } from '@/stores/matchStore'
import { api } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import TearRitual from '@/components/match/TearRitual'
import FlowGuard from '@/components/guards/FlowGuard'
import styles from './page.module.css'

interface MatchPrefs {
  match_gender_pref: string | null
  match_age_min: number | null
  match_age_max: number | null
  pure_taste_match: boolean
}

const TAG_ZH: Record<string, string> = {
  twist: '反轉結局', mindfuck: '燒腦', slowburn: '慢熱', ensemble: '群戲',
  solo: '獨角戲', visualFeast: '視覺饗宴', dialogue: '對白精彩', tearjerker: '催淚',
  darkTone: '黑暗', uplifting: '正能量', philosophical: '哲學思辨', satirical: '社會諷刺',
  nostalgic: '懷舊', experimental: '實驗性', cult: '邪典', comingOfAge: '成長故事',
  revenge: '復仇', heist: '精密計畫', survival: '生存掙扎', timeTravel: '時空穿越',
  dystopia: '反烏托邦', trueStory: '真實事件', nonEnglish: '非英語',
  existential: '存在主義', antiHero: '反英雄', romanticCore: '浪漫內核',
  violentAesthetic: '暴力美學', socialCritique: '社會批判', psychoThriller: '心理驚悚',
  absurdist: '荒誕',
}

const TAG_EN: Record<string, string> = {
  twist: 'Plot twist', mindfuck: 'Mind-bending', slowburn: 'Slow burn', ensemble: 'Ensemble',
  solo: 'Solo act', visualFeast: 'Visual feast', dialogue: 'Sharp dialogue', tearjerker: 'Tearjerker',
  darkTone: 'Dark', uplifting: 'Uplifting', philosophical: 'Philosophical', satirical: 'Satirical',
  nostalgic: 'Nostalgic', experimental: 'Experimental', cult: 'Cult', comingOfAge: 'Coming of age',
  revenge: 'Revenge', heist: 'Heist', survival: 'Survival', timeTravel: 'Time travel',
  dystopia: 'Dystopia', trueStory: 'True story', nonEnglish: 'Non-English',
  existential: 'Existential', antiHero: 'Anti-hero', romanticCore: 'Romantic',
  violentAesthetic: 'Violent aesthetic', socialCritique: 'Social critique', psychoThriller: 'Psychological',
  absurdist: 'Absurdist',
}

function MatchCard({ match, onInvite, onRespond, highlighted }: {
  match: MatchItem
  onInvite: () => void
  onRespond: (accept: boolean) => void
  highlighted?: boolean
}) {
  const { t, locale } = useI18n()
  const pct = Math.round(match.similarity_score * 100)
  const tagMap = locale === 'zh' ? TAG_ZH : TAG_EN

  return (
    <motion.div
      id={`match-${match.id}`}
      className={`${styles.card} ${highlighted ? styles.highlighted : ''}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className={styles.cardHeader}>
        <div className={styles.partnerInfo}>
          <span className={styles.partnerName}>{match.partner_name}</span>
          <span className={styles.similarity}>{pct}% match</span>
        </div>
        <span className={`${styles.status} ${styles[match.status]}`}>
          {match.status}
        </span>
      </div>

      {match.shared_tags.length > 0 && (
        <div className={styles.tags}>
          {match.shared_tags.slice(0, 5).map((tag) => (
            <span key={tag} className={styles.tag}>
              {tagMap[tag] || tag}
            </span>
          ))}
        </div>
      )}

      {match.ice_breakers.length > 0 && (
        <div className={styles.iceBreaker}>
          <i className="ri-chat-smile-2-line" />
          <span>{match.ice_breakers[0]}</span>
        </div>
      )}

      <div className={styles.cardActions}>
        {match.status === 'discovered' && (
          <button className={styles.inviteBtn} onClick={onInvite}>
            <i className="ri-mail-send-line" /> {t('matches.invite')}
          </button>
        )}
        {match.status === 'invited' && (
          <div className={styles.respondBtns}>
            <button className={styles.acceptBtn} onClick={() => onRespond(true)}>
              <i className="ri-check-line" /> {t('matches.accept')}
            </button>
            <button className={styles.declineBtn} onClick={() => onRespond(false)}>
              <i className="ri-close-line" /> {t('matches.decline')}
            </button>
          </div>
        )}
        {match.status === 'accepted' && (
          <div className={styles.acceptedSection}>
            <TearRitual
              ticketImageUrl={match.ticket_image_url}
              partnerName={match.partner_name}
              similarityScore={match.similarity_score}
            />
          </div>
        )}
      </div>
    </motion.div>
  )
}

function MatchFilter({ prefs, onChange }: {
  prefs: MatchPrefs
  onChange: (updated: Partial<MatchPrefs>) => void
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)

  const GENDER_OPTIONS = [
    { value: '', label: t('matches.prefAny') },
    { value: 'female', label: t('matches.prefFemale') },
    { value: 'male', label: t('matches.prefMale') },
    { value: 'other', label: t('matches.prefOther') },
  ]

  return (
    <div className={styles.filterBar}>
      <button
        className={styles.filterToggle}
        onClick={() => setOpen(!open)}
      >
        <i className="ri-filter-3-line" />
        {t('matches.filterLabel')}
        <i className={open ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'} />
      </button>

      {open && (
        <motion.div
          className={styles.filterPanel}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: 0.2 }}
        >
          <div className={styles.filterRow}>
            <span className={styles.filterLabel}>{t('matches.prefGender')}</span>
            <div className={styles.filterOptions}>
              {GENDER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`${styles.filterOption} ${
                    (prefs.match_gender_pref || '') === opt.value ? styles.filterActive : ''
                  }`}
                  onClick={() => onChange({ match_gender_pref: opt.value || null })}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.filterRow}>
            <span className={styles.filterLabel}>{t('matches.prefAge')}</span>
            <div className={styles.ageInputs}>
              <input
                type="number"
                className={styles.ageInput}
                placeholder="18"
                value={prefs.match_age_min ?? ''}
                onChange={(e) => onChange({
                  match_age_min: e.target.value ? Number(e.target.value) : null,
                })}
                min={18}
                max={99}
              />
              <span className={styles.ageDash}>—</span>
              <input
                type="number"
                className={styles.ageInput}
                placeholder="99"
                value={prefs.match_age_max ?? ''}
                onChange={(e) => onChange({
                  match_age_max: e.target.value ? Number(e.target.value) : null,
                })}
                min={18}
                max={99}
              />
            </div>
          </div>

          <label className={styles.filterCheck}>
            <input
              type="checkbox"
              checked={prefs.pure_taste_match}
              onChange={(e) => onChange({ pure_taste_match: e.target.checked })}
            />
            <span>{t('matches.pureTaste')}</span>
          </label>
          <p className={styles.filterHint}>{t('matches.pureTasteHint')}</p>
        </motion.div>
      )}
    </div>
  )
}

function MatchesContent() {
  const searchParams = useSearchParams()
  const { t } = useI18n()
  const {
    matches, isLoading, isDiscovering,
    fetchMatches, discoverMatches, sendInvite, respondToInvite,
  } = useMatchStore()

  const [prefs, setPrefs] = useState<MatchPrefs>({
    match_gender_pref: null,
    match_age_min: null,
    match_age_max: null,
    pure_taste_match: false,
  })

  useEffect(() => {
    fetchMatches()
    // Load current preferences from profile
    api<MatchPrefs & Record<string, unknown>>('/profile').then((p) => {
      setPrefs({
        match_gender_pref: p.match_gender_pref,
        match_age_min: p.match_age_min,
        match_age_max: p.match_age_max,
        pure_taste_match: p.pure_taste_match,
      })
    })
  }, [fetchMatches])

  const savePrefs = useCallback((updated: Partial<MatchPrefs>) => {
    const next = { ...prefs, ...updated }
    setPrefs(next)
    // Persist to profile (fire-and-forget)
    api('/profile', {
      method: 'PATCH',
      body: JSON.stringify(updated),
    })
  }, [prefs])

  const respondId = searchParams.get('respond')
  const matchId = searchParams.get('match')
  const highlightId = respondId || matchId

  useEffect(() => {
    if (highlightId && !isLoading) {
      const el = document.getElementById(`match-${highlightId}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [highlightId, isLoading])

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.header}>
          <h1 className={styles.title}>{t('matches.title')}</h1>
          <button
            className={styles.discoverBtn}
            onClick={discoverMatches}
            disabled={isDiscovering}
          >
            <i className="ri-compass-discover-line" />
            {isDiscovering ? t('matches.discovering') : t('matches.discover')}
          </button>
        </div>

        <MatchFilter prefs={prefs} onChange={savePrefs} />

        {isLoading && (
          <div className={styles.loading}>
            <i className="ri-loader-4-line ri-spin ri-2x" />
          </div>
        )}

        {!isLoading && matches.length === 0 && (
          <div className={styles.empty}>
            <i className="ri-group-line ri-3x" />
            <p>{t('matches.empty')}</p>
            <p className={styles.emptyHint}>{t('matches.emptyHint')}</p>
          </div>
        )}

        <div className={styles.grid}>
          {matches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              onInvite={() => sendInvite(match.id)}
              onRespond={(accept) => respondToInvite(match.id, accept)}
              highlighted={match.id === highlightId}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function MatchesPage() {
  return (
    <FlowGuard require="dna">
      <Suspense fallback={
        <div className={styles.container}>
          <div className={styles.loading}>
            <i className="ri-loader-4-line ri-spin ri-2x" />
          </div>
        </div>
      }>
        <MatchesContent />
      </Suspense>
    </FlowGuard>
  )
}
