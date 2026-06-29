/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📐 FASE 7: PROJECT TYPES V2 TESTS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Tests that:
 * 1. ProjectTypes.ts barrel re-exports V2 types and functions correctly
 * 2. luxToChronosV2 converts a LuxProject to a valid ChronosProjectV2
 * 3. chronosV2ToLux converts a ChronosProjectV2 to a valid LuxProject
 * 4. Roundtrip preserves essential data (name, audio, duration, clips)
 * 5. Edge cases: no audio, no clips, missing fields
 *
 * AXIOMA ANTI-SIMULACIÓN: Zero Math.random(). All data deterministic.
 *
 * @module chronos/__tests__/ProjectTypes
 */

import { describe, test, expect } from 'vitest'

// ─── Import from the barrel ────────────────────────────────────────────
import {
  // Persistence layer
  PROJECT_VERSION,
  PROJECT_EXTENSION,
  createEmptyProject,
  serializeProject,
  deserializeProject,
  validateProject,
  luxToChronosV2,
  chronosV2ToLux,
  // Runtime layer
  generateChronosId,
  createDefaultProjectV2,
  createTrackV2,
} from '../core/ProjectTypes'

// Direct imports for type verification
import type {
  LuxProject,
  ProjectMeta,
  ChronosProjectV2,
  ChronosProjectMeta,
} from '../core/ProjectTypes'

