import { describe, test, expect, beforeEach } from 'vitest'
import { AtmosphereSystem } from '../systems/AtmosphereSystem'
import type { AudioMetrics, VibeProfile, MusicalContext, FrameContext } from '../systems/BaseSystem'
import type { IAtmosphereNodeData, ICapabilityNode } from '../capability-node'
import type { INodeView } from '../node-graph'
import type { IIntentBus, INodeIntent } from '../intent-bus'
import { NodeFamily } from '../types'
import type { AtmosphereSafetyState } from '../types'

function makeAudio(o: Partial<AudioMetrics> = {}): AudioMetrics {
  return { subBass: 0.6, bass: 0.7, mid: 0.5, highMid: 0.4, presence: 0.3, air: 0.2,
    energy: 0.65, hasTransient: false, transientStrength: 0, bpm: 128, beatPhase: 0.25, beatCount: 16, ...o }
}
function makeVibe(o: Partial<VibeProfile> = {}): VibeProfile {
  return { name: 'techno-club', palette: [{ h: 0.02, s: 0.9, l: 0.5 }, { h: 0.58, s: 0.8, l: 0.45 }],
    movementSpeed: 0.7, intensity: 0.8, beamExpressiveness: 0.5, ...o }
}
function makeMusical(o: Partial<MusicalContext> = {}): MusicalContext {
  return { section: 'drop', dropImminent: false, sectionIntensity: 0.8,
    harmonicTension: 0.3, sectionElapsedMs: 4000, ...o }
}
function makeCtx(o: Partial<FrameContext> = {}): FrameContext {
  return { audio: makeAudio(), musical: makeMusical(), vibe: makeVibe(),
    nowMs: 1000, deltaMs: 22, frameIndex: 1, ...o }
}
function makeBus(): IIntentBus & { captured: INodeIntent[] } {
  const c: INodeIntent[] = []
  return {
    captured: c,
    push(i: INodeIntent): void { c.push({ nodeId: i.nodeId, values: { ...i.values }, priority: i.priority, confidence: i.confidence, source: i.source }) },
    clear(): void { c.length = 0 },
    buildIndex(): void { },
    getIntentsForNode(_id: string): readonly INodeIntent[] { return [] },
    forEach(_fn: (i: INodeIntent) => void): void { c.forEach(_fn) },
    get size(): number { return c.length },
    get overflowed(): boolean { return false },
  } as unknown as IIntentBus & { captured: INodeIntent[] }
}
function makeView<T extends ICapabilityNode>(nodes: T[]): INodeView<T> {
  return { get count(): number { return nodes.length },
    forEach(fn: (n: T, i: number) => void): void { nodes.forEach((n, i) => fn(n, i)) },
    get(i: number): T { return nodes[i] }, byZone(): T[] { return [...nodes] }, byRole(): T[] { return [...nodes] } }
}
function makeSafety(o: Partial<AtmosphereSafetyState> = {}): AtmosphereSafetyState {
  return { lastActivationMs: 0, totalActiveMs: 0, cooldownRemaining: 0, ...o }
}
function makeAtmos(type: 'fog' | 'haze' | 'spark' | 'fan' | 'pyro' | 'custom', o: Partial<IAtmosphereNodeData> = {}): IAtmosphereNodeData {
  return { nodeId: 'atmos-001:atmos', family: NodeFamily.ATMOSPHERE, role: 'primary',
    deviceId: 'atmos-001', zoneId: 'STAGE_CENTER', atmosType: type,
    channels: [], constraints: { maxSpeed: 100 } as any,
    state: new Float64Array(4), position: { x: 0, y: 2, z: 0 },
    safety: makeSafety(), ...o,
  } as unknown as IAtmosphereNodeData
}

describe('AtmosphereSystem — Safety Gates & Fan', () => {
  let s: AtmosphereSystem, b: ReturnType<typeof makeBus>
  beforeEach(() => { s = new AtmosphereSystem(); b = makeBus() })

  test('Gate 2 Overheat: fog running 180s forces output=0 at second 181', () => {
    const n = makeAtmos('fog', { safety: makeSafety({ totalActiveMs: 181_000 }) })
    const v = makeView([n])
    s.process(v, makeCtx({ nowMs: 181_000, musical: makeMusical({ section: 'drop' }) }), b)
    expect(b.captured.length).toBe(1)
    expect(b.captured[0].values['output']).toBe(0)
    expect(b.captured[0].values['fan_speed']).toBeGreaterThan(0)
  })

  test('Gate 2 Normal: fog under 180s emits output > 0', () => {
    const n = makeAtmos('fog', { safety: makeSafety({ totalActiveMs: 60_000 }) })
    const v = makeView([n])
    s.process(v, makeCtx({ nowMs: 60_000, musical: makeMusical({ section: 'drop' }) }), b)
    expect(b.captured[0].values['output']).toBeGreaterThan(0)
  })

  test('Gate 3 Spark: blocked when energy=0.5 even in drop', () => {
    const n = makeAtmos('spark')
    const v = makeView([n])
    s.process(v, makeCtx({ audio: makeAudio({ energy: 0.5, hasTransient: true, transientStrength: 0.9 }), musical: makeMusical({ section: 'drop' }), vibe: makeVibe({ intensity: 0.9 }) }), b)
    expect(b.captured[0].values['output']).toBe(0)
  })

  test('Gate 3 Spark: blocked in build even with energy=0.9', () => {
    const n = makeAtmos('spark')
    const v = makeView([n])
    s.process(v, makeCtx({ audio: makeAudio({ energy: 0.9, hasTransient: true, transientStrength: 0.9 }), musical: makeMusical({ section: 'build' }), vibe: makeVibe({ intensity: 0.9 }) }), b)
    expect(b.captured[0].values['output']).toBe(0)
  })

  test('Gate 3 Spark: allowed in drop with energy>0.80 and vibe>=0.7', () => {
    const n = makeAtmos('spark')
    const v = makeView([n])
    s.process(v, makeCtx({ audio: makeAudio({ energy: 0.85, hasTransient: true, transientStrength: 0.9 }), musical: makeMusical({ section: 'drop' }), vibe: makeVibe({ intensity: 0.8 }) }), b)
    expect(b.captured[0].values['output']).toBeGreaterThan(0)
  })

  test('Gate 1 Cooldown: any cooldownRemaining>0 forces shutdown output=0', () => {
    const n = makeAtmos('fog', { safety: makeSafety({ cooldownRemaining: 1, totalActiveMs: 0 }) })
    const v = makeView([n])
    s.process(v, makeCtx({ nowMs: 0, musical: makeMusical({ section: 'drop' }) }), b)
    expect(b.captured[0].values['output']).toBe(0)
    expect(b.captured[0].values['fan_speed']).toBe(0.10)
  })

  test('Fan speed modulates with audio energy (low vs high)', () => {
    const n = makeAtmos('fan')
    const v = makeView([n])
    s.process(v, makeCtx({ audio: makeAudio({ energy: 0.1 }), musical: makeMusical({ section: 'verse' }) }), b)
    const low = b.captured[0].values['fan_speed']!
    b.clear()
    s.process(v, makeCtx({ audio: makeAudio({ energy: 0.95 }), musical: makeMusical({ section: 'drop' }) }), b)
    const high = b.captured[0].values['fan_speed']!
    expect(high).toBeGreaterThan(low)
  })
})
