import { useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { getTagLabel } from '@/lib/tagLabels'
import styles from '../page.module.css'

interface Movie {
  tmdb_id: number
  title_en: string
  poster_url: string | null
  match_tags: string[]
}

interface WatchlistMovie extends Movie {
  supporter_count: number
}

interface OverviewTabProps {
  sharedTags: string[]
  recommendedMovies: Movie[]
  sharedWatchlist: WatchlistMovie[]
  groupName: string
}

export default function OverviewTab({
  sharedTags,
  recommendedMovies,
  sharedWatchlist,
  groupName,
}: OverviewTabProps) {
  const { t, locale } = useI18n()
  const recommendedRailRef = useRef<HTMLDivElement | null>(null)
  const watchlistRailRef = useRef<HTMLDivElement | null>(null)
  const [activePanel, setActivePanel] = useState<'recommended' | 'watchlist'>('recommended')

  function scrollRail(panel: 'recommended' | 'watchlist', direction: 'prev' | 'next') {
    const rail = panel === 'recommended' ? recommendedRailRef.current : watchlistRailRef.current
    if (!rail) return
    const offset = Math.max(rail.clientWidth * 0.82, 260)
    rail.scrollBy({ left: direction === 'next' ? offset : -offset, behavior: 'smooth' })
  }

  return (
    <>
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <p className={styles.label}>{t('theaters.fit')}</p>
        </div>
        <div className={styles.tags}>
          {sharedTags.map((tag) => (
            <span key={tag} className={styles.tag}>{getTagLabel(tag, locale)}</span>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <p className={styles.label}>{t('theaters.tabOverview')}</p>
          <p className={styles.detailText}>Switch between this room&apos;s starter shelf and its shared pull list.</p>
        </div>
        <div className={styles.panelTabs} role="tablist" aria-label={`${groupName} overview panels`}>
          <button
            type="button"
            role="tab"
            aria-selected={activePanel === 'recommended'}
            className={`${styles.panelTab} ${activePanel === 'recommended' ? styles.panelTabActive : ''}`}
            onClick={() => setActivePanel('recommended')}
          >
            {t('theaters.recommended')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activePanel === 'watchlist'}
            className={`${styles.panelTab} ${activePanel === 'watchlist' ? styles.panelTabActive : ''}`}
            onClick={() => setActivePanel('watchlist')}
          >
            {t('theaters.watchlist')}
          </button>
        </div>

        {activePanel === 'recommended' && (
          recommendedMovies.length > 0 ? (
            <div className={styles.carouselSection}>
              {recommendedMovies.length > 1 && (
                <div className={styles.railControls} aria-label={t('theaters.carouselControls', { shelf: t('theaters.recommended') })}>
                  <button type="button" className={styles.railButton} onClick={() => scrollRail('recommended', 'prev')} aria-label={t('theaters.carouselPrevious', { shelf: t('theaters.recommended') })}>
                    <i className="ri-arrow-left-s-line" />
                  </button>
                  <button type="button" className={styles.railButton} onClick={() => scrollRail('recommended', 'next')} aria-label={t('theaters.carouselNext', { shelf: t('theaters.recommended') })}>
                    <i className="ri-arrow-right-s-line" />
                  </button>
                </div>
              )}
              <div ref={recommendedRailRef} className={styles.horizontalRail} aria-label={t('theaters.carouselShelf', { shelf: t('theaters.recommended') })}>
                {recommendedMovies.map((movie) => (
                  <article key={movie.tmdb_id} className={styles.movieRailCard}>
                    {movie.poster_url ? (
                      <img className={styles.movieRailPoster} src={movie.poster_url} alt={movie.title_en} loading="lazy" decoding="async" />
                    ) : (
                      <div className={styles.movieRailPosterFallback} aria-hidden="true"><i className="ri-film-line" /></div>
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
              <div className={styles.emptyStateIcon} aria-hidden="true"><i className="ri-clapperboard-line" /></div>
              <p className={styles.emptyStateTitle}>{groupName}</p>
              <p className={styles.detailText}>This room is still building its opening lineup.</p>
            </div>
          )
        )}

        {activePanel === 'watchlist' && (
          sharedWatchlist.length > 0 ? (
            <div className={styles.carouselSection}>
              {sharedWatchlist.length > 1 && (
                <div className={styles.railControls} aria-label={t('theaters.carouselControls', { shelf: t('theaters.watchlist') })}>
                  <button type="button" className={styles.railButton} onClick={() => scrollRail('watchlist', 'prev')} aria-label={t('theaters.carouselPrevious', { shelf: t('theaters.watchlist') })}>
                    <i className="ri-arrow-left-s-line" />
                  </button>
                  <button type="button" className={styles.railButton} onClick={() => scrollRail('watchlist', 'next')} aria-label={t('theaters.carouselNext', { shelf: t('theaters.watchlist') })}>
                    <i className="ri-arrow-right-s-line" />
                  </button>
                </div>
              )}
              <div ref={watchlistRailRef} className={styles.horizontalRail} aria-label={t('theaters.carouselShelf', { shelf: t('theaters.watchlist') })}>
                {sharedWatchlist.map((movie) => (
                  <article key={movie.tmdb_id} className={styles.movieRailCard}>
                    {movie.poster_url ? (
                      <img className={styles.movieRailPoster} src={movie.poster_url} alt={movie.title_en} loading="lazy" decoding="async" />
                    ) : (
                      <div className={styles.movieRailPosterFallback} aria-hidden="true"><i className="ri-film-line" /></div>
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
              <div className={styles.emptyStateIcon} aria-hidden="true"><i className="ri-group-line" /></div>
              <p className={styles.emptyStateTitle}>No shared watchlist yet.</p>
              <p className={styles.detailText}>Once the room starts aligning on titles, this shelf will fill in.</p>
            </div>
          )
        )}
      </section>
    </>
  )
}
