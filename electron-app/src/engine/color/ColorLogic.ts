/**
 * 🎨 WAVE 220: COLOR LOGIC
 * 
 * @deprecated WAVE 269: Reemplazado por SeleneColorEngine.
 * Este archivo fue el "andamio de madera" mientras se estabilizaba Titan V2.
 * Ahora que el Ferrari (SeleneColorEngine) está conectado, este archivo
 * queda como legacy y será eliminado en una futura limpieza.
 * 
 * Lógica de colores PURA extraída de LatinoStereoPhysics.
 * Calcula paletas HSL basadas en contexto musical y perfil de vibe.
 * 
 * FILOSOFÍA:
 * - NO genera RGB ni DMX - solo HSL abstracto
 * - Respeta las restricciones del VibeProfile
 * - Detecta momentos especiales (Solar Flare, Machine Gun, etc.)
 * 
 * @layer ENGINE/COLOR
 * @version TITAN 2.0 (DEPRECATED)
 */

import { ColorPalette, HSLColor, withHex } from '../../core/protocol/LightingIntent'
import { MusicalContext } from '../../core/protocol/MusicalContext'

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Input para el cálculo de color
 */
export interface ColorLogicInput {
  context: MusicalContext
  audio: {
    bass: number
    energy: number
    high: number
    previousBass: number
    previousEnergy: number
    deltaTime: number
  }
  vibeProfile: VibeColorConfig
  previousPalette: ColorPalette
}

/**
 * Configuración de color del vibe (subset de VibeProfile)
 */
export interface VibeColorConfig {
  id: string
  color: {
    strategies: string[]
    temperature: { min: number; max: number }
    atmosphericTemp: number
    saturation: { min: number; max: number }
    forbiddenHueRanges?: [number, number][]
    allowedHueRanges?: [number, number][]
  }
  dimmer: {
    floor: number
    ceiling: number
    allowBlackout: boolean
  }
}

/**
 * Resultado del cálculo de color
 */
export interface ColorLogicResult {
  palette: ColorPalette
  isSolarFlare: boolean
  isMachineGunBlackout: boolean
  subGenre: 'cumbia' | 'reggaeton' | 'salsa' | 'techno' | 'chill' | 'generic'
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTES (Extraídas de LatinoStereoPhysics)
// ═══════════════════════════════════════════════════════════════════════════

/** Umbral para Solar Flare (kick fuerte) */
const KICK_THRESHOLD = 0.80

/** Delta mínimo de bass para trigger */
const BASS_DELTA_THRESHOLD = 0.15

/** Umbral de caída para Machine Gun blackout */
const NEGATIVE_DROP_THRESHOLD = 0.4

/** Ventana de tiempo para detectar drop (ms) */
const NEGATIVE_DROP_WINDOW_MS = 100

/** Frames de blackout */
const BLACKOUT_FRAMES = 3

// Colores neón predefinidos (HSL normalizado 0-1) - WAVE 256.7: Añadir .hex
const NEON_COLORS = {
  magenta: withHex({ h: 300/360, s: 1.0, l: 0.65 }),
  cyan: withHex({ h: 180/360, s: 1.0, l: 0.60 }),
  lime: withHex({ h: 120/360, s: 1.0, l: 0.55 }),
  orange: withHex({ h: 30/360, s: 1.0, l: 0.55 }),
  yellow: withHex({ h: 55/360, s: 1.0, l: 0.55 }),
  gold: withHex({ h: 38/360, s: 1.0, l: 0.45 }),  // Solar Flare color
}

// ═══════════════════════════════════════════════════════════════════════════
// COLOR LOGIC CLASS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🎨 COLOR LOGIC
 * 
 * Motor de cálculo de paletas de color reactivas.
 */
export class ColorLogic {
  // Estado interno
  private blackoutFramesRemaining = 0
  private beatCounter = 0
  private lastNeonColorIndex = 0
  private framesSinceNeonChange = 0
  
  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Calcula la paleta de colores basada en contexto musical.
   */
  public calculate(input: ColorLogicInput): ColorPalette {
    const { context, audio, vibeProfile, previousPalette } = input
    
    // Detectar subgénero
    const subGenre = this.detectSubGenre(context.bpm, vibeProfile.id)
    
    // Detectar efectos especiales
    const isMachineGun = this.detectMachineGun(audio, subGenre)
    const isSolarFlare = this.detectSolarFlare(audio, subGenre)
    
    // Si estamos en blackout, retornar negro
    if (isMachineGun) {
      return this.createBlackoutPalette()
    }
    
    // Calcular paleta base según temperatura y mood
    let palette = this.calculateBasePalette(context, vibeProfile)
    
    // Aplicar Solar Flare si corresponde
    if (isSolarFlare) {
      palette = this.applySolarFlare(palette)
    }
    
    // Aplicar inyección de neón para cumbia/generic
    if ((subGenre === 'cumbia' || subGenre === 'generic') && audio.bass > 0.4) {
      palette = this.applyNeonInjection(palette, audio.bass)
    }
    
    // Interpolar suavemente con paleta anterior para evitar cambios bruscos
    palette = this.interpolatePalettes(previousPalette, palette, 0.3)
    
    return palette
  }
  
