'use client'

import { motion } from 'framer-motion'
import { useI18n } from '@/lib/i18n'
import { getTagLabel } from '@/lib/tagLabels'
import styles from './TagCloud.module.css'

interface TagCloudProps {
  tagLabels: Record<string, number>
}

export default function TagCloud({ tagLabels }: TagCloudProps) {
  const { t, locale } = useI18n()
  const entries = Object.entries(tagLabels).sort((a, b) => b[1] - a[1])

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>
        <i className="ri-price-tag-3-line" /> {t('dna.tags')}
      </h3>
      <div className={styles.cloud}>
        {entries.map(([tag, score], i) => (
          <motion.span
            key={tag}
            className={styles.tag}
            style={{
              '--tag-scale': Math.max(0.7, score),
            } as React.CSSProperties}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 + i * 0.08, type: 'spring', stiffness: 300 }}
          >
            {getTagLabel(tag, locale)}
          </motion.span>
        ))}
      </div>
    </div>
  )
}
