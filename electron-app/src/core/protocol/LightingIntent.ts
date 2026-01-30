/**
 * 🏛️ WAVE 201: LIGHTING INTENT
 * 
 * Define la salida del MOTOR (SeleneLux2).
 * El Motor recibe MusicalContext y produce SOLO este tipo.
 * 
 * REGLA: El Motor NO conoce fixtures específicos ni DMX.
 *        Solo describe QUÉ QUEREMOS EXPRESAR en términos abstractos.
 * 
 * @layer MOTOR → HAL
 * @version TITAN 2.0
 */

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS DE COLOR
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Color en formato HSL (normalizado 0-1)
 */
export interface HSLColor {
  /** Hue (0-1, donde 0=rojo, 0.33=verde, 0.66=azul) */
  h: number
  /** Saturation (0-1) */
  s: number
  /** Lightness (0-1) */
  l: number
  /** Pre-computed HEX string (for UI rendering) */
  hex?: string
}

/**
 * Paleta de 4 colores para iluminación
 */
export interface ColorPalette {
  /** Color principal - el protagonista */
  primary: HSLColor
  /** Color secundario - complemento/contraste */
  secondary: HSLColor
  /** Color de acento - para highlights y momentos especiales */
  accent: HSLColor
  /** Color ambiente - fondos y rellenos */
  ambient: HSLColor
  /** Strategy used to generate this palette (for debug/display) */
  strategy?: string
}

/**
 * Rol de color en la paleta
 */
export type PaletteRole = keyof ColorPalette

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS DE ZONA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Zonas abstractas del escenario
 * El HAL mapeará estas zonas a fixtures reales
 * 
 * 🌊 WAVE 1035: Añadidas zonas stereo (frontL/R, backL/R)
 */
export type AbstractZone = 
  | 'front'           // Frente del escenario (hacia el público) - LEGACY MONO
  | 'back'            // Fondo del escenario - LEGACY MONO
  | 'left'            // Lado izquierdo (movers)
  | 'right'           // Lado derecho (movers)
  | 'center'          // Centro
  | 'floor'           // Nivel del suelo
  | 'elevated'        // Elevado/truss
  | 'ambient'         // Ambiente general
  // 🌊 WAVE 1035: 7-Zone Stereo Architecture
  | 'frontL'          // Front Left Pars
  | 'frontR'          // Front Right Pars
  | 'backL'           // Back Left Pars
  | 'backR'           // Back Right Pars

/**
 * Intención para una zona específica
 */
export interface ZoneIntent {
  /** Intensidad de esta zona (0-1) */
  intensity: number
  /** Qué color de la paleta usar */
  paletteRole: PaletteRole
  /** Override de color específico (opcional) */
  colorOverride?: HSLColor
}

/**
 * Mapa de intenciones por zona
 */
export type ZoneIntentMap = Partial<Record<AbstractZone, ZoneIntent>>

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS DE MOVIMIENTO
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Patrones de movimiento abstractos
 * WAVE 340.1: Añadido 'mirror' para efecto puertas techno
 */
export type MovementPattern = 
  | 'static'          // Sin movimiento (con micro-respiración)
  | 'sweep'           // Barrido horizontal
  | 'circle'          // Movimiento circular
  | 'figure8'         // Figura de 8 (Lissajous)
  | 'random'          // Movimiento aleatorio suave
  | 'chase'           // Persecución secuencial
  | 'pulse'           // Pulsación rítmica
  | 'wave'            // Onda (serpiente de luz)
  | 'focus'           // Enfoque en un punto
  | 'mirror'          // WAVE 340.1: Espejo (pares/impares invertidos)

/**
 * Intención de movimiento abstracta
 */
export interface MovementIntent {
  /** Patrón de movimiento deseado */
  pattern: MovementPattern
  /** Velocidad del movimiento (0-1) */
  speed: number
  /** Amplitud del movimiento (0-1) */
  amplitude: number
  /** Centro X normalizado (0-1, donde 0.5 = centro) */
  centerX: number
  /** Centro Y normalizado (0-1, donde 0.5 = centro) */
  centerY: number
  /** Sincronizar con el beat */
  beatSync: boolean
  /** 🔧 WAVE 350: Tipo de desfase (linear = sin rotación polar, polar = con rotación) */
  phaseType?: 'linear' | 'polar'
  // ═══════════════════════════════════════════════════════════════════════════
  // 🔧 WAVE 1046: THE MECHANICS BYPASS
  // Si la física (THE DEEP FIELD) envía coordenadas L/R explícitas,
  // MasterArbiter las usa para routing estéreo de movers
  // ═══════════════════════════════════════════════════════════════════════════
  /** Coordenadas explícitas del mover izquierdo (0-1) */
  mechanicsL?: { pan: number; tilt: number }
  /** Coordenadas explícitas del mover derecho (0-1) */
  mechanicsR?: { pan: number; tilt: number }
}

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS DE EFECTOS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Tipos de efectos especiales
 */
