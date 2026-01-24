/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧱 BASE EFFECT - THE FOUNDATION
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 680: THE ARSENAL & THE SHIELD
 * 
 * Clase abstracta base para todos los efectos.
 * Provee helpers comunes para que los efectos "respiren" con la música.
 * 
 * HELPERS PROVISTOS:
 * - getIntensityFromZScore(): Escala intensidad según momento musical
 * - getBpmPulse(): Pulso sincronizado al BPM
 * - getPhaseOffset(): Offset de fase para efectos secuenciales
 * 
 * @module core/effects/BaseEffect
 * @version WAVE 680
 */

import { 
  ILightEffect, 
  EffectTriggerConfig, 
  EffectFrameOutput, 
  EffectPhase,
  EffectCategory,
  EffectZone,
  MusicalContext
} from './types'

// ═══════════════════════════════════════════════════════════════════════════
// BASE EFFECT ABSTRACT CLASS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🧱 BASE EFFECT
 * 
 * Todos los efectos heredan de aquí.
 * Implementa ILightEffect y provee helpers comunes.
 */
export abstract class BaseEffect implements ILightEffect {
  // ─────────────────────────────────────────────────────────────────────────
  // ILightEffect required properties (abstract - hijo debe definir)
  // ─────────────────────────────────────────────────────────────────────────
  
  abstract readonly effectType: string
  abstract readonly name: string
  abstract readonly category: EffectCategory
  abstract readonly priority: number
  
  // ─────────────────────────────────────────────────────────────────────────
  // 🚂 WAVE 800: RAILWAY SWITCH - Mix Bus Declaration
  // 
  // 'htp' = High Takes Precedence - Se mezcla con física (aditivo)
  // 'global' = Global Override - Ignora física (dictador)
  // 
  // Default: 'htp' - Los efectos suman por defecto
  // Los efectos que necesitan "silencio" deben sobrescribir con 'global'
  // ─────────────────────────────────────────────────────────────────────────
  readonly mixBus: 'htp' | 'global' = 'htp'
  
  // ─────────────────────────────────────────────────────────────────────────
  // Common state (protected - hijos pueden acceder)
  // ─────────────────────────────────────────────────────────────────────────
  
  readonly id: string
  protected phase: EffectPhase = 'idle'
  protected elapsedMs = 0
  protected triggerIntensity = 1.0
  protected zones: EffectZone[] = ['all']
  protected source: string = 'unknown'
  protected musicalContext: MusicalContext | null = null
  
  // ─────────────────────────────────────────────────────────────────────────
  // 👻 WAVE 999: ZOMBIE STATE (Release Phase)
  // Cuando un efecto "termina", no muere inmediatamente.
  // Entra en estado ZOMBIE durante releaseMs para hacer fade-out elegante.
  // ─────────────────────────────────────────────────────────────────────────
  
  /** ¿Está el efecto en fase de release (zombie)? */
  private _isReleasing = false
  
  /** Duración del release en ms */
  private _releaseDurationMs = 500
  
  /** Tiempo transcurrido en release */
  private _releaseElapsedMs = 0
  
  /** ¿Ha completado el release? (muerte real) */
  private _releaseComplete = false
  
  // ─────────────────────────────────────────────────────────────────────────
  // Constructor
  // ─────────────────────────────────────────────────────────────────────────
  
