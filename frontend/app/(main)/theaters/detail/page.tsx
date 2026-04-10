'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useI18n } from '@/lib/i18n'
import FlowGuard from '@/components/guards/FlowGuard'
import { useTheaterDetail } from './useTheaterDetail'
import styles from './page.module.css'
import TheaterHero from './components/TheaterHero'
import TheaterTabBar, { type TabId } from './components/TheaterTabBar'
import OverviewTab from './components/OverviewTab'
import ListsTab from './components/ListsTab'
import BoardTab from './components/BoardTab'
import CreateListModal from './components/CreateListModal'

function TheaterDetailContent() {
  const { t } = useI18n()
  const searchParams = useSearchParams()
  const groupId = searchParams.get('id') || ''
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [isCreateListModalOpen, setIsCreateListModalOpen] = useState(false)

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
        <TheaterHero
          group={group}
          error={error}
          isLoading={isLoading}
          isMutating={isMutating}
          onJoin={() => void joinGroup()}
          onLeave={() => void leaveGroup()}
          onRefresh={() => void loadGroup()}
        />

        <TheaterTabBar activeTab={activeTab} onTabChange={setActiveTab} />

        {activeTab === 'overview' && (
          <OverviewTab
            sharedTags={group.shared_tags}
            recommendedMovies={group.recommended_movies}
            sharedWatchlist={group.shared_watchlist}
            groupName={group.name}
          />
        )}

        {activeTab === 'lists' && (
          <ListsTab
            lists={lists}
            isMember={group.is_member}
            isMutating={isMutating}
            onCreateListClick={() => setIsCreateListModalOpen(true)}
            onUpdateList={updateList}
            onDeleteList={deleteList}
            onAppendListItem={appendListItem}
            onDeleteListItem={deleteListItem}
            onUpdateListItemNote={updateListItemNote}
            onReorderListItems={reorderListItems}
            onPostListReply={postListReply}
            onDeleteListReply={deleteListReply}
          />
        )}

        {activeTab === 'board' && (
          <BoardTab
            messages={group.recent_messages}
            groupName={group.name}
            isMember={group.is_member}
            isMutating={isMutating}
            onPostMessage={postMessage}
            onDeleteMessage={deleteMessage}
          />
        )}

        {isCreateListModalOpen && (
          <CreateListModal
            isMutating={isMutating}
            onClose={() => setIsCreateListModalOpen(false)}
            onCreate={createList}
          />
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
