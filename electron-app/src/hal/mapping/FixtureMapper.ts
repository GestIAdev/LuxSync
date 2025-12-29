/**
 * 🏛️ WAVE 210: FIXTURE MAPPER
 * 
 * Extracted from main.ts fixtureStates.map() logic
 * 
 * RESPONSIBILITIES:
 * - Convert LightingIntent to per-fixture state
 * - Apply color roles (primary/secondary/accent/ambient)
 * - Calculate DMX channel values
 * - Handle pan/tilt for movers
 * - Support effects override (strobe, blinder, police, rainbow)
 * 
 * DOES NOT:
 * - Calculate intensity (that's ZoneRouter + PhysicsEngine)
 * - Know about audio analysis (that's Brain's job)
 * - Send DMX (that's the Driver's job)
 */

import type { LightingIntent, HSLColor, DMXPacket } from '../../core/protocol'
import { hslToRgb } from '../../core/protocol/LightingIntent'
import type { PhysicalZone } from './ZoneRouter'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Fixture definition (from patch) */
export interface PatchedFixture {
  dmxAddress: number
  universe: number
  name: string
  zone?: string
  type?: string
  channelCount?: number
}

/** Calculated fixture state (output of mapper) */
export interface FixtureState {
  dmxAddress: number
  universe: number
  name: string
  zone: string
  type: string
  dimmer: number    // 0-255
  r: number         // 0-255
  g: number         // 0-255
  b: number         // 0-255
  pan: number       // 0-255
  tilt: number      // 0-255
}

/** Color palette in RGB format */
export interface RGBPalette {
  primary: { r: number; g: number; b: number }
  secondary: { r: number; g: number; b: number }
  accent: { r: number; g: number; b: number }
  ambient: { r: number; g: number; b: number }
}

/** Movement state for movers */
export interface MovementState {
  pan: number       // 0-1 normalized
  tilt: number      // 0-1 normalized
}

/** Manual override for a fixture */
export interface ManualOverride {
  pan?: number
  tilt?: number
  dimmer?: number
  speed?: number
  r?: number
  g?: number
  b?: number
  patternEnabled?: boolean
  movementPattern?: string
  patternSpeed?: number
  patternAmplitude?: number
  patternPhase?: number
}

/** Active effect identifiers */
export type EffectId = 'strobe' | 'blinder' | 'police' | 'rainbow'

