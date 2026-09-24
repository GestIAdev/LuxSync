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
import type { SynthSpec } from '../compiler/synth/SynthSpec'

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

// ═══════════════════════════════════════════════════════════════════════════
// 🜨 WAVE 8192 — LAYER PAINT (CRUX_RESOLUTION §3.1)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * QUÉ pinta una capa — ortogonal a CÓMO la capa reparte tiempo/gain en
 * el espacio (geometría). En v1 esto era global del proyecto
 * (targetParams/targetColor/lutSource/defaultSynth); en v2 es por capa
 * con herencia de `project.defaultPaint`.
 */
export interface LayerPaint {
  /** Planos de salida que esta capa escribe (parámetros DMX). */
  readonly params: readonly HephParamId[]
  /** Color de la capa, '#rrggbb'. Solo relevante si params incluye 'color'. */
  readonly color?: string
  /** Opacidad en los planos de VALOR (color) — [0,1], default 1. */
  readonly opacity?: number
  /** Forma de onda local (Crux 3). undefined → defaultPaint.synth. */
  readonly synth?: SynthSpec
  /** Λ-Ride por capa (la curva de una pista Forge). undefined → synth. */
  readonly lut?: LutSource
}

/**
 * Mixin común a los 7 kinds (§3.1): pintura opcional por capa.
 * `undefined` = HEREDA `project.defaultPaint` (compatibilidad total —
 * los gestos persistidos en v1 no traen paint). Un paint parcial solo
 * sobrescribe los campos presentes: `effectivePaint(g) =
 * { ...project.defaultPaint, ...g.paint }`.
 */
export interface GestureCommon {
  readonly paint?: Partial<LayerPaint>
}

/**
 * BASE — el suelo del campo. Delay/gain uniforme para todo el rig
 * (o para la selección si se le aplicara máscara en el futuro).
 * Es la "capa fondo" — normalmente la primera de la pila.
 */
