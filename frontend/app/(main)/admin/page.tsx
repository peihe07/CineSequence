'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import MiniChart from './charts/MiniChart'
import DonutChart from './charts/DonutChart'
import StackedBar from './charts/StackedBar'
import BroadcastManager from './BroadcastManager'
import styles from './page.module.css'

interface Stats {
  users: {
    total: number
    today: number
    this_week: number
    sequencing_breakdown: Record<string, number>
  }
  dna: {
    total_active: number
    archetype_distribution: Record<string, number>
  }
  matches: {
    total: number
    status_breakdown: Record<string, number>
    invite_rate: number
    accept_rate: number
  }
  funnel: {
    registered: number
    completed_sequencing: number
    has_dna: number
    has_match: number
  }
  trends: {
    users: number | null
    dna: number | null
    matches: number | null
  }
}

interface DailyStats {
  days: number
  registrations: { date: string; count: number }[]
  dna_builds: { date: string; count: number }[]
  matches: { date: string; count: number }[]
}

interface TokenByType {
  calls: number
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  estimated_cost_usd: number
}

interface ApiUsage {
  gemini: {
    personality_readings: number
    ice_breakers: number
    ai_pairs: number
    estimated_total: number
    token_usage: Record<string, TokenByType>
    total_prompt_tokens: number
    total_completion_tokens: number
    total_tokens: number
    estimated_total_cost_usd: number
  }
  tmdb: { estimated_queries: number }
  resend: { invite_emails: number; invite_reminder_emails: number; accepted_emails: number; estimated_total: number }
}

interface WaitlistEntry {
  email: string
  source: string
  created_at: string
}

interface WaitlistData {
  total: number
  entries: WaitlistEntry[]
}

function StatCard({ value, label, trend, icon }: { value: number | string; label: string; trend?: number | null; icon?: string }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statTop}>
        {icon && <i className={`${icon} ${styles.statIcon}`} />}
        <span className={styles.statValue}>{value}</span>
      </div>
      <span className={styles.statLabel}>{label}</span>
      {trend !== undefined && trend !== null && (
        <span className={`${styles.trend} ${trend > 0 ? styles.trendUp : trend < 0 ? styles.trendDown : ''}`}>
          {trend > 0 ? <i className="ri-arrow-up-s-line" /> : trend < 0 ? <i className="ri-arrow-down-s-line" /> : '—'}
          {trend !== 0 ? `${Math.abs(trend)}%` : ''}
        </span>
      )}
    </div>
  )
}

function FunnelBar({ count, max, label, rate }: { count: number; max: number; label: string; rate?: number }) {
  const pct = max > 0 ? (count / max) * 100 : 0
  const displayWidth = count === 0 ? 0 : Math.max(pct, 8)
  return (
    <div className={styles.funnelRow}>
      <span className={styles.funnelLabel}>{label}</span>
      <div className={styles.funnelTrack}>
        <div
          className={styles.funnelBar}
          style={{ width: `${displayWidth}%` }}
        />
        <span className={styles.funnelCount}>
          {count}{rate !== undefined ? ` (${(rate * 100).toFixed(0)}%)` : ''}
        </span>
      </div>
    </div>
  )
}

function CollapsibleSection({ title, icon, children, defaultOpen = true }: {
  title: string
  icon: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={styles.section}>
      <button type="button" className={styles.sectionToggle} onClick={() => setOpen((v) => !v)}>
        <div className={styles.sectionTitleRow}>
          <i className={`${icon} ${styles.sectionIcon}`} />
          <h2 className={styles.sectionTitle}>{title}</h2>
        </div>
        <i className={`ri-arrow-${open ? 'up' : 'down'}-s-line ${styles.sectionChevron}`} />
      </button>
      {open && <div className={styles.sectionBody}>{children}</div>}
    </div>
  )
}

