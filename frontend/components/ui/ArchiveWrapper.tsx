'use client'

import { useMemo } from 'react'
import { usePathname } from 'next/navigation'
import styles from './ArchiveWrapper.module.css'

const FILE_IDS: Array<{ match: RegExp; fileId: string; cue: string }> = [
  { match: /^\/sequencing(?:\/|$)/, fileId: 'SEQ-00', cue: 'SEQUENCING PIPELINE' },
  { match: /^\/dna(?:\/|$)/, fileId: 'DNA-01', cue: 'MOVIE DNA REPORT' },
  { match: /^\/matches(?:\/|$)/, fileId: 'MTC-02', cue: 'MATCH RESOLUTION' },
  { match: /^\/theaters(?:\/|$)/, fileId: 'THR-03', cue: 'SCREENING INDEX' },
  { match: /^\/profile(?:\/|$)/, fileId: 'USR-04', cue: 'USER DOSSIER' },
  { match: /^\/ticket(?:\/|$)/, fileId: 'TKT-05', cue: 'ADMISSION RECORD' },
  { match: /^\/admin(?:\/|$)/, fileId: 'ADM-99', cue: 'CONTROL ACCESS' },
]

function resolveArchiveMeta(pathname: string) {
  return FILE_IDS.find(({ match }) => match.test(pathname)) ?? {
    fileId: 'ARC-00',
    cue: 'ARCHIVE VIEW',
  }
}

export default function ArchiveWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { fileId, cue } = useMemo(() => resolveArchiveMeta(pathname), [pathname])

  return (
    <div className={styles.archive}>
      <div className={styles.frame}>
        <div className={styles.leftRail} aria-hidden="true">
          <span className={styles.sideLabel}>FILE {fileId}</span>
          <span className={styles.sideRule} />
        </div>

        <div className={styles.content}>
          <div className={styles.hudRow} aria-hidden="true">
            <span className={styles.hudCue}>[{cue}]</span>
            <span className={styles.hudMeta}>GEN_SEQ v2.0.4 // SCALE 1.0</span>
          </div>
          {children}
        </div>

        <div className={styles.rightRail} aria-hidden="true">
          <span className={styles.timecode}>TC 00:24:16</span>
          <span className={styles.status}>ARCHIVE READY</span>
        </div>
      </div>
    </div>
  )
}
