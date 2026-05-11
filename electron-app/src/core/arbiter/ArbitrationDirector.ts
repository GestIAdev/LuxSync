/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎬 ARBITRATION DIRECTOR
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 3504 — PASO 3: The Director and the Facade.
 *
 * Esta clase ES el MasterArbiter nuevo. Contiene toda la lógica de composición
 * por frame del monolito original, pero delega el estado de capas (L0–L4) al
 * ILayerStateManager inyectado por constructor.
 *
 * RESPONSABILIDADES DEL DIRECTOR:
 *   ✓ Leer el estado de capas del LayerStateManager (no tiene layer0-4 propios).
 *   ✓ Coordinar arbitrateFixture() por cada fixture registrado.
 *   ✓ Aplicar el CrossfadeEngine sobre los resultados de mergeChannelForFixture().
 *   ✓ Producir el FinalLightingTarget que consume HAL.renderFromTarget().
 *   ✓ Gestionar el estado no-de-capas: fixtures, patterns, formations, playback,
 *     grandMaster, inhibitLimits, outputEnabled, positionReleaseFades, etc.
 *
 * RESPONSABILIDADES DELEGADAS:
 *   • Estado L0–L4               → ILayerStateManager
 *   • Matemática de resolución   → mergeChannelForFixture (consume MergeStrategies)
 *
 * CONTRATOS:
 *   ✓ El singleton MasterArbiter (fachada) entrega esta clase con su constructor
 *     por defecto para mantener retrocompatibilidad con todos los consumidores.
 *   ✓ API pública 100% idéntica al MasterArbiter pre-WAVE-3504.
 *   ✓ TypeScript: 0 errores.
 *
 * @module core/arbiter/ArbitrationDirector
 * @version WAVE 3504.3
 */

import { EventEmitter } from 'events'
import {
  type Layer0_Titan,
  type Layer1_Consciousness,
  type Layer2_Manual,
  type Layer3_Effect,
  type FinalLightingTarget,
  type FixtureLightingTarget,
  type GlobalEffectsState,
  type ChannelType,
  type ChannelValue,
  type MasterArbiterConfig,
  type ArbiterFixture,
  type RGBOutput,
  type EffectIntent,
  type EffectIntentMap,
  type EffectType,
  ControlLayer,
  DEFAULT_ARBITER_CONFIG,
  DEFAULT_MERGE_STRATEGIES,
  getChannelCategory,
  getChannelCategories,
} from './types'
import { mergeChannel, clampDMX } from './merge/MergeStrategies'
import { CrossfadeEngine } from './CrossfadeEngine'
import { resolveZone } from '../zones/ZoneMapper'
import {
  solve as ikSolve,
  solveGroup as ikSolveGroup,
  solveGroupWithFan as ikSolveGroupWithFan,
  buildProfile as ikBuildProfile,
  type Target3D,
  type IKFixtureProfile,
  type IKResult,
  type IKFanResult,
  type SpatialFanMode,
} from '../../engine/movement/InverseKinematicsEngine'
import {
  LayerStateManager,
  type ILayerStateManager,
  type LayerStateConfig,
} from './state/LayerStateManager'

// ─────────────────────────────────────────────────────────────────────────────
// Mover Shield (WAVE 3304) — module-level constant (no re-creation per frame)
// ─────────────────────────────────────────────────────────────────────────────
const MOVER_SHIELD_CHANNELS: ReadonlySet<ChannelType> = new Set<ChannelType>([
  'red', 'green', 'blue', 'white', 'amber',
  'uv', 'cyan', 'magenta', 'yellow', 'color_wheel',
])

// ─────────────────────────────────────────────────────────────────────────────
// Internal types (unchanged from monolith — private impl details)
// ─────────────────────────────────────────────────────────────────────────────

interface ArbiterEvents {
  'output': (target: FinalLightingTarget) => void
  'manualOverride': (fixtureId: string, channels: ChannelType[]) => void
  'manualRelease': (fixtureId: string, channels: ChannelType[]) => void
  'blackout': (active: boolean) => void
  'effectStart': (effect: Layer3_Effect) => void
  'effectEnd': (effectType: string) => void
  'originChanged': (fixtureId: string, origin: { pan: number; tilt: number }) => void
  'error': (error: Error) => void
}

interface PatternConfig {
  type: 'circle' | 'eight' | 'sweep' | 'darkspin' | 'tornado' | 'gravity_bounce' | 'butterfly' | 'heartbeat'
  speed: number
  size: number
  center: { pan: number; tilt: number }
  startTime: number
}

interface GroupFormation {
  fixtureIds: string[]
  center: { pan: number; tilt: number }
  offsets: Map<string, { panOffset: number; tiltOffset: number }>
  fan: number
  timestamp: number
}

// ═══════════════════════════════════════════════════════════════════════════
// ARBITRATION DIRECTOR
// ═══════════════════════════════════════════════════════════════════════════

export class ArbitrationDirector extends EventEmitter {

  // ── Configuration ─────────────────────────────────────────────────────────
  private config: MasterArbiterConfig

  // ── Injected collaborators ─────────────────────────────────────────────────
  /** Layer state owner — L0 through L4. No state is duplicated here. */
  private readonly layerState: ILayerStateManager
  private crossfadeEngine: CrossfadeEngine

  // ── Fixture registry ───────────────────────────────────────────────────────
  private fixtures: Map<string, ArbiterFixture> = new Map()
  private moverCount: number = 0

  // ── Position / color caches ────────────────────────────────────────────────
  private lastKnownPositions: Map<string, { pan: number; tilt: number }> = new Map()
  private lastKnownColors: Map<string, { r: number; g: number; b: number }> = new Map()
  private _moverDiagLastLog = 0

  // ── Ghost Handoff (WAVE 2042.21) ───────────────────────────────────────────
  private fixtureOrigins: Map<string, { pan: number; tilt: number; timestamp: number }> = new Map()

  // ── Position Release Fade (WAVE 2074.3) ───────────────────────────────────
  private positionReleaseFades: Map<string, {
    fromPan: number
    fromTilt: number
    startTime: number
    durationMs: number
  }> = new Map()
  private readonly POSITION_RELEASE_MS = 500

  // ── Playback / Chronos hybrid (WAVE 2063) ─────────────────────────────────
  private playbackActive: boolean = false
  private currentPlaybackFrame: Map<string, FixtureLightingTarget> = new Map()
  private _playbackMeta: { hasActiveVibe: boolean; vibeId: string | null } = {
    hasActiveVibe: false,
    vibeId: null,
  }

  // ── IK processed fixtures (WAVE 2604) ─────────────────────────────────────
  private _ikProcessedFixtures: Set<string> = new Set()

  // ── Grand Master & Inhibit (WAVE 376 / WAVE 3270) ─────────────────────────
  private grandMaster: number = 1.0
  private inhibitLimits: Map<string, number> = new Map()

  // ── Output Gate (WAVE 1132) ────────────────────────────────────────────────
  // ⚡ WAVE 4612: Revertido. Arrancar en SAFE MODE (ARMED=false). La UI no
  // depende de este flag — el hot-frame se emite antes del output gate.
  private _outputEnabled: boolean = false
  private _lastOutputGateChange: {
    enabled: boolean; atMs: number; label?: string; stack?: string
  } | null = null

  // ── Grand Master Speed (WAVE 2495) ────────────────────────────────────────
  private grandMasterSpeed: number = 1.0

  // ── Patterns & Formations ──────────────────────────────────────────────────
  private activePatterns: Map<string, PatternConfig> = new Map()
  private activeFormations: Map<string, GroupFormation> = new Map()

  // ── Frame tracking ─────────────────────────────────────────────────────────
  private frameNumber: number = 0
  private lastOutputTimestamp: number = 0

  // ── WAVE 2770: BLACK BOX — Layer 2 loss detector ──────────────────────────
  private _prevFrameOverrideIds: Set<string> = new Set()
  private _currentOverrideIdsBuf: Set<string> = new Set()
  private _manualFixtureIdsBuf: string[] = []
  private _activeEffectTypesBuf: EffectType[] = []
  private _playbackAffectedBuf: Set<string> = new Set()
  private _layer2LastModStack: Map<string, string> = new Map()
  private _blackBoxThrottleMs: number = 0
  private _layerLossThrottleMs: number = 0
  private _layerLossPending: string[] = []
  private _traceLastArbiterLogAtMs = 0
  private _lastOutputEnabled: boolean = false  // for gate change detection

