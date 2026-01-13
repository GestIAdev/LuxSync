/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📄 SHOWFILE V2 SCHEMA - WAVE 360 Phase 1
 * "La Memoria Fotográfica de LuxSync"
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Este archivo define la estructura de datos para el nuevo sistema de
 * persistencia. Reemplaza el viejo config.json con un formato más robusto
 * que soporta:
 * 
 * - Posiciones 3D reales (no algorítmicas)
 * - Rotación base de fixtures
 * - Grupos de fixtures
 * - Zonas explícitas
 * - Perfiles de seguridad física
 * - Escenas (migradas desde localStorage)
 * 
 * @module core/stage/ShowFileV2
 * @version 360.1.0
 */

// ═══════════════════════════════════════════════════════════════════════════
// TYPES: PHYSICS & SAFETY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Motor types that affect physics behavior
 * - 'servo-pro': Fast, precise, expensive (like Clay Paky)
 * - 'stepper-quality': Good balance (like ADJ Vizi)
 * - 'stepper-cheap': Slow, needs protection (Chinese clones)
 * - 'unknown': Conservative defaults
 */
export type MotorType = 'servo-pro' | 'stepper-quality' | 'stepper-cheap' | 'unknown'

/**
 * Physical installation orientation
 * - 'ceiling': Hanging from truss, pointing down (default)
 * - 'floor': On ground, pointing up
 * - 'wall-left': Mounted on left wall
 * - 'wall-right': Mounted on right wall
 * - 'truss-front': Hanging from front truss
 * - 'truss-back': Hanging from back truss
 */
export type InstallationOrientation = 
  | 'ceiling' 
  | 'floor' 
  | 'wall-left' 
  | 'wall-right' 
  | 'truss-front' 
  | 'truss-back'

/**
 * 🛡️ PHYSICS PROFILE - THE LIFE INSURANCE
 * 
 * This is the most critical section. It defines how the fixture
 * physically behaves and what safety limits apply.
 */
export interface PhysicsProfile {
  /** Motor technology affects speed/acceleration limits */
  motorType: MotorType
  
  /** Maximum acceleration in DMX units/second² (THE LIFE INSURANCE) */
  maxAcceleration: number
  
  /** Maximum velocity in DMX units/second */
  maxVelocity: number
  
  /** Enable safety cap (clamps all movements) */
  safetyCap: boolean
  
  /** Physical installation orientation */
  orientation: InstallationOrientation
  
  /** Invert pan direction (for fixtures mounted backwards) */
  invertPan: boolean
  
  /** Invert tilt direction (for fixtures mounted upside-down) */
  invertTilt: boolean
  
  /** Swap pan/tilt axes (for fixtures rotated 90°) */
  swapPanTilt: boolean
  
  /** Home position (where fixture rests when idle) */
  homePosition: {
    pan: number   // 0-255 DMX
    tilt: number  // 0-255 DMX
  }
  
  /** Tilt limits to prevent aiming at audience */
  tiltLimits: {
    min: number   // 0-255 DMX (lowest allowed)
    max: number   // 0-255 DMX (highest allowed)
  }
}

/**
 * Default physics profiles by motor type
 */
