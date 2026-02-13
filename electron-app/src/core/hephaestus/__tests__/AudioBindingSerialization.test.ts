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
  HephAutomationClip, 
  HephCurve, 
  HephKeyframe,
  HephAudioBinding,
  HephParamId,
} from '../types'
import { serializeHephClip, deserializeHephClip } from '../types'

describe('WAVE 2030.14: Audio Binding Serialization', () => {
  /**
   * Creates a minimal clip with audio binding for testing.
   */
  function createTestClipWithAudioBinding(): HephAutomationClip {
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

    const curves = new Map<HephParamId, HephCurve>()
    curves.set('intensity' as HephParamId, curve)

    return {
      id: 'test-clip-audio-binding',
      name: 'Test Audio Binding Clip',
      author: 'PunkOpus',
      category: 'physical' as import('../../effects/types').EffectCategory,
      tags: ['test', 'audio-reactive'],
      vibeCompat: ['high-energy'],
      zones: ['movers_left', 'movers_right'] as import('../../effects/types').EffectZone[],
      mixBus: 'htp',
      priority: 5,
      durationMs: 2000,
      effectType: 'pulse',
      curves,
      staticParams: {},
    }
  }

  test('should preserve audioBinding through serialize → deserialize cycle', () => {
    // ═══ ARRANGE ═══
    const originalClip = createTestClipWithAudioBinding()

    // ═══ ACT ═══
    const serialized = serializeHephClip(originalClip)
    const restored = deserializeHephClip(serialized)

    // ═══ ASSERT ═══
    const restoredCurve = restored.curves.get('intensity' as HephParamId)
    expect(restoredCurve).toBeDefined()

    // Keyframe with audio binding
    const kfWithBinding = restoredCurve!.keyframes[1]
    expect(kfWithBinding.audioBinding).toBeDefined()
    expect(kfWithBinding.audioBinding!.source).toBe('bass')
    expect(kfWithBinding.audioBinding!.inputRange).toEqual([0.2, 0.8])
    expect(kfWithBinding.audioBinding!.outputRange).toEqual([0, 1])
    expect(kfWithBinding.audioBinding!.smoothing).toBe(0.15)

    // Keyframe without audio binding
    const kfWithoutBinding = restoredCurve!.keyframes[2]
    expect(kfWithoutBinding.audioBinding).toBeUndefined()

    // Also check mode persists
    expect(restoredCurve!.mode).toBe('additive')
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
      const curve = clip.curves.get('intensity' as HephParamId)!
      curve.keyframes[1].audioBinding = binding

      const serialized = serializeHephClip(clip)
      const restored = deserializeHephClip(serialized)

      const restoredBinding = restored.curves.get('intensity' as HephParamId)!.keyframes[1].audioBinding
      expect(restoredBinding?.source).toBe(source)
    }
  })

  test('should preserve zones array through serialization', () => {
    const clip = createTestClipWithAudioBinding()
    
    const serialized = serializeHephClip(clip)
    const restored = deserializeHephClip(serialized)

    expect(restored.zones).toEqual(['movers_left', 'movers_right'])
  })

  test('should handle empty zones (meaning ALL zones)', () => {
    const clip = createTestClipWithAudioBinding()
    clip.zones = []

    const serialized = serializeHephClip(clip)
    const restored = deserializeHephClip(serialized)

    expect(restored.zones).toEqual([])
  })

  test('should preserve bezierHandles alongside audioBinding', () => {
    const clip = createTestClipWithAudioBinding()
    
    const serialized = serializeHephClip(clip)
    const restored = deserializeHephClip(serialized)

    const kf = restored.curves.get('intensity' as HephParamId)!.keyframes[1]
    expect(kf.bezierHandles).toEqual([0.42, 0, 0.58, 1])
    expect(kf.audioBinding).toBeDefined()
  })
})
