'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useI18n } from '@/lib/i18n'
import { getTagLabel } from '@/lib/tagLabels'
import FlowGuard from '@/components/guards/FlowGuard'
import { useTheaterDetail } from './useTheaterDetail'
import styles from './page.module.css'

function TheaterDetailContent() {
  const { t, locale } = useI18n()
  const params = useParams<{ id: string }>()
  const [draftMessage, setDraftMessage] = useState('')
  const {
    group,
    error,
    isLoading,
    isMutating,
    loadGroup,
    joinGroup,
    leaveGroup,
    postMessage,
    deleteMessage,
  } = useTheaterDetail(params.id)

  async function handlePostMessage() {
    const posted = await postMessage(draftMessage)
    if (posted) {
      setDraftMessage('')
    }
  }

  if (isLoading) {
    return <div className={styles.state}>{t('common.loading')}</div>
  }

  if (error || !group) {
    return (
      <div className={styles.state}>
        <p>{error || t('common.error')}</p>
        <Link href="/theaters" className={styles.backLink}>{t('common.back')}</Link>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <Link href="/theaters" className={styles.backLink}>{t('common.back')}</Link>
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
        <p className={styles.label}>{t('theaters.messages')}</p>
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
          <div className={styles.composer}>
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
  )
}

export default function TheaterDetailPage() {
  return (
    <FlowGuard require="dna">
      <TheaterDetailContent />
    </FlowGuard>
  )
}
