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
import type { CanonicalZone } from '../stage/ShowFileV2'

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
// PHASE DISTRIBUTION - WAVE 2400: THE PHASER REVOLUTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ⚒️ WAVE 2400: Modo de distribución de fase entre fixtures.
 *
 * 'linear'     → Offset crece linealmente: fixture[i] = i × stepMs
 * 'mirror'     → Fold simétrico: se pliega desde los extremos al centro
 * 'center-out' → Expansión desde el centro hacia afuera
 */
export type PhaseSymmetryMode = 'linear' | 'mirror' | 'center-out'

/**
 * ⚒️ WAVE 2400: Dirección de propagación de la fase.
 *
 * 1  → Forward:  fixture 0 primero, fixture N último
 * -1 → Reverse:  fixture N primero, fixture 0 último
 */
export type PhaseDirection = 1 | -1

/**
 * ⚒️ WAVE 2400: Configuración completa de distribución de fase para un clip.
 *
 * Se almacena como extensión de FixtureSelector o directamente
 * en el HephAutomationClip.
 *
 * INVARIANTES:
 * - spread ∈ [0, 1]  (0 = sin offset, 1 = spread completo de durationMs)
 * - wings ∈ [1, N]   (1 = sin división, N = N sub-grupos)
 * - wings ≤ fixtureCount (se clampea en runtime)
 */
export interface PhaseConfig {
  /** Spread total: fracción de durationMs que separa al primero del último */
  spread: number   // 0-1

  /** Modo de simetría */
  symmetry: PhaseSymmetryMode

  /** Cantidad de wings (sub-grupos con fase independiente) */
  wings: number    // 1-N, default 1

  /** Dirección de propagación */
  direction: PhaseDirection  // default 1
}

/**
 * ⚒️ WAVE 2400: Default PhaseConfig — sin distribución de fase.
 * @deprecated V2 legacy — use PhaseConfigPro from './phase/PhaseConfigPro'.
 */
export const DEFAULT_PHASE_CONFIG: Readonly<PhaseConfig> = {
  spread: 0,
  symmetry: 'linear',
  wings: 1,
  direction: 1,
} as const

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
  /**
   * WAVE 4848 V3: normalizedValue ∈ [0,1]. Adapter abre shutter automáticamente.
   * Alias de contrato v3 — en v2 era 'strobe', en v3 se documenta como 'strobeRate'.
   */
  | 'strobeRate'
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
 * ⚒️ HEPHAESTUS AUTOMATION CLIP — Canonical alias (WAVE 7003)
 *
 * V2 purged. All .lfx files are V3 native. This alias ensures
 * every import of `HephAutomationClip` enforces V3 structure.
 */
export type HephAutomationClip = HephAutomationClipV3

// ═══════════════════════════════════════════════════════════════════════════
// V3 MULTICELLULAR TYPES — WAVE 4848
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Objetivo espacial de un HephTrack v3.
 * Puede ser cualquiera de las 9 zonas canónicas o un helper compuesto.
 *
 * Canon: ShowFileV2.ts → CanonicalZone (9 zonas).
 * Helpers: 'all' = todas excepto unassigned; 'all-pars' / 'all-movers' expandidos por ZoneMapper.
 */
export type ZoneTarget = CanonicalZone | 'all' | 'all-pars' | 'all-movers'

/**
 * Estrategia de fusión cuando múltiples tracks coinciden en el mismo (paramId, fixture).
 *
 *  'max'      → HTP: gana el valor más alto                  (default para 'intensity')
 *  'replace'  → LTP: el track de mayor prioridad gana        (default para 'color', 'pan', 'tilt')
 *  'add'      → Aditivo: suma clampeada a range.max
 *  'multiply' → Multiplicativo: producto de valores
 */
export type BlendMode = 'max' | 'replace' | 'add' | 'multiply'

/**
 * ⚒️ WAVE 4848 — Track multicelular.
 *
 * Unidad atómica del genoma V3: UNA curva aplicada sobre UN conjunto
 * de zonas canónicas. Múltiples HephTrack en un clip = multicelularidad.
 *
 * INVARIANTES:
 *   - zones.length >= 1  (track sin destino es error de Loader)
 *   - dimmerScale ∈ [0, 1]
 *   - Si paramId === 'color' y colorOverride definido → suplanta la curva
 *   - cell es RESERVADO v3.0 — Runtime no lo consume. Migrator no lo emite todavía.
 */
export interface HephTrack {
  /** ID estable del track (UUID v4 o slug determinista del migrator). */
  id: string

  /** Parámetro DMX-semántico que este track controla. */
  paramId: HephParamId

  /** Zonas canónicas (o helpers) sobre las que aplica. NUNCA vacío. */
  zones: readonly ZoneTarget[]

  /** La curva de keyframes para este parámetro. */
  curve: HephCurve

  /**
   * Multiplicador del dimmer del fixture.
   * Solo semántico cuando paramId === 'intensity'. [0..1] Default 1.
   */
  dimmerScale?: number

  /**
   * Override de color constante.
   * Si definido y paramId === 'color' → suplanta el output evaluado de la curva.
   */
  colorOverride?: HSL

