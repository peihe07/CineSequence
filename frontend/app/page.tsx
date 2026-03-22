'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { useI18n } from '@/lib/i18n'
import styles from './page.module.css'

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
}

export default function Home() {
  const { t, locale } = useI18n()
  const isEnglish = locale === 'en'

  return (
    <main className={styles.main}>
      <section className={styles.hero}>
        <motion.h1
          className={`${styles.title} ${styles.titleEn}`}
          {...fadeUp}
          transition={{ duration: 0.6 }}
        >
          Cine Sequence
        </motion.h1>
        <motion.p
          className={styles.subtitle}
          {...fadeUp}
          transition={{ duration: 0.6, delay: 0.15 }}
        >
          {t('landing.subtitle')}
        </motion.p>
        <motion.div
          className={styles.cta}
          {...fadeUp}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <Link href="/register" className={styles.ctaPrimary}>
            <i className="ri-dna-line" />
            {t('landing.start')}
          </Link>
          <Link href="/login" className={styles.ctaSecondary}>
            {t('landing.login')}
          </Link>
        </motion.div>
      </section>

      <div className={styles.divider} />

      <section className={styles.section}>
        <h2 className={`${styles.sectionTitle} ${isEnglish ? styles.sectionTitleEn : ''}`}>
          {t('landing.howTitle')}
        </h2>
        <div className={styles.steps}>
          <motion.div className={styles.step} {...fadeUp} transition={{ duration: 0.5, delay: 0.1 }}>
            <i className={`ri-film-line ${styles.stepIcon}`} />
            <span className={`${styles.stepNumber} ${styles.stepNumberEn}`}>01</span>
            <span className={styles.stepTitle}>{t('landing.step1Title')}</span>
            <span className={styles.stepDesc}>{t('landing.step1Desc')}</span>
          </motion.div>

          <motion.div className={styles.step} {...fadeUp} transition={{ duration: 0.5, delay: 0.2 }}>
            <i className={`ri-dna-line ${styles.stepIcon}`} />
            <span className={`${styles.stepNumber} ${styles.stepNumberEn}`}>02</span>
            <span className={styles.stepTitle}>{t('landing.step2Title')}</span>
            <span className={styles.stepDesc}>{t('landing.step2Desc')}</span>
          </motion.div>

          <motion.div className={styles.step} {...fadeUp} transition={{ duration: 0.5, delay: 0.3 }}>
            <i className={`ri-hearts-line ${styles.stepIcon}`} />
            <span className={`${styles.stepNumber} ${styles.stepNumberEn}`}>03</span>
            <span className={styles.stepTitle}>{t('landing.step3Title')}</span>
            <span className={styles.stepDesc}>{t('landing.step3Desc')}</span>
          </motion.div>
        </div>
      </section>

      <footer className={styles.footer}>
        Cine Sequence &copy; {new Date().getFullYear()}
      </footer>
    </main>
  )
}
