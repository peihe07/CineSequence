'use client'

import { useState, useCallback } from 'react'
import { soundManager } from '@/lib/sound'
import styles from './MuteToggle.module.css'

export default function MuteToggle() {
  const [muted, setMuted] = useState(() => soundManager.muted)

  const handleToggle = useCallback(() => {
    const nowMuted = soundManager.toggle()
    setMuted(nowMuted)
  }, [])

  return (
    <button
      className={styles.toggle}
      onClick={handleToggle}
      aria-label={muted ? 'Unmute sound effects' : 'Mute sound effects'}
      title={muted ? 'Sound off' : 'Sound on'}
    >
      <i className={muted ? 'ri-volume-mute-line' : 'ri-volume-up-line'} />
    </button>
  )
}
