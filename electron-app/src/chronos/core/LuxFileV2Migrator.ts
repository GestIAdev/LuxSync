/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔄 LUX FILE V2 → V3 MIGRATOR (OPERATION LAZARUS — B-2)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * One-way adapter that converts a legacy `.lux` V2 payload (identified by
 * `meta.version === "2.0"` and the absence of `$schema`) into a well-formed
 * `LuxFileV3` so the V3 loader can open the vendor's extant show files.
 *
 * The V2 shape (from scenes/*.lux):
 *   {
 *     meta:    { version: "2.0", author, created (epoch ms), modified (epoch ms),
 *                durationMs, name },
 *     audio:   { name, path, bpm, offsetMs, durationMs } | undefined,
 *     timeline:{ clips: V2Clip[], playheadMs, viewportStartMs, pixelsPerSecond },
 *     library: { customEffects, presets }
 *   }
 *
 * V2 clips carry a `trackId` string ("vibe", "fx1", "fx3", …) that was a UI
 * label, not a canonical zone. We group clips by trackId and emit one V3 track
 * per group, targeting 'global' (the V3 wildcard) so routing still reaches all
 * fixtures. The operator can re-target tracks in the UI after migration.
 *
 * The migrated file is returned with an empty `checksum`; the serializer
 * computes the real one on the next save, and the loader permits a missing
 * checksum (LAZARUS B-4).
 *
 * @module chronos/core/LuxFileV2Migrator
 */

import {
  LUX_V3_SCHEMA,
  LUX_DEFAULT_BPM,
  type LuxFileV3,
  type LuxTrackV3,
  type LuxClipV3,
  type LuxMetaV3,
  type LuxAudioV3,
  type LuxClipType,
  type LuxMixBus,
} from './LuxFileV3'
import type { HephAutomationClipV3, HephTrack, HephCurve, HephKeyframe, HephInterpolation } from '../../core/hephaestus/types'
import { generateLuxId } from './LuxFileV3.factories'

// ═══════════════════════════════════════════════════════════════════════════
// V2 TYPE SKETCHES (loose — only what we read)
// ═══════════════════════════════════════════════════════════════════════════

interface V2Meta {
  version?: string
  author?: string
  created?: number
  modified?: number
  durationMs?: number
  name?: string
}

interface V2Audio {
  name?: string
  path?: string
  bpm?: number
  offsetMs?: number
  durationMs?: number
}

interface V2Keyframe {
  offsetMs?: number
  value?: number
  easing?: string
}

interface V2HephKeyframe {
  timeMs?: number
  value?: number
  interpolation?: HephInterpolation
  bezierHandles?: [number, number, number, number]
}

interface V2HephCurve {
  paramId?: string
  valueType?: 'number' | 'color'
  range?: [number, number]
  defaultValue?: number
  keyframes?: V2HephKeyframe[]
  mode?: 'absolute' | 'relative'
}

interface V2HephClip {
  id?: string
  name?: string
  author?: string
  category?: string
  tags?: string[]
  vibeCompat?: string[]
  zones?: string[]
  mixBus?: LuxMixBus
  priority?: number
  durationMs?: number
  effectType?: string
  curves?: Record<string, V2HephCurve>
  staticParams?: Record<string, number | string | boolean>
}

interface V2Clip {
  id?: string
  type?: string
  vibeType?: string
  fxType?: string
  label?: string
  startMs?: number
  endMs?: number
  trackId?: string
  color?: string
  intensity?: number
  fadeInMs?: number
  fadeOutMs?: number
  keyframes?: V2Keyframe[]
  params?: Record<string, unknown>
  selected?: boolean
  locked?: boolean
  hephFilePath?: string
  isHephCustom?: boolean
  hephClip?: V2HephClip
  mixBus?: LuxMixBus
  zones?: string[]
  priority?: number
}

interface V2File {
  meta?: V2Meta
  audio?: V2Audio
  timeline?: { clips?: V2Clip[] }
  library?: unknown
}

// ═══════════════════════════════════════════════════════════════════════════
// DETECTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Returns true if `data` looks like a V2 `.lux` payload: it lacks the V3
 * `$schema` discriminator but carries `meta.version` starting with "2.".
 */
export function looksLikeV2(data: unknown): boolean {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return false
  const d = data as Record<string, unknown>
  if (d.$schema === LUX_V3_SCHEMA) return false
  const meta = d.meta as V2Meta | undefined
  return !!meta && typeof meta.version === 'string' && meta.version.startsWith('2.')
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function toIso(epochMs: number | undefined, fallback: string): string {
  if (typeof epochMs === 'number' && Number.isFinite(epochMs) && epochMs > 0) {
    try {
      return new Date(epochMs).toISOString()
    } catch {
      return fallback
    }
  }
  return fallback
}

function finiteOr(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function easingToInterpolation(easing: string | undefined): HephInterpolation {
  switch (easing) {
    case 'ease-in': return 'bezier'
    case 'ease-out': return 'bezier'
    case 'ease-in-out': return 'bezier'
    case 'linear': return 'linear'
    case 'hold': return 'hold'
    default: return 'linear'
  }
}

function easingBezier(easing: string | undefined): [number, number, number, number] | undefined {
  switch (easing) {
    case 'ease-in': return [0.42, 0, 1, 1]
    case 'ease-out': return [0, 0, 0.58, 1]
    case 'ease-in-out': return [0.42, 0, 0.58, 1]
    default: return undefined
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HEPHCLIP V2 → V3
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Convert a V2 hephClip (curves map) into a V3 HephAutomationClipV3 (tracks[]).
 * If `v2` is null/undefined, synthesize a minimal single-intensity-track clip
 * from the V2 visual keyframes so preset FX clips (core_meltdown, etc.) pass
 * the V3 schema's non-empty-keyframes requirement.
 */
function migrateHephClip(
  v2: V2HephClip | undefined,
  fallbackKeyframes: V2Keyframe[],
  fallbackName: string,
  fallbackDurationMs: number,
  fallbackEffectType: string
): HephAutomationClipV3 {
  const clipId = v2?.id ?? generateLuxId('heph')
  const name = v2?.name ?? fallbackName
  const durationMs = finiteOr(v2?.durationMs, fallbackDurationMs)

  const tracks: HephTrack[] = []

  if (v2?.curves) {
    // V2 already has HephCurve-shaped curves — wrap each in a HephTrack.
    for (const [paramId, curve] of Object.entries(v2.curves)) {
      const keyframes: HephKeyframe[] = (curve.keyframes ?? []).map((kf) => ({
        timeMs: finiteOr(kf.timeMs, 0),
        value: typeof kf.value === 'number' ? kf.value : 0,
        interpolation: kf.interpolation ?? 'linear',
        bezierHandles: kf.bezierHandles,
      }))
      if (keyframes.length === 0) continue
      const hephCurve: HephCurve = {
        paramId: paramId as HephCurve['paramId'],
        valueType: curve.valueType ?? 'number',
        range: curve.range ?? [0, 1],
        defaultValue: typeof curve.defaultValue === 'number' ? curve.defaultValue : 0,
        keyframes,
        mode: curve.mode ?? 'absolute',
      }
      tracks.push({
        id: generateLuxId('htrk'),
        paramId: paramId as HephTrack['paramId'],
        zones: ['all'],
        curve: hephCurve,
      })
    }
  }

  // Fallback: synthesize an intensity track from the V2 visual keyframes.
  if (tracks.length === 0 && fallbackKeyframes.length > 0) {
    const keyframes: HephKeyframe[] = fallbackKeyframes.map((kf) => ({
      timeMs: finiteOr(kf.offsetMs, 0),
      value: typeof kf.value === 'number' ? kf.value : 0,
      interpolation: easingToInterpolation(kf.easing),
      bezierHandles: easingBezier(kf.easing),
    }))
    tracks.push({
      id: generateLuxId('htrk'),
      paramId: 'intensity',
      zones: ['all'],
      curve: {
        paramId: 'intensity',
        valueType: 'number',
        range: [0, 1],
        defaultValue: 0,
        keyframes,
        mode: 'absolute',
      },
    })
  }

  // Absolute last resort: a single hold keyframe so the clip is structurally valid.
  if (tracks.length === 0) {
    tracks.push({
      id: generateLuxId('htrk'),
      paramId: 'intensity',
      zones: ['all'],
      curve: {
        paramId: 'intensity',
        valueType: 'number',
        range: [0, 1],
        defaultValue: 0,
        keyframes: [{ timeMs: 0, value: 0, interpolation: 'hold' }],
        mode: 'absolute',
      },
    })
  }

  // Collect spatialZones as the union of track zones.
  const spatialZones = Array.from(new Set(tracks.flatMap((t) => t.zones)))

  return {
    id: clipId,
    name,
    author: v2?.author ?? 'LuxSync User',
    category: (v2?.category as HephAutomationClipV3['category']) ?? 'physical',
    tags: v2?.tags ?? [],
    vibeCompat: v2?.vibeCompat ?? [],
    spatialZones,
    mixBus: v2?.mixBus ?? 'global',
    priority: finiteOr(v2?.priority, 50),
    durationMs,
    effectType: v2?.effectType ?? fallbackEffectType,
    tracks,
    staticParams: v2?.staticParams ?? {},
    schemaVersion: '3.0',
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CLIP V2 → V3
// ═══════════════════════════════════════════════════════════════════════════

function migrateClip(v2: V2Clip): LuxClipV3 {
  const id = v2.id ?? generateLuxId('clip')
  const type: LuxClipType = v2.type === 'fx' ? 'fx' : 'vibe'
  const startMs = finiteOr(v2.startMs, 0)
  const endMs = finiteOr(v2.endMs, startMs + 1000)
  const durationMs = Math.max(1, endMs - startMs)

  if (type === 'vibe') {
    return {
      id,
      type: 'vibe',
      label: v2.label ?? v2.vibeType ?? 'Vibe',
      startMs,
      endMs,
      color: v2.color ?? '#a855f7',
      locked: !!v2.locked,
      vibeType: v2.vibeType ?? 'idle',
      intensity: typeof v2.intensity === 'number' ? Math.max(0, Math.min(1, v2.intensity)) : 1,
      fadeInMs: finiteOr(v2.fadeInMs, 0),
      fadeOutMs: finiteOr(v2.fadeOutMs, 0),
    }
  }

  // FX clip
  const hephClip = migrateHephClip(
    v2.hephClip,
    v2.keyframes ?? [],
    v2.label ?? v2.fxType ?? 'FX',
    durationMs,
    v2.fxType ?? v2.params?.effectType as string ?? 'heph_custom'
  )

  return {
    id,
    type: 'fx',
    label: v2.label ?? v2.fxType ?? 'FX',
    startMs,
    endMs,
    color: v2.color ?? '#ef4444',
    locked: !!v2.locked,
    hephClip,
    hephFilePath: v2.hephFilePath,
    zones: v2.zones ? [...v2.zones] : undefined,
    priority: typeof v2.priority === 'number' ? v2.priority : undefined,
    mixBus: v2.mixBus ?? hephClip.mixBus,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TRACK GROUPING
// ═══════════════════════════════════════════════════════════════════════════

function groupClipsByTrack(v2Clips: V2Clip[]): LuxTrackV3[] {
  const groups = new Map<string, LuxClipV3[]>()
  const order: string[] = []

  for (const c of v2Clips) {
    const trackId = c.trackId ?? 'global'
    if (!groups.has(trackId)) {
      groups.set(trackId, [])
      order.push(trackId)
    }
    groups.get(trackId)!.push(migrateClip(c))
  }

  let orderIdx = 0
  return order.map((trackId) => {
    const clips = groups.get(trackId) ?? []
    const track: LuxTrackV3 = {
      id: generateLuxId('trk'),
      targetZone: 'global',
      visualLabel: trackId.toUpperCase(),
      color: '#6b7280',
      clips,
      enabled: true,
      solo: false,
      locked: false,
      order: orderIdx++,
      height: 36,
    }
    return track
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN ENTRY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Migrate a V2 `.lux` payload into a valid `LuxFileV3`.
 * Throws on unrecoverable structural problems; returns a file with an empty
 * checksum (the serializer populates it on the next save).
 */
export function migrateV2toV3(data: unknown): LuxFileV3 {
  if (!looksLikeV2(data)) {
    throw new Error('migrateV2toV3: payload is not a recognizable V2 .lux file')
  }
  const v2 = data as V2File
  const meta = v2.meta ?? {}
  const now = new Date().toISOString()

  const luxMeta: LuxMetaV3 = {
    name: meta.name ?? 'Migrated Show',
    author: meta.author ?? 'Unknown',
    createdAt: toIso(meta.created, now),
    modifiedAt: toIso(meta.modified, now),
    durationMs: finiteOr(meta.durationMs, 0),
  }

  let audio: LuxAudioV3 | null = null
  if (v2.audio) {
    const a = v2.audio
    audio = {
      fileName: a.name ?? '',
      relativePath: a.path ?? '',
      durationMs: finiteOr(a.durationMs, luxMeta.durationMs),
      offsetMs: finiteOr(a.offsetMs, 0),
      detectedBpm: finiteOr(a.bpm, LUX_DEFAULT_BPM),
      bpmConfidence: 0,
    }
  }

  const v2Clips = v2.timeline?.clips ?? []
  const tracks = groupClipsByTrack(v2Clips)

  return {
    $schema: LUX_V3_SCHEMA,
    meta: luxMeta,
    audio,
    analysis: null,
    vibeBase: null,
    tracks,
    markers: [],
    safety: null,
    checksum: '',
  }
}
