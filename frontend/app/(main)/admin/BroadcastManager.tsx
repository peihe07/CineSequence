'use client'

import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import styles from './broadcast.module.css'

interface Broadcast {
  broadcast_id: string
  title_zh: string
  title_en: string
  body_zh: string | null
  body_en: string | null
  link: string | null
  total: number
  read_count: number
  created_at: string | null
}

interface BroadcastListResponse {
  broadcasts: Broadcast[]
}

interface BroadcastResult {
  broadcast_id: string
  notifications_created: number
  email_sent: number
  email_failed: number
  waitlist_emails: number
}

const RECIPIENTS_OPTIONS = ['all_users', 'waitlist', 'both'] as const

export default function BroadcastManager() {
  const { t, locale } = useI18n()
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])
  const [showForm, setShowForm] = useState(false)
  const [sending, setSending] = useState(false)
  const [lastResult, setLastResult] = useState<BroadcastResult | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)

  // 表單 state
  const [titleZh, setTitleZh] = useState('')
  const [titleEn, setTitleEn] = useState('')
  const [bodyZh, setBodyZh] = useState('')
  const [bodyEn, setBodyEn] = useState('')
  const [link, setLink] = useState('/sequencing')
  const [recipients, setRecipients] = useState<typeof RECIPIENTS_OPTIONS[number]>('all_users')
  const [sendEmail, setSendEmail] = useState(false)

  const recipientLabel = (r: string) => {
    if (r === 'all_users') return t('admin.allUsers')
    if (r === 'waitlist') return t('admin.waitlistOnly')
    return t('admin.bothUsersAndWaitlist')
  }

  const fetchBroadcasts = useCallback(async () => {
    try {
      const data = await api<BroadcastListResponse>('/admin/notifications')
      setBroadcasts(data.broadcasts)
    } catch {
      // 靜默處理
    }
  }, [])

  useEffect(() => {
    fetchBroadcasts()
  }, [fetchBroadcasts])

  const handleSend = async () => {
    if (!titleZh || !titleEn) return
    setSending(true)
    setLastResult(null)
    setSendError(null)
    try {
      const result = await api<BroadcastResult>('/admin/notifications', {
        method: 'POST',
        body: JSON.stringify({
          title_zh: titleZh,
          title_en: titleEn,
          body_zh: bodyZh || null,
          body_en: bodyEn || null,
          link: link || null,
          recipients,
          send_email: sendEmail,
        }),
      })
      setLastResult(result)
      setShowForm(false)
      resetForm()
      await fetchBroadcasts()
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  const handleDelete = async (broadcastId: string) => {
    if (!window.confirm(t('admin.confirmDelete'))) return
    try {
      await api(`/admin/notifications/${broadcastId}`, { method: 'DELETE' })
      setBroadcasts((prev) => prev.filter((b) => b.broadcast_id !== broadcastId))
    } catch {
      // 錯誤由 api 層處理
    }
  }

  const resetForm = () => {
    setTitleZh('')
    setTitleEn('')
    setBodyZh('')
    setBodyEn('')
    setLink('/sequencing')
    setRecipients('all_users')
    setSendEmail(false)
  }

  const dateFormatter = new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <h2 className={styles.sectionTitle}>{t('admin.broadcasts')}</h2>
        <button
          type="button"
          className={styles.newBtn}
          onClick={() => setShowForm((v) => !v)}
        >
          <i className={showForm ? 'ri-close-line' : 'ri-add-line'} />
          {showForm ? '' : t('admin.newBroadcast')}
        </button>
      </div>

      {/* 發送結果 */}
      {lastResult && (
        <div className={styles.resultBanner}>
          <i className="ri-checkbox-circle-line" />
          <span>
            {t('admin.broadcastSent')} — {lastResult.notifications_created} notifications
            {lastResult.email_sent > 0 && `, ${lastResult.email_sent} emails`}
            {lastResult.email_failed > 0 && ` (${lastResult.email_failed} failed)`}
          </span>
        </div>
      )}

      {/* 發送錯誤 */}
      {sendError && (
        <div className={styles.errorBanner}>
          <i className="ri-error-warning-line" />
          <span>{sendError}</span>
        </div>
      )}

      {/* 新增表單 */}
      {showForm && (
        <div className={styles.form}>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>{t('admin.broadcastTitle')} ({t('admin.zh')})</label>
            <input
              type="text"
              className={styles.input}
              value={titleZh}
              onChange={(e) => setTitleZh(e.target.value)}
              placeholder="系統更新通知"
            />
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>{t('admin.broadcastTitle')} ({t('admin.en')})</label>
            <input
              type="text"
              className={styles.input}
              value={titleEn}
              onChange={(e) => setTitleEn(e.target.value)}
              placeholder="System Update"
            />
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>{t('admin.broadcastBody')} ({t('admin.zh')})</label>
            <textarea
              className={styles.textarea}
              value={bodyZh}
              onChange={(e) => setBodyZh(e.target.value)}
              rows={3}
            />
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>{t('admin.broadcastBody')} ({t('admin.en')})</label>
            <textarea
              className={styles.textarea}
              value={bodyEn}
              onChange={(e) => setBodyEn(e.target.value)}
              rows={3}
            />
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>{t('admin.broadcastLink')}</label>
            <input
              type="text"
              className={styles.input}
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="/sequencing"
            />
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>{t('admin.broadcastRecipients')}</label>
            <div className={styles.radioGroup}>
              {RECIPIENTS_OPTIONS.map((opt) => (
                <label key={opt} className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="recipients"
                    value={opt}
                    checked={recipients === opt}
                    onChange={() => setRecipients(opt)}
                  />
                  {recipientLabel(opt)}
                </label>
              ))}
            </div>
          </div>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
            />
            {t('admin.sendEmail')}
          </label>
          <button
            type="button"
            className={styles.sendBtn}
            onClick={handleSend}
            disabled={sending || !titleZh || !titleEn}
          >
            {sending ? t('admin.sending') : t('admin.send')}
          </button>
        </div>
      )}

      {/* 廣播紀錄列表 */}
      <div className={styles.listHeader}>
        <span className={styles.listTitle}>{t('admin.broadcastHistory')}</span>
      </div>
      {broadcasts.length === 0 ? (
        <p className={styles.empty}>{t('admin.noBroadcasts')}</p>
      ) : (
        <div className={styles.list}>
          {broadcasts.map((b) => (
            <div key={b.broadcast_id} className={styles.card}>
              <div className={styles.cardMain}>
                <span className={styles.cardTitle}>
                  {locale === 'zh' ? b.title_zh : b.title_en}
                </span>
                {(locale === 'zh' ? b.body_zh : b.body_en) && (
                  <span className={styles.cardBody}>
                    {locale === 'zh' ? b.body_zh : b.body_en}
                  </span>
                )}
                {b.link && <span className={styles.cardLink}>{b.link}</span>}
              </div>
              <div className={styles.cardMeta}>
                <span className={styles.cardStat}>
                  {t('admin.readRate')}: {b.read_count}/{b.total}
                </span>
                {b.created_at && (
                  <span className={styles.cardDate}>
                    {dateFormatter.format(new Date(b.created_at))}
                  </span>
                )}
                <button
                  type="button"
                  className={styles.deleteBtn}
                  onClick={() => handleDelete(b.broadcast_id)}
                >
                  <i className="ri-delete-bin-line" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
