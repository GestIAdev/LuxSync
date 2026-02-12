/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚒️ USE HEPH PREVIEW — WAVE 2030.25: THE HEPHAESTUS LAB
 * Standalone preview engine for Hephaestus clips.
 * 
 * Bypasses TitanOrchestrator entirely.
 * Evaluates curves with REAL CurveEvaluator + scaleToDMX + hslToRgb.
 * Runs its own requestAnimationFrame loop — isolated from the main engine.
 * 
 * ARCHITECTURE:
 *   CurveEvaluator → scaleToDMX/hslToRgb → PreviewFixtureState
 *   No HephaestusRuntime (uses fs/path, Node-only).
 *   No TitanOrchestrator. No HAL. No IPC. Pure renderer math.
 * 
 * @module views/HephaestusView/useHephPreview
 * @version WAVE 2030.25
 */

import { useRef, useState, useCallback, useEffect } from 'react'
import { CurveEvaluator } from '../../../core/hephaestus/CurveEvaluator'
import { scaleToDMX, scaleToDMX16, hslToRgb } from '../../../core/hephaestus/runtime/HephaestusRuntime'
import type { HephAutomationClip, HephParamId } from '../../../core/hephaestus/types'
import type { EffectZone } from '../../../core/effects/types'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Snapshot of a single fixture's resolved state at the current playhead.
 * All values are DMX-ready (0-255) or RGB.
 */
export interface PreviewFixtureState {
  /** Zone identifier for this virtual fixture */
  zone: EffectZone | 'all'
  /** Display label */
  label: string
  /** 0-255 */
  dimmer: number
  /** RGB 0-255 each */
  r: number
  g: number
  b: number
  /** 0-255 */
  pan: number
  panFine: number
  tilt: number
  tiltFine: number
  /** 0-255 */
  white: number
  amber: number
  strobe: number
  zoom: number
  focus: number
}

export interface HephPreviewState {
  /** Current playhead position in ms */
  playheadMs: number
  /** Current normalized progress 0-1 */
  progress: number
  /** Is the preview playing? */
  isPlaying: boolean
  /** Resolved fixture states for this frame */
  fixtures: PreviewFixtureState[]
  /** Frame counter */
  frameCount: number
}

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT ZONES — Virtual fixtures for radar display
// ═══════════════════════════════════════════════════════════════════════════

const MULTI_ZONE_LAYOUT: { zone: EffectZone; label: string; x: number; y: number }[] = [
  { zone: 'front' as EffectZone, label: 'FRONT',  x: 0.5, y: 0.2 },
  { zone: 'back' as EffectZone,  label: 'BACK',   x: 0.5, y: 0.8 },
  { zone: 'left' as EffectZone,  label: 'LEFT',   x: 0.15, y: 0.5 },
  { zone: 'right' as EffectZone, label: 'RIGHT',  x: 0.85, y: 0.5 },
]

// ═══════════════════════════════════════════════════════════════════════════
// EVALUATOR — Pure math, no Runtime dependency
// ═══════════════════════════════════════════════════════════════════════════