export const DEFAULT_PHYSICS_PROFILES: Record<MotorType, PhysicsProfile> = {
  'servo-pro': {
    motorType: 'servo-pro',
    maxAcceleration: 4000,
    maxVelocity: 800,
    safetyCap: false,
    orientation: 'ceiling',
    invertPan: false,
    invertTilt: false,
    swapPanTilt: false,
    homePosition: { pan: 127, tilt: 127 },
    tiltLimits: { min: 20, max: 200 }
  },
  'stepper-quality': {
    motorType: 'stepper-quality',
    maxAcceleration: 2500,
    maxVelocity: 600,
    safetyCap: true,
    orientation: 'ceiling',
    invertPan: false,
    invertTilt: false,
    swapPanTilt: false,
    homePosition: { pan: 127, tilt: 127 },
    tiltLimits: { min: 20, max: 200 }
  },
  'stepper-cheap': {
    motorType: 'stepper-cheap',
    maxAcceleration: 1500,  // 🛡️ THE LIFE INSURANCE - Low acceleration for cheap motors
    maxVelocity: 400,
    safetyCap: true,
    orientation: 'ceiling',
    invertPan: false,
    invertTilt: false,
    swapPanTilt: false,
    homePosition: { pan: 127, tilt: 127 },
    tiltLimits: { min: 30, max: 180 }
  },
  'unknown': {
    motorType: 'unknown',
    maxAcceleration: 2000,  // Conservative default
    maxVelocity: 500,
    safetyCap: true,
    orientation: 'ceiling',
    invertPan: false,
    invertTilt: false,
    swapPanTilt: false,
    homePosition: { pan: 127, tilt: 127 },
    tiltLimits: { min: 20, max: 200 }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPES: POSITION & GEOMETRY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 3D Position in meters (real-world coordinates)
 * 
 * Coordinate system:
 * - X: Left (-) to Right (+) from audience perspective
 * - Y: Down (-) to Up (+) (0 = floor level)
 * - Z: Back (-) to Front (+) (0 = center stage)
 */
export interface Position3D {
  x: number  // meters
  y: number  // meters
  z: number  // meters
}

/**
 * 3D Rotation in degrees
 * 
 * - pitch: Rotation around X axis (tilting forward/backward)
 * - yaw: Rotation around Y axis (turning left/right)
 * - roll: Rotation around Z axis (tilting sideways)
 */
export interface Rotation3D {
  pitch: number  // degrees, typically -90 to +90
  yaw: number    // degrees, 0-360
  roll: number   // degrees, -180 to +180
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPES: FIXTURE V2
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Zone identifiers (now explicit strings, not auto-assigned)
 */
export type FixtureZone = 
  | 'stage-left'
  | 'stage-right'
  | 'stage-center'
  | 'ceiling-front'
  | 'ceiling-back'
  | 'ceiling-left'
  | 'ceiling-right'
  | 'ceiling-center'
  | 'floor-front'
  | 'floor-back'
  | 'truss-1'
  | 'truss-2'
  | 'truss-3'
  | 'custom'
  | 'unassigned'

/**
 * 🎯 FIXTURE V2 - The complete fixture definition with all persistence
 */
export interface FixtureV2 {
  /** Unique identifier (e.g., "fix-001", "mover-left-1") */
  id: string
  
  /** User-defined name (e.g., "Front Wash Left") */
  name: string
  
  /** Display name from fixture library (e.g., "ADJ Vizi Beam 5RX") */
  model: string
  
  /** Manufacturer (e.g., "ADJ", "Chauvet", "Robe") */
  manufacturer: string
  
  /** Fixture type for categorization */
  type: 'moving-head' | 'par' | 'wash' | 'strobe' | 'laser' | 'blinder' | 'generic'
  
  // ═══════════════════════════════════════════════════════════════════════
  // DMX CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════
  
  /** DMX address (1-512) */
  address: number
  
  /** DMX universe (0-based) */
  universe: number
  
  /** Total channel count */
  channelCount: number
  
  /** Reference to fixture profile in library */
  profileId: string
  
  // ═══════════════════════════════════════════════════════════════════════
  // PHYSICAL CONFIGURATION (PERSISTED!)
  // ═══════════════════════════════════════════════════════════════════════
  
  /** 3D position in real-world meters */
  position: Position3D
  
  /** Base rotation (how the fixture is mounted) */
  rotation: Rotation3D
  
  /** Physics and safety profile */
  physics: PhysicsProfile
  
  /** Zone for grouping and routing */
  zone: FixtureZone
  
  // ═══════════════════════════════════════════════════════════════════════
  // METADATA
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Path to .fxt definition file */
  definitionPath?: string
  
  /** User notes */
  notes?: string
  
  /** Is this fixture enabled? */
  enabled: boolean
  
  /** Color for visualization (hex) */
  displayColor?: string
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🔥 WAVE 384: INLINE CHANNEL & CAPABILITY DATA
  // These are persisted to ensure fixture data survives library changes
  // ═══════════════════════════════════════════════════════════════════════
  
  /** 
   * Channel definitions from library (persisted inline)
   * This ensures the fixture knows its channels even if library changes
   */
  channels?: Array<{
    index: number
    name: string
    type: string
    is16bit: boolean
  }>
  
  /**
   * Fixture capabilities flags (persisted inline)
   * Used by MasterArbiter for intelligent color/movement routing
   */
  capabilities?: {
    hasMovementChannels?: boolean
    has16bitMovement?: boolean
    hasColorMixing?: boolean
    hasColorWheel?: boolean
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔥 WAVE 384: TYPE MAPPING HELPER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Map library fixture type (FXTParser format) to FixtureV2 type
 */
export function mapLibraryTypeToFixtureType(
  libraryType: string
): FixtureV2['type'] {
  const typeMap: Record<string, FixtureV2['type']> = {
    'moving_head': 'moving-head',
    'movinghead': 'moving-head',
    'moving-head': 'moving-head',
    'par': 'par',
    'wash': 'wash',
    'strobe': 'strobe',
    'laser': 'laser',
    'blinder': 'blinder',
    'generic': 'generic'
  }
  
  return typeMap[libraryType?.toLowerCase()] || 'generic'
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPES: GROUPS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🎭 FIXTURE GROUP - For organizing and controlling multiple fixtures
 */
export interface FixtureGroup {
  /** Unique group identifier */
  id: string
  
  /** User-defined name (e.g., "Front Wash", "All Movers") */
  name: string
  
  /** Array of fixture IDs belonging to this group */
  fixtureIds: string[]
  
  /** Display color for group visualization */
  color: string
  
  /** Keyboard shortcut (e.g., "1", "F1") */
  hotkey?: string
  
  /** Is this a system-generated group? (e.g., "All", "By Zone") */
  isSystem: boolean
  
  /** Order for display in UI */
  order: number
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPES: SCENES (migrated from localStorage)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Serialized fixture state for scene snapshot
 */
export interface FixtureSnapshot {
  fixtureId: string
  values: {
    h?: number
    s?: number
    l?: number
    r?: number
    g?: number
    b?: number
    w?: number
    dimmer?: number
    pan?: number
    tilt?: number
    focus?: number
    zoom?: number
    gobo?: number
    prism?: boolean
  }
}

/**
 * 📸 SCENE - A snapshot of fixture states
 */
export interface SceneV2 {
  /** Unique scene identifier */
  id: string
  
  /** User-defined name */
  name: string
  
  /** Scene description/notes */
  description?: string
  
  /** Creation timestamp */
  createdAt: string
  
  /** Last modification timestamp */
  modifiedAt: string
  
  /** Default fade time in milliseconds */
  fadeTime: number
  
  /** Tags for organization */
  tags: string[]
  
  /** Preview color (hex) */
  previewColor: string
  
  /** Fixture snapshots */
  snapshots: FixtureSnapshot[]
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPES: STAGE CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Physical stage dimensions
 */
export interface StageDimensions {
  /** Stage width in meters */
  width: number
  
  /** Stage depth in meters */
  depth: number
  
  /** Maximum height (truss/ceiling) in meters */
  height: number
  
  /** Grid cell size for snapping (meters) */
  gridSize: number
}

/**
 * Stage visualization settings
 */
export interface StageVisuals {
  /** Show 3D grid */
  showGrid: boolean
  
  /** Show beam cones */
  showBeams: boolean
  
  /** Show zone labels */
  showZoneLabels: boolean
  
  /** Show fixture names */
  showFixtureNames: boolean
  
  /** Background color (hex) */
  backgroundColor: string
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPES: SHOWFILE V2 (THE MAIN STRUCTURE)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * DMX Output configuration
 */
export interface DMXConfigV2 {
  /** Driver type */
  driver: 'enttec-usb-dmx-pro' | 'artnet' | 'virtual'
  
  /** COM port or IP address */
  port: string
  
  /** Active universes */
  universes: number[]
  
  /** Output frame rate */
  frameRate: number
}

/**
 * Audio input configuration
 */
export interface AudioConfigV2 {
  /** Audio source */
  source: 'microphone' | 'system' | 'line-in' | 'simulation'
  
  /** Device ID */
  deviceId?: string
  
  /** Device name for display */
  deviceName?: string
  
  /** Sensitivity (0-1) */
  sensitivity: number
  
  /** Input gain multiplier */
  inputGain: number
}

/**
 * 📄 SHOWFILE V2 - THE COMPLETE SHOW DEFINITION
 * 
 * This is the master file format that persists everything.
 * Saved to: %APPDATA%/LuxSync/shows/{name}.luxshow
 */
export interface ShowFileV2 {
  // ═══════════════════════════════════════════════════════════════════════
  // METADATA
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Schema version for migration */
  schemaVersion: '2.0.0'
  
  /** Show name */
  name: string
  
  /** Show description */
  description: string
  
  /** Creation timestamp */
  createdAt: string
  
  /** Last save timestamp */
  modifiedAt: string
  
  /** LuxSync version that created this file */
  createdWith: string
  
  // ═══════════════════════════════════════════════════════════════════════
  // STAGE
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Physical stage dimensions */
  stage: StageDimensions
  
  /** Visualization settings */
  visuals: StageVisuals
  
  // ═══════════════════════════════════════════════════════════════════════
  // FIXTURES
  // ═══════════════════════════════════════════════════════════════════════
  
  /** All fixtures in the show */
  fixtures: FixtureV2[]
  
  /** Fixture groups */
  groups: FixtureGroup[]
  
  // ═══════════════════════════════════════════════════════════════════════
  // SCENES
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Saved scenes/snapshots */
  scenes: SceneV2[]
  
  // ═══════════════════════════════════════════════════════════════════════
  // HARDWARE
  // ═══════════════════════════════════════════════════════════════════════
  
  /** DMX output configuration */
  dmx: DMXConfigV2
  
  /** Audio input configuration */
  audio: AudioConfigV2
  
  // ═══════════════════════════════════════════════════════════════════════
  // SELENE / AI
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Default vibe */
  defaultVibe: string
  
  /** Selene operating mode */
  seleneMode: 'idle' | 'reactive' | 'autonomous' | 'choreography'
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a new empty ShowFile with sensible defaults
 */
export function createEmptyShowFile(name: string = 'New Show'): ShowFileV2 {
  const now = new Date().toISOString()
  
  return {
    schemaVersion: '2.0.0',
    name,
    description: '',
    createdAt: now,
    modifiedAt: now,
    createdWith: '1.0.0',
    
    stage: {
      width: 12,
      depth: 8,
      height: 5,
      gridSize: 0.5
    },
    
    visuals: {
      showGrid: true,
      showBeams: true,
      showZoneLabels: true,
      showFixtureNames: false,
      backgroundColor: '#0a0a12'
    },
    
    fixtures: [],
    groups: [],
    scenes: [],
    
    dmx: {
      driver: 'virtual',
      port: '',
      universes: [0],
      frameRate: 40
    },
    
    audio: {
      source: 'simulation',
      sensitivity: 0.7,
      inputGain: 1.0
    },
    
    defaultVibe: 'techno-club',
    seleneMode: 'idle'
  }
}

/**
 * Create a new fixture with default values
 */
export function createDefaultFixture(
  id: string,
  address: number,
  options: Partial<FixtureV2> = {}
): FixtureV2 {
  return {
    id,
    name: options.name || `Fixture ${address}`,
    model: options.model || 'Generic',
    manufacturer: options.manufacturer || 'Unknown',
    type: options.type || 'generic',
    address,
    universe: options.universe || 0,
    channelCount: options.channelCount || 1,
    profileId: options.profileId || 'generic-dimmer',
    position: options.position || { x: 0, y: 3, z: 0 },
    rotation: options.rotation || { pitch: -45, yaw: 0, roll: 0 },
    physics: options.physics || { ...DEFAULT_PHYSICS_PROFILES['unknown'] },
    zone: options.zone || 'unassigned',
    enabled: true,
    ...options
  }
}

/**
 * Create a new fixture group
 */
export function createFixtureGroup(
  id: string,
  name: string,
  fixtureIds: string[] = []
): FixtureGroup {
  return {
    id,
    name,
    fixtureIds,
    color: '#00f3ff',
    isSystem: false,
    order: 0
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Validate a ShowFile structure
 */
export function validateShowFile(data: unknown): data is ShowFileV2 {
  if (!data || typeof data !== 'object') return false
  
  const show = data as Partial<ShowFileV2>
  
  // Required fields
  if (show.schemaVersion !== '2.0.0') return false
  if (typeof show.name !== 'string') return false
  if (!Array.isArray(show.fixtures)) return false
  if (!Array.isArray(show.groups)) return false
  if (!Array.isArray(show.scenes)) return false
  
  return true
}

/**
 * Get schema version from file (for migration)
 */
export function getSchemaVersion(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  
  const obj = data as Record<string, unknown>
  
  // V2 format
  if (obj.schemaVersion === '2.0.0') return '2.0.0'
  
  // V1 format (old ConfigManager)
  if (obj.version && typeof obj.patchedFixtures !== 'undefined') return '1.0.0'
  
  return null
}
