'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import { useAuthStore } from '@/stores/authStore'
import styles from './MessageInbox.module.css'

interface Conversation {
  match_id: string
  partner_name: string
  partner_avatar_url: string | null
  last_message_body: string
  last_message_at: string
  last_sender_id: string
  is_own: boolean
}

interface ConversationListResponse {
  conversations: Conversation[]
}

const POLL_INTERVAL = 60_000

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

export default function MessageInbox() {
  const { locale, t } = useI18n()
  const router = useRouter()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [hasNew, setHasNew] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const lastSeenRef = useRef<string | null>(null)

  const fetchConversations = useCallback(async () => {
    try {
      const data = await api<ConversationListResponse>('/matches/conversations')
      setConversations(data.conversations)

      // Detect new incoming messages
      const latest = data.conversations.find((c) => !c.is_own)
      if (latest && lastSeenRef.current && latest.last_message_at > lastSeenRef.current) {
        setHasNew(true)
      }
      if (latest) {
        lastSeenRef.current = latest.last_message_at
      }
    } catch {
      // Silently fail
    }
  }, [])

  // Poll for conversations
  useEffect(() => {
    if (!isAuthenticated) return
    void fetchConversations()
    const interval = setInterval(() => void fetchConversations(), POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [isAuthenticated, fetchConversations])

  // Fetch when dropdown opens
  useEffect(() => {
    if (isOpen && isAuthenticated) {
      setHasNew(false)
      void fetchConversations()
    }
  }, [isOpen, isAuthenticated, fetchConversations])

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

  const handleClickConversation = useCallback(
    (conv: Conversation) => {
      router.push(`/matches?match=${conv.match_id}`)
      setIsOpen(false)
    },
    [router],
  )

  if (!isAuthenticated) return null

  return (
    <div className={styles.container} ref={containerRef}>
      <button
        className={styles.button}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={t('inbox.title')}
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
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {hasNew && <span className={styles.badge} />}
      </button>

      {isOpen && (
        <div className={styles.dropdown} role="menu" aria-label={t('inbox.title')}>
          <div className={styles.dropdownHeader}>
            <span className={styles.dropdownTitle}>{t('inbox.title')}</span>
          </div>

          <div className={styles.dropdownList}>
            {conversations.length === 0 ? (
              <p className={styles.empty}>{t('inbox.empty')}</p>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.match_id}
                  className={styles.item}
                  onClick={() => handleClickConversation(conv)}
                >
                  <div className={styles.avatar}>
                    {conv.partner_avatar_url ? (
                      <img
                        src={conv.partner_avatar_url}
                        alt={conv.partner_name}
                        className={styles.avatarImg}
                      />
                    ) : (
                      <span className={styles.avatarFallback}>
                        {conv.partner_name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className={styles.itemContent}>
                    <div className={styles.itemHeader}>
                      <span className={styles.partnerName}>{conv.partner_name}</span>
                      <span className={styles.itemTime}>
                        {formatTimeAgo(conv.last_message_at, locale)}
                      </span>
                    </div>
                    <span className={styles.preview}>
                      {conv.is_own && `${t('inbox.you')} `}
                      {conv.last_message_body}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
