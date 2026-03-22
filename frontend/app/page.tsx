'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n'
import styles from './page.module.css'

interface TermLine {
  key: string
  type: 'normal' | 'highlight' | 'prompt'
  delay: number
}

const LINES: TermLine[] = [
  { key: 'landing.termLine1', type: 'normal', delay: 0 },
  { key: 'landing.termLine2', type: 'normal', delay: 800 },
  { key: 'landing.termLine3', type: 'normal', delay: 1600 },
  { key: 'landing.termLine4', type: 'highlight', delay: 2800 },
  { key: 'landing.termLine5', type: 'prompt', delay: 3800 },
]

const FLOW_STEPS = [
  { num: '01', titleKey: 'landing.step1Title', descKey: 'landing.step1Desc', icon: 'ri-film-line' },
  { num: '02', titleKey: 'landing.step2Title', descKey: 'landing.step2Desc', icon: 'ri-git-branch-line' },
  { num: '03', titleKey: 'landing.step3Title', descKey: 'landing.step3Desc', icon: 'ri-dna-line' },
  { num: '04', titleKey: 'landing.step4Title', descKey: 'landing.step4Desc', icon: 'ri-group-line' },
  { num: '05', titleKey: 'landing.step5Title', descKey: 'landing.step5Desc', icon: 'ri-ticket-2-line' },
]

export default function Home() {
  const { t } = useI18n()
  const router = useRouter()
  const [visibleCount, setVisibleCount] = useState(0)
  const [responded, setResponded] = useState(false)
  const allLinesVisible = visibleCount >= LINES.length

  // Sequentially reveal lines
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    LINES.forEach((line, i) => {
      timers.push(setTimeout(() => setVisibleCount(i + 1), line.delay))
    })
    return () => timers.forEach(clearTimeout)
  }, [])

  // Keyboard listener: press Y to start
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (!allLinesVisible || responded) return
    if (e.key === 'y' || e.key === 'Y') {
      setResponded(true)
      setTimeout(() => router.push('/register'), 600)
    }
  }, [allLinesVisible, responded, router])

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  return (
    <main className={styles.main}>
      {/* Terminal hero section */}
      <section className={styles.hero}>
        <div className={styles.terminal}>
          <div className={styles.titleBar}>
            <span className={styles.dot} />
            <span className={styles.dot} />
            <span className={styles.dot} />
            <span className={styles.titleText}>CINE_SEQUENCE v1.0</span>
          </div>

          <div className={styles.body}>
            {LINES.slice(0, visibleCount).map((line, i) => {
              if (line.type === 'prompt') {
                return (
                  <div key={i}>
                    <div className={styles.prompt} style={{ animationDelay: '0ms' }}>
                      <span className={styles.linePrefix}>&gt;</span>
                      {t(line.key)}
                      {!responded && <span className={styles.cursor} />}
                    </div>
                    {responded && (
                      <div className={styles.response}>
                        <span className={styles.linePrefix}>&gt;</span>
                        Y
                      </div>
                    )}
                  </div>
                )
              }
              return (
                <div
                  key={i}
                  className={`${styles.line} ${line.type === 'highlight' ? styles.lineHighlight : ''}`}
                  style={{ animationDelay: '0ms' }}
                >
                  <span className={styles.linePrefix}>&gt;</span>
                  {t(line.key)}
                </div>
              )
            })}
          </div>

          {allLinesVisible && !responded && (
            <div className={styles.ctaArea} style={{ animationDelay: '400ms' }}>
              <div className={styles.ctaRow}>
                <Link href="/register" className={styles.ctaPrimary}>
                  {t('landing.start')}
                </Link>
                <Link href="/login" className={styles.ctaSecondary}>
                  {t('landing.login')}
                </Link>
              </div>
              <span className={styles.hint}>{t('landing.termHint')}</span>
            </div>
          )}
        </div>
      </section>

      {/* Flow steps section */}
      <section className={styles.flowSection}>
        <h2 className={styles.flowTitle}>{t('landing.howTitle')}</h2>
        <div className={styles.flowTimeline}>
          {FLOW_STEPS.map((step, i) => (
            <div key={step.num} className={styles.flowStep}>
              <div className={styles.stepLeft}>
                <span className={styles.stepNum}>{step.num}</span>
                {i < FLOW_STEPS.length - 1 && <div className={styles.stepConnector} />}
              </div>
              <div className={styles.stepCard}>
                <div className={styles.stepHeader}>
                  <i className={step.icon} />
                  <span className={styles.stepTitle}>{t(step.titleKey)}</span>
                </div>
                <p className={styles.stepDesc}>{t(step.descKey)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className={styles.bottomCta}>
        <Link href="/register" className={styles.ctaPrimary}>
          {t('landing.start')}
        </Link>
      </section>

      <footer className={styles.footer}>
        CINE SEQUENCE &copy; {new Date().getFullYear()}
      </footer>
    </main>
  )
}
