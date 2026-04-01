'use client'

import { useState } from 'react'
import LoginModal from '@/components/auth/LoginModal'
import Button from '@/components/ui/Button'
import { useI18n } from '@/lib/i18n'
import { useAuthStore } from '@/stores/authStore'
import styles from './PreviewGate.module.css'

export function usePreviewAccess(nextPath?: string) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const [isOpen, setIsOpen] = useState(false)

  function openPreviewGate() {
    setIsOpen(true)
  }

  function guardPreviewAction(action?: () => void) {
    if (isAuthenticated) {
      action?.()
      return
    }

    setIsOpen(true)
  }

  const resolvedNextPath = nextPath ?? '/sequencing'

  return {
    isPreview: !isAuthenticated,
    openPreviewGate,
    guardPreviewAction,
    previewModal: isOpen ? (
      <LoginModal
        open={isOpen}
        mode="register"
        nextPath={resolvedNextPath}
        onClose={() => setIsOpen(false)}
      />
    ) : null,
  }
}

export function PreviewBanner({
  nextPath,
  compact = false,
}: {
  nextPath?: string
  compact?: boolean
}) {
  const { t } = useI18n()
  const { isPreview, openPreviewGate, previewModal } = usePreviewAccess(nextPath)

  if (!isPreview) {
    return null
  }

  return (
    <>
      <section className={`${styles.banner} ${compact ? styles.compact : ''}`}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>{t('preview.badge')}</p>
          <p className={styles.title}>{t('preview.title')}</p>
          <p className={styles.body}>{t('preview.body')}</p>
        </div>
        <Button variant="secondary" onClick={openPreviewGate}>
          {t('preview.cta')}
        </Button>
      </section>
      {previewModal}
    </>
  )
}
