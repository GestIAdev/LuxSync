/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎯 VIBE MOVEMENT MANAGER - WAVE 343: OPERATION CLEAN SLATE
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * RESPONSABILIDAD ÚNICA: Generación de patrones de movimiento
 * 
 * Este módulo centraliza TODA la matemática de trayectorias:
 * - Lissajous (Figure8)
 * - Sweep (barrido horizontal)
 * - Wave (ondulación)
 * - Mirror (espejo techno)
 * - Chase (persecución láser)
 * - Circle (rotación suave)
 * - Static (respiración zen)
 * 
 * ARQUITECTURA:
 * 
 *   TitanEngine (ORQUESTADOR)
 *        │
 *        │  "Dame movimiento para Latino con energy 0.7"
 *        ▼
 *   VibeMovementManager (ARTISTA)
 *        │
 *        │  Retorna: { x: -0.3, y: 0.2 } (coordenadas abstractas)
 *        ▼
 *   FixturePhysicsDriver (FÍSICO)
 *        │
 *        │  Aplica: límites, inercia, rev limiter
 *        ▼
 *   DMX Hardware (REALIDAD)
 * 
 * UNIDADES DE SALIDA:
 * - x, y: -1.0 a +1.0 (coordenadas normalizadas)
 * - -1 = izquierda/arriba extremo
 * -  0 = centro
 * - +1 = derecha/abajo extremo
 * 
 * @layer ENGINE/MOVEMENT
 * @version WAVE 343 - Operation Clean Slate
 */

import { MOVEMENT_PRESETS, getMovementPreset } from './VibeMovementPresets'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Resultado de generación de movimiento */
export interface MovementIntent {
  /** Posición X normalizada (-1 a +1) */
  x: number
  /** Posición Y normalizada (-1 a +1) */
  y: number
  /** Patrón activo */
  pattern: string
  /** Velocidad normalizada (0-1) */
  speed: number
  /** Amplitud del movimiento (0-1) */
  amplitude: number
  /** Debug: frecuencia usada */
  _frequency?: number
}

/** Contexto de audio para generación de movimiento */
export interface AudioContext {
  /** Energía general (0-1) */
  energy: number
  /** Nivel de bass (0-1) */
  bass: number
  /** Nivel de mids (0-1) */
  mids: number
  /** Nivel de highs (0-1) */
  highs: number
  /** BPM detectado */
  bpm: number
  /** Fase del beat (0-1) */
  beatPhase: number
}

/** Configuración de patrón por vibe */
interface PatternConfig {
  pattern: string
  frequency: number        // Hz base (independiente del BPM)
  amplitudeBase: number    // Amplitud base (0-1)
  amplitudeEnergy: number  // Cuánto afecta energy a la amplitud
  phaseOffset: boolean     // ¿Aplicar desfase per-fixture?
}

// ═══════════════════════════════════════════════════════════════════════════
// PATTERN CONFIGURATIONS POR VIBE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🎨 CONFIGURACIÓN DE PATRONES POR VIBE
 * 
 * Cada vibe tiene su "coreografía" característica:
 * - Patrón geométrico (qué forma dibuja)
 * - Frecuencia fija (velocidad de la forma)
 * - Amplitud (qué tan grande es el movimiento)
 * - Phase offset (si los movers van desfasados)
 */
const VIBE_PATTERN_CONFIG: Record<string, PatternConfig> = {
  // 💃 LATINO: Figure8 (Lissajous) - Caderas de cumbia
  'fiesta-latina': {
    pattern: 'figure8',
    frequency: 0.1,          // 1 ciclo cada 10 segundos (ultra suave)
    amplitudeBase: 0.75,     // Movimiento amplio
    amplitudeEnergy: 0.25,   // +25% con energía máxima
    phaseOffset: true,       // Snake effect
  },
  
  // 🎛️ TECHNO: Mirror - Puertas del infierno
  'techno-club': {
    pattern: 'mirror',
    frequency: 0.4,          // 1 ciclo cada 2.5 segundos (agresivo)
    amplitudeBase: 0.6,
    amplitudeEnergy: 0.35,
    phaseOffset: false,      // No desfase, pero sí inversión L/R
  },
  
  // 🎸 ROCK: Wave - Wall of light
  'pop-rock': {
    pattern: 'wave',
    frequency: 0.15,         // Moderado
    amplitudeBase: 0.5,
    amplitudeEnergy: 0.4,
    phaseOffset: true,
  },
  
  // 🍸 CHILL: Circle - Ola de mar
  'chill-lounge': {
    pattern: 'circle',
    frequency: 0.05,         // Ultra lento (1 rotación cada 20s)
    amplitudeBase: 0.45,
    amplitudeEnergy: 0.15,
    phaseOffset: true,
  },
  
  // 💤 IDLE: Static - Respiración zen
  'idle': {
    pattern: 'static',
    frequency: 0.1,
    amplitudeBase: 0.1,
    amplitudeEnergy: 0.1,
    phaseOffset: false,
  },
}

