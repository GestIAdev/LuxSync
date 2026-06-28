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
import { scaleToDMX, scaleToDMX16 } from '../../../core/hephaestus/runtime/HephUtils'
import { type PhaseConfigPro, type FixturePhase } from '../../../core/hephaestus/phase/PhaseConfigPro'
import { resolveWithOverrides, type PhaseOverrideMap } from '../../../core/hephaestus/phase/PhaseOverride'
import { buildTrackEvaluators } from '../../../core/hephaestus/HephSharedMath'
import { evaluateFixtureParams } from '../../../core/hephaestus/HephEvaluationKernel'
import type { HephAutomationClipV3, HephTrack } from '../../../core/hephaestus/types'
import type { EffectZone } from '../../../core/effects/types'
import type { FixtureV2 } from '../../../core/stage/ShowFileV2'
import { resolveZoneTags } from '../../../core/zones/ZoneMapper'

const FPS_44_MS = 1000 / 44

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
  /** Desfase temporal real en ms asignado por resolvePro */
  phaseOffsetMs: number
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
  /** Ring buffer of last 60 frames for oscilloscope */
  history: Array<{ timeMs: number; val: number }>
}

/**
 * High-frequency preview data stored in refs (not React state).
 * Consumers read this via previewDataRef.current in their render loops,
 * avoiding 44 React re-renders per second.
 */
