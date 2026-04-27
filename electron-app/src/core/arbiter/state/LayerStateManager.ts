/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🗂️ LAYER STATE MANAGER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 3504 — PASO 2: Layer State Isolation.
 *
 * Owner único de las cinco capas de intents del pipeline de arbitración.
 * Extrae del MasterArbiter la responsabilidad de persistir el estado de las
 * capas, dejando al Arbiter libre de actuar solo como compositor.
 *
 * CAPAS (en orden de prioridad ascendente):
 *   L0  TITAN_AI     — Intent generado por TitanEngine cada frame.
 *   L1  CONSCIOUSNESS — Modificadores de SeleneLuxConscious (fósil/CORE 3).
 *   L2  MANUAL        — Overrides manuales por fixture (operador, MIDI, OSC).
 *   L3  EFFECTS       — Efectos temporales (WAVE 373 legacy) + EffectIntents (WAVE 2662).
 *   L4  BLACKOUT      — Booleano de emergencia. Gana sobre todo.
 *
 * CONTRATOS:
 *   ✓ Esta clase NO resuelve merge: sólo almacena y expone el estado por capa.
 *   ✓ NO importa singletons ni event bus. Sus dependencias llegan por constructor.
 *   ✓ Toda lógica de resolución/priorización pertenece al MergeStrategyResolver.
 *   ✓ Compatible con MasterArbiter actual: los métodos públicos mapean 1:1
 *     con el API existente para permitir migración sin regresión (WAVE 3505).
 *
 * ORIGEN DE LA LÓGICA:
 *   Estado extraído de MasterArbiter.ts lines 125–136 (layer fields) y los
 *   métodos CRUD lines 429–1100 (setTitanIntent, setManualOverride,
 *   releaseManualOverride, addEffect, setEffectIntents, setBlackout, etc.).
 *
 * @module core/arbiter/state/LayerStateManager
 * @version WAVE 3504
 */

import type {
  Layer0_Titan,
  Layer1_Consciousness,
  Layer2_Manual,
  Layer3_Effect,
  EffectIntent,
  EffectIntentMap,
  EffectType,
  ChannelType,
} from '../types'

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

export interface LayerStateConfig {
  /** Maximum concurrent Layer 2 overrides. Default 64. */
  maxManualOverrides: number
  /** Maximum active Layer 3 legacy effects. Default 8. */
  maxActiveEffects: number
  /** Whether consciousness (L1) is active. Default false (CORE 3). */
  consciousnessEnabled: boolean
}

const DEFAULT_LAYER_STATE_CONFIG: LayerStateConfig = {
  maxManualOverrides: 64,
  maxActiveEffects: 8,
  consciousnessEnabled: false,
}

// ═══════════════════════════════════════════════════════════════════════════
// INTERFACE (Blueprint §2.3)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Contrato que ArbitrationDirector consumirá vía DI en WAVE 3505.
 *
 * Expone el estado de las cinco capas como getters y mutaciones CRUD.
 * No incluye ninguna lógica de resolución/merge.
 */
export interface ILayerStateManager {
  // ── Layer 0 ──────────────────────────────────────────────────────────────
  setTitanIntent(intent: Layer0_Titan): void
  getTitanIntent(): Layer0_Titan | null
  clearTitanIntent(): void

  // ── Layer 1 ──────────────────────────────────────────────────────────────
  setConsciousnessModifier(modifier: Layer1_Consciousness): void
  getConsciousnessModifier(): Layer1_Consciousness | null
  clearConsciousnessModifier(): void

  // ── Layer 2 ──────────────────────────────────────────────────────────────
  setManualOverride(override: Layer2_Manual): void
  getManualOverride(fixtureId: string): Layer2_Manual | undefined
  hasManualOverride(fixtureId: string, channel?: ChannelType): boolean
  releaseManualOverride(fixtureId: string, channels?: ChannelType[]): void
  releaseAllManualOverrides(): void
  getManualOverrideFixtureIds(): string[]
  getManualOverrideCount(): number

  // ── Layer 3 legacy effects ────────────────────────────────────────────────
  addEffect(effect: Layer3_Effect): void
  removeEffect(type: EffectType): void
  clearEffects(): void
  getActiveEffects(): readonly Layer3_Effect[]
  tickExpiredEffects(now: number): EffectType[]

  // ── Layer 3 effect intents (WAVE 2662) ───────────────────────────────────
  setEffectIntents(intents: EffectIntentMap): void
  getEffectIntent(fixtureId: string): EffectIntent | undefined
  getEffectIntentsMap(): Readonly<EffectIntentMap>
  clearEffectIntents(): void

  // ── Layer 4 ──────────────────────────────────────────────────────────────
  enableBlackout(): void
  disableBlackout(): void
  toggleBlackout(): boolean
  isBlackoutActive(): boolean

