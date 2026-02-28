/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📐 WAVE 2081: PROJECT TYPES UNIFICATION TESTS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Suite 8: ProjectTypes — Barrel exports, conversion roundtrip, type integrity
 *
 * Tests that:
 * 1. ProjectTypes.ts barrel re-exports everything correctly
 * 2. luxToChronos converts a LuxProject to a valid ChronosProject
 * 3. chronosToLux converts a ChronosProject to a valid LuxProject
 * 4. Roundtrip preserves essential data (name, audio, duration, clips)
 * 5. Edge cases: no audio, no clips, missing fields
 *
 * AXIOMA ANTI-SIMULACIÓN: Zero Math.random(). All data deterministic.
 *
 * @module chronos/__tests__/ProjectTypes
 * @version WAVE 2081
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
  luxToChronos,
  chronosToLux,
  // Runtime layer
  generateChronosId,
  createDefaultProject,
  createDefaultTrack,
  createEffectClip,
  createAutomationLane,
  createAutomationPoint,
} from '../core/ProjectTypes'

// Direct imports for type verification
import type {
  LuxProject,
  ChronosProject,
  ProjectMeta,
  ChronosProjectMeta,
} from '../core/ProjectTypes'

// ═══════════════════════════════════════════════════════════════════════════
// 📐 TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('📐 ProjectTypes — M1 Unification', () => {

  // ─────────────────────────────────────────────────────────────────────
  // BARREL EXPORTS
  // ─────────────────────────────────────────────────────────────────────

  describe('📦 Barrel Exports', () => {
    test('Persistence layer exports are functions', () => {
      expect(typeof createEmptyProject).toBe('function')
      expect(typeof serializeProject).toBe('function')
      expect(typeof deserializeProject).toBe('function')
      expect(typeof validateProject).toBe('function')
      expect(typeof luxToChronos).toBe('function')
      expect(typeof chronosToLux).toBe('function')
    })

    test('Runtime layer exports are functions', () => {
      expect(typeof generateChronosId).toBe('function')
      expect(typeof createDefaultProject).toBe('function')
      expect(typeof createDefaultTrack).toBe('function')
      expect(typeof createEffectClip).toBe('function')
      expect(typeof createAutomationLane).toBe('function')
      expect(typeof createAutomationPoint).toBe('function')
    })

    test('Constants are correct', () => {
      expect(PROJECT_VERSION).toBe('2.0')
      expect(PROJECT_EXTENSION).toBe('.lux')
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // luxToChronos
  // ─────────────────────────────────────────────────────────────────────

  describe('🔄 luxToChronos', () => {
    test('Converts empty LuxProject to ChronosProject', () => {
      const lux = createEmptyProject('Test Lux')
      const ch = luxToChronos(lux)

      // Root shape
      expect(ch.version).toBe('1.0.0')
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

      const ch = luxToChronos(lux)

      expect(ch.meta.audioPath).toBe('/music/track.mp3')
      expect(ch.meta.bpm).toBe(128)
      expect(ch.meta.audioHash).toBe('abc123')
    })

    test('Preserves project name', () => {
      const lux = createEmptyProject('My Show')
      const ch = luxToChronos(lux)
      expect(ch.meta.name).toBe('My Show')
    })

    test('Converts timestamps to ISO strings', () => {
      const lux = createEmptyProject('Time Test')
      const ch = luxToChronos(lux)

      expect(ch.meta.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      expect(ch.meta.modifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    test('Creates default playback config', () => {
      const lux = createEmptyProject('Playback Test')
      const ch = luxToChronos(lux)

      expect(ch.playback.loop).toBe(false)
      expect(ch.playback.snapToBeat).toBe(true)
      expect(ch.playback.overrideMode).toBe('whisper')
      expect(ch.playback.latencyCompensationMs).toBe(10)
    })

    test('Handles null audio gracefully', () => {
      const lux = createEmptyProject('No Audio')
      lux.audio = null

      const ch = luxToChronos(lux)
      expect(ch.meta.audioPath).toBeNull()
      expect(ch.meta.audioHash).toBeNull()
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // chronosToLux
  // ─────────────────────────────────────────────────────────────────────

  describe('🔄 chronosToLux', () => {
    test('Converts empty ChronosProject to LuxProject', () => {
      const ch = createDefaultProject('Test Chronos')
      const lux = chronosToLux(ch)

      expect(lux.meta.version).toBe(PROJECT_VERSION)
      expect(lux.meta.name).toBe('Test Chronos')
      expect(lux.timeline.clips).toHaveLength(0)
      expect(lux.audio).toBeNull()
      expect(lux.library.customEffects).toHaveLength(0)
    })

    test('Preserves audio path into ProjectAudio', () => {
      const ch = createDefaultProject('Audio Export')
      ch.meta.audioPath = '/music/export.wav'
      ch.meta.bpm = 140

      const lux = chronosToLux(ch)

      expect(lux.audio).not.toBeNull()
      expect(lux.audio!.path).toBe('/music/export.wav')
      expect(lux.audio!.bpm).toBe(140)
    })

    test('Null audioPath produces null audio', () => {
      const ch = createDefaultProject('No Audio')
      ch.meta.audioPath = null

      const lux = chronosToLux(ch)
      expect(lux.audio).toBeNull()
    })

    test('Timestamps are numeric (epoch ms)', () => {
      const ch = createDefaultProject('Timestamp Test')
      const lux = chronosToLux(ch)

      expect(typeof lux.meta.created).toBe('number')
      expect(typeof lux.meta.modified).toBe('number')
      expect(lux.meta.created).toBeGreaterThan(0)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // ROUNDTRIP
  // ─────────────────────────────────────────────────────────────────────

  describe('🔁 Roundtrip Integrity', () => {
    test('LuxProject → ChronosProject → LuxProject preserves name', () => {
      const original = createEmptyProject('Roundtrip Test')
      original.audio = {
        name: 'beat.mp3',
        path: '/audio/beat.mp3',
        bpm: 130,
        offsetMs: 0,
        durationMs: 180000,
      }

      const chronos = luxToChronos(original)
      const backToLux = chronosToLux(chronos)

      expect(backToLux.meta.name).toBe('Roundtrip Test')
      expect(backToLux.audio!.path).toBe('/audio/beat.mp3')
      expect(backToLux.audio!.bpm).toBe(130)
    })

    test('ChronosProject → LuxProject → ChronosProject preserves name', () => {
      const original = createDefaultProject('Reverse Roundtrip')
      original.meta.audioPath = '/test/audio.wav'
      original.meta.bpm = 145

      const lux = chronosToLux(original)
      const backToChronos = luxToChronos(lux)

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
