'use client'

import { useState } from 'react'
import Tooltip from './Tooltip'
import styles from './DonutChart.module.css'

const COLORS = [
  '#2dd4bf', '#38bdf8', '#a78bfa', '#f59e0b',
  '#f472b6', '#34d399', '#60a5fa', '#c084fc',
  '#fb923c', '#4ade80',
]

const SIZE = 160
const STROKE = 28
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const CENTER = SIZE / 2

interface DonutChartProps {
  data: Record<string, number>
}

export default function DonutChart({ data }: DonutChartProps) {
  const [hovered, setHovered] = useState<string | null>(null)

  const entries = Object.entries(data)
    .filter(([k]) => k && k !== 'None')
    .sort((a, b) => b[1] - a[1])

  const total = entries.reduce((sum, [, v]) => sum + v, 0)
  if (total === 0) return null

  // Build segments
  let offset = 0
  const segments = entries.map(([label, count], i) => {
    const pct = count / total
    const dash = pct * CIRCUMFERENCE
    const gap = CIRCUMFERENCE - dash
    const rotation = (offset / total) * 360 - 90
    offset += count
    return { label, count, pct, dash, gap, rotation, color: COLORS[i % COLORS.length] }
  })

  return (
    <div className={styles.wrapper}>
      <div className={styles.chartContainer}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className={styles.svg}>
          {segments.map((seg) => (
            <circle
              key={seg.label}
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              fill="none"
              stroke={seg.color}
              strokeWidth={STROKE}
              strokeDasharray={`${seg.dash} ${seg.gap}`}
              transform={`rotate(${seg.rotation} ${CENTER} ${CENTER})`}
              opacity={hovered === null || hovered === seg.label ? 1 : 0.35}
              style={{ transition: 'opacity 0.2s ease' }}
              onMouseEnter={() => setHovered(seg.label)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
        </svg>
        <div className={styles.centerLabel}>
          <span className={styles.centerValue}>{total}</span>
        </div>
        {hovered && (
          <Tooltip x={SIZE / 2} y={SIZE / 2 - RADIUS - 16} visible>
            {hovered}: {data[hovered]} ({((data[hovered] / total) * 100).toFixed(1)}%)
          </Tooltip>
        )}
      </div>

      {/* Legend */}
      <div className={styles.legend}>
        {segments.map((seg) => (
          <div
            key={seg.label}
            className={styles.legendItem}
            onMouseEnter={() => setHovered(seg.label)}
            onMouseLeave={() => setHovered(null)}
          >
            <span className={styles.legendDot} style={{ background: seg.color }} />
            <span className={styles.legendLabel}>{seg.label}</span>
            <span className={styles.legendCount}>{seg.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
