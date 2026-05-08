import { describe, expect, test } from 'vitest'
import { TitanOrchestrator } from '../TitanOrchestrator'

describe('TitanOrchestrator WAVE 4623 — isPlaced bridge', () => {
  test('construye FixtureV2 para Aether con isPlaced=false cuando el show no lo define', () => {
    const orchestrator = Object.create(TitanOrchestrator.prototype) as TitanOrchestrator
    const definition = {
      id: 'profile-mh-1',
      name: 'Mover Test',
      manufacturer: 'PunkFactory',
      type: 'moving-head',
      channels: [
        { index: 1, name: 'Dimmer', type: 'dimmer', defaultValue: 0, is16bit: false },
      ],
    }
    const fixture = {
      id: 'fixture-01',
      name: 'Fixture 01',
      type: 'moving-head',
      address: 17,
      universe: 0,
      position: { x: 0, y: 3, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      zone: 'front',
    }

    const fixtureV2 = (orchestrator as any)._buildFixtureV2ForAether(fixture, definition)

    expect(fixtureV2.isPlaced).toBe(false)
  })

  test('preserva isPlaced=true cuando el show sí lo define', () => {
    const orchestrator = Object.create(TitanOrchestrator.prototype) as TitanOrchestrator
    const definition = {
      id: 'profile-mh-2',
      name: 'Mover Test 2',
      manufacturer: 'PunkFactory',
      type: 'moving-head',
      channels: [
        { index: 1, name: 'Dimmer', type: 'dimmer', defaultValue: 0, is16bit: false },
      ],
    }
    const fixture = {
      id: 'fixture-02',
      name: 'Fixture 02',
      type: 'moving-head',
      address: 18,
      universe: 0,
      isPlaced: true,
      position: { x: 1, y: 4, z: -1 },
      rotation: { x: 0, y: 0, z: 0 },
      zone: 'front',
    }

    const fixtureV2 = (orchestrator as any)._buildFixtureV2ForAether(fixture, definition)

    expect(fixtureV2.isPlaced).toBe(true)
  })
})