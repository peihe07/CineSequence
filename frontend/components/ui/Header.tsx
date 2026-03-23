'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n'
import LocaleToggle from './LocaleToggle'
import MuteToggle from './MuteToggle'
import styles from './Header.module.css'

const NAV_ITEMS = [
  { href: '/sequencing', labelKey: 'nav.sequencing' },
  { href: '/dna', labelKey: 'nav.dna' },
  { href: '/matches', labelKey: 'nav.matches' },
  { href: '/theaters', labelKey: 'nav.theaters' },
  { href: '/profile', labelKey: 'nav.profile' },
]

export default function Header() {
  const pathname = usePathname()
  const { t } = useI18n()
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const syncScroll = () => {
      setIsScrolled(window.scrollY > 16)
    }
    syncScroll()
    window.addEventListener('scroll', syncScroll, { passive: true })
    return () => window.removeEventListener('scroll', syncScroll)
  }, [])

  return (
    <header className={`${styles.header} ${isScrolled ? styles.scrolled : ''}`}>
      {/* Left: brand logo */}
      <Link href="/sequencing" className={styles.brand}>
        CINE SEQUENCE
      </Link>

      {/* Center: recessed nav tray with pill-shaped active item */}
      <nav className={styles.navTray} aria-label={t('nav.main')}>
        {NAV_ITEMS.map(({ href, labelKey }) => {
          const isActive = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
            >
              {t(labelKey)}
            </Link>
          )
        })}
      </nav>

      {/* Right: locale toggle + mute */}
      <div className={styles.right}>
        <MuteToggle />
        <LocaleToggle />
      </div>
    </header>
  )
}
