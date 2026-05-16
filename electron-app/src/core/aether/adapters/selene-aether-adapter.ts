/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧠 WAVE 4524.3 — SELENE-AETHER ADAPTER (L3 COGNITIVE BRIDGE)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Traductor entre el mundo cognitivo de Selene (efectos nominales + zonas
 * canónicas) y el mundo atómico de Aether (intenciones de canal por nodo).
 *
 * PIPELINE:
 *   CombinedEffectOutput + ConsciousnessOutput
 *     → Disassembler (campos semánticos → canales DMX normalizados 0-1)
 *       → ZoneNodeRouter (zona canónica → NodeId[])
 *         → IIntentBus.push() con priority=300, source='effect'
 *
 * REGLAS ABSOLUTAS:
 *   ❌ NUNCA emite targetX/Y/Z, pan, tilt (L3 bloqueado de movimiento)
 *   ✅ CERO new en hot-path (scratch objects pre-allocated)
 *   ✅ priority = 300 (L3 Effects range: 300-399)
 *   ✅ source = 'effect'
 *
 * SCRATCH OBJECTS:
 *   El blueprint especifica 3 familias de scratch: IMPACT, COLOR, STROBE.
 *   Cada uno tiene su propio dict de values para shapes de V8 estables.
 *   Se mutan in-place; bus.push() los captura antes de retornar.
 *
 * @module core/aether/adapters/selene-aether-adapter
 * @version WAVE 4524.3
 */

import type { IIntentBus, INodeIntent } from '../intent-bus'
import type { IZoneNodeRouter } from './helpers/zone-node-router'
import { NodeFamily } from '../types'
import type { MergeStrategy } from '../types'
import type { CombinedEffectOutput } from '../../effects/types'
import type { ConsciousnessOutput } from '../../protocol/ConsciousnessOutput'
import type { EffectZone } from '../../effects/types'
import type { NodeId } from '../types'

