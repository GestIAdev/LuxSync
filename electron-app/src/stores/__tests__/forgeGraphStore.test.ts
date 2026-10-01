/**
 * 🧪 WAVE 8411-C — forgeGraphStore inspector persistence.
 *
 * Regresión de los bugs reales detrás de "el input se resetea y el nodo se
 * deselecciona":
 *
 *   A) `updateNodeConfig` NO debe tocar `inspectedNodeId` — la selección del
 *      inspector sobrevive a la escritura.
 *   B) `updateNodeConfig` debe persistir `config.maxVirtualDim` (y borrarla
 *      cuando llega `undefined` — JSON.stringify omite la key, y `?? 1` la
 *      trata como uncapped).
 *   C) `inspectNode(id)` con id válido persiste hasta un `inspectNode(null)`
 *      explícito — nada más puede cerrarlo.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { useForgeGraphStore } from '../forgeGraphStore'
import type {
  IForgeNode,
  IForgeNodeGraph,
  IOutputDmxConfig,
} from '../../core/forge/types'

const OUT_CONFIG: IOutputDmxConfig = {
  nodeType: 'output_dmx',
  channelType: 'red',
  dmxOffset: 12,
  channelName: 'Red',
  defaultDmxValue: 0,
  aetherNodeId: 'beam-color',
  aetherZone: 'air',
}

function makeGraph(): IForgeNodeGraph {
  const node: IForgeNode = {
    id: 'forge_n_red',
    type: 'output_dmx',
    category: 'output',
    label: 'Red',
    uiPosition: { x: 0, y: 0 },
    inputs: [],
    outputs: [],
    config: OUT_CONFIG,
  }
  return {
    version: '1.0.0',
    nodes: [node],
    edges: [],
    meta: {
      createdAt: new Date().toISOString(),
      generatorWave: 'TEST',
      autoMigrated: false,
      dmxFootprint: 16,
    },
  }
}

describe('forgeGraphStore — inspector persistence (WAVE 8411-C)', () => {
  beforeEach(() => {
    useForgeGraphStore.getState().loadGraph(makeGraph(), 'fixture-test', false)
    useForgeGraphStore.getState().inspectNode('forge_n_red')
  })

  it('A) updateNodeConfig conserva inspectedNodeId y marca dirty', () => {
    useForgeGraphStore
      .getState()
      .updateNodeConfig('forge_n_red', { maxVirtualDim: 0.392 })

    const s = useForgeGraphStore.getState()
    expect(s.inspectedNodeId).toBe('forge_n_red')
    expect(s.isDirty).toBe(true)
  })

  it('B) updateNodeConfig persiste maxVirtualDim en config', () => {
    useForgeGraphStore
      .getState()
      .updateNodeConfig('forge_n_red', { maxVirtualDim: 0.392 })

    const node = useForgeGraphStore
      .getState()
      .graph!.nodes.find((n) => n.id === 'forge_n_red')!
    expect((node.config as IOutputDmxConfig).maxVirtualDim).toBe(0.392)
  })

  it('B2) maxVirtualDim=undefined en el partial retira el cap (100% = uncapped)', () => {
    const store = useForgeGraphStore.getState()
    store.updateNodeConfig('forge_n_red', { maxVirtualDim: 0.5 })
    store.updateNodeConfig('forge_n_red', { maxVirtualDim: undefined })

    const node = useForgeGraphStore
      .getState()
      .graph!.nodes.find((n) => n.id === 'forge_n_red')!
    expect((node.config as IOutputDmxConfig).maxVirtualDim).toBeUndefined()
  })

  it('C) escrituras repetidas no cierran el inspector', () => {
    const store = useForgeGraphStore.getState()
    store.updateNodeConfig('forge_n_red', { maxVirtualDim: 0.7 })
    store.updateNodeConfig('forge_n_red', { maxVirtualDim: 0.4 })
    store.updateNodeLabel('forge_n_red', 'Red beam')
    store.moveNode('forge_n_red', 50, 50)

    expect(useForgeGraphStore.getState().inspectedNodeId).toBe('forge_n_red')
    const node = useForgeGraphStore
      .getState()
      .graph!.nodes.find((n) => n.id === 'forge_n_red')!
    expect((node.config as IOutputDmxConfig).maxVirtualDim).toBe(0.4)
    expect(node.label).toBe('Red beam')
  })
})