function evaluateClipFrame(
  clip: HephAutomationClip,
  evaluator: CurveEvaluator,
  timeMs: number,
): PreviewFixtureState {
  let dimmer = 0
  let r = 0, g = 0, b = 0
  let pan = 128, panFine = 0
  let tilt = 128, tiltFine = 0
  let white = 0, amber = 0, strobe = 0
  let zoom = 128, focus = 128

  for (const [paramId, curve] of clip.curves) {
    if (curve.valueType === 'color') {
      const hsl = evaluator.getColorValue(paramId, timeMs)
      // Apply intensity modulation to lightness (consistent with Runtime)
      const intensityCurve = clip.curves.get('intensity')
      let intensityMod = 1.0
      if (intensityCurve) {
        intensityMod = evaluator.getValue('intensity', timeMs)
      }
      const modulatedL = (hsl.l / 100) * intensityMod
      const rgb = hslToRgb(hsl.h, hsl.s / 100, modulatedL)
      r = rgb.r
      g = rgb.g
      b = rgb.b
      continue
    }

    const raw = evaluator.getValue(paramId, timeMs)

    switch (paramId) {
      case 'intensity':
        dimmer = scaleToDMX('intensity', raw)
        break
      case 'pan': {
        const p16 = scaleToDMX16(raw)
        pan = p16.coarse
        panFine = p16.fine
        break
      }
      case 'tilt': {
        const t16 = scaleToDMX16(raw)
        tilt = t16.coarse
        tiltFine = t16.fine
        break
      }
      case 'white':
        white = scaleToDMX('white', raw)
        break
      case 'amber':
        amber = scaleToDMX('amber', raw)
        break
      case 'strobe':
        strobe = scaleToDMX('strobe', raw)
        break
      case 'zoom':
        zoom = scaleToDMX('zoom', raw)
        break
      case 'focus':
        focus = scaleToDMX('focus', raw)
        break
    }
  }

  return {
    zone: 'all',
    label: 'ALL',
    dimmer, r, g, b,
    pan, panFine, tilt, tiltFine,
    white, amber, strobe, zoom, focus,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════

export function useHephPreview(clip: HephAutomationClip): HephPreviewState & {
  play: () => void
  pause: () => void
  stop: () => void
  seek: (ms: number) => void
} {
  const [state, setState] = useState<HephPreviewState>({
    playheadMs: 0,
    progress: 0,
    isPlaying: false,
    fixtures: [],
    frameCount: 0,
  })

  const rafRef = useRef<number>(0)
  const startRealTimeRef = useRef<number>(0)
  const startClipTimeRef = useRef<number>(0)
  const isPlayingRef = useRef(false)
  const clipRef = useRef(clip)
  const evaluatorRef = useRef<CurveEvaluator | null>(null)

  // Rebuild evaluator when clip curves change
  useEffect(() => {
    clipRef.current = clip
    evaluatorRef.current = new CurveEvaluator(clip.curves, clip.durationMs)
    // Re-evaluate current frame with new curves (live editing feedback)
    if (!isPlayingRef.current) {
      const ev = evaluatorRef.current
      const t = state.playheadMs
      const fixtures = resolveFixtures(clip, ev, t)
      setState(prev => ({ ...prev, fixtures }))
    }
  }, [clip, clip.curves, clip.durationMs])

  /**
   * Resolve fixtures based on clip zones.
   * 1 zone or 'all' → 1 big fixture.
   * Multiple zones → 4 distributed fixtures with slight delay offsets.
   */
  const resolveFixtures = useCallback(
    (c: HephAutomationClip, ev: CurveEvaluator, timeMs: number): PreviewFixtureState[] => {
      if (c.zones.length <= 1 || c.zones.includes('all' as EffectZone)) {
        // Single fixture — center of radar
        const f = evaluateClipFrame(c, ev, timeMs)
        return [f]
      }

      // Multi-zone: evaluate each zone with a tiny phase offset for visual variety
      return MULTI_ZONE_LAYOUT.map((layout, idx) => {
        // Phase offset per zone: 0, 50ms, 100ms, 150ms — shows propagation delay
        const phaseOffset = idx * 50
        const offsetTime = Math.max(0, timeMs - phaseOffset)
        const f = evaluateClipFrame(c, ev, offsetTime)
        return {
          ...f,
          zone: layout.zone,
          label: layout.label,
        }
      })
    },
    [],
  )

  // ── Animation Loop ──
  const tick = useCallback((timestamp: number) => {
    if (!isPlayingRef.current) return

    const elapsed = timestamp - startRealTimeRef.current
    let clipTimeMs = startClipTimeRef.current + elapsed

    // Loop
    if (clipTimeMs >= clipRef.current.durationMs) {
      clipTimeMs = clipTimeMs % clipRef.current.durationMs
      startRealTimeRef.current = timestamp
      startClipTimeRef.current = 0
    }

    const ev = evaluatorRef.current
    if (!ev) return

    const fixtures = resolveFixtures(clipRef.current, ev, clipTimeMs)

    setState(prev => ({
      playheadMs: clipTimeMs,
      progress: clipTimeMs / clipRef.current.durationMs,
      isPlaying: true,
      fixtures,
      frameCount: prev.frameCount + 1,
    }))

    rafRef.current = requestAnimationFrame(tick)
  }, [resolveFixtures])

  // ── Controls ──
  const play = useCallback(() => {
    if (isPlayingRef.current) return
    isPlayingRef.current = true

    // Rebuild evaluator fresh
    evaluatorRef.current = new CurveEvaluator(clipRef.current.curves, clipRef.current.durationMs)
    startRealTimeRef.current = performance.now()
    startClipTimeRef.current = state.playheadMs

    setState(prev => ({ ...prev, isPlaying: true }))
    rafRef.current = requestAnimationFrame(tick)
  }, [tick, state.playheadMs])

  const pause = useCallback(() => {
    isPlayingRef.current = false
    cancelAnimationFrame(rafRef.current)
    setState(prev => ({ ...prev, isPlaying: false }))
  }, [])

  const stop = useCallback(() => {
    isPlayingRef.current = false
    cancelAnimationFrame(rafRef.current)

    const ev = evaluatorRef.current
    const fixtures = ev ? resolveFixtures(clipRef.current, ev, 0) : []

    setState({
      playheadMs: 0,
      progress: 0,
      isPlaying: false,
      fixtures,
      frameCount: 0,
    })
  }, [resolveFixtures])

  const seek = useCallback((ms: number) => {
    const clamped = Math.max(0, Math.min(clipRef.current.durationMs, ms))
    const ev = evaluatorRef.current
    const fixtures = ev ? resolveFixtures(clipRef.current, ev, clamped) : []

    if (isPlayingRef.current) {
      startRealTimeRef.current = performance.now()
      startClipTimeRef.current = clamped
    }

    setState(prev => ({
      ...prev,
      playheadMs: clamped,
      progress: clamped / clipRef.current.durationMs,
      fixtures,
    }))
  }, [resolveFixtures])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current)
      isPlayingRef.current = false
    }
  }, [])

  return { ...state, play, pause, stop, seek }
}
