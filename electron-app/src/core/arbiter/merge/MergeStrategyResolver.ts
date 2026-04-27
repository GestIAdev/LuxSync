/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎛️ MERGE STRATEGY RESOLVER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 3504 — PASO 1: Extracción Matemática.
 *
 * Esta clase es la implementación de IMergeStrategyResolver del blueprint.
 * Contiene ÚNICA Y EXCLUSIVAMENTE la matemática de resolución DMX por canal:
 *
 *   - HTP  (Highest Takes Precedence)  → dimmer / strobe / shutter
 *   - LTP  (Latest Takes Precedence)   → posición / color / beam / control
 *   - ADD  (Additive Blend)            → efectos ambientales acumulativos
 *   - OVERRIDE                         → sustitución absoluta (blackout, dictador)
 *
 * CONTRATOS DE PUREZA:
 *   ✓ Cero dependencias de estado externo.
 *   ✓ Cero singletons, cero event bus, cero imports de módulos con side-effects.
 *   ✓ Todos los métodos son estáticos y deterministas.
 *   ✓ Dado el mismo input, siempre produce el mismo output.
 *   ✓ Testeable en aislamiento sin mocks.
 *
 * ORIGEN DE LA LÓGICA:
 *   Matemática extraída de MasterArbiter.ts:
 *   - `arbitrate()` líneas 1584–1645: blendMode switch HTP/LTP/ADD para dimmer y color.
 *   - `mergeChannelForFixture()` líneas 2136–2295: resolución por capa HTP/LTP.
 *   - `arbitrateFixture()` líneas 1908–2130: Grand Master + Inhibit Limit + NaN shield.
 *   - `MergeStrategies.ts` funciones atómicas ya existentes: integradas aquí como resolver.
 *
 * RELACIÓN CON MergeStrategies.ts:
 *   `MergeStrategies.ts` (WAVE 373) contiene las funciones atómicas de bajo nivel
 *   (mergeHTP, mergeLTP, mergeBLEND, mergeChannel, clampDMX, etc.).
 *   `MergeStrategyResolver.ts` (WAVE 3504) es la capa de política por encima:
 *   recibe candidatos con prioridad de capa y elige la estrategia correcta
 *   según el canal. Es el contrato que consumirá ArbitrationDirector en WAVE 3505.
 *
 * USO PREVISTO (WAVE 3505):
 *   ```ts
 *   const resolver = new MergeStrategyResolver()
 *   const result = resolver.resolve('dimmer', candidates)
 *   // result.value → DMX final, result.winnerPriority → capa ganadora
 *   ```
 *
 * @module core/arbiter/merge/MergeStrategyResolver
 * @version WAVE 3504
 * @purity PURE — no state, no side-effects
 */

import { DEFAULT_MERGE_STRATEGIES } from '../types'
import type { ChannelType, MergeStrategy } from '../types'
import { clampDMX } from './MergeStrategies'
import { resolveHTP } from './strategies/HTP'
import { resolveLTP } from './strategies/LTP'
import { resolveADD } from './strategies/ADD'
import type { ChannelKey, LayerCandidate, MergeMode, ResolveResult } from './types'

// ═══════════════════════════════════════════════════════════════════════════
// INTERFACE (Blueprint §2.3)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Contract that ArbitrationDirector will depend on (WAVE 3505).
 * Resolves N layer candidates for a given channel into a single DMX value.
 */
export interface IMergeStrategyResolver {
  resolve(channel: ChannelKey, candidates: readonly LayerCandidate[]): ResolveResult
  resolveWithMode(mode: MergeMode, candidates: readonly LayerCandidate[]): ResolveResult
}

// ═══════════════════════════════════════════════════════════════════════════
// GRAND MASTER + INHIBIT LIMIT MATH
// (Extraído de arbitrateFixture, líneas ~2090 de MasterArbiter.ts)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Aplica Grand Master e Inhibit Limit al valor de dimmer final.
 *
 * Fórmula:  dimmerfinal = clamp(rawDimmer × grandMaster × inhibitLimit)
 *
 * El resultado es siempre un entero DMX válido [0, 255].
 * NaN/Infinity en cualquier operando resulta en 0 (blackout seguro, WAVE 2750).
 *
 * @pure
 */
export function applyGrandMasterAndInhibit(
  rawDimmer: number,
  grandMaster: number,
  inhibitLimit: number
): number {
  return clampDMX(rawDimmer * grandMaster * inhibitLimit)
}

