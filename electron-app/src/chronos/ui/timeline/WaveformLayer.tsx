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

import React, { useRef, useEffect, useCallback, memo } from 'react'
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

// 🌊 WAVE 2015: SPECTRAL GRADIENT COLORS
// Creates the neon spectral effect: violet edges → cyan middle → white center
const SPECTRAL_COLORS = {
  edge: '#6d28d9',    // Violeta oscuro (0%, 100%)
  middle: '#06b6d4',  // Cyan neón (30%, 70%)
  center: '#ffffff',  // Blanco puro (50%)
} as const

/**
 * 🌊 WAVE 2015: Create spectral gradient for waveform fill
 */
function createSpectralGradient(
  ctx: CanvasRenderingContext2D,
  height: number,
  intensity: number = 1
): CanvasGradient {
  const centerY = height / 2
  const gradient = ctx.createLinearGradient(0, 0, 0, height)
  
  // Edge opacity scales with intensity
  const edgeOpacity = 0.6 + intensity * 0.3
  const middleOpacity = 0.8 + intensity * 0.2
  
  // Top to center
  gradient.addColorStop(0, `rgba(109, 40, 217, ${edgeOpacity})`)     // Violet edge
  gradient.addColorStop(0.30, `rgba(6, 182, 212, ${middleOpacity})`) // Cyan
  gradient.addColorStop(0.48, `rgba(255, 255, 255, ${0.9 + intensity * 0.1})`) // Near-white
  gradient.addColorStop(0.50, '#ffffff')                              // Pure white center
  gradient.addColorStop(0.52, `rgba(255, 255, 255, ${0.9 + intensity * 0.1})`) // Near-white
  gradient.addColorStop(0.70, `rgba(6, 182, 212, ${middleOpacity})`) // Cyan
  gradient.addColorStop(1, `rgba(109, 40, 217, ${edgeOpacity})`)     // Violet edge
  
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
 * 🌊 WAVE 2015: SPECTRAL WAVEFORM RENDERER
 * Render waveform with neon spectral gradient (violet→cyan→white→cyan→violet)
 * Uses filled continuous path for smooth, professional look
 * 🛡️ WAVE 2005.2: Heavily optimized for large files
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
  
  const { waveform, energyHeatmap } = analysisData
  const { width, height } = canvas
  
  // Clear canvas
  ctx.clearRect(0, 0, width, height)
  
  // 🛡️ Early exit if no data
  if (!waveform.peaks || waveform.peaks.length === 0) return
  
  // Calculate visible range in waveform samples
  const msPerSample = 1000 / waveform.samplesPerSecond
  const startSample = Math.max(0, Math.floor(viewportStartMs / msPerSample))
  const endSample = Math.min(waveform.peaks.length, Math.ceil(viewportEndMs / msPerSample))
  
  // 🛡️ Early exit if nothing to render
  if (startSample >= endSample) return
  
  // Calculate pixels per sample at current zoom
  const visibleWidth = width - leftOffset
  const visibleDurationMs = viewportEndMs - viewportStartMs
  const pixelsPerSample = (visibleWidth / visibleDurationMs) * msPerSample
  
  // 🛡️ Limit max points for performance
  const maxPoints = 800
  const numVisibleSamples = endSample - startSample
  const downsampleFactor = Math.max(1, Math.ceil(numVisibleSamples / maxPoints))
  
  // Center line (for mirror)
  const centerY = height / 2
  const maxAmplitude = centerY * 0.92 // Leave small margin
  
  // Disable anti-aliasing for crisper look
  ctx.imageSmoothingEnabled = false
  
  // 🌊 WAVE 2015: Calculate average energy for spectral intensity
  let totalEnergy = 0
  let energyCount = 0
  for (let i = startSample; i < endSample; i += downsampleFactor * 4) {
    const heatmapIndex = Math.floor((i * msPerSample) / energyHeatmap.resolutionMs)
    totalEnergy += energyHeatmap.energy[heatmapIndex] ?? 0.3
    energyCount++
  }
  const avgEnergy = energyCount > 0 ? totalEnergy / energyCount : 0.5
  
  // 🌊 WAVE 2015: Create spectral gradient
  const spectralGradient = createSpectralGradient(ctx, height, avgEnergy)
  
  // Build waveform path (top half)
  const topPath = new Path2D()
  const bottomPath = new Path2D()
  let isFirst = true
  
  for (let i = startSample; i < endSample; i += downsampleFactor) {
    // Find max RMS in downsampled range
    let avgRms = 0
    let count = 0
    
    const rangeEnd = Math.min(i + downsampleFactor, endSample)
    for (let j = i; j < rangeEnd; j++) {
      avgRms += waveform.rms[j] ?? 0
      count++
    }
    if (count > 0) avgRms /= count
    
    // Calculate position
    const sampleTimeMs = i * msPerSample
    const x = leftOffset + ((sampleTimeMs - viewportStartMs) / 1000) * pixelsPerSecond
    
    // Skip if outside visible area
    if (x < leftOffset - 10 || x > width + 10) continue
    
    // Calculate heights
    const rmsHeight = avgRms * maxAmplitude
    
    // Build continuous path
    if (isFirst) {
      topPath.moveTo(x, centerY - rmsHeight)
      bottomPath.moveTo(x, centerY + rmsHeight)
      isFirst = false
    } else {
      topPath.lineTo(x, centerY - rmsHeight)
      bottomPath.lineTo(x, centerY + rmsHeight)
    }
  }
  
  // Complete the filled shape (close the paths)
  // Top path: trace back along center line
  topPath.lineTo(width, centerY)
  topPath.lineTo(leftOffset, centerY)
  topPath.closePath()
  
  // Bottom path: trace back along center line
  bottomPath.lineTo(width, centerY)
  bottomPath.lineTo(leftOffset, centerY)
  bottomPath.closePath()
  
  // 🌊 WAVE 2015: Fill with spectral gradient
  ctx.fillStyle = spectralGradient
  ctx.fill(topPath)
  ctx.fill(bottomPath)
  
  // 🌊 WAVE 2015: Add subtle stroke for definition
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
  ctx.lineWidth = 0.5
  
  // Stroke only the outer edge (not the center line closure)
  const strokeTopPath = new Path2D()
  const strokeBottomPath = new Path2D()
  isFirst = true
  
  for (let i = startSample; i < endSample; i += downsampleFactor) {
    let avgRms = 0
    let count = 0
    const rangeEnd = Math.min(i + downsampleFactor, endSample)
    for (let j = i; j < rangeEnd; j++) {
      avgRms += waveform.rms[j] ?? 0
      count++
    }
    if (count > 0) avgRms /= count
    
    const sampleTimeMs = i * msPerSample
    const x = leftOffset + ((sampleTimeMs - viewportStartMs) / 1000) * pixelsPerSecond
    if (x < leftOffset - 10 || x > width + 10) continue
    
    const rmsHeight = avgRms * maxAmplitude
    
    if (isFirst) {
      strokeTopPath.moveTo(x, centerY - rmsHeight)
      strokeBottomPath.moveTo(x, centerY + rmsHeight)
      isFirst = false
    } else {
      strokeTopPath.lineTo(x, centerY - rmsHeight)
      strokeBottomPath.lineTo(x, centerY + rmsHeight)
    }
  }
  
  ctx.stroke(strokeTopPath)
  ctx.stroke(strokeBottomPath)
  
  // 🌊 WAVE 2015: Glow center line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(leftOffset, centerY)
  ctx.lineTo(width, centerY)
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
  
  // Find first beat in viewport
  const firstBeat = Math.floor(viewportStartMs / msPerBeat)
  const lastBeat = Math.ceil(viewportEndMs / msPerBeat)
  
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
