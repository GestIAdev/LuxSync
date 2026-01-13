/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎭 MASTER ARBITER - CENTRAL CONTROL HIERARCHY
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 373: The single source of truth for all lighting control.
 * 
 * THE PROBLEM IT SOLVES:
 * Before MasterArbiter, we had:
 * - TitanEngine generating LightingIntent
 * - SeleneLuxConscious existing but disconnected
 * - Manual controls not integrated
 * - No clear priority system
 * 
 * NOW:
 * Every layer submits to MasterArbiter → MasterArbiter arbitrates → Single output to HAL
 * 
 * LAYER PRIORITY (highest wins):
 * - Layer 4: BLACKOUT (emergency, always wins)
 * - Layer 3: EFFECTS (strobe, flash, etc.)
 * - Layer 2: MANUAL (user overrides)
 * - Layer 1: CONSCIOUSNESS (CORE 3 - SeleneLuxConscious)
 * - Layer 0: TITAN_AI (base from TitanEngine)
 * 
 * MERGE STRATEGY:
 * - Dimmer: HTP (Highest Takes Precedence)
 * - Position/Color: LTP (Latest Takes Precedence)
 * - Transitions: Smooth crossfade on release
 * 
 * @module core/arbiter/MasterArbiter
 * @version WAVE 373
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
  ControlLayer,
  DEFAULT_ARBITER_CONFIG,
  DEFAULT_MERGE_STRATEGIES,
} from './types'
import { mergeChannel, clampDMX } from './merge/MergeStrategies'
import { CrossfadeEngine } from './CrossfadeEngine'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface ArbiterEvents {
  'output': (target: FinalLightingTarget) => void
  'manualOverride': (fixtureId: string, channels: ChannelType[]) => void
  'manualRelease': (fixtureId: string, channels: ChannelType[]) => void
  'blackout': (active: boolean) => void
  'effectStart': (effect: Layer3_Effect) => void
  'effectEnd': (effectType: string) => void
  'error': (error: Error) => void
}

// ═══════════════════════════════════════════════════════════════════════════
// MASTER ARBITER CLASS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Pattern configuration for movement generation
 */
interface PatternConfig {
  type: 'circle' | 'eight' | 'sweep'
  speed: number      // 0-1 (cycles per second)
  size: number       // 0-1 (amplitude as fraction of full range)
  center: { pan: number; tilt: number }  // 0-65535
  startTime: number
}

/**
 * Group formation with relative positioning
 */
interface GroupFormation {
  fixtureIds: string[]
  center: { pan: number; tilt: number }
  offsets: Map<string, { panOffset: number; tiltOffset: number }>
  fan: number  // 0-1 multiplier for spacing
  timestamp: number
}

export class MasterArbiter extends EventEmitter {
  private config: MasterArbiterConfig
  private crossfadeEngine: CrossfadeEngine
  
  // Layer state
  private layer0_titan: Layer0_Titan | null = null
  private layer1_consciousness: Layer1_Consciousness | null = null
  private layer2_manualOverrides: Map<string, Layer2_Manual> = new Map()
  private layer3_effects: Layer3_Effect[] = []
  private layer4_blackout: boolean = false
  
  // Fixtures (populated from HAL or StageStore)
  private fixtures: Map<string, ArbiterFixture> = new Map()
  
  // Grand Master (WAVE 376)
  private grandMaster: number = 1.0  // 0-1, multiplies dimmer globally
  
  // Pattern Engine (WAVE 376)
  private activePatterns: Map<string, PatternConfig> = new Map()
  
  // Group Formations (WAVE 376)
  private activeFormations: Map<string, GroupFormation> = new Map()
  
  // State tracking
  private frameNumber: number = 0
  private lastOutputTimestamp: number = 0
  
