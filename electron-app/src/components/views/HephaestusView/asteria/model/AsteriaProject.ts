/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 ASTERIA PROJECT — WAVE 8030-P1: EL GESTURE STACK (MODELO)
 *
 * Tipos canónicos del modelo no destructivo de Asteria — blueprint §5.2
 * verbatim. La pila de gestos es LA RECETA: cada herramienta empuja un
 * Gesture paramétrico, y el fieldEngine evalúa la pila a un campo escalar
 * por nodo { delayMs, gain } que el compilador hornea en tracks `ast_*`.
 *
 * NADA se rasteriza al hacer el gesto — el stack es re-editable,
 * reordenable y paramétrico. Es el "Photoshop de capas" del rig.
 *
 * Layering: `clip.asteria` (core/hephaestus/types.ts) es el ENVELOPE
 * persistido — `version` + `rigFingerprint` son el contrato mínimo del
 * `.lfx`. Este modelo extiende ese envelope con el contenido completo.
 * Core jamás interpreta los gestos (payload opaco — §5.3).
 *
 * @module HephaestusView/asteria/model/AsteriaProject
 * @version WAVE 8030-P1
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { AsteriaProject as AsteriaProjectEnvelope } from '../../../../../core/hephaestus/types'
import type { HephParamId } from '../../../../../core/hephaestus/types'

// ═══════════════════════════════════════════════════════════════════════════
// BLEND & CHANNEL
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Operación de mezcla del gesto sobre el campo acumulado.
 * 'replace' pisa · 'min'/'max' recortan · 'add'/'mul' componen.
 */
export type BlendOp = 'replace' | 'min' | 'max' | 'add' | 'mul'

/** Canal del campo que el gesto escribe. */
export type FieldChannel = 'delay' | 'gain' | 'both'

// ═══════════════════════════════════════════════════════════════════════════
// MASK
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Selección: lista de NodeIds REALES del atlas.
 * NUNCA índices — el atlas cambia al re-patchar (blueprint §5.2).
 */
export interface NodeMask {
  readonly nodeIds: readonly string[]
}

// ═══════════════════════════════════════════════════════════════════════════
// GESTURES — unión discriminada por `kind`
// ═══════════════════════════════════════════════════════════════════════════

/** Punto del mundo en METROS, convención Crystal Box (plano XZ). */
export interface WorldPoint2D {
  readonly x: number
  readonly z: number
}

/**
 * BASE — el suelo del campo. Delay/gain uniforme para todo el rig
 * (o para la selección si se le aplicara máscara en el futuro).
 * Es la "capa fondo" — normalmente la primera de la pila.
 */
export interface BaseGesture {
  readonly kind: 'base'
  readonly id: string
  readonly delayMs: number
  readonly gain: number
}

/**
 * WAVE — frente de onda radial desde un emisor. delay = distancia / speed.
 * `shape`: 'point' (punto), 'line' (frente direccional), 'ring'.
 * `huygens`: multi-emisor — el delay usa min(dist) a cualquier emisor.
 */
export interface WaveGesture {
  readonly kind: 'wave'
  readonly id: string
  readonly mask: NodeMask
  readonly op: BlendOp
  /** Emisor en METROS. */
  readonly emitter: WorldPoint2D
  readonly shape: 'point' | 'line' | 'ring'
  /** Dirección del frente para shape 'line' (grados). */
  readonly dirDeg?: number
  /** Velocidad del frente en m/s — delay = dist / speedMps · 1000. */
  readonly speedMps: number
  /** Atenúa gain con la distancia al emisor. */
  readonly falloffM?: number
  /** Multi-emisor Huygens → delay = min(dist a cualquier emisor). */
  readonly huygens?: readonly WorldPoint2D[]
  /**
   * 🜨 WAVE 8181: gain de capa — si definido, el gesto también escribe
   * gain en los nodos cubiertos (con falloffM lo multiplica). undefined
   * = solo delay, el gain de capas previas queda intacto.
   */
  readonly gain?: number
}

/**
 * CHRONO — pincel cronológico. El trazo crudo con tiempo real: cada punto
 * guarda (x, z, tMs) — el tempo del arrastre ES la coreografía.
 * `captureRealTime` = true usa el tempo capturado; false lo aplana.
 */
