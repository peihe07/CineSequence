'use client'

import { useState, useCallback } from 'react'
import { useI18n } from '@/lib/i18n'
import { soundManager } from '@/lib/sound'
import styles from './MuteToggle.module.css'

export default function MuteToggle() {
  const { t } = useI18n()
  const [muted, setMuted] = useState(() => soundManager.muted)

  const handleToggle = useCallback(() => {
    const nowMuted = soundManager.toggle()
    setMuted(nowMuted)
  }, [])

  return (
    <button
      className={styles.toggle}
      onClick={handleToggle}
      aria-label={muted ? t('sound.unmute') : t('sound.mute')}
      title={muted ? t('sound.off') : t('sound.on')}
    >
      <i className={muted ? 'ri-volume-mute-line' : 'ri-volume-up-line'} />
    </button>
  )
}
