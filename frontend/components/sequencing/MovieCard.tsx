'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useSequencingStore } from '@/stores/sequencingStore'
import { soundManager } from '@/lib/sound'
import styles from './MovieCard.module.css'

// Genre-to-color mapping for ambient background
const GENRE_COLORS: Record<string, string> = {
  'Action': '#e63946',
  'Thriller': '#7b2d8b',
  'Horror': '#6a0572',
  'Science Fiction': '#1d3557',
  'Drama': '#457b9d',
  'Comedy': '#e9c46a',
  'Romance': '#f4a261',
  'Animation': '#2a9d8f',
  'Adventure': '#e76f51',
  'Crime': '#264653',
  'Mystery': '#5e548e',
  'Fantasy': '#9b5de5',
  'Documentary': '#606c38',
  'Music': '#f72585',
  'War': '#6c584c',
}

interface MovieCardProps {
  movie: {
    tmdb_id: number
    title_en: string
    title_zh: string | null
    poster_url: string | null
    year: number | null
    genres: string[]
  }
  onPick: (pickMode: 'watched' | 'attracted') => void
  side: 'left' | 'right'
}

export default function MovieCard({ movie, onPick, side }: MovieCardProps) {
  const [pickMode, setPickMode] = useState<'watched' | 'attracted'>('attracted')
  const setAmbientColor = useSequencingStore((s) => s.setAmbientColor)

  function handleMouseEnter() {
    const primaryGenre = movie.genres[0]
    const color = GENRE_COLORS[primaryGenre] || '#888'
    setAmbientColor(color)
  }

  function handleMouseLeave() {
    setAmbientColor(null)
  }

  return (
    <motion.div
      className={styles.card}
      style={{ transformStyle: 'preserve-3d' }}
      initial={{ rotateY: 180, y: 30, scale: 0.9, opacity: 0 }}
      animate={{ rotateY: 0, y: 0, scale: 1, opacity: 1 }}
      exit={{ y: -30, scale: 0.85, opacity: 0, rotateY: 12 }}
      transition={{
        type: 'spring',
        stiffness: 120,
        damping: 18,
        delay: side === 'right' ? 0.12 : 0,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      whileHover={{ scale: 1.02, y: -4 }}
      onClick={() => { soundManager.play('pick'); onPick(pickMode) }}
    >
      {/* Card back face (visible during flip) */}
      <div className={styles.cardBack}>
        <i className="ri-dna-line" />
      </div>
      <div className={styles.poster}>
        {movie.poster_url ? (
          <img src={movie.poster_url} alt={movie.title_en} className={styles.posterImage} />
        ) : (
          <div className={styles.posterPlaceholder}>
            <i className="ri-film-line ri-3x" />
          </div>
        )}
      </div>

      <div className={styles.info}>
        <h3 className={styles.title}>{movie.title_zh || movie.title_en}</h3>
        {movie.title_zh && (
          <p className={styles.titleEn}>{movie.title_en}</p>
        )}
        {movie.year && <span className={styles.year}>{movie.year}</span>}
        <div className={styles.genres}>
          {movie.genres.slice(0, 3).map((g) => (
            <span key={g} className={styles.genre}>{g}</span>
          ))}
        </div>
      </div>

      <div className={styles.pickModeToggle}>
        <button
          className={`${styles.modeBtn} ${pickMode === 'watched' ? styles.modeActive : ''}`}
          onClick={(e) => { e.stopPropagation(); setPickMode('watched') }}
        >
          <i className="ri-eye-line" /> Watched
        </button>
        <button
          className={`${styles.modeBtn} ${pickMode === 'attracted' ? styles.modeActive : ''}`}
          onClick={(e) => { e.stopPropagation(); setPickMode('attracted') }}
        >
          <i className="ri-heart-line" /> Want to see
        </button>
      </div>
    </motion.div>
  )
}
