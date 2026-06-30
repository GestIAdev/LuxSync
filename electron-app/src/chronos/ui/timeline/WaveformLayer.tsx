/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌊 WAVEFORM LAYER - WAVE 2005: THE PULSE
 * High-performance HTML5 Canvas waveform renderer
 * 
 * DESIGN GOALS:
 * - Render 5 min song in <16ms per frame (60fps)
 * - Energy-based heatmap coloring (bass=purple, energy=cyan, drop=white)
 * - Mirror reflection style (like SoundCloud/Ableton)
 * - Smooth zoom/scroll without re-rendering data
 * 
 * RENDERING STRATEGY:
 * 1. Pre-render waveform to OffscreenCanvas at full resolution
 * 2. Use drawImage() with source cropping for viewport
 * 3. Only re-render full waveform when data changes
 * 
 * @module chronos/ui/timeline/WaveformLayer
 * @version WAVE 2005
 */

import React, { useRef, useEffect, useCallback, memo, useState } from 'react'
import type { WaveformData, HeatmapData, AnalysisData } from '../../core/types'
import './WaveformLayer.css'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface WaveformLayerProps {
  /** Analysis data from GodEarOffline */
  analysisData: AnalysisData | null
  
  /** Viewport start time in ms */
  viewportStartMs: number
  
  /** Viewport end time in ms */
  viewportEndMs: number
  
  /** Pixels per second (zoom level) */
  pixelsPerSecond: number
  
  /** Track height in pixels */
  height: number
  
  /** Offset from left edge for track labels */
  leftOffset: number
  
  /** Duration of audio in ms */
  durationMs: number
  
  /** Optional: BPM for beat grid overlay */
  bpm?: number
  
  /** Show beat grid overlay */
  showBeatGrid?: boolean
}

// ═══════════════════════════════════════════════════════════════════════════
// COLOR PALETTE - WAVE 2006: HIGH CONTRAST ENERGY HEATMAP
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Energy to color mapping (0-1 energy -> color)
 * 
 * WAVE 2006 ENHANCEMENT:
 * - Low energy: Deep purple/blue (chill) - DARKER
 * - Medium energy: BRIGHT CYAN (groove) - MORE SATURATED
 * - High energy: WHITE (drop) - PURE WHITE for peaks
 * 
 * Increased contrast for better readability
 */
function energyToColor(energy: number, bass: number, high: number): string {
  // Normalize inputs
  const e = Math.min(1, Math.max(0, energy))
  const b = Math.min(1, Math.max(0, bass))
  const h = Math.min(1, Math.max(0, high))
  
  let hue: number
  let saturation: number
  let lightness: number
  
  if (e < 0.25) {
    // Low energy: Deep purple/blue (chill zone) - DARKER
    const t = e / 0.25
    hue = 270 - t * 30           // 270 (purple) -> 240 (blue)
    saturation = 50 + t * 30     // 50% -> 80%
    lightness = 15 + t * 15      // 15% -> 30% (darker base)
  } else if (e < 0.6) {
    // Medium energy: BRIGHT CYAN (groove zone) - HIGHER CONTRAST
    const t = (e - 0.25) / 0.35
    hue = 240 - t * 60           // 240 (blue) -> 180 (cyan)
    saturation = 80 + t * 15     // 80% -> 95%
    lightness = 30 + t * 30      // 30% -> 60% (bright cyan)
  } else if (e < 0.85) {
    // High energy: Hot cyan (intense) 
    const t = (e - 0.6) / 0.25
    hue = 180                    // Pure cyan
    saturation = 95 - t * 25     // 95% -> 70% (desaturating towards white)
    lightness = 60 + t * 25      // 60% -> 85%
  } else {
    // Peak energy: PURE WHITE (drops/transients)
    const t = (e - 0.85) / 0.15
    hue = 180                    // Stays cyan-ish
    saturation = 70 - t * 60     // 70% -> 10% (almost desaturated)
    lightness = 85 + t * 13      // 85% -> 98% (near white)
  }
  
  // Bass boost: Shift towards purple/magenta (stronger influence)
  if (b > 0.4) {
    const bassInfluence = (b - 0.4) * 0.5
    hue = hue + (290 - hue) * bassInfluence
    saturation = Math.min(100, saturation + bassInfluence * 15)
  }
  
  // High frequency boost: Shift towards white
  if (h > 0.5) {
    const highInfluence = (h - 0.5) * 0.6
    lightness = Math.min(98, lightness + highInfluence * 25)
    saturation = Math.max(5, saturation - highInfluence * 30)
  }
  
  return `hsl(${Math.round(hue)}, ${Math.round(saturation)}%, ${Math.round(lightness)}%)`
}

