import { describe, test, expect } from 'vitest'

import { ZoneNodeRouter } from '../adapters/helpers/zone-node-router'
import { NodeFamily } from '../types'

import type { EffectZone } from '../../effects/types'
import type { INodeGraph, INodeView } from '../node-graph'
import type { NodeId, ZoneId, NodeRole } from '../types'

type MockNode = { nodeId: NodeId }

function makeView(zoneMap: Record<string, readonly NodeId[]>, allNodeIds: readonly NodeId[]): INodeView<MockNode> {
  const nodes = allNodeIds.map((nodeId) => ({ nodeId }))
  const emptyNodes: readonly MockNode[] = Object.freeze([])
  const emptyNodeIds: readonly NodeId[] = Object.freeze([])

  return {
    get count(): number {
      return nodes.length
    },
    forEach(fn: (node: MockNode, index: number) => void): void {
      nodes.forEach((n, i) => fn(n, i))
    },
    get(index: number): MockNode {
      return nodes[index]!
    },
    byZone(zoneId: ZoneId): readonly MockNode[] {
      const ids = zoneMap[zoneId] ?? []
      if (ids.length === 0) return emptyNodeIds as unknown as readonly MockNode[]
      return ids as unknown as readonly MockNode[]
    },
    byRole(_role: NodeRole): readonly MockNode[] {
      return emptyNodes
    },
  }
}

function makeNodeGraph(): INodeGraph {
  const colorFrontLeft = Object.freeze(['color-front-left-1'] as const)
  const colorFrontRight = Object.freeze(['color-front-right-1'] as const)
  const colorBackLeft = Object.freeze(['color-back-left-1'] as const)
  const colorBackRight = Object.freeze(['color-back-right-1'] as const)
  const colorMoversLeft = Object.freeze(['color-mover-left-1'] as const)
  const colorMoversRight = Object.freeze(['color-mover-right-1'] as const)
  const colorAll = Object.freeze([
    'color-front-left-1',
    'color-front-right-1',
    'color-back-left-1',
    'color-back-right-1',
  ] as const)

  const impactFrontLeft = Object.freeze(['impact-front-left-1'] as const)
  const impactFrontRight = Object.freeze(['impact-front-right-1'] as const)
  const impactMoversLeft = Object.freeze(['impact-mover-left-1'] as const)
  const impactMoversRight = Object.freeze(['impact-mover-right-1'] as const)
  const impactAll = Object.freeze([
    'impact-front-left-1',
    'impact-front-right-1',
    'impact-back-left-1',
    'impact-back-right-1',
  ] as const)

  const kineticFrontLeft = Object.freeze(['kinetic-front-left-1'] as const)
  const kineticFrontRight = Object.freeze(['kinetic-front-right-1'] as const)
  const kineticAll = Object.freeze(['kinetic-front-left-1', 'kinetic-front-right-1'] as const)

  const beamFrontLeft = Object.freeze(['beam-front-left-1'] as const)
  const beamFrontRight = Object.freeze(['beam-front-right-1'] as const)
  const beamAll = Object.freeze(['beam-front-left-1', 'beam-front-right-1'] as const)

  const colorView = makeView(
    {
      'front-left': colorFrontLeft,
      'front-right': colorFrontRight,
      'back-left': colorBackLeft,
      'back-right': colorBackRight,
      'movers-left': colorMoversLeft,
      'movers-right': colorMoversRight,
      all: colorAll,
    },
    colorAll,
  )
  const impactView = makeView(
    {
      'front-left': impactFrontLeft,
      'front-right': impactFrontRight,
      'movers-left': impactMoversLeft,
      'movers-right': impactMoversRight,
      all: impactAll,
    },
    impactAll,
  )
  const kineticView = makeView({ 'front-left': kineticFrontLeft, 'front-right': kineticFrontRight, all: kineticAll }, kineticAll)
  const beamView = makeView({ 'front-left': beamFrontLeft, 'front-right': beamFrontRight, all: beamAll }, beamAll)

  return {
    getView(family: NodeFamily): INodeView<any> {
      if (family === NodeFamily.COLOR) return colorView as unknown as INodeView<any>
      if (family === NodeFamily.IMPACT) return impactView as unknown as INodeView<any>
      if (family === NodeFamily.KINETIC) return kineticView as unknown as INodeView<any>
      if (family === NodeFamily.BEAM) return beamView as unknown as INodeView<any>
      return makeView({}, []) as unknown as INodeView<any>
    },
    registerDevice() { return [] },
    unregisterDevice() {},
    getNodesByZone() { return [] },
    getNodesByRole() { return [] },
    getDeviceNodes() { return [] },
    getDevice() { return undefined },
    getNodeData() { return undefined },
    hasNode() { return false },
    snapshot() {
      return {
        timestamp: 0,
        counts: {
          [NodeFamily.COLOR]: colorAll.length,
          [NodeFamily.IMPACT]: impactAll.length,
          [NodeFamily.KINETIC]: kineticAll.length,
          [NodeFamily.BEAM]: beamAll.length,
          [NodeFamily.ATMOSPHERE]: 0,
        },
        totalNodes: colorAll.length + impactAll.length + kineticAll.length + beamAll.length,
        totalDevices: 0,
        deviceIds: [],
        activeZones: [],
        roleDistribution: {},
      }
    },
    get totalNodes() {
      return colorAll.length + impactAll.length + kineticAll.length + beamAll.length
    },
    get totalDevices() {
      return 0
    },
  } as unknown as INodeGraph
}

