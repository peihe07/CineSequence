'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import styles from './AIReading.module.css'

interface AIReadingProps {
  personalityReading: string | null
  hiddenTraits: string[]
  conversationStyle: string | null
  idealMovieDate: string | null
}

function useTypewriter(text: string, speed: number = 30) {
  const [displayed, setDisplayed] = useState('')
  const [isDone, setIsDone] = useState(false)

  useEffect(() => {
    if (!text) {
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
  }, [text, speed])

  return { displayed, isDone }
}

export default function AIReading({
  personalityReading,
  hiddenTraits,
  conversationStyle,
  idealMovieDate,
}: AIReadingProps) {
  const { displayed, isDone } = useTypewriter(personalityReading || '', 25)

  if (!personalityReading) return null

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>
        <i className="ri-brain-line" /> AI Personality Reading
      </h3>

      <div className={styles.readingBox}>
        <p className={styles.reading}>
          {displayed}
          {!isDone && <span className={styles.cursor}>|</span>}
        </p>
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
                <i className="ri-eye-off-line" /> Hidden Traits
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
                <i className="ri-chat-smile-2-line" /> Conversation Style
              </h4>
              <p className={styles.sectionText}>{conversationStyle}</p>
            </div>
          )}

          {idealMovieDate && (
            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>
                <i className="ri-movie-2-line" /> Ideal Movie Date
              </h4>
              <p className={styles.sectionText}>{idealMovieDate}</p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}
