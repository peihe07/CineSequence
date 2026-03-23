'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n'
import FloatingLocaleToggle from '@/components/ui/FloatingLocaleToggle'
import styles from './page.module.css'

const PANELS = [
  { titleKey: 'landing.step1Title', descKey: 'landing.step1Desc', icon: 'ri-film-line',       photo: '/landing/panel-01.svg' },
  { titleKey: 'landing.step2Title', descKey: 'landing.step2Desc', icon: 'ri-git-branch-line', photo: '/landing/panel-02.svg' },
  { titleKey: 'landing.step3Title', descKey: 'landing.step3Desc', icon: 'ri-dna-line',      photo: '/landing/panel-03.svg' },
  { titleKey: 'landing.step4Title', descKey: 'landing.step4Desc', icon: 'ri-group-line',    photo: '/landing/panel-04.svg' },
  { titleKey: 'landing.step5Title', descKey: 'landing.step5Desc', icon: 'ri-ticket-2-line', photo: '/landing/panel-05.svg' },
]

function useTypewriter(text: string, speed = 60, delay = 800) {
  const [displayed, setDisplayed] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    setDisplayed('')
    setDone(false)

    const delayTimer = setTimeout(() => {
      let i = 0
      const interval = setInterval(() => {
        i++
        setDisplayed(text.slice(0, i))
        if (i >= text.length) {
          clearInterval(interval)
          setDone(true)
        }
      }, speed)
      return () => clearInterval(interval)
    }, delay)

    return () => clearTimeout(delayTimer)
  }, [text, speed, delay])

  return { displayed, done }
}

function useTerminalSequence(lines: string[], start: boolean, stepDelay = 220) {
  const [visibleCount, setVisibleCount] = useState(0)
  const sequenceKey = lines.join('||')

  useEffect(() => {
    if (!start) {
      setVisibleCount(0)
      return
    }

    setVisibleCount(0)
    const timers = lines.map((_, index) =>
      window.setTimeout(() => {
        setVisibleCount(index + 1)
      }, index * stepDelay),
    )

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [sequenceKey, start, stepDelay])

  return visibleCount
}

export default function Home() {
  const { t } = useI18n()
  const headlineText = t('landing.termLine4')
  const { displayed, done } = useTypewriter(headlineText)
  const terminalLines = useMemo(() => [
    t('landing.termLine1'),
    t('landing.termLine2'),
    t('landing.termLine3'),
    t('landing.step2Desc'),
  ], [t])
  const visibleTerminalLines = useTerminalSequence(terminalLines, done)

  return (
    <main className={styles.main}>
      <FloatingLocaleToggle />
      <section className={styles.hero}>
        <div className={styles.panelStrip}>
          {PANELS.map((panel, i) => (
            <div key={i} className={styles.panel} data-index={i}>
              <div
                className={styles.panelPhoto}
                style={{ backgroundImage: `url(${panel.photo})` }}
              />
              <div className={styles.panelIconWrap}>
                <i className={`${panel.icon} ${styles.panelIcon}`} />
              </div>
              <div className={styles.panelLabel}>
                <span className={styles.panelLabelTitle}>{t(panel.titleKey)}</span>
                {panel.descKey && <p className={styles.panelLabelDesc}>{t(panel.descKey)}</p>}
              </div>
            </div>
          ))}
        </div>

        <div className={styles.mobileGallery} aria-hidden="true">
          <div className={styles.mobileGalleryTrack}>
            {PANELS.map((panel, i) => (
              <div key={i} className={styles.mobileCard} data-index={i}>
                <div
                  className={styles.mobileCardPhoto}
                  style={{ backgroundImage: `url(${panel.photo})` }}
                />
              </div>
            ))}
          </div>
        </div>

        <Link href="/" className={styles.logo}>
          <span className={styles.logoMain}>Cine</span>
          <span className={styles.logoSub}>Sequence</span>
        </Link>

        <div className={styles.heroOverlay}>
          <span className={styles.sideLabel}>FILE 00</span>
          <div className={styles.manifest}>
            <h1 className={styles.heroHeadline}>
              <span className={styles.headlineText}>{displayed}</span>
              <span className={`${styles.cursor} ${done ? styles.cursorBlink : ''}`}>|</span>
            </h1>
            <div className={styles.terminal}>
              {terminalLines.map((line, index) => (
                <span
                  key={line}
                  className={`${styles.terminalLine} ${index < visibleTerminalLines ? styles.terminalLineVisible : ''}`}
                >
                  {line}
                </span>
              ))}
            </div>
            <div className={`${styles.heroCta} ${done ? styles.heroCtaVisible : ''}`}>
              <Link href="/register" className={styles.ctaPrimary}>
                {t('landing.start')}
              </Link>
              <Link href="/login" className={styles.ctaSecondary}>
                {t('landing.login')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <span className={styles.footerCopy}>&copy; {new Date().getFullYear()} peihe</span>
        <span className={styles.footerDot} aria-hidden="true" />
        <a href="mailto:y450376@gmail.com" className={styles.footerIcon} aria-label={t('landing.contactEmail')}>
          <i className="ri-mail-line" />
        </a>
        <a
          href="https://medium.com/@peihe07"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.footerIcon}
          aria-label={t('landing.contactBlog')}
        >
          <i className="ri-article-line" />
        </a>
      </footer>
    </main>
  )
}
