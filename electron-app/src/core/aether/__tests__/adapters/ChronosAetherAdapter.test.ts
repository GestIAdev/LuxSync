import { describe, test, expect, vi } from 'vitest'

import { ChronosAetherAdapter } from '../../adapters/ChronosAetherAdapter'
import { NodeFamily, type NodeId } from '../../types'

import type { INodeArbiter } from '../../intent-bus'
import type { INodeGraph } from '../../node-graph'
import type { PlaybackFrameSnapshot, TimelineEngine, ChronosFixtureTarget } from '../../../engine/TimelineEngine'

type NodeShape = {
  nodeId: NodeId
  family: NodeFamily
  channels?: Array<{ type: string }>
}

type MockGraphState = {
  views: Record<NodeFamily, NodeShape[]>
  deviceNodes: Map<string, NodeId[]>
  nodesById: Map<NodeId, NodeShape>
}

function makeMockGraphState(): MockGraphState {
  return {
    views: {
      [NodeFamily.IMPACT]: [],
      [NodeFamily.COLOR]: [],
      [NodeFamily.KINETIC]: [],
      [NodeFamily.BEAM]: [],
      [NodeFamily.ATMOSPHERE]: [],
    },
    deviceNodes: new Map<string, NodeId[]>(),
    nodesById: new Map<NodeId, NodeShape>(),
  }
}

function makeNodeView<T extends NodeShape>(nodes: T[]) {
  return {
    count: nodes.length,
    forEach: (fn: (node: T, index: number) => void): void => {
      for (let i = 0; i < nodes.length; i++) {
        fn(nodes[i], i)
      }
    },
    get: (index: number): T => nodes[index],
    byZone: (): T[] => [],
    byRole: (): T[] => [],
  }
}

function makeGraphMock(state: MockGraphState) {
  const getView = vi.fn((family: NodeFamily) => {
    const nodes = state.views[family] ?? []
    return makeNodeView(nodes)
  })

  const getDeviceNodes = vi.fn((deviceId: string) => {
    return state.deviceNodes.get(deviceId) ?? []
  })

  const getNodeData = vi.fn((nodeId: NodeId) => {
    return state.nodesById.get(nodeId)
  })

  const graph = {
    getView,
    getDeviceNodes,
    getNodeData,
  } as unknown as INodeGraph

  return { graph, getView, getDeviceNodes, getNodeData }
}

function makeTarget(overrides: Partial<ChronosFixtureTarget> = {}): ChronosFixtureTarget {
  return {
    fixtureId: 'fixture-1',
    dimmer: 255,
    red: 128,
    green: 64,
    blue: 32,
    white: 0,
    pan: 127,
    tilt: 127,
    zoom: 0,
    speed: 127,
    colorTouched: true,
    blendMode: 'HTP',
    ...overrides,
  }
}

function makeSnapshot(targets: ChronosFixtureTarget[], tickMs: number): PlaybackFrameSnapshot {
  return {
    targets,
    hasActiveVibe: false,
    vibeId: null,
    tickMs,
  }
}

function makeTimeline(snapshot: PlaybackFrameSnapshot | null, isPlaying = true): TimelineEngine {
  return {
    isPlaying,
    getLastPlaybackFrame: () => snapshot,
  } as unknown as TimelineEngine
}

function makeArbiterSpy() {
  const setPlaybackIntents = vi.fn()
  const arbiter = {
    setPlaybackIntents,
  } as unknown as INodeArbiter

  return { arbiter, setPlaybackIntents }
}

