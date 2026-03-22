'use client'

import { useI18n } from '@/lib/i18n'
import styles from './page.module.css'

export default function PrivacyPage() {
  const { t } = useI18n()

  return (
    <main className={styles.container}>
      <article className={styles.content}>
        <h1 className={styles.title}>{t('privacy.title')}</h1>
        <p className={styles.updated}>{t('privacy.lastUpdated')}</p>

        <section className={styles.section}>
          <h2>{t('privacy.collectTitle')}</h2>
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
          <h2>{t('privacy.sharedTitle')}</h2>
          <p>{t('privacy.sharedIntro')}</p>
          <ul>
            <li>{t('privacy.sharedName')}</li>
            <li>{t('privacy.sharedArchetype')}</li>
            <li>{t('privacy.sharedTags')}</li>
            <li>{t('privacy.sharedIceBreakers')}</li>
            <li>{t('privacy.sharedSimilarity')}</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>{t('privacy.notSharedTitle')}</h2>
          <p>{t('privacy.notSharedIntro')}</p>
          <ul>
            <li>{t('privacy.notSharedEmail')}</li>
            <li>{t('privacy.notSharedBirthYear')}</li>
            <li>{t('privacy.notSharedGender')}</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>{t('privacy.storageTitle')}</h2>
          <p>{t('privacy.storageBody')}</p>
        </section>

        <section className={styles.section}>
          <h2>{t('privacy.thirdPartyTitle')}</h2>
          <p>{t('privacy.thirdPartyBody')}</p>
        </section>

        <section className={styles.section}>
          <h2>{t('privacy.rightsTitle')}</h2>
          <p>{t('privacy.rightsBody')}</p>
        </section>

        <section className={styles.section}>
          <h2>{t('privacy.contactTitle')}</h2>
          <p>{t('privacy.contactBody')}</p>
        </section>
      </article>
    </main>
  )
}
