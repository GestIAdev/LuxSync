import { describe, it, expect } from 'vitest'
import { NodeGraphBuilder } from '../NodeGraphBuilder'
import type { FixtureChannel } from '../../../types/FixtureDefinition'

describe('NodeGraphBuilder - Roundtrip y resiliencia', () => {
  it('Test 1 (El Espejo): channels[] -> graph -> channels[] conserva identidad exacta', () => {
    const channels: FixtureChannel[] = [
      {
        index: 0,
        name: 'Dimmer Master',
        type: 'dimmer',
        defaultValue: 255,
        is16bit: false,
      },
      {
        index: 1,
        name: 'Pan Coarse',
        type: 'pan',
        defaultValue: 127,
        is16bit: true,
      },
      {
        index: 3,
        name: 'Tilt Coarse',
        type: 'tilt',
        defaultValue: 96,
        is16bit: true,
      },
      {
        index: 5,
        name: 'Mirror Rotation',
        type: 'rotation',
        defaultValue: 128,
        is16bit: false,
        continuousRotation: true,
      },
      {
        index: 6,
        name: 'Fan Speed',
        type: 'custom',
        defaultValue: 180,
        is16bit: false,
        customName: 'Fan Speed',
      },
      {
        index: 7,
        name: 'Fog Macro',
        type: 'macro',
        defaultValue: 90,
        is16bit: false,
        customName: 'Fog Macro',
      },
    ]

    const graph = NodeGraphBuilder.fromChannels(channels)
    const roundtrip = NodeGraphBuilder.toChannels(graph)

    expect(roundtrip).toEqual(channels)
  })

  it('Test 2 (Preservación de Estado): defaultValue, channelName, is16bit sobreviven en output_dmx', () => {
    const channels: FixtureChannel[] = [
      {
        index: 10,
        name: 'Custom Laser Pattern',
        type: 'custom',
        defaultValue: 64,
        is16bit: false,
        customName: 'Custom Laser Pattern',
      },
      {
        index: 11,
        name: 'Pan Coarse',
        type: 'pan',
        defaultValue: 200,
        is16bit: true,
      },
    ]

    const graph = NodeGraphBuilder.fromChannels(channels)
    const outputNodes = graph.nodes.filter((n) => n.type === 'output_dmx')

    const customOutput = outputNodes.find((n) => n.config.nodeType === 'output_dmx' && n.config.channelType === 'custom')
    const panOutput = outputNodes.find((n) => n.config.nodeType === 'output_dmx' && n.config.channelType === 'pan')

    expect(customOutput).toBeDefined()
    expect(customOutput?.config.nodeType).toBe('output_dmx')
    if (customOutput?.config.nodeType === 'output_dmx') {
      expect(customOutput.config.defaultDmxValue).toBe(64)
      expect(customOutput.config.channelName).toBe('Custom Laser Pattern')
      expect(customOutput.config.is16bit).toBeUndefined()
    }

    expect(panOutput).toBeDefined()
    expect(panOutput?.config.nodeType).toBe('output_dmx')
    if (panOutput?.config.nodeType === 'output_dmx') {
      expect(panOutput.config.defaultDmxValue).toBe(200)
      expect(panOutput.config.channelName).toBe('Pan Coarse')
      expect(panOutput.config.is16bit).toBe(true)
    }
  })

  it('Test 3 (Resiliencia al Desorden): toChannels ordena por dmxOffset', () => {
    const baseChannels: FixtureChannel[] = [
      { index: 0, name: 'Dimmer', type: 'dimmer', defaultValue: 255, is16bit: false },
      { index: 5, name: 'Blue', type: 'blue', defaultValue: 0, is16bit: false },
      { index: 2, name: 'Pan', type: 'pan', defaultValue: 127, is16bit: false },
    ]

    const graph = NodeGraphBuilder.fromChannels(baseChannels)

    const shuffledNodes = [...graph.nodes].sort((a, b) => {
      if (a.type === 'output_dmx' && b.type === 'output_dmx') return b.config.dmxOffset - a.config.dmxOffset
      if (a.type === 'output_dmx') return -1
      if (b.type === 'output_dmx') return 1
      return 0
    })

    const shuffledGraph = {
      ...graph,
      nodes: shuffledNodes,
    }

    const restored = NodeGraphBuilder.toChannels(shuffledGraph)
    expect(restored.map((c) => c.index)).toEqual([0, 2, 5])
  })

  it('Edge Case: fromChannels([]) retorna grafo válido vacío', () => {
    const emptyGraph = NodeGraphBuilder.fromChannels([])

    expect(emptyGraph.version).toBeDefined()
    expect(emptyGraph.nodes).toEqual([])
    expect(emptyGraph.edges).toEqual([])
    expect(emptyGraph.meta.autoMigrated).toBe(true)
    expect(emptyGraph.meta.dmxFootprint).toBe(0)
  })

  it('Edge Case: validate detecta colisión de dmxOffset en output_dmx', () => {
    const graph = NodeGraphBuilder.fromChannels([
      { index: 0, name: 'Dimmer', type: 'dimmer', defaultValue: 255, is16bit: false },
      { index: 1, name: 'Red', type: 'red', defaultValue: 0, is16bit: false },
    ])

    const firstOutput = graph.nodes.find((n) => n.type === 'output_dmx')
    expect(firstOutput).toBeDefined()
    if (!firstOutput || firstOutput.config.nodeType !== 'output_dmx') return

    const collisionNode = {
      ...firstOutput,
      id: `${firstOutput.id}-collision`,
      config: {
        ...firstOutput.config,
        channelType: 'green' as const,
      },
      label: 'Collision Output',
    }

    const graphWithCollision = {
      ...graph,
      nodes: [...graph.nodes, collisionNode],
    }

    const errors = NodeGraphBuilder.validate(graphWithCollision)
    expect(errors.some((e) => e.code === 'DMX_OFFSET_COLLISION')).toBe(true)
  })
})
