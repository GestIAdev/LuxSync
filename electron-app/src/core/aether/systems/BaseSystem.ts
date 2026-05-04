/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚛️  AETHER MATRIX — BASE SYSTEM CONTRACT & AUDIO CONTEXT TYPES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 3505.3: El contrato y los tipos de contexto que todos los Systems
 * deben implementar.
 *
 * FILOSOFÍA:
 * Un System en nuestra arquitectura ECS es pura lógica de transformación:
 * recibe datos del mundo (audio, vibe, estado) y produce NodeIntents.
 * No guarda estado persistente de business logic — si necesita trackear
 * algo entre frames (ej. un envolvente), ese estado vive en el nodo mismo
 * (pre-allocated en ICapabilityNode.state o en los campos mutable del nodo).
 *
 * CONTRATO DEL FRAME LOOP (44 Hz):
 * ```
 * 1. Orchestrator llama  system.process(view, context, bus)
 * 2. System itera        view.forEach((node) => { ... })
 * 3. System escribe      bus.push(intent)  ← zero-alloc
 * 4. Orchestrator pasa   el bus al NodeArbiter
 * ```
 *
 * ZERO-ALLOC OBLIGATORIO:
 * El método `process()` no puede crear objetos en el heap.
 * Las subclases deben pre-alocar toda estructura en el constructor.
 *
 * @module core/aether/systems/BaseSystem
 * @version WAVE 3505.3
 */

import type { IIntentBus, INodeIntent } from '../intent-bus'
import type { INodeView } from '../node-graph'
import type { ICapabilityNode, AnyNodeData } from '../capability-node'
import type { BandMixWeights, NodeFamily } from '../types'

// ═══════════════════════════════════════════════════════════════════════════
// AUDIO METRICS — Energía del frame actual del DSP
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Métricas de audio del frame actual.
 *
 * Producidas por el pipeline DSP (GodEar) y pasadas a los Systems
 * en cada ciclo de 44 Hz. Todos los valores están normalizados (0-1).
 *
 * Este objeto es readonly — los Systems no pueden mutarlo.
 * Se re-usa entre frames (sin allocations): el DSP actualiza
 * los campos in-place.
 */
export interface AudioMetrics {
  // ── Bandas de frecuencia (0-1 normalizado) ───────────────────────────
  /** Sub-bass (20-60 Hz) — el tesoro del kick drum, el subsónico */
  subBass: number
  /** Bass (60-250 Hz) — el bajo fundamental */
  bass: number
  /** Mid (250 Hz - 2 kHz) — el cuerpo armónico */
  mid: number
  /** High-mid (2-6 kHz) — presencia, ataque, claridad */
  highMid: number
  /** Presence (6-12 kHz) — brillo, mordida, sibilancia */
  presence: number
  /** Air (12-20 kHz) — el éter, el shimmer */
  air: number

  // ── Métricas globales ─────────────────────────────────────────────────
  /** Energía RMS global (0-1) */
  energy: number
  /** ¿Hay transiente detectado en este frame? (onset detection) */
  hasTransient: boolean
  /** Fuerza del transiente (0-1). 0 si no hay transiente. */
  transientStrength: number
  /** BPM actual detectado por el beat tracker (0 si no detectado) */
  bpm: number
  /** Fase del beat (0-1 dentro del beat actual) */
  beatPhase: number
  /** Número de beats desde el inicio de la sesión (para sincronía larga) */
  beatCount: number
}

// ═══════════════════════════════════════════════════════════════════════════
// VIBE PROFILE — La intención creativa del momento
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Configuración del Vibe activo.
 *
 * Define la "personalidad" reactiva del show: cómo responde cada
 * familia de nodos a los distintos estímulos de audio.
 * Configurada por el operador, no por el audio en tiempo real.
 *
 * Los Systems leen este objeto para ajustar sus algoritmos:
 * ImpactSystem usa `bandMatrixOverride`; ColorSystem usa `palette`.
 */
export interface VibeProfile {
  /** Nombre del vibe activo (e.g. "Techno Oscuro", "Chill Ambiental") */
  name: string

