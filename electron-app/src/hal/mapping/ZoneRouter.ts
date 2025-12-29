/**
 * 🏛️ WAVE 207: ZONE ROUTER
 * 
 * Extracted from main.ts switch(zone) block (~300 lines)
 * 
 * RESPONSIBILITIES:
 * - Map abstract zones to fixture indices
 * - Determine which fixtures respond to which audio signals
 * - Provide zone-specific physics parameters
 * - Route LightingIntent zones to actual fixture addresses
 * 
 * DOES NOT:
 * - Calculate actual DMX values (that's FixtureMapper's job)
 * - Know about specific fixture channels (that's FixtureMapper's job)
 * - Apply physics (that's PhysicsEngine's job)
 */

import type { LightingIntent, ZoneIntent } from '../../core/protocol'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Physical zone identifiers (from main.ts) */
export type PhysicalZone = 
  | 'FRONT_PARS'
  | 'BACK_PARS'
  | 'MOVING_LEFT'
  | 'MOVING_RIGHT'
  | 'STROBES'
  | 'AMBIENT'
  | 'FLOOR'
  | 'UNASSIGNED'

/** Audio signal type that a zone responds to */
export type AudioResponsiveness = 'bass' | 'treble' | 'melody' | 'beat' | 'ambient'

/** Zone physics configuration */
export interface ZonePhysicsConfig {
  type: 'PAR' | 'MOVER'
  decayMultiplier: number   // 1.0 for normal, 1.5 for shimmer, etc.
  colorRole: 'primary' | 'secondary' | 'accent' | 'ambient'
}

/** Routing result for a single zone */
export interface ZoneRouteResult {
  zone: PhysicalZone
  respondsTo: AudioResponsiveness
  physics: ZonePhysicsConfig
  gateThreshold: number     // Minimum signal to activate
  gainMultiplier: number    // Signal amplification
  maxIntensity: number      // Ceiling cap
}

/** Preset configuration for vibe-aware routing */
export interface VibeRouteConfig {
  parGate: number
  parGain: number
  parMax: number
  backParGate: number
  backParGain: number
  backParMax: number
  melodyThreshold: number
  decaySpeed: number
  moverDecaySpeed?: number
}

/** Input for zone intensity calculation */
export interface ZoneIntensityInput {
  rawBass: number
  rawMid: number
  rawTreble: number
  bassPulse: number
  treblePulse: number
  melodySignal: number
  isRealSilence: boolean
  isAGCTrap: boolean
  isMelodyDominant: boolean
}

