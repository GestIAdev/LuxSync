/**
 * ☀️ HYPERION — Zone Layout Engine
 * 
 * SINGLE SOURCE OF TRUTH para posicionamiento de fixtures por zona.
 * Usa CanonicalZone de ShowFileV2.ts — los 9 valores canónicos.
 * Alimenta tanto TacticalCanvas (2D) como VisualizerCanvas (3D).
 * 
 * @module components/simulator/shared/ZoneLayoutEngine
 * @since WAVE 2042.1 (Project Hyperion — Phase 0)
 */

import { 
  normalizeZone, 
  type CanonicalZone, 
  CANONICAL_ZONES,
  ZONE_LABELS 
} from '../../../core/stage/ShowFileV2'

// ═══════════════════════════════════════════════════════════════════════════
// RE-EXPORTS — Para que otros módulos no tengan que importar de ShowFileV2
// ═══════════════════════════════════════════════════════════════════════════

export { normalizeZone, CANONICAL_ZONES, ZONE_LABELS }
export type { CanonicalZone }

// ═══════════════════════════════════════════════════════════════════════════
// ZONE COLORS — Hyperion Neon Palette for each canonical zone
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Colores neon para cada zona canónica.
 * Usados en GroupsPanel, TacticalCanvas zone labels, etc.
 */
export const ZONE_COLORS: Record<CanonicalZone, string> = {
  'front':         '#FF6B35',   // Naranja cálido (wash audience)
  'back':          '#A855F7',   // Púrpura (counterlight drama)
  'floor':         '#22D3EE',   // Cyan floor (uplight frío)
  'movers-left':   '#3B82F6',   // Azul eléctrico
  'movers-right':  '#F43F5E',   // Rosa eléctrico
  'center':        '#FACC15',   // Amarillo blinder
  'air':           '#10B981',   // Verde laser
  'ambient':       '#94A3B8',   // Gris plateado (house)
  'unassigned':    '#475569',   // Gris oscuro
}

// ═══════════════════════════════════════════════════════════════════════════
// 2D LAYOUT — Posiciones relativas al canvas (0-1 normalized)
// ═══════════════════════════════════════════════════════════════════════════

export interface ZoneLayout2D {
  /** Posición Y relativa (0 = top, 1 = bottom) */
  y: number
  /** Rango X para distribución horizontal [min, max] (0-1) */
  xRange: [number, number]
  /** ¿Es una columna vertical? (movers laterales) */
  vertical?: boolean
  /** Posición X fija (para zonas laterales) */
  fixedX?: number
  /** Label para display */
  label: string
  /** Stereo split config — divide la zona en L/R para distribución estéreo */
  stereo?: {
    leftRange: [number, number]
    rightRange: [number, number]
  }
}

/**
 * Layout 2D para cada zona canónica.
 * Coordenadas normalizadas 0-1 relativas al viewport del canvas.
 * Stereo split automático para front/back/floor.
 */
export const ZONE_LAYOUT_2D: Record<CanonicalZone, ZoneLayout2D> = {
  'front': {
    y: 0.85,
    xRange: [0.08, 0.92],
    label: 'FRONT',
    stereo: {
      leftRange: [0.08, 0.42],
      rightRange: [0.58, 0.92],
    },
  },
  'back': {
    y: 0.55,
    xRange: [0.12, 0.88],
    label: 'BACK',
    stereo: {
      leftRange: [0.12, 0.42],
      rightRange: [0.58, 0.88],
    },
  },
  'floor': {
    y: 0.92,
    xRange: [0.15, 0.85],
    label: 'FLOOR',
    stereo: {
      leftRange: [0.15, 0.42],
      rightRange: [0.58, 0.85],
    },
  },
  'movers-left': {
    y: 0.28,
    xRange: [0.12, 0.12],
    label: 'MOVER Ⓛ',
    vertical: true,
    fixedX: 0.12,
  },
  'movers-right': {
    y: 0.28,
    xRange: [0.88, 0.88],
    label: 'MOVER Ⓡ',
    vertical: true,
    fixedX: 0.88,
  },
  'center': {
    y: 0.40,
    xRange: [0.35, 0.65],
    label: 'CENTER',
  },
  'air': {
    y: 0.18,
    xRange: [0.30, 0.70],
    label: 'AIR',
  },
  'ambient': {
    y: 0.08,
    xRange: [0.05, 0.95],
    label: 'AMBIENT',
  },
  'unassigned': {
    y: 0.70,
    xRange: [0.25, 0.75],
    label: 'UNASSIGNED',
  },
}

// ═══════════════════════════════════════════════════════════════════════════
// 3D LAYOUT — Posiciones en metros (espacio real del escenario)
// ═══════════════════════════════════════════════════════════════════════════

