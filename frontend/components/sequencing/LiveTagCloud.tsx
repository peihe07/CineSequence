'use client'

import { AnimatePresence, motion } from 'framer-motion'
import styles from './LiveTagCloud.module.css'

interface LiveTagCloudProps {
  tags: string[]
}

export default function LiveTagCloud({ tags }: LiveTagCloudProps) {
  if (tags.length === 0) return null

  return (
    <div className={styles.container}>
      <AnimatePresence>
        {tags.map((tag, i) => (
          <motion.span
            key={`${tag}-${i}`}
            className={styles.tag}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            {tag}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  )
}