  // ── WAVE 2910 WIRETAP ──────────────────────────────────────────────────────
  private _wiretap_prevHadPosition: Map<string, boolean> = new Map()

  // ─────────────────────────────────────────────────────────────────────────
  // CONSTRUCTOR
  // ─────────────────────────────────────────────────────────────────────────

  constructor(
    config: Partial<MasterArbiterConfig> = {},
    layerState?: ILayerStateManager
  ) {
    super()
    this.config = { ...DEFAULT_ARBITER_CONFIG, ...config }
    this.crossfadeEngine = new CrossfadeEngine(this.config.defaultCrossfadeMs)

    // If a pre-built LayerStateManager is injected, use it.
    // Otherwise, create a default one derived from config.
    this.layerState = layerState ?? new LayerStateManager({
      maxManualOverrides: this.config.maxManualOverrides,
      maxActiveEffects: this.config.maxActiveEffects,
      consciousnessEnabled: this.config.consciousnessEnabled,
    })
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FIXTURE MANAGEMENT (identical to monolith — fixture data is Director state)
  // ═══════════════════════════════════════════════════════════════════════════

  setFixtures(fixtures: ArbiterFixture[]): void {
    this.fixtures.clear()
    let moverCount = 0
    let totalChannels = 0

    for (const fixture of fixtures) {
      const id = fixture.id ?? fixture.name
      const zone = fixture.zone || 'NO_ZONE'
      const name = fixture.name || 'NO_NAME'

      this.fixtures.set(id, fixture)
      if (this.isMovingFixture(fixture)) moverCount++
      const chCount = (fixture.channels as any)?.length ?? 0
      totalChannels += chCount
    }

    this.moverCount = moverCount
  }

  private isMovingFixture(fixture: ArbiterFixture): boolean {
    if (!fixture) return false
    const type = (fixture.type || '').toLowerCase()
    const name = (fixture.name || '').toLowerCase()
    const hasPanTilt = (fixture.channels as any)?.some((c: any) =>
      c.type === 'pan' || c.type === 'tilt'
    )
    return hasPanTilt || type.includes('moving') || type.includes('mover') ||
      name.includes('moving') || name.includes('mover') || name.includes('scan')
  }

  getFixture(id: string): ArbiterFixture | undefined {
    return this.fixtures.get(id)
  }

  getFixtureIds(): string[] {
    return Array.from(this.fixtures.keys())
  }

  getFixturesForZoneMapping(): Array<{ id: string; zone: string; position?: { x: number }; enabled?: boolean }> {
    return Array.from(this.fixtures.values()).map(f => ({
      id: f.id ?? f.name,
      zone: f.zone || '',
      position: f.position,
      enabled: (f as any).enabled !== false,
    }))
  }

  getFixtureIdsByZone(effectZone: string): string[] {
    const fixtures = this.getFixturesForZoneMapping()
    const result = resolveZone(effectZone, fixtures)

    if (result.length === 0) {
      console.warn(
        `[ArbitrationDirector] ⚠️ WAVE 2543.4: Zone "${effectZone}" matched 0 fixtures — falling back to wildcard`
      )
      return this.getFixtureIds()
    }

    return result
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 0 — TITAN AI  (delegated to layerState)
  // ═══════════════════════════════════════════════════════════════════════════

  setTitanIntent(intent: Layer0_Titan): void {
    this.layerState.setTitanIntent(intent)
  }

  getTitanIntent(): Layer0_Titan | null {
    return this.layerState.getTitanIntent()
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 1 — CONSCIOUSNESS (delegated to layerState)
  // ═══════════════════════════════════════════════════════════════════════════

  setConsciousnessModifier(modifier: Layer1_Consciousness): void {
    this.layerState.setConsciousnessModifier(modifier)
  }

  clearConsciousnessModifier(): void {
    this.layerState.clearConsciousnessModifier()
  }

  getConsciousnessState(): Layer1_Consciousness | null {
    return this.layerState.getConsciousnessModifier()
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 2 — MANUAL OVERRIDE (delegated + Director-side side-effects)
  // ═══════════════════════════════════════════════════════════════════════════

  setManualOverride(override: Layer2_Manual): void {
    if (this.config.debug) {
      console.log(`[ArbitrationDirector] UI mandó control a ${override.fixtureId}:`, override.controls)
    }

    if (!this.fixtures.has(override.fixtureId)) {
      console.warn(`[ArbitrationDirector] ❌ Unknown fixture: ${override.fixtureId}`)
      console.warn(`[ArbitrationDirector] 📋 Known fixtures: ${Array.from(this.fixtures.keys()).join(', ')}`)
      return
    }

    // WAVE 2772: UNDEFINED SANITIZER
    const sanitizedControls: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(override.controls as Record<string, unknown>)) {
      if (val !== undefined) sanitizedControls[key] = val
    }
    override = { ...override, controls: sanitizedControls as Layer2_Manual['controls'] }
    override = {
      ...override,
      overrideChannels: override.overrideChannels.filter(
        ch => (sanitizedControls as Record<string, unknown>)[ch] !== undefined || ch === 'dimmer'
      ) as ChannelType[],
    }

    this.layerState.setManualOverride(override)
    this._layer2LastModStack.set(override.fixtureId, `DIR @ frame ${this.frameNumber} | src=${override.source}`)

    // WAVE 2497: DIMMER AUTO-TAKE
    const finalOverride = this.layerState.getManualOverride(override.fixtureId)
    if (finalOverride && !finalOverride.overrideChannels.includes('dimmer' as ChannelType)) {
      const titanValues = this.getTitanValuesForFixture(override.fixtureId)
      if (titanValues.dimmer === 0) {
        finalOverride.controls = { ...finalOverride.controls, dimmer: 255 } as any
        finalOverride.overrideChannels = [...finalOverride.overrideChannels, 'dimmer' as ChannelType]
      }
    }

    this.emit('manualOverride', override.fixtureId, override.overrideChannels)
  }

  applySpatialTarget(
    target: Target3D,
    fixtureIds: string[],
    fanMode: SpatialFanMode = 'converge',
    fanAmplitude: number = 0
  ): Map<string, IKFanResult> {
    const profiles: IKFixtureProfile[] = []
    const validIds: string[] = []

    for (const id of fixtureIds) {
      const fixture = this.fixtures.get(id)
      if (!fixture || !fixture.position) continue

      const cal = (fixture as any).calibration
      const physics = (fixture as any).physics

      const profile = ikBuildProfile(
        id,
        fixture.position,
        (fixture as any).rotation,
        (fixture as any).installationOrientation ?? 'ceiling',
        cal ? {
          panOffset: cal.panOffset ?? 0,
          tiltOffset: cal.tiltOffset ?? 0,
          panInvert: cal.panInvert ?? false,
          tiltInvert: cal.tiltInvert ?? false,
        } : undefined,
        (fixture as any).panRangeDeg,
        (fixture as any).tiltRangeDeg,
        physics?.tiltLimits
      )
      profiles.push(profile)
      validIds.push(id)
    }

    if (profiles.length === 0) return new Map()

    const currentPanMap = new Map<string, number>()
    for (const id of validIds) {
      const lastPos = this.lastKnownPositions.get(id)
      if (lastPos) currentPanMap.set(id, lastPos.pan)
    }

    const results = ikSolveGroupWithFan(
      profiles,
      target,
      fanMode,
      fanAmplitude,
      currentPanMap.size > 0 ? currentPanMap : null
    )

    for (const id of validIds) {
      const ikResult = results.get(id)
      if (!ikResult) continue
      this.setManualOverride({
        fixtureId: id,
        controls: { pan: ikResult.pan, tilt: ikResult.tilt },
        overrideChannels: ['pan', 'tilt'],
        mode: 'absolute',
        source: 'ui_joystick',
        priority: 1,
        autoReleaseMs: 0,
        releaseTransitionMs: this.config.defaultCrossfadeMs,
        timestamp: performance.now(),
      })
      this._ikProcessedFixtures.add(id)
    }

    return results
  }

  releaseSpatialTarget(fixtureIds: string[]): void {
    for (const id of fixtureIds) {
      this._ikProcessedFixtures.delete(id)
      this.releaseManualOverride(id, ['pan', 'tilt'])
    }
  }

  releaseManualOverride(fixtureId: string, channels?: ChannelType[]): void {
    const override = this.layerState.getManualOverride(fixtureId)
    if (!override) return

    const channelsToRelease = channels ?? override.overrideChannels
    const titanValues = this.getTitanValuesForFixture(fixtureId)

    for (const channel of channelsToRelease) {
      const currentValue = this.getManualChannelValue(override, channel)
      const targetValue = titanValues[channel] ?? 0
      this.crossfadeEngine.startTransition(
        fixtureId,
        channel,
        currentValue,
        targetValue,
        override.releaseTransitionMs || this.config.defaultCrossfadeMs
      )
    }

    const releasingMovement = channelsToRelease.includes('pan' as ChannelType) ||
      channelsToRelease.includes('tilt' as ChannelType)

    if (!channels || releasingMovement) {
      this._ikProcessedFixtures.delete(fixtureId)

      const lastManualPan = override.controls.pan ?? 128
      const lastManualTilt = override.controls.tilt ?? 128
      this.positionReleaseFades.set(fixtureId, {
        fromPan: lastManualPan,
        fromTilt: lastManualTilt,
        startTime: performance.now(),
        durationMs: this.POSITION_RELEASE_MS,
      })

      if (this.activePatterns.has(fixtureId)) this.activePatterns.delete(fixtureId)
      if (this.fixtureOrigins.has(fixtureId)) this.fixtureOrigins.delete(fixtureId)
    }

    this.layerState.releaseManualOverride(fixtureId, channels)
    this._layer2LastModStack.set(fixtureId, `EXPLICIT RELEASE @ frame ${this.frameNumber}`)
    this.emit('manualRelease', fixtureId, channelsToRelease)
  }

  releaseAllManualOverrides(): void {
    for (const fixtureId of this.layerState.getManualOverrideFixtureIds()) {
      this.releaseManualOverride(fixtureId)
    }
  }

  getManualOverride(fixtureId: string): Layer2_Manual | undefined {
    return this.layerState.getManualOverride(fixtureId)
  }

  hasManualOverride(fixtureId: string, channel?: ChannelType): boolean {
    return this.layerState.hasManualOverride(fixtureId, channel)
  }

  getManualOverrideFixtures(): string[] {
    return this.layerState.getManualOverrideFixtureIds()
  }

  setFixtureOrigin(fixtureId: string, pan: number, tilt: number): void {
    this.fixtureOrigins.set(fixtureId, { pan, tilt, timestamp: performance.now() })
    this.emit('originChanged', fixtureId, { pan, tilt })
  }

  getFixtureOrigin(fixtureId: string): { pan: number; tilt: number } | null {
    return this.fixtureOrigins.get(fixtureId) ?? null
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 3 — EFFECTS (delegated to layerState)
  // ═══════════════════════════════════════════════════════════════════════════

  addEffect(effect: Layer3_Effect): void {
    this.layerState.addEffect(effect)
    this.emit('effectStart', effect)
  }

  removeEffect(type: string): void {
    this.layerState.removeEffect(type as EffectType)
    this.emit('effectEnd', type)
  }

  clearEffects(): void {
    this.layerState.clearEffects()
  }

  setEffectIntents(intents: EffectIntentMap): void {
    // WAVE 3305: Strip movement from ALL effect intents
    // WAVE 3307: Strip color/white/amber from movers on global effects
    for (const [fixtureId, intent] of intents) {
      delete intent.movement

      if (intent.mixBus === 'global' && !intent.overrideMoverShield) {
        const fixtureMeta = this.fixtures.get(fixtureId)
        if (fixtureMeta && this.isMovingFixture(fixtureMeta)) {
          delete intent.color
          delete intent.white
          delete intent.amber
        }
      }
    }
    this.layerState.setEffectIntents(intents)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 4 — BLACKOUT (delegated to layerState + event emit)
  // ═══════════════════════════════════════════════════════════════════════════

  setBlackout(active: boolean): void {
    const changed = this.layerState.isBlackoutActive() !== active
    if (active) {
      this.layerState.enableBlackout()
    } else {
      this.layerState.disableBlackout()
    }
    if (changed) {
      this.emit('blackout', active)
    }
  }

  toggleBlackout(): boolean {
    const next = this.layerState.toggleBlackout()
    this.emit('blackout', next)
    return next
  }

  isBlackoutActive(): boolean {
    return this.layerState.isBlackoutActive()
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GRAND MASTER + INHIBIT (Director state — not layer state)
  // ═══════════════════════════════════════════════════════════════════════════

  setGrandMaster(value: number): void {
    this.grandMaster = Math.max(0, Math.min(1, value))
    if (this.config.debug) {
      console.log(`[ArbitrationDirector] Grand Master: ${Math.round(this.grandMaster * 100)}%`)
    }
  }

  getGrandMaster(): number {
    return this.grandMaster
  }

  setInhibitLimit(fixtureIds: string[], value: number): void {
    const clamped = Math.max(0, Math.min(1, value))
    for (const id of fixtureIds) {
      this.inhibitLimits.set(id, clamped)
    }
  }

  getInhibitLimit(fixtureId: string): number {
    return this.inhibitLimits.get(fixtureId) ?? 1.0
  }

  clearInhibitLimit(fixtureIds: string[]): void {
    for (const id of fixtureIds) {
      this.inhibitLimits.delete(id)
    }
  }

  getInhibitLimits(): Map<string, number> {
    return this.inhibitLimits
  }

  setGrandMasterSpeed(value: number): void {
    this.grandMasterSpeed = Math.max(0.1, Math.min(2.0, value))
  }

  getGrandMasterSpeed(): number {
    return this.grandMasterSpeed
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OUTPUT GATE (WAVE 1132)
  // ═══════════════════════════════════════════════════════════════════════════

  setOutputEnabled(enabled: boolean): void {
    const changed = this._outputEnabled !== enabled
    this._outputEnabled = enabled
    if (changed) {
      this._lastOutputGateChange = { enabled, atMs: performance.now() }
      console.log(`[ArbitrationDirector] 🚦 Output ${enabled ? 'ENABLED (LIVE)' : 'DISABLED (ARMED)'}`)
    }
  }

  setOutputEnabledTagged(enabled: boolean, label: string): void {
    const changed = this._outputEnabled !== enabled
    this._outputEnabled = enabled
    if (changed) {
      this._lastOutputGateChange = { enabled, atMs: performance.now(), label, stack: new Error().stack }
    }
  }

  isOutputEnabled(): boolean {
    return this._outputEnabled
  }

  toggleOutput(): boolean {
    this.setOutputEnabled(!this._outputEnabled)
    return this._outputEnabled
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PATTERN ENGINE (WAVE 376)
  // ═══════════════════════════════════════════════════════════════════════════

  setPattern(fixtureIds: string[], pattern: Omit<PatternConfig, 'startTime'>): void {
    const startTime = performance.now()
    for (const id of fixtureIds) {
      if (!this.fixtures.has(id)) continue
      this.activePatterns.set(id, { ...pattern, startTime })
    }
  }

  clearPattern(fixtureIds: string[]): void {
    for (const id of fixtureIds) {
      this.activePatterns.delete(id)
    }
  }

  updatePatternParams(fixtureIds: string[], speed: number, size: number): void {
    for (const id of fixtureIds) {
      const p = this.activePatterns.get(id)
      if (p) {
        p.speed = speed
        p.size = size
      }
    }
  }

  getPattern(fixtureId: string): PatternConfig | undefined {
    return this.activePatterns.get(fixtureId)
  }

  getCurrentPosition(fixtureId: string): { pan: number; tilt: number } {
    const manual = this.layerState.getManualOverride(fixtureId)
    if (manual?.controls.pan !== undefined && manual?.controls.tilt !== undefined) {
      return { pan: manual.controls.pan, tilt: manual.controls.tilt }
    }
    const last = this.lastKnownPositions.get(fixtureId)
    return last ?? { pan: 128, tilt: 128 }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP FORMATIONS (WAVE 376)
  // ═══════════════════════════════════════════════════════════════════════════

  setGroupFormation(
    groupId: string,
    fixtureIds: string[],
    center: { pan: number; tilt: number },
    fan: number
  ): void {
    const offsets = new Map<string, { panOffset: number; tiltOffset: number }>()
    const count = fixtureIds.length
    for (let i = 0; i < count; i++) {
      const t = count > 1 ? (i / (count - 1)) * 2 - 1 : 0
      offsets.set(fixtureIds[i], { panOffset: t * 64, tiltOffset: 0 })
    }
    this.activeFormations.set(groupId, {
      fixtureIds,
      center,
      offsets,
      fan,
      timestamp: performance.now(),
    })
  }

  clearGroupFormation(groupId: string): void {
    this.activeFormations.delete(groupId)
  }

  getGroupFormation(groupId: string): GroupFormation | undefined {
    return this.activeFormations.get(groupId)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PLAYBACK / CHRONOS HYBRID (WAVE 2063)
  // ═══════════════════════════════════════════════════════════════════════════

  setPlaybackFrame(
    fixtures: FixtureLightingTarget[],
    meta?: { hasActiveVibe: boolean; vibeId: string | null }
  ): void {
    this.currentPlaybackFrame.clear()
    for (const fixture of fixtures) {
      this.currentPlaybackFrame.set(fixture.fixtureId, fixture)
    }
    this.playbackActive = true
    this._playbackMeta = meta ?? { hasActiveVibe: false, vibeId: null }
  }

  stopPlayback(): void {
    this.playbackActive = false
    this.currentPlaybackFrame.clear()
    this._playbackMeta = { hasActiveVibe: false, vibeId: null }
    console.log('[ArbitrationDirector] 🎬 PLAYBACK STOPPED: Returning to normal layer arbitration')
  }

  isPlaybackActive(): boolean {
    return this.playbackActive
  }

  getPlaybackAffectedFixtureIds(): Set<string> {
    this._playbackAffectedBuf.clear()
    if (this.playbackActive) {
      for (const k of this.currentPlaybackFrame.keys()) {
        this._playbackAffectedBuf.add(k)
      }
    }
    return this._playbackAffectedBuf
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN ARBITRATION — THE HEART OF THE DIRECTOR
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 🎭 Produces the FinalLightingTarget for this frame.
   *
   * Per-frame pipeline:
   *   1. Read layer state from ILayerStateManager.
   *   2. Expire legacy Layer 3 effects.
   *   3. For each fixture: arbitrateFixture(id, now).
   *   4. Apply Chronos hybrid overlay if playback is active.
   *   5. Clear EffectIntents (frame freshness guarantee — WAVE 2662).
   *   6. Emit 'output' and return FinalLightingTarget.
   */
  arbitrate(): FinalLightingTarget {
    const now = performance.now()
    this.frameNumber++

    // ── WAVE 2063: HYBRID (PLAYBACK) PATH ──────────────────────────────────
    if (this.playbackActive) {
      const expired = this.layerState.tickExpiredEffects(now)
      for (const t of expired) this.emit('effectEnd', t)

      const allFixtureIds = Array.from(this.fixtures.keys())
      const hybridTargets: FixtureLightingTarget[] = []

      for (const fixtureId of allFixtureIds) {
        const titanTarget = this.arbitrateFixture(fixtureId, now)
        const chronosData = this.currentPlaybackFrame.get(fixtureId)

        if (chronosData) {
          const blendMode = (chronosData as any).blendMode ?? 'HTP'
          const chronosDim = chronosData.dimmer ?? 0
          const titanDim = titanTarget.dimmer

          let finalDimmer: number
          if (blendMode === 'LTP') {
            finalDimmer = chronosDim
          } else if (blendMode === 'ADD') {
            finalDimmer = clampDMX(titanDim + chronosDim)
          } else {
            finalDimmer = Math.max(titanDim, chronosDim)
          }

          const chronosHasColor = !!(
            chronosData.color.r || chronosData.color.g || chronosData.color.b
          )
          const colorTouched = chronosHasColor

          let finalColor: RGBOutput
          if (blendMode === 'ADD' && chronosHasColor) {
            finalColor = {
              r: clampDMX(titanTarget.color.r + chronosData.color.r),
              g: clampDMX(titanTarget.color.g + chronosData.color.g),
              b: clampDMX(titanTarget.color.b + chronosData.color.b),
            }
          } else if (chronosHasColor) {
            finalColor = {
              r: clampDMX(chronosData.color.r),
              g: clampDMX(chronosData.color.g),
              b: clampDMX(chronosData.color.b),
            }
          } else {
            finalColor = titanTarget.color
          }

          const finalColorWheel = (blendMode === 'LTP' && colorTouched)
            ? (chronosData.color_wheel ?? 0)
            : (chronosData.color_wheel ?? titanTarget.color_wheel)

          const hybridTarget: FixtureLightingTarget = {
            fixtureId,
            dimmer: finalDimmer,
            color: finalColor,
            pan: titanTarget.pan,
            tilt: titanTarget.tilt,
            zoom: titanTarget.zoom,
            speed: titanTarget.speed,
            focus: titanTarget.focus,
            color_wheel: finalColorWheel,
            phantomChannels: titanTarget.phantomChannels,
            _controlSources: {
              ...titanTarget._controlSources,
              dimmer: ControlLayer.EFFECTS,
              red: ControlLayer.EFFECTS,
              green: ControlLayer.EFFECTS,
              blue: ControlLayer.EFFECTS,
            },
            _crossfadeActive: titanTarget._crossfadeActive,
            _crossfadeProgress: titanTarget._crossfadeProgress,
            _ikProcessed: titanTarget._ikProcessed,
          }

          hybridTargets.push(hybridTarget)

          const safePan = Number.isFinite(hybridTarget.pan) ? hybridTarget.pan : 128
          const safeTilt = Number.isFinite(hybridTarget.tilt) ? hybridTarget.tilt : 128
          this.lastKnownPositions.set(fixtureId, { pan: safePan, tilt: safeTilt })
        } else {
          hybridTargets.push(titanTarget)
        }
      }

      const output: FinalLightingTarget = {
        fixtures: hybridTargets,
        globalEffects: {
          strobeActive: false,
          strobeSpeed: 0,
          blinderActive: false,
          blinderIntensity: 0,
          blackoutActive: false,
          freezeActive: false,
        },
        timestamp: now,
        frameNumber: this.frameNumber,
        _layerActivity: {
          titanActive: this._playbackMeta.hasActiveVibe,
          titanVibeId: this._playbackMeta.vibeId ?? 'PLAYBACK_COLOR_ONLY',
          consciousnessActive: false,
          consciousnessStatus: undefined,
          manualOverrideCount: 0,
          manualFixtureIds: [],
          activeEffects: [],
        },
      }

      this.lastOutputTimestamp = now
      this.emit('output', output)
      return output
    }

    // ── NORMAL ARBITRATION PATH ────────────────────────────────────────────
    const expired = this.layerState.tickExpiredEffects(now)
    for (const t of expired) this.emit('effectEnd', t)

    // WAVE 2228: Armed-state logging
    if (!this._outputEnabled && this.frameNumber % 150 === 0) {
      const last = this._lastOutputGateChange
      console.log(
        `[ArbitrationDirector] 🚦 ARMED STATE: Output DISABLED | DMX gate active in HAL | Press GO to enable DMX`,
        { outputEnabled: this._outputEnabled, lastGateChange: last ?? null }
      )
    }

    // WAVE 2770: LAYER_LOSS DETECTOR
    this._currentOverrideIdsBuf.clear()
    for (const k of this.layerState.getManualOverrideFixtureIds()) {
      this._currentOverrideIdsBuf.add(k)
    }
    for (const prevId of this._prevFrameOverrideIds) {
      if (!this._currentOverrideIdsBuf.has(prevId)) {
        this._layerLossPending.push(prevId)
      }
    }
    if (this._layerLossPending.length > 0 && now - this._layerLossThrottleMs > 2000) {
      console.warn(
        `[📡 LAYER_LOSS] 🚨 ${this._layerLossPending.length} fixture(s) lost Layer 2 override: ` +
        `[${this._layerLossPending.join(', ')}] | frame ${this.frameNumber}`
      )
      this._layerLossPending.length = 0
      this._layerLossThrottleMs = now
    }
    const _swapBuf = this._prevFrameOverrideIds
    this._prevFrameOverrideIds = this._currentOverrideIdsBuf
    this._currentOverrideIdsBuf = _swapBuf

    // Arbitrate each fixture
    const fixtureTargets: FixtureLightingTarget[] = []
    for (const [fixtureId] of this.fixtures) {
      fixtureTargets.push(this.arbitrateFixture(fixtureId, now))
    }

    // WAVE 2770: GHOST_WHITE DETECTOR
    const titanIntent = this.layerState.getTitanIntent()
    if (now - this._blackBoxThrottleMs > 2000) {
      const palette = titanIntent?.intent?.palette
      const paletteHasWhite = palette
        ? [palette.primary, palette.secondary, palette.accent, palette.ambient].some(
            c => c && c.s < 0.05 && c.l > 0.9
          )
        : false

      for (const target of fixtureTargets) {
        const { r, g, b } = target.color
        if (r >= 250 && g >= 250 && b >= 250 && !paletteHasWhite) {
          const src = target._controlSources?.red ?? target._controlSources?.green ?? -1
          const srcLabel = src === ControlLayer.MANUAL ? 'MANUAL'
            : src === ControlLayer.EFFECTS ? 'EFFECTS'
            : src === ControlLayer.TITAN_AI ? 'TITAN_AI'
            : `UNKNOWN(${src})`
          console.warn(
            `[📡 GHOST_WHITE] 👻 ${target.fixtureId} ` +
            `RGB(${r},${g},${b}) src=${srcLabel} vibe=${titanIntent?.vibeId ?? 'NONE'} ` +
            `frame=${this.frameNumber}`
          )
          this._blackBoxThrottleMs = now
          break
        }
      }
    }

    const globalEffects = this.buildGlobalEffectsState()

    this._manualFixtureIdsBuf.length = 0
    for (const k of this.layerState.getManualOverrideFixtureIds()) this._manualFixtureIdsBuf.push(k)

    this._activeEffectTypesBuf.length = 0
    for (const e of this.layerState.getActiveEffects()) this._activeEffectTypesBuf.push(e.type)

    const layer1 = this.layerState.getConsciousnessModifier()

    const output: FinalLightingTarget = {
      fixtures: fixtureTargets,
      globalEffects,
      timestamp: now,
      frameNumber: this.frameNumber,
      _layerActivity: {
        titanActive: titanIntent !== null,
        titanVibeId: titanIntent?.vibeId ?? '',
        consciousnessActive: layer1?.active ?? false,
        consciousnessStatus: layer1?.status,
        manualOverrideCount: this.layerState.getManualOverrideCount(),
        manualFixtureIds: this._manualFixtureIdsBuf,
        activeEffects: this._activeEffectTypesBuf,
        effectIntentCount: this.layerState.getEffectIntentsMap().size,
      },
    }

    // WAVE 2662: Frame freshness guarantee — clear intents after arbitration
    this.layerState.clearEffectIntents()

    this.lastOutputTimestamp = now
    this.emit('output', output)
    return output
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE: PER-FIXTURE ARBITRATION
  // ═══════════════════════════════════════════════════════════════════════════

  private arbitrateFixture(fixtureId: string, now: number): FixtureLightingTarget {
    const controlSources: Partial<Record<ChannelType, ControlLayer>> = {}
    const manualOverride = this.layerState.getManualOverride(fixtureId)
    const titanValues = this.getTitanValuesForFixture(fixtureId)

    const dimmer = this.mergeChannelForFixture(fixtureId, 'dimmer', titanValues, manualOverride, now, controlSources)
    const red = this.mergeChannelForFixture(fixtureId, 'red', titanValues, manualOverride, now, controlSources)
    const green = this.mergeChannelForFixture(fixtureId, 'green', titanValues, manualOverride, now, controlSources)
    const blue = this.mergeChannelForFixture(fixtureId, 'blue', titanValues, manualOverride, now, controlSources)

    const { pan: rawPan, tilt: rawTilt } = this.getAdjustedPosition(fixtureId, titanValues, manualOverride, now)

    // WAVE 3305: Movement strictly from L0/L2 — effects cannot move fixtures
    const effectAdjustedPan = rawPan
    const effectAdjustedTilt = rawTilt

    // WAVE 2232: VIP PASSPORT — stamp pan/tilt controlSources
    if (manualOverride?.overrideChannels.includes('pan')) {
      controlSources['pan'] = ControlLayer.MANUAL
    } else {
      controlSources['pan'] = ControlLayer.TITAN_AI
    }
    if (manualOverride?.overrideChannels.includes('tilt')) {
      controlSources['tilt'] = ControlLayer.MANUAL
    } else {
      controlSources['tilt'] = ControlLayer.TITAN_AI
    }

    // WAVE 2910 WIRETAP
    const nowHasPosition = !!(
      manualOverride?.overrideChannels.includes('pan') ||
      manualOverride?.overrideChannels.includes('tilt')
    )
    const prevHadPosition = this._wiretap_prevHadPosition.get(fixtureId) ?? false
    if (prevHadPosition && !nowHasPosition) {
      console.trace(
        `🚨 [WIRETAP WAVE 2910] TRANSICIÓN: ${fixtureId} pasó de MANUAL a ` +
        `${manualOverride ? 'override-sin-pos' : 'SIN-OVERRIDE'} | frame ${this.frameNumber}`
      )
    }
    this._wiretap_prevHadPosition.set(fixtureId, nowHasPosition)

    // WAVE 2074.3: POSITION RELEASE FADE
    let pan = effectAdjustedPan
    let tilt = effectAdjustedTilt
    const releaseFade = this.positionReleaseFades.get(fixtureId)
    if (releaseFade) {
      const elapsed = now - releaseFade.startTime
      if (elapsed >= releaseFade.durationMs) {
        this.positionReleaseFades.delete(fixtureId)
      } else {
        const t = elapsed / releaseFade.durationMs
        const smoothT = t * t * (3 - 2 * t)
        pan = releaseFade.fromPan + (effectAdjustedPan - releaseFade.fromPan) * smoothT
        tilt = releaseFade.fromTilt + (effectAdjustedTilt - releaseFade.fromTilt) * smoothT
      }
    }

    const zoom = this.mergeChannelForFixture(fixtureId, 'zoom', titanValues, manualOverride, now, controlSources)
    const focus = this.mergeChannelForFixture(fixtureId, 'focus', titanValues, manualOverride, now, controlSources)
    const speed = this.mergeChannelForFixture(fixtureId, 'speed', titanValues, manualOverride, now, controlSources)
    const color_wheel = this.mergeChannelForFixture(fixtureId, 'color_wheel', titanValues, manualOverride, now, controlSources)

    // WAVE 2084: PHANTOM PANEL
    const phantomChannels: Record<string, number> = {}
    const NATIVE_CHANNELS = new Set([
      'dimmer', 'red', 'green', 'blue', 'pan', 'tilt',
      'zoom', 'focus', 'speed', 'color_wheel',
    ])
    const fixtureData = this.fixtures.get(fixtureId)
    const channelDefs: Array<{ type: string; name?: string; customName?: string; index?: number; defaultValue?: number }> =
      (fixtureData as any)?.channelDefinitions ?? (fixtureData as any)?.channels ?? []

    for (const ch of channelDefs) {
      if (NATIVE_CHANNELS.has(ch.type)) continue
      const labelKey = (ch.customName || ch.name || '').trim()
      const phantomKey = (ch.type === 'custom' || ch.type === 'unknown')
        ? (labelKey || `unknown_${ch.index ?? 0}`)
        : ch.type

      const manualPhantomValue =
        manualOverride?.controls?.phantomChannels?.[phantomKey] ??
        (labelKey ? manualOverride?.controls?.phantomChannels?.[labelKey] : undefined) ??
        manualOverride?.controls?.phantomChannels?.[ch.type] ??
        (manualOverride?.overrideChannels?.includes(ch.type as ChannelType)
          ? (manualOverride.controls as Record<string, number>)[ch.type]
          : undefined)

      if (manualPhantomValue !== undefined) {
        phantomChannels[phantomKey] = clampDMX(manualPhantomValue)
        controlSources[ch.type as ChannelType] = ControlLayer.MANUAL
      } else {
        phantomChannels[phantomKey] = ch.defaultValue ?? 0
        controlSources[ch.type as ChannelType] = ControlLayer.TITAN_AI
      }
    }

    const crossfadeActive = this.isAnyCrossfadeActive(fixtureId)
    const crossfadeProgress = crossfadeActive ? this.getAverageCrossfadeProgress(fixtureId) : 0

    // Grand Master + Inhibit (WAVE 376 / WAVE 3270)
    const inhibitLimit = this.inhibitLimits.get(fixtureId) ?? 1.0
    const dimmerfinal = clampDMX(dimmer * this.grandMaster * inhibitLimit)

    // WAVE 2750: NaN BOMB SHIELD
    const lastPos = this.lastKnownPositions.get(fixtureId)
    const safePan = Number.isFinite(pan) ? pan : (lastPos?.pan ?? 128)
    const safeTilt = Number.isFinite(tilt) ? tilt : (lastPos?.tilt ?? 128)

    const target = {
      fixtureId,
      dimmer: dimmerfinal,
      color: {
        r: clampDMX(red),
        g: clampDMX(green),
        b: clampDMX(blue),
      },
      pan: clampDMX(safePan),
      tilt: clampDMX(safeTilt),
      zoom: clampDMX(zoom),
      focus: clampDMX(focus),
      speed: clampDMX(speed),
      color_wheel: clampDMX(color_wheel),
      phantomChannels,
      _controlSources: controlSources,
      _crossfadeActive: crossfadeActive,
      _crossfadeProgress: crossfadeProgress,
      _ikProcessed: this._ikProcessedFixtures.has(fixtureId),
    }

    // Ghost Protocol — cache position
    const safePanT = Number.isFinite(target.pan) ? target.pan : 128
    const safeTiltT = Number.isFinite(target.tilt) ? target.tilt : 128
    this.lastKnownPositions.set(fixtureId, { pan: safePanT, tilt: safeTiltT })

    // WAVE 3240: MOVE IN BLACK — L4 applies dimmer=0 ONLY
    const blackoutActive = this.layerState.isBlackoutActive()
    if (blackoutActive) {
      target.dimmer = 0
      target._controlSources['dimmer'] = ControlLayer.BLACKOUT
      if (target.phantomChannels['shutter'] !== undefined) {
        target.phantomChannels['shutter'] = 0
        target._controlSources['shutter' as ChannelType] = ControlLayer.BLACKOUT
      }
    }

    return target
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE: CHANNEL MERGE
  // ═══════════════════════════════════════════════════════════════════════════

  private mergeChannelForFixture(
    fixtureId: string,
    channel: ChannelType,
    titanValues: Record<ChannelType, number>,
    manualOverride: Layer2_Manual | undefined,
    now: number,
    controlSources: Partial<Record<ChannelType, ControlLayer>>
  ): number {
    const values: ChannelValue[] = []
    const titanIntent = this.layerState.getTitanIntent()
    const titanActive = titanIntent !== null

    // WAVE 380: TEST MODE heartbeat
    if (!titanActive && channel === 'dimmer') {
      const phase = (now / 3000) * Math.PI * 2
      const pulse = 51 + Math.sin(phase) * 25
      values.push({ layer: ControlLayer.TITAN_AI, value: pulse, timestamp: now })
      controlSources[channel] = ControlLayer.TITAN_AI
      return pulse
    }

    const titanValue = titanValues[channel] ?? 0
    values.push({
      layer: ControlLayer.TITAN_AI,
      value: titanValue,
      timestamp: titanIntent?.timestamp ?? now,
    })

    // Establish base: L0 unless L2 overrides
    let baseValue = titanValue
    let baseSource = ControlLayer.TITAN_AI

    if (manualOverride && manualOverride.overrideChannels.includes(channel)) {
      baseValue = this.getManualChannelValue(manualOverride, channel)
      baseSource = ControlLayer.MANUAL
    }

    // WAVE 2662 + WAVE 3200 + WAVE 3303: Effect Intents — Layer 3 SUPREME
    const effectIntent = this.layerState.getEffectIntent(fixtureId)
    if (effectIntent) {
      const intentValue = this.getIntentValueForChannel(effectIntent, channel)

      // WAVE 3304 + WAVE 3305: Mover Shield
      let moverShieldActive = false
      if (MOVER_SHIELD_CHANNELS.has(channel) && effectIntent.mixBus === 'global' && !effectIntent.overrideMoverShield) {
        const fixtureMeta = this.fixtures.get(fixtureId)
        if (fixtureMeta && this.isMovingFixture(fixtureMeta)) {
          moverShieldActive = true
        }
      }

      if (!moverShieldActive) {
        if (effectIntent.mixBus === 'global') {
          controlSources[channel] = ControlLayer.EFFECTS
          if (channel === 'dimmer') {
            return intentValue !== null ? intentValue : 0
          } else {
            return intentValue !== null ? intentValue : baseValue
          }
        } else if (intentValue !== null) {
          if (channel === 'dimmer') {
            controlSources[channel] = ControlLayer.EFFECTS
            return Math.max(baseValue, intentValue)
          } else {
            controlSources[channel] = ControlLayer.EFFECTS
            return intentValue
          }
        }
      }
    }

    // Legacy L3: strobe/blinder/flash/freeze
    const effectValue = this.getEffectValueForChannel(fixtureId, channel, now)
    if (effectValue !== null) {
      controlSources[channel] = ControlLayer.EFFECTS
      return effectValue
    }

    // No L3 — return base (L2 or L0)
    if (baseSource === ControlLayer.MANUAL) {
      controlSources[channel] = ControlLayer.MANUAL
      return baseValue
    }

    // Crossfade back to AI
    if (this.crossfadeEngine.isTransitioning(fixtureId, channel)) {
      const crossfadedValue = this.crossfadeEngine.getCurrentValue(
        fixtureId, channel, titanValue, titanValue
      )
      controlSources[channel] = ControlLayer.TITAN_AI
      return crossfadedValue
    }

    const result = mergeChannel(channel, values)
    controlSources[channel] = result.source
    return result.value
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE: POSITION + PATTERNS
  // ═══════════════════════════════════════════════════════════════════════════

  private calculatePatternOffset(pattern: PatternConfig, now: number): { panOffset: number; tiltOffset: number } {
    const elapsedMs = now - pattern.startTime
    const BETA_MAX_SPEED = 0.5
    const scaledSpeed = pattern.speed * this.grandMasterSpeed
    const safeSpeed = Math.min(Math.max(0.01, scaledSpeed), BETA_MAX_SPEED)
    const cycleDurationMs = (1000 / safeSpeed)
    const phase = (elapsedMs % cycleDurationMs) / cycleDurationMs
    const t = phase * 2 * Math.PI

    if (this.frameNumber % 60 === 0) {
      console.log(
        `[Pattern] 🔄 type=${pattern.type} speed=${pattern.speed.toFixed(3)}Hz ` +
        `size=${pattern.size.toFixed(3)} elapsed=${(elapsedMs / 1000).toFixed(1)}s ` +
        `cycle=${(cycleDurationMs / 1000).toFixed(2)}s phase=${phase.toFixed(3)}`
      )
    }

    let panOffset = 0
    let tiltOffset = 0

    switch (pattern.type) {
      case 'circle':
        panOffset = Math.cos(t)
        tiltOffset = Math.sin(t)
        break
      case 'eight':
        panOffset = Math.sin(t)
        tiltOffset = Math.sin(t * 2) / 2
        break
      case 'sweep':
        panOffset = Math.sin(t)
        tiltOffset = 0
        break
      case 'darkspin':
      case 'tornado': {
        const envelope = Math.sin(t * 0.25)
        panOffset = Math.cos(t) * envelope
        tiltOffset = Math.sin(t) * envelope
        break
      }
      case 'gravity_bounce': {
        const bounce = Math.cos(t * 1.5)
        panOffset = Math.sin(t)
        tiltOffset = -(bounce * bounce)
        break
      }
      case 'butterfly':
        panOffset = Math.sin(t * 2)
        tiltOffset = Math.sin(t)
        break
      case 'heartbeat': {
        const pulse = Math.sin(t * 2)
        panOffset = 0
        tiltOffset = pulse * pulse * pulse * pulse * Math.sign(pulse)
        break
      }
    }

    return { panOffset, tiltOffset }
  }

  private getAdjustedPosition(
    fixtureId: string,
    titanValues: Record<ChannelType, number>,
    manualOverride: Layer2_Manual | undefined,
    now: number
  ): { pan: number; tilt: number } {
    const basePan = manualOverride?.controls.pan ?? titanValues.pan
    const baseTilt = manualOverride?.controls.tilt ?? titanValues.tilt

    const pattern = this.activePatterns.get(fixtureId)
    if (pattern) {
      const offset = this.calculatePatternOffset(pattern, now)
      const MANUAL_MAX_MOVEMENT = 128
      const rawPanMovement = offset.panOffset * 128 * pattern.size
      const rawTiltMovement = offset.tiltOffset * 128 * pattern.size
      const panMovement = Math.max(-MANUAL_MAX_MOVEMENT, Math.min(MANUAL_MAX_MOVEMENT, rawPanMovement))
      const tiltMovement = Math.max(-MANUAL_MAX_MOVEMENT, Math.min(MANUAL_MAX_MOVEMENT, rawTiltMovement))
      const liveCenterPan = basePan
      const liveCenterTilt = baseTilt

      if (this.frameNumber % 60 === 0) {
        console.log(
          `[Position] 📍 ${fixtureId.substring(0, 8)} liveCenter=P${liveCenterPan.toFixed(0)}/T${liveCenterTilt.toFixed(0)} ` +
          `→ adjusted=P${(liveCenterPan + panMovement).toFixed(1)}/T${(liveCenterTilt + tiltMovement).toFixed(1)}`
        )
      }

      return { pan: liveCenterPan + panMovement, tilt: liveCenterTilt + tiltMovement }
    }

    for (const [, formation] of this.activeFormations) {
      if (!formation.fixtureIds.includes(fixtureId)) continue
      const offset = formation.offsets.get(fixtureId)
      if (!offset) continue
      return {
        pan: formation.center.pan + (offset.panOffset * formation.fan),
        tilt: formation.center.tilt + (offset.tiltOffset * formation.fan),
      }
    }

    return { pan: basePan, tilt: baseTilt }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE: TITAN VALUES FOR FIXTURE (Zone routing, color mapping, movement)
  // ═══════════════════════════════════════════════════════════════════════════

  private getTitanValuesForFixture(fixtureId: string): Record<ChannelType, number> {
    const fixture = this.fixtures.get(fixtureId)
    const speedChannel = (fixture?.channels as any)?.find((c: any) => c.type === 'speed')
    const defaultSpeed = speedChannel?.defaultValue ?? 128
    const panChannel = (fixture?.channels as any)?.find((c: any) => c.type === 'pan')
    const tiltChannel = (fixture?.channels as any)?.find((c: any) => c.type === 'tilt')
    const defaultPan = panChannel?.defaultValue ?? 128
    const defaultTilt = tiltChannel?.defaultValue ?? 128

    const defaults: Record<ChannelType, number> = {
      dimmer: 0, red: 0, green: 0, blue: 0, white: 0,
      pan: defaultPan, tilt: defaultTilt,
      zoom: 128, focus: 128, gobo: 0, prism: 0, speed: defaultSpeed,
      strobe: 0, color_wheel: 0, amber: 0, uv: 0,
      shutter: 255, cyan: 0, magenta: 0, yellow: 0,
      pan_fine: 0, tilt_fine: 0, gobo_rotation: 0, prism_rotation: 0,
      frost: 0, macro: 0, control: 0, rotation: 0, custom: 0, unknown: 0,
    }

    const titanIntent = this.layerState.getTitanIntent()
    if (!titanIntent?.intent) return defaults

    const intent = titanIntent.intent

    if (intent.optics) {
      defaults.zoom = intent.optics.zoom ?? 128
      defaults.focus = intent.optics.focus ?? 128
    }

    const zone = (fixture?.zone || 'UNASSIGNED').toLowerCase()
    const nameStr = (fixture?.name || '').toLowerCase()
    const posX = fixture?.position?.x ?? 0

    const isLeft = (posX < -0.1) ||
      nameStr.includes('left') || nameStr.includes('izq') ||
      nameStr.includes(' l ') || nameStr.endsWith(' l') ||
      nameStr.startsWith('l ') || zone.includes('left') || zone.includes('moving_left')

    const hasStereoSignal = intent.zones && 'frontL' in intent.zones
    let intentZone = 'front'

    if (zone.includes('front')) {
      intentZone = hasStereoSignal ? (isLeft ? 'frontL' : 'frontR') : 'front'
    } else if (zone.includes('back')) {
      intentZone = hasStereoSignal ? (isLeft ? 'backL' : 'backR') : 'back'
    } else if (zone.includes('left')) {
      intentZone = 'left'
    } else if (zone.includes('right')) {
      intentZone = 'right'
    } else {
      intentZone = 'ambient'
    }

    const zoneIntent = (intent.zones as any)?.[intentZone]
    const rawIntensity = zoneIntent?.intensity ?? intent.masterIntensity
    const zoneIntensity = (typeof rawIntensity === 'number' && !Number.isNaN(rawIntensity)) ? rawIntensity : 0
    const dMin = (fixture?.capabilities as any)?.dimmerMin ?? 0
    defaults.dimmer = zoneIntensity > 0 ? Math.round(dMin + (zoneIntensity * (255 - dMin))) : 0

    let selectedColor = intent.palette?.primary
    const paletteRole = zoneIntent?.paletteRole || 'primary'
    switch (paletteRole) {
      case 'primary': selectedColor = intent.palette?.primary; break
      case 'secondary': selectedColor = intent.palette?.secondary || intent.palette?.primary; break
      case 'accent': selectedColor = intent.palette?.accent || intent.palette?.secondary || intent.palette?.primary; break
      case 'ambient': selectedColor = intent.palette?.ambient || intent.palette?.primary; break
      default: selectedColor = intent.palette?.primary
    }

    if (!zoneIntent?.paletteRole) {
      const zoneUpper = zone.toUpperCase()
      if (zoneUpper.includes('FRONT')) {
        selectedColor = intent.palette?.primary
      } else if (zoneUpper.includes('BACK')) {
        selectedColor = intent.palette?.accent || intent.palette?.secondary || intent.palette?.primary
      } else if (zoneUpper.includes('LEFT') || zoneUpper.includes('RIGHT')) {
        selectedColor = intent.palette?.secondary || intent.palette?.primary
      } else if (zoneUpper.includes('MOVING') || this.isMovingFixture(fixture!)) {
        selectedColor = intent.palette?.accent || intent.palette?.secondary || intent.palette?.primary
      }
    }

    const manualOverrideForBunker = this.layerState.getManualOverride(fixtureId)
    const hasColorOverride = manualOverrideForBunker
      ? manualOverrideForBunker.overrideChannels.some(ch => getChannelCategory(ch) === 'color')
      : false

    if (hasColorOverride) {
      const frozen = this.lastKnownColors.get(fixtureId)
      if (frozen) {
        defaults.red = frozen.r
        defaults.green = frozen.g
        defaults.blue = frozen.b
      }
    } else if (selectedColor) {
      const rgb = this.hslToRgb(selectedColor)
      defaults.red = rgb.r
      defaults.green = rgb.g
      defaults.blue = rgb.b
      this.lastKnownColors.set(fixtureId, { r: rgb.r, g: rgb.g, b: rgb.b })
    }

    if (intent.movement && fixture) {
      const isMover = this.isMovingFixture(fixture)
      if (isMover) {
        let mechanic = null

        if (intent.movement.mechanicsL && intent.movement.mechanicsR) {
          mechanic = isLeft ? intent.movement.mechanicsL : intent.movement.mechanicsR
        }
        if (!mechanic && (intent as any).mechanics) {
          const rootMech = (intent as any).mechanics
          if (rootMech.moverL && rootMech.moverR) {
            mechanic = isLeft ? rootMech.moverL : rootMech.moverR
          }
        }

        if (mechanic) {
          defaults.pan = mechanic.pan * 255
          defaults.tilt = mechanic.tilt * 255
        } else if (this.moverCount > 1) {
          const moverIndex = this.getMoverIndex(fixtureId)
          const spreadFactor = 0.15
          const totalSpread = spreadFactor * (this.moverCount - 1)
          const offset = (moverIndex * spreadFactor) - (totalSpread / 2)
          const basePan = intent.movement.centerX
          const baseTilt = intent.movement.centerY
          defaults.pan = Math.max(0, Math.min(1, basePan + offset)) * 255
          defaults.tilt = Math.max(0, Math.min(1, baseTilt + (offset * 0.3))) * 255
        } else {
          defaults.pan = intent.movement.centerX * 255
          defaults.tilt = intent.movement.centerY * 255
        }
      }
    }

    return defaults
  }

  private getMoverIndex(fixtureId: string): number {
    let moverIndex = 0
    for (const [id, fixture] of this.fixtures) {
      if (this.isMovingFixture(fixture)) {
        if (id === fixtureId) return moverIndex
        moverIndex++
      }
    }
    return 0
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE: CHANNEL VALUE HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private getManualChannelValue(override: Layer2_Manual, channel: ChannelType): number {
    const controls = override.controls
    switch (channel) {
      case 'dimmer': return controls.dimmer ?? 0
      case 'red': return controls.red ?? 0
      case 'green': return controls.green ?? 0
      case 'blue': return controls.blue ?? 0
      case 'white': return controls.white ?? 0
      case 'pan': return controls.pan ?? 128
      case 'tilt': return controls.tilt ?? 128
      case 'zoom': return controls.zoom ?? 128
      case 'focus': return controls.focus ?? 128
      case 'speed': return controls.speed ?? 128
      case 'strobe': return controls.strobe ?? 0
      case 'gobo': return controls.gobo ?? 0
      case 'color_wheel': return controls.color_wheel ?? 0
      default: return 0
    }
  }

  private getEffectValueForChannel(
    fixtureId: string,
    channel: ChannelType,
    now: number
  ): number | null {
    for (const effect of this.layerState.getActiveEffects()) {
      if (effect.fixtureIds.length > 0 && !effect.fixtureIds.includes(fixtureId)) continue

      switch (effect.type) {
        case 'strobe':
          if (channel === 'dimmer') {
            const strobeHz = (effect.params.speed as number) ?? 10
            const period = 1000 / strobeHz
            const phase = (now - effect.startTime) % period
            return phase < period / 2 ? 255 * effect.intensity : 0
          }
          break
        case 'blinder':
          if (channel === 'dimmer') return 255 * effect.intensity
          if (channel === 'red' || channel === 'green' || channel === 'blue') return 255
          break
        case 'flash':
          if (channel === 'dimmer') {
            const elapsed = now - effect.startTime
            const progress = elapsed / effect.durationMs
            return 255 * effect.intensity * (1 - progress)
          }
          break
        case 'freeze':
          return null
      }
    }
    return null
  }

  private getIntentValueForChannel(intent: EffectIntent, channel: ChannelType): number | null {
    switch (channel) {
      case 'dimmer': return intent.dimmer ?? null
      case 'red': return intent.color?.r ?? null
      case 'green': return intent.color?.g ?? null
      case 'blue': return intent.color?.b ?? null
      case 'white': return intent.white ?? null
      default: return null
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE: GLOBAL EFFECTS + CROSSFADE HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private buildGlobalEffectsState(): GlobalEffectsState {
    const effects = this.layerState.getActiveEffects()
    return {
      strobeActive: effects.some(e => e.type === 'strobe'),
      strobeSpeed: effects.find(e => e.type === 'strobe')?.params.speed as number ?? 0,
      blinderActive: effects.some(e => e.type === 'blinder'),
      blinderIntensity: effects.find(e => e.type === 'blinder')?.intensity ?? 0,
      blackoutActive: this.layerState.isBlackoutActive(),
      freezeActive: effects.some(e => e.type === 'freeze'),
    }
  }

  private isAnyCrossfadeActive(fixtureId: string): boolean {
    const channels: ChannelType[] = ['dimmer', 'red', 'green', 'blue', 'pan', 'tilt', 'zoom', 'focus']
    return channels.some(ch => this.crossfadeEngine.isTransitioning(fixtureId, ch))
  }

  private getAverageCrossfadeProgress(fixtureId: string): number {
    const channels: ChannelType[] = ['dimmer', 'red', 'green', 'blue', 'pan', 'tilt', 'zoom', 'focus']
    let total = 0
    let count = 0
    for (const ch of channels) {
      const state = this.crossfadeEngine.getTransitionState(fixtureId, ch)
      if (state) { total += state.progress; count++ }
    }
    return count > 0 ? total / count : 0
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE: HSL → RGB
  // ═══════════════════════════════════════════════════════════════════════════

  private hslToRgb(hsl: { h: number; s: number; l: number }): RGBOutput {
    const { h, s, l } = hsl
    let r: number, g: number, b: number

    if (s === 0) {
      r = g = b = l
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1
        if (t > 1) t -= 1
        if (t < 1 / 6) return p + (q - p) * 6 * t
        if (t < 1 / 2) return q
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
        return p
      }
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s
      const p = 2 * l - q
      r = hue2rgb(p, q, h + 1 / 3)
      g = hue2rgb(p, q, h)
      b = hue2rgb(p, q, h - 1 / 3)
    }

    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255),
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATUS & DEBUG
  // ═══════════════════════════════════════════════════════════════════════════

  getStatus() {
    const titanIntent = this.layerState.getTitanIntent()
    const layer1 = this.layerState.getConsciousnessModifier()
    return {
      fixtureCount: this.fixtures.size,
      frameNumber: this.frameNumber,
      outputEnabled: this._outputEnabled,
      blackoutActive: this.layerState.isBlackoutActive(),
      grandMaster: this.grandMaster,
      inhibitLimits: Object.fromEntries(this.inhibitLimits),
      titanActive: titanIntent !== null,
      titanVibeId: titanIntent?.vibeId ?? null,
      consciousnessActive: layer1?.active ?? false,
      consciousnessStatus: layer1?.status ?? null,
      manualOverrideCount: this.layerState.getManualOverrideCount(),
      manualFixtureIds: this.layerState.getManualOverrideFixtureIds(),
      hasManualOverrides: this.layerState.getManualOverrideCount() > 0,
      activeEffects: this.layerState.getActiveEffects().map(e => e.type),
      activeCrossfades: this.crossfadeEngine.getActiveCount(),
    }
  }

  clearTitanState(): void {
    this.layerState.clearTitanIntent()
    this.positionReleaseFades.clear()
    this.lastKnownPositions.clear()
    this.fixtureOrigins.clear()
    this.crossfadeEngine.clearAll()
    this.frameNumber = 0
    console.log('[ArbitrationDirector] 🧹 WAVE 2227: Titan state cleared (operator state preserved)')
  }

  reset(): void {
    this.layerState.resetAllLayers()
    this.layerState.disableBlackout()
    this._outputEnabled = false
    this.crossfadeEngine.clearAll()
    this.frameNumber = 0
    console.log('[ArbitrationDirector] 🚦 Reset complete - Output DISABLED (COLD state)')
  }

  updateConfig(config: Partial<MasterArbiterConfig>): void {
    this.config = { ...this.config, ...config }
    this.crossfadeEngine.setDefaultDuration(this.config.defaultCrossfadeMs)
  }
}
