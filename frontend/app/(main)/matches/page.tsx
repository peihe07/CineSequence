'use client'

import { Suspense, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { useMatchStore, MatchItem } from '@/stores/matchStore'
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

function MatchCard({ match, onInvite, onRespond, highlighted }: {
  match: MatchItem
  onInvite: () => void
  onRespond: (accept: boolean) => void
  highlighted?: boolean
}) {
  const { t, locale } = useI18n()
  const pct = Math.round(match.similarity_score * 100)
  const tagMap = locale === 'zh' ? TAG_ZH : TAG_EN

  return (
    <motion.div
      id={`match-${match.id}`}
      className={`${styles.card} ${highlighted ? styles.highlighted : ''}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className={styles.cardHeader}>
        <div className={styles.partnerInfo}>
          <span className={styles.partnerName}>{match.partner_name}</span>
          <span className={styles.similarity}>{pct}% match</span>
        </div>
        <span className={`${styles.status} ${styles[match.status]}`}>
          {match.status}
        </span>
      </div>

      {match.shared_tags.length > 0 && (
        <div className={styles.tags}>
          {match.shared_tags.slice(0, 5).map((tag) => (
            <span key={tag} className={styles.tag}>
              {tagMap[tag] || tag}
            </span>
          ))}
        </div>
      )}

      {match.ice_breakers.length > 0 && (
        <div className={styles.iceBreaker}>
          <i className="ri-chat-smile-2-line" />
          <span>{match.ice_breakers[0]}</span>
        </div>
      )}

      <div className={styles.cardActions}>
        {match.status === 'discovered' && (
          <button className={styles.inviteBtn} onClick={onInvite}>
            <i className="ri-mail-send-line" /> {t('matches.invite')}
          </button>
        )}
        {match.status === 'invited' && (
          <div className={styles.respondBtns}>
            <button className={styles.acceptBtn} onClick={() => onRespond(true)}>
              <i className="ri-check-line" /> {t('matches.accept')}
            </button>
            <button className={styles.declineBtn} onClick={() => onRespond(false)}>
              <i className="ri-close-line" /> {t('matches.decline')}
            </button>
          </div>
        )}
        {match.status === 'accepted' && (
          <span className={styles.acceptedLabel}>
            <i className="ri-heart-line" /> {t('matches.matched')}
          </span>
        )}
      </div>
    </motion.div>
  )
}

function MatchesContent() {
  const searchParams = useSearchParams()
  const { t } = useI18n()
  const {
    matches, isLoading, isDiscovering,
    fetchMatches, discoverMatches, sendInvite, respondToInvite,
  } = useMatchStore()

  useEffect(() => {
    fetchMatches()
  }, [fetchMatches])

  const respondId = searchParams.get('respond')
  const matchId = searchParams.get('match')
  const highlightId = respondId || matchId

  useEffect(() => {
    if (highlightId && !isLoading) {
      const el = document.getElementById(`match-${highlightId}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [highlightId, isLoading])

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.header}>
          <h1 className={styles.title}>{t('matches.title')}</h1>
          <button
            className={styles.discoverBtn}
            onClick={discoverMatches}
            disabled={isDiscovering}
          >
            <i className="ri-compass-discover-line" />
            {isDiscovering ? t('matches.discovering') : t('matches.discover')}
          </button>
        </div>

        {isLoading && (
          <div className={styles.loading}>
            <i className="ri-loader-4-line ri-spin ri-2x" />
          </div>
        )}

        {!isLoading && matches.length === 0 && (
          <div className={styles.empty}>
            <i className="ri-group-line ri-3x" />
            <p>{t('matches.empty')}</p>
            <p className={styles.emptyHint}>{t('matches.emptyHint')}</p>
          </div>
        )}

        <div className={styles.grid}>
          {matches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              onInvite={() => sendInvite(match.id)}
              onRespond={(accept) => respondToInvite(match.id, accept)}
              highlighted={match.id === highlightId}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function MatchesPage() {
  return (
    <Suspense fallback={
      <div className={styles.container}>
        <div className={styles.loading}>
          <i className="ri-loader-4-line ri-spin ri-2x" />
        </div>
      </div>
    }>
      <MatchesContent />
    </Suspense>
  )
}
