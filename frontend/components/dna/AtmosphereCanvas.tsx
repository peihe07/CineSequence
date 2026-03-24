'use client'

import { useEffect, useRef } from 'react'
import styles from './AtmosphereCanvas.module.css'

interface AtmosphereCanvasProps {
  /** Archetype ID for color palette */
  archetypeId: string
}

// Archetype → atmosphere accent color (same palette as StarNebula)
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

const DEFAULT_COLOR = '#c06223'

interface SmokeParticle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  opacity: number
  fadeSpeed: number
  life: number
  maxLife: number
}

interface DancingLight {
  x: number
  y: number
  baseX: number
  baseY: number
  radius: number
  opacity: number
  phaseX: number
  phaseY: number
  speed: number
  color: string
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function createSmoke(w: number, h: number): SmokeParticle {
  const maxLife = 200 + Math.random() * 300
  return {
    x: Math.random() * w,
    y: h + Math.random() * 40,
    vx: (Math.random() - 0.5) * 0.3,
    vy: -(0.15 + Math.random() * 0.35),
    radius: 30 + Math.random() * 60,
    opacity: 0,
    fadeSpeed: 0.004 + Math.random() * 0.003,
    life: 0,
    maxLife,
  }
}

function createLight(w: number, h: number, color: string): DancingLight {
  const baseX = Math.random() * w
  const baseY = Math.random() * h
  return {
    x: baseX,
    y: baseY,
    baseX,
    baseY,
    radius: 60 + Math.random() * 100,
    opacity: 0.02 + Math.random() * 0.04,
    phaseX: Math.random() * Math.PI * 2,
    phaseY: Math.random() * Math.PI * 2,
    speed: 0.003 + Math.random() * 0.004,
    color,
  }
}

export default function AtmosphereCanvas({ archetypeId }: AtmosphereCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || prefersReducedMotion) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const w = rect.width
    const h = rect.height
    const accent = ARCHETYPE_COLORS[archetypeId] || DEFAULT_COLOR
    const [r, g, b] = hexToRgb(accent)

    // Smoke particles — rising wisps
    const smokeCount = 12
    const smokeParticles: SmokeParticle[] = Array.from(
      { length: smokeCount },
      () => {
        const p = createSmoke(w, h)
        // Stagger initial life so they don't all start from the bottom
        p.y = Math.random() * h
        p.life = Math.random() * p.maxLife
        return p
      },
    )

    // Dancing lights — gentle drifting orbs
    const lightCount = 5
    const lights: DancingLight[] = Array.from({ length: lightCount }, () =>
      createLight(w, h, accent),
    )

    let time = 0

    function draw() {
      if (!ctx) return
      ctx.clearRect(0, 0, w, h)

      // Dancing lights
      for (const light of lights) {
        time++
        const driftX = Math.sin(time * light.speed + light.phaseX) * 40
        const driftY = Math.cos(time * light.speed * 0.7 + light.phaseY) * 30
        light.x = light.baseX + driftX
        light.y = light.baseY + driftY

        const grad = ctx.createRadialGradient(
          light.x, light.y, 0,
          light.x, light.y, light.radius,
        )
        grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${light.opacity})`)
        grad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${light.opacity * 0.3})`)
        grad.addColorStop(1, 'transparent')
        ctx.fillStyle = grad
        ctx.fillRect(
          light.x - light.radius,
          light.y - light.radius,
          light.radius * 2,
          light.radius * 2,
        )
      }

      // Smoke particles
      for (let i = 0; i < smokeParticles.length; i++) {
        const p = smokeParticles[i]
        p.life++
        p.x += p.vx
        p.y += p.vy

        // Fade in during first 20%, fade out during last 40%
        const lifeRatio = p.life / p.maxLife
        if (lifeRatio < 0.2) {
          p.opacity = (lifeRatio / 0.2) * 0.035
        } else if (lifeRatio > 0.6) {
          p.opacity = ((1 - lifeRatio) / 0.4) * 0.035
        }

        // Slight horizontal drift
        p.vx += (Math.random() - 0.5) * 0.02

        // Recycle when expired
        if (p.life >= p.maxLife || p.y < -p.radius) {
          smokeParticles[i] = createSmoke(w, h)
        }

        const smokeGrad = ctx.createRadialGradient(
          p.x, p.y, 0,
          p.x, p.y, p.radius,
        )
        smokeGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${p.opacity})`)
        smokeGrad.addColorStop(0.6, `rgba(${r}, ${g}, ${b}, ${p.opacity * 0.4})`)
        smokeGrad.addColorStop(1, 'transparent')
        ctx.fillStyle = smokeGrad
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fill()
      }

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [archetypeId, prefersReducedMotion])

  if (prefersReducedMotion) return null

  return <canvas ref={canvasRef} className={styles.canvas} />
}
