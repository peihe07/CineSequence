import { useState } from 'react'
import { useI18n } from '@/lib/i18n'
import styles from '../page.module.css'

interface Message {
  id: string
  body: string
  created_at: string
  user: { id: string; name: string; avatar_url: string | null }
  can_delete: boolean
}

interface BoardTabProps {
  messages: Message[]
  groupName: string
  isMember: boolean
  isMutating: boolean
  onPostMessage: (body: string) => Promise<boolean | undefined>
  onDeleteMessage: (id: string) => void
}

export default function BoardTab({
  messages,
  groupName,
  isMember,
  isMutating,
  onPostMessage,
  onDeleteMessage,
}: BoardTabProps) {
  const { t, locale } = useI18n()
  const [draftMessage, setDraftMessage] = useState('')

  async function handlePost() {
    const posted = await onPostMessage(draftMessage)
    if (posted) setDraftMessage('')
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <p className={styles.label}>{t('theaters.messages')}</p>
        <p className={styles.detailText}>{t('theaters.messagesHint')}</p>
      </div>
      <div className={styles.messageList}>
        {messages.length > 0 ? messages.map((message) => (
          <article key={message.id} className={styles.messageItem}>
            <div className={styles.messageMeta}>
              <p className={styles.itemTitle}>{message.user.name}</p>
              <div className={styles.messageMeta}>
                <span className={styles.meta}>{new Date(message.created_at).toLocaleString(locale)}</span>
                {message.can_delete && (
                  <button className={styles.inlineBtn} disabled={isMutating} onClick={() => void onDeleteMessage(message.id)}>
                    {t('theaters.messageDelete')}
                  </button>
                )}
              </div>
            </div>
            <p className={styles.messageBody}>{message.body}</p>
          </article>
        )) : (
          <div className={styles.emptyStateCard}>
            <div className={styles.emptyStateIcon} aria-hidden="true"><i className="ri-chat-3-line" /></div>
            <p className={styles.emptyStateTitle}>{t('theaters.messagesEmpty')}</p>
            <p className={styles.detailText}>Open the thread with one short note about what this room should watch next.</p>
          </div>
        )}
      </div>
      {isMember && (
        <div className={styles.boardComposer}>
          <textarea
            className={styles.textarea}
            value={draftMessage}
            onChange={(event) => setDraftMessage(event.target.value)}
            placeholder={t('theaters.messagePlaceholder')}
            rows={3}
          />
          <div className={styles.boardComposerActions}>
            <span className={styles.meta}>{groupName}</span>
            <button className={styles.primaryBtn} disabled={isMutating} onClick={() => void handlePost()}>
              {t('theaters.messageSend')}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
