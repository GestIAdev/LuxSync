/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚡ AETHER MATRIX — VMM ADAPTER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 3508: THE KINETIC BRIDGE — Fase 2 Acoplamiento de Motores
 *
 * RESPONSABILIDAD:
 * Wrappear el VibeMovementManager (motor real de movimiento) y traducir
 * su salida abstracta (-1,+1) en INodeIntent de pan/tilt (0-1) para
 * todos los KINETIC_NODEs en el IntentBus.
 *
 * FILOSOFÍA:
 * El VMM sabe de vibes, fases y BPM. El Aether sabe de nodos y canales.
 * Este adapter es el traductor — no tiene lógica propia de movimiento.
 * Solo transforma tipos y normaliza coordenadas.
 *
 * ESTEREO:
 * Los nodos con position.x < 0 (lado izquierdo físico) espejean el pan.
 * Compatible con todos los stereoTypes del VMM (mirror/snake/sync).
 * El VMM ya maneja el desfase de fase vía stereoIndex — el adapter
 * solo aporta la inversión de espejo para la geometría espacial.
 *
 * ZERO-ALLOC GARANTIZADO @ 44Hz:
 * - _vmmAudio: puente pre-allocado, campos sobrescritos in-place cada frame.
 * - _intentScratch + _valuesDict: heredados de BaseSystem — nunca new.
 * - VMM.generateIntent() devuelve nuevo objeto cada llamada → los campos se
 *   copian a variables locales del stack. Sin retener referencias.
 *
 * VIBES → VMM ID:
 * context.vibe.name se mapea a vibeId del VMM via VIBE_ID_MAP estático.
 * Si el nombre no está en el mapa, se usa 'techno-club' como fallback seguro.
 *
 * @module core/aether/adapters/VMMAdapter
 * @version WAVE 3508 — BLOOD & MUSCLE F2
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

/** Priority L0 — sistemas base de IA */
const INTENT_PRIORITY = 10

/** Fuente identificable para debug y arbitraje */
const INTENT_SOURCE = 'vmm-adapter'

/**
 * Mapa de VibeProfile.name → VMM vibeId.
 * El VMM reconoce estos IDs en su diccionario de patrones y perfiles.
 * Si se añade un nuevo vibe al sistema, se actualiza este mapa — nunca el adapter.
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
// VMM ADAPTER
// ─────────────────────────────────────────────────────────────────────────────

export class VMMAdapter extends BaseSystem<IKineticNodeData> implements IAetherSystem<IKineticNodeData> {

  readonly name   = 'VMMAdapter'
  readonly family = NodeFamily.KINETIC
  readonly source: string = INTENT_SOURCE

  // El único VMM — creado en construcción, vive toda la vida del adapter
  private readonly _vmm: VibeMovementManager

  // Puente pre-allocado: se sobrescriben campos in-place en el hot-path.
  // Nunca se crea un nuevo objeto dentro de process().
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
    const { audio, musical, vibe } = context

    // ── 1. Resolver vibeId → VMM vibeId (lookup O(1), sin alloc)
    const vibeId = VIBE_ID_MAP[vibe.name] ?? FALLBACK_VIBE_ID

    // ── 2. Actualizar puente de audio in-place (cero alloc)
    const va = this._vmmAudio
    va.energy    = audio.energy
    va.bass      = audio.bass
    va.mids      = audio.mid        // AudioMetrics.mid → vmmAudio.mids
    va.highs     = audio.highMid    // AudioMetrics.highMid ≈ vmmAudio.highs
    va.bpm       = audio.bpm
    va.beatPhase = audio.beatPhase
    va.beatCount = audio.beatCount ?? 0

    // ── 3. Preparar scratch de intent (fuente y prioridad invariantes)
    this._intentScratch.priority   = INTENT_PRIORITY
    this._intentScratch.confidence = BaseSystem.clamp01(audio.energy * 0.8 + 0.2)
    this._intentScratch.source     = INTENT_SOURCE

    // ── 4. Iterar nodos (forEach es zero-alloc — no crea array)
    nodes.forEach((node, _index) => {
      // ── 4a. Limpiar valores stale del nodo anterior (zero-alloc)
      this._valuesDict['rotation'] = undefined as any
      this._valuesDict['pan']       = undefined as any
      this._valuesDict['tilt']      = undefined as any
      this._valuesDict['speed']     = undefined as any

      // Obtener intent del VMM para este nodo
      const intent = this._vmm.generateIntent(
        vibeId,
        va,
        node.stereoIndex,
        node.stereoTotal,
        node.maxPanSpeed,
      )

      if (node.isContinuous) {
        // ── Rotación continua (fan, pétalo): el eje X del VMM mapea a rotation ──
        let rotation = (intent.x + 1) * 0.5  // -1..+1 → 0..1 (0.5 = stop)

        if ((node.position?.x ?? 0) < 0) {
          rotation = 1 - rotation  // espejo para simetría
        }

        this._valuesDict['rotation'] = BaseSystem.clamp01(rotation)
        this._valuesDict['speed']    = BaseSystem.clamp01(intent.speed)
      } else {
        // ── Mover estándar (pan/tilt posicionado) ────────────────────────────
        let pan  = (intent.x + 1) * 0.5
        let tilt = (intent.y + 1) * 0.5

        if ((node.position?.x ?? 0) < 0) {
          pan = 1 - pan
        }

        this._valuesDict['pan']  = BaseSystem.clamp01(pan)
        this._valuesDict['tilt'] = BaseSystem.clamp01(tilt)
        this._valuesDict['speed'] = BaseSystem.clamp01(intent.speed)
      }

      // Escribir al bus (IntentBus copia los valores — seguro reutilizar scratch)
      this._intentScratch.nodeId = node.nodeId
      bus.push(this._intentScratch as INodeIntent)
    })
  }
}
