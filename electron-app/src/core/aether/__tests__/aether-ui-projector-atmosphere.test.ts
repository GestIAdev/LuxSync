/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌫️  WAVE 8416 — ATMOSPHERIC TELEMETRY DECOUPLING TESTS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * El bug: AetherUIProjector duck-typeaba `dimmer`/`r`/`g`/`b` de CUALQUIER
 * familia de nodo. Cuando un adapter L0/L1 hacía broadcast zonal escribiendo
 * esas keys al mapa arbitrado del nodo `:atmosphere`, la telemetría rítmica
 * llegaba al Tactical Canvas → el icono del fog pulsaba con el beat aunque
 * la bomba estuviera a 0.
 *
 * Invariante post-8416:
 *   - Un nodo ATMOSPHERE NUNCA proyecta fotónica (dimmer/rgb/sub-zonas).
 *   - `fixture.dimmer` (la métrica visual del icono) solo refleja EMISIÓN
 *     real: smoke_pump / smoke_density / fire_valve / fire_ignite /
 *     emission_gate / fan_speed + aliases crudos (smoke/fire/emission) +
 *     canal 'custom' con nombre de emisión.
 *   - Emisión 0 → fixture.dimmer 0 → icono inerte.
 *   - Nodos fotónicos (IMPACT/COLOR) conservan la proyección normal.
 *
 * AXIOMA ANTI-SIMULACIÓN: Sin Math.random(). Entradas deterministas.
 *
 * @module core/aether/__tests__/aether-ui-projector-atmosphere.test
 * @version WAVE 8416
 */

import { describe, test, expect } from 'vitest'
import { AetherUIProjector } from '../resolver/AetherUIProjector'
import { NodeFamily } from '../types'
import type { NodeGraph } from '../NodeGraph'
import type { IAtmosphereNodeData, IImpactNodeData } from '../capability-node'
import type { ArbitratedNodeMap } from '../intent-bus'
import type { FixtureState } from '../../../hal/mapping/FixtureMapper'
import type { DeviceId, NodeId } from '../types'

// ═══════════════════════════════════════════════════════════════════════════
// FACTORIES
// ═══════════════════════════════════════════════════════════════════════════

const DEVICE_ID = 'fog-dev-01' as DeviceId
const ATMO_NODE_ID = 'fog-dev-01:atmosphere' as NodeId

function makeAtmosphereNode(
  channelTypes: Array<{ type: string; customName?: string }> = [{ type: 'smoke_pump' }],
): IAtmosphereNodeData {
  return {
    nodeId: ATMO_NODE_ID,
    family: NodeFamily.ATMOSPHERE,
    role: 'primary',
    deviceId: DEVICE_ID,
    zoneId: 'air',
    channels: channelTypes.map((c, i) => ({
      type: c.type, dmxOffset: i, defaultValue: 0, customName: c.customName,
    })),
    atmosType: 'fog',
    safety: { armed: false },
  } as unknown as IAtmosphereNodeData
}

function makeImpactNode(nodeId = 'par-01:impact', deviceId = 'par-01'): IImpactNodeData {
  return {
    nodeId,
    family: NodeFamily.IMPACT,
    role: 'primary',
    deviceId,
    zoneId: 'floor',
    channels: [{ type: 'dimmer', dmxOffset: 0, defaultValue: 0 }],
  } as unknown as IImpactNodeData
}

function makeFixture(fixtureId = DEVICE_ID as string, type = 'fog'): FixtureState {
  return {
    dmxAddress: 1, universe: 0, name: 'PLS FL 1500', zone: 'air', type,
    dimmer: 0, r: 0, g: 0, b: 0,
    pan: 128, tilt: 128, zoom: 128, focus: 128,
    fixtureId,
  } as FixtureState
}

function makeGraph(
  devices: Map<string, Array<{ nodeId: string; data: unknown }>>,
): NodeGraph {
  const nodeById = new Map<string, unknown>()
  for (const nodes of devices.values()) {
    for (const n of nodes) nodeById.set(n.nodeId, n.data)
  }
  return {
    getDeviceNodes: (id: DeviceId) => (devices.get(id as string) ?? []).map(n => n.nodeId),
    getNodeData: (id: NodeId) => nodeById.get(id as string),
  } as unknown as NodeGraph
}

