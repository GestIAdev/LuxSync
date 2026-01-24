/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎨 WAVE 1000: FIXTURE PROFILES - EL DICCIONARIO
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Define las CAPACIDADES FÍSICAS de cada tipo de fixture.
 * Esto NO son los canales DMX (eso lo hace FXTParser), sino las
 * capacidades reales del hardware: tipo de mezcla de color, velocidades
 * seguras, rueda de colores física, etc.
 * 
 * FILOSOFÍA:
 * - LED RGB → "Habla todos los idiomas" (cualquier color, instantáneo)
 * - Beam 2R → "Solo habla su dialecto" (colores fijos, lento)
 * - El HAL es el intérprete universal
 * 
 * @module hal/translation/FixtureProfiles
 * @version WAVE 1000
 */

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Tipo de mezcla de color que soporta el fixture
 */
export type ColorMixingType = 
  | 'rgb'       // LED RGB directo - cualquier color instantáneo
  | 'rgbw'      // LED RGBW - cualquier color + blanco frío
  | 'cmy'       // CMY substractivo (fixtures de descarga de alta gama)
  | 'wheel'     // Rueda de colores física - colores fijos, cambio lento
  | 'hybrid'    // Rueda + CMY (algunos spots de gama alta)

/**
 * Tipo de obturador/shutter
 */
export type ShutterType =
  | 'digital'    // LED - instantáneo, puede strobar a cualquier velocidad
  | 'mechanical' // Mecánico - tiene inercia, velocidad limitada

/**
 * Tipo de motor de movimiento
 */
export type MovementType =
  | 'stepper'   // Motor paso a paso - preciso pero con inercia
  | 'servo'     // Servomotor - suave pero lento
  | 'galvo'     // Galvanómetro (láser) - ultra rápido

/**
 * Un color en la rueda física
 */
export interface WheelColor {
  /** Valor DMX para seleccionar este color (0-255) */
  dmx: number
  /** Nombre legible del color */
  name: string
  /** Aproximación RGB para cálculos de distancia */
  rgb: { r: number; g: number; b: number }
  /** Si el color incluye gobo o textura */
  hasTexture?: boolean
}

/**
 * Definición completa de una rueda de colores
 */
export interface ColorWheelDefinition {
  /** Lista de colores disponibles en orden de rueda */
  colors: WheelColor[]
  /** ¿Permite giro continuo (rainbow effect)? */
  allowsContinuousSpin: boolean
  /** DMX value para activar giro continuo (si aplica) */
  spinStartDmx?: number
  /** Tiempo mínimo entre cambios de color (ms) - PROTECCIÓN MECÁNICA */
  minChangeTimeMs: number
}

/**
 * Perfil completo de un fixture
 */
export interface FixtureProfile {
  /** ID único del perfil (debe coincidir con el modelo del fixture) */
  id: string
  /** Nombre legible */
  name: string
  /** Tipo genérico de fixture */
  type: 'beam' | 'spot' | 'wash' | 'par' | 'strobe' | 'laser' | 'generic'
  
  /** Capacidades del motor de color */
  colorEngine: {
    /** Tipo de mezcla de color */
    mixing: ColorMixingType
    /** Definición de rueda de colores (solo si mixing = 'wheel' o 'hybrid') */
    colorWheel?: ColorWheelDefinition
  }
  
  /** Capacidades del shutter */
  shutter: {
    type: ShutterType
    /** Frecuencia máxima segura de strobe (Hz) - solo para mecánicos */
    maxStrobeHz?: number
  }
  
  /** Capacidades de movimiento (solo para movers) */
  movement?: {
    type: MovementType
    /** Velocidad máxima de pan (grados/segundo) */
    maxPanSpeed: number
    /** Velocidad máxima de tilt (grados/segundo) */
    maxTiltSpeed: number
  }
  
