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
 * 🔥 WAVE 2040.24 FASE 1: CANONICAL ZONE — LA VERDAD ÚNICA
 * 
 * 9 valores semánticos, kebab-case, sin gritos, sin ambigüedad.
 * Toda zona legacy se normaliza a uno de estos 9 valores.
 * 
 * Mapping semántico:
 *   front       → PARs frontales (audience-facing wash)
 *   back        → PARs traseros (counter/backlight)
 *   floor       → PARs de suelo (uplight)
 *   movers-left → Cabezas móviles lado izquierdo
 *   movers-right→ Cabezas móviles lado derecho
 *   center      → Strobes/Blinders centrales
 *   air         → Lásers/Aerials/Atmósfera
 *   ambient     → House lights/ambiente
 *   unassigned  → Sin asignar
 */
export type CanonicalZone =
  | 'front'
  | 'back'
  | 'floor'
  | 'movers-left'
  | 'movers-right'
  | 'center'
  | 'air'
  | 'ambient'
  | 'unassigned'

/**
 * FixtureZone = CanonicalZone + legacy strings para backwards compatibility.
 * TODO WAVE 2040.24 FASE 4: Eliminar legacy strings cuando toda la migración esté completa.
 */
export type FixtureZone = CanonicalZone
  // 🪦 LEGACY V2 (SCREAMING_CASE) — deprecated, normalizar con normalizeZone()
  | 'FRONT_PARS'
  | 'BACK_PARS'
  | 'FLOOR_PARS'
  | 'MOVING_LEFT'
  | 'MOVING_RIGHT'
  | 'AIR'
  | 'AMBIENT'
  | 'CENTER'
  | 'STROBES'
  | 'LASERS'
  | 'UNASSIGNED'
  // 🪦 LEGACY V1 (kebab-case viejo) — deprecated
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

// ═══════════════════════════════════════════════════════════════════════════
// CANONICAL ZONE UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🔥 WAVE 2040.24: Array canónico de las 9 zonas válidas.
 * Usado para validación, UI dropdowns y iteración.
 */
export const CANONICAL_ZONES: readonly CanonicalZone[] = [
  'front',
  'back',
  'floor',
  'movers-left',
  'movers-right',
  'center',
  'air',
  'ambient',
  'unassigned',
] as const

/**
 * 🔥 WAVE 2040.24: Labels para UI — cada zona canónica con su emoji y nombre.
 */
export const ZONE_LABELS: Record<CanonicalZone, string> = {
  'front':        '🔴 FRONT (Main)',
  'back':         '🔵 BACK (Counter)',
  'floor':        '⬇️ FLOOR (Uplight)',
  'movers-left':  '🏎️ MOVER LEFT',
  'movers-right': '🏎️ MOVER RIGHT',
  'center':       '⚡ CENTER (Strobes/Blinders)',
  'air':          '✨ AIR (Laser/Atmosphere)',
  'ambient':      '🌫️ AMBIENT (House)',
  'unassigned':   '❓ UNASSIGNED',
}

/**
 * 🔥 WAVE 2040.24 FASE 1: NORMALIZER — El traductor universal de zonas.
 * 
 * Acepta CUALQUIER string legacy y lo convierte a CanonicalZone.
 * Determinista, sin side effects, sin excepciones.
 * Si no reconoce el input → 'unassigned' (nunca crashea).
 * 
 * @param zone — Cualquier string de zona (legacy V1, SCREAMING V2, canonical, basura...)
 * @returns CanonicalZone — Siempre uno de los 9 valores válidos
 */
export function normalizeZone(zone: string | undefined | null): CanonicalZone {
  if (!zone) return 'unassigned'

  const raw = zone.trim().toLowerCase()

  // ── Ya es canónica ────────────────────────────────────────────────────
  if (CANONICAL_ZONES.includes(raw as CanonicalZone)) {
    return raw as CanonicalZone
  }

  // ── Mapa exhaustivo: legacy → canonical ───────────────────────────────
  const MAP: Record<string, CanonicalZone> = {
    // SCREAMING_CASE V2
    'front_pars':    'front',
    'back_pars':     'back',
    'floor_pars':    'floor',
    'moving_left':   'movers-left',
    'moving_right':  'movers-right',
    'strobes':       'center',
    'lasers':        'air',

    // kebab-case legacy V1
    'stage-left':    'movers-left',
    'stage-right':   'movers-right',
    'stage-center':  'center',
    'ceiling-front': 'front',
    'ceiling-back':  'back',
    'ceiling-left':  'movers-left',
    'ceiling-right': 'movers-right',
    'ceiling-center':'center',
    'floor-front':   'front',
    'floor-back':    'back',
    'truss-1':       'back',
    'truss-2':       'back',
    'truss-3':       'back',
    'custom':        'unassigned',

    // Aliases cortos (por si llegan del migrador viejo)
    'left':          'movers-left',
    'right':         'movers-right',
    'front':         'front',
    'back':          'back',
    'floor':         'floor',
    'center':        'center',
    'ceiling':       'center',
    'truss':         'back',
    'air':           'air',
    'ambient':       'ambient',
    'unassigned':    'unassigned',
  }

  return MAP[raw] ?? 'unassigned'
}

