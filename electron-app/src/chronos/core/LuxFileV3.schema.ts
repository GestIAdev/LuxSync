/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛡️ LUX FILE V3 — RUNTIME VALIDATION & TYPE GUARDS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Strict, defensive validation for `.lux` V3 payloads coming from disk or IPC.
 * No legacy V2 tolerance: anything that isn't a well-formed V3 file is rejected.
 *
 * Returns structured results (errors + warnings) instead of throwing, so the
 * loader can decide policy.
 *
 * @module chronos/core/LuxFileV3.schema
 * @version V3.0
 */

import { CANONICAL_ZONES } from '../../core/stage/ShowFileV2'
import {
  LUX_V3_SCHEMA,
  type LuxFileV3,
  type LuxClipV3,
  type LuxTrackV3,
  type LuxTargetZone,
  type LuxMixBus,
  type LuxClipType,
} from './LuxFileV3'
import { looksLikeV2 } from './LuxFileV2Migrator'

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION RESULT
// ═══════════════════════════════════════════════════════════════════════════

export interface LuxValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

const ENERGY_ZONES: readonly string[] = [
  'silence',
  'valley',
  'ambient',
  'gentle',
  'active',
  'intense',
  'peak',
]

const VALID_TARGET_ZONES: ReadonlySet<string> = new Set<string>([
  ...CANONICAL_ZONES,
  'global',
  ...ENERGY_ZONES,
])

const VALID_MIX_BUSES: ReadonlySet<string> = new Set<LuxMixBus>([
  'global',
  'htp',
  'ambient',
  'accent',
])

const VALID_CLIP_TYPES: ReadonlySet<string> = new Set<LuxClipType>([
  'vibe',
  'fx',
])

// ═══════════════════════════════════════════════════════════════════════════
// PRIMITIVE GUARDS
// ═══════════════════════════════════════════════════════════════════════════

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0
}

// ═══════════════════════════════════════════════════════════════════════════
// CLIP VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

