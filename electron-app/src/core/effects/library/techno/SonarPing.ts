/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔵 SONAR PING - SUBMARINE TENSION
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * 🏭 WAVE 977: LA FÁBRICA - Tensión Submarina para Silencios
 * 
 * FILOSOFÍA:
 * Un pulso solitario de luz Cian/Azul que viaja desde los Pars traseros
 * hacia los delanteros. Como el ping de un sonar en las profundidades.
 * Perfecto para los silencios tecnológicos donde el vacío necesita ALGO.
 * 
 * ZONA TARGET: SILENCE / VALLEY (E < 0.50)
 * Cuando el techno respira, el sonar vigila.
 * 
 * COMPORTAMIENTO:
 * - MixBus: 'global' (DICTADOR - el ping necesita negro alrededor)
 * - Un pulso viaja de back → pars → front (secuencia espacial)
 * - Duración del ping: 150-200ms por zona
 * - Gap entre zonas: 100ms (efecto de "viaje")
 * - Intensidad: Baja pero visible (25-45%)
 * 
 * ADN:
 * - Aggression: 0.15 (Bajo - no agrede)
 * - Chaos: 0.10 (Muy ordenado - secuencia predecible)
 * - Organicity: 0.05 (Máquina pura - tecnología submarina)
 * 
 * COLORES:
 * - Cian profundo (190, 100, 45) - Deep Ocean
 * - Azul frío (210, 80, 40) - Abyssal Blue
 * 
 * @module core/effects/library/techno/SonarPing
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

interface SonarPingConfig {
  /** Duración del ping en cada zona (ms) */
  pingDurationMs: number
  
  /** Gap entre zonas (ms) - el "viaje" del sonar */
  zoneGapMs: number
  
  /** Intensidad del ping (0-1) */
  pingIntensity: number
  
  /** ¿Hacer ping de vuelta? (back→front→back) */
  returnPing: boolean
  
  /** Color primario: Cian profundo */
  colorPrimary: { h: number; s: number; l: number }
  
  /** Color secundario: Azul frío */
  colorSecondary: { h: number; s: number; l: number }
  
  /** ¿Usar color aleatorio entre primary/secondary? */
  randomizeColor: boolean
}

const DEFAULT_CONFIG: SonarPingConfig = {
  pingDurationMs: 180,       // 180ms por zona
  zoneGapMs: 100,            // 100ms de viaje entre zonas
  pingIntensity: 0.40,       // 40% - visible pero no dominante
  returnPing: false,         // Solo ida (back→front)
  colorPrimary: { h: 190, s: 100, l: 45 },   // Cian profundo
  colorSecondary: { h: 210, s: 80, l: 40 },  // Azul frío
  randomizeColor: false,     // Color consistente por efecto
}

// Secuencia espacial: back → pars → front
const ZONE_SEQUENCE: EffectZone[] = ['back', 'all-pars', 'front']