  // ── Global reset ─────────────────────────────────────────────────────────
  resetAllLayers(): void

  // ── Diagnostics ──────────────────────────────────────────────────────────
  snapshot(): LayerStateSnapshot
}

// ═══════════════════════════════════════════════════════════════════════════
// SNAPSHOT (para tests de paridad y telemetría)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Captura instantánea del estado de todas las capas.
 * Usada por tests de regresión frame-por-frame (WAVE 3504 §6).
 */
export interface LayerStateSnapshot {
  readonly layer0: Layer0_Titan | null
  readonly layer1: Layer1_Consciousness | null
  readonly layer2Count: number
  readonly layer2FixtureIds: readonly string[]
  readonly layer3EffectCount: number
  readonly layer3EffectTypes: readonly EffectType[]
  readonly layer3IntentCount: number
  readonly layer4Blackout: boolean
}

// ═══════════════════════════════════════════════════════════════════════════
// IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════════════

export class LayerStateManager implements ILayerStateManager {

  private readonly config: LayerStateConfig

  // ── Layer storage ─────────────────────────────────────────────────────────

  /** L0 — TitanEngine intent. Null before first frame. */
  private _layer0: Layer0_Titan | null = null

  /** L1 — SeleneLuxConscious modifier. Null until CORE 3. */
  private _layer1: Layer1_Consciousness | null = null

  /**
   * L2 — Manual overrides. keyed by fixtureId.
   * WAVE 2711: merge semántico por categoría de canal (posición vs color vs intensidad).
   */
  private _layer2: Map<string, Layer2_Manual> = new Map()

  /**
   * L3 legacy — Efectos temporales (strobe, flash, blinder…).
   * Predatan la API de EffectIntents (WAVE 373 → WAVE 2662).
   */
  private _layer3Effects: Layer3_Effect[] = []

  /**
   * L3 intents — EffectManager output pre-resuelto a fixtureId.
   * Se limpia al final de cada frame (garantía de frescura).
   * WAVE 2662.
   */
  private _layer3Intents: EffectIntentMap = new Map()

  /** L4 — Blackout de emergencia. Dimmer → 0 en todos los fixtures. */
  private _layer4Blackout: boolean = false

  // ── WAVE 3190: reuse buffers ─────────────────────────────────────────────
  private _manualIdsBuf: string[] = []
  private _effectTypesBuf: EffectType[] = []

  // ─────────────────────────────────────────────────────────────────────────

