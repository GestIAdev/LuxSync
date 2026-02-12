/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚒️ HEPHAESTUS TYPES - THE DNA OF THE FORGE
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 2030.2: HEPHAESTUS CORE ENGINE
 * 
 * Data structures para el sistema de automatización multi-parámetro.
 * Cada tipo aquí define cómo se almacena, transmite y evalúa
 * una curva de automatización.
 * 
 * ARQUITECTURA DE TIPOS:
 * 
 *   HSL                    → Color atómico
 *   HephKeyframe           → Punto en el tiempo con valor + interpolación
 *   HephCurve              → Secuencia de keyframes para UN parámetro
 *   HephAutomationClip     → Colección de curvas = efecto completo
 *   HephParamSnapshot      → Snapshot de todos los params en un instante
 * 
 * INVARIANTES:
 * - Keyframes SIEMPRE ordenados por timeMs ascendente
 * - Valores numéricos SIEMPRE en rango normalizado (según curve.range)
 * - Colores SIEMPRE en HSL (h: 0-360, s: 0-100, l: 0-100)
 * - bezierHandles: [cx1, cy1, cx2, cy2] donde cada valor es 0-1
 *   (pero cy puede exceder 0-1 para overshoot/bounce)
 * 
 * @module core/hephaestus/types
 * @version WAVE 2030.2
 */

import type { EffectCategory, EffectZone } from '../effects/types'

// ═══════════════════════════════════════════════════════════════════════════
// ATOMIC TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Color en espacio HSL.
 * 
 * El espacio HSL es ideal para interpolación perceptual:
 * - H (Hue): Rueda de color, interpolación circular shortest-path
 * - S (Saturation): Lineal, más intuitivo que en RGB
 * - L (Lightness): Lineal, controla brillo sin afectar tono
 */
export interface HSL {
  /** Hue: 0-360 (grados en la rueda de color) */
  h: number
  /** Saturation: 0-100 (% de saturación) */
  s: number
  /** Lightness: 0-100 (% de luminosidad) */
  l: number
}

/**
 * Tipo de interpolación entre dos keyframes.
 * 
 * 'hold'   → Step function: valor constante hasta el siguiente keyframe
 * 'linear' → Línea recta entre dos puntos
 * 'bezier' → Cubic bezier con handles de control (After Effects style)
 */
export type HephInterpolation = 'hold' | 'linear' | 'bezier'

/**
 * Modo de aplicación de una curva sobre el output del efecto base.
 * 
 * 'absolute' → El valor de la curva REEMPLAZA el del efecto
 *   intensity curva = 0.5 → dimmer = 0.5
 * 
 * 'relative' → El valor de la curva MULTIPLICA el del efecto
 *   intensity curva = 0.5, efecto genera 0.8 → dimmer = 0.4
 * 
 * 'additive' → El valor de la curva SE SUMA al del efecto (clamped)
 *   pan curva = 0.1, efecto genera 0.3 → pan = 0.4
 */
export type HephCurveMode = 'absolute' | 'relative' | 'additive'

// ═══════════════════════════════════════════════════════════════════════════
// PARAMETER IDS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * IDs de parámetros que Hephaestus puede controlar.
 * 
 * Cada ID se mapea directamente a un campo de EffectFrameOutput
 * o a un parámetro interno del efecto.
 * 
 * MAPPING:
 *   'intensity'  → dimmerOverride (0-1)
 *   'color'      → colorOverride (HSL)
 *   'white'      → whiteOverride (0-1)
 *   'amber'      → amberOverride (0-1)
 *   'speed'      → param interno del efecto (0-1 normalizado)
 *   'pan'        → movement.pan (0-1 → 16-bit: coarse + fine)
 *   'tilt'       → movement.tilt (0-1 → 16-bit: coarse + fine)
 *   'zoom'       → zoom (0-1 → 0-255 DMX)
 *   'focus'      → focus (0-1 → 0-255 DMX)
 *   'iris'       → iris (0-1 → 0-255 DMX)
 *   'gobo1'      → gobo wheel 1 (0-1 → 0-255 DMX)
 *   'gobo2'      → gobo wheel 2 (0-1 → 0-255 DMX)
 *   'prism'      → prism rotation (0-1 → 0-255 DMX)
 *   'strobe'     → strobeRate (0=off, 1=18Hz max)
 *   'globalComp' → globalComposition (0-1)
 *   'width'      → param interno (beam/chase width, 0-1)
 *   'direction'  → param interno (sweep direction, 0=L→R, 1=R→L)
 */
export type HephParamId =
  | 'intensity'
  | 'color'
  | 'white'
  | 'amber'
  | 'speed'
  | 'pan'
  | 'tilt'
  | 'zoom'
  | 'focus'
  | 'iris'
  | 'gobo1'
  | 'gobo2'
  | 'prism'
  | 'strobe'
  | 'globalComp'
  | 'width'
  | 'direction'

// ═══════════════════════════════════════════════════════════════════════════
// KEYFRAME
// ═══════════════════════════════════════════════════════════════════════════

