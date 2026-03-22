'use client'

import Button from '@/components/ui/Button'
import { soundManager } from '@/lib/sound'
import styles from './SkipActions.module.css'

interface SkipActionsProps {
  onSkip: () => void
  onReroll: () => void
  disabled: boolean
}

export default function SkipActions({ onSkip, onReroll, disabled }: SkipActionsProps) {
  return (
    <div className={styles.container}>
      <Button variant="secondary" size="sm" onClick={onReroll} disabled={disabled}>
        <i className="ri-refresh-line" /> Swap this pair
      </Button>
      <Button variant="ghost" size="sm" onClick={() => { soundManager.play('skip'); onSkip() }} disabled={disabled}>
        <i className="ri-skip-forward-line" /> Skip this pair
      </Button>
    </div>
  )
}