describe('ZoneNodeRouter — WAVE 4524.4', () => {
  test('Test 1 — front agrega front-left + front-right (estéreo)', () => {
    const graph = makeNodeGraph()
    const router = new ZoneNodeRouter(graph)

    const frontColorNodes = router.resolve('front' as EffectZone, NodeFamily.COLOR)
    expect(frontColorNodes).toEqual(['color-front-left-1', 'color-front-right-1'])
  })

  test('Test 2 — Filtrado de familia: all+COLOR excluye IMPACT/KINETIC', () => {
    const graph = makeNodeGraph()
    const router = new ZoneNodeRouter(graph)

    const allColorNodes = router.resolve('all' as EffectZone, NodeFamily.COLOR)
    expect(allColorNodes).toEqual(['color-front-left-1', 'color-front-right-1', 'color-back-left-1', 'color-back-right-1'])
    expect(allColorNodes).not.toContain('impact-front-1')
    expect(allColorNodes).not.toContain('kinetic-front-left-1')
  })

  test('Test 3 — Inmutabilidad/Zero-Alloc: misma referencia en llamadas sucesivas', () => {
    const graph = makeNodeGraph()
    const router = new ZoneNodeRouter(graph)

    const first = router.resolve('front' as EffectZone, NodeFamily.COLOR)
    const second = router.resolve('front' as EffectZone, NodeFamily.COLOR)

    expect(second).toBe(first)
  })

  test('Test 4 — all-movers resuelve unión movers-left+movers-right sin fallback a all', () => {
    const graph = makeNodeGraph()
    const router = new ZoneNodeRouter(graph)

    const allMoversColor = router.resolve('all-movers' as EffectZone, NodeFamily.COLOR)
    expect(allMoversColor).toEqual(['color-mover-left-1', 'color-mover-right-1'])
    expect(allMoversColor).not.toContain('color-front-left-1')

    const again = router.resolve('all-movers' as EffectZone, NodeFamily.COLOR)
    expect(again).toBe(allMoversColor)
  })

  test('Test 5 — Alias frontL se normaliza a front-left', () => {
    const graph = makeNodeGraph()
    const router = new ZoneNodeRouter(graph)

    const nodes = router.resolve('frontL' as EffectZone, NodeFamily.COLOR)
    expect(nodes).toEqual(['color-front-left-1'])
  })

  test('Test 6 — Zona desconocida no cae a all (evita flood global)', () => {
    const graph = makeNodeGraph()
    const router = new ZoneNodeRouter(graph)

    const nodes = router.resolve('totally-unknown-zone' as EffectZone, NodeFamily.COLOR)
    expect(nodes).toEqual([])
  })
})
