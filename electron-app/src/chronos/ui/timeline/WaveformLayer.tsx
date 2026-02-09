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
// COLOR PALETTE - CYBERPUNK ENERGY HEATMAP
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Energy to color mapping (0-1 energy -> color)
 * Low energy: Deep purple/blue (chill)
 * Medium energy: Cyan (groove)
 * High energy: White/Hot cyan (drop)
 */
function energyToColor(energy: number, bass: number, high: number): string {
  // Normalize inputs
  const e = Math.min(1, Math.max(0, energy))
  const b = Math.min(1, Math.max(0, bass))
  const h = Math.min(1, Math.max(0, high))
  
  // Base hue: 260 (purple) -> 180 (cyan) -> 180 (white) based on energy
  // Saturation: Higher for mid-energy, lower for extremes
  // Lightness: 30% (dark) -> 50% (vibrant) -> 90% (white hot)
  
  let hue: number
  let saturation: number
  let lightness: number
  
  if (e < 0.3) {
    // Low energy: Purple/Blue (chill zone)
    hue = 260 - (e / 0.3) * 40  // 260 -> 220
    saturation = 60 + e * 40    // 60% -> 72%
    lightness = 25 + e * 25     // 25% -> 32%
  } else if (e < 0.7) {
    // Medium energy: Cyan (groove zone)
    const t = (e - 0.3) / 0.4
    hue = 220 - t * 40           // 220 -> 180
    saturation = 72 + t * 18     // 72% -> 90%
    lightness = 32 + t * 20      // 32% -> 52%
  } else {
    // High energy: Hot cyan to white (drop zone)
    const t = (e - 0.7) / 0.3
    hue = 180                    // Stay cyan
    saturation = 90 - t * 40     // 90% -> 50% (whiter)
    lightness = 52 + t * 38      // 52% -> 90% (brighter)
  }
  
  // Bass boost: Shift towards purple/magenta
  if (b > 0.5) {
    const bassInfluence = (b - 0.5) * 0.3
    hue = hue + (280 - hue) * bassInfluence
    saturation = Math.min(100, saturation + bassInfluence * 20)
  }
  
  // High frequency boost: Shift towards white/cyan
  if (h > 0.6) {
    const highInfluence = (h - 0.6) * 0.5
    lightness = Math.min(95, lightness + highInfluence * 30)
    saturation = Math.max(30, saturation - highInfluence * 20)
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
 * Render waveform to canvas with mirror reflection
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
  
  // 🛡️ WAVE 2005.2: Early exit if no data
  if (!waveform.peaks || waveform.peaks.length === 0) return
  
  // Calculate visible range in waveform samples
  const msPerSample = 1000 / waveform.samplesPerSecond
  const startSample = Math.max(0, Math.floor(viewportStartMs / msPerSample))
  const endSample = Math.min(waveform.peaks.length, Math.ceil(viewportEndMs / msPerSample))
  
  // 🛡️ WAVE 2005.2: Early exit if nothing to render
  if (startSample >= endSample) return
  
  // Calculate pixels per sample at current zoom
  const visibleWidth = width - leftOffset
  const visibleDurationMs = viewportEndMs - viewportStartMs
  const pixelsPerSample = (visibleWidth / visibleDurationMs) * msPerSample
  
  // 🛡️ WAVE 2005.2: More aggressive downsampling - limit max bars to ~600 for performance
  const maxBarsOnScreen = 600
  const numVisibleSamples = endSample - startSample
  const minDownsample = Math.ceil(numVisibleSamples / maxBarsOnScreen)
  
  // Determine downsampling factor 
  const minPixelsPerBar = 2
  const pixelBasedDownsample = Math.max(1, Math.floor(minPixelsPerBar / pixelsPerSample))
  const downsampleFactor = Math.max(pixelBasedDownsample, minDownsample)
  
  // Center line (for mirror)
  const centerY = height / 2
  const maxAmplitude = centerY * 0.9 // Leave small margin
  
  // 🛡️ WAVE 2005.2: Disable expensive anti-aliasing for performance
  ctx.imageSmoothingEnabled = false
  
  // Draw waveform bars - OPTIMIZED
  for (let i = startSample; i < endSample; i += downsampleFactor) {
    // Find max peak in downsampled range
    let maxPeak = 0
    let avgRms = 0
    let count = 0
    
    const rangeEnd = Math.min(i + downsampleFactor, endSample)
    for (let j = i; j < rangeEnd; j++) {
      const peak = waveform.peaks[j]
      if (peak > maxPeak) maxPeak = peak
      avgRms += waveform.rms[j]
      count++
    }
    if (count > 0) avgRms /= count
    
    // Get energy data for coloring
    const heatmapIndex = Math.floor((i * msPerSample) / energyHeatmap.resolutionMs)
    const energy = energyHeatmap.energy[heatmapIndex] ?? 0.3
    const bass = energyHeatmap.bass?.[heatmapIndex] ?? 0.3
    const high = energyHeatmap.high?.[heatmapIndex] ?? 0.3
    
    // Calculate bar position
    const sampleTimeMs = i * msPerSample
    const x = leftOffset + ((sampleTimeMs - viewportStartMs) / 1000) * pixelsPerSecond
    const barWidth = Math.max(1, pixelsPerSample * downsampleFactor - 1)
    
    // Skip if outside visible area
    if (x < leftOffset - barWidth || x > width) continue
    
    // Calculate bar heights
    const peakHeight = maxPeak * maxAmplitude
    const rmsHeight = avgRms * maxAmplitude
    
    // 🛡️ WAVE 2005.2: Use cached solid color instead of expensive gradient
    const color = getCachedColor(energy, bass, high)
    
    // Draw RMS (solid inner bar) - top half
    ctx.fillStyle = color
    ctx.fillRect(x, centerY - rmsHeight, barWidth, rmsHeight)
    
    // Draw RMS - bottom half (mirror)
    ctx.fillRect(x, centerY, barWidth, rmsHeight)
    
    // 🛡️ WAVE 2005.2: Only draw peak outline if significant difference (performance)
    if (peakHeight - rmsHeight > 2) {
      ctx.fillStyle = `rgba(255, 255, 255, ${0.08 + energy * 0.1})`
      ctx.fillRect(x, centerY - peakHeight, barWidth, peakHeight - rmsHeight)
      ctx.fillRect(x, centerY + rmsHeight, barWidth, peakHeight - rmsHeight)
    }
  }
  
  // Draw center line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(leftOffset, centerY)
  ctx.lineTo(width, centerY)
  ctx.stroke()
  
  // 🛡️ WAVE 2005.2: REMOVED expensive glow effect loop entirely
  // The color heatmap already provides visual energy feedback
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
