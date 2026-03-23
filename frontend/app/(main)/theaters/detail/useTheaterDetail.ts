'use client'

import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { translateStatic } from '@/lib/i18n'
import type { TheaterGroupDetail, TheaterMessage } from './types'

export function useTheaterDetail(groupId: string) {
  const [group, setGroup] = useState<TheaterGroupDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isMutating, setIsMutating] = useState(false)

  const loadGroup = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await api<TheaterGroupDetail>(`/groups/${groupId}`)
      setGroup(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : translateStatic('common.error'))
    } finally {
      setIsLoading(false)
    }
  }, [groupId])

  useEffect(() => {
    if (!groupId) {
      setGroup(null)
      setError(translateStatic('common.error'))
      setIsLoading(false)
      return
    }

    void loadGroup()
  }, [groupId, loadGroup])

  const mutateMembership = useCallback(async (action: 'join' | 'leave') => {
    setIsMutating(true)
    try {
      const result = await api<TheaterGroupDetail>(`/groups/${groupId}/${action}`, { method: 'POST' })
      setGroup(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : translateStatic('common.error'))
    } finally {
      setIsMutating(false)
    }
  }, [groupId])

  const postMessage = useCallback(async (body: string) => {
    const text = body.trim()
    if (!text) return false

    setIsMutating(true)
    try {
      const message = await api<TheaterMessage>(`/groups/${groupId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body: text }),
      })
      setGroup((current) => current ? {
        ...current,
        recent_messages: [...current.recent_messages, message].slice(-8),
      } : current)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : translateStatic('common.error'))
      return false
    } finally {
      setIsMutating(false)
    }
  }, [groupId])

  const deleteMessage = useCallback(async (messageId: string) => {
    setIsMutating(true)
    try {
      await api(`/groups/${groupId}/messages/${messageId}`, { method: 'DELETE' })
      setGroup((current) => current ? {
        ...current,
        recent_messages: current.recent_messages.filter((message) => message.id !== messageId),
      } : current)
    } catch (err) {
      setError(err instanceof Error ? err.message : translateStatic('common.error'))
    } finally {
      setIsMutating(false)
    }
  }, [groupId])

  return {
    group,
    error,
    isLoading,
    isMutating,
    loadGroup,
    joinGroup: () => mutateMembership('join'),
    leaveGroup: () => mutateMembership('leave'),
    postMessage,
    deleteMessage,
  }
}
