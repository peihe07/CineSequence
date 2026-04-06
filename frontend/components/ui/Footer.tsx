'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n'
import styles from './Footer.module.css'

type FooterModalKind = 'privacy' | 'terms' | null

export default function Footer() {
  const { t } = useI18n()
  const [openModal, setOpenModal] = useState<FooterModalKind>(null)
  const supportUrl =
    process.env.NEXT_PUBLIC_SUPPORT_URL?.trim() ||
    process.env.NEXT_PUBLIC_BUYMEACOFFEE_URL?.trim()
  const supportHref = supportUrl || '/pricing#support'

  useEffect(() => {
    if (!openModal) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpenModal(null)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [openModal])

  const isPrivacy = openModal === 'privacy'
  const modalTitle = isPrivacy ? t('privacy.title') : t('terms.title')
  const modalUpdated = isPrivacy ? t('privacy.lastUpdated') : t('terms.lastUpdated')

  return (
    <>
      <footer className={styles.footer}>
        <div className={styles.inner}>
          <div className={styles.signature}>
            <span className={styles.signatureKicker}>Cinematic Archive</span>
            <div className={styles.signatureText}>
              <span className={styles.signatureTitle}>
                <span className={styles.signatureTitleMain}>Cine</span>
                <span className={styles.signatureTitleSub}>Sequence</span>
              </span>
            </div>
          </div>

          <div className={styles.utilityRow}>
            <a href="mailto:y450376@gmail.com" className={styles.footerMail} aria-label={t('landing.contactEmail')}>
              <i className="ri-mail-line" />
              <span>y450376@gmail.com</span>
            </a>

            <a
              href={supportHref}
              className={styles.footerSupport}
              target={supportUrl ? '_blank' : undefined}
              rel={supportUrl ? 'noreferrer noopener external' : undefined}
              aria-label={t('footer.supportAria')}
            >
              <i className="ri-cup-line" />
              <span>{t('footer.support')}</span>
            </a>

            <nav className={styles.footerNav} aria-label={t('footer.nav')}>
              <Link href="/about" className={styles.footerLink}>
                {t('footer.about')}
              </Link>
              <Link href="/pricing" className={styles.footerLink}>
                {t('footer.pricing')}
              </Link>
              <button type="button" className={styles.footerLink} onClick={() => setOpenModal('privacy')}>
                {t('footer.privacy')}
              </button>
              <button type="button" className={styles.footerLink} onClick={() => setOpenModal('terms')}>
                {t('footer.terms')}
              </button>
            </nav>
            <span className={styles.footerYear}>&copy; {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>

      {openModal ? (
        <div className={styles.overlay} onClick={() => setOpenModal(null)}>
          <div
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="footer-policy-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.dialogHeader}>
              <div>
                <h2 id="footer-policy-title" className={styles.dialogTitle}>{modalTitle}</h2>
                <p className={styles.dialogUpdated}>{modalUpdated}</p>
              </div>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => setOpenModal(null)}
                aria-label={t('common.cancel')}
              >
                <i className="ri-close-line" />
              </button>
            </div>

            <div className={styles.dialogBody}>
              {isPrivacy ? (
                <>
                  <section className={styles.section}>
                    <h3>{t('privacy.collectTitle')}</h3>
                    <p>{t('privacy.collectIntro')}</p>
                    <ul>
                      <li>{t('privacy.collectEmail')}</li>
                      <li>{t('privacy.collectName')}</li>
                      <li>{t('privacy.collectGender')}</li>
                      <li>{t('privacy.collectRegion')}</li>
                      <li>{t('privacy.collectPicks')}</li>
                    </ul>
                  </section>
                  <section className={styles.section}>
                    <h3>{t('privacy.sharedTitle')}</h3>
                    <p>{t('privacy.sharedIntro')}</p>
                    <ul>
                      <li>{t('privacy.sharedName')}</li>
                      <li>{t('privacy.sharedArchetype')}</li>
                      <li>{t('privacy.sharedTags')}</li>
                      <li>{t('privacy.sharedIceBreakers')}</li>
                      <li>{t('privacy.sharedSimilarity')}</li>
                      <li>{t('privacy.sharedEmailAfterAccept')}</li>
                    </ul>
                  </section>
                  <section className={styles.section}>
                    <h3>{t('privacy.notSharedTitle')}</h3>
                    <p>{t('privacy.notSharedIntro')}</p>
                    <ul>
                      <li>{t('privacy.notSharedEmail')}</li>
                      <li>{t('privacy.notSharedBirthYear')}</li>
                      <li>{t('privacy.notSharedGender')}</li>
                    </ul>
                  </section>
                  <section className={styles.section}>
                    <h3>{t('privacy.storageTitle')}</h3>
                    <p>{t('privacy.storageBody')}</p>
                  </section>
                  <section className={styles.section}>
                    <h3>{t('privacy.thirdPartyTitle')}</h3>
                    <p>{t('privacy.thirdPartyBody')}</p>
                  </section>
                  <section className={styles.section}>
                    <h3>{t('privacy.rightsTitle')}</h3>
                    <p>{t('privacy.rightsBody')}</p>
                  </section>
                  <section className={styles.section}>
                    <h3>{t('privacy.contactTitle')}</h3>
                    <p>{t('privacy.contactBody')}</p>
                  </section>
                </>
              ) : (
                <>
                  <section className={styles.section}>
                    <h3>{t('terms.serviceTitle')}</h3>
                    <p>{t('terms.serviceBody')}</p>
                  </section>
                  <section className={styles.section}>
                    <h3>{t('terms.eligibilityTitle')}</h3>
                    <p>{t('terms.eligibilityBody')}</p>
                  </section>
                  <section className={styles.section}>
                    <h3>{t('terms.accountTitle')}</h3>
                    <p>{t('terms.accountBody')}</p>
                  </section>
                  <section className={styles.section}>
                    <h3>{t('terms.aiTitle')}</h3>
                    <p>{t('terms.aiBody')}</p>
                  </section>
                  <section className={styles.section}>
                    <h3>{t('terms.matchingTitle')}</h3>
                    <p>{t('terms.matchingBody')}</p>
                  </section>
                  <section className={styles.section}>
                    <h3>{t('terms.conductTitle')}</h3>
                    <p>{t('terms.conductBody')}</p>
                  </section>
                  <section className={styles.section}>
                    <h3>{t('terms.dataTitle')}</h3>
                    <p>{t('terms.dataBody')}</p>
                  </section>
                  <section className={styles.section}>
                    <h3>{t('terms.terminationTitle')}</h3>
                    <p>{t('terms.terminationBody')}</p>
                  </section>
                  <section className={styles.section}>
                    <h3>{t('terms.warrantyTitle')}</h3>
                    <p>{t('terms.warrantyBody')}</p>
                  </section>
                  <section className={styles.section}>
                    <h3>{t('terms.contactTitle')}</h3>
                    <p>{t('terms.contactBody')}</p>
                  </section>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
