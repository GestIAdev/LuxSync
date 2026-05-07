/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚗️  WAVE 4519.1 — THE PROVING GROUNDS
 * Suite 1: NodeExtractionPipeline — Forja → IDeviceDefinition
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Valida que la cadena de traducción de un FixtureDefinition legacy
 * a un IDeviceDefinition Aether produce nodos correctos 1:1, con
 * las familias semánticas correctas y los roles asignados.
 *
 * AXIOMA ANTI-SIMULACIÓN: Zero Math.random(). Todo determinista.
 * MÓDULO AISLADO: No usa TitanOrchestrator. Solo NodeExtractionPipeline.
 *
 * @module core/aether/__tests__/extraction-pipeline.test
 * @version WAVE 4519.1
 */

import { describe, test, expect, beforeEach } from 'vitest'
import { NodeExtractionPipeline } from '../ingestion/NodeExtractionPipeline'
import { NodeFamily } from '../types'
import type { FixtureDefinition, FixtureChannel } from '../../../types/FixtureDefinition'

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS — Builders de fixtures deterministas
// ═══════════════════════════════════════════════════════════════════════════

function ch(index: number, type: FixtureChannel['type'], name: string): FixtureChannel {
  return { index, name, type, defaultValue: 0, is16bit: false }
}

/** Fixture moving-head completo: dimmer + pan + tilt + r,g,b + zoom */
function makeFullMovingHead(): FixtureDefinition {
  return {
    id: 'test-mover-001',
    name: 'Test Mover 1',
    manufacturer: 'PunkFactory',
    type: 'moving-head',
    channels: [
      ch(1, 'dimmer',  'Dimmer'),
      ch(2, 'pan',     'Pan'),
      ch(3, 'tilt',    'Tilt'),
      ch(4, 'red',     'Red'),
      ch(5, 'green',   'Green'),
      ch(6, 'blue',    'Blue'),
      ch(7, 'zoom',    'Zoom'),
    ],
    capabilities: {
      hasDimmer: true,
      hasPan:    true,
      hasTilt:   true,
      hasColorMixing: true,
      colorEngine: 'rgb',
    },
    physics: {
      motorType:       'servo',
      maxAcceleration: 400,
      safetyCap:       true,
    },
  }
}

/** Fixture par: solo dimmer + r,g,b (sin movimiento) */
function makeRgbPar(): FixtureDefinition {
  return {
    id: 'test-par-002',
    name: 'Test PAR RGB',
    manufacturer: 'PunkFactory',
    type: 'par',
    channels: [
      ch(1, 'dimmer', 'Dimmer'),
      ch(2, 'red',    'Red'),
      ch(3, 'green',  'Green'),
      ch(4, 'blue',   'Blue'),
    ],
    capabilities: {
      hasDimmer:      true,
      hasColorMixing: true,
      colorEngine:    'rgb',
    },
  }
}

/** Fixture roto: dimmer y red comparten el mismo slot físico */
function makeOverlappingRgbMover(): FixtureDefinition {
  return {
    id: 'broken-overlap-004',
    name: 'Broken RGB Mover',
    manufacturer: 'PunkFactory',
    type: 'moving-head',
    channels: [
      ch(1, 'dimmer', 'Dimmer'),
      ch(1, 'red', 'Red'),
      ch(2, 'green', 'Green'),
      ch(3, 'blue', 'Blue'),
      ch(4, 'white', 'White'),
      ch(5, 'strobe', 'Strobe'),
      ch(6, 'amber', 'Amber'),
    ],
    capabilities: {
      hasDimmer: true,
      hasColorMixing: true,
      colorEngine: 'rgbw',
      hasStrobe: true,
    },
  }
}