/**
 * 🔥 WAVE 2040.24: Comprueba si un string es una CanonicalZone válida.
 */
export function isCanonicalZone(zone: string | undefined | null): zone is CanonicalZone {
  if (!zone) return false
  return CANONICAL_ZONES.includes(zone as CanonicalZone)
}

// ═══════════════════════════════════════════════════════════════════════════
// FIXTURE SELECTOR - WAVE 2040.25 FASE 3
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🎯 WAVE 2040.25 FASE 3: FixtureSelector — Filtros dinámicos tipo grandMA3
 * 
 * Permite targeting avanzado: zona + parity (even/odd) + index range + stereo (L/R).
 * El selector se resuelve en runtime a una lista concreta de fixture IDs.
 * 
 * EJEMPLOS:
 * - { target: 'front', parity: 'even' } → Front PARs pares
 * - { target: 'movers-left', indexRange: '1-3' } → Primeros 3 movers izquierdos
 * - { target: 'all', parity: 'odd', stereoSide: 'left' } → Todos los impares del lado izquierdo
 * 
 * FLUJO:
 * 1. Resolver target (zona o grupo) → lista base de fixtures
 * 2. Filtrar por parity (even/odd) → índices dentro del grupo
 * 3. Filtrar por indexRange ('1-3' o '1,3,5') → posiciones específicas
 * 4. Filtrar por stereoSide (L/R) → position.x < 0 o >= 0
 * 5. Resultado final → IDs concretos para el efecto
 */
export interface FixtureSelector {
  /** 
   * Target: zona canónica, grupo ID, o 'all'
   * Si es una CanonicalZone: resuelve fixtures con esa zona
   * Si es un group ID: resuelve fixtures del grupo
   * Si es 'all': todas las fixtures del show
   */
  target: CanonicalZone | string
  
  /** 
   * Parity filter (aplicado DESPUÉS de resolver target)
   * - 'all': Todos (default)
   * - 'even': Solo fixtures con índice par (0, 2, 4, ...) dentro del grupo
   * - 'odd': Solo fixtures con índice impar (1, 3, 5, ...) dentro del grupo
   */
  parity?: 'all' | 'even' | 'odd'
  
  /** 
   * Index range filter: "1-3" o "1,3,5" (1-based, dentro del grupo resuelto)
   * Ejemplos:
   * - "1-3": Primeros 3 fixtures del grupo
   * - "1,3,5": Fixtures en posiciones 1, 3 y 5
   * - "2-": Desde la posición 2 hasta el final
   */
  indexRange?: string
  
  /**
   * Stereo side filter (basado en position.x de StageBuilder)
   * - 'left': Solo fixtures con position.x < 0
   * - 'right': Solo fixtures con position.x >= 0
   * - undefined: Ambos lados
   */
  stereoSide?: 'left' | 'right'
  
  /** 
   * Phase spread: offset de fase por fixture (para wave/chase effects)
   * 0 = todos en fase, 1 = spread completo (180° entre primero y último)
   */
  phaseSpread?: number  // 0-1
}

/**
 * 🎯 WAVE 2040.25 FASE 3: Resolver FixtureSelector → lista de IDs
 * 
 * Esta función es el CORAZÓN del targeting avanzado.
 * Convierte un selector abstracto en una lista concreta de fixture IDs.
 * 
 * @param selector — El selector a resolver
 * @param fixtures — Array de todas las fixtures del show (desde stageStore)
 * @param groups — Array de grupos del show (para resolver group IDs)
 * @returns Array de fixture IDs que matchean el selector
 */
