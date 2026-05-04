/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚡ AETHER MATRIX — KINETIC ADAPTER (HOLOGRAPHIC PROJECTION)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 4523.4: THE HOLOGRAPHIC ADAPTER — Fase A
 *
 * RESPONSABILIDAD:
 * Sustituye al VMMAdapter. En lugar de emitir canales abstractos `pan`/`tilt`
 * (0-1), proyecta la salida del VibeMovementManager en un plano virtual 3D y
 * emite canales espaciales `targetX`, `targetY`, `targetZ` en metros.
 *
 * FILOSOFÍA:
 * Aether ya no piensa en "pan/tilt normalizados". Piensa en puntos del espacio
 * real. La traducción a ángulos físicos (DMX) ocurre exclusivamente en el
 * NodeResolver via IKEngine (WAVE 4523.5+).
 *
 * PROYECCIÓN HOLOGRÁFICA:
 * El VMM produce coordenadas abstractas (x,y) ∈ [-1,+1] sobre un plano
 * normalizado. Este adapter las mapea linealmente al Crystal Box activo
 * del StageConstructor (inyectado en FrameContext.stageBounds):
 *
 *   TargetX = x × (width  / 2)                  (metros, eje horizontal)
 *   TargetY = centerY + y × (height / 2)        (metros, eje vertical)
 *   TargetZ = depth / 2                          (metros, plano frontal)
 *
 * Los targets se clampean siempre a los límites físicos del escenario.
 *
 * ESTEREO:
 * El VMM ya aplica mirror/snake/phase vía stereoIndex. Este adapter NO invierte
 * ningún eje — la geometría estéreo emerge del VMM directamente en los valores
 * (x,y) que ya vienen por-nodo. La proyección holográfica es puramente lineal.
 *
 * NODOS CONTINUOS (fan, mirror ball):
 * Para `isContinuous === true`, el IK no aplica (no hay un "target 3D" para
 * rotación continua). Este adapter emite `rotation` + `speed` en canal
 * normalizado (flujo legacy) para que el NodeResolver los trate directamente.
 *
 * ZERO-ALLOC GARANTIZADO @ 44Hz:
 * - `_vmmAudio`: puente pre-allocado, mutado in-place.
 * - `_intentScratch` + `_valuesDict`: heredados de BaseSystem.
 * - La proyección holográfica usa solo aritmética de stack.
 *
 * @module core/aether/adapters/KineticAdapter
 * @version WAVE 4523.4 — THE HOLOGRAPHIC ADAPTER
 */

import { NodeFamily } from '../types'
import type { IKineticNodeData } from '../capability-node'
import type { INodeView } from '../node-graph'
import type { IIntentBus, INodeIntent } from '../intent-bus'
import { BaseSystem, type IAetherSystem, type FrameContext } from '../systems'
import {
  VibeMovementManager,
  type AudioContext as VmmAudioContext,
} from '../../../engine/movement/VibeMovementManager'

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Priority L0 — coreografía automática IA */
const INTENT_PRIORITY = 10

/** Fuente identificable para debug y arbitraje */
const INTENT_SOURCE = 'kinetic-adapter'

/**
 * Fallback determinista si aún no llega stageBounds por IPC.
 * Se usa solo como red de seguridad de arranque.
 */
const DEFAULT_STAGE_BOUNDS = {
  width: 8.0,
  height: 4.0,
  depth: 2.0,
  centerY: 1.5,
} as const

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : (value > max ? max : value)
}

/**
 * Mapa de VibeProfile.name → VMM vibeId.
 * Inmutable para garantizar lookup O(1) sin alloc en el hot-path.
 */
const VIBE_ID_MAP: Readonly<Record<string, string>> = {
  'techno-club':    'techno-club',
  'techno':         'techno-club',
  'electro':        'techno-club',
  'fiesta-latina':  'fiesta-latina',
  'latino':         'fiesta-latina',
  'salsa':          'fiesta-latina',
  'reggaeton':      'fiesta-latina',
  'pop-rock':       'pop-rock',
  'rock':           'pop-rock',
  'pop':            'pop-rock',
  'chill-lounge':   'chill-lounge',
  'chill':          'chill-lounge',
  'lounge':         'chill-lounge',
  'ambient':        'chill-lounge',
  'jazz':           'chill-lounge',
  'idle':           'idle',
} as const

const FALLBACK_VIBE_ID = 'techno-club'

// ─────────────────────────────────────────────────────────────────────────────
// KINETIC ADAPTER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Adapter L0 (priority=10) para nodos KINETIC.
 *
 * Reemplaza al VMMAdapter de WAVE 3508. En lugar de emitir `pan`/`tilt`
 * normalizados, proyecta la salida del VMM al plano virtual 3D y emite
 * `targetX`, `targetY`, `targetZ` en metros.
 *
 * El NodeArbiter trata estos canales con política LTP (última prioridad
 * más alta gana), exactamente igual que cualquier otro canal del bus.
 * El NodeResolver (WAVE 4523.5+) intercepta los canales espaciales y
 * los desvía al IKEngine para obtener pan/tilt DMX por fixture.
 */
export class KineticAdapter extends BaseSystem<IKineticNodeData> implements IAetherSystem<IKineticNodeData> {

  readonly name   = 'KineticAdapter'
  readonly family = NodeFamily.KINETIC
  readonly source: string = INTENT_SOURCE

  private readonly _vmm: VibeMovementManager

