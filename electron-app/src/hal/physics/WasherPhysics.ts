/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎨 WAVE 1031: WASHER PHYSICS - "EL LIENZO DE FONDO"
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * FILOSOFÍA: Los Washers (y barras LED) no marcan el ritmo, marcan la ATMÓSFERA.
 * Viven en el SUBSUELO frecuencial donde la música se SIENTE, no se oye.
 * 
 * SOURCE MAPPING:
 * - Input Principal: spectral.bands.subBass (20-60Hz)
 *   → Presión de aire, el "empujón" físico de los graves
 * - Input Secundario: spectral.texture
 *   → Determina si la sala "respira" o "explota"
 * 
 * COMPORTAMIENTOS BASE:
 * - BREATHING_WALL (Warm/Clean): La sala respira con la música
 *   → Intensidad suave al volumen general
 *   → Transiciones de color lentas (2 segundos)
 *   → Efecto: Orgánico, envolvente
 * 
 * - REACTIVE_STROBE (Harsh): Cegador de color sólido
 *   → Trigger: Golpes fuertes de bass
 *   → Efecto: Toda la sala explota en color
 * 
 * DIFERENCIA CON PARs:
 * - PARs = Ritmo puntual (kick, snare)
 * - Washers = Atmósfera continua (presión, ambiente)
 * 
 * @module hal/physics/WasherPhysics
 * @version WAVE 1031 - THE PHOTON WEAVER
 */

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Modo de comportamiento del washer */
export type WasherMode = 'breathing_wall' | 'reactive_strobe' | 'ambient_glow'

/** Input para el motor de física de washers */
export interface WasherPhysicsInput {
  /** Banda subBass (20-60Hz) - Presión de aire - 0 a 1 */
  subBass: number
  /** Textura detectada por el God Ear */
  texture: 'clean' | 'warm' | 'harsh' | 'noisy'
  /** Energía general normalizada */
  energy: number
  /** Bass tradicional para detección de golpes */
  bass: number
  /** Claridad del audio (para ajustar transiciones) */
  clarity?: number
  /** BPM detectado (para sincronización de breathing) */
  bpm?: number
}

