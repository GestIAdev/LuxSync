/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🏭 LUX FILE V3 — FACTORIES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Deterministic constructors for the `.lux` V3 core. No Math.random() — IDs use
 * crypto.randomUUID when available, with a monotonic-counter fallback.
 *
 * Bridges between the two representations:
 *   - toChronosProjectV3(file) → hydrate runtime state (playhead, viewport, bpm)
 *   - toLuxFileV3(project)     → strip runtime state (checksum recomputed by serializer)
 *
 * @module chronos/core/LuxFileV3.factories
 * @version V3.0
 */

import type { HephAutomationClipV3 } from '../../core/hephaestus/types'
import {
  LUX_V3_SCHEMA,
  LUX_DEFAULT_BPM,
  type LuxFileV3,
  type ChronosProjectV3,
  type LuxMetaV3,
  type LuxTrackV3,
  type LuxClipV3,
  type LuxMarkerV3,
  type LuxMarkerType,
  type LuxTargetZone,
  type LuxMixBus,
  type VibeBaseV3,
  type LuxAnalysisV3,
  type LuxHeatmapV3,
  type LuxWaveformV3,
  type LuxSectionV3,
  type LuxTransientV3,
  type LuxTransientType,
} from './LuxFileV3'
import type { AnalysisData, HeatmapData, WaveformData, DetectedSection } from './types'
import type { TimelineClip, VibeClip, FXClip } from './TimelineClip'
import { toVibeType, toFXType, extractVisualKeyframes, getVibeColor, MIXBUS_CLIP_COLORS, HEPH_EMBER_COLOR } from './TimelineClip'

// ═══════════════════════════════════════════════════════════════════════════
// ID GENERATION (deterministic, no Math.random)
// ═══════════════════════════════════════════════════════════════════════════

let _idCounter = 0

/** Generate a stable unique id with the given prefix. */
export function generateLuxId(prefix = 'lux'): string {
  try {
    if (
      typeof crypto !== 'undefined' &&
      typeof (crypto as { randomUUID?: () => string }).randomUUID === 'function'
    ) {
      return `${prefix}_${(crypto as { randomUUID: () => string }).randomUUID()}`
    }
  } catch {
    // fall through
  }
  const now = Date.now().toString(36)
  _idCounter = (_idCounter + 1) % 0xffffff
  return `${prefix}_${now}_${_idCounter.toString(36)}`
}

// ═══════════════════════════════════════════════════════════════════════════
// ZONE COLORS
// ═══════════════════════════════════════════════════════════════════════════

export const TRACK_ZONE_COLORS: Record<string, string> = {
  front: '#ef4444',
  back: '#3b82f6',
  floor: '#22c55e',
  'movers-left': '#f59e0b',
  'movers-right': '#f59e0b',
  center: '#a855f7',
  air: '#06b6d4',
  ambient: '#33ddaa',
  unassigned: '#475569',
  global: '#e2e8f0',
  // ── WAVE 7107-B: Selene Energy Zone colors ──
  peak: '#ff0040',
  intense: '#ff6b2b',
  active: '#f59e0b',
  gentle: '#22d3ee',
  valley: '#6366f1',
  silence: '#1e293b',
}

function zoneColor(zone: LuxTargetZone): string {
  return TRACK_ZONE_COLORS[zone] ?? '#475569'
}

const VIBE_CLIP_COLOR = '#8b5cf6'
const FX_CLIP_COLOR = '#22d3ee'

// ═══════════════════════════════════════════════════════════════════════════
// META
// ═══════════════════════════════════════════════════════════════════════════

function resolveAuthor(): string {
  try {
    return (
      (globalThis as { luxsync?: { getSystemUser?: () => string } }).luxsync?.getSystemUser?.() ??
      ''
    )
  } catch {
    return ''
  }
}

