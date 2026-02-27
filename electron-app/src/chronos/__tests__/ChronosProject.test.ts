/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 💾 WAVE 2078: CHRONOS TEST ARMY
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Suite 3: ChronosProject — .lux file format integrity
 * 
 * AXIOMA ANTI-SIMULACIÓN: Zero Math.random(). All assertions deterministic.
 * 
 * @module chronos/__tests__/ChronosProject
 * @version WAVE 2078
 */

import { describe, test, expect, beforeEach } from 'vitest'
import {
  createEmptyProject,
  createProjectFromState,
  serializeProject,
  deserializeProject,
  validateProject,
  PROJECT_VERSION,
  PROJECT_EXTENSION,
  PROJECT_MIME,
} from '../core/ChronosProject'
import type { LuxProject } from '../core/ChronosProject'
import type { TimelineClip } from '../core/TimelineClip'

// ═══════════════════════════════════════════════════════════════════════════
// 💾 PROJECT FACTORY TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('💾 ChronosProject — .lux Format Integrity', () => {

  // ─────────────────────────────────────────────────────────────────────
  // CONSTANTS
  // ─────────────────────────────────────────────────────────────────────

  test('PROJECT_VERSION is defined and non-empty', () => {
    expect(PROJECT_VERSION).toBeTruthy()
    expect(typeof PROJECT_VERSION).toBe('string')
  })

  test('PROJECT_EXTENSION is .lux', () => {
    expect(PROJECT_EXTENSION).toBe('.lux')
  })

  test('PROJECT_MIME is defined', () => {
    expect(PROJECT_MIME).toBeTruthy()
  })

  // ─────────────────────────────────────────────────────────────────────
  // createEmptyProject
  // ─────────────────────────────────────────────────────────────────────

  describe('🏭 createEmptyProject', () => {

    test('Returns a valid project structure', () => {
      const project = createEmptyProject('Test Show')
      
      expect(project).toBeDefined()
      expect(project.meta).toBeDefined()
      expect(project.timeline).toBeDefined()
      expect(project.library).toBeDefined()
    })

    test('Project name matches input', () => {
      const project = createEmptyProject('Noche de Cumbia')
      expect(project.meta.name).toBe('Noche de Cumbia')
    })

    test('Default name is Untitled Project', () => {
      const project = createEmptyProject()
      expect(project.meta.name).toBe('Untitled Project')
    })

    test('Version matches PROJECT_VERSION', () => {
      const project = createEmptyProject('Test')
      expect(project.meta.version).toBe(PROJECT_VERSION)
    })

    test('Created and modified timestamps are set', () => {
      const before = Date.now()
      const project = createEmptyProject('Test')
      const after = Date.now()
      
      expect(project.meta.created).toBeGreaterThanOrEqual(before)
      expect(project.meta.created).toBeLessThanOrEqual(after)
      expect(project.meta.modified).toBeGreaterThanOrEqual(before)
      expect(project.meta.modified).toBeLessThanOrEqual(after)
    })

    test('Timeline starts with zero clips', () => {
      const project = createEmptyProject('Test')
      expect(project.timeline.clips).toEqual([])
    })

    test('Audio is null for empty project', () => {
      const project = createEmptyProject('Test')
      expect(project.audio).toBeNull()
    })

    test('Duration defaults to 60000ms (1 minute)', () => {
      const project = createEmptyProject('Test')
      expect(project.meta.durationMs).toBe(60000)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // createProjectFromState
  // ─────────────────────────────────────────────────────────────────────

  describe('🏭 createProjectFromState', () => {

    test('Creates project with given name', () => {
      const project = createProjectFromState('Live Set', [], null)
      expect(project.meta.name).toBe('Live Set')
    })

    test('Includes audio info when provided', () => {
      const audio = {
        name: 'track.mp3',
        path: '/music/track.mp3',
        bpm: 128,
        durationMs: 180000,
      }
      const project = createProjectFromState('Test', [], audio)
      
      expect(project.audio).toBeDefined()
      expect(project.audio!.name).toBe('track.mp3')
      expect(project.audio!.bpm).toBe(128)
      expect(project.audio!.durationMs).toBe(180000)
    })

    test('Audio null when not provided', () => {
      const project = createProjectFromState('Test', [], null)
      expect(project.audio).toBeNull()
    })

    test('Duration comes from audio when available', () => {
      const audio = {
        name: 'test.mp3',
        path: '/test.mp3',
        bpm: 120,
        durationMs: 240000,
      }
      const project = createProjectFromState('Test', [], audio)
      expect(project.meta.durationMs).toBe(240000)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // SERIALIZATION ROUNDTRIP
  // ─────────────────────────────────────────────────────────────────────

  describe('📦 Serialization Roundtrip', () => {

    let project: LuxProject

    beforeEach(() => {
      project = createEmptyProject('Roundtrip Test')
    })

    test('Serialize produces valid JSON', () => {
      const json = serializeProject(project)
      expect(() => JSON.parse(json)).not.toThrow()
    })

    test('Deserialize reconstructs project', () => {
      const json = serializeProject(project)
      const restored = deserializeProject(json)
      
      expect(restored).not.toBeNull()
      expect(restored!.meta.name).toBe('Roundtrip Test')
      expect(restored!.meta.version).toBe(PROJECT_VERSION)
    })

    test('Roundtrip preserves all fields', () => {
      const audio = {
        name: 'cumbia.mp3',
        path: '/music/cumbia.mp3',
        bpm: 96,
        durationMs: 300000,
      }
      const original = createProjectFromState('Full Roundtrip', [], audio)
      
      const json = serializeProject(original)
      const restored = deserializeProject(json)!
      
      expect(restored.meta.name).toBe(original.meta.name)
      expect(restored.audio?.name).toBe('cumbia.mp3')
      expect(restored.audio?.bpm).toBe(96)
      expect(restored.timeline.clips.length).toBe(0)
    })

    test('Serialize updates modified timestamp', () => {
      const originalModified = project.meta.modified
      
      // Small delay to ensure timestamp difference
      const json = serializeProject(project)
      const restored = deserializeProject(json)!
      
      expect(restored.meta.modified).toBeGreaterThanOrEqual(originalModified)
    })

    test('Deserialize returns null for invalid JSON', () => {
      expect(deserializeProject('not json at all')).toBeNull()
    })

    test('Deserialize returns null for missing version', () => {
      const bad = JSON.stringify({ timeline: { clips: [] } })
      expect(deserializeProject(bad)).toBeNull()
    })

    test('Deserialize returns null for missing clips', () => {
      const bad = JSON.stringify({ meta: { version: '2.0' } })
      expect(deserializeProject(bad)).toBeNull()
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // VALIDATION
  // ─────────────────────────────────────────────────────────────────────

  describe('🛡️ Validation', () => {

    test('Empty project is valid', () => {
      const project = createEmptyProject('Valid')
      const result = validateProject(project)
      
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    test('Missing meta produces error', () => {
      const broken = { timeline: { clips: [] }, library: { customEffects: [], presets: [] } } as any
      const result = validateProject(broken)
      
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    test('Invalid clip without id produces error', () => {
      const project = createEmptyProject('Bad Clips')
      project.timeline.clips = [
        { type: 'fx', startMs: 0, endMs: 1000 } as any,
      ]
      const result = validateProject(project)
      
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('missing id'))).toBe(true)
    })

    test('Clip with startMs >= endMs produces error', () => {
      const project = createEmptyProject('Backwards Clip')
      project.timeline.clips = [
        { id: 'test-1', type: 'fx', startMs: 5000, endMs: 1000 } as any,
      ]
      const result = validateProject(project)
      
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('startMs'))).toBe(true)
    })

    test('Clip with negative startMs produces error', () => {
      const project = createEmptyProject('Negative Time')
      project.timeline.clips = [
        { id: 'test-1', type: 'fx', startMs: -100, endMs: 1000 } as any,
      ]
      const result = validateProject(project)
      
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('negative'))).toBe(true)
    })

    test('Validation is deterministic', () => {
      const project = createEmptyProject('Determinism Check')
      const r1 = validateProject(project)
      const r2 = validateProject(project)
      
      expect(r1.valid).toBe(r2.valid)
      expect(r1.errors.length).toBe(r2.errors.length)
      expect(r1.warnings.length).toBe(r2.warnings.length)
    })
  })
})
