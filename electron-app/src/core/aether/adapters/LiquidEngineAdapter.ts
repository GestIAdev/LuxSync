/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌊 AETHER MATRIX — LIQUID ENGINE ADAPTER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 3508: THE PHOTONIC BRIDGE — Fase 2 Acoplamiento de Motores
 *
 * RESPONSABILIDAD:
 * Conectar el LiquidEngineBase (LiquidEngine71/41 de hal/physics) con la
 * capa Aether. Traduce FrameContext → LiquidStereoInput → applyBands() →
 * LiquidStereoResult y distribuye las intensidades zonales como INodeIntent
 * a IMPACT nodes (dimmer) y COLOR nodes (rgb tintado por vibe.palette).
 *
 * EPICENTRO DE ONDA:
 * El LiquidEngine produce 6 intensidades zonales (frontL/R, backL/R, moverL/R).
 * Estas intensidades representan "energía física" en el escenario.
 * El adapter usa la posición 3D de cada nodo para calcular su cercanía al
 * epicentro y modular la intensidad final:
 *
 *   dist     = sqrt((node.x - epi.x)² + (node.y - epi.y)² + (node.z - epi.z)²)
 *   falloff  = clamp01(1 - dist / maxRadiusM)
 *   intensity = zoneIntensity * falloff * vibe.intensity
 *
 * Si el nodo no tiene posición registrada (SpatialRegistrar aún no ejecutado),
 * falloff = 1.0 — recibe la intensidad completa sin penalización espacial.
 *
 * MAPEO ZONAL → NODO:
 * La zona de un nodo se determina por su position.x (izq/der) y position.y
 * (frente/fondo). El adapter deriva la zona semánticamente:
 *
 *   position.y >= 0  && position.x >= 0  → frontRight / moverRight
 *   position.y >= 0  && position.x <  0  → frontLeft  / moverLeft
 *   position.y <  0  && position.x >= 0  → backRight
 *   position.y <  0  && position.x <  0  → backLeft
 *
 * Para IMPACT node: el valor de dimmer = computeBandMix × zoneIntensity × falloff
 * Para COLOR node:  el tinte viene de vibe.palette[0] escalado por zoneIntensity × falloff
 *
 * ZERO-ALLOC @ 44Hz:
 * - _liquidInput: objeto pre-allocado, campos sobrescritos in-place.
 * - _impactScratch + _impactValues: para ImpactNode intents.
 * - _colorScratch + _colorValues: para ColorNode intents.
 * - _rgbScratch: para conversión HSL → RGB sin alloc.
 * - Math.sqrt() es función nativa del motor JS — sin alloc.
 *
 * LAYOUT:
 * Por defecto usa liquidEngine71 (7.1). Se puede inyectar un engine
 * alternativo vía constructor para el layout 4.1 o telemetría.
 *
 * @module core/aether/adapters/LiquidEngineAdapter
 * @version WAVE 3508 — BLOOD & MUSCLE F2
 */

import { NodeFamily } from '../types'
import type { IImpactNodeData, IColorNodeData } from '../capability-node'
import type { INodeView } from '../node-graph'
import type { IIntentBus, INodeIntent } from '../intent-bus'
import { BaseSystem, type IAetherSystem, type FrameContext } from '../systems'
import { liquidEngine71 } from '../../../hal/physics/LiquidEngine71'
import type { LiquidEngineBase } from '../../../hal/physics/LiquidEngineBase'
import type { LiquidStereoInput, LiquidStereoResult } from '../../../hal/physics/LiquidStereoPhysics'

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Priority L0 — sistemas base de IA */
const INTENT_PRIORITY = 10

const IMPACT_SOURCE = 'liquid-adapter-impact'
const COLOR_SOURCE  = 'liquid-adapter-color'

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
export class LiquidImpactAdapter extends BaseSystem<IImpactNodeData> implements IAetherSystem<IImpactNodeData> {

  readonly name   = 'LiquidImpactAdapter'
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
    b.lowMid   = audio.lowMid
    b.mid      = audio.mid
    b.highMid  = audio.highMid
    b.treble   = audio.treble
    b.ultraAir = audio.ultraAir

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
      const zoneIntensity = selectZoneIntensity(result, px, py)

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

// ─────────────────────────────────────────────────────────────────────────────
// LIQUID ENGINE ADAPTER — COLOR NODES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Adapter para ColorNodes (wash LED, PARs con color).
 * Traduce el resultado zonal del LiquidEngine a intents RGB tintados
 * por la paleta del vibe activo, modulados por distancia al epicentro.
 */
export class LiquidColorAdapter extends BaseSystem<IColorNodeData> implements IAetherSystem<IColorNodeData> {

  readonly name   = 'LiquidColorAdapter'
  readonly family = NodeFamily.COLOR
  readonly source: string = COLOR_SOURCE

  private readonly _engine: LiquidEngineBase
  private readonly _maxRadiusM: number
  private readonly _epicenter = { x: 0, y: 0, z: 0 }

  // Scratch de trabajo para conversión HSL → RGB
  private readonly _rgbScratch = { r: 0, g: 0, b: 0 }

  // LiquidStereoInput compartido (se recalcula igual que en LiquidImpactAdapter).
  // En el flujo real del orquestador, ambos adapters procesan el mismo frame
  // en secuencia → applyBands() se llama dos veces por frame.
  // Solución arquitectónica limpia: el orquestador puede pasar el resultado
  // externamente via injectResult(). Por ahora cada adapter es auto-contenido
  // para mantener cero dependencia entre ellos (SOLID).
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

    // ── 1. Build LiquidStereoInput in-place
    const inp = this._liquidInput
    const b   = inp.bands

    b.subBass  = audio.subBass
    b.bass     = audio.bass
    b.lowMid   = audio.lowMid
    b.mid      = audio.mid
    b.highMid  = audio.highMid
    b.treble   = audio.treble
    b.ultraAir = audio.ultraAir

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
      const zoneIntensity = selectZoneIntensity(result, px, py)

      // ── 5c. Brightness final = energía × falloff × vibe.intensity
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

// ─────────────────────────────────────────────────────────────────────────────
// PURE HELPER — SELECCIÓN DE ZONA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Selecciona la intensidad zonal correcta del LiquidStereoResult
 * basándose en la posición física del nodo en el escenario.
 *
 * Convención de escenario (vista desde el público):
 *   +X = derecha del escenario, -X = izquierda
 *   +Y = frente (downstage), -Y = fondo (upstage)
 *
 * Esta función es pura, determinista y no aloca memoria.
 */
function selectZoneIntensity(
  result: LiquidStereoResult,
  nodeX: number,
  nodeY: number,
): number {
  const isRight   = nodeX >= 0
  const isFront   = nodeY >= 0
  const isMid     = Math.abs(nodeX) < 2.0  // ±2m del eje central = zona movers

  if (isMid) {
    // Movers / cabezas móviles — zona central
    return isRight ? result.moverRightIntensity : result.moverLeftIntensity
  }

  if (isFront) {
    // PARs frontales / wash front
    return isRight ? result.frontRightIntensity : result.frontLeftIntensity
  }

  // PARs traseros / wash back
  return isRight ? result.backRightIntensity : result.backLeftIntensity
}
