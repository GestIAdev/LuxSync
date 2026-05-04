import { describe, expect, it } from 'vitest'
import { ForgeGraphCompiler } from '../../compiler/ForgeGraphCompiler'
import { ForgeNodeEvaluator } from '../ForgeNodeEvaluator'
import type { ForgeFrameContext } from '../../compiler/types'
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
      dmxFootprint: 32,
    },
  }
}

function ctx(overrides: Partial<ForgeFrameContext> = {}): ForgeFrameContext {
  return {
    timeMs: 0,
    deltaMs: 1000 / 60,
    bpm: 120,
    bpmConfidence: 1,
    isBeat: false,
    energy: 0,
    audioBands: new Float64Array(6),
    frameIndex: 0,
    ...overrides,
  }
}

describe('ForgeNodeEvaluator', () => {
  it('Routing Básico: input_dmx -> proc_math(*0.5) -> output_dmx produce DMX 128', () => {
    const compiled = ForgeGraphCompiler.compile(
      graph(
        [
          {
            id: 'in-level',
            type: 'input_dmx',
            category: 'input',
            inputs: [],
            outputs: [outPort('value')],
            config: { nodeType: 'input_dmx', channelKey: 'level' },
            uiPosition: { x: 0, y: 0 },
          },
          {
            id: 'in-factor',
            type: 'input_dmx',
            category: 'input',
            inputs: [],
            outputs: [outPort('value')],
            config: { nodeType: 'input_dmx', channelKey: 'factor' },
            uiPosition: { x: 0, y: 80 },
          },
          {
            id: 'math',
            type: 'proc_math',
            category: 'process',
            inputs: [inPort('a'), inPort('b')],
            outputs: [outPort('value')],
            config: { nodeType: 'proc_math', operation: 'multiply' },
            uiPosition: { x: 150, y: 0 },
          },
          {
            id: 'out',
            type: 'output_dmx',
            category: 'output',
            inputs: [inPort('value')],
            outputs: [],
            config: { nodeType: 'output_dmx', channelType: 'dimmer', dmxOffset: 7, defaultDmxValue: 0 },
            uiPosition: { x: 300, y: 0 },
          },
        ],
        [
          edge('e1', 'in-level', 'value', 'math', 'a'),
          edge('e2', 'in-factor', 'value', 'math', 'b'),
          edge('e3', 'math', 'value', 'out', 'value'),
        ],
      ),
      'fixture-routing',
    )

    const dmx = new Uint8Array(512)
    ForgeNodeEvaluator.evaluate(compiled, { level: 1.0, factor: 0.5 }, ctx(), dmx, 0)

    expect(dmx[7]).toBe(128)
  })

  it('Stateful Nodes: proc_lfo avanza fase y produce seno matemáticamente preciso', () => {
    const compiled = ForgeGraphCompiler.compile(
      graph(
        [
          {
            id: 'lfo',
            type: 'proc_lfo',
            category: 'process',
            inputs: [],
            outputs: [outPort('value')],
            config: {
              nodeType: 'proc_lfo',
              waveform: 'sine',
              frequencyHz: 1,
              syncToBpm: false,
              bpmDivisor: 1,
              phase: 0,
            },
            uiPosition: { x: 100, y: 0 },
          },
          {
            id: 'out',
            type: 'output_dmx',
            category: 'output',
            inputs: [inPort('value')],
            outputs: [],
            config: { nodeType: 'output_dmx', channelType: 'dimmer', dmxOffset: 0, defaultDmxValue: 0 },
            uiPosition: { x: 250, y: 0 },
          },
        ],
        [edge('e1', 'lfo', 'value', 'out', 'value')],
      ),
      'fixture-lfo',
    )

    const dmx = new Uint8Array(512)
    ForgeNodeEvaluator.evaluate(compiled, undefined, ctx({ deltaMs: 250, timeMs: 250 }), dmx, 0)

    expect(compiled.stateBuffer[0]).toBeCloseTo(0.25, 6)
    expect(compiled.wireBuffer[compiled.program[0].outputOffset]).toBeCloseTo(1.0, 6)
    expect(dmx[0]).toBe(255)

    ForgeNodeEvaluator.evaluate(compiled, undefined, ctx({ deltaMs: 250, timeMs: 500, frameIndex: 1 }), dmx, 0)
    expect(compiled.stateBuffer[0]).toBeCloseTo(0.5, 6)
    expect(compiled.wireBuffer[compiled.program[0].outputOffset]).toBeCloseTo(0.5, 6)
    expect(dmx[0]).toBe(128)
  })

  it('Stateful Nodes: proc_smooth conserva estado entre frames', () => {
    const compiled = ForgeGraphCompiler.compile(
      graph(
        [
          {
            id: 'in',
            type: 'input_dmx',
            category: 'input',
            inputs: [],
            outputs: [outPort('value')],
            config: { nodeType: 'input_dmx', channelKey: 'level' },
            uiPosition: { x: 0, y: 0 },
          },
          {
            id: 'smooth',
            type: 'proc_smooth',
            category: 'process',
            inputs: [inPort('value')],
            outputs: [outPort('value')],
            config: { nodeType: 'proc_smooth', attackMs: 1000, releaseMs: 1000 },
            uiPosition: { x: 150, y: 0 },
          },
          {
            id: 'out',
            type: 'output_dmx',
            category: 'output',
            inputs: [inPort('value')],
            outputs: [],
            config: { nodeType: 'output_dmx', channelType: 'dimmer', dmxOffset: 4, defaultDmxValue: 0 },
            uiPosition: { x: 300, y: 0 },
          },
        ],
        [
          edge('e1', 'in', 'value', 'smooth', 'value'),
          edge('e2', 'smooth', 'value', 'out', 'value'),
        ],
      ),
      'fixture-smooth',
    )

    const dmx = new Uint8Array(512)
    ForgeNodeEvaluator.evaluate(compiled, { level: 1 }, ctx({ deltaMs: 1000 }), dmx, 0)
    expect(compiled.stateBuffer[0]).toBeCloseTo(1 - Math.exp(-1), 6)
    expect(dmx[4]).toBe(Math.round((1 - Math.exp(-1)) * 255))

    ForgeNodeEvaluator.evaluate(compiled, { level: 1 }, ctx({ deltaMs: 1000, frameIndex: 1, timeMs: 1000 }), dmx, 0)
    expect(compiled.stateBuffer[0]).toBeGreaterThan(0.63)
    expect(compiled.stateBuffer[0]).toBeLessThan(1.0)
    expect(dmx[4]).toBe(Math.round(compiled.stateBuffer[0] * 255))
  })
})
