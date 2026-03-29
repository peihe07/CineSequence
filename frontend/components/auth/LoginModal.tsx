'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import LoginForm from '@/components/auth/LoginForm'
import WaitlistForm from '@/components/auth/WaitlistForm'
import { sanitizeNextPath } from '@/lib/authProtection'
import { useI18n } from '@/lib/i18n'
import { useAuthStore } from '@/stores/authStore'
import styles from './LoginModal.module.css'

interface LoginModalProps {
  open: boolean
  mode?: 'login' | 'register'
  nextPath?: string
  onClose: () => void
}

export default function LoginModal({ open, mode = 'login', nextPath, onClose }: LoginModalProps) {
  const router = useRouter()
  const [activeMode, setActiveMode] = useState<'login' | 'register'>(mode)
  const { t, locale } = useI18n()
  const { isAuthenticated } = useAuthStore()
  const resolvedNextPath = sanitizeNextPath(nextPath) ?? '/sequencing'
  const waitlistLabel = locale === 'zh' ? '候補名單' : 'Waitlist'
  const waitlistHeadline = locale === 'zh' ? '加入重新開放候補。' : 'Join the reopen list.'
  const waitlistCopy = locale === 'zh'
    ? '目前不開放直接註冊。留下 email，等新功能開發與系統維修完成後，我們會再次通知你。'
    : 'Direct sign-up is paused. Leave your email and we will notify you after feature work and maintenance are complete.'
  const waitlistStatus = locale === 'zh' ? 'Waitlist / 啟用中' : 'Waitlist / Active'
  const waitlistPath = locale === 'zh' ? 'ROOT > ACCESS > WAITLIST' : 'ROOT > ACCESS > WAITLIST'
  const waitlistTimecode = locale === 'zh' ? '候補名單 / 檔案 00' : 'WAITLIST / FILE 00'
  const waitlistRuleTitle = locale === 'zh' ? '開放規則' : 'Access rule'
  const waitlistRuleBody = locale === 'zh'
    ? '目前暫停直接建檔，系統恢復開放後會再發送通知信。'
    : 'Direct account creation is paused. We will email you again once access reopens.'
  const waitlistGateTitle = locale === 'zh' ? '目前狀態' : 'Current status'
  const waitlistGateBody = locale === 'zh'
    ? '你仍可在這裡登入既有帳號；新用戶請先加入 waitlist。'
    : 'Existing users can still sign in here. New users should join the waitlist first.'

  useEffect(() => {
    if (!open) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  useEffect(() => {
    if (open) {
      setActiveMode(mode)
    }
  }, [mode, open])

  useEffect(() => {
    if (!open) {
      return
    }

    if (isAuthenticated) {
      onClose()
      router.replace(resolvedNextPath)
    }
  }, [isAuthenticated, onClose, open, resolvedNextPath, router])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={styles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
        >
          <motion.div
            className={styles.shell}
            role="dialog"
            aria-modal="true"
            aria-label={activeMode === 'login' ? t('auth.modalLabel') : t('register.title')}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            onClick={(event) => event.stopPropagation()}
          >
            <aside className={styles.intro}>
              <div className={styles.introTop}>
                <span className={styles.kicker}>
                  {activeMode === 'login' ? '[ ACCESS_PORTAL ]' : '[ DOSSIER_INTAKE ]'}
                </span>
                <div className={styles.switcher}>
                  <button
                    type="button"
                    className={`${styles.switchTab} ${activeMode === 'login' ? styles.switchTabActive : ''}`}
                    onClick={() => setActiveMode('login')}
                  >
                    {t('auth.signIn')}
                  </button>
                  <button
                    type="button"
                    className={`${styles.switchTab} ${activeMode === 'register' ? styles.switchTabActive : ''}`}
                    onClick={() => setActiveMode('register')}
                  >
                    {waitlistLabel}
                  </button>
                </div>
                <h2 className={styles.headline}>
                  {activeMode === 'login' ? t('auth.modalHeadline') : waitlistHeadline}
                </h2>
                <p className={styles.copy}>
                  {activeMode === 'login'
                    ? t('auth.modalCopy')
                    : waitlistCopy}
                </p>
                <div className={styles.introMeta}>
                  <span className={styles.status}>
                    {activeMode === 'login' ? t('auth.modalStatus') : waitlistStatus}
                  </span>
                  <span className={styles.path}>
                    {activeMode === 'login' ? t('auth.modalPath') : waitlistPath}
                  </span>
                  <span className={styles.timecode}>
                    {activeMode === 'login' ? t('auth.modalTimecode') : waitlistTimecode}
                  </span>
                </div>
              </div>

              <div className={styles.notes}>
                <div className={styles.note}>
                  <span className={styles.noteLabel}>
                    {activeMode === 'login' ? t('auth.modalRuleTitle') : waitlistRuleTitle}
                  </span>
                  <span className={styles.noteText}>
                    {activeMode === 'login'
                      ? t('auth.modalRuleBody')
                      : waitlistRuleBody}
                  </span>
                </div>
                <div className={styles.note}>
                  <span className={styles.noteLabel}>
                    {activeMode === 'login' ? t('auth.modalNoAccountTitle') : waitlistGateTitle}
                  </span>
                  <span className={styles.noteText}>
                    {activeMode === 'login' ? (
                      <>
                        {t('auth.modalNoAccountPrefix')} <Link href="/register" prefetch={false} onClick={onClose}>{waitlistLabel}</Link>{t('auth.modalNoAccountSuffix')}
                      </>
                    ) : (
                      waitlistGateBody
                    )}
                  </span>
                </div>
              </div>
            </aside>

            <section className={styles.formPane}>
              <button type="button" className={styles.close} onClick={onClose} aria-label={t('auth.modalClose')}>
                <i className="ri-close-line" />
              </button>
              {activeMode === 'login' ? (
                <LoginForm
                  mode="modal"
                  nextPath={nextPath}
                  onRegisterClick={() => setActiveMode('register')}
                />
              ) : (
                <WaitlistForm onSecondaryClick={() => setActiveMode('login')} />
              )}
            </section>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