export interface ZoneLayout3D {
  /** Altura Y (factor de height: 0=suelo, 1=truss máximo) */
  heightFactor: number
  /** Profundidad Z (factor: -1=fondo del escenario, 1=frente/audience) */
  depthFactor: number
  /** Rango X para distribución (factor de halfWidth: -1=izquierda, 1=derecha) */
  xRange: [number, number]
  /** Pitch por defecto en grados (negativo = apunta abajo) */
  defaultPitch: number
  /** ¿Distribuir verticalmente? (para movers en columnas laterales) */
  vertical?: boolean
  /** Posición X fija (factor de halfWidth, para zonas laterales) */
  fixedX?: number
}

/**
 * Layout 3D para cada zona canónica.
 * Factores relativos que se multiplican por las dimensiones del StageConfig.
 */
export const ZONE_LAYOUT_3D: Record<CanonicalZone, ZoneLayout3D> = {
  'front': {
    heightFactor: 0.30,
    depthFactor: 0.80,
    xRange: [-0.70, 0.70],
    defaultPitch: -30,
  },
  'back': {
    heightFactor: 0.85,
    depthFactor: -0.60,
    xRange: [-0.60, 0.60],
    defaultPitch: -45,
  },
  'floor': {
    heightFactor: 0.05,
    depthFactor: 0.60,
    xRange: [-0.65, 0.65],
    defaultPitch: 80,     // Apunta hacia arriba (uplight)
  },
  'movers-left': {
    heightFactor: 0.70,
    depthFactor: 0.00,
    xRange: [-0.85, -0.85],
    defaultPitch: -20,
    vertical: true,
    fixedX: -0.85,
  },
  'movers-right': {
    heightFactor: 0.70,
    depthFactor: 0.00,
    xRange: [0.85, 0.85],
    defaultPitch: -20,
    vertical: true,
    fixedX: 0.85,
  },
  'center': {
    heightFactor: 0.90,
    depthFactor: -0.30,
    xRange: [-0.30, 0.30],
    defaultPitch: -60,
  },
  'air': {
    heightFactor: 0.60,
    depthFactor: -0.50,
    xRange: [-0.20, 0.20],
    defaultPitch: 0,      // Horizontal (lásers, aerials)
  },
  'ambient': {
    heightFactor: 0.95,
    depthFactor: 0.50,
    xRange: [-0.90, 0.90],
    defaultPitch: -90,    // Directamente hacia abajo
  },
  'unassigned': {
    heightFactor: 0.50,
    depthFactor: 0.00,
    xRange: [-0.50, 0.50],
    defaultPitch: -30,
  },
}

// ═══════════════════════════════════════════════════════════════════════════
// STAGE CONFIG — Dimensiones físicas del escenario (metros)
// ═══════════════════════════════════════════════════════════════════════════

export interface StageConfig {
  /** Ancho total del escenario en metros */
  width: number
  /** Profundidad del escenario en metros */
  depth: number
  /** Altura máxima del truss en metros */
  height: number
}

/**
 * Configuración por defecto del escenario (tamaño mediano típico).
 * Se puede override por show cargado.
 */
