/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 💎 WAVE 2040.21: THE DIAMOND CERTIFICATION TEST
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * End-to-End integrity test for Diamond Data pipeline:
 *   Mock Heph Clip → createHephFXClip → serializeProject → deserializeProject → Assert
 * 
 * OBJECTIVES:
 * 1. Generate complex HephAutomationClipV3 in memory (tracks, mixBus, spatialZones)
 * 2. Simulate Drop: Execute createHephFXClip with that payload
 * 3. Simulate Save: Execute serializeProject and get JSON
 * 4. Simulate Load: Execute deserializeProject with that JSON
 * 5. ASSERT integrity: curves, mixBus, color, zones all preserved
 * 
 * If this test passes GREEN → DIAMOND DATA STRUCTURE IS CERTIFIED ✅💎
 * 
 * AXIOMA ANTI-SIMULACIÓN: No Math.random(). All values are deterministic.
 * Same input → Same output, always.
 * 
 * @module chronos/__tests__/DiamondData
 * @version WAVE 2040.21
 */

import { describe, test, expect } from 'vitest'
import { createHephFXClip, MIXBUS_CLIP_COLORS } from '../core/TimelineClip'
import { createEmptyChronosProjectV3, serializeProject, deserializeProject, createTrackV3, toLuxFileV3 } from '../core/ChronosProject'
import type { HephAutomationClipV3, HephCurve, HephTrack, ZoneTarget } from '../../core/hephaestus/types'
import type { FXClip } from '../core/TimelineClip'
import type { LuxClipV3, ChronosProjectV3 } from '../core/LuxFileV3'

// ═══════════════════════════════════════════════════════════════════════════
// TEST HELPERS: THE FORGE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a test intensity track: 0 → 1 → 0 envelope
 */
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

/**
 * Create a test tilt track: pan/tilt movement sweep
 */
function createTiltTrack(durationMs: number): HephTrack {
  return {
    id: 'track-tilt',
    paramId: 'tilt',
    zones: ['all'] as readonly ZoneTarget[],
    curve: {
      paramId: 'tilt',
      valueType: 'number',
      range: [0, 1],
      defaultValue: 0.5,
      mode: 'absolute',
      keyframes: [
        { timeMs: 0, value: 0, interpolation: 'bezier', bezierHandles: [0.33, 0, 0.66, 1] },
        { timeMs: durationMs, value: 1, interpolation: 'hold' },
      ],
    },
  }
}

/**
 * Create a test color track: HSL rainbow sweep
 */
function createColorTrack(durationMs: number): HephTrack {
  return {
    id: 'track-color',
    paramId: 'color',
    zones: ['all'] as readonly ZoneTarget[],
    curve: {
      paramId: 'color',
      valueType: 'color',
      range: [0, 1],
      defaultValue: { h: 0, s: 100, l: 50 },
      mode: 'absolute',
      keyframes: [
        { timeMs: 0, value: { h: 0, s: 100, l: 50 }, interpolation: 'linear' },
        { timeMs: durationMs / 2, value: { h: 180, s: 100, l: 50 }, interpolation: 'linear' },
        { timeMs: durationMs, value: { h: 360, s: 100, l: 50 }, interpolation: 'hold' },
      ],
    },
  }
}

/**
 * Create a mock HephAutomationClipV3 with all Diamond Data fields
 */