// 🌊 WAVE 4832: Traducción blendMode (per-zone) → mergeStrategy (per-intent).
// 'max'     → 'HTP'  (efecto blando que tinta sin matar el brillo de L0)
// 'replace' → 'LTP'  (efecto tirano que domina la capa)
// undefined → 'LTP'  (default seguro retrocompatible)
function blendModeToMergeStrategy(
  blendMode: 'replace' | 'max' | undefined,
): MergeStrategy {
  return blendMode === 'max' ? 'HTP' : 'LTP'
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTES L3
// ═══════════════════════════════════════════════════════════════════════════

/** Prioridad L3: Effects (300-399) — domina sobre L0 (10) y L1 (100) */
const L3_PRIORITY = 300

/** Fuente de todos los intents emitidos por este adapter */
const L3_SOURCE = 'effect' as const

/**
 * Composición mínima para procesar el frame.
 * Por debajo de este umbral, el efecto es invisible — early return.
 */
const MIN_GLOBAL_COMPOSITION = 0.01

/**
 * Energía máxima para físicas de modifier.
 * Por encima de 0.85, el Energy Override tiene VETO TOTAL (WAVE 450).
 */
const MAX_ENERGY_FOR_PHYSICS_MOD = 0.85

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Conversión HSL → RGB (inline, zero-alloc)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Clamp de 0 a 1 — inline, sin función extra.
 */
function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

/**
 * Convierte HSL (h: 0-360, s: 0-100, l: 0-100) a RGB normalizado (0-1).
 *
 * Algoritmo estándar de 6 zonas, completamente inline.
 * Zero-alloc: escribe directamente en el objeto destino pasado por referencia.
 */
function hslToRgbInto(
  h: number,
  s: number,
  l: number,
  out: { r: number; g: number; b: number },
): void {
  const sn = s / 100
  const ln = l / 100

  const c = (1 - Math.abs(2 * ln - 1)) * sn
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = ln - c / 2

  const hi = Math.floor(h / 60) % 6

  let r = 0
  let g = 0
  let b = 0

  if (hi === 0) { r = c; g = x; b = 0 }
  else if (hi === 1) { r = x; g = c; b = 0 }
  else if (hi === 2) { r = 0; g = c; b = x }
  else if (hi === 3) { r = 0; g = x; b = c }
  else if (hi === 4) { r = x; g = 0; b = c }
  else              { r = c; g = 0; b = x }

  out.r = clamp01(r + m)
  out.g = clamp01(g + m)
  out.b = clamp01(b + m)
}

/** Buffer temporal para conversiones HSL→RGB (reutilizado, zero-alloc) */
const _rgbBuffer = { r: 0, g: 0, b: 0 }

type ColorInput = {
  h?: number
  s?: number
  l?: number
  isHSL?: boolean
  red?: number
  green?: number
  blue?: number
  r?: number
  g?: number
  b?: number
}

function isHslColor(color: ColorInput): color is { h: number; s: number; l: number } {
  return color.isHSL === true || (
    typeof color.h === 'number' &&
    typeof color.s === 'number' &&
    typeof color.l === 'number'
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// SELENE AETHER ADAPTER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Adapter L3: traduce CombinedEffectOutput + ConsciousnessOutput
 * en intents atómicos hacia el IntentBus.
 *
 * NO extiende BaseSystem porque no tiene un INodeView propio —
 * trabaja con múltiples familias a través del ZoneNodeRouter.
 *
 * Sigue el mismo patrón de scratch de BaseSystem: objetos mutables
 * pre-allocated, cast a INodeIntent solo en el push().
 */
export class SeleneAetherAdapter {

  private readonly _zoneRouter: IZoneNodeRouter

  /** 🏎️ WAVE 4831: DarkSpin bypass flag para este frame */
  private _skipDarkSpin = false

  /** 🔬 WAVE 4832 DIAG: firma de zonas previamente loggeada (anti-spam). */
  private _lastDiagSignature = ''

  /** 🔬 WAVE 4832 DIAG: contador anti-spam para values trace (1 cada 60 frames con valor). */
  private _diagFrameCount = 0

  // ── Scratch objects pre-allocated (ver §5.4 del blueprint) ─────────────

  /** Scratch para canales IMPACT (dimmer) */
  private readonly _impactValues: Record<string, number> = { dimmer: 0 }
  private readonly _impactScratch: {
    nodeId: NodeId
    values: Record<string, number>
    priority: number
    confidence: number
    source: typeof L3_SOURCE
    skipDarkSpin: boolean
    mergeStrategy: MergeStrategy
  } = {
    nodeId: '' as NodeId,
    values: null as unknown as Record<string, number>,
    priority: L3_PRIORITY,
    confidence: 1.0,
    source: L3_SOURCE,
    skipDarkSpin: false,
    mergeStrategy: 'LTP',
  }

  /** Scratch para canales COLOR (aliases duales rgb + red/green/blue + white/amber) */
  private readonly _colorValues: Record<string, number> = {
    r: 0,
    g: 0,
    b: 0,
    red: 0,
    green: 0,
    blue: 0,
    white: 0,
    amber: 0,
  }
  private readonly _colorScratch: {
    nodeId: NodeId
    values: Record<string, number>
    priority: number
    confidence: number
    source: typeof L3_SOURCE
    skipDarkSpin: boolean
    mergeStrategy: MergeStrategy
  } = {
    nodeId: '' as NodeId,
    values: null as unknown as Record<string, number>,
    priority: L3_PRIORITY,
    confidence: 1.0,
    source: L3_SOURCE,
    skipDarkSpin: false,
    mergeStrategy: 'LTP',
  }

  /** Scratch para canales STROBE (strobeRate, shutter) */
  private readonly _strobeValues: Record<string, number> = { strobeRate: 0, shutter: 0 }
  private readonly _strobeScratch: {
    nodeId: NodeId
    values: Record<string, number>
    priority: number
    confidence: number
    source: typeof L3_SOURCE
    skipDarkSpin: boolean
    mergeStrategy: MergeStrategy
  } = {
    nodeId: '' as NodeId,
    values: null as unknown as Record<string, number>,
    priority: L3_PRIORITY,
    confidence: 1.0,
    source: L3_SOURCE,
    skipDarkSpin: false,
    mergeStrategy: 'LTP',
  }

  constructor(zoneRouter: IZoneNodeRouter) {
    this._zoneRouter = zoneRouter

    // Cablear values al scratch — un único wiring en construcción
    this._impactScratch.values = this._impactValues
    this._colorScratch.values  = this._colorValues
    this._strobeScratch.values = this._strobeValues
  }

  // ═════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Ingesta por frame. Traduce el output cognitivo de Selene y los efectos
   * activos en intents L3 atómicos que se empujan al IntentBus.
   *
   * ZERO-ALLOC: usa scratch objects pre-allocated sin ningún `new`.
   * BLOQUEO DE MOVIMIENTO: nunca emite targetX/Y/Z ni pan/tilt.
   *
   * @param consciousness - Output del DecisionMaker (null = no-op en physics)
   * @param effectOutput  - Output combinado del EffectManager singleton
   * @param deltaMs       - Delta time del frame (no usado en esta versión)
   * @param bus           - IntentBus donde empujar los intents L3
   */
  ingest(
    consciousness: ConsciousnessOutput | null,
    effectOutput: CombinedEffectOutput,
    _deltaMs: number,
    bus: IIntentBus,
  ): void {
    // ── Gate 1: Sin efectos activos → no-op ──────────────────────────────
    if (!effectOutput.hasActiveEffects) {
      return
    }

    // ── Gate 2: Composición global mínima ────────────────────────────────
    // Si globalComposition no viene (effects legacy), asumimos opacidad total
    // para no silenciar color/zoneOverrides válidos.
    const composition = effectOutput.globalComposition ?? 1
    if (
      effectOutput.globalComposition !== undefined &&
      composition < MIN_GLOBAL_COMPOSITION
    ) {
      return
    }

    // 🏎️ WAVE 4831: DarkSpin bypass flag para este frame
    this._skipDarkSpin = effectOutput.skipDarkSpin === true

    // ── Fase 1: Overrides globales (zona 'all') ───────────────────────────
    this._processGlobalOverrides(effectOutput, composition, bus)

    // ── Fase 2: Zone overrides (zonas específicas) ────────────────────────
    if (effectOutput.zoneOverrides) {
      this._processZoneOverrides(effectOutput.zoneOverrides, composition, bus)
    }

    // ── Fase 3: Physics modifier (strobe) ─────────────────────────────────
    if (consciousness?.physicsModifier) {
      this._processPhysicsModifier(consciousness.physicsModifier, consciousness, bus)
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // PRIVATE — HOT-PATH (zero-alloc, mutación in-place de scratch objects)
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Emite los overrides globales (aplican a la zona 'all').
   *
   * Canales que puede emitir: dimmer, white, amber, r/g/b.
   * NO emite movimiento (regla L3 estricta).
   */
  private _processGlobalOverrides(
    output: CombinedEffectOutput,
    composition: number,
    bus: IIntentBus,
  ): void {
    // 🌊 WAVE 4832: Los overrides globales son tiranos por construcción
    // (provienen de efectos con mixBus='global' tipo OroSolido/StrobeStorm).
    // Siempre 'LTP' → dominación L3 absoluta sobre L0/L1.
    const globalMerge: MergeStrategy = 'LTP'

    // dimmerOverride → IMPACT nodes zona 'all'
    if (output.dimmerOverride !== undefined) {
      this._emitImpact('all' as EffectZone, clamp01(output.dimmerOverride), composition, bus, globalMerge)
    }

    // colorOverride HSL/RGB → COLOR nodes zona 'all'
    if (output.colorOverride) {
      this._emitColor('all' as EffectZone, output.colorOverride as ColorInput, composition, bus)
      this._emitOmniZoneColors(output.colorOverride as ColorInput, composition, bus)
    }

    // whiteOverride → COLOR nodes zona 'all' (canal 'white')
    if (output.whiteOverride !== undefined) {
      this._emitWhite('all' as EffectZone, clamp01(output.whiteOverride), composition, bus, globalMerge)
    }

    // amberOverride → COLOR nodes zona 'all' (canal 'amber')
    if (output.amberOverride !== undefined) {
      this._emitAmber('all' as EffectZone, clamp01(output.amberOverride), composition, bus, globalMerge)
    }

    // strobeRate → IMPACT nodes zona 'all' (canal 'strobeRate' para fixtures con shutter)
    if (output.strobeRate !== undefined && output.strobeRate > 0) {
      this._emitStrobe('all' as EffectZone, clamp01(output.strobeRate), composition, bus)
    }
  }

  /**
   * WAVE 4684: Inyección nativa de color para zonas ambientales.
   * WAVE 4812: Eliminadas derivaciones de matiz (—_deriveAmbientColor, _deriveAirColor).
   * Se envía el color base directamente — la paleta Selene ya tiene 4 roles puros
   * (primary/secondary/accent/ambient) que el ColorAdapter mapea según la zona.
   * No se necesitan transformaciones locales de hue/sat/lightness aquí.
   */
  private _emitOmniZoneColors(base: ColorInput, composition: number, bus: IIntentBus): void {
    this._emitColor('ambient' as EffectZone, base, composition, bus)
    this._emitColor('air' as EffectZone, base, composition, bus)
  }

  /**
   * Emite los overrides específicos por zona.
   *
   * Itera el mapa zoneOverrides y traduce cada zona a sus NodeIds.
   * DESCARTA completamente el campo `movement` de cada zona (regla L3).
   */
  private _processZoneOverrides(
    zoneOverrides: NonNullable<CombinedEffectOutput['zoneOverrides']>,
    composition: number,
    bus: IIntentBus,
  ): void {
    // 🔬 WAVE 4832 DIAG: log one-shot per zone-set signature.
    // Imprime qué zonas declara el efecto y cuántos NodeIds resuelve cada una
    // por familia. Permite detectar shows con fixtures en zonas que el adapter
    // NO conoce (causa de "soft effects no pintan"). Auto-throttled: misma firma
    // de zonas no re-imprime hasta que cambie el set.
    const zoneSignature = Object.keys(zoneOverrides).sort().join(',')
    if (zoneSignature !== this._lastDiagSignature) {
      this._lastDiagSignature = zoneSignature
      const summary: string[] = []
      for (const z of Object.keys(zoneOverrides)) {
        const impactCount = this._zoneRouter.resolve(z as EffectZone, NodeFamily.IMPACT).length
        const colorCount = this._zoneRouter.resolve(z as EffectZone, NodeFamily.COLOR).length
        summary.push(`${z}(I:${impactCount},C:${colorCount})`)
      }
      console.log(`[SeleneAetherAdapter 🔬] zone resolution: ${summary.join(' | ')}`)
    }

    // 🔬 WAVE 4832 DIAG: dump real de valores 1 vez/segundo (~60 frames a 60fps).
    // Permite ver si dimmer/color emitidos son != 0 cuando el user reporta
    // "no pinta". Captura SÓLO si pasaron suficientes frames para evitar spam.
    this._diagFrameCount++
    const shouldDumpValues = this._diagFrameCount % 60 === 0

    for (const zoneId in zoneOverrides) {
      const override = zoneOverrides[zoneId]
      const zone = zoneId as EffectZone

      if (shouldDumpValues) {
        const colorStr = override.color
          ? `H${Math.round(override.color.h)}/S${Math.round(override.color.s)}/L${Math.round(override.color.l)}`
          : '—'
        const dimStr = override.dimmer !== undefined ? override.dimmer.toFixed(2) : '—'
        const wStr = override.white !== undefined ? override.white.toFixed(2) : '—'
        const aStr = override.amber !== undefined ? override.amber.toFixed(2) : '—'
        console.log(`[SeleneAetherAdapter 🔬] zone=${zoneId} blend=${override.blendMode ?? '?'} dim=${dimStr} color=${colorStr} w=${wStr} a=${aStr}`)
      }

      // 🌊 WAVE 4832: El blendMode declarado por el efecto se traduce
      // a mergeStrategy. SOLO afecta a canales de luminancia (dimmer/white/amber):
      //   'max'     → 'HTP'  (CumbiaMoon/CorazonLatino: tintan sin matar L0)
      //   'replace' → 'LTP'  (OroSolido/StrobeStorm: dominan la capa)
      // El canal de color (r/g/b) siempre se emite con 'LTP': mezclar HSL por
      // máximo de componente RGB rompe la identidad cromática del efecto.
      const luminanceMerge = blendModeToMergeStrategy(override.blendMode)

      // dimmer → IMPACT nodes de esta zona
      if (override.dimmer !== undefined) {
        this._emitImpact(zone, clamp01(override.dimmer), composition, bus, luminanceMerge)
      }

      // color HSL/RGB → COLOR nodes de esta zona (LTP forzado: ver nota arriba)
      if (override.color) {
        this._emitColor(zone, override.color as ColorInput, composition, bus)
      }

      // white → COLOR nodes de esta zona
      if (override.white !== undefined) {
        this._emitWhite(zone, clamp01(override.white), composition, bus, luminanceMerge)
      }

      // amber → COLOR nodes de esta zona
      if (override.amber !== undefined) {
        this._emitAmber(zone, clamp01(override.amber), composition, bus, luminanceMerge)
      }

      // strobeRate → IMPACT nodes de esta zona
      if (override.strobeRate !== undefined && override.strobeRate > 0) {
        this._emitStrobe(zone, clamp01(override.strobeRate), composition, bus)
      }

      // ❌ override.movement → DESCARTADO (Regla L3: movimiento ≡ KineticAdapter)
    }
  }

  /**
   * Emite intents de strobe/flash basados en el physicsModifier de Selene.
   *
   * Condiciones para emitir:
   *   - modifier.confidence > 0.5
   *   - energy < MAX_ENERGY_FOR_PHYSICS_MOD (0.85) → WAVE 450 Energy Override
   *
   * Emite a todos los nodos IMPACT (zona 'all').
   */
  private _processPhysicsModifier(
    modifier: NonNullable<ConsciousnessOutput['physicsModifier']>,
    consciousness: ConsciousnessOutput,
    bus: IIntentBus,
  ): void {
    // Gate: confianza mínima
    if (modifier.confidence <= 0.5) {
      return
    }

    // Gate: WAVE 450 Energy Override — la física tiene VETO en drops/clímax
    // Leer energía del debugInfo si está disponible (sin alloc, acceso directo)
    const energy = (consciousness as any).debugInfo?.smoothedEnergy as number | undefined
    if (energy !== undefined && energy > MAX_ENERGY_FOR_PHYSICS_MOD) {
      return
    }

    const nodeIds = this._zoneRouter.resolve('all' as EffectZone, NodeFamily.IMPACT)
    if (nodeIds.length === 0) {
      return
    }

    // strobeIntensity → canal strobeRate
    const strobeRate = modifier.strobeIntensity !== undefined
      ? clamp01(modifier.strobeIntensity)
      : 0

    // flashIntensity → shutter: abierto si > 0.5, cerrado si ≤ 0.5
    const shutter = modifier.flashIntensity !== undefined
      ? (modifier.flashIntensity > 0.5 ? 1.0 : 0.0)
      : 0

    const scratch = this._strobeScratch
    const vals    = this._strobeValues

    vals.strobeRate = strobeRate
    vals.shutter    = shutter
    scratch.confidence = modifier.confidence

    for (let i = 0; i < nodeIds.length; i++) {
      scratch.nodeId = nodeIds[i]
      bus.push(scratch as unknown as INodeIntent)
    }
  }

  // ── Helpers de emisión atómica ──────────────────────────────────────────

  /**
   * Emite un intent de dimmer a todos los nodos IMPACT de una zona.
   */
  private _emitImpact(
    zone: EffectZone,
    dimmer: number,
    confidence: number,
    bus: IIntentBus,
    mergeStrategy: MergeStrategy = 'LTP',
  ): void {
    const nodeIds = this._zoneRouter.resolve(zone, NodeFamily.IMPACT)
    if (nodeIds.length === 0) return

    const scratch = this._impactScratch
    const vals    = this._impactValues

    vals.dimmer          = dimmer
    scratch.confidence   = confidence
    scratch.skipDarkSpin = this._skipDarkSpin
    scratch.mergeStrategy = mergeStrategy

    for (let i = 0; i < nodeIds.length; i++) {
      scratch.nodeId = nodeIds[i]
      bus.push(scratch as unknown as INodeIntent)
    }
  }

  /** Limpia keys residuales del color scratch para evitar contaminación cruzada */
  private _clearColorScratch(): void {
    const v = this._colorValues
    delete (v as Record<string, number>)['r']
    delete (v as Record<string, number>)['g']
    delete (v as Record<string, number>)['b']
    delete (v as Record<string, number>)['red']
    delete (v as Record<string, number>)['green']
    delete (v as Record<string, number>)['blue']
    delete (v as Record<string, number>)['white']
    delete (v as Record<string, number>)['amber']
  }

  /**
   * Emite un intent de color RGB a todos los nodos COLOR de una zona.
   */
  private _emitColor(
    zone: EffectZone,
    color: ColorInput,
    confidence: number,
    bus: IIntentBus,
  ): void {
    const nodeIds = this._zoneRouter.resolve(zone, NodeFamily.COLOR)
    if (nodeIds.length === 0) return

    if (isHslColor(color)) {
      hslToRgbInto(color.h, color.s, color.l, _rgbBuffer)
      color = _rgbBuffer
    }

    this._clearColorScratch()
    const scratch = this._colorScratch
    const vals    = this._colorValues

    const r = color.red ?? color.r ?? 0
    const g = color.green ?? color.g ?? 0
    const b = color.blue ?? color.b ?? 0

    // Compat dual: algunos paths consumen r/g/b y otros red/green/blue.
    vals.r               = r
    vals.g               = g
    vals.b               = b
    vals.red             = r
    vals.green           = g
    vals.blue            = b
    scratch.confidence   = confidence
    scratch.skipDarkSpin = this._skipDarkSpin
    // 🌊 WAVE 4832: el color SIEMPRE se emite como LTP. Mezclar componentes
    // RGB por máximo rompe la identidad cromática (rojo + plata = magenta sucio).
    scratch.mergeStrategy = 'LTP'

    for (let i = 0; i < nodeIds.length; i++) {
      scratch.nodeId = nodeIds[i]
      bus.push(scratch as unknown as INodeIntent)
    }
  }

  /**
   * Emite un intent de white a todos los nodos COLOR de una zona.
   */
  private _emitWhite(
    zone: EffectZone,
    white: number,
    confidence: number,
    bus: IIntentBus,
    mergeStrategy: MergeStrategy = 'LTP',
  ): void {
    const nodeIds = this._zoneRouter.resolve(zone, NodeFamily.COLOR)
    if (nodeIds.length === 0) return

    this._clearColorScratch()
    const scratch = this._colorScratch
    const vals    = this._colorValues

    vals.white           = white
    scratch.confidence   = confidence
    scratch.skipDarkSpin = this._skipDarkSpin
    scratch.mergeStrategy = mergeStrategy

    for (let i = 0; i < nodeIds.length; i++) {
      scratch.nodeId = nodeIds[i]
      bus.push(scratch as unknown as INodeIntent)
    }
  }

  /**
   * Emite un intent de amber a todos los nodos COLOR de una zona.
   */
  private _emitAmber(
    zone: EffectZone,
    amber: number,
    confidence: number,
    bus: IIntentBus,
    mergeStrategy: MergeStrategy = 'LTP',
  ): void {
    const nodeIds = this._zoneRouter.resolve(zone, NodeFamily.COLOR)
    if (nodeIds.length === 0) return

    this._clearColorScratch()
    const scratch = this._colorScratch
    const vals    = this._colorValues

    vals.amber           = amber
    scratch.confidence   = confidence
    scratch.skipDarkSpin = this._skipDarkSpin
    scratch.mergeStrategy = mergeStrategy

    for (let i = 0; i < nodeIds.length; i++) {
      scratch.nodeId = nodeIds[i]
      bus.push(scratch as unknown as INodeIntent)
    }
  }

  /**
   * Emite un intent de strobeRate a todos los nodos IMPACT de una zona.
   * Usado cuando CombinedEffectOutput trae strobeRate > 0 (PASO 3 WAVE 4664).
   */
  private _emitStrobe(
    zone: EffectZone,
    strobeRate: number,
    confidence: number,
    bus: IIntentBus,
  ): void {
    const nodeIds = this._zoneRouter.resolve(zone, NodeFamily.IMPACT)
    if (nodeIds.length === 0) return

    const scratch = this._strobeScratch
    const vals    = this._strobeValues

    vals.strobeRate      = strobeRate
    vals.shutter         = 1.0
    scratch.confidence   = confidence
    scratch.skipDarkSpin = this._skipDarkSpin
    // Strobe es siempre LTP estricto (canal STRICT_PRIORITY en el Arbiter).
    scratch.mergeStrategy = 'LTP'

    for (let i = 0; i < nodeIds.length; i++) {
      scratch.nodeId = nodeIds[i]
      bus.push(scratch as unknown as INodeIntent)
    }
  }
}
