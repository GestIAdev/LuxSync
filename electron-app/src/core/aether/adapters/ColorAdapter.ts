/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎨 AETHER MATRIX — COLOR ADAPTER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 3516.3: THE COLOR DECOUPLING — Extracción y Renombramiento
 *
 * RESPONSABILIDAD (SINGLE):
 * Conectar el LiquidEngineBase con nodos COLOR (wash LED, PARs tintados).
 * Traduce FrameContext → LiquidStereoInput → applyBands() → LiquidStereoResult
 * y distribuye las intensidades zonales moduladas por:
 *   - Posición espacial del nodo (falloff por distancia al epicentro)
 *   - Paleta de colors del vibe activo
 *   - Energía espectral del audio (blend entre primary/secondary)
 *
 * NO MANEJA dimmers, strobes, gobos — esos son responsabilidad de ImpactAdapter.
 * Este adapter es puro COLOR.
 *
 * ZERO-ALLOC @ 44Hz:
 * - _liquidInput: pre-allocado, campos sobrescritos in-place
 * - _rgbScratch: conversión HSL → RGB sin alloc
 * - _intentScratch: inyectado por BaseSystem
 * - Math.sqrt() es nativa del motor JS
 *
 * ARQUITECTURA:
 * - Cada zoneIntensity se mapea según position.x (left/right) y position.z (front/back, upstage/downstage).
 *   WAVE 3506.1.1: Y es altura (no zoning). Z es profundidad del escenario (eje de interés).
 * - RGB se obtiene de vibe.palette[0] (primary color)
 * - Brightness se modula por audio.energy × falloff × zoneIntensity
 * - Opcionalmente blendea con palette[1] según bass energy (groove → secondary)
 *
 * @module core/aether/adapters/ColorAdapter
 * @version WAVE 3516.3 — DECOUPLING
 */

import { NodeFamily } from '../types'
import type { IColorNodeData } from '../capability-node'
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

const INTENT_PRIORITY = 10
const COLOR_SOURCE = 'color-adapter'

/**
 * Radio máximo de influencia de la onda energética (metros).
 * Nodos más lejos reciben falloff = 0.
 * Calibrado para escenarios de club mediano (~10m de profundidad).
 */
const DEFAULT_MAX_RADIUS_M = 12.0

// ─────────────────────────────────────────────────────────────────────────────
// COLOR ADAPTER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Adapter para ColorNodes (wash LED, PARs con color).
 * Traduce el resultado zonal del LiquidEngine a intents RGB tintados
 * por la paleta del vibe activo, modulados por distancia al epicentro.
 *
 * WAVE 3516.3: Extraída de ImpactAdapter.ts como clase independiente.
 * Renombrada de LiquidColorAdapter → ColorAdapter para claridad.
 */
export class ColorAdapter extends BaseSystem<IColorNodeData> implements IAetherSystem<IColorNodeData> {

  readonly name   = 'ColorAdapter'
  readonly family = NodeFamily.COLOR
  readonly source: string = COLOR_SOURCE

  private readonly _engine: LiquidEngineBase
  private readonly _maxRadiusM: number
  private readonly _epicenter = { x: 0, y: 0, z: 0 }

  // Scratch de trabajo para conversión HSL → RGB
  private readonly _rgbScratch = { r: 0, g: 0, b: 0 }

  // LiquidStereoInput pre-allocado — cero alloc en hot-path.
  // Nota: En una arquitectura más sofisticada, ImpactAdapter y ColorAdapter
  // compartirían el resultado de applyBands() en lugar de llamarlo dos veces.
  // Por ahora cada uno es auto-contenido (SOLID — cero dependencia cruzada).
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

