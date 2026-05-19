// ════════════════════════════════════════════════════════════════════════════
// 🏛️ WAVE 2482 — INFINITE ARSENAL · SELENE-HEPHAESTUS BRIDGE
// ════════════════════════════════════════════════════════════════════════════
//  Pieza central de enrutamiento dual-path entre Selene IA y Hephaestus.
//
//  FLUJO:
//    Selene DecisionMaker → ConsciousnessEffectDecision { effectType, ... }
//      ↓
//    SeleneHephBridge.route(decision, context)
//      ├─ HIT  → DynamicEffectRegistry encuentra `.lfx` v2.1 compatible.
//      │         Spatial filter: si spatialBehavior='absolute' Y hay IK
//      │         target activo, silenciamos pan/tilt del clip pero
//      │         dejamos pasar dimmer/color (BridgeRoute.silenceSpatial).
//      │         Invoca el `playHook` (HephaestusRuntime.play) si existe.
//      │         → { kind: 'hephaestus', entry, resolved }
//      │
//      └─ MISS → Sin entry o no eligible. NO toca pipeline legacy.
//                → { kind: 'legacy' }
//                El caller (selene-aether-adapter) continúa como hoy:
//                EffectManager.triggerEffect() / dream simulator.
//
//  REGLA DE ORO (WAVE 2482):
//    - El bridge nunca llama directamente a EffectDreamSimulator ni a
//      EffectManager. Solo decide si el efecto va por Hephaestus o no.
//    - Si retorna { kind:'legacy' } el caller hace EXACTAMENTE lo que
//      hacía antes — retrocompatibilidad estricta.
//    - El bridge no toca el NodeArbiter directamente; la inyección a L3+
//      la realiza HephaestusAetherAdapter ya existente, alimentado por
//      los outputs que HephaestusRuntime.tick() produce tras play().
// ════════════════════════════════════════════════════════════════════════════

import type { ConsciousnessEffectDecision } from '../protocol/ConsciousnessOutput'
import {
  getDynamicEffectRegistry,
  type DynamicEffectRegistry,
} from './DynamicEffectRegistry'
import type { RegistryEntry, SpatialBehavior } from './lfxTypes'

// ─── TIPOS PÚBLICOS ─────────────────────────────────────────────────────────

/**
 * Contexto que el caller proporciona al bridge en cada decisión.
 * Aether-aware: el bridge puede consultar si hay IK target activo para
 * decidir si silencia pan/tilt del clip.
 */
export interface BridgeContext {
  /**
   * Nodos kinetic que tienen un target IK activo (motor kinetic override).
   * Si el set no está vacío, los efectos `spatialBehavior='absolute'` se
   * marcarán con `silenceSpatial=true` para que el caller filtre pan/tilt.
   *
   * Puede ser `null` si el caller no expone visibilidad de IK; en ese caso
   * asumimos "no IK activo" y dejamos al clip secuestrar pan/tilt.
   */
  readonly ikActiveNodeIds: ReadonlySet<string> | null

  /**
   * Frame timestamp (ms desde epoch). Usado para `playedAt` en el resultado.
   * Opcional — defaults a `Date.now()`.
   */
  readonly nowMs?: number
}

/** Parámetros resueltos por el bridge para alimentar el HephaestusRuntime. */
export interface ResolvedPlayParams {
  readonly effectId: string
  readonly filePath: string | null
  readonly intensity: number
  readonly durationMs: number
  readonly fixtureTargeting: string
  readonly overlayMode: 'absolute' | 'relative' | 'additive'
  readonly intensityScaling: 'proportional' | 'fixed' | 'energyDriven'
  /**
   * Si true, el caller debe filtrar pan/tilt del output del runtime.
   * Solo se setea cuando el clip declara `spatialBehavior='absolute'` Y
   * hay un IK target activo conflictivo.
   */
  readonly silenceSpatial: boolean
}

export type BridgeRoute =
  | {
      readonly kind: 'hephaestus'
      readonly entry: RegistryEntry
      readonly resolved: ResolvedPlayParams
      /** Instance ID del runtime si el playHook se ejecutó; -1 si solo se planificó. */
      readonly instanceId: number
    }
  | {
      readonly kind: 'legacy'
      /** Razón legible del miss (debug only). */
      readonly reason: 'no-entry' | 'spatial-incompatible' | 'no-file'
    }

/**
 * Callback opcional que dispara la ejecución real en HephaestusRuntime.
 * Si se proporciona, el bridge lo invoca cuando hay HIT.
 * Retorna instanceId del runtime (>0) o -1 si falló.
 */
export type PlayHook = (params: ResolvedPlayParams, entry: RegistryEntry) => number

// ─── BRIDGE ─────────────────────────────────────────────────────────────────

export class SeleneHephBridge {
  private readonly _registry: DynamicEffectRegistry
  private _playHook: PlayHook | null = null

  // Telemetría
  private _hephRoutes = 0
  private _legacyRoutes = 0
  private _spatialSilenced = 0

