'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n'
import { useNotificationStore, type NotificationItem } from '@/stores/notificationStore'
import { useAuthStore } from '@/stores/authStore'
import styles from './NotificationBell.module.css'

const POLL_INTERVAL = 30_000

function NotificationRow({
  item,
  locale,
  onClickItem,
}: {
  item: NotificationItem
  locale: 'zh' | 'en'
  onClickItem: (item: NotificationItem) => void
}) {
  const title = locale === 'zh' ? item.title_zh : item.title_en
  const body = locale === 'zh' ? item.body_zh : item.body_en
  const timeAgo = formatTimeAgo(item.created_at, locale)

  return (
    <button
      className={`${styles.item} ${item.is_read ? styles.itemRead : ''}`}
      onClick={() => onClickItem(item)}
    >
      <span className={styles.icon}>{typeIcon(item.type)}</span>
      <div className={styles.itemContent}>
        <span className={styles.itemTitle}>{title}</span>
        {body && <span className={styles.itemBody}>{body}</span>}
        <span className={styles.itemTime}>{timeAgo}</span>
      </div>
      {!item.is_read && <span className={styles.unreadDot} />}
    </button>
  )
}

function typeIcon(type: NotificationItem['type']): string {
  switch (type) {
    case 'dna_ready':
      return '🧬'
    case 'match_found':
      return '🔍'
    case 'invite_received':
      return '✉️'
    case 'match_accepted':
      return '🎬'
    case 'system':
      return '📢'
  }
}

function formatTimeAgo(isoString: string, locale: 'zh' | 'en'): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return locale === 'zh' ? '剛才' : 'just now'
  if (minutes < 60) return locale === 'zh' ? `${minutes} 分鐘前` : `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return locale === 'zh' ? `${hours} 小時前` : `${hours}h ago`
  const days = Math.floor(hours / 24)
  return locale === 'zh' ? `${days} 天前` : `${days}d ago`
}

export default function NotificationBell() {
  const { locale, t } = useI18n()
  const router = useRouter()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const {
    notifications,
    unreadCount,
    fetchNotifications,
    pollUnreadCount,
    markAsRead,
    markAllAsRead,
  } = useNotificationStore()

  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Poll for unread count
  useEffect(() => {
    if (!isAuthenticated) return
    pollUnreadCount()
    const interval = setInterval(pollUnreadCount, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [isAuthenticated, pollUnreadCount])

  // Fetch full list when dropdown opens
  useEffect(() => {
    if (isOpen && isAuthenticated) {
      fetchNotifications()
    }
  }, [isOpen, isAuthenticated, fetchNotifications])

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen])

  const handleClickItem = useCallback(
    (item: NotificationItem) => {
      if (!item.is_read) {
        markAsRead(item.id)
      }
      if (item.link) {
        router.push(item.link)
        setIsOpen(false)
      }
    },
    [markAsRead, router],
  )

  const handleMarkAllRead = useCallback(() => {
    markAllAsRead()
  }, [markAllAsRead])

  const handleViewAll = useCallback(() => {
    setIsOpen(false)
    router.push('/notifications')
  }, [router])

  if (!isAuthenticated) return null

  return (
    <div className={styles.container} ref={containerRef}>
      <button
        className={styles.bell}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={t('notification.bell')}
        aria-expanded={isOpen}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className={styles.badge} aria-label={`${unreadCount} ${t('notification.unread')}`}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className={styles.dropdown} role="menu" aria-label={t('notification.list')}>
          <div className={styles.dropdownHeader}>
            <span className={styles.dropdownTitle}>{t('notification.title')}</span>
            {unreadCount > 0 && (
              <button className={styles.markAllRead} onClick={handleMarkAllRead}>
                {t('notification.markAllRead')}
              </button>
            )}
          </div>

          <div className={styles.dropdownList}>
            {notifications.length === 0 ? (
              <p className={styles.empty}>{t('notification.empty')}</p>
            ) : (
              notifications.map((item) => (
                <NotificationRow
                  key={item.id}
                  item={item}
                  locale={locale}
                  onClickItem={handleClickItem}
                />
              ))
            )}
          </div>

          <button
            type="button"
            className={styles.viewAll}
            onClick={handleViewAll}
          >
            {t('notification.viewAll')}
          </button>
        </div>
      )}
    </div>
  )
}
