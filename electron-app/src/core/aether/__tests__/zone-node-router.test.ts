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
  const colorFront = Object.freeze(['color-front-1', 'color-front-2'] as const)
  const colorAll = Object.freeze(['color-front-1', 'color-front-2', 'color-back-1'] as const)

  const impactFront = Object.freeze(['impact-front-1'] as const)
  const impactAll = Object.freeze(['impact-front-1', 'impact-back-1'] as const)

  const kineticFront = Object.freeze(['kinetic-front-1'] as const)
  const kineticAll = Object.freeze(['kinetic-front-1'] as const)

  const beamFront = Object.freeze(['beam-front-1'] as const)
  const beamAll = Object.freeze(['beam-front-1'] as const)

  const colorView = makeView({ front: colorFront, all: colorAll }, colorAll)
  const impactView = makeView({ front: impactFront, all: impactAll }, impactAll)
  const kineticView = makeView({ front: kineticFront, all: kineticAll }, kineticAll)
  const beamView = makeView({ front: beamFront, all: beamAll }, beamAll)

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
  test('Test 1 — Expansión correcta: zona front devuelve NodeIds exactos esperados', () => {
    const graph = makeNodeGraph()
    const router = new ZoneNodeRouter(graph)

    const frontColorNodes = router.resolve('front' as EffectZone, NodeFamily.COLOR)
    expect(frontColorNodes).toEqual(['color-front-1', 'color-front-2'])
  })

  test('Test 2 — Filtrado de familia: all+COLOR excluye IMPACT/KINETIC', () => {
    const graph = makeNodeGraph()
    const router = new ZoneNodeRouter(graph)

    const allColorNodes = router.resolve('all' as EffectZone, NodeFamily.COLOR)
    expect(allColorNodes).toEqual(['color-front-1', 'color-front-2', 'color-back-1'])
    expect(allColorNodes).not.toContain('impact-front-1')
    expect(allColorNodes).not.toContain('kinetic-front-1')
  })

  test('Test 3 — Inmutabilidad/Zero-Alloc: misma referencia en llamadas sucesivas', () => {
    const graph = makeNodeGraph()
    const router = new ZoneNodeRouter(graph)

    const first = router.resolve('front' as EffectZone, NodeFamily.COLOR)
    const second = router.resolve('front' as EffectZone, NodeFamily.COLOR)

    expect(second).toBe(first)
  })
})
