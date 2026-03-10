/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔥 LATINA MELTDOWN - NUCLEAR SALSA
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * 🌊 WAVE 1004.3: FASE 3 - DNA EXTREMOS
 * 
 * LA BESTIA: Un estrobo sincronizado al KICK que usa paleta latina
 * (Rojo/Amarillo) pero con la AGRESIVIDAD del Techno.
 * 
 * DNA TARGET:
 * - Aggression: 0.95 (BRUTAL - máxima agresión)
 * - Chaos: 0.30 (Rítmico - sincronizado al beat)
 * - Organicity: 0.20 (Sintético - mecánico, preciso)
 * 
 * FILOSOFÍA:
 * "Cuando la salsa se vuelve nuclear. El fuego latino con
 * la precisión de una máquina de guerra."
 * 
 * MECÁNICA:
 * - Estrobo KICK-SYNC (golpea con el bombo)
 * - Colores: Rojo Profundo (10°) → Amarillo Nuclear (55°)
 * - Pre-blackout de 50ms para MÁXIMO contraste
 * - SHORT effect (<2000ms) = PUEDE usar color en movers
 * - Intensidad 100% sin piedad
 * 
 * PERFECT FOR:
 * - Drops de reggaetón pesado
 * - Perreo intenso (BPM ~95-100)
 * - Coros de dembow
 * - Finales explosivos
 * 
 * @module core/effects/library/fiestalatina/LatinaMeltdown
 * @version WAVE 1004.3
 */

import { BaseEffect } from '../../BaseEffect'
import { 
  EffectTriggerConfig, 
  EffectFrameOutput, 
  EffectCategory,
  EffectZone
} from '../../types'

// ═══════════════════════════════════════════════════════════════════════════
// 🔥 CONFIGURATION - NUCLEAR SALSA
// ═══════════════════════════════════════════════════════════════════════════

interface LatinaMeltdownConfig {
  /** Número de golpes nucleares */
  hitCount: number
  
  /** Duración del flash nuclear (ms) */
  flashDurationMs: number
  
  /** Duración del pre-blackout (ms) - contraste forzado */
  preBlackoutMs: number
  
  /** Gap entre golpes (ms) */
  gapMs: number
  
  /** Intensidad máxima del strobe (0-1) */
  maxIntensity: number
  
  /** ¿Alternar colores? */
  alternateColors: boolean
  
  /** 🌊 WAVE 1090: Tiempo de fade in (ms) */
  fadeInMs: number
  
  /** 🌊 WAVE 1090: Tiempo de fade out (ms) */
  fadeOutMs: number
}

const DEFAULT_CONFIG: LatinaMeltdownConfig = {
  hitCount: 6,              // 6 golpes nucleares
  flashDurationMs: 110,     // 🩸 WAVE 2190: 80→110ms — más tiempo ardiendo, más brutal
  preBlackoutMs: 40,        // 🩸 WAVE 2190: 50→40ms — blackout más corto, golpea antes
  gapMs: 100,               // 🩸 WAVE 2190: 120→100ms — menos silencio, más densidad
  maxIntensity: 1.0,        // 100% sin piedad
  alternateColors: true,    // Rojo → Amarillo → Rojo → Amarillo
  fadeInMs: 0,              // 🩸 WAVE 2190: 200→0ms — ATAQUE INMEDIATO, sin carita suave
  fadeOutMs: 400,           // 🩸 WAVE 2190: 600→400ms — salida más corta, el golpe termina seco
}

// Duración total calculada: ~1500ms (SHORT effect - puede usar color en movers)
// (50 + 80 + 120) * 6 = 1500ms

// ═══════════════════════════════════════════════════════════════════════════
// 🎨 PALETA NUCLEAR LATINA
// ═══════════════════════════════════════════════════════════════════════════

