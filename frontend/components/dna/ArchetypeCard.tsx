'use client'

import { motion } from 'framer-motion'
import styles from './ArchetypeCard.module.css'

interface ArchetypeCardProps {
  archetype: {
    id: string
    name: string
    name_en: string
    icon: string
    description: string
  }
}

export default function ArchetypeCard({ archetype }: ArchetypeCardProps) {
  return (
    <motion.div
      className={styles.card}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
    >
      <div className={styles.iconWrap}>
        <i className={archetype.icon} />
        <div className={styles.iconGlow} />
      </div>
      <h2 className={styles.name}>{archetype.name}</h2>
      <span className={styles.nameEn}>{archetype.name_en}</span>
      <p className={styles.description}>{archetype.description}</p>
    </motion.div>
  )
}
