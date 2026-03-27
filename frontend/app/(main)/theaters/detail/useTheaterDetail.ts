'use client'

import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { translateStatic } from '@/lib/i18n'
import type { TheaterGroupDetail, TheaterList, TheaterMessage } from './types'

type TheaterListItemInput = {
  tmdb_id: number
  title_en: string
  title_zh?: string | null
  poster_url?: string | null
  genres?: string[]
  runtime_minutes?: number | null
  match_tags?: string[]
  note?: string | null
}

export function useTheaterDetail(groupId: string) {
  const [group, setGroup] = useState<TheaterGroupDetail | null>(null)
  const [lists, setLists] = useState<TheaterList[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [mutationCount, setMutationCount] = useState(0)
  const isMutating = mutationCount > 0

  const beginMutation = useCallback(() => {
    setMutationCount((count) => count + 1)
  }, [])

  const endMutation = useCallback(() => {
    setMutationCount((count) => Math.max(0, count - 1))
  }, [])

  const ensureGroupId = useCallback(() => {
    if (groupId) {
      return true
    }

    setError(translateStatic('common.error'))
    return false
  }, [groupId])

  const loadGroup = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [groupResult, listResult] = await Promise.all([
        api<TheaterGroupDetail>(`/groups/${groupId}`),
        api<TheaterList[]>(`/groups/${groupId}/lists`),
      ])
      setGroup(groupResult)
      setLists(listResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : translateStatic('common.error'))
    } finally {
      setIsLoading(false)
    }
  }, [groupId])

  useEffect(() => {
    if (!groupId) {
      setGroup(null)
      setLists([])
      setError(translateStatic('common.error'))
      setIsLoading(false)
      return
    }

    void loadGroup()
  }, [groupId, loadGroup])

  const mutateMembership = useCallback(async (action: 'join' | 'leave') => {
    if (!ensureGroupId()) {
      return
    }

    beginMutation()
    try {
      const result = await api<TheaterGroupDetail>(`/groups/${groupId}/${action}`, { method: 'POST' })
      setError(null)
      setGroup(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : translateStatic('common.error'))
    } finally {
      endMutation()
    }
  }, [beginMutation, endMutation, ensureGroupId, groupId])

  const postMessage = useCallback(async (body: string) => {
    const text = body.trim()
    if (!text) return false
    if (!ensureGroupId()) return false

    beginMutation()
    try {
      const message = await api<TheaterMessage>(`/groups/${groupId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body: text }),
      })
      setError(null)
      setGroup((current) => current ? {
        ...current,
        recent_messages: [...current.recent_messages, message].slice(-8),
      } : current)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : translateStatic('common.error'))
      return false
    } finally {
      endMutation()
    }
  }, [beginMutation, endMutation, ensureGroupId, groupId])

  const deleteMessage = useCallback(async (messageId: string) => {
    if (!ensureGroupId()) {
      return
    }

    beginMutation()
    try {
      await api(`/groups/${groupId}/messages/${messageId}`, { method: 'DELETE' })
      setError(null)
      setGroup((current) => current ? {
        ...current,
        recent_messages: current.recent_messages.filter((message) => message.id !== messageId),
      } : current)
    } catch (err) {
      setError(err instanceof Error ? err.message : translateStatic('common.error'))
    } finally {
      endMutation()
    }
  }, [beginMutation, endMutation, ensureGroupId, groupId])

  const createList = useCallback(async (input: {
    title: string
    description: string
    itemTitles?: string[]
    items?: TheaterListItemInput[]
  }) => {
    const title = input.title.trim()
    const description = input.description.trim()
    const manualItems = (input.itemTitles ?? [])
      .map((itemTitle) => itemTitle.trim())
      .filter(Boolean)
      .map((itemTitle, index) => ({
        tmdb_id: 0,
        title_en: itemTitle,
        title_zh: null,
        poster_url: null,
        genres: [],
        runtime_minutes: null,
        match_tags: [],
        note: index === 0 ? 'Seeded from quick-create flow.' : null,
      }))
    const items = [...(input.items ?? []), ...manualItems]

    if (!title) return false
    if (!ensureGroupId()) return false

    beginMutation()
    try {
      const created = await api<TheaterList>(`/groups/${groupId}/lists`, {
        method: 'POST',
        body: JSON.stringify({
          title,
          description,
          items: items.map((item) => ({
            tmdb_id: item.tmdb_id,
            title_en: item.title_en,
            title_zh: item.title_zh ?? null,
            poster_url: item.poster_url ?? null,
            genres: item.genres ?? [],
            runtime_minutes: item.runtime_minutes ?? null,
            match_tags: item.match_tags ?? [],
            note: item.note ?? null,
          })),
        }),
      })
      setError(null)
      setLists((current) => [created, ...current])
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : translateStatic('common.error'))
      return false
    } finally {
      endMutation()
    }
  }, [beginMutation, endMutation, ensureGroupId, groupId])

  const updateList = useCallback(async (listId: string, input: { title: string; description: string }) => {
    const title = input.title.trim()
    const description = input.description.trim()

    if (!title) return false
    if (!ensureGroupId()) return false

    beginMutation()
    try {
      const updated = await api<TheaterList>(`/groups/${groupId}/lists/${listId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title,
          description,
        }),
      })
      setError(null)
      setLists((current) => current.map((list) => (list.id === listId ? updated : list)))
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : translateStatic('common.error'))
      return false
    } finally {
      endMutation()
    }
  }, [beginMutation, endMutation, ensureGroupId, groupId])

  const deleteList = useCallback(async (listId: string) => {
    if (!ensureGroupId()) {
      return
    }

    beginMutation()
    try {
      await api(`/groups/${groupId}/lists/${listId}`, {
        method: 'DELETE',
      })
      setError(null)
      setLists((current) => current.filter((list) => list.id !== listId))
    } catch (err) {
      setError(err instanceof Error ? err.message : translateStatic('common.error'))
    } finally {
      endMutation()
    }
  }, [beginMutation, endMutation, ensureGroupId, groupId])

  const appendListItem = useCallback(async (listId: string, item: string | TheaterListItemInput) => {
    const payload = typeof item === 'string'
      ? {
          tmdb_id: 0,
          title_en: item.trim(),
          title_zh: null,
          poster_url: null,
          genres: [],
          runtime_minutes: null,
          match_tags: [],
          note: null,
        }
      : {
          tmdb_id: item.tmdb_id,
          title_en: item.title_en.trim(),
          title_zh: item.title_zh ?? null,
          poster_url: item.poster_url ?? null,
          genres: item.genres ?? [],
          runtime_minutes: item.runtime_minutes ?? null,
          match_tags: item.match_tags ?? [],
          note: item.note ?? null,
        }

    if (!payload.title_en) return false
    if (!ensureGroupId()) return false

    beginMutation()
    try {
      const updated = await api<TheaterList>(`/groups/${groupId}/lists/${listId}/items`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setError(null)
      setLists((current) => current.map((list) => (list.id === listId ? updated : list)))
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : translateStatic('common.error'))
      return false
    } finally {
      endMutation()
    }
  }, [beginMutation, endMutation, ensureGroupId, groupId])

  const deleteListItem = useCallback(async (listId: string, itemId: string) => {
    if (!ensureGroupId()) {
      return
    }

    beginMutation()
    try {
      const updated = await api<TheaterList>(`/groups/${groupId}/lists/${listId}/items/${itemId}`, {
        method: 'DELETE',
      })
      setError(null)
      setLists((current) => current.map((list) => (list.id === listId ? updated : list)))
    } catch (err) {
      setError(err instanceof Error ? err.message : translateStatic('common.error'))
    } finally {
      endMutation()
    }
  }, [beginMutation, endMutation, ensureGroupId, groupId])

  const updateListItemNote = useCallback(async (listId: string, itemId: string, note: string) => {
    if (!ensureGroupId()) return false

    beginMutation()
    try {
      const updated = await api<TheaterList>(`/groups/${groupId}/lists/${listId}/items/${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify({ note }),
      })
      setError(null)
      setLists((current) => current.map((list) => (list.id === listId ? updated : list)))
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : translateStatic('common.error'))
      return false
    } finally {
      endMutation()
    }
  }, [beginMutation, endMutation, ensureGroupId, groupId])

  const reorderListItems = useCallback(async (listId: string, itemIds: string[]) => {
    if (!ensureGroupId()) return false

    beginMutation()
    try {
      const updated = await api<TheaterList>(`/groups/${groupId}/lists/${listId}/items/reorder`, {
        method: 'PATCH',
        body: JSON.stringify({ item_ids: itemIds }),
      })
      setError(null)
      setLists((current) => current.map((list) => (list.id === listId ? updated : list)))
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : translateStatic('common.error'))
      return false
    } finally {
      endMutation()
    }
  }, [beginMutation, endMutation, ensureGroupId, groupId])

  const postListReply = useCallback(async (listId: string, body: string) => {
    const text = body.trim()
    if (!text) return false
    if (!ensureGroupId()) return false

    beginMutation()
    try {
      const updated = await api<TheaterList>(`/groups/${groupId}/lists/${listId}/replies`, {
        method: 'POST',
        body: JSON.stringify({ body: text }),
      })
      setError(null)
      setLists((current) => current.map((list) => (list.id === listId ? updated : list)))
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : translateStatic('common.error'))
      return false
    } finally {
      endMutation()
    }
  }, [beginMutation, endMutation, ensureGroupId, groupId])

  const deleteListReply = useCallback(async (listId: string, replyId: string) => {
    if (!ensureGroupId()) {
      return
    }

    beginMutation()
    try {
      const updated = await api<TheaterList>(`/groups/${groupId}/lists/${listId}/replies/${replyId}`, {
        method: 'DELETE',
      })
      setError(null)
      setLists((current) => current.map((list) => (list.id === listId ? updated : list)))
    } catch (err) {
      setError(err instanceof Error ? err.message : translateStatic('common.error'))
    } finally {
      endMutation()
    }
  }, [beginMutation, endMutation, ensureGroupId, groupId])

  return {
    group,
    lists,
    error,
    isLoading,
    isMutating,
    loadGroup,
    joinGroup: () => mutateMembership('join'),
    leaveGroup: () => mutateMembership('leave'),
    createList,
    updateList,
    deleteList,
    appendListItem,
    deleteListItem,
    updateListItemNote,
    reorderListItems,
    postListReply,
    deleteListReply,
    postMessage,
    deleteMessage,
  }
}
