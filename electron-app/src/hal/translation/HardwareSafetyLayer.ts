/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛡️ WAVE 1000: HARDWARE SAFETY LAYER - EL BÚNKER
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Protege la maquinaria de las demandas imposibles de la IA.
 * 
 * PROBLEMA QUE RESUELVE:
 * Selene sueña un efecto estroboscópico multicolor a 20Hz.
 * El Beam 2R tiene rueda mecánica que tarda 500ms en cambiar.
 * Si intentamos seguir a Selene, el motor se quema.
 * 
 * SOLUCIÓN:
 * 1. DEBOUNCE: Ignorar cambios más rápidos que el límite del hardware
 * 2. LATCH: En efectos caóticos, elegir un color y mantenerlo
 * 3. SHUTTER DELEGATION: Si no puedes cambiar de color, strobeaen blanco
 * 
 * FILOSOFÍA:
 * "Es mejor un show imperfecto que un fixture roto"
 * 
 * @module hal/translation/HardwareSafetyLayer
 * @version WAVE 1000
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
 */
interface FixtureSafetyState {
  /** ID del fixture */
  fixtureId: string
  /** Último color aplicado (DMX de rueda) */
  lastColorDmx: number
  /** Timestamp del último cambio de color */
  lastColorChangeTime: number
  /** ¿Está en modo "latch" (color bloqueado)? */
  isLatched: boolean
  /** Color bloqueado durante latch */
  latchedColorDmx: number
  /** Timestamp de inicio del latch */
  latchStartTime: number
  /** Contador de intentos de cambio bloqueados (para métricas) */
  blockedChanges: number
  /** Último dimmer para detectar strobe patterns */
  lastDimmer: number
  /** Historial de cambios recientes (para detectar caos) */
  recentChanges: number[]  // Timestamps de cambios
}

/**
 * Resultado del filtro de seguridad
 */
export interface SafetyFilterResult {
  /** Color DMX final a enviar */
  finalColorDmx: number
  /** ¿Se bloqueó el cambio? */
  wasBlocked: boolean
  /** ¿Se activó modo latch? */
  isInLatch: boolean
  /** Razón del bloqueo (si aplica) */
  blockReason?: string
  /** Valor de shutter sugerido (255 = abierto, <255 = strobe) */
  suggestedShutter: number
  /** ¿Se recomienda delegar a strobe? */
  delegateToStrobe: boolean
}

/**
 * Configuración del SafetyLayer
 */
export interface SafetyConfig {
  /** ¿Activar logs de debug? */
  debug: boolean
  /** Multiplicador del tiempo mínimo de cambio (1.0 = usar valor del perfil) */
  safetyMargin: number
  /** Umbral de cambios/segundo para detectar caos (default: 3) */
  chaosThreshold: number
  /** Tiempo de latch forzado cuando se detecta caos (ms) */
  latchDurationMs: number
}

const DEFAULT_CONFIG: SafetyConfig = {
  debug: false,
  safetyMargin: 1.2,      // 20% margen de seguridad extra
  chaosThreshold: 3,       // 3 cambios/segundo = caos
  latchDurationMs: 2000,   // 2 segundos de latch
}