export default function AdminPage() {
  const { t } = useI18n()
  const [stats, setStats] = useState<Stats | null>(null)
  const [daily, setDaily] = useState<DailyStats | null>(null)
  const [apiUsage, setApiUsage] = useState<ApiUsage | null>(null)
  const [waitlist, setWaitlist] = useState<WaitlistData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)
  const initialLoadDone = useRef(false)

  useEffect(() => {
    async function load() {
      try {
        const [s, d, a, w] = await Promise.all([
          api<Stats>('/admin/stats'),
          api<DailyStats>(`/admin/stats/daily?days=${days}`),
          api<ApiUsage>('/admin/api-usage'),
          api<WaitlistData>('/admin/waitlist'),
        ])
        setStats(s)
        setDaily(d)
        setApiUsage(a)
        setWaitlist(w)
        initialLoadDone.current = true
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to load'
        setError(msg)
      } finally {
        setLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchDaily = useCallback(async (d: number) => {
    try {
      const result = await api<DailyStats>(`/admin/stats/daily?days=${d}`)
      setDaily(result)
    } catch {
      // keep existing daily data on error
    }
  }, [])

  const handleDaysChange = (d: number) => {
    setDays(d)
    if (initialLoadDone.current) fetchDaily(d)
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <i className="ri-loader-4-line ri-spin ri-2x" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.forbidden}>
          <i className="ri-lock-line ri-3x" />
          <p>{error}</p>
        </div>
      </div>
    )
  }

  if (!stats || !daily || !apiUsage || !waitlist) return null

  const funnelMax = stats.funnel.registered || 1
  const { registered, completed_sequencing, has_dna, has_match } = stats.funnel
  const funnelRates = {
    toSequencing: registered > 0 ? completed_sequencing / registered : 0,
    toDna: completed_sequencing > 0 ? has_dna / completed_sequencing : 0,
    toMatch: has_dna > 0 ? has_match / has_dna : 0,
  }
  const waitlistDateFormatter = new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.pageHeader}>
          <h1 className={styles.title}>{t('admin.title')}</h1>
          <span className={styles.headerMeta}>ADMIN_CONSOLE // LIVE</span>
        </div>

        {/* ── 1. Broadcast — top priority ── */}
        <div className={styles.section}>
          <BroadcastManager />
        </div>

        {/* ── 2. Key metrics at a glance ── */}
        <div className={styles.grid}>
          <StatCard value={stats.users.total} label={t('admin.totalUsers')} icon="ri-user-line" />
          <StatCard value={stats.users.today} label={t('admin.today')} icon="ri-calendar-event-line" />
          <StatCard value={stats.users.this_week} label={t('admin.thisWeek')} trend={stats.trends.users} icon="ri-line-chart-line" />
          <StatCard value={stats.dna.total_active} label={t('admin.dnaProfiles')} trend={stats.trends.dna} icon="ri-dna-line" />
          <StatCard value={stats.matches.total} label={t('admin.totalMatches')} trend={stats.trends.matches} icon="ri-link" />
          <StatCard value={`${(stats.matches.accept_rate * 100).toFixed(0)}%`} label={t('admin.acceptRate')} icon="ri-check-double-line" />
        </div>

        {/* ── 3. Funnel ── */}
        <CollapsibleSection title={t('admin.userFunnel')} icon="ri-filter-3-line">
          <div className={styles.funnel}>
            <FunnelBar count={registered} max={funnelMax} label={t('admin.registered')} />
            <FunnelBar count={completed_sequencing} max={funnelMax} label={t('admin.completedSequencing')} rate={funnelRates.toSequencing} />
            <FunnelBar count={has_dna} max={funnelMax} label={t('admin.hasDna')} rate={funnelRates.toDna} />
            <FunnelBar count={has_match} max={funnelMax} label={t('admin.hasMatch')} rate={funnelRates.toMatch} />
          </div>
        </CollapsibleSection>

        {/* ── 4. Daily trends ── */}
        <CollapsibleSection title={t('admin.dailyRegistrations')} icon="ri-bar-chart-2-line">
          <div className={styles.rangeRow}>
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                className={`${styles.rangeBtn} ${days === d ? styles.rangeBtnActive : ''}`}
                onClick={() => handleDaysChange(d)}
              >
                {d}{t('admin.daysSuffix')}
              </button>
            ))}
          </div>

          <div className={styles.chartGroup}>
            <div className={styles.chartPanel}>
              <span className={styles.chartLabel}>{t('admin.dailyRegistrations')}</span>
              {daily.registrations.length > 0 ? (
                <MiniChart data={daily.registrations} color="teal" />
              ) : (
                <p className={styles.noData}>{t('admin.noData')}</p>
              )}
            </div>
            <div className={styles.chartPanel}>
              <span className={styles.chartLabel}>{t('admin.dailyDnaBuilds')}</span>
              {daily.dna_builds.length > 0 ? (
                <MiniChart data={daily.dna_builds} color="blue" />
              ) : (
                <p className={styles.noData}>{t('admin.noData')}</p>
              )}
            </div>
          </div>
        </CollapsibleSection>

        {/* ── 5. Distribution charts ── */}
        <CollapsibleSection title={t('admin.matchStatus')} icon="ri-pie-chart-2-line">
          <div className={styles.distributionRow}>
            <div className={styles.distributionPanel}>
              <span className={styles.chartLabel}>{t('admin.matchStatus')}</span>
              <StackedBar data={stats.matches.status_breakdown} />
            </div>
            {Object.keys(stats.dna.archetype_distribution).length > 0 && (
              <div className={styles.distributionPanel}>
                <span className={styles.chartLabel}>{t('admin.archetypeDistribution')}</span>
                <DonutChart data={stats.dna.archetype_distribution} />
              </div>
            )}
          </div>
        </CollapsibleSection>

        {/* ── 6. Waitlist ── */}
        <CollapsibleSection title={t('admin.waitlist')} icon="ri-mail-line" defaultOpen={false}>
          <div className={styles.waitlistHeader}>
            <div className={styles.waitlistTotal}>
              <span>{t('admin.waitlistTotal')}</span>
              <strong>{waitlist.total.toLocaleString()}</strong>
            </div>
          </div>
          {waitlist.entries.length > 0 ? (
            <div className={styles.waitlistTable} role="table" aria-label={t('admin.waitlist')}>
              <div className={`${styles.waitlistRow} ${styles.waitlistHead}`} role="row">
                <span role="columnheader">{t('admin.waitlistEmail')}</span>
                <span role="columnheader">{t('admin.waitlistSource')}</span>
                <span role="columnheader">{t('admin.waitlistCreatedAt')}</span>
              </div>
              {waitlist.entries.map((entry) => (
                <div key={`${entry.email}-${entry.created_at}`} className={styles.waitlistRow} role="row">
                  <span className={styles.waitlistEmail} role="cell">{entry.email}</span>
                  <span role="cell">{entry.source}</span>
                  <span role="cell">{waitlistDateFormatter.format(new Date(entry.created_at))}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.noData}>{t('admin.waitlistEmpty')}</p>
          )}
        </CollapsibleSection>

        {/* ── 7. API usage ── */}
        <CollapsibleSection title={t('admin.estimatedApiUsage')} icon="ri-cloud-line" defaultOpen={false}>
          <div className={styles.apiGrid}>
            <div className={styles.apiCard}>
              <span className={styles.apiCardTitle}>Gemini</span>
              <div className={styles.apiRow}>
                <span>{t('admin.personalityReadings')}</span>
                <span>{apiUsage.gemini.personality_readings}</span>
              </div>
              <div className={styles.apiRow}>
                <span>{t('admin.iceBreakers')}</span>
                <span>{apiUsage.gemini.ice_breakers}</span>
              </div>
              <div className={styles.apiRow}>
                <span>{t('admin.aiPairs')}</span>
                <span>{apiUsage.gemini.ai_pairs}</span>
              </div>
              <div className={`${styles.apiRow} ${styles.apiTotal}`}>
                <span>{t('admin.total')}</span>
                <span>{apiUsage.gemini.estimated_total}</span>
              </div>
            </div>

            <div className={styles.apiCard}>
              <span className={styles.apiCardTitle}>TMDB</span>
              <div className={styles.apiRow}>
                <span>{t('admin.queries')}</span>
                <span>{apiUsage.tmdb.estimated_queries}</span>
              </div>
            </div>

            <div className={styles.apiCard}>
              <span className={styles.apiCardTitle}>Resend</span>
              <div className={styles.apiRow}>
                <span>{t('admin.inviteEmails')}</span>
                <span>{apiUsage.resend.invite_emails}</span>
              </div>
              <div className={styles.apiRow}>
                <span>{t('admin.inviteReminderEmails')}</span>
                <span>{apiUsage.resend.invite_reminder_emails}</span>
              </div>
              <div className={styles.apiRow}>
                <span>{t('admin.acceptedEmails')}</span>
                <span>{apiUsage.resend.accepted_emails}</span>
              </div>
              <div className={`${styles.apiRow} ${styles.apiTotal}`}>
                <span>{t('admin.total')}</span>
                <span>{apiUsage.resend.estimated_total}</span>
              </div>
            </div>
          </div>
        </CollapsibleSection>

        {/* ── 8. Token usage ── */}
        <CollapsibleSection title={t('admin.tokenUsage')} icon="ri-coin-line" defaultOpen={false}>
          <div className={styles.apiGrid}>
            {Object.entries(apiUsage.gemini.token_usage).map(([type, data]) => (
              <div key={type} className={styles.apiCard}>
                <span className={styles.apiCardTitle}>{type}</span>
                <div className={styles.apiRow}>
                  <span>{t('admin.calls')}</span>
                  <span>{data.calls}</span>
                </div>
                <div className={styles.apiRow}>
                  <span>{t('admin.promptTokens')}</span>
                  <span>{data.prompt_tokens.toLocaleString()}</span>
                </div>
                <div className={styles.apiRow}>
                  <span>{t('admin.completionTokens')}</span>
                  <span>{data.completion_tokens.toLocaleString()}</span>
                </div>
                <div className={`${styles.apiRow} ${styles.apiTotal}`}>
                  <span>{t('admin.estimatedCost')}</span>
                  <span>${data.estimated_cost_usd.toFixed(4)}</span>
                </div>
              </div>
            ))}
          </div>
          {apiUsage.gemini.total_tokens > 0 && (
            <div className={styles.costSummary}>
              <span>{t('admin.totalTokens')}: {apiUsage.gemini.total_tokens.toLocaleString()}</span>
              <span className={styles.costValue}>${apiUsage.gemini.estimated_total_cost_usd.toFixed(4)}</span>
            </div>
          )}
        </CollapsibleSection>
      </div>
    </div>
  )
}
