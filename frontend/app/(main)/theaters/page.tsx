'use client'

import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { useGroupStore } from '@/stores/groupStore'
import { useI18n } from '@/lib/i18n'
import styles from './page.module.css'

const TAG_ZH: Record<string, string> = {
  twist: '反轉結局', mindfuck: '燒腦', slowburn: '慢熱', ensemble: '群戲',
  solo: '獨角戲', visualFeast: '視覺饗宴', dialogue: '對白精彩', tearjerker: '催淚',
  darkTone: '黑暗', uplifting: '正能量', philosophical: '哲學思辨', satirical: '社會諷刺',
  nostalgic: '懷舊', experimental: '實驗性', cult: '邪典', comingOfAge: '成長故事',
  revenge: '復仇', heist: '精密計畫', survival: '生存掙扎', timeTravel: '時空穿越',
  dystopia: '反烏托邦', trueStory: '真實事件', nonEnglish: '非英語',
  existential: '存在主義', antiHero: '反英雄', romanticCore: '浪漫內核',
  violentAesthetic: '暴力美學', socialCritique: '社會批判', psychoThriller: '心理驚悚',
  absurdist: '荒誕',
}

const TAG_EN: Record<string, string> = {
  twist: 'Plot twist', mindfuck: 'Mind-bending', slowburn: 'Slow burn', ensemble: 'Ensemble',
  solo: 'Solo act', visualFeast: 'Visual feast', dialogue: 'Sharp dialogue', tearjerker: 'Tearjerker',
  darkTone: 'Dark', uplifting: 'Uplifting', philosophical: 'Philosophical', satirical: 'Satirical',
  nostalgic: 'Nostalgic', experimental: 'Experimental', cult: 'Cult', comingOfAge: 'Coming of age',
  revenge: 'Revenge', heist: 'Heist', survival: 'Survival', timeTravel: 'Time travel',
  dystopia: 'Dystopia', trueStory: 'True story', nonEnglish: 'Non-English',
  existential: 'Existential', antiHero: 'Anti-hero', romanticCore: 'Romantic',
  violentAesthetic: 'Violent aesthetic', socialCritique: 'Social critique', psychoThriller: 'Psychological',
  absurdist: 'Absurdist',
}

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
  const tagMap = locale === 'zh' ? TAG_ZH : TAG_EN

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
            {tagMap[tag] || tag}
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
  const { t } = useI18n()
  const { groups, isLoading, fetchGroups, autoAssign, joinGroup, leaveGroup } = useGroupStore()

  useEffect(() => {
    fetchGroups()
  }, [fetchGroups])

  return (
    <div className={styles.container}>
      <div className={styles.content}>
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
          </div>
        )}

        <div className={styles.grid}>
          {groups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              onJoin={() => joinGroup(group.id)}
              onLeave={() => leaveGroup(group.id)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
