/**
 * 🎭 WAVE 220: VIBE MANAGER
 * 
 * Gestor de perfiles de Vibe para el motor TITAN.
 * Carga y administra los perfiles que definen el comportamiento visual.
 * 
 * FILOSOFÍA:
 * - Los Vibes son RESTRICCIONES, no generadores
 * - Definen QUÉ ESTÁ PERMITIDO, el motor decide QUÉ HACER
 * - Cada vibe tiene su personalidad única
 * 
 * @layer ENGINE/VIBE
 * @version TITAN 2.0
 */

import { VIBE_FIESTA_LATINA } from './profiles/FiestaLatinaProfile'
import { VIBE_TECHNO_CLUB } from './profiles/TechnoClubProfile'
import { VIBE_CHILL_LOUNGE } from './profiles/ChillLoungeProfile'

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Identificadores de Vibe disponibles
 */
export type VibeId = 'fiesta-latina' | 'techno-club' | 'chill-lounge' | 'idle'

/**
 * Perfil de Vibe completo (copiado de VibeProfile.ts pero simplificado)
 */
export interface VibeProfile {
  id: VibeId
  name: string
  description: string
  icon: string
  
  color: {
    strategies: string[]
    temperature: { min: number; max: number }
    atmosphericTemp: number
    saturation: { min: number; max: number }
    forbiddenHueRanges?: [number, number][]
    allowedHueRanges?: [number, number][]
  }
  
  dimmer: {
    floor: number
    ceiling: number
    allowBlackout: boolean
    transitionSpeed: string
  }
  
  movement: {
    allowedPatterns: string[]
    speedRange: { min: number; max: number }
    allowAggressive: boolean
    preferredSync: string
  }
  
  effects: {
    allowed: string[]
    maxStrobeRate: number
    maxIntensity: number
  }
  
  meta: {
    baseEnergy: number
    volatility: number
    stabilityFirst: boolean
    bpmHint: { min: number; max: number }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// VIBE IDLE (Default/Fallback)
// ═══════════════════════════════════════════════════════════════════════════

const VIBE_IDLE: VibeProfile = {
  id: 'idle',
  name: 'Idle',
  description: 'Neutral waiting state',
  icon: '⏸️',
  
  color: {
    strategies: ['monochromatic'],
    temperature: { min: 4000, max: 6000 },
    atmosphericTemp: 5000,
    saturation: { min: 0.3, max: 0.5 },
  },
  
  dimmer: {
    floor: 0.1,
    ceiling: 0.4,
    allowBlackout: false,
    transitionSpeed: 'slow',
  },
  
  movement: {
    allowedPatterns: ['static'],
    speedRange: { min: 0, max: 0.1 },
    allowAggressive: false,
    preferredSync: 'none',
  },
  
  effects: {
    allowed: [],
    maxStrobeRate: 0,
    maxIntensity: 0.3,
  },
  
  meta: {
    baseEnergy: 0.2,
    volatility: 0.1,
    stabilityFirst: true,
    bpmHint: { min: 0, max: 200 },
  },
}

// ═══════════════════════════════════════════════════════════════════════════
// REGISTRO DE VIBES
// ═══════════════════════════════════════════════════════════════════════════

const VIBE_REGISTRY: Map<VibeId, VibeProfile> = new Map([
  ['idle', VIBE_IDLE],
  ['fiesta-latina', VIBE_FIESTA_LATINA],
  ['techno-club', VIBE_TECHNO_CLUB],
  ['chill-lounge', VIBE_CHILL_LOUNGE],
])

// ═══════════════════════════════════════════════════════════════════════════
// VIBE MANAGER CLASS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🎭 VIBE MANAGER
 * 
 * Administra los perfiles de Vibe activos.
 */
export class VibeManager {
  private currentVibeId: VibeId = 'idle'
  private transitionProgress = 1.0  // 0 = transitioning, 1 = stable
  private previousVibeId: VibeId | null = null
  
  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Establece el vibe activo.
   */
  public setVibe(vibeId: VibeId): void {
    if (vibeId === this.currentVibeId) return
    
    if (!VIBE_REGISTRY.has(vibeId)) {
      console.warn(`[VibeManager] Unknown vibe: ${vibeId}, falling back to idle`)
      vibeId = 'idle'
    }
    
    this.previousVibeId = this.currentVibeId
    this.currentVibeId = vibeId
    this.transitionProgress = 0
    
    console.log(`[VibeManager] 🎭 Switching to: ${vibeId}`)
  }
  
  /**
   * Obtiene el ID del vibe actual.
   */
  public getCurrentVibeId(): VibeId {
    return this.currentVibeId
  }
  
  /**
   * Obtiene el perfil del vibe actual.
   */
  public getCurrentProfile(): VibeProfile {
    return VIBE_REGISTRY.get(this.currentVibeId) ?? VIBE_IDLE
  }
  
  /**
   * Obtiene un perfil por ID.
   */
  public getProfile(vibeId: VibeId): VibeProfile | undefined {
    return VIBE_REGISTRY.get(vibeId)
  }
  
  /**
   * Lista todos los vibes disponibles.
   */
  public getAvailableVibes(): { id: VibeId; name: string; icon: string }[] {
    return Array.from(VIBE_REGISTRY.values()).map(v => ({
      id: v.id,
      name: v.name,
      icon: v.icon,
    }))
  }
  
  /**
   * Actualiza el progreso de transición (llamar cada frame).
   */
  public updateTransition(deltaTime: number): void {
    if (this.transitionProgress < 1) {
      // Transición de 500ms
      this.transitionProgress = Math.min(1, this.transitionProgress + deltaTime / 500)
    }
  }
  
  /**
   * Indica si estamos en transición.
   */
  public isTransitioning(): boolean {
    return this.transitionProgress < 1
  }
  
  /**
   * Obtiene el progreso de transición (0-1).
   */
  public getTransitionProgress(): number {
    return this.transitionProgress
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export { VIBE_REGISTRY, VIBE_IDLE }