/**
 * WAVE 2030.14: Audio Binding Configuration
 * Links a keyframe's value to real-time audio analysis data.
 * When bound, the keyframe's static value becomes the BASE,
 * and audio modulates it according to the mapping.
 */
export interface HephAudioBinding {
  /** Audio source channel */
  source: 'energy' | 'bass' | 'mids' | 'highs' | 'none'
  
  /** Input range from audio analyzer [min, max] (typically 0-1) */
  inputRange: [number, number]
  
  /** Output range for the parameter [min, max] */
  outputRange: [number, number]
  
  /** Smoothing factor (0 = instant, 1 = very slow) */
  smoothing: number
}

/**
 * ⚒️ HEPHAESTUS KEYFRAME
 * 
 * Un punto de control en el tiempo.
 * Dos keyframes consecutivos definen un segmento interpolable.
 * 
 * La innovación: cubic-bezier handles para curvas orgánicas.
 * No easings nombradas de CSS — control total con 4 floats.
 * 
 * Esto es After Effects, Blender, Ableton. Estándar de industria creativa.
 */
export interface HephKeyframe {
  /** Tiempo en ms desde inicio del clip */
  timeMs: number

  /**
   * Valor en este punto.
   * - number: Para intensity, speed, zoom, pan, tilt (rango según curve.range)
   * - HSL: Para color { h: 0-360, s: 0-100, l: 0-100 }
   */
  value: number | HSL

  /**
   * Interpolación HACIA el siguiente keyframe.
   * Define cómo se transiciona desde ESTE keyframe al siguiente.
   * El último keyframe de una curva ignora este campo.
   */
  interpolation: HephInterpolation

  /**
   * Handles de control para cubic-bezier.
   * Solo relevante cuando interpolation === 'bezier'.
   * 
   * Formato: [cx1, cy1, cx2, cy2]
   * cx/cy son posiciones relativas del segmento (0-1 para x).
   * cy puede exceder 0-1 para overshoot/bounce.
   * 
   * Presets semánticos:
   *   ease-in:     [0.42, 0,    1,    1   ]
   *   ease-out:    [0,    0,    0.58, 1   ]
   *   ease-in-out: [0.42, 0,    0.58, 1   ]
   *   overshoot:   [0.68, -0.6, 0.32, 1.6 ]
   *   bounce:      [0.34, 1.56, 0.64, 1   ]
   *   snap:        [0.9,  0,    0.1,  1   ]
   */
  bezierHandles?: [number, number, number, number]
  
  /**
   * WAVE 2030.14: Audio binding for reactive keyframes.
   * When present, the keyframe value is modulated by audio input.
   */
  audioBinding?: HephAudioBinding
}

// ═══════════════════════════════════════════════════════════════════════════
// CURVE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ⚒️ HEPHAESTUS AUTOMATION CURVE
 * 
 * Una secuencia ordenada de keyframes para UN parámetro.
 * Es la unidad atómica de automatización.
 * 
 * INVARIANTES:
 * - keyframes SIEMPRE están ordenados por timeMs (ascendente)
 * - Mínimo 1 keyframe (valor constante)
 * - El primer keyframe define el valor inicial
 * - El último keyframe define el valor final
 * - Consultas fuera de rango clampean al primer/último valor
 */
export interface HephCurve {
  /** ID del parámetro que esta curva controla */
  paramId: HephParamId

  /** Tipo de valor para validación y branching de interpolación */
  valueType: 'number' | 'color'

  /** Rango válido para valores numéricos [min, max] */
  range: [number, number]

  /** Valor por defecto cuando no hay keyframes activos */
  defaultValue: number | HSL

  /** Keyframes ordenados por tiempo ascendente */
  keyframes: HephKeyframe[]

  /**
   * Modo de aplicación sobre el output base del efecto.
   * Default: 'absolute'
   */
  mode: HephCurveMode
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTOMATION CLIP
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ⚒️ HEPHAESTUS AUTOMATION CLIP
 * 
 * Un FXClip evolucionado. Contiene MÚLTIPLES curvas
 * (una por parámetro automatizado).
 * 
 * Es lo que se guarda en el archivo .lfx y lo que
 * Chronos coloca en el timeline.
 */
export interface HephAutomationClip {
  /** ID único del clip */
  id: string

  /** Nombre legible para UI */
  name: string

  /** Autor del clip */
  author: string

  /** Categoría del efecto */
  category: EffectCategory

  /** Tags para búsqueda/filtrado */
  tags: string[]

  /** Compatibilidad de vibes (vacío = todas) */
  vibeCompat: string[]

  /** Zonas objetivo del efecto */
  zones: EffectZone[]

  /** Mix bus: 'htp' (aditivo) o 'global' (dictador) */
  mixBus: 'htp' | 'global'

  /** Prioridad del efecto (0-100) */
  priority: number

  /** Duración total del clip en ms */
  durationMs: number

  /**
   * El tipo de efecto BASE que este clip automatiza.
   * 
   * Si es un effectType existente (e.g., 'acid_sweep'),
   * Hephaestus modula sus parámetros internos via overlay.
   * 
   * Si es 'heph_custom', Hephaestus genera el output
   * directamente desde las curvas (bypass effect class).
   */
  effectType: string

