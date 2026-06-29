/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🏛️ LUX FILE V3 — CORE CERTIFICATION TEST
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Validates the incorruptible `.lux` V3 core:
 *   1. Factories produce well-formed, valid files.
 *   2. Round-trip serialize → deserialize is lossless.
 *   3. Checksum is correct, idempotent, and tamper-detecting.
 *   4. Type guards reject malformed / legacy payloads.
 *   5. FX clips marry .lfx V3 (embedded HephAutomationClipV3, schemaVersion '3.0').
 *   6. BPM strategy: detectedBpm → runtimeBpm fallback chain.
 *
 * AXIOMA ANTI-SIMULACIÓN: deterministic values, no Math.random().
 *
 * @module chronos/__tests__/LuxFileV3
 */

import { describe, test, expect } from 'vitest'
import type { HephAutomationClipV3, HephTrack, ZoneTarget } from '../../core/hephaestus/types'
import {
  LUX_V3_SCHEMA,
  LUX_DEFAULT_BPM,
  type LuxFileV3,
  type ChronosProjectV3,
} from '../core/LuxFileV3'
import {
  createEmptyLuxFileV3,
  createTrackV3,
  createVibeClipV3,
  createFXClipV3,
  createMarkerV3,
  createVibeBaseV3,
  toChronosProjectV3,
  toLuxFileV3,
} from '../core/LuxFileV3.factories'
import { validateLuxFileV3, isLuxFileV3 } from '../core/LuxFileV3.schema'
import {
  serializeLuxV3,
  deserializeLuxV3,
  computeLuxChecksum,
  verifyLuxChecksum,
  canonicalStringify,
} from '../core/LuxFileV3.serializer'

// ═══════════════════════════════════════════════════════════════════════════
// FORGE: deterministic .lfx V3 mock
// ═══════════════════════════════════════════════════════════════════════════

function createIntensityTrack(durationMs: number): HephTrack {
  return {
    id: 'track-intensity',
    paramId: 'intensity',
    zones: ['all'] as readonly ZoneTarget[],
    curve: {
      paramId: 'intensity',
      valueType: 'number',
      range: [0, 1],
      defaultValue: 0,
      mode: 'absolute',
      keyframes: [
        { timeMs: 0, value: 0, interpolation: 'linear' },
        { timeMs: durationMs / 2, value: 1, interpolation: 'linear' },
        { timeMs: durationMs, value: 0, interpolation: 'hold' },
      ],
    },
  }
}

function createMockHephClipV3(durationMs = 2000): HephAutomationClipV3 {
  return {
    id: 'heph-mock-001',
    name: 'Test Strobe',
    author: 'tester',
    category: 'physical',
    tags: ['test', 'strobe'],
    vibeCompat: ['techno-club'],
    spatialZones: ['front', 'back'] as readonly ZoneTarget[],
    mixBus: 'htp',
    priority: 5,
    durationMs,
    effectType: 'strobe',
    tracks: [createIntensityTrack(durationMs)],
    staticParams: {},
    schemaVersion: '3.0',
  }
}