describe('ChronosAetherAdapter', () => {
  test('CASO 1: cache-and-replay reutiliza exactamente el mismo array e intents para el mismo tick', () => {
    const state = makeMockGraphState()
    const impactNode: NodeShape = { nodeId: 'fixture-1:impact' as NodeId, family: NodeFamily.IMPACT }

    state.views[NodeFamily.IMPACT] = [impactNode]
    state.deviceNodes.set('fixture-1', [impactNode.nodeId])
    state.nodesById.set(impactNode.nodeId, {
      ...impactNode,
      channels: [{ type: 'dimmer' }],
    })

    const { graph, getDeviceNodes } = makeGraphMock(state)
    const adapter = new ChronosAetherAdapter(graph)
    const { arbiter, setPlaybackIntents } = makeArbiterSpy()

    const snapshot = makeSnapshot([makeTarget({ dimmer: 200 })], 1000)
    const timeline = makeTimeline(snapshot, true)

    adapter.ingest(timeline, 16, arbiter)
    adapter.ingest(timeline, 16, arbiter)

    expect(setPlaybackIntents).toHaveBeenCalledTimes(2)
    expect(getDeviceNodes).toHaveBeenCalledTimes(1)

    const firstArray = setPlaybackIntents.mock.calls[0][0] as Array<{ nodeId: NodeId; values: Record<string, number> }>
    const secondArray = setPlaybackIntents.mock.calls[1][0] as Array<{ nodeId: NodeId; values: Record<string, number> }>

    expect(secondArray).toBe(firstArray)
    expect(secondArray[0]).toBe(firstArray[0])
    expect(secondArray[0].values).toBe(firstArray[0].values)
  })

  test('CASO 2: colorTouched=false omite estrictamente intents COLOR', () => {
    const state = makeMockGraphState()
    const impactNode: NodeShape = { nodeId: 'fixture-1:impact' as NodeId, family: NodeFamily.IMPACT }
    const colorNode: NodeShape = { nodeId: 'fixture-1:color' as NodeId, family: NodeFamily.COLOR }
    const kineticNode: NodeShape = { nodeId: 'fixture-1:kinetic' as NodeId, family: NodeFamily.KINETIC }

    state.views[NodeFamily.IMPACT] = [impactNode]
    state.views[NodeFamily.COLOR] = [colorNode]
    state.views[NodeFamily.KINETIC] = [kineticNode]

    state.deviceNodes.set('fixture-1', [impactNode.nodeId, colorNode.nodeId, kineticNode.nodeId])
    state.nodesById.set(impactNode.nodeId, { ...impactNode, channels: [{ type: 'dimmer' }] })
    state.nodesById.set(colorNode.nodeId, { ...colorNode, channels: [{ type: 'red' }] })
    state.nodesById.set(kineticNode.nodeId, { ...kineticNode, channels: [{ type: 'pan' }] })

    const { graph } = makeGraphMock(state)
    const adapter = new ChronosAetherAdapter(graph)
    const { arbiter, setPlaybackIntents } = makeArbiterSpy()

    const target = makeTarget({
      colorTouched: false,
      red: 255,
      green: 255,
      blue: 255,
      dimmer: 180,
      pan: 200,
      tilt: 180,
      speed: 100,
    })

    adapter.ingest(makeTimeline(makeSnapshot([target], 2000), true), 16, arbiter)

    const intents = setPlaybackIntents.mock.calls[0][0] as Array<{ nodeId: NodeId; values: Record<string, number> }>

    expect(intents.some((intent) => intent.nodeId === impactNode.nodeId)).toBe(true)
    expect(intents.some((intent) => intent.nodeId === kineticNode.nodeId)).toBe(true)
    expect(intents.some((intent) => intent.nodeId === colorNode.nodeId)).toBe(false)
  })

  test('CASO 3: blackout LTP con dimmer=0 emite shutter=0 si IMPACT soporta shutter', () => {
    const state = makeMockGraphState()
    const impactNode: NodeShape = {
      nodeId: 'fixture-1:impact' as NodeId,
      family: NodeFamily.IMPACT,
      channels: [{ type: 'dimmer' }, { type: 'shutter' }],
    }

    state.views[NodeFamily.IMPACT] = [impactNode]
    state.deviceNodes.set('fixture-1', [impactNode.nodeId])
    state.nodesById.set(impactNode.nodeId, impactNode)

    const { graph } = makeGraphMock(state)
    const adapter = new ChronosAetherAdapter(graph)
    const { arbiter, setPlaybackIntents } = makeArbiterSpy()

    const target = makeTarget({
      blendMode: 'LTP',
      dimmer: 0,
      pan: 0,
      tilt: 0,
      speed: 0,
      colorTouched: false,
    })

    adapter.ingest(makeTimeline(makeSnapshot([target], 3000), true), 16, arbiter)

    const intents = setPlaybackIntents.mock.calls[0][0] as Array<{ nodeId: NodeId; values: Record<string, number> }>
    expect(intents).toHaveLength(1)
    expect(intents[0].nodeId).toBe(impactNode.nodeId)
    expect(intents[0].values['dimmer']).toBe(0)
    expect(intents[0].values['shutter']).toBe(0)
  })

  test('CASO 4A: si Timeline isPlaying=false limpia capa LP con array vacío', () => {
    const state = makeMockGraphState()
    const { graph } = makeGraphMock(state)
    const adapter = new ChronosAetherAdapter(graph)
    const { arbiter, setPlaybackIntents } = makeArbiterSpy()

    adapter.ingest(makeTimeline(makeSnapshot([makeTarget()], 4000), false), 16, arbiter)

    const intents = setPlaybackIntents.mock.calls[0][0] as Array<unknown>
    expect(Array.isArray(intents)).toBe(true)
    expect(intents).toHaveLength(0)
  })

  test('CASO 4B: si getLastPlaybackFrame()===null limpia capa LP con array vacío', () => {
    const state = makeMockGraphState()
    const { graph } = makeGraphMock(state)
    const adapter = new ChronosAetherAdapter(graph)
    const { arbiter, setPlaybackIntents } = makeArbiterSpy()

    adapter.ingest(makeTimeline(null, true), 16, arbiter)

    const intents = setPlaybackIntents.mock.calls[0][0] as Array<unknown>
    expect(Array.isArray(intents)).toBe(true)
    expect(intents).toHaveLength(0)
  })

  test('CASO 5: rebuildNodeIndex permite reconocer fixtures registrados en vivo', () => {
    const state = makeMockGraphState()

    const oldNode: NodeShape = { nodeId: 'fixture-1:impact' as NodeId, family: NodeFamily.IMPACT }
    state.views[NodeFamily.IMPACT] = [oldNode]
    state.deviceNodes.set('fixture-1', [oldNode.nodeId])
    state.nodesById.set(oldNode.nodeId, { ...oldNode, channels: [{ type: 'dimmer' }] })

    const { graph } = makeGraphMock(state)
    const adapter = new ChronosAetherAdapter(graph)
    const { arbiter, setPlaybackIntents } = makeArbiterSpy()

    const newNode: NodeShape = { nodeId: 'fixture-2:impact' as NodeId, family: NodeFamily.IMPACT }
    state.views[NodeFamily.IMPACT].push(newNode)
    state.deviceNodes.set('fixture-2', [newNode.nodeId])
    state.nodesById.set(newNode.nodeId, { ...newNode, channels: [{ type: 'dimmer' }] })

    adapter.ingest(
      makeTimeline(
        makeSnapshot([makeTarget({ fixtureId: 'fixture-2', dimmer: 220, colorTouched: false, pan: 0, tilt: 0, speed: 0 })], 5000),
        true,
      ),
      16,
      arbiter,
    )

    let intents = setPlaybackIntents.mock.calls[0][0] as Array<{ nodeId: NodeId }>
    expect(intents.some((intent) => intent.nodeId === newNode.nodeId)).toBe(false)

    adapter.rebuildNodeIndex()

    adapter.ingest(
      makeTimeline(
        makeSnapshot([makeTarget({ fixtureId: 'fixture-2', dimmer: 220, colorTouched: false, pan: 0, tilt: 0, speed: 0 })], 5001),
        true,
      ),
      16,
      arbiter,
    )

    intents = setPlaybackIntents.mock.calls[1][0] as Array<{ nodeId: NodeId }>
    expect(intents.some((intent) => intent.nodeId === newNode.nodeId)).toBe(true)
  })
})