  /**
   * Overrides de la Matriz de Bandas × Roles para el ImpactSystem.
   * Si null, el ImpactSystem usa los pesos por defecto del Blueprint.
   * Las claves son NodeRole; los valores son BandMixWeights parciales.
   */
  bandMatrixOverride?: Readonly<Record<string, Partial<BandMixWeights>>>

  /**
   * Paleta de colores activa (6 colores HSL para el ColorSystem).
   * Índices: 0 = primary, 1 = secondary, 2-5 = accent variants.
   */
  palette: ColorEntry[]

  /**
   * Velocidad base del VMM para el KineticSystem (0-1).
   * 0 = movimiento mínimo; 1 = movimiento máximo permitido.
   */
  movementSpeed: number

  /**
   * Intensidad base del Vibe (0-1).
   * Escala global que multiplica la energía de audio.
   * Techno = 1.0; Lounge = 0.3.
   */
  intensity: number

  /**
   * Factor de agresividad de efectos de beam (0-1).
   * 0 = solo valores base (zoom/focus conservador);
   * 1 = Selene IA máxima expresividad (gobos, prismas, transiciones).
   */
  beamExpressiveness: number
}

/**
 * Entrada de color en la paleta del Vibe.
 * Valores normalizados (0-1) para H, S, L.
 */
export interface ColorEntry {
  h: number  // Hue (0-1 wrapping)
  s: number  // Saturation (0-1)
  l: number  // Lightness (0-1)
}

// ═══════════════════════════════════════════════════════════════════════════
// MUSICAL CONTEXT — Estado musical de alto nivel
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Contexto musical de alto nivel del frame actual.
 *
 * Información procesada por GodEar que va más allá de las métricas
 * brutas: en qué sección de la canción estamos, si hay drop inminente,
 * cuál es el "mood" percibido.
 *
 * Producida por el análisis de Selene IA y/o reglas heurísticas
 * del pipeline de audio.
 */
export interface MusicalContext {
  /** Sección musical actual */
  section: 'intro' | 'verse' | 'build' | 'drop' | 'break' | 'outro' | 'unknown'
  /** ¿Hay un drop inminente en los próximos N frames? */
  dropImminent: boolean
  /** Intensidad percibida de la sección (0-1) */
  sectionIntensity: number
  /** Nivel de tensión armónica (0-1) — chord tension, disonancia */
  harmonicTension: number
  /** Tiempo desde el inicio de la sección actual (ms) */
  sectionElapsedMs: number
}

// ═══════════════════════════════════════════════════════════════════════════
// FRAME CONTEXT — Contexto completo de un frame para los Systems
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Contexto completo del frame actual.
 *
 * Pasado a cada System en su método `process()`.
 * Contiene todo lo que un System puede necesitar para tomar
 * decisiones sin acceder a estado global.
 *
 * Este objeto es READONLY desde la perspectiva de los Systems.
 * El Orchestrator lo construye y mantiene.
 *
 * ZERO-ALLOC: este objeto se construye una vez y se reutiliza
 * en cada frame actualizando sus campos mutables internamente.
 */
export interface FrameContext {
  /** Métricas de audio del frame actual (del DSP) */
  audio: AudioMetrics
  /** Contexto musical de alto nivel (de Selene IA / heurísticas) */
  musical: MusicalContext
  /** Perfil del Vibe activo */
  vibe: VibeProfile
  /** Límites espaciales activos del Crystal Box (metros). */
  stageBounds?: {
    width: number
    height: number
    depth: number
    centerY: number
  }
  /** Timestamp del frame actual (ms desde epoch) */
  nowMs: number
  /** Delta de tiempo desde el frame anterior (ms) — para physics */
  deltaMs: number
  /** Número de frame (contador global desde inicio de sesión) */
  frameIndex: number
}