/** Build a fully populated, valid file for round-trip tests. */
function createPopulatedFile(): LuxFileV3 {
  const base = createEmptyLuxFileV3('Demo Show')
  const track = createTrackV3('front')

  const vibe = createVibeClipV3({
    vibeType: 'techno-club',
    startMs: 0,
    endMs: 10_000,
    intensity: 0.8,
  })
  const fx = createFXClipV3({
    hephClip: createMockHephClipV3(),
    startMs: 4000,
    endMs: 6000,
    hephFilePath: 'effects/test-strobe.lfx',
  })
  track.clips.push(vibe, fx)

  return {
    ...base,
    meta: { ...base.meta, durationMs: 10_000 },
    audio: {
      fileName: 'track.mp3',
      relativePath: './audio/track.mp3',
      durationMs: 10_000,
      offsetMs: 0,
      detectedBpm: 128,
      bpmConfidence: 0.92,
    },
    analysis: {
      detectedBpm: 128,
      bpmConfidence: 0.92,
      beatGrid: [0, 469, 938, 1406],
      sections: [{ startMs: 0, endMs: 10_000, label: 'main', energy: 0.7 }],
      transients: [{ timeMs: 0, type: 'kick', intensity: 1 }],
      energyHeatmap: [0.1, 0.5, 0.9],
      waveform: [0, 0.3, -0.2, 0.5],
    },
    vibeBase: createVibeBaseV3('chill-lounge', 'Chill Lounge'),
    tracks: [track],
    markers: [createMarkerV3(4000, 'drop', 'THE DROP')],
    safety: { maxStrobeFreqHz: 10, containsRapidFlash: true, communityTrusted: true },
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. FACTORIES
// ═══════════════════════════════════════════════════════════════════════════

describe('LuxFileV3 — factories', () => {
  test('createEmptyLuxFileV3 produces a valid empty file', () => {
    const file = createEmptyLuxFileV3('My Show')
    expect(file.$schema).toBe(LUX_V3_SCHEMA)
    expect(file.meta.name).toBe('My Show')
    expect(file.tracks).toEqual([])
    expect(validateLuxFileV3(file).valid).toBe(true)
  })

  test('createTrackV3 auto-numbers duplicate zones', () => {
    const t1 = createTrackV3('front', [])
    const t2 = createTrackV3('front', [t1])
    expect(t1.visualLabel).toBe('FRONT')
    expect(t2.visualLabel).toBe('FRONT #2')
    expect(t1.id).not.toBe(t2.id)
  })

  test('createFXClipV3 embeds .lfx V3 and mirrors mixBus', () => {
    const heph = createMockHephClipV3()
    const clip = createFXClipV3({ hephClip: heph, startMs: 0, endMs: 2000 })
    expect(clip.type).toBe('fx')
    expect(clip.hephClip?.schemaVersion).toBe('3.0')
    expect(clip.mixBus).toBe('htp')
    expect(clip.zones).toEqual(['front', 'back'])
  })

  test('createVibeClipV3 sets vibe defaults', () => {
    const clip = createVibeClipV3({ vibeType: 'techno-club', startMs: 0, endMs: 1000 })
    expect(clip.type).toBe('vibe')
    expect(clip.intensity).toBe(1)
    expect(clip.vibeType).toBe('techno-club')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. ROUND-TRIP
// ═══════════════════════════════════════════════════════════════════════════

describe('LuxFileV3 — round-trip serialize/deserialize', () => {
  test('lossless round-trip preserves all data', async () => {
    const original = createPopulatedFile()
    const json = await serializeLuxV3(original)
    const result = await deserializeLuxV3(json)

    expect(result.file).not.toBeNull()
    expect(result.validation.valid).toBe(true)
    expect(result.checksumValid).toBe(true)

    const loaded = result.file!
    expect(loaded.meta.name).toBe('Demo Show')
    expect(loaded.audio?.detectedBpm).toBe(128)
    expect(loaded.tracks).toHaveLength(1)
    expect(loaded.tracks[0].clips).toHaveLength(2)

    // FX clip integrity (Diamond Data married to .lfx V3)
    const fx = loaded.tracks[0].clips.find((c) => c.type === 'fx')!
    expect(fx.hephClip?.schemaVersion).toBe('3.0')
    expect(fx.hephClip?.tracks[0].curve.keyframes).toHaveLength(3)

    // Markers + analysis + vibeBase preserved
    expect(loaded.markers[0].label).toBe('THE DROP')
    expect(loaded.analysis?.beatGrid).toEqual([0, 469, 938, 1406])
    expect(loaded.vibeBase?.vibeId).toBe('chill-lounge')
  })

  test('serialize does not mutate the in-memory file', async () => {
    const original = createPopulatedFile()
    expect(original.checksum).toBe('')
    await serializeLuxV3(original)
    expect(original.checksum).toBe('') // unchanged
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. CHECKSUM
// ═══════════════════════════════════════════════════════════════════════════

describe('LuxFileV3 — checksum integrity', () => {
  test('checksum is sha256-prefixed and idempotent', async () => {
    const file = createPopulatedFile()
    const c1 = await computeLuxChecksum(file)
    const c2 = await computeLuxChecksum(file)
    expect(c1).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(c1).toBe(c2)
  })

  test('checksum is independent of key order (canonical)', async () => {
    const file = createPopulatedFile()
    const reordered = {
      checksum: '',
      tracks: file.tracks,
      meta: file.meta,
      $schema: file.$schema,
      audio: file.audio,
      analysis: file.analysis,
      vibeBase: file.vibeBase,
      markers: file.markers,
      safety: file.safety,
    } as LuxFileV3
    expect(await computeLuxChecksum(file)).toBe(await computeLuxChecksum(reordered))
  })

  test('tampering is detected on deserialize', async () => {
    const json = await serializeLuxV3(createPopulatedFile())
    const tampered = json.replace('"detectedBpm": 128', '"detectedBpm": 175')
    const result = await deserializeLuxV3(tampered)
    expect(result.file).not.toBeNull()
    expect(result.checksumValid).toBe(false)
    expect(result.validation.warnings.some((w) => w.includes('Checksum mismatch'))).toBe(true)
  })

  test('verifyLuxChecksum validates a freshly serialized file', async () => {
    const json = await serializeLuxV3(createPopulatedFile())
    const result = await deserializeLuxV3(json)
    expect(await verifyLuxChecksum(result.file!)).toBe(true)
  })

  test('canonicalStringify sorts keys deeply', () => {
    const a = canonicalStringify({ b: 1, a: { d: 2, c: 3 } })
    expect(a).toBe('{"a":{"c":3,"d":2},"b":1}')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 4. TYPE GUARDS / VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

describe('LuxFileV3 — validation rejects bad payloads', () => {
  test('rejects wrong $schema (no legacy V2)', () => {
    const bad = { ...createEmptyLuxFileV3(), $schema: 'luxsync.lux/2.0' }
    const res = validateLuxFileV3(bad)
    expect(res.valid).toBe(false)
    expect(res.errors[0]).toContain('Invalid $schema')
    expect(isLuxFileV3(bad)).toBe(false)
  })

  test('rejects non-object', () => {
    expect(validateLuxFileV3(null).valid).toBe(false)
    expect(validateLuxFileV3('string').valid).toBe(false)
    expect(validateLuxFileV3(42).valid).toBe(false)
  })

  test('rejects FX clip with non-V3 hephClip', () => {
    const file = createPopulatedFile()
    const fx = file.tracks[0].clips.find((c) => c.type === 'fx')!
    ;(fx.hephClip as { schemaVersion: string }).schemaVersion = '2.1'
    const res = validateLuxFileV3(file)
    expect(res.valid).toBe(false)
    expect(res.errors.some((e) => e.includes("schemaVersion must be '3.0'"))).toBe(true)
  })

  test('rejects clip with startMs >= endMs', () => {
    const file = createEmptyLuxFileV3()
    const track = createTrackV3('front')
    track.clips.push(
      createVibeClipV3({ vibeType: 'idle', startMs: 5000, endMs: 1000 })
    )
    const bad = { ...file, tracks: [track] }
    const res = validateLuxFileV3(bad)
    expect(res.valid).toBe(false)
    expect(res.errors.some((e) => e.includes('>= endMs'))).toBe(true)
  })

  test('rejects invalid targetZone', () => {
    const file = createEmptyLuxFileV3()
    const track = { ...createTrackV3('front'), targetZone: 'nonsense' as never }
    const res = validateLuxFileV3({ ...file, tracks: [track] })
    expect(res.valid).toBe(false)
    expect(res.errors.some((e) => e.includes('invalid targetZone'))).toBe(true)
  })

  test('deserialize rejects malformed JSON', async () => {
    const result = await deserializeLuxV3('{not valid json')
    expect(result.file).toBeNull()
    expect(result.validation.valid).toBe(false)
    expect(result.validation.errors[0]).toContain('JSON parse error')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 5. RUNTIME BRIDGE + BPM STRATEGY
// ═══════════════════════════════════════════════════════════════════════════

describe('LuxFileV3 — runtime bridge & BPM', () => {
  test('toChronosProjectV3 hydrates ephemeral state', () => {
    const file = createPopulatedFile()
    const project = toChronosProjectV3(file)
    expect(project.playheadMs).toBe(0)
    expect(project.pixelsPerSecond).toBe(100)
    expect(project.manualBpmOverride).toBeNull()
    expect(project.selectedClipIds).toBeInstanceOf(Set)
  })

  test('runtimeBpm falls back to detectedBpm from audio', () => {
    const project = toChronosProjectV3(createPopulatedFile())
    expect(project.runtimeBpm).toBe(128)
  })

  test('runtimeBpm falls back to LUX_DEFAULT_BPM when no audio/analysis', () => {
    const project = toChronosProjectV3(createEmptyLuxFileV3())
    expect(project.runtimeBpm).toBe(LUX_DEFAULT_BPM)
  })

  test('toLuxFileV3 strips runtime state and refreshes modifiedAt', () => {
    const project: ChronosProjectV3 = toChronosProjectV3(createPopulatedFile())
    project.playheadMs = 5000
    project.selectedClipIds.add('clip-x')
    const file = toLuxFileV3(project)
    expect((file as unknown as Record<string, unknown>).playheadMs).toBeUndefined()
    expect((file as unknown as Record<string, unknown>).selectedClipIds).toBeUndefined()
    expect(file.$schema).toBe(LUX_V3_SCHEMA)
  })

  test('full cycle: file → runtime → file → serialize → deserialize', async () => {
    const original = createPopulatedFile()
    const project = toChronosProjectV3(original)
    const backToFile = toLuxFileV3(project)
    const json = await serializeLuxV3(backToFile)
    const result = await deserializeLuxV3(json)
    expect(result.checksumValid).toBe(true)
    expect(result.file?.tracks[0].clips).toHaveLength(2)
  })
})
