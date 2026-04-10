import { useState } from 'react'
import { useI18n } from '@/lib/i18n'
import type { TheaterMovieSearchResult } from '@/lib/theater-types'
import { searchTheaterMovies } from '../movieSearchCache'
import styles from '../page.module.css'

interface CreateListModalProps {
  isMutating: boolean
  onClose: () => void
  onCreate: (data: {
    title: string
    description: string
    itemTitles: string[]
    items: Array<{
      tmdb_id: number
      title_en: string
      title_zh: string | null
      poster_url: string | null
      genres: string[]
      runtime_minutes: number | null
      match_tags: string[]
      note: string | null
    }>
  }) => Promise<boolean | undefined>
}

export default function CreateListModal({ isMutating, onClose, onCreate }: CreateListModalProps) {
  const { t } = useI18n()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [itemTitles, setItemTitles] = useState('')
  const [selectedMovies, setSelectedMovies] = useState<TheaterMovieSearchResult[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<TheaterMovieSearchResult[]>([])
  const [searchError, setSearchError] = useState<string | null>(null)
  const [isSearching, setIsSearching] = useState(false)

  async function handleSearch() {
    if (searchQuery.trim().length < 2) {
      setSearchResults([])
      setSearchError(null)
      return
    }
    setIsSearching(true)
    try {
      const results = await searchTheaterMovies(searchQuery)
      setSearchResults(results)
      setSearchError(null)
    } catch (err) {
      setSearchResults([])
      setSearchError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setIsSearching(false)
    }
  }

  function handleSelect(movie: TheaterMovieSearchResult) {
    setSelectedMovies((current) =>
      current.some((entry) => entry.tmdb_id === movie.tmdb_id) ? current : [...current, movie]
    )
    setSearchQuery('')
    setSearchResults([])
    setSearchError(null)
  }

  async function handleCreate() {
    const created = await onCreate({
      title,
      description,
      itemTitles: itemTitles.split('\n'),
      items: selectedMovies.map((movie) => ({
        tmdb_id: movie.tmdb_id,
        title_en: movie.title_en,
        title_zh: movie.title_zh,
        poster_url: movie.poster_url,
        genres: movie.genres,
        runtime_minutes: movie.runtime_minutes,
        match_tags: [],
        note: null,
      })),
    })
    if (created) onClose()
  }

  return (
    <div className={styles.modalOverlay} role="presentation" onClick={onClose}>
      <div
        className={styles.modalPanel}
        role="dialog"
        aria-modal="true"
        aria-label={t('theaters.listCreate')}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <div>
            <p className={styles.label}>{t('theaters.userLists')}</p>
            <h2 className={styles.modalTitle}>{t('theaters.listCreate')}</h2>
          </div>
          <button type="button" className={styles.inlineBtn} onClick={onClose}>
            {t('common.cancel')}
          </button>
        </div>
        <div className={styles.composer}>
          <input className={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('theaters.listTitlePlaceholder')} />
          <textarea className={styles.textarea} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('theaters.listDescriptionPlaceholder')} rows={3} />
          <textarea className={styles.textarea} value={itemTitles} onChange={(e) => setItemTitles(e.target.value)} placeholder={t('theaters.listItemsPlaceholder')} rows={4} />
          <div className={styles.searchComposer}>
            <div className={styles.searchInputRow}>
              <input className={styles.input} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t('theaters.listMovieSearchPlaceholder')} />
              <button className={styles.secondaryBtn} disabled={isMutating || isSearching} onClick={() => void handleSearch()}>
                {isSearching ? t('common.loading') : t('theaters.listMovieSearch')}
              </button>
            </div>
            {searchError && <p className={styles.meta}>{searchError}</p>}
            {searchResults.length > 0 && (
              <div className={styles.searchResults}>
                {searchResults.map((movie) => (
                  <button key={movie.tmdb_id} type="button" className={styles.searchResultItem} onClick={() => handleSelect(movie)}>
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
            {selectedMovies.length > 0 && (
              <div className={styles.selectedMovieGrid}>
                {selectedMovies.map((movie) => (
                  <div key={movie.tmdb_id} className={styles.selectedMovieChip}>
                    <span>{movie.title_zh || movie.title_en}</span>
                    <button type="button" className={styles.inlineBtn} onClick={() => setSelectedMovies((c) => c.filter((m) => m.tmdb_id !== movie.tmdb_id))}>
                      <i className="ri-close-line" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button className={styles.primaryBtn} disabled={isMutating} onClick={() => void handleCreate()}>
            {t('theaters.listCreate')}
          </button>
        </div>
      </div>
    </div>
  )
}