/**
 * Create gradient for a waveform bar based on energy
 */
function createBarGradient(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  height: number,
  energy: number,
  bass: number,
  high: number
): CanvasGradient {
  const gradient = ctx.createLinearGradient(x, y, x, y + height)
  
  const baseColor = energyToColor(energy, bass, high)
  const brightColor = energyToColor(Math.min(1, energy * 1.3), bass, high)
  const darkColor = energyToColor(energy * 0.5, bass * 0.7, high * 0.7)
  
  // Gradient from bright (center) to dark (edges)
  gradient.addColorStop(0, darkColor)
  gradient.addColorStop(0.3, baseColor)
  gradient.addColorStop(0.5, brightColor)
  gradient.addColorStop(0.7, baseColor)
  gradient.addColorStop(1, darkColor)
  
  return gradient
}

// 🌊 WAVE 2040.14: AURORA PRISMATIC GRADIENT
// Deep Purple edges → Violet/Magenta middle → White/Pink center
// The waveform glows like a neon aurora borealis
const AURORA_COLORS = {
  edge: '#4c1d95',    // Deep purple (0%, 100%)
  middle: '#d946ef',  // Fuchsia/Magenta (30%, 70%)
  center: '#fce7f3',  // White-pink (50%)
} as const

/**
 * 🌊 WAVE 2040.14: Create AURORA gradient for waveform fill
 * Deep Purple → Violet/Magenta → White/Pink center, mirrored symmetrically
 */
function createSpectralGradient(
  ctx: CanvasRenderingContext2D,
  height: number,
  intensity: number = 1
): CanvasGradient {
  const gradient = ctx.createLinearGradient(0, 0, 0, height)
  
  // Edge opacity scales with intensity
  const edgeOpacity = 0.6 + intensity * 0.3
  const middleOpacity = 0.8 + intensity * 0.2
  const centerOpacity = 0.9 + intensity * 0.1
  
  // Top → Center → Bottom (mirrored aurora)
  gradient.addColorStop(0, `rgba(76, 29, 149, ${edgeOpacity})`)       // Deep purple edge
  gradient.addColorStop(0.20, `rgba(139, 92, 246, ${middleOpacity})`) // Violet transition
  gradient.addColorStop(0.35, `rgba(217, 70, 239, ${middleOpacity})`) // Fuchsia/Magenta
  gradient.addColorStop(0.42, `rgba(244, 114, 182, ${centerOpacity})`)// Pink approach
  gradient.addColorStop(0.50, `rgba(252, 231, 243, ${0.95})`)        // White-pink center
  gradient.addColorStop(0.58, `rgba(244, 114, 182, ${centerOpacity})`)// Pink approach
  gradient.addColorStop(0.65, `rgba(217, 70, 239, ${middleOpacity})`) // Fuchsia/Magenta
  gradient.addColorStop(0.80, `rgba(139, 92, 246, ${middleOpacity})`) // Violet transition
  gradient.addColorStop(1, `rgba(76, 29, 149, ${edgeOpacity})`)       // Deep purple edge
  
  return gradient
}

// ═══════════════════════════════════════════════════════════════════════════
// WAVEFORM RENDERER - OPTIMIZED FOR PERFORMANCE
// ═══════════════════════════════════════════════════════════════════════════

// 🛡️ WAVE 2005.2: Pre-computed color cache to avoid HSL string creation per bar
const colorCache = new Map<string, string>()

function getCachedColor(energy: number, bass: number, high: number): string {
  // Quantize to reduce cache size (5% steps = 20 levels per param = 8000 combos max)
  const eKey = Math.round(energy * 20)
  const bKey = Math.round(bass * 20)
  const hKey = Math.round(high * 20)
  const key = `${eKey}-${bKey}-${hKey}`
  
  let color = colorCache.get(key)
  if (!color) {
    color = energyToColor(energy, bass, high)
    colorCache.set(key, color)
  }
  return color
}

/**
 * 🌊 WAVE 7107-B: ARIADNE RIBBON — Tactical Heatmap Renderer
 * Replaces classic waveform bars with a continuous energy heatmap + transient markers.
 * Energy 0.0 = deep blue/dark, 1.0 = fiery red/orange.
 * Transients drawn as bright vertical lines (kicks/drops).
 */
