/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚡ AETHER MATRIX — KINETIC ADAPTER (CLASSIC PIPE)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 4632: SPLIT-BRAIN Fase 3 — VMM → L0 clásico
 *
 * RESPONSABILIDAD:
 * Sustituye al VMMAdapter y emite intención cinemática clásica directa:
 * `pan`, `tilt`, `speed` normalizados (0-1) al IntentBus L0.
 *
 * FILOSOFÍA:
 * En Split-Brain, el flujo automático (VMM) pertenece a la ruta clásica.
 * El flujo espacial (targetX/Y/Z) queda reservado para overrides manuales L2.
 *
 * MAPPING:
 * El VMM entrega `intent.x`/`intent.y` en [-1,+1]. Se mapean linealmente a
 * normalizados [0,1] para canales pan/tilt:
 *   pan  = (x + 1) / 2
 *   tilt = (y + 1) / 2
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
 * @version WAVE 4632 — CLASSIC PIPE
 */

import { NodeFamily } from '../types'
import type { IKineticNodeData } from '../capability-node'
import type { INodeView } from '../node-graph'
import type { IIntentBus, INodeIntent } from '../intent-bus'
import { BaseSystem, type IAetherSystem, type FrameContext } from '../systems'
import {
  VibeMovementManager,
  vibeMovementManager,
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
 * Emite exclusivamente canales clásicos `pan`, `tilt` y `speed`.
 * No genera ni inyecta targetX/Y/Z.
 */
export class KineticAdapter extends BaseSystem<IKineticNodeData> implements IAetherSystem<IKineticNodeData> {

  readonly name   = 'KineticAdapter'
  readonly family = NodeFamily.KINETIC
  readonly source: string = INTENT_SOURCE

  private readonly _vmm: VibeMovementManager = vibeMovementManager

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
      // Canales espaciales legacy se limpian explícitamente para evitar fugas.
      this._valuesDict['targetX'] = undefined as any
      this._valuesDict['targetY'] = undefined as any
      this._valuesDict['targetZ'] = undefined as any
      // Canales clásicos/continuos.
      this._valuesDict['pan']      = undefined as any
      this._valuesDict['tilt']     = undefined as any
      this._valuesDict['rotation'] = undefined as any
      this._valuesDict['speed']    = undefined as any

      // ── 4b. Obtener intención 2D del VMM para este nodo ───────────────
      // 🎭 WAVE 4645: Left/Right phase asymmetry
      // Fixtures on the right side (x > 0) get π phase offset for counterpoint motion
      const phaseOffset = (node.physicalPosition?.x ?? 0) > 0 ? Math.PI : 0

      const intent = this._vmm.generateIntent(
        vibeId,
        va,
        node.stereoIndex,
        node.stereoTotal,
        node.maxPanSpeed,
        phaseOffset,
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
        // ── FLUJO CLÁSICO SPLIT-BRAIN: VMM → pan/tilt normalizados ──────
        this._valuesDict['pan']     = BaseSystem.clamp01((intent.x + 1) * 0.5)
        this._valuesDict['tilt']    = BaseSystem.clamp01((intent.y + 1) * 0.5)
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
