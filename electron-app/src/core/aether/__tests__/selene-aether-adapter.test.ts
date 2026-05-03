import { describe, test, expect, vi } from 'vitest'

import { SeleneAetherAdapter } from '../adapters/selene-aether-adapter'
import { NodeFamily } from '../types'

import type { IIntentBus, INodeIntent } from '../intent-bus'
import type { CombinedEffectOutput, EffectZone } from '../../effects/types'
import type { ConsciousnessOutput } from '../../protocol/ConsciousnessOutput'
import type { IZoneNodeRouter } from '../adapters/helpers/zone-node-router'

function makeEffectOutput(overrides: Partial<CombinedEffectOutput> = {}): CombinedEffectOutput {
  return {
    hasActiveEffects: true,
    intensity: 1,
    contributingEffects: ['test-effect'],
    globalComposition: 1,
    ...overrides,
  }
}

function makeConsciousness(overrides: Partial<ConsciousnessOutput> = {}): ConsciousnessOutput {
  return {
    colorDecision: null,
    physicsModifier: null,
    movementDecision: null,
    effectDecision: null,
    confidence: 1,
    timestamp: 123456,
    source: 'hunt',
    debugInfo: {
      huntState: 'sleeping',
      beautyScore: 0,
      consonance: 0,
      beautyTrend: 'stable',
      biasesDetected: [],
      cyclesInCurrentState: 0,
    },
    ...overrides,
  }
}

function makeRouterMock(): { router: IZoneNodeRouter; resolve: ReturnType<typeof vi.fn> } {
  const resolve = vi.fn((zone: EffectZone, family: NodeFamily): readonly string[] => {
    if (zone === 'all' && family === NodeFamily.IMPACT) return ['impact-1']
    if (zone === 'all' && family === NodeFamily.COLOR) return ['color-1']
    if (zone === 'front' && family === NodeFamily.IMPACT) return ['impact-front-1']
    if (zone === 'front' && family === NodeFamily.COLOR) return ['color-front-1']
    return []
  })

  return {
    resolve,
    router: { resolve },
  }
}

function makeCaptureBus(): { bus: IIntentBus; captured: INodeIntent[]; pushSpy: ReturnType<typeof vi.fn> } {
  const captured: INodeIntent[] = []
  const pushSpy = vi.fn((intent: INodeIntent) => {
    captured.push({
      nodeId: intent.nodeId,
      values: { ...intent.values },
      priority: intent.priority,
      confidence: intent.confidence,
      source: intent.source,
    })
    return true
  })

  const bus: IIntentBus = {
    push: pushSpy,
    clear: vi.fn(),
    getIntentsForNode: vi.fn(() => []),
    buildIndex: vi.fn(),
    forEach: vi.fn(),
    size: 0,
    overflowed: false,
  } as unknown as IIntentBus

  return { bus, captured, pushSpy }
}

