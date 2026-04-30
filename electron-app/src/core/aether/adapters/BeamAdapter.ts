/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔦 AETHER MATRIX — BEAM ADAPTER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 3516.4: THE OPTIC BRIDGE
 *
 * RESPONSABILIDAD (SINGLE):
 * Conectar el FrameContext con nodos BEAM (moving heads con ópticas).
 * Traduce métricas de audio + estado musical → valores de zoom, focus,
 * gobo, gobo_rotation, prism, prism_rotation.
 *
 * SEGURIDAD MECÁNICA — MECHANICAL HOLD:
 * Las ruedas de gobo y prisma son mecanismos físicos que NO pueden
 * conmutar más rápido de lo que su motor permite. Un cambio de posición
 * antes de que el motor alcance destino produce parpadeo o daño.
 *
 *   GOBO_HOLD_MS  = 2000ms — Tiempo mínimo entre cambios de gobo
 *   PRISM_HOLD_MS = 1500ms — Tiempo mínimo entre cambios de prisma
 *
 * El hold se trackea con un Map<nodeId, lastChangeMs> pre-allocado.
 * En el hot-path NO se crea ningún objeto nuevo.
 *
 * LÓGICA DE ÓPTICAS (BlueMap Blueprint §3.3):
 *
 *   ZOOM: f(beamExpressiveness, section)
 *     - Drop     → haz cerrado máximo (tight beam, impacto máximo)
 *     - Build    → haz medio (anticipación)
 *     - Break    → wash abierto (ambiente)
 *     - Default  → modulado por beamExpressiveness
 *
 *   FOCUS: f(movementSpeed, energy)
 *     - Más movimiento + mayor energía → foco más suave (diffuso)
 *
 *   GOBO: f(sectionElapsedMs, beamExpressiveness)
 *     - Cambia de índice según elapsed si hay suficiente expressiveness
 *     - Respetando MECHANICAL_HOLD
 *
 *   PRISM: f(dropImminent, beamExpressiveness)
 *     - ON solo si dropImminent Y beamExpressiveness > 0.6
 *     - Respetando MECHANICAL_HOLD
 *
 *   GOBO_ROTATION / PRISM_ROTATION: continuos, sin hold
 *     - Velocidad modulada por beatPhase × energy
 *
 * ZERO-ALLOC @ 44Hz:
 * - _intentScratch: inyectado por BaseSystem, mutado in-place
 * - _goboHoldMs / _prismHoldMs: Map pre-allocado en constructor
 * - Variables locales primitivas — viven en stack
 *
 * @module core/aether/adapters/BeamAdapter
 * @version WAVE 3516.4 — OPTIC BRIDGE
 */

import { NodeFamily } from '../types'
import type { IBeamNodeData } from '../capability-node'
import type { INodeView } from '../node-graph'
import type { IIntentBus, INodeIntent } from '../intent-bus'
import { BaseSystem, type IAetherSystem, type FrameContext } from '../systems'

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const INTENT_PRIORITY = 10
const BEAM_SOURCE = 'beam-adapter'

/**
 * Tiempo mínimo (ms) entre cambios de posición de rueda de gobos.
 * Protege el motor físico. Blueprint §3.3: MECHANICAL_HOLD 2000ms.
 */
const GOBO_HOLD_MS = 2000

/**
 * Tiempo mínimo (ms) entre activación/desactivación de prismas.
 * Protege el motor físico. Blueprint §3.3: MECHANICAL_HOLD 1500ms.
 */
const PRISM_HOLD_MS = 1500

/**
 * Número total de gobos disponibles (índice 0-based circular).
 * Valor conservador: la mayoría de ruedas tienen 6-8 posiciones.
 */
const GOBO_COUNT = 6

/**
 * Threshold de beamExpressiveness por encima del cual se activa el prisma.
 */
const PRISM_EXPRESSIVENESS_THRESHOLD = 0.6