export interface ChronoGesture {
  readonly kind: 'chrono'
  readonly id: string
  readonly mask: NodeMask
  readonly op: BlendOp
  /** Trazo crudo con tiempo — { x, z } en metros, tMs relativo al inicio. */
  readonly stroke: readonly { x: number; z: number; tMs: number }[]
  /** true = usa el tempo real del arrastre; false = distribución uniforme. */
  readonly captureRealTime: boolean
  /** Ancho del pincel en metros. */
  readonly radiusM: number
  /**
   * 🜨 WAVE 8181 (post-proceso §T3): escala temporal del trazo —
   * multiplica el delay resultante (2.0 = chase el doble de lento,
   * 0.5 = comprimido al 50 %). undefined = 1 (tempo capturado).
   */
  readonly timeScale?: number
  /**
   * 🜨 WAVE 8181: invierte el sentido del trazo — el último punto
   * pintado dispara primero (delay = totalMs − tMs).
   */
  readonly invert?: boolean
  /**
   * 🜨 WAVE 8181: gain de capa — si definido, el gesto también estampa
   * gain uniforme en los nodos cubiertos. undefined = solo delay.
   */
  readonly gain?: number
}

/**
 * GLYPH — texto o forma vectorial estampada en el campo espacial.
 * La imagen se rasteriza al campo: los nodos bajo el trazo reciben
 * delay/gain según la cobertura del glifo.
 */
export interface GlyphGesture {
  readonly kind: 'glyph'
  readonly id: string
  readonly mask: NodeMask
  readonly op: BlendOp
  readonly text?: string
  readonly svgPath?: string
  readonly transform: {
    readonly x: number
    readonly z: number
    readonly scaleM: number
    readonly rotDeg: number
  }
  readonly channel: FieldChannel
  readonly threshold?: number
  readonly antialias: boolean
  /**
   * 🜨 WAVE 8181: multiplicador de la cobertura en el canal gain
   * (intensidad del texto estampado). undefined = 1. Solo afecta al
   * canal 'gain' — con channel 'delay' el glifo barre y no estampa.
   */
  readonly gain?: number
}

/**
 * SLICE — rebanado del rig por un eje en cubos discretos con delay
 * escalonado. `axis` incluye 'dmx' y 'zone' (orden de patch / etiqueta).
 * `shuffleSeed` usa el MISMO hash que PhaseConfigPro → paridad con el
 * spread del Phase Canvas (blueprint §7.5).
 */
export interface SliceGesture {
  readonly kind: 'slice'
  readonly id: string
  readonly mask: NodeMask
  readonly op: BlendOp
  readonly axis: 'x' | 'z' | 'radius' | 'angle' | 'dmx' | 'zone'
  readonly buckets: number
  readonly spanMs: number
  readonly symmetry: 'linear' | 'mirror' | 'center-out'
  readonly shuffleSeed?: number
  /**
   * 🜨 WAVE 8181: gain de capa — si definido, el gesto también estampa
   * gain uniforme en los nodos cubiertos. undefined = solo delay.
   */
  readonly gain?: number
}

/**
 * MANUAL — escape hatch: valores directos por nodo. El único gesto O(N)
 * — se cuenta en el HUD de presupuesto del `.lfx` (§5.3). Sin mask ni op:
 * las entries SON el campo.
 */
export interface ManualGesture {
  readonly kind: 'manual'
  readonly id: string
  readonly entries: readonly { nodeId: string; delayMs?: number; gain?: number }[]
  /**
   * 🜨 WAVE 8181: multiplicador maestro sobre el gain de las entries
   * (entry sin gain propio recibe este valor). undefined = 1.
   */
  readonly gain?: number
}

/**
 * NOISE — ruido Perlin muestreado en la posición de cada nodo.
 * Rompe la simetría perfecta — "orgánico" en vez de "mecánico".
 */
export interface NoiseGesture {
  readonly kind: 'noise'
  readonly id: string
  readonly mask: NodeMask
  readonly op: BlendOp
  readonly seed: number
  readonly scaleM: number
  readonly amountMs: number
  readonly octaves: 1 | 2 | 3
  /**
   * 🜨 WAVE 8181: gain de capa — si definido, el gesto también estampa
   * gain uniforme en los nodos cubiertos. undefined = solo delay.
   */
  readonly gain?: number
}

/** La unión discriminada del stack — 7 kinds. */
export type Gesture =
  | BaseGesture
  | WaveGesture
  | ChronoGesture
  | GlyphGesture
  | SliceGesture
  | ManualGesture
  | NoiseGesture