export interface BaseGesture extends GestureCommon {
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
export interface WaveGesture extends GestureCommon {
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
export interface ChronoGesture extends GestureCommon {
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
export interface GlyphGesture extends GestureCommon {
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
   * 🜨 WAVE 8183 (M2): invierte el bitmap — "texto negro sobre blanco".
   * La cobertura se niega DENTRO del rect del glifo (1 − cov antes del
   * threshold): las letras no reclaman nodos y el fondo del rect sí.
   * Fuera del rect sigue siendo 0 — la imagen invertida no inunda la
   * máscara entera. undefined = false (texto clásico luz-sobre-oscuridad).
   */
  readonly invert?: boolean
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
export interface SliceGesture extends GestureCommon {
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
export interface ManualGesture extends GestureCommon {
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
export interface NoiseGesture extends GestureCommon {
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
 *   - 'mcc-device' → WAVE 8186 (VÍA A del COHORT_FORENSIC_AUDIT):
 *               cohortes normales + aislamiento quirúrgico por
 *               `track.cell = nodeId` para las cohortes con
 *               COHORT_ZONE_SPILL — el adapter descarta por match
 *               exacto de nodeId, engañando al filtro de zonas sin
 *               tocar el runtime.
 */
export type CompileStrategy = 'auto' | 'lambda' | 'cohort' | 'mcc' | 'mcc-device'

/** Fuente de la curva-LUT que los tracks `ast_*` reutilizan (Λ-Ride). */
export type LutSource =
  | { kind: 'preset'; name: string }
  | { kind: 'ride'; trackId: string }

/**
 * El proyecto Asteria V2 — persiste en `clip.asteria` (D-4, embebido).
 * Extiende el envelope del core (`version` + `rigFingerprint`).
 *
 * 🜨 WAVE 8192 (Crux 2, §3.1): el TARGET dejó de ser global — params,
 * color, síntesis y fuente LUT son PINTURA (`defaultPaint` + override
 * por capa en `gesture.paint`). La herencia pasiva mantiene la paridad
 * hasta que el fieldEngine multi-plano aterrice (WAVE 8193).
 */
export interface AsteriaProject extends AsteriaProjectEnvelope {
  readonly version: 2
  /** La pila no destructiva — el modelo re-editable. */
  readonly stack: readonly Gesture[]
  readonly strategy: CompileStrategy
  /**
   * Pintura por defecto del documento — la heredan todas las capas sin
   * `paint` propio. Sustituye a los campos root v1 (targetParams,
   * targetColor, lutSource, defaultSynth).
   */
  readonly defaultPaint: LayerPaint
  /**
   * §2.5 — política de inundación del color estático cuando la ruta
   * zonal derramaría sobre fixtures ajenos: 'contain' reemite como
   * constantes quirúrgicas por nodo; 'allow' acepta el flood (paridad
   * V1 — los proyectos migrados la fijan siempre en 'allow').
   */
  readonly colorFlood: 'contain' | 'allow'
  /** K máximo de clases de color (median-cut OKLab en WAVE 8194). */
  readonly colorBudget: number
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

/**
 * 🜨 WAVE 8192 (§3.2): la forma persistida pre-v2 — entrada del
 * migrador. En v1 el TARGET era GLOBAL del proyecto (la causa del
 * Crux 2): un solo color/conjunto de params por documento entero.
 * Solo existe para tipar documentos viejos y fixtures — el código
 * nuevo jamás la construye.
 */
export interface AsteriaProjectV1 extends AsteriaProjectEnvelope {
  readonly version: 1
  readonly stack: readonly Gesture[]
  readonly strategy: CompileStrategy
  readonly targetParams: readonly HephParamId[]
  readonly targetColor?: string
  readonly lutSource: LutSource
  readonly defaultSynth?: SynthSpec
  readonly cohortBudget: number
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
/** Forma por defecto — el trapezoide Λ de siempre (byte-parity V1). */
export const ASTERIA_DEFAULT_SYNTH: SynthSpec = { shape: 'pulse' }
/**
 * 🜨 WAVE 8192 (§2.5/R1): política por defecto en proyectos NUEVOS —
 * 'contain' (un color estático jamás inunda fixtures ajenos). Los
 * proyectos migrados quedan en 'allow' para preservar la salida V1.
 */
export const ASTERIA_DEFAULT_COLOR_FLOOD: 'contain' | 'allow' = 'contain'
/** K máximo de clases de color (cuantización OKLab, WAVE 8194). */
export const ASTERIA_DEFAULT_COLOR_BUDGET = 16
/** El gesto suelo de todo proyecto nuevo: campo uniforme identidad. */
export const ASTERIA_BASE_GESTURE_ID = 'base'

/** La pintura por defecto de un documento nuevo (equivale al TARGET V1). */
export function createDefaultPaint(): LayerPaint {
  return {
    params: ASTERIA_DEFAULT_TARGET_PARAMS,
    color: ASTERIA_DEFAULT_TARGET_COLOR,
    synth: ASTERIA_DEFAULT_SYNTH,
  }
}

/**
 * 🜨 WAVE 8193 — pintura efectiva de un gesto: merge de `defaultPaint`
 * con el override parcial `g.paint` (undefined → herencia total, §3.1).
 * El fieldEngine la usa para enrutar el scratch a los planos del gesto;
 * el compilador para resolver la forma de onda del owner (§4.4).
 */
export function effectivePaint(
  project: AsteriaProject,
  g: Gesture,
): LayerPaint {
  return g.paint ? { ...project.defaultPaint, ...g.paint } : project.defaultPaint
}

/**
 * Proyecto nuevo: pila con un único gesto `base` (identidad — el campo
 * arranca plano y cada herramienta empuja capas encima). La huella del
 * rig se inyecta al crearlo (vacía si el atlas aún no ha llegado — el
 * store la sella en el primer `setNodeAtlas`).
 */
export function createDefaultProject(rigFingerprint = ''): AsteriaProject {
  return {
    version: 2,
    stack: [{ kind: 'base', id: ASTERIA_BASE_GESTURE_ID, delayMs: 0, gain: 1 }],
    strategy: ASTERIA_DEFAULT_STRATEGY,
    defaultPaint: createDefaultPaint(),
    colorFlood: ASTERIA_DEFAULT_COLOR_FLOOD,
    colorBudget: ASTERIA_DEFAULT_COLOR_BUDGET,
    cohortBudget: ASTERIA_DEFAULT_COHORT_BUDGET,
    rigFingerprint,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 🜨 WAVE 8192 — MIGRACIÓN v1 → v2 (§3.2: sin pérdidas, sin sorpresa)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Convierte un documento v1 al modelo v2: el TARGET global aterriza en
 * `defaultPaint` y `colorFlood` queda en 'allow' para que la compilación
 * del proyecto migrado sea byte a byte idéntica a la de v1 (gate G-MIG).
 * Ningún gesto recibe `paint` → todos heredan el default.
 *
 * Idempotente: un proyecto ya v2 se devuelve tal cual. No muta la
 * entrada. Los campos legacy ausentes caen a sus defaults históricos —
 * documentos pre-8120/8184/8191 siguen cargando.
 */
export function migrateV1toV2(
  p: AsteriaProjectV1 | AsteriaProject,
): AsteriaProject {
  if (p.version === 2) return p
  const { targetParams, targetColor, lutSource, defaultSynth, ...rest } = p
  return {
    ...rest,
    version: 2,
    defaultPaint: {
      params: targetParams ?? ASTERIA_DEFAULT_TARGET_PARAMS,
      color: targetColor ?? ASTERIA_DEFAULT_TARGET_COLOR,
      // 'preset' no se persiste en el paint: undefined = síntesis local
      lut: lutSource?.kind === 'ride' ? lutSource : undefined,
      synth: defaultSynth ?? ASTERIA_DEFAULT_SYNTH,
    },
    colorFlood: 'allow', // v1 no contenía → preservar salida idéntica
    colorBudget: ASTERIA_DEFAULT_COLOR_BUDGET,
  }
}
