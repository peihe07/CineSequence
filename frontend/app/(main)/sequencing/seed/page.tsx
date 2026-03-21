'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '@/lib/api'
import { useSequencingStore } from '@/stores/sequencingStore'
import { useI18n } from '@/lib/i18n'
import Button from '@/components/ui/Button'
import styles from './page.module.css'

interface SearchResult {
  tmdb_id: number
  title_en: string
  title_zh: string | null
  poster_url: string | null
  year: number | null
}

export default function SeedMoviePage() {
  const router = useRouter()
  const { t, locale } = useI18n()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [selected, setSelected] = useState<SearchResult | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { setSeedMovie } = useSequencingStore()

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([])
      return
    }
    setIsSearching(true)
    try {
      const data = await api<SearchResult[]>(`/sequencing/search?q=${encodeURIComponent(q)}`)
      setResults(data)
    } catch {
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(query), 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, search])

  function handleSelect(movie: SearchResult) {
    setSelected(movie)
    // Prefer locale-appropriate title in the search input
    setQuery(locale === 'zh' && movie.title_zh ? movie.title_zh : movie.title_en)
    setResults([])
  }

  async function handleConfirm() {
    if (!selected) return
    setIsSubmitting(true)
    try {
      await setSeedMovie(selected.tmdb_id)
      router.push('/sequencing')
    } catch {
      setIsSubmitting(false)
    }
  }

  function handleSkipSeed() {
    router.push('/sequencing')
  }

  return (
    <main className={styles.container}>
      <div className={styles.content}>
        <div className={styles.header}>
          <i className="ri-film-line" style={{ fontSize: '2rem' }} />
          <h1 className={styles.title}>{t('seed.title')}</h1>
          <p className={styles.subtitle}>{t('seed.subtitle')}</p>
        </div>

        <div className={styles.searchArea}>
          <div className={styles.searchBox}>
            <i className="ri-search-line" />
            <input
              className={styles.searchInput}
              type="text"
              placeholder={t('seed.placeholder')}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                if (selected) setSelected(null)
              }}
              autoFocus
            />
            {isSearching && <span className={styles.spinner} />}
          </div>

          <AnimatePresence>
            {results.length > 0 && (
              <motion.ul
                className={styles.dropdown}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                {results.map((movie) => (
                  <li key={movie.tmdb_id}>
                    <button
                      className={styles.resultItem}
                      onClick={() => handleSelect(movie)}
                    >
                      {movie.poster_url ? (
                        <img
                          className={styles.poster}
                          src={movie.poster_url}
                          alt={movie.title_en}
                        />
                      ) : (
                        <div className={styles.posterPlaceholder}>
                          <i className="ri-movie-2-line" />
                        </div>
                      )}
                      <div className={styles.movieInfo}>
                        <span className={styles.movieTitle}>
                          {locale === 'zh' && movie.title_zh ? movie.title_zh : movie.title_en}
                        </span>
                        <span className={styles.movieMeta}>
                          {movie.title_zh && movie.title_en !== movie.title_zh && (
                            <span>{movie.title_en}</span>
                          )}
                          {movie.year && <span>{movie.year}</span>}
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>

        {selected && (
          <motion.div
            className={styles.selectedCard}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            {selected.poster_url && (
              <img
                className={styles.selectedPoster}
                src={selected.poster_url}
                alt={selected.title_en}
              />
            )}
            <div className={styles.selectedInfo}>
              <span className={styles.selectedTitle}>
                {locale === 'zh' && selected.title_zh ? selected.title_zh : selected.title_en}
              </span>
              {selected.year && (
                <span className={styles.selectedYear}>{selected.year}</span>
              )}
            </div>
          </motion.div>
        )}

        <div className={styles.actions}>
          <Button
            variant="primary"
            size="lg"
            onClick={handleConfirm}
            disabled={!selected}
            loading={isSubmitting}
          >
            <i className="ri-dna-line" /> {t('seed.confirm')}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleSkipSeed}>
            {t('seed.skip')}
          </Button>
        </div>
      </div>
    </main>
  )
}
