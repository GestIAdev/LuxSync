import { describe, test, expect, beforeEach } from 'vitest'
import { BeamSystem } from '../systems/BeamSystem'
import type { AudioMetrics, VibeProfile, MusicalContext, FrameContext } from '../systems/BaseSystem'
import type { IBeamNodeData, ICapabilityNode } from '../capability-node'
import type { INodeView } from '../node-graph'
import type { IIntentBus, INodeIntent } from '../intent-bus'
import { NodeFamily } from '../types'

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
function makeBeam(o: Partial<IBeamNodeData> = {}): IBeamNodeData {
  return { nodeId: 'beam-001:beam', family: NodeFamily.BEAM, role: 'primary',
    deviceId: 'beam-001', zoneId: 'FRONT_WASH',
    hasGobo: true, hasGoboRotation: true, hasPrism: true, hasPrismRotation: true,
    hasZoom: true, hasFocus: true, hasFrost: true,
    channels: [], constraints: { maxSpeed: 100 } as any,
    state: new Float64Array(4), position: { x: 0, y: 4, z: 2 }, ...o,
  } as unknown as IBeamNodeData
}

describe('BeamSystem — Mechanical Hold Timers & Zoom', () => {
  let s: BeamSystem, b: ReturnType<typeof makeBus>
  beforeEach(() => { s = new BeamSystem(); b = makeBus() })

  test('gobo blocked at 500ms, allowed at 2001ms', () => {
    const n = makeBeam({ hasPrism: false, hasPrismRotation: false, hasGoboRotation: false, hasZoom: false, hasFocus: false, hasFrost: false })
    const v = makeView([n])
    s.process(v, makeCtx({ nowMs: 0, musical: makeMusical({ section: 'drop' }) }), b)
    expect(b.captured[0].values['gobo']).toBeDefined()
    b.clear()
    s.process(v, makeCtx({ nowMs: 500, musical: makeMusical({ section: 'drop' }) }), b)
    expect(b.captured[0].values['gobo']).toBeUndefined()
    b.clear()
    s.process(v, makeCtx({ nowMs: 2001, musical: makeMusical({ section: 'build' }) }), b)
    expect(b.captured[0].values['gobo']).toBeDefined()
  })

  test('prism blocked at 1000ms, allowed at 1501ms', () => {
    const n = makeBeam({ hasGobo: false, hasGoboRotation: false, hasZoom: false, hasFocus: false, hasFrost: false })
    n.state[1] = 0
    const v = makeView([n])
    s.process(v, makeCtx({ nowMs: 0, musical: makeMusical({ section: 'build' }) }), b)
    expect(b.captured[0].values['prism']).toBeDefined()
    b.clear()
    s.process(v, makeCtx({ nowMs: 1000, musical: makeMusical({ section: 'drop' }) }), b)
    expect(b.captured[0].values['prism']).toBeUndefined()
    b.clear()
    s.process(v, makeCtx({ nowMs: 1501, musical: makeMusical({ section: 'drop' }) }), b)
    expect(b.captured[0].values['prism']).toBeDefined()
  })

  test('zoom in drop is tight (~0.20) vs intro is wide (~0.80)', () => {
    const n = makeBeam({ hasGobo: false, hasGoboRotation: false, hasPrism: false, hasPrismRotation: false, hasFocus: false, hasFrost: false })
    const v = makeView([n])
    s.process(v, makeCtx({ nowMs: 0, musical: makeMusical({ section: 'drop' }), audio: makeAudio({ hasTransient: false, transientStrength: 0 }) }), b)
    const dropZoom = b.captured[0].values['zoom']!
    b.clear()
    s.process(v, makeCtx({ nowMs: 100, musical: makeMusical({ section: 'intro' }), audio: makeAudio({ hasTransient: false, transientStrength: 0 }) }), b)
    const introZoom = b.captured[0].values['zoom']!
    expect(dropZoom).toBeLessThan(introZoom)
    expect(dropZoom).toBeCloseTo(0.20, 1)
    expect(introZoom).toBeCloseTo(0.80, 1)
  })
})