/** Output del motor de física de washers */
export interface WasherPhysicsResult {
  /** Intensidad general del washer (0-1) */
  intensity: number
  /** Velocidad de transición de color (segundos) */
  colorTransitionSpeed: number
  /** Modo activo */
  mode: WasherMode
  /** ¿Hay un golpe de bass activo? (para REACTIVE_STROBE) */
  impactActive: boolean
  /** Intensidad del golpe (0-1) para flash de color */
  impactIntensity: number
  /** Factor de "respiración" para BREATHING_WALL (-1 a +1) */
  breathingFactor: number
  /** Debug info */
  debugInfo: {
    rawSubBass: number
    rawEnergy: number
    textureDetected: string
    modeReason: string
    breathingPhase: number
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 🎨 WASHER PHYSICS ENGINE
// ═══════════════════════════════════════════════════════════════════════════

export class WasherPhysics {
  // ═══════════════════════════════════════════════════════════════════════
  // CONSTANTES - TUNING PERFECTO
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Floor mínimo de intensidad (los washers NUNCA están completamente apagados) */
  private readonly INTENSITY_FLOOR = 0.15
  
  /** Ceiling máximo para BREATHING_WALL (no cegar, solo envolver) */
  private readonly BREATHING_CEILING = 0.70
  
  /** Ceiling para REACTIVE_STROBE (puede explotar) */
  private readonly STROBE_CEILING = 0.95
  
  /** Umbral de bass para detectar impacto */
  private readonly IMPACT_THRESHOLD = 0.65
  
  /** Tiempo de transición para BREATHING_WALL (segundos) */
  private readonly BREATHING_TRANSITION_TIME = 2.0
  
  /** Tiempo de transición para REACTIVE_STROBE (segundos) */
  private readonly STROBE_TRANSITION_TIME = 0.1
  
  /** Período base de respiración (segundos) - modulado por BPM */
  private readonly BREATHING_PERIOD_BASE = 4.0
  
  /** Decay del impacto (frames) */
  private readonly IMPACT_DECAY = 0.75
  
  // ═══════════════════════════════════════════════════════════════════════
  // ESTADO INTERNO
  // ═══════════════════════════════════════════════════════════════════════
  
  private frameCount = 0
  private breathingPhase = 0
  private lastIntensity = this.INTENSITY_FLOOR
  private lastImpactIntensity = 0
  private impactCooldown = 0
  private lastBassValue = 0
  
  constructor() {
    console.log('[WasherPhysics] 🎨 WAVE 1031: Canvas of Light initialized')
    console.log(`[WasherPhysics] 🌊 BREATHING FLOOR: ${this.INTENSITY_FLOOR}`)
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // API PÚBLICA
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * 🎨 Procesa el input espectral y genera física para washers
   */
  public apply(input: WasherPhysicsInput): WasherPhysicsResult {
    this.frameCount++
    
    const { subBass, texture, energy, bass, clarity = 0.5, bpm = 120 } = input
    
    // ─────────────────────────────────────────────────────────────────────
    // 1. DETERMINAR MODO SEGÚN TEXTURA
    // ─────────────────────────────────────────────────────────────────────
    const mode = this.determineMode(texture, energy)
    
    // ─────────────────────────────────────────────────────────────────────
    // 2. DETECTAR IMPACTO DE BASS (para REACTIVE_STROBE)
    // ─────────────────────────────────────────────────────────────────────
    const { impactActive, impactIntensity } = this.detectImpact(bass)
    
    // ─────────────────────────────────────────────────────────────────────
    // 3. CALCULAR FACTOR DE RESPIRACIÓN (para BREATHING_WALL)
    // ─────────────────────────────────────────────────────────────────────
    const breathingFactor = this.calculateBreathing(bpm, subBass)
    
    // ─────────────────────────────────────────────────────────────────────
    // 4. CALCULAR INTENSIDAD SEGÚN MODO
    // ─────────────────────────────────────────────────────────────────────
    let intensity: number
    let colorTransitionSpeed: number
    
    if (mode === 'breathing_wall') {
      // BREATHING_WALL: La sala respira
      // Intensidad base = subBass + modulación de respiración
      const breathingMod = breathingFactor * 0.15  // ±15% de variación
      const baseIntensity = this.INTENSITY_FLOOR + subBass * 0.4 + energy * 0.2
      intensity = Math.min(
        this.BREATHING_CEILING,
        Math.max(this.INTENSITY_FLOOR, baseIntensity + breathingMod)
      )
      
      // Transiciones lentas (2 segundos)
      colorTransitionSpeed = this.BREATHING_TRANSITION_TIME
      
    } else if (mode === 'reactive_strobe') {
      // REACTIVE_STROBE: Explosión de color en cada golpe
      if (impactActive) {
        // Golpe detectado: FLASH
        intensity = Math.min(this.STROBE_CEILING, impactIntensity)
        colorTransitionSpeed = this.STROBE_TRANSITION_TIME
      } else {
        // Entre golpes: intensidad base con decay
        const decayedIntensity = this.lastIntensity * 0.9
        intensity = Math.max(this.INTENSITY_FLOOR + subBass * 0.3, decayedIntensity)
        colorTransitionSpeed = 0.3  // Decay moderado
      }
      
    } else {
      // AMBIENT_GLOW: Resplandor constante
      intensity = this.INTENSITY_FLOOR + energy * 0.35
      colorTransitionSpeed = 3.0  // Muy lento
    }
    
    // ─────────────────────────────────────────────────────────────────────
    // 5. SMOOTHING PARA EVITAR SALTOS BRUSCOS
    // ─────────────────────────────────────────────────────────────────────
    // Más suave que otros fixtures - los washers son ATMÓSFERA
    const smoothingFactor = mode === 'reactive_strobe' ? 0.4 : 0.15
    this.lastIntensity = this.lastIntensity * (1 - smoothingFactor) + intensity * smoothingFactor
    
    // ─────────────────────────────────────────────────────────────────────
    // 6. CONSTRUIR RESULTADO
    // ─────────────────────────────────────────────────────────────────────
    return {
      intensity: this.lastIntensity,
      colorTransitionSpeed,
      mode,
      impactActive,
      impactIntensity: this.lastImpactIntensity,
      breathingFactor,
      debugInfo: {
        rawSubBass: subBass,
        rawEnergy: energy,
        textureDetected: texture,
        modeReason: this.getModeReason(mode, texture),
        breathingPhase: this.breathingPhase
      }
    }
  }
  
  /**
   * Reset del estado (útil para cambios de canción)
   */
  public reset(): void {
    this.frameCount = 0
    this.breathingPhase = 0
    this.lastIntensity = this.INTENSITY_FLOOR
    this.lastImpactIntensity = 0
    this.impactCooldown = 0
    this.lastBassValue = 0
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // MÉTODOS PRIVADOS
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Determina el modo de comportamiento según textura y energía
   */
  private determineMode(texture: string, energy: number): WasherMode {
    // REACTIVE_STROBE: Sonido harsh con alta energía
    if (texture === 'harsh' && energy > 0.5) {
      return 'reactive_strobe'
    }
    
    // BREATHING_WALL: Sonido limpio o cálido (la mayoría del tiempo)
    if (texture === 'clean' || texture === 'warm') {
      return 'breathing_wall'
    }
    
    // NOISY con baja energía: Solo ambient glow
    if (texture === 'noisy' && energy < 0.4) {
      return 'ambient_glow'
    }
    
    // Fallback basado en energía
    return energy > 0.6 ? 'reactive_strobe' : 'breathing_wall'
  }
  
  /**
   * Detecta impactos de bass para REACTIVE_STROBE
   * Usa detección de derivada (subida rápida)
   */
  private detectImpact(bass: number): { impactActive: boolean; impactIntensity: number } {
    // Calcular derivada (cambio desde el último frame)
    const bassDerivative = bass - this.lastBassValue
    this.lastBassValue = bass
    
    // Decrementar cooldown
    if (this.impactCooldown > 0) {
      this.impactCooldown--
    }
    
    // Decay de la última intensidad de impacto
    this.lastImpactIntensity *= this.IMPACT_DECAY
    
    // Detectar impacto: bass alto + derivada positiva + sin cooldown
    const isImpact = 
      bass > this.IMPACT_THRESHOLD && 
      bassDerivative > 0.15 && 
      this.impactCooldown === 0
    
    if (isImpact) {
      // ¡IMPACTO!
      this.lastImpactIntensity = Math.min(1.0, bass * 1.2)
      this.impactCooldown = 4  // 4 frames de cooldown (~66ms a 60fps)
      
      return { impactActive: true, impactIntensity: this.lastImpactIntensity }
    }
    
    return { impactActive: false, impactIntensity: this.lastImpactIntensity }
  }
  
  /**
   * Calcula el factor de "respiración" para BREATHING_WALL
   * Onda sinusoidal modulada por BPM y subBass
   */
  private calculateBreathing(bpm: number, subBass: number): number {
    // Período de respiración ajustado al BPM
    // BPM alto = respiración más rápida
    const bpmFactor = Math.max(0.5, Math.min(2.0, bpm / 120))
    const period = this.BREATHING_PERIOD_BASE / bpmFactor
    
    // Convertir frames a segundos (asumiendo 60fps)
    const timeSeconds = this.frameCount / 60
    
    // Actualizar fase (0 a 2π)
    this.breathingPhase = (timeSeconds / period) * Math.PI * 2
    
    // Factor de respiración base (-1 a +1)
    const baseFactor = Math.sin(this.breathingPhase)
    
    // Modulación por subBass: cuando hay subBass, la respiración se profundiza
    const subBassModulation = 1 + subBass * 0.5  // 1.0 a 1.5
    
    return baseFactor * subBassModulation * 0.5  // Escalar a ±0.5 máximo
  }
  
  /**
   * Genera razón del modo para debug
   */
  private getModeReason(mode: WasherMode, texture: string): string {
    switch (mode) {
      case 'breathing_wall':
        return `Texture ${texture} → La sala respira con la música`
      case 'reactive_strobe':
        return `Texture ${texture} + High energy → Explosión de color en cada golpe`
      case 'ambient_glow':
        return `Texture ${texture} + Low energy → Resplandor ambiental constante`
      default:
        return 'Unknown mode'
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════════

export const washerPhysics = new WasherPhysics()
