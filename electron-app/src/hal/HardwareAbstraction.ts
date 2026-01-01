/**
 * 🏛️ WAVE 215: HARDWARE ABSTRACTION FACADE
 * 
 * The "Grand Connector" - The single entry point to all hardware.
 * 
 * COMPOSITION:
 * - PhysicsEngine: Decay, inertia, hysteresis
 * - ZoneRouter: Zone-to-fixture mapping
 * - FixtureMapper: Intent-to-DMX conversion
 * - Driver: USB/ArtNet/Mock output
 * 
 * MASTER METHOD: render(intent, fixtures)
 * Orchestrates the complete pipeline:
 * 1. Router → Determine which fixtures respond
 * 2. Physics → Apply decay/inertia
 * 3. Mapper → Convert to fixture states
 * 4. Driver → Send DMX
 * 
 * @layer HAL
 * @version TITAN 2.0
 */

import {
  type LightingIntent,
  type DMXPacket,
  hslToRgb,
  createEmptyUniverse,
} from '../core/protocol'

import { PhysicsEngine } from './physics/PhysicsEngine'
import { ZoneRouter, type PhysicalZone, type VibeRouteConfig, type ZoneIntensityInput } from './mapping/ZoneRouter'
import { FixtureMapper, type PatchedFixture, type FixtureState, type MovementState } from './mapping/FixtureMapper'
import { type IDMXDriver, type DriverType, MockDMXDriver } from './drivers'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Audio metrics required for physics calculations */
export interface AudioMetrics {
  rawBass: number
  rawMid: number
  rawTreble: number
  energy: number
  isRealSilence: boolean
  isAGCTrap: boolean
}

/** HAL configuration */
export interface HALConfig {
  driverType: DriverType
  installationType: 'floor' | 'ceiling'
  debug: boolean
}

/** HAL status for monitoring */
export interface HALStatus {
  isConnected: boolean
  driverType: DriverType
  framesRendered: number
  fixturesActive: number
  avgRenderTime: number
  lastRenderTime: number
}

