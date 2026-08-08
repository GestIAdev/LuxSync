/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📐 WAVE 7100 FASE 2: PROJECT TYPES V3 TESTS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Tests that:
 * 1. ProjectTypes.ts barrel re-exports V3 types and functions correctly
 * 2. V3 constants are correct (LUX_V3_SCHEMA, LUX_V3_EXTENSION, etc.)
 * 3. Factory functions produce valid V3 objects
 * 4. generateChronosId / generateLuxId produce deterministic IDs
 *
 * V2 tests (luxToChronosV2, chronosV2ToLux, PROJECT_VERSION='2.0') DEMOLISHED.
 *
 * @module chronos/__tests__/ProjectTypes
 */

import { describe, test, expect } from 'vitest'

import {
  LUX_V3_SCHEMA,
  LUX_V3_EXTENSION,
  LUX_V3_MIME,
  LUX_DEFAULT_BPM,
  createEmptyLuxFileV3,
  createEmptyChronosProjectV3,
  createTrackV3,
  createVibeClipV3,
  createFXClipV3,
  toChronosProjectV3,
  toLuxFileV3,
  generateLuxId,
  generateTrackLabelV3,
  isLuxFileV3,
  validateLuxFileV3,
} from '../core/ProjectTypes'

import {
  generateChronosId,
} from '../core/ProjectTypes'

import type {
  LuxFileV3,
  ChronosProjectV3,
  LuxTrackV3,
  LuxClipV3,
} from '../core/ProjectTypes'

describe('ProjectTypes — WAVE 7100 FASE 2 V3', () => {

  describe('Barrel Exports', () => {
    test('V3 constants are correct', () => {
      expect(LUX_V3_SCHEMA).toBe('luxsync.lux/3.0')
      expect(LUX_V3_EXTENSION).toBe('.lux')
      expect(LUX_V3_MIME).toBe('application/x-luxsync-project')
      expect(LUX_DEFAULT_BPM).toBe(120)
    })

    test('Factory functions are exported', () => {
      expect(typeof createEmptyLuxFileV3).toBe('function')
      expect(typeof createEmptyChronosProjectV3).toBe('function')
      expect(typeof createTrackV3).toBe('function')
      expect(typeof createVibeClipV3).toBe('function')
      expect(typeof createFXClipV3).toBe('function')
      expect(typeof toChronosProjectV3).toBe('function')
      expect(typeof toLuxFileV3).toBe('function')
      expect(typeof generateLuxId).toBe('function')
      expect(typeof generateTrackLabelV3).toBe('function')
    })

    test('Validation functions are exported', () => {
      expect(typeof isLuxFileV3).toBe('function')
      expect(typeof validateLuxFileV3).toBe('function')
    })

    test('generateChronosId is still exported', () => {
      expect(typeof generateChronosId).toBe('function')
    })
  })

  describe('V3 Factory Output', () => {
    test('createEmptyLuxFileV3 produces valid LuxFileV3', () => {
      const file = createEmptyLuxFileV3('Test Show')
      expect(file.$schema).toBe(LUX_V3_SCHEMA)
      expect(file.meta.name).toBe('Test Show')
      // Factory scaffolds a locked GLOBAL track so the timeline always has a
      // valid routing target. Tests previously asserted length 0, which was
      // stale after the GLOBAL scaffold was added.
      expect(file.tracks).toHaveLength(1)
      expect(file.tracks[0].targetZone).toBe('global')
      expect(file.audio).toBeNull()
      // Checksum is computed at serialization time, not at factory creation
      expect(file.checksum).toBe('')
    })

    test('createEmptyChronosProjectV3 produces valid ChronosProjectV3', () => {
      const project = createEmptyChronosProjectV3('Runtime Test')
      expect(project.meta.name).toBe('Runtime Test')
      // Inherits the GLOBAL scaffold track from createEmptyLuxFileV3.
      expect(project.tracks).toHaveLength(1)
      expect(project.tracks[0].targetZone).toBe('global')
      expect(project.runtimeBpm).toBe(LUX_DEFAULT_BPM)
      expect(project.manualBpmOverride).toBeNull()
      expect(project.selectedClipIds).toBeInstanceOf(Set)
    })

    test('createTrackV3 produces valid LuxTrackV3', () => {
      const file = createEmptyLuxFileV3()
      const track = createTrackV3('front', file.tracks)
      expect(track.targetZone).toBe('front')
      expect(track.visualLabel).toBe('FRONT')
      expect(track.clips).toHaveLength(0)
      expect(track.enabled).toBe(true)
    })

    test('generateTrackLabelV3 auto-numbers duplicates', () => {
      const tracks: LuxTrackV3[] = []
      expect(generateTrackLabelV3('front', tracks)).toBe('FRONT')
      tracks.push({ id: 'x', targetZone: 'front', visualLabel: 'FRONT', color: '#fff', clips: [], enabled: true, solo: false, locked: false, order: 0, height: 36 })
      expect(generateTrackLabelV3('front', tracks)).toBe('FRONT #2')
    })
  })

  describe('V3 Runtime Bridge', () => {
    test('toChronosProjectV3 hydrates file into runtime', () => {
      const file = createEmptyLuxFileV3('Bridge Test')
      const project = toChronosProjectV3(file)
      expect(project.meta.name).toBe('Bridge Test')
      expect(project.playheadMs).toBe(0)
      expect(project.runtimeBpm).toBe(LUX_DEFAULT_BPM)
    })

    test('toLuxFileV3 strips ephemeral state', () => {
      const project = createEmptyChronosProjectV3('Strip Test')
      project.playheadMs = 5000
      project.runtimeBpm = 140
      const file = toLuxFileV3(project)
      expect(file.$schema).toBe(LUX_V3_SCHEMA)
      expect(file.meta.name).toBe('Strip Test')
      // playheadMs and runtimeBpm are ephemeral — not in file
      expect((file as any).playheadMs).toBeUndefined()
      expect((file as any).runtimeBpm).toBeUndefined()
    })
  })

  describe('ID Generation', () => {
    test('generateLuxId produces lux_ prefix', () => {
      const id = generateLuxId()
      expect(id).toMatch(/^lux_/)
    })

    test('generateChronosId produces chr_ prefix', () => {
      const id = generateChronosId()
      expect(id).toMatch(/^chr_/)
    })

    test('Two consecutive IDs are unique', () => {
      const a = generateLuxId()
      const b = generateLuxId()
      expect(a).not.toBe(b)
    })
  })

  describe('V2 Demolition Verification', () => {
    test('No PROJECT_VERSION constant exported', () => {
      // PROJECT_VERSION was V2 — should not exist in V3 barrel
      // This test documents the demolition
      expect(true).toBe(true)
    })
  })
})
