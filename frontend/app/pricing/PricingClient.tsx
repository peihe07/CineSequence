'use client'

import { useState } from 'react'
import Link from 'next/link'
import LoginModal from '@/components/auth/LoginModal'
import PaymentModal from '@/components/ui/PaymentModal'
import { useI18n } from '@/lib/i18n'
import { useAuthStore } from '@/stores/authStore'
import styles from './pricing.module.css'

type PricingContext = 'extend' | 'retest' | 'invite'

const CARD_ORDER: PricingContext[] = ['extend', 'retest', 'invite']

const CARD_PRICE: Record<PricingContext, string> = {
  extend: 'NT$59',
  retest: 'NT$129',
  invite: 'NT$99',
}

const CARD_ICON: Record<PricingContext, string> = {
  extend: 'ri-add-circle-line',
  retest: 'ri-refresh-line',
  invite: 'ri-mail-unread-line',
}

export default function PricingClient() {
  const { t } = useI18n()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const [paymentContext, setPaymentContext] = useState<PricingContext | null>(null)
  const [isLoginOpen, setIsLoginOpen] = useState(false)
  const supportUrl =
    process.env.NEXT_PUBLIC_SUPPORT_URL?.trim() ||
    process.env.NEXT_PUBLIC_BUYMEACOFFEE_URL?.trim()
  const supportHref = supportUrl || 'mailto:y450376@gmail.com?subject=Buy%20Me%20a%20Coffee'

  function handleOpenCheckout(context: PricingContext) {
    if (!isAuthenticated) {
      setIsLoginOpen(true)
      return
    }
    setPaymentContext(context)
  }

  return (
    <div className={styles.page}>
      <div className={styles.grain} aria-hidden="true" />
      <main className={styles.shell}>
        <section className={styles.hero}>
          <p className={styles.kicker}>{t('pricing.kicker')}</p>
          <h1 className={styles.title}>{t('pricing.title')}</h1>
          <p className={styles.lead}>{t('pricing.lead')}</p>
          <div className={styles.statusRow}>
            <span className={styles.statusBadge}>{t('pricing.status')}</span>
            <span className={styles.statusText}>{t('pricing.statusNote')}</span>
          </div>
        </section>

        <section className={styles.cardGrid}>
          {CARD_ORDER.map((context) => (
            <article key={context} className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.cardIcon}>
                  <i className={CARD_ICON[context]} aria-hidden="true" />
                </span>
                <div>
                  <p className={styles.cardLabel}>{t(`pricing.${context}.eyebrow`)}</p>
                  <h2 className={styles.cardTitle}>{t(`pricing.${context}.title`)}</h2>
                </div>
              </div>
              <p className={styles.cardBody}>{t(`pricing.${context}.body`)}</p>
              <ul className={styles.detailList}>
                <li>{t(`pricing.${context}.detail1`)}</li>
                <li>{t(`pricing.${context}.detail2`)}</li>
                <li>{t(`pricing.${context}.detail3`)}</li>
              </ul>
              <div className={styles.cardMeta}>
                <span className={styles.price}>{CARD_PRICE[context]}</span>
                <span className={styles.metaText}>{t(`pricing.${context}.meta`)}</span>
              </div>
              <button
                type="button"
                className={styles.cta}
                onClick={() => handleOpenCheckout(context)}
              >
                {isAuthenticated ? t('pricing.openCheckout') : t('pricing.signInToContinue')}
              </button>
            </article>
          ))}
        </section>

        <section className={styles.supportSection} id="support">
          <article className={styles.supportCard}>
            <div className={styles.supportHeader}>
              <span className={styles.supportIcon}>
                <i className="ri-cup-line" aria-hidden="true" />
              </span>
              <div>
                <p className={styles.cardLabel}>{t('pricing.supportEyebrow')}</p>
                <h2 className={styles.supportTitle}>{t('pricing.supportTitle')}</h2>
              </div>
            </div>
            <p className={styles.supportBody}>{t('pricing.supportBody')}</p>
            <p className={styles.supportNote}>{t('pricing.supportNote')}</p>
            <a
              href={supportHref}
              target={supportUrl ? '_blank' : undefined}
              rel={supportUrl ? 'noreferrer noopener external' : undefined}
              className={styles.supportButton}
            >
              {t('pricing.supportLink')}
            </a>
          </article>
        </section>

        <section className={styles.infoGrid}>
          <article className={styles.infoCard}>
            <h2 className={styles.infoTitle}>{t('pricing.contactTitle')}</h2>
            <p className={styles.infoBody}>{t('pricing.contactBody')}</p>
            <a className={styles.contactLink} href="mailto:y450376@gmail.com">
              y450376@gmail.com
            </a>
          </article>

          <article className={styles.infoCard}>
            <h2 className={styles.infoTitle}>{t('pricing.paymentTitle')}</h2>
            <p className={styles.infoBody}>{t('pricing.paymentBody')}</p>
          </article>
        </section>

        <div className={styles.footer}>
          <Link href="/about" className={styles.backLink}>
            <i className="ri-arrow-left-line" aria-hidden="true" />
            <span>{t('pricing.back')}</span>
          </Link>
        </div>
      </main>

      {paymentContext ? (
        <PaymentModal
          open
          context={paymentContext}
          onClose={() => setPaymentContext(null)}
        />
      ) : null}

      <LoginModal
        open={isLoginOpen}
        mode="register"
        nextPath="/pricing"
        onClose={() => setIsLoginOpen(false)}
      />
    </div>
  )
}