  /**
   * Puente de audio pre-allocado.
   * Sus campos se sobrescriben in-place en el hot-path — nunca se crea
   * un nuevo objeto dentro de process().
   */
  private readonly _vmmAudio: VmmAudioContext = {
    energy:    0,
    bass:      0,
    mids:      0,
    highs:     0,
    bpm:       120,
    beatPhase: 0,
    beatCount: 0,
  }

  constructor() {
    super()
    this._vmm = new VibeMovementManager()
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HOT-PATH — 44Hz
  // ─────────────────────────────────────────────────────────────────────────

  process(
    nodes: INodeView<IKineticNodeData>,
    context: FrameContext,
    bus: IIntentBus,
  ): void {
    const { audio, vibe } = context
    const stageBounds = context.stageBounds ?? DEFAULT_STAGE_BOUNDS

    const width   = stageBounds.width  > 0 ? stageBounds.width  : DEFAULT_STAGE_BOUNDS.width
    const height  = stageBounds.height > 0 ? stageBounds.height : DEFAULT_STAGE_BOUNDS.height
    const depth   = stageBounds.depth  > 0 ? stageBounds.depth  : DEFAULT_STAGE_BOUNDS.depth
    const centerY = Number.isFinite(stageBounds.centerY)
      ? clamp(stageBounds.centerY, 0, height)
      : height * 0.5

    const halfW = width * 0.5
    const halfH = height * 0.5
    const halfD = depth * 0.5

    // ── 1. Resolver vibeId → VMM vibeId (lookup O(1), sin alloc)
    const vibeId = VIBE_ID_MAP[vibe.name] ?? FALLBACK_VIBE_ID

    // ── 2. Actualizar puente de audio in-place (cero alloc)
    const va = this._vmmAudio
    va.energy    = audio.energy
    va.bass      = audio.bass
    va.mids      = audio.mid
    va.highs     = audio.highMid
    va.bpm       = audio.bpm
    va.beatPhase = audio.beatPhase
    va.beatCount = audio.beatCount ?? 0

    // ── 3. Preparar scratch de intent (campos invariantes al frame)
    this._intentScratch.priority   = INTENT_PRIORITY
    this._intentScratch.confidence = BaseSystem.clamp01(audio.energy * 0.8 + 0.2)
    this._intentScratch.source     = INTENT_SOURCE

    // ── 4. Iterar nodos KINETIC (forEach es zero-alloc)
    nodes.forEach((node, _index) => {

      // ── 4a. Limpiar slots del scratch del nodo anterior ────────────────
      // Solo los canales que este adapter puede escribir.
      // Canales espaciales (flujo IK):
      this._valuesDict['targetX'] = undefined as any
      this._valuesDict['targetY'] = undefined as any
      this._valuesDict['targetZ'] = undefined as any
      // Canales legacy (flujo continuo):
      this._valuesDict['rotation'] = undefined as any
      this._valuesDict['speed']    = undefined as any

      // ── 4b. Obtener intención 2D del VMM para este nodo ───────────────
      const intent = this._vmm.generateIntent(
        vibeId,
        va,
        node.stereoIndex,
        node.stereoTotal,
        node.maxPanSpeed,
      )

      if (node.isContinuous) {
        // ── FLUJO LEGACY: rotación continua (fan, mirror ball) ──────────
        // El IK no aplica a rotación continua. Seguimos emitiendo canales
        // normalizados que el NodeResolver trata directamente.
        let rotation = (intent.x + 1) * 0.5   // [-1,+1] → [0,1]  (0.5 = stop)

        // El espejeo para nodos continuos se aplica en X de posición física
        if ((node.physicalPosition?.x ?? 0) < 0) {
          rotation = 1 - rotation
        }

        this._valuesDict['rotation'] = BaseSystem.clamp01(rotation)
        this._valuesDict['speed']    = BaseSystem.clamp01(intent.speed)

      } else {
        // ── FLUJO IK: proyección holográfica → canales espaciales ───────
        //
        // El VMM ya aplica mirror/snake/phase vía stereoIndex.
        // Solo necesitamos la proyección lineal al plano virtual.
        //
        //   TargetX = x × (width / 2)
        //   TargetY = centerY + y × (height / 2)
        //   TargetZ = depth / 2  (plano frontal)
        //
        // Nota de signo en Y: el VMM emite y > 0 como "arriba" y y < 0
        // como "abajo" (perspectiva de pantalla). El IK usa Y positivo
        // hacia arriba (eje mundo estándar). La proyección es directa.

        const projectedX = intent.x * halfW
        const projectedY = centerY + intent.y * halfH
        const projectedZ = halfD

        const targetX = clamp(projectedX, -halfW, halfW)
        const targetY = clamp(projectedY, 0, height)
        const targetZ = clamp(projectedZ, -halfD, halfD)

        this._valuesDict['targetX'] = targetX
        this._valuesDict['targetY'] = targetY
        this._valuesDict['targetZ'] = targetZ
        this._valuesDict['speed']   = BaseSystem.clamp01(intent.speed)
      }

      // ── 4c. Push al bus (IntentBus copia los valores — seguro reutilizar scratch)
      this._intentScratch.nodeId = node.nodeId
      bus.push(this._intentScratch as INodeIntent)
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BACKWARD COMPATIBILITY ALIAS
// El TitanOrchestrator referencia esta clase por nombre 'VMMAdapter' en
// todos los commits anteriores a WAVE 4523.4. Exportamos el alias para
// que no haya que tocar el orchestrator en este wave.
// ─────────────────────────────────────────────────────────────────────────────

/** @deprecated Usa KineticAdapter directamente. Este alias se elimina en WAVE 4525. */
export const VMMAdapter = KineticAdapter