  constructor(idPrefix: string) {
    this.id = `${idPrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // ILightEffect implementation (base)
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * 🎯 TRIGGER - Base implementation
   * Los hijos pueden override para lógica adicional
   */
  trigger(config: EffectTriggerConfig): void {
    this.phase = 'attack'
    this.elapsedMs = 0
    this.triggerIntensity = config.intensity
    this.zones = config.zones || ['all']
    this.source = config.source
    this.musicalContext = config.musicalContext || null
  }
  
  /**
   * 🔄 UPDATE - Abstract, hijo debe implementar
   */
  abstract update(deltaMs: number): void
  
  /**
   * 📤 GET OUTPUT - Abstract, hijo debe implementar
   */
  abstract getOutput(): EffectFrameOutput | null
  
  /**
   * ❓ IS FINISHED
   */
  isFinished(): boolean {
    return this.phase === 'finished'
  }
  
  /**
   * ⛔ ABORT
   */
  abort(): void {
    this.phase = 'finished'
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // 👻 WAVE 999: ZOMBIE STATE (Release Phase) - THE SILK PROTOCOL
  // "El Fantasma de la Ópera" - Fade-Out obligatorio para transiciones suaves
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * 👻 START RELEASE - Inicia el fade-out zombie
   * 
   * Llamado por EffectManager cuando el efecto termina su duración natural.
   * El efecto NO muere inmediatamente - entra en estado ZOMBIE.
   * 
   * @param durationMs Duración del fade-out (default: 500ms)
   */
  startRelease(durationMs = 500): void {
    if (this._isReleasing) return // Ya en release
    
    this._isReleasing = true
    this._releaseDurationMs = durationMs
    this._releaseElapsedMs = 0
    this._releaseComplete = false
    
    console.log(`[👻 ZOMBIE] ${this.effectType} entering release phase (${durationMs}ms fade-out)`)
  }
  
  /**
   * 👻 FORCE FADE OUT - Eyección de emergencia (válvula de presión)
   * 
   * Llamado cuando el efecto está "fuera de lugar" por cambio de energía.
   * Fade-out más rápido que el release natural.
   * 
   * @param durationMs Duración del fade-out rápido (default: 200ms)
   */
  forceFadeOut(durationMs = 200): void {
    if (this._releaseComplete) return // Ya muerto
    
    // Si ya estaba en release, acortar el tiempo restante
    if (this._isReleasing) {
      const remaining = this._releaseDurationMs - this._releaseElapsedMs
      if (durationMs < remaining) {
        this._releaseDurationMs = this._releaseElapsedMs + durationMs
      }
    } else {
      this.startRelease(durationMs)
    }
    
    console.log(`[⏏️ EJECT] ${this.effectType} force fade-out (${durationMs}ms)`)
  }
  
  /**
   * 👻 UPDATE RELEASE - Actualiza el estado zombie
   * 
   * Llamado internamente durante update() si está en release.
   * 
   * @param deltaMs Tiempo desde último frame
   */
  protected updateRelease(deltaMs: number): void {
    if (!this._isReleasing) return
    
    this._releaseElapsedMs += deltaMs
    
    if (this._releaseElapsedMs >= this._releaseDurationMs) {
      this._releaseComplete = true
      this.phase = 'finished'
      console.log(`[👻 ZOMBIE] ${this.effectType} release complete - TRUE DEATH`)
    }
  }
  
  /**
   * 👻 GET RELEASE MULTIPLIER - Multiplicador de dimmer durante release
   * 
   * Retorna un valor 1.0 → 0.0 durante el fade-out.
   * Usa curva exponencial para fade más natural.
   * 
   * @returns Multiplicador 0-1 para aplicar al dimmer
   */
  getReleaseMultiplier(): number {
    if (!this._isReleasing) return 1.0
    if (this._releaseComplete) return 0.0
    
    const progress = this._releaseElapsedMs / this._releaseDurationMs
    // Curva exponencial: más rápido al principio, más suave al final
    // 1 - progress^2 da una curva más natural que lineal
    return Math.max(0, 1 - Math.pow(progress, 2))
  }
  
  /**
   * 👻 IS RELEASING - ¿Está en estado zombie?
   */
  get isReleasing(): boolean {
    return this._isReleasing
  }
  
  /**
   * 👻 IS RELEASE COMPLETE - ¿Ha terminado el fade-out?
   */
  get releaseComplete(): boolean {
    return this._releaseComplete
  }
  
  /**
   * 📊 GET PHASE
   */
  getPhase(): EffectPhase {
    return this.phase
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // 🎵 MUSICAL HELPERS - El alma que respira
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * 📈 GET INTENSITY FROM Z-SCORE
   * 
   * Escala la intensidad según el momento musical.
   * 
   * @param base Intensidad base (0-1)
   * @param scale Factor de escala del zScore (default: 0.3)
   * @returns Intensidad ajustada (0-1)
   * 
   * Ejemplos:
   * - Silencio (Z=0): base * 0.7
   * - Normal (Z=1.5): base * 1.0
   * - Drop (Z=3.5): base * 1.3 (capped at 1.0)
   */
  protected getIntensityFromZScore(base: number, scale = 0.3): number {
    if (!this.musicalContext) return base
    
    const z = this.musicalContext.zScore
    // Normalizar Z: 1.5 = neutral, <1.5 reduce, >1.5 amplifica
    const zFactor = 1 + (z - 1.5) * scale
    return Math.min(1.0, Math.max(0.0, base * zFactor))
  }
  
  /**
   * 🥁 GET BPM PULSE
   * 
   * Genera un pulso sincronizado al BPM.
   * 
   * @param divisor Divisor del beat (1=beat, 2=half, 4=quarter)
   * @returns Valor 0-1 donde 0=downbeat, 1=upbeat
   */
  protected getBpmPulse(divisor = 1): number {
    if (!this.musicalContext || this.musicalContext.bpm <= 0) return 0.5
    
    const msPerBeat = 60000 / this.musicalContext.bpm
    const msPerPulse = msPerBeat / divisor
    
    // Usar beatPhase si disponible, sino calcular con elapsed
    if (this.musicalContext.beatPhase !== undefined) {
      return (this.musicalContext.beatPhase * divisor) % 1
    }
    
    // Fallback: usar tiempo elapsed (menos preciso)
    return (this.elapsedMs % msPerPulse) / msPerPulse
  }
  
  /**
   * 🌊 GET SINUSOIDAL PULSE
   * 
   * Pulso sinusoidal suave para efectos orgánicos.
   * 
   * @param periodMs Periodo en milisegundos
   * @param phaseOffset Offset de fase (0-1)
   * @returns Valor 0-1 en forma de onda sinusoidal
   */
  protected getSinePulse(periodMs: number, phaseOffset = 0): number {
    const phase = ((this.elapsedMs / periodMs) + phaseOffset) % 1
    // Sin(-PI/2) starts at 0, sin(PI/2) = 1, normalizado a 0-1
    return (Math.sin((phase - 0.25) * Math.PI * 2) + 1) / 2
  }
  
  /**
   * 📐 GET PHASE OFFSET FOR ZONE
   * 
   * Calcula offset de fase para efectos de ola/secuencia.
   * 
   * @param zone Zona del efecto
   * @param totalZones Número total de zonas
   * @returns Offset 0-1
   */
  protected getZonePhaseOffset(zone: EffectZone, totalZones = 4): number {
    const zoneOrder: Record<EffectZone, number> = {
      'front': 0,
      'pars': 1,
      'back': 2,
      'movers': 3,
      'movers_left': 3,   // 🤖 WAVE 810: L/R tienen mismo orden que movers
      'movers_right': 3,
      'all': 0,
    }
    return (zoneOrder[zone] || 0) / totalZones
  }
  
  /**
   * ⚡ GET ENERGY FACTOR
   * 
   * Factor multiplicador basado en energía del audio.
   * 
   * @param minFactor Factor mínimo cuando energía es 0
   * @param maxFactor Factor máximo cuando energía es 1
   * @returns Factor entre min y max
   */
  protected getEnergyFactor(minFactor = 0.5, maxFactor = 1.0): number {
    if (!this.musicalContext) return (minFactor + maxFactor) / 2
    
    const energy = this.musicalContext.energy
    return minFactor + (maxFactor - minFactor) * energy
  }
  
  /**
   * 🎯 GET CURRENT BPM
   * 
   * Obtiene el BPM actual o un fallback.
   */
  protected getCurrentBpm(fallback = 120): number {
    return this.musicalContext?.bpm || fallback
  }
  
  /**
   * 📊 IS IN DROP
   * 
   * ¿Estamos actualmente en un drop/climax?
   */
  protected isInDrop(): boolean {
    return this.musicalContext?.inDrop ?? false
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // 🎨 COLOR HELPERS
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * 🎨 RGB to HSL conversion
   * 
   * @param r Red 0-255
   * @param g Green 0-255  
   * @param b Blue 0-255
   * @returns HSL object {h: 0-360, s: 0-100, l: 0-100}
   */
  protected rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
    const rn = r / 255
    const gn = g / 255
    const bn = b / 255
    
    const max = Math.max(rn, gn, bn)
    const min = Math.min(rn, gn, bn)
    const l = (max + min) / 2
    
    let h = 0
    let s = 0
    
    if (max !== min) {
      const d = max - min
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
      
      if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6
      else if (max === gn) h = ((bn - rn) / d + 2) / 6
      else h = ((rn - gn) / d + 4) / 6
    }
    
    return {
      h: h * 360,
      s: s * 100,
      l: l * 100
    }
  }
  
  /**
   * 🎨 HSL to RGB conversion
   */
  protected hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
    const sn = s / 100
    const ln = l / 100
    const hn = h / 360
    
    if (sn === 0) {
      const v = Math.round(ln * 255)
      return { r: v, g: v, b: v }
    }
    
    const hue2rgb = (p: number, q: number, t: number): number => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1/6) return p + (q - p) * 6 * t
      if (t < 1/2) return q
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
      return p
    }
    
    const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn
    const p = 2 * ln - q
    
    return {
      r: Math.round(hue2rgb(p, q, hn + 1/3) * 255),
      g: Math.round(hue2rgb(p, q, hn) * 255),
      b: Math.round(hue2rgb(p, q, hn - 1/3) * 255)
    }
  }
  
  /**
   * 🔀 INTERPOLATE VALUES
   * 
   * Interpola linealmente entre dos valores.
   */
  protected lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t
  }
  
  /**
   * 📐 EASE IN OUT CUBIC
   * 
   * Curva de aceleración/desaceleración suave.
   */
  protected easeInOutCubic(t: number): number {
    return t < 0.5 
      ? 4 * t * t * t 
      : 1 - Math.pow(-2 * t + 2, 3) / 2
  }
}