const MELTDOWN_PALETTE = {
  // Rojo Profundo - El corazón del fuego
  ROJO_NUCLEAR: { h: 10, s: 100, l: 50 },
  
  // Amarillo Nuclear - La explosión
  AMARILLO_NUCLEAR: { h: 55, s: 100, l: 55 },
  
  // Naranja Fundido - Transición
  NARANJA_FUSION: { h: 30, s: 100, l: 52 },
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔥 LATINA MELTDOWN CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class LatinaMeltdown extends BaseEffect {
  // ─────────────────────────────────────────────────────────────────────────
  // ILightEffect properties
  // ─────────────────────────────────────────────────────────────────────────
  
  readonly effectType = 'latina_meltdown'
  readonly name = 'Latina Meltdown'
  readonly category: EffectCategory = 'physical'
  readonly priority = 95  // MÁXIMA prioridad (strobe brutal)
  readonly mixBus = 'global' as const  // 🚂 Dictador total
  
  // ─────────────────────────────────────────────────────────────────────────
  // Internal state
  // ─────────────────────────────────────────────────────────────────────────
  
  private config: LatinaMeltdownConfig
  private currentHit = 0
  private totalDurationMs = 0
  
  // Estado de la fase actual dentro de un hit
  private hitPhase: 'pre-blackout' | 'flash' | 'gap' = 'pre-blackout'
  private hitPhaseTimer = 0
  
  // ─────────────────────────────────────────────────────────────────────────
  // Constructor
  // ─────────────────────────────────────────────────────────────────────────
  
  constructor(config?: Partial<LatinaMeltdownConfig>) {
    super('latina_meltdown')
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.calculateTotalDuration()
  }
  
  private calculateTotalDuration(): void {
    const hitCycleMs = this.config.preBlackoutMs + 
                       this.config.flashDurationMs + 
                       this.config.gapMs
    this.totalDurationMs = hitCycleMs * this.config.hitCount
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // ILightEffect implementation
  // ─────────────────────────────────────────────────────────────────────────
  
  trigger(config: EffectTriggerConfig): void {
    super.trigger(config)
    
    // GLOBAL - Afecta TODO el escenario
    this.zones = ['front', 'back', 'all-movers']
    
    // Reset state
    this.currentHit = 0
    this.hitPhase = 'pre-blackout'
    this.hitPhaseTimer = 0
    
    console.log(`[LatinaMeltdown 🔥] NUCLEAR ACTIVATED! Hits=${this.config.hitCount} Duration=${this.totalDurationMs}ms`)
    console.log(`[LatinaMeltdown 🔥] DNA: A=0.95 C=0.30 O=0.20 (BRUTAL/RITMICO/SINTETICO)`)
  }
  
  update(deltaMs: number): void {
    if (this.phase === 'idle' || this.phase === 'finished') return
    
    this.elapsedMs += deltaMs
    this.hitPhaseTimer += deltaMs
    
    // Verificar fin del efecto
    if (this.currentHit >= this.config.hitCount) {
      this.phase = 'finished'
      console.log(`[LatinaMeltdown 🔥] MELTDOWN COMPLETE - Nuclear salsa delivered`)
      return
    }
    
    // State machine: pre-blackout → flash → gap → next hit
    this.updateHitPhase()
    
    // Safety timeout
    if (this.elapsedMs > this.totalDurationMs * 1.5) {
      this.phase = 'finished'
    }
  }
  
  private updateHitPhase(): void {
    switch (this.hitPhase) {
      case 'pre-blackout':
        if (this.hitPhaseTimer >= this.config.preBlackoutMs) {
          this.hitPhase = 'flash'
          this.hitPhaseTimer = 0
        }
        break
        
      case 'flash':
        if (this.hitPhaseTimer >= this.config.flashDurationMs) {
          this.hitPhase = 'gap'
          this.hitPhaseTimer = 0
        }
        break
        
      case 'gap':
        if (this.hitPhaseTimer >= this.config.gapMs) {
          // Siguiente hit
          this.currentHit++
          this.hitPhase = 'pre-blackout'
          this.hitPhaseTimer = 0
        }
        break
    }
  }
  
  getOutput(): EffectFrameOutput | null {
    if (this.phase === 'idle' || this.phase === 'finished') return null
    
    const elapsed = this.elapsedMs
    const duration = this.totalDurationMs
    
    // 🌊 WAVE 1090: FLUID DYNAMICS (Latino - suave)
    let fadeOpacity = 1.0
    const fadeOutStart = duration - this.config.fadeOutMs
    if (this.config.fadeInMs > 0 && elapsed < this.config.fadeInMs) {
      fadeOpacity = (elapsed / this.config.fadeInMs) ** 1.5
    } else if (this.config.fadeOutMs > 0 && elapsed > fadeOutStart) {
      fadeOpacity = ((duration - elapsed) / this.config.fadeOutMs) ** 1.5
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🔥 NUCLEAR SALSA OUTPUT
    // ═══════════════════════════════════════════════════════════════════════
    
    let dimmer = 0
    let color = MELTDOWN_PALETTE.ROJO_NUCLEAR
    
    switch (this.hitPhase) {
      case 'pre-blackout':
        // 50ms de NEGRURA total - contraste máximo
        dimmer = 0
        break
        
      case 'flash':
        // EXPLOSIÓN NUCLEAR
        dimmer = this.config.maxIntensity
        
        // Alternar colores si está configurado
        if (this.config.alternateColors) {
          color = this.currentHit % 2 === 0 
            ? MELTDOWN_PALETTE.ROJO_NUCLEAR 
            : MELTDOWN_PALETTE.AMARILLO_NUCLEAR
        }
        break
        
      case 'gap':
        // Oscuridad entre golpes (no total, pero baja)
        dimmer = 0.05  // 5% para no ser negro absoluto
        break
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🩸 WAVE 2190.1: ZONE-COMPLETE DISPATCH — ANTI AUTO-WHITE
    //
    // BUG RAÍZ: El TimelineEngine usa ZONE PATH cuando hay zoneOverrides.
    // ZONE PATH llama dispatchZoneOverrides() y NUNCA dispatchGlobalOutput().
    // Resultado: colorOverride (para PARs) se descartaba silenciosamente.
    // PARs quedaban sin color → physics ponía dimmer > 0 → AUTO-WHITE INJECTION.
    //
    // SOLUCIÓN: TODAS las zonas van en zoneOverrides explícitas.
    // No hay colorOverride global — cada zona se pinta a sí misma.
    // movers → NARANJA_FUSION fijo (sin riesgo Color Wheel)
    // front/back → alternancia Rojo↔Amarillo (RGB safe)
    // ═══════════════════════════════════════════════════════════════════════

    const isSilent = this.hitPhase === 'pre-blackout' || this.hitPhase === 'gap'
    const parsColor = isSilent
      ? { h: 0, s: 0, l: 0 }  // Negro en pre-blackout/gap
      : color                   // Rojo o Amarillo en flash
    const moversColor = isSilent
      ? { h: 0, s: 0, l: 0 }  // Negro en pre-blackout/gap
      : MELTDOWN_PALETTE.NARANJA_FUSION  // DORADO fijo en flash (sin color wheel)

    const zoneOverrides: EffectFrameOutput['zoneOverrides'] = {
      front: {
        color: parsColor,
        dimmer: dimmer,
        blendMode: 'replace',
      },
      back: {
        color: parsColor,
        dimmer: dimmer,
        blendMode: 'replace',
      },
      movers: {
        color: moversColor,
        dimmer: dimmer,
        blendMode: 'replace',
      },
    }

    return {
      effectId: this.id,
      category: this.category,
      phase: this.phase,
      progress: elapsed / duration,
      zones: this.zones,
      intensity: dimmer,

      dimmerOverride: dimmer,
      // 🩸 WAVE 2190.1: colorOverride eliminado — era ignorado por ZONE PATH
      // Toda la autoridad de color vive en zoneOverrides ahora

      zoneOverrides,

      globalComposition: fadeOpacity,  // 🌊 WAVE 1090: FLUID DYNAMICS
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Getters
  // ─────────────────────────────────────────────────────────────────────────
  
  getDurationMs(): number {
    return this.totalDurationMs
  }
  
  getCurrentPhase(): string {
    return this.hitPhase
  }
  
  getCurrentHit(): number {
    return this.currentHit
  }
}

export default LatinaMeltdown