// ═══════════════════════════════════════════════════════════════════════════
// VIBE MOVEMENT MANAGER
// ═══════════════════════════════════════════════════════════════════════════

export class VibeMovementManager {
  private time: number = 0
  private lastUpdate: number = Date.now()
  private frameCount: number = 0
  
  /**
   * 🎯 GENERA INTENT DE MOVIMIENTO
   * 
   * Esta es la función principal que TitanEngine debe llamar.
   * Reemplaza TODO el switch hardcoded de patterns.
   * 
   * @param vibeId ID del vibe actual (ej: 'fiesta-latina')
   * @param audio Contexto de audio actual
   * @returns MovementIntent con coordenadas normalizadas (-1 a +1)
   */
  generateIntent(vibeId: string, audio: AudioContext): MovementIntent {
    // Actualizar tiempo interno
    const now = Date.now()
    const deltaTime = (now - this.lastUpdate) / 1000
    this.lastUpdate = now
    this.time += deltaTime
    this.frameCount++
    
    // Obtener configuración del vibe
    const config = VIBE_PATTERN_CONFIG[vibeId] || VIBE_PATTERN_CONFIG['idle']
    const preset = getMovementPreset(vibeId)
    
    // Calcular amplitud final (base + energy boost)
    const amplitude = config.amplitudeBase + audio.energy * config.amplitudeEnergy
    
    // Si hay muy poca energía y el vibe permite home en silencio, reducir movimiento
    const silenceThreshold = preset.behavior.homeOnSilence ? 0.05 : 0.01
    if (audio.energy < silenceThreshold) {
      return {
        x: 0,
        y: 0,
        pattern: config.pattern,
        speed: 0,
        amplitude: 0,
        _frequency: 0,
      }
    }
    
    // Generar posición según el patrón
    const position = this.generatePattern(
      config.pattern,
      this.time,
      config.frequency,
      amplitude,
      audio
    )
    
    // Log cada ~500ms para debug
    if (this.frameCount % 30 === 0) {
      const panDeg = Math.round(position.x * 270)  // ±270° típico
      const tiltDeg = Math.round(position.y * 135) // ±135° típico
      console.log(`[🎯 VMM] ${vibeId} | ${config.pattern} @ ${config.frequency}Hz | E:${audio.energy.toFixed(2)} | Pan:${panDeg}° Tilt:${tiltDeg}°`)
    }
    
    return {
      x: position.x,
      y: position.y,
      pattern: config.pattern,
      speed: config.frequency,
      amplitude,
      _frequency: config.frequency,
    }
  }
  
