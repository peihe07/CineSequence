'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/lib/i18n'
import styles from './MessageBoard.module.css'

interface Message {
  id: string
  sender_id: string
  sender_name: string
  body: string
  created_at: string
}

/** Optimistic message before server confirmation */
interface OptimisticMessage {
  tempId: string
  sender_id: string
  body: string
  created_at: string
  status: 'sending' | 'failed'
}

interface MessageListResponse {
  messages: Message[]
  has_more: boolean
}

interface MessageBoardProps {
  matchId: string
}

function formatTime(isoString: string): string {
  const date = new Date(isoString)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${month}/${day} ${hours}:${minutes}`
}

let optimisticCounter = 0

const POLL_INTERVAL = 12_000

export default function MessageBoard({ matchId }: MessageBoardProps) {
  const userId = useAuthStore((s) => s.user?.id)
  const { t } = useI18n()
  const [messages, setMessages] = useState<Message[]>([])
  const [optimistic, setOptimistic] = useState<OptimisticMessage[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [body, setBody] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const fetchMessages = useCallback(async (cursor?: string) => {
    const params = new URLSearchParams({ limit: '20' })
    if (cursor) params.set('cursor', cursor)
    const data = await api<MessageListResponse>(
      `/matches/${matchId}/messages?${params}`
    )
    return data
  }, [matchId])

  // Initial load
  useEffect(() => {
    setIsLoading(true)
    void fetchMessages().then((data) => {
      setMessages(data?.messages ?? [])
      setHasMore(data?.has_more ?? false)
      setIsLoading(false)
      // 初次載入用 instant scroll，不用動畫
      requestAnimationFrame(() => {
        if (listRef.current) {
          listRef.current.scrollTop = listRef.current.scrollHeight
        }
      })
    }).catch(() => {
      setMessages([])
      setIsLoading(false)
    })
  }, [fetchMessages])

  // Silent polling
  useEffect(() => {
    const interval = setInterval(() => {
      void fetchMessages().then((data) => {
        if (!data?.messages) return
        setMessages((prev) => {
          // 只在有新訊息時更新，避免不必要的 re-render
          if (data.messages.length !== prev.length ||
              data.messages[data.messages.length - 1]?.id !== prev[prev.length - 1]?.id) {
            return data.messages
          }
          return prev
        })
        setHasMore(data.has_more ?? false)
      }).catch(() => {})
    }, POLL_INTERVAL)

    return () => clearInterval(interval)
  }, [fetchMessages])

  // 新訊息時自動滾動到底部
  useEffect(() => {
    if (messages.length > 0 || optimistic.length > 0) {
      scrollToBottom()
    }
  }, [messages.length, optimistic.length, scrollToBottom])

  const handleLoadMore = useCallback(async () => {
    if (!messages.length) return
    const oldestTime = messages[0].created_at
    try {
      const data = await fetchMessages(oldestTime)
      setMessages((prev) => [...(data?.messages ?? []), ...prev])
      setHasMore(data?.has_more ?? false)
    } catch {
      // Silently fail
    }
  }, [fetchMessages, messages])

  const handleSend = useCallback(async () => {
    const trimmed = body.trim()
    if (!trimmed || !userId) return

    const tempId = `opt-${++optimisticCounter}`
    const optimisticMsg: OptimisticMessage = {
      tempId,
      sender_id: userId,
      body: trimmed,
      created_at: new Date().toISOString(),
      status: 'sending',
    }

    // Optimistic: 立即顯示
    setOptimistic((prev) => [...prev, optimisticMsg])
    setBody('')

    try {
      const msg = await api<Message>(`/matches/${matchId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body: trimmed }),
      })
      // 成功：移除 optimistic，加入真實訊息
      setOptimistic((prev) => prev.filter((o) => o.tempId !== tempId))
      setMessages((prev) => [...prev, msg])
    } catch {
      // 失敗：標記為 failed
      setOptimistic((prev) =>
        prev.map((o) => o.tempId === tempId ? { ...o, status: 'failed' as const } : o)
      )
    }
  }, [body, matchId, userId])

  const handleRetry = useCallback(async (tempId: string) => {
    const msg = optimistic.find((o) => o.tempId === tempId)
    if (!msg) return

    setOptimistic((prev) =>
      prev.map((o) => o.tempId === tempId ? { ...o, status: 'sending' as const } : o)
    )

    try {
      const result = await api<Message>(`/matches/${matchId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body: msg.body }),
      })
      setOptimistic((prev) => prev.filter((o) => o.tempId !== tempId))
      setMessages((prev) => [...prev, result])
    } catch {
      setOptimistic((prev) =>
        prev.map((o) => o.tempId === tempId ? { ...o, status: 'failed' as const } : o)
      )
    }
  }, [matchId, optimistic])

  const handleDismiss = useCallback((tempId: string) => {
    setOptimistic((prev) => prev.filter((o) => o.tempId !== tempId))
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      void handleSend()
    }
  }, [handleSend])

  const charCount = body.length
  const isOverLimit = charCount > 500

  if (isLoading) {
    return (
      <div className={styles.board}>
        <div className={styles.loading}>
          <i className="ri-loader-4-line ri-spin" aria-hidden="true" />
        </div>
      </div>
    )
  }

  return (
    <div className={styles.board}>
      <div className={styles.header}>
        <span className={styles.headerLabel}>{t('messageBoard.title')}</span>
        <span className={styles.pollIndicator} aria-hidden="true">
          <i className="ri-signal-wifi-line" />
          <span>LIVE</span>
        </span>
      </div>

      <div className={styles.messageList} ref={listRef}>
        {hasMore && (
          <button
            className={styles.loadMoreBtn}
            onClick={() => void handleLoadMore()}
          >
            {t('messageBoard.loadMore')}
          </button>
        )}

        {messages.length === 0 && optimistic.length === 0 && (
          <div className={styles.empty}>
            <i className="ri-chat-3-line" aria-hidden="true" />
            <span>{t('messageBoard.empty')}</span>
          </div>
        )}

        {/* Confirmed messages */}
        {messages.map((msg) => {
          const isMine = msg.sender_id === userId
          return (
            <div
              key={msg.id}
              className={`${styles.bubble} ${isMine ? styles.bubbleMine : styles.bubbleTheirs}`}
            >
              <span className={styles.bubbleBody}>{msg.body}</span>
              <span className={styles.bubbleMeta}>
                {!isMine && <span>{msg.sender_name}</span>}
                <span>{formatTime(msg.created_at)}</span>
                <span className={styles.statusTag}>[ACK]</span>
              </span>
            </div>
          )
        })}

        {/* Optimistic messages */}
        {optimistic.map((msg) => (
          <div
            key={msg.tempId}
            className={`${styles.bubble} ${styles.bubbleMine} ${
              msg.status === 'sending' ? styles.bubbleOptimistic : styles.bubbleFailed
            }`}
          >
            <span className={styles.bubbleBody}>{msg.body}</span>
            <span className={styles.bubbleMeta}>
              <span>{formatTime(msg.created_at)}</span>
              {msg.status === 'sending' && (
                <span className={styles.statusTagSending}>[TRANSMITTING...]</span>
              )}
              {msg.status === 'failed' && (
                <>
                  <span className={styles.statusTagFailed}>[FAILED]</span>
                  <button
                    className={styles.retryBtn}
                    onClick={() => void handleRetry(msg.tempId)}
                    aria-label={t('messageBoard.retry')}
                  >
                    <i className="ri-refresh-line" aria-hidden="true" />
                  </button>
                  <button
                    className={styles.dismissBtn}
                    onClick={() => handleDismiss(msg.tempId)}
                    aria-label={t('messageBoard.dismiss')}
                  >
                    <i className="ri-close-line" aria-hidden="true" />
                  </button>
                </>
              )}
            </span>
          </div>
        ))}

        {/* Scroll anchor */}
        <div ref={bottomRef} />
      </div>

      <div className={styles.inputArea}>
        <textarea
          className={styles.textInput}
          placeholder={t('messageBoard.placeholder')}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={500}
          rows={1}
        />
        <button
          className={styles.sendBtn}
          onClick={() => void handleSend()}
          disabled={!body.trim() || isOverLimit}
          aria-label={t('messageBoard.send')}
        >
          <i className="ri-send-plane-fill" aria-hidden="true" />
        </button>
      </div>
      {charCount > 400 && (
        <span className={`${styles.charCount} ${isOverLimit ? styles.charCountWarn : ''}`}>
          {charCount}/500
        </span>
      )}
    </div>
  )
}