  constructor(registry?: DynamicEffectRegistry) {
    this._registry = registry ?? getDynamicEffectRegistry()
  }

  /**
   * Conecta el callback real al HephaestusRuntime.
   * En Fase 0/1 (plumbing) este hook puede no estar conectado; el bridge
   * igualmente decide correctamente y devuelve los `resolved` params.
   */
  public setPlayHook(hook: PlayHook | null): void {
    this._playHook = hook
  }

  /**
   * Punto de entrada principal del enrutamiento.
   *
   * @returns BridgeRoute — el caller actúa según `kind`.
   */
  public route(
    decision: ConsciousnessEffectDecision,
    context: BridgeContext,
  ): BridgeRoute {
    const entry = this._registry.getEntry(decision.effectType)

    if (!entry) {
      this._legacyRoutes++
      return _LEGACY_NO_ENTRY
    }

    // Spatial compatibility check.
    const silenceSpatial = _shouldSilenceSpatial(entry.spatialBehavior, context)
    if (silenceSpatial && entry.spatialBehavior === 'absolute') {
      // Política WAVE 2482: si el clip es ABSOLUTO y hay IK activo,
      // NO lo silenciamos completo — dejamos pasar dimmer/color pero
      // bloqueamos pan/tilt. La decisión final de qué hacer con
      // pan/tilt vive en el HephaestusAetherAdapter (Fase 2).
      this._spatialSilenced++
    }

    // 'spatial' es futuro — todavía no hay IK ingress de clips.
    if (entry.spatialBehavior === 'spatial') {
      this._legacyRoutes++
      return _LEGACY_SPATIAL_INCOMPATIBLE
    }

    const resolved = _resolvePlayParams(entry, decision, silenceSpatial)
    let instanceId = -1
    if (this._playHook) {
      try {
        instanceId = this._playHook(resolved, entry)
      } catch (err) {
        console.warn(
          `[SeleneHephBridge ⚠️] playHook threw for "${decision.effectType}":`,
          err,
        )
      }
    }

    this._hephRoutes++
    return { kind: 'hephaestus', entry, resolved, instanceId }
  }

  /**
   * Consulta rápida: ¿este effectType es enrutable por Hephaestus?
   * Útil para que el caller decida ANTES de armar la decision.
   */
  public canRoute(effectType: string): boolean {
    return this._registry.has(effectType)
  }

  /** Telemetría acumulada (lectura no destructiva). */
  public getTelemetry(): {
    readonly hephRoutes: number
    readonly legacyRoutes: number
    readonly spatialSilenced: number
  } {
    return {
      hephRoutes: this._hephRoutes,
      legacyRoutes: this._legacyRoutes,
      spatialSilenced: this._spatialSilenced,
    }
  }

  /** Reset de contadores (usar tras consume telemetry). */
  public resetTelemetry(): void {
    this._hephRoutes = 0
    this._legacyRoutes = 0
    this._spatialSilenced = 0
  }
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

function _shouldSilenceSpatial(
  behavior: SpatialBehavior,
  ctx: BridgeContext,
): boolean {
  if (behavior !== 'absolute') return false
  const ik = ctx.ikActiveNodeIds
  return ik != null && ik.size > 0
}

function _resolvePlayParams(
  entry: RegistryEntry,
  decision: ConsciousnessEffectDecision,
  silenceSpatial: boolean,
): ResolvedPlayParams {
  // Intensity scaling: 'fixed' ignora la intensity de Selene.
  const intensity =
    entry.execHints.intensityScaling === 'fixed'
      ? 1.0
      : _clamp01(decision.intensity)

  return {
    effectId: entry.id,
    filePath: entry.filePath,
    intensity,
    durationMs: entry.durationMs,
    fixtureTargeting: entry.execHints.fixtureTargeting,
    overlayMode: entry.execHints.overlayMode,
    intensityScaling: entry.execHints.intensityScaling,
    silenceSpatial,
  }
}

function _clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  if (n < 0) return 0
  if (n > 1) return 1
  return n
}

// ─── ROUTE LITERALS pre-congelados (zero-alloc misses) ──────────────────────

const _LEGACY_NO_ENTRY: BridgeRoute = Object.freeze({
  kind: 'legacy',
  reason: 'no-entry',
}) as BridgeRoute

const _LEGACY_SPATIAL_INCOMPATIBLE: BridgeRoute = Object.freeze({
  kind: 'legacy',
  reason: 'spatial-incompatible',
}) as BridgeRoute

// ─── SINGLETON ──────────────────────────────────────────────────────────────

let _instance: SeleneHephBridge | null = null

/** Acceso al singleton compartido. */
export function getSeleneHephBridge(): SeleneHephBridge {
  if (_instance == null) _instance = new SeleneHephBridge()
  return _instance
}

/** SOLO para tests: resetea el singleton. */
export function __resetSeleneHephBridgeForTests(): void {
  _instance = null
}
