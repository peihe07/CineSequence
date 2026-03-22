'use client'

import styles from '@/app/(main)/profile/page.module.css'

interface ProfileHeaderProps {
  title: string
  logoutLabel: string
  loggingOutLabel: string
  isLoggingOut: boolean
  onLogout: () => Promise<void>
}

export default function ProfileHeader({
  title,
  logoutLabel,
  loggingOutLabel,
  isLoggingOut,
  onLogout,
}: ProfileHeaderProps) {
  return (
    <div className={styles.header}>
      <h1 className={styles.title}>{title}</h1>
      <button
        type="button"
        className={styles.logoutButton}
        onClick={onLogout}
        disabled={isLoggingOut}
      >
        {isLoggingOut ? loggingOutLabel : logoutLabel}
      </button>
    </div>
  )
}