// ═══════════════════════════════════════════════════════════════════════════
// IAETHER SYSTEM — El contrato base de todo System
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🧠 IAetherSystem — Contrato base que todo System debe implementar.
 *
 * Un System en la arquitectura ECS de Aether es la lógica pura
 * que transforma el estado del mundo (audio + vibe + nodos) en
 * NodeIntents. Es el cerebro de su dominio: ImpactSystem sabe de
 * física de intensidad; ColorSystem sabe de cromática; etc.
 *
 * INVARIANTES:
 * - `process()` no crea objetos en el heap (zero-alloc).
 * - `process()` escribe directamente en el `bus` — no retorna arrays.
 * - El estado inter-frame vive en los nodos, no en el System.
 * - Un System no sabe qué fixture o hardware recibirá sus intents.
 *
 * @typeParam T — El tipo de datos de nodo que este System procesa.
 */
export interface IAetherSystem<T extends ICapabilityNode> {
  /**
   * El nombre identificativo del System (para logging y telemetría).
   */
  readonly name: string

  /**
   * La familia de nodo que este System procesa.
   */
  readonly family: NodeFamily

  /**
   * 🔥 El Hot Path — se llama 44 veces por segundo.
   *
   * Itera sobre la vista de nodos asignada, calcula los valores
   * de canal para cada nodo según el contexto, y escribe los
   * intents resultantes en el bus.
   *
   * OBLIGATORIO ZERO-ALLOC:
   * - No usar `new`, literales de objeto `{}`, o literales de array `[]`.
   * - No llamar a métodos que retornen nuevos objetos sin pre-allocar.
   * - Las variables locales de tipo primitivo están permitidas
   *   (viven en el stack, no en el heap).
   *
   * @param view    — Vista tipada de los nodos de esta familia
   * @param context — Contexto del frame (audio + musical + vibe)
   * @param bus     — El IntentBus donde escribir los NodeIntents
   */
  process(
    view: INodeView<T>,
    context: FrameContext,
    bus: IIntentBus,
  ): void
}

// ═══════════════════════════════════════════════════════════════════════════
// BASE SYSTEM — Clase abstracta con utilidades compartidas
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Clase base abstracta para los Systems de Aether.
 *
 * Proporciona:
 * - Un intent pre-allocated reutilizable (zero-alloc hot path).
 * - Métodos de curva de transferencia como funciones puras estáticas.
 * - Helpers de mezcla de bandas de audio.
 * - Logging de telemetría sin overhead en producción.
 *
 * Los Systems concretos heredan de esta clase e implementan `process()`.
 *
 * PATRÓN DE USO:
 * ```ts
 * class MySystem extends BaseSystem<IImpactNodeData> implements IAetherSystem<IImpactNodeData> {
 *   process(view, context, bus) {
 *     view.forEach((node) => {
 *       // Reutiliza this._intentScratch — zero-alloc
 *       this._intentScratch.nodeId  = node.nodeId
 *       this._intentScratch.values['dimmer'] = computedValue
 *       bus.push(this._intentScratch as INodeIntent)
 *     })
 *   }
 * }
 * ```
 */
export abstract class BaseSystem<T extends ICapabilityNode> {

  abstract readonly name: string
  abstract readonly family: NodeFamily

  // ── Pre-allocated scratch objects ──────────────────────────────────────
  //
  // Estos objetos se reutilizan en CADA push al bus.
  // Solo un intent puede estar "en vuelo" a la vez porque bus.push()
  // copia los valores antes de retornar. Nunca guardar una referencia
  // a _intentScratch fuera del callback del forEach.

  /**
   * Objeto de intent reutilizable. Mutado in-place en cada iteración.
   * NUNCA almacenar una referencia externa a este objeto.
   */
  protected readonly _intentScratch: {
    nodeId: string
    values: Record<string, number>
    priority: number
    confidence: number
    source: string
  }

  /**
   * Pre-allocated values dict del scratch intent.
   * Referencia al mismo objeto que _intentScratch.values para
   * acceso directo sin navegación de objetos.
   */
  protected readonly _valuesDict: Record<string, number>

