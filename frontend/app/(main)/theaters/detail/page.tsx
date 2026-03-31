'use client'

import { api } from '@/lib/api'
import Link from 'next/link'
import { useRef, useState, type CSSProperties } from 'react'
import { useSearchParams } from 'next/navigation'
import { useI18n } from '@/lib/i18n'
import { getTagLabel } from '@/lib/tagLabels'
import type { TheaterMovieSearchResult } from '@/lib/theater-types'
import FlowGuard from '@/components/guards/FlowGuard'
import { useTheaterDetail } from './useTheaterDetail'
import styles from './page.module.css'

function TheaterDetailContent() {
  const { t, locale } = useI18n()
  const searchParams = useSearchParams()
  const groupId = searchParams.get('id') || ''
  const recommendedRailRef = useRef<HTMLDivElement | null>(null)
  const watchlistRailRef = useRef<HTMLDivElement | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'lists' | 'board'>('overview')
  const [activeOverviewPanel, setActiveOverviewPanel] = useState<'recommended' | 'watchlist'>('recommended')
  const [expandedListId, setExpandedListId] = useState<string | null>(null)
  const [expandedRepliesByList, setExpandedRepliesByList] = useState<Record<string, boolean>>({})
  const [isCreateListModalOpen, setIsCreateListModalOpen] = useState(false)
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
      setIsCreateListModalOpen(false)
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

  function scrollRail(panel: 'recommended' | 'watchlist', direction: 'prev' | 'next') {
    const rail = panel === 'recommended' ? recommendedRailRef.current : watchlistRailRef.current
    if (!rail) return

    const offset = Math.max(rail.clientWidth * 0.82, 260)
    rail.scrollBy({
      left: direction === 'next' ? offset : -offset,
      behavior: 'smooth',
    })
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
      <div className={styles.content}>
      <div className={styles.hero}>
        <Link href="/theaters" prefetch={false} className={styles.backLink}>
          <i className="ri-arrow-left-line" /> {t('common.back')}
        </Link>
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
              <i className="ri-logout-box-line" /> {t('theaters.leave')}
            </button>
          ) : (
            <button className={styles.primaryBtn} disabled={isMutating} onClick={() => void joinGroup()}>
              <i className="ri-add-line" /> {t('theaters.join')}
            </button>
          )}
          <button className={styles.secondaryBtn} disabled={isLoading || isMutating} onClick={() => void loadGroup()}>
            <i className="ri-refresh-line" /> {t('error.retry')}
          </button>
        </div>
        {error && <p className={styles.errorText}>{error}</p>}
      </div>

      <section className={styles.section}>
        <div className={styles.tabBar} role="tablist" aria-label={t('theaters.tabs')}>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'overview'}
            className={`${styles.tabButton} ${activeTab === 'overview' ? styles.tabButtonActive : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            {t('theaters.tabOverview')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'lists'}
            className={`${styles.tabButton} ${activeTab === 'lists' ? styles.tabButtonActive : ''}`}
            onClick={() => setActiveTab('lists')}
          >
            {t('theaters.tabLists')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'board'}
            className={`${styles.tabButton} ${activeTab === 'board' ? styles.tabButtonActive : ''}`}
            onClick={() => setActiveTab('board')}
          >
            {t('theaters.tabBoard')}
          </button>
        </div>
      </section>

      {activeTab === 'overview' && (
        <>
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <p className={styles.label}>{t('theaters.fit')}</p>
            </div>
            <div className={styles.tags}>
              {group.shared_tags.map((tag) => (
                <span key={tag} className={styles.tag}>{getTagLabel(tag, locale)}</span>
              ))}
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <p className={styles.label}>{t('theaters.tabOverview')}</p>
              <p className={styles.detailText}>Switch between this room&apos;s starter shelf and its shared pull list.</p>
            </div>
            <div className={styles.panelTabs} role="tablist" aria-label={`${group.name} overview panels`}>
              <button
                type="button"
                role="tab"
                aria-selected={activeOverviewPanel === 'recommended'}
                className={`${styles.panelTab} ${activeOverviewPanel === 'recommended' ? styles.panelTabActive : ''}`}
                onClick={() => setActiveOverviewPanel('recommended')}
              >
                {t('theaters.recommended')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeOverviewPanel === 'watchlist'}
                className={`${styles.panelTab} ${activeOverviewPanel === 'watchlist' ? styles.panelTabActive : ''}`}
                onClick={() => setActiveOverviewPanel('watchlist')}
              >
                {t('theaters.watchlist')}
              </button>
            </div>

            {activeOverviewPanel === 'recommended' && (
              group.recommended_movies.length > 0 ? (
                <div className={styles.carouselSection}>
                  {group.recommended_movies.length > 1 && (
                    <div className={styles.railControls} aria-label={t('theaters.carouselControls', { shelf: t('theaters.recommended') })}>
                      <button
                        type="button"
                        className={styles.railButton}
                        onClick={() => scrollRail('recommended', 'prev')}
                        aria-label={t('theaters.carouselPrevious', { shelf: t('theaters.recommended') })}
                      >
                        <i className="ri-arrow-left-s-line" />
                      </button>
                      <button
                        type="button"
                        className={styles.railButton}
                        onClick={() => scrollRail('recommended', 'next')}
                        aria-label={t('theaters.carouselNext', { shelf: t('theaters.recommended') })}
                      >
                        <i className="ri-arrow-right-s-line" />
                      </button>
                    </div>
                  )}
                  <div
                    ref={recommendedRailRef}
                    className={styles.horizontalRail}
                    aria-label={t('theaters.carouselShelf', { shelf: t('theaters.recommended') })}
                  >
                    {group.recommended_movies.map((movie) => (
                      <article key={movie.tmdb_id} className={styles.movieRailCard}>
                        {movie.poster_url ? (
                          <img
                            className={styles.movieRailPoster}
                            src={movie.poster_url}
                            alt={movie.title_en}
                          />
                        ) : (
                          <div className={styles.movieRailPosterFallback} aria-hidden="true">
                            <i className="ri-film-line" />
                          </div>
                        )}
                        <div className={styles.movieRailBody}>
                          <p className={styles.itemTitle}>{movie.title_en}</p>
                          <div className={styles.tags}>
                            {movie.match_tags.map((tag) => (
                              <span key={`${movie.tmdb_id}-${tag}`} className={styles.tag}>{getTagLabel(tag, locale)}</span>
                            ))}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ) : (
                <div className={styles.emptyStateCard}>
                  <div className={styles.emptyStateIcon} aria-hidden="true">
                    <i className="ri-clapperboard-line" />
                  </div>
                  <p className={styles.emptyStateTitle}>{group.name}</p>
                  <p className={styles.detailText}>This room is still building its opening lineup.</p>
                </div>
              )
            )}

            {activeOverviewPanel === 'watchlist' && (
              group.shared_watchlist.length > 0 ? (
                <div className={styles.carouselSection}>
                  {group.shared_watchlist.length > 1 && (
                    <div className={styles.railControls} aria-label={t('theaters.carouselControls', { shelf: t('theaters.watchlist') })}>
                      <button
                        type="button"
                        className={styles.railButton}
                        onClick={() => scrollRail('watchlist', 'prev')}
                        aria-label={t('theaters.carouselPrevious', { shelf: t('theaters.watchlist') })}
                      >
                        <i className="ri-arrow-left-s-line" />
                      </button>
                      <button
                        type="button"
                        className={styles.railButton}
                        onClick={() => scrollRail('watchlist', 'next')}
                        aria-label={t('theaters.carouselNext', { shelf: t('theaters.watchlist') })}
                      >
                        <i className="ri-arrow-right-s-line" />
                      </button>
                    </div>
                  )}
                  <div
                    ref={watchlistRailRef}
                    className={styles.horizontalRail}
                    aria-label={t('theaters.carouselShelf', { shelf: t('theaters.watchlist') })}
                  >
                    {group.shared_watchlist.map((movie) => (
                      <article key={movie.tmdb_id} className={styles.movieRailCard}>
                        {movie.poster_url ? (
                          <img
                            className={styles.movieRailPoster}
                            src={movie.poster_url}
                            alt={movie.title_en}
                          />
                        ) : (
                          <div className={styles.movieRailPosterFallback} aria-hidden="true">
                            <i className="ri-film-line" />
                          </div>
                        )}
                        <div className={styles.movieRailBody}>
                          <div className={styles.itemRow}>
                            <p className={styles.itemTitle}>{movie.title_en}</p>
                            <span className={styles.supporterBadge}>{t('theaters.supporters', { count: movie.supporter_count })}</span>
                          </div>
                          <div className={styles.tags}>
                            {movie.match_tags.map((tag) => (
                              <span key={`${movie.tmdb_id}-${tag}`} className={styles.tag}>{getTagLabel(tag, locale)}</span>
                            ))}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ) : (
                <div className={styles.emptyStateCard}>
                  <div className={styles.emptyStateIcon} aria-hidden="true">
                    <i className="ri-group-line" />
                  </div>
                  <p className={styles.emptyStateTitle}>No shared watchlist yet.</p>
                  <p className={styles.detailText}>Once the room starts aligning on titles, this shelf will fill in.</p>
                </div>
              )
            )}
          </section>
        </>
      )}

      {activeTab === 'lists' && (
        <section className={styles.section}>
        <p className={styles.label}>{t('theaters.userLists')}</p>
        {group.is_member && (
          <div className={styles.sectionActions}>
            <button
              type="button"
              className={styles.primaryBtn}
              disabled={isMutating}
              onClick={() => setIsCreateListModalOpen(true)}
            >
              <i className="ri-add-line" /> {t('theaters.listCreate')}
            </button>
          </div>
        )}
        <div className={styles.listGrid}>
          {lists.length > 0 ? lists.map((list) => (
            <article key={list.id} className={`${styles.listCard} ${expandedListId === list.id ? styles.listExpanded : ''}`}>
              <div className={styles.listHeader}>
                <div className={styles.listHeaderCopy}>
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
                        onClick={() => {
                          setExpandedListId(list.id)
                          setEditingListId((current) => current === list.id ? null : list.id)
                        }}
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
                  <button
                    className={styles.inlineBtn}
                    disabled={isMutating}
                    onClick={() => setExpandedListId((current) => current === list.id ? null : list.id)}
                  >
                    {expandedListId === list.id ? t('theaters.listCollapse') : t('theaters.listExpand')}
                  </button>
                </div>
              </div>
              <div className={styles.listHero}>
                <div className={styles.posterStack} aria-hidden="true">
                  {list.items.slice(0, 3).map((item, index) => (
                    item.poster_url ? (
                      <img
                        key={item.id}
                        className={styles.posterStackCard}
                        src={item.poster_url}
                        alt=""
                        style={{ ['--stack-index' as string]: index } as CSSProperties}
                      />
                    ) : (
                      <div
                        key={item.id}
                        className={styles.posterStackFallback}
                        style={{ ['--stack-index' as string]: index } as CSSProperties}
                      >
                        <i className="ri-film-line" />
                      </div>
                    )
                  ))}
                  {list.items.length === 0 && (
                    <div className={styles.posterStackEmpty}>
                      <i className="ri-film-line" />
                    </div>
                  )}
                </div>
                <div className={styles.listHeroCopy}>
                  {list.description ? (
                    <p className={styles.listDescription}>{list.description}</p>
                  ) : (
                    <p className={styles.detailText}>{t('theaters.listItems', { count: list.items.length })}</p>
                  )}
                  <div className={styles.listSummaryRow}>
                    <span className={styles.summaryChip}>{t('theaters.listItems', { count: list.items.length })}</span>
                    {list.items.length > 0 && (
                      <span className={styles.summaryChip}>
                        {(list.items[0].title_zh || list.items[0].title_en)}
                        {list.items.length > 1 ? ` +${list.items.length - 1}` : ''}
                      </span>
                    )}
                    <span className={styles.summaryChip}>{t('theaters.listRepliesCount', { count: list.replies.length })}</span>
                  </div>
                  <div className={styles.listMetaRow}>
                    <span className={styles.meta}>{t('theaters.listItems', { count: list.items.length })}</span>
                    {list.replies.length > 0 && (
                      <span className={styles.meta}>{t('theaters.listRepliesCount', { count: list.replies.length })}</span>
                    )}
                  </div>
                </div>
              </div>
              {expandedListId === list.id && (
                <>
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
                        rows={2}
                      />
                      <button
                        className={styles.secondaryBtn}
                        disabled={isMutating}
                        onClick={() => void handleUpdateList(list.id, list.title, list.description)}
                      >
                        {t('theaters.listUpdate')}
                      </button>
                    </div>
                  )}
                  {list.items.length > 0 && (
                    <div className={styles.itemList}>
                      {list.items.map((item) => (
                        <div key={item.id} className={styles.listItemRow}>
                          {item.poster_url ? (
                            <img
                              className={styles.itemPoster}
                              src={item.poster_url}
                              alt={item.title_zh || item.title_en}
                            />
                          ) : (
                            <div className={styles.itemPosterFallback} aria-hidden="true">
                              <i className="ri-film-line" />
                            </div>
                          )}
                          <div className={styles.itemContentBlock}>
                            <div>
                              <p className={styles.itemTitle}>{item.title_zh || item.title_en}</p>
                              {item.title_zh && <p className={styles.meta}>{item.title_en}</p>}
                            </div>
                            {item.match_tags.length > 0 && (
                              <div className={styles.tags}>
                                {item.match_tags.map((tag) => (
                                  <span key={`${item.id}-${tag}`} className={styles.tag}>
                                    {getTagLabel(tag, locale)}
                                  </span>
                                ))}
                              </div>
                            )}
                            {item.note && <p className={styles.itemNote}>{item.note}</p>}
                            {group.is_member && (
                              <div className={styles.itemNoteComposer}>
                                <input
                                  className={styles.input}
                                  value={draftNoteByItem[item.id] ?? item.note ?? ''}
                                  onChange={(event) => setDraftNoteByItem((current) => ({ ...current, [item.id]: event.target.value }))}
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
                          <div className={styles.itemFooter}>
                            {group.is_member && (
                              <div className={styles.itemActions}>
                                <button
                                  className={styles.inlineBtn}
                                  disabled={isMutating || item.position === 0}
                                  onClick={() => void handleMoveListItem(list.id, item.id, 'up')}
                                >
                                  {t('theaters.listItemMoveUp')}
                                </button>
                                <button
                                  className={styles.inlineBtn}
                                  disabled={isMutating || item.position === list.items.length - 1}
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
                        </div>
                      ))}
                    </div>
                  )}
                  {group.is_member && (
                    <div className={styles.composer}>
                      <div className={styles.inlineComposer}>
                        <input
                          className={styles.input}
                          value={draftItemByList[list.id] ?? ''}
                          onChange={(event) => setDraftItemByList((current) => ({ ...current, [list.id]: event.target.value }))}
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
                      <div className={styles.searchComposer}>
                        <div className={styles.searchInputRow}>
                          <input
                            className={styles.input}
                            value={appendSearchQueryByList[list.id] ?? ''}
                            onChange={(event) => setAppendSearchQueryByList((current) => ({
                              ...current,
                              [list.id]: event.target.value,
                            }))}
                            placeholder={t('theaters.listMovieSearchPlaceholder')}
                          />
                          <button
                            className={styles.secondaryBtn}
                            disabled={isMutating || !!appendSearchingByList[list.id]}
                            onClick={() => void handleSearchListMovie(list.id)}
                          >
                            {appendSearchingByList[list.id] ? t('common.loading') : t('theaters.listMovieSearch')}
                          </button>
                        </div>
                        {appendSearchErrorByList[list.id] && (
                          <p className={styles.meta}>{appendSearchErrorByList[list.id]}</p>
                        )}
                        {(appendSearchResultsByList[list.id] ?? []).length > 0 && (
                          <div className={styles.searchResults}>
                            {(appendSearchResultsByList[list.id] ?? []).map((movie) => (
                              <button
                                key={movie.tmdb_id}
                                type="button"
                                className={styles.searchResultItem}
                                onClick={() => void handleSelectListMovie(list.id, movie)}
                              >
                                {movie.poster_url ? (
                                  <img
                                    src={movie.poster_url}
                                    alt={movie.title_zh || movie.title_en}
                                    className={styles.searchResultPoster}
                                  />
                                ) : (
                                  <div className={styles.searchResultPosterFallback}>
                                    <i className="ri-movie-line" />
                                  </div>
                                )}
                                <span className={styles.searchResultText}>
                                  {movie.title_zh || movie.title_en}
                                  {movie.year ? ` (${movie.year})` : ''}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <div className={styles.replyBlock}>
                    <div className={styles.replyHeader}>
                      <div>
                        <p className={styles.label}>{t('theaters.listReplies')}</p>
                        <p className={styles.meta}>{t('theaters.listRepliesCount', { count: list.replies.length })}</p>
                      </div>
                      <button
                        className={styles.inlineBtn}
                        disabled={isMutating}
                        onClick={() => setExpandedRepliesByList((current) => ({
                          ...current,
                          [list.id]: !current[list.id],
                        }))}
                      >
                        {expandedRepliesByList[list.id] ? t('theaters.listRepliesCollapse') : t('theaters.listRepliesExpand')}
                      </button>
                    </div>
                    {expandedRepliesByList[list.id] && (
                      <>
                        <div className={styles.list}>
                          {list.replies.length > 0 ? list.replies.map((reply) => (
                            <article key={reply.id} className={styles.replyItem}>
                              <div className={styles.itemRow}>
                                <p className={styles.itemTitle}>{reply.user.name}</p>
                                <div className={styles.itemRow}>
                                  <span className={styles.meta}>{new Date(reply.created_at).toLocaleString(locale)}</span>
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
                              </div>
                              <p className={styles.message}>{reply.body}</p>
                            </article>
                          )) : (
                            <div className={styles.inlineEmptyState}>
                              <p className={styles.meta}>{t('theaters.listRepliesEmpty')}</p>
                            </div>
                          )}
                        </div>
                        {group.is_member && (
                          <div className={styles.composer}>
                            <textarea
                              className={styles.textarea}
                              value={draftReplyByList[list.id] ?? ''}
                              onChange={(event) => setDraftReplyByList((current) => ({ ...current, [list.id]: event.target.value }))}
                              placeholder={t('theaters.listReplyPlaceholder')}
                              rows={2}
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
                      </>
                    )}
                  </div>
                </>
              )}
            </article>
          )) : (
            <div className={styles.emptyStateCard}>
              <div className={styles.emptyStateIcon} aria-hidden="true">
                <i className="ri-stack-line" />
              </div>
              <p className={styles.emptyStateTitle}>{t('theaters.userListsEmpty')}</p>
              <p className={styles.detailText}>Start the first list and give this room a point of view.</p>
            </div>
          )}
        </div>
        </section>
      )}

      {activeTab === 'board' && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <p className={styles.label}>{t('theaters.messages')}</p>
            <p className={styles.detailText}>{t('theaters.messagesHint')}</p>
          </div>
          <div className={styles.messageList}>
            {group.recent_messages.length > 0 ? group.recent_messages.map((message) => (
              <article key={message.id} className={styles.messageItem}>
                <div className={styles.messageMeta}>
                  <p className={styles.itemTitle}>{message.user.name}</p>
                  <div className={styles.messageMeta}>
                    <span className={styles.meta}>{new Date(message.created_at).toLocaleString(locale)}</span>
                    {message.can_delete && (
                      <button className={styles.inlineBtn} disabled={isMutating} onClick={() => void deleteMessage(message.id)}>
                        {t('theaters.messageDelete')}
                      </button>
                    )}
                  </div>
                </div>
                <p className={styles.messageBody}>{message.body}</p>
              </article>
            )) : (
              <div className={styles.emptyStateCard}>
                <div className={styles.emptyStateIcon} aria-hidden="true">
                  <i className="ri-chat-3-line" />
                </div>
                <p className={styles.emptyStateTitle}>{t('theaters.messagesEmpty')}</p>
                <p className={styles.detailText}>Open the thread with one short note about what this room should watch next.</p>
              </div>
            )}
          </div>
          {group.is_member && (
            <div className={styles.boardComposer}>
              <textarea
                className={styles.textarea}
                value={draftMessage}
                onChange={(event) => setDraftMessage(event.target.value)}
                placeholder={t('theaters.messagePlaceholder')}
                rows={3}
              />
              <div className={styles.boardComposerActions}>
                <span className={styles.meta}>{group.name}</span>
                <button className={styles.primaryBtn} disabled={isMutating} onClick={() => void handlePostMessage()}>
                  {t('theaters.messageSend')}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {isCreateListModalOpen && (
        <div className={styles.modalOverlay} role="presentation" onClick={() => setIsCreateListModalOpen(false)}>
          <div
            className={styles.modalPanel}
            role="dialog"
            aria-modal="true"
            aria-label={t('theaters.listCreate')}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.label}>{t('theaters.userLists')}</p>
                <h2 className={styles.modalTitle}>{t('theaters.listCreate')}</h2>
              </div>
              <button
                type="button"
                className={styles.inlineBtn}
                onClick={() => setIsCreateListModalOpen(false)}
              >
                {t('common.cancel')}
              </button>
            </div>
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
                rows={3}
              />
              <textarea
                className={styles.textarea}
                value={draftListItems}
                onChange={(event) => setDraftListItems(event.target.value)}
                placeholder={t('theaters.listItemsPlaceholder')}
                rows={4}
              />
              <div className={styles.searchComposer}>
                <div className={styles.searchInputRow}>
                  <input
                    className={styles.input}
                    value={draftSearchQuery}
                    onChange={(event) => setDraftSearchQuery(event.target.value)}
                    placeholder={t('theaters.listMovieSearchPlaceholder')}
                  />
                  <button
                    className={styles.secondaryBtn}
                    disabled={isMutating || isDraftSearching}
                    onClick={() => void handleSearchDraftMovies()}
                  >
                    {isDraftSearching ? t('common.loading') : t('theaters.listMovieSearch')}
                  </button>
                </div>
                {draftSearchError && <p className={styles.meta}>{draftSearchError}</p>}
                {draftSearchResults.length > 0 && (
                  <div className={styles.searchResults}>
                    {draftSearchResults.map((movie) => (
                      <button
                        key={movie.tmdb_id}
                        type="button"
                        className={styles.searchResultItem}
                        onClick={() => handleSelectDraftMovie(movie)}
                      >
                        {movie.poster_url ? (
                          <img
                            src={movie.poster_url}
                            alt={movie.title_zh || movie.title_en}
                            className={styles.searchResultPoster}
                          />
                        ) : (
                          <div className={styles.searchResultPosterFallback}>
                            <i className="ri-movie-line" />
                          </div>
                        )}
                        <span className={styles.searchResultText}>
                          {movie.title_zh || movie.title_en}
                          {movie.year ? ` (${movie.year})` : ''}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {draftSelectedMovies.length > 0 && (
                  <div className={styles.selectedMovieGrid}>
                    {draftSelectedMovies.map((movie) => (
                      <div key={movie.tmdb_id} className={styles.selectedMovieChip}>
                        <span>{movie.title_zh || movie.title_en}</span>
                        <button
                          type="button"
                          className={styles.inlineBtn}
                          onClick={() => handleRemoveDraftMovie(movie.tmdb_id)}
                        >
                          <i className="ri-close-line" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button className={styles.primaryBtn} disabled={isMutating} onClick={() => void handleCreateList()}>
                {t('theaters.listCreate')}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
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
