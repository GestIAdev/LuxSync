import { describe, expect, it } from 'vitest'
import { ForgeGraphCompiler } from '../ForgeGraphCompiler'
import type { ICompoundIngenioConfig, IForgeEdge, IForgeNode, IForgeNodeGraph, IForgePort } from '../../types'

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

  it('WAVE 4552 — Inlining: compound_ingenio se aplana en instrucciones primitivas', () => {
    // Sub-graph del Ingenio: input_constant -> proc_smooth -> output_dmx
    const subInput: IForgeNode = {
      id: 'sub-const',
      type: 'input_constant',
      category: 'input',
      inputs: [],
      outputs: [outPort('value')],
      config: { nodeType: 'input_constant', value: 0.75 },
      uiPosition: { x: 0, y: 0 },
      label: 'ConstInSub',
    }
    const subSmooth: IForgeNode = {
      id: 'sub-smooth',
      type: 'proc_smooth',
      category: 'process',
      inputs: [inPort('value')],
      outputs: [outPort('value')],
      config: { nodeType: 'proc_smooth', attackMs: 50, releaseMs: 50 },
      uiPosition: { x: 150, y: 0 },
      label: 'SmoothInSub',
    }
    const subOutput: IForgeNode = {
      id: 'sub-out',
      type: 'output_dmx',
      category: 'output',
      inputs: [inPort('value')],
      outputs: [],
      config: { nodeType: 'output_dmx', channelType: 'dimmer', dmxOffset: 0, defaultDmxValue: 0 },
      uiPosition: { x: 300, y: 0 },
      label: 'DmxOutInSub',
    }
    const subGraph: IForgeNodeGraph = {
      version: '1.0.0',
      nodes: [subInput, subSmooth, subOutput],
      edges: [
        edge('se1', 'sub-const', 'value', 'sub-smooth', 'value'),
        edge('se2', 'sub-smooth', 'value', 'sub-out', 'value'),
      ],
      meta: {
        createdAt: '2026-05-05T00:00:00.000Z',
        generatorWave: 'WAVE-4552-test',
        autoMigrated: false,
        dmxFootprint: 1,
      },
    }

    // El compound node en el grafo principal. No hay puertos externos expuestos
    // porque la logica es totalmente auto-contenida (no necesita portMapping).
    const ingenioConfig: ICompoundIngenioConfig = {
      nodeType: 'compound_ingenio',
      ingenioName: 'TestIngenio',
      ingenioRef: null,
      subGraph,
      portMapping: { inputs: [], outputs: [] },
    }
    const compoundNode: IForgeNode = {
      id: 'ing-1',
      type: 'compound_ingenio',
      category: 'compound',
      inputs: [],
      outputs: [],
      config: ingenioConfig,
      uiPosition: { x: 0, y: 0 },
      label: 'TestIngenio',
    }

    const parentGraph = graph([compoundNode], [])
    const compiled = ForgeGraphCompiler.compile(parentGraph, 'fixture-inline-test')

    // El programa compilado debe tener 3 instrucciones (6=const, 9=smooth, 23=output_dmx)
    // No debe haber ninguna instruccion con opcode 0 (compound_ingenio / noop)
    expect(compiled.program.length).toBe(3)
    expect(compiled.program.map((i) => i.opcode)).toEqual([6, 9, 23])
    // El smooth tiene 1 slot de estado
    expect(compiled.totalStateSlots).toBe(1)
    // Hay 1 output DMX en la salida
    expect(compiled.outputs.length).toBe(1)
    expect(compiled.outputs[0].dmxOffset).toBe(0)
  })

  it('WAVE 4552 — Inlining anidado: Ingenio dentro de Ingenio se aplana completamente', () => {
    // Nivel 2 (mas profundo): input_constant -> output_dmx
    const deepConst: IForgeNode = {
      id: 'deep-const',
      type: 'input_constant',
      category: 'input',
      inputs: [],
      outputs: [outPort('value')],
      config: { nodeType: 'input_constant', value: 0.5 },
      uiPosition: { x: 0, y: 0 },
    }
    const deepOut: IForgeNode = {
      id: 'deep-out',
      type: 'output_dmx',
      category: 'output',
      inputs: [inPort('value')],
      outputs: [],
      config: { nodeType: 'output_dmx', channelType: 'dimmer', dmxOffset: 2, defaultDmxValue: 0 },
      uiPosition: { x: 200, y: 0 },
    }
    const deepGraph: IForgeNodeGraph = {
      version: '1.0.0',
      nodes: [deepConst, deepOut],
      edges: [edge('de1', 'deep-const', 'value', 'deep-out', 'value')],
      meta: { createdAt: '2026-05-05T00:00:00.000Z', generatorWave: 'WAVE-4552-nested', autoMigrated: false, dmxFootprint: 1 },
    }

    // Nivel 1: un compound que contiene el deep compound
    const innerCompoundConfig: ICompoundIngenioConfig = {
      nodeType: 'compound_ingenio',
      ingenioName: 'InnerIngenio',
      ingenioRef: null,
      subGraph: deepGraph,
      portMapping: { inputs: [], outputs: [] },
    }
    const innerCompound: IForgeNode = {
      id: 'ing-inner',
      type: 'compound_ingenio',
      category: 'compound',
      inputs: [],
      outputs: [],
      config: innerCompoundConfig,
      uiPosition: { x: 0, y: 0 },
    }
    const level1Graph: IForgeNodeGraph = {
      version: '1.0.0',
      nodes: [innerCompound],
      edges: [],
      meta: { createdAt: '2026-05-05T00:00:00.000Z', generatorWave: 'WAVE-4552-nested-l1', autoMigrated: false, dmxFootprint: 1 },
    }

    // Nivel 0 (raiz): compound que contiene el nivel 1
    const outerCompoundConfig: ICompoundIngenioConfig = {
      nodeType: 'compound_ingenio',
      ingenioName: 'OuterIngenio',
      ingenioRef: null,
      subGraph: level1Graph,
      portMapping: { inputs: [], outputs: [] },
    }
    const outerCompound: IForgeNode = {
      id: 'ing-outer',
      type: 'compound_ingenio',
      category: 'compound',
      inputs: [],
      outputs: [],
      config: outerCompoundConfig,
      uiPosition: { x: 0, y: 0 },
    }

    const rootGraph = graph([outerCompound], [])
    const compiled = ForgeGraphCompiler.compile(rootGraph, 'fixture-nested-inline')

    // Debe tener exactamente 2 instrucciones primitivas al final (input_constant + output_dmx)
    expect(compiled.program.length).toBe(2)
    // Ningun opcode 0 (compound noop) debe sobrevivir
    expect(compiled.program.every((i) => i.opcode !== 0)).toBe(true)
    expect(compiled.outputs.length).toBe(1)
  })
})
