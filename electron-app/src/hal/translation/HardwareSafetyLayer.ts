/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛡️ WAVE 1000 → WAVE 2711: HARDWARE SAFETY LAYER - EL BÚNKER (LIMPIO)
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Protege la maquinaria de las demandas imposibles de la IA.
 * 
 * WAVE 2711: Eliminados chaos latch y strobe delegation.
 * Solo queda el debounce pasivo (CHECK 3 original).
 * DarkSpinFilter se encarga del blackout durante tránsito.
 * 
 * @module hal/translation/HardwareSafetyLayer
 * @version WAVE 2711
 */

import { 
  type FixtureProfile, 
  isMechanicalFixture,
  needsColorTranslation,
} from './FixtureProfiles'
import { type RGB, type ColorTranslationResult } from './ColorTranslator'

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Estado de seguridad por fixture
 * Solo retiene lo necesario para el debounce temporal.
 */
interface FixtureSafetyState {
  fixtureId: string
  lastColorDmx: number
  lastColorChangeTime: number
  blockedChanges: number
  lastDimmer: number
}

/**
 * Resultado del filtro de seguridad
 * Sin strobe delegation — DarkSpinFilter maneja el blackout mecánico.
 */
export interface SafetyFilterResult {
  finalColorDmx: number
  wasBlocked: boolean
  isDebounced: boolean
  blockReason?: string
}

/**
 * Configuración del SafetyLayer
 */
export interface SafetyConfig {
  debug: boolean
  safetyMargin: number
}

const DEFAULT_CONFIG: SafetyConfig = {
  debug: false,
  safetyMargin: 1.2,
}

// ═══════════════════════════════════════════════════════════════════════════
// HARDWARE SAFETY LAYER CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class HardwareSafetyLayer {
  private fixtureStates = new Map<string, FixtureSafetyState>()
  private config: SafetyConfig
  private totalBlockedChanges = 0
  
  constructor(config: Partial<SafetyConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }
  
  /**
   * 🎯 Filtra un cambio de color — solo debounce temporal.
   * El chaos latch y strobe delegation fueron eliminados en WAVE 2711.
   * DarkSpinFilter se encarga del blackout durante tránsito mecánico.
   */
  public filter(
    fixtureId: string,
    requestedColorDmx: number,
    profile: FixtureProfile | undefined,
    currentDimmer: number = 255
  ): SafetyFilterResult {
    const now = Date.now()
    
    // Sin perfil o fixture digital → pass-through
    if (!profile || !isMechanicalFixture(profile)) {
      return {
        finalColorDmx: requestedColorDmx,
        wasBlocked: false,
        isDebounced: false,
      }
    }
    
    // Obtener o crear estado
    let state = this.fixtureStates.get(fixtureId)
    if (!state) {
      state = {
        fixtureId,
        lastColorDmx: requestedColorDmx,
        lastColorChangeTime: now,
        blockedChanges: 0,
        lastDimmer: currentDimmer,
      }
      this.fixtureStates.set(fixtureId, state)
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // DEBOUNCE: ¿Ha pasado suficiente tiempo desde el último cambio?
    // ═══════════════════════════════════════════════════════════════════
    const minChangeTime = this.getMinChangeTime(profile)
    const timeSinceLastChange = now - state.lastColorChangeTime
    
    if (requestedColorDmx !== state.lastColorDmx && timeSinceLastChange < minChangeTime) {
      state.blockedChanges++
      this.totalBlockedChanges++
      
      if (this.config.debug && state.blockedChanges % 30 === 0) {
        console.log(`[SafetyLayer] 🚫 DEBOUNCE: ${fixtureId} (${timeSinceLastChange}ms < ${minChangeTime}ms)`)
      }
      
      return {
        finalColorDmx: state.lastColorDmx,
        wasBlocked: true,
        isDebounced: true,
        blockReason: `DEBOUNCE (${timeSinceLastChange}ms < ${minChangeTime}ms)`,
      }
    }
    
    // Permitir el cambio
    if (requestedColorDmx !== state.lastColorDmx) {
      state.lastColorDmx = requestedColorDmx
      state.lastColorChangeTime = now
      state.blockedChanges = 0
      
      if (this.config.debug) {
        console.log(`[SafetyLayer] ✅ ALLOWED: ${fixtureId} → color DMX ${requestedColorDmx}`)
      }
    }
    
    state.lastDimmer = currentDimmer
    
    return {
      finalColorDmx: requestedColorDmx,
      wasBlocked: false,
      isDebounced: false,
    }
  }
  
  /**
   * 🔧 WAVE 2711: getLastColor — devuelve el último color aplicado
   * para que DarkSpinFilter sepa qué valor holdear durante tránsito.
   */
  public getLastColor(fixtureId: string): number {
    return this.fixtureStates.get(fixtureId)?.lastColorDmx ?? 0
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // MÉTODOS PRIVADOS
  // ═══════════════════════════════════════════════════════════════════════
  
  private getMinChangeTime(profile: FixtureProfile): number {
    const baseTime = profile.colorEngine?.colorWheel?.minChangeTimeMs ?? 500
    return Math.round(baseTime * this.config.safetyMargin)
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // API PÚBLICA
  // ═══════════════════════════════════════════════════════════════════════
  
  public resetFixture(fixtureId: string): void {
    this.fixtureStates.delete(fixtureId)
  }
  
  public resetAll(): void {
    this.fixtureStates.clear()
  }
  
  public getMetrics(): { 
    totalBlockedChanges: number
    activeFixtures: number
  } {
    return {
      totalBlockedChanges: this.totalBlockedChanges,
      activeFixtures: this.fixtureStates.size,
    }
  }
  
  public setConfig(config: Partial<SafetyConfig>): void {
    this.config = { ...this.config, ...config }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON EXPORT
// ═══════════════════════════════════════════════════════════════════════════

let instance: HardwareSafetyLayer | null = null

export function getHardwareSafetyLayer(): HardwareSafetyLayer {
  if (!instance) {
    instance = new HardwareSafetyLayer()
  }
  return instance
}
