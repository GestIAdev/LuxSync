/**
 * 💡 FIXTURE MANAGER
 * Gestiona todos los fixtures (luces) de la instalación
 * 
 * - Carga definiciones de fixtures (.fxt)
 * - Mantiene estado de cada fixture
 * - Traduce decisiones abstractas a valores DMX concretos
 */

import type {
  FixtureType,
  RGBColor,
} from '../types'
import type { ColorOutput } from '../engines/visual/ColorEngine'
import type { MovementOutput } from '../engines/visual/MovementEngine'
import type { EffectsOutput } from '../engines/visual/EffectsEngine'

/**
 * Definición de un fixture (de archivo .fxt)
 */
export interface FixtureDefinition {
  name: string
  manufacturer: string
  type: FixtureType
  channels: ChannelDefinition[]
  modes: { name: string; channelCount: number }[]
}

/**
 * Definición de un canal DMX
 */
export interface ChannelDefinition {
  name: string
  type: ChannelType
  defaultValue: number
  range?: [number, number]
}

export type ChannelType = 
  | 'dimmer' | 'red' | 'green' | 'blue' | 'white' | 'amber' | 'uv'
  | 'pan' | 'panFine' | 'tilt' | 'tiltFine'
  | 'gobo' | 'goboRotation' | 'color' | 'prism'
  | 'strobe' | 'shutter' | 'focus' | 'zoom'
  | 'speed' | 'macro' | 'control'

/**
 * Capacidades detectadas del fixture
 */
interface FixtureCaps {
  hasDimmer: boolean
  hasRGB: boolean
  hasWhite: boolean
  hasPanTilt: boolean
  hasGobo: boolean
  hasStrobe: boolean
  hasPrism: boolean
  hasZoom: boolean
}

/**
 * Estado interno de un fixture
 */
interface InternalFixtureState {
  dimmer: number        // 0-255
  color: RGBColor       // RGB
  white: number         // 0-255
  pan: number           // 0-1
  tilt: number          // 0-1
  gobo: number          // 0-255
  strobe: number        // 0-255
  caps: FixtureCaps
}

/**
 * Fixture instanciado en el sistema
 */
export interface ManagedFixture {
  id: string
  definition: FixtureDefinition
  universe: number
  startChannel: number
  state: InternalFixtureState
  group?: string
}

/**
 * 💡 FixtureManager
 */
export class FixtureManager {
  private fixtures: Map<string, ManagedFixture> = new Map()
  private definitions: Map<string, FixtureDefinition> = new Map()
  private groups: Map<string, string[]> = new Map() // group -> fixtureIds
  
  constructor() {
    this.loadDefaultDefinitions()
  }
  
  /**
   * Cargar definiciones predeterminadas (fixtures genéricos)
   */
  private loadDefaultDefinitions(): void {
    // Par LED RGB genérico
    this.definitions.set('generic-par-rgb', {
      name: 'Generic PAR RGB',
      manufacturer: 'Generic',
      type: 'par',
      channels: [
        { name: 'Dimmer', type: 'dimmer', defaultValue: 0 },
        { name: 'Red', type: 'red', defaultValue: 0 },
        { name: 'Green', type: 'green', defaultValue: 0 },
        { name: 'Blue', type: 'blue', defaultValue: 0 },
      ],
      modes: [{ name: '4ch', channelCount: 4 }],
    })
    
    // Par LED RGBW genérico
    this.definitions.set('generic-par-rgbw', {
      name: 'Generic PAR RGBW',
      manufacturer: 'Generic',
      type: 'par',
      channels: [
        { name: 'Dimmer', type: 'dimmer', defaultValue: 0 },
        { name: 'Red', type: 'red', defaultValue: 0 },
        { name: 'Green', type: 'green', defaultValue: 0 },
        { name: 'Blue', type: 'blue', defaultValue: 0 },
        { name: 'White', type: 'white', defaultValue: 0 },
      ],
      modes: [{ name: '5ch', channelCount: 5 }],
    })
    
    // Moving Head genérico
    this.definitions.set('generic-moving-head', {
      name: 'Generic Moving Head',
      manufacturer: 'Generic',
      type: 'moving_head',
      channels: [
        { name: 'Pan', type: 'pan', defaultValue: 127 },
        { name: 'Pan Fine', type: 'panFine', defaultValue: 0 },
        { name: 'Tilt', type: 'tilt', defaultValue: 127 },
        { name: 'Tilt Fine', type: 'tiltFine', defaultValue: 0 },
        { name: 'Speed', type: 'speed', defaultValue: 0 },
        { name: 'Dimmer', type: 'dimmer', defaultValue: 0 },
        { name: 'Strobe', type: 'strobe', defaultValue: 0 },
        { name: 'Red', type: 'red', defaultValue: 0 },
        { name: 'Green', type: 'green', defaultValue: 0 },
        { name: 'Blue', type: 'blue', defaultValue: 0 },
        { name: 'White', type: 'white', defaultValue: 0 },
        { name: 'Gobo', type: 'gobo', defaultValue: 0 },
        { name: 'Gobo Rotation', type: 'goboRotation', defaultValue: 0 },
        { name: 'Focus', type: 'focus', defaultValue: 127 },
        { name: 'Prism', type: 'prism', defaultValue: 0 },
      ],
      modes: [{ name: '15ch', channelCount: 15 }],
    })
    
    // Strobe genérico
    this.definitions.set('generic-strobe', {
      name: 'Generic Strobe',
      manufacturer: 'Generic',
      type: 'strobe',
      channels: [
        { name: 'Dimmer', type: 'dimmer', defaultValue: 0 },
        { name: 'Strobe', type: 'strobe', defaultValue: 0 },
      ],
      modes: [{ name: '2ch', channelCount: 2 }],
    })
  }
  
