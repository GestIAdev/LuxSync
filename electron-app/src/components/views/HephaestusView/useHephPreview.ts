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
import { scaleToDMX, scaleToDMX16, hslToRgb } from '../../../core/hephaestus/runtime/HephUtils'
import { PhaseDistributor } from '../../../core/hephaestus/runtime/PhaseDistributor'
import type { HephAutomationClip, HephParamId, PhaseConfig, FixturePhase } from '../../../core/hephaestus/types'
import { DEFAULT_PHASE_CONFIG } from '../../../core/hephaestus/types'
import type { EffectZone } from '../../../core/effects/types'
import type { FixtureV2 } from '../../../core/stage/ShowFileV2'
import { resolveZoneTags } from '../../../core/zones/ZoneMapper'

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
  /** Fixture ID (real fixture from show, or zone-based fallback) */
  fixtureId: string
  /** Display label */
  label: string
  /** Radar X position (0-1 normalized, for horizontal wave layout) */
  radarX: number
  /** Radar Y position (0-1 normalized) */
  radarY: number
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

/**
 * ⚒️ WAVE 2043.10: OPERATION GHOSTBUSTER (Expanded)
 * 
 * Complete zone-to-radar-position mapping.
 * Every zone from SmartZoneSelector gets a meaningful spatial position.
 * 
 * SPATIAL LAYOUT (Radar = top-down stage view):
 * 
 *         0.5
 *     ┌────●────┐  ← FRONT (y=0.2)
 *     │         │
 *  L ●│    ●    │● R    ← CENTER (y=0.5), LEFT (x=0.15), RIGHT (x=0.85)
 *     │         │
 *     └────●────┘  ← BACK (y=0.8)
 *          ●       ← FLOOR (y=0.9)
 *     ●         ●  ← ODD/EVEN (y=0.65)
 *          ●       ← AIR (y=0.1)
 */
const ZONE_RADAR_POSITIONS: Record<string, { label: string; x: number; y: number }> = {
  // ── Target zones ──
  'all-movers':   { label: 'MOV',    x: 0.5,  y: 0.35 },
  'all-pars':     { label: 'PAR',    x: 0.5,  y: 0.65 },
  'air':          { label: 'AIR',    x: 0.5,  y: 0.1  },

  // ── Position zones ──
  'front':        { label: 'FRONT',  x: 0.5,  y: 0.2  },
  'back':         { label: 'BACK',   x: 0.5,  y: 0.8  },
  'floor':        { label: 'FLOOR',  x: 0.5,  y: 0.92 },
  'center':       { label: 'CTR',    x: 0.5,  y: 0.5  },

  // ── Side / Stereo zones ──
  'all-left':     { label: 'LEFT',   x: 0.15, y: 0.5  },
  'all-right':    { label: 'RIGHT',  x: 0.85, y: 0.5  },
  'left':         { label: 'LEFT',   x: 0.15, y: 0.5  },
  'right':        { label: 'RIGHT',  x: 0.85, y: 0.5  },

  // ── Parity zones ──
  'movers-left':  { label: 'ODD',    x: 0.3,  y: 0.65 },
  'movers-right': { label: 'EVEN',   x: 0.7,  y: 0.65 },

  // ── Canonical zones (from ShowFileV2) ──
  'ambient':      { label: 'AMB',    x: 0.5,  y: 0.5  },
  'unassigned':   { label: 'UNASN',  x: 0.5,  y: 0.5  },

  // ── Stereo PARs ──
  'frontL':       { label: 'FRT-L',  x: 0.25, y: 0.2  },
  'frontR':       { label: 'FRT-R',  x: 0.75, y: 0.2  },
  'backL':        { label: 'BCK-L',  x: 0.25, y: 0.8  },
  'backR':        { label: 'BCK-R',  x: 0.75, y: 0.8  },
  'floorL':       { label: 'FLR-L',  x: 0.25, y: 0.92 },
  'floorR':       { label: 'FLR-R',  x: 0.75, y: 0.92 },
}

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
      
      // ⚒️ WAVE 2040.22c: DEFENSIVE GUARDS AGAINST NaN/undefined/null HSL VALUES
      // If any HSL component is invalid, skip color evaluation (use default black)
      if (!hsl || typeof hsl.h !== 'number' || typeof hsl.s !== 'number' || typeof hsl.l !== 'number' ||
          !Number.isFinite(hsl.h) || !Number.isFinite(hsl.s) || !Number.isFinite(hsl.l)) {
        console.warn('[useHephPreview] Invalid HSL from evaluator:', hsl, 'paramId:', paramId)
        continue  // Skip this color curve, leave RGB at 0
      }
      
      // Apply intensity modulation to lightness (consistent with Runtime)
      const intensityCurve = clip.curves.get('intensity')
      let intensityMod = 1.0
      if (intensityCurve) {
        intensityMod = evaluator.getValue('intensity', timeMs)
      }
      const modulatedL = (hsl.l / 100) * intensityMod
      const rgb = hslToRgb(hsl.h, hsl.s / 100, modulatedL)
      
      // ⚒️ WAVE 2040.22c: FINAL NaN GUARD (defense in depth)
      r = Number.isFinite(rgb.r) ? rgb.r : 0
      g = Number.isFinite(rgb.g) ? rgb.g : 0
      b = Number.isFinite(rgb.b) ? rgb.b : 0
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
    zone: 'all' as const,
    fixtureId: 'preview-all',
    label: 'ALL',
    radarX: 0.5,
    radarY: 0.5,
    dimmer, r, g, b,
    pan, panFine, tilt, tiltFine,
    white, amber, strobe, zoom, focus,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════

