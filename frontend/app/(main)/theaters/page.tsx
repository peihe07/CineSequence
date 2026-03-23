'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useGroupStore } from '@/stores/groupStore'
import { useI18n } from '@/lib/i18n'
import { getTagLabel } from '@/lib/tagLabels'
import FlowGuard from '@/components/guards/FlowGuard'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import styles from './page.module.css'

interface GroupItem {
  id: string
  name: string
  subtitle: string
  icon: string
  primary_tags: string[]
  is_hidden: boolean
  member_count: number
  is_active: boolean
  is_member: boolean
}

function GroupCard({ group, onJoin, onLeave }: {
  group: GroupItem
  onJoin: () => void
  onLeave: () => void
}) {
  const { t, locale } = useI18n()

  return (
    <motion.div
      className={styles.card}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className={styles.cardHeader}>
        <div className={styles.groupInfo}>
          <i className={`${group.icon} ${styles.groupIcon}`} />
          <div className={styles.groupText}>
            <span className={styles.groupName}>{group.name}</span>
            <span className={styles.groupSubtitle}>{group.subtitle}</span>
          </div>
        </div>
        <span className={styles.memberBadge}>
          <i className="ri-group-line" />
          {group.member_count}
        </span>
      </div>

      <div className={styles.tags}>
        {group.primary_tags.map((tag) => (
          <span key={tag} className={styles.tag}>
            {getTagLabel(tag, locale)}
          </span>
        ))}
      </div>

      <div className={styles.statusRow}>
        {group.is_hidden && (
          <span className={styles.hiddenBadge}>
            <i className="ri-eye-off-line" /> {t('theaters.hidden')}
          </span>
        )}
        {group.is_active ? (
          <span className={styles.activeBadge}>
            <i className="ri-checkbox-circle-line" /> {t('theaters.active')}
          </span>
        ) : (
          <span className={styles.inactiveBadge}>
            <i className="ri-time-line" /> {t('theaters.inactive')}
          </span>
        )}
      </div>

      <div className={styles.cardActions}>
        {group.is_member ? (
          <button className={styles.leaveBtn} onClick={onLeave}>
            <i className="ri-logout-box-line" /> {t('theaters.leave')}
          </button>
        ) : (
          <button className={styles.joinBtn} onClick={onJoin}>
            <i className="ri-add-line" /> {t('theaters.join')}
          </button>
        )}
      </div>
    </motion.div>
  )
}

export default function TheatersPage() {
  return (
    <FlowGuard require="dna">
      <TheatersContent />
    </FlowGuard>
  )
}

function TheatersContent() {
  const { t } = useI18n()
  const { groups, isLoading, fetchGroups, autoAssign, joinGroup, leaveGroup } = useGroupStore()
  const [leaveTarget, setLeaveTarget] = useState<string | null>(null)

  useEffect(() => {
    fetchGroups()
  }, [fetchGroups])

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <section className={`${styles.section} ${styles.heroSection}`}>
          <span className={styles.sideLabel}>FILE 06</span>
          <div className={styles.header}>
            <h1 className={styles.title}>{t('theaters.title')}</h1>
            <button
              className={styles.assignBtn}
              onClick={autoAssign}
              disabled={isLoading}
            >
              <i className="ri-magic-line" />
              {isLoading ? t('common.loading') : t('theaters.autoAssign')}
            </button>
          </div>
          <p className={styles.deck}>
            Shared viewing rooms arranged by cinematic DNA, ready for assignment, entry, and reveal.
          </p>
        </section>

        <section className={`${styles.section} ${styles.resultsSection}`}>
          {isLoading && (
            <div className={styles.loading}>
              <i className="ri-loader-4-line ri-spin ri-2x" />
            </div>
          )}

          {!isLoading && groups.length === 0 && (
            <div className={styles.empty}>
              <i className="ri-film-line ri-3x" />
              <p>{t('theaters.empty')}</p>
              <p className={styles.emptyHint}>{t('theaters.emptyHint')}</p>
              <button
                className={styles.assignBtn}
                onClick={autoAssign}
                disabled={isLoading}
                style={{ marginTop: '0.5rem' }}
              >
                <i className="ri-magic-line" />
                {t('theaters.autoAssign')}
              </button>
            </div>
          )}

          <div className={styles.grid}>
            {groups.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                onJoin={() => joinGroup(group.id)}
                onLeave={() => setLeaveTarget(group.id)}
              />
            ))}
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={leaveTarget !== null}
        message={t('confirm.leaveGroup')}
        onConfirm={() => {
          if (leaveTarget) leaveGroup(leaveTarget)
          setLeaveTarget(null)
        }}
        onCancel={() => setLeaveTarget(null)}
      />
    </div>
  )
}