  /**
   * Agregar un fixture
   */
  addFixture(
    id: string,
    definitionId: string,
    universe: number,
    startChannel: number,
    group?: string
  ): ManagedFixture | null {
    const definition = this.definitions.get(definitionId)
    if (!definition) {
      console.warn(`Definition not found: ${definitionId}`)
      return null
    }
    
    const caps = this.detectCapabilities(definition)
    
    const fixture: ManagedFixture = {
      id,
      definition,
      universe,
      startChannel,
      state: {
        dimmer: 0,
        color: { r: 0, g: 0, b: 0 },
        white: 0,
        pan: 0.5,
        tilt: 0.5,
        gobo: 0,
        strobe: 0,
        caps,
      },
      group,
    }
    
    this.fixtures.set(id, fixture)
    
    if (group) {
      if (!this.groups.has(group)) {
        this.groups.set(group, [])
      }
      this.groups.get(group)!.push(id)
    }
    
    return fixture
  }
  
  private detectCapabilities(def: FixtureDefinition): FixtureCaps {
    return {
      hasDimmer: def.channels.some(c => c.type === 'dimmer'),
      hasRGB: def.channels.some(c => c.type === 'red') && 
              def.channels.some(c => c.type === 'green') && 
              def.channels.some(c => c.type === 'blue'),
      hasWhite: def.channels.some(c => c.type === 'white'),
      hasPanTilt: def.channels.some(c => c.type === 'pan') && 
                  def.channels.some(c => c.type === 'tilt'),
      hasGobo: def.channels.some(c => c.type === 'gobo'),
      hasStrobe: def.channels.some(c => c.type === 'strobe'),
      hasPrism: def.channels.some(c => c.type === 'prism'),
      hasZoom: def.channels.some(c => c.type === 'zoom'),
    }
  }
  
  /**
   * Aplicar salida de ColorEngine
   */
  applyColor(fixtureId: string, color: ColorOutput): void {
    const fixture = this.fixtures.get(fixtureId)
    if (!fixture) return
    
    fixture.state.dimmer = Math.round(color.intensity * 255)
    fixture.state.color = color.primary
  }
  
  /**
   * Aplicar salida de MovementEngine
   */
  applyMovement(fixtureId: string, movement: MovementOutput): void {
    const fixture = this.fixtures.get(fixtureId)
    if (!fixture || !fixture.state.caps.hasPanTilt) return
    
    fixture.state.pan = movement.pan
    fixture.state.tilt = movement.tilt
  }
  
  /**
   * Aplicar efectos
   */
  applyEffects(fixtureId: string, effects: EffectsOutput): void {
    const fixture = this.fixtures.get(fixtureId)
    if (!fixture) return
    
    if (fixture.state.caps.hasStrobe) {
      fixture.state.strobe = effects.strobe 
        ? Math.round(effects.strobeSpeed * 255) 
        : 0
    }
    
    if (effects.blinder) {
      fixture.state.dimmer = 255
    }
  }
  
  /**
   * Generar array de valores DMX para un fixture
   */
  getDMXValues(fixtureId: string): number[] {
    const fixture = this.fixtures.get(fixtureId)
    if (!fixture) return []
    
    const values: number[] = []
    const s = fixture.state
    
    for (const channel of fixture.definition.channels) {
      switch (channel.type) {
        case 'dimmer': values.push(s.dimmer); break
        case 'red': values.push(s.color.r); break
        case 'green': values.push(s.color.g); break
        case 'blue': values.push(s.color.b); break
        case 'white': values.push(s.white); break
        case 'pan': values.push(Math.round(s.pan * 255)); break
        case 'panFine': values.push(Math.round((s.pan * 255 % 1) * 255)); break
        case 'tilt': values.push(Math.round(s.tilt * 255)); break
        case 'tiltFine': values.push(Math.round((s.tilt * 255 % 1) * 255)); break
        case 'strobe': values.push(s.strobe); break
        case 'gobo': values.push(s.gobo); break
        default: values.push(channel.defaultValue)
      }
    }
    
    return values
  }
  
  getAllFixtures(): ManagedFixture[] {
    return Array.from(this.fixtures.values())
  }
  
  getGroup(groupName: string): ManagedFixture[] {
    const ids = this.groups.get(groupName) || []
    return ids.map(id => this.fixtures.get(id)).filter(Boolean) as ManagedFixture[]
  }
  
  getState(fixtureId: string): InternalFixtureState | null {
    return this.fixtures.get(fixtureId)?.state ?? null
  }
  
  registerDefinition(id: string, definition: FixtureDefinition): void {
    this.definitions.set(id, definition)
  }
  
  getAvailableDefinitions(): string[] {
    return Array.from(this.definitions.keys())
  }
  
  clear(): void {
    this.fixtures.clear()
    this.groups.clear()
  }
  
  getCount(): number {
    return this.fixtures.size
  }
}
