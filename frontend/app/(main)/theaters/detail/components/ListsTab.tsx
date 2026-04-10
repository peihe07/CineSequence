import { useState, type CSSProperties } from 'react'
import { useI18n } from '@/lib/i18n'
import { getTagLabel } from '@/lib/tagLabels'
import type { TheaterList } from '@/lib/theater-types'
import type { TheaterMovieSearchResult } from '@/lib/theater-types'
import { searchTheaterMovies } from '../movieSearchCache'
import styles from '../page.module.css'

interface ListsTabProps {
  lists: TheaterList[]
  isMember: boolean
  isMutating: boolean
  onCreateListClick: () => void
  onUpdateList: (listId: string, data: { title: string; description: string }) => Promise<boolean | undefined>
  onDeleteList: (listId: string) => void
  onAppendListItem: (listId: string, item: {
    tmdb_id: number; title_en: string; title_zh: string | null
    poster_url: string | null; genres: string[]; runtime_minutes: number | null
    match_tags: string[]; note: string | null
  } | string) => Promise<boolean | undefined>
  onDeleteListItem: (listId: string, itemId: string) => void
  onUpdateListItemNote: (listId: string, itemId: string, note: string) => Promise<boolean | undefined>
  onReorderListItems: (listId: string, itemIds: string[]) => void
  onPostListReply: (listId: string, body: string) => Promise<boolean | undefined>
  onDeleteListReply: (listId: string, replyId: string) => void
}