function createMockHephClip(durationMs: number): HephAutomationClipV3 {
  return {
    id: 'test-heph-clip-001',
    name: 'Solar Sweep Test',
    author: 'PunkOpus QA',
    category: 'movement',
    tags: ['sweep', 'intensity', 'color'],
    vibeCompat: ['techno-club', 'fiesta-latina'],
    spatialZones: ['front', 'back'] as readonly ZoneTarget[],
    mixBus: 'htp',
    priority: 5,
    durationMs,
    effectType: 'heph_custom',
    tracks: [
      createIntensityTrack(durationMs),
      createTiltTrack(durationMs),
      createColorTrack(durationMs),
    ],
    staticParams: {
      gobo1: 1,
      prism: 0,
    },
    schemaVersion: '3.0',
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// THE GAUNTLET: DIAMOND DATA INTEGRITY TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('💎 Diamond Data Pipeline Integrity', () => {
  
  test('🔹 STEP 1: createHephFXClip preserves Diamond Data', () => {
    const durationMs = 4000
    const mockHeph = createMockHephClip(durationMs)
    
    const clip = createHephFXClip(
      'Solar Sweep Test',
      '/library/solar_sweep.lfx',
      0,
      durationMs,
      'zone-front',
      'heph_custom',
      mockHeph,
      ['front', 'back'],
      5
    )
    
    // Assert: FXClip structure
    expect(clip.type).toBe('fx')
    expect(clip.fxType).toBe('heph-custom')
    expect(clip.label).toBe('Solar Sweep Test')
    expect(clip.isHephCustom).toBe(true)
    
    // Assert: Diamond Data embedded
    expect(clip.hephClip).toBeDefined()
    expect(clip.hephClip?.id).toBe('test-heph-clip-001')
    expect(clip.hephClip?.name).toBe('Solar Sweep Test')
    
    // Assert: Tracks preserved
    expect(clip.hephClip?.tracks).toBeDefined()
    expect(clip.hephClip!.tracks.length).toBe(3)
    const intensityTrack = clip.hephClip!.tracks.find(t => t.paramId === 'intensity')
    expect(intensityTrack).toBeDefined()
    const tiltTrack = clip.hephClip!.tracks.find(t => t.paramId === 'tilt')
    expect(tiltTrack).toBeDefined()
    const colorTrack = clip.hephClip!.tracks.find(t => t.paramId === 'color')
    expect(colorTrack).toBeDefined()
    
    // Assert: MixBus routing (V3: canonical source is hephClip.mixBus)
    expect(clip.hephClip?.mixBus).toBe('htp')
    expect(clip.color).toBe(MIXBUS_CLIP_COLORS['htp']) // Orange #f59e0b
    
    // Assert: Zones & Priority
    expect(clip.zones).toEqual(['front', 'back'])
    expect(clip.priority).toBe(5)
    
    // Assert: Visual keyframes generated (WAVE 2040.21: priority curve = tilt, not intensity)
    expect(clip.keyframes).toBeDefined()
    expect(clip.keyframes.length).toBeGreaterThan(0)
    // Should extract tilt curve (priority: intensity > tilt > pan > color)
    // Since we have intensity, it should extract that one
    expect(clip.keyframes.length).toBe(3) // 3 keyframes from intensity curve
    expect(clip.keyframes[0].value).toBe(0) // Start at 0
    expect(clip.keyframes[1].value).toBe(1) // Peak at 1
    expect(clip.keyframes[2].value).toBe(0) // End at 0
  })
  
  test('🔹 STEP 2: Project serialization preserves Diamond Data', async () => {
    const durationMs = 4000
    const mockHeph = createMockHephClip(durationMs)
    
    const clip = createHephFXClip(
      'Solar Sweep Test',
      '/library/solar_sweep.lfx',
      0,
      durationMs,
      'zone-front',
      'heph_custom',
      mockHeph,
      ['front', 'back'],
      5
    )
    
    // Create project with clip in a track
    const project = createEmptyChronosProjectV3()
    project.meta.name = 'Diamond Test Project'
    const track = createTrackV3('front')
    track.clips = [clip as unknown as LuxClipV3]
    project.tracks = [track]
    
    // Serialize (async in V3)
    const json = await serializeProject(toLuxFileV3(project))
    
    // Assert: JSON is valid
    expect(json).toBeDefined()
    expect(json.length).toBeGreaterThan(0)
    
    // Parse back for inspection
    const parsed = JSON.parse(json)
    expect(parsed.tracks).toBeDefined()
    expect(parsed.tracks[0].clips).toBeDefined()
    expect(parsed.tracks[0].clips.length).toBe(1)
    
    const serializedClip = parsed.tracks[0].clips[0]
    expect(serializedClip.hephClip).toBeDefined()
    expect(serializedClip.hephClip.tracks).toBeDefined()
    expect(serializedClip.hephClip.mixBus).toBe('htp')
  })
  
  test('🔹 STEP 3: Project deserialization preserves Diamond Data', async () => {
    const durationMs = 4000
    const mockHeph = createMockHephClip(durationMs)
    
    const originalClip = createHephFXClip(
      'Solar Sweep Test',
      '/library/solar_sweep.lfx',
      0,
      durationMs,
      'zone-front',
      'heph_custom',
      mockHeph,
      ['front', 'back'],
      5
    )
    
    // Create → Serialize → Deserialize
    const project = createEmptyChronosProjectV3()
    project.meta.name = 'Diamond Test Project'
    const track = createTrackV3('front')
    track.clips = [originalClip as unknown as LuxClipV3]
    project.tracks = [track]
    
    const json = await serializeProject(toLuxFileV3(project))
    const result = await deserializeProject(json)
    
    // Assert: Project loaded successfully
    expect(result.file).toBeDefined()
    const allClips = result.file!.tracks.flatMap(t => t.clips)
    expect(allClips.length).toBe(1)
    
    const loadedClip = allClips[0] as unknown as FXClip
    
    // Assert: Clip structure preserved
    expect(loadedClip.type).toBe('fx')
    expect(loadedClip.fxType).toBe('heph-custom')
    expect(loadedClip.label).toBe('Solar Sweep Test')
    expect(loadedClip.isHephCustom).toBe(true)
    
    // 💎 THE DIAMOND CERTIFICATION — Critical assertions:
    
    // Assert: hephClip exists
    expect(loadedClip.hephClip).toBeDefined()
    expect(loadedClip.hephClip?.id).toBe('test-heph-clip-001')
    expect(loadedClip.hephClip?.name).toBe('Solar Sweep Test')
    
    // Assert: Tracks preserved with exact keyframe data
    expect(loadedClip.hephClip?.tracks).toBeDefined()
    expect(loadedClip.hephClip!.tracks.length).toBe(3)
    
    const intensityTrack = loadedClip.hephClip!.tracks.find(t => t.paramId === 'intensity')
    expect(intensityTrack).toBeDefined()
    expect(intensityTrack!.curve.keyframes.length).toBe(3)
    expect(intensityTrack!.curve.keyframes[0].value).toBe(0)
    expect(intensityTrack!.curve.keyframes[1].value).toBe(1)
    expect(intensityTrack!.curve.keyframes[2].value).toBe(0)
    
    const tiltTrack = loadedClip.hephClip!.tracks.find(t => t.paramId === 'tilt')
    expect(tiltTrack).toBeDefined()
    expect(tiltTrack!.curve.keyframes.length).toBe(2)
    expect(tiltTrack!.curve.keyframes[0].interpolation).toBe('bezier')
    
    const colorTrack = loadedClip.hephClip!.tracks.find(t => t.paramId === 'color')
    expect(colorTrack).toBeDefined()
    expect(colorTrack!.curve.keyframes.length).toBe(3)
    expect(colorTrack!.curve.keyframes[0].value).toEqual({ h: 0, s: 100, l: 50 })
    
    // Assert: MixBus routing preserved (V3: canonical source is hephClip.mixBus)
    expect(loadedClip.hephClip?.mixBus).toBe('htp')
    expect(loadedClip.color).toBe(MIXBUS_CLIP_COLORS['htp'])
    
    // Assert: Zones preserved
    expect(loadedClip.zones).toEqual(['front', 'back'])
    
    // Assert: Priority preserved
    expect(loadedClip.priority).toBe(5)
    
    // Assert: Visual keyframes preserved
    expect(loadedClip.keyframes).toBeDefined()
    expect(loadedClip.keyframes.length).toBe(3)
  })
  
  test('🔹 STEP 4: Multiple Heph clips with different mixBus', async () => {
    const durationMs = 2000
    
    // Create 4 clips, one per mixBus
    const globalClip = createHephFXClip(
      'Strobe Storm',
      '/library/strobe_storm.lfx',
      0,
      durationMs,
      'zone-all',
      'heph_custom',
      { ...createMockHephClip(durationMs), mixBus: 'global', name: 'Strobe Storm' },
      [],
      10
    )
    
    const htpClip = createHephFXClip(
      'Pan Sweep',
      '/library/pan_sweep.lfx',
      durationMs,
      durationMs,
      'zone-front',
      'heph_custom',
      { ...createMockHephClip(durationMs), mixBus: 'htp', name: 'Pan Sweep' },
      [],
      5
    )
    
    const ambientClip = createHephFXClip(
      'Color Wash',
      '/library/color_wash.lfx',
      durationMs * 2,
      durationMs,
      'zone-back',
      'heph_custom',
      { ...createMockHephClip(durationMs), mixBus: 'ambient', name: 'Color Wash' },
      [],
      3
    )
    
    const accentClip = createHephFXClip(
      'Gobo Flash',
      '/library/gobo_flash.lfx',
      durationMs * 3,
      durationMs,
      'zone-center',
      'heph_custom',
      { ...createMockHephClip(durationMs), mixBus: 'accent', name: 'Gobo Flash' },
      [],
      8
    )
    
    const project = createEmptyChronosProjectV3()
    project.meta.name = 'Multi MixBus Test'
    const track = createTrackV3('front')
    track.clips = [globalClip, htpClip, ambientClip, accentClip].map(c => c as unknown as LuxClipV3)
    project.tracks = [track]
    
    // Serialize → Deserialize
    const json = await serializeProject(toLuxFileV3(project))
    const result = await deserializeProject(json)
    
    expect(result.file).toBeDefined()
    const allClips = result.file!.tracks.flatMap(t => t.clips)
    expect(allClips.length).toBe(4)
    
    const [g, h, a, ac] = allClips as unknown as FXClip[]
    
    // Assert: Each clip has correct mixBus (via hephClip) and color
    expect(g.hephClip?.mixBus).toBe('global')
    expect(g.color).toBe(MIXBUS_CLIP_COLORS['global']) // Red
    
    expect(h.hephClip?.mixBus).toBe('htp')
    expect(h.color).toBe(MIXBUS_CLIP_COLORS['htp']) // Orange
    
    expect(a.hephClip?.mixBus).toBe('ambient')
    expect(a.color).toBe(MIXBUS_CLIP_COLORS['ambient']) // Green
    
    expect(ac.hephClip?.mixBus).toBe('accent')
    expect(ac.color).toBe(MIXBUS_CLIP_COLORS['accent']) // Blue
  })
  
  test('🔹 STEP 5: Heph clip without tracks (edge case)', async () => {
    const durationMs = 1000
    const mockHeph: HephAutomationClipV3 = {
      id: 'test-no-curves',
      name: 'Empty Clip',
      author: 'Test',
      category: 'physical',
      tags: [],
      vibeCompat: [],
      spatialZones: [] as readonly ZoneTarget[],
      mixBus: 'global',
      priority: 1,
      durationMs,
      effectType: 'heph_custom',
      tracks: [], // No tracks!
      staticParams: {},
      schemaVersion: '3.0',
    }
    
    const clip = createHephFXClip(
      'Empty Clip',
      '/library/empty.lfx',
      0,
      durationMs,
      'zone-all',
      'heph_custom',
      mockHeph,
      [],
      1
    )
    
    // Should still create valid clip
    expect(clip.hephClip).toBeDefined()
    expect(clip.hephClip!.tracks.length).toBe(0)
    
    // Should have generic 3-point envelope keyframes (fallback)
    expect(clip.keyframes.length).toBe(3)
    expect(clip.keyframes[0].value).toBe(0)
    expect(clip.keyframes[1].value).toBe(1)
    expect(clip.keyframes[2].value).toBe(0)
    
    // Serialize → Deserialize
    // V3 validator rejects hephClips with 0 tracks (by design — empty automation is invalid)
    const project = createEmptyChronosProjectV3()
    project.meta.name = 'Empty Clip Test'
    const track = createTrackV3('front')
    track.clips = [clip as unknown as LuxClipV3]
    project.tracks = [track]
    const json = await serializeProject(toLuxFileV3(project))
    const result = await deserializeProject(json)
    
    // V3 schema: empty hephClip tracks is a validation error
    expect(result.file).toBeNull()
    expect(result.validation.valid).toBe(false)
    expect(result.validation.errors.some(e => e.includes('0 tracks'))).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 💎 CERTIFICATION RESULT
// ═══════════════════════════════════════════════════════════════════════════
// 
// If all tests pass GREEN:
//   ✅ Diamond Data structure is CERTIFIED
//   ✅ Serialization pipeline is INTACT
//   ✅ No data loss between create → save → load
//   ✅ MixBus routing preserved across full lifecycle
//   ✅ Visual priority curve logic works correctly
// 
// AXIOMA ANTI-SIMULACIÓN: No mocks of business logic. All values deterministic.
// Same input → Same output, ALWAYS.
// ═══════════════════════════════════════════════════════════════════════════
