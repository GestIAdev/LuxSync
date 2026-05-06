/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚗️  WAVE 4573 — PHASE 6
 * Suite A: ShowFileMigrator — Validación de migraciones espaciales
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Valida:
 *   §1 — physics.orientation='wall-left' se promueve a raíz en parche 2.1→2.2
 *   §2 — Heurística de altura: Y > 2 → 'ceiling', Y ≤ 2 → 'floor'
 *   §3 — Fixtures legacy migrados a 2.1→2.2 obtienen isPlaced determinista
 *   §4 — migrateV2ToLatest es idempotente (ya en 2.2.0 → cero patches)
 *
 * AXIOMA ANTI-SIMULACIÓN: Cero Math.random(). Datos deterministas.
 *
 * @module core/stage/__tests__/ShowFileMigrator.test
 * @version WAVE 4573 Phase 6
 */

import { describe, test, expect } from 'vitest'
import { migrateV2ToLatest, LATEST_V2_VERSION } from '../ShowFileMigrator'
import type { ShowFileV2, FixtureV2 } from '../ShowFileV2'

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS — Builders de ShowFile mínimos para tests
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Crea un ShowFile mínimo en v2.1.0 listo para el parche WAVE 4573.
 * El campo "fixtures" es tipado como any[] para poder pasar datos legacy
 * con physics.orientation (campo deprecado pero que puede existir en disco).
 */
function makeShowV21(fixtures: any[]): ShowFileV2 {
  return {
    schemaVersion: '2.1.0',
    version: '2.0.0',
    name: 'Test Show',
    description: '',
    createdAt: '2024-01-01T00:00:00.000Z',
    modifiedAt: '2024-01-01T00:00:00.000Z',
    fixtures: fixtures as FixtureV2[],
    scenes: [],
    groups: [],
    dmx: { driver: 'virtual', port: '', universes: [0], frameRate: 40 },
    audio: { source: 'microphone', deviceId: '', deviceName: '', sensitivity: 1, inputGain: 1 },
    meta: { authorName: 'Test', tags: [], lastSavedBy: 'test' },
  }
}

/** Fixture mínimo v2.1 con orientación dentro de physics (campo legacy deprecado) */
function makeLegacyFixtureWithPhysicsOrientation(
  id: string,
  y: number,
  physicsOrientation: string,
): any {
  return {
    id,
    name: `Fixture ${id}`,
    model: `Model ${id}`,
    manufacturer: 'TestMfr',
    type: 'moving-head',
    address: 1,
    universe: 0,
    channelCount: 7,
    profileId: 'generic',
    position: { x: 0, y, z: 0 },
    rotation: { pitch: -45, yaw: 0, roll: 0 },
    // orientation está AUSENTE en raíz — vive en physics (legacy)
    physics: {
      motorType: 'stepper-cheap',
      maxAcceleration: 200,
      safetyCap: true,
      orientation: physicsOrientation, // campo deprecado que el parche debe promover
    },
    zone: 'front',
    enabled: true,
  }
}

