'use client'

import Button from '@/components/ui/Button'
import { useI18n } from '@/lib/i18n'
import { soundManager } from '@/lib/sound'
import styles from './SkipActions.module.css'

interface SkipActionsProps {
  onSkip: () => void
  onReroll: () => void
  disabled: boolean
}

export default function SkipActions({ onSkip, onReroll, disabled }: SkipActionsProps) {
  const { t } = useI18n()

  return (
    <div className={styles.container}>
      <Button variant="secondary" size="sm" onClick={onReroll} disabled={disabled}>
        <i className="ri-refresh-line" /> {t('seq.reroll')}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => { soundManager.play('skip'); onSkip() }} disabled={disabled}>
        <i className="ri-skip-forward-line" /> {t('seq.skipPair')}
      </Button>
    </div>
  )
}