/**
 * Intervalo de rotación de sección para cambio de gobo (ms).
 * Cada N ms de la sección, el gobo puede avanzar una posición.
 */
const GOBO_SECTION_INTERVAL_MS = 8000

// ─────────────────────────────────────────────────────────────────────────────
// BEAM ADAPTER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Adapter para nodos BEAM (cabezas móviles con ópticas).
 * Genera intents de zoom, focus, gobo y prism respetando
 * los MECHANICAL_HOLD_TIME_MS de seguridad para motores físicos.
 *
 * WAVE 3516.4: THE OPTIC BRIDGE
 */
export class BeamAdapter extends BaseSystem<IBeamNodeData> implements IAetherSystem<IBeamNodeData> {

  readonly name   = 'BeamAdapter'
  readonly family = NodeFamily.BEAM
  readonly source: string = BEAM_SOURCE

  /**
   * Tracks del último cambio de gobo por nodo.
   * Pre-allocado vacío; se popula la primera vez que aparece cada nodeId.
   * NUNCA se crea un Map nuevo en el hot-path.
   */
  private readonly _goboLastChangeMs = new Map<string, number>()

  /**
   * Tracks del último cambio de prisma por nodo.
   * Mismo patrón que _goboLastChangeMs.
   */
  private readonly _prismLastChangeMs = new Map<string, number>()

  /**
   * Tracks del índice de gobo actual por nodo.
   * Pre-allocado para cero-alloc en el hot-path.
   */
  private readonly _currentGoboIndex = new Map<string, number>()

  /**
   * Estado del prisma (on/off) por nodo — para detectar cambios.
   */
  private readonly _prismActive = new Map<string, boolean>()