function validateClip(
  clip: unknown,
  path: string,
  errors: string[],
  warnings: string[]
): void {
  if (!isObject(clip)) {
    errors.push(`${path}: clip is not an object`)
    return
  }

  if (!isNonEmptyString(clip.id)) errors.push(`${path}: missing/invalid id`)
  if (!VALID_CLIP_TYPES.has(clip.type as string)) {
    errors.push(`${path}: invalid type '${String(clip.type)}'`)
  }
  if (typeof clip.label !== 'string') warnings.push(`${path}: missing label`)

  if (!isFiniteNumber(clip.startMs)) errors.push(`${path}: invalid startMs`)
  if (!isFiniteNumber(clip.endMs)) errors.push(`${path}: invalid endMs`)

  if (isFiniteNumber(clip.startMs) && isFiniteNumber(clip.endMs)) {
    if (clip.startMs < 0) errors.push(`${path}: negative startMs (${clip.startMs})`)
    if (clip.startMs >= clip.endMs) {
      errors.push(`${path}: startMs (${clip.startMs}) >= endMs (${clip.endMs})`)
    }
  }

  // ── Type-specific ──
  if (clip.type === 'fx') {
    if (!isObject(clip.hephClip)) {
      errors.push(`${path}: FX clip missing embedded hephClip`)
    } else {
      const heph = clip.hephClip
      if (heph.schemaVersion !== '3.0') {
        errors.push(
          `${path}: hephClip.schemaVersion must be '3.0' (got '${String(heph.schemaVersion)}')`
        )
      }
      if (!Array.isArray(heph.tracks) || heph.tracks.length === 0) {
        errors.push(`${path}: hephClip has 0 tracks (empty automation)`)
      }
      if (!isNonEmptyString(heph.mixBus as string)) {
        warnings.push(`${path}: hephClip missing mixBus routing`)
      }
      // P2.4 FIX: Deep-validate hephClip internal structures.
      // Each track must have a curve with a non-empty keyframes array.
      if (Array.isArray(heph.tracks)) {
        heph.tracks.forEach((track: unknown, ti: number) => {
          const tpath = `${path}.hephClip.tracks[${ti}]`
          if (!isObject(track)) {
            errors.push(`${tpath}: track is not an object`)
            return
          }
          if (!isNonEmptyString(track.paramId as string)) {
            warnings.push(`${tpath}: missing paramId`)
          }
          if (!isObject(track.curve)) {
            errors.push(`${tpath}: missing curve object`)
            return
          }
          const curve = track.curve as Record<string, unknown>
          // P2.4 FIX: keyframes array must exist and be non-empty
          if (!Array.isArray(curve.keyframes) || curve.keyframes.length === 0) {
            errors.push(`${tpath}: curve.keyframes is empty or missing (no automation points)`)
          } else {
            // Validate each keyframe has required fields
            curve.keyframes.forEach((kf: unknown, ki: number) => {
              const kfPath = `${tpath}.curve.keyframes[${ki}]`
              if (!isObject(kf)) {
                errors.push(`${kfPath}: keyframe is not an object`)
                return
              }
              if (!isFiniteNumber(kf.timeMs)) {
                errors.push(`${kfPath}: missing/invalid timeMs`)
              }
              if (kf.value === undefined || kf.value === null) {
                errors.push(`${kfPath}: missing value`)
              }
            })
          }
        })
      }
    }
    if (clip.mixBus !== undefined && !VALID_MIX_BUSES.has(clip.mixBus as string)) {
      errors.push(`${path}: invalid mixBus '${String(clip.mixBus)}'`)
    }
  }

  if (clip.type === 'vibe') {
    if (!isNonEmptyString(clip.vibeType)) {
      warnings.push(`${path}: vibe clip missing vibeType`)
    }
    // P2.5 FIX: Intensity bounds check — must be 0 <= value <= 1
    if (clip.intensity !== undefined) {
      if (!isFiniteNumber(clip.intensity)) {
        errors.push(`${path}: intensity is not a finite number (got '${String(clip.intensity)}')`)
      } else if (clip.intensity < 0 || clip.intensity > 1) {
        errors.push(`${path}: intensity out of bounds [0,1] (got ${clip.intensity})`)
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TRACK VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

function validateTrack(
  track: unknown,
  index: number,
  errors: string[],
  warnings: string[]
): void {
  const path = `tracks[${index}]`
  if (!isObject(track)) {
    errors.push(`${path}: track is not an object`)
    return
  }

  if (!isNonEmptyString(track.id)) errors.push(`${path}: missing/invalid id`)

  if (!VALID_TARGET_ZONES.has(track.targetZone as string)) {
    errors.push(`${path}: invalid targetZone '${String(track.targetZone)}'`)
  }

  if (typeof track.visualLabel !== 'string') {
    warnings.push(`${path}: missing visualLabel`)
  }
  if (typeof track.enabled !== 'boolean') {
    warnings.push(`${path}: missing enabled flag`)
  }

  if (!Array.isArray(track.clips)) {
    errors.push(`${path}: clips is not an array`)
    return
  }

  track.clips.forEach((clip, ci) => {
    validateClip(clip, `${path}.clips[${ci}]`, errors, warnings)
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// FILE VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Validate an unknown payload as a LuxFileV3.
 * Does NOT verify the checksum — use verifyLuxChecksum() for that.
 */
export function validateLuxFileV3(data: unknown): LuxValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!isObject(data)) {
    return { valid: false, errors: ['Payload is not an object'], warnings }
  }

  // Schema discriminator — HARD GATE for unknown formats.
  // LAZARUS B-2 FIX: legacy V2 files (no $schema, meta.version starts with "2.")
  //   are routed through migrateV2toV3 by the deserializer BEFORE this validator
  //   runs, so by the time we get here a missing $schema means the file is
  //   neither V3 nor a recognizable V2 — reject it.
  if (data.$schema !== LUX_V3_SCHEMA) {
    // Defensive: if a V2 file slipped past the deserializer's migration hook,
    // surface a clear error rather than a cryptic deep-validation cascade.
    if (looksLikeV2(data)) {
      errors.push(
        'Legacy V2 file was not migrated before validation (caller bug). ' +
        'Run migrateV2toV3() before validateLuxFileV3().'
      )
    } else {
      errors.push(
        `Invalid $schema: expected '${LUX_V3_SCHEMA}', got '${String(data.$schema)}'`
      )
    }
    return { valid: false, errors, warnings }
  }

  // Meta
  if (!isObject(data.meta)) {
    errors.push('Missing meta')
  } else {
    if (!isNonEmptyString(data.meta.name)) errors.push('Missing meta.name')
    if (!isFiniteNumber(data.meta.durationMs)) {
      errors.push('Invalid meta.durationMs')
    }
  }

  // Audio (nullable)
  if (data.audio !== null && data.audio !== undefined) {
    if (!isObject(data.audio)) {
      errors.push('audio must be an object or null')
    } else {
      if (!isNonEmptyString(data.audio.fileName)) {
        warnings.push('audio missing fileName')
      }
      if (!isFiniteNumber(data.audio.detectedBpm)) {
        warnings.push('audio missing detectedBpm')
      }
    }
  }

  // Tracks
  if (!Array.isArray(data.tracks)) {
    errors.push('tracks is not an array')
  } else {
    data.tracks.forEach((t, i) => validateTrack(t, i, errors, warnings))

    // P2.2 + P2.3 FIX: Cross-clip validation — ID uniqueness and temporal overlap.
    // This pass runs AFTER per-clip validation so we only check structurally valid clips.
    //
    // LAZARUS B-1 FIX: The overlap check is now partitioned by clip.type.
    // A `vibe` clip and an `fx` clip ARE allowed to overlap on the same track —
    // that is the canonical usage pattern (an FX accent layered over a sustained
    // base vibe). Only two clips of the SAME type overlapping on the same track
    // is a structural error. The previous type-blind check rejected the vendor's
    // own fixture (Vibe 0–10000 + FX 4000–6000) as corrupt, breaking save/load.
    const seenClipIds = new Set<string>()

    for (let ti = 0; ti < data.tracks.length; ti++) {
      const track = data.tracks[ti] as Record<string, unknown>
      if (!isObject(track) || !Array.isArray(track.clips)) continue

      const trackId = (track.id as string) ?? `track-${ti}`
      // Per-type range buckets so cross-type layering is permitted.
      const rangesByType = new Map<string, Array<[number, number]>>()

      for (let ci = 0; ci < track.clips.length; ci++) {
        const clip = track.clips[ci] as Record<string, unknown>
        if (!isObject(clip)) continue

        // P2.2: Check clip ID uniqueness
        if (isNonEmptyString(clip.id)) {
          if (seenClipIds.has(clip.id)) {
            errors.push(`Duplicate clip id '${clip.id}' (tracks[${ti}].clips[${ci}])`)
          } else {
            seenClipIds.add(clip.id)
          }
        }

        // P2.3: Check temporal overlap on the same track — SAME TYPE ONLY.
        if (isFiniteNumber(clip.startMs) && isFiniteNumber(clip.endMs) && clip.startMs < clip.endMs) {
          const clipType = typeof clip.type === 'string' ? clip.type : 'unknown'
          const range: [number, number] = [clip.startMs as number, clip.endMs as number]
          const ranges = rangesByType.get(clipType) ?? []
          for (const [prevStart, prevEnd] of ranges) {
            if (range[0] < prevEnd && prevStart < range[1]) {
              errors.push(
                `Temporal overlap on track '${trackId}': ${clipType} clip '${String(clip.id)}' ` +
                `[${range[0]}, ${range[1]}) overlaps [${prevStart}, ${prevEnd})`
              )
              break // Report first overlap only (avoid error spam)
            }
          }
          ranges.push(range)
          rangesByType.set(clipType, ranges)
        }
      }
    }
  }

  // Markers (nullable array)
  if (data.markers !== undefined && !Array.isArray(data.markers)) {
    errors.push('markers is not an array')
  }

  // Analysis (nullable, embedded GodEar FFT)
  if (data.analysis !== null && data.analysis !== undefined) {
    if (!isObject(data.analysis)) {
      warnings.push('analysis is not an object (will be ignored)')
    } else {
      const a = data.analysis
      if (!isFiniteNumber(a.detectedBpm)) {
        warnings.push('analysis missing detectedBpm')
      }
      if (!isFiniteNumber(a.bpmConfidence)) {
        warnings.push('analysis missing bpmConfidence')
      }
      if (!isObject(a.heatmap)) {
        warnings.push('analysis.heatmap is not an object (TitanEngine injection may fail)')
      } else {
        if (!Array.isArray(a.heatmap.energy)) {
          warnings.push('analysis.heatmap.energy is not an array')
        }
        if (!isFiniteNumber(a.heatmap.resolutionMs)) {
          warnings.push('analysis.heatmap missing resolutionMs')
        }
        // P2.13 FIX: Cross-check that the 7 tactical FFT bands match the
        // energy array length. Mismatched lengths cause TitanEngine index
        // errors and visual artifacts.
        const energyLen = Array.isArray(a.heatmap.energy) ? a.heatmap.energy.length : 0
        const TACTICAL_BANDS = [
          'subBass', 'bassReal', 'lowMid', 'mid', 'highMid', 'treble', 'ultraAir',
        ] as const
        if (energyLen > 0) {
          for (const band of TACTICAL_BANDS) {
            const bandArr = a.heatmap[band]
            if (Array.isArray(bandArr) && bandArr.length !== energyLen) {
              errors.push(
                `analysis.heatmap.${band} length (${bandArr.length}) != energy length (${energyLen})`
              )
            }
          }
        }
      }
      if (!isObject(a.waveform)) {
        warnings.push('analysis.waveform is not an object (UI waveform may fail)')
      } else {
        if (!Array.isArray(a.waveform.peaks)) {
          warnings.push('analysis.waveform.peaks is not an array')
        }
      }
    }
  }

  // HEIMDALL 7.3: Epilepsy Safety validation.
  // The safety object is nullable (legacy/migrated files may not have one),
  // but IF present, its fields must be validated to prevent photosensitive
  // liabilities. maxStrobeFreqHz must be in [1, 30] Hz — values outside this
  // range are either meaningless (0 Hz = no strobe) or dangerous (>30 Hz
  // approaches the seizure-inducing threshold). containsRapidFlash must be a
  // boolean so the UI can display the appropriate warning badge.
  if (data.safety !== null && data.safety !== undefined) {
    if (!isObject(data.safety)) {
      warnings.push('safety is not an object (will be ignored)')
    } else {
      const s = data.safety
      if (!isFiniteNumber(s.maxStrobeFreqHz)) {
        warnings.push('safety.maxStrobeFreqHz is not a finite number')
      } else if (s.maxStrobeFreqHz < 1 || s.maxStrobeFreqHz > 30) {
        errors.push(
          `safety.maxStrobeFreqHz out of range: ${s.maxStrobeFreqHz} Hz ` +
          `(must be 1–30 Hz per photosensitive safety limits)`
        )
      }
      if (typeof s.containsRapidFlash !== 'boolean') {
        warnings.push('safety.containsRapidFlash is not a boolean')
      }
      if (typeof s.communityTrusted !== 'boolean') {
        warnings.push('safety.communityTrusted is not a boolean')
      }
    }
  }

  // LAZARUS B-4 FIX: Inverted integrity threat model.
  // A MISSING checksum is a WARNING (allow load) — this permits opening legacy
  //   or migrated files that have not yet been re-saved with a checksum.
  // A WRONG checksum is a HARD ERROR and must be enforced by the loader
  //   (see ChronosStore.load) — that is the check that actually detects corruption.
  // The checksum is an error-detection code, NOT a cryptographic signature; the
  //   word "corruption" is used deliberately, never "tamper".
  if (!isNonEmptyString(data.checksum)) {
    warnings.push('Missing checksum — integrity cannot be verified (file may be incomplete or migrated)')
  }

  return { valid: errors.length === 0, errors, warnings }
}

/**
 * Strict type guard. Returns true only if the payload is a valid LuxFileV3
 * (does not verify checksum).
 */
export function isLuxFileV3(data: unknown): data is LuxFileV3 {
  return validateLuxFileV3(data).valid
}

// Re-export commonly used types/constants for ergonomic imports.
export type { LuxFileV3, LuxClipV3, LuxTrackV3, LuxTargetZone }
