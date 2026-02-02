/**
 * ☀️ SOLAR CAUSTICS - Rayos de Sol Descendiendo en SHALLOWS (0-1000m)
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 1073: OCEANIC CALIBRATION - Desplazamiento REAL estilo TidalWave
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * CONCEPTO ARTÍSTICO:
 * Rayos de luz solar penetrando el agua desde la superficie,
 * descendiendo LENTAMENTE desde los movers (arriba) hacia el front (fondo).
 * 
 * ZONAS (de arriba a abajo - DESPLAZAMIENTO VERTICAL):
 *  - MOVERS: Superficie del agua - donde entran los rayos (100% intensidad)
 *  - BACK: Zona media del agua (80% intensidad, ligeramente disperso)
 *  - FRONT: Fondo oceánico (60% intensidad, disperso y tenue)
 * 
 * MECÁNICA WAVE 1073:
 * - DESPLAZAMIENTO VERTICAL: Inspirado en TidalWave pero LENTO (chill)
 * - 2 RAYOS ESTÉREO: L y R con desfase temporal
 * - CRUCE DIAGONAL: El rayo puede cruzar de L a R durante el descenso
 * - mixBus='global' + blendMode='replace': El rayo MANDA (override completo)
 * - Movimiento de movers ULTRA LENTO (protección movers chinos)
 * 
 * HSL FORMAT: h(0-360), s(0-100), l(0-100)
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { BaseEffect } from '../../BaseEffect'
import { EffectTriggerConfig, EffectFrameOutput, EffectCategory } from '../../types'

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════════════════

interface SolarCausticsConfig {
  /** Duración total del efecto en ms */
  durationMs: number
  /** Intensidad máxima del rayo (0-1) */
  peakIntensity: number
  /** Desfase entre rayo L y R en ms */
  rayOffsetMs: number
  /** Probabilidad de cruce diagonal (0-1) */
  crossProbability: number
  /** Duración del descenso de un rayo en ms */
  rayDescentMs: number
}

const DEFAULT_CONFIG: SolarCausticsConfig = {
  durationMs: 6500,           // 🌊 WAVE 1073.2: 6.5s (ajustado a rayDescentsMs + overlap)
  peakIntensity: 0.95,        // 🌊 WAVE 1073.1: Subido de 0.70 a 0.95 (necesita más punch con global)
  rayOffsetMs: 1200,          // 🌊 WAVE 1073.2: 1.2s desfase (más overlap visual)
  crossProbability: 0.35,     // 35% de probabilidad de cruce diagonal
  rayDescentMs: 5000,         // 🌊 WAVE 1073.2: 5 segundos por rayo (duración=1200+5000=6200 + margen)
}

// ═══════════════════════════════════════════════════════════════════════════
// COLORES DE LUZ SOLAR SUBMARINA
// ═══════════════════════════════════════════════════════════════════════════

const SUNLIGHT_COLORS = {
  // En superficie: dorado brillante
  surface: { h: 48, s: 90, l: 65 },
  // En zona media: ámbar más suave
  middle: { h: 44, s: 82, l: 58 },
  // En el fondo: dorado pálido disperso
  deep: { h: 50, s: 70, l: 50 },
}

// ═══════════════════════════════════════════════════════════════════════════
// ESTRUCTURA DE UN RAYO
// ═══════════════════════════════════════════════════════════════════════════

interface SunRay {
  /** Identificador del rayo */
  id: 'L' | 'R'
  /** Tiempo de inicio del rayo (relativo al efecto) */
  startMs: number
  /** ¿Cruza de un lado al otro? */
  crosses: boolean
  /** Lado de inicio si cruza */
  startSide: 'L' | 'R'
}

// ═══════════════════════════════════════════════════════════════════════════
// CLASE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

export class SolarCaustics extends BaseEffect {
  readonly effectType = 'solar_caustics'
  readonly name = 'Solar Caustics'
  readonly category: EffectCategory = 'physical'
  readonly priority = 68
  readonly mixBus = 'global' as const  // 🌊 WAVE 1073: GLOBAL = Override completo (como TidalWave)
  
  private config: SolarCausticsConfig
  private rays: SunRay[] = []
  
  constructor(config?: Partial<SolarCausticsConfig>) {
    super('solar_caustics')
    this.config = { ...DEFAULT_CONFIG, ...config }
  }
  
