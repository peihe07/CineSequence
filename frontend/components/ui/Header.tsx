'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useI18n } from '@/lib/i18n'
import MuteToggle from './MuteToggle'
import styles from './Header.module.css'

const TITLE_MAP: Record<string, string> = {
  '/sequencing': 'nav.sequencing',
  '/sequencing/seed': 'nav.sequencing',
  '/sequencing/complete': 'nav.sequencing',
  '/dna': 'nav.dna',
  '/matches': 'nav.matches',
  '/theaters': 'nav.theaters',
  '/profile': 'nav.profile',
  '/admin': 'nav.admin',
}

const ROOT_PATHS = ['/sequencing', '/dna', '/matches', '/theaters', '/profile']

export default function Header() {
  const router = useRouter()
  const pathname = usePathname()
  const { t } = useI18n()

  const isRoot = ROOT_PATHS.includes(pathname)
  const titleKey = TITLE_MAP[pathname] || Object.entries(TITLE_MAP).find(([p]) => pathname.startsWith(p))?.[1]

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        {!isRoot && (
          <button onClick={() => router.back()} className={styles.backBtn} aria-label="Back">
            <i className="ri-arrow-left-s-line" />
          </button>
        )}
      </div>
      <span className={styles.title}>{titleKey ? t(titleKey) : ''}</span>
      <div className={styles.right}>
        <MuteToggle />
      </div>
    </header>
  )
}
