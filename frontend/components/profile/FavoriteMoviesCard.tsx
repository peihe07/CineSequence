'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import styles from '@/app/(main)/profile/page.module.css'
import type { FavoriteMovie } from './types'

interface FavoriteMoviesCardProps {
  favorites: FavoriteMovie[]
  title: string
  hintLabel: string
  searchLabel: string
  searchingLabel: string
  saveLabel: string
  cancelLabel: string
  editLabel: string
  onUpdate: (movies: FavoriteMovie[]) => void
  isPreview?: boolean
}

interface SearchResult {
  tmdb_id: number
  title: string
  title_en: string
  poster_url: string | null
  year: number | null
}

export default function FavoriteMoviesCard({
  favorites,
  title,
  hintLabel,
  searchLabel,
  searchingLabel,
  saveLabel,
  cancelLabel,
  editLabel,
  onUpdate,
  isPreview = false,
}: FavoriteMoviesCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<FavoriteMovie[]>(favorites)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setDraft(favorites)
  }, [favorites])

  const searchMovies = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([])
      return
    }
    setSearching(true)
    try {
      const data = await api<SearchResult[]>(`/sequencing/search?q=${encodeURIComponent(q)}`)
      setResults(data)
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }, [])

  function handleQueryChange(value: string) {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => searchMovies(value), 400)
  }

  function handleSelect(movie: SearchResult) {
    if (draft.length >= 3) return
    if (draft.some((m) => m.tmdb_id === movie.tmdb_id)) return

    const newFav: FavoriteMovie = {
      id: '',
      tmdb_id: movie.tmdb_id,
      title_zh: movie.title,
      title_en: movie.title_en,
      poster_url: movie.poster_url,
      display_order: draft.length,
    }
    setDraft([...draft, newFav])
    setQuery('')
    setResults([])
  }

  function handleRemove(tmdbId: number) {
    setDraft(draft.filter((m) => m.tmdb_id !== tmdbId).map((m, i) => ({ ...m, display_order: i })))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const body = {
        movies: draft.map((m, i) => ({
          tmdb_id: m.tmdb_id,
          title_zh: m.title_zh,
          title_en: m.title_en,
          poster_url: m.poster_url,
          display_order: i,
        })),
      }
      const updated = await api<FavoriteMovie[]>('/profile/favorites', {
        method: 'PUT',
        body: JSON.stringify(body),
      })
      onUpdate(updated)
      setIsEditing(false)
    } finally {
      setSaving(false)
    }
  }

  if (isPreview && favorites.length === 0) return null

  return (
    <div className={styles.card}>
      <div className={styles.sectionTitleRow}>
        <h2 className={styles.sectionTitle}>
          <i className="ri-film-line" /> {title}
        </h2>
        {!isPreview && (
          <button
            className={styles.editBtn}
            onClick={() => { setDraft(favorites); setIsEditing(!isEditing) }}
            aria-label={editLabel}
          >
            <i className="ri-pencil-line" />
          </button>
        )}
      </div>

      {!isEditing ? (
        <div className={styles.favoritesGrid}>
          {favorites.length === 0 ? (
            <p className={styles.cardIntro}>{hintLabel}</p>
          ) : (
            favorites.map((movie) => (
              <div key={movie.tmdb_id} className={styles.favoriteItem}>
                {movie.poster_url ? (
                  <img
                    src={movie.poster_url}
                    alt={movie.title_zh || movie.title_en || ''}
                    className={styles.favoritePoster}
                  />
                ) : (
                  <div className={styles.favoritePosterEmpty}>
                    <i className="ri-movie-line" />
                  </div>
                )}
                <span className={styles.favoriteTitle}>
                  {movie.title_zh || movie.title_en}
                </span>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className={styles.preferencesEditor}>
          <div className={styles.favoritesGrid}>
            {draft.map((movie) => (
              <div key={movie.tmdb_id} className={styles.favoriteItem}>
                {movie.poster_url ? (
                  <img
                    src={movie.poster_url}
                    alt={movie.title_zh || movie.title_en || ''}
                    className={styles.favoritePoster}
                  />
                ) : (
                  <div className={styles.favoritePosterEmpty}>
                    <i className="ri-movie-line" />
                  </div>
                )}
                <span className={styles.favoriteTitle}>
                  {movie.title_zh || movie.title_en}
                </span>
                <button
                  className={styles.favoriteRemove}
                  onClick={() => handleRemove(movie.tmdb_id)}
                  type="button"
                >
                  <i className="ri-close-line" />
                </button>
              </div>
            ))}
          </div>

          {draft.length < 3 && (
            <div className={styles.field}>
              <input
                className={styles.editInput}
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder={searchLabel}
              />
              {searching && (
                <span className={styles.cardIntro}>
                  <i className="ri-loader-4-line ri-spin" />
                  {' '}
                  {searchingLabel}
                </span>
              )}
              {results.length > 0 && (
                <div className={styles.searchResults}>
                  {results.slice(0, 6).map((r) => (
                    <button
                      key={r.tmdb_id}
                      className={styles.searchResultItem}
                      onClick={() => handleSelect(r)}
                      type="button"
                    >
                      {r.poster_url && (
                        <img src={r.poster_url} alt="" className={styles.searchResultPoster} />
                      )}
                      <span>
                        {r.title}
                        {r.year ? ` (${r.year})` : ''}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className={styles.editRow} style={{ justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
            <button className={styles.cancelBtn} onClick={() => setIsEditing(false)}>
              {cancelLabel}
            </button>
            <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
              {saving ? '…' : saveLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
