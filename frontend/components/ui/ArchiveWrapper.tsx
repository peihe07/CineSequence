'use client'

import { useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { useI18n } from '@/lib/i18n'
import styles from './ArchiveWrapper.module.css'

type ArchiveDensity = 'full' | 'minimal'

const FILE_IDS: Array<{ match: RegExp; fileId: string; cueKey: string; breadcrumbKey: string; density: ArchiveDensity }> = [
  { match: /^\/sequencing(?:\/|$)/, fileId: 'SEQ-00', cueKey: 'archive.sequencingCue', breadcrumbKey: 'archive.sequencingBreadcrumb', density: 'full' },
  { match: /^\/dna(?:\/|$)/, fileId: 'DNA-01', cueKey: 'archive.dnaCue', breadcrumbKey: 'archive.dnaBreadcrumb', density: 'full' },
  { match: /^\/matches(?:\/|$)/, fileId: 'MTC-02', cueKey: 'archive.matchesCue', breadcrumbKey: 'archive.matchesBreadcrumb', density: 'full' },
  { match: /^\/theaters(?:\/|$)/, fileId: 'THR-03', cueKey: 'archive.theatersCue', breadcrumbKey: 'archive.theatersBreadcrumb', density: 'full' },
  { match: /^\/profile(?:\/|$)/, fileId: 'USR-04', cueKey: 'archive.profileCue', breadcrumbKey: 'archive.profileBreadcrumb', density: 'minimal' },
  { match: /^\/ticket(?:\/|$)/, fileId: 'TKT-05', cueKey: 'archive.ticketCue', breadcrumbKey: 'archive.ticketBreadcrumb', density: 'full' },
  { match: /^\/admin(?:\/|$)/, fileId: 'ADM-99', cueKey: 'archive.adminCue', breadcrumbKey: 'archive.adminBreadcrumb', density: 'minimal' },
]

function resolveArchiveMeta(pathname: string) {
  return FILE_IDS.find(({ match }) => match.test(pathname)) ?? {
    fileId: 'ARC-00',
    cueKey: 'archive.defaultCue',
    breadcrumbKey: 'archive.defaultBreadcrumb',
    density: 'full' as ArchiveDensity,
  }
}

export default function ArchiveWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { t } = useI18n()
  const { fileId, cueKey, breadcrumbKey, density } = useMemo(() => resolveArchiveMeta(pathname), [pathname])

  // Minimal density: only HUD row + content, no rails / scan badge / frame decorations
  if (density === 'minimal') {
    return (
      <div className={`${styles.archive} ${styles.archiveMinimal}`}>
        <div className={styles.content}>
          <div className={styles.hudRow} aria-hidden="true">
            <span className={styles.hudCue}>[{t(cueKey)}]</span>
            <span className={styles.hudMeta}>{t(breadcrumbKey)}</span>
          </div>
          {children}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.archive}>
      <div className={styles.frame}>
        <div className={styles.leftRail} aria-hidden="true">
          <span className={styles.sideLabel}>{t('archive.file', { id: fileId })}</span>
          <span className={styles.sideRule} />
        </div>

        <div className={styles.content}>
          <div className={styles.hudRow} aria-hidden="true">
            <span className={styles.hudCue}>[{t(cueKey)}]</span>
            <span className={styles.hudMeta}>{t(breadcrumbKey)}</span>
          </div>
          {children}
        </div>

        <div className={styles.rightRail} aria-hidden="true">
          <span className={styles.timecode}>TC 00:24:16</span>
          <span className={styles.status}>{t('archive.statusReady')}</span>
        </div>
      </div>
      <div className={styles.scanBadge} aria-hidden="true">
        <span className={styles.scanIndex}>{fileId}</span>
        <span className={styles.scanLabel}>{t('archive.scanComplete')}</span>
      </div>
    </div>
  )
}
