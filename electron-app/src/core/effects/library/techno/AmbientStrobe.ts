/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📸 AMBIENT STROBE - STADIUM FLASHBULBS
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * 🏭 WAVE 977: LA FÁBRICA - El Eslabón Perdido del Techno
 * 
 * FILOSOFÍA:
 * Flashes suaves dispersos en el escenario. Como cámaras de fotos
 * en un estadio antes del concierto. No son sincronizados, no ciegan.
 * Mantienen el ritmo visual sin agredir.
 * 
 * ZONA TARGET: GENTLE / ACTIVE (E=0.65-0.82)
 * El puente entre la calma y la tormenta.
 * 
 * COMPORTAMIENTO:
 * - MixBus: 'global' (ADITIVO - flashes que salpican la física)
 * - Flashes blancos suaves, dispersos espacialmente
 * - NO sincrónicos: cada fixture tiene probabilidad independiente
 * - Frecuencia: 2-4 Hz (lento para no agredir)
 * - Intensidad: 40-70% (visible pero no cegador)
 * 
 * ADN:
 * - Aggression: 0.45 (Medio)
 * - Chaos: 0.40 (Semi-ordenado)
 * - Organicity: 0.10 (Máquina pura)
 * 
 * COLORES:
 * - Blanco suave (0, 0, 90) - no blanco puro para evitar harshness
 * - Opcional: Tinte cyan (190, 20, 85) en peaks
 * 
 * @module core/effects/library/techno/AmbientStrobe
 * @version WAVE 977 - LA FÁBRICA
 */

import { BaseEffect } from '../../BaseEffect'
import { 
  EffectTriggerConfig, 
  EffectFrameOutput, 
  EffectCategory,
  EffectZone
} from '../../types'

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

interface AmbientStrobeConfig {
  /** Duración total del efecto (ms) */
  durationMs: number
  
  /** Duración de cada flash (ms) */
  flashDurationMs: number
  
  /** Probabilidad de flash por fixture por tick (0-1) */
  flashProbability: number
  
  /** Intensidad mínima de flash */
  minIntensity: number
  
  /** Intensidad máxima de flash */
  maxIntensity: number
  
  /** Intervalo entre ticks de evaluación (ms) */
  tickIntervalMs: number
  
  /** ¿BPM-synced? */
  bpmSync: boolean
}

const DEFAULT_CONFIG: AmbientStrobeConfig = {
  durationMs: 4000,          // 4 segundos de actividad
  flashDurationMs: 80,       // Flash de 80ms (suave)
  flashProbability: 0.08,    // 8% por fixture por tick → dispersión natural
  minIntensity: 0.40,        // 40% mínimo
  maxIntensity: 0.70,        // 70% máximo (no cegador)
  tickIntervalMs: 100,       // Evaluar cada 100ms (~10Hz)
  bpmSync: false,            // NO sync - queremos dispersión orgánica
}

// Zonas disponibles para flashes
const FLASH_ZONES: EffectZone[] = ['front', 'pars', 'back']

