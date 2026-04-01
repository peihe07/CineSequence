'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { PreviewBanner, usePreviewAccess } from '@/components/preview/PreviewGate'
import { useGroupStore } from '@/stores/groupStore'
import { useI18n } from '@/lib/i18n'
import { PREVIEW_THEATER_GROUPS } from '@/lib/previewContent'
import { useAuthStore } from '@/stores/authStore'
import { getTagLabel } from '@/lib/tagLabels'
import type { TheaterGroup } from '@/lib/theater-types'
import FlowGuard from '@/components/guards/FlowGuard'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import styles from './page.module.css'

function FeaturedGroup({ group }: { group: TheaterGroup }) {
  const { t, locale } = useI18n()

  return (
    <motion.section
      className={styles.featuredGroup}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
    >
      <div className={styles.featuredHeader}>
        <div className={styles.groupInfo}>
          <i className={`${group.icon} ${styles.groupIcon}`} />
          <div className={styles.groupText}>
            <p className={styles.featuredEyebrow}>{t('theaters.featured')}</p>
            <h2 className={styles.featuredTitle}>{group.name}</h2>
            <p className={styles.groupSubtitle}>{group.subtitle}</p>
          </div>
        </div>
        <Link href={`/theaters/${group.id}`} prefetch={false} className={styles.detailLink}>
          <i className="ri-arrow-right-up-line" /> {t('theaters.open')}
        </Link>
      </div>

      <div className={styles.featuredGrid}>
        <section className={styles.featuredBlock}>
          <p className={styles.detailLabel}>{t('theaters.fit')}</p>
          {group.shared_tags.length > 0 ? (
            <>
              <p className={styles.detailText}>{t('theaters.fitHint')}</p>
              <div className={styles.detailTags}>
                {group.shared_tags.map((tag) => (
                  <span key={tag} className={styles.detailTag}>
                    {getTagLabel(tag, locale)}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className={styles.detailText}>{t('theaters.noSharedTags')}</p>
          )}
        </section>

        <section className={styles.featuredBlock}>
          <div className={styles.blockHeader}>
            <p className={styles.detailLabel}>{t('theaters.recommended')}</p>
            <p className={styles.blockHint}>{t('theaters.featuredHint')}</p>
          </div>
          {group.recommended_movies.length > 0 ? (
            <div className={styles.horizontalRail}>
              {group.recommended_movies.map((movie) => (
                <article key={movie.tmdb_id} className={styles.movieRailCard}>
                  {movie.poster_url ? (
                    <Image
                      src={movie.poster_url}
                      alt={movie.title_en}
                      className={styles.movieRailPoster}
                      width={240}
                      height={360}
                      unoptimized
                    />
                  ) : (
                    <div className={styles.movieRailPosterFallback}>
                      <span>{movie.title_en.slice(0, 1)}</span>
                    </div>
                  )}
                  <div className={styles.movieRailBody}>
                    <p className={styles.movieTitle}>{movie.title_en}</p>
                    <div className={styles.movieTags}>
                      {movie.match_tags.map((tag) => (
                        <span key={`${movie.tmdb_id}-${tag}`} className={styles.movieTag}>
                          {getTagLabel(tag, locale)}
                        </span>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.emptyCard}>
              <div className={styles.emptyIcon}><i className="ri-clapperboard-line" /></div>
              <p className={styles.detailText}>{t('theaters.featuredHint')}</p>
            </div>
          )}
        </section>

        <section className={styles.featuredBlock}>
          <div className={styles.blockHeader}>
            <p className={styles.detailLabel}>{t('theaters.watchlist')}</p>
            <p className={styles.blockHint}>{t('theaters.watchlistHint')}</p>
          </div>
          {group.shared_watchlist.length > 0 ? (
            <div className={styles.horizontalRail}>
              {group.shared_watchlist.map((movie) => (
                <article key={movie.tmdb_id} className={styles.movieRailCard}>
                  {movie.poster_url ? (
                    <Image
                      src={movie.poster_url}
                      alt={movie.title_en}
                      className={styles.movieRailPoster}
                      width={240}
                      height={360}
                      unoptimized
                    />
                  ) : (
                    <div className={styles.movieRailPosterFallback}>
                      <span>{movie.title_en.slice(0, 1)}</span>
                    </div>
                  )}
                  <div className={styles.movieRailBody}>
                    <div className={styles.watchlistMeta}>
                      <p className={styles.movieTitle}>{movie.title_en}</p>
                      <span className={styles.supporterBadge}>
                        {t('theaters.supporters', { count: movie.supporter_count })}
                      </span>
                    </div>
                    <div className={styles.movieTags}>
                      {movie.match_tags.map((tag) => (
                        <span key={`${movie.tmdb_id}-${tag}`} className={styles.movieTag}>
                          {getTagLabel(tag, locale)}
                        </span>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.emptyCard}>
              <div className={styles.emptyIcon}><i className="ri-group-line" /></div>
              <p className={styles.detailText}>{t('theaters.messagesEmpty')}</p>
            </div>
          )}
        </section>

        <section className={`${styles.featuredBlock} ${styles.activityBlock}`}>
          <div className={styles.blockHeader}>
            <p className={styles.detailLabel}>{t('theaters.activity')}</p>
            <p className={styles.blockHint}>{t('theaters.activityHint')}</p>
          </div>
          {group.recent_activity.length > 0 ? (
            <div className={styles.activityList}>
              {group.recent_activity.map((activity) => (
                <article key={activity.id} className={styles.activityItem}>
                  <div className={styles.activityMeta}>
                    <p className={styles.activityTitle}>
                      {activity.type === 'list_created'
                        ? t('theaters.activityListCreated', {
                            name: activity.actor.name,
                            title: activity.list_title,
                          })
                        : t('theaters.activityListReplied', {
                            name: activity.actor.name,
                            title: activity.list_title,
                          })}
                    </p>
                    <span className={styles.messageTime}>
                      {new Date(activity.created_at).toLocaleString(locale)}
                    </span>
                  </div>
                  {activity.body && <p className={styles.activityBody}>{activity.body}</p>}
                </article>
              ))}
            </div>
          ) : (
            <p className={styles.detailText}>{t('theaters.activityEmpty')}</p>
          )}
        </section>
      </div>
    </motion.section>
  )
}

function GroupCard({ group, onJoin, onLeave }: {
  group: TheaterGroup
  onJoin: () => void
  onLeave: () => void
}) {
  const { t, locale } = useI18n()
  const [activeDetailTab, setActiveDetailTab] = useState<'fit' | 'recommended' | 'watchlist' | 'members'>('fit')

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

      <div className={styles.detailTabs} role="tablist" aria-label={`${group.name} details`}>
        <button
          type="button"
          role="tab"
          aria-selected={activeDetailTab === 'fit'}
          className={`${styles.detailTab} ${activeDetailTab === 'fit' ? styles.detailTabActive : ''}`}
          onClick={() => setActiveDetailTab('fit')}
        >
          {t('theaters.fit')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeDetailTab === 'recommended'}
          className={`${styles.detailTab} ${activeDetailTab === 'recommended' ? styles.detailTabActive : ''}`}
          onClick={() => setActiveDetailTab('recommended')}
        >
          {t('theaters.recommended')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeDetailTab === 'watchlist'}
          className={`${styles.detailTab} ${activeDetailTab === 'watchlist' ? styles.detailTabActive : ''}`}
          onClick={() => setActiveDetailTab('watchlist')}
        >
          {t('theaters.watchlist')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeDetailTab === 'members'}
          className={`${styles.detailTab} ${activeDetailTab === 'members' ? styles.detailTabActive : ''}`}
          onClick={() => setActiveDetailTab('members')}
        >
          {t('theaters.members')}
        </button>
      </div>

      <div className={styles.detailPanel}>
        {activeDetailTab === 'fit' && (
          <section className={styles.detailBlock}>
            <p className={styles.detailLabel}>{t('theaters.fit')}</p>
            {group.shared_tags.length > 0 ? (
              <>
                <p className={styles.detailText}>{t('theaters.fitHint')}</p>
                <div className={styles.detailTags}>
                  {group.shared_tags.map((tag) => (
                    <span key={tag} className={styles.detailTag}>
                      {getTagLabel(tag, locale)}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <p className={styles.detailText}>{t('theaters.noSharedTags')}</p>
            )}
          </section>
        )}

        {activeDetailTab === 'recommended' && (
          <section className={styles.detailBlock}>
            <p className={styles.detailLabel}>{t('theaters.recommended')}</p>
            {group.recommended_movies.length > 0 ? (
              <div className={styles.compactRail}>
                {group.recommended_movies.map((movie) => (
                  <article key={movie.tmdb_id} className={styles.compactMovieCard}>
                    {movie.poster_url ? (
                      <Image
                        src={movie.poster_url}
                        alt={movie.title_en}
                        className={styles.moviePosterCompact}
                        width={44}
                        height={64}
                        unoptimized
                      />
                    ) : (
                      <div className={styles.moviePosterCompactFallback}>
                        <span>{movie.title_en.slice(0, 1)}</span>
                      </div>
                    )}
                    <div className={styles.movieCopy}>
                      <p className={styles.movieTitle}>{movie.title_en}</p>
                      <div className={styles.movieTags}>
                        {movie.match_tags.map((tag) => (
                          <span key={`${movie.tmdb_id}-${tag}`} className={styles.movieTag}>
                            {getTagLabel(tag, locale)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className={styles.detailText}>{t('theaters.featuredHint')}</p>
            )}
          </section>
        )}

        {activeDetailTab === 'watchlist' && (
          <section className={styles.detailBlock}>
            <p className={styles.detailLabel}>{t('theaters.watchlist')}</p>
            {group.shared_watchlist.length > 0 ? (
              <div className={styles.watchlistListCompact}>
                {group.shared_watchlist.slice(0, 3).map((movie) => (
                  <article key={movie.tmdb_id} className={styles.watchlistItemCompact}>
                    <div className={styles.movieCardCompact}>
                      {movie.poster_url ? (
                        <Image
                          src={movie.poster_url}
                          alt={movie.title_en}
                          className={styles.moviePosterCompact}
                          width={44}
                          height={64}
                          unoptimized
                        />
                      ) : (
                        <div className={styles.moviePosterCompactFallback}>
                          <span>{movie.title_en.slice(0, 1)}</span>
                        </div>
                      )}
                      <div className={styles.watchlistMeta}>
                        <p className={styles.movieTitle}>{movie.title_en}</p>
                        <span className={styles.supporterBadge}>
                          {t('theaters.supporters', { count: movie.supporter_count })}
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className={styles.detailText}>{t('theaters.messagesEmpty')}</p>
            )}
          </section>
        )}

        {activeDetailTab === 'members' && (
          <section className={styles.detailBlock}>
            <p className={styles.detailLabel}>{t('theaters.members')}</p>
            {group.member_preview.length > 0 ? (
              <div className={styles.memberList}>
                {group.member_preview.map((member) => (
                  <span key={member.id} className={styles.memberChip}>
                    {member.name}
                  </span>
                ))}
              </div>
            ) : (
              <p className={styles.detailText}>{t('theaters.membersEmpty')}</p>
            )}
          </section>
        )}
      </div>

      <div className={styles.cardActions}>
        <Link href={`/theaters/${group.id}`} prefetch={false} className={styles.detailLink}>
          <i className="ri-arrow-right-up-line" /> {t('theaters.open')}
        </Link>
        <div className={styles.cardActionMeta}>
          <span className={styles.cardActionHint}>
            {group.is_member ? t('theaters.cardHintMember') : t('theaters.cardHintVisitor')}
          </span>
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
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const { isPreview, guardPreviewAction, previewModal } = usePreviewAccess('/theaters')
  const { groups, isLoading, fetchGroups, autoAssign, joinGroup, leaveGroup } = useGroupStore()
  const [leaveTarget, setLeaveTarget] = useState<string | null>(null)
  const displayGroups = isPreview ? PREVIEW_THEATER_GROUPS : groups
  const featuredGroup = displayGroups.find((group) => group.is_member) ?? displayGroups[0] ?? null
  const remainingGroups = featuredGroup
    ? displayGroups.filter((group) => group.id !== featuredGroup.id)
    : []

  useEffect(() => {
    if (!isAuthenticated) {
      return
    }

    fetchGroups()
  }, [fetchGroups, isAuthenticated])

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <section className={`${styles.section} ${styles.heroSection}`}>
          <span className={styles.sideLabel}>{t('theaters.fileLabel')}</span>
          <p className={styles.eyebrow}>[ SCREENING_INDEX ]</p>
          <p className={styles.kicker}>{t('theaters.nextStep')}</p>
          <div className={styles.header}>
            <h1 className={styles.title}>{t('theaters.title')}</h1>
            <button
              className={styles.assignBtn}
              onClick={() => guardPreviewAction(() => void autoAssign())}
              disabled={isLoading}
            >
              <i className="ri-magic-line" />
              {isLoading ? t('common.loading') : t('theaters.autoAssign')}
            </button>
          </div>
          <p className={styles.deck}>
            {t('theaters.deck')}
          </p>
          <p className={styles.assignmentNote}>{t('theaters.assignmentReady')}</p>
          <p className={styles.heroMeta}>GROUP_SCAN: LIVE // ASSIGNMENT: READY</p>
          <PreviewBanner nextPath="/theaters" compact />
        </section>

        <section className={`${styles.section} ${styles.resultsSection}`}>
          {isLoading && (
            <div className={styles.loading}>
              <i className="ri-loader-4-line ri-spin ri-2x" />
            </div>
          )}

          {!isLoading && displayGroups.length === 0 && (
            <div className={styles.empty}>
              <i className="ri-film-line ri-3x" />
              <p>{t('theaters.empty')}</p>
              <p className={styles.emptyHint}>{t('theaters.emptyHint')}</p>
              <button
                className={styles.assignBtn}
                onClick={() => guardPreviewAction(() => void autoAssign())}
                disabled={isLoading}
                style={{ marginTop: '0.5rem' }}
              >
                <i className="ri-magic-line" />
                {t('theaters.autoAssign')}
              </button>
            </div>
          )}

          {!isLoading && featuredGroup && (
            <>
              <FeaturedGroup group={featuredGroup} />

              {remainingGroups.length > 0 && (
                <div className={styles.librarySection}>
                  <div className={styles.sectionHeader}>
                    <p className={styles.sectionEyebrow}>{t('theaters.library')}</p>
                    <p className={styles.sectionIntro}>{t('theaters.libraryHint')}</p>
                  </div>
                  <div className={styles.grid}>
                    {remainingGroups.map((group) => (
                      <GroupCard
                        key={group.id}
                        group={group}
                        onJoin={() => guardPreviewAction(() => void joinGroup(group.id))}
                        onLeave={() => {
                          if (isPreview) {
                            guardPreviewAction()
                            return
                          }
                          setLeaveTarget(group.id)
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={!isPreview && leaveTarget !== null}
        message={t('confirm.leaveGroup')}
        onConfirm={() => {
          if (leaveTarget) void leaveGroup(leaveTarget)
          setLeaveTarget(null)
        }}
        onCancel={() => setLeaveTarget(null)}
      />
      {previewModal}
    </div>
  )
}
