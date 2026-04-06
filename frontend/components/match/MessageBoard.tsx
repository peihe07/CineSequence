'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import styles from './MessageBoard.module.css'

interface Message {
  id: string
  sender_id: string
  sender_name: string
  body: string
  created_at: string
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

export default function MessageBoard({ matchId }: MessageBoardProps) {
  const userId = useAuthStore((s) => s.user?.id)
  const [messages, setMessages] = useState<Message[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [body, setBody] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

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

  const handleRefresh = useCallback(async () => {
    try {
      const data = await fetchMessages()
      setMessages(data?.messages ?? [])
      setHasMore(data?.has_more ?? false)
      requestAnimationFrame(() => {
        if (listRef.current) {
          listRef.current.scrollTop = listRef.current.scrollHeight
        }
      })
    } catch {
      // Silently fail on refresh
    }
  }, [fetchMessages])

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
    if (!trimmed || isSending) return

    setIsSending(true)
    try {
      const msg = await api<Message>(`/matches/${matchId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body: trimmed }),
      })
      setMessages((prev) => [...prev, msg])
      setBody('')
      requestAnimationFrame(() => {
        if (listRef.current) {
          listRef.current.scrollTop = listRef.current.scrollHeight
        }
      })
    } catch {
      // TODO: show error inline
    } finally {
      setIsSending(false)
    }
  }, [body, isSending, matchId])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
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
        <span className={styles.headerLabel}>Message Board</span>
        <button
          className={styles.refreshBtn}
          onClick={() => void handleRefresh()}
          aria-label="Refresh messages"
        >
          <i className="ri-refresh-line" aria-hidden="true" />
        </button>
      </div>

      <div className={styles.messageList} ref={listRef}>
        {hasMore && (
          <button
            className={styles.loadMoreBtn}
            onClick={() => void handleLoadMore()}
          >
            Load earlier messages
          </button>
        )}

        {messages.length === 0 && (
          <div className={styles.empty}>
            <i className="ri-chat-3-line" aria-hidden="true" />
            <span>Start a conversation about your shared taste.</span>
          </div>
        )}

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
              </span>
            </div>
          )
        })}
      </div>

      <div className={styles.inputArea}>
        <textarea
          className={styles.textInput}
          placeholder="Write a message..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={500}
          rows={1}
          disabled={isSending}
        />
        <button
          className={styles.sendBtn}
          onClick={() => void handleSend()}
          disabled={isSending || !body.trim() || isOverLimit}
          aria-label="Send message"
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
