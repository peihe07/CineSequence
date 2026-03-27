'use client'

import { type ReactNode } from 'react'
import styles from './Tooltip.module.css'

interface TooltipProps {
  x: number
  y: number
  visible: boolean
  children: ReactNode
}

export default function Tooltip({ x, y, visible, children }: TooltipProps) {
  if (!visible) return null
  return (
    <div
      className={styles.tooltip}
      style={{ left: x, top: y }}
    >
      {children}
    </div>
  )
}