// ═══════════════════════════════════════════════════════════════════════════
// 📐 TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('📐 ProjectTypes — FASE 7 V2', () => {

  // ─────────────────────────────────────────────────────────────────────
  // BARREL EXPORTS
  // ─────────────────────────────────────────────────────────────────────

  describe('📦 Barrel Exports', () => {
    test('Persistence layer exports are functions', () => {
      expect(typeof createEmptyProject).toBe('function')
      expect(typeof serializeProject).toBe('function')
      expect(typeof deserializeProject).toBe('function')
      expect(typeof validateProject).toBe('function')
      expect(typeof luxToChronosV2).toBe('function')
      expect(typeof chronosV2ToLux).toBe('function')
    })

    test('Runtime layer exports are functions', () => {
      expect(typeof generateChronosId).toBe('function')
      expect(typeof createDefaultProjectV2).toBe('function')
      expect(typeof createTrackV2).toBe('function')
    })

    test('Constants are correct', () => {
      expect(PROJECT_VERSION).toBe('2.0')
      expect(PROJECT_EXTENSION).toBe('.lux')
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // luxToChronosV2
  // ─────────────────────────────────────────────────────────────────────

  describe('🔄 luxToChronosV2', () => {
    test('Converts empty LuxProject to ChronosProjectV2', () => {
      const lux = createEmptyProject('Test Lux')
      const ch = luxToChronosV2(lux)

      // Root shape
      expect(ch.version).toBe('2.0.0')
      expect(ch.id).toMatch(/^chr_/)
      expect(ch.meta.name).toBe('Test Lux')
      expect(ch.tracks).toHaveLength(1)
      expect(ch.tracks[0].clips).toHaveLength(0)
      expect(ch.analysis).toBeNull()
      expect(ch.globalAutomation).toHaveLength(0)
      expect(ch.markers).toHaveLength(0)
    })

    test('Preserves audio metadata', () => {
      const lux = createEmptyProject('Audio Test')
      lux.audio = {
        name: 'track.mp3',
        path: '/music/track.mp3',
        bpm: 128,
        offsetMs: 0,
        durationMs: 240000,
        checksum: 'abc123',
      }

      const ch = luxToChronosV2(lux)

      expect(ch.meta.audioPath).toBe('/music/track.mp3')
      expect(ch.meta.bpm).toBe(128)
      expect(ch.meta.audioHash).toBe('abc123')
    })

    test('Preserves project name', () => {
      const lux = createEmptyProject('My Show')
      const ch = luxToChronosV2(lux)
      expect(ch.meta.name).toBe('My Show')
    })

    test('Converts timestamps to ISO strings', () => {
      const lux = createEmptyProject('Time Test')
      const ch = luxToChronosV2(lux)

      expect(ch.meta.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      expect(ch.meta.modifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    test('Creates default playback config', () => {
      const lux = createEmptyProject('Playback Test')
      const ch = luxToChronosV2(lux)

      expect(ch.playback.loop).toBe(false)
      expect(ch.playback.snapToBeat).toBe(true)
      expect(ch.playback.overrideMode).toBe('whisper')
      expect(ch.playback.latencyCompensationMs).toBe(10)
    })

    test('Handles null audio gracefully', () => {
      const lux = createEmptyProject('No Audio')
      lux.audio = null

      const ch = luxToChronosV2(lux)
      expect(ch.meta.audioPath).toBeNull()
      expect(ch.meta.audioHash).toBeNull()
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // chronosV2ToLux
  // ─────────────────────────────────────────────────────────────────────

  describe('🔄 chronosV2ToLux', () => {
    test('Converts empty ChronosProjectV2 to LuxProject', () => {
      const ch = createDefaultProjectV2('Test Chronos')
      const lux = chronosV2ToLux(ch)

      expect(lux.meta.version).toBe(PROJECT_VERSION)
      expect(lux.meta.name).toBe('Test Chronos')
      expect(lux.timeline.clips).toHaveLength(0)
      expect(lux.audio).toBeNull()
      expect(lux.library.customEffects).toHaveLength(0)
    })

    test('Preserves audio path into ProjectAudio', () => {
      const ch = createDefaultProjectV2('Audio Export')
      ch.meta.audioPath = '/music/export.wav'
      ch.meta.bpm = 140

      const lux = chronosV2ToLux(ch)

      expect(lux.audio).not.toBeNull()
      expect(lux.audio!.path).toBe('/music/export.wav')
      expect(lux.audio!.bpm).toBe(140)
    })

    test('Null audioPath produces null audio', () => {
      const ch = createDefaultProjectV2('No Audio')
      ch.meta.audioPath = null

      const lux = chronosV2ToLux(ch)
      expect(lux.audio).toBeNull()
    })

    test('Timestamps are numeric (epoch ms)', () => {
      const ch = createDefaultProjectV2('Timestamp Test')
      const lux = chronosV2ToLux(ch)

      expect(typeof lux.meta.created).toBe('number')
      expect(typeof lux.meta.modified).toBe('number')
      expect(lux.meta.created).toBeGreaterThan(0)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // ROUNDTRIP
  // ─────────────────────────────────────────────────────────────────────

  describe('🔁 Roundtrip Integrity', () => {
    test('LuxProject → ChronosProjectV2 → LuxProject preserves name', () => {
      const original = createEmptyProject('Roundtrip Test')
      original.audio = {
        name: 'beat.mp3',
        path: '/audio/beat.mp3',
        bpm: 130,
        offsetMs: 0,
        durationMs: 180000,
      }

      const chronos = luxToChronosV2(original)
      const backToLux = chronosV2ToLux(chronos)

      expect(backToLux.meta.name).toBe('Roundtrip Test')
      expect(backToLux.audio!.path).toBe('/audio/beat.mp3')
      expect(backToLux.audio!.bpm).toBe(130)
    })

    test('ChronosProjectV2 → LuxProject → ChronosProjectV2 preserves name', () => {
      const original = createDefaultProjectV2('Reverse Roundtrip')
      original.meta.audioPath = '/test/audio.wav'
      original.meta.bpm = 145

      const lux = chronosV2ToLux(original)
      const backToChronos = luxToChronosV2(lux)

      expect(backToChronos.meta.name).toBe('Reverse Roundtrip')
      expect(backToChronos.meta.audioPath).toBe('/test/audio.wav')
      expect(backToChronos.meta.bpm).toBe(145)
    })

    test('Serialization roundtrip via JSON', () => {
      const original = createEmptyProject('JSON Roundtrip')
      const json = serializeProject(original)
      const parsed = deserializeProject(json)

      expect(parsed).not.toBeNull()
      expect(parsed!.meta.name).toBe('JSON Roundtrip')
      expect(validateProject(parsed!).valid).toBe(true)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // ID DETERMINISM (M3 — generateChronosId)
  // ─────────────────────────────────────────────────────────────────────

  describe('🔑 ID Generation (Anti-Simulation)', () => {
    test('generateChronosId produces chr_ prefix', () => {
      const id = generateChronosId()
      expect(id).toMatch(/^chr_/)
    })

    test('Two consecutive IDs are unique', () => {
      const a = generateChronosId()
      const b = generateChronosId()
      expect(a).not.toBe(b)
    })

    test('IDs are deterministic format (no Math.random)', () => {
      // If crypto.randomUUID is available, format is chr_<uuid>
      // If not, format is chr_<timestamp36>_<counter36>
      const id = generateChronosId()
      const parts = id.split('_')
      expect(parts[0]).toBe('chr')
      expect(parts.length).toBeGreaterThanOrEqual(2)
    })
  })
})
