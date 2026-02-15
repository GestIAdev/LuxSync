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
  'originChanged': (fixtureId: string, origin: { pan: number; tilt: number }) => void  // 👻 WAVE 2042.21
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
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🚦 WAVE 1132: OUTPUT GATE - THE COLD START PROTOCOL
  // When false, system is in ARMED state: engine runs but DMX output is blocked
  // When true, system is in LIVE state: DMX flows to fixtures
  // DEFAULT: false (COLD START - no hot patching on app launch)
  // ═══════════════════════════════════════════════════════════════════════════
  private _outputEnabled: boolean = false
  
  // Fixtures (populated from HAL or StageStore)
  private fixtures: Map<string, ArbiterFixture> = new Map()
  
  // 🥶 WAVE 1165: GHOST PROTOCOL - Last known position cache
  // Used to freeze fixtures in place during blackout/silence instead of whipping to center
  private lastKnownPositions: Map<string, { pan: number; tilt: number }> = new Map()
  
  // 👻 WAVE 2042.21: GHOST HANDOFF - Fixture origin positions
  // When operator releases manual control, we store the position here so AI adopts it as "home"
  private fixtureOrigins: Map<string, { pan: number; tilt: number; timestamp: number }> = new Map()
  
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
    
    // 🚦 WAVE 1132: Log cold start state
    console.log('[MasterArbiter] 🚦 COLD START: Output DISABLED by default (ARMED state)')
    
    if (this.config.debug) {
      console.log('[MasterArbiter] Initialized with config:', this.config)
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // FIXTURE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * 🩸 WAVE 382: Register fixtures for arbitration
   * NOW PRESERVES: capabilities, hasMovementChannels, channels, type
   * Call this when patch changes or on init.
   * 
   * 🔥 WAVE 384.5: Enhanced logging to verify channel propagation
   */
  setFixtures(fixtures: ArbiterFixture[]): void {
    this.fixtures.clear()
    
    // 🩸 Track movers for individual movement calculation
    let moverCount = 0
    let totalChannels = 0
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🕵️ WAVE 1055: IDENTITY CRISIS DIAGNOSTIC (COMMENTED - Mission Accomplished)
    // Uncomment if stereo routing breaks again
    // ═══════════════════════════════════════════════════════════════════════
    // console.log(`\n[🕵️ WAVE 1055 IDENTITY AUDIT] ═══════════════════════════════════════`)
    // console.log(`[🕵️ WAVE 1055] Receiving ${fixtures.length} fixtures for registration:`)
    
    for (const fixture of fixtures) {
      const id = fixture.id ?? fixture.name
      // const posX = fixture.position?.x ?? 'UNDEFINED'
      // const posY = fixture.position?.y ?? 'UNDEFINED'
      const zone = fixture.zone || 'NO_ZONE'
      const name = fixture.name || 'NO_NAME'
      
      // 🕵️ WAVE 1055: Diagnose identity for EVERY fixture (DIAGNOSTICS COMMENTED)
      // const hasValidPosition = fixture.position?.x !== undefined && fixture.position?.x !== 0
      // const nameHasLR = name.toLowerCase().includes('left') || 
      //                   name.toLowerCase().includes('right') ||
      //                   name.toLowerCase().includes(' l ') ||
      //                   name.toLowerCase().includes(' r ')
      // const zoneHasLR = zone.toLowerCase().includes('left') || 
      //                   zone.toLowerCase().includes('right')
      
      // const identityStatus = hasValidPosition ? '✅ POS' : 
      //                       (nameHasLR ? '⚠️ NAME' : 
      //                       (zoneHasLR ? '⚠️ ZONE' : '❌ LOST'))
      
      // console.log(`[🕵️ IDENTITY] ${identityStatus} | "${name}" | zone="${zone}" | pos.x=${posX} | pos.y=${posY}`)
      
      // 🩸 WAVE 382: Preserve ALL metadata, don't strip
      const isMover = this.isMovingFixture(fixture)
      const channelCount = fixture.channels?.length || 0
      totalChannels += channelCount
      
      this.fixtures.set(id, { 
        ...fixture, 
        id,
        type: fixture.type || 'generic',
        // Preserve capabilities if sent, or infer from type
        capabilities: fixture.capabilities || {
          hasColor: true,
          hasDimmer: true,
          hasMovement: isMover,
          hasZoom: isMover,
          hasFocus: isMover,
        },
        hasMovementChannels: fixture.hasMovementChannels ?? isMover,
        channels: fixture.channels || [],
      })
      
      if (isMover) moverCount++
      
      // 🔥 WAVE 384.5: Log each fixture's channel info
      if (this.config.debug && channelCount > 0) {
        console.log(`[MasterArbiter] 📦 Fixture "${fixture.name}": ${channelCount} channels, movement=${fixture.hasMovementChannels}`)
      }
    }
    
    console.log(`[🕵️ WAVE 1055] ═══════════════════════════════════════════════════════════`)
    
    // Store mover count for spread calculations
    this.moverCount = moverCount
    
    // 🔥 WAVE 384.5: Summary log for verification
    console.log(`[MasterArbiter] 🩸 Registered ${this.fixtures.size} fixtures (${moverCount} movers, ${totalChannels} total channels)`)
  }
  
  /**
   * 🩸 WAVE 382: Helper to detect moving fixtures
   */
  private isMovingFixture(fixture: ArbiterFixture): boolean {
    const type = (fixture.type || '').toLowerCase()
    const zone = (fixture.zone || '').toUpperCase()
    return type.includes('moving') || 
           type.includes('spot') || 
           type.includes('beam') ||
           zone.includes('MOVING') ||
           fixture.hasMovementChannels === true
  }
  
  // 🩸 WAVE 382: Track mover count for spread calculation
  private moverCount: number = 0
  
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
   * WAVE 440: Now MERGES with existing override instead of replacing.
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
      console.warn(`[MasterArbiter] ❌ Unknown fixture: ${override.fixtureId}`)
      console.warn(`[MasterArbiter] 📋 Known fixtures: ${Array.from(this.fixtures.keys()).join(', ')}`)
      return
    }
    
    // 🔥 WAVE 1219: Debug log for successful override (only with controls for movement)
    if (override.overrideChannels.includes('pan') || override.overrideChannels.includes('tilt')) {
      console.log(`[MasterArbiter] ✅ Override accepted: ${override.fixtureId}`, override.overrideChannels, override.controls)
    }
    
    // 🎨 WAVE 2042.29: Debug log for color overrides
    const hasColor = override.overrideChannels.some(ch => ['red', 'green', 'blue'].includes(ch))
    if (hasColor) {
      console.log(`[MasterArbiter] 🎨 COLOR Override: ${override.fixtureId}`, {
        channels: override.overrideChannels,
        red: override.controls.red,
        green: override.controls.green,
        blue: override.controls.blue
      })
    }
    
    // WAVE 440: MEMORY MERGE - Fuse with existing override instead of replacing
    const existingOverride = this.layer2_manualOverrides.get(override.fixtureId)
    
    if (existingOverride) {
      // Merge controls: new values override existing, but keep non-conflicting ones
      const mergedControls = {
        ...existingOverride.controls,
        ...override.controls,
      }
      
      // Merge channels: union of both sets (no duplicates)
      const mergedChannels = [...new Set([
        ...existingOverride.overrideChannels,
        ...override.overrideChannels,
      ])]
      
      // Store merged override
      this.layer2_manualOverrides.set(override.fixtureId, {
        ...existingOverride,
        ...override,
        controls: mergedControls,
        overrideChannels: mergedChannels as ChannelType[],
        timestamp: performance.now()
      })
      
      if (this.config.debug) {
        console.log(`[MasterArbiter] 🔀 Merged override: ${override.fixtureId}`, {
          newChannels: override.overrideChannels,
          totalChannels: mergedChannels
        })
      }
    } else {
      // No existing override, store as new
      this.layer2_manualOverrides.set(override.fixtureId, {
        ...override,
        timestamp: performance.now()
      })
      
      if (this.config.debug) {
        console.log(`[MasterArbiter] ➕ New override: ${override.fixtureId}`, override.overrideChannels)
      }
    }
    
    // Emit event
    this.emit('manualOverride', override.fixtureId, override.overrideChannels)
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
  
  /**
   * 👻 WAVE 2042.21: GHOST HANDOFF - Set fixture origin for soft release
   * 
   * When the operator releases manual control, this method sets the current position
   * as the new "home" for the AI movement system. This prevents the fixture from
   * jumping to a random position when AI takes over.
   * 
   * @param fixtureId - The fixture to update
   * @param pan - Pan value in DMX (0-255)
   * @param tilt - Tilt value in DMX (0-255)
   */
  setFixtureOrigin(fixtureId: string, pan: number, tilt: number): void {
    // Store the origin position for this fixture
    // This will be used by getTitanValuesForFixture as a baseline
    this.fixtureOrigins.set(fixtureId, { pan, tilt, timestamp: performance.now() })
    
    if (this.config.debug) {
      console.log(`[MasterArbiter] 👻 Origin set: ${fixtureId} → P${pan}/T${tilt}`)
    }
    
    // Emit event for any listeners (e.g., movement manager)
    this.emit('originChanged', fixtureId, { pan, tilt })
  }
  
  /**
   * 👻 WAVE 2042.21: Get fixture origin (for AI movement baseline)
   */
  getFixtureOrigin(fixtureId: string): { pan: number; tilt: number } | null {
    return this.fixtureOrigins.get(fixtureId) ?? null
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
  // 🚦 WAVE 1132: OUTPUT GATE - THE COLD START PROTOCOL
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Set output enabled state (THE GATE)
   * When false: System is ARMED - engine runs, calculates, but DMX stays at safe values
   * When true: System is LIVE - DMX flows to fixtures
   * 
   * IMPORTANT: This is the final gate before hardware. 
   * Even with blackout OFF and GM at 100%, if outputEnabled is false → no DMX.
   */
  setOutputEnabled(enabled: boolean): void {
    const changed = this._outputEnabled !== enabled
    this._outputEnabled = enabled
    
    if (changed) {
      const state = enabled ? '🟢 LIVE' : '🔴 ARMED'
      console.log(`[MasterArbiter] 🚦 Output Gate: ${state}`)
      this.emit('outputEnabled', enabled)
    }
  }
  
  /**
   * Get output enabled state
   */
  isOutputEnabled(): boolean {
    return this._outputEnabled
  }
  
  /**
   * Toggle output enabled state
   */
  toggleOutput(): boolean {
    this.setOutputEnabled(!this._outputEnabled)
    return this._outputEnabled
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
    
    // 🔍 DEBUG: Log fixture registration status
    console.log(`[MasterArbiter] 🔍 setPattern called for ${fixtureIds.length} fixtures. Known fixtures: ${this.fixtures.size}`)
    
    for (const fixtureId of fixtureIds) {
      if (!this.fixtures.has(fixtureId)) {
        console.warn(`[MasterArbiter] ❌ Unknown fixture for pattern: ${fixtureId}`)
        console.warn(`[MasterArbiter] 📋 Known fixture IDs: ${Array.from(this.fixtures.keys()).slice(0, 5).join(', ')}...`)
        continue
      }
      
      this.activePatterns.set(fixtureId, config)
      console.log(`[MasterArbiter] ✅ Pattern ${pattern.type} injected for fixture ${fixtureId}`)
    }
    
    console.log(`[MasterArbiter] 📊 activePatterns now has ${this.activePatterns.size} entries`)
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
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🚦 WAVE 1132: OUTPUT GATE STATUS LOGGING (Throttled)
    // Log every ~5 seconds when in ARMED state so user knows DMX is blocked
    // ═══════════════════════════════════════════════════════════════════════
    if (!this._outputEnabled && this.frameNumber % 150 === 0) {
      console.log(`[MasterArbiter] 🚦 ARMED STATE: Output DISABLED | ${this.fixtures.size} fixtures forced to BLACKOUT | Press GO to enable DMX`)
    }
    
    // 🧹 WAVE 671.5: Silenced fixture processing spam (every 5s)
    // WAVE 380: Debug fixture IDs being processed
    // if (this.frameNumber % 300 === 0) { // Every ~5s at 60fps
    //   console.log(`[MasterArbiter] 🩸 Processing ${this.fixtures.size} fixtures:`, 
    //     Array.from(this.fixtures.keys()).slice(0, 3).join(', '), '...')
    // }
    
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
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🚦 WAVE 1132 + 1219: OUTPUT GATE - WITH CALIBRATION BYPASS
    // When output is DISABLED (ARMED state), AI/effects get BLACKOUT
    // BUT: Manual overrides (from Calibration/Commander) still work!
    // This allows testing hardware before going LIVE.
    // ═══════════════════════════════════════════════════════════════════════
    const manualOverride = this.layer2_manualOverrides.get(fixtureId)
    
    if (!this._outputEnabled && !manualOverride) {
      // No manual control → full blackout
      return this.createOutputGateBlackout(fixtureId)
    }
    
    // LAYER 4: Check blackout first (highest priority after output gate)
    if (this.layer4_blackout) {
      return this.createBlackoutTarget(fixtureId, controlSources)
    }
    
    // Get values from each layer
    const titanValues = this.getTitanValuesForFixture(fixtureId)
    // manualOverride already fetched above for OUTPUT GATE check
    
    // Merge each channel
    const dimmer = this.mergeChannelForFixture(fixtureId, 'dimmer', titanValues, manualOverride, now, controlSources)
    const red = this.mergeChannelForFixture(fixtureId, 'red', titanValues, manualOverride, now, controlSources)
    const green = this.mergeChannelForFixture(fixtureId, 'green', titanValues, manualOverride, now, controlSources)
    const blue = this.mergeChannelForFixture(fixtureId, 'blue', titanValues, manualOverride, now, controlSources)
    
    // Get position (with pattern/formation applied)
    const { pan, tilt } = this.getAdjustedPosition(fixtureId, titanValues, manualOverride, now)
    
    const zoom = this.mergeChannelForFixture(fixtureId, 'zoom', titanValues, manualOverride, now, controlSources)
    const focus = this.mergeChannelForFixture(fixtureId, 'focus', titanValues, manualOverride, now, controlSources)
    // 🔥 WAVE 1008.4: Merge speed channel for Pan/Tilt movement velocity
    const speed = this.mergeChannelForFixture(fixtureId, 'speed', titanValues, manualOverride, now, controlSources)
    // 🎨 WAVE 1008.6: Merge color_wheel channel (THE WHEELSMITH)
    const color_wheel = this.mergeChannelForFixture(fixtureId, 'color_wheel', titanValues, manualOverride, now, controlSources)
    
    // Check if any crossfade is active
    const crossfadeActive = this.isAnyCrossfadeActive(fixtureId)
    const crossfadeProgress = crossfadeActive ? this.getAverageCrossfadeProgress(fixtureId) : 0
    
    // Apply Grand Master to dimmer (final step before clamping)
    const dimmerfinal = clampDMX(dimmer * this.grandMaster)
    
    const target = {
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
      speed: clampDMX(speed),  // 🔥 WAVE 1008.4: Movement speed (0=fast, 255=slow)
      color_wheel: clampDMX(color_wheel),  // 🎨 WAVE 1008.6: Color wheel position (THE WHEELSMITH)
      _controlSources: controlSources,
      _crossfadeActive: crossfadeActive,
      _crossfadeProgress: crossfadeProgress,
    }
    
    // 🥶 WAVE 1165: GHOST PROTOCOL - Cache last known position for freeze-on-blackout
    this.lastKnownPositions.set(fixtureId, { pan: target.pan, tilt: target.tilt })
    
    return target
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
    
    // WAVE 380: TEST MODE - Heartbeat artificial cuando no hay Titan
    // Si no hay Titan activo (silencio de Selene), generar pulso suave
    const titanActive = this.layer0_titan !== null
    if (!titanActive && channel === 'dimmer') {
      // Pulso sinusoidal: 20% base + 10% oscilación = rango 10-30%
      const phase = (now / 3000) * Math.PI * 2 // 3 segundos por ciclo
      const pulse = 51 + Math.sin(phase) * 25 // DMX 26-76 (~10-30%)
      values.push({
        layer: ControlLayer.TITAN_AI,
        value: pulse,
        timestamp: now,
      })
      controlSources[channel] = ControlLayer.TITAN_AI
      // No agregar otros layers cuando test mode está activo
      return pulse
    }
    
    // Layer 0: Titan AI
    const titanValue = titanValues[channel] ?? 0
    
    // 🩸 WAVE 380.5: Kickstart REMOVED - data flow confirmed working
    // The system now properly shows colors from vibes
    
    values.push({
      layer: ControlLayer.TITAN_AI,
      value: titanValue,
      timestamp: this.layer0_titan?.timestamp ?? now,
    })
    
    // Layer 1: Consciousness (CORE 3 - placeholder)
    // Will be implemented when consciousness is connected
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🔧 WAVE 440.5: MANUAL OVERRIDE = ABSOLUTE PRIORITY
    // 
    // The previous LTP (Latest Takes Precedence) strategy was WRONG for manual.
    // Titan updates every frame with a new timestamp, so it always won.
    // 
    // FIX: Manual overrides WIN unconditionally. No timestamp comparison.
    // When user grabs control, they KEEP it until they release.
    // ═══════════════════════════════════════════════════════════════════════
    if (manualOverride && manualOverride.overrideChannels.includes(channel)) {
      const manualValue = this.getManualChannelValue(manualOverride, channel)
      controlSources[channel] = ControlLayer.MANUAL
      
      // 🎨 WAVE 2042.29: Debug log for color channels
      if (['red', 'green', 'blue'].includes(channel)) {
        console.log(`[MasterArbiter] 🎨 APPLYING ${channel}: ${manualValue} for ${fixtureId}`)
      }
      
      // DIRECT RETURN - Manual wins, skip merge entirely
      return manualValue
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
   * 🔧 WAVE 2042.24: Simplified - size already normalized 0-1
   */
  private calculatePatternOffset(pattern: PatternConfig, now: number): { panOffset: number; tiltOffset: number } {
    const elapsedMs = now - pattern.startTime
    const cycleDurationMs = (1000 / Math.max(0.01, pattern.speed))  // speed = cycles per second, prevent div by 0
    const phase = (elapsedMs % cycleDurationMs) / cycleDurationMs
    const t = phase * 2 * Math.PI  // 0 to 2π
    
    // 🔧 WAVE 2042.24: Size is already 0-1, applied in getAdjustedPosition
    // Here we just generate the shape with amplitude -1 to +1
    let panOffset = 0
    let tiltOffset = 0
    
    switch (pattern.type) {
      case 'circle':
        // Circle: x = cos(t), y = sin(t)
        panOffset = Math.cos(t)
        tiltOffset = Math.sin(t)
        break
        
      case 'eight':
        // Eight: x = sin(t), y = sin(2t) / 2
        panOffset = Math.sin(t)
        tiltOffset = Math.sin(t * 2) / 2
        break
        
      case 'sweep':
        // Sweep: x = sin(t), y = 0
        panOffset = Math.sin(t)
        tiltOffset = 0
        break
    }
    
    return { panOffset, tiltOffset }
  }
  
  /**
   * Get adjusted position with patterns and formations applied
   * 🔧 WAVE 2042.24: Fixed scale - All values in DMX 0-255 range
   */
  private getAdjustedPosition(
    fixtureId: string,
    titanValues: Record<ChannelType, number>,
    manualOverride: Layer2_Manual | undefined,
    now: number
  ): { pan: number; tilt: number } {
    // Get base position (DMX 0-255)
    const basePan = manualOverride?.controls.pan ?? titanValues.pan
    const baseTilt = manualOverride?.controls.tilt ?? titanValues.tilt
    
    // Apply pattern if active
    const pattern = this.activePatterns.get(fixtureId)
    if (pattern) {
      const offset = this.calculatePatternOffset(pattern, now)
      // 🔧 WAVE 2042.24: Scale offset to DMX range (0-255), not 16-bit
      // offset is -1 to 1, size is already normalized 0-1
      // Max movement = 128 DMX units (half range) * size
      const panMovement = offset.panOffset * 128 * pattern.size
      const tiltMovement = offset.tiltOffset * 128 * pattern.size
      
      const adjustedPan = pattern.center.pan + panMovement
      const adjustedTilt = pattern.center.tilt + tiltMovement
      
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
   * 🩸 WAVE 382: Get Titan values for a specific fixture
   * NOW WITH: Zone-based color mapping + Individual mover movement
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
      speed: 0,      // 0 = fast movement (critical for movers!)
      strobe: 0,
      color_wheel: 0,
      amber: 0,
      uv: 0,
    }
    
    if (!this.layer0_titan?.intent) return defaults
    
    const intent = this.layer0_titan.intent
    const fixture = this.fixtures.get(fixtureId)
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🔦 WAVE 411 FIX: OPTICS HANDOFF
    // Si Titan envía óptica, úsala. Si no, usa el default (128).
    // ═══════════════════════════════════════════════════════════════════════
    if (intent.optics) {
      defaults.zoom = intent.optics.zoom ?? 128
      defaults.focus = intent.optics.focus ?? 128
      // Si tuvieras iris, también aquí:
      // defaults.iris = intent.optics.iris ?? 0
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🧱 WAVE 1039: 7-ZONE STEREO ROUTING
    // Demolición del "Muro de Luz Mono"
    // 🔧 WAVE 1052: ROBUST IDENTITY - Multi-heuristic Left/Right detection
    // ═══════════════════════════════════════════════════════════════════════
    
    const zone = (fixture?.zone || 'UNASSIGNED').toLowerCase()
    const fixtureType = (fixture?.type || 'generic').toLowerCase()
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🕵️‍♂️ WAVE 1052: ROBUST LATERALITY DETECTION
    // ═══════════════════════════════════════════════════════════════════════
    // PROBLEM: If position.x is undefined/0, isLeft was always FALSE
    //          → ALL fixtures assigned to RIGHT channel
    //          → frontL had no fixtures → MONO visual
    //
    // SOLUTION: Multi-heuristic detection using:
    //   1. Physical position.x (primary)
    //   2. Fixture name contains "left"/"izq"/"L"
    //   3. Zone name contains "left"
    // ═══════════════════════════════════════════════════════════════════════
    
    const nameStr = (fixture?.name || '').toLowerCase()
    const zoneStr = zone  // Already lowercase
    const posX = fixture?.position?.x ?? 0
    
    // Is Left IF: (X < -0.1) OR (Name says "left") OR (Zone says "left")
    // Using -0.1 threshold instead of 0 to avoid centerline ambiguity
    const isLeft = (posX < -0.1) || 
                   nameStr.includes('left') || 
                   nameStr.includes('izq') ||      // Spanish "Izquierda"
                   nameStr.includes(' l ') ||      // "Front L PAR"
                   nameStr.endsWith(' l') ||       // "PAR L"
                   nameStr.startsWith('l ') ||     // "L PAR"
                   zoneStr.includes('left') ||
                   zoneStr.includes('moving_left')
    
    // 2. Detectar si Titan está enviando señal Estéreo
    // (Si frontL existe en el intent, asumimos modo 7-zonas)
    const hasStereoSignal = intent.zones && 'frontL' in intent.zones
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🕵️ WAVE 1055: ROUTING DECISION DIAGNOSTIC (COMMENTED - Mission Accomplished)
    // Uncomment if stereo routing breaks again
    // ═══════════════════════════════════════════════════════════════════════
    // if (this.frameNumber % 60 === 1) {
    //   const debugPosX = posX.toFixed(2)
    //   const debugIsLeft = isLeft ? 'LEFT' : 'RIGHT'
    //   const debugHasStereo = hasStereoSignal ? 'STEREO' : 'MONO'
    //   console.log(`[🕵️ ROUTING] "${nameStr.substring(0,20)}" | pos.x=${debugPosX} | zone="${zoneStr}" | → ${debugIsLeft} | signal=${debugHasStereo}`)
    // }
    
    // 3. Mapeo Dinámico
    // Tipado extendido localmente para incluir las nuevas zonas
    let intentZone: string = 'front' 
    
    if (zone.includes('front')) {
      if (hasStereoSignal) {
        intentZone = isLeft ? 'frontL' : 'frontR'
      } else {
        intentZone = 'front' // Legacy Fallback
      }
    } else if (zone.includes('back')) {
      if (hasStereoSignal) {
        intentZone = isLeft ? 'backL' : 'backR'
      } else {
        intentZone = 'back' // Legacy Fallback
      }
    } else if (zone.includes('left')) {
      intentZone = 'left' // Movers L
    } else if (zone.includes('right')) {
      intentZone = 'right' // Movers R
    } else if (zone.includes('ambient') || zone === 'unassigned') {
      intentZone = 'ambient'
    } else {
      // Caso Air/Ceiling no mapeado explícitamente -> Ambient o Front
      intentZone = 'ambient' 
    }
    
    // Acceso dinámico seguro (TypeScript-friendly)
    const zoneIntent = (intent.zones as any)?.[intentZone]
    const zoneIntensity = zoneIntent?.intensity ?? intent.masterIntensity
    defaults.dimmer = zoneIntensity * 255
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🎨 WAVE 382: ZONE-BASED COLOR MAPPING (No more monochrome!)
    // NOW WITH: Zone-based paletteRole mapping
    // ═══════════════════════════════════════════════════════════════════════
    
    const zoneUpper = zone.toUpperCase()
    
    // 🎨 WAVE 410: Determine which palette color to use based on zone + paletteRole
    let selectedColor = intent.palette?.primary  // Default fallback
    const paletteRole = zoneIntent?.paletteRole || 'primary'  // Get role from intent
    
    // Map paletteRole to actual palette color
    switch (paletteRole) {
      case 'primary':
        selectedColor = intent.palette?.primary
        break
      case 'secondary':
        selectedColor = intent.palette?.secondary || intent.palette?.primary
        break
      case 'accent':
        selectedColor = intent.palette?.accent || intent.palette?.secondary || intent.palette?.primary
        break
      case 'ambient':
        // 🎨 WAVE 412 FIX: Use palette.ambient directly (SeleneLux provides 4-color palette)
        // ANTES: Darkened primary (legacy assumption: ambient = dark version of primary)
        // AHORA: Use ambient color from palette (e.g., Cyan in Complementary scheme)
        selectedColor = intent.palette?.ambient || intent.palette?.primary
        break
      default:
        selectedColor = intent.palette?.primary
    }
    
    // Legacy zone-based fallback (if paletteRole not set)
    if (!zoneIntent?.paletteRole) {
      if (zoneUpper.includes('FRONT')) {
        // 🟡 FRONT: Warm wash - PRIMARY color
        selectedColor = intent.palette?.primary
      } else if (zoneUpper.includes('BACK')) {
        // � BACK: Cool contrast - ACCENT color (NOT secondary!)
        selectedColor = intent.palette?.accent || intent.palette?.secondary || intent.palette?.primary
      } else if (zoneUpper.includes('LEFT') || zoneUpper.includes('RIGHT')) {
        // 🟢 SIDES: Secondary
        selectedColor = intent.palette?.secondary || intent.palette?.primary
      } else if (zoneUpper.includes('MOVING') || this.isMovingFixture(fixture!)) {
        // 🟣 MOVERS: Dramatic accent - ACCENT or SECONDARY
        selectedColor = intent.palette?.accent || intent.palette?.secondary || intent.palette?.primary
      }
    }
    
    // Convert selected HSL to RGB
    if (selectedColor) {
      const rgb = this.hslToRgb(selectedColor)
      defaults.red = rgb.r
      defaults.green = rgb.g
      defaults.blue = rgb.b
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // ═══════════════════════════════════════════════════════════════════════
    // 🎯 WAVE 382: INDIVIDUAL MOVER MOVEMENT (No more Borg convergence!)
    // 🔧 WAVE 1046: THE MECHANICS BYPASS - Use explicit L/R coordinates if provided
    // 🔧 WAVE 1052: ROBUST MECHANICS DRAGNET - Search mechanics in ALL possible locations
    // ═══════════════════════════════════════════════════════════════════════
    
    if (intent.movement && fixture) {
      const isMover = this.isMovingFixture(fixture)
      
      if (isMover) {
        // ═══════════════════════════════════════════════════════════════════════
        // 🔧 WAVE 1052: ROBUST MECHANICS BYPASS
        // ═══════════════════════════════════════════════════════════════════════
        // PROBLEM: Mechanics could be in:
        //   - intent.movement.mechanicsL/R (WAVE 1046 standard)
        //   - intent.mechanics.moverL/R (WAVE 1044 legacy)
        //   - Nowhere (fallback to VMM)
        //
        // SOLUTION: Search ALL locations, use first found
        // ═══════════════════════════════════════════════════════════════════════
        
        let mechanic = null
        
        // 1. Try intent.movement.mechanicsL/R (WAVE 1046 Standard)
        if (intent.movement.mechanicsL && intent.movement.mechanicsR) {
          mechanic = isLeft ? intent.movement.mechanicsL : intent.movement.mechanicsR
        }
        
        // 2. Try intent.mechanics (root-level, WAVE 1044 Legacy)
        if (!mechanic && (intent as any).mechanics) {
          const rootMech = (intent as any).mechanics
          if (rootMech.moverL && rootMech.moverR) {
            mechanic = isLeft ? rootMech.moverL : rootMech.moverR
          }
        }
        
        // 3. Apply mechanics if found
        if (mechanic) {
          // THE DEEP FIELD / CELESTIAL MOVERS: Use explicit coordinates
          defaults.pan = mechanic.pan * 255
          defaults.tilt = mechanic.tilt * 255
          
          // WAVE 1048: Intensity coupling (if present)
          if (mechanic.intensity !== undefined) {
            defaults.dimmer = mechanic.intensity * 255
          }
          
          // ═══════════════════════════════════════════════════════════════════
          // 🌊 WAVE 1072: DEPRECATED - colorOverride bypass removed
          // ═══════════════════════════════════════════════════════════════════
          // ANTES (WAVE 1060): Usábamos colorOverride para bypasear el engine
          // y forzar colores oceánicos hardcodeados.
          //
          // AHORA: La modulación oceánica se aplica via oceanicModulation en
          // SeleneColorEngine.generate(), integrándose con la constitution
          // en vez de bypasear. Los colores ya vienen correctos en la paleta.
          //
          // if ((intent as any).mechanics?.colorOverride) { ... }  // REMOVED
          // ═══════════════════════════════════════════════════════════════════
          
        } else if (this.moverCount > 1) {
          // LEGACY: Calculate spread offset based on mover index
          const moverIndex = this.getMoverIndex(fixtureId)
          
          // Formula: Creates a fan pattern centered around the base position
          const spreadFactor = 0.15  // How much to spread (0.15 = 15% of full range per mover)
          const totalSpread = spreadFactor * (this.moverCount - 1)
          const offset = (moverIndex * spreadFactor) - (totalSpread / 2)
          
          // Apply offset to base position, clamped to 0-1 range
          const basePan = intent.movement.centerX
          const baseTilt = intent.movement.centerY
          
          // Pan spreads horizontally, Tilt stays mostly centered with slight variation
          const finalPan = Math.max(0, Math.min(1, basePan + offset))
          const finalTilt = Math.max(0, Math.min(1, baseTilt + (offset * 0.3)))  // Less vertical spread
          
          defaults.pan = finalPan * 255
          defaults.tilt = finalTilt * 255
        } else {
          // Single mover: use base position
          defaults.pan = intent.movement.centerX * 255
          defaults.tilt = intent.movement.centerY * 255
        }
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // � WAVE 1072: DEPRECATED - Global colorOverride bypass removed
    // ═══════════════════════════════════════════════════════════════════════
    // ANTES (WAVE 1060): Había un segundo bypass global aquí para forzar
    // colores oceánicos en TODOS los fixtures.
    //
    // AHORA: Los colores ya vienen correctos desde SeleneColorEngine porque
    // oceanicModulation modula la paleta de forma natural.
    //
    // if ((intent as any).mechanics?.colorOverride) { ... }  // REMOVED
    // ═══════════════════════════════════════════════════════════════════════
    
    return defaults
  }
  
  /**
   * 🩸 WAVE 382: Get mover index for spread calculation
   */
  private getMoverIndex(fixtureId: string): number {
    let moverIndex = 0
    for (const [id, fixture] of this.fixtures) {
      if (this.isMovingFixture(fixture)) {
        if (id === fixtureId) return moverIndex
        moverIndex++
      }
    }
    return 0  // Fallback
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
      // 🔥 WAVE 1008.2: Movement speed and additional channels
      case 'speed': return controls.speed ?? 128
      case 'strobe': return controls.strobe ?? 0
      case 'gobo': return controls.gobo ?? 0
      case 'color_wheel': return controls.color_wheel ?? 0
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
   * 🥶 WAVE 1165: GHOST PROTOCOL - Create blackout target with FREEZE
   * Blackout = dimmer 0 + shutter closed, BUT position FREEZES in place
   */
  private createBlackoutTarget(
    fixtureId: string,
    controlSources: Partial<Record<ChannelType, ControlLayer>>
  ): FixtureLightingTarget {
    // All channels sourced from BLACKOUT layer
    const channels: ChannelType[] = ['dimmer', 'red', 'green', 'blue', 'pan', 'tilt', 'zoom', 'focus', 'speed', 'color_wheel']
    for (const ch of channels) {
      controlSources[ch] = ControlLayer.BLACKOUT
    }
    
    // 🥶 WAVE 1165: GHOST PROTOCOL - Get last known position to FREEZE in place
    const lastPos = this.lastKnownPositions.get(fixtureId)
    const freezePan = lastPos?.pan ?? 128
    const freezeTilt = lastPos?.tilt ?? 128
    
    return {
      fixtureId,
      dimmer: 0,
      color: { r: 0, g: 0, b: 0 },
      pan: freezePan,       // 🥶 FREEZE: Stay where you are
      tilt: freezeTilt,     // 🥶 FREEZE: Stay where you are
      zoom: 128,
      focus: 128,
      speed: 0,  // 🔥 WAVE 1008.4: Fast movement during blackout (0=fast)
      color_wheel: 0,  // 🎨 WAVE 1008.6: Color wheel off during blackout
      _controlSources: controlSources,
      _crossfadeActive: false,
      _crossfadeProgress: 0,
    }
  }
  
  /**
   * 🚦 WAVE 1132: Create OUTPUT GATE blackout target
   * 
   * This is the SUPREME blackout - when the system is in ARMED state,
   * ALL fixtures are forced to safe values regardless of any other layer.
   * Different from manual blackout: this is a safety interlock, not a creative choice.
   * 
   * 🥶 WAVE 1165: GHOST PROTOCOL - FREEZE instead of WHIP
   * 
   * SAFE STATE:
   * - Dimmer: 0 (no light emission)
   * - Color: Black (no color)
   * - Position: LAST KNOWN (freeze in place) or Center if unknown
   * - Speed: 0 (fast) - if enabled later, respond quickly
   * - Color wheel: 0 (open/white)
   */
  private createOutputGateBlackout(fixtureId: string): FixtureLightingTarget {
    // Mark all channels as controlled by OUTPUT_GATE (BLACKOUT layer for compatibility)
    const controlSources: Partial<Record<ChannelType, ControlLayer>> = {}
    const channels: ChannelType[] = ['dimmer', 'red', 'green', 'blue', 'pan', 'tilt', 'zoom', 'focus', 'speed', 'color_wheel']
    for (const ch of channels) {
      controlSources[ch] = ControlLayer.BLACKOUT  // Use BLACKOUT layer for compatibility
    }
    
    // 🥶 WAVE 1165: GHOST PROTOCOL - Get last known position to FREEZE in place
    const lastPos = this.lastKnownPositions.get(fixtureId)
    const freezePan = lastPos?.pan ?? 128   // Default to center if no history
    const freezeTilt = lastPos?.tilt ?? 128
    
    return {
      fixtureId,
      dimmer: 0,                    // 🚫 No light
      color: { r: 0, g: 0, b: 0 },  // 🖤 Black
      pan: freezePan,               // 🥶 FREEZE: Last known position
      tilt: freezeTilt,             // 🥶 FREEZE: Last known position
      zoom: 128,                    // 🔍 Mid zoom
      focus: 128,                   // 🔍 Mid focus
      speed: 0,                     // ⚡ Fast response when enabled
      color_wheel: 0,               // ⚪ Open/white
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
   * 🩸 WAVE 380 FIX: HSL values are already normalized (0-1), don't divide by 360!
   */
  private hslToRgb(hsl: { h: number; s: number; l: number }): RGBOutput {
    const { h, s, l } = hsl
    // 🩸 WAVE 380: h is already 0-1 from ColorPalette (HSLColor interface)
    // Don't divide by 360 - that was destroying all colors to red!
    const hNorm = h
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
   * 🚦 WAVE 1132: Added outputEnabled for Cold Start Protocol
   */
  getStatus() {
    return {
      fixtureCount: this.fixtures.size,
      frameNumber: this.frameNumber,
      // 🚦 WAVE 1132: Output Gate status
      outputEnabled: this._outputEnabled,
      blackoutActive: this.layer4_blackout,
      grandMaster: this.grandMaster,
      titanActive: this.layer0_titan !== null,
      titanVibeId: this.layer0_titan?.vibeId ?? null,
      consciousnessActive: this.layer1_consciousness?.active ?? false,
      consciousnessStatus: this.layer1_consciousness?.status ?? null,
      manualOverrideCount: this.layer2_manualOverrides.size,
      manualFixtureIds: Array.from(this.layer2_manualOverrides.keys()),
      hasManualOverrides: this.layer2_manualOverrides.size > 0,
      activeEffects: this.layer3_effects.map(e => e.type),
      activeCrossfades: this.crossfadeEngine.getActiveCount(),
    }
  }
  
  /**
   * Reset arbiter state
   * 🚦 WAVE 1132: Reset also sets outputEnabled to false (back to COLD)
   */
  reset(): void {
    this.layer0_titan = null
    this.layer1_consciousness = null
    this.layer2_manualOverrides.clear()
    this.layer3_effects = []
    this.layer4_blackout = false
    this._outputEnabled = false  // 🚦 WAVE 1132: Reset to COLD state
    this.crossfadeEngine.clearAll()
    this.frameNumber = 0
    
    console.log('[MasterArbiter] 🚦 Reset complete - Output DISABLED (COLD state)')
    
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
