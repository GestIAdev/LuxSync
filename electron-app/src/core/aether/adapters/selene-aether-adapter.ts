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
import type { CombinedEffectOutput } from '../../effects/types'
import type { ConsciousnessOutput } from '../../protocol/ConsciousnessOutput'
import type { EffectZone } from '../../effects/types'
import type { NodeId } from '../types'

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

  // ── Scratch objects pre-allocated (ver §5.4 del blueprint) ─────────────

  /** Scratch para canales IMPACT (dimmer) */
  private readonly _impactValues: Record<string, number> = { dimmer: 0 }
  private readonly _impactScratch = {
    nodeId: '' as NodeId,
    values: null as unknown as Record<string, number>,
    priority: L3_PRIORITY,
    confidence: 1.0,
    source: L3_SOURCE,
  }

  /** Scratch para canales COLOR (r, g, b) */
  private readonly _colorValues: Record<string, number> = { r: 0, g: 0, b: 0 }
  private readonly _colorScratch = {
    nodeId: '' as NodeId,
    values: null as unknown as Record<string, number>,
    priority: L3_PRIORITY,
    confidence: 1.0,
    source: L3_SOURCE,
  }

  /** Scratch para canales STROBE (strobeRate, shutter) */
  private readonly _strobeValues: Record<string, number> = { strobeRate: 0, shutter: 0 }
  private readonly _strobeScratch = {
    nodeId: '' as NodeId,
    values: null as unknown as Record<string, number>,
    priority: L3_PRIORITY,
    confidence: 1.0,
    source: L3_SOURCE,
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
    const composition = effectOutput.globalComposition ?? 0
    if (composition < MIN_GLOBAL_COMPOSITION) {
      return
    }

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
    // dimmerOverride → IMPACT nodes zona 'all'
    if (output.dimmerOverride !== undefined) {
      this._emitImpact('all' as EffectZone, clamp01(output.dimmerOverride), composition, bus)
    }

    // colorOverride HSL → COLOR nodes zona 'all'
    if (output.colorOverride) {
      const c = output.colorOverride
      hslToRgbInto(c.h, c.s, c.l, _rgbBuffer)
      this._emitColor('all' as EffectZone, _rgbBuffer.r, _rgbBuffer.g, _rgbBuffer.b, composition, bus)
    }

    // whiteOverride → COLOR nodes zona 'all' (canal 'white')
    if (output.whiteOverride !== undefined) {
      this._emitWhite('all' as EffectZone, clamp01(output.whiteOverride), composition, bus)
    }

    // amberOverride → COLOR nodes zona 'all' (canal 'amber')
    if (output.amberOverride !== undefined) {
      this._emitAmber('all' as EffectZone, clamp01(output.amberOverride), composition, bus)
    }
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
    for (const zoneId in zoneOverrides) {
      const override = zoneOverrides[zoneId]
      const zone = zoneId as EffectZone

      // dimmer → IMPACT nodes de esta zona
      if (override.dimmer !== undefined) {
        this._emitImpact(zone, clamp01(override.dimmer), composition, bus)
      }

      // color HSL → COLOR nodes de esta zona
      if (override.color) {
        hslToRgbInto(override.color.h, override.color.s, override.color.l, _rgbBuffer)
        this._emitColor(zone, _rgbBuffer.r, _rgbBuffer.g, _rgbBuffer.b, composition, bus)
      }

      // white → COLOR nodes de esta zona
      if (override.white !== undefined) {
        this._emitWhite(zone, clamp01(override.white), composition, bus)
      }

      // amber → COLOR nodes de esta zona
      if (override.amber !== undefined) {
        this._emitAmber(zone, clamp01(override.amber), composition, bus)
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
  ): void {
    const nodeIds = this._zoneRouter.resolve(zone, NodeFamily.IMPACT)
    if (nodeIds.length === 0) return

    const scratch = this._impactScratch
    const vals    = this._impactValues

    vals.dimmer         = dimmer
    scratch.confidence  = confidence

    for (let i = 0; i < nodeIds.length; i++) {
      scratch.nodeId = nodeIds[i]
      bus.push(scratch as unknown as INodeIntent)
    }
  }

  /**
   * Emite un intent de color RGB a todos los nodos COLOR de una zona.
   */
  private _emitColor(
    zone: EffectZone,
    r: number,
    g: number,
    b: number,
    confidence: number,
    bus: IIntentBus,
  ): void {
    const nodeIds = this._zoneRouter.resolve(zone, NodeFamily.COLOR)
    if (nodeIds.length === 0) return

    const scratch = this._colorScratch
    const vals    = this._colorValues

    vals.r              = r
    vals.g              = g
    vals.b              = b
    scratch.confidence  = confidence

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
  ): void {
    const nodeIds = this._zoneRouter.resolve(zone, NodeFamily.COLOR)
    if (nodeIds.length === 0) return

    const scratch = this._colorScratch
    const vals    = this._colorValues

    vals.white          = white
    scratch.confidence  = confidence

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
  ): void {
    const nodeIds = this._zoneRouter.resolve(zone, NodeFamily.COLOR)
    if (nodeIds.length === 0) return

    const scratch = this._colorScratch
    const vals    = this._colorValues

    vals.amber          = amber
    scratch.confidence  = confidence

    for (let i = 0; i < nodeIds.length; i++) {
      scratch.nodeId = nodeIds[i]
      bus.push(scratch as unknown as INodeIntent)
    }
  }
}