  constructor(config: Partial<LayerStateConfig> = {}) {
    this.config = { ...DEFAULT_LAYER_STATE_CONFIG, ...config }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 0 — TITAN AI
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Recibe el LightingIntent producido por TitanEngine cada frame.
   * Llamado por TitanOrchestrator / OrchestratorPipeline inmediatamente
   * antes de arbitrate().
   */
  setTitanIntent(intent: Layer0_Titan): void {
    this._layer0 = intent
  }

  /** Devuelve el último intent de Titan. Null antes del primer frame. */
  getTitanIntent(): Layer0_Titan | null {
    return this._layer0
  }

  /** Limpia el intent de Titan (usado en reset / shutdown). */
  clearTitanIntent(): void {
    this._layer0 = null
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 1 — CONSCIOUSNESS (FÓSIL / CORE 3)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Recibe modificadores de SeleneLuxConscious.
   * Es un no-op silencioso mientras consciousnessEnabled === false (CORE 3).
   * Retrocompatible con MasterArbiter.setConsciousnessModifier().
   */
  setConsciousnessModifier(modifier: Layer1_Consciousness): void {
    if (!this.config.consciousnessEnabled) return
    this._layer1 = modifier
  }

  /** Devuelve el modificador activo. Null hasta CORE 3. */
  getConsciousnessModifier(): Layer1_Consciousness | null {
    return this._layer1
  }

  /** Limpia el modificador de consciencia. */
  clearConsciousnessModifier(): void {
    this._layer1 = null
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 2 — MANUAL OVERRIDE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Registra o actualiza el override manual para un fixture.
   *
   * Semántica de merge (WAVE 3479.7 deep merge — retrocompatible con WAVE 2711):
   *   - Si ya existe un override para este fixture, los controles se fusionan
   *     en profundidad: el nuevo payload reemplaza los campos que trae, y
   *     preserva los campos que no trae (no-stomp por categoría de canal).
   *   - phantomChannels se fusionan de forma independiente (WAVE 2084).
   *   - overrideChannels es la unión de ambos sets.
   *
   * NOTA: la lógica de validación de fixtures (si el fixture existe en el
   * registro) es responsabilidad del caller (ArbitrationDirector / MasterArbiter).
   * LayerStateManager es agnóstico al patch de fixtures — sólo guarda overrides.
   */
  setManualOverride(override: Layer2_Manual): void {
    if (
      this._layer2.size >= this.config.maxManualOverrides &&
      !this._layer2.has(override.fixtureId)
    ) {
      console.warn(
        `[LayerStateManager] L2 capacity reached (${this.config.maxManualOverrides}). Override for ${override.fixtureId} rejected.`
      )
      return
    }

    const existing = this._layer2.get(override.fixtureId)

    if (existing) {
      // ── WAVE 3479.7: Deep merge ───────────────────────────────────────────
      const existingControls = existing.controls as Record<string, unknown>
      const newControls = override.controls as Record<string, unknown>

      // Merge phantom channels independently
      const mergedPhantom = {
        ...(existingControls['phantomChannels'] as Record<string, number> ?? {}),
        ...(newControls['phantomChannels'] as Record<string, number> ?? {}),
      }

      const mergedControls: Record<string, unknown> = {
        ...existingControls,
        ...newControls,
      }

      if (Object.keys(mergedPhantom).length > 0) {
        mergedControls['phantomChannels'] = mergedPhantom
      } else {
        delete mergedControls['phantomChannels']
      }

      // Union of channels — WAVE 2711: no stomp, both sets survive
      const mergedChannels = [
        ...new Set([...existing.overrideChannels, ...override.overrideChannels]),
      ] as ChannelType[]

      this._layer2.set(override.fixtureId, {
        ...existing,
        ...override,
        controls: mergedControls as Layer2_Manual['controls'],
        overrideChannels: mergedChannels,
        timestamp: performance.now(),
      })
    } else {
      // ── New override ──────────────────────────────────────────────────────
      this._layer2.set(override.fixtureId, {
        ...override,
        timestamp: performance.now(),
      })
    }
  }

  /** Devuelve el override activo para un fixture, o undefined si no existe. */
  getManualOverride(fixtureId: string): Layer2_Manual | undefined {
    return this._layer2.get(fixtureId)
  }

  /**
   * Verifica si un fixture tiene override activo y, opcionalmente,
   * si ese override incluye un canal concreto.
   */
  hasManualOverride(fixtureId: string, channel?: ChannelType): boolean {
    const ov = this._layer2.get(fixtureId)
    if (!ov) return false
    if (channel !== undefined) return ov.overrideChannels.includes(channel)
    return true
  }

  /**
   * Libera canales específicos (o todos) del override de un fixture.
   *
   * Si `channels` es undefined → release total del fixture.
   * Si `channels` es un array → release parcial; el override sobrevive
   * con los canales restantes.
   *
   * NOTA: La lógica de crossfade, PositionReleaseFade y pattern-annihilation
   * que hoy vive en MasterArbiter.releaseManualOverride() se extraerá en WAVE 3505
   * como servicios independientes (PositionReleaseFader, MovementPatternEngine).
   * Esta clase solo gestiona el estado bruto de Layer 2.
   */
  releaseManualOverride(fixtureId: string, channels?: ChannelType[]): void {
    const ov = this._layer2.get(fixtureId)
    if (!ov) return

    if (!channels) {
      // Full release
      this._layer2.delete(fixtureId)
      return
    }

    // Partial release
    const remaining = ov.overrideChannels.filter(c => !channels.includes(c))
    if (remaining.length === 0) {
      this._layer2.delete(fixtureId)
    } else {
      ov.overrideChannels = remaining
    }
  }

  /** Libera todos los overrides manuales (nuke total de L2). */
  releaseAllManualOverrides(): void {
    this._layer2.clear()
  }

  /**
   * Devuelve los fixture IDs con override activo.
   * WAVE 3190: reutiliza buffer para cero alloc en hot path.
   */
  getManualOverrideFixtureIds(): string[] {
    this._manualIdsBuf.length = 0
    for (const k of this._layer2.keys()) this._manualIdsBuf.push(k)
    return this._manualIdsBuf
  }

  /** Número de overrides manuales activos. */
  getManualOverrideCount(): number {
    return this._layer2.size
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 3 — LEGACY EFFECTS (WAVE 373 — pre-EffectIntents)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Registra un efecto temporal.
   * Si se alcanza el límite, elimina el más antiguo (FIFO).
   * startTime se estampa aquí para garantizar un reloj determinista.
   */
  addEffect(effect: Layer3_Effect): void {
    if (this._layer3Effects.length >= this.config.maxActiveEffects) {
      this._layer3Effects.shift()
    }
    this._layer3Effects.push({ ...effect, startTime: performance.now() })
  }

  /** Elimina un efecto por tipo. */
  removeEffect(type: EffectType): void {
    const idx = this._layer3Effects.findIndex(e => e.type === type)
    if (idx !== -1) this._layer3Effects.splice(idx, 1)
  }

  /** Elimina todos los efectos legacy. */
  clearEffects(): void {
    this._layer3Effects.length = 0
  }

  /** Devuelve una vista de sólo lectura de los efectos activos. */
  getActiveEffects(): readonly Layer3_Effect[] {
    return this._layer3Effects
  }

  /**
   * Expira efectos cuya duración ha vencido.
   * Devuelve los tipos que fueron eliminados (para que el caller emita eventos).
   *
   * WAVE 3190: muta en-place, cero alloc cuando no hay expirados.
   * Debe llamarse UNA VEZ al inicio de cada ciclo de arbitración.
   */
  tickExpiredEffects(now: number): EffectType[] {
    const expired: EffectType[] = []
    let i = this._layer3Effects.length - 1
    while (i >= 0) {
      const fx = this._layer3Effects[i]
      if (now - fx.startTime >= fx.durationMs) {
        expired.push(fx.type)
        this._layer3Effects.splice(i, 1)
      }
      i--
    }
    return expired
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 3 — EFFECT INTENTS (WAVE 2662)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Inyecta el mapa de intents pre-resueltos (zona → fixtureId).
   * Llamado por TitanOrchestrator / OrchestratorPipeline ANTES de arbitrate().
   * Los intents se limpian al final del frame con clearEffectIntents().
   *
   * Retrocompatible con MasterArbiter.setEffectIntents():
   * La lógica de mover-shield (WAVE 3305/3307) y strip-movement (WAVE 3305)
   * es responsabilidad del caller antes de llamar aquí, o será extraída al
   * IntentComposer en WAVE 3505. LayerStateManager sólo almacena.
   */
  setEffectIntents(intents: EffectIntentMap): void {
    this._layer3Intents = intents
  }

  /**
   * Devuelve el EffectIntent para un fixture concreto, o undefined si no existe.
   * Hot path: llamado por ArbitrationDirector para cada fixture × canal.
   */
  getEffectIntent(fixtureId: string): EffectIntent | undefined {
    return this._layer3Intents.get(fixtureId)
  }

  /** Devuelve el mapa completo de intents activos (read-only). */
  getEffectIntentsMap(): Readonly<EffectIntentMap> {
    return this._layer3Intents
  }

  /**
   * Limpia el mapa de intents al final de cada frame.
   * Garantía de frescura: si el Orchestrator no inyecta intents el siguiente
   * frame, ningún efecto queda zombie.
   * WAVE 2662: "frame freshness guarantee".
   */
  clearEffectIntents(): void {
    this._layer3Intents.clear()
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 4 — BLACKOUT
  // ═══════════════════════════════════════════════════════════════════════════

  /** Activa el blackout (L4). Todos los dimmers → 0. Solo MOVE IN BLACK activo. */
  enableBlackout(): void {
    this._layer4Blackout = true
  }

  /** Desactiva el blackout. */
  disableBlackout(): void {
    this._layer4Blackout = false
  }

  /**
   * Alterna el estado del blackout.
   * Retrocompatible con MasterArbiter.toggleBlackout().
   * @returns true si el blackout quedó ACTIVO tras el toggle.
   */
  toggleBlackout(): boolean {
    this._layer4Blackout = !this._layer4Blackout
    return this._layer4Blackout
  }

  /** true si el blackout está activo. */
  isBlackoutActive(): boolean {
    return this._layer4Blackout
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GLOBAL RESET
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Limpia el estado de todas las capas a sus valores por defecto.
   * Usado en shutdown, cambio de vibe radical (Amnesia Protocol), y tests.
   *
   * L4 (blackout) NO se toca: un resetAllLayers no debería levantar un
   * blackout de emergencia activo. Para eso existe disableBlackout() explícito.
   */
  resetAllLayers(): void {
    this._layer0 = null
    this._layer1 = null
    this._layer2.clear()
    this._layer3Effects.length = 0
    this._layer3Intents.clear()
    // L4 intencionalmente preservado — ver doc arriba
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DIAGNOSTICS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Captura instantánea del estado de todas las capas.
   * WAVE 3504 §6: usada por tests de paridad frame-por-frame.
   */
  snapshot(): LayerStateSnapshot {
    // WAVE 3190: buffer reutilizado para effect types
    this._effectTypesBuf.length = 0
    for (const e of this._layer3Effects) this._effectTypesBuf.push(e.type)

    const manualIds: string[] = []
    for (const k of this._layer2.keys()) manualIds.push(k)

    return {
      layer0: this._layer0,
      layer1: this._layer1,
      layer2Count: this._layer2.size,
      layer2FixtureIds: manualIds,
      layer3EffectCount: this._layer3Effects.length,
      layer3EffectTypes: [...this._effectTypesBuf],
      layer3IntentCount: this._layer3Intents.size,
      layer4Blackout: this._layer4Blackout,
    }
  }
}
