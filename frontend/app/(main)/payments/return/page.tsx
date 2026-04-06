'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import styles from './page.module.css'

interface OrderStatus {
  order_no: string
  product_type: string
  amount: number
  status: 'pending' | 'paid' | 'failed' | 'refunded'
  paid_at: string | null
  created_at: string
}

interface PaymentHistoryResponse {
  orders: OrderStatus[]
}

function PaymentReturnContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { t } = useI18n()
  const orderNo = searchParams.get('order_no')
  const [status, setStatus] = useState<'loading' | 'paid' | 'pending' | 'failed'>('loading')
  const [pollCount, setPollCount] = useState(0)

  useEffect(() => {
    if (!orderNo) {
      setStatus('failed')
      return
    }

    async function checkOrder() {
      try {
        const res = await api<PaymentHistoryResponse>('/payments/history')
        const order = res.orders.find((o) => o.order_no === orderNo)
        if (!order) {
          setStatus('failed')
          return
        }
        if (order.status === 'paid') {
          setStatus('paid')
        } else if (order.status === 'failed') {
          setStatus('failed')
        } else {
          // 仍在 pending，繼續輪詢（最多 10 次）
          setStatus('pending')
          if (pollCount < 10) {
            setTimeout(() => setPollCount((c) => c + 1), 3000)
          }
        }
      } catch {
        setStatus('failed')
      }
    }

    void checkOrder()
  }, [orderNo, pollCount])

  // 成功後 3 秒自動導回
  useEffect(() => {
    if (status !== 'paid') return
    const timer = setTimeout(() => router.push('/dna'), 3000)
    return () => clearTimeout(timer)
  }, [status, router])

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {status === 'loading' && (
          <div className={styles.stateBlock}>
            <i className="ri-loader-4-line ri-spin ri-2x" aria-hidden="true" />
            <p className={styles.stateText}>{t('paymentReturn.checking')}</p>
          </div>
        )}

        {status === 'pending' && (
          <div className={styles.stateBlock}>
            <motion.div
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <i className="ri-signal-wifi-line ri-2x" aria-hidden="true" />
            </motion.div>
            <p className={styles.stateText}>{t('paymentReturn.pending')}</p>
            <p className={styles.stateHint}>{t('paymentReturn.pendingHint')}</p>
          </div>
        )}

        {status === 'paid' && (
          <motion.div
            className={styles.stateBlock}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
          >
            <motion.div
              className={styles.successIcon}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            >
              <i className="ri-shield-check-line ri-3x" aria-hidden="true" />
            </motion.div>
            <p className={styles.successTitle}>{t('paymentReturn.granted')}</p>
            <p className={styles.stateHint}>{t('paymentReturn.redirecting')}</p>
          </motion.div>
        )}

        {status === 'failed' && (
          <div className={styles.stateBlock}>
            <i className="ri-error-warning-line ri-2x" style={{ color: 'var(--color-error-muted)' }} aria-hidden="true" />
            <p className={styles.stateText}>{t('paymentReturn.failed')}</p>
            <button className={styles.backBtn} onClick={() => router.push('/dna')}>
              {t('paymentReturn.backToDna')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function PaymentReturnPage() {
  return (
    <Suspense fallback={
      <div className={styles.container}>
        <div className={styles.content}>
          <i className="ri-loader-4-line ri-spin ri-2x" aria-hidden="true" />
        </div>
      </div>
    }>
      <PaymentReturnContent />
    </Suspense>
  )
}
