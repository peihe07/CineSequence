'use client'

import { useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '@/lib/api'
import styles from './PaymentModal.module.css'

type ProductType = 'extension' | 'retest' | 'bundle' | 'invite_unlock' | 'share_card'

interface Product {
  type: ProductType
  name: string
  detail: string
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
    { type: 'extension', name: 'Extension +10', detail: '10 rounds of deeper sequencing', price: 59 },
    { type: 'bundle', name: 'Bundle', detail: '1 retest + 2 extensions', price: 199 },
  ],
  retest: [
    { type: 'retest', name: 'Retest', detail: 'Full 30-round re-sequencing', price: 129 },
    { type: 'bundle', name: 'Bundle', detail: '1 retest + 2 extensions', price: 199 },
  ],
  invite: [
    { type: 'invite_unlock', name: 'Unlimited Invites', detail: 'Permanent unlock, no expiration', price: 99 },
  ],
  share_card: [
    { type: 'share_card', name: 'Premium Share Card', detail: 'High-res DNA card for social sharing', price: 59 },
  ],
}

const CONTEXT_TITLES: Record<string, string> = {
  extend: 'Extend Your Sequencing',
  retest: 'Retest Your DNA',
  invite: 'Unlock Invites',
  share_card: 'Premium Share Card',
}

const CONTEXT_DESCRIPTIONS: Record<string, string> = {
  extend: 'Go deeper into your cinematic taste with 10 more rounds of sequencing.',
  retest: 'Start fresh with a complete 30-round re-sequencing to get an updated DNA profile.',
  invite: 'You\'ve used all your invite credits. Unlock unlimited invites to connect with more matches.',
  share_card: 'Generate a premium visual card of your DNA for sharing on social media.',
}

interface CheckoutResponse {
  order_no: string
  ecpay_form_html: string
}

export default function PaymentModal({ open, onClose, context }: PaymentModalProps) {
  const products = PRODUCT_MAP[context] ?? []
  const [selected, setSelected] = useState<ProductType>(products[0]?.type ?? 'extension')
  const [isLoading, setIsLoading] = useState(false)

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
            aria-label={CONTEXT_TITLES[context]}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.header}>
              <span className={styles.title}>{CONTEXT_TITLES[context]}</span>
              <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
                <i className="ri-close-line" aria-hidden="true" />
              </button>
            </div>

            <p className={styles.description}>{CONTEXT_DESCRIPTIONS[context]}</p>

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
                    <span className={styles.productName}>{product.name}</span>
                    <span className={styles.productDetail}>{product.detail}</span>
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
              {isLoading ? 'Processing...' : 'Proceed to Payment'}
            </button>

            <p className={styles.note}>
              Secure payment via ECPay. Used credits are non-refundable.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
