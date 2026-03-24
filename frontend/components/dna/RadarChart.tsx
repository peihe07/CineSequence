'use client'

import { motion } from 'framer-motion'
import { useI18n } from '@/lib/i18n'
import styles from './RadarChart.module.css'

interface RadarChartProps {
  scores: {
    mainstream_independent: number
    rational_emotional: number
    light_dark: number
  }
}

// 3 axes: each 1-5, center is 3
const AXES = [
  { key: 'mainstream_independent', labelAKey: 'dna.axis.mainstream', labelBKey: 'dna.axis.independent' },
  { key: 'rational_emotional', labelAKey: 'dna.axis.rational', labelBKey: 'dna.axis.emotional' },
  { key: 'light_dark', labelAKey: 'dna.axis.light', labelBKey: 'dna.axis.dark' },
] as const

const SIZE = 240
const CENTER = SIZE / 2
const RADIUS = 90

function polarToCart(angleDeg: number, r: number): [number, number] {
  const rad = (angleDeg - 90) * (Math.PI / 180)
  return [CENTER + r * Math.cos(rad), CENTER + r * Math.sin(rad)]
}

export default function RadarChart({ scores }: RadarChartProps) {
  const { t } = useI18n()
  const angleStep = 360 / AXES.length

  // Build polygon points from scores (map 1-5 to 0-RADIUS)
  const points = AXES.map((axis, i) => {
    const value = (scores[axis.key] as number) || 3
    const normalized = ((value - 1) / 4) * RADIUS
    const angle = i * angleStep
    return polarToCart(angle, normalized)
  })

  const polygonStr = points.map(([x, y]) => `${x},${y}`).join(' ')

  // Background grid rings
  const rings = [0.25, 0.5, 0.75, 1.0]

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>
        <i className="ri-compass-3-line" /> {t('dna.quadrantMap')}
      </h3>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className={styles.svg}
        width={SIZE}
        height={SIZE}
      >
        {/* Grid rings */}
        {rings.map((scale) => {
          const ringPoints = AXES.map((_, i) => {
            const angle = i * angleStep
            return polarToCart(angle, RADIUS * scale)
          })
          const ringStr = ringPoints.map(([x, y]) => `${x},${y}`).join(' ')
          return (
            <polygon
              key={scale}
              points={ringStr}
              fill="none"
              stroke="rgba(68,81,75,0.1)"
              strokeWidth={1}
            />
          )
        })}

        {/* Axis lines */}
        {AXES.map((_, i) => {
          const angle = i * angleStep
          const [x, y] = polarToCart(angle, RADIUS)
          return (
            <line
              key={i}
              x1={CENTER}
              y1={CENTER}
              x2={x}
              y2={y}
              stroke="rgba(68,81,75,0.08)"
              strokeWidth={1}
            />
          )
        })}

        {/* Data polygon */}
        <motion.polygon
          points={polygonStr}
          fill="rgba(229, 126, 49, 0.1)"
          stroke="var(--accent)"
          strokeWidth={2}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.5 }}
        />

        {/* Data dots */}
        {points.map(([x, y], i) => (
          <motion.circle
            key={i}
            cx={x}
            cy={y}
            r={4}
            fill="var(--accent)"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.6 + i * 0.1, type: 'spring' }}
          />
        ))}
      </svg>

      {/* Labels */}
      <div className={styles.labels}>
        {AXES.map((axis) => {
          const value = (scores[axis.key] as number) || 3
          const pctB = Math.round(((value - 1) / 4) * 100)
          return (
            <div key={axis.key} className={styles.labelRow}>
              <span className={styles.labelA}>{t(axis.labelAKey)}</span>
              <div className={styles.bar}>
                <motion.div
                  className={styles.barFill}
                  initial={{ width: 0 }}
                  animate={{ width: `${pctB}%` }}
                  transition={{ duration: 0.6, delay: 0.8 }}
                />
              </div>
              <span className={styles.labelB}>{t(axis.labelBKey)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
