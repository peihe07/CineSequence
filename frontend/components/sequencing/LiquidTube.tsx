'use client'

import { useEffect, useRef } from 'react'
import styles from './LiquidTube.module.css'

interface LiquidTubeProps {
  /** Current round (1-based) */
  currentRound: number
  /** Total rounds */
  totalRounds: number
  /** Accent color for the liquid */
  liquidColor?: string
}

// Default warm bronze
const DEFAULT_COLOR = '#c06223'

export default function LiquidTube({
  currentRound,
  totalRounds,
  liquidColor,
}: LiquidTubeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const w = rect.width
    const h = rect.height
    const color = liquidColor || DEFAULT_COLOR
    const fillRatio = Math.min(currentRound / totalRounds, 1)

    // Tube dimensions
    const tubeW = 20
    const tubeX = (w - tubeW) / 2
    const tubeTop = 12
    const tubeBot = h - 12
    const tubeH = tubeBot - tubeTop

    // Liquid level
    const liquidTop = tubeBot - tubeH * fillRatio

    let time = 0

    function draw() {
      if (!ctx) return
      ctx.clearRect(0, 0, w, h)

      // Tube outline
      ctx.strokeStyle = 'var(--border-dark)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.roundRect(tubeX, tubeTop, tubeW, tubeH, 10)
      ctx.stroke()

      // Clip to tube shape for liquid
      ctx.save()
      ctx.beginPath()
      ctx.roundRect(tubeX + 1, tubeTop + 1, tubeW - 2, tubeH - 2, 9)
      ctx.clip()

      // Liquid gradient
      const grad = ctx.createLinearGradient(0, liquidTop, 0, tubeBot)
      grad.addColorStop(0, color + '99') // semi-transparent at surface
      grad.addColorStop(1, color + 'dd') // more opaque at bottom

      // Wave at liquid surface
      ctx.beginPath()
      ctx.moveTo(tubeX, tubeBot)
      ctx.lineTo(tubeX, liquidTop)

      if (!prefersReducedMotion) {
        // Sine wave at the surface
        for (let x = 0; x <= tubeW; x++) {
          const waveY = Math.sin(time * 0.004 + x * 0.4) * 2
          ctx.lineTo(tubeX + x, liquidTop + waveY)
        }
      } else {
        ctx.lineTo(tubeX + tubeW, liquidTop)
      }

      ctx.lineTo(tubeX + tubeW, tubeBot)
      ctx.closePath()
      ctx.fillStyle = grad
      ctx.fill()

      ctx.restore()

      // Round indicator dots along the tube
      const dotSpacing = tubeH / totalRounds
      for (let i = 0; i < totalRounds; i++) {
        const dotY = tubeBot - dotSpacing * (i + 0.5)
        ctx.beginPath()
        ctx.arc(tubeX + tubeW + 6, dotY, 1.5, 0, Math.PI * 2)
        ctx.fillStyle = i < currentRound ? color : '#ddd9d0'
        ctx.fill()
      }

      time++
      if (!prefersReducedMotion) {
        animRef.current = requestAnimationFrame(draw)
      }
    }

    draw()
    if (!prefersReducedMotion) {
      animRef.current = requestAnimationFrame(draw)
    }

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [currentRound, totalRounds, liquidColor, prefersReducedMotion])

  return (
    <div className={styles.tube}>
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  )
}