  /**
   * 🎬 TRIGGER - Configura los 2 rayos con sus características
   */
  trigger(triggerConfig: EffectTriggerConfig): void {
    super.trigger(triggerConfig)
    
    // Decidir si cada rayo cruza (basado en timestamp para determinismo)
    const now = Date.now()
    const rayLCrosses = (now % 100) < (this.config.crossProbability * 100)
    const rayRCrosses = ((now + 37) % 100) < (this.config.crossProbability * 100)
    
    // Configurar los 2 rayos
    this.rays = [
      {
        id: 'L',
        startMs: 0,                               // El rayo L empieza inmediatamente
        crosses: rayLCrosses,
        startSide: 'L',                           // Empieza en la izquierda
      },
      {
        id: 'R',
        startMs: this.config.rayOffsetMs,        // El rayo R empieza con delay
        crosses: rayRCrosses,
        startSide: 'R',                           // Empieza en la derecha
      },
    ]
    
    const crossInfo = [
      rayLCrosses ? 'L→R' : 'L',
      rayRCrosses ? 'R→L' : 'R',
    ].join(', ')
    
    console.log(`[CAUSTICS ☀️] 2 rays descending: ${crossInfo}`)
  }

  /**
   * 🔄 UPDATE - Avanza el tiempo del efecto
   */
  update(deltaMs: number): void {
    if (this.phase === 'idle' || this.phase === 'finished') return
    this.elapsedMs += deltaMs
    if (this.elapsedMs >= this.config.durationMs) {
      this.phase = 'finished'
    }
  }
  
  /**
   * 🌊 Calcula la profundidad de descenso de un rayo (0=superficie, 1=fondo)
   */
  private getRayDepth(rayStartMs: number): number {
    const rayElapsed = this.elapsedMs - rayStartMs
    if (rayElapsed < 0) return -1  // Rayo no ha empezado
    
    const descent = Math.min(rayElapsed / this.config.rayDescentMs, 1)
    return descent
  }
  
  /**
   * 💡 Calcula la intensidad de un rayo en una zona específica
   * Fade-in rápido, fade-out lento (dispersión en agua)
   */
  private getZoneIntensity(
    rayDepth: number,
    zoneDepth: number,
    zoneAttenuation: number
  ): number {
    if (rayDepth < 0) return 0  // Rayo no ha empezado
    
    const frontWidth = 0.35  // Ancho del frente del rayo
    const distance = rayDepth - zoneDepth
    
    let intensity: number
    if (distance < -frontWidth) {
      intensity = 0
    } else if (distance < 0) {
      // Fade-in rápido
      const fadeIn = 1 - Math.abs(distance) / frontWidth
      intensity = fadeIn ** 0.8
    } else if (distance < frontWidth * 2) {
      // Fade-out lento (dispersión en agua)
      const fadeOut = 1 - (distance / (frontWidth * 2))
      intensity = fadeOut ** 1.5
    } else {
      intensity = 0
    }
    
    return intensity * zoneAttenuation
  }
  
  /**
   * 🎨 Obtiene el color para una profundidad específica
   */
  private getColorForDepth(depth: number): { h: number; s: number; l: number } {
    if (depth < 0.4) {
      const t = depth / 0.4
      return {
        h: SUNLIGHT_COLORS.surface.h + (SUNLIGHT_COLORS.middle.h - SUNLIGHT_COLORS.surface.h) * t,
        s: SUNLIGHT_COLORS.surface.s + (SUNLIGHT_COLORS.middle.s - SUNLIGHT_COLORS.surface.s) * t,
        l: SUNLIGHT_COLORS.surface.l + (SUNLIGHT_COLORS.middle.l - SUNLIGHT_COLORS.surface.l) * t,
      }
    } else {
      const t = (depth - 0.4) / 0.6
      return {
        h: SUNLIGHT_COLORS.middle.h + (SUNLIGHT_COLORS.deep.h - SUNLIGHT_COLORS.middle.h) * t,
        s: SUNLIGHT_COLORS.middle.s + (SUNLIGHT_COLORS.deep.s - SUNLIGHT_COLORS.middle.s) * t,
        l: SUNLIGHT_COLORS.middle.l + (SUNLIGHT_COLORS.deep.l - SUNLIGHT_COLORS.middle.l) * t,
      }
    }
  }
  
