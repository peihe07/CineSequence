'use client'

import { useState } from 'react'
import Tooltip from './Tooltip'
import styles from './StackedBar.module.css'

const STATUS_COLORS: Record<string, string> = {
  discovered: '#38bdf8',
  invited: '#a78bfa',
  accepted: '#2dd4bf',
  declined: '#f472b6',
}

const FALLBACK_COLOR = '#94a3b8'

interface StackedBarProps {
  data: Record<string, number>
}

export default function StackedBar({ data }: StackedBarProps) {
  const [hovered, setHovered] = useState<string | null>(null)

  const entries = Object.entries(data).filter(([, v]) => v > 0)
  const total = entries.reduce((sum, [, v]) => sum + v, 0)
  if (total === 0) return null

  return (
    <div className={styles.wrapper}>
      {/* Bar */}
      <div className={styles.barContainer}>
        {entries.map(([status, count]) => {
          const pct = (count / total) * 100
          const color = STATUS_COLORS[status] || FALLBACK_COLOR
          return (
            <div
              key={status}
              className={styles.segment}
              style={{ flex: count, background: color, opacity: hovered === null || hovered === status ? 1 : 0.35 }}
              onMouseEnter={() => setHovered(status)}
              onMouseLeave={() => setHovered(null)}
            >
              {pct > 15 && (
                <span className={styles.segmentLabel}>{pct.toFixed(0)}%</span>
              )}
            </div>
          )
        })}
        {hovered && (
          <Tooltip x={0} y={-8} visible>
            {hovered}: {data[hovered]} ({((data[hovered] / total) * 100).toFixed(1)}%)
          </Tooltip>
        )}
      </div>

      {/* Legend */}
      <div className={styles.legend}>
        {entries.map(([status, count]) => (
          <div
            key={status}
            className={styles.legendItem}
            onMouseEnter={() => setHovered(status)}
            onMouseLeave={() => setHovered(null)}
          >
            <span
              className={styles.legendDot}
              style={{ background: STATUS_COLORS[status] || FALLBACK_COLOR }}
            />
            <span className={styles.legendLabel}>{status}</span>
            <span className={styles.legendCount}>{count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