  /**
   * LAS CURVAS — El corazón de Hephaestus
   * 
   * Map de paramId → curva de automatización.
   * Solo se incluyen parámetros que tienen keyframes.
   * Parámetros no incluidos usan el valor por defecto del efecto.
   */
  curves: Map<HephParamId, HephCurve>

  /**
   * Parámetros estáticos (no automatizados).
   * Para valores que no cambian durante el efecto.
   * Equivalente al `params` actual de FXClip.
   */
  staticParams: Record<string, number | string | boolean>
}

// ═══════════════════════════════════════════════════════════════════════════
// SNAPSHOT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Snapshot de todos los valores de curva evaluados en un instante.
 * 
 * Las keys son HephParamId, los values son number o HSL
 * dependiendo del valueType de la curva.
 */
export type HephParamSnapshot = Partial<Record<HephParamId, number | HSL>>

// ═══════════════════════════════════════════════════════════════════════════
// BEZIER PRESETS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Presets de bezier handles para uso rápido.
 * 
 * El usuario puede seleccionar un preset en la UI y luego
 * ajustar los handles manualmente si necesita refinamiento.
 */
export const BEZIER_PRESETS: Record<string, [number, number, number, number]> = {
  'linear':      [0,    0,    1,    1   ],
  'ease-in':     [0.42, 0,    1,    1   ],
  'ease-out':    [0,    0,    0.58, 1   ],
  'ease-in-out': [0.42, 0,    0.58, 1   ],
  'overshoot':   [0.68, -0.6, 0.32, 1.6 ],
  'bounce':      [0.34, 1.56, 0.64, 1   ],
  'snap':        [0.9,  0,    0.1,  1   ],
  'smooth':      [0.25, 0.1,  0.25, 1   ],
  'sharp-in':    [0.9,  0,    0.7,  1   ],
  'sharp-out':   [0.3,  0,    0.1,  1   ],
} as const

// ═══════════════════════════════════════════════════════════════════════════
// TYPE GUARDS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Type guard: ¿Es este valor un HSL?
 */
export function isHSL(value: number | HSL): value is HSL {
  return (
    typeof value === 'object' &&
    value !== null &&
    'h' in value &&
    's' in value &&
    'l' in value
  )
}

/**
 * Type guard: ¿Es este valor un number?
 */
export function isNumericValue(value: number | HSL): value is number {
  return typeof value === 'number'
}

// ═══════════════════════════════════════════════════════════════════════════
// SERIALIZATION (IPC-safe)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Versión serializable de HephAutomationClip para IPC.
 * 
 * El problema: `Map<>` no se serializa correctamente en IPC de Electron.
 * Se convierte a `{}` vacío al pasar por JSON.stringify/parse.
 * 
 * Esta interface usa `Record<>` en lugar de `Map<>` para que
 * el clip pueda viajar seguro entre renderer y main process.
 */
export interface HephAutomationClipSerialized {
  id: string
  name: string
  author: string
  category: string
  tags: string[]
  vibeCompat: string[]
  zones: string[]
  mixBus: 'htp' | 'global'
  priority: number
  durationMs: number
  effectType: string
  curves: Record<string, HephCurve>  // ← Record, no Map
  staticParams: Record<string, number | string | boolean>
}

/**
 * Serializa un HephAutomationClip para transporte IPC.
 * Convierte Map → Record.
 */
export function serializeHephClip(clip: HephAutomationClip): HephAutomationClipSerialized {
  const curvesRecord: Record<string, HephCurve> = {}
  for (const [paramId, curve] of clip.curves) {
    curvesRecord[paramId] = curve
  }
  
  return {
    id: clip.id,
    name: clip.name,
    author: clip.author,
    category: clip.category,
    tags: clip.tags,
    vibeCompat: clip.vibeCompat,
    zones: clip.zones as string[],
    mixBus: clip.mixBus,
    priority: clip.priority,
    durationMs: clip.durationMs,
    effectType: clip.effectType,
    curves: curvesRecord,
    staticParams: clip.staticParams,
  }
}

/**
 * Deserializa un HephAutomationClipSerialized de vuelta a HephAutomationClip.
 * Convierte Record → Map.
 */
export function deserializeHephClip(serialized: HephAutomationClipSerialized): HephAutomationClip {
  const curvesMap = new Map<HephParamId, HephCurve>()
  for (const [paramId, curve] of Object.entries(serialized.curves)) {
    curvesMap.set(paramId as HephParamId, curve)
  }
  
  return {
    id: serialized.id,
    name: serialized.name,
    author: serialized.author,
    category: serialized.category as import('../effects/types').EffectCategory,
    tags: serialized.tags,
    vibeCompat: serialized.vibeCompat,
    zones: serialized.zones as import('../effects/types').EffectZone[],
    mixBus: serialized.mixBus,
    priority: serialized.priority,
    durationMs: serialized.durationMs,
    effectType: serialized.effectType,
    curves: curvesMap,
    staticParams: serialized.staticParams,
  }
}
