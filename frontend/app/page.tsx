'use client'

import Link from 'next/link'
import { useI18n } from '@/lib/i18n'
import styles from './page.module.css'

const PANELS = [
  { num: '01', titleKey: 'landing.step1Title' },
  { num: '02', titleKey: 'landing.step2Title' },
  { num: '03', titleKey: 'landing.step3Title' },
  { num: '04', titleKey: 'landing.step4Title' },
  { num: '05', titleKey: 'landing.step5Title' },
]

export default function Home() {
  const { t } = useI18n()

  return (
    <main className={styles.main}>
      {/* Hero — 5 cinematic panels + overlay */}
      <section className={styles.hero}>
        {/* Panel strip (background) */}
        <div className={styles.panelStrip}>
          {PANELS.map((panel, i) => (
            <div key={panel.num} className={styles.panel} data-index={i}>
              <span className={styles.panelBgNum}>{panel.num}</span>
              <div className={styles.panelLabel}>
                <span className={styles.panelLabelNum}>{panel.num}</span>
                <span className={styles.panelLabelTitle}>{t(panel.titleKey)}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Text overlay */}
        <div className={styles.heroOverlay}>
          <p className={styles.heroEyebrow}>CINE SEQUENCE</p>
          <h1 className={styles.heroHeadline}>{t('landing.termLine4')}</h1>
          <div className={styles.heroCta}>
            <Link href="/register" className={styles.ctaPrimary}>
              {t('landing.start')}
            </Link>
            <Link href="/login" className={styles.ctaSecondary}>
              {t('landing.login')}
            </Link>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        CINE SEQUENCE &copy; {new Date().getFullYear()}
      </footer>
    </main>
  )
}
