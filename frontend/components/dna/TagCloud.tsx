'use client'

import { motion } from 'framer-motion'
import styles from './TagCloud.module.css'

// Tag display names (zh)
const TAG_NAMES: Record<string, string> = {
  twist: '反轉結局',
  mindfuck: '燒腦',
  slowburn: '慢熱',
  ensemble: '群戲',
  solo: '獨角戲',
  visualFeast: '視覺饗宴',
  dialogue: '對白精彩',
  tearjerker: '催淚',
  darkTone: '黑暗',
  uplifting: '正能量',
  philosophical: '哲學思辨',
  satirical: '社會諷刺',
  nostalgic: '懷舊',
  experimental: '實驗性',
  cult: '邪典',
  comingOfAge: '成長故事',
  revenge: '復仇',
  heist: '精密計畫',
  survival: '生存掙扎',
  timeTravel: '時空穿越',
  dystopia: '反烏托邦',
  trueStory: '真實事件',
  nonEnglish: '非英語',
  existential: '存在主義',
  antiHero: '反英雄',
  romanticCore: '浪漫內核',
  violentAesthetic: '暴力美學',
  socialCritique: '社會批判',
  psychoThriller: '心理驚悚',
  absurdist: '荒誕',
}

interface TagCloudProps {
  tagLabels: Record<string, number>
}

export default function TagCloud({ tagLabels }: TagCloudProps) {
  const entries = Object.entries(tagLabels).sort((a, b) => b[1] - a[1])

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>
        <i className="ri-price-tag-3-line" /> DNA Tags
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
            {TAG_NAMES[tag] || tag}
          </motion.span>
        ))}
      </div>
    </div>
  )
}
