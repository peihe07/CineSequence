'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import FloatingLocaleToggle from '@/components/ui/FloatingLocaleToggle'
import { useI18n } from '@/lib/i18n'
import styles from './layout.module.css'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isRegister = pathname === '/register'
  const { t } = useI18n()

  return (
    <main className={styles.shell}>
      <FloatingLocaleToggle />
      <div className={styles.sideLabelGroup}>
        <span className={styles.sideLabel}>{t('auth.layoutAccess')}</span>
        <div className={styles.sideLine} />
      </div>
      <div className={styles.backdrop} aria-hidden="true" />
      <section className={`${styles.card} ${isRegister ? styles.cardWide : ''}`}>
        {isRegister ? (
          <div className={styles.cardSplit}>
            <aside className={styles.intro}>
              <div className={styles.introTop}>
                <span className={styles.introKicker}>{t('auth.layoutKicker')}</span>
                <Link href="/" prefetch={false} className={styles.brand}>
                  <span className={styles.brandScript}>Cine</span>
                  <span className={styles.brandMono}>Sequence</span>
                </Link>
                <h1 className={styles.introHeadline}>{t('auth.layoutHeadline')}</h1>
                <p className={styles.introCopy}>{t('auth.layoutCopy')}</p>
                <div className={styles.introMeta}>
                  <span className={styles.introStatus}>{t('auth.layoutStatus')}</span>
                  <span className={styles.introPath}>{t('auth.layoutPath')}</span>
                  <span className={styles.introTimecode}>{t('auth.layoutTimecode')}</span>
                </div>
              </div>
              <div className={styles.introNotes}>
                <div className={styles.introNote}>
                  <span className={styles.introNoteLabel}>{t('auth.layoutRuleTitle')}</span>
                  <span className={styles.introNoteText}>{t('auth.layoutRuleBody')}</span>
                </div>
                <div className={styles.introNote}>
                  <span className={styles.introNoteLabel}>{t('auth.layoutGateTitle')}</span>
                  <span className={styles.introNoteText}>{t('auth.layoutGateBody')}</span>
                </div>
              </div>
            </aside>
            <div className={styles.formPane}>
              <div className={styles.cardMeta}>
                <span className={styles.eyebrow}>{t('auth.layoutEyebrow')}</span>
                <span className={styles.status}>{t('auth.layoutGateway')}</span>
              </div>
              <div className={styles.content}>{children}</div>
              <div className={styles.footerMeta}>
                <span>{t('auth.layoutFooterPath')}</span>
                <span>{t('auth.layoutFooterFile')}</span>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className={styles.cardMeta}>
              <span className={styles.eyebrow}>{t('auth.layoutEyebrow')}</span>
              <span className={styles.status}>{t('auth.layoutGateway')}</span>
            </div>
            <Link href="/" prefetch={false} className={styles.brand}>
              <span className={styles.brandScript}>Cine</span>
              <span className={styles.brandMono}>Sequence</span>
            </Link>
            <div className={styles.content}>{children}</div>
            <div className={styles.footerMeta}>
              <span>{t('auth.layoutFooterPath')}</span>
              <span>{t('auth.layoutFooterFile')}</span>
            </div>
          </>
        )}
      </section>
    </main>
  )
}