export type EffectType = 
  | 'strobe'          // Estroboscopio
  | 'chase'           // Persecución
  | 'rainbow'         // Arcoíris
  | 'pulse'           // Pulso
  | 'blackout'        // Apagón
  | 'flash'           // Flash único
  | 'fade'            // Fundido

/**
 * Intención de efecto
 */
export interface EffectIntent {
  /** Tipo de efecto */
  type: EffectType
  /** Intensidad del efecto (0-1) */
  intensity: number
  /** Velocidad del efecto (0-1) */
  speed: number
  /** Duración en ms (0 = indefinido) */
  duration: number
  /** Zonas afectadas (vacío = todas) */
  zones: AbstractZone[]
}

// ═══════════════════════════════════════════════════════════════════════════
// INTERFAZ PRINCIPAL: LIGHTING INTENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Fuente del intent
 */
export type IntentSource = 'procedural' | 'manual' | 'effect' | 'override'

/**
 * ⚡ LIGHTING INTENT
 * 
 * La salida principal del MOTOR. Describe completamente
 * lo que queremos expresar sin conocer el hardware específico.
 * 
 * @example
 * ```typescript
 * const intent: LightingIntent = {
 *   palette: {
 *     primary: { h: 0.08, s: 1, l: 0.5 },    // Oro
 *     secondary: { h: 0.95, s: 0.9, l: 0.5 }, // Magenta
 *     accent: { h: 0.55, s: 1, l: 0.6 },      // Cyan
 *     ambient: { h: 0.08, s: 0.3, l: 0.2 },   // Oro oscuro
 *   },
 *   masterIntensity: 0.85,
 *   zones: {
 *     front: { intensity: 1.0, paletteRole: 'primary' },
 *     back: { intensity: 0.6, paletteRole: 'ambient' },
 *   },
 *   movement: {
 *     pattern: 'sweep',
 *     speed: 0.5,
 *     amplitude: 0.7,
 *     centerX: 0.5,
 *     centerY: 0.5,
 *     beatSync: true,
 *   },
 *   effects: [],
 *   source: 'procedural',
 *   timestamp: Date.now()
 * }
 * ```
 */
export interface LightingIntent {
  // ═══════════════════════════════════════════════════════════════════════
  // COLOR
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Paleta de colores activa */
  palette: ColorPalette

  // ═══════════════════════════════════════════════════════════════════════
  // INTENSITY
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Intensidad maestra global (0-1) */
  masterIntensity: number

  // ═══════════════════════════════════════════════════════════════════════
  // ZONES
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Intenciones por zona */
  zones: ZoneIntentMap

  // ═══════════════════════════════════════════════════════════════════════
  // MOVEMENT
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Intención de movimiento para movers */
  movement: MovementIntent

  // ═══════════════════════════════════════════════════════════════════════
  // OPTICS (WAVE 410)
  // ═══════════════════════════════════════════════════════════════════════
  
  /** 🔦 WAVE 410: Configuración óptica (Zoom/Focus) basada en Vibe */
  optics?: {
    zoom: number       // 0-255 (0=Beam tight, 255=Wash wide)
    focus: number      // 0-255 (0=Sharp, 255=Soft)
    iris?: number      // 0-255 (si el fixture tiene iris)
  }

  // ═══════════════════════════════════════════════════════════════════════
  // EFFECTS
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Efectos activos */
  effects: EffectIntent[]

  // ═══════════════════════════════════════════════════════════════════════
  // META
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Fuente de este intent */
  source: IntentSource
  
  /** Timestamp de cuando se generó */
  timestamp: number
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY / HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Crea un LightingIntent por defecto (blackout)
 */
export function createDefaultLightingIntent(): LightingIntent {
  return {
    palette: {
      primary: { h: 0, s: 0, l: 0 },
      secondary: { h: 0, s: 0, l: 0 },
      accent: { h: 0, s: 0, l: 0 },
      ambient: { h: 0, s: 0, l: 0 },
    },
    masterIntensity: 0,
    zones: {},
    movement: {
      pattern: 'static',
      speed: 0,
      amplitude: 0,
      centerX: 0.5,
      centerY: 0.5,
      beatSync: false,
    },
    effects: [],
    source: 'procedural',
    timestamp: Date.now(),
  }
}

/**
 * Convierte HSL a RGB (0-255)
 */
export function hslToRgb(hsl: HSLColor): { r: number; g: number; b: number } {
  const { h, s, l } = hsl
  let r: number, g: number, b: number

  if (s === 0) {
    r = g = b = l
  } else {
    const hue2rgb = (p: number, q: number, t: number): number => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1/6) return p + (q - p) * 6 * t
      if (t < 1/2) return q
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
      return p
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1/3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1/3)
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  }
}

/**
 * Convierte HSL a HEX string (#RRGGBB)
 */
export function hslToHex(hsl: HSLColor): string {
  const { r, g, b } = hslToRgb(hsl)
  const toHex = (n: number) => n.toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/**
 * Añade el campo .hex a un HSLColor
 */
export function withHex(hsl: HSLColor): HSLColor {
  return {
    ...hsl,
    hex: hslToHex(hsl)
  }
}
