'use client'

import { useState } from 'react'
import Button from '@/components/ui/Button'
import { useI18n } from '@/lib/i18n'
import { soundManager } from '@/lib/sound'
import styles from './SkipActions.module.css'

interface SkipActionsProps {
  onSkip: () => void
  onReroll: () => void
  onDislikeBoth: () => void
  disabled: boolean
}

export default function SkipActions({ onSkip, onReroll, onDislikeBoth, disabled }: SkipActionsProps) {
  const { t } = useI18n()
  const [showExtendedActions, setShowExtendedActions] = useState(false)

  return (
    <div className={styles.container}>
      <div className={styles.actionCard}>
        <Button variant="secondary" size="sm" onClick={onReroll} disabled={disabled}>
          <i className="ri-refresh-line" /> {t('seq.reroll')}
        </Button>
        <p className={styles.hint}>{t('seq.rerollHint')}</p>
      </div>
      <div className={styles.actionCard}>
        <Button variant="ghost" size="sm" onClick={() => { soundManager.play('skip'); onSkip() }} disabled={disabled}>
          <i className="ri-skip-forward-line" /> {t('seq.skipPair')}
        </Button>
        <p className={styles.hint}>{t('seq.skipHint')}</p>
      </div>
      <div className={styles.actionCard}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowExtendedActions((value) => !value)}
          disabled={disabled}
        >
          <i className="ri-more-2-line" /> {t('seq.moreOptions')}
        </Button>
        <p className={styles.hint}>{t('seq.moreOptionsHint')}</p>
        {showExtendedActions && (
          <div className={styles.extendedActions}>
            <Button variant="ghost" size="sm" onClick={onDislikeBoth} disabled={disabled}>
              <i className="ri-close-circle-line" /> {t('seq.dislikeBoth')}
            </Button>
            <p className={styles.hint}>{t('seq.dislikeBothHint')}</p>
          </div>
        )}
      </div>
    </div>
  )
}
