'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
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
}

interface DailyStats {
  days: number
  registrations: { date: string; count: number }[]
  dna_builds: { date: string; count: number }[]
  matches: { date: string; count: number }[]
}

interface ApiUsage {
  gemini: { personality_readings: number; ice_breakers: number; ai_pairs: number; estimated_total: number }
  tmdb: { estimated_queries: number }
  resend: { invite_emails: number; invite_reminder_emails: number; accepted_emails: number; estimated_total: number }
}

function StatCard({ value, label }: { value: number | string; label: string }) {
  return (
    <div className={styles.statCard}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  )
}

function MiniChart({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1)
  return (
    <div className={styles.chart}>
      {data.map((d) => (
        <div
          key={d.date}
          className={styles.chartBar}
          style={{ height: `${(d.count / max) * 100}%` }}
          title={`${d.date}: ${d.count}`}
        />
      ))}
    </div>
  )
}

function FunnelBar({ count, max, label }: { count: number; max: number; label: string }) {
  const pct = max > 0 ? (count / max) * 100 : 0
  return (
    <div className={styles.funnelRow}>
      <span className={styles.funnelLabel}>{label}</span>
      <div className={styles.funnelBar} style={{ width: `${Math.max(pct, 8)}%` }}>
        <span className={styles.funnelCount}>{count}</span>
      </div>
    </div>
  )
}

export default function AdminPage() {
  const { t } = useI18n()
  const [stats, setStats] = useState<Stats | null>(null)
  const [daily, setDaily] = useState<DailyStats | null>(null)
  const [apiUsage, setApiUsage] = useState<ApiUsage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [s, d, a] = await Promise.all([
          api<Stats>('/admin/stats'),
          api<DailyStats>('/admin/stats/daily?days=30'),
          api<ApiUsage>('/admin/api-usage'),
        ])
        setStats(s)
        setDaily(d)
        setApiUsage(a)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : t('admin.loadFailed')
        setError(msg)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [t])

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

  if (!stats || !daily || !apiUsage) return null

  const funnelMax = stats.funnel.registered || 1

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.title}>{t('admin.title')}</h1>

        {/* Overview */}
        <div className={styles.grid}>
          <StatCard value={stats.users.total} label={t('admin.totalUsers')} />
          <StatCard value={stats.users.today} label={t('admin.today')} />
          <StatCard value={stats.users.this_week} label={t('admin.thisWeek')} />
          <StatCard value={stats.dna.total_active} label={t('admin.dnaProfiles')} />
          <StatCard value={stats.matches.total} label={t('admin.totalMatches')} />
          <StatCard value={`${(stats.matches.accept_rate * 100).toFixed(0)}%`} label={t('admin.acceptRate')} />
        </div>

        {/* Funnel */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('admin.userFunnel')}</h2>
          <div className={styles.funnel}>
            <FunnelBar count={stats.funnel.registered} max={funnelMax} label={t('admin.registered')} />
            <FunnelBar count={stats.funnel.completed_sequencing} max={funnelMax} label={t('admin.completedSequencing')} />
            <FunnelBar count={stats.funnel.has_dna} max={funnelMax} label={t('admin.hasDna')} />
            <FunnelBar count={stats.funnel.has_match} max={funnelMax} label={t('admin.hasMatch')} />
          </div>
        </div>

        {/* Daily charts */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('admin.dailyRegistrations')}</h2>
          {daily.registrations.length > 0 ? (
            <MiniChart data={daily.registrations} />
          ) : (
            <p className={styles.funnelLabel}>{t('admin.noData')}</p>
          )}
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('admin.dailyDnaBuilds')}</h2>
          {daily.dna_builds.length > 0 ? (
            <MiniChart data={daily.dna_builds} />
          ) : (
            <p className={styles.funnelLabel}>{t('admin.noData')}</p>
          )}
        </div>

        {/* Archetype distribution */}
        {Object.keys(stats.dna.archetype_distribution).length > 0 && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>{t('admin.archetypeDistribution')}</h2>
            <table className={styles.table}>
              <thead>
                <tr><th>{t('admin.archetype')}</th><th>{t('admin.count')}</th></tr>
              </thead>
              <tbody>
                {Object.entries(stats.dna.archetype_distribution)
                  .sort((a, b) => b[1] - a[1])
                  .map(([archetype, count]) => (
                    <tr key={archetype}><td>{archetype}</td><td>{count}</td></tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Match breakdown */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('admin.matchStatus')}</h2>
          <table className={styles.table}>
            <thead>
              <tr><th>{t('admin.status')}</th><th>{t('admin.count')}</th></tr>
            </thead>
            <tbody>
              {Object.entries(stats.matches.status_breakdown).map(([status, count]) => (
                <tr key={status}><td>{status}</td><td>{count}</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* API usage */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('admin.estimatedApiUsage')}</h2>
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
        </div>
      </div>
    </div>
  )
}