export function useHephPreview(clip: HephAutomationClip, stageFixtures: FixtureV2[] = []): HephPreviewState & {
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
  const stageFixturesRef = useRef(stageFixtures)
  const evaluatorRef = useRef<CurveEvaluator | null>(null)

  // Keep stageFixtures ref current
  useEffect(() => {
    stageFixturesRef.current = stageFixtures
  }, [stageFixtures])

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
   * Resolve fixtures based on clip zones + REAL show patch + PhaseDistributor.
   * 
   * ⚒️ WAVE 2403.2: OPERATION RADAR AWAKENING
   * Expands zones → real fixture IDs from the show patch.
   * Each fixture gets its own radar dot, horizontally distributed for wave viz.
   * PhaseDistributor receives the REAL fixture IDs (N > 1 per zone).
   * 
   * - 'all' or empty → 1 big fixture (center of radar, no phase)
   * - Specific zones → Lookup real fixtures from stageStore, distribute phase
   * - Fallback: if no stage fixtures loaded, use zone-based single dots
   */
  const resolveFixtures = useCallback(
    (c: HephAutomationClip, ev: CurveEvaluator, timeMs: number): PreviewFixtureState[] => {
      // ── CASE 1: 'all' selected → Single fixture at center ──
      if (c.zones.includes('all' as EffectZone)) {
        const f = evaluateClipFrame(c, ev, timeMs)
        return [f]
      }

      // ── CASE 2: No zones selected → Fallback ──
      if (c.zones.length === 0) {
        const f = evaluateClipFrame(c, ev, timeMs)
        return [f]
      }

      // ── WAVE 2543.4: Zone resolution delegated to ZoneMapper (Single Source of Truth) ──
      const currentStageFixtures = stageFixturesRef.current

      // Build ZoneMappable projections from stage fixtures
      const zoneMappable = currentStageFixtures.map(sf => ({
        id: sf.id,
        zone: sf.zone,
        enabled: sf.enabled,
        position: sf.position ? { x: sf.position.x } : undefined,
      }))

      // Resolve real fixture IDs via centralized ZoneMapper
      const resolvedIds = resolveZoneTags(c.zones.map(String), zoneMappable)
      const resolvedIdSet = new Set(resolvedIds)

      // Build targetPool from resolved IDs, preserving zone info for radar display
      let targetPool: Array<{ id: string; name: string; zone: EffectZone }> = []
      for (const sf of currentStageFixtures) {
        if (resolvedIdSet.has(sf.id)) {
          targetPool.push({ id: sf.id, name: sf.name, zone: sf.zone as EffectZone })
        }
      }

      // If no real fixtures matched, create virtual fallback dots per zone
      if (targetPool.length === 0) {
        for (const zoneId of c.zones) {
          const zoneStr = String(zoneId)
          targetPool.push({ id: `zone-${zoneStr}`, name: zoneStr, zone: zoneId })
        }
      }

      // ── Step 4: If pool is empty, fall back to virtual dots per zone ──
      if (targetPool.length === 0) {
        const f = evaluateClipFrame(c, ev, timeMs)
        return [f]
      }

      const resolvedFixtures = targetPool

      // ── CASE 3: Still only 1 fixture? Skip phase distribution ──
      if (resolvedFixtures.length <= 1) {
        const f = evaluateClipFrame(c, ev, timeMs)
        const pos = ZONE_RADAR_POSITIONS[String(resolvedFixtures[0]?.zone)] ?? { x: 0.5, y: 0.5 }
        return [{
          ...f,
          fixtureId: resolvedFixtures[0]?.id ?? 'solo',
          zone: resolvedFixtures[0]?.zone ?? 'all',
          label: resolvedFixtures[0]?.name?.substring(0, 8).toUpperCase() ?? 'ALL',
          radarX: pos.x,
          radarY: pos.y,
        }]
      }

      // ── WAVE 2403.2: Phase distribution over REAL fixture IDs ──
      const phaseConfig: PhaseConfig = c.selector?.phase ?? DEFAULT_PHASE_CONFIG
      const fixtureIds = resolvedFixtures.map(rf => rf.id)
      const fixturePhases: FixturePhase[] = PhaseDistributor.resolve(
        fixtureIds,
        phaseConfig,
        c.durationMs
      )

      // Build lookup: fixtureId → phaseOffsetMs
      const phaseByFixture = new Map<string, number>()
      for (const fp of fixturePhases) {
        phaseByFixture.set(fp.fixtureId, fp.phaseOffsetMs)
      }

      // ── Build radar layout: horizontal distribution for wave visualization ──
      const totalFixtures = resolvedFixtures.length
      const MARGIN = 0.08  // 8% margin from edges
      const usableWidth = 1 - (MARGIN * 2)

      const fixtures: PreviewFixtureState[] = []

      for (let i = 0; i < totalFixtures; i++) {
        const rf = resolvedFixtures[i]
        const phaseOffset = phaseByFixture.get(rf.id) ?? 0
        const offsetTime = Math.max(0, timeMs + phaseOffset)
        const f = evaluateClipFrame(c, ev, offsetTime)

        // Horizontal distribution: evenly spaced across X axis
        const radarX = totalFixtures === 1
          ? 0.5
          : MARGIN + (i / (totalFixtures - 1)) * usableWidth

        // Vertical: use zone base position for Y, so different zones stack vertically
        const zonePos = ZONE_RADAR_POSITIONS[String(rf.zone)]
        const radarY = zonePos?.y ?? 0.5

        // Label: show short fixture name (max 6 chars) + index
        const shortName = rf.name.length > 6
          ? rf.name.substring(0, 6)
          : rf.name

        fixtures.push({
          ...f,
          fixtureId: rf.id,
          zone: rf.zone,
          label: shortName.toUpperCase(),
          radarX,
          radarY,
        })
      }

      return fixtures
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
