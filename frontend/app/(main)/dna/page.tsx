'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useDnaStore } from '@/stores/dnaStore'
import { useI18n } from '@/lib/i18n'
import ArchetypeCard from '@/components/dna/ArchetypeCard'
import StarNebula from '@/components/dna/StarNebula'
import TagCloud from '@/components/dna/TagCloud'
import RadarChart from '@/components/dna/RadarChart'
import AIReading from '@/components/dna/AIReading'
import Button from '@/components/ui/Button'
import styles from './page.module.css'

export default function DnaResultPage() {
  const router = useRouter()
  const { t } = useI18n()
  const { result, isBuilding, isLoading, error, buildDna, fetchResult } = useDnaStore()

  useEffect(() => {
    // Try to fetch existing result first; if 404, trigger build
    fetchResult().catch(() => {
      buildDna()
    })
  }, [fetchResult, buildDna])

  // Building state — loading animation
  if (isBuilding || (isLoading && !result)) {
    return (
      <main className={styles.container}>
        <div className={styles.loading}>
          <motion.div
            className={styles.dnaHelix}
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          >
            <i className="ri-dna-line" style={{ fontSize: '3rem' }} />
          </motion.div>
          <motion.p
            className={styles.loadingText}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {t('dna.analyzing')}
          </motion.p>
        </div>
      </main>
    )
  }

  if (error && !result) {
    return (
      <main className={styles.container}>
        <div className={styles.error}>
          <i className="ri-error-warning-line" style={{ fontSize: '2rem' }} />
          <p>{error}</p>
          <Button variant="secondary" onClick={() => buildDna()}>
            {t('dna.retry')}
          </Button>
        </div>
      </main>
    )
  }

  if (!result) return null

  return (
    <main className={styles.container}>
      <motion.div
        className={styles.content}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className={styles.header}>
          <motion.h1
            className={styles.title}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            {t('dna.title')}
          </motion.h1>
        </div>

        <StarNebula
          genreVector={result.genre_vector}
          archetypeId={result.archetype.id}
        />

        <ArchetypeCard archetype={result.archetype} />

        <div className={styles.grid}>
          <RadarChart scores={result.quadrant_scores} />
          <TagCloud tagLabels={result.tag_labels} />
        </div>

        <AIReading
          personalityReading={result.personality_reading}
          hiddenTraits={result.hidden_traits}
          conversationStyle={result.conversation_style}
          idealMovieDate={result.ideal_movie_date}
        />

        <div className={styles.actions}>
          <Button
            variant="primary"
            size="lg"
            onClick={() => router.push('/matches')}
          >
            <i className="ri-group-line" /> {t('dna.findMatches')}
          </Button>
        </div>
      </motion.div>
    </main>
  )
}
