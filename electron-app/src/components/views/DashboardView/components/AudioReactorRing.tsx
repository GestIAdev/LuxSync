/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎵 AUDIO REACTOR RING - WAVE 35.2: Truth Store Wiring
 * Visualizador circular estilo reactor Arc que pulsa con el beat
 * Connected to truthStore.audio for real energy data
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useRef, useEffect, useCallback } from 'react'
import { useBeat, useAudio } from '../../../../stores/truthStore'
import './AudioReactorRing.css'

interface AudioReactorRingProps {
  size?: number
  className?: string
}

export const AudioReactorRing: React.FC<AudioReactorRingProps> = ({
  size = 280,
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)
  const lastBeatRef = useRef<number>(0)
  const pulseRef = useRef<number>(0)
  
  // Audio data from truth store - REAL DATA
  const beat = useBeat() // 🛡️ WAVE 2042.13: React 19 stable hook
  const audio = useAudio() // 🛡️ WAVE 2042.12: React 19 stable hook
  
  const bpm = beat?.bpm || 120
  const energy = audio?.energy || 0.5  // Real energy from audio analysis
  const confidence = beat?.confidence || 0.7
  const onBeat = beat?.onBeat || false
  
  const render = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    
    const W = canvas.width
    const H = canvas.height
    const centerX = W / 2
    const centerY = H / 2
    const baseRadius = Math.min(W, H) * 0.35

    // 🛡️ WAVE 7569: NaN SHIELD — createRadialGradient throws TypeError on
    // non-finite coordinates in Chromium. Guard all gradient inputs upfront.
    if (!Number.isFinite(centerX) || !Number.isFinite(centerY) || !Number.isFinite(baseRadius) || baseRadius <= 0) return
    
    // Clear with fade trail
    ctx.fillStyle = 'rgba(10, 10, 20, 0.15)'
    ctx.fillRect(0, 0, W, H)
    
    // Pulse decay
    pulseRef.current *= 0.92
    
    // Detect beat hit
    const now = Date.now()
    if (onBeat && now - lastBeatRef.current > 100) {
      pulseRef.current = 0.8
      lastBeatRef.current = now
    }
    
    const pulse = pulseRef.current
    const time = now / 1000
    
    // ═══════════════════════════════════════════════════════════════════════
    // OUTER RING - Energy Field
    // ═══════════════════════════════════════════════════════════════════════

    const outerRadius = baseRadius * (1.3 + pulse * 0.2)
    if (!Number.isFinite(outerRadius) || outerRadius <= 0) return
    const segments = 64

    ctx.beginPath()
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2
      const wobble = Math.sin(angle * 8 + time * 3) * (2 + energy * 8)
      const r = outerRadius + wobble
      const x = centerX + Math.cos(angle) * r
      const y = centerY + Math.sin(angle) * r

      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()

    // 🛡️ WAVE 7712: Solid stroke with globalAlpha — replaces createRadialGradient.
    // Position/radius change every frame (depend on pulse), so gradient can't be cached.
    // Solid color + alpha = zero CanvasGradient C++ objects.
    ctx.globalAlpha = Math.max(0, Math.min(1, 0.2 + pulse * 0.3 + energy * 0.2))
    ctx.strokeStyle = '#8a2be2'
    ctx.lineWidth = 2 + energy * 3
    ctx.stroke()
    ctx.globalAlpha = 1

    // ═══════════════════════════════════════════════════════════════════════
    // MIDDLE RING - Core Reactor
    // ═══════════════════════════════════════════════════════════════════════

    const midRadius = baseRadius * (0.9 + pulse * 0.15)
    if (!Number.isFinite(midRadius) || midRadius <= 0) return

    ctx.beginPath()
    ctx.arc(centerX, centerY, midRadius, 0, Math.PI * 2)
    ctx.globalAlpha = Math.max(0, Math.min(1, 0.4 + pulse * 0.4))
    ctx.strokeStyle = '#00ffff'
    ctx.lineWidth = 3 + pulse * 4
    ctx.stroke()
    ctx.globalAlpha = 1

    // 🛡️ WAVE 7712: Inner glow — concentric circles with decreasing alpha
    // instead of createRadialGradient. Same visual effect, zero C++ objects.
    if (midRadius > 2) {
      for (let s = 4; s >= 1; s--) {
        const r = (midRadius * s) / 4
        ctx.beginPath()
        ctx.arc(centerX, centerY, r, 0, Math.PI * 2)
        ctx.globalAlpha = Math.max(0, Math.min(1, (0.15 + pulse * 0.25) * (1 - s / 5)))
        ctx.fillStyle = '#00ffff'
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    // ═══════════════════════════════════════════════════════════════════════
    // INNER CORE - The Heart
    // ═══════════════════════════════════════════════════════════════════════

    const coreRadius = baseRadius * (0.25 + pulse * 0.1)
    if (!Number.isFinite(coreRadius) || coreRadius <= 0) return

    // 🛡️ WAVE 7712: Core glow — concentric circles with decreasing alpha
    if (coreRadius > 1) {
      for (let s = 4; s >= 1; s--) {
        const r = (coreRadius * 2 * s) / 4
        ctx.beginPath()
        ctx.arc(centerX, centerY, r, 0, Math.PI * 2)
        if (s <= 2) {
          ctx.globalAlpha = Math.max(0, Math.min(1, (0.8 + pulse * 0.2) * (1 - (s - 1) / 4)))
          ctx.fillStyle = '#ffffff'
        } else {
          ctx.globalAlpha = Math.max(0, Math.min(1, (0.6 + energy * 0.3) * (1 - (s - 1) / 4)))
          ctx.fillStyle = '#00ffff'
        }
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    // Solid core
    ctx.beginPath()
    ctx.arc(centerX, centerY, coreRadius, 0, Math.PI * 2)
    ctx.globalAlpha = Math.max(0, Math.min(1, 0.9 + pulse * 0.1))
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.globalAlpha = 1

    // ═══════════════════════════════════════════════════════════════════════
    // ENERGY BARS - Rotating segments
    // ═══════════════════════════════════════════════════════════════════════

    const barCount = 12

    ctx.save()
    ctx.translate(centerX, centerY)
    ctx.rotate(time * 0.5)

    // 🛡️ WAVE 7712: Solid fill bars with alpha modulation — replaces
    // createLinearGradient per bar (12 gradients/frame eliminated).
    for (let i = 0; i < barCount; i++) {
      const angle = (i / barCount) * Math.PI * 2
      const barEnergy = Math.sin(time * 2 + i * 0.5) * 0.5 + 0.5
      const barLength = baseRadius * (0.5 + barEnergy * energy * 0.4)

      ctx.save()
      ctx.rotate(angle)

      // Solid fill — alpha fades from base to tip
      const baseAlpha = Math.max(0, Math.min(1, 0.3 + pulse * 0.4))
      const tipAlpha = Math.max(0, Math.min(1, 0.5 + energy * 0.3))

      // Base half (cyan)
      ctx.beginPath()
      ctx.moveTo(midRadius * 0.6, -2)
      ctx.lineTo(midRadius * 0.6 + barLength * 0.5, -1.5)
      ctx.lineTo(midRadius * 0.6 + barLength * 0.5, 1.5)
      ctx.lineTo(midRadius * 0.6, 2)
      ctx.closePath()
      ctx.globalAlpha = baseAlpha
      ctx.fillStyle = '#00ffff'
      ctx.fill()

      // Tip half (magenta)
      ctx.beginPath()
      ctx.moveTo(midRadius * 0.6 + barLength * 0.5, -1.5)
      ctx.lineTo(midRadius * 0.6 + barLength, -1)
      ctx.lineTo(midRadius * 0.6 + barLength, 1)
      ctx.lineTo(midRadius * 0.6 + barLength * 0.5, 1.5)
      ctx.closePath()
      ctx.globalAlpha = tipAlpha
      ctx.fillStyle = '#ff0080'
      ctx.fill()

      ctx.restore()
    }

    ctx.globalAlpha = 1
    ctx.restore()
    
    // ═══════════════════════════════════════════════════════════════════════
    // BPM TEXT
    // ═══════════════════════════════════════════════════════════════════════

    // 🛡️ WAVE 7712: Use globalAlpha + solid fillStyle instead of rgba() template
    // literals. Eliminates 2 string allocs/frame (template literal interpolation).
    ctx.save()
    ctx.font = 'bold 32px "Orbitron", "Rajdhani", monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.globalAlpha = Math.max(0, Math.min(1, 0.9 + pulse * 0.1))
    ctx.fillStyle = '#ffffff'
    ctx.shadowColor = '#00ffff'
    ctx.shadowBlur = 10 + pulse * 20
    ctx.fillText(Math.round(bpm).toString(), centerX, centerY - 8)

    ctx.font = '12px "Rajdhani", sans-serif'
    ctx.globalAlpha = 0.7
    ctx.fillStyle = '#00ffff'
    ctx.shadowBlur = 5
    ctx.fillText('BPM', centerX, centerY + 18)
    ctx.restore()
    
    animationRef.current = requestAnimationFrame(render)
  }, [bpm, energy, confidence, onBeat])
  
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    // Set canvas size with device pixel ratio
    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    canvas.style.width = `${size}px`
    canvas.style.height = `${size}px`
    
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.scale(dpr, dpr)
      canvas.width = size
      canvas.height = size
    }
    
    animationRef.current = requestAnimationFrame(render)
    
    return () => {
      cancelAnimationFrame(animationRef.current)
    }
  }, [size, render])
  
  return (
    <div className={`audio-reactor-ring ${className}`}>
      <canvas ref={canvasRef} />
      <div className="reactor-label">AUDIO REACTOR</div>
    </div>
  )
}

export default AudioReactorRing
