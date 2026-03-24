'use client'

import { useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useI18n } from '@/lib/i18n'
import { useNotificationStore, type NotificationItem } from '@/stores/notificationStore'
import styles from './page.module.css'

const TYPE_ICONS: Record<NotificationItem['type'], string> = {
  dna_ready: '🧬',
  match_found: '🔍',
  invite_received: '✉️',
  match_accepted: '🎬',
  system: '📢',
}

function formatTimeAgo(isoString: string, locale: 'zh' | 'en'): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return locale === 'zh' ? '剛才' : 'just now'
  if (minutes < 60) return locale === 'zh' ? `${minutes} 分鐘前` : `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return locale === 'zh' ? `${hours} 小時前` : `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return locale === 'zh' ? `${days} 天前` : `${days}d ago`
  const months = Math.floor(days / 30)
  return locale === 'zh' ? `${months} 個月前` : `${months}mo ago`
}

function NotificationRow({
  item,
  locale,
  onClick,
}: {
  item: NotificationItem
  locale: 'zh' | 'en'
  onClick: (item: NotificationItem) => void
}) {
  const title = locale === 'zh' ? item.title_zh : item.title_en
  const body = locale === 'zh' ? item.body_zh : item.body_en

  return (
    <motion.button
      className={`${styles.row} ${item.is_read ? styles.rowRead : ''}`}
      onClick={() => onClick(item)}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <span className={styles.icon}>{TYPE_ICONS[item.type]}</span>
      <div className={styles.rowContent}>
        <span className={styles.rowTitle}>{title}</span>
        {body && <span className={styles.rowBody}>{body}</span>}
        <span className={styles.rowTime}>{formatTimeAgo(item.created_at, locale)}</span>
      </div>
      {!item.is_read && <span className={styles.unreadDot} />}
    </motion.button>
  )
}

export default function NotificationsPage() {
  const { locale, t } = useI18n()
  const router = useRouter()
  const {
    notifications,
    unreadCount,
    isLoading,
    error,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotificationStore()

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  const handleClick = useCallback(
    (item: NotificationItem) => {
      if (!item.is_read) {
        markAsRead(item.id)
      }
      if (item.link) {
        router.push(item.link)
      }
    },
    [markAsRead, router],
  )

  return (
    <div className={styles.container}>
      <motion.div
        className={styles.content}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <section className={`${styles.section} ${styles.heroSection}`}>
          <span className={styles.sideLabel}>{t('notifications.fileLabel')}</span>
          <p className={styles.eyebrow}>[ SIGNAL_LOG ]</p>
          <div className={styles.header}>
            <h1 className={styles.title}>{t('notifications.pageTitle')}</h1>
            {unreadCount > 0 && (
              <button className={styles.markAllBtn} onClick={markAllAsRead}>
                {t('notification.markAllRead')}
              </button>
            )}
          </div>
          <p className={styles.deck}>{t('notifications.deck')}</p>
          <p className={styles.heroMeta}>
            {t('notifications.total', { count: String(notifications.length) })}{' // '}{t('notifications.unreadCount', { count: String(unreadCount) })}
          </p>
        </section>

        <section className={`${styles.section} ${styles.listSection}`}>
          {isLoading ? (
            <div className={styles.loading}>
              <i className="ri-loader-4-line ri-spin ri-2x" />
            </div>
          ) : error ? (
            <div className={styles.empty}>
              <p className={styles.emptyText}>{error}</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.emptyText}>{t('notification.empty')}</p>
            </div>
          ) : (
            <div className={styles.list}>
              {notifications.map((item) => (
                <NotificationRow
                  key={item.id}
                  item={item}
                  locale={locale}
                  onClick={handleClick}
                />
              ))}
            </div>
          )}
        </section>
      </motion.div>
    </div>
  )
}
