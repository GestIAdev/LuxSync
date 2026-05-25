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
import type {
  PixelExecutionHints,
  RegistryEntry,
  SpatialBehavior,
} from './lfxTypes'

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

/**
 * 🎨 WAVE 4812: Parámetros resueltos para un clip pixel-mapped.
 * Equivalente a `ResolvedPlayParams` para el dominio bitmap.
 */
export interface ResolvedPixelParams {
  readonly effectId: string
  readonly filePath: string | null
  readonly intensity: number
  readonly durationMs: number
  readonly fixtureTargeting: string
  /** Hints declarados por el clip — propagación literal desde el `.lfx`. */
  readonly pixelHints: PixelExecutionHints
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
      // 🎨 WAVE 4812: dominio pixel-mapped.
      readonly kind: 'pixelmap'
      readonly entry: RegistryEntry
      readonly resolved: ResolvedPixelParams
      /** ID del Virtual Frame Buffer adquirido por el RenderHook; null si fallback. */
      readonly canvasId: string
    }
  | {
      readonly kind: 'legacy'
      /** Razón legible del miss (debug only). */
      readonly reason: 'no-entry' | 'spatial-incompatible' | 'no-file' | 'no-canvas-engine'
    }

/**
 * Callback opcional que dispara la ejecución real en HephaestusRuntime.
 * Si se proporciona, el bridge lo invoca cuando hay HIT.
 * Retorna instanceId del runtime (>0) o -1 si falló.
 */
export type PlayHook = (params: ResolvedPlayParams, entry: RegistryEntry) => number

/**
 * 🎨 WAVE 4812: Callback para clips `executionDomain === 'pixel'`.
 * El caller (TitanOrchestrator) implementa este hook llamando a
 * `AetherCanvasManager.acquire(...)` y `PixelMapAetherAdapter.bindCanvas(...)`.
 *
 * @returns canvasId del frame buffer adquirido, o `null` si el motor de
 *          canvas aún no está montado (degrada a `'legacy'`).
 */
export type RenderHook = (
  params: ResolvedPixelParams,
  entry: RegistryEntry,
) => string | null

// ─── BRIDGE ─────────────────────────────────────────────────────────────────

export class SeleneHephBridge {
  private readonly _registry: DynamicEffectRegistry
  private _playHook: PlayHook | null = null
  // 🎨 WAVE 4812: hook para clips pixel-mapped.
  private _renderHook: RenderHook | null = null

  // Telemetría
  private _hephRoutes = 0
  private _legacyRoutes = 0
  private _spatialSilenced = 0
  // 🎨 WAVE 4812
  private _pixelmapRoutes = 0

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
   * 🎨 WAVE 4812: Conecta el callback al `AetherCanvasManager`.
   * Si está null, los clips pixel-mapped degradan a `'legacy'` con
   * `reason='no-canvas-engine'` — útil en boot temprano.
   */
  public setRenderHook(hook: RenderHook | null): void {
    this._renderHook = hook
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

    // 🎨 WAVE 4812: Discriminador vector vs pixel.
    // El default 'vector' garantiza retrocompat: clips pre-WAVE-4812
    // recorren exactamente la misma rama que antes.
    const domain = entry.executionDomain ?? 'vector'

    if (domain === 'pixel') {
      // Sin RenderHook → degradar a legacy, no pisar el flujo Hephaestus.
      if (!this._renderHook || !entry.pixelHints) {
        this._legacyRoutes++
        return _LEGACY_NO_CANVAS_ENGINE
      }
      const resolvedPx = _resolvePixelParams(entry, decision)
      let canvasId: string | null = null
      try {
        canvasId = this._renderHook(resolvedPx, entry)
      } catch (err) {
        console.warn(
          `[SeleneArsenalBridge ⚠️] renderHook threw for "${decision.effectType}":`,
          err,
        )
      }
      if (!canvasId) {
        this._legacyRoutes++
        return _LEGACY_NO_CANVAS_ENGINE
      }
      this._pixelmapRoutes++
      return { kind: 'pixelmap', entry, resolved: resolvedPx, canvasId }
    }

    // domain === 'vector' o 'hybrid' (hybrid trata como vector aquí;
    // los canales pixel del híbrido los emite el caller en una segunda
    // pasada vía renderHook — ver blueprint §2.5).

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
    readonly pixelmapRoutes: number
  } {
    return {
      hephRoutes: this._hephRoutes,
      legacyRoutes: this._legacyRoutes,
      spatialSilenced: this._spatialSilenced,
      pixelmapRoutes: this._pixelmapRoutes,
    }
  }

  /** Reset de contadores (usar tras consume telemetry). */
  public resetTelemetry(): void {
    this._hephRoutes = 0
    this._legacyRoutes = 0
    this._spatialSilenced = 0
    this._pixelmapRoutes = 0
  }
}

/**
 * 🎨 WAVE 4812 — Alias semántico.
 * El bridge enruta tres `kind`: 'hephaestus' (vectorial), 'pixelmap' (canvas)
 * y 'legacy' (fallback). Mantenemos `SeleneHephBridge` como nombre canónico
 * para no romper imports existentes; `SeleneArsenalBridge` documenta la
 * naturaleza multi-arsenal del componente.
 */
export const SeleneArsenalBridge = SeleneHephBridge
export type SeleneArsenalBridge = SeleneHephBridge

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

/**
 * 🎨 WAVE 4812: Resuelve los parámetros de un clip pixel-mapped.
 * Pre-condición: `entry.executionDomain === 'pixel'` && `entry.pixelHints != null`.
 */
function _resolvePixelParams(
  entry: RegistryEntry,
  decision: ConsciousnessEffectDecision,
): ResolvedPixelParams {
  const intensity =
    entry.execHints.intensityScaling === 'fixed'
      ? 1.0
      : _clamp01(decision.intensity)

  // El caller garantiza pixelHints != null antes de llamar.
  return {
    effectId: entry.id,
    filePath: entry.filePath,
    intensity,
    durationMs: entry.durationMs,
    fixtureTargeting: entry.execHints.fixtureTargeting,
    pixelHints: entry.pixelHints as PixelExecutionHints,
  }
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

// 🎨 WAVE 4812
const _LEGACY_NO_CANVAS_ENGINE: BridgeRoute = Object.freeze({
  kind: 'legacy',
  reason: 'no-canvas-engine',
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
