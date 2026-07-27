/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎛️ WAVE 7120 — USE LIVE CALIBRATION
 * React hook for L3++ Live Calibration Mode via SharedArrayBuffer.
 *
 * Evaluates Hephaestus clip curves at 44Hz and writes normalized [0,1]
 * values directly to the CalibrationSAB. The main process TickEngine reads
 * the SAB and injects intents into NodeArbiter's L3++ layer.
 *
 * Zero-IPC: data flows through SharedArrayBuffer (Aether Glass infrastructure).
 * Zero-allocation: writer reuses pre-allocated entries array.
 *
 * @module views/HephaestusView/useLiveCalibration
 * @version WAVE 7120
 */

import { useRef, useState, useCallback, useEffect } from 'react'
import type { MutableRefObject } from 'react'
import { CurveEvaluator } from '../../../core/hephaestus/CurveEvaluator'
import { buildTrackEvaluators } from '../../../core/hephaestus/HephSharedMath'
import { evaluateFixtureParams } from '../../../core/hephaestus/HephEvaluationKernel'
import { resolveWithOverrides } from '../../../core/hephaestus/phase/PhaseOverride'
import type { HephAutomationClipV3 } from '../../../core/hephaestus/types'
import type { FixtureV2 } from '../../../core/stage/ShowFileV2'
import { resolveZoneTags } from '../../../core/zones/ZoneMapper'
import {
  type CalibrationEntry,
} from '../../../core/aether/glass/CalibrationSAB'
import type { HephPreviewData } from './useHephPreview'

const FPS_44_MS = 1000 / 44

// Channel mapping: PreviewFixtureState DMX params → Aether normalized channel names
// The SAB writer sends normalized [0,1] values. The NodeArbiter L3++ layer
// applies them as INodeIntent.values[channel] = normalizedValue.
const FORBIDDEN_ENERGY_TAGS = ['energy', 'bass', 'mid', 'high', 'energy_impact']

interface UseLiveCalibrationReturn {
  isActive: boolean
  toggle: () => void
  enable: () => void
  disable: () => void
}

