/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚒️ AUDIO BINDING SERIALIZATION TEST - WAVE 2030.14
 * Verifies audioBinding field persists through serialize/deserialize cycle
 * 
 * @module tests/hephaestus/AudioBindingSerialization
 * @version WAVE 2030.14
 */

import { describe, test, expect } from 'vitest'
import type { 
  HephAutomationClipV3, 
  HephCurve, 
  HephKeyframe,
  HephAudioBinding,
  HephParamId,
  HephTrack,
  ZoneTarget,
} from '../types'
import { serializeHephClip } from '../types'

describe('WAVE 2030.14: Audio Binding Serialization', () => {
  /**
   * Creates a minimal clip with audio binding for testing.
   */
  function createTestClipWithAudioBinding(): HephAutomationClipV3 {
    const audioBinding: HephAudioBinding = {
      source: 'bass',
      inputRange: [0.2, 0.8],
      outputRange: [0, 1],
      smoothing: 0.15,
    }

    const keyframeWithBinding: HephKeyframe = {
      timeMs: 500,
      value: 0.5,
      interpolation: 'bezier',
      bezierHandles: [0.42, 0, 0.58, 1],
      audioBinding,
    }

    const keyframeWithoutBinding: HephKeyframe = {
      timeMs: 1000,
      value: 1.0,
      interpolation: 'linear',
    }

    const curve: HephCurve = {
      paramId: 'intensity' as HephParamId,
      valueType: 'number',
      range: [0, 1],
      defaultValue: 0,
      keyframes: [
        { timeMs: 0, value: 0, interpolation: 'linear' },
        keyframeWithBinding,
        keyframeWithoutBinding,
      ],
      mode: 'additive',
    }

    const track: HephTrack = {
      id: 'track-intensity',
      paramId: 'intensity' as HephParamId,
      zones: ['all'] as readonly ZoneTarget[],
      curve,
    }

    return {
      id: 'test-clip-audio-binding',
      name: 'Test Audio Binding Clip',
      author: 'PunkOpus',
      category: 'physical' as import('../../effects/types').EffectCategory,
      tags: ['test', 'audio-reactive'],
      vibeCompat: ['high-energy'],
      spatialZones: ['movers-left', 'movers-right'] as readonly ZoneTarget[],
      mixBus: 'htp',
      priority: 5,
      durationMs: 2000,
      effectType: 'pulse',
      tracks: [track],
      staticParams: {},
      schemaVersion: '3.0',
    }
  }

  test('should preserve audioBinding through serialize cycle', () => {
    // ═══ ARRANGE ═══
    const originalClip = createTestClipWithAudioBinding()

    // ═══ ACT ═══
    const restored = serializeHephClip(originalClip)

    // ═══ ASSERT ═══
    const intensityTrack = restored.tracks.find(t => t.paramId === 'intensity' as HephParamId)
    expect(intensityTrack).toBeDefined()
    const restoredCurve = intensityTrack!.curve

    // Keyframe with audio binding
    const kfWithBinding = restoredCurve.keyframes[1]
    expect(kfWithBinding.audioBinding).toBeDefined()
    expect(kfWithBinding.audioBinding!.source).toBe('bass')
    expect(kfWithBinding.audioBinding!.inputRange).toEqual([0.2, 0.8])
    expect(kfWithBinding.audioBinding!.outputRange).toEqual([0, 1])
    expect(kfWithBinding.audioBinding!.smoothing).toBe(0.15)

    // Keyframe without audio binding
    const kfWithoutBinding = restoredCurve.keyframes[2]
    expect(kfWithoutBinding.audioBinding).toBeUndefined()

    // Also check mode persists
    expect(restoredCurve.mode).toBe('additive')
  })

  test('should handle all audio source types', () => {
    const sources: HephAudioBinding['source'][] = ['none', 'energy', 'bass', 'mids', 'highs']

    for (const source of sources) {
      const binding: HephAudioBinding = {
        source,
        inputRange: [0, 1],
        outputRange: [0, 1],
        smoothing: 0.1,
      }

      const clip = createTestClipWithAudioBinding()
      const track = clip.tracks.find(t => t.paramId === 'intensity' as HephParamId)!
      track.curve.keyframes[1].audioBinding = binding

      const restored = serializeHephClip(clip)

      const restoredTrack = restored.tracks.find(t => t.paramId === 'intensity' as HephParamId)!
      const restoredBinding = restoredTrack.curve.keyframes[1].audioBinding
      expect(restoredBinding?.source).toBe(source)
    }
  })

  test('should preserve spatialZones array through serialization', () => {
    const clip = createTestClipWithAudioBinding()
    
    const restored = serializeHephClip(clip)

    expect(restored.spatialZones).toEqual(['movers-left', 'movers-right'])
  })

  test('should handle empty spatialZones (meaning ALL zones)', () => {
    const clip = createTestClipWithAudioBinding()
    clip.spatialZones = []

    const restored = serializeHephClip(clip)

    expect(restored.spatialZones).toEqual([])
  })

  test('should preserve bezierHandles alongside audioBinding', () => {
    const clip = createTestClipWithAudioBinding()
    
    const restored = serializeHephClip(clip)

    const track = restored.tracks.find(t => t.paramId === 'intensity' as HephParamId)!
    const kf = track.curve.keyframes[1]
    expect(kf.bezierHandles).toEqual([0.42, 0, 0.58, 1])
    expect(kf.audioBinding).toBeDefined()
  })
})
