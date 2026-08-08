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
/**
 * VALKYRIE H-5a: Gradient cache.
 * createLinearGradient + addColorStop allocate a fresh CanvasGradient every
 * call. The spectral gradient depends only on (ctx, height, intensity) and is
 * reconstructed every frame in the render loop — a per-frame allocation that
 * is pure waste. We cache the last gradient and reuse it when the key matches.
 * The vignette gradient (height-only) is cached the same way.
 */
interface GradientCacheEntry {
  ctx: CanvasRenderingContext2D
  height: number
  intensity: number
  gradient: CanvasGradient
}
let _spectralGradientCache: GradientCacheEntry | null = null

function createSpectralGradient(
  ctx: CanvasRenderingContext2D,
  height: number,
  intensity: number = 1
): CanvasGradient {
  // Cache hit — same context, height, and intensity → reuse.
  if (
    _spectralGradientCache &&
    _spectralGradientCache.ctx === ctx &&
    _spectralGradientCache.height === height &&
    _spectralGradientCache.intensity === intensity
  ) {
    return _spectralGradientCache.gradient
  }

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

  _spectralGradientCache = { ctx, height, intensity, gradient }
  return gradient
}

/** Vignette gradient cache (depends only on ctx + height). */
let _vignetteGradientCache: { ctx: CanvasRenderingContext2D; height: number; gradient: CanvasGradient } | null = null
function getVignetteGradient(ctx: CanvasRenderingContext2D, height: number): CanvasGradient {
  if (_vignetteGradientCache && _vignetteGradientCache.ctx === ctx && _vignetteGradientCache.height === height) {
    return _vignetteGradientCache.gradient
  }
  const gradient = ctx.createLinearGradient(0, 0, 0, height)
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0.20)')
  gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0)')
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0.20)')
  _vignetteGradientCache = { ctx, height, gradient }
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
 * 🌊 WAVE 7107-B v2: ARIADNE RIBBON — 3-Layer Tactical Waveform
 * 
 * Layer 0: Energy heatmap background (30% opacity) — a flowing river of color
 *          Deep blue (silence) → cyan (groove) → orange (intense) → fiery red (peak)
 * Layer 1: Aurora waveform bars (mirrored, spectral gradient) — the pulse, restored
 * Layer 2: Transient markers (bright vertical lines with glow) — kicks/drops
 * 
 * The heatmap tells you WHAT the energy is doing (the river).
 * The waveform tells you HOW the audio looks (the pulse).
 * Transients tell you WHEN the hits land (the spikes).
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

  const { waveform, energyHeatmap, transients } = analysisData
  const { width, height } = canvas

  // Clear canvas
  ctx.clearRect(0, 0, width, height)

  // 🛡️ Early exit if no data at all
  if (!waveform?.peaks || waveform.peaks.length === 0) return
  if (!energyHeatmap?.energy || energyHeatmap.energy.length === 0) return

  const visibleWidth = width - leftOffset
  const pixelsPerMs = pixelsPerSecond / 1000
  const visibleDurationMs = visibleWidth / pixelsPerMs
  const actualViewportEnd = viewportStartMs + visibleDurationMs

  // ═══════════════════════════════════════════════════════════════════════
  // LAYER 0: ENERGY HEATMAP BACKGROUND (30% opacity river)
  // WAVE 7108: Phosphor Noir palette — cyberpunk clean ramp, no mud
  //   0.0: #0a0a0f (abyssal blue/black)
  //   0.4: #00e5ff (neon cyan)
  //   0.7: #b388ff (UV purple)
  //   1.0: #ff1744 (neon magenta-red)
  // ═══════════════════════════════════════════════════════════════════════
  const energyToHeatRGB = (e: number): [number, number, number] => {
    const c = Math.min(1, Math.max(0, e))
    if (c < 0.4) {
      // Abyssal → Neon Cyan
      const t = c / 0.4
      return [
        Math.round(10 + t * (0 - 10)),         // 10 → 0
        Math.round(10 + t * (229 - 10)),        // 10 → 229
        Math.round(15 + t * (255 - 15)),        // 15 → 255
      ]
    } else if (c < 0.7) {
      // Neon Cyan → UV Purple
      const t = (c - 0.4) / 0.3
      return [
        Math.round(0 + t * (179 - 0)),          // 0 → 179
        Math.round(229 + t * (136 - 229)),      // 229 → 136
        Math.round(255 + t * (255 - 255)),      // 255 → 255
      ]
    } else {
      // UV Purple → Neon Magenta-Red
      const t = (c - 0.7) / 0.3
      return [
        Math.round(179 + t * (255 - 179)),      // 179 → 255
        Math.round(136 + t * (23 - 136)),       // 136 → 23
        Math.round(255 + t * (68 - 255)),       // 255 → 68
      ]
    }
  }

  const resMs = energyHeatmap.resolutionMs
  const heatStartIdx = Math.max(0, Math.floor(viewportStartMs / resMs))
  const heatEndIdx = Math.min(energyHeatmap.energy.length, Math.ceil(actualViewportEnd / resMs))

  if (heatStartIdx < heatEndIdx) {
    for (let i = heatStartIdx; i < heatEndIdx; i++) {
      const sampleTimeMs = i * resMs
      const x = leftOffset + ((sampleTimeMs - viewportStartMs) / 1000) * pixelsPerSecond
      if (x < leftOffset || x > width) continue

      const energy = energyHeatmap.energy[i] ?? 0
      const [r, g, b] = energyToHeatRGB(energy)

      const stripWidth = Math.max(1, (resMs / 1000) * pixelsPerSecond)
      // 30% opacity — decorative background, not overwhelming
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.30)`
      ctx.fillRect(x, 0, stripWidth, height)
    }

    // Vignette gradient for depth (darker top/bottom edges) — VALKYRIE H-5a: cached
    const vGrad = getVignetteGradient(ctx, height)
    ctx.fillStyle = vGrad
    ctx.fillRect(leftOffset, 0, visibleWidth, height)
  }

  // ═══════════════════════════════════════════════════════════════════════
  // LAYER 1: AURORA WAVEFORM BARS (mirrored, spectral gradient)
  // ═══════════════════════════════════════════════════════════════════════
  const msPerSample = 1000 / waveform.samplesPerSecond
  const startSample = Math.max(0, Math.floor(viewportStartMs / msPerSample))
  const endSample = Math.min(waveform.peaks.length, Math.ceil(actualViewportEnd / msPerSample))

  if (startSample < endSample) {
    const pixelsPerSample = (visibleWidth / visibleDurationMs) * msPerSample
    const maxBars = 200
    const numVisibleSamples = endSample - startSample
    const downsampleFactor = Math.max(1, Math.ceil(numVisibleSamples / maxBars))

    const centerY = height / 2
    const maxAmplitude = centerY * 0.88

    const barWidthBase = pixelsPerSample * downsampleFactor
    const barWidth = Math.max(3, barWidthBase - 1)
    const barGap = Math.max(1, barWidthBase * 0.1)

    ctx.imageSmoothingEnabled = false

    // Aurora spectral gradient for bar fills
    const spectralGradient = createSpectralGradient(ctx, height, 0.7)
    ctx.shadowColor = '#d946ef'
    ctx.shadowBlur = 10

    for (let i = startSample; i < endSample; i += downsampleFactor) {
      let maxRms = 0
      let maxPeak = 0

      const rangeEnd = Math.min(i + downsampleFactor, endSample)
      for (let j = i; j < rangeEnd; j++) {
        const rms = waveform.rms[j] ?? 0
        const peak = waveform.peaks[j] ?? 0
        if (rms > maxRms) maxRms = rms
        if (peak > maxPeak) maxPeak = peak
      }

      const sampleTimeMs = i * msPerSample
      const x = leftOffset + ((sampleTimeMs - viewportStartMs) / 1000) * pixelsPerSecond

      if (x < leftOffset - barWidth || x > width + barWidth) continue

      const peakHeight = maxPeak * maxAmplitude
      const rmsHeight = maxRms * maxAmplitude

      // Energy for this bar's time position
      const heatmapIndex = Math.floor((i * msPerSample) / energyHeatmap.resolutionMs)
      const energy = energyHeatmap.energy[heatmapIndex] ?? 0.3

      // Peak extensions (outer ghost bars, magenta tint)
      if (peakHeight > rmsHeight + 2) {
        ctx.fillStyle = `rgba(139, 92, 246, ${0.3 + energy * 0.2})`
        ctx.fillRect(x, centerY - peakHeight, barWidth - barGap, peakHeight - rmsHeight)
        ctx.fillRect(x, centerY + rmsHeight, barWidth - barGap, peakHeight - rmsHeight)
      }

      // RMS core bars (aurora gradient)
      ctx.fillStyle = spectralGradient
      ctx.fillRect(x, centerY - rmsHeight, barWidth - barGap, rmsHeight)
      ctx.fillRect(x, centerY, barWidth - barGap, rmsHeight)

      // Hot center highlight for high-energy moments
      if (energy > 0.5 && rmsHeight > 5) {
        const highlightHeight = rmsHeight * 0.3
        ctx.fillStyle = `rgba(255, 255, 255, ${0.2 + (energy - 0.5) * 0.6})`
        ctx.fillRect(x, centerY - highlightHeight, barWidth - barGap, highlightHeight * 2)
      }
    }

    // Reset shadow
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0

    // Aurora center line (pink-white, subtle)
    ctx.strokeStyle = 'rgba(244, 114, 182, 0.3)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(leftOffset, centerY)
    ctx.lineTo(width, centerY)
    ctx.stroke()
  }

  // ═══════════════════════════════════════════════════════════════════════
  // LAYER 2: TRANSIENT MARKERS (bright vertical lines with glow)
  // ═══════════════════════════════════════════════════════════════════════
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

    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.restore()
  }
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
