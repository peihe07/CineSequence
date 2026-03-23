'use client'

import { useI18n } from '@/lib/i18n'
import styles from '../privacy/page.module.css'

export default function TermsPage() {
  const { t } = useI18n()

  return (
    <main className={styles.container}>
      <article className={styles.content}>
        <h1 className={styles.title}>{t('terms.title')}</h1>
        <p className={styles.updated}>{t('terms.lastUpdated')}</p>

        <section className={styles.section}>
          <h2>{t('terms.serviceTitle')}</h2>
          <p>{t('terms.serviceBody')}</p>
        </section>

        <section className={styles.section}>
          <h2>{t('terms.eligibilityTitle')}</h2>
          <p>{t('terms.eligibilityBody')}</p>
        </section>

        <section className={styles.section}>
          <h2>{t('terms.accountTitle')}</h2>
          <p>{t('terms.accountBody')}</p>
        </section>

        <section className={styles.section}>
          <h2>{t('terms.aiTitle')}</h2>
          <p>{t('terms.aiBody')}</p>
        </section>

        <section className={styles.section}>
          <h2>{t('terms.matchingTitle')}</h2>
          <p>{t('terms.matchingBody')}</p>
        </section>

        <section className={styles.section}>
          <h2>{t('terms.conductTitle')}</h2>
          <p>{t('terms.conductBody')}</p>
        </section>

        <section className={styles.section}>
          <h2>{t('terms.dataTitle')}</h2>
          <p>{t('terms.dataBody')}</p>
        </section>

        <section className={styles.section}>
          <h2>{t('terms.terminationTitle')}</h2>
          <p>{t('terms.terminationBody')}</p>
        </section>

        <section className={styles.section}>
          <h2>{t('terms.warrantyTitle')}</h2>
          <p>{t('terms.warrantyBody')}</p>
        </section>

        <section className={styles.section}>
          <h2>{t('terms.contactTitle')}</h2>
          <p>{t('terms.contactBody')}</p>
        </section>
      </article>
    </main>
  )
}