// ═══════════════════════════════════════════════════════════════════════════
// FIXTURE MAPPER CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class FixtureMapper {
  // Installation type affects tilt inversion
  private installationType: 'floor' | 'ceiling' = 'floor'
  
  // Manual overrides storage
  private manualOverrides = new Map<string, ManualOverride>()
  
  // Active effects
  private activeEffects = new Set<EffectId>()
  
  // Blackout state
  private blackoutActive = false
  
  constructor() {
    console.log('[FixtureMapper] 🎛️ Initialized (WAVE 210)')
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Map a LightingIntent to a single fixture's state.
   */
  public mapFixture(
    fixture: PatchedFixture,
    intent: LightingIntent,
    intensity: number,
    movement: MovementState
  ): FixtureState {
    const zone = (fixture.zone || 'UNASSIGNED') as PhysicalZone
    
    // Convert intent palette to RGB
    const palette = this.intentPaletteToRGB(intent)
    
    // Determine which color role this zone uses
    const colorRole = this.getColorRoleForZone(zone)
    const fixtureColor = palette[colorRole]
    
    // Calculate pan/tilt with installation type correction
    let panValue = movement.pan
    let tiltValue = movement.tilt
    
    const isMovingFixture = this.isMovingZone(zone) || 
                            fixture.type?.toLowerCase().includes('moving')
    
    // Mirror effect for MOVING_RIGHT
    if (zone === 'MOVING_RIGHT') {
      panValue = 1 - panValue
    }
    
    // Ceiling tilt inversion (WAVE 24.6)
    if (this.installationType === 'ceiling' && isMovingFixture) {
      tiltValue = 1 - tiltValue
    }
    
    return {
      dmxAddress: fixture.dmxAddress,
      universe: fixture.universe,
      name: fixture.name,
      zone: zone,
      type: fixture.type || 'unknown',
      dimmer: Math.round(intensity * 255),
      r: fixtureColor.r,
      g: fixtureColor.g,
      b: fixtureColor.b,
      pan: isMovingFixture ? Math.round(panValue * 255) : 0,
      tilt: isMovingFixture ? Math.round(tiltValue * 255) : 0,
    }
  }
  
  /**
   * Apply effects and overrides to fixture states.
   * This is called AFTER mapFixture to modify the final output.
   */
  public applyEffectsAndOverrides(
    states: FixtureState[],
    timestamp: number
  ): FixtureState[] {
    return states.map(state => {
      let finalState = { ...state }
      
      // Apply manual override if exists
      const fixtureId = `fixture-${state.dmxAddress}`
      const override = this.manualOverrides.get(fixtureId) || 
                       this.manualOverrides.get(state.name)
      
      if (override) {
        finalState = this.applyOverride(finalState, override, timestamp)
      }
      
      // Apply active effects
      finalState = this.applyActiveEffects(finalState, timestamp)
      
      // Apply blackout (overrides everything)
      if (this.blackoutActive) {
        finalState.dimmer = 0
        finalState.r = 0
        finalState.g = 0
        finalState.b = 0
      }
      
      return finalState
    })
  }
  
  /**
   * Convert fixture states to DMX packets.
   */
  public statesToDMXPackets(states: FixtureState[]): DMXPacket[] {
    return states.map(state => ({
      universe: state.universe,
      address: state.dmxAddress,
      channels: [
        state.dimmer,
        state.r,
        state.g,
        state.b,
        state.pan,
        state.tilt,
      ],
      fixtureId: `fixture-${state.dmxAddress}`
    }))
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // STATE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════
  
  public setInstallationType(type: 'floor' | 'ceiling'): void {
    this.installationType = type
  }
  
  public setManualOverride(fixtureId: string, override: ManualOverride): void {
    this.manualOverrides.set(fixtureId, override)
  }
  
  public clearManualOverride(fixtureId: string): void {
    this.manualOverrides.delete(fixtureId)
  }
  
  public clearAllOverrides(): void {
    this.manualOverrides.clear()
  }
  
  public setEffect(effect: EffectId, active: boolean): void {
    if (active) {
      this.activeEffects.add(effect)
    } else {
      this.activeEffects.delete(effect)
    }
  }
  
  public setBlackout(active: boolean): void {
    this.blackoutActive = active
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // PRIVATE METHODS
  // ═══════════════════════════════════════════════════════════════════════
  
  private intentPaletteToRGB(intent: LightingIntent): RGBPalette {
    return {
      primary: hslToRgb(intent.palette.primary),
      secondary: hslToRgb(intent.palette.secondary),
      accent: hslToRgb(intent.palette.accent),
      ambient: hslToRgb(intent.palette.ambient),
    }
  }
  
  private getColorRoleForZone(zone: PhysicalZone): keyof RGBPalette {
    const roleMap: Record<PhysicalZone, keyof RGBPalette> = {
      'FRONT_PARS': 'primary',
      'BACK_PARS': 'accent',
      'MOVING_LEFT': 'secondary',
      'MOVING_RIGHT': 'ambient',
      'STROBES': 'accent',
      'AMBIENT': 'ambient',
      'FLOOR': 'primary',
      'UNASSIGNED': 'primary',
    }
    return roleMap[zone] || 'primary'
  }
  
  private isMovingZone(zone: string): boolean {
    return zone.includes('MOVING') || 
           zone.toLowerCase().includes('left') || 
           zone.toLowerCase().includes('right')
  }
  
  private applyOverride(
    state: FixtureState,
    override: ManualOverride,
    timestamp: number
  ): FixtureState {
    const result = { ...state }
    
    if (override.pan !== undefined) result.pan = override.pan
    if (override.tilt !== undefined) result.tilt = override.tilt
    if (override.dimmer !== undefined) result.dimmer = override.dimmer
    if (override.r !== undefined) result.r = override.r
    if (override.g !== undefined) result.g = override.g
    if (override.b !== undefined) result.b = override.b
    
    // Pattern movement
    if (override.patternEnabled && override.movementPattern && 
        override.movementPattern !== 'static') {
      const patternResult = this.calculatePatternMovement(
        override,
        result.pan,
        result.tilt,
        timestamp
      )
      result.pan = patternResult.pan
      result.tilt = patternResult.tilt
    }
    
    return result
  }
  
  private calculatePatternMovement(
    override: ManualOverride,
    basePan: number,
    baseTilt: number,
    timestamp: number
  ): { pan: number; tilt: number } {
    const speed = (override.patternSpeed || 50) / 100
    const phase = ((timestamp * speed) / 1000) % (Math.PI * 2)
    const amplitude = ((override.patternAmplitude || 50) / 100) * 127
    
    const centerPan = override.pan !== undefined ? override.pan : 127
    const centerTilt = override.tilt !== undefined ? override.tilt : 127
    
    let pan = basePan
    let tilt = baseTilt
    
    switch (override.movementPattern) {
      case 'circle':
        pan = Math.round(centerPan + Math.cos(phase) * amplitude)
        tilt = Math.round(centerTilt + Math.sin(phase) * amplitude)
        break
      case 'figure8':
        pan = Math.round(centerPan + Math.sin(phase) * amplitude)
        tilt = Math.round(centerTilt + Math.sin(phase * 2) * amplitude * 0.5)
        break
      case 'sweep':
        pan = Math.round(centerPan + Math.sin(phase) * amplitude)
        tilt = centerTilt
        break
      case 'random':
        pan = Math.round(centerPan + (Math.random() - 0.5) * amplitude * 0.3)
        tilt = Math.round(centerTilt + (Math.random() - 0.5) * amplitude * 0.3)
        break
    }
    
    // Clamp to valid DMX range
    pan = Math.max(0, Math.min(255, pan))
    tilt = Math.max(0, Math.min(255, tilt))
    
    return { pan, tilt }
  }
  
  private applyActiveEffects(state: FixtureState, timestamp: number): FixtureState {
    const result = { ...state }
    
    if (this.activeEffects.has('strobe')) {
      const strobeOn = (Math.floor(timestamp / 50) % 2) === 0
      result.dimmer = strobeOn ? 255 : 0
    }
    
    if (this.activeEffects.has('blinder')) {
      result.dimmer = 255
      result.r = 255
      result.g = 255
      result.b = 255
    }
    
    if (this.activeEffects.has('police')) {
      const policePhase = (Math.floor(timestamp / 250) % 2) === 0
      result.dimmer = 255
      result.r = policePhase ? 255 : 0
      result.g = 0
      result.b = policePhase ? 0 : 255
    }
    
    if (this.activeEffects.has('rainbow')) {
      const hue = (timestamp / 3000) % 1
      const rgb = this.hslToRgbLocal(hue, 1.0, 0.5)
      result.r = rgb.r
      result.g = rgb.g
      result.b = rgb.b
      result.dimmer = 255
    }
    
    return result
  }
  
  /**
   * Local HSL to RGB for effects (normalized h 0-1).
   */
  private hslToRgbLocal(h: number, s: number, l: number): { r: number; g: number; b: number } {
    let r: number, g: number, b: number
    
    if (s === 0) {
      r = g = b = l
    } else {
      const hue2rgb = (p: number, q: number, t: number): number => {
        if (t < 0) t += 1
        if (t > 1) t -= 1
        if (t < 1/6) return p + (q - p) * 6 * t
        if (t < 1/2) return q
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
        return p
      }
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s
      const p = 2 * l - q
      r = hue2rgb(p, q, h + 1/3)
      g = hue2rgb(p, q, h)
      b = hue2rgb(p, q, h - 1/3)
    }
    
    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255),
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════════════════════
  
  public destroy(): void {
    this.manualOverrides.clear()
    this.activeEffects.clear()
    console.log('[FixtureMapper] 🛑 Destroyed')
  }
}

// Export singleton for easy use
export const fixtureMapper = new FixtureMapper()
