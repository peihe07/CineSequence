import { useI18n } from '@/lib/i18n'
import styles from '../page.module.css'

export type TabId = 'overview' | 'lists' | 'board'

interface TheaterTabBarProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
}

export default function TheaterTabBar({ activeTab, onTabChange }: TheaterTabBarProps) {
  const { t } = useI18n()

  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: t('theaters.tabOverview') },
    { id: 'lists', label: t('theaters.tabLists') },
    { id: 'board', label: t('theaters.tabBoard') },
  ]

  return (
    <section className={styles.section}>
      <div className={styles.tabBar} role="tablist" aria-label={t('theaters.tabs')}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`${styles.tabButton} ${activeTab === tab.id ? styles.tabButtonActive : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </section>
  )
}