  /** Flags de seguridad */
  safety: {
    /** ¿Requiere blackout durante cambio de color? (ruedas ruidosas) */
    blackoutOnColorChange: boolean
    /** Tiempo máximo de encendido continuo a 100% (segundos, 0 = sin límite) */
    maxContinuousOnTime: number
    /** ¿Es un fixture de descarga? (requiere espera para reencendido) */
    isDischarge: boolean
    /** Tiempo de enfriamiento si se apaga (segundos) */
    cooldownTime: number
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PERFILES PREDEFINIDOS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🔦 BEAM 2R / LB230N - El clásico beam de discoteca
 * 
 * Rueda de colores física, 8 colores, lámpara de descarga.
 * REQUIERE PROTECCIÓN MECÁNICA - no puede cambiar color rápido.
 */
export const BEAM_2R_PROFILE: FixtureProfile = {
  id: 'beam-2r',
  name: 'Beam 2R / LB230N / Sharpy Clone',
  type: 'beam',
  
  colorEngine: {
    mixing: 'wheel',
    colorWheel: {
      colors: [
        // Rueda típica de un Beam 2R (puede variar según fabricante)
        { dmx: 0,   name: 'Open (White)',     rgb: { r: 255, g: 255, b: 255 } },
        { dmx: 15,  name: 'Red',              rgb: { r: 255, g: 0,   b: 0   } },
        { dmx: 30,  name: 'Orange',           rgb: { r: 255, g: 128, b: 0   } },
        { dmx: 45,  name: 'Yellow',           rgb: { r: 255, g: 255, b: 0   } },
        { dmx: 60,  name: 'Green',            rgb: { r: 0,   g: 255, b: 0   } },
        { dmx: 75,  name: 'Cyan',             rgb: { r: 0,   g: 255, b: 255 } },
        { dmx: 90,  name: 'Blue',             rgb: { r: 0,   g: 0,   b: 255 } },
        { dmx: 105, name: 'Magenta',          rgb: { r: 255, g: 0,   b: 255 } },
        { dmx: 120, name: 'Light Blue',       rgb: { r: 128, g: 128, b: 255 } },
        { dmx: 135, name: 'Pink',             rgb: { r: 255, g: 128, b: 255 } },
        { dmx: 150, name: 'UV Purple',        rgb: { r: 128, g: 0,   b: 255 } },
        { dmx: 165, name: 'CTO (Warm White)', rgb: { r: 255, g: 200, b: 150 } },
        // 190-255: Giro continuo (rainbow spin)
      ],
      allowsContinuousSpin: true,
      spinStartDmx: 190,
      minChangeTimeMs: 500, // ¡CRÍTICO! No cambiar más rápido que esto
    },
  },
  
  shutter: {
    type: 'mechanical',
    maxStrobeHz: 12, // El shutter mecánico no aguanta más
  },
  
  movement: {
    type: 'stepper',
    maxPanSpeed: 180, // grados/segundo
    maxTiltSpeed: 120,
  },
  
  safety: {
    blackoutOnColorChange: false, // El beam 2R cambia limpio
    maxContinuousOnTime: 0, // Sin límite real
    isDischarge: true, // ¡LÁMPARA DE DESCARGA!
    cooldownTime: 300, // 5 minutos de enfriamiento mínimo
  },
}

/**
 * 🌈 LED PAR RGB Genérico
 * 
 * El fixture más común. LED RGB directo, sin rueda.
 * Puede hacer cualquier color al instante.
 */
export const LED_PAR_RGB_PROFILE: FixtureProfile = {
  id: 'led-par-rgb',
  name: 'LED PAR RGB Generic',
  type: 'par',
  
  colorEngine: {
    mixing: 'rgb',
    // Sin rueda de colores
  },
  
  shutter: {
    type: 'digital',
    // Sin límite de strobe
  },
  
  // Sin movimiento (es un PAR fijo)
  
  safety: {
    blackoutOnColorChange: false,
    maxContinuousOnTime: 0, // LEDs aguantan todo el día
    isDischarge: false,
    cooldownTime: 0,
  },
}

/**
 * 🌟 LED Moving Head Wash
 * 
 * Moving head con LEDs RGB/RGBW. Puede hacer cualquier color.
 * Movimiento más suave que los beams mecánicos.
 */
export const LED_WASH_PROFILE: FixtureProfile = {
  id: 'led-wash',
  name: 'LED Moving Head Wash',
  type: 'wash',
  
  colorEngine: {
    mixing: 'rgbw',
  },
  
  shutter: {
    type: 'digital',
  },
  
  movement: {
    type: 'stepper',
    maxPanSpeed: 200,
    maxTiltSpeed: 150,
  },
  
  safety: {
    blackoutOnColorChange: false,
    maxContinuousOnTime: 0,
    isDischarge: false,
    cooldownTime: 0,
  },
}

/**
 * 💥 Strobe LED
 * 
 * Strobe puro. Solo blanco, pero a velocidades brutales.
 */
export const LED_STROBE_PROFILE: FixtureProfile = {
  id: 'led-strobe',
  name: 'LED Strobe',
  type: 'strobe',
  
  colorEngine: {
    mixing: 'rgb', // Algunos tienen RGB
  },
  
  shutter: {
    type: 'digital',
    // Sin límite - es su propósito
  },
  
  safety: {
    blackoutOnColorChange: false,
    maxContinuousOnTime: 30, // 30 segundos máximo a full (seguridad epilepsia)
    isDischarge: false,
    cooldownTime: 0,
  },
}

// ═══════════════════════════════════════════════════════════════════════════
// REGISTRY DE PERFILES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Mapa de perfiles por ID
 */
const PROFILE_REGISTRY = new Map<string, FixtureProfile>([
  [BEAM_2R_PROFILE.id, BEAM_2R_PROFILE],
  [LED_PAR_RGB_PROFILE.id, LED_PAR_RGB_PROFILE],
  [LED_WASH_PROFILE.id, LED_WASH_PROFILE],
  [LED_STROBE_PROFILE.id, LED_STROBE_PROFILE],
])

/**
 * 🔍 Mapeo heurístico de nombres de fixture a perfiles
 * Usado cuando no hay profileId explícito
 */
const MODEL_TO_PROFILE: Array<[RegExp, string]> = [
  // Beams
  [/beam.?2r/i, 'beam-2r'],
  [/lb230/i, 'beam-2r'],
  [/sharpy/i, 'beam-2r'],
  [/beam.?230/i, 'beam-2r'],
  [/5r.?beam/i, 'beam-2r'],
  [/7r.?beam/i, 'beam-2r'],
  
  // LED Washes
  [/wash.*led/i, 'led-wash'],
  [/led.*wash/i, 'led-wash'],
  [/moving.*head.*led/i, 'led-wash'],
  
  // LED PARs
  [/par.*led/i, 'led-par-rgb'],
  [/led.*par/i, 'led-par-rgb'],
  [/slim.*par/i, 'led-par-rgb'],
  [/flat.*par/i, 'led-par-rgb'],
  
  // Strobes
  [/strobe/i, 'led-strobe'],
  [/atomic/i, 'led-strobe'],
]

// ═══════════════════════════════════════════════════════════════════════════
// API PÚBLICA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Obtiene un perfil por ID
 */
export function getProfile(profileId: string): FixtureProfile | undefined {
  return PROFILE_REGISTRY.get(profileId)
}

/**
 * Obtiene un perfil basado en el nombre/modelo del fixture (heurístico)
 */
export function getProfileByModel(modelName: string): FixtureProfile | undefined {
  for (const [pattern, profileId] of MODEL_TO_PROFILE) {
    if (pattern.test(modelName)) {
      return PROFILE_REGISTRY.get(profileId)
    }
  }
  return undefined
}

/**
 * Detecta si un fixture necesita traducción de color (tiene rueda)
 */
export function needsColorTranslation(profile: FixtureProfile | undefined): boolean {
  if (!profile) return false
  return profile.colorEngine.mixing === 'wheel' || profile.colorEngine.mixing === 'hybrid'
}

/**
 * Detecta si un fixture es mecánico (necesita protección de velocidad)
 */
export function isMechanicalFixture(profile: FixtureProfile | undefined): boolean {
  if (!profile) return false
  return profile.shutter.type === 'mechanical' || profile.safety.isDischarge
}

/**
 * Registra un perfil personalizado
 */
export function registerProfile(profile: FixtureProfile): void {
  PROFILE_REGISTRY.set(profile.id, profile)
  console.log(`[FixtureProfiles] 📚 Registered profile: ${profile.id}`)
}

/**
 * Lista todos los perfiles registrados
 */
export function listProfiles(): string[] {
  return Array.from(PROFILE_REGISTRY.keys())
}

console.log(`[FixtureProfiles] 🎨 WAVE 1000: Loaded ${PROFILE_REGISTRY.size} fixture profiles`)
