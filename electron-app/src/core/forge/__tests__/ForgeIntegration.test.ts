import { describe, expect, it } from 'vitest'
import { ForgeGraphCompiler } from '../compiler/ForgeGraphCompiler'
import { ForgeNodeEvaluator } from '../evaluator/ForgeNodeEvaluator'
import type { ForgeFrameContext } from '../compiler/types'
import type { IForgeEdge, IForgeNode, IForgeNodeGraph, IForgePort } from '../types'

function inPort(id: string): IForgePort {
  return { id, label: id, dataType: 'normalized', direction: 'in', defaultValue: 0, required: true }
}

function outPort(id: string): IForgePort {
  return { id, label: id, dataType: 'normalized', direction: 'out', defaultValue: 0 }
}

function edge(id: string, sourceNode: string, sourcePort: string, targetNode: string, targetPort: string): IForgeEdge {
  return { id, sourceNode, sourcePort, targetNode, targetPort }
}

function graph(nodes: readonly IForgeNode[], edges: readonly IForgeEdge[]): IForgeNodeGraph {
  return {
    version: '1.0.0',
    nodes,
    edges,
    meta: {
      createdAt: '2026-05-04T00:00:00.000Z',
      generatorWave: 'WAVE-4548.7',
      autoMigrated: false,
      dmxFootprint: 16,
    },
  }
}

function ctx(frameIndex: number): ForgeFrameContext {
  return {
    timeMs: frameIndex * 16.6667,
    deltaMs: 16.6667,
    bpm: 120,
    bpmConfidence: 1,
    isBeat: true,
    energy: 1,
    audioBands: new Float64Array(6),
    frameIndex,
  }
}

describe('Forge Integration - The Tungsten Fan', () => {
  it('input_beat -> logic_counter -> proc_map_range -> output_dmx mantiene estado y alterna la salida', () => {
    const compiled = ForgeGraphCompiler.compile(
      graph(
        [
          {
            id: 'beat',
            type: 'input_beat',
            category: 'input',
            inputs: [],
            outputs: [outPort('pulse')],
            config: { nodeType: 'empty' },
            uiPosition: { x: 0, y: 0 },
          },
          {
            id: 'counter',
            type: 'logic_counter',
            category: 'logic',
            inputs: [inPort('trigger')],
            outputs: [outPort('value')],
            config: { nodeType: 'logic_counter', modulo: 3, emitNormalized: false },
            uiPosition: { x: 120, y: 0 },
          },
          {
            id: 'mapper',
            type: 'proc_map_range',
            category: 'process',
            inputs: [inPort('value')],
            outputs: [outPort('value')],
            config: { nodeType: 'proc_map_range', inputMin: 0, inputMax: 2, outputMin: 0, outputMax: 1 },
            uiPosition: { x: 240, y: 0 },
          },
          {
            id: 'out',
            type: 'output_dmx',
            category: 'output',
            inputs: [inPort('value')],
            outputs: [],
            config: { nodeType: 'output_dmx', channelType: 'custom', dmxOffset: 12, channelName: 'Tungsten Fan', defaultDmxValue: 0 },
            uiPosition: { x: 360, y: 0 },
          },
        ],
        [
          edge('e1', 'beat', 'pulse', 'counter', 'trigger'),
          edge('e2', 'counter', 'value', 'mapper', 'value'),
          edge('e3', 'mapper', 'value', 'out', 'value'),
        ],
      ),
      'fixture-tungsten-fan',
    )

    const dmx = new Uint8Array(512)

    ForgeNodeEvaluator.evaluate(compiled, undefined, ctx(0), dmx, 0)
    expect(compiled.stateBuffer[0]).toBe(1)
    expect(dmx[12]).toBe(128)

    ForgeNodeEvaluator.evaluate(compiled, undefined, ctx(1), dmx, 0)
    expect(compiled.stateBuffer[0]).toBe(2)
    expect(dmx[12]).toBe(255)

    ForgeNodeEvaluator.evaluate(compiled, undefined, ctx(2), dmx, 0)
    expect(compiled.stateBuffer[0]).toBe(0)
    expect(dmx[12]).toBe(0)
  })
})
