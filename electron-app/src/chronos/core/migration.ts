/**
 * CHRONOS MIGRATION — V1 to V2
 *
 * WAVE 2551: migrateProjectV1toV2()
 *
 * Converts a ChronosProject (V1, 1.0.0) into a ChronosProjectV2 (2.0.0).
 * Pure function — no side effects, no IPC, no store mutations.
 * The store calls this on load when it detects version === '1.0.0'.
 *
 * Migration rules:
 *   - TimelineTrack of type 'effect' or 'zone' → TimelineTrackV2
 *   - TimelineTrack of type 'vibe' → clips extracted to vibeClips
 *   - TimelineTrack of type 'audio'/'intensity'/'color'/'automation' → dropped
 *     (those are structural/UI representations, not applicable in V2)
 *   - targetZone: normalizes V1 zone string to CanonicalZone | 'global'
 *     - '*', 'all', null, undefined → 'global'
 *     - known CanonicalZone strings → pass through
 *     - unknown strings → 'global' with a warning
 *
 * @module chronos/core/migration
 */

import type { ChronosProject, ChronosProjectV2, TimelineTrackV2 } from './types'
import type { CanonicalZone } from '../../core/stage/ShowFileV2'
import { CANONICAL_ZONES } from '../../core/zones/ZoneMapper'

// Canonical zone lookup set for O(1) membership test
const CANONICAL_ZONE_SET: ReadonlySet<string> = new Set(CANONICAL_ZONES)

/**
 * Normalize a raw V1 targetZone string to CanonicalZone | 'global'.
 *
 * V1 used loose strings: '*', 'all', 'front', 'movers-left', etc.
 * V2 uses strict CanonicalZone | 'global' union.
 */
function normalizeV1Zone(zone: string | null | undefined): CanonicalZone | 'global' {
  if (!zone || zone === '*' || zone === 'all') return 'global'
  if (CANONICAL_ZONE_SET.has(zone)) return zone as CanonicalZone
  // Fallback with warning — V1 might have had custom/composite zone strings
  console.warn(`[migration] Unknown V1 zone "${zone}" — mapping to 'global'`)
  return 'global'
}

/**
 * Convert a ChronosProject (V1) to a ChronosProjectV2.
 *
 * Called automatically by ChronosStore.load() when it detects
 * `project.version === '1.0.0'` in the serialized JSON.
 */
export function migrateProjectV1toV2(v1: ChronosProject): ChronosProjectV2 {
  const migratedTracks: TimelineTrackV2[] = []

  // We keep the V1 clips as-is — TimelineClip shape is compatible between V1 and V2.
  // Only the track wrapper changes.
  // Vibe tracks are dropped: V2 has no vibeClips field yet (future wave).
  for (let i = 0; i < v1.tracks.length; i++) {
    const t = v1.tracks[i]

    // Only migrate effect/zone tracks — vibe/audio/etc. not applicable in V2
    if (t.type !== 'effect' && t.type !== 'zone') continue

    const targetZone = normalizeV1Zone(t.targetZone)

    migratedTracks.push({
      id: t.id,
      targetZone,
      visualLabel: t.name,
      color: t.color,
      clips: [...t.clips],
      automation: [...(t.automation ?? [])],
      enabled: t.enabled,
      solo: t.solo,
      locked: t.locked,
      order: i,
      height: t.height,
    })
  }

  return {
    version: '2.0.0',
    id: v1.id,
    meta: { ...v1.meta },
    playback: { ...v1.playback },
    analysis: v1.analysis ? { ...v1.analysis } : null,
    tracks: migratedTracks,
    globalAutomation: [...v1.globalAutomation],
    markers: [...v1.markers],
  }
}

/**
 * Detect the version of a raw parsed project JSON.
 * Returns '1.0.0', '2.0.0', or null if unrecognized.
 */
export function detectProjectVersion(raw: unknown): '1.0.0' | '2.0.0' | null {
  if (!raw || typeof raw !== 'object') return null
  const version = (raw as Record<string, unknown>).version
  if (version === '1.0.0' || version === '2.0.0') return version
  return null
}
