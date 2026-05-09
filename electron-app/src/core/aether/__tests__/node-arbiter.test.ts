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
