'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useI18n } from '@/lib/i18n'
import { getTagLabel } from '@/lib/tagLabels'
import styles from './AIReading.module.css'

interface AIReadingProps {
  topTags: string[]
  personalityReading: string | null
  hiddenTraits: string[]
  conversationStyle: string | null
  idealMovieDate: string | null
}

function useShouldAnimateTypewriter() {
  const [shouldAnimate, setShouldAnimate] = useState(true)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const isCoarsePointer = window.matchMedia('(hover: none) and (pointer: coarse)').matches

    setShouldAnimate(!prefersReducedMotion && !isCoarsePointer)
  }, [])

  return shouldAnimate
}

function useTypewriter(text: string, enabled: boolean, speed: number = 30) {
  const [displayed, setDisplayed] = useState('')
  const [isDone, setIsDone] = useState(false)

  useEffect(() => {
    if (!text) {
      setDisplayed('')
      setIsDone(true)
      return
    }

    if (!enabled) {
      setDisplayed(text)
      setIsDone(true)
      return
    }

    setDisplayed('')
    setIsDone(false)
    let i = 0

    const interval = setInterval(() => {
      if (i < text.length) {
        setDisplayed(text.slice(0, i + 1))
        i++
      } else {
        setIsDone(true)
        clearInterval(interval)
      }
    }, speed)

    return () => clearInterval(interval)
  }, [text, enabled, speed])

  return { displayed, isDone }
}

function getReadingPreview(text: string, maxLength: number = 110) {
  if (text.length <= maxLength) return text
  const preview = text.slice(0, maxLength).trimEnd()
  return `${preview}…`
}

export default function AIReading({
  topTags,
  personalityReading,
  hiddenTraits,
  conversationStyle,
  idealMovieDate,
}: AIReadingProps) {
  const { t, locale } = useI18n()
  const [expanded, setExpanded] = useState(false)
  const shouldAnimateTypewriter = useShouldAnimateTypewriter()
  const previewText = useMemo(
    () => getReadingPreview(personalityReading || ''),
    [personalityReading],
  )
  const { displayed, isDone } = useTypewriter(previewText, shouldAnimateTypewriter, 18)

  if (!personalityReading) return null

  const canExpand = personalityReading.length > previewText.length
  const readingText = isDone ? (expanded ? personalityReading : previewText) : displayed

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>
        <i className="ri-brain-line" /> {t('dna.reading')}
      </h3>

      <div className={styles.readingBox}>
        {topTags.length > 0 && (
          <div className={styles.signalStrip}>
            <span className={styles.signalLabel}>{t('dna.signal')}</span>
            <div className={styles.signalTags}>
              {topTags.slice(0, 3).map((tag) => (
                <span key={tag} className={styles.signalTag}>
                  {getTagLabel(tag, locale)}
                </span>
              ))}
            </div>
          </div>
        )}
        <p className={styles.reading}>
          {readingText}
          {!isDone && <span className={styles.cursor}>|</span>}
        </p>
        {isDone && canExpand && (
          <button
            type="button"
            className={styles.toggle}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? t('dna.showLess') : t('dna.showMore')}
          </button>
        )}
      </div>

      {isDone && (
        <motion.div
          className={styles.extras}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {hiddenTraits.length > 0 && (
            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>
                <i className="ri-eye-off-line" /> {t('dna.traits')}
              </h4>
              <div className={styles.traits}>
                {hiddenTraits.map((trait) => (
                  <span key={trait} className={styles.trait}>{trait}</span>
                ))}
              </div>
            </div>
          )}

          {conversationStyle && (
            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>
                <i className="ri-chat-smile-2-line" /> {t('dna.style')}
              </h4>
              <p className={styles.sectionText}>{conversationStyle}</p>
            </div>
          )}

          {idealMovieDate && (
            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>
                <i className="ri-movie-2-line" /> {t('dna.idealDate')}
              </h4>
              <p className={styles.sectionText}>{idealMovieDate}</p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}
