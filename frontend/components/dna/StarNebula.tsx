'use client'

import { useEffect, useRef } from 'react'
import styles from './StarNebula.module.css'

interface StarNebulaProps {
  /** Genre vector: key = genre name, value = score (0-1) */
  genreVector: Record<string, number>
  /** Archetype ID for nebula color palette */
  archetypeId: string
}

// Archetype → nebula base color
const ARCHETYPE_COLORS: Record<string, string> = {
  shadowProjector: '#7b2d8b',
  mirrorWatcher: '#457b9d',
  emotionDiver: '#e63946',
  genreNomad: '#2a9d8f',
  aestheteCollector: '#f4a261',
  narrativeArchitect: '#264653',
  culturalExplorer: '#9b5de5',
  nostalgiaKeeper: '#6c584c',
}

const DEFAULT_NEBULA = '#c06223'

export default function StarNebula({ genreVector, archetypeId }: StarNebulaProps) {
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
    const cx = w / 2
    const cy = h / 2
    const nebulaColor = ARCHETYPE_COLORS[archetypeId] || DEFAULT_NEBULA

    // Generate star positions from genre vector
    const entries = Object.entries(genreVector).filter(([, v]) => v > 0)
    const stars: Array<{
      x: number; y: number
      size: number; genre: string; score: number
      phaseOffset: number
    }> = []

    const angleStep = (Math.PI * 2) / Math.max(entries.length, 1)
    entries.forEach(([genre, score], i) => {
      const angle = angleStep * i - Math.PI / 2
      const radius = 40 + score * (Math.min(w, h) * 0.3)
      const jitterX = (Math.random() - 0.5) * 30
      const jitterY = (Math.random() - 0.5) * 30
      stars.push({
        x: cx + Math.cos(angle) * radius + jitterX,
        y: cy + Math.sin(angle) * radius + jitterY,
        size: 2 + score * 4,
        genre,
        score,
        phaseOffset: Math.random() * Math.PI * 2,
      })
    })

    // Constellation lines: connect adjacent stars
    const lines: Array<[number, number]> = []
    for (let i = 0; i < stars.length; i++) {
      const next = (i + 1) % stars.length
      lines.push([i, next])
    }

    // Ambient particles
    const particles = Array.from({ length: 20 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.2,
      vy: (Math.random() - 0.5) * 0.15,
      size: Math.random() * 1.5 + 0.5,
      opacity: Math.random() * 0.3 + 0.05,
    }))

    let time = 0

    function draw() {
      if (!ctx) return
      ctx.clearRect(0, 0, w, h)

      // Nebula background glow
      const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, Math.min(w, h) * 0.45)
      grad.addColorStop(0, nebulaColor + '18')
      grad.addColorStop(0.5, nebulaColor + '08')
      grad.addColorStop(1, 'transparent')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, w, h)

      // Constellation lines
      ctx.strokeStyle = nebulaColor + '22'
      ctx.lineWidth = 0.5
      for (const [a, b] of lines) {
        ctx.beginPath()
        ctx.moveTo(stars[a].x, stars[a].y)
        ctx.lineTo(stars[b].x, stars[b].y)
        ctx.stroke()
      }

      // Stars with pulse
      for (const star of stars) {
        const pulse = prefersReducedMotion
          ? 1
          : 0.7 + 0.3 * Math.sin(time * 0.003 + star.phaseOffset)
        ctx.beginPath()
        ctx.arc(star.x, star.y, star.size * pulse, 0, Math.PI * 2)
        ctx.fillStyle = nebulaColor + 'cc'
        ctx.fill()

        // Outer glow
        ctx.beginPath()
        ctx.arc(star.x, star.y, star.size * 2.5 * pulse, 0, Math.PI * 2)
        ctx.fillStyle = nebulaColor + '15'
        ctx.fill()
      }

      // Ambient particles
      if (!prefersReducedMotion) {
        for (const p of particles) {
          p.x += p.vx
          p.y += p.vy
          if (p.x < 0 || p.x > w) p.vx *= -1
          if (p.y < 0 || p.y > h) p.vy *= -1

          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
          ctx.fillStyle = nebulaColor + Math.round(p.opacity * 255).toString(16).padStart(2, '0')
          ctx.fill()
        }
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
  }, [genreVector, archetypeId, prefersReducedMotion])

  return (
    <div className={styles.nebula}>
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  )
}