  /**
   * 📤 GET OUTPUT - Genera el frame de salida
   */
  getOutput(): EffectFrameOutput | null {
    if (this.phase === 'idle' || this.phase === 'finished') return null
    
    const progress = this.elapsedMs / this.config.durationMs
    
    // Envelope global
    let globalEnvelope: number
    if (progress < 0.15) {
      globalEnvelope = (progress / 0.15) ** 1.5
    } else if (progress > 0.85) {
      globalEnvelope = ((1 - progress) / 0.15) ** 1.5
    } else {
      globalEnvelope = 1.0
    }
    
    // Profundidades y atenuaciones de las zonas
    // 🌊 WAVE 1073.1: Subidas las atenuaciones para más visibilidad
    const ZONE_DEPTHS = { movers: 0.0, back: 0.45, front: 1.0 }
    const ZONE_ATTENUATION = { movers: 1.0, back: 0.80, front: 0.55 }
    
    // Acumuladores de intensidad por zona
    const intensities = {
      movers_left: 0, movers_right: 0,
      backL: 0, backR: 0,
      frontL: 0, frontR: 0,
    }
    
    // Procesar cada rayo
    for (const ray of this.rays) {
      const rayDepth = this.getRayDepth(ray.startMs)
      if (rayDepth < 0) continue
      
      // Determinar qué lado ilumina este rayo
      let sideAtDepth: 'L' | 'R' | 'both'
      if (ray.crosses) {
        if (rayDepth < 0.3) {
          sideAtDepth = ray.startSide
        } else if (rayDepth < 0.7) {
          sideAtDepth = 'both'
        } else {
          sideAtDepth = ray.startSide === 'L' ? 'R' : 'L'
        }
      } else {
        sideAtDepth = ray.id
      }
      
      // Calcular intensidad para cada zona
      const moverInt = this.getZoneIntensity(rayDepth, ZONE_DEPTHS.movers, ZONE_ATTENUATION.movers)
      const backInt = this.getZoneIntensity(rayDepth, ZONE_DEPTHS.back, ZONE_ATTENUATION.back)
      const frontInt = this.getZoneIntensity(rayDepth, ZONE_DEPTHS.front, ZONE_ATTENUATION.front)
      
      // Asignar a los lados correspondientes (HTP)
      if (sideAtDepth === 'L' || sideAtDepth === 'both') {
        intensities.movers_left = Math.max(intensities.movers_left, moverInt)
        intensities.backL = Math.max(intensities.backL, backInt)
        intensities.frontL = Math.max(intensities.frontL, frontInt)
      }
      if (sideAtDepth === 'R' || sideAtDepth === 'both') {
        intensities.movers_right = Math.max(intensities.movers_right, moverInt)
        intensities.backR = Math.max(intensities.backR, backInt)
        intensities.frontR = Math.max(intensities.frontR, frontInt)
      }
    }
    
    // Shimmer sutil de refracción
    const shimmerL = Math.sin(progress * Math.PI * 4) * 0.08 + 0.92
    const shimmerR = Math.sin(progress * Math.PI * 4 + 0.7) * 0.08 + 0.92
    
    // Colores por profundidad
    const colorMovers = this.getColorForDepth(ZONE_DEPTHS.movers)
    const colorBack = this.getColorForDepth(ZONE_DEPTHS.back)
    const colorFront = this.getColorForDepth(ZONE_DEPTHS.front)
    
    // Movimiento lento de movers
    const rayPanL = Math.sin(progress * Math.PI * 0.6) * 15 - 10
    const rayPanR = Math.sin(progress * Math.PI * 0.6 + Math.PI * 0.3) * 15 + 10
    const rayTilt = 0.35 + Math.cos(progress * Math.PI * 0.4) * 0.08
    
    const finalIntensity = globalEnvelope * this.config.peakIntensity * this.triggerIntensity
    
    const output: EffectFrameOutput = {
      effectId: this.id,
      category: this.category,
      phase: this.phase,
      progress,
      zones: ['frontL', 'frontR', 'backL', 'backR', 'movers_left', 'movers_right'],
      intensity: finalIntensity,
      zoneOverrides: {},
    }

    // MOVERS: Rayos de sol desde ARRIBA - ULTRA LENTO
    output.zoneOverrides!['movers_left'] = {
      dimmer: intensities.movers_left * shimmerL * finalIntensity,
      color: colorMovers,
      blendMode: 'replace' as const,  // 🌊 WAVE 1073: REPLACE = El rayo manda
      movement: { 
        pan: rayPanL, 
        tilt: rayTilt * 100,  // Convertir a grados
        isAbsolute: false,
        speed: 0.15,  // 🌊 WAVE 1073: ULTRA LENTO (protección movers chinos)
      },
    }
    output.zoneOverrides!['movers_right'] = {
      dimmer: intensities.movers_right * shimmerR * finalIntensity,
      color: colorMovers,
      blendMode: 'replace' as const,
      movement: { 
        pan: rayPanR, 
        tilt: rayTilt * 100,
        isAbsolute: false,
        speed: 0.15,
      },
    }
    
    // BACK: Zona media
    output.zoneOverrides!['backL'] = {
      dimmer: intensities.backL * shimmerL * finalIntensity,
      color: colorBack,
      blendMode: 'replace' as const,
    }
    output.zoneOverrides!['backR'] = {
      dimmer: intensities.backR * shimmerR * finalIntensity,
      color: colorBack,
      blendMode: 'replace' as const,
    }
    
    // FRONT: Fondo oceánico
    output.zoneOverrides!['frontL'] = {
      dimmer: intensities.frontL * shimmerL * finalIntensity,
      color: colorFront,
      blendMode: 'replace' as const,
    }
    output.zoneOverrides!['frontR'] = {
      dimmer: intensities.frontR * shimmerR * finalIntensity,
      color: colorFront,
      blendMode: 'replace' as const,
    }
    
    return output
  }
  
  isFinished(): boolean { return this.phase === 'finished' }
  abort(): void { this.phase = 'finished' }
}