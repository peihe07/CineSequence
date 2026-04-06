'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import styles from './PaymentModal.module.css'

type ProductType = 'extension' | 'retest' | 'bundle' | 'invite_unlock' | 'share_card'

interface Product {
  type: ProductType
  nameKey: string
  detailKey: string
  price: number
}

interface PaymentModalProps {
  open: boolean
  onClose: () => void
  /** Which products to show. Determines the context (extend, retest, invite, etc.) */
  context: 'extend' | 'retest' | 'invite' | 'share_card'
}

const PRODUCT_MAP: Record<string, Product[]> = {
  extend: [
    { type: 'extension', nameKey: 'payment.product.extension.name', detailKey: 'payment.product.extension.detail', price: 59 },
    { type: 'bundle', nameKey: 'payment.product.bundle.name', detailKey: 'payment.product.bundle.detail', price: 199 },
  ],
  retest: [
    { type: 'retest', nameKey: 'payment.product.retest.name', detailKey: 'payment.product.retest.detail', price: 129 },
    { type: 'bundle', nameKey: 'payment.product.bundle.name', detailKey: 'payment.product.bundle.detail', price: 199 },
  ],
  invite: [
    { type: 'invite_unlock', nameKey: 'payment.product.inviteUnlock.name', detailKey: 'payment.product.inviteUnlock.detail', price: 99 },
  ],
  share_card: [
    { type: 'share_card', nameKey: 'payment.product.shareCard.name', detailKey: 'payment.product.shareCard.detail', price: 59 },
  ],
}

const CONTEXT_TITLE_KEYS: Record<PaymentModalProps['context'], string> = {
  extend: 'payment.context.extend.title',
  retest: 'payment.context.retest.title',
  invite: 'payment.context.invite.title',
  share_card: 'payment.context.shareCard.title',
}

const CONTEXT_DESCRIPTION_KEYS: Record<PaymentModalProps['context'], string> = {
  extend: 'payment.context.extend.description',
  retest: 'payment.context.retest.description',
  invite: 'payment.context.invite.description',
  share_card: 'payment.context.shareCard.description',
}

interface CheckoutResponse {
  order_no: string
  ecpay_form_html: string
}

export default function PaymentModal({ open, onClose, context }: PaymentModalProps) {
  const { t } = useI18n()
  const products = PRODUCT_MAP[context] ?? []
  const [selected, setSelected] = useState<ProductType>(products[0]?.type ?? 'extension')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    setSelected(products[0]?.type ?? 'extension')
  }, [products])

  const handleCheckout = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await api<CheckoutResponse>('/payments/checkout', {
        method: 'POST',
        body: JSON.stringify({ product_type: selected }),
      })

      // Inject ECPay form HTML and auto-submit
      const container = document.createElement('div')
      container.innerHTML = res.ecpay_form_html
      document.body.appendChild(container)
      const form = container.querySelector('form')
      form?.submit()
    } catch {
      setIsLoading(false)
    }
  }, [selected])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={styles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          <motion.div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-label={t(CONTEXT_TITLE_KEYS[context])}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.header}>
              <span className={styles.title}>{t(CONTEXT_TITLE_KEYS[context])}</span>
              <button className={styles.closeBtn} onClick={onClose} aria-label={t('payment.close')}>
                <i className="ri-close-line" aria-hidden="true" />
              </button>
            </div>

            <p className={styles.description}>{t(CONTEXT_DESCRIPTION_KEYS[context])}</p>

            <div className={styles.products}>
              {products.map((product) => (
                <div
                  key={product.type}
                  className={`${styles.productCard} ${selected === product.type ? styles.productSelected : ''}`}
                  onClick={() => setSelected(product.type)}
                  role="radio"
                  aria-checked={selected === product.type}
                >
                  <div className={styles.productInfo}>
                    <span className={styles.productName}>{t(product.nameKey)}</span>
                    <span className={styles.productDetail}>{t(product.detailKey)}</span>
                  </div>
                  <span className={styles.productPrice}>NT${product.price}</span>
                </div>
              ))}
            </div>

            <button
              className={styles.checkoutBtn}
              onClick={() => void handleCheckout()}
              disabled={isLoading}
            >
              {isLoading ? t('payment.processing') : t('payment.submit')}
            </button>

            <p className={styles.note}>
              {t('payment.note')}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
