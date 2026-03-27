'use client'

import { useRef, useState } from 'react'
import Tooltip from './Tooltip'
import styles from './MiniChart.module.css'

interface DataPoint {
  date: string
  count: number
}

interface MiniChartProps {
  data: DataPoint[]
  color?: 'accent' | 'teal' | 'blue'
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export default function MiniChart({ data, color = 'accent' }: MiniChartProps) {
  const [hovered, setHovered] = useState<{ idx: number; x: number; y: number } | null>(null)
  const chartRef = useRef<HTMLDivElement>(null)

  const max = Math.max(...data.map((d) => d.count), 1)

  // Y-axis scale: 3 ticks
  const ticks = [Math.round(max), Math.round(max * 0.5), 0]

  // X-axis labels: first, middle, last
  const xLabels =
    data.length >= 3
      ? [
          { label: formatDate(data[0].date), pos: 0 },
          { label: formatDate(data[Math.floor(data.length / 2)].date), pos: 50 },
          { label: formatDate(data[data.length - 1].date), pos: 100 },
        ]
      : data.map((d, i) => ({
          label: formatDate(d.date),
          pos: data.length === 1 ? 50 : (i / (data.length - 1)) * 100,
        }))

  const handleMouseEnter = (idx: number, e: React.MouseEvent<HTMLDivElement>) => {
    if (!chartRef.current) return
    const rect = chartRef.current.getBoundingClientRect()
    const barRect = e.currentTarget.getBoundingClientRect()
    setHovered({
      idx,
      x: barRect.left - rect.left + barRect.width / 2,
      y: barRect.top - rect.top - 8,
    })
  }

  return (
    <div className={styles.wrapper}>
      {/* Y-axis */}
      <div className={styles.yAxis}>
        {ticks.map((tick) => (
          <span key={tick} className={styles.yLabel}>{tick}</span>
        ))}
      </div>

      {/* Chart area */}
      <div className={styles.chartArea}>
        {/* Grid lines */}
        <div className={styles.gridLines}>
          {ticks.map((_, i) => (
            <div key={i} className={styles.gridLine} />
          ))}
        </div>

        {/* Bars */}
        <div className={styles.bars} ref={chartRef}>
          <Tooltip
            x={hovered?.x ?? 0}
            y={hovered?.y ?? 0}
            visible={hovered !== null}
          >
            {hovered !== null && (
              <>
                <strong>{data[hovered.idx].date}</strong>
                <br />
                {data[hovered.idx].count}
              </>
            )}
          </Tooltip>
          {data.map((d, i) => (
            <div
              key={d.date}
              className={`${styles.bar} ${styles[`bar--${color}`]}`}
              style={{ height: `${(d.count / max) * 100}%` }}
              onMouseEnter={(e) => handleMouseEnter(i, e)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
        </div>

        {/* X-axis */}
        <div className={styles.xAxis}>
          {xLabels.map(({ label, pos }) => (
            <span key={label} className={styles.xLabel} style={{ left: `${pos}%` }}>
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