function renderWaveform(
  canvas: HTMLCanvasElement,
  analysisData: AnalysisData,
  viewportStartMs: number,
  viewportEndMs: number,
  pixelsPerSecond: number,
  leftOffset: number,
  durationMs: number
): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const { energyHeatmap, transients } = analysisData
  const { width, height } = canvas

  // Clear canvas
  ctx.clearRect(0, 0, width, height)

  // 🛡️ Early exit if no heatmap data
  if (!energyHeatmap?.energy || energyHeatmap.energy.length === 0) return

  const visibleWidth = width - leftOffset
  const pixelsPerMs = pixelsPerSecond / 1000
  const visibleDurationMs = visibleWidth / pixelsPerMs
  const actualViewportEnd = viewportStartMs + visibleDurationMs

  // ── (a) CONTINUOUS HEATMAP BACKGROUND ──────────────────────────────
  // Map energy [0..1] to color: 0.0 = deep blue (#0a0a2e), 1.0 = fiery red (#ff3300)
  const energyToHeatColor = (e: number): [number, number, number] => {
    const clamped = Math.min(1, Math.max(0, e))
    if (clamped < 0.25) {
      // Deep blue → blue
      const t = clamped / 0.25
      return [Math.round(10 + t * 20), Math.round(10 + t * 40), Math.round(46 + t * 80)]
    } else if (clamped < 0.5) {
      // Blue → cyan/teal
      const t = (clamped - 0.25) / 0.25
      return [Math.round(30 + t * 0), Math.round(50 + t * 130), Math.round(126 + t * 40)]
    } else if (clamped < 0.75) {
      // Cyan → orange
      const t = (clamped - 0.5) / 0.25
      return [Math.round(30 + t * 200), Math.round(180 + t * 20), Math.round(166 - t * 120)]
    } else {
      // Orange → fiery red
      const t = (clamped - 0.75) / 0.25
      return [Math.round(230 + t * 25), Math.round(200 - t * 150), Math.round(46 - t * 40)]
    }
  }

  // Draw heatmap as 1px-wide vertical strips for maximum resolution
  const resMs = energyHeatmap.resolutionMs
  const startIdx = Math.max(0, Math.floor(viewportStartMs / resMs))
  const endIdx = Math.min(energyHeatmap.energy.length, Math.ceil(actualViewportEnd / resMs))

  if (startIdx < endIdx) {
    for (let i = startIdx; i < endIdx; i++) {
      const sampleTimeMs = i * resMs
      const x = leftOffset + ((sampleTimeMs - viewportStartMs) / 1000) * pixelsPerSecond
      if (x < leftOffset || x > width) continue

      const energy = energyHeatmap.energy[i] ?? 0
      const [r, g, b] = energyToHeatColor(energy)

      // Draw vertical strip
      const stripWidth = Math.max(1, (resMs / 1000) * pixelsPerSecond)
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`
      ctx.fillRect(x, 0, stripWidth, height)
    }

    // Blend overlay for depth — subtle gradient from top/bottom
    const grad = ctx.createLinearGradient(0, 0, 0, height)
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.25)')
    grad.addColorStop(0.5, 'rgba(0, 0, 0, 0)')
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.25)')
    ctx.fillStyle = grad
    ctx.fillRect(leftOffset, 0, visibleWidth, height)
  }

  // ── (b) TRANSIENT MARKERS ──────────────────────────────────────────
  // Draw bright vertical lines for each transient (kick/drop) in viewport
  if (transients && transients.length > 0) {
    ctx.save()
    ctx.shadowColor = 'rgba(255, 255, 255, 0.8)'
    ctx.shadowBlur = 6
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'
    ctx.lineWidth = 2

    for (const tMs of transients) {
      if (tMs < viewportStartMs || tMs > actualViewportEnd) continue
      const x = leftOffset + ((tMs - viewportStartMs) / 1000) * pixelsPerSecond
      if (x < leftOffset || x > width) continue

      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }

    // Reset shadow
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.restore()
  }

  // ── Center line (subtle) ───────────────────────────────────────────
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(leftOffset, height / 2)
  ctx.lineTo(width, height / 2)
  ctx.stroke()
}

/**
 * Render beat grid overlay
 */
function renderBeatGrid(
  canvas: HTMLCanvasElement,
  bpm: number,
  viewportStartMs: number,
  viewportEndMs: number,
  pixelsPerSecond: number,
  leftOffset: number
): void {
  const ctx = canvas.getContext('2d')
  if (!ctx || bpm <= 0) return
  
  const { width, height } = canvas
  const msPerBeat = 60000 / bpm
  
  // 🔥 WAVE 2040.40: INFINITE HORIZON — Calculate last beat from CANVAS WIDTH
  const visibleWidth = width - leftOffset
  const pixelsPerMs = pixelsPerSecond / 1000
  const visibleDurationMs = visibleWidth / pixelsPerMs
  const actualViewportEnd = viewportStartMs + visibleDurationMs
  
  // Find first beat in viewport
  const firstBeat = Math.floor(viewportStartMs / msPerBeat)
  const lastBeat = Math.ceil(actualViewportEnd / msPerBeat)
  
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.2)' // Blue
  ctx.lineWidth = 1
  
  for (let beat = firstBeat; beat <= lastBeat; beat++) {
    const timeMs = beat * msPerBeat
    const x = leftOffset + ((timeMs - viewportStartMs) / 1000) * pixelsPerSecond
    
    if (x < leftOffset || x > width) continue
    
    // Downbeats are brighter
    const isDownbeat = beat % 4 === 0
    ctx.strokeStyle = isDownbeat 
      ? 'rgba(59, 130, 246, 0.4)' 
      : 'rgba(59, 130, 246, 0.15)'
    ctx.lineWidth = isDownbeat ? 2 : 1
    
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
    ctx.stroke()
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const WaveformLayer: React.FC<WaveformLayerProps> = memo(({
  analysisData,
  viewportStartMs,
  viewportEndMs,
  pixelsPerSecond,
  height,
  leftOffset,
  durationMs,
  bpm = 120,
  showBeatGrid = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // 🔧 WAVE 2018.1: Force render trigger after resize
  const [renderTrigger, setRenderTrigger] = useState(0)
  
  // Handle resize
  const updateCanvasSize = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    
    const rect = container.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    
    canvas.width = rect.width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${height}px`
    
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.scale(dpr, dpr)
    }
    
    // 🔧 WAVE 2018.1: Trigger re-render after resize
    setRenderTrigger(prev => prev + 1)
  }, [height])
  
  // Resize observer
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    
    const resizeObserver = new ResizeObserver(() => {
      updateCanvasSize()
    })
    
    resizeObserver.observe(container)
    updateCanvasSize()
    
    return () => resizeObserver.disconnect()
  }, [updateCanvasSize])
  
  // 🔧 WAVE 2018: Force canvas resize when analysisData arrives
  // This fixes the "ghost waveform" bug where canvas has zero dimensions
  // when data arrives before ResizeObserver fires
  const hadDataRef = useRef(false)
  
  useEffect(() => {
    if (analysisData && !hadDataRef.current) {
      // First time data arrives - ensure canvas is sized
      hadDataRef.current = true
      console.log('[WaveformLayer] 🎨 First data arrival - forcing resize')
      updateCanvasSize()
    } else if (!analysisData) {
      hadDataRef.current = false
    }
  }, [analysisData, updateCanvasSize])
  
  // Render waveform
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    // Clear if no data
    if (!analysisData) {
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
      return
    }
    
    // 🔧 WAVE 2018: Skip render if canvas has zero dimensions (wait for resize)
    if (canvas.width === 0 || canvas.height === 0) {
      console.log('[WaveformLayer] ⏸️ Skipping render - canvas not sized yet')
      return
    }
    
    console.log('[WaveformLayer] 🎨 Rendering waveform', {
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      viewportStart: viewportStartMs,
      viewportEnd: viewportEndMs
    })
    
    // Use requestAnimationFrame for smooth rendering
    const rafId = requestAnimationFrame(() => {
      renderWaveform(
        canvas,
        analysisData,
        viewportStartMs,
        viewportEndMs,
        pixelsPerSecond,
        leftOffset,
        durationMs
      )
      
      if (showBeatGrid) {
        renderBeatGrid(
          canvas,
          bpm,
          viewportStartMs,
          viewportEndMs,
          pixelsPerSecond,
          leftOffset
        )
      }
    })
    
    return () => cancelAnimationFrame(rafId)
  }, [
    analysisData,
    viewportStartMs,
    viewportEndMs,
    pixelsPerSecond,
    leftOffset,
    durationMs,
    bpm,
    showBeatGrid,
    renderTrigger, // 🔧 WAVE 2018.1: Re-render when canvas resizes
  ])
  
  return (
    <div 
      ref={containerRef}
      className="waveform-layer"
      style={{ height }}
    >
      <canvas
        ref={canvasRef}
        className="waveform-canvas"
      />
      
      {/* Empty state */}
      {!analysisData && (
        <div className="waveform-empty">
          <span className="empty-icon">🎵</span>
          <span className="empty-text">DROP AUDIO FILE</span>
        </div>
      )}
    </div>
  )
})

WaveformLayer.displayName = 'WaveformLayer'

export default WaveformLayer