// ═══════════════════════════════════════════════════════════════════════════
// 📸 AMBIENT STROBE CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class AmbientStrobe extends BaseEffect {
  // ─────────────────────────────────────────────────────────────────────────
  // ILightEffect properties
  // ─────────────────────────────────────────────────────────────────────────
  
  readonly effectType = 'ambient_strobe'
  readonly name = 'Ambient Strobe'
  readonly category: EffectCategory = 'physical'
  readonly priority = 68  // Entre atmospheric (60-70) y aggressive (85-95)
  readonly mixBus = 'global' as const  // 🚂 Salpica la física
  
  // ─────────────────────────────────────────────────────────────────────────
  // Internal state
  // ─────────────────────────────────────────────────────────────────────────
  
  private config: AmbientStrobeConfig
  private lastTickTime: number = 0
  private activeFlashes: Map<EffectZone, {
    startTime: number
    intensity: number
  }> = new Map()
  
  // Pseudo-random state (determinista basado en tiempo)
  private tickCounter: number = 0
  
  // ─────────────────────────────────────────────────────────────────────────
  // Constructor
  // ─────────────────────────────────────────────────────────────────────────
  
  constructor(config?: Partial<AmbientStrobeConfig>) {
    super('ambient_strobe')
    this.config = { ...DEFAULT_CONFIG, ...config }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────
  
  trigger(config: EffectTriggerConfig): void {
    super.trigger(config)
    this.triggerIntensity = config.intensity ?? 1.0
    this.lastTickTime = Date.now()
    this.activeFlashes.clear()
    this.tickCounter = 0
    
    // 📸 Inicio del efecto
    // console.log(`[📸 AMBIENT_STROBE] Triggered @ intensity ${this.triggerIntensity.toFixed(2)}`)
  }
  
  update(deltaMs: number): void {
    if (this.phase === 'idle' || this.phase === 'finished') return
    
    this.elapsedMs += deltaMs
    
    // ¿Terminó?
    if (this.elapsedMs >= this.config.durationMs) {
      this.phase = 'finished'
      return
    }
    
    const now = Date.now()
    
    // ═══════════════════════════════════════════════════════════════════
    // 1. TICK DE EVALUACIÓN - ¿Nuevos flashes?
    // ═══════════════════════════════════════════════════════════════════
    if (now - this.lastTickTime >= this.config.tickIntervalMs) {
      this.lastTickTime = now
      this.tickCounter++
      
      // Evaluar cada zona independientemente
      for (const zone of FLASH_ZONES) {
        // No iniciar flash si ya hay uno activo en esta zona
        if (this.activeFlashes.has(zone)) continue
        
        // ═══════════════════════════════════════════════════════════════
        // PSEUDO-RANDOM DETERMINISTA (evita Math.random())
        // Usa el tick counter y la zona para generar pseudo-aleatoriedad
        // ═══════════════════════════════════════════════════════════════
        const zoneHash = zone.charCodeAt(0) + zone.charCodeAt(zone.length - 1)
        const pseudoRandom = ((this.tickCounter * 7919 + zoneHash * 104729) % 10000) / 10000
        
        // ¿Este fixture destella en este tick?
        if (pseudoRandom < this.config.flashProbability) {
          // Intensidad pseudo-aleatoria dentro del rango
          const intensityRange = this.config.maxIntensity - this.config.minIntensity
          const intensityRandom = ((this.tickCounter * 3571 + zoneHash * 7907) % 10000) / 10000
          const flashIntensity = this.config.minIntensity + (intensityRange * intensityRandom)
          
          this.activeFlashes.set(zone, {
            startTime: now,
            intensity: flashIntensity * this.triggerIntensity,
          })
        }
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // 2. LIMPIAR FLASHES EXPIRADOS
    // ═══════════════════════════════════════════════════════════════════
    for (const [zone, flash] of this.activeFlashes) {
      if (now - flash.startTime >= this.config.flashDurationMs) {
        this.activeFlashes.delete(zone)
      }
    }
  }
  
  getOutput(): EffectFrameOutput {
    const progress = Math.min(this.elapsedMs / this.config.durationMs, 1)
    
    // Color: Blanco suave (no puro para evitar harshness)
    const color = { h: 0, s: 0, l: 90 }
    
    // Construir zoneOverrides para flashes activos
    const zoneOverrides: Record<string, {
      dimmer: number
      color?: { h: number; s: number; l: number }
    }> = {}
    
    for (const [zone, flash] of this.activeFlashes) {
      zoneOverrides[zone] = {
        dimmer: flash.intensity,
        color,
      }
    }
    
    // Calcular intensidad global (promedio de flashes activos)
    const activeCount = this.activeFlashes.size
    const totalIntensity = activeCount > 0
      ? Array.from(this.activeFlashes.values()).reduce((sum, f) => sum + f.intensity, 0) / activeCount
      : 0
    
    return {
      effectId: this.id,
      category: this.category,
      phase: this.phase,
      progress,
      zones: Array.from(this.activeFlashes.keys()),
      intensity: totalIntensity,
      zoneOverrides,
      colorOverride: color,
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Debug
  // ─────────────────────────────────────────────────────────────────────────
  
  getDebugState(): Record<string, unknown> {
    return {
      effectType: this.effectType,
      phase: this.phase,
      elapsedMs: this.elapsedMs,
      durationMs: this.config.durationMs,
      activeFlashes: Array.from(this.activeFlashes.entries()).map(([z, f]) => ({
        zone: z,
        intensity: f.intensity.toFixed(2),
      })),
      tickCounter: this.tickCounter,
    }
  }
}

// Default export para compatibilidad
export default AmbientStrobe
