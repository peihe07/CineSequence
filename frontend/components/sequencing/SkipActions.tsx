'use client'

import Button from '@/components/ui/Button'
import { soundManager } from '@/lib/sound'
import styles from './SkipActions.module.css'

interface SkipActionsProps {
  onSkip: () => void
  disabled: boolean
}

export default function SkipActions({ onSkip, disabled }: SkipActionsProps) {
  return (
    <div className={styles.container}>
      <Button variant="ghost" size="sm" onClick={() => { soundManager.play('skip'); onSkip() }} disabled={disabled}>
        <i className="ri-skip-forward-line" /> Skip this pair
      </Button>
    </div>
  )
}
