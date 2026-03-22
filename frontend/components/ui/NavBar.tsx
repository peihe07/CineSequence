'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useI18n } from '@/lib/i18n'
import styles from './NavBar.module.css'

const NAV_ITEMS = [
  { href: '/sequencing', icon: 'ri-film-line', labelKey: 'nav.sequencing' },
  { href: '/dna', icon: 'ri-dna-line', labelKey: 'nav.dna' },
  { href: '/matches', icon: 'ri-hearts-line', labelKey: 'nav.matches' },
  { href: '/theaters', icon: 'ri-movie-2-line', labelKey: 'nav.theaters' },
  { href: '/profile', icon: 'ri-user-line', labelKey: 'nav.profile' },
]

export default function NavBar() {
  const pathname = usePathname()
  const { t } = useI18n()

  return (
    <>
      <nav className={styles.nav}>
        <div className={styles.inner}>
          {NAV_ITEMS.map(({ href, icon, labelKey }) => {
            const isActive = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`${styles.link} ${isActive ? styles.active : ''}`}
              >
                <i className={icon} />
                <span>{t(labelKey)}</span>
              </Link>
            )
          })}
        </div>
      </nav>
      <div className={styles.spacer} />
    </>
  )
}