describe('SeleneAetherAdapter — WAVE 4524.4', () => {
  test('Test 1 — Traducción atómica: dimmer + color HSL con priority=300 y source effect', () => {
    const { router } = makeRouterMock()
    const { bus, captured } = makeCaptureBus()
    const adapter = new SeleneAetherAdapter(router)

    const effect = makeEffectOutput({
      dimmerOverride: 0.7,
      colorOverride: { h: 0, s: 100, l: 50 },
      globalComposition: 0.9,
    })

    adapter.ingest(null, effect, 16, bus)

    const dimmerIntent = captured.find((i) => i.nodeId === 'impact-1')
    const colorIntent = captured.find((i) => i.nodeId === 'color-1')

    expect(dimmerIntent).toBeDefined()
    expect(colorIntent).toBeDefined()

    expect(dimmerIntent!.values['dimmer']).toBeCloseTo(0.7, 6)
    expect(dimmerIntent!.priority).toBe(300)
    expect(dimmerIntent!.source).toBe('effect')

    expect(colorIntent!.values['r']).toBeCloseTo(1, 6)
    expect(colorIntent!.values['g']).toBeCloseTo(0, 6)
    expect(colorIntent!.values['b']).toBeCloseTo(0, 6)
    expect(colorIntent!.priority).toBe(300)
    expect(colorIntent!.source).toBe('effect')
  })

  test('Test 2 — Gate de composición: globalComposition<0.01 hace early-exit', () => {
    const { router, resolve } = makeRouterMock()
    const { bus, pushSpy } = makeCaptureBus()
    const adapter = new SeleneAetherAdapter(router)

    const effect = makeEffectOutput({
      globalComposition: 0.005,
      dimmerOverride: 1,
      colorOverride: { h: 120, s: 100, l: 50 },
    })

    adapter.ingest(null, effect, 16, bus)

    expect(pushSpy).not.toHaveBeenCalled()
    expect(resolve).not.toHaveBeenCalled()
  })

  test('Test 3 — El muro de movimiento: ignora movement y nunca emite target/pan/tilt', () => {
    const { router } = makeRouterMock()
    const { bus, captured } = makeCaptureBus()
    const adapter = new SeleneAetherAdapter(router)

    const effect = makeEffectOutput({
      globalComposition: 1,
      zoneOverrides: {
        front: {
          dimmer: 0.55,
          movement: {
            pan: 0.9,
            tilt: 0.1,
            isAbsolute: true,
            speed: 1,
          },
        },
      },
    })

    adapter.ingest(null, effect, 16, bus)

    expect(captured.length).toBeGreaterThan(0)
    for (const intent of captured) {
      expect(intent.values['targetX']).toBeUndefined()
      expect(intent.values['targetY']).toBeUndefined()
      expect(intent.values['targetZ']).toBeUndefined()
      expect(intent.values['pan']).toBeUndefined()
      expect(intent.values['tilt']).toBeUndefined()
    }
  })

  test('Test 4 — Strobe physics: solo pasa con energy<0.85 y confidence>0.5', () => {
    const { router } = makeRouterMock()
    const { bus, captured, pushSpy } = makeCaptureBus()
    const adapter = new SeleneAetherAdapter(router)

    const baseEffect = makeEffectOutput({ globalComposition: 1 })

    const allowed = makeConsciousness({
      physicsModifier: {
        strobeIntensity: 0.8,
        flashIntensity: 0.9,
        confidence: 0.9,
      },
      debugInfo: {
        huntState: 'sleeping',
        beautyScore: 0,
        consonance: 0,
        beautyTrend: 'stable',
        biasesDetected: [],
        cyclesInCurrentState: 0,
        smoothedEnergy: 0.6,
      } as ConsciousnessOutput['debugInfo'],
    })

    adapter.ingest(allowed, baseEffect, 16, bus)
    const allowedStrobe = captured.find((i) => i.nodeId === 'impact-1' && i.values['strobeRate'] !== undefined)
    expect(allowedStrobe).toBeDefined()
    expect(allowedStrobe!.values['strobeRate']).toBeCloseTo(0.8, 6)
    expect(allowedStrobe!.values['shutter']).toBe(1)

    captured.length = 0
    pushSpy.mockClear()

    const blockedByEnergy = makeConsciousness({
      physicsModifier: {
        strobeIntensity: 0.8,
        flashIntensity: 0.9,
        confidence: 0.9,
      },
      debugInfo: {
        huntState: 'sleeping',
        beautyScore: 0,
        consonance: 0,
        beautyTrend: 'stable',
        biasesDetected: [],
        cyclesInCurrentState: 0,
        smoothedEnergy: 0.95,
      } as ConsciousnessOutput['debugInfo'],
    })

    adapter.ingest(blockedByEnergy, baseEffect, 16, bus)
    expect(pushSpy).not.toHaveBeenCalled()

    const blockedByConfidence = makeConsciousness({
      physicsModifier: {
        strobeIntensity: 0.8,
        flashIntensity: 0.9,
        confidence: 0.4,
      },
      debugInfo: {
        huntState: 'sleeping',
        beautyScore: 0,
        consonance: 0,
        beautyTrend: 'stable',
        biasesDetected: [],
        cyclesInCurrentState: 0,
        smoothedEnergy: 0.2,
      } as ConsciousnessOutput['debugInfo'],
    })

    adapter.ingest(blockedByConfidence, baseEffect, 16, bus)
    expect(pushSpy).not.toHaveBeenCalled()
  })
})
