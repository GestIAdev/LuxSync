import { describe, it, expect } from 'vitest'
import { NodeGraphBuilder } from '../../core/forge/NodeGraphBuilder'
import {
  deriveCapabilitiesUnified,
  type FixtureDefinition,
  type FixtureChannel,
} from '../FixtureDefinition'

describe('FixtureDefinition - deriveCapabilitiesUnified', () => {
  it('Test 1 (Prioridad NodeGraph): usa output_dmx del grafo por encima de channels[] engañoso', () => {
    const deceptiveChannels: FixtureChannel[] = [
      {
        index: 0,
        name: 'Legacy Dimmer Only',
        type: 'dimmer',
        defaultValue: 255,
        is16bit: false,
      },
    ]

    const graphChannels: FixtureChannel[] = [
      { index: 1, name: 'Pan', type: 'pan', defaultValue: 127, is16bit: false },
      { index: 2, name: 'Tilt', type: 'tilt', defaultValue: 127, is16bit: false },
      { index: 3, name: 'Red', type: 'red', defaultValue: 0, is16bit: false },
      { index: 4, name: 'Green', type: 'green', defaultValue: 0, is16bit: false },
      { index: 5, name: 'Blue', type: 'blue', defaultValue: 0, is16bit: false },
    ]

    const fixtureWithGraph: FixtureDefinition & { nodeGraph: ReturnType<typeof NodeGraphBuilder.fromChannels> } = {
      id: 'fx-node-priority',
      name: 'Node Priority Fixture',
      manufacturer: 'LuxSync',
      type: 'moving-head',
      channels: deceptiveChannels,
      nodeGraph: NodeGraphBuilder.fromChannels(graphChannels),
    }

    const caps = deriveCapabilitiesUnified(fixtureWithGraph)

    expect(caps.hasPanTilt).toBe(true)
    expect(caps.hasColorMixing).toBe(true)
    expect(caps.colorMixingType).toBe('rgb')
    expect(caps.hasDimmer).toBe(false)
    expect(caps.channelCount).toBe(5)
  })

  it('Test 2 (Fallback Legacy): sin nodeGraph usa channels[] legacy', () => {
    const legacyChannels: FixtureChannel[] = [
      { index: 0, name: 'Dimmer', type: 'dimmer', defaultValue: 255, is16bit: false },
      { index: 1, name: 'Pan', type: 'pan', defaultValue: 127, is16bit: false },
      { index: 2, name: 'Tilt', type: 'tilt', defaultValue: 127, is16bit: false },
      { index: 3, name: 'Red', type: 'red', defaultValue: 0, is16bit: false },
      { index: 4, name: 'Green', type: 'green', defaultValue: 0, is16bit: false },
      { index: 5, name: 'Blue', type: 'blue', defaultValue: 0, is16bit: false },
      { index: 6, name: 'Macro', type: 'macro', defaultValue: 32, is16bit: false },
    ]

    const legacyFixture: FixtureDefinition = {
      id: 'fx-legacy-fallback',
      name: 'Legacy Fixture',
      manufacturer: 'LuxSync',
      type: 'par',
      channels: legacyChannels,
    }

    const caps = deriveCapabilitiesUnified(legacyFixture)

    expect(caps.hasPanTilt).toBe(true)
    expect(caps.hasColorMixing).toBe(true)
    expect(caps.colorMixingType).toBe('rgb')
    expect(caps.hasDimmer).toBe(true)
    expect(caps.hasMacro).toBe(true)
    expect(caps.channelCount).toBe(7)
  })
})
