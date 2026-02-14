/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔄 SHOWFILE MIGRATOR - WAVE 360 Phase 1
 * "La Cirugía de Transplante de Órganos"
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Migración silenciosa de configuraciones v1 a ShowFile v2.
 * 
 * El usuario NO notará nada. Simplemente su viejo config.json
 * será leído, transformado y guardado en el nuevo formato.
 * 
 * REGLA: El primer fixture sin posición recibe una posición generada
 *        basada en su zona. Después de eso, SIEMPRE se persiste.
 * 
 * @module core/stage/ShowFileMigrator
 * @version 360.1.0
 */

import {
  ShowFileV2,
  FixtureV2,
  FixtureGroup,
  SceneV2,
  FixtureZone,
  PhysicsProfile,
  Position3D,
  Rotation3D,
  DEFAULT_PHYSICS_PROFILES,
  createEmptyShowFile,
  getSchemaVersion,
  normalizeZone
} from './ShowFileV2'

// ═══════════════════════════════════════════════════════════════════════════
// V1 TYPES (Old ConfigManager format)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * V1 Config structure (from ConfigManager.ts)
 */
interface ConfigV1 {
  version: string
  patchedFixtures: PatchedFixtureV1[]
  dmxConfig: {
    driver: string
    port: string
  }
  audioConfig: {
    source: string
    deviceId: string
    deviceName: string
    sensitivity: number
    inputGain: number
  }
}

/**
 * V1 Patched Fixture structure
 */
interface PatchedFixtureV1 {
  id: string
  name: string
  type: string
  manufacturer: string
  channelCount: number
  dmxAddress: number
  universe: number
  zone: string
  filePath: string
}

/**
 * V1 Scene structure (from localStorage)
 */
interface SceneV1 {
  id: string
  name: string
  fixtures: Record<string, {
    h?: number
    s?: number
    l?: number
    r?: number
    g?: number
    b?: number
    dimmer?: number
    pan?: number
    tilt?: number
  }>
}

// ═══════════════════════════════════════════════════════════════════════════
// POSITION GENERATION (One-time only for migration)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Stage reference dimensions for position generation
 */
const STAGE_REF = {
  width: 12,   // meters
  depth: 8,    // meters
  height: 5    // meters (truss height)
}

/**
 * Zone position templates
 * These are used ONLY during migration for fixtures without positions
 */
const ZONE_POSITIONS: Record<string, Position3D> = {
  // 🔥 WAVE 2040.24: Canonical zone positions
  'front':         { x: 0, y: 4.5, z: 2 },
  'back':          { x: 0, y: 4.5, z: -2 },
  'floor':         { x: 0, y: 0.3, z: 3 },
  'movers-left':   { x: -4.5, y: 3.0, z: 0 },
  'movers-right':  { x: 4.5, y: 3.0, z: 0 },
  'center':        { x: 0, y: 4.5, z: 0 },
  'air':           { x: 0, y: 3.5, z: -1 },
  'ambient':       { x: 0, y: 3.0, z: 0 },
  'unassigned':    { x: 0, y: 3.0, z: 0 }
}

/**
 * Generate position for a fixture based on its zone and index
 * Used ONLY during migration when no position exists
 */
function generateMigrationPosition(zone: string, indexInZone: number): Position3D {
  const basePos = ZONE_POSITIONS[zone] || ZONE_POSITIONS['unassigned']
  
  // Spread fixtures within zone (offset by index)
  const spreadX = (indexInZone % 3 - 1) * 1.5  // -1.5, 0, 1.5
  const spreadZ = Math.floor(indexInZone / 3) * 1.0
  
  return {
    x: basePos.x + spreadX,
    y: basePos.y,
    z: basePos.z + spreadZ
  }
}

/**
 * Generate default rotation based on zone (WAVE 2040.24: canonical zones)
 */
function generateMigrationRotation(zone: string): Rotation3D {
  // Floor fixtures point up
  if (zone === 'floor') {
    return { pitch: 45, yaw: 0, roll: 0 }
  }
  
  // Back/air fixtures point down-forward
  if (zone === 'back' || zone === 'air') {
    return { pitch: -45, yaw: 0, roll: 0 }
  }
  
  // Center (strobes/blinders) point straight down
  if (zone === 'center') {
    return { pitch: -60, yaw: 0, roll: 0 }
  }
  
  // Front pars point down at audience
  if (zone === 'front') {
    return { pitch: -30, yaw: 0, roll: 0 }
  }
  
  // Default: forward
  return { pitch: 0, yaw: 0, roll: 0 }
}

// ═══════════════════════════════════════════════════════════════════════════
// ZONE MAPPING (WAVE 2040.24: CANONICAL)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🔥 WAVE 2040.24 FASE 6: Map old zone string → CanonicalZone
 * Delega toda la lógica a normalizeZone() para una sola fuente de verdad.
 */
