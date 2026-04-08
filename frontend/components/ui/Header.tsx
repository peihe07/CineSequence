'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import LoginModal from '@/components/auth/LoginModal'
import { useI18n } from '@/lib/i18n'
import { soundManager } from '@/lib/sound'
import { useAuthStore } from '@/stores/authStore'
import LocaleToggle from './LocaleToggle'
import MuteToggle from './MuteToggle'
import NotificationBell from './NotificationBell'
import Button from './Button'
import styles from './Header.module.css'

const NAV_ITEMS = [
  { href: '/sequencing', labelKey: 'nav.sequencing', index: '00' },
  { href: '/dna', labelKey: 'nav.dna', index: '01' },
  { href: '/matches', labelKey: 'nav.matches', index: '02' },
  { href: '/theaters', labelKey: 'nav.theaters', index: '03' },
  { href: '/profile', labelKey: 'nav.profile', index: '04', authOnly: true },
]

export default function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const { t } = useI18n()
  const user = useAuthStore((state) => state.user)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const logout = useAuthStore((state) => state.logout)
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)

  useEffect(() => {
    const syncScroll = () => {
      setIsScrolled(window.scrollY > 16)
    }
    syncScroll()
    window.addEventListener('scroll', syncScroll, { passive: true })
    return () => window.removeEventListener('scroll', syncScroll)
  }, [])

  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname])

  function handleNavCue() {
    soundManager.play('flip', { volume: 0.12, playbackRate: 1.08 })
  }

  async function handleLogout() {
    setIsMobileMenuOpen(false)
    setIsLoggingOut(true)
    try {
      await logout()
      router.replace('/')
    } finally {
      setIsLoggingOut(false)
    }
  }

  const navItems = user?.is_admin
    ? [...NAV_ITEMS, { href: '/admin', labelKey: 'nav.admin', index: '05' }]
    : NAV_ITEMS

  function renderNavLinks(linkClassName = styles.navLink, activeClassName = styles.navLinkActive) {
    return navItems
      .filter((item) => !item.authOnly || isAuthenticated)
      .map(({ href, labelKey, index }) => {
      const isActive = pathname.startsWith(href)
      return (
        <Link
          key={href}
          href={href}
          prefetch={false}
          className={`${linkClassName} ${isActive ? activeClassName : ''}`}
          onClick={handleNavCue}
        >
          <span className={styles.navIndex}>{index}</span>
          <span>{t(labelKey)}</span>
        </Link>
      )
      })
  }

  return (
    <header className={`${styles.header} ${isScrolled ? styles.scrolled : ''}`}>
      <Link
        href="/"
        prefetch={false}
        className={styles.brand}
        onClick={handleNavCue}
      >
        <span className={styles.brandMain}>Cine</span>
        <span className={styles.brandSub}>Sequence</span>
      </Link>

      <nav className={styles.navTray} aria-label={t('nav.main')}>
        {renderNavLinks()}
      </nav>

      <div className={styles.right}>
        <NotificationBell />
        <MuteToggle />
        <div className={styles.desktopLocale}>
          <LocaleToggle />
        </div>
        {isAuthenticated ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={styles.desktopLogout}
            onClick={() => void handleLogout()}
            loading={isLoggingOut}
          >
            {t('profile.logout')}
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={styles.desktopLogout}
            onClick={() => setIsLoginModalOpen(true)}
          >
            {t('auth.signIn')}
          </Button>
        )}
        <button
          type="button"
          className={styles.menuToggle}
          aria-label={isMobileMenuOpen ? t('header.closeMenu') : t('header.openMenu')}
          aria-expanded={isMobileMenuOpen}
          aria-controls="mobile-nav-sheet"
          onClick={() => setIsMobileMenuOpen((prev) => !prev)}
        >
          <span className={styles.menuLine} />
          <span className={styles.menuLine} />
          <span className={styles.menuLine} />
        </button>
      </div>

      {isMobileMenuOpen && (
        <div
          id="mobile-nav-sheet"
          className={styles.mobileMenu}
          role="dialog"
          aria-modal="false"
          aria-label={t('header.mobileMenu')}
        >
          <nav className={styles.mobileNavList} aria-label={t('header.mobileMenu')}>
            {renderNavLinks(styles.mobileNavLink, styles.mobileNavLinkActive)}
          </nav>
          <div className={styles.mobileUtilityRow}>
            <span className={styles.mobileUtilityLabel}>{t('header.language')}</span>
            <LocaleToggle />
          </div>
          {isAuthenticated ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className={styles.mobileLogout}
              onClick={() => void handleLogout()}
              loading={isLoggingOut}
            >
              {t('profile.logout')}
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className={styles.mobileLogout}
              onClick={() => {
                setIsMobileMenuOpen(false)
                setIsLoginModalOpen(true)
              }}
            >
              {t('auth.signIn')}
            </Button>
          )}
        </div>
      )}

      <LoginModal
        open={isLoginModalOpen}
        mode="register"
        nextPath={pathname}
        onClose={() => setIsLoginModalOpen(false)}
      />
    </header>
  )
}