export default function ListsTab({
  lists,
  isMember,
  isMutating,
  onCreateListClick,
  onUpdateList,
  onDeleteList,
  onAppendListItem,
  onDeleteListItem,
  onUpdateListItemNote,
  onReorderListItems,
  onPostListReply,
  onDeleteListReply,
}: ListsTabProps) {
  const { t, locale } = useI18n()
  const [expandedListId, setExpandedListId] = useState<string | null>(null)
  const [expandedRepliesByList, setExpandedRepliesByList] = useState<Record<string, boolean>>({})
  const [editingListId, setEditingListId] = useState<string | null>(null)
  const [draftListMetaById, setDraftListMetaById] = useState<Record<string, { title: string; description: string }>>({})
  const [draftItemByList, setDraftItemByList] = useState<Record<string, string>>({})
  const [draftNoteByItem, setDraftNoteByItem] = useState<Record<string, string>>({})
  const [draftReplyByList, setDraftReplyByList] = useState<Record<string, string>>({})
  const [appendSearchQueryByList, setAppendSearchQueryByList] = useState<Record<string, string>>({})
  const [appendSearchResultsByList, setAppendSearchResultsByList] = useState<Record<string, TheaterMovieSearchResult[]>>({})
  const [appendSearchErrorByList, setAppendSearchErrorByList] = useState<Record<string, string | null>>({})
  const [appendSearchingByList, setAppendSearchingByList] = useState<Record<string, boolean>>({})

  async function handleUpdateList(listId: string, fallbackTitle: string, fallbackDescription: string | null) {
    const draft = draftListMetaById[listId]
    const saved = await onUpdateList(listId, {
      title: draft?.title ?? fallbackTitle,
      description: draft?.description ?? fallbackDescription ?? '',
    })
    if (saved) {
      setDraftListMetaById((current) => ({
        ...current,
        [listId]: { title: draft?.title ?? fallbackTitle, description: draft?.description ?? fallbackDescription ?? '' },
      }))
      setEditingListId(null)
    }
  }

  async function handleAppendListItem(listId: string) {
    const created = await onAppendListItem(listId, draftItemByList[listId] ?? '')
    if (created) setDraftItemByList((current) => ({ ...current, [listId]: '' }))
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
      const results = await searchTheaterMovies(query)
      setAppendSearchResultsByList((current) => ({ ...current, [listId]: results }))
      setAppendSearchErrorByList((current) => ({ ...current, [listId]: null }))
    } catch (err) {
      setAppendSearchResultsByList((current) => ({ ...current, [listId]: [] }))
      setAppendSearchErrorByList((current) => ({ ...current, [listId]: err instanceof Error ? err.message : t('common.error') }))
    } finally {
      setAppendSearchingByList((current) => ({ ...current, [listId]: false }))
    }
  }

  async function handleSelectListMovie(listId: string, movie: TheaterMovieSearchResult) {
    const created = await onAppendListItem(listId, {
      tmdb_id: movie.tmdb_id, title_en: movie.title_en, title_zh: movie.title_zh,
      poster_url: movie.poster_url, genres: movie.genres, runtime_minutes: movie.runtime_minutes,
      match_tags: [], note: null,
    })
    if (created) {
      setAppendSearchQueryByList((current) => ({ ...current, [listId]: '' }))
      setAppendSearchResultsByList((current) => ({ ...current, [listId]: [] }))
      setAppendSearchErrorByList((current) => ({ ...current, [listId]: null }))
    }
  }

  async function handlePostListReply(listId: string) {
    const created = await onPostListReply(listId, draftReplyByList[listId] ?? '')
    if (created) setDraftReplyByList((current) => ({ ...current, [listId]: '' }))
  }

  async function handleSaveItemNote(listId: string, itemId: string) {
    await onUpdateListItemNote(listId, itemId, draftNoteByItem[itemId] ?? '')
  }

  function handleMoveItem(listId: string, itemId: string, direction: 'up' | 'down') {
    const targetList = lists.find((entry) => entry.id === listId)
    if (!targetList) return
    const currentIndex = targetList.items.findIndex((item) => item.id === itemId)
    if (currentIndex === -1) return
    const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (nextIndex < 0 || nextIndex >= targetList.items.length) return
    const nextOrder = [...targetList.items]
    const [moved] = nextOrder.splice(currentIndex, 1)
    nextOrder.splice(nextIndex, 0, moved)
    onReorderListItems(listId, nextOrder.map((item) => item.id))
  }

  return (
    <section className={styles.section}>
      <p className={styles.label}>{t('theaters.userLists')}</p>
      {isMember && (
        <div className={styles.sectionActions}>
          <button type="button" className={styles.primaryBtn} disabled={isMutating} onClick={onCreateListClick}>
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
                <span className={styles.supporterBadge}>{t('theaters.listItems', { count: list.items.length })}</span>
                {isMember && (
                  <>
                    <button className={styles.inlineBtn} disabled={isMutating} onClick={() => { setExpandedListId(list.id); setEditingListId((c) => c === list.id ? null : list.id) }}>
                      {editingListId === list.id ? t('common.cancel') : t('theaters.listEdit')}
                    </button>
                    <button className={styles.inlineBtn} disabled={isMutating} onClick={() => void onDeleteList(list.id)}>
                      {t('theaters.listDelete')}
                    </button>
                  </>
                )}
                <button className={styles.inlineBtn} disabled={isMutating} onClick={() => setExpandedListId((c) => c === list.id ? null : list.id)}>
                  {expandedListId === list.id ? t('theaters.listCollapse') : t('theaters.listExpand')}
                </button>
              </div>
            </div>
            <div className={styles.listHero}>
              <div className={styles.posterStack} aria-hidden="true">
                {list.items.slice(0, 3).map((item, index) => (
                  item.poster_url ? (
                    <img key={item.id} className={styles.posterStackCard} src={item.poster_url} alt="" loading="lazy" decoding="async" style={{ ['--stack-index' as string]: index } as CSSProperties} />
                  ) : (
                    <div key={item.id} className={styles.posterStackFallback} style={{ ['--stack-index' as string]: index } as CSSProperties}>
                      <i className="ri-film-line" />
                    </div>
                  )
                ))}
                {list.items.length === 0 && (
                  <div className={styles.posterStackEmpty}><i className="ri-film-line" /></div>
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
                {isMember && editingListId === list.id && (
                  <div className={styles.composer}>
                    <input className={styles.input} value={draftListMetaById[list.id]?.title ?? list.title} onChange={(e) => setDraftListMetaById((c) => ({ ...c, [list.id]: { title: e.target.value, description: c[list.id]?.description ?? list.description ?? '' } }))} placeholder={t('theaters.listTitlePlaceholder')} />
                    <textarea className={styles.textarea} value={draftListMetaById[list.id]?.description ?? list.description ?? ''} onChange={(e) => setDraftListMetaById((c) => ({ ...c, [list.id]: { title: c[list.id]?.title ?? list.title, description: e.target.value } }))} placeholder={t('theaters.listDescriptionPlaceholder')} rows={2} />
                    <button className={styles.secondaryBtn} disabled={isMutating} onClick={() => void handleUpdateList(list.id, list.title, list.description)}>
                      {t('theaters.listUpdate')}
                    </button>
                  </div>
                )}
                {list.items.length > 0 && (
                  <div className={styles.itemList}>
                    {list.items.map((item) => (
                      <div key={item.id} className={styles.listItemRow}>
                        {item.poster_url ? (
                          <img className={styles.itemPoster} src={item.poster_url} alt={item.title_zh || item.title_en} loading="lazy" decoding="async" />
                        ) : (
                          <div className={styles.itemPosterFallback} aria-hidden="true"><i className="ri-film-line" /></div>
                        )}
                        <div className={styles.itemContentBlock}>
                          <div>
                            <p className={styles.itemTitle}>{item.title_zh || item.title_en}</p>
                            {item.title_zh && <p className={styles.meta}>{item.title_en}</p>}
                          </div>
                          {item.match_tags.length > 0 && (
                            <div className={styles.tags}>
                              {item.match_tags.map((tag) => (
                                <span key={`${item.id}-${tag}`} className={styles.tag}>{getTagLabel(tag, locale)}</span>
                              ))}
                            </div>
                          )}
                          {item.note && <p className={styles.itemNote}>{item.note}</p>}
                          {isMember && (
                            <div className={styles.itemNoteComposer}>
                              <input className={styles.input} value={draftNoteByItem[item.id] ?? item.note ?? ''} onChange={(e) => setDraftNoteByItem((c) => ({ ...c, [item.id]: e.target.value }))} placeholder={t('theaters.listItemNotePlaceholder')} />
                              <button className={styles.secondaryBtn} disabled={isMutating} onClick={() => void handleSaveItemNote(list.id, item.id)}>
                                {t('theaters.listItemNoteSave')}
                              </button>
                            </div>
                          )}
                        </div>
                        <div className={styles.itemFooter}>
                          {isMember && (
                            <div className={styles.itemActions}>
                              <button className={styles.inlineBtn} disabled={isMutating || item.position === 0} onClick={() => void handleMoveItem(list.id, item.id, 'up')}>
                                {t('theaters.listItemMoveUp')}
                              </button>
                              <button className={styles.inlineBtn} disabled={isMutating || item.position === list.items.length - 1} onClick={() => void handleMoveItem(list.id, item.id, 'down')}>
                                {t('theaters.listItemMoveDown')}
                              </button>
                              <button className={styles.inlineBtn} disabled={isMutating} onClick={() => void onDeleteListItem(list.id, item.id)}>
                                {t('theaters.listItemRemove')}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {isMember && (
                  <div className={styles.composer}>
                    <div className={styles.inlineComposer}>
                      <input className={styles.input} value={draftItemByList[list.id] ?? ''} onChange={(e) => setDraftItemByList((c) => ({ ...c, [list.id]: e.target.value }))} placeholder={t('theaters.listItemPlaceholder')} />
                      <button className={styles.secondaryBtn} disabled={isMutating} onClick={() => void handleAppendListItem(list.id)}>
                        {t('theaters.listItemAdd')}
                      </button>
                    </div>
                    <div className={styles.searchComposer}>
                      <div className={styles.searchInputRow}>
                        <input className={styles.input} value={appendSearchQueryByList[list.id] ?? ''} onChange={(e) => setAppendSearchQueryByList((c) => ({ ...c, [list.id]: e.target.value }))} placeholder={t('theaters.listMovieSearchPlaceholder')} />
                        <button className={styles.secondaryBtn} disabled={isMutating || !!appendSearchingByList[list.id]} onClick={() => void handleSearchListMovie(list.id)}>
                          {appendSearchingByList[list.id] ? t('common.loading') : t('theaters.listMovieSearch')}
                        </button>
                      </div>
                      {appendSearchErrorByList[list.id] && <p className={styles.meta}>{appendSearchErrorByList[list.id]}</p>}
                      {(appendSearchResultsByList[list.id] ?? []).length > 0 && (
                        <div className={styles.searchResults}>
                          {(appendSearchResultsByList[list.id] ?? []).map((movie) => (
                            <button key={movie.tmdb_id} type="button" className={styles.searchResultItem} onClick={() => void handleSelectListMovie(list.id, movie)}>
                              {movie.poster_url ? (
                                <img src={movie.poster_url} alt={movie.title_zh || movie.title_en} className={styles.searchResultPoster} loading="lazy" decoding="async" />
                              ) : (
                                <div className={styles.searchResultPosterFallback}><i className="ri-movie-line" /></div>
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
                    <button className={styles.inlineBtn} disabled={isMutating} onClick={() => setExpandedRepliesByList((c) => ({ ...c, [list.id]: !c[list.id] }))}>
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
                                  <button className={styles.inlineBtn} disabled={isMutating} onClick={() => void onDeleteListReply(list.id, reply.id)}>
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
                      {isMember && (
                        <div className={styles.composer}>
                          <textarea className={styles.textarea} value={draftReplyByList[list.id] ?? ''} onChange={(e) => setDraftReplyByList((c) => ({ ...c, [list.id]: e.target.value }))} placeholder={t('theaters.listReplyPlaceholder')} rows={2} />
                          <button className={styles.secondaryBtn} disabled={isMutating} onClick={() => void handlePostListReply(list.id)}>
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
            <div className={styles.emptyStateIcon} aria-hidden="true"><i className="ri-stack-line" /></div>
            <p className={styles.emptyStateTitle}>{t('theaters.userListsEmpty')}</p>
            <p className={styles.detailText}>Start the first list and give this room a point of view.</p>
          </div>
        )}
      </div>
    </section>
  )
}