// ═══════════════════════════════════════════════════════════════════════════
// 🔵 SONAR PING CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class SonarPing extends BaseEffect {
  // ─────────────────────────────────────────────────────────────────────────
  // ILightEffect properties
  // ─────────────────────────────────────────────────────────────────────────
  
  readonly effectType = 'sonar_ping'
  readonly name = 'Sonar Ping'
  readonly category: EffectCategory = 'physical'
  readonly priority = 55  // Baja prioridad - efecto ambient/atmosférico
  readonly mixBus = 'global' as const  // 🚂 El ping necesita negro para destacar
  
  // ─────────────────────────────────────────────────────────────────────────
  // Internal state
  // ─────────────────────────────────────────────────────────────────────────
  
  private config: SonarPingConfig
  private totalDurationMs: number = 0
  private currentColor: { h: number; s: number; l: number }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Constructor
  // ─────────────────────────────────────────────────────────────────────────
  
  constructor(config?: Partial<SonarPingConfig>) {
    super('sonar_ping')
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.currentColor = this.config.colorPrimary
    this.calculateTotalDuration()
  }
  
  private calculateTotalDuration(): void {
    const zonesCount = ZONE_SEQUENCE.length
    const forwardDuration = (this.config.pingDurationMs + this.config.zoneGapMs) * zonesCount
    
    if (this.config.returnPing) {
      // Ida + vuelta
      this.totalDurationMs = forwardDuration * 2
    } else {
      this.totalDurationMs = forwardDuration
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────
  
  trigger(config: EffectTriggerConfig): void {
    super.trigger(config)
    this.triggerIntensity = config.intensity ?? 1.0
    
    // ═══════════════════════════════════════════════════════════════════
    // Seleccionar color (determinista basado en timestamp del trigger)
    // ═══════════════════════════════════════════════════════════════════
    if (this.config.randomizeColor) {
      const colorSelector = (Date.now() % 2) === 0
      this.currentColor = colorSelector 
        ? this.config.colorPrimary 
        : this.config.colorSecondary
    } else {
      this.currentColor = this.config.colorPrimary
    }
    
    // 🔵 Inicio del efecto
    // console.log(`[🔵 SONAR_PING] Triggered @ intensity ${this.triggerIntensity.toFixed(2)}`)
  }
  
  update(deltaMs: number): void {
    if (this.phase === 'idle' || this.phase === 'finished') return
    
    this.elapsedMs += deltaMs
    
    // ¿Terminó?
    if (this.elapsedMs >= this.totalDurationMs) {
      this.phase = 'finished'
      return
    }
    
    // La fase se actualiza según el progreso
    const progress = this.elapsedMs / this.totalDurationMs
    if (progress < 0.1) {
      this.phase = 'attack'
    } else if (progress < 0.9) {
      this.phase = 'sustain'
    } else {
      this.phase = 'decay'
    }
  }
  
  getOutput(): EffectFrameOutput | null {
    // 🛠️ WAVE 987: Validación de phase - retornar null si no estamos activos
    if (this.phase === 'idle' || this.phase === 'finished') {
      return null
    }
    
    const progress = Math.min(this.elapsedMs / this.totalDurationMs, 1)
    
    // ═══════════════════════════════════════════════════════════════════
    // CALCULAR QUÉ ZONA ESTÁ ACTIVA
    // ═══════════════════════════════════════════════════════════════════
    const zoneCycleDuration = this.config.pingDurationMs + this.config.zoneGapMs
    const currentZoneIndex = Math.floor(this.elapsedMs / zoneCycleDuration) % ZONE_SEQUENCE.length
    const timeInZoneCycle = this.elapsedMs % zoneCycleDuration
    
    // ¿Estamos en el ping o en el gap?
    const isInPing = timeInZoneCycle < this.config.pingDurationMs
    
    // Determinar dirección (ida o vuelta)
    let activeZoneIndex = currentZoneIndex
    if (this.config.returnPing) {
      const halfwayPoint = this.totalDurationMs / 2
      if (this.elapsedMs > halfwayPoint) {
        // Vuelta: invertir dirección
        activeZoneIndex = ZONE_SEQUENCE.length - 1 - currentZoneIndex
      }
    }
    
    const activeZone = ZONE_SEQUENCE[activeZoneIndex]
    
    // ═══════════════════════════════════════════════════════════════════
    // CALCULAR INTENSIDAD CON FADE
    // ═══════════════════════════════════════════════════════════════════
    let pingIntensity = 0
    if (isInPing) {
      const pingProgress = timeInZoneCycle / this.config.pingDurationMs
      
      // Envelope: Attack rápido, decay gradual (sinusoidal)
      const envelope = Math.sin(pingProgress * Math.PI)
      pingIntensity = this.config.pingIntensity * this.triggerIntensity * envelope
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // CONSTRUIR OUTPUT
    // 🛠️ WAVE 987: Solo retornar output válido cuando hay ping activo
    // ═══════════════════════════════════════════════════════════════════
    const zoneOverrides: Record<string, {
      dimmer: number
      color?: { h: number; s: number; l: number }
    }> = {}
    
    if (isInPing && pingIntensity > 0.01) {
      zoneOverrides[activeZone] = {
        dimmer: pingIntensity,
        color: this.currentColor,
      }
      
      // 🔵 Retornar frame válido CON color override
      return {
        effectId: this.id,
        category: this.category,
        phase: this.phase,
        progress,
        zones: [activeZone],
        intensity: pingIntensity,
        zoneOverrides,
        colorOverride: this.currentColor,
      }
    }
    
    // 🛠️ WAVE 987: Si NO hay ping activo (gap), retornar null
    // Esto evita frames vacíos que confunden al MasterArbiter
    return null
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Debug
  // ─────────────────────────────────────────────────────────────────────────
  
  getDebugState(): Record<string, unknown> {
    const zoneCycleDuration = this.config.pingDurationMs + this.config.zoneGapMs
    const currentZoneIndex = Math.floor(this.elapsedMs / zoneCycleDuration) % ZONE_SEQUENCE.length
    
    return {
      effectType: this.effectType,
      phase: this.phase,
      elapsedMs: this.elapsedMs,
      totalDurationMs: this.totalDurationMs,
      currentZone: ZONE_SEQUENCE[currentZoneIndex],
      color: `hsl(${this.currentColor.h}, ${this.currentColor.s}%, ${this.currentColor.l}%)`,
    }
  }
}

// Default export para compatibilidad
export default SonarPing
