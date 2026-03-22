'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
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
  resend: { invite_emails: number; accepted_emails: number; estimated_total: number }
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
        const msg = e instanceof Error ? e.message : 'Failed to load'
        setError(msg)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

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
        <h1 className={styles.title}>Admin Dashboard</h1>

        {/* Overview */}
        <div className={styles.grid}>
          <StatCard value={stats.users.total} label="Total Users" />
          <StatCard value={stats.users.today} label="Today" />
          <StatCard value={stats.users.this_week} label="This Week" />
          <StatCard value={stats.dna.total_active} label="DNA Profiles" />
          <StatCard value={stats.matches.total} label="Total Matches" />
          <StatCard value={`${(stats.matches.accept_rate * 100).toFixed(0)}%`} label="Accept Rate" />
        </div>

        {/* Funnel */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>User Funnel</h2>
          <div className={styles.funnel}>
            <FunnelBar count={stats.funnel.registered} max={funnelMax} label="Registered" />
            <FunnelBar count={stats.funnel.completed_sequencing} max={funnelMax} label="Completed Sequencing" />
            <FunnelBar count={stats.funnel.has_dna} max={funnelMax} label="Has DNA" />
            <FunnelBar count={stats.funnel.has_match} max={funnelMax} label="Has Match" />
          </div>
        </div>

        {/* Daily charts */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Daily Registrations (30d)</h2>
          {daily.registrations.length > 0 ? (
            <MiniChart data={daily.registrations} />
          ) : (
            <p className={styles.funnelLabel}>No data yet</p>
          )}
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Daily DNA Builds (30d)</h2>
          {daily.dna_builds.length > 0 ? (
            <MiniChart data={daily.dna_builds} />
          ) : (
            <p className={styles.funnelLabel}>No data yet</p>
          )}
        </div>

        {/* Archetype distribution */}
        {Object.keys(stats.dna.archetype_distribution).length > 0 && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Archetype Distribution</h2>
            <table className={styles.table}>
              <thead>
                <tr><th>Archetype</th><th>Count</th></tr>
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
          <h2 className={styles.sectionTitle}>Match Status</h2>
          <table className={styles.table}>
            <thead>
              <tr><th>Status</th><th>Count</th></tr>
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
          <h2 className={styles.sectionTitle}>Estimated API Usage</h2>
          <div className={styles.apiGrid}>
            <div className={styles.apiCard}>
              <span className={styles.apiCardTitle}>Gemini</span>
              <div className={styles.apiRow}>
                <span>Personality readings</span>
                <span>{apiUsage.gemini.personality_readings}</span>
              </div>
              <div className={styles.apiRow}>
                <span>Ice breakers</span>
                <span>{apiUsage.gemini.ice_breakers}</span>
              </div>
              <div className={styles.apiRow}>
                <span>AI pairs</span>
                <span>{apiUsage.gemini.ai_pairs}</span>
              </div>
              <div className={`${styles.apiRow} ${styles.apiTotal}`}>
                <span>Total</span>
                <span>{apiUsage.gemini.estimated_total}</span>
              </div>
            </div>

            <div className={styles.apiCard}>
              <span className={styles.apiCardTitle}>TMDB</span>
              <div className={styles.apiRow}>
                <span>Queries</span>
                <span>{apiUsage.tmdb.estimated_queries}</span>
              </div>
            </div>

            <div className={styles.apiCard}>
              <span className={styles.apiCardTitle}>Resend</span>
              <div className={styles.apiRow}>
                <span>Invite emails</span>
                <span>{apiUsage.resend.invite_emails}</span>
              </div>
              <div className={styles.apiRow}>
                <span>Accepted emails</span>
                <span>{apiUsage.resend.accepted_emails}</span>
              </div>
              <div className={`${styles.apiRow} ${styles.apiTotal}`}>
                <span>Total</span>
                <span>{apiUsage.resend.estimated_total}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