  constructor(config: Partial<MasterArbiterConfig> = {}) {
    super()
    this.config = { ...DEFAULT_ARBITER_CONFIG, ...config }
    this.crossfadeEngine = new CrossfadeEngine(this.config.defaultCrossfadeMs)
    
    if (this.config.debug) {
      console.log('[MasterArbiter] Initialized with config:', this.config)
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // FIXTURE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Register fixtures for arbitration
   * Call this when patch changes or on init.
   */
  setFixtures(fixtures: ArbiterFixture[]): void {
    this.fixtures.clear()
    for (const fixture of fixtures) {
      const id = fixture.id ?? fixture.name
      this.fixtures.set(id, { ...fixture, id })
    }
    
    if (this.config.debug) {
      console.log(`[MasterArbiter] Registered ${this.fixtures.size} fixtures`)
    }
  }
  
  /**
   * Get fixture by ID
   */
  getFixture(id: string): ArbiterFixture | undefined {
    return this.fixtures.get(id)
  }
  
  /**
   * Get all fixture IDs
   */
  getFixtureIds(): string[] {
    return Array.from(this.fixtures.keys())
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // LAYER 0: TITAN AI INPUT
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Set Layer 0 input from TitanEngine
   * Called every frame by TitanOrchestrator.
   */
  setTitanIntent(intent: Layer0_Titan): void {
    this.layer0_titan = intent
  }
  
  /**
   * Get current Titan intent (for debugging)
   */
  getTitanIntent(): Layer0_Titan | null {
    return this.layer0_titan
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // LAYER 1: CONSCIOUSNESS INPUT (CORE 3 - PLACEHOLDER)
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Set Layer 1 input from SeleneLuxConscious
   * CORE 3: This will be connected when consciousness is integrated.
   */
  setConsciousnessModifier(modifier: Layer1_Consciousness): void {
    if (!this.config.consciousnessEnabled) {
      return  // Silently ignore if consciousness is disabled
    }
    this.layer1_consciousness = modifier
  }
  
  /**
   * Clear consciousness modifier
   */
  clearConsciousnessModifier(): void {
    this.layer1_consciousness = null
  }
  
  /**
   * Get current consciousness state (for debugging)
   */
  getConsciousnessState(): Layer1_Consciousness | null {
    return this.layer1_consciousness
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // LAYER 2: MANUAL OVERRIDE
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Set manual override for a fixture
   * Overwrites existing override for same fixture.
   */
  setManualOverride(override: Layer2_Manual): void {
    // Check limit
    if (this.layer2_manualOverrides.size >= this.config.maxManualOverrides &&
        !this.layer2_manualOverrides.has(override.fixtureId)) {
      console.warn(`[MasterArbiter] Max manual overrides reached (${this.config.maxManualOverrides})`)
      return
    }
    
    // Check if fixture exists
    if (!this.fixtures.has(override.fixtureId)) {
      console.warn(`[MasterArbiter] Unknown fixture: ${override.fixtureId}`)
      return
    }
    
    // Store override
    this.layer2_manualOverrides.set(override.fixtureId, {
      ...override,
      timestamp: performance.now()
    })
    
    // Emit event
    this.emit('manualOverride', override.fixtureId, override.overrideChannels)
    
    if (this.config.debug) {
      console.log(`[MasterArbiter] Manual override: ${override.fixtureId}`, override.overrideChannels)
    }
  }
  
  /**
   * Release manual override for a fixture
   * Starts crossfade transition back to AI control.
   */
  releaseManualOverride(fixtureId: string, channels?: ChannelType[]): void {
    const override = this.layer2_manualOverrides.get(fixtureId)
    if (!override) return
    
    const channelsToRelease = channels ?? override.overrideChannels
    
    // For each channel being released, start a crossfade
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
    
    // Update or remove override
    if (channels) {
      // Partial release - remove only specified channels
      const remainingChannels = override.overrideChannels.filter(c => !channels.includes(c))
      if (remainingChannels.length === 0) {
        this.layer2_manualOverrides.delete(fixtureId)
      } else {
        override.overrideChannels = remainingChannels
      }
    } else {
      // Full release
      this.layer2_manualOverrides.delete(fixtureId)
    }
    
    // Emit event
    this.emit('manualRelease', fixtureId, channelsToRelease)
    
    if (this.config.debug) {
      console.log(`[MasterArbiter] Manual released: ${fixtureId}`, channelsToRelease)
    }
  }
  
  /**
   * Release all manual overrides
   */
  releaseAllManualOverrides(): void {
    for (const fixtureId of this.layer2_manualOverrides.keys()) {
      this.releaseManualOverride(fixtureId)
    }
  }
  
  /**
   * Get manual override for a fixture
   */
  getManualOverride(fixtureId: string): Layer2_Manual | undefined {
    return this.layer2_manualOverrides.get(fixtureId)
  }
  
  /**
   * Check if fixture has manual override
   */
  hasManualOverride(fixtureId: string, channel?: ChannelType): boolean {
    const override = this.layer2_manualOverrides.get(fixtureId)
    if (!override) return false
    if (channel) return override.overrideChannels.includes(channel)
    return true
  }
  
  /**
   * Get all fixtures with manual overrides
   */
  getManualOverrideFixtures(): string[] {
    return Array.from(this.layer2_manualOverrides.keys())
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // LAYER 3: EFFECTS
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Add an effect
   */
  addEffect(effect: Layer3_Effect): void {
    if (this.layer3_effects.length >= this.config.maxActiveEffects) {
      // Remove oldest effect
      this.layer3_effects.shift()
    }
    
    effect.startTime = performance.now()
    this.layer3_effects.push(effect)
    
    this.emit('effectStart', effect)
    
    if (this.config.debug) {
      console.log(`[MasterArbiter] Effect started: ${effect.type}`)
    }
  }
  
  /**
   * Remove an effect
   */
  removeEffect(type: string): void {
    const index = this.layer3_effects.findIndex(e => e.type === type)
    if (index !== -1) {
      this.layer3_effects.splice(index, 1)
      this.emit('effectEnd', type)
    }
  }
  
  /**
   * Clear all effects
   */
  clearEffects(): void {
    this.layer3_effects = []
  }
  
  /**
   * Clean up expired effects
   */
  private cleanupExpiredEffects(): void {
    const now = performance.now()
    this.layer3_effects = this.layer3_effects.filter(effect => {
      const elapsed = now - effect.startTime
      if (elapsed >= effect.durationMs) {
        this.emit('effectEnd', effect.type)
        return false
      }
      return true
    })
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // LAYER 4: BLACKOUT
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Set blackout state
   * When true, all fixtures go to 0 regardless of other layers.
   */
  setBlackout(active: boolean): void {
    const changed = this.layer4_blackout !== active
    this.layer4_blackout = active
    
    if (changed) {
      this.emit('blackout', active)
      if (this.config.debug) {
        console.log(`[MasterArbiter] Blackout: ${active}`)
      }
    }
  }
  
  /**
   * Toggle blackout
   */
  toggleBlackout(): boolean {
    this.setBlackout(!this.layer4_blackout)
    return this.layer4_blackout
  }
  
  /**
   * Get blackout state
   */
  isBlackoutActive(): boolean {
    return this.layer4_blackout
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // GRAND MASTER (WAVE 376)
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Set Grand Master level (0-1)
   * Multiplies dimmer for ALL fixtures globally.
   * If set to 0.5, no fixture can be brighter than 50%.
   */
  setGrandMaster(value: number): void {
    this.grandMaster = Math.max(0, Math.min(1, value))
    
    if (this.config.debug) {
      console.log(`[MasterArbiter] Grand Master: ${Math.round(this.grandMaster * 100)}%`)
    }
  }
  
  /**
   * Get current Grand Master level
   */
  getGrandMaster(): number {
    return this.grandMaster
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // PATTERN ENGINE (WAVE 376)
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Set pattern for a fixture or group
   * Pattern generates procedural movement (Circle, Eight, Sweep).
   */
  setPattern(fixtureIds: string[], pattern: Omit<PatternConfig, 'startTime'>): void {
    const config: PatternConfig = {
      ...pattern,
      startTime: performance.now(),
    }
    
    for (const fixtureId of fixtureIds) {
      if (!this.fixtures.has(fixtureId)) {
        console.warn(`[MasterArbiter] Unknown fixture for pattern: ${fixtureId}`)
        continue
      }
      
      this.activePatterns.set(fixtureId, config)
    }
    
    if (this.config.debug) {
      console.log(`[MasterArbiter] Pattern set (${pattern.type}): ${fixtureIds.length} fixtures`)
    }
  }
  
  /**
   * Clear pattern for fixtures
   */
  clearPattern(fixtureIds: string[]): void {
    for (const fixtureId of fixtureIds) {
      this.activePatterns.delete(fixtureId)
    }
    
    if (this.config.debug) {
      console.log(`[MasterArbiter] Pattern cleared: ${fixtureIds.length} fixtures`)
    }
  }
  
  /**
   * Get pattern for a fixture
   */
  getPattern(fixtureId: string): PatternConfig | undefined {
    return this.activePatterns.get(fixtureId)
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // GROUP FORMATION (WAVE 376)
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Set group formation (Radar control)
   * Moves group center while maintaining relative spacing.
   * Calculates offsets from group center on first call.
   */
  setGroupFormation(groupId: string, fixtureIds: string[], center: { pan: number; tilt: number }, fan: number): void {
    // Get or create formation
    let formation = this.activeFormations.get(groupId)
    
    if (!formation) {
      // First time: calculate offsets from current positions
      const offsets = new Map<string, { panOffset: number; tiltOffset: number }>()
      
      for (const fixtureId of fixtureIds) {
        // Get current position from manual override or AI
        const manualOverride = this.layer2_manualOverrides.get(fixtureId)
        const titanValues = this.getTitanValuesForFixture(fixtureId)
        
        const currentPan = manualOverride?.controls.pan ?? titanValues.pan
        const currentTilt = manualOverride?.controls.tilt ?? titanValues.tilt
        
        const panOffset = currentPan - center.pan
        const tiltOffset = currentTilt - center.tilt
        
        offsets.set(fixtureId, { panOffset, tiltOffset })
      }
      
      formation = {
        fixtureIds,
        center,
        offsets,
        fan,
        timestamp: performance.now(),
      }
      
      this.activeFormations.set(groupId, formation)
    } else {
      // Update center and fan
      formation.center = center
      formation.fan = fan
      formation.timestamp = performance.now()
    }
    
    if (this.config.debug) {
      console.log(`[MasterArbiter] Group formation: ${groupId} center=(${center.pan},${center.tilt}) fan=${fan}`)
    }
  }
  
  /**
   * Clear group formation
   */
  clearGroupFormation(groupId: string): void {
    this.activeFormations.delete(groupId)
    
    if (this.config.debug) {
      console.log(`[MasterArbiter] Group formation cleared: ${groupId}`)
    }
  }
  
  /**
   * Get group formation
   */
  getGroupFormation(groupId: string): GroupFormation | undefined {
    return this.activeFormations.get(groupId)
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // MAIN ARBITRATION
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * 🎭 MAIN ARBITRATION FUNCTION
   * 
   * Merges all layers and produces final lighting target.
   * Call this every frame to get the output for HAL.
   * 
   * @returns Final lighting target ready for HAL
   */
  arbitrate(): FinalLightingTarget {
    const now = performance.now()
    this.frameNumber++
    
    // Clean up expired effects
    this.cleanupExpiredEffects()
    
    // Arbitrate each fixture
    const fixtureTargets: FixtureLightingTarget[] = []
    
    for (const [fixtureId] of this.fixtures) {
      const target = this.arbitrateFixture(fixtureId, now)
      fixtureTargets.push(target)
    }
    
    // Build global effects state
    const globalEffects = this.buildGlobalEffectsState()
    
    // Build final output
    const output: FinalLightingTarget = {
      fixtures: fixtureTargets,
      globalEffects,
      timestamp: now,
      frameNumber: this.frameNumber,
      _layerActivity: {
        titanActive: this.layer0_titan !== null,
        titanVibeId: this.layer0_titan?.vibeId ?? '',
        consciousnessActive: this.layer1_consciousness?.active ?? false,
        consciousnessStatus: this.layer1_consciousness?.status,
        manualOverrideCount: this.layer2_manualOverrides.size,
        manualFixtureIds: Array.from(this.layer2_manualOverrides.keys()),
        activeEffects: this.layer3_effects.map(e => e.type),
      }
    }
    
    this.lastOutputTimestamp = now
    this.emit('output', output)
    
    return output
  }
  
  /**
   * Arbitrate a single fixture
   */
  private arbitrateFixture(fixtureId: string, now: number): FixtureLightingTarget {
    const controlSources: Partial<Record<ChannelType, ControlLayer>> = {}
    
    // LAYER 4: Check blackout first (highest priority)
    if (this.layer4_blackout) {
      return this.createBlackoutTarget(fixtureId, controlSources)
    }
    
    // Get values from each layer
    const titanValues = this.getTitanValuesForFixture(fixtureId)
    const manualOverride = this.layer2_manualOverrides.get(fixtureId)
    
    // Merge each channel
    const dimmer = this.mergeChannelForFixture(fixtureId, 'dimmer', titanValues, manualOverride, now, controlSources)
    const red = this.mergeChannelForFixture(fixtureId, 'red', titanValues, manualOverride, now, controlSources)
    const green = this.mergeChannelForFixture(fixtureId, 'green', titanValues, manualOverride, now, controlSources)
    const blue = this.mergeChannelForFixture(fixtureId, 'blue', titanValues, manualOverride, now, controlSources)
    
    // Get position (with pattern/formation applied)
    const { pan, tilt } = this.getAdjustedPosition(fixtureId, titanValues, manualOverride, now)
    
    const zoom = this.mergeChannelForFixture(fixtureId, 'zoom', titanValues, manualOverride, now, controlSources)
    const focus = this.mergeChannelForFixture(fixtureId, 'focus', titanValues, manualOverride, now, controlSources)
    
    // Check if any crossfade is active
    const crossfadeActive = this.isAnyCrossfadeActive(fixtureId)
    const crossfadeProgress = crossfadeActive ? this.getAverageCrossfadeProgress(fixtureId) : 0
    
    // Apply Grand Master to dimmer (final step before clamping)
    const dimmerfinal = clampDMX(dimmer * this.grandMaster)
    
    return {
      fixtureId,
      dimmer: dimmerfinal,
      color: {
        r: clampDMX(red),
        g: clampDMX(green),
        b: clampDMX(blue),
      },
      pan: clampDMX(pan),
      tilt: clampDMX(tilt),
      zoom: clampDMX(zoom),
      focus: clampDMX(focus),
      _controlSources: controlSources,
      _crossfadeActive: crossfadeActive,
      _crossfadeProgress: crossfadeProgress,
    }
  }
  
  /**
   * Merge a single channel for a fixture
   */
  private mergeChannelForFixture(
    fixtureId: string,
    channel: ChannelType,
    titanValues: Record<ChannelType, number>,
    manualOverride: Layer2_Manual | undefined,
    now: number,
    controlSources: Partial<Record<ChannelType, ControlLayer>>
  ): number {
    const values: ChannelValue[] = []
    
    // Layer 0: Titan AI
    const titanValue = titanValues[channel] ?? 0
    values.push({
      layer: ControlLayer.TITAN_AI,
      value: titanValue,
      timestamp: this.layer0_titan?.timestamp ?? now,
    })
    
    // Layer 1: Consciousness (CORE 3 - placeholder)
    // Will be implemented when consciousness is connected
    
    // Layer 2: Manual override
    if (manualOverride && manualOverride.overrideChannels.includes(channel)) {
      const manualValue = this.getManualChannelValue(manualOverride, channel)
      values.push({
        layer: ControlLayer.MANUAL,
        value: manualValue,
        timestamp: manualOverride.timestamp,
      })
    }
    
    // Layer 3: Effects
    const effectValue = this.getEffectValueForChannel(fixtureId, channel, now)
    if (effectValue !== null) {
      values.push({
        layer: ControlLayer.EFFECTS,
        value: effectValue,
        timestamp: now,
      })
    }
    
    // Check if crossfade is active for this channel
    if (this.crossfadeEngine.isTransitioning(fixtureId, channel)) {
      // Get interpolated value from crossfade
      const crossfadedValue = this.crossfadeEngine.getCurrentValue(
        fixtureId,
        channel,
        titanValue,
        titanValue
      )
      controlSources[channel] = ControlLayer.TITAN_AI  // Transitioning back to AI
      return crossfadedValue
    }
    
    // Merge values using channel's strategy
    const result = mergeChannel(channel, values)
    controlSources[channel] = result.source
    
    return result.value
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Calculate pattern offset (Circle, Eight, Sweep)
   * Returns pan/tilt offset as fractions (-1 to +1)
   */
  private calculatePatternOffset(pattern: PatternConfig, now: number): { panOffset: number; tiltOffset: number } {
    const elapsedMs = now - pattern.startTime
    const cycleDurationMs = (1000 / pattern.speed)  // speed = cycles per second
    const phase = (elapsedMs % cycleDurationMs) / cycleDurationMs
    const t = phase * 2 * Math.PI  // 0 to 2π
    
    const amplitude = pattern.size * 0.3  // 30% max swing of range
    let panOffset = 0
    let tiltOffset = 0
    
    switch (pattern.type) {
      case 'circle':
        // Circle: x = cos(t), y = sin(t)
        panOffset = Math.cos(t) * amplitude
        tiltOffset = Math.sin(t) * amplitude
        break
        
      case 'eight':
        // Eight: x = sin(t), y = sin(2t) / 2
        panOffset = Math.sin(t) * amplitude
        tiltOffset = (Math.sin(t * 2) / 2) * amplitude
        break
        
      case 'sweep':
        // Sweep: x = sin(t), y = 0
        panOffset = Math.sin(t) * amplitude
        tiltOffset = 0
        break
    }
    
    return { panOffset, tiltOffset }
  }
  
  /**
   * Get adjusted position with patterns and formations applied
   */
  private getAdjustedPosition(
    fixtureId: string,
    titanValues: Record<ChannelType, number>,
    manualOverride: Layer2_Manual | undefined,
    now: number
  ): { pan: number; tilt: number } {
    // Get base position
    const basePan = manualOverride?.controls.pan ?? titanValues.pan
    const baseTilt = manualOverride?.controls.tilt ?? titanValues.tilt
    
    // Apply pattern if active
    const pattern = this.activePatterns.get(fixtureId)
    if (pattern) {
      const offset = this.calculatePatternOffset(pattern, now)
      const adjustedPan = basePan + (offset.panOffset * 65535)
      const adjustedTilt = baseTilt + (offset.tiltOffset * 65535)
      return { pan: adjustedPan, tilt: adjustedTilt }
    }
    
    // Apply group formation if active
    for (const [groupId, formation] of this.activeFormations) {
      if (!formation.fixtureIds.includes(fixtureId)) continue
      
      const offset = formation.offsets.get(fixtureId)
      if (!offset) continue
      
      // Apply fan multiplier to offsets
      const fanAdjustedPan = formation.center.pan + (offset.panOffset * formation.fan)
      const fanAdjustedTilt = formation.center.tilt + (offset.tiltOffset * formation.fan)
      
      return { pan: fanAdjustedPan, tilt: fanAdjustedTilt }
    }
    
    // No pattern or formation: return base position
    return { pan: basePan, tilt: baseTilt }
  }
  
  /**
   * Get Titan values for a specific fixture
   * Extracts values from LightingIntent which uses zones + palette model
   */
  private getTitanValuesForFixture(fixtureId: string): Record<ChannelType, number> {
    const defaults: Record<ChannelType, number> = {
      dimmer: 0,
      red: 0,
      green: 0,
      blue: 0,
      white: 0,
      pan: 128,
      tilt: 128,
      zoom: 128,
      focus: 128,
      gobo: 0,
      prism: 0,
    }
    
    if (!this.layer0_titan?.intent) return defaults
    
    const intent = this.layer0_titan.intent
    
    // Global dimmer from masterIntensity
    defaults.dimmer = intent.masterIntensity * 255
    
    // Get primary color from palette (converted to RGB)
    if (intent.palette?.primary) {
      const rgb = this.hslToRgb(intent.palette.primary)
      defaults.red = rgb.r
      defaults.green = rgb.g
      defaults.blue = rgb.b
    }
    
    // Get movement center as pan/tilt
    if (intent.movement) {
      // centerX/Y are 0-1 where 0.5 = center
      // Convert to DMX 0-255 where 128 = center
      defaults.pan = intent.movement.centerX * 255
      defaults.tilt = intent.movement.centerY * 255
    }
    
    // TODO: Zone-based fixture mapping could go here
    // For now, all fixtures get the global values
    // Future: Look up fixture's zone and apply zone-specific intent
    
    return defaults
  }
  
  /**
   * Get manual value for a specific channel
   */
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
      default: return 0
    }
  }
  
  /**
   * Get effect value for a channel (if any effect affects it)
   */
  private getEffectValueForChannel(
    fixtureId: string,
    channel: ChannelType,
    now: number
  ): number | null {
    for (const effect of this.layer3_effects) {
      // Check if effect applies to this fixture
      if (effect.fixtureIds.length > 0 && !effect.fixtureIds.includes(fixtureId)) {
        continue
      }
      
      // Apply effect based on type
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
          if (channel === 'red') return 255
          if (channel === 'green') return 255
          if (channel === 'blue') return 255
          break
          
        case 'flash':
          if (channel === 'dimmer') {
            const elapsed = now - effect.startTime
            const progress = elapsed / effect.durationMs
            return 255 * effect.intensity * (1 - progress)  // Decay
          }
          break
          
        case 'freeze':
          // Freeze returns null to indicate "keep current value"
          // This is handled by not including it in merge
          return null
      }
    }
    
    return null
  }
  
  /**
   * Create blackout target
   */
  private createBlackoutTarget(
    fixtureId: string,
    controlSources: Partial<Record<ChannelType, ControlLayer>>
  ): FixtureLightingTarget {
    // All channels sourced from BLACKOUT layer
    const channels: ChannelType[] = ['dimmer', 'red', 'green', 'blue', 'pan', 'tilt', 'zoom', 'focus']
    for (const ch of channels) {
      controlSources[ch] = ControlLayer.BLACKOUT
    }
    
    return {
      fixtureId,
      dimmer: 0,
      color: { r: 0, g: 0, b: 0 },
      pan: 128,
      tilt: 128,
      zoom: 128,
      focus: 128,
      _controlSources: controlSources,
      _crossfadeActive: false,
      _crossfadeProgress: 0,
    }
  }
  
  /**
   * Build global effects state
   */
  private buildGlobalEffectsState(): GlobalEffectsState {
    return {
      strobeActive: this.layer3_effects.some(e => e.type === 'strobe'),
      strobeSpeed: this.layer3_effects.find(e => e.type === 'strobe')?.params.speed as number ?? 0,
      blinderActive: this.layer3_effects.some(e => e.type === 'blinder'),
      blinderIntensity: this.layer3_effects.find(e => e.type === 'blinder')?.intensity ?? 0,
      blackoutActive: this.layer4_blackout,
      freezeActive: this.layer3_effects.some(e => e.type === 'freeze'),
    }
  }
  
  /**
   * Check if any crossfade is active for a fixture
   */
  private isAnyCrossfadeActive(fixtureId: string): boolean {
    const channels: ChannelType[] = ['dimmer', 'red', 'green', 'blue', 'pan', 'tilt', 'zoom', 'focus']
    return channels.some(ch => this.crossfadeEngine.isTransitioning(fixtureId, ch))
  }
  
  /**
   * Get average crossfade progress for a fixture
   */
  private getAverageCrossfadeProgress(fixtureId: string): number {
    const channels: ChannelType[] = ['dimmer', 'red', 'green', 'blue', 'pan', 'tilt', 'zoom', 'focus']
    let total = 0
    let count = 0
    
    for (const ch of channels) {
      const state = this.crossfadeEngine.getTransitionState(fixtureId, ch)
      if (state) {
        total += state.progress
        count++
      }
    }
    
    return count > 0 ? total / count : 0
  }
  
  /**
   * HSL to RGB conversion
   */
  private hslToRgb(hsl: { h: number; s: number; l: number }): RGBOutput {
    const { h, s, l } = hsl
    const hNorm = h / 360
    const sNorm = s
    const lNorm = l
    
    let r: number, g: number, b: number
    
    if (sNorm === 0) {
      r = g = b = lNorm
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1
        if (t > 1) t -= 1
        if (t < 1/6) return p + (q - p) * 6 * t
        if (t < 1/2) return q
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
        return p
      }
      
      const q = lNorm < 0.5 ? lNorm * (1 + sNorm) : lNorm + sNorm - lNorm * sNorm
      const p = 2 * lNorm - q
      
      r = hue2rgb(p, q, hNorm + 1/3)
      g = hue2rgb(p, q, hNorm)
      b = hue2rgb(p, q, hNorm - 1/3)
    }
    
    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255),
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // STATUS & DEBUG
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Get arbiter status for debugging/UI
   */
  getStatus() {
    return {
      fixtureCount: this.fixtures.size,
      frameNumber: this.frameNumber,
      blackoutActive: this.layer4_blackout,
      titanActive: this.layer0_titan !== null,
      titanVibeId: this.layer0_titan?.vibeId ?? null,
      consciousnessActive: this.layer1_consciousness?.active ?? false,
      consciousnessStatus: this.layer1_consciousness?.status ?? null,
      manualOverrideCount: this.layer2_manualOverrides.size,
      manualFixtureIds: Array.from(this.layer2_manualOverrides.keys()),
      activeEffects: this.layer3_effects.map(e => e.type),
      activeCrossfades: this.crossfadeEngine.getActiveCount(),
    }
  }
  
  /**
   * Reset arbiter state
   */
  reset(): void {
    this.layer0_titan = null
    this.layer1_consciousness = null
    this.layer2_manualOverrides.clear()
    this.layer3_effects = []
    this.layer4_blackout = false
    this.crossfadeEngine.clearAll()
    this.frameNumber = 0
    
    if (this.config.debug) {
      console.log('[MasterArbiter] Reset complete')
    }
  }
  
  /**
   * Update configuration
   */
  updateConfig(config: Partial<MasterArbiterConfig>): void {
    this.config = { ...this.config, ...config }
    this.crossfadeEngine.setDefaultDuration(this.config.defaultCrossfadeMs)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON EXPORT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Global MasterArbiter instance
 * Use this for production - single source of truth.
 */
export const masterArbiter = new MasterArbiter()