export type GestureKind = Gesture['kind']

// ═══════════════════════════════════════════════════════════════════════════
// PROJECT — el documento Asteria persistido en clip.asteria
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Estrategia de compilación del campo a tracks:
 *   - 'auto'   → el compilador elige (λ si cabe, cohort si no)
 *   - 'lambda' → Vía Λ: una pista-LUT + phaseOverrides (§3)
 *   - 'cohort' → cuantización en K cohortes de delay (presupuesto HUD)
 *   - 'mcc'    → Máscaras de Curva Celular (§4 — independencia por celda)
 */
export type CompileStrategy = 'auto' | 'lambda' | 'cohort' | 'mcc'

/** Fuente de la curva-LUT que los tracks `ast_*` reutilizan (Λ-Ride). */
export type LutSource =
  | { kind: 'preset'; name: string }
  | { kind: 'ride'; trackId: string }

/**
 * El proyecto Asteria — persiste en `clip.asteria` (D-4, embebido).
 * Extiende el envelope del core (`version` + `rigFingerprint`).
 */
export interface AsteriaProject extends AsteriaProjectEnvelope {
  /** La pila no destructiva — el modelo re-editable. */
  readonly stack: readonly Gesture[]
  readonly strategy: CompileStrategy
  /** A qué parámetros Heph aplica el campo (dimmer, r/g/b, pan, tilt…). */
  readonly targetParams: readonly HephParamId[]
  /**
   * 🌈 WAVE 8120 (M1): color elegido por el operador para el canal
   * 'color' — HEX '#rrggbb'. El sintetizador lo convierte en un pulso
   * monocromático (H/S constantes, L en forma de pulso). Opcional:
   * proyectos persistidos antes del 8120 no lo traen — el compilador
   * cae a ASTERIA_DEFAULT_TARGET_COLOR.
   */
  readonly targetColor?: string
  readonly lutSource: LutSource
  /** K máximo de cohortes para strategy 'cohort' (default 16). */
  readonly cohortBudget: number
  /**
   * 🜨 WAVE 8050 (M3): posiciones XZ selladas al crear el documento —
   * sin ellas el remapeo por proximidad post-Rig Drift no sabría dónde
   * ESTABA un nodo perdido. Opcional (proyectos viejos no la traen —
   * esos nodos se reportan `unmappable`).
   */
  readonly nodePositions?: Readonly<Record<string, { readonly x: number; readonly z: number }>>
}

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULTS
// ═══════════════════════════════════════════════════════════════════════════

export const ASTERIA_DEFAULT_COHORT_BUDGET = 16
export const ASTERIA_DEFAULT_STRATEGY: CompileStrategy = 'auto'
/** El campo se aplica por defecto al dimmer — el parámetro universal del rig. */
export const ASTERIA_DEFAULT_TARGET_PARAMS: readonly HephParamId[] = ['intensity']
/** Color por defecto del canal 'color' — rojo puro (HEX '#rrggbb'). */
export const ASTERIA_DEFAULT_TARGET_COLOR = '#ff0000'
export const ASTERIA_DEFAULT_LUT_SOURCE: LutSource = { kind: 'preset', name: 'default' }
/** El gesto suelo de todo proyecto nuevo: campo uniforme identidad. */
export const ASTERIA_BASE_GESTURE_ID = 'base'

/**
 * Proyecto nuevo: pila con un único gesto `base` (identidad — el campo
 * arranca plano y cada herramienta empuja capas encima). La huella del
 * rig se inyecta al crearlo (vacía si el atlas aún no ha llegado — el
 * store la sella en el primer `setNodeAtlas`).
 */
export function createDefaultProject(rigFingerprint = ''): AsteriaProject {
  return {
    version: 1,
    stack: [{ kind: 'base', id: ASTERIA_BASE_GESTURE_ID, delayMs: 0, gain: 1 }],
    strategy: ASTERIA_DEFAULT_STRATEGY,
    targetParams: ASTERIA_DEFAULT_TARGET_PARAMS,
    targetColor: ASTERIA_DEFAULT_TARGET_COLOR,
    lutSource: ASTERIA_DEFAULT_LUT_SOURCE,
    cohortBudget: ASTERIA_DEFAULT_COHORT_BUDGET,
    rigFingerprint,
  }
}
