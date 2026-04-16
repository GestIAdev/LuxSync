/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛡️ WAVE 1000 → WAVE 2711: HARDWARE SAFETY LAYER — PASSIVE DEBOUNCE
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Protege la rueda mecánica de color de cambios más rápidos que su motor.
 * 
 * 🔧 WAVE 2711: DESMANTELAMIENTO DEL BÚNKER
 *
 * ANTES (WAVE 1000):
 *   - CHECK 1: Chaos Latch → congelaba el color en lastColorDmx durante 2s
 *   - CHECK 2: Chaos detection → >3 cambios/sec disparaba latch
 *   - CHECK 3: Debounce → bloqueaba cambios más rápidos que minChangeTimeMs
 *   - Strobe delegation → inyectaba strobe shutter en el fixture
 *
 * PROBLEMA:
 *   - Chaos latch congelaba en DMX 0 = White/Open en Beam 2R
 *   - Strobe delegation hacía flash blanco involuntario
 *   - DarkSpinFilter (WAVE 2690) ya maneja blackout durante tránsito de rueda
 *   - HarmonicQuantizer (WAVE 2672) ya gate colores al BPM
 *   → El búnker era REDUNDANTE y DAÑINO
 *
 * AHORA:
 *   - SOLO debounce pasivo (minChangeTimeMs del perfil)
 *   - SIN chaos latch, SIN strobe delegation
 *   - delegateToStrobe = SIEMPRE false
 *   - suggestedShutter = SIEMPRE 255 (shutter open)
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
 * Estado de seguridad por fixture — solo debounce
 */
interface FixtureSafetyState {
  fixtureId: string
  lastColorDmx: number
  lastColorChangeTime: number
  /** Contador de cambios bloqueados (para métricas) */
  blockedChanges: number
}

/**
 * Resultado del filtro de seguridad
 * Sin strobe delegation — DarkSpinFilter maneja el blackout mecánico.
 */
export interface SafetyFilterResult {
  finalColorDmx: number
  wasBlocked: boolean
  /** ¿Estaba en debounce? — WAVE 2711 */
  isDebounced: boolean
  /** Razón del bloqueo (si aplica) */
  blockReason?: string
}

/**
 * Configuración del SafetyLayer
 */
export interface SafetyConfig {
  debug: boolean
  safetyMargin: number
  /** WAVE 2711: Preserved for API compatibility, no longer used */
  chaosThreshold: number
  /** WAVE 2711: Preserved for API compatibility, no longer used */
  latchDurationMs: number
}

const DEFAULT_CONFIG: SafetyConfig = {
  debug: false,
  safetyMargin: 1.2,      // 20% margen de seguridad extra
  chaosThreshold: 3,       // WAVE 2711: legacy, unused
  latchDurationMs: 2000,   // WAVE 2711: legacy, unused
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
   * 🎯 MÉTODO PRINCIPAL: Filtra un cambio de color — solo debounce pasivo
   * 
   * WAVE 2711: Chaos latch y strobe delegation ELIMINADOS.
   * DarkSpinFilter (WAVE 2690) y HarmonicQuantizer (WAVE 2672) manejan
   * la protección inteligente. Este layer solo protege el motor físico.
   * 
   * @param fixtureId - ID único del fixture
   * @param requestedColorDmx - Color DMX que quiere Selene
   * @param profile - Perfil del fixture
   * @param currentDimmer - Dimmer actual (preserved for API compat)
   * @returns Resultado filtrado
   */
  public filter(
    fixtureId: string,
    requestedColorDmx: number,
    profile: FixtureProfile | undefined,
    currentDimmer: number = 255
  ): SafetyFilterResult {
    const now = Date.now()
    
    // ═══════════════════════════════════════════════════════════════════
    // CASO 1: Sin perfil o es fixture digital → Pass-through
    // ═══════════════════════════════════════════════════════════════════
    if (!profile || !isMechanicalFixture(profile)) {
      return {
        finalColorDmx: requestedColorDmx,
        wasBlocked: false,
        isDebounced: false,
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // CASO 2: Fixture mecánico → Debounce pasivo solamente
    // ═══════════════════════════════════════════════════════════════════
    
    let state = this.fixtureStates.get(fixtureId)
    if (!state) {
      state = {
        fixtureId,
        lastColorDmx: requestedColorDmx,
        lastColorChangeTime: now,
        blockedChanges: 0,
      }
      this.fixtureStates.set(fixtureId, state)
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // DEBOUNCE: ¿Ha pasado suficiente tiempo desde el último cambio?
    // Si el color no cambió, pass-through inmediato.
    // ═══════════════════════════════════════════════════════════════════
    if (requestedColorDmx !== state.lastColorDmx) {
      const minChangeTime = this.getMinChangeTime(profile)
      const timeSinceLastChange = now - state.lastColorChangeTime
      
      if (timeSinceLastChange < minChangeTime) {
        // Cambio demasiado rápido para el motor → BLOQUEAR
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
      
      // Cambio permitido — actualizar estado
      state.lastColorDmx = requestedColorDmx
      state.lastColorChangeTime = now
      state.blockedChanges = 0
      
      if (this.config.debug) {
        console.log(`[SafetyLayer] ✅ ALLOWED: ${fixtureId} → color DMX ${requestedColorDmx}`)
      }
    }
    
    return {
      finalColorDmx: requestedColorDmx,
      wasBlocked: false,
      isDebounced: false,
    }
  }
  
  /**
   * 🔧 WAVE 2711: getLastColor — devuelve el último color aplicado
   * para que HarmonicQuantizer sepa qué valor holdear cuando el gate está cerrado.
   */
  public getLastColor(fixtureId: string): number | undefined {
    return this.fixtureStates.get(fixtureId)?.lastColorDmx
  }
  
  /**
   * Resetea el estado de un fixture específico
   */
  public resetFixture(fixtureId: string): void {
    this.fixtureStates.delete(fixtureId)
  }
  
  public resetAll(): void {
    this.fixtureStates.clear()
  }
  
  /**
   * Obtiene métricas de seguridad
   * WAVE 2711: solo debounce, sin latch/strobe
   */
  public getMetrics(): { 
    totalBlockedChanges: number
    activeFixtures: number
  } {
    return {
      totalBlockedChanges: this.totalBlockedChanges,
      activeFixtures: this.fixtureStates.size,
    }
  }
  
  /**
   * Imprime un reporte de métricas
   */
  public printMetrics(): void {
    const m = this.getMetrics()
    console.log('[SafetyLayer] 📊 METRICS:')
    console.log(`  Blocked changes (debounce): ${m.totalBlockedChanges}`)
    console.log(`  Active fixtures: ${m.activeFixtures}`)
  }
  
  /**
   * Actualiza la configuración
   */
  public setConfig(config: Partial<SafetyConfig>): void {
    this.config = { ...this.config, ...config }
  }

  private getMinChangeTime(profile: FixtureProfile): number {
    const baseTime = profile.colorEngine?.colorWheel?.minChangeTimeMs ?? 500
    return Math.round(baseTime * this.config.safetyMargin)
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
