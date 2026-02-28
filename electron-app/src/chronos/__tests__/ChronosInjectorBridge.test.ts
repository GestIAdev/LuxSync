/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔌 WAVE 2083: CHRONOS TEST ARMY — PERIPHERAL COVERAGE
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Suite 10: ChronosInjector (Bridge) — "The Whisperer"
 * Tests: inject(), whisper vs full mode blending, modulators,
 * trigger tracking, seek detection reset, effect progress,
 * zone/color overrides, applyToMusicalContext.
 * 
 * AXIOMA ANTI-SIMULACIÓN: Zero Math.random(). All assertions deterministic.
 * 
 * @module chronos/__tests__/ChronosInjectorBridge
 * @version WAVE 2083
 */

import { describe, test, expect, beforeEach } from 'vitest'
import {
  ChronosInjector,
  getChronosInjector,
  resetChronosInjector,
} from '../bridge/ChronosInjector'
import type { ChronosOverrides } from '../bridge/ChronosInjector'
import type { ChronosContext, ChronosActiveEffect } from '../core/types'

// ═══════════════════════════════════════════════════════════════════════════
// 🏗️ DETERMINISTIC FIXTURES
// ═══════════════════════════════════════════════════════════════════════════

function makeContext(overrides: Partial<ChronosContext> = {}): ChronosContext {
  return {
    timestamp: 1000,
    active: true,
    overrideMode: 'whisper',
    vibeOverride: null,
    intensityOverride: null,
    zoneOverrides: null,
    colorOverride: null,
    activeEffects: [],
    automationValues: new Map(),
    ...overrides,
  }
}

function makeActiveEffect(overrides: Partial<ChronosActiveEffect> = {}): ChronosActiveEffect {
  return {
    effectId: 'strobe_burst',
    progress: 0.5,
    intensity: 0.8,
    speed: 1.0,
    zones: ['front'],
    params: {},
    sourceClipId: 'clip-001',
    ...overrides,
  }
}