  setEpicenter(x: number, y: number, z: number): void {
    this._epicenter.x = x
    this._epicenter.y = y
    this._epicenter.z = z
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HOT-PATH — 44Hz
  // ─────────────────────────────────────────────────────────────────────────

  process(
    nodes: INodeView<IColorNodeData>,
    context: FrameContext,
    bus: IIntentBus,
  ): void {
    const { audio, musical, vibe } = context

    // ── 1. Build LiquidStereoInput in-place (cero alloc)
    const inp = this._liquidInput
    const b   = inp.bands

    b.subBass  = audio.subBass
    b.bass     = audio.bass
    b.lowMid   = audio.bass * 0.5
    b.mid      = audio.mid
    b.highMid  = audio.highMid
    b.treble   = audio.presence           // presence (4-8kHz) ≈ treble percusivo; WAVE 3516.1: rawTreble
    b.ultraAir = audio.air                // air (12-20kHz) = ultraAir del LiquidEngine; WAVE 3516.1: pure ultraAir

    inp.isRealSilence    = audio.energy < 0.01
    inp.isAGCTrap        = false
    inp.harshness        = audio.highMid
    inp.flatness         = 0
    inp.isKick           = audio.hasTransient && audio.bass > 0.5
    inp.sectionType      = musical.section !== 'unknown' ? musical.section : 'drop'
    inp.spectralCentroid = 0

    // ── 2. Motor real
    const result: LiquidStereoResult = this._engine.applyBands(inp)

    // ── 3. Color base desde la paleta del vibe (palette[0] = primary color)
    // VibeProfile.palette es ColorEntry[]. Cada ColorEntry tiene { h, s, l }.
    // Usamos palette[0] como tinte base. Si la paleta tiene 2+ entradas,
    // blendemos con palette[1] según la energía de la zona.
    const palette   = vibe.palette
    const primary   = palette[0]   // siempre existe (validado por VibeProfile)
    const secondary = palette.length > 1 ? palette[1] : primary

    // Blend entre primary y secondary según energía espectral (bass = groove)
    const blendT = BaseSystem.clamp01(audio.bass)
    const blendH = BaseSystem.lerp(primary.h, secondary.h, blendT)
    const blendS = BaseSystem.lerp(primary.s, secondary.s, blendT)
    const blendL = BaseSystem.lerp(primary.l, secondary.l, blendT)

    // Convertir HSL blended → RGB scratch (cero alloc — escribe en _rgbScratch)
    BaseSystem.hslToRgb(blendH, blendS, blendL, this._rgbScratch)
    const baseR = this._rgbScratch.r
    const baseG = this._rgbScratch.g
    const baseB = this._rgbScratch.b

    // ── 4. Preparar scratch invariante
    this._intentScratch.priority = INTENT_PRIORITY
    this._intentScratch.source   = COLOR_SOURCE

    const epiX     = this._epicenter.x
    const epiY     = this._epicenter.y
    const epiZ     = this._epicenter.z
    const maxR     = this._maxRadiusM
    const vibeGain = vibe.intensity

    // ── 5. Iterar nodos — color tintado por zona + distancia
    nodes.forEach((node, _index) => {

      // ── 5a. Distancia al epicentro de onda
      const px = node.position?.x ?? 0
      const py = node.position?.y ?? 0
      const pz = node.position?.z ?? 0

      const dx      = px - epiX
      const dy      = py - epiY
      const dz      = pz - epiZ
      const dist    = Math.sqrt(dx * dx + dy * dy + dz * dz)
      const falloff = BaseSystem.clamp01(1 - dist / maxR)

      // ── 5b. Intensidad zonal del LiquidEngine para la zona de este nodo
      //        WAVE 3506.1.1: X = left/right, Z = front/back (NOT Y)
      const zoneIntensity = selectZoneIntensityXZ(result, px, pz)

      // ── 5c. Brightness final = energía × falloff × zoneIntensity × vibe.intensity
      const brightness = BaseSystem.clamp01(audio.energy * falloff * zoneIntensity * vibeGain)

      // ── 5d. Aplicar brightness al color base (escala RGB sin cambiar el tinte)
      this._valuesDict['red']   = BaseSystem.clamp01(baseR * brightness)
      this._valuesDict['green'] = BaseSystem.clamp01(baseG * brightness)
      this._valuesDict['blue']  = BaseSystem.clamp01(baseB * brightness)

      this._intentScratch.confidence = BaseSystem.clamp01(audio.energy * falloff)
      this._intentScratch.nodeId     = node.nodeId
      bus.push(this._intentScratch as INodeIntent)
    })
  }
}