// ═══════════════════════════════════════════════════════════════════════════
// HARDWARE ABSTRACTION CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class HardwareAbstraction {
  // Composed modules
  private physics: PhysicsEngine
  private router: ZoneRouter
  private mapper: FixtureMapper
  private driver: IDMXDriver
  
  // Configuration
  private config: HALConfig
  
  // State
  private framesRendered = 0
  private lastRenderTime = 0
  private renderTimes: number[] = []
  private universeBuffers = new Map<number, Uint8Array>()
  private lastFixtureStates: FixtureState[] = []
  private lastDebugTime = 0  // WAVE 256.7: For throttled debug logging
  
  // Current vibe preset (for physics)
  // 🔥 WAVE 279.5: HEART vs SLAP - Filosofía de zonas
  // FRONT PARS (Bass/Heart): bom bom bom - presión en el pecho, no agresivo
  // BACK PARS (Mid/Snare): PAF! - bofetada en la cara, explosivo
  private currentPreset: VibeRouteConfig = {
    parGate: 0.08,           // Heart: responde a bass ligero
    parGain: 3.5,            // Heart: amplificación moderada
    parMax: 0.95,            // Heart: techo limitado (presión, no golpe)
    backParGate: 0.15,       // Slap: ignora ruido de fondo
    backParGain: 2.8,        // Slap: ganancia para rango dinámico
    backParMax: 1.0,         // Slap: ¡BOFETADA COMPLETA! PAF!
    melodyThreshold: 0.10,   // Movers: activan fácil con melodía
    decaySpeed: 2,
    moverDecaySpeed: 3,
  }
  
  constructor(config: Partial<HALConfig> = {}) {
    this.config = {
      driverType: config.driverType ?? 'mock',
      installationType: config.installationType ?? 'floor',
      debug: config.debug ?? true,
    }
    
    // Instantiate composed modules
    this.physics = new PhysicsEngine()
    this.router = new ZoneRouter()
    this.mapper = new FixtureMapper()
    
    // Create driver based on config
    this.driver = this.createDriver(this.config.driverType)
    
    // Configure mapper
    this.mapper.setInstallationType(this.config.installationType)
    
    // Initialize universe 1 (extract Uint8Array from DMXUniverse)
    this.universeBuffers.set(1, createEmptyUniverse(1).channels)
    
    console.log('[HAL] 🏛️ HardwareAbstraction initialized (WAVE 215)')
    console.log(`[HAL]    Driver: ${this.config.driverType}`)
    console.log(`[HAL]    Installation: ${this.config.installationType}`)
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // MAIN RENDER PIPELINE
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * 🎯 MASTER METHOD: Render a LightingIntent to hardware.
   * 
   * This orchestrates the complete HAL pipeline:
   * 1. Calculate zone intensities using router + audio
   * 2. Apply physics (decay/inertia) to smooth values
   * 3. Map to fixture states (colors, movement)
   * 4. Apply effects and overrides
   * 5. Send to DMX driver
   * 
   * @param intent - Abstract lighting intent from Engine
   * @param fixtures - Patched fixture configuration
   * @param audio - Current audio metrics for physics
   * @returns Array of final fixture states (for UI broadcast)
   */
  public render(
    intent: LightingIntent,
    fixtures: PatchedFixture[],
    audio: AudioMetrics
  ): FixtureState[] {
    const startTime = performance.now()
    
    // Build audio input for router
    const audioInput = this.buildAudioInput(audio)
    
    // Process each fixture through the pipeline
    const fixtureStates = fixtures.map(fixture => {
      const zone = (fixture.zone || 'UNASSIGNED') as PhysicalZone
      
      // 1. ROUTER: Calculate raw intensity for this zone
      const rawIntensity = this.calculateZoneIntensity(zone, audioInput)
      
      // 2. PHYSICS: Apply decay/inertia
      const physicsKey = `${fixture.dmxAddress}-${zone}`
      const zoneConfig = this.router.getZoneConfig(zone)
      const physicsType = zoneConfig?.physics.type || 'PAR'
      const decaySpeed = physicsType === 'MOVER' 
        ? this.router.getEffectiveMoverDecay(this.currentPreset)
        : this.currentPreset.decaySpeed
      
      const finalIntensity = this.physics.applyDecayWithPhysics(
        physicsKey,
        rawIntensity,
        decaySpeed,
        physicsType
      )
      
      // 3. MAPPER: Convert to fixture state
      // MovementIntent uses centerX/centerY (0-1), we map to pan/tilt
      const movement: MovementState = {
        pan: intent.movement?.centerX ?? 0.5,
        tilt: intent.movement?.centerY ?? 0.5,
      }
      
      return this.mapper.mapFixture(fixture, intent, finalIntensity, movement)
    })
    
    // 4. EFFECTS: Apply global effects and manual overrides
    const finalStates = this.mapper.applyEffectsAndOverrides(fixtureStates, Date.now())
    
    // 5. DRIVER: Send to hardware
    this.sendToDriver(finalStates)
    
    // Update stats
    this.framesRendered++
    this.lastRenderTime = performance.now() - startTime
    this.renderTimes.push(this.lastRenderTime)
    if (this.renderTimes.length > 100) this.renderTimes.shift()
    
    // Store for UI broadcast
    this.lastFixtureStates = finalStates
    
    // Debug logging (1% sample rate)
    if (this.config.debug && Math.random() < 0.01) {
      const activeCount = finalStates.filter(f => f.dimmer > 0).length
      console.log(
        `[HAL] 🔧 Render #${this.framesRendered} | ` +
        `Active: ${activeCount}/${finalStates.length} | ` +
        `Time: ${this.lastRenderTime.toFixed(2)}ms`
      )
    }
    
    return finalStates
  }
  
  /**
   * Simplified render for STUB/demo mode (uses intent directly).
   */
  public renderSimple(intent: LightingIntent): void {
    this.framesRendered++
    
    const primaryRGB = hslToRgb(intent.palette.primary)
    const intensity = (intent.masterIntensity * 100).toFixed(0)
    const zoneCount = Object.keys(intent.zones).length
    
    console.log(
      `[HAL] 🔧 Render #${this.framesRendered} | ` +
      `Intensity: ${intensity}% | ` +
      `RGB(${primaryRGB.r},${primaryRGB.g},${primaryRGB.b}) | ` +
      `Zones: ${zoneCount}`
    )
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // ZONE INTENSITY CALCULATION
  // ═══════════════════════════════════════════════════════════════════════
  
  private calculateZoneIntensity(zone: PhysicalZone, audio: ZoneIntensityInput): number {
    switch (zone) {
      case 'FRONT_PARS':
        return this.router.calculateFrontParIntensity(audio, this.currentPreset)
      
      case 'BACK_PARS':
        return this.router.calculateBackParIntensity(audio, this.currentPreset)
      
      case 'MOVING_LEFT':
      case 'MOVING_RIGHT': {
        // Use mover calculation from physics engine
        const hystKey = `${zone}-hyst`
        const wasOn = this.physics.getMoverHysteresisState(hystKey)
        
        const result = this.physics.calculateMoverTarget({
          moverKey: hystKey,  // 🔧 WAVE 280: Unique key for state buffer
          presetName: 'Default',  // Would come from VibeManager
          melodyThreshold: this.currentPreset.melodyThreshold,
          rawMid: audio.rawMid,
          rawBass: audio.rawBass,
          rawTreble: audio.rawTreble,
          moverState: wasOn,
          isRealSilence: audio.isRealSilence,
          isAGCTrap: audio.isAGCTrap,
        })
        
        // WAVE 256.7: Debug log for movers - every 2 seconds
        if (Date.now() - this.lastDebugTime > 2000 && zone === 'MOVING_LEFT') {
          console.log(`[HAL MOVER] ${zone}: mid=${audio.rawMid.toFixed(2)}, treble=${audio.rawTreble.toFixed(2)}, bass=${audio.rawBass.toFixed(2)} → intensity=${result.intensity.toFixed(2)}, state=${result.newState}`)
          this.lastDebugTime = Date.now()
        }
        
        this.physics.setMoverHysteresisState(hystKey, result.newState)
        return result.intensity
      }
      
      case 'STROBES':
        // Strobes only on beat with high bass
        return (audio.bassPulse > 0.8) ? 1.0 : 0
      
      default:
        return audio.melodySignal * 0.5
    }
  }
  
  private buildAudioInput(audio: AudioMetrics): ZoneIntensityInput {
    // WAVE 256.5: Calculate derived values with REDUCED thresholds for better reactivity
    // Previous bassFloor=0.5 was killing most audio signal
    const bassFloor = 0.15  // Was 0.5 - now much more sensitive
    const bassPulse = Math.max(0, audio.rawBass - bassFloor)  // Was bassFloor * 0.6
    const treblePulse = Math.max(0, audio.rawTreble - 0.05)   // Was 0.15
    const melodySignal = Math.max(audio.rawMid * 1.2, audio.rawTreble)  // Boosted mid
    const isMelodyDominant = audio.rawMid + audio.rawTreble > audio.rawBass * 1.5
    
    return {
      rawBass: audio.rawBass,
      rawMid: audio.rawMid,
      rawTreble: audio.rawTreble,
      bassPulse,
      treblePulse,
      melodySignal,
      isRealSilence: audio.isRealSilence,
      isAGCTrap: audio.isAGCTrap,
      isMelodyDominant,
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // DRIVER MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════
  
  private createDriver(type: DriverType): IDMXDriver {
    switch (type) {
      case 'mock':
        // WAVE 252: Silent mock driver
        return new MockDMXDriver({ debug: false })
      
      case 'usb':
        // For now, fall back to silent mock
        // Real USB driver would be: return new USBDMXDriverAdapter()
        return new MockDMXDriver({ debug: false })
      
      case 'artnet':
        // For now, fall back to silent mock
        return new MockDMXDriver({ debug: false })
      
      default:
        // WAVE 252: Default to silent mock (no spam)
        return new MockDMXDriver({ debug: false })
    }
  }
  
  private sendToDriver(states: FixtureState[]): void {
    if (!this.driver.isConnected) {
      // Try to connect
      this.driver.connect().catch(err => {
        if (this.config.debug) {
          console.error('[HAL] ❌ Driver connection failed:', err)
        }
      })
      return
    }
    
    // Convert states to DMX packets and send
    const packets = this.mapper.statesToDMXPackets(states)
    
    for (const packet of packets) {
      this.driver.send(packet)
    }
  }
  
  /**
   * Connect to DMX hardware.
   */
  public async connect(): Promise<boolean> {
    console.log(`[HAL] 🔌 Connecting to ${this.config.driverType} driver...`)
    return await this.driver.connect()
  }
  
  /**
   * Disconnect from hardware.
   */
  public async disconnect(): Promise<void> {
    console.log('[HAL] 🔌 Disconnecting...')
    await this.driver.close()
  }
  
  /**
   * Switch to a different driver type.
   */
  public async switchDriver(type: DriverType): Promise<boolean> {
    console.log(`[HAL] 🔄 Switching driver to: ${type}`)
    
    // Close existing driver
    await this.driver.close()
    
    // Create new driver
    this.driver = this.createDriver(type)
    this.config.driverType = type
    
    // Connect new driver
    return await this.driver.connect()
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // STATE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Update vibe preset for physics calculations.
   */
  public setVibePreset(preset: VibeRouteConfig): void {
    this.currentPreset = preset
  }
  
  /**
   * Set blackout mode.
   */
  public setBlackout(active: boolean): void {
    this.mapper.setBlackout(active)
    if (active) {
      this.driver.blackout()
    }
  }
  
  /**
   * Set manual override for a fixture.
   */
  public setManualOverride(fixtureId: string, override: Record<string, number>): void {
    this.mapper.setManualOverride(fixtureId, override)
  }
  
  /**
   * Clear all manual overrides.
   */
  public clearOverrides(): void {
    this.mapper.clearAllOverrides()
  }
  
  /**
   * Set effect active state.
   */
  public setEffect(effect: 'strobe' | 'blinder' | 'police' | 'rainbow', active: boolean): void {
    this.mapper.setEffect(effect, active)
  }
  
  /**
   * Reset all physics state (for mode changes).
   */
  public resetPhysics(): void {
    this.physics.reset()
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // STATUS & MONITORING
  // ═══════════════════════════════════════════════════════════════════════
  
  public getStatus(): HALStatus {
    const avgRenderTime = this.renderTimes.length > 0
      ? this.renderTimes.reduce((a, b) => a + b, 0) / this.renderTimes.length
      : 0
    
    return {
      isConnected: this.driver.isConnected,
      driverType: this.config.driverType,
      framesRendered: this.framesRendered,
      fixturesActive: this.lastFixtureStates.filter(f => f.dimmer > 0).length,
      avgRenderTime,
      lastRenderTime: this.lastRenderTime,
    }
  }
  
  public getLastFixtureStates(): FixtureState[] {
    return this.lastFixtureStates
  }
  
  get isConnected(): boolean {
    return this.driver.isConnected
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════════════════════
  
  public async destroy(): Promise<void> {
    console.log('[HAL] 🛑 Destroying HardwareAbstraction...')
    
    this.physics.destroy()
    this.router.destroy()
    this.mapper.destroy()
    await this.driver.close()
    
    this.universeBuffers.clear()
    this.lastFixtureStates = []
    
    console.log('[HAL] ✅ Destroyed')
  }
}

// Export singleton for easy use
export const hardwareAbstraction = new HardwareAbstraction()