  constructor() {
    super()
    this._intentScratch.priority = INTENT_PRIORITY
    this._intentScratch.source   = BEAM_SOURCE
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HOT PATH — 44 Hz
  // ─────────────────────────────────────────────────────────────────────────

  process(
    view:    INodeView<IBeamNodeData>,
    context: FrameContext,
    bus:     IIntentBus,
  ): void {
    const { audio, musical, vibe, nowMs } = context
    const section              = musical.section
    const sectionElapsedMs     = musical.sectionElapsedMs
    const dropImminent         = musical.dropImminent
    const beamExpress          = vibe.beamExpressiveness
    const movementSpeed        = vibe.movementSpeed
    const energy               = audio.energy
    const beatPhase            = audio.beatPhase

    // ── Calcular valores de frame que son iguales para todos los nodos ──────

    // ZOOM: haz modulado por section y expressiveness
    //   Drop   → tight beam (0.10) — impacto máximo
    //   Build  → medio (0.45)      — anticipación
    //   Break  → wash (0.90)       — ambiente amplio
    //   Default → lineal por beamExpress invertido
    let targetZoom: number
    if (section === 'drop') {
      targetZoom = 0.10
    } else if (section === 'build') {
      targetZoom = 0.40 + (1 - beamExpress) * 0.15
    } else if (section === 'break' || section === 'outro') {
      targetZoom = 0.85
    } else {
      // Verse, intro, etc.: beamExpress alto = haz cerrado, chico = abierto
      targetZoom = BaseSystem.clamp01(0.30 + (1 - beamExpress) * 0.55)
    }

    // FOCUS: más movimiento + más energía → suaviza el foco (profundidad)
    //   focus=0 → sharp; focus=1 → soft (difuso)
    const targetFocus = BaseSystem.clamp01(movementSpeed * 0.4 + energy * 0.3)

    // GOBO_ROTATION: velocidad continua sincronizada con beatPhase
    //   Ciclo de 0→1 → 0 siguiendo el beat (no mecánico, sin hold)
    const goboRotation = BaseSystem.clamp01(beatPhase * beamExpress)

    // PRISM_ROTATION: más lento que gobo, modulado por energía
    const prismRotation = BaseSystem.clamp01((1 - beatPhase) * 0.6 * energy)

    // Decisión de prisma: ON si dropImminent Y beamExpress supera threshold
    const wantPrism = dropImminent && beamExpress >= PRISM_EXPRESSIVENESS_THRESHOLD

    // ── Iteración de nodos ────────────────────────────────────────────────
    view.forEach((node) => {
      const nodeId = node.nodeId

      // Inicializar estado de hold si el nodo es nuevo (primera aparición)
      if (!this._goboLastChangeMs.has(nodeId)) {
        this._goboLastChangeMs.set(nodeId, 0)
        this._currentGoboIndex.set(nodeId, 0)
      }
      if (!this._prismLastChangeMs.has(nodeId)) {
        this._prismLastChangeMs.set(nodeId, 0)
        this._prismActive.set(nodeId, false)
      }

      // ── ZOOM ──────────────────────────────────────────────────────────
      let zoom = targetZoom
      if (!node.hasZoom) zoom = 0  // No tiene canal zoom → 0

      // ── FOCUS ─────────────────────────────────────────────────────────
      let focus = targetFocus
      if (!node.hasFocus) focus = 0

      // ── GOBO — Mechanical Hold Guard ──────────────────────────────────
      let goboValue = 0
      if (node.hasGobo) {
        const lastGoboMs  = this._goboLastChangeMs.get(nodeId)!
        const goboHeld    = (nowMs - lastGoboMs) < GOBO_HOLD_MS
        const currentIdx  = this._currentGoboIndex.get(nodeId)!

        if (!goboHeld && beamExpress > 0.3) {
          // Calcular nuevo índice basado en sectionElapsedMs
          const newIdx = Math.floor(sectionElapsedMs / GOBO_SECTION_INTERVAL_MS) % GOBO_COUNT

          if (newIdx !== currentIdx) {
            // Cambio de gobo permitido — registrar tiempo
            this._goboLastChangeMs.set(nodeId, nowMs)
            this._currentGoboIndex.set(nodeId, newIdx)
            goboValue = newIdx / (GOBO_COUNT - 1)  // Normalizado 0-1
          } else {
            goboValue = currentIdx / (GOBO_COUNT - 1)
          }
        } else {
          // En hold o poca expressiveness — mantener índice actual
          goboValue = currentIdx / (GOBO_COUNT - 1)
        }
      }

      // ── PRISM — Mechanical Hold Guard ─────────────────────────────────
      let prismValue = 0
      if (node.hasPrism) {
        const lastPrismMs   = this._prismLastChangeMs.get(nodeId)!
        const prismHeld     = (nowMs - lastPrismMs) < PRISM_HOLD_MS
        const isPrismActive = this._prismActive.get(nodeId)!

        if (!prismHeld && wantPrism !== isPrismActive) {
          // Cambio de estado permitido — registrar tiempo
          this._prismLastChangeMs.set(nodeId, nowMs)
          this._prismActive.set(nodeId, wantPrism)
          prismValue = wantPrism ? 1.0 : 0.0
        } else {
          prismValue = isPrismActive ? 1.0 : 0.0
        }
      }

      // ── CONSTRUIR INTENT ───────────────────────────────────────────────
      this._intentScratch.nodeId = nodeId

      // Solo escribir los canales que el nodo declara tener
      if (node.hasZoom)          this._valuesDict['zoom']           = zoom
      if (node.hasFocus)         this._valuesDict['focus']          = focus
      if (node.hasGobo)          this._valuesDict['gobo']           = goboValue
      if (node.hasGoboRotation)  this._valuesDict['gobo_rotation']  = goboRotation
      if (node.hasPrism)         this._valuesDict['prism']          = prismValue
      if (node.hasPrismRotation) this._valuesDict['prism_rotation'] = prismRotation

      this._intentScratch.confidence = BaseSystem.clamp01(energy * beamExpress)
      bus.push(this._intentScratch as INodeIntent)
    })
  }
}
