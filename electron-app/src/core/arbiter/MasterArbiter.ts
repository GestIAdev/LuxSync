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
import { normalizeZone } from '../stage/ShowFileV2'

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
  type: 'circle' | 'eight' | 'sweep' | 'tornado' | 'gravity_bounce' | 'butterfly' | 'heartbeat'
  speed: number      // 0.05-1.5 Hz (cycles per second)
  size: number       // 0-1 (amplitude as fraction of half DMX range)
  center: { pan: number; tilt: number }  // DMX 0-255 anchor position
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
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🏎️ WAVE 2074.3: POSITION RELEASE FADE — THE SOFT HANDOFF
  //
  // Cuando el operador suelta el XY pad (manual release), los canales de
  // dimmer/color ya tienen crossfade via CrossfadeEngine. Pero pan/tilt
  // pasan por getAdjustedPosition() que devuelve HARD CUT al titan value.
  //
  // SOLUCIÓN: Post-process DESPUÉS de getAdjustedPosition().
  // Se captura la última posición manual al momento del release y se
  // interpola linealmente hacia la posición Titan durante POSITION_RELEASE_MS.
  //
  // Esto es un POST-PROCESS — NO contamina Titan values (ese era el bug
  // del Ghost Handoff original que se tuvo que exorcizar en WAVE 2070.3).
  // ═══════════════════════════════════════════════════════════════════════
  private positionReleaseFades: Map<string, {
    fromPan: number
    fromTilt: number
    startTime: number
    durationMs: number
  }> = new Map()
  private readonly POSITION_RELEASE_MS = 500  // Fade suave de medio segundo
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🎬 WAVE 2063: HYBRID MODE - Playback with Titan coexistence
  // Chronos controls color/dimmer. Titan controls movement (when vibe active).
  // ═══════════════════════════════════════════════════════════════════════
  private playbackActive: boolean = false
  private currentPlaybackFrame: Map<string, FixtureLightingTarget> = new Map()
  private _playbackMeta: { hasActiveVibe: boolean; vibeId: string | null } = { hasActiveVibe: false, vibeId: null }
  
  // Grand Master (WAVE 376)
  private grandMaster: number = 1.0  // 0-1, multiplies dimmer globally
  
  // Pattern Engine (WAVE 376)
  private activePatterns: Map<string, PatternConfig> = new Map()
  
  // Group Formations (WAVE 376)
  private activeFormations: Map<string, GroupFormation> = new Map()
  
  // State tracking
  private frameNumber: number = 0
  private lastOutputTimestamp: number = 0

  // 🔎 WAVE 1219.4: Trace throttles (avoid console storms)
  private _traceLastArbiterLogAtMs = 0

  // 🔎 WAVE 2122.2: Output Gate assassination tracking
  // We keep the last origin (label + stack) so when outputEnabled flips unexpectedly,
  // we can name the killer.
  private _lastOutputGateChange: {
    enabled: boolean
    atMs: number
    label?: string
    stack?: string
  } | null = null
  
  constructor(config: Partial<MasterArbiterConfig> = {}) {
    super()
    this.config = { ...DEFAULT_ARBITER_CONFIG, ...config }
    this.crossfadeEngine = new CrossfadeEngine(this.config.defaultCrossfadeMs)
    
    // WAVE 2098: Boot silence
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
    
    // WAVE 2098: Boot silence — WAVE 1055 separator removed
    
    // Store mover count for spread calculations
    this.moverCount = moverCount
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

  /**
   * 🎯 WAVE 2067: ZONE-AWARE FIXTURE RESOLUTION
   * 
   * Maps effect zone IDs (from EffectFrameOutput.zoneOverrides) to real fixture IDs.
   * Effects use abstract zones like 'front', 'back', 'all-pars', 'all-movers'.
   * This resolves them to the actual fixtures registered in the Arbiter.
   * 
   * ZONE VOCABULARY:
   * ┌─────────────────────┬──────────────────────────────────────────────────┐
   * │ Effect Zone         │ Maps To (CanonicalZones)                        │
   * ├─────────────────────┼──────────────────────────────────────────────────┤
   * │ 'front'             │ front                                           │
   * │ 'back'              │ back                                            │
   * │ 'floor'             │ floor                                           │
   * │ 'all-pars' / 'pars' │ front + back + floor                            │
   * │ 'all-movers'/'movers│ movers-left + movers-right                     │
   * │ 'center'            │ center                                          │
   * │ 'air'               │ air                                             │
   * │ 'all' / '*'         │ ALL fixtures                                    │
   * │ 'front_left' etc.   │ front (positional subset - future)             │
   * └─────────────────────┴──────────────────────────────────────────────────┘
   * 
   * @param effectZone Zone ID from the effect's zoneOverrides
   * @returns Array of fixture IDs belonging to that zone
   */
  getFixtureIdsByZone(effectZone: string): string[] {
    const zone = effectZone.toLowerCase().trim()

    // Wildcard → everything
    if (zone === 'all' || zone === '*') {
      return this.getFixtureIds()
    }

    // Composite zones → union of canonical zones
    const COMPOSITE_ZONES: Record<string, string[]> = {
      'all-pars':   ['front', 'back', 'floor'],
      'pars':       ['front', 'back', 'floor'],
      'all-movers': ['movers-left', 'movers-right'],
      'movers':     ['movers-left', 'movers-right'],
    }

    const canonicalTargets = COMPOSITE_ZONES[zone]
      ? COMPOSITE_ZONES[zone]
      : [zone] // Single zone — use as-is

    // 🎯 WAVE 2067.1: Resolve via normalizeZone() — handles ALL legacy formats
    // BEFORE: fixture.zone.toLowerCase() → 'front_pars' ≠ 'front' → MISS
    // NOW:    normalizeZone('FRONT_PARS') → 'front' → MATCH
    const result: string[] = []
    for (const [id, fixture] of this.fixtures) {
      const fixtureZone = normalizeZone(fixture.zone)
      if (canonicalTargets.includes(fixtureZone)) {
        result.push(id)
      }
    }

    // Positional sub-zones (GatlingRaid style): front_left, back_center, etc.
    // These need stereo/position resolution — match by zone prefix + position
    if (result.length === 0 && zone.includes('_')) {
      const [zoneBase, side] = zone.split('_')
      for (const [id, fixture] of this.fixtures) {
        const fixtureZone = normalizeZone(fixture.zone)
        if (!fixtureZone.startsWith(zoneBase)) continue

        // Match by name/position hints
        const name = (fixture.name || '').toLowerCase()
        if (side === 'left' && (name.includes('left') || name.includes(' l ') || fixtureZone.includes('left'))) {
          result.push(id)
        } else if (side === 'right' && (name.includes('right') || name.includes(' r ') || fixtureZone.includes('right'))) {
          result.push(id)
        } else if (side === 'center' && (name.includes('center') || name.includes('centre') || fixtureZone === zoneBase)) {
          result.push(id)
        }
      }
    }

    // FALLBACK: If zone resolved to NOTHING, return ALL fixtures rather than silence.
    // Better to light everything than light nothing.
    if (result.length === 0) {
      console.warn(
        `[MasterArbiter] ⚠️ WAVE 2067: Zone "${effectZone}" matched 0 fixtures — falling back to wildcard`
      )
      return this.getFixtureIds()
    }

    return result
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
    console.log(`[RADAR 1 - ENTRADA] UI mandó control a ${override.fixtureId}:`, override.controls);
    
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
    // Disabled: WAVE 2052 - Too spammy (60 FPS, every fixture with pan/tilt override)
    // if (override.overrideChannels.includes('pan') || override.overrideChannels.includes('tilt')) {
    //   console.log(`[MasterArbiter] ✅ Override accepted: ${override.fixtureId}`, override.overrideChannels, override.controls)
    // }
    
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
   * 🔧 WAVE 2070.3: EXORCISM — Also purge patterns and origins for released fixtures.
   *   Without this, activePatterns stayed orphaned after UNLOCK, keeping the fixture
   *   locked on pattern.center instead of returning to Titan/Selene.
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
    
    // 🔧 WAVE 2070.3 + 2070.4: MANDATORY pattern purge on pan/tilt release
    // If channels is undefined (full release) OR contains 'pan'/'tilt',
    // the pattern MUST die. No zombies. No orphans.
    const releasingMovement = channelsToRelease.includes('pan' as ChannelType) || 
                               channelsToRelease.includes('tilt' as ChannelType)
    if (!channels || releasingMovement) {
      // 🏎️ WAVE 2074.3: POSITION RELEASE FADE — Capture manual position for soft handoff
      // BEFORE purging the override, grab the current position for interpolation.
      // This operates AFTER getAdjustedPosition (post-process) — does NOT contaminate Titan.
      const lastManualPan = override.controls.pan ?? 128
      const lastManualTilt = override.controls.tilt ?? 128
      this.positionReleaseFades.set(fixtureId, {
        fromPan: lastManualPan,
        fromTilt: lastManualTilt,
        startTime: Date.now(),
        durationMs: this.POSITION_RELEASE_MS,
      })
      console.log(`[MasterArbiter] 🏎️ WAVE 2074.3: Position release fade started: ${fixtureId} from P${lastManualPan.toFixed(0)}/T${lastManualTilt.toFixed(0)} (${this.POSITION_RELEASE_MS}ms)`)
      
      // OBLIGATORY: Annihilate active pattern for this fixture
      if (this.activePatterns.has(fixtureId)) {
        this.activePatterns.delete(fixtureId)
        console.log(`[MasterArbiter] 🧹 WAVE 2070.4: Pattern ANNIHILATED on release: ${fixtureId} (fullRelease=${!channels}, movement=${releasingMovement})`)
      }
      // Purge ghost origin
      if (this.fixtureOrigins.has(fixtureId)) {
        this.fixtureOrigins.delete(fixtureId)
      }
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
      // Capture origin (best-effort). This is intentionally lightweight.
      const stack = new Error().stack
      const last = this._lastOutputGateChange
      this._lastOutputGateChange = {
        enabled,
        atMs: Date.now(),
        // label will be set by tagged callers via setOutputEnabledTagged()
        label: last?.label,
        stack,
      }

      console.log(`[MasterArbiter] 🚦 Output Gate: ${state}`, {
        prev: last?.enabled,
        label: this._lastOutputGateChange.label ?? 'unknown',
      })
      // Print a trimmed stack once per flip (high-signal, low-frequency)
      if (stack) {
        const trimmed = stack.split('\n').slice(0, 8).join('\n')
        console.log('[MasterArbiter] 🚦 Output Gate origin (trimmed):\n' + trimmed)
      }
      this.emit('outputEnabled', enabled)
    }
  }

  /**
   * 🔎 WAVE 2122.2: Tagged gate change — use this from IPC/UI/calibration flows.
   * Keeps the same public API, but lets us name the caller in logs.
   */
  setOutputEnabledTagged(enabled: boolean, label: string): void {
    this._lastOutputGateChange = {
      enabled: this._outputEnabled,
      atMs: Date.now(),
      label,
      stack: this._lastOutputGateChange?.stack,
    }
    this.setOutputEnabled(enabled)
    // After setOutputEnabled runs, it will emit/log with the label.
    if (this._lastOutputGateChange) {
      this._lastOutputGateChange.label = label
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
   * 🔧 WAVE 2070.2: Update pattern speed/size WITHOUT resetting startTime.
   * 
   * The old flow re-created the entire PatternConfig on every slider change,
   * which reset startTime = performance.now() → phase = 0 → pattern never
   * completes a cycle. Now we surgically update speed/size in-place.
   */
  updatePatternParams(fixtureIds: string[], speed: number, size: number): void {
    for (const fixtureId of fixtureIds) {
      const existing = this.activePatterns.get(fixtureId)
      if (existing) {
        existing.speed = speed
        existing.size = size
        // startTime stays untouched → phase continues uninterrupted
      }
    }
  }
  
  /**
   * Get pattern for a fixture
   */
  getPattern(fixtureId: string): PatternConfig | undefined {
    return this.activePatterns.get(fixtureId)
  }
  
  /**
   * 🔧 WAVE 2071: THE ANCHOR — Get current effective position for a fixture.
   * 
   * Returns the REAL position the fixture is at RIGHT NOW:
   *   1. If manualOverride has pan/tilt → use that (user moved XY pad)
   *   2. Otherwise → snapshot Titan's current position (AI is driving)
   * 
   * This is the ONLY correct way to capture an anchor point for patterns.
   * Without this, patterns orbit around a moving center (Titan) = chaos.
   */
  getCurrentPosition(fixtureId: string): { pan: number; tilt: number } {
    const override = this.layer2_manualOverrides.get(fixtureId)
    if (override?.controls.pan !== undefined && override?.controls.tilt !== undefined) {
      return { pan: override.controls.pan, tilt: override.controls.tilt }
    }
    const titanValues = this.getTitanValuesForFixture(fixtureId)
    return { pan: titanValues.pan, tilt: titanValues.tilt }
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
  // 🔥 WAVE 2056: DIRECT DRIVE - Playback Frame Injection
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * 🔥 WAVE 2056: SCORCHED EARTH PROTOCOL
   * 
   * Inject a complete playback frame from TimelineEngine.
   * ═══════════════════════════════════════════════════════════════════════
   * 🎬 WAVE 2063: HYBRID MODE — Smart Override, NOT Scorched Earth
   * ═══════════════════════════════════════════════════════════════════════
   * 
   * When playback is active, Chronos controls COLOR channels (dimmer, RGB, white, color_wheel).
   * If a Vibe is active, Titan KEEPS control of MOVEMENT channels (pan, tilt, zoom, speed).
   * 
   * This is NOT video rendering anymore — it's a smart layer overlay.
   * Chronos is a color director. Titan is a movement director. They coexist.
   * 
   * @param fixtures Array of fixture states from TimelineEngine
   * @param meta Hybrid metadata: whether a vibe is active, and which vibe
   */
  setPlaybackFrame(
    fixtures: FixtureLightingTarget[],
    meta?: { hasActiveVibe: boolean; vibeId: string | null }
  ): void {
    this.currentPlaybackFrame.clear()
    
    for (const fixture of fixtures) {
      this.currentPlaybackFrame.set(fixture.fixtureId, fixture)
    }
    
    // Activate playback mode
    this.playbackActive = true
    
    // 🎬 WAVE 2063: Store hybrid metadata
    this._playbackMeta = meta ?? { hasActiveVibe: false, vibeId: null }
    
    if (this.config.debug && this.frameNumber % 60 === 0) {
      const mode = this._playbackMeta.hasActiveVibe ? 'HYBRID (Titan+Chronos)' : 'COLOR ONLY'
      console.log(`[MasterArbiter] 🎬 PLAYBACK ${mode}: ${fixtures.length} fixtures | vibe: ${this._playbackMeta.vibeId ?? 'none'}`)
    }
  }
  
  /**
   * Stop playback mode and return to normal layer arbitration
   */
  stopPlayback(): void {
    this.playbackActive = false
    this.currentPlaybackFrame.clear()
    this._playbackMeta = { hasActiveVibe: false, vibeId: null }
    console.log('[MasterArbiter] 🎬 PLAYBACK STOPPED: Returning to normal layer arbitration')
  }
  
  /**
   * Check if playback is active
   */
  isPlaybackActive(): boolean {
    return this.playbackActive
  }

  /**
   * 🎬 WAVE 2065: Get the fixture IDs that Chronos is CURRENTLY controlling.
   * 
   * In Transparent Overlay mode, Chronos only controls fixtures that have
   * an active FX clip painting them RIGHT NOW. All other fixtures are free.
   * 
   * Used by TitanOrchestrator to decide which fixtures to gate from
   * EffectManager/HephaestusRuntime (only the ones Chronos is touching).
   */
  getPlaybackAffectedFixtureIds(): Set<string> {
    if (!this.playbackActive) return new Set()
    return new Set(this.currentPlaybackFrame.keys())
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
   * 🎬 WAVE 2063: HYBRID MODE — When playback is active, Chronos controls color
   * and Titan controls movement. Both directors coexist. No more scorched earth.
   * 
   * @returns Final lighting target ready for HAL
   */
  arbitrate(): FinalLightingTarget {
    const now = performance.now()
    this.frameNumber++
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🎬 WAVE 2063: HYBRID MODE — Chronos + Titan coexistence
    // 
    // OLD (WAVE 2056): Direct Drive returned raw frames, killing Titan.
    // NEW: Chronos is a COLOR DIRECTOR, Titan is a MOVEMENT DIRECTOR.
    //
    // When playback active:
    //   1. Run NORMAL arbitration (Titan generates pan/tilt/zoom/speed)
    //   2. OVERLAY Chronos color data (dimmer, R, G, B, white, color_wheel)
    //   3. If vibe is active → Titan keeps movement. If not → Chronos movement wins.
    //
    // This fixes:
    //   - GRAY BUG: Frames now go through normal HAL → translateColorToWheel()
    //   - DEAD VIBE: Titan runs normally → FixturePhysicsDriver gets pan/tilt targets
    //
    // 🎬 WAVE 2065: THE TRANSPARENT OVERLAY
    //   Chronos frame is now SPARSE — only contains fixtures actively touched by FX.
    //   Untouched fixtures → pure Titan. Touched fixtures → HTP blend.
    //   The Vibe is the canvas, Chronos paints ON TOP of it.
    // ═══════════════════════════════════════════════════════════════════════
    if (this.playbackActive) {
      // STEP 1: Run normal arbitration for ALL fixtures (Titan/Selene lives!)
      this.cleanupExpiredEffects()
      
      const allFixtureIds = Array.from(this.fixtures.keys())
      const hybridTargets: FixtureLightingTarget[] = []
      
      for (const fixtureId of allFixtureIds) {
        // Get Titan's full arbitration (includes vibe color + movement)
        const titanTarget = this.arbitrateFixture(fixtureId, now)
        
        // Get Chronos' frame data (only present if an FX clip is touching this fixture)
        const chronosData = this.currentPlaybackFrame.get(fixtureId)
        
        if (chronosData) {
          // ═══════════════════════════════════════════════════════════════════
          // �️ WAVE 2066: THE SMART MIXBUS — Dynamic Blend Mode Arbitration
          //
          // The playback frame now carries a per-fixture blendMode.
          // Each effect declares its mixing intent:
          //
          //   'HTP' → Highest Takes Precedence (washes, color fills)
          //           Math.max(titanDim, chronosDim) — brighter wins
          //           The vibe canvas shines through if it's brighter.
          //
          //   'LTP' → Last Takes Precedence / Override (strobes, blackouts, meltdowns)
          //           chronosDim directly replaces titanDim — ABSOLUTE AUTHORITY
          //           A strobe at 0 WILL kill the vibe. A blackout IS a blackout.
          //
          //   'ADD' → Additive (ambient mists, accents, atmospheric)
          //           Math.min(255, titanDim + chronosDim) — both contribute
          //           Subtle effects ADD to the existing vibe canvas.
          //
          // COLOR: Same logic applies per blendMode.
          // MOVEMENT: Always from Titan (the vibe owns choreography).
          // ═══════════════════════════════════════════════════════════════════
          
          const chronosDim = clampDMX(chronosData.dimmer * this.grandMaster)
          const titanDim = titanTarget.dimmer
          
          // 🎛️ WAVE 2066: Read blendMode from the enriched frame
          const blendMode: string = (chronosData as any).blendMode ?? 'HTP'
          
          // ── DIMMER: Switch by blend mode ──
          let finalDimmer: number
          switch (blendMode) {
            case 'LTP':
              // ABSOLUTE OVERRIDE — Chronos dictates dimmer.
              // Strobes, blackouts, meltdowns: the zero IS the zero.
              finalDimmer = chronosDim
              break
            case 'ADD':
              // ADDITIVE — Both sources contribute, capped at 255
              finalDimmer = clampDMX(titanDim + chronosDim)
              break
            case 'HTP':
            default:
              // HIGHEST TAKES PRECEDENCE — The brighter one wins
              finalDimmer = Math.max(chronosDim, titanDim)
              break
          }
          
          // ── COLOR: Blend mode aware ──
          // 🔥 WAVE 2068: THE COLOR SHIELD — LTP color is ABSOLUTE and BINARY.
          // 🎭 WAVE 2070: THE TRANSPARENT DICTATOR — LTP respects color omission.
          //
          // When blendMode === 'LTP' (Override/Dictator effects):
          //   - IF colorTouched === true: Color channels are LAW. Absolute. Binary.
          //     Even RGB(0,0,0) is intentional (blackout IS blackout).
          //   - IF colorTouched === false: The effect CHOSE to be transparent on color.
          //     Titan's color passes through untouched. The Dictator only rules
          //     dimmer and movement in this case (e.g., DeepBreath on movers).
          //
          // This is the difference between:
          //   "I command BLACK" (colorTouched=true, RGB=0,0,0) → absolute black
          //   "I have nothing to say about color" (colorTouched=false) → Titan's color lives
          //
          // THE RULE: A Dictator only dictates what it explicitly declares.
          //           Silence is not suppression. Omission is not annihilation.
          const colorTouched = (chronosData as any).colorTouched !== false  // default true for backwards compat
          const chronosHasColor = chronosData.color.r > 0 || chronosData.color.g > 0 || chronosData.color.b > 0
          let finalColor: { r: number; g: number; b: number }
          
          if (blendMode === 'LTP' && colorTouched) {
            // LTP + color was explicitly touched: ABSOLUTE. Even black is intentional.
            // NO multiplication by dimmer. NO blending with Titan. ABSOLUTE.
            finalColor = {
              r: clampDMX(chronosData.color.r),
              g: clampDMX(chronosData.color.g),
              b: clampDMX(chronosData.color.b),
            }
          } else if (blendMode === 'LTP' && !colorTouched) {
            // 🎭 WAVE 2070: LTP but color NOT touched → Titan's color passes through
            // The Dictator is transparent on color. It only rules dimmer/movement.
            finalColor = titanTarget.color
          } else if (blendMode === 'ADD' && chronosHasColor) {
            // ADD: Additive color mixing (both contribute)
            finalColor = {
              r: clampDMX(titanTarget.color.r + chronosData.color.r),
              g: clampDMX(titanTarget.color.g + chronosData.color.g),
              b: clampDMX(titanTarget.color.b + chronosData.color.b),
            }
          } else if (chronosHasColor) {
            // HTP with real color: Chronos color wins
            finalColor = {
              r: clampDMX(chronosData.color.r),
              g: clampDMX(chronosData.color.g),
              b: clampDMX(chronosData.color.b),
            }
          } else {
            // No Chronos color → Titan's vibe color passes through
            finalColor = titanTarget.color
          }

          // 🔥 WAVE 2068 + 🎭 WAVE 2070: LTP color_wheel logic
          // If LTP AND color was touched → force open (0) to prevent gel contamination
          // If LTP AND color NOT touched → Titan keeps its color_wheel (transparent dictator)
          // HTP/ADD → standard fallback to Titan if not specified
          const finalColorWheel = (blendMode === 'LTP' && colorTouched)
            ? (chronosData.color_wheel ?? 0)   // LTP + color touched: force open if not specified
            : (chronosData.color_wheel ?? titanTarget.color_wheel)  // Transparent LTP / HTP / ADD: Titan fallback
          
          const hybridTarget: FixtureLightingTarget = {
            fixtureId,
            
            dimmer: finalDimmer,
            color: finalColor,
            
            // ── MOVEMENT: Titan always owns choreography ──
            pan: titanTarget.pan,
            tilt: titanTarget.tilt,
            zoom: titanTarget.zoom,
            speed: titanTarget.speed,
            focus: titanTarget.focus,
            
            // ── MECHANICAL CHANNELS: Wave 2068 color shield aware ──
            color_wheel: finalColorWheel,
            
            // 🔥 WAVE 2084: Phantom channels passthrough from Titan's arbitration
            phantomChannels: titanTarget.phantomChannels,
            
            // ── Metadata ──
            _controlSources: {
              ...titanTarget._controlSources,
              dimmer: ControlLayer.EFFECTS,
              red: ControlLayer.EFFECTS,
              green: ControlLayer.EFFECTS,
              blue: ControlLayer.EFFECTS,
            },
            _crossfadeActive: titanTarget._crossfadeActive,
            _crossfadeProgress: titanTarget._crossfadeProgress,
          }
          
          hybridTargets.push(hybridTarget)
          
          // 🔬 WAVE 2066: Smart MixBus telemetry (1 sample every 5s)
          if (this.frameNumber % 300 === 1 && hybridTargets.length === 1) {
            console.log(
              `[MasterArbiter �️ MIXBUS] f=${fixtureId} mode=${blendMode} | ` +
              `chronos: dim=${chronosDim} RGB(${chronosData.color.r.toFixed(0)},${chronosData.color.g.toFixed(0)},${chronosData.color.b.toFixed(0)}) | ` +
              `titan: dim=${titanDim} RGB(${titanTarget.color.r},${titanTarget.color.g},${titanTarget.color.b}) | ` +
              `FINAL: dim=${finalDimmer} color=${chronosHasColor ? (blendMode === 'ADD' ? 'additive' : 'chronos') : 'titan'} | ` +
              `overlay=${this.currentPlaybackFrame.size}/${allFixtureIds.length} fixtures`
            )
          }
          
          // Cache position for Ghost Protocol
          this.lastKnownPositions.set(fixtureId, { pan: hybridTarget.pan, tilt: hybridTarget.tilt })
        } else {
          // 🎬 WAVE 2065: Fixture NOT in Chronos frame → 100% Titan/Selene
          // The vibe paints this fixture with its full reactive color + movement.
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
          activeEffects: [],  // Chronos is not a layer effect, it's a playback overlay
        }
      }
      
      this.lastOutputTimestamp = now
      this.emit('output', output)
      return output
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // NORMAL LAYER ARBITRATION (when playback is NOT active)
    // ═══════════════════════════════════════════════════════════════════════
    
    // Clean up expired effects
    this.cleanupExpiredEffects()
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🚦 WAVE 1132: OUTPUT GATE STATUS LOGGING (Throttled)
    // Log every ~5 seconds when in ARMED state so user knows DMX is blocked
    // ═══════════════════════════════════════════════════════════════════════
    if (!this._outputEnabled && this.frameNumber % 150 === 0) {
      const last = this._lastOutputGateChange
      console.log(
        `[MasterArbiter] 🚦 ARMED STATE: Output DISABLED | ${this.fixtures.size} fixtures forced to BLACKOUT | Press GO to enable DMX`,
        {
          outputEnabled: this._outputEnabled,
          lastGateChange: last
            ? {
                prev: last.enabled,
                label: last.label ?? 'unknown',
                atMs: last.atMs,
              }
            : null,
        }
      )
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

    // 🔎 TRACE DISABLED: Manual override detection (too spammy). Re-enable if investigating merged channel issues.
    // if (manualOverride) {
    //   const nowMs = Date.now()
    //   if (nowMs - this._traceLastArbiterLogAtMs > 750) {
    //     this._traceLastArbiterLogAtMs = nowMs
    //     console.log('[TRACE ARBITER] manualOverride active', {...})
    //   }
    // }
    
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
    const { pan: rawPan, tilt: rawTilt } = this.getAdjustedPosition(fixtureId, titanValues, manualOverride, now)
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🏎️ WAVE 2074.3: POSITION RELEASE FADE — POST-PROCESS
    //
    // Si hay un fade activo para este fixture, interpolamos entre la última
    // posición manual (fromPan/fromTilt) y la posición Titan (rawPan/rawTilt).
    //
    // Esto es un POST-PROCESS: getAdjustedPosition ya devolvió el valor
    // correcto de Titan. Nosotros solo lo suavizamos temporalmente.
    // NO contaminamos Titan values. NO creamos zombies.
    // Después de durationMs, el fade se auto-purga.
    // ═══════════════════════════════════════════════════════════════════════
    let pan = rawPan
    let tilt = rawTilt
    
    const releaseFade = this.positionReleaseFades.get(fixtureId)
    if (releaseFade) {
      const elapsed = now - releaseFade.startTime
      if (elapsed >= releaseFade.durationMs) {
        // Fade completado — purgar
        this.positionReleaseFades.delete(fixtureId)
      } else {
        // Interpolación lineal: from → to (rawPan/rawTilt = posición Titan actual)
        const t = elapsed / releaseFade.durationMs
        // Curva ease-out: t² × (3 - 2t) — suave al final, no al principio
        const smoothT = t * t * (3 - 2 * t)
        pan = releaseFade.fromPan + (rawPan - releaseFade.fromPan) * smoothT
        tilt = releaseFade.fromTilt + (rawTilt - releaseFade.fromTilt) * smoothT
      }
    }
    
    const zoom = this.mergeChannelForFixture(fixtureId, 'zoom', titanValues, manualOverride, now, controlSources)
    const focus = this.mergeChannelForFixture(fixtureId, 'focus', titanValues, manualOverride, now, controlSources)
    // 🔥 WAVE 1008.4: Merge speed channel for Pan/Tilt movement velocity
    const speed = this.mergeChannelForFixture(fixtureId, 'speed', titanValues, manualOverride, now, controlSources)
    // 🎨 WAVE 1008.6: Merge color_wheel channel (THE WHEELSMITH)
    const color_wheel = this.mergeChannelForFixture(fixtureId, 'color_wheel', titanValues, manualOverride, now, controlSources)

    // 🔎 TRACE DISABLED: Final merged channels (too spammy). Re-enable if investigating merge strategy.
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🔥 WAVE 2084: PHANTOM PANEL — Canales Dinámicos para Ingenios
    //
    // Los canales que NO son nativos del Arbiter (rotation, custom, macro,
    // frost, gobo, gobo_rotation, prism, prism_rotation, shutter, control,
    // cyan, magenta, yellow, etc.) se resuelven así:
    //
    //   1. Si hay Manual Override con phantomChannels → usar ese valor (LTP)
    //   2. Si no → usar el defaultValue del canal en la definición del fixture
    //
    // Titan/Selene NO generan valores para estos canales.
    // El Arbiter actúa como PASSTHROUGH transparente.
    // Solo el operador humano (Layer 2) puede modificar estos valores.
    // ═══════════════════════════════════════════════════════════════════════
    const phantomChannels: Record<string, number> = {}
    const NATIVE_CHANNELS = new Set([
      'dimmer', 'red', 'green', 'blue', 'pan', 'tilt',
      'zoom', 'focus', 'speed', 'color_wheel',
    ])
    
    // Obtener canales del fixture registrado
    const fixtureData = this.fixtures.get(fixtureId)
    if (fixtureData && (fixtureData as any).channelDefinitions) {
      const channelDefs: Array<{ type: string; defaultValue: number }> = (fixtureData as any).channelDefinitions
      for (const ch of channelDefs) {
        if (!NATIVE_CHANNELS.has(ch.type)) {
          // Check manual override first
          const manualPhantomValue = manualOverride?.controls?.phantomChannels?.[ch.type]
          if (manualPhantomValue !== undefined) {
            phantomChannels[ch.type] = clampDMX(manualPhantomValue)
            controlSources[ch.type as ChannelType] = ControlLayer.MANUAL
          } else {
            phantomChannels[ch.type] = ch.defaultValue ?? 0
            controlSources[ch.type as ChannelType] = ControlLayer.TITAN_AI
          }
        }
      }
    }
    
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
      phantomChannels,  // 🔥 WAVE 2084: Phantom Panel passthrough
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
   * 🔧 WAVE 2070.3: Added diagnostic logging every 60 frames
   */
  private calculatePatternOffset(pattern: PatternConfig, now: number): { panOffset: number; tiltOffset: number } {
    const elapsedMs = now - pattern.startTime
    const cycleDurationMs = (1000 / Math.max(0.01, pattern.speed))  // speed = cycles per second, prevent div by 0
    const phase = (elapsedMs % cycleDurationMs) / cycleDurationMs
    const t = phase * 2 * Math.PI  // 0 to 2π
    
    // 🔧 WAVE 2070.3: Diagnostic — log every 60 frames to see actual values
    if (this.frameNumber % 60 === 0) {
      console.log(`[Pattern] 🔄 type=${pattern.type} speed=${pattern.speed.toFixed(3)}Hz size=${pattern.size.toFixed(3)} elapsed=${(elapsedMs/1000).toFixed(1)}s cycle=${(cycleDurationMs/1000).toFixed(2)}s phase=${phase.toFixed(3)} t=${t.toFixed(3)}`)
    }
    
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

      case 'tornado':
        // 🌪️ Tornado: Spiral that grows and shrinks — mesmerizing vortex
        panOffset = Math.cos(t) * Math.sin(t * 0.25)
        tiltOffset = Math.sin(t) * Math.sin(t * 0.25)
        break

      case 'gravity_bounce':
        // 🏓 Gravity Bounce: Realistic bouncing ball with lateral sweep
        panOffset = Math.sin(t)
        tiltOffset = Math.abs(Math.cos(t * 1.5)) * -1
        break

      case 'butterfly':
        // 🦋 Butterfly: Lissajous figure — celtic knot / infinity flower
        panOffset = Math.sin(t * 3)
        tiltOffset = Math.sin(t * 2)
        break

      case 'heartbeat':
        // ⚡ Heartbeat: Violent techno pulse — sharp tilt spikes
        panOffset = 0
        tiltOffset = Math.pow(Math.sin(t * 2), 8) * Math.sign(Math.sin(t * 2))
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
      
      // 🔧 WAVE 2070.3b: THE HIGHLANDER — Use LIVE base position as center,
      // not the static pattern.center captured at creation time.
      // This way: if the user moves the XY pad while a pattern is running,
      // the pattern orbits around the NEW position, not the old frozen one.
      // basePan = manualOverride.controls.pan (if user moved pad) ?? titanValues.pan
      const liveCenterPan = basePan
      const liveCenterTilt = baseTilt
      
      const adjustedPan = liveCenterPan + panMovement
      const adjustedTilt = liveCenterTilt + tiltMovement
      
      // 🔧 WAVE 2070.3: Diagnostic — show final position vs center
      if (this.frameNumber % 60 === 0) {
        console.log(`[Position] 📍 ${fixtureId.substring(0,8)} liveCenter=P${liveCenterPan.toFixed(0)}/T${liveCenterTilt.toFixed(0)} → adjusted=P${adjustedPan.toFixed(1)}/T${adjustedTilt.toFixed(1)} (move=±${panMovement.toFixed(1)}/${tiltMovement.toFixed(1)}) hasOverride=${!!manualOverride}`)
      }
      
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
    const fixture = this.fixtures.get(fixtureId)
    
    // 🏎️ WAVE 2062: EL FRENO DE MANO DE HARDWARE
    // Buscamos el canal de velocidad en tu JSON para no enviar 0 (violencia máxima)
    // channels es Array<{ index, name, type, is16bit, defaultValue }>
    const speedChannel = (fixture?.channels as any)?.find((c: any) => c.type === 'speed')
    const defaultSpeed = speedChannel?.defaultValue ?? 0

    // 🔥 WAVE 1135.3: Leer defaultValue real de pan/tilt desde el JSON del fixture
    // El Forge permite configurar el centro mecánico del equipo — aquí lo honramos
    const panChannel = (fixture?.channels as any)?.find((c: any) => c.type === 'pan')
    const tiltChannel = (fixture?.channels as any)?.find((c: any) => c.type === 'tilt')
    const defaultPan = panChannel?.defaultValue ?? 128
    const defaultTilt = tiltChannel?.defaultValue ?? 128

    const defaults: Record<ChannelType, number> = {
      dimmer: 0,
      red: 0,
      green: 0,
      blue: 0,
      white: 0,
      pan: defaultPan,
      tilt: defaultTilt,
      zoom: 128,
      focus: 128,
      gobo: 0,
      prism: 0,
      speed: defaultSpeed, // 🚀 MAGIA: Usamos el 127 de tu molde en vez de forzar 0
      strobe: 0,
      color_wheel: 0,
      amber: 0,
      uv: 0,
      // 🔥 WAVE 2084: Canales expandidos (todos los que el ChannelType del Arbiter ahora soporta)
      shutter: 255,     // Open by default
      cyan: 0,
      magenta: 0,
      yellow: 0,
      pan_fine: 0,
      tilt_fine: 0,
      gobo_rotation: 0,
      prism_rotation: 0,
      frost: 0,
      macro: 0,
      control: 0,
      rotation: 0,
      custom: 0,
      unknown: 0,
    }
    
    if (!this.layer0_titan?.intent) return defaults
    
    const intent = this.layer0_titan.intent
    
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

    // 🔥 WAVE 1135.3: Dead Zone interpolation
    // dimmerMin = valor DMX mínimo donde el hardware realmente enciende.
    // Escala: 0 → 0 (blackout estricto), >0 → mapea [0,1] al rango [dMin, 255]
    const dMin = (fixture?.capabilities as any)?.dimmerMin ?? 0
    defaults.dimmer = zoneIntensity > 0
      ? Math.round(dMin + (zoneIntensity * (255 - dMin)))
      : 0
    
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
          // 🔥 WAVE 1135.3: Aplicamos Dead Zone también a intensidad de mechanics
          if (mechanic.intensity !== undefined) {
            const dMinMech = (fixture?.capabilities as any)?.dimmerMin ?? 0
            defaults.dimmer = mechanic.intensity > 0
              ? Math.round(dMinMech + (mechanic.intensity * (255 - dMinMech)))
              : 0
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
    
    // ═══════════════════════════════════════════════════════════════════════
    // 👻 WAVE 2070.2: GHOST HANDOFF — DISABLED (WAVE 2070.3 EXORCISM)
    // ═══════════════════════════════════════════════════════════════════════
    // The interpolation was contaminating the Titan → getAdjustedPosition pipeline.
    // When operator releases manual control, we now do a HARD CUT back to Titan.
    // The smooth crossfade was causing the fixture to appear "stuck" because:
    //   1. Origin values overwrote Titan values fed to getAdjustedPosition
    //   2. Patterns used contaminated base positions
    //   3. UNLOCK couldn't complete because interpolation held position
    //
    // TODO: Re-enable with proper architecture that doesn't touch Titan values
    //       but instead operates AFTER getAdjustedPosition as a post-process.
    // ═══════════════════════════════════════════════════════════════════════
    // const GHOST_TRANSITION_MS = 2000
    // const origin = this.fixtureOrigins.get(fixtureId)
    // if (origin) { ... }
    
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
      phantomChannels: {},  // 🔥 WAVE 2084: Empty in blackout — all phantoms go to default
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
      phantomChannels: {},          // 🔥 WAVE 2084: Empty in output gate — safe state
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
