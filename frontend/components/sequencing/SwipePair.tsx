'use client'

import { motion } from 'framer-motion'
import { useI18n } from '@/lib/i18n'
import MovieCard from './MovieCard'
import styles from './SwipePair.module.css'

interface SwipePairProps {
  pair: {
    round_number: number
    phase: number
    movie_a: {
      tmdb_id: number
      title_en: string
      title_zh: string | null
      poster_url: string | null
      year: number | null
      genres: string[]
    }
    movie_b: {
      tmdb_id: number
      title_en: string
      title_zh: string | null
      poster_url: string | null
      year: number | null
      genres: string[]
    }
  }
  onPick: (tmdbId: number) => void
  isLoading: boolean
}

export default function SwipePair({ pair, onPick, isLoading }: SwipePairProps) {
  const { t } = useI18n()

  return (
    <motion.div
      className={styles.pairContainer}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <MovieCard
        movie={pair.movie_a}
        onPick={() => !isLoading && onPick(pair.movie_a.tmdb_id)}
        side="left"
      />

      <div className={styles.vsContainer}>
        <span className={styles.vs}>{t('seq.vs')}</span>
        <div className={styles.vsGlow} />
      </div>

      <MovieCard
        movie={pair.movie_b}
        onPick={() => !isLoading && onPick(pair.movie_b.tmdb_id)}
        side="right"
      />
    </motion.div>
  )
}