// ═══════════════════════════════════════════════════════════════════════════
// HARDWARE SAFETY LAYER CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class HardwareSafetyLayer {
  // Estado por fixture
  private fixtureStates = new Map<string, FixtureSafetyState>()
  
  // Configuración
  private config: SafetyConfig
  
  // Métricas globales
  private totalBlockedChanges = 0
  private totalLatchActivations = 0
  private totalStrobeDelegations = 0
  
  constructor(config: Partial<SafetyConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    console.log('[SafetyLayer] 🛡️ WAVE 1000: Hardware Safety Layer initialized')
    console.log(`[SafetyLayer]    Safety margin: ${this.config.safetyMargin}x`)
    console.log(`[SafetyLayer]    Chaos threshold: ${this.config.chaosThreshold} changes/sec`)
    console.log(`[SafetyLayer]    Latch duration: ${this.config.latchDurationMs}ms`)
  }
  
  /**
   * 🎯 MÉTODO PRINCIPAL: Filtra un cambio de color a través del búnker de seguridad
   * 
   * @param fixtureId - ID único del fixture
   * @param requestedColorDmx - Color DMX que quiere Selene
   * @param profile - Perfil del fixture
   * @param currentDimmer - Dimmer actual (para detectar strobe patterns)
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
    // CASO 1: Sin perfil o es fixture digital → Pass-through (sin restricciones)
    // ═══════════════════════════════════════════════════════════════════
    if (!profile || !isMechanicalFixture(profile)) {
      return {
        finalColorDmx: requestedColorDmx,
        wasBlocked: false,
        isInLatch: false,
        suggestedShutter: 255,
        delegateToStrobe: false,
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // CASO 2: Fixture mecánico → Aplicar protección
    // ═══════════════════════════════════════════════════════════════════
    
    // Obtener o crear estado del fixture
    let state = this.fixtureStates.get(fixtureId)
    if (!state) {
      state = this.createInitialState(fixtureId, requestedColorDmx)
      this.fixtureStates.set(fixtureId, state)
    }
    
    // Actualizar historial de cambios
    this.updateChangeHistory(state, requestedColorDmx, now)
    
    // ═══════════════════════════════════════════════════════════════════
    // CHECK 1: ¿Estamos en modo LATCH?
    // ═══════════════════════════════════════════════════════════════════
    if (state.isLatched) {
      const latchElapsed = now - state.latchStartTime
      
      if (latchElapsed < this.config.latchDurationMs) {
        // Aún en latch → mantener color bloqueado
        state.blockedChanges++
        this.totalBlockedChanges++
        
        if (this.config.debug && state.blockedChanges % 10 === 0) {
          console.log(`[SafetyLayer] 🔒 LATCH: ${fixtureId} blocked (${Math.round(latchElapsed)}ms/${this.config.latchDurationMs}ms)`)
        }
        
        return {
          finalColorDmx: state.latchedColorDmx,
          wasBlocked: true,
          isInLatch: true,
          blockReason: `LATCH active (${Math.round(latchElapsed)}ms remaining)`,
          suggestedShutter: this.calculateStrobeShutter(state, currentDimmer),
          delegateToStrobe: this.shouldDelegateToStrobe(state),
        }
      } else {
        // Latch expirado → liberar
        state.isLatched = false
        if (this.config.debug) {
          console.log(`[SafetyLayer] 🔓 LATCH released: ${fixtureId}`)
        }
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // CHECK 2: ¿Detectamos patrón de CAOS?
    // ═══════════════════════════════════════════════════════════════════
    const changesPerSecond = this.calculateChangesPerSecond(state, now)
    
    if (changesPerSecond > this.config.chaosThreshold) {
      // ¡CAOS DETECTADO! Activar LATCH
      state.isLatched = true
      state.latchedColorDmx = state.lastColorDmx  // Mantener el último color bueno
      state.latchStartTime = now
      this.totalLatchActivations++
      
      if (this.config.debug) {
        console.log(`[SafetyLayer] ⚠️ CHAOS DETECTED: ${fixtureId} (${changesPerSecond.toFixed(1)} changes/sec)`)
        console.log(`[SafetyLayer] 🔒 LATCH activated: holding color DMX ${state.latchedColorDmx}`)
      }
      
      return {
        finalColorDmx: state.latchedColorDmx,
        wasBlocked: true,
        isInLatch: true,
        blockReason: `CHAOS (${changesPerSecond.toFixed(1)} changes/sec > ${this.config.chaosThreshold})`,
        suggestedShutter: this.calculateStrobeShutter(state, currentDimmer),
        delegateToStrobe: true,  // En caos, delegamos a strobe
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // CHECK 3: ¿Ha pasado suficiente tiempo desde el último cambio?
    // ═══════════════════════════════════════════════════════════════════
    const minChangeTime = this.getMinChangeTime(profile)
    const timeSinceLastChange = now - state.lastColorChangeTime
    
    if (requestedColorDmx !== state.lastColorDmx && timeSinceLastChange < minChangeTime) {
      // Cambio demasiado rápido → BLOQUEAR
      state.blockedChanges++
      this.totalBlockedChanges++
      
      if (this.config.debug && state.blockedChanges % 30 === 0) {
        console.log(`[SafetyLayer] 🚫 DEBOUNCE: ${fixtureId} (${timeSinceLastChange}ms < ${minChangeTime}ms)`)
      }
      
      return {
        finalColorDmx: state.lastColorDmx,  // Mantener color anterior
        wasBlocked: true,
        isInLatch: false,
        blockReason: `DEBOUNCE (${timeSinceLastChange}ms < ${minChangeTime}ms)`,
        suggestedShutter: 255,
        delegateToStrobe: false,
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // CASO SEGURO: Permitir el cambio
    // ═══════════════════════════════════════════════════════════════════
    if (requestedColorDmx !== state.lastColorDmx) {
      state.lastColorDmx = requestedColorDmx
      state.lastColorChangeTime = now
      
      if (this.config.debug) {
        console.log(`[SafetyLayer] ✅ ALLOWED: ${fixtureId} → color DMX ${requestedColorDmx}`)
      }
    }
    
    state.lastDimmer = currentDimmer
    
    return {
      finalColorDmx: requestedColorDmx,
      wasBlocked: false,
      isInLatch: false,
      suggestedShutter: 255,
      delegateToStrobe: false,
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // MÉTODOS PRIVADOS
  // ═══════════════════════════════════════════════════════════════════════
  
  private createInitialState(fixtureId: string, initialColor: number): FixtureSafetyState {
    return {
      fixtureId,
      lastColorDmx: initialColor,
      lastColorChangeTime: Date.now(),
      isLatched: false,
      latchedColorDmx: 0,
      latchStartTime: 0,
      blockedChanges: 0,
      lastDimmer: 255,
      recentChanges: [],
    }
  }
  
  private getMinChangeTime(profile: FixtureProfile): number {
    const baseTime = profile.colorEngine.colorWheel?.minChangeTimeMs ?? 500
    return Math.round(baseTime * this.config.safetyMargin)
  }
  
  private updateChangeHistory(state: FixtureSafetyState, newColor: number, now: number): void {
    // Si el color cambió, registrar el timestamp
    if (newColor !== state.lastColorDmx) {
      state.recentChanges.push(now)
    }
    
    // Limpiar cambios viejos (más de 2 segundos)
    const cutoff = now - 2000
    state.recentChanges = state.recentChanges.filter(t => t > cutoff)
  }
  
  private calculateChangesPerSecond(state: FixtureSafetyState, now: number): number {
    // Contar cambios en el último segundo
    const oneSecondAgo = now - 1000
    const recentCount = state.recentChanges.filter(t => t > oneSecondAgo).length
    return recentCount
  }
  
  private shouldDelegateToStrobe(state: FixtureSafetyState): boolean {
    // Delegar a strobe si hay muchos cambios bloqueados
    return state.blockedChanges > 10
  }
  
  private calculateStrobeShutter(state: FixtureSafetyState, currentDimmer: number): number {
    // Si estamos en modo strobe delegation, calcular velocidad de strobe
    // basado en la intensidad de la demanda
    if (!this.shouldDelegateToStrobe(state)) {
      return 255  // Shutter abierto
    }
    
    // Mapear cambios bloqueados a velocidad de strobe
    // Más cambios = strobe más rápido
    const intensity = Math.min(state.blockedChanges / 30, 1)  // 0-1
    
    // Strobe típico: 128 = medio, 200 = rápido, 255 = muy rápido
    return Math.round(128 + intensity * 127)
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // API PÚBLICA
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Resetea el estado de un fixture específico
   */
  public resetFixture(fixtureId: string): void {
    this.fixtureStates.delete(fixtureId)
    if (this.config.debug) {
      console.log(`[SafetyLayer] 🔄 Reset: ${fixtureId}`)
    }
  }
  
  /**
   * Resetea todos los estados
   */
  public resetAll(): void {
    this.fixtureStates.clear()
    console.log('[SafetyLayer] 🔄 All fixtures reset')
  }
  
  /**
   * Obtiene métricas de seguridad
   */
  public getMetrics(): { 
    totalBlockedChanges: number
    totalLatchActivations: number
    totalStrobeDelegations: number
    activeFixtures: number
    fixturesInLatch: number
  } {
    let fixturesInLatch = 0
    this.fixtureStates.forEach(state => {
      if (state.isLatched) fixturesInLatch++
    })
    
    return {
      totalBlockedChanges: this.totalBlockedChanges,
      totalLatchActivations: this.totalLatchActivations,
      totalStrobeDelegations: this.totalStrobeDelegations,
      activeFixtures: this.fixtureStates.size,
      fixturesInLatch,
    }
  }
  
  /**
   * Imprime un reporte de métricas
   */
  public printMetrics(): void {
    const m = this.getMetrics()
    console.log('[SafetyLayer] 📊 METRICS:')
    console.log(`  Blocked changes: ${m.totalBlockedChanges}`)
    console.log(`  Latch activations: ${m.totalLatchActivations}`)
    console.log(`  Strobe delegations: ${m.totalStrobeDelegations}`)
    console.log(`  Active fixtures: ${m.activeFixtures}`)
    console.log(`  Fixtures in latch: ${m.fixturesInLatch}`)
  }
  
  /**
   * Actualiza la configuración
   */
  public setConfig(config: Partial<SafetyConfig>): void {
    this.config = { ...this.config, ...config }
    console.log('[SafetyLayer] ⚙️ Config updated')
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