// ═══════════════════════════════════════════════════════════════════════════
// ZONE ROUTER CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class ZoneRouter {
  // Zone routing configuration (static, based on main.ts logic)
  private zoneConfig: Map<PhysicalZone, ZoneRouteResult>
  
  constructor() {
    this.zoneConfig = this.buildZoneConfig()
    console.log('[ZoneRouter] 🗺️ Initialized (WAVE 207)')
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Get routing configuration for a physical zone.
   */
  public getZoneConfig(zone: PhysicalZone): ZoneRouteResult | undefined {
    return this.zoneConfig.get(zone)
  }
  
  /**
   * Calculate target intensity for FRONT_PARS zone.
   * Based on main.ts WAVE 107 implementation.
   */
  public calculateFrontParIntensity(
    input: ZoneIntensityInput,
    preset: VibeRouteConfig
  ): number {
    // VOCAL LOCK: If silence, PARs off
    if (input.isRealSilence) {
      return 0
    }
    
    // KICK GUARD - Sidechain Visual (WAVE 117)
    let isolationFactor = 1.0
    if (input.treblePulse > 0.2) {
      isolationFactor = 0.4  // Strong snare snap
    } else if (input.treblePulse > 0.1) {
      isolationFactor = 0.7  // Hi-hat or minor transient
    }
    
    // Check if bass exceeds gate
    if (input.bassPulse > preset.parGate) {
      const isolatedPulse = input.bassPulse * isolationFactor
      let rawIntensity = Math.min(1, (isolatedPulse - preset.parGate) * preset.parGain)
      
      // Visual headroom ceiling
      rawIntensity = Math.min(preset.parMax, rawIntensity)
      
      // Soft knee clipper
      rawIntensity = this.applySoftKnee(rawIntensity)
      
      // Vanta Black hard floor (WAVE 119)
      if (rawIntensity < 0.20) rawIntensity = 0
      
      // AGC Trap
      if (input.isAGCTrap) rawIntensity = 0
      
      return rawIntensity
    }
    
    return 0
  }
  
  /**
   * Calculate target intensity for BACK_PARS zone.
   * Based on main.ts WAVE 117.1 implementation.
   */
  public calculateBackParIntensity(
    input: ZoneIntensityInput,
    preset: VibeRouteConfig
  ): number {
    if (input.isRealSilence) {
      return 0
    }
    
    // Hybrid mode: rawTreble + treblePulse boost (WAVE 117.1)
    const pulseBoost = input.treblePulse > 0.1 ? 1.3 : 1.0
    
    if (input.rawTreble > preset.backParGate) {
      let rawIntensity = Math.min(1, 
        (input.rawTreble - preset.backParGate) * preset.backParGain * pulseBoost
      )
      
      // Visual headroom ceiling
      rawIntensity = Math.min(preset.backParMax, rawIntensity)
      
      // Soft knee clipper
      rawIntensity = this.applySoftKnee(rawIntensity)
      
      // Vanta Black hard floor
      if (rawIntensity < 0.20) rawIntensity = 0
      
      // AGC Trap
      if (input.isAGCTrap) rawIntensity = 0
      
      return rawIntensity
    }
    
    return 0
  }
  
  /**
   * Get shimmer decay speed for back PARs.
   * Slower decay for cymbals/hi-hats (WAVE 109).
   */
  public getShimmerDecaySpeed(baseDecaySpeed: number): number {
    return Math.min(10, baseDecaySpeed * 1.5)
  }
  
  /**
   * Get effective mover decay speed.
   * Uses separate moverDecaySpeed if defined (WAVE 161.5).
   */
  public getEffectiveMoverDecay(preset: VibeRouteConfig): number {
    return preset.moverDecaySpeed ?? preset.decaySpeed
  }
  
  /**
   * Map abstract zone from LightingIntent to physical zones.
   */
  public mapAbstractToPhysical(abstractZone: string): PhysicalZone[] {
    const mapping: Record<string, PhysicalZone[]> = {
      'front': ['FRONT_PARS'],
      'back': ['BACK_PARS'],
      'left': ['MOVING_LEFT'],
      'right': ['MOVING_RIGHT'],
      'center': ['FRONT_PARS', 'BACK_PARS'],
      'floor': ['FRONT_PARS', 'BACK_PARS'],
      'elevated': ['MOVING_LEFT', 'MOVING_RIGHT'],
      'ambient': ['AMBIENT'],
    }
    
    return mapping[abstractZone] || ['UNASSIGNED']
  }
  
  /**
   * Get all zones that match a filter.
   */
  public getZonesByType(filter: 'PAR' | 'MOVER' | 'ALL'): PhysicalZone[] {
    if (filter === 'ALL') {
      return Array.from(this.zoneConfig.keys())
    }
    
    const result: PhysicalZone[] = []
    this.zoneConfig.forEach((config, zone) => {
      if (config.physics.type === filter) {
        result.push(zone)
      }
    })
    return result
  }
  
  /**
   * Check if a zone string contains MOVING identifier.
   */
  public isMovingZone(zone: string): boolean {
    return zone.includes('MOVING') || 
           zone.toLowerCase().includes('left') || 
           zone.toLowerCase().includes('right')
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // PRIVATE METHODS
  // ═══════════════════════════════════════════════════════════════════════
  
  private buildZoneConfig(): Map<PhysicalZone, ZoneRouteResult> {
    const config = new Map<PhysicalZone, ZoneRouteResult>()
    
    config.set('FRONT_PARS', {
      zone: 'FRONT_PARS',
      respondsTo: 'bass',
      physics: { type: 'PAR', decayMultiplier: 1.0, colorRole: 'primary' },
      gateThreshold: 0.20,
      gainMultiplier: 2.0,
      maxIntensity: 0.78
    })
    
    config.set('BACK_PARS', {
      zone: 'BACK_PARS',
      respondsTo: 'treble',
      physics: { type: 'PAR', decayMultiplier: 1.5, colorRole: 'accent' },
      gateThreshold: 0.15,
      gainMultiplier: 2.5,
      maxIntensity: 0.85
    })
    
    config.set('MOVING_LEFT', {
      zone: 'MOVING_LEFT',
      respondsTo: 'melody',
      physics: { type: 'MOVER', decayMultiplier: 1.0, colorRole: 'secondary' },
      gateThreshold: 0.25,
      gainMultiplier: 1.5,
      maxIntensity: 1.0
    })
    
    config.set('MOVING_RIGHT', {
      zone: 'MOVING_RIGHT',
      respondsTo: 'melody',
      physics: { type: 'MOVER', decayMultiplier: 1.0, colorRole: 'ambient' },
      gateThreshold: 0.25,
      gainMultiplier: 1.5,
      maxIntensity: 1.0
    })
    
    config.set('STROBES', {
      zone: 'STROBES',
      respondsTo: 'beat',
      physics: { type: 'PAR', decayMultiplier: 0.5, colorRole: 'accent' },
      gateThreshold: 0.80,
      gainMultiplier: 1.0,
      maxIntensity: 1.0
    })
    
    config.set('AMBIENT', {
      zone: 'AMBIENT',
      respondsTo: 'ambient',
      physics: { type: 'PAR', decayMultiplier: 2.0, colorRole: 'ambient' },
      gateThreshold: 0.10,
      gainMultiplier: 1.0,
      maxIntensity: 0.50
    })
    
    config.set('FLOOR', {
      zone: 'FLOOR',
      respondsTo: 'bass',
      physics: { type: 'PAR', decayMultiplier: 1.2, colorRole: 'primary' },
      gateThreshold: 0.25,
      gainMultiplier: 1.8,
      maxIntensity: 0.70
    })
    
    config.set('UNASSIGNED', {
      zone: 'UNASSIGNED',
      respondsTo: 'ambient',
      physics: { type: 'PAR', decayMultiplier: 1.0, colorRole: 'primary' },
      gateThreshold: 0.30,
      gainMultiplier: 1.0,
      maxIntensity: 0.60
    })
    
    return config
  }
  
  /**
   * Soft knee clipper (same as PhysicsEngine).
   */
  private applySoftKnee(value: number): number {
    if (value < 0.15) return 0
    if (value < 0.25) {
      const normalized = (value - 0.15) / 0.10
      return normalized * 0.25
    }
    return value
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════════════════════
  
  public destroy(): void {
    this.zoneConfig.clear()
    console.log('[ZoneRouter] 🛑 Destroyed')
  }
}

// Export singleton for easy use
export const zoneRouter = new ZoneRouter()