/** Fixture mínimo v2.1 sin ninguna orientación (ni raíz ni physics) */
function makeFixtureNoOrientation(id: string, y: number): any {
  return {
    id,
    name: `Fixture ${id}`,
    model: `Model ${id}`,
    manufacturer: 'TestMfr',
    type: 'par',
    address: 5,
    universe: 0,
    channelCount: 4,
    profileId: 'generic',
    position: { x: 0, y, z: 0 },
    rotation: { pitch: 0, yaw: 0, roll: 0 },
    // Sin orientation, sin physics.orientation → heurística de altura
    physics: { motorType: 'stepper-cheap', maxAcceleration: 200, safetyCap: true },
    zone: 'front',
    enabled: true,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// §1 — Promoción de physics.orientation → raíz
// ═══════════════════════════════════════════════════════════════════════════

describe('Suite A §1 — Promoción physics.orientation → FixtureV2.orientation', () => {

  test('fixture con physics.orientation="wall-left" obtiene orientation="wall-left" en raíz', () => {
    const show = makeShowV21([
      makeLegacyFixtureWithPhysicsOrientation('fix-wl', 3.0, 'wall-left'),
    ])

    const { show: migrated, appliedPatches } = migrateV2ToLatest(show)

    expect(appliedPatches).toHaveLength(1)
    expect(appliedPatches[0]).toContain('4573')

    const fixture = migrated.fixtures[0]
    expect(fixture.orientation).toBe('wall-left')
  })

  test('fixture con physics.orientation="wall-right" obtiene orientation="wall-right" en raíz', () => {
    const show = makeShowV21([
      makeLegacyFixtureWithPhysicsOrientation('fix-wr', 3.0, 'wall-right'),
    ])

    const { show: migrated } = migrateV2ToLatest(show)

    expect(migrated.fixtures[0].orientation).toBe('wall-right')
  })

  test('fixture con physics.orientation="floor" obtiene orientation="floor" en raíz', () => {
    const show = makeShowV21([
      makeLegacyFixtureWithPhysicsOrientation('fix-fl', 0.5, 'floor'),
    ])

    const { show: migrated } = migrateV2ToLatest(show)

    expect(migrated.fixtures[0].orientation).toBe('floor')
  })

  test('si orientation ya está en raíz, NO se sobreescribe con physics.orientation', () => {
    // Caso edge: fixture que ya tenía orientación en raíz (2.2.0 pero sin schemaVersion bump)
    const show = makeShowV21([
      {
        ...makeLegacyFixtureWithPhysicsOrientation('fix-explicit', 3.0, 'truss-front'),
        orientation: 'ceiling', // ya tiene orientation explícita en raíz
      },
    ])

    const { show: migrated } = migrateV2ToLatest(show)

    // El parche NO sobreescribe orientation existente
    expect(migrated.fixtures[0].orientation).toBe('ceiling')
  })

})

// ═══════════════════════════════════════════════════════════════════════════
// §2 — Heurística de altura para orientation
// ═══════════════════════════════════════════════════════════════════════════

describe('Suite A §2 — Heurística de altura (sin physics.orientation)', () => {

  test('Y=4.5 (truss) → orientation="ceiling" por heurística', () => {
    const show = makeShowV21([
      makeFixtureNoOrientation('fix-high', 4.5),
    ])
    const { show: migrated } = migrateV2ToLatest(show)
    expect(migrated.fixtures[0].orientation).toBe('ceiling')
  })

  test('Y=2.5 (ligeramente alto) → orientation="ceiling" (umbral: Y > 2)', () => {
    const show = makeShowV21([
      makeFixtureNoOrientation('fix-mid-high', 2.5),
    ])
    const { show: migrated } = migrateV2ToLatest(show)
    expect(migrated.fixtures[0].orientation).toBe('ceiling')
  })

  test('Y=1.0 (suelo bajo) → orientation="floor" por heurística', () => {
    const show = makeShowV21([
      makeFixtureNoOrientation('fix-low', 1.0),
    ])
    const { show: migrated } = migrateV2ToLatest(show)
    expect(migrated.fixtures[0].orientation).toBe('floor')
  })

  test('Y=2.0 (exactamente en el umbral) → orientation="floor" (Y > 2 requerido)', () => {
    const show = makeShowV21([
      makeFixtureNoOrientation('fix-threshold', 2.0),
    ])
    const { show: migrated } = migrateV2ToLatest(show)
    // 2.0 NO es > 2, así que cae en 'floor'
    expect(migrated.fixtures[0].orientation).toBe('floor')
  })

  test('Y=0.3 (base del escenario) → orientation="floor" por heurística', () => {
    const show = makeShowV21([
      makeFixtureNoOrientation('fix-floor', 0.3),
    ])
    const { show: migrated } = migrateV2ToLatest(show)
    expect(migrated.fixtures[0].orientation).toBe('floor')
  })

})

// ═══════════════════════════════════════════════════════════════════════════
// §3 — isPlaced flag tras migración 2.1 → 2.2
// ═══════════════════════════════════════════════════════════════════════════

describe('Suite A §3 — isPlaced flag (fixtures legacy migrados)', () => {

  test('fixture legacy con posición NO-sentinel obtiene isPlaced=true', () => {
    const show = makeShowV21([
      makeFixtureNoOrientation('fix-placed', 4.5), // x:0, y:4.5, z:0 — NO es sentinel {0,3,0}
    ])
    const { show: migrated } = migrateV2ToLatest(show)
    expect(migrated.fixtures[0].isPlaced).toBe(true)
  })

  test('fixture legacy con posición sentinel {x:0, y:3, z:0} obtiene isPlaced=false', () => {
    const sentinel = makeFixtureNoOrientation('fix-sentinel', 3.0) // y=3 → sentinel si x=0, z=0
    const show = makeShowV21([sentinel])
    const { show: migrated } = migrateV2ToLatest(show)
    // {x:0, y:3, z:0} es exactamente el sentinel de Guerrilla mode
    expect(migrated.fixtures[0].isPlaced).toBe(false)
  })

  test('fixture con posición lateral (x != 0) obtiene isPlaced=true aunque y=3', () => {
    const fix = makeFixtureNoOrientation('fix-lateral', 3.0)
    fix.position = { x: 2.0, y: 3.0, z: 0.0 } // x != 0 → NO es sentinel
    const show = makeShowV21([fix])
    const { show: migrated } = migrateV2ToLatest(show)
    expect(migrated.fixtures[0].isPlaced).toBe(true)
  })

  test('si isPlaced ya estaba en fixture, NO se sobreescribe', () => {
    const fix = {
      ...makeFixtureNoOrientation('fix-pre-placed', 3.0),
      isPlaced: true, // ya tiene flag explícita (posición sentinel pero fue colocado manualmente)
    }
    const show = makeShowV21([fix])
    const { show: migrated } = migrateV2ToLatest(show)
    expect(migrated.fixtures[0].isPlaced).toBe(true)
  })

  test('múltiples fixtures: cada uno obtiene isPlaced correcto según su posición', () => {
    const show = makeShowV21([
      makeFixtureNoOrientation('fix-a', 4.5), // posición real → isPlaced=true
      makeFixtureNoOrientation('fix-b', 3.0), // sentinel → isPlaced=false
      makeFixtureNoOrientation('fix-c', 0.3), // posición real → isPlaced=true
    ])
    const { show: migrated } = migrateV2ToLatest(show)

    expect(migrated.fixtures[0].isPlaced).toBe(true)   // y=4.5, !sentinel
    expect(migrated.fixtures[1].isPlaced).toBe(false)  // y=3, x=0, z=0 → sentinel
    expect(migrated.fixtures[2].isPlaced).toBe(true)   // y=0.3, !sentinel
  })

})

// ═══════════════════════════════════════════════════════════════════════════
// §4 — Idempotencia
// ═══════════════════════════════════════════════════════════════════════════

describe('Suite A §4 — Idempotencia de migrateV2ToLatest', () => {

  test('show ya en versión 2.2.0 (LATEST) → cero patches aplicados', () => {
    const show = makeShowV21([]) // lo ponemos en 2.2.0 manualmente
    ;(show as any).schemaVersion = '2.2.0'

    const { appliedPatches } = migrateV2ToLatest(show)
    expect(appliedPatches).toHaveLength(0)
  })

  test('LATEST_V2_VERSION es "2.2.0"', () => {
    expect(LATEST_V2_VERSION).toBe('2.2.0')
  })

  test('show en 2.0.0 pasa por ambos parches: 2.0.0→2.1.0 y 2.1.0→2.2.0', () => {
    const show = makeShowV21([makeFixtureNoOrientation('fix-v200', 4.0)])
    ;(show as any).schemaVersion = '2.0.0'

    const { show: migrated, appliedPatches } = migrateV2ToLatest(show)

    expect(appliedPatches).toHaveLength(2)
    expect(migrated.schemaVersion).toBe('2.2.0')
    // El fixture debe tener orientation asignada al final
    expect(migrated.fixtures[0].orientation).toBeDefined()
    expect(migrated.fixtures[0].isPlaced).toBeDefined()
  })

})