  constructor() {
    // Pre-allocar el objeto de values separado primero
    this._valuesDict = {}
    this._intentScratch = {
      nodeId: '',
      values: this._valuesDict,
      priority: 0,
      confidence: 1.0,
      source: '',
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // TRANSFER CURVES — Funciones puras, sin alloación
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Curva lineal: `output = input`.
   * Para valores donde la proporcionalidad directa tiene sentido (posición).
   */
  protected static applyLinear(input: number): number {
    return input < 0 ? 0 : input > 1 ? 1 : input
  }

  /**
   * Curva exponencial: `output = input ^ exponent`.
   * El "Snappy Attack" para dimmers de percusión.
   * Exponent 2.5 default = casi nada hasta 0.7, luego latigazo brutal.
   *
   * Con noiseGate: todo input < noiseGate → output = 0. Silencio absoluto.
   */
  protected static applyExponential(input: number, exponent: number = 2.5, noiseGate: number = 0): number {
    if (input < noiseGate) return 0
    const clamped = input < 0 ? 0 : input > 1 ? 1 : input
    return Math.pow(clamped, exponent)
  }

  /**
   * Curva logarítmica: `output = log(1 + input * 9) / log(10)`.
   * Respuesta orgánica y suave para breath/ambient.
   * Sube rápido al principio, luego se va aplanando.
   */
  protected static applyLogarithmic(input: number): number {
    const clamped = input < 0 ? 0 : input > 1 ? 1 : input
    return Math.log(1 + clamped * 9) / Math.LN10
  }

  /**
   * Curva S (Hermite cubic): `output = 3t² - 2t³`.
   * Arranque y final suaves. Ideal para fades cinematográficos.
   */
  protected static applySCurve(input: number): number {
    const t = input < 0 ? 0 : input > 1 ? 1 : input
    return t * t * (3 - 2 * t)
  }

  /**
   * Curva gamma: `output = input ^ (1 / gamma)`.
   * Corrección perceptual del ojo humano. Gamma 2.2 = estándar sRGB.
   */
  protected static applyGamma(input: number, gamma: number = 2.2): number {
    const clamped = input < 0 ? 0 : input > 1 ? 1 : input
    return Math.pow(clamped, 1 / gamma)
  }

  // ═══════════════════════════════════════════════════════════════════════
  // BAND MIX — Mezcla ponderada de bandas de audio
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Calcula la energía mezclada para un nodo según sus BandMixWeights
   * y las métricas de audio del frame actual.
   *
   * Resultado normalizado: la suma de (banda * peso) no se normaliza
   * por la suma de pesos — el diseñador elige los pesos consciente de
   * que valores > 1 son posibles, y el clamp final lo gestiona.
   *
   * @returns Energía mezclada, clamped a [0, 1].
   */
  protected static computeBandMix(audio: AudioMetrics, weights: BandMixWeights): number {
    const raw =
      audio.subBass  * weights.subBass  +
      audio.bass     * weights.bass     +
      audio.mid      * weights.mid      +
      audio.highMid  * weights.highMid  +
      audio.presence * weights.presence +
      audio.air      * weights.air      +
      audio.energy   * weights.energy

    return raw < 0 ? 0 : raw > 1 ? 1 : raw
  }

  /**
   * Clamp rápido a [0, 1]. Función inline para el hot path.
   */
  protected static clamp01(v: number): number {
    return v < 0 ? 0 : v > 1 ? 1 : v
  }

  /**
   * Interpolación lineal entre a y b.
   */
  protected static lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t
  }

  /**
   * Convierte HSL (0-1 cada uno) a RGB (0-1 cada uno).
   * Función pura, sin alloc. Escribe directamente en el target.
   */
  protected static hslToRgb(
    h: number, s: number, l: number,
    out: { r: number; g: number; b: number },
  ): void {
    if (s === 0) {
      out.r = l; out.g = l; out.b = l
      return
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    out.r = BaseSystem._hueToRgb(p, q, h + 1/3)
    out.g = BaseSystem._hueToRgb(p, q, h)
    out.b = BaseSystem._hueToRgb(p, q, h - 1/3)
  }

  private static _hueToRgb(p: number, q: number, t: number): number {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1/6) return p + (q - p) * 6 * t
    if (t < 1/2) return q
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
    return p
  }
}