  /**
   * Calcula el resultado completo con flags de efectos.
   */
  public calculateWithEffects(input: ColorLogicInput): ColorLogicResult {
    const { context, audio, vibeProfile } = input
    const subGenre = this.detectSubGenre(context.bpm, vibeProfile.id)
    
    return {
      palette: this.calculate(input),
      isSolarFlare: this.detectSolarFlare(audio, subGenre),
      isMachineGunBlackout: this.detectMachineGun(audio, subGenre),
      subGenre,
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // PRIVATE: DETECCIÓN
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Detecta subgénero basado en BPM y vibe.
   */
  private detectSubGenre(
    bpm: number,
    vibeId: string
  ): 'cumbia' | 'reggaeton' | 'salsa' | 'techno' | 'chill' | 'generic' {
    // Priorizar por vibe
    if (vibeId.includes('techno')) return 'techno'
    if (vibeId.includes('chill')) return 'chill'
    
    // Para latinos, detectar por BPM
    if (vibeId.includes('latina') || vibeId.includes('latino')) {
      if (bpm >= 130) return 'salsa'
      if (bpm >= 85 && bpm <= 100) return 'reggaeton'
      if (bpm >= 85) return 'cumbia'
    }
    
    return 'generic'
  }
  
  /**
   * Detecta Machine Gun blackout (caída brusca de energía).
   */
  private detectMachineGun(
    audio: { energy: number; previousEnergy: number; deltaTime: number },
    subGenre: string
  ): boolean {
    // Cumbia no tiene machine gun
    if (subGenre === 'cumbia') return false
    
    const energyDelta = audio.previousEnergy - audio.energy
    const isNegativeDrop = (
      energyDelta >= NEGATIVE_DROP_THRESHOLD &&
      audio.deltaTime <= NEGATIVE_DROP_WINDOW_MS &&
      audio.previousEnergy > 0.6
    )
    
    if (isNegativeDrop) {
      this.blackoutFramesRemaining = BLACKOUT_FRAMES
    }
    
    if (this.blackoutFramesRemaining > 0) {
      this.blackoutFramesRemaining--
      return true
    }
    
    return false
  }
  
  /**
   * Detecta Solar Flare (kick fuerte con delta positivo).
   */
  private detectSolarFlare(
    audio: { bass: number; previousBass: number },
    subGenre: string
  ): boolean {
    // Cumbia no tiene solar flare (evita blancos)
    if (subGenre === 'cumbia') return false
    
    const bassDelta = audio.bass - audio.previousBass
    return audio.bass > KICK_THRESHOLD && bassDelta > BASS_DELTA_THRESHOLD
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // PRIVATE: CÁLCULO DE PALETAS
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Calcula paleta base según temperatura atmosférica del vibe.
   */
  private calculateBasePalette(
    context: MusicalContext,
    vibeProfile: VibeColorConfig
  ): ColorPalette {
    const { atmosphericTemp, saturation } = vibeProfile.color
    
    // Temperatura a hue base (Kelvin conceptual a grados)
    // 2000K (cálido) → ~30° (naranja)
    // 6500K (neutro) → ~180° (cyan)
    // 10000K (frío) → ~240° (azul)
    const tempToHue = (temp: number): number => {
      const normalized = (temp - 2000) / (10000 - 2000) // 0-1
      // Mapear a rango 30° (cálido) a 240° (frío)
      return (30 + (normalized * 210)) / 360
    }
    
    const baseHue = tempToHue(atmosphericTemp)
    
    // Ajustar saturación según energía
    const energySat = saturation.min + (context.energy * (saturation.max - saturation.min))
    
    // Construir paleta con armonía triádica - WAVE 256.7: Añadir .hex para UI
    const primary: HSLColor = withHex({
      h: baseHue,
      s: energySat,
      l: 0.5,
    })
    
    const secondary: HSLColor = withHex({
      h: (baseHue + 0.33) % 1,  // +120° (triádico)
      s: energySat * 0.9,
      l: 0.5,
    })
    
    const accent: HSLColor = withHex({
      h: (baseHue + 0.66) % 1,  // +240° (triádico)
      s: energySat,
      l: 0.6,
    })
    
    const ambient: HSLColor = withHex({
      h: baseHue,
      s: energySat * 0.3,
      l: 0.2,
    })
    
    return { primary, secondary, accent, ambient }
  }
  
  /**
   * Aplica efecto Solar Flare (destello dorado).
   */
  private applySolarFlare(palette: ColorPalette): ColorPalette {
    return {
      ...palette,
      accent: { ...NEON_COLORS.gold },
      primary: withHex({
        ...palette.primary,
        l: Math.min(0.85, palette.primary.l + 0.15), // +15% brillo
      }),
    }
  }
  
  /**
   * Aplica inyección de neón (para cumbia/generic).
   */
  private applyNeonInjection(palette: ColorPalette, bassLevel: number): ColorPalette {
    this.beatCounter++
    this.framesSinceNeonChange++
    
    // Cooldown de 8 frames entre cambios
    if (this.framesSinceNeonChange >= 8) {
      this.lastNeonColorIndex = this.beatCounter % 4
      this.framesSinceNeonChange = 0
    }
    
    const neonOptions = [
      NEON_COLORS.magenta,
      NEON_COLORS.cyan,
      NEON_COLORS.lime,
      NEON_COLORS.orange,
    ]
    
    const neonColor = neonOptions[this.lastNeonColorIndex]
    const intensity = Math.min(1, bassLevel * 1.2)
    
    return {
      ...palette,
      accent: this.blendColors(palette.accent, neonColor, intensity),
      primary: this.blendColors(palette.primary, neonOptions[(this.lastNeonColorIndex + 2) % 4], intensity * 0.5),
    }
  }
  
  /**
   * Crea paleta de blackout.
   */
  private createBlackoutPalette(): ColorPalette {
    const black: HSLColor = withHex({ h: 0, s: 0, l: 0 })
    return {
      primary: black,
      secondary: black,
      accent: black,
      ambient: black,
    }
  }
  
  /**
   * Interpola entre dos paletas.
   */
  private interpolatePalettes(
    from: ColorPalette,
    to: ColorPalette,
    factor: number
  ): ColorPalette {
    const lerp = (a: number, b: number): number => a + (b - a) * factor
    const lerpColor = (a: HSLColor, b: HSLColor): HSLColor => withHex({
      h: lerp(a.h, b.h),
      s: lerp(a.s, b.s),
      l: lerp(a.l, b.l),
    })
    
    return {
      primary: lerpColor(from.primary, to.primary),
      secondary: lerpColor(from.secondary, to.secondary),
      accent: lerpColor(from.accent, to.accent),
      ambient: lerpColor(from.ambient, to.ambient),
    }
  }
  
  /**
   * Mezcla dos colores HSL.
   */
  private blendColors(a: HSLColor, b: HSLColor, factor: number): HSLColor {
    return withHex({
      h: a.h + (b.h - a.h) * factor,
      s: a.s + (b.s - a.s) * factor,
      l: a.l + (b.l - a.l) * factor,
    })
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export { NEON_COLORS }
