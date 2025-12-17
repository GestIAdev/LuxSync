/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📐 LAYOUT GENERATOR 3D - WAVE 30: Stage Command & Dashboard
 * Convierte zonas de fixtures a coordenadas 3D reales
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Este helper posiciona fixtures en un espacio 3D basándose en su propiedad
 * `zone`, similar al sistema 2D pero con profundidad real.
 * 
 * Coordinate System:
 * - X: Left (-) to Right (+)
 * - Y: Down (-) to Up (+)  [altura desde el suelo]
 * - Z: Back (-) to Front (+)  [profundidad del escenario]
 * 
 * @module utils/layoutGenerator3D
 * @version 30.0.0
 */

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface Position3D {
  x: number
  y: number
  z: number
}

export interface Fixture3DLayout {
  id: string
  position: Position3D
  rotation: { x: number; y: number; z: number }
  type: 'par' | 'moving' | 'strobe' | 'laser'
  zone: string
}

export interface StageConfig {
  /** Ancho del escenario en metros */
  width: number
  /** Profundidad del escenario en metros */
  depth: number
  /** Altura máxima (truss) en metros */
  height: number
  /** Espaciado entre fixtures de la misma zona */
  fixtureSpacing: number
}

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

export const DEFAULT_STAGE_CONFIG: StageConfig = {
  width: 12,      // 12 metros de ancho
  depth: 8,       // 8 metros de profundidad
  height: 5,      // 5 metros hasta el truss
  fixtureSpacing: 1.5,
}

// ═══════════════════════════════════════════════════════════════════════════
// ZONE LAYOUT DEFINITIONS
// Posiciones base para cada zona en el espacio 3D normalizado (-1 a 1)
// ═══════════════════════════════════════════════════════════════════════════

interface ZoneDefinition {
  /** Altura Y (0 = suelo, 1 = truss) */
  heightFactor: number
  /** Profundidad Z (-1 = fondo, 1 = frente) */
  depthFactor: number
  /** Rango X para distribución (min, max) como factor de ancho */
  xRange: [number, number]
  /** Ángulo de rotación por defecto (pitch hacia abajo) */
  defaultPitch: number
  /** ¿Distribuir en Y en lugar de X? (para columnas laterales) */
  distributeVertical?: boolean
  /** Posición X fija (para zonas laterales) */
  fixedX?: number
}