  /**
   * Estrategia de fusión multi-track.
   * Default implícito: 'max' si paramId === 'intensity'; 'replace' para el resto.
   */
  blendMode?: BlendMode

  /**
   * Forward-compat SOLO: ID de celda dentro de un fixture multicell.
   * RESERVADO en v3.0 — Runtime no lo consume. Migrator no lo emite todavía.
   */
  cell?: string

  /**
   * Selector fino de fixtures (intersección AND con zones).
   * Si presente, filtra los fixtures resueltos por zones a un subconjunto.
   */
  selector?: import('../stage/ShowFileV2').FixtureSelector

  /**
   * ⚒️ WAVE 4859 — Distribución de fase grandMA3-style per-fixture.
   *
   * Shorthand directo en el track (alternativa a declarar `selector.phase`).
   * Cuando presente, el Runtime usa `resolveWithOverrides()` (PhaseConfigPro)
   * al activar el clip y almacena los offsets en `ResolvedTrack.fixturePhases`.
   *
   * MODELO MA3: `spreadDeg: 360` = el último fixture empieza su animación
   * exactamente un ciclo después que el primero. El offset se aplica con
   * wrap continuo → `localElapsedMs = (clipTime + phaseOffset) % durationMs`.
   */
  phaseConfig?: import('./phase/PhaseConfigPro').PhaseConfigPro

  /**
   * ⚒️ Phase Canvas — Overrides manuales de fase per-fixture.
   *
   * Key = fixtureId, Value = PhaseOverride (delta o absolute).
   * Vacío o ausente → comportamiento algorítmico puro (default).
   * Aplicado DESPUÉS de resolvePro() — no modifica el algoritmo base.
   */
  phaseOverrides?: import('./phase/PhaseOverride').PhaseOverrideMap
}

/**
 * ⚒️ WAVE 4848 — Automation Clip V3.0 (Multicelular).
 *
 * Reemplaza HephAutomationClip en el pipeline V3.
 * Cambio clave: `curves: Map<HephParamId, HephCurve>` → `tracks: HephTrack[]`.
 *
 * Discriminado por `schemaVersion: '3.0'` en el LfxFileLoader.
 * Si schemaVersion es '2.x', el Loader usa el adapter in-memory v2→v3.
 *
 * SEPARACIÓN DE NAMESPACES (cierra F3b de WAVE-4847):
 *   - spatialZones → DÓNDE van los fixtures (CanonicalZone / helpers)
 *   - cognitiveDNA  → CUÁNDO/CÓMO actúa Selene (EnergyZone, ACO, vibes)
 *   El Loader rechaza cualquier EnergyZoneId en spatialZones.
 */
export interface HephAutomationClipV3 {
  // ── Identidad ──
  id: string
  name: string
  author: string
  category: EffectCategory
  tags: string[]
  vibeCompat: string[]

  // ── ESPACIAL CANÓNICO (resumen — cierra F3b de WAVE-4847) ──
  /**
   * Unión de todas las zones de tracks[]. Resumen para Selene/UI.
   * El LfxFileLoader auto-recomputa y valida en carga.
   * Para targeting granular → iterar tracks[].
   */
  spatialZones: readonly ZoneTarget[]

  // ── Ejecución ──
  mixBus: 'global' | 'htp' | 'ambient' | 'accent'
  priority: number
  durationMs: number
  effectType: string

  /**
   * ❤️ EL CORAZÓN MULTICELULAR.
   * Cada track = una curva sobre un conjunto de zonas.
   * Orden canónico (migrator): zona ASC → paramId ASC (garantiza idempotencia/checksum).
   */
  tracks: HephTrack[]

  /**
   * Parámetros estáticos (escalares constantes durante el clip).
   * NUNCA dominantColorH/S/L — se derivan de curvas 'color' en runtime.
   */
  staticParams: Record<string, number | string | boolean>

  // ── Cognitivo (opcional — solo clips Selene-visibles) ──
  cognitiveDNA?: import('../arsenal/lfxTypes').CognitiveDNA
  simulationMeta?: import('../arsenal/lfxTypes').SimulationMeta
  safetyDeclaration?: import('../arsenal/lfxTypes').SafetyDeclaration