function mapZone(oldZone: string): FixtureZone {
  return normalizeZone(oldZone)
}

/**
 * Map old fixture type to new type
 */
function mapFixtureType(
  oldType: string
): 'moving-head' | 'par' | 'wash' | 'strobe' | 'laser' | 'blinder' | 'generic' {
  const typeMap: Record<string, 'moving-head' | 'par' | 'wash' | 'strobe' | 'laser' | 'blinder' | 'generic'> = {
    'moving-head': 'moving-head',
    'mover': 'moving-head',
    'spot': 'moving-head',
    'beam': 'moving-head',
    'par': 'par',
    'led-par': 'par',
    'wash': 'wash',
    'strobe': 'strobe',
    'laser': 'laser',
    'blinder': 'blinder'
  }
  
  const normalized = oldType.toLowerCase().trim()
  return typeMap[normalized] || 'generic'
}

// ═══════════════════════════════════════════════════════════════════════════
// PHYSICS INFERENCE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Infer motor type from fixture name/manufacturer
 * Conservative approach: default to stepper-cheap for safety
 */
function inferMotorType(name: string, manufacturer: string): PhysicsProfile {
  const lowName = name.toLowerCase()
  const lowMfr = manufacturer.toLowerCase()
  
  // Pro brands with servo motors
  const proServo = ['robe', 'clay paky', 'martin', 'vari-lite', 'ayrton']
  for (const brand of proServo) {
    if (lowMfr.includes(brand)) {
      return { ...DEFAULT_PHYSICS_PROFILES['servo-pro'] }
    }
  }
  
  // Quality brands with good steppers
  const qualityStepper = ['adj', 'chauvet', 'elation', 'american dj']
  for (const brand of qualityStepper) {
    if (lowMfr.includes(brand)) {
      return { ...DEFAULT_PHYSICS_PROFILES['stepper-quality'] }
    }
  }
  
  // Default: cheap stepper (safest assumption)
  // 🛡️ THE LIFE INSURANCE - Assume the worst, be pleasantly surprised
  return { ...DEFAULT_PHYSICS_PROFILES['stepper-cheap'] }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN MIGRATION LOGIC
// ═══════════════════════════════════════════════════════════════════════════

export interface MigrationResult {
  success: boolean
  showFile: ShowFileV2 | null
  warnings: string[]
  fixturesCount: number
  scenesCount: number
  groupsCount: number
}

/**
 * Migrate a V1 config to V2 ShowFile
 */
export function migrateConfigV1ToV2(
  configV1: ConfigV1,
  scenes: SceneV1[] = [],
  showName: string = 'Migrated Show'
): MigrationResult {
  const warnings: string[] = []
  
  // Create empty show as base
  const show = createEmptyShowFile(showName)
  show.description = `Migrated from LuxSync config v${configV1.version}`
  
  // ═══════════════════════════════════════════════════════════════════════
  // MIGRATE FIXTURES
  // ═══════════════════════════════════════════════════════════════════════
  
  // Count fixtures per zone for position spreading
  const zoneCounts: Record<string, number> = {}
  
  const fixtures: FixtureV2[] = configV1.patchedFixtures.map((oldFix) => {
    const zone = mapZone(oldFix.zone)
    const indexInZone = zoneCounts[zone] || 0
    zoneCounts[zone] = indexInZone + 1
    
    const physics = inferMotorType(oldFix.name, oldFix.manufacturer)
    
    return {
      id: oldFix.id,
      name: oldFix.name,
      model: oldFix.name,
      manufacturer: oldFix.manufacturer,
      type: mapFixtureType(oldFix.type),
      address: oldFix.dmxAddress,
      universe: oldFix.universe,
      channelCount: oldFix.channelCount,
      profileId: oldFix.filePath || 'generic',
      position: generateMigrationPosition(zone, indexInZone),
      rotation: generateMigrationRotation(zone),
      physics,
      zone,
      definitionPath: oldFix.filePath,
      enabled: true
    }
  })
  
  show.fixtures = fixtures
  
  // ═══════════════════════════════════════════════════════════════════════
  // MIGRATE SCENES (from localStorage data)
  // ═══════════════════════════════════════════════════════════════════════
  
  const migratedScenes: SceneV2[] = scenes.map((oldScene, index) => {
    const snapshots = Object.entries(oldScene.fixtures || {}).map(([fixtureId, values]) => ({
      fixtureId,
      values: values as SceneV2['snapshots'][0]['values']
    }))
    
    return {
      id: oldScene.id,
      name: oldScene.name || `Scene ${index + 1}`,
      description: 'Migrated from localStorage',
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      fadeTime: 500,
      tags: ['migrated'],
      previewColor: '#00f3ff',
      snapshots
    }
  })
  
  show.scenes = migratedScenes
  
  // ═══════════════════════════════════════════════════════════════════════
  // CREATE DEFAULT GROUPS
  // ═══════════════════════════════════════════════════════════════════════
  
  const groups: FixtureGroup[] = []
  
  // Auto-create zone-based groups
  const fixturesByZone = new Map<string, string[]>()
  for (const fix of fixtures) {
    if (!fixturesByZone.has(fix.zone)) {
      fixturesByZone.set(fix.zone, [])
    }
    fixturesByZone.get(fix.zone)!.push(fix.id)
  }
  
  let groupOrder = 0
  for (const [zone, ids] of fixturesByZone) {
    if (ids.length > 1) {  // Only create group if multiple fixtures
      groups.push({
        id: `group-zone-${zone}`,
        name: zone.replace('-', ' ').toUpperCase(),
        fixtureIds: ids,
        color: '#00f3ff',
        isSystem: true,
        order: groupOrder++
      })
    }
  }
  
  // Auto-create type-based groups
  const fixturesByType = new Map<string, string[]>()
  for (const fix of fixtures) {
    if (!fixturesByType.has(fix.type)) {
      fixturesByType.set(fix.type, [])
    }
    fixturesByType.get(fix.type)!.push(fix.id)
  }
  
  for (const [type, ids] of fixturesByType) {
    if (ids.length > 1 && type !== 'generic') {
      groups.push({
        id: `group-type-${type}`,
        name: `All ${type.replace('-', ' ')}s`,
        fixtureIds: ids,
        color: '#f54a00',
        isSystem: true,
        order: groupOrder++
      })
    }
  }
  
  // "All" group
  if (fixtures.length > 0) {
    groups.push({
      id: 'group-all',
      name: 'ALL FIXTURES',
      fixtureIds: fixtures.map(f => f.id),
      color: '#ffffff',
      hotkey: '0',
      isSystem: true,
      order: 999
    })
  }
  
  show.groups = groups
  
  // ═══════════════════════════════════════════════════════════════════════
  // MIGRATE DMX CONFIG
  // ═══════════════════════════════════════════════════════════════════════
  
  if (configV1.dmxConfig) {
    show.dmx = {
      driver: configV1.dmxConfig.driver as ShowFileV2['dmx']['driver'] || 'virtual',
      port: configV1.dmxConfig.port || '',
      universes: [0],  // Default, will be expanded based on fixtures
      frameRate: 40
    }
    
    // Auto-detect universes from fixtures
    const universes = new Set<number>()
    for (const fix of fixtures) {
      universes.add(fix.universe)
    }
    show.dmx.universes = Array.from(universes).sort((a, b) => a - b)
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // MIGRATE AUDIO CONFIG
  // ═══════════════════════════════════════════════════════════════════════
  
  if (configV1.audioConfig) {
    show.audio = {
      source: (configV1.audioConfig.source as ShowFileV2['audio']['source']) || 'simulation',
      deviceId: configV1.audioConfig.deviceId,
      deviceName: configV1.audioConfig.deviceName,
      sensitivity: configV1.audioConfig.sensitivity || 0.7,
      inputGain: configV1.audioConfig.inputGain || 1.0
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // RESULT
  // ═══════════════════════════════════════════════════════════════════════
  
  return {
    success: true,
    showFile: show,
    warnings,
    fixturesCount: fixtures.length,
    scenesCount: migratedScenes.length,
    groupsCount: groups.length
  }
}

/**
 * Detect if data is V1 or V2 and migrate if needed
 */
export function autoMigrate(data: unknown): MigrationResult {
  const version = getSchemaVersion(data)
  
  if (version === '2.0.0') {
    // Already V2
    return {
      success: true,
      showFile: data as ShowFileV2,
      warnings: [],
      fixturesCount: (data as ShowFileV2).fixtures.length,
      scenesCount: (data as ShowFileV2).scenes.length,
      groupsCount: (data as ShowFileV2).groups.length
    }
  }
  
  if (version === '1.0.0') {
    // V1 needs migration
    return migrateConfigV1ToV2(data as ConfigV1)
  }
  
  // Unknown format
  return {
    success: false,
    showFile: null,
    warnings: ['Unknown config format, cannot migrate'],
    fixturesCount: 0,
    scenesCount: 0,
    groupsCount: 0
  }
}

/**
 * Extract scenes from localStorage format (browser-side migration helper)
 */
export function parseLegacyScenes(localStorageData: string | null): SceneV1[] {
  if (!localStorageData) return []
  
  try {
    const data = JSON.parse(localStorageData)
    if (Array.isArray(data)) {
      return data as SceneV1[]
    }
    return []
  } catch {
    return []
  }
}