export const DEFAULT_STAGE_CONFIG: StageConfig = {
  width: 12,   // 12 metros de ancho
  depth: 8,    // 8 metros de profundidad
  height: 5,   // 5 metros de altura máxima
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Resuelve la zona canónica de un fixture.
 * Acepta CUALQUIER input (legacy strings, undefined, null, basura).
 * Wrapper semántico para normalizeZone — naming más claro para uso en fixtures.
 * 
 * @param zone — Cualquier string de zona
 * @returns CanonicalZone — Siempre uno de los 9 valores válidos
 */
export function resolveFixtureZone(zone: string | undefined | null): CanonicalZone {
  return normalizeZone(zone)
}

/**
 * Distribuye N fixtures uniformemente en un rango numérico.
 * Usado para calcular posiciones X dentro de una zona.
 * 
 * @param index — Índice del fixture (0-based)
 * @param total — Número total de fixtures a distribuir
 * @param min — Valor mínimo del rango
 * @param max — Valor máximo del rango
 * @returns Posición calculada para este índice
 * 
 * @example
 * distributeInRange(0, 4, 0, 1)  // 0.0
 * distributeInRange(1, 4, 0, 1)  // 0.333
 * distributeInRange(2, 4, 0, 1)  // 0.666
 * distributeInRange(3, 4, 0, 1)  // 1.0
 */
export function distributeInRange(
  index: number, 
  total: number, 
  min: number, 
  max: number
): number {
  if (total <= 1) return (min + max) / 2
  return min + ((max - min) * index) / (total - 1)
}

/**
 * Agrupa fixtures por zona canónica.
 * Devuelve un Map con todos los fixtures agrupados.
 * Zonas vacías se incluyen como arrays vacíos.
 * 
 * @param fixtures — Array de objetos con propiedad `zone`
 * @returns Map<CanonicalZone, T[]>
 */
export function groupByCanonicalZone<T extends { zone?: string }>(
  fixtures: T[]
): Map<CanonicalZone, T[]> {
  // Inicializar con todas las zonas vacías
  const groups = new Map<CanonicalZone, T[]>()
  for (const zone of CANONICAL_ZONES) {
    groups.set(zone, [])
  }
  
  // Agrupar fixtures
  for (const fixture of fixtures) {
    const canonical = normalizeZone(fixture.zone)
    groups.get(canonical)!.push(fixture)
  }
  
  return groups
}

/**
 * Genera la posición 2D de un fixture basado en su zona y índice dentro de la zona.
 * Usado por TacticalCanvas para posicionar fixtures en el canvas.
 * 
 * @param zone — Zona canónica del fixture
 * @param index — Índice del fixture dentro de su zona
 * @param totalInZone — Total de fixtures en esta zona
 * @param canvasWidth — Ancho del canvas en píxeles
 * @param canvasHeight — Alto del canvas en píxeles
 * @returns Coordenadas {x, y} en píxeles
 */
export function calculatePosition2D(
  zone: CanonicalZone,
  index: number,
  totalInZone: number,
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number } {
  const layout = ZONE_LAYOUT_2D[zone]
  
  let x: number
  const y = layout.y * canvasHeight
  
  if (layout.fixedX !== undefined) {
    // Zona lateral (movers): X fijo, distribuir en Y
    x = layout.fixedX * canvasWidth
  } else if (layout.stereo) {
    // Zona con stereo split: alternar entre L/R
    const isLeft = index % 2 === 0
    const halfIndex = Math.floor(index / 2)
    const totalPerSide = Math.ceil(totalInZone / 2)
    const range = isLeft ? layout.stereo.leftRange : layout.stereo.rightRange
    x = distributeInRange(halfIndex, totalPerSide, range[0], range[1]) * canvasWidth
  } else {
    // Zona simple: distribuir horizontalmente
    const [minX, maxX] = layout.xRange
    x = distributeInRange(index, totalInZone, minX, maxX) * canvasWidth
  }
  
  return { x, y }
}

/**
 * Genera la posición 3D de un fixture basado en su zona y índice.
 * Usado por VisualizerCanvas para posicionar fixtures en el escenario 3D.
 * 
 * @param zone — Zona canónica del fixture
 * @param index — Índice del fixture dentro de su zona
 * @param totalInZone — Total de fixtures en esta zona
 * @param config — Configuración del escenario (dimensiones)
 * @returns Coordenadas {x, y, z} en metros
 */
export function calculatePosition3D(
  zone: CanonicalZone,
  index: number,
  totalInZone: number,
  config: StageConfig = DEFAULT_STAGE_CONFIG
): { x: number; y: number; z: number } {
  const layout = ZONE_LAYOUT_3D[zone]
  const halfWidth = config.width / 2
  const halfDepth = config.depth / 2
  
  // Calcular Y (altura) — siempre basado en heightFactor
  const y = layout.heightFactor * config.height
  
  // Calcular Z (profundidad)
  const z = layout.depthFactor * halfDepth
  
  // Calcular X (posición horizontal)
  let x: number
  if (layout.fixedX !== undefined) {
    // Zona lateral: X fijo
    x = layout.fixedX * halfWidth
  } else {
    // Distribuir horizontalmente en el rango
    const [minX, maxX] = layout.xRange
    x = distributeInRange(index, totalInZone, minX * halfWidth, maxX * halfWidth)
  }
  
  return { x, y, z }
}

/**
 * Obtiene el pitch (inclinación) por defecto para una zona.
 * Usado para orientación inicial de moving heads en 3D.
 * 
 * @param zone — Zona canónica
 * @returns Ángulo en grados (negativo = apunta abajo)
 */
export function getDefaultPitch(zone: CanonicalZone): number {
  return ZONE_LAYOUT_3D[zone].defaultPitch
}

/**
 * Comprueba si una zona usa distribución vertical (movers laterales).
 * 
 * @param zone — Zona canónica
 * @returns true si los fixtures se apilan verticalmente
 */
export function isVerticalZone(zone: CanonicalZone): boolean {
  return ZONE_LAYOUT_2D[zone].vertical === true
}

/**
 * Comprueba si una zona tiene stereo split (L/R distribution).
 * 
 * @param zone — Zona canónica
 * @returns true si la zona se divide en L/R
 */
export function hasStereoSplit(zone: CanonicalZone): boolean {
  return ZONE_LAYOUT_2D[zone].stereo !== undefined
}
