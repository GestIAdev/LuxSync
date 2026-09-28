import { describe, expect, test } from 'vitest'

import { NodeArbiter } from '../NodeArbiter'

describe('NodeArbiter mover shield diplomatic passport', () => {
  test('bloquea color Selene en nodos protegidos cuando no hay override', () => {
    const arbiter = new NodeArbiter()

    arbiter.setMoverShieldNodeIds(['mover-1:color'])
    arbiter.setSeleneOverrideMoverShield(false)
    arbiter.setSeleneOverrides([
      {
        nodeId: 'mover-1:color',
        values: { r: 1, g: 0.5, b: 0.25, red: 1, green: 0.5, blue: 0.25 },
        priority: 300,
        confidence: 1,
        source: 'effect',
      },
    ])

    const result = arbiter.arbitrate()
    const channels = result.get('mover-1:color')

    expect(channels).toBeDefined()
    expect(channels?.['r']).toBeUndefined()
    expect(channels?.['g']).toBeUndefined()
    expect(channels?.['b']).toBeUndefined()
    expect(channels?.['red']).toBeUndefined()
    expect(channels?.['green']).toBeUndefined()
    expect(channels?.['blue']).toBeUndefined()
  })

  test('permite color Selene en nodos protegidos cuando override esta activo', () => {
    const arbiter = new NodeArbiter()

    arbiter.setMoverShieldNodeIds(['mover-1:color'])
    arbiter.setSeleneOverrideMoverShield(true)
    arbiter.setSeleneOverrides([
      {
        nodeId: 'mover-1:color',
        values: { r: 1, g: 0.5, b: 0.25, red: 1, green: 0.5, blue: 0.25 },
        priority: 300,
        confidence: 1,
        source: 'effect',
      },
    ])

    const result = arbiter.arbitrate()
    const channels = result.get('mover-1:color')

    expect(channels).toBeDefined()
    expect(channels?.['r']).toBeCloseTo(1, 6)
    expect(channels?.['g']).toBeCloseTo(0.5, 6)
    expect(channels?.['b']).toBeCloseTo(0.25, 6)
    expect(channels?.['red']).toBeCloseTo(1, 6)
    expect(channels?.['green']).toBeCloseTo(0.5, 6)
    expect(channels?.['blue']).toBeCloseTo(0.25, 6)
  })
})

describe('NodeArbiter — Inhibit Limits sobre Virtual Dimmer (WAVE 8269)', () => {
  const busOf = (intents: any[]) => ({ getAll: () => intents }) as any
  const l0 = (nodeId: string, values: Record<string, number>) => ({
    nodeId, values, priority: 0, confidence: 1, source: 'liquid-aether-l0',
  })

  test('capa brightness del nodo cuando no hay dimmer en el record', () => {
    const arbiter = new NodeArbiter()
    arbiter.setSystemIntents(busOf([l0('beam-1:beam-color', { brightness: 0.8 })]))
    arbiter.setInhibitLimit('beam-1:beam-color', 0.5)

    const result = arbiter.arbitrate()
    expect(result.get('beam-1:beam-color')?.['brightness']).toBeCloseTo(0.4, 6)
  })

  test('capa dimmer y brightness simultáneamente cuando ambos existen', () => {
    const arbiter = new NodeArbiter()
    arbiter.setSystemIntents(busOf([l0('mix-1:cell', { dimmer: 1.0, brightness: 1.0 })]))
    arbiter.setInhibitLimit('mix-1:cell', 0.25)

    const record = arbiter.arbitrate().get('mix-1:cell')
    expect(record?.['dimmer']).toBeCloseTo(0.25, 6)
    expect(record?.['brightness']).toBeCloseTo(0.25, 6)
  })

  test('limit=0 apaga el dimmer virtual por completo', () => {
    const arbiter = new NodeArbiter()
    arbiter.setSystemIntents(busOf([l0('beam-1:beam-color', { brightness: 1.0 })]))
    arbiter.setInhibitLimit('beam-1:beam-color', 0)

    expect(arbiter.arbitrate().get('beam-1:beam-color')?.['brightness']).toBe(0)
  })
})
