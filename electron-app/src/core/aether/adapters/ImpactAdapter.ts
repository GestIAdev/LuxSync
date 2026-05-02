/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 💥 AETHER MATRIX — IMPACT ADAPTER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 3508: THE PHOTONIC BRIDGE — Fase 2 Acoplamiento de Motores
 * WAVE 3516.3: COLOR DECOUPLING — Extracción de responsabilidades
 *
 * RESPONSABILIDAD (SINGLE):
 * Conectar el LiquidEngineBase (LiquidEngine71/41 de hal/physics) con la
 * capa Aether PARA NODOS IMPACT (dimmer, strobe, shutter, gobos).
 * Traduce FrameContext → LiquidStereoInput → applyBands() → LiquidStereoResult
 * y distribuye las intensidades zonales como INodeIntent a IMPACT nodes.
 *
 * NOTA: La lógica de COLOR nodes fue extraída a ColorAdapter.ts (WAVE 3516.3).
 * Este archivo SOLO maneja fixtures de impacto (iluminación base).
 *
 * EPICENTRO DE ONDA:
 * El LiquidEngine produce 6 intensidades zonales (frontL/R, backL/R, moverL/R).
 * El adapter usa la posición 3D de cada nodo para calcular su cercanía al
 * epicentro y modular la intensidad final:
 *
 *   dist     = sqrt((node.x - epi.x)² + (node.y - epi.y)² + (node.z - epi.z)²)
 *   falloff  = clamp01(1 - dist / maxRadiusM)
 *   intensity = zoneIntensity * falloff * vibe.intensity
 *
 * Si el nodo no tiene posición (SpatialRegistrar aún no ejecutado),
 * falloff = 1.0 — recibe intensidad completa sin penalización.
 *
 * MAPEO ZONAL → NODO:
 * La zona se determina por position.x (izq/der) y position.z (frente/fondo upstage/downstage).
 * WAVE 3506.1.1: Y es altura (no participapara zoning). Z es profundidad escenario (eje principal).
 *
 *   position.z >= 0  && position.x >= 0  → frontRight / moverRight (downstage, right)
 *   position.z >= 0  && position.x <  0  → frontLeft  / moverLeft (downstage, left)
 *   position.z <  0  && position.x >= 0  → backRight (upstage, right)
 *   position.z <  0  && position.x <  0  → backLeft (upstage, left)
 *
 * Para IMPACT node: dimmer = computeBandMix × zoneIntensity × falloff
 *
 * ZERO-ALLOC @ 44Hz:
 * - _liquidInput: pre-allocado, campos sobrescritos in-place
 * - Math.sqrt() es función nativa — sin alloc
 *
 * @module core/aether/adapters/ImpactAdapter
 * @version WAVE 3516.3 — SINGLE RESPONSIBILITY
 */

import { NodeFamily } from '../types'
import type { IImpactNodeData, IColorNodeData } from '../capability-node'
import type { INodeView } from '../node-graph'
import type { IIntentBus, INodeIntent } from '../intent-bus'
import { BaseSystem, type IAetherSystem, type FrameContext } from '../systems'
import { liquidEngine71 } from '../../../hal/physics/LiquidEngine71'
import type { LiquidEngineBase } from '../../../hal/physics/LiquidEngineBase'
import type { LiquidStereoInput, LiquidStereoResult } from '../../../hal/physics/LiquidStereoPhysics'
import { selectZoneIntensityXZ } from './zoneUtils'

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Priority L0 — sistemas base de IA */
const INTENT_PRIORITY = 10

const IMPACT_SOURCE = 'liquid-adapter-impact'

/**
 * Radio máximo de influencia de la onda energética (metros).
 * Nodos más lejos del epicentro que este radio reciben falloff = 0.
 * Valor calibrado para escenarios de club mediano (~10m de profundidad).
 */
const DEFAULT_MAX_RADIUS_M = 12.0

// ─────────────────────────────────────────────────────────────────────────────
// LIQUID ENGINE ADAPTER — IMPACT NODES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Adapter para ImpactNodes (dimmers/PAR/wash).
 * Escucha el LiquidEngine y traduce sus intensidades zonales a dimmer values
 * moduladas por la distancia espacial del nodo al epicentro de la onda.
 */
export class ImpactAdapter extends BaseSystem<IImpactNodeData> implements IAetherSystem<IImpactNodeData> {

  readonly name   = 'ImpactAdapter'
  readonly family = NodeFamily.IMPACT
  readonly source: string = IMPACT_SOURCE

  private readonly _engine: LiquidEngineBase
  private readonly _maxRadiusM: number