const ZONE_DEFINITIONS: Record<string, ZoneDefinition> = {
  // PARs frontales - fila baja al frente del escenario
  FRONT: {
    heightFactor: 0.3,    // 1.5m de altura (sobre truss bajo o suelo)
    depthFactor: 0.8,     // Muy al frente
    xRange: [-0.7, 0.7],  // Distribuidos en casi todo el ancho
    defaultPitch: -30,    // Apuntando hacia abajo al público
  },
  FRONT_PARS: {
    heightFactor: 0.3,
    depthFactor: 0.8,
    xRange: [-0.7, 0.7],
    defaultPitch: -30,
  },
  
  // PARs traseros - fila alta al fondo
  BACK: {
    heightFactor: 0.85,   // 4.25m de altura (truss principal)
    depthFactor: -0.6,    // Fondo del escenario
    xRange: [-0.6, 0.6],
    defaultPitch: -45,    // Apuntando más hacia abajo
  },
  BACK_PARS: {
    heightFactor: 0.85,
    depthFactor: -0.6,
    xRange: [-0.6, 0.6],
    defaultPitch: -45,
  },
  
  // Moving heads izquierda - columna lateral
  LEFT: {
    heightFactor: 0.7,    // Altura variable
    depthFactor: 0.0,     // Centro de profundidad
    xRange: [-0.9, -0.9], // Fijo a la izquierda
    defaultPitch: -20,
    distributeVertical: true,
    fixedX: -0.85,
  },
  MOVING_LEFT: {
    heightFactor: 0.7,
    depthFactor: 0.0,
    xRange: [-0.9, -0.9],
    defaultPitch: -20,
    distributeVertical: true,
    fixedX: -0.85,
  },
  
  // Moving heads derecha - columna lateral
  RIGHT: {
    heightFactor: 0.7,
    depthFactor: 0.0,
    xRange: [0.9, 0.9],
    defaultPitch: -20,
    distributeVertical: true,
    fixedX: 0.85,
  },
  MOVING_RIGHT: {
    heightFactor: 0.7,
    depthFactor: 0.0,
    xRange: [0.9, 0.9],
    defaultPitch: -20,
    distributeVertical: true,
    fixedX: 0.85,
  },
  
  // Strobes - centro superior
  CENTER: {
    heightFactor: 0.9,    // Casi en el truss
    depthFactor: -0.3,    // Ligeramente atrás
    xRange: [-0.3, 0.3],
    defaultPitch: -60,
  },
  STROBES: {
    heightFactor: 0.95,
    depthFactor: -0.2,
    xRange: [-0.4, 0.4],
    defaultPitch: -90,    // Apuntando directamente hacia abajo
  },
  
  // Láser - centro
  LASERS: {
    heightFactor: 0.6,
    depthFactor: -0.5,
    xRange: [-0.2, 0.2],
    defaultPitch: 0,      // Horizontal
  },
  
  // Default/Unassigned - dispersos
  DEFAULT: {
    heightFactor: 0.5,
    depthFactor: 0.0,
    xRange: [-0.5, 0.5],
    defaultPitch: -30,
  },
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Determina el tipo visual de fixture basándose en su nombre/tipo
 */
export function getFixtureType(name: string, type: string): 'par' | 'moving' | 'strobe' | 'laser' {
  const combined = `${name} ${type}`.toLowerCase()
  
  if (combined.includes('moving') || combined.includes('spot') || combined.includes('beam') || combined.includes('head') || combined.includes('vizi')) {
    return 'moving'
  } else if (combined.includes('strobe')) {
    return 'strobe'
  } else if (combined.includes('laser')) {
    return 'laser'
  }
  return 'par'
}

/**
 * Normaliza el nombre de zona para coincidir con las definiciones
 */
function normalizeZone(zone: string): string {
  if (!zone) return 'DEFAULT'
  
  const upper = zone.toUpperCase().trim()
  
  // Mapeos directos
  if (ZONE_DEFINITIONS[upper]) return upper
  
  // Mapeos parciales
  if (upper.includes('FRONT')) return 'FRONT'
  if (upper.includes('BACK')) return 'BACK'
  if (upper.includes('MOVING_LEFT') || (upper.includes('MOVING') && upper.includes('LEFT'))) return 'MOVING_LEFT'
  if (upper.includes('MOVING_RIGHT') || (upper.includes('MOVING') && upper.includes('RIGHT'))) return 'MOVING_RIGHT'
  if (upper.includes('LEFT')) return 'LEFT'
  if (upper.includes('RIGHT')) return 'RIGHT'
  if (upper.includes('STROBE')) return 'STROBES'
  if (upper.includes('LASER')) return 'LASERS'
  if (upper.includes('CENTER')) return 'CENTER'
  
  return 'DEFAULT'
}

/**
 * Distribuye fixtures equitativamente en un rango
 */
function distributeInRange(index: number, total: number, min: number, max: number): number {
  if (total <= 1) return (min + max) / 2
  return min + ((max - min) * index) / (total - 1)
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN GENERATOR FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

export interface FixtureInput {
  id: string
  name?: string
  type?: string
  zone?: string
  dmxAddress?: number
}

/**
 * Genera posiciones 3D para un array de fixtures basándose en sus zonas
 * 
 * @param fixtures - Array de fixtures con info de zona
 * @param config - Configuración del escenario (opcional)
 * @returns Array de fixtures con posiciones 3D calculadas
 */
export function generateLayout3D(
  fixtures: FixtureInput[],
  config: StageConfig = DEFAULT_STAGE_CONFIG
): Fixture3DLayout[] {
  if (!fixtures || fixtures.length === 0) return []
  
  const { width, depth, height } = config
  const halfWidth = width / 2
  const halfDepth = depth / 2
  
  // Agrupar fixtures por zona para calcular distribución
  const fixturesByZone: Record<string, FixtureInput[]> = {}
  
  fixtures.forEach(fixture => {
    const normalizedZone = normalizeZone(fixture.zone || '')
    if (!fixturesByZone[normalizedZone]) {
      fixturesByZone[normalizedZone] = []
    }
    fixturesByZone[normalizedZone].push(fixture)
  })
  
  // Generar layouts
  const layouts: Fixture3DLayout[] = []
  
  Object.entries(fixturesByZone).forEach(([zoneName, zoneFixtures]) => {
    const zoneDef = ZONE_DEFINITIONS[zoneName] || ZONE_DEFINITIONS.DEFAULT
    
    zoneFixtures.forEach((fixture, index) => {
      const fixtureType = getFixtureType(fixture.name || '', fixture.type || '')
      
      let x: number
      let y: number
      let z: number
      
      if (zoneDef.distributeVertical) {
        // Columnas laterales: X fijo, distribuir en Y
        x = (zoneDef.fixedX ?? zoneDef.xRange[0]) * halfWidth
        y = distributeInRange(index, zoneFixtures.length, 0.5, 0.9) * height
        z = zoneDef.depthFactor * halfDepth
      } else {
        // Filas horizontales: Y fijo, distribuir en X
        x = distributeInRange(index, zoneFixtures.length, zoneDef.xRange[0], zoneDef.xRange[1]) * halfWidth
        y = zoneDef.heightFactor * height
        z = zoneDef.depthFactor * halfDepth
      }
      
      layouts.push({
        id: fixture.id || `fixture-${fixture.dmxAddress}`,
        position: { x, y, z },
        rotation: {
          x: (zoneDef.defaultPitch * Math.PI) / 180, // Convertir a radianes
          y: 0,
          z: 0,
        },
        type: fixtureType,
        zone: zoneName,
      })
    })
  })
  
  return layouts
}

/**
 * Obtiene la posición 3D de un solo fixture (útil para lookups)
 */
export function getFixture3DPosition(
  fixture: FixtureInput,
  allFixtures: FixtureInput[],
  config: StageConfig = DEFAULT_STAGE_CONFIG
): Position3D | null {
  const layouts = generateLayout3D(allFixtures, config)
  const found = layouts.find(l => l.id === fixture.id)
  return found?.position ?? null
}

// ═══════════════════════════════════════════════════════════════════════════
// DEBUG UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Imprime un resumen de la distribución de fixtures (para debug)
 */
export function debugLayout3D(fixtures: FixtureInput[]): void {
  const layouts = generateLayout3D(fixtures)
  
  console.group('🎭 3D Layout Debug')
  console.log(`Total fixtures: ${layouts.length}`)
  
  const byZone = layouts.reduce((acc, l) => {
    if (!acc[l.zone]) acc[l.zone] = []
    acc[l.zone].push(l)
    return acc
  }, {} as Record<string, Fixture3DLayout[]>)
  
  Object.entries(byZone).forEach(([zone, items]) => {
    console.log(`\n📍 ${zone} (${items.length} fixtures):`)
    items.forEach(item => {
      console.log(`   ${item.id}: [${item.position.x.toFixed(2)}, ${item.position.y.toFixed(2)}, ${item.position.z.toFixed(2)}] (${item.type})`)
    })
  })
  
  console.groupEnd()
}
