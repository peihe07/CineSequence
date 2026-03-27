'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useI18n } from '@/lib/i18n'
import { getTagLabel } from '@/lib/tagLabels'
import FlowGuard from '@/components/guards/FlowGuard'
import { useTheaterDetail } from './useTheaterDetail'
import styles from './page.module.css'

function TheaterDetailContent() {
  const { t, locale } = useI18n()
  const searchParams = useSearchParams()
  const groupId = searchParams.get('id') || ''
  const [draftMessage, setDraftMessage] = useState('')
  const [draftListTitle, setDraftListTitle] = useState('')
  const [draftListDescription, setDraftListDescription] = useState('')
  const [draftListItems, setDraftListItems] = useState('')
  const [draftListMetaById, setDraftListMetaById] = useState<Record<string, { title: string; description: string }>>({})
  const [editingListId, setEditingListId] = useState<string | null>(null)
  const [draftItemByList, setDraftItemByList] = useState<Record<string, string>>({})
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
    })
    if (created) {
      setDraftListTitle('')
      setDraftListDescription('')
      setDraftListItems('')
    }
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
              {list.description && <p className={styles.message}>{list.description}</p>}
              {list.items.length > 0 && (
                <div className={styles.itemList}>
                  {list.items.map((item) => (
                    <div key={item.id} className={styles.listItemRow}>
                      <div className={styles.itemContentBlock}>
                        <span className={styles.tag}>{item.title_en}</span>
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
                  ))}
                </div>
              )}
              {group.is_member && (
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
              )}
              <div className={styles.replyBlock}>
                <p className={styles.label}>{t('theaters.listReplies')}</p>
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
                    <p className={styles.meta}>{t('theaters.listRepliesEmpty')}</p>
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
              rows={3}
            />
            <textarea
              className={styles.textarea}
              value={draftListItems}
              onChange={(event) => setDraftListItems(event.target.value)}
              placeholder={t('theaters.listItemsPlaceholder')}
              rows={4}
            />
            <button className={styles.primaryBtn} disabled={isMutating} onClick={() => void handleCreateList()}>
              {t('theaters.listCreate')}
            </button>
          </div>
        )}
      </section>

      <section className={`${styles.section} ${styles.legacySection}`}>
        <div className={styles.sectionHeader}>
          <p className={styles.label}>{t('theaters.messages')}</p>
          <p className={styles.detailText}>{t('theaters.messagesHint')}</p>
        </div>
        <div className={styles.list}>
          {group.recent_messages.length > 0 ? group.recent_messages.map((message) => (
            <article key={message.id} className={styles.item}>
              <div className={styles.itemRow}>
                <p className={styles.itemTitle}>{message.user.name}</p>
                <div className={styles.itemRow}>
                  <span className={styles.meta}>{new Date(message.created_at).toLocaleString(locale)}</span>
                  {message.can_delete && (
                    <button className={styles.inlineBtn} disabled={isMutating} onClick={() => void deleteMessage(message.id)}>
                      {t('theaters.messageDelete')}
                    </button>
                  )}
                </div>
              </div>
              <p className={styles.message}>{message.body}</p>
            </article>
          )) : (
            <p className={styles.meta}>{t('theaters.messagesEmpty')}</p>
          )}
        </div>
        {group.is_member && (
          <div className={`${styles.composer} ${styles.legacyComposer}`}>
            <textarea
              className={styles.textarea}
              value={draftMessage}
              onChange={(event) => setDraftMessage(event.target.value)}
              placeholder={t('theaters.messagePlaceholder')}
              rows={3}
            />
            <button className={styles.primaryBtn} disabled={isMutating} onClick={() => void handlePostMessage()}>
              {t('theaters.messageSend')}
            </button>
          </div>
        )}
      </section>
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