  /**
   * Epicentro de la onda energética en coordenadas de escenario (metros).
   * Por defecto al centro del stage (0,0,0).
   * Se puede actualizar en patch-time via setEpicenter() — nunca en el hot-path.
   */
  private readonly _epicenter = { x: 0, y: 0, z: 0 }

  // ── LiquidStereoInput pre-allocado — cero alloc en hot-path
  private readonly _liquidInput: LiquidStereoInput = {
    bands: {
      subBass:  0,
      bass:     0,
      lowMid:   0,
      mid:      0,
      highMid:  0,
      treble:   0,
      ultraAir: 0,
    },
    isRealSilence: false,
    isAGCTrap:     false,
  }

  constructor(engine?: LiquidEngineBase, maxRadiusM = DEFAULT_MAX_RADIUS_M) {
    super()
    this._engine     = engine ?? liquidEngine71
    this._maxRadiusM = maxRadiusM
  }

  /**
   * Actualiza la posición del epicentro de onda.
   * Llamar en patch-time o cuando Selene IA reacciona a un drop.
   * NUNCA llamar desde el hot-path.
   */
  setEpicenter(x: number, y: number, z: number): void {
    this._epicenter.x = x
    this._epicenter.y = y
    this._epicenter.z = z
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HOT-PATH — 44Hz
  // ─────────────────────────────────────────────────────────────────────────

  process(
    nodes: INodeView<IImpactNodeData>,
    context: FrameContext,
    bus: IIntentBus,
  ): void {
    const { audio, musical, vibe } = context

    // ── 1. Construir LiquidStereoInput in-place (cero alloc)
    const inp  = this._liquidInput
    const b    = inp.bands

    b.subBass  = audio.subBass
    b.bass     = audio.bass
    b.lowMid   = audio.bass * 0.5           // AudioMetrics no tiene lowMid directo
    b.mid      = audio.mid
    b.highMid  = audio.highMid
    b.treble   = audio.presence             // presence (4-8kHz) ≈ treble percusivo
    b.ultraAir = audio.air                  // air (12-20kHz) = ultraAir del LiquidEngine

    inp.isRealSilence    = audio.energy < 0.01
    inp.isAGCTrap        = false
    inp.harshness        = audio.highMid
    inp.flatness         = 0                // AudioMetrics no expone spectralFlatness → 0 neutro
    inp.isKick           = audio.hasTransient && audio.bass > 0.5
    inp.sectionType      = musical.section !== 'unknown' ? musical.section : 'drop'
    inp.spectralCentroid = 0                // no disponible en AudioMetrics base

    // ── 2. Ejecutar el motor real de física — ESTA ES LA ÚNICA LLAMADA AL ENGINE
    const result: LiquidStereoResult = this._engine.applyBands(inp)

    // ── 3. Preparar scratch invariante para este frame
    this._intentScratch.priority   = INTENT_PRIORITY
    this._intentScratch.source     = IMPACT_SOURCE

    const epiX = this._epicenter.x
    const epiY = this._epicenter.y
    const epiZ = this._epicenter.z
    const maxR = this._maxRadiusM
    const globalVibe = vibe.intensity

    // ── 4. Iterar nodos — distribuir intensidad por posición espacial
    nodes.forEach((node, _index) => {

      // ── 4a. Cálculo de distancia al epicentro de la onda energética
      //        (La fórmula que el blueprint exige que sea explícita)
      const px = node.position?.x ?? 0
      const py = node.position?.y ?? 0
      const pz = node.position?.z ?? 0

      const dx = px - epiX
      const dy = py - epiY
      const dz = pz - epiZ
      const dist    = Math.sqrt(dx * dx + dy * dy + dz * dz)
      const falloff = BaseSystem.clamp01(1 - dist / maxR)

      // ── 4b. Selección de zona por posición física del nodo
      //        El LiquidEngine produce intensidades zonales — elegimos la
      //        zona correcta según dónde está físicamente el fixture.
      //        WAVE 3506.1.1: X = left/right, Z = front/back (NOT Y)
      const zoneIntensity = selectZoneIntensityXZ(result, px, pz)

      // ── 4c. Intensidad final = bandmix × falloff × zoneIntensity × vibe.intensity
      //        computeBandMix: pondera las 7 bandas según el perfil del nodo.
      const bandEnergy    = BaseSystem.computeBandMix(audio, node.bandMix)
      const intentDimmer  = BaseSystem.clamp01(bandEnergy * falloff * zoneIntensity * globalVibe)

      this._intentScratch.confidence       = BaseSystem.clamp01(audio.energy * falloff)
      this._valuesDict['dimmer']           = intentDimmer

      this._intentScratch.nodeId = node.nodeId
      bus.push(this._intentScratch as INodeIntent)
    })
  }
}


