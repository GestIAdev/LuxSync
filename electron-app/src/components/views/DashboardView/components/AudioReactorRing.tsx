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
    
    // Gradient stroke
    const gradient = ctx.createRadialGradient(centerX, centerY, baseRadius * 0.5, centerX, centerY, outerRadius * 1.2)
    gradient.addColorStop(0, `rgba(0, 255, 255, ${0.1 + pulse * 0.3})`)
    gradient.addColorStop(0.5, `rgba(138, 43, 226, ${0.3 + energy * 0.4})`)
    gradient.addColorStop(1, `rgba(255, 0, 128, ${0.2 + pulse * 0.5})`)
    
    ctx.strokeStyle = gradient
    ctx.lineWidth = 2 + energy * 3
    ctx.stroke()
    
    // ═══════════════════════════════════════════════════════════════════════
    // MIDDLE RING - Core Reactor
    // ═══════════════════════════════════════════════════════════════════════
    
    const midRadius = baseRadius * (0.9 + pulse * 0.15)
    
    ctx.beginPath()
    ctx.arc(centerX, centerY, midRadius, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(0, 255, 255, ${0.4 + pulse * 0.4})`
    ctx.lineWidth = 3 + pulse * 4
    ctx.stroke()
    
    // Inner glow
    const innerGlow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, midRadius)
    innerGlow.addColorStop(0, `rgba(0, 255, 255, ${0.15 + pulse * 0.25})`)
    innerGlow.addColorStop(0.7, `rgba(138, 43, 226, ${0.05 + energy * 0.1})`)
    innerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)')
    
    ctx.beginPath()
    ctx.arc(centerX, centerY, midRadius, 0, Math.PI * 2)
    ctx.fillStyle = innerGlow
    ctx.fill()
    
    // ═══════════════════════════════════════════════════════════════════════
    // INNER CORE - The Heart
    // ═══════════════════════════════════════════════════════════════════════
    
    const coreRadius = baseRadius * (0.25 + pulse * 0.1)
    
    // Core glow
    const coreGlow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, coreRadius * 2)
    coreGlow.addColorStop(0, `rgba(255, 255, 255, ${0.8 + pulse * 0.2})`)
    coreGlow.addColorStop(0.3, `rgba(0, 255, 255, ${0.6 + energy * 0.3})`)
    coreGlow.addColorStop(0.7, `rgba(138, 43, 226, ${0.3})`)
    coreGlow.addColorStop(1, 'rgba(0, 0, 0, 0)')
    
    ctx.beginPath()
    ctx.arc(centerX, centerY, coreRadius * 2, 0, Math.PI * 2)
    ctx.fillStyle = coreGlow
    ctx.fill()
    
    // Solid core
    ctx.beginPath()
    ctx.arc(centerX, centerY, coreRadius, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(255, 255, 255, ${0.9 + pulse * 0.1})`
    ctx.fill()
    
    // ═══════════════════════════════════════════════════════════════════════
    // ENERGY BARS - Rotating segments
    // ═══════════════════════════════════════════════════════════════════════
    
    const barCount = 12
    const barWidth = 0.08
    
    ctx.save()
    ctx.translate(centerX, centerY)
    ctx.rotate(time * 0.5)
    
    for (let i = 0; i < barCount; i++) {
      const angle = (i / barCount) * Math.PI * 2
      const barEnergy = Math.sin(time * 2 + i * 0.5) * 0.5 + 0.5
      const barLength = baseRadius * (0.5 + barEnergy * energy * 0.4)
      
      ctx.save()
      ctx.rotate(angle)
      
      const barGradient = ctx.createLinearGradient(midRadius * 0.6, 0, midRadius * 0.6 + barLength, 0)
      barGradient.addColorStop(0, 'rgba(0, 255, 255, 0)')
      barGradient.addColorStop(0.3, `rgba(0, 255, 255, ${0.3 + pulse * 0.4})`)
      barGradient.addColorStop(1, `rgba(255, 0, 128, ${0.5 + energy * 0.3})`)
      
      ctx.beginPath()
      ctx.moveTo(midRadius * 0.6, -2)
      ctx.lineTo(midRadius * 0.6 + barLength, -1)
      ctx.lineTo(midRadius * 0.6 + barLength, 1)
      ctx.lineTo(midRadius * 0.6, 2)
      ctx.closePath()
      ctx.fillStyle = barGradient
      ctx.fill()
      
      ctx.restore()
    }
    
    ctx.restore()
    
    // ═══════════════════════════════════════════════════════════════════════
    // BPM TEXT
    // ═══════════════════════════════════════════════════════════════════════
    
    ctx.save()
    ctx.font = 'bold 32px "Orbitron", "Rajdhani", monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = `rgba(255, 255, 255, ${0.9 + pulse * 0.1})`
    ctx.shadowColor = '#00ffff'
    ctx.shadowBlur = 10 + pulse * 20
    ctx.fillText(Math.round(bpm).toString(), centerX, centerY - 8)
    
    ctx.font = '12px "Rajdhani", sans-serif'
    ctx.fillStyle = 'rgba(0, 255, 255, 0.7)'
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