function makeMusicalContext() {
  return {
    energy: 0.6,
    key: 'C' as const,
    confidence: 0.8,
    bpm: 128,
    beat: 1,
    section: 'drop',
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔌 BRIDGE INJECTOR TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('🔌 ChronosInjector Bridge — The Whisperer', () => {

  let injector: ChronosInjector

  beforeEach(() => {
    resetChronosInjector()
    injector = new ChronosInjector()
  })

  // ─────────────────────────────────────────────────────────────────────
  // SINGLETON
  // ─────────────────────────────────────────────────────────────────────

  describe('🔒 Singleton', () => {

    test('getChronosInjector returns same instance', () => {
      const a = getChronosInjector()
      const b = getChronosInjector()
      expect(a).toBe(b)
      expect(a).toBeInstanceOf(ChronosInjector)
    })

    test('resetChronosInjector creates fresh instance', () => {
      const first = getChronosInjector()
      resetChronosInjector()
      const second = getChronosInjector()
      expect(second).not.toBe(first)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // ENABLED / DISABLED
  // ─────────────────────────────────────────────────────────────────────

  describe('🔘 Enable / Disable', () => {

    test('starts enabled', () => {
      expect(injector.isEnabled()).toBe(true)
    })

    test('setEnabled(false) returns empty overrides', () => {
      injector.setEnabled(false)
      const result = injector.inject(makeContext())

      expect(result.active).toBe(false)
      expect(result.triggerEvents).toHaveLength(0)
    })

    test('setEnabled(false) resets internal state', () => {
      // Inject something first to populate state
      injector.inject(makeContext({ activeEffects: [makeActiveEffect()] }))

      injector.setEnabled(false)
      injector.setEnabled(true)

      // Inject same effect again → should trigger as new (state was reset)
      const result = injector.inject(makeContext({ 
        timestamp: 2000,
        activeEffects: [makeActiveEffect()] 
      }))
      expect(result.triggerEvents).toHaveLength(1)
      expect(result.triggerEvents[0].isNewTrigger).toBe(true)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // INJECT — BASIC
  // ─────────────────────────────────────────────────────────────────────

  describe('🔌 inject() — Basic', () => {

    test('inactive context returns empty overrides', () => {
      const result = injector.inject(makeContext({ active: false }))
      expect(result.active).toBe(false)
      expect(result.mode).toBe('whisper')
    })

    test('active context returns active overrides', () => {
      const result = injector.inject(makeContext())
      expect(result.active).toBe(true)
      expect(result.timestamp).toBe(1000)
    })

    test('override mode is propagated', () => {
      const resultW = injector.inject(makeContext({ overrideMode: 'whisper' }))
      expect(resultW.mode).toBe('whisper')

      // New injector for clean state
      const inj2 = new ChronosInjector()
      const resultF = inj2.inject(makeContext({ overrideMode: 'full' }))
      expect(resultF.mode).toBe('full')
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // FORCED VIBE
  // ─────────────────────────────────────────────────────────────────────

  describe('🎭 Forced Vibe Override', () => {

    test('no vibeOverride → forcedVibe is null', () => {
      const result = injector.inject(makeContext())
      expect(result.forcedVibe).toBeNull()
    })

    test('vibeOverride maps correctly', () => {
      const result = injector.inject(makeContext({
        vibeOverride: {
          vibeId: 'techno-club',
          transition: 'fade',
          progress: 0.75,
        }
      }))

      expect(result.forcedVibe).not.toBeNull()
      expect(result.forcedVibe!.vibeId).toBe('techno-club')
      expect(result.forcedVibe!.transition).toBe('fade')
      expect(result.forcedVibe!.transitionProgress).toBe(0.75)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // MODULATORS
  // ─────────────────────────────────────────────────────────────────────

  describe('🎛️ Modulators from Automation', () => {

    test('empty automation → all modulators null', () => {
      const result = injector.inject(makeContext())
      const m = result.modulators
      expect(m.masterIntensity).toBeNull()
      expect(m.masterSpeed).toBeNull()
      expect(m.hueOffset).toBeNull()
      expect(m.saturation).toBeNull()
      expect(m.energyOverride).toBeNull()
    })

    test('master.intensity maps to masterIntensity', () => {
      const automation = new Map<string, number>([['master.intensity', 0.7]])
      const result = injector.inject(makeContext({ automationValues: automation as any }))
      expect(result.modulators.masterIntensity).toBe(0.7)
    })

    test('master.speed maps to masterSpeed', () => {
      const automation = new Map<string, number>([['master.speed', 1.5]])
      const result = injector.inject(makeContext({ automationValues: automation as any }))
      expect(result.modulators.masterSpeed).toBe(1.5)
    })

    test('master.hue_offset maps to hueOffset (×360)', () => {
      const automation = new Map<string, number>([['master.hue_offset', 0.5]])
      const result = injector.inject(makeContext({ automationValues: automation as any }))
      expect(result.modulators.hueOffset).toBe(180) // 0.5 × 360
    })

    test('master.saturation maps to saturation', () => {
      const automation = new Map<string, number>([['master.saturation', 0.9]])
      const result = injector.inject(makeContext({ automationValues: automation as any }))
      expect(result.modulators.saturation).toBe(0.9)
    })

    test('selene.energy maps to energyOverride', () => {
      const automation = new Map<string, number>([['selene.energy', 0.4]])
      const result = injector.inject(makeContext({ automationValues: automation as any }))
      expect(result.modulators.energyOverride).toBe(0.4)
    })

    test('param.* maps to custom modulators', () => {
      const automation = new Map<string, number>([['param.myCustom', 0.33]])
      const result = injector.inject(makeContext({ automationValues: automation as any }))
      expect(result.modulators.custom.get('myCustom')).toBe(0.33)
    })

    test('intensityOverride from context overrides masterIntensity', () => {
      const automation = new Map<string, number>([['master.intensity', 0.7]])
      const result = injector.inject(makeContext({ 
        automationValues: automation as any,
        intensityOverride: 0.3,
      }))
      // intensityOverride wins over automation
      expect(result.modulators.masterIntensity).toBe(0.3)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // EFFECT TRIGGERS
  // ─────────────────────────────────────────────────────────────────────

  describe('⚡ Effect Triggers', () => {

    test('new effect generates trigger event', () => {
      const effect = makeActiveEffect()
      const result = injector.inject(makeContext({ activeEffects: [effect] }))

      expect(result.triggerEvents).toHaveLength(1)
      expect(result.triggerEvents[0].isNewTrigger).toBe(true)
      expect(result.triggerEvents[0].effectId).toBe('strobe_burst')
      expect(result.triggerEvents[0].intensity).toBe(0.8)
    })

    test('same effect on next tick does NOT re-trigger', () => {
      const effect = makeActiveEffect()
      injector.inject(makeContext({ timestamp: 1000, activeEffects: [effect] }))
      const result = injector.inject(makeContext({ timestamp: 1050, activeEffects: [effect] }))

      expect(result.triggerEvents).toHaveLength(0)
    })

    test('effect always appears in activeEffectsWithProgress', () => {
      const effect = makeActiveEffect({ progress: 0.7 })
      const result = injector.inject(makeContext({ activeEffects: [effect] }))

      expect(result.activeEffectsWithProgress).toHaveLength(1)
      expect(result.activeEffectsWithProgress[0].progress).toBe(0.7)
      expect(result.activeEffectsWithProgress[0].effectId).toBe('strobe_burst')
    })

    test('effect removed from activeEffects clears trigger tracking', () => {
      const effect = makeActiveEffect()
      injector.inject(makeContext({ timestamp: 1000, activeEffects: [effect] }))
      // Effect no longer active
      injector.inject(makeContext({ timestamp: 2000, activeEffects: [] }))
      // Effect appears again → should trigger as new
      const result = injector.inject(makeContext({ timestamp: 3000, activeEffects: [effect] }))

      expect(result.triggerEvents).toHaveLength(1)
      expect(result.triggerEvents[0].isNewTrigger).toBe(true)
    })

    test('registerEffectInstance links clipId to instanceId', () => {
      const effect = makeActiveEffect({ sourceClipId: 'clip-007' })
      injector.registerEffectInstance('clip-007', 'instance-42')

      const result = injector.inject(makeContext({ activeEffects: [effect] }))
      expect(result.activeEffectsWithProgress[0].instanceId).toBe('instance-42')
    })

    test('unregisterEffectInstance clears the mapping', () => {
      injector.registerEffectInstance('clip-007', 'instance-42')
      injector.unregisterEffectInstance('clip-007')

      const effect = makeActiveEffect({ sourceClipId: 'clip-007' })
      const result = injector.inject(makeContext({ activeEffects: [effect] }))
      expect(result.activeEffectsWithProgress[0].instanceId).toBeNull()
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // SEEK DETECTION
  // ─────────────────────────────────────────────────────────────────────

  describe('🔀 Seek Detection', () => {

    test('large timestamp jump clears trigger tracking', () => {
      const effect = makeActiveEffect()
      injector.inject(makeContext({ timestamp: 1000, activeEffects: [effect] }))

      // Jump >100ms → seek detected → triggers reset
      const result = injector.inject(makeContext({ timestamp: 5000, activeEffects: [effect] }))
      expect(result.triggerEvents).toHaveLength(1) // Re-triggered!
      expect(result.triggerEvents[0].isNewTrigger).toBe(true)
    })

    test('small timestamp step does NOT reset triggers', () => {
      const effect = makeActiveEffect()
      injector.inject(makeContext({ timestamp: 1000, activeEffects: [effect] }))

      // Step <100ms → NOT a seek
      const result = injector.inject(makeContext({ timestamp: 1050, activeEffects: [effect] }))
      expect(result.triggerEvents).toHaveLength(0) // NOT re-triggered
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // ZONE OVERRIDES
  // ─────────────────────────────────────────────────────────────────────

  describe('🎯 Zone Overrides', () => {

    test('no zoneOverrides → null', () => {
      const result = injector.inject(makeContext())
      expect(result.zoneOverride).toBeNull()
    })

    test('zoneOverrides map correctly', () => {
      const result = injector.inject(makeContext({
        zoneOverrides: {
          enabledZones: ['front', 'back'],
          blackoutDisabled: true,
        }
      }))

      expect(result.zoneOverride).not.toBeNull()
      expect(result.zoneOverride!.enabledZones).toEqual(['front', 'back'])
      expect(result.zoneOverride!.blackoutDisabled).toBe(true)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // COLOR OVERRIDES
  // ─────────────────────────────────────────────────────────────────────

  describe('🎨 Color Overrides', () => {

    test('no colorOverride → null', () => {
      const result = injector.inject(makeContext())
      expect(result.colorOverride).toBeNull()
    })

    test('colorOverride maps correctly', () => {
      const result = injector.inject(makeContext({
        colorOverride: {
          palette: { primary: '#ff0000', secondary: '#00ff00', accent: '#0000ff' },
          keyLock: 'Am',
        }
      }))

      expect(result.colorOverride).not.toBeNull()
      expect(result.colorOverride!.palette.primary).toBe('#ff0000')
      expect(result.colorOverride!.keyLock).toBe('Am')
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // APPLY TO MUSICAL CONTEXT
  // ─────────────────────────────────────────────────────────────────────

  describe('📊 applyToMusicalContext', () => {

    test('inactive overrides return original context unchanged', () => {
      const original = makeMusicalContext()
      const overrides: ChronosOverrides = {
        active: false,
        mode: 'whisper',
        timestamp: 1000,
        forcedVibe: null,
        modulators: {
          masterIntensity: null,
          masterSpeed: null,
          hueOffset: null,
          saturation: null,
          energyOverride: null,
          custom: new Map(),
        },
        triggerEvents: [],
        activeEffectsWithProgress: [],
        zoneOverride: null,
        colorOverride: null,
      }

      const result = injector.applyToMusicalContext(original as any, overrides)
      expect(result).toBe(original) // Same reference, no modification
    })

    test('whisper mode blends energy (70/30)', () => {
      const original = makeMusicalContext()
      original.energy = 0.4

      const overrides: ChronosOverrides = {
        active: true,
        mode: 'whisper',
        timestamp: 1000,
        forcedVibe: null,
        modulators: {
          masterIntensity: null,
          masterSpeed: null,
          hueOffset: null,
          saturation: null,
          energyOverride: 1.0, // Chronos wants full energy
          custom: new Map(),
        },
        triggerEvents: [],
        activeEffectsWithProgress: [],
        zoneOverride: null,
        colorOverride: null,
      }

      const result = injector.applyToMusicalContext(original as any, overrides)
      // Whisper: 1.0 × 0.7 + 0.4 × 0.3 = 0.70 + 0.12 = 0.82
      expect(result.energy).toBeCloseTo(0.82, 5)
    })

    test('full mode dictates energy completely', () => {
      const original = makeMusicalContext()
      original.energy = 0.4

      const overrides: ChronosOverrides = {
        active: true,
        mode: 'full',
        timestamp: 1000,
        forcedVibe: null,
        modulators: {
          masterIntensity: null,
          masterSpeed: null,
          hueOffset: null,
          saturation: null,
          energyOverride: 0.9,
          custom: new Map(),
        },
        triggerEvents: [],
        activeEffectsWithProgress: [],
        zoneOverride: null,
        colorOverride: null,
      }

      const result = injector.applyToMusicalContext(original as any, overrides)
      expect(result.energy).toBe(0.9)
    })

    test('masterIntensity scales energy', () => {
      const original = makeMusicalContext()
      original.energy = 0.5

      const overrides: ChronosOverrides = {
        active: true,
        mode: 'full',
        timestamp: 1000,
        forcedVibe: null,
        modulators: {
          masterIntensity: 0.5, // Half intensity
          masterSpeed: null,
          hueOffset: null,
          saturation: null,
          energyOverride: 0.8,
          custom: new Map(),
        },
        triggerEvents: [],
        activeEffectsWithProgress: [],
        zoneOverride: null,
        colorOverride: null,
      }

      const result = injector.applyToMusicalContext(original as any, overrides)
      // energy = 0.8 (full mode) × 0.5 (masterIntensity) = 0.4
      expect(result.energy).toBeCloseTo(0.4, 5)
    })

    test('keyLock forces key and confidence=1.0', () => {
      const original = makeMusicalContext()

      const overrides: ChronosOverrides = {
        active: true,
        mode: 'whisper',
        timestamp: 1000,
        forcedVibe: null,
        modulators: {
          masterIntensity: null,
          masterSpeed: null,
          hueOffset: null,
          saturation: null,
          energyOverride: null,
          custom: new Map(),
        },
        triggerEvents: [],
        activeEffectsWithProgress: [],
        zoneOverride: null,
        colorOverride: {
          palette: { primary: '#ff0000', secondary: '#00ff00', accent: '#0000ff' },
          keyLock: 'Am',
        },
      }

      const result = injector.applyToMusicalContext(original as any, overrides)
      expect(result.key).toBe('Am')
      expect(result.confidence).toBe(1.0)
    })

    test('_fromChronos and _chronosTimestamp are set', () => {
      const original = makeMusicalContext()
      const overrides: ChronosOverrides = {
        active: true,
        mode: 'whisper',
        timestamp: 4242,
        forcedVibe: null,
        modulators: {
          masterIntensity: null,
          masterSpeed: null,
          hueOffset: null,
          saturation: null,
          energyOverride: null,
          custom: new Map(),
        },
        triggerEvents: [],
        activeEffectsWithProgress: [],
        zoneOverride: null,
        colorOverride: null,
      }

      const result = injector.applyToMusicalContext(original as any, overrides)
      expect((result as any)._fromChronos).toBe(true)
      expect((result as any)._chronosTimestamp).toBe(4242)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // RESET
  // ─────────────────────────────────────────────────────────────────────

  describe('🔄 Reset', () => {

    test('reset clears trigger tracking', () => {
      const effect = makeActiveEffect()
      injector.inject(makeContext({ timestamp: 1000, activeEffects: [effect] }))

      injector.reset()

      // Same effect should trigger as new
      const result = injector.inject(makeContext({ timestamp: 1010, activeEffects: [effect] }))
      expect(result.triggerEvents).toHaveLength(1)
    })

    test('reset clears effect instance map', () => {
      injector.registerEffectInstance('clip-007', 'inst-42')
      injector.reset()

      const effect = makeActiveEffect({ sourceClipId: 'clip-007' })
      const result = injector.inject(makeContext({ activeEffects: [effect] }))
      expect(result.activeEffectsWithProgress[0].instanceId).toBeNull()
    })

    test('reset clears lastTimestamp', () => {
      injector.inject(makeContext({ timestamp: 5000 }))
      injector.reset()

      // Timestamp 5010 from 0 would be a seek (>100ms jump) if not reset
      // But since reset cleared lastTimestamp to 0, 5010-0 > 100 IS a seek
      // The real test: after reset + inject at 100, a step to 150 should NOT seek
      injector.inject(makeContext({ timestamp: 100, activeEffects: [makeActiveEffect()] }))
      const result = injector.inject(makeContext({ timestamp: 150, activeEffects: [makeActiveEffect()] }))
      expect(result.triggerEvents).toHaveLength(0) // Not re-triggered (no seek)
    })
  })
})