function makeArbitrated(entries: Record<string, Record<string, number>>): ArbitratedNodeMap {
  return new Map(Object.entries(entries)) as ArbitratedNodeMap
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('WAVE 8416 — Atmospheric Telemetry Decoupling', () => {
  const projector = new AetherUIProjector()

  test('bleed fotónico L0/L1 (dimmer+rgb) en nodo :atmosphere NO llega al fixture', () => {
    const fixture = makeFixture()
    const graph = makeGraph(new Map([
      [DEVICE_ID as string, [{ nodeId: ATMO_NODE_ID, data: makeAtmosphereNode() }]],
    ]))
    // Broadcast zonal rítmico — el caso real del bug reportado.
    const arbitrated = makeArbitrated({
      [ATMO_NODE_ID]: { dimmer: 0.9, r: 1, g: 0.5, b: 0.2, brightness: 0.8 },
    })

    projector.project([fixture], graph, arbitrated, false, 16)

    expect(fixture.dimmer).toBe(0)
    expect(fixture.r).toBe(0)
    expect(fixture.g).toBe(0)
    expect(fixture.b).toBe(0)
    expect(fixture.rAir ?? 0).toBe(0)
    expect(fixture.rAmbient ?? 0).toBe(0)
    expect(fixture.rStrobe ?? 0).toBe(0)
  })

  test('emisión real (smoke_pump) SÍ proyecta a fixture.dimmer', () => {
    const fixture = makeFixture()
    const graph = makeGraph(new Map([
      [DEVICE_ID as string, [{ nodeId: ATMO_NODE_ID, data: makeAtmosphereNode() }]],
    ]))
    const arbitrated = makeArbitrated({ [ATMO_NODE_ID]: { smoke_pump: 0.6 } })

    projector.project([fixture], graph, arbitrated, false, 16)

    expect(fixture.dimmer).toBe(Math.round(0.6 * 255))
    expect(fixture.r).toBe(0) // nunca crominancia
  })

  test('smoke_pump = 0 → icono inerte (dimmer 0) aunque haya bleed rítmico', () => {
    const fixture = makeFixture()
    const graph = makeGraph(new Map([
      [DEVICE_ID as string, [{ nodeId: ATMO_NODE_ID, data: makeAtmosphereNode() }]],
    ]))
    const arbitrated = makeArbitrated({
      [ATMO_NODE_ID]: { smoke_pump: 0, dimmer: 1, r: 1, g: 1, b: 1 },
    })

    projector.project([fixture], graph, arbitrated, false, 16)

    expect(fixture.dimmer).toBe(0)
  })

  test('alias crudos (smoke/fire/emission) cuentan como emisión', () => {
    const fixture = makeFixture()
    const graph = makeGraph(new Map([
      [DEVICE_ID as string, [{ nodeId: ATMO_NODE_ID, data: makeAtmosphereNode() }]],
    ]))
    const arbitrated = makeArbitrated({ [ATMO_NODE_ID]: { smoke: 0.5 } })

    projector.project([fixture], graph, arbitrated, false, 16)

    expect(fixture.dimmer).toBe(Math.round(0.5 * 255))
  })

  test("canal 'custom' solo cuenta como emisión si su nombre es atmosférico", () => {
    const named = makeFixture()
    const unnamed = makeFixture()
    const nodeNamed = makeAtmosphereNode([{ type: 'custom', customName: 'Smoke Pump' }])
    const nodeGeneric = makeAtmosphereNode([{ type: 'custom', customName: 'Reset Macro' }])
    const graphNamed = makeGraph(new Map([
      [DEVICE_ID as string, [{ nodeId: ATMO_NODE_ID, data: nodeNamed }]],
    ]))
    const graphGeneric = makeGraph(new Map([
      [DEVICE_ID as string, [{ nodeId: ATMO_NODE_ID, data: nodeGeneric }]],
    ]))
    const arbitrated = makeArbitrated({ [ATMO_NODE_ID]: { custom: 0.7 } })

    projector.project([named], graphNamed, arbitrated, false, 16)
    projector.project([unnamed], graphGeneric, arbitrated, false, 16)

    expect(named.dimmer).toBe(Math.round(0.7 * 255))
    expect(unnamed.dimmer).toBe(0)
  })

  test('fixture fotónico normal (IMPACT) conserva dimmer rítmico — sin regresión', () => {
    const parFixture = makeFixture('par-01', 'par')
    const impactNode = makeImpactNode()
    const graph = makeGraph(new Map([
      ['par-01', [{ nodeId: 'par-01:impact', data: impactNode }]],
    ]))
    const arbitrated = makeArbitrated({ 'par-01:impact': { dimmer: 0.8 } })

    projector.project([parFixture], graph, arbitrated, false, 16)

    // role='primary' aplica gain ×1.25 (WAVE 4696 M2): 0.8×1.25=1.0 → 255
    expect(parFixture.dimmer).toBe(255)
  })

  test('smoke_density y fan_speed también alimentan la emisión visual', () => {
    const fixture = makeFixture()
    const graph = makeGraph(new Map([
      [DEVICE_ID as string, [{ nodeId: ATMO_NODE_ID, data: makeAtmosphereNode() }]],
    ]))
    const arbitrated = makeArbitrated({ [ATMO_NODE_ID]: { smoke_density: 0.3, fan_speed: 0.4 } })

    projector.project([fixture], graph, arbitrated, false, 16)

    expect(fixture.dimmer).toBe(Math.round(0.4 * 255)) // HTP: el mayor gana
  })

  // ── WAVE 8416 hotfix: fixture-level clamp (el bug del "pulso gris") ─────

  test('nodo IMPACT fantasma (dimmer sintético del fallback) NO ilumina un fog', () => {
    // El caso real reportado: FixtureHydrationEngine inyectaba un canal
    // 'dimmer' a fixtures sin perfil → nodo IMPACT → broadcasts L0 de
    // zona escribían dimmer rítmico → icono gris pulsando con los kicks.
    const fixture = makeFixture()
    const impactNode = makeImpactNode(`${DEVICE_ID}:impact`, DEVICE_ID as string)
    const graph = makeGraph(new Map([
      [DEVICE_ID as string, [
        { nodeId: ATMO_NODE_ID, data: makeAtmosphereNode() },
        { nodeId: `${DEVICE_ID}:impact`, data: impactNode },
      ]],
    ]))
    const arbitrated = makeArbitrated({
      [ATMO_NODE_ID]: { level: 0.9 },          // key muerta L0 — no es emisión
      [`${DEVICE_ID}:impact`]: { dimmer: 0.9 }, // bleed fotónico del fantasma
    })

    projector.project([fixture], graph, arbitrated, false, 16)

    expect(fixture.dimmer).toBe(0)
    expect(fixture.r).toBe(0)
  })

  test('ingenio huérfano SIN nodos: dimmer legado (Hephaestus) se fuerza a 0', () => {
    // Fixture del rack básico sin grafo — el path legado escribe f.dimmer
    // antes de project(). El clamp post-loop lo anula.
    const fixture = makeFixture('orphan-fog')
    fixture.dimmer = 200   // bleed pre-project (Hephaestus 'intensity')
    fixture.r = 200; fixture.g = 180; fixture.b = 150
    const graph = makeGraph(new Map()) // sin nodos registrados

    projector.project([fixture], graph, makeArbitrated({}), false, 16)

    expect(fixture.dimmer).toBe(0)
    expect(fixture.r).toBe(0)
    expect(fixture.rAir ?? 0).toBe(0)
  })

  test('phantomChannels (path huérfano setExtra → byte DMX real) alimentan el icono', () => {
    const fixture = makeFixture('orphan-fog')
    fixture.phantomChannels = { smoke_pump: 128 }
    const graph = makeGraph(new Map())

    projector.project([fixture], graph, makeArbitrated({}), false, 16)

    expect(fixture.dimmer).toBe(128)
  })

  test('mirror-ball: rotation (motor) cuenta como actividad, no es fotónica', () => {
    const fixture = makeFixture('mb-01', 'mirror-ball')
    const graph = makeGraph(new Map())
    fixture.rotation = 200

    projector.project([fixture], graph, makeArbitrated({}), false, 16)

    expect(fixture.dimmer).toBe(200)
  })
})
