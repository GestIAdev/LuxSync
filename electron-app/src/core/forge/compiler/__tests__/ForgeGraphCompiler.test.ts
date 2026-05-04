import { describe, expect, it } from 'vitest'
import { ForgeGraphCompiler } from '../ForgeGraphCompiler'
import type { IForgeEdge, IForgeNode, IForgeNodeGraph, IForgePort } from '../../types'

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

describe('ForgeGraphCompiler', () => {
  it('El Sort Topológico: compile() ordena A -> B -> C aunque el grafo venga desordenado', () => {
    const nodeC: IForgeNode = {
      id: 'C',
      type: 'output_dmx',
      category: 'output',
      inputs: [inPort('value')],
      outputs: [],
      config: { nodeType: 'output_dmx', channelType: 'dimmer', dmxOffset: 0, defaultDmxValue: 0 },
      uiPosition: { x: 400, y: 0 },
      label: 'C',
    }
    const nodeB: IForgeNode = {
      id: 'B',
      type: 'proc_invert',
      category: 'process',
      inputs: [inPort('value')],
      outputs: [outPort('value')],
      config: { nodeType: 'empty' },
      uiPosition: { x: 250, y: 0 },
      label: 'B',
    }
    const nodeA: IForgeNode = {
      id: 'A',
      type: 'input_constant',
      category: 'input',
      inputs: [],
      outputs: [outPort('value')],
      config: { nodeType: 'input_constant', value: 0.25 },
      uiPosition: { x: 100, y: 0 },
      label: 'A',
    }

    const compiled = ForgeGraphCompiler.compile(
      graph(
        [nodeC, nodeB, nodeA],
        [
          edge('e1', 'A', 'value', 'B', 'value'),
          edge('e2', 'B', 'value', 'C', 'value'),
        ],
      ),
      'fixture-topo',
    )

    expect(compiled.program.map((instr) => instr.opcode)).toEqual([6, 15, 23])
  })

  it('Buffer Allocation: totalWireSlots y totalStateSlots tienen tamaño exacto', () => {
    const inputA: IForgeNode = {
      id: 'in-a',
      type: 'input_dmx',
      category: 'input',
      inputs: [],
      outputs: [outPort('value')],
      config: { nodeType: 'input_dmx', channelKey: 'level' },
      uiPosition: { x: 0, y: 0 },
    }
    const inputB: IForgeNode = {
      id: 'in-b',
      type: 'input_dmx',
      category: 'input',
      inputs: [],
      outputs: [outPort('value')],
      config: { nodeType: 'input_dmx', channelKey: 'factor' },
      uiPosition: { x: 0, y: 80 },
    }
    const math: IForgeNode = {
      id: 'math',
      type: 'proc_math',
      category: 'process',
      inputs: [inPort('a'), inPort('b')],
      outputs: [outPort('value')],
      config: { nodeType: 'proc_math', operation: 'multiply' },
      uiPosition: { x: 200, y: 0 },
    }
    const smooth: IForgeNode = {
      id: 'smooth',
      type: 'proc_smooth',
      category: 'process',
      inputs: [inPort('value')],
      outputs: [outPort('value')],
      config: { nodeType: 'proc_smooth', attackMs: 100, releaseMs: 100 },
      uiPosition: { x: 300, y: 0 },
    }
    const output: IForgeNode = {
      id: 'out',
      type: 'output_dmx',
      category: 'output',
      inputs: [inPort('value')],
      outputs: [],
      config: { nodeType: 'output_dmx', channelType: 'dimmer', dmxOffset: 4, defaultDmxValue: 0 },
      uiPosition: { x: 400, y: 0 },
    }

    const compiled = ForgeGraphCompiler.compile(
      graph(
        [output, smooth, math, inputB, inputA],
        [
          edge('e1', 'in-a', 'value', 'math', 'a'),
          edge('e2', 'in-b', 'value', 'math', 'b'),
          edge('e3', 'math', 'value', 'smooth', 'value'),
          edge('e4', 'smooth', 'value', 'out', 'value'),
        ],
      ),
      'fixture-buffers',
    )

    expect(compiled.totalWireSlots).toBe(8)
    expect(compiled.wireBuffer.length).toBe(8)
    expect(compiled.totalStateSlots).toBe(1)
    expect(compiled.stateBuffer.length).toBe(1)
  })
})