export function createLuxMetaV3(name = 'Untitled Show'): LuxMetaV3 {
  const nowIso = new Date().toISOString()
  return {
    name,
    author: resolveAuthor(),
    createdAt: nowIso,
    modifiedAt: nowIso,
    durationMs: 0,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TRACK
// ═══════════════════════════════════════════════════════════════════════════

export const ZONE_BASE_LABELS: Record<string, string> = {
  front: 'FRONT',
  back: 'BACK',
  floor: 'FLOOR',
  'movers-left': 'MOVERS L',
  'movers-right': 'MOVERS R',
  center: 'CENTER',
  air: 'AIR',
  ambient: 'AMBIENT',
  unassigned: 'UNASSIGNED',
  global: 'GLOBAL',
  // ── WAVE 7107-B: Selene Energy Zone labels ──
  peak: 'PEAK',
  intense: 'INTENSE',
  active: 'ACTIVE',
  gentle: 'GENTLE',
  valley: 'VALLEY',
  silence: 'SILENCE',
}

/**
 * Generate a default visual label. First 'front' → "FRONT", second → "FRONT #2".
 */
export function generateTrackLabelV3(
  targetZone: LuxTargetZone,
  existing: readonly LuxTrackV3[]
): string {
  const base = ZONE_BASE_LABELS[targetZone] ?? String(targetZone).toUpperCase()
  const count = existing.filter((t) => t.targetZone === targetZone).length
  return count === 0 ? base : `${base} #${count + 1}`
}

export function createTrackV3(
  targetZone: LuxTargetZone,
  existing: readonly LuxTrackV3[] = [],
  overrides: Partial<Omit<LuxTrackV3, 'id' | 'targetZone'>> = {}
): LuxTrackV3 {
  return {
    id: generateLuxId('trk'),
    targetZone,
    visualLabel: overrides.visualLabel ?? generateTrackLabelV3(targetZone, existing),
    color: overrides.color ?? zoneColor(targetZone),
    clips: overrides.clips ?? [],
    enabled: overrides.enabled ?? true,
    solo: overrides.solo ?? false,
    locked: overrides.locked ?? false,
    order: overrides.order ?? existing.length,
    height: overrides.height ?? 36,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CLIPS
// ═══════════════════════════════════════════════════════════════════════════

export interface CreateVibeClipOptions {
  vibeType: string
  startMs: number
  endMs: number
  label?: string
  intensity?: number
  color?: string
  fadeInMs?: number
  fadeOutMs?: number
}

export function createVibeClipV3(opts: CreateVibeClipOptions): LuxClipV3 {
  return {
    id: generateLuxId('clip'),
    type: 'vibe',
    label: opts.label ?? opts.vibeType,
    startMs: opts.startMs,
    endMs: opts.endMs,
    color: opts.color ?? VIBE_CLIP_COLOR,
    locked: false,
    vibeType: opts.vibeType,
    intensity: opts.intensity ?? 1,
    fadeInMs: opts.fadeInMs ?? 0,
    fadeOutMs: opts.fadeOutMs ?? 0,
  }
}

export interface CreateFXClipOptions {
  hephClip: HephAutomationClipV3
  startMs: number
  endMs: number
  label?: string
  color?: string
  hephFilePath?: string
  zones?: readonly string[]
  priority?: number
}

export function createFXClipV3(opts: CreateFXClipOptions): LuxClipV3 {
  const heph = opts.hephClip
  return {
    id: generateLuxId('clip'),
    type: 'fx',
    label: opts.label ?? heph.name,
    startMs: opts.startMs,
    endMs: opts.endMs,
    color: opts.color ?? FX_CLIP_COLOR,
    locked: false,
    hephClip: heph,
    hephFilePath: opts.hephFilePath,
    zones: opts.zones ?? heph.spatialZones.map((z) => String(z)),
    priority: opts.priority ?? heph.priority,
    mixBus: heph.mixBus as LuxMixBus,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MARKER
// ═══════════════════════════════════════════════════════════════════════════

export function createMarkerV3(
  timeMs: number,
  type: LuxMarkerType,
  label: string,
  color?: string
): LuxMarkerV3 {
  return { id: generateLuxId('mrk'), timeMs, type, label, color }
}

// ═══════════════════════════════════════════════════════════════════════════
// FILE / PROJECT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create an empty `.lux` V3 file. Checksum is empty — the serializer computes
 * the real one on save.
 */
export function createEmptyLuxFileV3(name = 'Untitled Show'): LuxFileV3 {
  const globalTrack = createTrackV3('global', [], {
    visualLabel: 'GLOBAL',
    locked: true,
    order: 0,
    height: 36,
  })
  return {
    $schema: LUX_V3_SCHEMA,
    meta: createLuxMetaV3(name),
    audio: null,
    analysis: null,
    vibeBase: null,
    tracks: [globalTrack],
    markers: [],
    safety: null,
    checksum: '',
  }
}

/**
 * Hydrate a runtime ChronosProjectV3 from a serialized LuxFileV3.
 * Adds ephemeral edit state with sane defaults.
 */
function luxClipToTimelineClip(clip: LuxClipV3, trackId: string): TimelineClip {
  if (clip.type === 'vibe') {
    const vibeClip: VibeClip = {
      id: clip.id,
      type: 'vibe',
      vibeType: toVibeType(clip.vibeType),
      label: clip.label,
      startMs: clip.startMs,
      endMs: clip.endMs,
      trackId,
      color: clip.color || getVibeColor(clip.vibeType ?? 'idle'),
      intensity: clip.intensity ?? 1,
      fadeInMs: clip.fadeInMs ?? 500,
      fadeOutMs: clip.fadeOutMs ?? 500,
      selected: false,
      locked: clip.locked,
    }
    return vibeClip
  }

  // FX clip
  const hephClip = clip.hephClip
  const resolvedMixBus = hephClip?.mixBus ?? 'htp'
  const color = clip.color || MIXBUS_CLIP_COLORS[resolvedMixBus] || HEPH_EMBER_COLOR
  const durationMs = clip.endMs - clip.startMs
  const fxType = toFXType(
    hephClip?.effectType === 'heph_custom' || hephClip?.effectType === 'heph-automation' || hephClip?.effectType === 'custom'
      ? 'heph-custom'
      : hephClip?.effectType ?? 'heph-custom'
  )

  const fxClip: FXClip = {
    id: clip.id,
    type: 'fx',
    fxType,
    label: clip.label,
    startMs: clip.startMs,
    endMs: clip.endMs,
    trackId,
    color,
    keyframes: extractVisualKeyframes(hephClip, durationMs),
    params: { effectType: hephClip?.effectType ?? 'heph_custom' },
    selected: false,
    locked: clip.locked,
    hephFilePath: clip.hephFilePath,
    isHephCustom: true,
    hephClip,
    zones: clip.zones ? [...clip.zones] : undefined,
    priority: clip.priority,
  }
  return fxClip
}

export function toChronosProjectV3(file: LuxFileV3): ChronosProjectV3 {
  const baseBpm = file.audio?.detectedBpm ?? file.analysis?.detectedBpm ?? LUX_DEFAULT_BPM
  return {
    $schema: file.$schema,
    meta: { ...file.meta },
    audio: file.audio ? { ...file.audio } : null,
    analysis: file.analysis ?? null,
    vibeBase: file.vibeBase ? { ...file.vibeBase } : null,
    tracks: file.tracks.map((t) => ({
      ...t,
      clips: t.clips.map(c => luxClipToTimelineClip(c, t.id)),
    })),
    markers: file.markers.map((m) => ({ ...m })),
    safety: file.safety ? { ...file.safety } : null,
    checksum: file.checksum,
    automationLanes: file.automationLanes ? file.automationLanes.map(l => ({ ...l, points: [...l.points] })) : [],

    // ── ephemeral ──
    playheadMs: 0,
    viewportStartMs: 0,
    pixelsPerSecond: 100,
    runtimeBpm: baseBpm,
    manualBpmOverride: null,
    selectedClipIds: new Set<string>(),
  }
}

/**
 * Strip runtime state from a ChronosProjectV3, producing a LuxFileV3 ready to
 * serialize. Checksum is left as-is — the serializer recomputes it.
 */
function timelineClipToLuxClip(clip: TimelineClip): LuxClipV3 {
  const base = {
    id: clip.id,
    type: clip.type,
    label: clip.label,
    startMs: clip.startMs,
    endMs: clip.endMs,
    color: clip.color,
    locked: clip.locked,
  }

  if (clip.type === 'vibe') {
    return {
      ...base,
      vibeType: clip.vibeType,
      intensity: clip.intensity,
      fadeInMs: clip.fadeInMs,
      fadeOutMs: clip.fadeOutMs,
    }
  }

  // FX clip — strip runtime-only fields, keep V3-canonical fields
  return {
    ...base,
    hephClip: clip.hephClip,
    hephFilePath: clip.hephFilePath,
    zones: clip.zones,
    priority: clip.priority,
    mixBus: clip.hephClip?.mixBus,
  }
}

export function toLuxFileV3(project: ChronosProjectV3): LuxFileV3 {
  return {
    $schema: project.$schema,
    meta: { ...project.meta, modifiedAt: new Date().toISOString() },
    audio: project.audio,
    analysis: project.analysis,
    vibeBase: project.vibeBase,
    tracks: project.tracks.map(t => ({
      ...t,
      clips: t.clips.map(c => timelineClipToLuxClip(c as TimelineClip)),
    })),
    markers: project.markers,
    safety: project.safety,
    automationLanes: project.automationLanes.length > 0 ? project.automationLanes.map(l => ({ ...l, points: [...l.points] })) : undefined,
    checksum: project.checksum,
  }
}

/** Create an empty runtime project. */
export function createEmptyChronosProjectV3(name = 'Untitled Show'): ChronosProjectV3 {
  return toChronosProjectV3(createEmptyLuxFileV3(name))
}

// ═══════════════════════════════════════════════════════════════════════════
// VIBE BASE
// ═══════════════════════════════════════════════════════════════════════════

export function createVibeBaseV3(
  vibeId: string,
  displayName: string,
  overrides: Partial<Omit<VibeBaseV3, 'vibeId' | 'displayName'>> = {}
): VibeBaseV3 {
  return {
    vibeId,
    displayName,
    intensity: overrides.intensity ?? 0.5,
    color: overrides.color ?? '#64748b',
    icon: overrides.icon ?? '🌙',
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ANALYSIS CONVERTER (AnalysisData → LuxAnalysisV3)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Convert a phantom worker's AnalysisData into an embeddable LuxAnalysisV3
 * for persistence in the .lux file. All band arrays are preserved so the
 * TitanEngine can inject real spectral data during playback without re-analysis.
 */
export function analysisDataToLuxAnalysisV3(data: AnalysisData): LuxAnalysisV3 {
  const hm = data.energyHeatmap
  const heatmap: LuxHeatmapV3 = {
    resolutionMs: hm.resolutionMs,
    energy: hm.energy,
    bass: hm.bass,
    high: hm.high,
    flux: hm.flux,
  }
  if (hm.subBass) heatmap.subBass = hm.subBass
  if (hm.bassReal) heatmap.bassReal = hm.bassReal
  if (hm.lowMid) heatmap.lowMid = hm.lowMid
  if (hm.mid) heatmap.mid = hm.mid
  if (hm.highMid) heatmap.highMid = hm.highMid
  if (hm.treble) heatmap.treble = hm.treble
  if (hm.ultraAir) heatmap.ultraAir = hm.ultraAir
  if (hm.spectralCentroid) heatmap.spectralCentroid = hm.spectralCentroid
  if (hm.spectralFlatness) heatmap.spectralFlatness = hm.spectralFlatness
  // GODEAR UNLEASHED Phase 3: pass through semantic enrichment telemetry
  if (hm.saturation) heatmap.saturation = hm.saturation
  if (hm.whiteNoise) heatmap.whiteNoise = hm.whiteNoise
  if (hm.rhythmicVoid) heatmap.rhythmicVoid = hm.rhythmicVoid
  if (hm.rolloff) heatmap.rolloff = hm.rolloff

  const waveform: LuxWaveformV3 = {
    samplesPerSecond: data.waveform.samplesPerSecond,
    peaks: data.waveform.peaks,
    rms: data.waveform.rms,
  }

  const sections: LuxSectionV3[] = data.sections.map((s: DetectedSection) => ({
    startMs: s.startMs,
    endMs: s.endMs,
    label: s.type,
    energy: s.avgEnergy,
  }))

  // GODEAR UNLEASHED Phase 2: prefer 3-band transientEvents when available;
  // fall back to legacy transients (timestamps only) for backwards compat.
  const transients: LuxTransientV3[] = data.transientEvents
    ? data.transientEvents.map((e) => ({
        timeMs: e.timeMs,
        type: e.type as LuxTransientType,
        intensity: e.strength,
      }))
    : normalizeTransients(data.transients)

  const analysis: LuxAnalysisV3 = {
    detectedBpm: data.beatGrid.bpm,
    bpmConfidence: data.beatGrid.confidence,
    firstBeatMs: data.beatGrid.firstBeatMs,
    beatGrid: data.beatGrid.beats ?? [],
    sections,
    transients,
    heatmap,
    waveform,
  }

  // 🌊 WAVE 7563: variable-tempo map. Written only when the analyser actually
  // produced it — an older analysis path leaves these undefined and the file
  // stays byte-identical to a pre-7563 save, which keeps the canonical
  // SHA-256 checksum stable for unchanged projects.
  const bg = data.beatGrid
  if (bg.tempoCurve && bg.tempoCurve.length > 0) {
    analysis.tempoCurve = bg.tempoCurve
    if (bg.tempoCurveResolutionMs !== undefined) {
      analysis.tempoCurveResolutionMs = bg.tempoCurveResolutionMs
    }
  }
  if (bg.downbeats && bg.downbeats.length > 0) analysis.downbeatGrid = bg.downbeats
  if (bg.timeSignature !== undefined) analysis.timeSignature = bg.timeSignature
  if (bg.downbeatConfidence !== undefined) analysis.downbeatConfidence = bg.downbeatConfidence
  if (bg.variableTempo !== undefined) analysis.variableTempo = bg.variableTempo

  return analysis
}

/**
 * Normalize transient data from the phantom worker.
 * The phantom returns either raw timestamps (number[]) or objects with
 * { timeMs, strength }. We map both to LuxTransientV3[].
 */
function normalizeTransients(raw: unknown): LuxTransientV3[] {
  if (!Array.isArray(raw)) return []
  return raw.map((t: unknown): LuxTransientV3 => {
    if (typeof t === 'number') {
      return { timeMs: t, type: 'unknown' as LuxTransientType, intensity: 0.5 }
    }
    if (t !== null && typeof t === 'object') {
      const obj = t as { timeMs?: number; strength?: number; intensity?: number; type?: string }
      return {
        timeMs: typeof obj.timeMs === 'number' ? obj.timeMs : 0,
        type: (obj.type as LuxTransientType) ?? 'unknown',
        intensity: typeof obj.strength === 'number'
          ? obj.strength
          : typeof obj.intensity === 'number'
            ? obj.intensity
            : 0.5,
      }
    }
    return { timeMs: 0, type: 'unknown', intensity: 0 }
  })
}

/**
 * Reconstruct a HeatmapData from a LuxHeatmapV3 for TitanEngine injection.
 * This is the reverse of the heatmap portion of analysisDataToLuxAnalysisV3.
 */
export function luxHeatmapToHeatmapData(hm: LuxHeatmapV3): HeatmapData {
  const result: HeatmapData = {
    resolutionMs: hm.resolutionMs,
    energy: [...hm.energy],
    bass: [...hm.bass],
    high: [...hm.high],
    flux: [...hm.flux],
  }
  if (hm.subBass) result.subBass = [...hm.subBass]
  if (hm.bassReal) result.bassReal = [...hm.bassReal]
  if (hm.lowMid) result.lowMid = [...hm.lowMid]
  if (hm.mid) result.mid = [...hm.mid]
  if (hm.highMid) result.highMid = [...hm.highMid]
  if (hm.treble) result.treble = [...hm.treble]
  if (hm.ultraAir) result.ultraAir = [...hm.ultraAir]
  if (hm.spectralCentroid) result.spectralCentroid = [...hm.spectralCentroid]
  if (hm.spectralFlatness) result.spectralFlatness = [...hm.spectralFlatness]
  // GODEAR UNLEASHED Phase 3: reconstruct semantic enrichment telemetry
  if (hm.saturation) result.saturation = [...hm.saturation]
  if (hm.whiteNoise) result.whiteNoise = [...hm.whiteNoise]
  if (hm.rhythmicVoid) result.rhythmicVoid = [...hm.rhythmicVoid]
  if (hm.rolloff) result.rolloff = [...hm.rolloff]
  return result
}

/**
 * Reconstruct a WaveformData from a LuxWaveformV3 for UI display.
 */
export function luxWaveformToWaveformData(wf: LuxWaveformV3): WaveformData {
  return {
    samplesPerSecond: wf.samplesPerSecond,
    peaks: [...wf.peaks],
    rms: [...wf.rms],
  }
}