export function resolveFixtureSelector(
  selector: FixtureSelector,
  fixtures: FixtureV2[],
  groups?: FixtureGroup[]
): string[] {
  // 1️⃣ Resolver target → lista base
  let baseFixtures: FixtureV2[] = []
  
  if (selector.target === 'all') {
    baseFixtures = fixtures
  } else if (isCanonicalZone(selector.target)) {
    // Es una zona canónica
    baseFixtures = fixtures.filter(f => f.zone === selector.target)
  } else {
    // Intentar resolver como group ID
    const group = groups?.find(g => g.id === selector.target)
    if (group) {
      baseFixtures = fixtures.filter(f => group.fixtureIds.includes(f.id))
    } else {
      // Grupo no encontrado, retornar vacío
      console.warn(`[resolveFixtureSelector] Unknown target: ${selector.target}`)
      return []
    }
  }
  
  // 2️⃣ Filtrar por stereoSide (si está definido)
  if (selector.stereoSide) {
    if (selector.stereoSide === 'left') {
      baseFixtures = baseFixtures.filter(f => f.position.x < 0)
    } else {
      baseFixtures = baseFixtures.filter(f => f.position.x >= 0)
    }
  }
  
  // 3️⃣ Filtrar por parity (even/odd)
  if (selector.parity && selector.parity !== 'all') {
    baseFixtures = baseFixtures.filter((_, idx) => {
      if (selector.parity === 'even') return idx % 2 === 0
      if (selector.parity === 'odd') return idx % 2 !== 0
      return true
    })
  }
  
  // 4️⃣ Filtrar por indexRange (si está definido)
  if (selector.indexRange) {
    const indices = parseIndexRange(selector.indexRange, baseFixtures.length)
    baseFixtures = baseFixtures.filter((_, idx) => indices.includes(idx))
  }
  
  // 5️⃣ Retornar IDs finales
  return baseFixtures.map(f => f.id)
}

/**
 * Parse index range string: "1-3" | "1,3,5" | "2-"
 * Returns 0-based indices array
 */
function parseIndexRange(range: string, maxLength: number): number[] {
  const result: number[] = []
  
  // Case: "1-3" → [0, 1, 2] (1-based input → 0-based output)
  if (range.includes('-')) {
    const [start, end] = range.split('-').map(s => s.trim())
    const startIdx = start ? parseInt(start, 10) - 1 : 0
    const endIdx = end ? parseInt(end, 10) - 1 : maxLength - 1
    
    for (let i = Math.max(0, startIdx); i <= Math.min(maxLength - 1, endIdx); i++) {
      result.push(i)
    }
  }
  // Case: "1,3,5" → [0, 2, 4]
  else if (range.includes(',')) {
    const indices = range.split(',').map(s => parseInt(s.trim(), 10) - 1)
    result.push(...indices.filter(i => i >= 0 && i < maxLength))
  }
  // Case: "3" → [2]
  else {
    const idx = parseInt(range, 10) - 1
    if (idx >= 0 && idx < maxLength) {
      result.push(idx)
    }
  }
  
  return result
}

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
   * 🔥 WAVE 1008.7: Added defaultValue for proper channel initialization
   */
  channels?: Array<{
    index: number
    name: string
    type: string
    is16bit: boolean
    defaultValue?: number  // 🔥 WAVE 1008.7: Preserve channel defaults (Shutter=255, Speed=0, etc)
  }>
  
  /**
   * Fixture capabilities flags (persisted inline)
   * Used by MasterArbiter for intelligent color/movement routing
   * 🔥 WAVE 1042.1: Extended to include colorEngine and colorWheel for Forge parity
   */
  capabilities?: {
    hasMovementChannels?: boolean
    has16bitMovement?: boolean
    hasColorMixing?: boolean
    hasColorWheel?: boolean
    // 🔥 WAVE 1042.1: Color system data (for Forge editing from stage)
    colorEngine?: 'rgb' | 'cmy' | 'wheel' | 'hybrid' | 'none'
    colorWheel?: {
      colors: Array<{
        dmx: number
        name: string
        rgb: { r: number; g: number; b: number }
        hasTexture?: boolean
      }>
    }
  }
  
  /**
   * 🔧 WAVE 1135.2: Calibration offsets (persisted per-show)
   * Used by CalibrationLab to compensate for physical mounting differences
   */
  calibration?: {
    /** Pan offset in degrees (-180 to +180) */
    panOffset: number
    /** Tilt offset in degrees (-90 to +90) */
    tiltOffset: number
    /** Invert pan direction */
    panInvert: boolean
    /** Invert tilt direction */
    tiltInvert: boolean
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
    'moving head': 'moving-head', // 🎯 WAVE 685.6: From Forge dropdown
    'moving': 'moving-head', // 🎯 WAVE 685.6: Saved as "moving" from Forge
    'par': 'par',
    'wash': 'wash',
    'strobe': 'strobe',
    'laser': 'laser',
    'blinder': 'blinder',
    'bar': 'generic', // Bar → generic for now
    'spot': 'generic',
    'scanner': 'generic',
    'other': 'generic',
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
