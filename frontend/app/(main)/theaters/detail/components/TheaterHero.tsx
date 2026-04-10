import Link from 'next/link'
import { useI18n } from '@/lib/i18n'
import styles from '../page.module.css'

interface TheaterHeroProps {
  group: {
    name: string
    member_count: number
    is_member: boolean
  }
  error: string | null
  isLoading: boolean
  isMutating: boolean
  onJoin: () => void
  onLeave: () => void
  onRefresh: () => void
}

export default function TheaterHero({
  group,
  error,
  isLoading,
  isMutating,
  onJoin,
  onLeave,
  onRefresh,
}: TheaterHeroProps) {
  const { t } = useI18n()

  return (
    <div className={styles.hero}>
      <Link href="/theaters" prefetch={false} className={styles.backLink}>
        <i className="ri-arrow-left-line" /> {t('common.back')}
      </Link>
      <p className={styles.eyebrow}>[ THEATER_FILE ]</p>
      <div className={styles.titleRow}>
        <div>
          <h1 className={styles.title}>{group.name}</h1>
        </div>
        <span className={styles.memberBadge}>
          <i className="ri-group-line" /> {group.member_count}
        </span>
      </div>
      <div className={styles.actionRow}>
        {group.is_member ? (
          <button className={styles.secondaryBtn} disabled={isMutating} onClick={onLeave}>
            <i className="ri-logout-box-line" /> {t('theaters.leave')}
          </button>
        ) : (
          <button className={styles.primaryBtn} disabled={isMutating} onClick={onJoin}>
            <i className="ri-add-line" /> {t('theaters.join')}
          </button>
        )}
        <button className={styles.secondaryBtn} disabled={isLoading || isMutating} onClick={onRefresh}>
          <i className="ri-refresh-line" /> {t('error.retry')}
        </button>
      </div>
      {error && <p className={styles.errorText}>{error}</p>}
    </div>
  )
}