// ═══════════════════════════════════════════════════════════════════════════
// NaN BOMB SHIELD — PAN/TILT
// (Extraído de arbitrateFixture, líneas ~2095 de MasterArbiter.ts — WAVE 2750)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Protege pan/tilt de NaN upstream.
 *
 * Para pan/tilt, clampDMX(NaN)=0 → HOME position = destructivo en cabezas
 * móviles. Si el valor no es finito, se preserva la última posición válida
 * en lugar de snapear a 0 (HOME).
 *
 * @pure
 */
export function safePosition(value: number, lastKnown: number): number {
  return Number.isFinite(value) ? clampDMX(value) : clampDMX(lastKnown)
}

// ═══════════════════════════════════════════════════════════════════════════
// CHRONOS HYBRID BLEND
// (Extraído de arbitrate() modo playback híbrido — MasterArbiter.ts líneas 1559–1645)
// (WAVE 2063 / WAVE 2065 / WAVE 2066 / WAVE 2068 / WAVE 2070)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Input para la mezcla híbrida Chronos + Titan.
 */
export interface HybridBlendInput {
  /** Valor de dimmer calculado por Titan (L0 + capas manuales). DMX [0,255]. */
  readonly titanDimmer: number
  /** Valor de dimmer del frame Chronos, ya multiplicado por grandMaster × inhibitLimit. DMX [0,255]. */
  readonly chronosDimmer: number
  /** Color RGB de Titan. */
  readonly titanColor: Readonly<{ r: number; g: number; b: number }>
  /** Color RGB del frame Chronos. */
  readonly chronosColor: Readonly<{ r: number; g: number; b: number }>
  /** Modo de mezcla declarado por el efecto Chronos. */
  readonly blendMode: 'HTP' | 'LTP' | 'ADD'
  /** true si el efecto Chronos tocó explícitamente los canales de color. */
  readonly colorTouched: boolean
}

/**
 * Resultado de la mezcla híbrida Chronos + Titan.
 */
export interface HybridBlendResult {
  readonly dimmer: number
  readonly color: { readonly r: number; readonly g: number; readonly b: number }
}

/**
 * Resuelve la mezcla híbrida Chronos + Titan para un fixture.
 *
 * Reglas (WAVE 2066 / WAVE 2068 / WAVE 2070):
 *
 * DIMMER:
 *   HTP  → Math.max(titanDimmer, chronosDimmer)
 *   LTP  → chronosDimmer (dictador absoluto; 0 IS 0)
 *   ADD  → clamp(titanDimmer + chronosDimmer)
 *
 * COLOR:
 *   LTP + colorTouched=true  → chronosColor absoluto (ni siquiera Titan puede colorear)
 *   LTP + colorTouched=false → titanColor (dictador transparente, WAVE 2070)
 *   ADD + chronosHasColor    → clamp(titanColor + chronosColor) por canal
 *   HTP / resto con color    → chronosColor si tiene color real, sino titanColor
 *   (ninguno)                → titanColor puro
 *
 * @pure — sin side-effects, sin referencias al estado del Arbiter.
 */
export function resolveHybridBlend(input: HybridBlendInput): HybridBlendResult {
  const { titanDimmer, chronosDimmer, titanColor, chronosColor, blendMode, colorTouched } = input

  // ── DIMMER ──────────────────────────────────────────────────────────────
  let finalDimmer: number
  switch (blendMode) {
    case 'LTP':
      finalDimmer = chronosDimmer
      break
    case 'ADD':
      finalDimmer = clampDMX(titanDimmer + chronosDimmer)
      break
    case 'HTP':
    default:
      finalDimmer = Math.max(chronosDimmer, titanDimmer)
      break
  }

  // ── COLOR ────────────────────────────────────────────────────────────────
  const chronosHasColor =
    chronosColor.r > 0 || chronosColor.g > 0 || chronosColor.b > 0

  let finalColor: { r: number; g: number; b: number }

  if (blendMode === 'LTP' && colorTouched) {
    // WAVE 2068: LTP + color tocado → absoluto. Incluso RGB(0,0,0) es intencional.
    finalColor = {
      r: clampDMX(chronosColor.r),
      g: clampDMX(chronosColor.g),
      b: clampDMX(chronosColor.b),
    }
  } else if (blendMode === 'LTP' && !colorTouched) {
    // WAVE 2070: Dictador transparente en color → Titan pasa sin tocar.
    finalColor = { r: titanColor.r, g: titanColor.g, b: titanColor.b }
  } else if (blendMode === 'ADD' && chronosHasColor) {
    finalColor = {
      r: clampDMX(titanColor.r + chronosColor.r),
      g: clampDMX(titanColor.g + chronosColor.g),
      b: clampDMX(titanColor.b + chronosColor.b),
    }
  } else if (chronosHasColor) {
    // HTP con color real → chronos gana
    finalColor = {
      r: clampDMX(chronosColor.r),
      g: clampDMX(chronosColor.g),
      b: clampDMX(chronosColor.b),
    }
  } else {
    // Sin color de Chronos → Titan
    finalColor = { r: titanColor.r, g: titanColor.g, b: titanColor.b }
  }

  return { dimmer: finalDimmer, color: finalColor }
}

