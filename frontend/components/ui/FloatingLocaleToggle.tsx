'use client'

import LocaleToggle from './LocaleToggle'
import styles from './FloatingLocaleToggle.module.css'

export default function FloatingLocaleToggle() {
  return (
    <div className={styles.wrapper}>
      <LocaleToggle />
    </div>
  )
}
