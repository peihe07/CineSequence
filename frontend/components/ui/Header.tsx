'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n'
import LocaleToggle from './LocaleToggle'
import MuteToggle from './MuteToggle'
import styles from './Header.module.css'

const NAV_ITEMS = [
  { href: '/sequencing', labelKey: 'nav.sequencing', index: '00' },
  { href: '/dna', labelKey: 'nav.dna', index: '01' },
  { href: '/matches', labelKey: 'nav.matches', index: '02' },
  { href: '/theaters', labelKey: 'nav.theaters', index: '03' },
  { href: '/profile', labelKey: 'nav.profile', index: '04' },
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
        <span className={styles.brandMain}>Cine</span>
        <span className={styles.brandSub}>Sequence</span>
      </Link>

      {/* Center: recessed nav tray with sequenced active item */}
      <nav className={styles.navTray} aria-label={t('nav.main')}>
        {NAV_ITEMS.map(({ href, labelKey, index }) => {
          const isActive = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
            >
              <span className={styles.navIndex}>{index}</span>
              <span>{t(labelKey)}</span>
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