  /**
   * 🔧 GENERA POSICIÓN SEGÚN PATRÓN
   * 
   * Toda la matemática de patterns vive AQUÍ.
   * 
   * @param pattern Tipo de patrón
   * @param time Tiempo en segundos
   * @param frequency Frecuencia en Hz
   * @param amplitude Amplitud (0-1)
   * @param audio Contexto de audio
   * @returns Posición {x, y} en rango -1 a +1
   */
  private generatePattern(
    pattern: string,
    time: number,
    frequency: number,
    amplitude: number,
    audio: AudioContext
  ): { x: number; y: number } {
    const t = time
    const f = frequency
    const a = amplitude
    const phase = Math.PI * 2 * f * t
    
    switch (pattern) {
      // ═══════════════════════════════════════════════════════════════════
      // 💃 FIGURE8: Curva de Lissajous (Pan 1x, Tilt 2x)
      // Crea la figura 8 que es perfecta para cumbia/salsa
      // ═══════════════════════════════════════════════════════════════════
      case 'figure8':
        return {
          x: Math.sin(phase) * a,
          y: Math.sin(phase * 2) * a * 0.5,  // Doble frecuencia, mitad amplitud
        }
      
      // ═══════════════════════════════════════════════════════════════════
      // 💫 CIRCLE: Rotación suave
      // Ideal para chill/lounge, ola de mar
      // ═══════════════════════════════════════════════════════════════════
      case 'circle':
        return {
          x: Math.cos(phase) * a,
          y: Math.sin(phase) * a * 0.5,  // Elipse más que círculo perfecto
        }
      
      // ═══════════════════════════════════════════════════════════════════
      // 🌊 WAVE: Ondulación lateral con respiración vertical
      // Pink Floyd vibes
      // ═══════════════════════════════════════════════════════════════════
      case 'wave':
        return {
          x: Math.sin(phase) * a * 0.6,
          y: Math.sin(phase * 0.5) * a * 0.25,  // Más lento en vertical
        }
      
      // ═══════════════════════════════════════════════════════════════════
      // 🏃 SWEEP: Barrido horizontal puro
      // ═══════════════════════════════════════════════════════════════════
      case 'sweep':
        return {
          x: Math.sin(phase) * a,
          y: audio.bass * 0.2 - 0.1,  // Tilt sigue el bass
        }
      
      // ═══════════════════════════════════════════════════════════════════
      // 🪞 MIRROR: Oscilación para puertas del infierno
      // El efecto espejo (LEFT vs RIGHT) lo aplica HAL, no aquí
      // Aquí solo generamos la base que será invertida
      // ═══════════════════════════════════════════════════════════════════
      case 'mirror':
        // PAN: Oscilación lateral
        const mirrorX = Math.sin(phase) * a
        
        // TILT: Doble movimiento (búsqueda + bass punch)
        const tiltOsc = Math.sin(phase * 2) * 0.2
        const bassPunch = Math.pow(audio.bass, 3) * 0.35
        const mirrorY = tiltOsc - bassPunch
        
        return { x: mirrorX, y: mirrorY }
      
      // ═══════════════════════════════════════════════════════════════════
      // 🏃 CHASE: Persecución láser (rápido)
      // ═══════════════════════════════════════════════════════════════════
      case 'chase':
        return {
          x: Math.sin(phase * 2) * a,  // Doble velocidad
          y: audio.bass * 0.15 - 0.075,
        }
      
      // ═══════════════════════════════════════════════════════════════════
      // 🧘 STATIC: Respiración zen
      // Micro-movimiento casi imperceptible
      // ═══════════════════════════════════════════════════════════════════
      case 'static':
        return {
          x: 0,
          y: Math.sin(phase) * 0.03 + audio.bass * 0.06,
        }
      
      // ═══════════════════════════════════════════════════════════════════
      // 💓 PULSE: Pulso hacia centro en cada beat
      // ═══════════════════════════════════════════════════════════════════
      case 'pulse':
        const beatDecay = Math.pow(1 - audio.beatPhase, 3)
        return {
          x: 0,
          y: -beatDecay * a * 0.4,
        }
      
      // ═══════════════════════════════════════════════════════════════════
      // 🎲 RANDOM: Posición pseudo-random (determinista)
      // ═══════════════════════════════════════════════════════════════════
      case 'random':
        // Usar sin/cos con primos para parecer random pero ser determinista
        const rx = Math.sin(t * 0.7919) * a * 0.4
        const ry = Math.cos(t * 0.5711) * a * 0.2
        return { x: rx, y: ry }
      
      // ═══════════════════════════════════════════════════════════════════
      // DEFAULT: Fallback a static
      // ═══════════════════════════════════════════════════════════════════
      default:
        console.warn(`[VMM] Pattern desconocido: "${pattern}", usando static`)
        return { x: 0, y: audio.energy * 0.15 }
    }
  }
  
  /**
   * 📊 Obtener configuración de patrón para un vibe
   * Útil para debug o UI
   */
  getPatternConfig(vibeId: string): PatternConfig {
    return VIBE_PATTERN_CONFIG[vibeId] || VIBE_PATTERN_CONFIG['idle']
  }
  
  /**
   * 🔄 Reset del tiempo interno
   * Llamar cuando cambia el vibe para empezar patrón desde el inicio
   */
  resetTime(): void {
    this.time = 0
    this.lastUpdate = Date.now()
  }
  
  /**
   * ⏱️ Obtener tiempo actual del manager
   */
  getTime(): number {
    return this.time
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON EXPORT
// ═══════════════════════════════════════════════════════════════════════════

/** Instancia singleton del manager */
export const vibeMovementManager = new VibeMovementManager()

/** Export default para uso directo */
export default vibeMovementManager
