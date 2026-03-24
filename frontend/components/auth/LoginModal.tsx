'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import LoginForm from '@/components/auth/LoginForm'
import RegisterForm from '@/components/auth/RegisterForm'
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
  const { t } = useI18n()
  const { isAuthenticated } = useAuthStore()
  const resolvedNextPath = sanitizeNextPath(nextPath) ?? '/sequencing'

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
                    {t('auth.signUp')}
                  </button>
                </div>
                <h2 className={styles.headline}>
                  {activeMode === 'login' ? t('auth.modalHeadline') : t('auth.layoutHeadline')}
                </h2>
                <p className={styles.copy}>
                  {activeMode === 'login'
                    ? t('auth.modalCopy')
                    : t('auth.layoutCopy')}
                </p>
                <div className={styles.introMeta}>
                  <span className={styles.status}>
                    {activeMode === 'login' ? t('auth.modalStatus') : t('auth.layoutStatus')}
                  </span>
                  <span className={styles.path}>
                    {activeMode === 'login' ? t('auth.modalPath') : t('auth.layoutPath')}
                  </span>
                  <span className={styles.timecode}>
                    {activeMode === 'login' ? t('auth.modalTimecode') : t('auth.layoutTimecode')}
                  </span>
                </div>
              </div>

              <div className={styles.notes}>
                <div className={styles.note}>
                  <span className={styles.noteLabel}>
                    {activeMode === 'login' ? t('auth.modalRuleTitle') : t('auth.layoutRuleTitle')}
                  </span>
                  <span className={styles.noteText}>
                    {activeMode === 'login'
                      ? t('auth.modalRuleBody')
                      : t('auth.layoutRuleBody')}
                  </span>
                </div>
                <div className={styles.note}>
                  <span className={styles.noteLabel}>
                    {activeMode === 'login' ? t('auth.modalNoAccountTitle') : t('auth.layoutGateTitle')}
                  </span>
                  <span className={styles.noteText}>
                    {activeMode === 'login' ? (
                      <>
                        {t('auth.modalNoAccountPrefix')} <Link href="/register" prefetch={false} onClick={onClose}>{t('auth.signUp')}</Link>{t('auth.modalNoAccountSuffix')}
                      </>
                    ) : (
                      t('auth.layoutGateBody')
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
                <RegisterForm
                  mode="modal"
                  nextPath={nextPath}
                  onLoginClick={() => setActiveMode('login')}
                />
              )}
            </section>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