// ═══════════════════════════════════════════════════════════════════════════
// MERGE STRATEGY RESOLVER — CLASE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Resuelve la mezcla de N candidatos de capa para un canal dado.
 *
 * La estrategia se elige automáticamente según el tipo de canal usando
 * DEFAULT_MERGE_STRATEGIES (HTP para dimmer, LTP para todo lo demás).
 * Puede sobreriderse con un MergeMode explícito via resolveWithMode().
 *
 * Esta clase es el contrato que ArbitrationDirector consumirá en WAVE 3505,
 * cuando reemplace la lógica inline de mergeChannelForFixture().
 *
 * @implements IMergeStrategyResolver
 * @purity PURE — instancia sin estado, métodos deterministas.
 */
export class MergeStrategyResolver implements IMergeStrategyResolver {

  // ── resolve ───────────────────────────────────────────────────────────────

  /**
   * Resuelve candidatos usando la estrategia por defecto del canal.
   *
   * La política viene de DEFAULT_MERGE_STRATEGIES en ../types.ts:
   *   dimmer → HTP
   *   todo lo demás → LTP
   *
   * Para efectos con ADD, usar resolveWithMode('ADD', candidates).
   */
  resolve(channel: ChannelKey, candidates: readonly LayerCandidate[]): ResolveResult {
    // ChannelKey es un subconjunto de ChannelType; el cast es seguro siempre
    // que ambos tipos estén sincronizados (garantizado por types.ts WAVE 2084).
    const strategy: MergeStrategy =
      DEFAULT_MERGE_STRATEGIES[channel as ChannelType] ?? 'LTP'

    return this._dispatch(strategy, candidates)
  }

  // ── resolveWithMode ───────────────────────────────────────────────────────

  /**
   * Resuelve candidatos con un MergeMode explícito.
   *
   * Usado cuando el caller conoce el modo (por ejemplo, el blendMode de un
   * frame Chronos o un efecto que declara ADD explícitamente).
   */
  resolveWithMode(mode: MergeMode, candidates: readonly LayerCandidate[]): ResolveResult {
    switch (mode) {
      case 'HTP':      return resolveHTP(candidates)
      case 'LTP':      return resolveLTP(candidates)
      case 'ADD':      return resolveADD(candidates)
      case 'OVERRIDE': return this._resolveOverride(candidates)
    }
  }

  // ── _dispatch (privado) ───────────────────────────────────────────────────

  private _dispatch(strategy: MergeStrategy, candidates: readonly LayerCandidate[]): ResolveResult {
    switch (strategy) {
      case 'HTP':      return resolveHTP(candidates)
      case 'LTP':      return resolveLTP(candidates)
      case 'BLEND':    return resolveLTP(candidates)  // BLEND → LTP fallback hasta CrossfadeEngine
      case 'OVERRIDE': return this._resolveOverride(candidates)
    }
  }

  // ── _resolveOverride (privado) ────────────────────────────────────────────

  /**
   * OVERRIDE: el candidato de mayor prioridad gana incondicionalmente.
   * Ignora timestamp y valor: la jerarquía de capa es ley.
   */
  private _resolveOverride(candidates: readonly LayerCandidate[]): ResolveResult {
    if (candidates.length === 0) return { value: 0, winnerPriority: 0 }

    let winner = candidates[0]
    for (let i = 1; i < candidates.length; i++) {
      if (candidates[i].priority > winner.priority) {
        winner = candidates[i]
      }
    }

    return { value: clampDMX(winner.value), winnerPriority: winner.priority }
  }
}