export function useLiveCalibration(
  clip: HephAutomationClipV3 | null,
  stageFixtures: FixtureV2[],
  previewDataRef: MutableRefObject<HephPreviewData>,
  isPlaying: boolean,
): UseLiveCalibrationReturn {
  const [isActive, setIsActive] = useState(false)
  const isActiveRef = useRef(false)
  const writeCalibrationFnRef = useRef<((entries: ReadonlyArray<CalibrationEntry>) => void) | null>(null)
  const rafRef = useRef<number>(0)
  const lastTickTimeRef = useRef<number>(0)
  const clipRef = useRef(clip)
  const stageFixturesRef = useRef(stageFixtures)
  const isPlayingRef = useRef(isPlaying)
  const previewDataRefRef = useRef(previewDataRef)
  const trackEvaluatorsRef = useRef<Map<string, CurveEvaluator> | null>(null)
  const entriesRef = useRef<CalibrationEntry[]>([])

  // Keep refs current
  useEffect(() => { clipRef.current = clip }, [clip])
  useEffect(() => { stageFixturesRef.current = stageFixtures }, [stageFixtures])
  useEffect(() => { isPlayingRef.current = isPlaying }, [isPlaying])
  useEffect(() => { previewDataRefRef.current = previewDataRef }, [previewDataRef])

  // Rebuild evaluators when clip changes
  useEffect(() => {
    if (!clip || !clip.tracks) return
    trackEvaluatorsRef.current = buildTrackEvaluators(clip.tracks, clip.durationMs)
  }, [clip, clip?.tracks, clip?.durationMs])

  const calibrationTick = useCallback((timestamp: number) => {
    if (!isActiveRef.current) return
    const c = clipRef.current
    if (!c) return

    if (timestamp - lastTickTimeRef.current < FPS_44_MS) {
      rafRef.current = requestAnimationFrame(calibrationTick)
      return
    }
    lastTickTimeRef.current = timestamp

    const evs = trackEvaluatorsRef.current
    if (!evs) {
      rafRef.current = requestAnimationFrame(calibrationTick)
      return
    }

    const writeCalibration = writeCalibrationFnRef.current
    if (!writeCalibration) {
      rafRef.current = requestAnimationFrame(calibrationTick)
      return
    }

    // Read playhead directly from the preview's high-frequency ref (44Hz)
    // This is the SAME time source as the UI preview — zero desync
    const timeMs = previewDataRefRef.current.current.playheadMs

    // If the preview is not playing, freeze calibration output (fixtures hold last position)
    // but keep the RAF alive so when play resumes, calibration resumes instantly
    if (!isPlayingRef.current) {
      rafRef.current = requestAnimationFrame(calibrationTick)
      return
    }

    // Resolve target fixtures from stage
    const stageFixtures = stageFixturesRef.current
    const hasRealStage = stageFixtures.length > 0

    // Build target pool
    const targetPool: Array<{ id: string; zone: string }> = []
    if (hasRealStage) {
      for (const sf of stageFixtures) {
        targetPool.push({ id: sf.id, zone: sf.zone })
      }
    } else {
      // No real fixtures — nothing to calibrate
      rafRef.current = requestAnimationFrame(calibrationTick)
      return
    }

    // Per-track zone resolution
    const allFixtureIdSet = new Set(targetPool.map(rf => rf.id))
    const trackFixtureSets = new Map<string, Set<string>>()
    const zoneMappable = stageFixtures.map(sf => ({
      id: sf.id,
      zone: sf.zone,
      enabled: sf.enabled,
      position: sf.position ? { x: sf.position.x } : undefined,
    }))

    for (const track of c.tracks) {
      const trackZones = (track.zones || []) as readonly string[]
      const cleanTrackZones = trackZones.filter(z => !FORBIDDEN_ENERGY_TAGS.includes(z.toLowerCase()))
      const isTrackUniversal = cleanTrackZones.length === 0 || cleanTrackZones.includes('all')

      if (isTrackUniversal) {
        trackFixtureSets.set(track.id, allFixtureIdSet)
      } else {
        const resolvedIds = resolveZoneTags(cleanTrackZones.map(String), zoneMappable)
        trackFixtureSets.set(track.id, new Set(resolvedIds))
      }
    }

    // Per-track phase offsets
    // Apply when spreadDeg > 0 (algorithmic) OR when manual overrides exist
    const fixtureIds = targetPool.map(rf => rf.id)
    const trackPhaseByFixture = new Map<string, Map<string, number>>()
    for (const track of c.tracks) {
      const hasOverrides = track.phaseOverrides && Object.keys(track.phaseOverrides).length > 0
      if (track.phaseConfig && (track.phaseConfig.spreadDeg > 0 || hasOverrides)) {
        const phases = resolveWithOverrides(fixtureIds, track.phaseConfig, track.phaseOverrides, c.durationMs)
        const m = new Map<string, number>()
        for (const fp of phases) {
          m.set(fp.fixtureId, fp.phaseOffsetMs)
        }
        trackPhaseByFixture.set(track.id, m)
      }
    }

    // Build calibration entries
    const entries = entriesRef.current
    entries.length = 0

    for (const rf of targetPool) {
      const applicableTracks = c.tracks.filter(t => {
        const fs = trackFixtureSets.get(t.id)
        return fs && fs.has(rf.id)
      })

      if (applicableTracks.length === 0) continue

      // Per-track time with phase offset (always wrap to durationMs)
      const perTrackTimeMs = new Map<string, number>()
      for (const track of applicableTracks) {
        const phaseMap = trackPhaseByFixture.get(track.id)
        const phaseOffset = phaseMap?.get(rf.id) ?? 0
        const offsetTime = ((timeMs + phaseOffset) % c.durationMs + c.durationMs) % c.durationMs
        perTrackTimeMs.set(track.id, offsetTime)
      }

      const wrappedTime = ((timeMs % c.durationMs) + c.durationMs) % c.durationMs
      const result = evaluateFixtureParams(c, evs, applicableTracks, wrappedTime, 1.0, perTrackTimeMs)
      const n = result.numeric

      // Build channel list with normalized [0,1] values
      const channels: Array<{ channel: string; value: number }> = []

      // Intensity / dimmer
      const intensity = n.get('intensity') ?? 0
      if (intensity > 0 || n.has('intensity')) {
        channels.push({ channel: 'dimmer', value: Math.max(0, Math.min(1, intensity)) })
      }

      // Color (normalized 0-1)
      channels.push({ channel: 'r', value: Math.max(0, Math.min(1, result.r / 255)) })
      channels.push({ channel: 'g', value: Math.max(0, Math.min(1, result.g / 255)) })
      channels.push({ channel: 'b', value: Math.max(0, Math.min(1, result.b / 255)) })

      // Pan / tilt (already 0-1 from kernel)
      const pan = n.get('pan')
      if (pan !== undefined) channels.push({ channel: 'pan', value: Math.max(0, Math.min(1, pan)) })
      const tilt = n.get('tilt')
      if (tilt !== undefined) channels.push({ channel: 'tilt', value: Math.max(0, Math.min(1, tilt)) })

      // Other channels
      const white = n.get('white')
      if (white !== undefined) channels.push({ channel: 'white', value: Math.max(0, Math.min(1, white)) })
      const amber = n.get('amber')
      if (amber !== undefined) channels.push({ channel: 'amber', value: Math.max(0, Math.min(1, amber)) })
      const strobe = n.get('strobe')
      if (strobe !== undefined) channels.push({ channel: 'strobe', value: Math.max(0, Math.min(1, strobe)) })
      const zoom = n.get('zoom')
      if (zoom !== undefined) channels.push({ channel: 'zoom', value: Math.max(0, Math.min(1, zoom)) })
      const focus = n.get('focus')
      if (focus !== undefined) channels.push({ channel: 'focus', value: Math.max(0, Math.min(1, focus)) })
      const iris = n.get('iris')
      if (iris !== undefined) channels.push({ channel: 'iris', value: Math.max(0, Math.min(1, iris)) })
      const gobo1 = n.get('gobo1')
      if (gobo1 !== undefined) channels.push({ channel: 'gobo', value: Math.max(0, Math.min(1, gobo1)) })
      const gobo2 = n.get('gobo2')
      if (gobo2 !== undefined) channels.push({ channel: 'gobo_rotation', value: Math.max(0, Math.min(1, gobo2)) })
      const prism = n.get('prism')
      if (prism !== undefined) channels.push({ channel: 'prism', value: Math.max(0, Math.min(1, prism)) })
      const speed = n.get('speed')
      if (speed !== undefined) channels.push({ channel: 'speed', value: Math.max(0, Math.min(1, speed)) })

      // NodeId format: fixtureId:family
      // Calibration targets the main node families that the fixture has.
      // We emit one entry per family that has values.
      // For simplicity and effectiveness, we target the most common families:
      // :impact (dimmer), :color (rgb), :kinetic (pan/tilt), :beam (zoom/focus)
      if (channels.length === 0) continue

      // Split channels by family for proper node targeting
      // strobe belongs to IMPACT family (same as dimmer) per HephaestusAetherAdapter._paramFamily
      const impactChannels = channels.filter(ch => ch.channel === 'dimmer' || ch.channel === 'strobe')
      // Add shutter=1.0 when strobe > 0 to open mechanical shutter
      const strobeVal = n.get('strobe')
      if (strobeVal !== undefined && strobeVal > 0) {
        impactChannels.push({ channel: 'shutter', value: 1.0 })
      }
      // white/amber belong to COLOR family per _paramFamily
      const colorChannels = channels.filter(ch => ch.channel === 'r' || ch.channel === 'g' || ch.channel === 'b' || ch.channel === 'white' || ch.channel === 'amber')
      const kineticChannels = channels.filter(ch => ch.channel === 'pan' || ch.channel === 'tilt' || ch.channel === 'speed')
      const beamChannels = channels.filter(ch => ch.channel === 'zoom' || ch.channel === 'focus' || ch.channel === 'iris' || ch.channel === 'gobo' || ch.channel === 'gobo_rotation' || ch.channel === 'prism')

      if (impactChannels.length > 0) {
        entries.push({ nodeId: `${rf.id}:impact`, channels: impactChannels })
      }
      if (colorChannels.length > 0) {
        entries.push({ nodeId: `${rf.id}:color`, channels: colorChannels })
      }
      if (kineticChannels.length > 0) {
        entries.push({ nodeId: `${rf.id}:kinetic`, channels: kineticChannels })
      }
      if (beamChannels.length > 0) {
        entries.push({ nodeId: `${rf.id}:beam`, channels: beamChannels })
      }
    }

    // Write to SAB via preload bridge
    writeCalibration(entries)

    rafRef.current = requestAnimationFrame(calibrationTick)
  }, [])

  const enable = useCallback(async () => {
    if (isActiveRef.current) return

    // Initialize calibration SAB via preload (SAB lives in preload, never crosses contextBridge)
    const initCalibration = window.luxsync?.initCalibration
    const writeCalibration = window.luxsync?.writeCalibration
    if (!initCalibration || !writeCalibration) {
      const keys = window.luxsync ? Object.keys(window.luxsync) : 'window.luxsync is undefined'
      console.warn('[useLiveCalibration] No IPC bridge — initCalibration/writeCalibration not on window.luxsync. Available keys:', keys)
      return
    }

    initCalibration()
    writeCalibrationFnRef.current = writeCalibration
    isActiveRef.current = true
    setIsActive(true)
    lastTickTimeRef.current = 0
    rafRef.current = requestAnimationFrame(calibrationTick)
    console.log('[useLiveCalibration] 🎛️ LIVE CALIBRATION ON — SAB writer active')
  }, [calibrationTick])

  const disable = useCallback(() => {
    if (!isActiveRef.current) return

    isActiveRef.current = false
    setIsActive(false)

    // Cancel rAF
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }

    // Clear calibration SAB via preload bridge
    if (window.luxsync?.clearCalibration) {
      window.luxsync.clearCalibration()
    }
    writeCalibrationFnRef.current = null

    // Notify main process
    if (window.luxsync?.disableCalibration) {
      window.luxsync.disableCalibration().catch(() => {})
    }

    console.log('[useLiveCalibration] 🎛️ LIVE CALIBRATION OFF — SAB cleared')
  }, [])

  const toggle = useCallback(() => {
    if (isActiveRef.current) {
      disable()
    } else {
      enable()
    }
  }, [enable, disable])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isActiveRef.current) {
        disable()
      }
    }
  }, [disable])

  return { isActive, toggle, enable, disable }
}
