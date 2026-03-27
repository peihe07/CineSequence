'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import { getTagLabel } from '@/lib/tagLabels'
import type { TheaterMovieSearchResult } from '@/lib/theater-types'
import FlowGuard from '@/components/guards/FlowGuard'
import { useTheaterDetail } from '../detail/useTheaterDetail'
import styles from '../detail/page.module.css'

function TheaterDetailContent() {
  const { t, locale } = useI18n()
  const params = useParams<{ id: string }>()
  const groupId = typeof params?.id === 'string' ? params.id : ''
  const [draftMessage, setDraftMessage] = useState('')
  const [draftListTitle, setDraftListTitle] = useState('')
  const [draftListDescription, setDraftListDescription] = useState('')
  const [draftListItems, setDraftListItems] = useState('')
  const [draftSelectedMovies, setDraftSelectedMovies] = useState<TheaterMovieSearchResult[]>([])
  const [draftSearchQuery, setDraftSearchQuery] = useState('')
  const [draftSearchResults, setDraftSearchResults] = useState<TheaterMovieSearchResult[]>([])
  const [draftSearchError, setDraftSearchError] = useState<string | null>(null)
  const [isDraftSearching, setIsDraftSearching] = useState(false)
  const [draftListMetaById, setDraftListMetaById] = useState<Record<string, { title: string; description: string }>>({})
  const [editingListId, setEditingListId] = useState<string | null>(null)
  const [draftItemByList, setDraftItemByList] = useState<Record<string, string>>({})
  const [appendSearchQueryByList, setAppendSearchQueryByList] = useState<Record<string, string>>({})
  const [appendSearchResultsByList, setAppendSearchResultsByList] = useState<Record<string, TheaterMovieSearchResult[]>>({})
  const [appendSearchErrorByList, setAppendSearchErrorByList] = useState<Record<string, string | null>>({})
  const [appendSearchingByList, setAppendSearchingByList] = useState<Record<string, boolean>>({})
  const [draftNoteByItem, setDraftNoteByItem] = useState<Record<string, string>>({})
  const [draftReplyByList, setDraftReplyByList] = useState<Record<string, string>>({})
  const {
    group,
    lists,
    error,
    isLoading,
    isMutating,
    loadGroup,
    joinGroup,
    leaveGroup,
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
  } = useTheaterDetail(groupId)

  async function handlePostMessage() {
    const posted = await postMessage(draftMessage)
    if (posted) {
      setDraftMessage('')
    }
  }

  async function handleCreateList() {
    const created = await createList({
      title: draftListTitle,
      description: draftListDescription,
      itemTitles: draftListItems.split('\n'),
      items: draftSelectedMovies.map((movie) => ({
        tmdb_id: movie.tmdb_id,
        title_en: movie.title_en,
        title_zh: movie.title_zh,
        poster_url: movie.poster_url,
        genres: movie.genres,
        runtime_minutes: movie.runtime_minutes,
        match_tags: [],
        note: null,
      })),
    })
    if (created) {
      setDraftListTitle('')
      setDraftListDescription('')
      setDraftListItems('')
      setDraftSelectedMovies([])
      setDraftSearchQuery('')
      setDraftSearchResults([])
      setDraftSearchError(null)
    }
  }

  async function searchMovies(query: string) {
    if (query.trim().length < 2) {
      return []
    }

    return api<TheaterMovieSearchResult[]>(`/sequencing/search?q=${encodeURIComponent(query.trim())}`)
  }

  async function handleSearchDraftMovies() {
    if (draftSearchQuery.trim().length < 2) {
      setDraftSearchResults([])
      setDraftSearchError(null)
      return
    }

    setIsDraftSearching(true)
    try {
      const results = await searchMovies(draftSearchQuery)
      setDraftSearchResults(results)
      setDraftSearchError(null)
    } catch (err) {
      setDraftSearchResults([])
      setDraftSearchError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setIsDraftSearching(false)
    }
  }

  function handleSelectDraftMovie(movie: TheaterMovieSearchResult) {
    setDraftSelectedMovies((current) => (
      current.some((entry) => entry.tmdb_id === movie.tmdb_id)
        ? current
        : [...current, movie]
    ))
    setDraftSearchQuery('')
    setDraftSearchResults([])
    setDraftSearchError(null)
  }

  function handleRemoveDraftMovie(tmdbId: number) {
    setDraftSelectedMovies((current) => current.filter((movie) => movie.tmdb_id !== tmdbId))
  }

  async function handleUpdateList(listId: string, fallbackTitle: string, fallbackDescription: string | null) {
    const draft = draftListMetaById[listId]
    const saved = await updateList(listId, {
      title: draft?.title ?? fallbackTitle,
      description: draft?.description ?? fallbackDescription ?? '',
    })
    if (saved) {
      setDraftListMetaById((current) => ({
        ...current,
        [listId]: {
          title: draft?.title ?? fallbackTitle,
          description: draft?.description ?? fallbackDescription ?? '',
        },
      }))
      setEditingListId(null)
    }
  }

  async function handleAppendListItem(listId: string) {
    const created = await appendListItem(listId, draftItemByList[listId] ?? '')
    if (created) {
      setDraftItemByList((current) => ({ ...current, [listId]: '' }))
    }
  }

  async function handleSearchListMovie(listId: string) {
    const query = appendSearchQueryByList[listId] ?? ''
    if (query.trim().length < 2) {
      setAppendSearchResultsByList((current) => ({ ...current, [listId]: [] }))
      setAppendSearchErrorByList((current) => ({ ...current, [listId]: null }))
      return
    }

    setAppendSearchingByList((current) => ({ ...current, [listId]: true }))
    try {
      const results = await searchMovies(query)
      setAppendSearchResultsByList((current) => ({ ...current, [listId]: results }))
      setAppendSearchErrorByList((current) => ({ ...current, [listId]: null }))
    } catch (err) {
      setAppendSearchResultsByList((current) => ({ ...current, [listId]: [] }))
      setAppendSearchErrorByList((current) => ({
        ...current,
        [listId]: err instanceof Error ? err.message : t('common.error'),
      }))
    } finally {
      setAppendSearchingByList((current) => ({ ...current, [listId]: false }))
    }
  }

  async function handleSelectListMovie(listId: string, movie: TheaterMovieSearchResult) {
    const created = await appendListItem(listId, {
      tmdb_id: movie.tmdb_id,
      title_en: movie.title_en,
      title_zh: movie.title_zh,
      poster_url: movie.poster_url,
      genres: movie.genres,
      runtime_minutes: movie.runtime_minutes,
      match_tags: [],
      note: null,
    })

    if (created) {
      setAppendSearchQueryByList((current) => ({ ...current, [listId]: '' }))
      setAppendSearchResultsByList((current) => ({ ...current, [listId]: [] }))
      setAppendSearchErrorByList((current) => ({ ...current, [listId]: null }))
    }
  }

  async function handlePostListReply(listId: string) {
    const created = await postListReply(listId, draftReplyByList[listId] ?? '')
    if (created) {
      setDraftReplyByList((current) => ({ ...current, [listId]: '' }))
    }
  }

  async function handleSaveListItemNote(listId: string, itemId: string) {
    const saved = await updateListItemNote(listId, itemId, draftNoteByItem[itemId] ?? '')
    if (saved) {
      setDraftNoteByItem((current) => ({
        ...current,
        [itemId]: draftNoteByItem[itemId] ?? '',
      }))
    }
  }

  async function handleMoveListItem(listId: string, itemId: string, direction: 'up' | 'down') {
    const targetList = lists.find((entry) => entry.id === listId)
    if (!targetList) return

    const currentIndex = targetList.items.findIndex((item) => item.id === itemId)
    if (currentIndex === -1) return

    const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (nextIndex < 0 || nextIndex >= targetList.items.length) return

    const nextOrder = [...targetList.items]
    const [moved] = nextOrder.splice(currentIndex, 1)
    nextOrder.splice(nextIndex, 0, moved)
    await reorderListItems(listId, nextOrder.map((item) => item.id))
  }

  if (isLoading) {
    return <div className={styles.state}>{t('common.loading')}</div>
  }

  if (error || !group) {
    return (
      <div className={styles.state}>
        <p>{error || t('common.error')}</p>
        <Link href="/theaters" prefetch={false} className={styles.backLink}>{t('common.back')}</Link>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <Link href="/theaters" prefetch={false} className={styles.backLink}>{t('common.back')}</Link>
        <p className={styles.eyebrow}>[ THEATER_FILE ]</p>
        <div className={styles.titleRow}>
          <div>
            <h1 className={styles.title}>{group.name}</h1>
            <p className={styles.subtitle}>{group.subtitle}</p>
          </div>
          <span className={styles.memberBadge}>
            <i className="ri-group-line" /> {group.member_count}
          </span>
        </div>
        <div className={styles.actionRow}>
          {group.is_member ? (
            <button className={styles.secondaryBtn} disabled={isMutating} onClick={() => void leaveGroup()}>
              {t('theaters.leave')}
            </button>
          ) : (
            <button className={styles.primaryBtn} disabled={isMutating} onClick={() => void joinGroup()}>
              {t('theaters.join')}
            </button>
          )}
          <button className={styles.secondaryBtn} disabled={isLoading || isMutating} onClick={() => void loadGroup()}>
            {t('error.retry')}
          </button>
        </div>
        {error && <p className={styles.errorText}>{error}</p>}
      </div>

      <section className={styles.section}>
        <p className={styles.label}>{t('theaters.fit')}</p>
        <div className={styles.tags}>
          {group.shared_tags.map((tag) => (
            <span key={tag} className={styles.tag}>{getTagLabel(tag, locale)}</span>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <p className={styles.label}>{t('theaters.recommended')}</p>
        <div className={styles.list}>
          {group.recommended_movies.map((movie) => (
            <article key={movie.tmdb_id} className={styles.item}>
              <p className={styles.itemTitle}>{movie.title_en}</p>
              <div className={styles.tags}>
                {movie.match_tags.map((tag) => (
                  <span key={`${movie.tmdb_id}-${tag}`} className={styles.tag}>{getTagLabel(tag, locale)}</span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <p className={styles.label}>{t('theaters.watchlist')}</p>
        <div className={styles.list}>
          {group.shared_watchlist.map((movie) => (
            <article key={movie.tmdb_id} className={styles.item}>
              <div className={styles.itemRow}>
                <p className={styles.itemTitle}>{movie.title_en}</p>
                <span className={styles.supporterBadge}>{t('theaters.supporters', { count: movie.supporter_count })}</span>
              </div>
              <div className={styles.tags}>
                {movie.match_tags.map((tag) => (
                  <span key={`${movie.tmdb_id}-${tag}`} className={styles.tag}>{getTagLabel(tag, locale)}</span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <p className={styles.label}>{t('theaters.userLists')}</p>
        <div className={styles.list}>
          {lists.length > 0 ? lists.map((list) => (
            <article key={list.id} className={styles.item}>
              <div className={styles.itemRow}>
                <div>
                  <p className={styles.itemTitle}>{list.title}</p>
                  <p className={styles.meta}>{t('theaters.listBy', { name: list.creator.name })}</p>
                </div>
                <div className={styles.listHeaderActions}>
                  <span className={styles.supporterBadge}>
                    {t('theaters.listItems', { count: list.items.length })}
                  </span>
                  {group.is_member && (
                    <>
                      <button
                        className={styles.inlineBtn}
                        disabled={isMutating}
                        onClick={() => setEditingListId((current) => current === list.id ? null : list.id)}
                      >
                        {editingListId === list.id ? t('common.cancel') : t('theaters.listEdit')}
                      </button>
                      <button
                        className={styles.inlineBtn}
                        disabled={isMutating}
                        onClick={() => void deleteList(list.id)}
                      >
                        {t('theaters.listDelete')}
                      </button>
                    </>
                  )}
                </div>
              </div>
              {group.is_member && editingListId === list.id && (
                <div className={styles.composer}>
                  <input
                    className={styles.input}
                    value={draftListMetaById[list.id]?.title ?? list.title}
                    onChange={(event) => setDraftListMetaById((current) => ({
                      ...current,
                      [list.id]: {
                        title: event.target.value,
                        description: current[list.id]?.description ?? list.description ?? '',
                      },
                    }))}
                    placeholder={t('theaters.listTitlePlaceholder')}
                  />
                  <textarea
                    className={styles.textarea}
                    value={draftListMetaById[list.id]?.description ?? list.description ?? ''}
                    onChange={(event) => setDraftListMetaById((current) => ({
                      ...current,
                      [list.id]: {
                        title: current[list.id]?.title ?? list.title,
                        description: event.target.value,
                      },
                    }))}
                    placeholder={t('theaters.listDescriptionPlaceholder')}
                  />
                  <button
                    className={styles.primaryBtn}
                    disabled={isMutating}
                    onClick={() => void handleUpdateList(list.id, list.title, list.description)}
                  >
                    {t('theaters.listUpdate')}
                  </button>
                </div>
              )}
              {list.description && <p className={styles.meta}>{list.description}</p>}
              {list.items.length > 0 && (
                <div className={styles.list}>
                  {list.items.map((item, index) => (
                    <div key={item.id} className={styles.item}>
                      <div className={styles.listItemRow}>
                        {item.poster_url ? (
                          <img
                            src={item.poster_url}
                            alt={item.title_zh || item.title_en}
                            className={styles.itemPoster}
                          />
                        ) : (
                          <div className={styles.itemPosterFallback}>
                            <span>{(item.title_zh || item.title_en).slice(0, 1)}</span>
                          </div>
                        )}
                        <div className={styles.itemContentBlock}>
                          <div className={styles.itemRow}>
                            <div>
                              <p className={styles.itemTitle}>{item.title_zh || item.title_en}</p>
                              {item.title_zh && item.title_en !== item.title_zh && (
                                <p className={styles.meta}>{item.title_en}</p>
                              )}
                            </div>
                            {group.is_member && (
                              <div className={styles.listHeaderActions}>
                                <button
                                  className={styles.inlineBtn}
                                  disabled={isMutating || index === 0}
                                  onClick={() => void handleMoveListItem(list.id, item.id, 'up')}
                                >
                                  {t('theaters.listItemMoveUp')}
                                </button>
                                <button
                                  className={styles.inlineBtn}
                                  disabled={isMutating || index === list.items.length - 1}
                                  onClick={() => void handleMoveListItem(list.id, item.id, 'down')}
                                >
                                  {t('theaters.listItemMoveDown')}
                                </button>
                                <button
                                  className={styles.inlineBtn}
                                  disabled={isMutating}
                                  onClick={() => void deleteListItem(list.id, item.id)}
                                >
                                  {t('theaters.listItemRemove')}
                                </button>
                              </div>
                            )}
                          </div>
                          {(item.genres.length > 0 || item.runtime_minutes) && (
                            <p className={styles.meta}>
                              {[item.genres.join(' / '), item.runtime_minutes ? `${item.runtime_minutes} min` : '']
                                .filter(Boolean)
                                .join(' • ')}
                            </p>
                          )}
                          {item.match_tags.length > 0 && (
                            <div className={styles.tags}>
                              {item.match_tags.map((tag) => (
                                <span key={`${item.id}-${tag}`} className={styles.tag}>{getTagLabel(tag, locale)}</span>
                              ))}
                            </div>
                          )}
                          {item.note && <p className={styles.itemNote}>{item.note}</p>}
                          {group.is_member && (
                            <div className={styles.itemNoteComposer}>
                              <input
                                className={styles.input}
                                value={draftNoteByItem[item.id] ?? item.note ?? ''}
                                onChange={(event) => setDraftNoteByItem((current) => ({
                                  ...current,
                                  [item.id]: event.target.value,
                                }))}
                                placeholder={t('theaters.listItemNotePlaceholder')}
                              />
                              <button
                                className={styles.secondaryBtn}
                                disabled={isMutating}
                                onClick={() => void handleSaveListItemNote(list.id, item.id)}
                              >
                                {t('theaters.listItemNoteSave')}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {group.is_member && (
                <div className={styles.composer}>
                  <input
                    className={styles.input}
                    value={draftItemByList[list.id] ?? ''}
                    onChange={(event) => setDraftItemByList((current) => ({
                      ...current,
                      [list.id]: event.target.value,
                    }))}
                    placeholder={t('theaters.listItemPlaceholder')}
                  />
                  <button
                    className={styles.secondaryBtn}
                    disabled={isMutating}
                    onClick={() => void handleAppendListItem(list.id)}
                  >
                    {t('theaters.listItemAdd')}
                  </button>
                </div>
              )}

              <div className={styles.replySection}>
                <p className={styles.label}>{t('theaters.listReplies')}</p>
                {list.replies.length > 0 ? (
                  <div className={styles.list}>
                    {list.replies.map((reply) => (
                      <div key={reply.id} className={styles.item}>
                        <div className={styles.itemRow}>
                          <p className={styles.meta}>{reply.user.name}</p>
                          {reply.can_delete && (
                            <button
                              className={styles.inlineBtn}
                              disabled={isMutating}
                              onClick={() => void deleteListReply(list.id, reply.id)}
                            >
                              {t('theaters.listReplyDelete')}
                            </button>
                          )}
                        </div>
                        <p className={styles.itemTitle}>{reply.body}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={styles.meta}>{t('theaters.listRepliesEmpty')}</p>
                )}
                {group.is_member && (
                  <div className={styles.composer}>
                    <input
                      className={styles.input}
                      value={draftReplyByList[list.id] ?? ''}
                      onChange={(event) => setDraftReplyByList((current) => ({
                        ...current,
                        [list.id]: event.target.value,
                      }))}
                      placeholder={t('theaters.listReplyPlaceholder')}
                    />
                    <button
                      className={styles.secondaryBtn}
                      disabled={isMutating}
                      onClick={() => void handlePostListReply(list.id)}
                    >
                      {t('theaters.listReplySend')}
                    </button>
                  </div>
                )}
              </div>
            </article>
          )) : (
            <p className={styles.meta}>{t('theaters.userListsEmpty')}</p>
          )}
        </div>

        {group.is_member && (
          <div className={styles.composer}>
            <input
              className={styles.input}
              value={draftListTitle}
              onChange={(event) => setDraftListTitle(event.target.value)}
              placeholder={t('theaters.listTitlePlaceholder')}
            />
            <textarea
              className={styles.textarea}
              value={draftListDescription}
              onChange={(event) => setDraftListDescription(event.target.value)}
              placeholder={t('theaters.listDescriptionPlaceholder')}
            />
            <textarea
              className={styles.textarea}
              value={draftListItems}
              onChange={(event) => setDraftListItems(event.target.value)}
              placeholder={t('theaters.listItemsPlaceholder')}
            />
            <button className={styles.primaryBtn} disabled={isMutating} onClick={() => void handleCreateList()}>
              {t('theaters.listCreate')}
            </button>
          </div>
        )}
      </section>

      <section className={styles.section}>
        <p className={styles.label}>{t('theaters.messages')}</p>
        <p className={styles.meta}>{t('theaters.messagesHint')}</p>
        {group.recent_messages.length > 0 ? (
          <div className={styles.list}>
            {group.recent_messages.map((message) => (
              <article key={message.id} className={styles.item}>
                <div className={styles.itemRow}>
                  <p className={styles.meta}>{message.user.name}</p>
                  {message.can_delete && (
                    <button className={styles.inlineBtn} disabled={isMutating} onClick={() => void deleteMessage(message.id)}>
                      {t('theaters.messageDelete')}
                    </button>
                  )}
                </div>
                <p className={styles.itemTitle}>{message.body}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className={styles.meta}>{t('theaters.messagesEmpty')}</p>
        )}

        {group.is_member && (
          <div className={styles.composer}>
            <textarea
              className={styles.textarea}
              value={draftMessage}
              onChange={(event) => setDraftMessage(event.target.value)}
              placeholder={t('theaters.messagePlaceholder')}
            />
            <button className={styles.primaryBtn} disabled={isMutating} onClick={() => void handlePostMessage()}>
              {t('theaters.messageSend')}
            </button>
          </div>
        )}
      </section>
    </div>
  )
}

export default function TheaterDetailPage() {
  return (
    <FlowGuard require="dna">
      <TheaterDetailContent />
    </FlowGuard>
  )
}
