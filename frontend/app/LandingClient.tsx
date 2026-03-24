'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import LoginModal from '@/components/auth/LoginModal'
import { useI18n } from '@/lib/i18n'
import { useAuthStore } from '@/stores/authStore'
import FloatingLocaleToggle from '@/components/ui/FloatingLocaleToggle'
import Footer from '@/components/ui/Footer'
import styles from './page.module.css'

const PANELS = [
  { href: '/sequencing/seed', titleKey: 'landing.step1Title', descKey: 'landing.step1Desc', icon: 'ri-film-line',       photo: '/landing/panel-01.svg' },
  { href: '/sequencing', titleKey: 'landing.step2Title', descKey: 'landing.step2Desc', icon: 'ri-git-branch-line', photo: '/landing/panel-02.svg' },
  { href: '/dna', titleKey: 'landing.step3Title', descKey: 'landing.step3Desc', icon: 'ri-dna-line',      photo: '/landing/panel-03.svg' },
  { href: '/matches', titleKey: 'landing.step4Title', descKey: 'landing.step4Desc', icon: 'ri-group-line',    photo: '/landing/panel-04.svg' },
  { href: '/ticket', titleKey: 'landing.step5Title', descKey: 'landing.step5Desc', icon: 'ri-ticket-2-line', photo: '/landing/panel-05.svg' },
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
  }, [lines, sequenceKey, start, stepDelay])

  return visibleCount
}

export default function LandingClient() {
  const router = useRouter()
  const { t } = useI18n()
  const [loginOpen, setLoginOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [authNextPath, setAuthNextPath] = useState<string | undefined>()
  const [activeSlide, setActiveSlide] = useState(0)
  const { isAuthenticated } = useAuthStore()
  const heroRef = useRef<HTMLElement>(null)
  const galleryRef = useRef<HTMLDivElement>(null)
  const headlineText = t('landing.termLine4')
  const { displayed, done } = useTypewriter(headlineText)
  const terminalLines = useMemo(() => [
    t('landing.termLine1'),
    t('landing.termLine2'),
    t('landing.termLine3'),
    t('landing.step2Desc'),
  ], [t])
  const visibleTerminalLines = useTerminalSequence(terminalLines, done)

  // Spotlight cursor tracking
  useEffect(() => {
    const hero = heroRef.current
    if (!hero) return

    const handleMove = (e: MouseEvent) => {
      const rect = hero.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const y = ((e.clientY - rect.top) / rect.height) * 100
      hero.style.setProperty('--spotlight-x', `${x}%`)
      hero.style.setProperty('--spotlight-y', `${y}%`)
    }

    hero.addEventListener('mousemove', handleMove, { passive: true })
    return () => hero.removeEventListener('mousemove', handleMove)
  }, [])

  // Film-strip scroll tracking
  useEffect(() => {
    const track = galleryRef.current
    if (!track) return

    const handleScroll = () => {
      const scrollLeft = track.scrollLeft
      const cardWidth = track.scrollWidth / PANELS.length
      const index = Math.round(scrollLeft / cardWidth)
      setActiveSlide(Math.min(index, PANELS.length - 1))
    }

    track.addEventListener('scroll', handleScroll, { passive: true })
    return () => track.removeEventListener('scroll', handleScroll)
  }, [])

  const openAuthFlow = useCallback(async (mode: 'login' | 'register', nextPath?: string) => {
    const fallbackPath = nextPath ?? '/sequencing'

    if (isAuthenticated) {
      router.push(fallbackPath)
      return
    }

    setAuthNextPath(nextPath)
    setAuthMode(mode)
    setLoginOpen(true)
  }, [isAuthenticated, router])

  const handleProtectedEntry = useCallback((event: React.MouseEvent<HTMLElement>) => {
    const target = event.currentTarget.getAttribute('href')
    if (target === '/sequencing/seed' || target === '/sequencing') {
      return
    }

    event.preventDefault()
    void openAuthFlow('login', target || undefined)
  }, [openAuthFlow])

  // Magnetic button effect
  const handleMagnet = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const btn = e.currentTarget
    const rect = btn.getBoundingClientRect()
    const x = e.clientX - rect.left - rect.width / 2
    const y = e.clientY - rect.top - rect.height / 2
    btn.style.setProperty('--magnet-x', `${x * 0.15}px`)
    btn.style.setProperty('--magnet-y', `${y * 0.15}px`)
  }, [])

  const handleMagnetLeave = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.setProperty('--magnet-x', '0')
    e.currentTarget.style.setProperty('--magnet-y', '0')
  }, [])

  return (
    <main className={styles.main}>
      <LoginModal
        open={loginOpen}
        mode={authMode}
        nextPath={authNextPath}
        onClose={() => setLoginOpen(false)}
      />
      <FloatingLocaleToggle />
      <section className={styles.hero} ref={heroRef}>
        <div className={styles.panelStrip}>
          {PANELS.map((panel, i) => (
            <Link
              key={i}
              href={panel.href}
              prefetch={false}
              className={styles.panel}
              data-index={i}
              onClick={handleProtectedEntry}
            >
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
            </Link>
          ))}
        </div>

        <div className={styles.mobileGallery} aria-hidden="true">
          <div className={styles.mobileGalleryTrack} ref={galleryRef}>
            {PANELS.map((panel, i) => (
              <Link
                key={i}
                href={panel.href}
                prefetch={false}
                className={styles.mobileCard}
                data-index={i}
                onClick={handleProtectedEntry}
              >
                <div
                  className={styles.mobileCardPhoto}
                  style={{ backgroundImage: `url(${panel.photo})` }}
                />
              </Link>
            ))}
          </div>

          {/* Film-strip progress indicator */}
          <div className={styles.filmStrip}>
            {PANELS.map((_, i) => (
              <div
                key={i}
                className={`${styles.filmFrame} ${i === activeSlide ? styles.filmFrameActive : ''}`}
              />
            ))}
          </div>
        </div>

        <Link href="/" prefetch={false} className={styles.logo}>
          <span className={styles.logoMain}>Cine</span>
          <span className={styles.logoSub}>Sequence</span>
        </Link>

        <div className={styles.heroOverlay}>
          <span className={styles.sideLabel}>{t('landing.fileLabel', { id: '00' })}</span>
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
              <button
                type="button"
                className={styles.ctaPrimary}
                onMouseMove={handleMagnet}
                onMouseLeave={handleMagnetLeave}
                onClick={() => void openAuthFlow('register')}
              >
                {t('landing.start')}
              </button>
              <button
                type="button"
                className={styles.ctaSecondary}
                onMouseMove={handleMagnet}
                onMouseLeave={handleMagnetLeave}
                onClick={() => void openAuthFlow('login')}
              >
                {t('landing.login')}
              </button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