  /** Discriminador para LfxFileLoader. Literal exacto '3.0'. */
  schemaVersion: '3.0'
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
 * ⚒️ WAVE 7003 — Serializador canónico V3.
 *
 * Toma el estado inmaculado del Store (Immer) y devuelve un objeto
 * JSON-ready limpio, descartando cualquier variable efímera de la UI.
 * Deep clone de tracks, curves, keyframes y nested objects.
 */
export function serializeHephClip(clip: HephAutomationClipV3): HephAutomationClipV3 {
  const cleanTracks: HephTrack[] = clip.tracks.map(track => ({
    id: track.id,
    paramId: track.paramId,
    zones: [...track.zones],
    curve: {
      paramId: track.curve.paramId,
      valueType: track.curve.valueType,
      range: Array.isArray(track.curve.range) && track.curve.range.length === 2
        ? [...track.curve.range] as [number, number]
        : (track.curve.valueType === 'color' ? [0, 360] : [0, 1]) as [number, number],
      defaultValue: typeof track.curve.defaultValue === 'object' && track.curve.defaultValue !== null
        ? { ...(track.curve.defaultValue as HSL) }
        : track.curve.defaultValue,
      keyframes: track.curve.keyframes.map(kf => ({
        timeMs: kf.timeMs,
        value: typeof kf.value === 'object' && kf.value !== null
          ? { ...(kf.value as HSL) }
          : kf.value,
        interpolation: kf.interpolation,
        bezierHandles: kf.bezierHandles ? [...kf.bezierHandles] as [number, number, number, number] : undefined,
        audioBinding: kf.audioBinding ? {
          source: kf.audioBinding.source,
          inputRange: [...kf.audioBinding.inputRange] as [number, number],
          outputRange: [...kf.audioBinding.outputRange] as [number, number],
          smoothing: kf.audioBinding.smoothing,
        } : undefined,
      })),
      mode: track.curve.mode ?? 'absolute',
    },
    dimmerScale: track.dimmerScale,
    colorOverride: track.colorOverride ? { ...track.colorOverride } : undefined,
    blendMode: track.blendMode,
    cell: track.cell,
    selector: track.selector ? JSON.parse(JSON.stringify(track.selector)) : undefined,
    phaseConfig: track.phaseConfig ? { ...track.phaseConfig } : undefined,
    phaseOverrides: track.phaseOverrides ? JSON.parse(JSON.stringify(track.phaseOverrides)) : undefined,
  }));

  return {
    id: clip.id,
    name: clip.name,
    author: clip.author,
    category: clip.category,
    tags: Array.isArray(clip.tags) ? [...clip.tags] : [],
    vibeCompat: Array.isArray(clip.vibeCompat) ? [...clip.vibeCompat] : [],
    spatialZones: Array.isArray(clip.spatialZones) ? [...clip.spatialZones] : [],
    mixBus: clip.mixBus,
    priority: clip.priority,
    durationMs: clip.durationMs,
    effectType: clip.effectType,
    tracks: cleanTracks,
    staticParams: clip.staticParams ? JSON.parse(JSON.stringify(clip.staticParams)) : {},
    cognitiveDNA: clip.cognitiveDNA ? JSON.parse(JSON.stringify(clip.cognitiveDNA)) : undefined,
    simulationMeta: clip.simulationMeta ? JSON.parse(JSON.stringify(clip.simulationMeta)) : undefined,
    safetyDeclaration: clip.safetyDeclaration ? JSON.parse(JSON.stringify(clip.safetyDeclaration)) : undefined,
    schemaVersion: '3.0',
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY INFERENCE - WAVE 2040.9a
// ═══════════════════════════════════════════════════════════════════════════

/** Parameter groups for category inference */
const PHYSICAL_PARAMS: HephParamId[] = ['intensity', 'strobe']
const COLOR_PARAMS: HephParamId[] = ['color', 'white', 'amber']
const MOVEMENT_PARAMS: HephParamId[] = ['pan', 'tilt']
const OPTICS_PARAMS: HephParamId[] = ['zoom', 'focus', 'iris', 'gobo1', 'gobo2', 'prism']

/**
 * ⚒️ WAVE 2040.9a: Infer EffectCategory from a clip's automated curves.
 * 
 * Analiza QUÉ parámetros toca un clip de Hephaestus y determina
 * su EffectCategory automáticamente. Si toca parámetros de 2+ grupos,
 * retorna 'composite'.
 * 
 * DETERMINISTA: No hay random, no hay heurística ambigua.
 * El resultado depende ÚNICAMENTE de qué curvas tiene el clip.
 * 
 * @param clip - HephAutomationClip con curvas definidas
 * @returns EffectCategory inferida desde las curvas
 */
export function inferHephCategory(clip: HephAutomationClip): import('../effects/types').EffectCategory {
  const paramIds = clip.tracks.map(t => t.paramId)
  
  const touchesPhysical = paramIds.some(p => PHYSICAL_PARAMS.includes(p))
  const touchesColor = paramIds.some(p => COLOR_PARAMS.includes(p))
  const touchesMovement = paramIds.some(p => MOVEMENT_PARAMS.includes(p))
  const touchesOptics = paramIds.some(p => OPTICS_PARAMS.includes(p))
  
  const groupCount = [touchesPhysical, touchesColor, touchesMovement, touchesOptics]
    .filter(Boolean).length
  
  // Multi-grupo → composite
  if (groupCount > 1) return 'composite'
  
  // Mono-grupo → categoría específica
  if (touchesPhysical) return 'physical'
  if (touchesColor) return 'color'
  if (touchesMovement) return 'movement'
  if (touchesOptics) return 'optics'
  
  // Parámetros genéricos (speed, width, direction, globalComp) sin grupo específico
  return 'physical'
}

// ═══════════════════════════════════════════════════════════════════════════
// RE-EXPORTS — PhaseConfigPro is the single source of truth for phase types
// ═══════════════════════════════════════════════════════════════════════════

export type { FixturePhase } from './phase/PhaseConfigPro'
