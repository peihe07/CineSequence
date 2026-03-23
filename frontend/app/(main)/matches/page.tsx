'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { useMatchStore } from '@/stores/matchStore'
import { api } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import TicketCard from '@/components/match/TicketCard'
import FlowGuard from '@/components/guards/FlowGuard'
import styles from './page.module.css'

interface MatchPrefs {
  match_gender_pref: string | null
  match_age_min: number | null
  match_age_max: number | null
  pure_taste_match: boolean
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
        aria-expanded={open}
        aria-controls="filter-panel"
      >
        <i className="ri-filter-3-line" aria-hidden="true" />
        {t('matches.filterLabel')}
        <i className={open ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'} aria-hidden="true" />
      </button>

      {open && (
        <motion.div
          id="filter-panel"
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
                aria-label={t('matches.minAge')}
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
                aria-label={t('matches.maxAge')}
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

/** Dot-based scroll indicator for the carousel */
function CarouselDots({ count, activeIndex }: { count: number; activeIndex: number }) {
  const { t } = useI18n()
  if (count <= 1) return null
  return (
    <div className={styles.carouselDots} role="tablist" aria-label={t('matches.ticketNav')}>
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          role="tab"
          aria-selected={i === activeIndex}
          aria-label={t('matches.ticketIndex', { index: i + 1 })}
          className={`${styles.dot} ${i === activeIndex ? styles.dotActive : ''}`}
        />
      ))}
    </div>
  )
}

function MatchesContent() {
  const searchParams = useSearchParams()
  const { t } = useI18n()
  const {
    matches, isLoading, isDiscovering, error,
    fetchMatches, discoverMatches, sendInvite, respondToInvite,
  } = useMatchStore()

  const [prefs, setPrefs] = useState<MatchPrefs>({
    match_gender_pref: null,
    match_age_min: null,
    match_age_max: null,
    pure_taste_match: false,
  })
  const [prefsError, setPrefsError] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  const carouselRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void fetchMatches()

    async function loadPrefs() {
      try {
        const p = await api<MatchPrefs & Record<string, unknown>>('/profile')
        setPrefs({
          match_gender_pref: p.match_gender_pref,
          match_age_min: p.match_age_min,
          match_age_max: p.match_age_max,
          pure_taste_match: p.pure_taste_match,
        })
        setPrefsError(null)
      } catch (err) {
        setPrefsError(err instanceof Error ? err.message : t('matches.prefLoadError'))
      }
    }

    void loadPrefs()
  }, [fetchMatches])

  const savePrefs = useCallback((updated: Partial<MatchPrefs>) => {
    const previous = prefs
    const next = { ...prefs, ...updated }
    setPrefs(next)
    setPrefsError(null)
    void api('/profile', {
      method: 'PATCH',
      body: JSON.stringify(updated),
    }).catch((err) => {
      setPrefs(previous)
      setPrefsError(err instanceof Error ? err.message : t('matches.prefSaveError'))
    })
  }, [prefs, t])

  const respondId = searchParams.get('respond')
  const matchId = searchParams.get('match')
  const highlightId = respondId || matchId

  // Auto-scroll to highlighted ticket
  useEffect(() => {
    if (!highlightId || isLoading || !carouselRef.current) return
    const idx = matches.findIndex((m) => m.id === highlightId)
    if (idx === -1) return

    const el = document.getElementById(`match-${highlightId}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    setActiveIndex(idx)
  }, [highlightId, isLoading, matches])

  // Track active index from scroll position
  const handleCarouselScroll = useCallback(() => {
    const carousel = carouselRef.current
    if (!carousel || matches.length === 0) return

    const scrollLeft = carousel.scrollLeft
    // Estimate which ticket is centered
    const ticketWidth = carousel.scrollWidth / matches.length
    const idx = Math.round(scrollLeft / ticketWidth)
    setActiveIndex(Math.min(idx, matches.length - 1))
  }, [matches.length])

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {/* ── HERO SECTION ────────────────────────────── */}
        <section className={`${styles.section} ${styles.heroSection}`}>
          <span className={styles.sideLabel}>FILE 03</span>
          <p className={styles.eyebrow}>[ MATCH_RESOLUTION ]</p>
          <div className={styles.header}>
            <h1 className={styles.title}>{t('matches.title')}</h1>
            <button
              className={styles.discoverBtn}
              onClick={discoverMatches}
              disabled={isDiscovering}
              aria-busy={isDiscovering}
            >
              <i className="ri-compass-discover-line" aria-hidden="true" />
              {isDiscovering ? t('matches.discovering') : t('matches.discover')}
            </button>
          </div>
          <p className={styles.deck}>
            {t('matches.deck')}
          </p>
          <p className={styles.heroMeta}>SYNC: OPEN CHANNEL // DISCOVERY: STANDBY</p>
        </section>

        {/* ── CONTROLS SECTION ────────────────────────── */}
        <section className={`${styles.section} ${styles.controlsSection}`}>
          {(prefsError || error) && (
            <p className={styles.errorText} role="alert">{prefsError || error}</p>
          )}
          <MatchFilter prefs={prefs} onChange={savePrefs} />
        </section>

        {/* ── DISCLAIMER SECTION ──────────────────────── */}
        <section className={styles.section}>
          <p className={styles.disclaimer}>{t('matches.disclaimer')}</p>
        </section>

        {/* ── RESULTS SECTION ─────────────────────────── */}
        <section className={`${styles.section} ${styles.resultsSection}`} aria-label={t('matches.results')}>
          {isLoading && (
            <div className={styles.loading} aria-live="polite" aria-label={t('matches.loading')}>
              <i className="ri-loader-4-line ri-spin ri-2x" aria-hidden="true" />
            </div>
          )}

          {!isLoading && matches.length === 0 && (
            <div className={styles.empty}>
              <i className="ri-group-line ri-3x" aria-hidden="true" />
              <p>{t('matches.empty')}</p>
              <p className={styles.emptyHint}>{t('matches.emptyHint')}</p>
              <button
                className={styles.discoverBtn}
                onClick={discoverMatches}
                disabled={isDiscovering}
                aria-busy={isDiscovering}
                style={{ marginTop: '0.5rem' }}
              >
                <i className="ri-compass-discover-line" aria-hidden="true" />
                {isDiscovering ? t('matches.discovering') : t('matches.discover')}
              </button>
            </div>
          )}

          {!isLoading && matches.length > 0 && (
            <>
              {/* Horizontal ticket carousel */}
              <div
                ref={carouselRef}
                className={styles.carousel}
                onScroll={handleCarouselScroll}
                role="region"
                aria-label={t('matches.carouselLabel')}
              >
                {matches.map((match, i) => (
                  <div
                    key={match.id}
                    className={`${styles.carouselItem} ${i === activeIndex ? styles.carouselItemActive : ''}`}
                  >
                    <TicketCard
                      match={match}
                      ticketNumber={i + 1}
                      onInvite={() => sendInvite(match.id)}
                      onRespond={(accept) => respondToInvite(match.id, accept)}
                      highlighted={match.id === highlightId}
                    />
                  </div>
                ))}
              </div>

              {/* Scroll indicator dots */}
              <CarouselDots count={matches.length} activeIndex={activeIndex} />
            </>
          )}
        </section>
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
            <i className="ri-loader-4-line ri-spin ri-2x" aria-hidden="true" />
          </div>
        </div>
      }>
        <MatchesContent />
      </Suspense>
    </FlowGuard>
  )
}