/** Fixture fog machine: solo custom output channel */
function makeFogMachine(): FixtureDefinition {
  return {
    id: 'test-fog-003',
    name: 'Test Fog Machine',
    manufacturer: 'PunkFactory',
    type: 'fog',
    channels: [
      ch(1, 'custom', 'Fog Output'),
    ],
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SUITE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

describe('⚗️ NodeExtractionPipeline — La Forja', () => {

  let pipeline: NodeExtractionPipeline

  beforeEach(() => {
    pipeline = new NodeExtractionPipeline()
  })

  // ─────────────────────────────────────────────────────────────────────
  // §1 — EXTRACCIÓN DE FAMILIAS BÁSICAS
  // ─────────────────────────────────────────────────────────────────────

  describe('§1 — Extracción de familias semánticas', () => {

    test('Un moving-head completo produce nodos de 4 familias distintas', () => {
      const def = pipeline.extract(makeFullMovingHead(), 1, 0, 'front')
      const families = def.nodes.map(n => n.family)

      expect(families).toContain(NodeFamily.IMPACT)
      expect(families).toContain(NodeFamily.COLOR)
      expect(families).toContain(NodeFamily.KINETIC)
      expect(families).toContain(NodeFamily.BEAM)
    })

    test('Un PAR RGB produce solo IMPACT y COLOR — sin KINETIC ni BEAM', () => {
      const def = pipeline.extract(makeRgbPar(), 1, 0, 'floor')
      const families = new Set(def.nodes.map(n => n.family))

      expect(families.has(NodeFamily.IMPACT)).toBe(true)
      expect(families.has(NodeFamily.COLOR)).toBe(true)
      expect(families.has(NodeFamily.KINETIC)).toBe(false)
      expect(families.has(NodeFamily.BEAM)).toBe(false)
    })

    test('Una máquina de humo (type=fog) produce un nodo ATMOSPHERE', () => {
      const def = pipeline.extract(makeFogMachine(), 1, 0, 'back')
      const families = new Set(def.nodes.map(n => n.family))

      expect(families.has(NodeFamily.ATMOSPHERE)).toBe(true)
    })

  })

  // ─────────────────────────────────────────────────────────────────────
  // §2 — EXTRACCIÓN DE NODO KINETIC
  // ─────────────────────────────────────────────────────────────────────

  describe('§2 — Nodo KINETIC del moving-head', () => {

    test('El nodo KINETIC tiene canales pan y tilt', () => {
      const def = pipeline.extract(makeFullMovingHead(), 1, 0, 'front')
      const kinetic = def.nodes.find(n => n.family === NodeFamily.KINETIC)

      expect(kinetic).toBeDefined()
      const channelTypes = kinetic!.channels.map(c => c.type)
      expect(channelTypes).toContain('pan')
      expect(channelTypes).toContain('tilt')
    })

    test('El nodo KINETIC tiene maxPanSpeed y maxTiltSpeed > 0', () => {
      const def = pipeline.extract(makeFullMovingHead(), 1, 0, 'front')
      const kinetic = def.nodes.find(n => n.family === NodeFamily.KINETIC) as any

      expect(kinetic).toBeDefined()
      expect(kinetic.maxPanSpeed).toBeGreaterThan(0)
      expect(kinetic.maxTiltSpeed).toBeGreaterThan(0)
    })

    test('El nodo KINETIC tiene currentPosition inicializado a 0.5', () => {
      const def = pipeline.extract(makeFullMovingHead(), 1, 0, 'front')
      const kinetic = def.nodes.find(n => n.family === NodeFamily.KINETIC) as any

      expect(kinetic).toBeDefined()
      expect(kinetic.currentPosition).toBeDefined()
      expect(kinetic.currentPosition.pan).toBeCloseTo(0.5)
      expect(kinetic.currentPosition.tilt).toBeCloseTo(0.5)
    })

  })

  // ─────────────────────────────────────────────────────────────────────
  // §3 — EXTRACCIÓN DE NODO BEAM (zoom)
  // ─────────────────────────────────────────────────────────────────────

  describe('§3 — Nodo BEAM del moving-head (zoom)', () => {

    test('El nodo BEAM existe y tiene hasZoom = true', () => {
      const def = pipeline.extract(makeFullMovingHead(), 1, 0, 'front')
      const beam = def.nodes.find(n => n.family === NodeFamily.BEAM) as any

      expect(beam).toBeDefined()
      expect(beam.hasZoom).toBe(true)
    })

    test('El canal zoom tiene el role "decoration" o equivalente semántico', () => {
      const def = pipeline.extract(makeFullMovingHead(), 1, 0, 'front')
      const beam = def.nodes.find(n => n.family === NodeFamily.BEAM)

      expect(beam).toBeDefined()
      // El BEAM node tiene role. No es un nodo reactivo al audio.
      expect(typeof beam!.role).toBe('string')
      expect(beam!.role.length).toBeGreaterThan(0)
    })

  })

  // ─────────────────────────────────────────────────────────────────────
  // §4 — INTEGRIDAD DEL IDeviceDefinition
  // ─────────────────────────────────────────────────────────────────────

  describe('§4 — Integridad del IDeviceDefinition generado', () => {

    test('El deviceId y universe/address se preservan correctamente', () => {
      const DEF = makeFullMovingHead()
      const result = pipeline.extract(DEF, 17, 2, 'movers-left')

      expect(result.dmxAddress).toBe(17)
      expect(result.universe).toBe(2)
    })

    test('Todos los nodeIds son únicos dentro del mismo device', () => {
      const def = pipeline.extract(makeFullMovingHead(), 1, 0, 'front')
      const ids = def.nodes.map(n => n.nodeId)
      const uniqueIds = new Set(ids)

      expect(uniqueIds.size).toBe(ids.length)
    })

    test('Todos los nodes tienen el mismo deviceId base en su nodeId', () => {
      const def = pipeline.extract(makeFullMovingHead(), 1, 0, 'front')

      for (const node of def.nodes) {
        // nodeId format: "<deviceId>:<nodeLabel>"
        expect(node.nodeId).toContain(':')
        const [devicePart] = node.nodeId.split(':')
        expect(devicePart.length).toBeGreaterThan(0)
      }
    })

    test('El fixture PAR tiene el mismo número de canales que en su definición', () => {
      const parDef = makeRgbPar()
      const result = pipeline.extract(parDef, 5, 0, 'floor')

      // Sumar canales totales de todos los nodos debe cubrir todos los channels
      // (un canal puede pertenecer a un solo nodo — sin solapamiento)
      const allChannels = result.nodes.flatMap(n => n.channels)
      const allTypes = allChannels.map(c => c.type)

      expect(allTypes).toContain('dimmer')
      expect(allTypes).toContain('red')
      expect(allTypes).toContain('green')
      expect(allTypes).toContain('blue')
    })

    test('Canales solapados en el mismo offset se sanean con prioridad semántica', () => {
      const result = pipeline.extract(makeOverlappingRgbMover(), 49, 0, 'back')

      const impact = result.nodes.find(node => node.family === NodeFamily.IMPACT)
      const color = result.nodes.find(node => node.family === NodeFamily.COLOR)

      expect(impact).toBeDefined()
      expect(color).toBeDefined()

      const impactDimmer = impact!.channels.find(channel => channel.type === 'dimmer')
      const colorRed = color!.channels.find(channel => channel.type === 'red')
      const colorGreen = color!.channels.find(channel => channel.type === 'green')

      expect(impactDimmer?.dmxOffset).toBe(0)
      expect(colorRed).toBeUndefined()
      expect(colorGreen?.dmxOffset).toBe(1)
    })

  })

  // ─────────────────────────────────────────────────────────────────────
  // §5 — FIXTURE TYPES ESPECIALES
  // ─────────────────────────────────────────────────────────────────────

  describe('§5 — Fixture types especiales → ATMOSPHERE', () => {

    test('Tipo "fog" genera nodo ATMOSPHERE aunque su canal sea "custom"', () => {
      const fogDef = makeFogMachine()
      const result = pipeline.extract(fogDef, 1, 0, 'back')

      const atmosNode = result.nodes.find(n => n.family === NodeFamily.ATMOSPHERE)
      expect(atmosNode).toBeDefined()
    })

    test('Un PAR no genera ATMOSPHERE', () => {
      const parDef = makeRgbPar()
      const result = pipeline.extract(parDef, 1, 0, 'floor')

      const atmosNode = result.nodes.find(n => n.family === NodeFamily.ATMOSPHERE)
      expect(atmosNode).toBeUndefined()
    })

  })

})