export interface HephPreviewData {
  playheadMs: number
  progress: number
  fixtures: PreviewFixtureState[]
  frameCount: number
  history: Array<{ timeMs: number; val: number }>
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

/** Find the first track with a non-trivial phaseConfig. Returns config + overrides. */
function findPhaseConfig(tracks: readonly HephTrack[]): { config: PhaseConfigPro; overrides?: PhaseOverrideMap } | null {
  for (const t of tracks) {
    if (t.phaseConfig && t.phaseConfig.spreadDeg > 0) {
      return { config: t.phaseConfig, overrides: t.phaseOverrides }
    }
  }
  return null
}

/**
 * 🧬 WAVE 7035 + AUDIT P0-B: Evaluate a single fixture's state from its applicable tracks.
 *
 * Delegates to HephEvaluationKernel (single source of truth shared with
 * HephaestusRuntime). The kernel handles track evaluation, intensity
 * modulation, and blend-mode fusion. This function scales the kernel's
 * normalized output to DMX format for the preview UI.
 */
function evaluateFixtureFrame(
  clip: HephAutomationClipV3,
  trackEvaluators: Map<string, CurveEvaluator>,
  applicableTracks: readonly HephTrack[],
  timeMs: number,
): PreviewFixtureState {
  const result = evaluateFixtureParams(clip, trackEvaluators, applicableTracks, timeMs, 1.0)
  const n = result.numeric

  // ── Scale to DMX ──
  const dimmer = scaleToDMX('intensity', n.get('intensity') ?? 0)
  const pan16 = scaleToDMX16(n.get('pan') ?? 0.5)
  const tilt16 = scaleToDMX16(n.get('tilt') ?? 0.5)
  const white = scaleToDMX('white', n.get('white') ?? 0)
  const amber = scaleToDMX('amber', n.get('amber') ?? 0)
  const strobe = scaleToDMX('strobe', n.get('strobe') ?? 0)
  const zoom = scaleToDMX('zoom', n.get('zoom') ?? 0.5)
  const focus = scaleToDMX('focus', n.get('focus') ?? 0.5)

  // ── WAVE 7024: Connect simulationMeta.isStrobe to the strobe channel ──
  const metaStrobe = clip.simulationMeta?.isStrobe && strobe === 0 ? 255 : 0
  const finalStrobe = Math.max(strobe, metaStrobe)

  return {
    zone: 'all' as const,
    fixtureId: 'preview-all',
    label: 'ALL',
    radarX: 0.5,
    radarY: 0.5,
    dimmer, r: result.r, g: result.g, b: result.b,
    pan: pan16.coarse, panFine: pan16.fine,
    tilt: tilt16.coarse, tiltFine: tilt16.fine,
    white, amber, strobe: finalStrobe, zoom, focus,
    phaseOffsetMs: 0,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════

export function useHephPreview(clip: HephAutomationClipV3 | null, stageFixtures: FixtureV2[] = []): HephPreviewState & {
  play: () => void
  pause: () => void
  stop: () => void
  seek: (ms: number) => void
  previewDataRef: React.RefObject<HephPreviewData>
} {
  const [state, setState] = useState<HephPreviewState>({
    playheadMs: 0,
    progress: 0,
    isPlaying: false,
    fixtures: [],
    frameCount: 0,
    history: [],
  })

  // ── High-frequency data ref: updated at 44Hz WITHOUT setState ──
  const previewDataRef = useRef<HephPreviewData>({
    playheadMs: 0,
    progress: 0,
    fixtures: [],
    frameCount: 0,
    history: [],
  })

  const rafRef = useRef<number>(0)
  const startRealTimeRef = useRef<number>(0)
  const startClipTimeRef = useRef<number>(0)
  const isPlayingRef = useRef(false)
  const clipRef = useRef(clip)
  const stageFixturesRef = useRef(stageFixtures)
  const trackEvaluatorsRef = useRef<Map<string, CurveEvaluator> | null>(null)
  const historyBufferRef = useRef<Array<{ timeMs: number; val: number }>>([])
  const lastTickTimeRef = useRef<number>(0)
  const frameCountRef = useRef<number>(0)

  // Keep stageFixtures ref current
  useEffect(() => {
    stageFixturesRef.current = stageFixtures
  }, [stageFixtures])

  // Rebuild per-track evaluators when clip tracks change
  useEffect(() => {
    if (!clip || !clip.tracks) return
    clipRef.current = clip
    trackEvaluatorsRef.current = buildTrackEvaluators(clip.tracks, clip.durationMs)
    // Re-evaluate current frame with new curves (live editing feedback)
    if (!isPlayingRef.current) {
      const evs = trackEvaluatorsRef.current
      const t = state.playheadMs
      const fixtures = resolveFixtures(clip, evs, t)
      previewDataRef.current = { ...previewDataRef.current, fixtures }
      setState(prev => ({ ...prev, fixtures }))
    }
  }, [clip, clip?.tracks, clip?.durationMs])

  /**
   * Resolve fixtures based on clip zones + REAL show patch + phase config.
   * 
   * ⚒️ WAVE 2403.2: OPERATION RADAR AWAKENING
   * Expands zones → real fixture IDs from the show patch.
   * Each fixture gets its own radar dot, horizontally distributed for wave viz.
   * Phase offsets are computed via computeOffsetPro() from PhaseConfigPro.
   * 
   * - 'all' or empty → 1 big fixture (center of radar, no phase)
   * - Specific zones → Lookup real fixtures from stageStore, distribute phase
   * - Fallback: if no stage fixtures loaded, use zone-based single dots
   */
  const resolveFixtures = useCallback(
    (c: HephAutomationClipV3, trackEvaluators: Map<string, CurveEvaluator>, timeMs: number): PreviewFixtureState[] => {
      // ── WAVE 7024-B: Cuarentena Semántica — Exorcismo de Energy Vibe Tags ──
      const FORBIDDEN_ENERGY_TAGS = [
        'silent', 'valley', 'ambient', 'gentle', 'active', 'intense', 'peak',
        'sil', 'val', 'amb', 'gen', 'act', 'int', 'pea',
      ]
      const rawZones = (c.spatialZones || []) as readonly string[]
      const cleanSpatialZones = rawZones.filter(z => !FORBIDDEN_ENERGY_TAGS.includes(z.toLowerCase()))
      const isUniversal = cleanSpatialZones.length === 0 || cleanSpatialZones.includes('all')

      // ── WAVE 7024-B: Prioridad Absoluta de Stage Real ──
      const currentStageFixtures = stageFixturesRef.current
      const hasRealStage = currentStageFixtures && currentStageFixtures.length > 0

      // Build targetPool — stage fixtures always win
      type PoolEntry = { id: string; name: string; zone: EffectZone; position?: { x: number; y: number; z: number } }
      let targetPool: PoolEntry[] = []

      if (isUniversal) {
        // Universal zone: use ALL stage fixtures, or 16 virtual if empty
        if (hasRealStage) {
          for (const sf of currentStageFixtures) {
            targetPool.push({ id: sf.id, name: sf.name, zone: sf.zone as EffectZone, position: sf.position })
          }
        } else {
          for (let i = 0; i < 16; i++) {
            targetPool.push({ id: `preview-virtual-${i}`, name: `V${i}`, zone: 'all' as EffectZone })
          }
        }
      } else {
        // Specific zones: resolve via ZoneMapper
        const zoneMappable = currentStageFixtures.map(sf => ({
          id: sf.id,
          zone: sf.zone,
          enabled: sf.enabled,
          position: sf.position ? { x: sf.position.x } : undefined,
        }))
        const resolvedIds = resolveZoneTags(cleanSpatialZones.map(String), zoneMappable)
        const resolvedIdSet = new Set(resolvedIds)

        for (const sf of currentStageFixtures) {
          if (resolvedIdSet.has(sf.id)) {
            targetPool.push({ id: sf.id, name: sf.name, zone: sf.zone as EffectZone, position: sf.position })
          }
        }

        // If no real fixtures matched, generate 16 virtual fixtures (never return 1)
        if (targetPool.length === 0) {
          for (let i = 0; i < 16; i++) {
            targetPool.push({ id: `preview-virtual-${i}`, name: `V${i}`, zone: 'all' as EffectZone })
          }
        }
      }

      // ── 🧬 WAVE 7035: Per-track zone resolution ──
      // For each track, resolve its zones to determine which fixtures it applies to.
      // This is the WYSIWYG fix: a track targeting 'air' only affects 'air' fixtures.
      const allFixtureIdSet = new Set(targetPool.map(rf => rf.id))
      const trackFixtureSets = new Map<string, Set<string>>()
      const zoneMappable = hasRealStage
        ? currentStageFixtures.map(sf => ({
            id: sf.id, zone: sf.zone, enabled: sf.enabled,
            position: sf.position ? { x: sf.position.x } : undefined,
          }))
        : null

      for (const track of c.tracks) {
        const trackZones = (track.zones || []) as readonly string[]
        const cleanTrackZones = trackZones.filter(z => !FORBIDDEN_ENERGY_TAGS.includes(z.toLowerCase()))
        const isTrackUniversal = cleanTrackZones.length === 0 || cleanTrackZones.includes('all')

        if (isTrackUniversal || !hasRealStage || !zoneMappable) {
          trackFixtureSets.set(track.id, allFixtureIdSet)
        } else {
          const resolvedIds = resolveZoneTags(cleanTrackZones.map(String), zoneMappable)
          trackFixtureSets.set(track.id, new Set(resolvedIds))
        }
      }

      // ── Phase distribution via resolvePro + overrides ──
      const phaseResult = findPhaseConfig(c.tracks)
      const fixtureIds = targetPool.map(rf => rf.id)
      let fixturePhases: FixturePhase[] | null = null
      if (phaseResult) {
        fixturePhases = resolveWithOverrides(fixtureIds, phaseResult.config, phaseResult.overrides, c.durationMs)
      }

      const phaseByFixture = new Map<string, number>()
      if (fixturePhases) {
        for (const fp of fixturePhases) {
          phaseByFixture.set(fp.fixtureId, fp.phaseOffsetMs)
        }
      }

      // ── Build radar layout ──
      const totalFixtures = targetPool.length
      const MARGIN = 0.06
      const usableWidth = 1 - (MARGIN * 2)

      // Compute min/max X for real position normalization
      let minX = Infinity, maxX = -Infinity
      if (hasRealStage) {
        for (const rf of targetPool) {
          if (rf.position && typeof rf.position.x === 'number') {
            minX = Math.min(minX, rf.position.x)
            maxX = Math.max(maxX, rf.position.x)
          }
        }
      }
      const stageWidth = maxX - minX
      const normalizeStageX = (x: number): number => {
        if (stageWidth <= 0.001) return 0.5
        return MARGIN + ((x - minX) / stageWidth) * usableWidth
      }

      const fixtures: PreviewFixtureState[] = []

      for (let i = 0; i < totalFixtures; i++) {
        const rf = targetPool[i]
        const phaseOffset = phaseByFixture.get(rf.id) ?? 0
        const offsetTime = phaseOffset > 0
          ? ((timeMs + phaseOffset) % c.durationMs + c.durationMs) % c.durationMs
          : timeMs

        // 🧬 WAVE 7035: Find applicable tracks for this fixture (per-track zone resolution)
        const applicableTracks = c.tracks.filter(t => {
          const fs = trackFixtureSets.get(t.id)
          return fs && fs.has(rf.id)
        })
        const f = evaluateFixtureFrame(c, trackEvaluators, applicableTracks, offsetTime)

        // Horizontal distribution: real position if available, else linear
        const radarX = hasRealStage && rf.position && typeof rf.position.x === 'number'
          ? normalizeStageX(rf.position.x)
          : totalFixtures === 1
            ? 0.5
            : MARGIN + (i / (totalFixtures - 1 || 1)) * usableWidth

        // Vertical: use zone base position for Y if zone-based, else 0.5
        const zonePos = ZONE_RADAR_POSITIONS[String(rf.zone)]
        const radarY = zonePos?.y ?? 0.5

        // Label: real fixture name, max 6 chars
        const shortName = (rf.name || rf.id || 'FIX').slice(0, 6)

        fixtures.push({
          ...f,
          fixtureId: rf.id,
          zone: rf.zone,
          label: shortName.toUpperCase(),
          radarX,
          radarY,
          phaseOffsetMs: phaseOffset,
        })
      }

      return fixtures
    },
    [],
  )

  // ── Animation Loop (throttled to 44 Hz — WAVE 7035) ──
  const tick = useCallback((timestamp: number) => {
    if (!isPlayingRef.current) return
    const c = clipRef.current
    if (!c) return

    // 🧬 WAVE 7035: Throttle to 44 Hz — skip frames that arrive too soon
    if (timestamp - lastTickTimeRef.current < FPS_44_MS) {
      rafRef.current = requestAnimationFrame(tick)
      return
    }
    lastTickTimeRef.current = timestamp

    const elapsed = timestamp - startRealTimeRef.current
    let clipTimeMs = startClipTimeRef.current + elapsed

    // Loop
    if (clipTimeMs >= c.durationMs) {
      clipTimeMs = clipTimeMs % c.durationMs
      startRealTimeRef.current = timestamp
      startClipTimeRef.current = 0
    }

    const evs = trackEvaluatorsRef.current
    if (!evs) return

    const fixtures = resolveFixtures(c, evs, clipTimeMs)

    // ── WAVE 7024: Ring buffer — push canonical val from fixture 0 ──
    const canonicalVal = fixtures.length > 0 ? fixtures[0].dimmer : 0
    const hist = historyBufferRef.current
    hist.push({ timeMs: clipTimeMs, val: canonicalVal })
    if (hist.length > 60) hist.shift()

    frameCountRef.current++

    // ── P2#3: Update ref only, NO setState — avoid 44 React re-renders/s ──
    previewDataRef.current = {
      playheadMs: clipTimeMs,
      progress: clipTimeMs / c.durationMs,
      fixtures,
      frameCount: frameCountRef.current,
      history: hist,
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [resolveFixtures])

  // ── Controls ──
  const play = useCallback(() => {
    if (isPlayingRef.current) return
    const c = clipRef.current
    if (!c) return
    isPlayingRef.current = true

    // Rebuild per-track evaluators fresh
    trackEvaluatorsRef.current = buildTrackEvaluators(c.tracks, c.durationMs)
    startRealTimeRef.current = performance.now()
    startClipTimeRef.current = state.playheadMs
    lastTickTimeRef.current = 0

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

    const c = clipRef.current
    const evs = trackEvaluatorsRef.current
    const fixtures = (c && evs) ? resolveFixtures(c, evs, 0) : []

    historyBufferRef.current = []
    frameCountRef.current = 0

    previewDataRef.current = {
      playheadMs: 0,
      progress: 0,
      fixtures,
      frameCount: 0,
      history: [],
    }

    setState({
      playheadMs: 0,
      progress: 0,
      isPlaying: false,
      fixtures,
      frameCount: 0,
      history: [],
    })
  }, [resolveFixtures])

  const seek = useCallback((ms: number) => {
    const c = clipRef.current
    if (!c) return
    const clamped = Math.max(0, Math.min(c.durationMs, ms))
    const evs = trackEvaluatorsRef.current
    const fixtures = evs ? resolveFixtures(c, evs, clamped) : []

    if (isPlayingRef.current) {
      startRealTimeRef.current = performance.now()
      startClipTimeRef.current = clamped
    }

    // ── WAVE 7024: Push to history on seek too ──
    const canonicalVal = fixtures.length > 0 ? fixtures[0].dimmer : 0
    const hist = historyBufferRef.current
    hist.push({ timeMs: clamped, val: canonicalVal })
    if (hist.length > 60) hist.shift()

    previewDataRef.current = {
      playheadMs: clamped,
      progress: clamped / c.durationMs,
      fixtures,
      frameCount: frameCountRef.current,
      history: hist,
    }

    setState(prev => ({
      ...prev,
      playheadMs: clamped,
      progress: clamped / c.durationMs,
      fixtures,
      history: [...hist],
    }))
  }, [resolveFixtures])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current)
      isPlayingRef.current = false
    }
  }, [])

  return { ...state, play, pause, stop, seek, previewDataRef }
}
