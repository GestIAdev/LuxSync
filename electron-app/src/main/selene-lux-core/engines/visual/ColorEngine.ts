/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎨 COLOR ENGINE V16 - LIVING PALETTES SYSTEM
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 33.2: Refactor completo con documentación profesional
 * 
 * Este motor genera colores PROCEDURALMENTE que:
 * - Evolucionan con el tiempo (no son estáticos)
 * - Reaccionan a la música (intensidad, energía)
 * - Usan lateralidad (side) para romper simetría
 * - Son deterministas (sin Math.random) usando entropia del sistema
 * 
 * PALETAS DISPONIBLES:
 * - fuego: Rojos/naranjas cálidos con acentos amarillos
 * - hielo: Azules fríos con aurora rosa/cian
 * - selva: Verdes tropicales con magenta/dorado
 * - neon: Ciclo cyberpunk de 60s entre colores neón
 * 
 * @module engines/visual/ColorEngine
 * @version 16.0.0
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type {
  PaletteState,
  RGBColor,
  MusicalPattern,
  EmotionalTone,
  ElementType,
  VisualConfig,
  AudioMetrics,
} from '../../types'
import type { BeatState } from '../audio/BeatDetector'

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ColorOutput {
  primary: RGBColor
  secondary: RGBColor
  accent: RGBColor
  ambient: RGBColor
  intensity: number
  saturation: number
}

/** Tipos de zona para fixtures */
export type ZoneType = 'wash' | 'spot'

/** Lateralidad para espejo cromático */
export type Side = 'left' | 'right' | 'front' | 'back'

/** IDs de paletas vivas disponibles */
export type LivingPaletteId = 'fuego' | 'hielo' | 'selva' | 'neon'

/** Definición interna de paleta */
interface PaletteDefinition {
  name: string
  description: string
  temperature: number
  minIntensity?: number
  redirect?: LivingPaletteId
}

/** Estado del generador de entropía */
interface EntropyState {
  timeSeed: number
  audioSeed: number
}

/** Estado de personalidad/creatividad del motor */
interface PersonalityState {
  creativity: number
  energy: number
}

/** Par de colores para ciclos (usado en neon) */
interface ColorPair {
  primary: number
  accent: number
}

// ═══════════════════════════════════════════════════════════════════════════
// COLOR ENGINE CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class ColorEngine {
  // ─────────────────────────────────────────────────────────────────────────
  // State
  // ─────────────────────────────────────────────────────────────────────────
  private activePalette: LivingPaletteId = 'fuego'
  private transitionProgress = 1
  private transitionDuration: number
  private targetPalette: LivingPaletteId | null = null
  
  /** Semillas para generar entropía determinista */
  private entropyState: EntropyState = {
    timeSeed: 0,
    audioSeed: 0,
  }
  
  /** Parámetros de personalidad que afectan la generación */
  private personality: PersonalityState = {
    creativity: 0.7,
    energy: 0.5,
  }
  
  /** Saturación global (0-1) */
  private globalSaturation = 1.0
  
  /** Intensidad global (0-1) */
  private globalIntensity = 1.0
  
  // ─────────────────────────────────────────────────────────────────────────
  // Palette Definitions
  // ─────────────────────────────────────────────────────────────────────────
  private readonly PALETTES: Record<string, PaletteDefinition> = {
    fuego: {
      name: 'Fuego',
      description: 'Latino Heat - Rojos/naranjas con amarillo solar',
      temperature: 0.85,
    },
    hielo: {
      name: 'Hielo',
      description: 'Arctic Dreams - Azules con aurora boreal',
      temperature: 0.2,
      minIntensity: 0.25,
    },
    selva: {
      name: 'Selva',
      description: 'Tropical Storm - Verdes con acentos magenta/dorado',
      temperature: 0.5,
    },
    neon: {
      name: 'Neon',
      description: 'Cyberpunk - Ciclo 60s de colores neón',
      temperature: 0.5,
    },
    default: {
      name: 'Default',
      description: 'Fallback a fuego',
      temperature: 0.5,
      redirect: 'fuego',
    },
  }
  
  /** Mapeo de estados emocionales a temperatura de color */
  private readonly moodToTemperature: Record<EmotionalTone, number> = {
    peaceful: 0.3,
    energetic: 0.8,
    chaotic: 0.5,
    harmonious: 0.5,
    building: 0.6,
    dropping: 0.7,
  }
  
  /** Colores base para elementos */
  private readonly elementToColor: Record<ElementType, RGBColor> = {
    fire: { r: 255, g: 68, b: 68 },
    water: { r: 68, g: 200, b: 255 },
    earth: { r: 139, g: 90, b: 43 },
    air: { r: 200, g: 200, b: 255 },
  }
  
  /** Pares de colores para el ciclo neón */
  private readonly NEON_PAIRS: ColorPair[] = [
    { primary: 300, accent: 180 },  // Magenta -> Cian
    { primary: 180, accent: 330 },  // Cian -> Rosa Hot
    { primary: 270, accent: 120 },  // Púrpura -> Verde Láser
    { primary: 120, accent: 300 },  // Verde -> Magenta
  ]
  
  // ─────────────────────────────────────────────────────────────────────────
  // Constructor
  // ─────────────────────────────────────────────────────────────────────────
  constructor(config: VisualConfig) {
    this.transitionDuration = config.transitionTime || 500
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Genera el color "vivo" para una zona y lado específico
   * 
   * @param paletteName - ID de la paleta a usar
   * @param intensity - Intensidad 0-1 (afecta luminosidad)
   * @param zoneType - 'wash' para PAR/wash, 'spot' para moving heads
   * @param side - 'left'|'right'|'front'|'back' para espejo cromático
   * @returns Color RGB calculado
   */
  getLivingColor(
    paletteName: string,
    intensity: number,
    zoneType: ZoneType = 'wash',
    side: Side = 'left'
  ): RGBColor {
    // Calcular drift temporal basado en creatividad
    const creativityBoost = 0.5 + (this.personality.creativity * 0.5)
    const driftSpeed = 15000 / creativityBoost
    const timeDrift = (Date.now() / driftSpeed) % 1
    
    // Resolver paleta (manejar redirects)
    let resolvedPalette = paletteName
    const palette = this.PALETTES[paletteName]
    if (palette?.redirect) {
      resolvedPalette = palette.redirect
    }
    if (!this.PALETTES[resolvedPalette]) {
      resolvedPalette = 'fuego'
    }
    
    // Generar entropía determinista
    const frameSeed = Date.now() + intensity * 1000 + (side === 'right' ? 500 : 0)
    const entropy = this.getSystemEntropy(frameSeed)
    
    // Calcular HSL según paleta
    let hue = 0
    let sat = 100
    let lum = 50
    
    switch (resolvedPalette) {
      case 'fuego': {
        const result = this.calculateFuego(zoneType, side, timeDrift, entropy, intensity)
        hue = result.h; sat = result.s; lum = result.l
        break
      }
      case 'hielo': {
        const result = this.calculateHielo(zoneType, side, timeDrift, entropy, intensity)
        hue = result.h; sat = result.s; lum = result.l
        break
      }
      case 'selva': {
        const result = this.calculateSelva(zoneType, side, timeDrift, entropy, intensity)
        hue = result.h; sat = result.s; lum = result.l
        break
      }
      case 'neon': {
        const result = this.calculateNeon(zoneType, side, intensity)
        hue = result.h; sat = result.s; lum = result.l
        break
      }
      default:
        hue = 20; sat = 90; lum = 50
    }
    
    // Ajuste por posición trasera
    if (side === 'back') {
      hue = (hue - 15 + 360) % 360
    }
    
    // Normalizar valores
    hue = ((hue % 360) + 360) % 360
    
    // Aplicar modificadores globales
    sat = Math.max(0, Math.min(100, sat * this.globalSaturation))
    lum = Math.max(0, Math.min(100, lum * this.globalIntensity))
    
    // Yellow Brilliance Fix: optimizar rango amarillo
    const optimized = this.optimizeYellowRange(hue, sat, lum)
    hue = optimized.h; sat = optimized.s; lum = optimized.l
    
    return this.hslToRgb(hue / 360, sat / 100, lum / 100)
  }

  /**
   * Genera colores completos a partir de métricas de audio
   */
  generate(
    metrics: AudioMetrics,
    beatState: BeatState,
    _pattern: MusicalPattern | null
  ): ColorOutput {
    this.personality.energy = metrics.energy
    const intensity = metrics.energy * 0.7 + metrics.bass * 0.3
    
    const primary = this.getLivingColor(this.activePalette, intensity, 'wash', 'front')
    const secondary = this.getLivingColor(this.activePalette, intensity, 'wash', 'back')
    const accent = this.getLivingColor(this.activePalette, intensity, 'spot', 'left')
    const ambient = this.getLivingColor(this.activePalette, intensity, 'spot', 'right')
    
    const beatBoost = beatState.onBeat ? 1.15 : 1.0
    
    return {
      primary: this.boostColor(primary, beatBoost),
      secondary: this.boostColor(secondary, beatBoost * 0.9),
      accent: this.boostColor(accent, beatBoost),
      ambient: this.boostColor(ambient, beatBoost * 0.8),
      intensity: Math.min(1, intensity * beatBoost),
      saturation: 0.9 * this.globalSaturation,
    }
  }

  /**
   * Calcula colores por zona (para UI y debugging)
   */
  calculateZoneColors(intensity: number): {
    front: RGBColor
    back: RGBColor
    movingLeft: RGBColor
    movingRight: RGBColor
  } {
    return {
      front: this.getLivingColor(this.activePalette, intensity, 'wash', 'front'),
      back: this.getLivingColor(this.activePalette, intensity, 'wash', 'back'),
      movingLeft: this.getLivingColor(this.activePalette, intensity, 'spot', 'left'),
      movingRight: this.getLivingColor(this.activePalette, intensity, 'spot', 'right'),
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Palette Control
  // ─────────────────────────────────────────────────────────────────────────

  /** Cambia la paleta con transición suave */
  setPalette(palette: LivingPaletteId): void {
    if (this.activePalette === palette) return
    this.targetPalette = palette
    this.transitionProgress = 0
  }
  
  /** Cambia la paleta inmediatamente (sin transición) */
  setPaletteImmediate(palette: LivingPaletteId): void {
    this.activePalette = palette
    this.targetPalette = null
    this.transitionProgress = 1
  }

  /** Actualiza el progreso de transición */
  updateTransition(deltaTime: number): void {
    if (this.transitionProgress < 1 && this.targetPalette) {
      this.transitionProgress += deltaTime / this.transitionDuration
      if (this.transitionProgress >= 1) {
        this.transitionProgress = 1
        this.activePalette = this.targetPalette
        this.targetPalette = null
      }
    }
  }

  /** Obtiene la paleta activa */
  getCurrentPalette(): LivingPaletteId {
    return this.activePalette
  }

  /** Obtiene el estado completo de la paleta */
  getPaletteState(): PaletteState {
    return {
      id: this.activePalette,
      colors: this.getPaletteHexColors(),
      saturation: this.globalSaturation,
      intensity: this.globalIntensity,
      temperature: this.getPaletteTemperature(),
    }
  }
  
  /** Lista de paletas disponibles */
  getAvailablePalettes(): Array<{ id: LivingPaletteId; name: string; description: string }> {
    return [
      { id: 'fuego', ...this.PALETTES.fuego },
      { id: 'hielo', ...this.PALETTES.hielo },
      { id: 'selva', ...this.PALETTES.selva },
      { id: 'neon', ...this.PALETTES.neon },
    ] as Array<{ id: LivingPaletteId; name: string; description: string }>
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Global Controls
  // ─────────────────────────────────────────────────────────────────────────

  /** Establece la saturación global (0-1) */
  setGlobalSaturation(value: number): void {
    this.globalSaturation = Math.max(0, Math.min(1, value))
  }

  /** Obtiene la saturación global */
  getGlobalSaturation(): number {
    return this.globalSaturation
  }

  /** Establece la intensidad global (0-1) */
  setGlobalIntensity(value: number): void {
    this.globalIntensity = Math.max(0, Math.min(1, value))
  }

  /** Obtiene la intensidad global */
  getGlobalIntensity(): number {
    return this.globalIntensity
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Utility Methods
  // ─────────────────────────────────────────────────────────────────────────

  /** Obtiene temperatura de un mood */
  getMoodTemperature(mood: EmotionalTone): number {
    return this.moodToTemperature[mood] ?? 0.5
  }

  /** Obtiene color base de un elemento */
  getElementColor(element: ElementType): RGBColor {
    return { ...this.elementToColor[element] }
  }

  /** Convierte RGB a HEX */
  rgbToHex(color: RGBColor): string {
    return '#' + [color.r, color.g, color.b]
      .map(x => x.toString(16).padStart(2, '0'))
      .join('')
  }

  /** Convierte HEX a RGB */
  hexToRgb(hex: string): RGBColor {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    } : { r: 255, g: 255, b: 255 }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE: Palette Calculation Methods
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * FUEGO (Latino Heat)
   * Rojos/naranjas cálidos + amarillo solar en móviles
   */
  private calculateFuego(
    zoneType: ZoneType,
    side: Side,
    timeDrift: number,
    entropy: number,
    intensity: number
  ): { h: number; s: number; l: number } {
    let h: number, s: number, l: number
    
    if (zoneType === 'spot') {
      // ESPEJO CROMÁTICO: LEFT y RIGHT diferentes
      if (side === 'left') {
        // LEFT: Amarillo Sol Ardiente
        h = 58 + (timeDrift * 6) + (entropy * 4)
        s = 95
        l = 70
      } else {
        // RIGHT: Naranja-Rojo Fuego
        h = 15 + (timeDrift * 10) + (entropy * 5)
        s = 100
        l = 55
      }
    } else {
      // PARs: Rojo-Naranja cálido
      const baseDrift = Math.sin(timeDrift * Math.PI * 2) * 20
      h = 10 + baseDrift + (intensity * 15)
      s = 95 + (intensity * 5)
      l = Math.max(45, 30 + (intensity * 35))
    }
    
    return { h, s, l }
  }

  /**
   * HIELO (Arctic Dreams)
   * Azules fríos + aurora rosa/cian en móviles
   */
  private calculateHielo(
    zoneType: ZoneType,
    side: Side,
    timeDrift: number,
    entropy: number,
    intensity: number
  ): { h: number; s: number; l: number } {
    let h: number, s: number, l: number
    
    // Aplicar intensidad mínima
    const minIntensity = this.PALETTES.hielo?.minIntensity || 0.25
    const adjustedIntensity = Math.max(intensity, minIntensity)
    
    if (zoneType === 'spot') {
      // ESPEJO CROMÁTICO: LEFT Rosa, RIGHT Cian
      if (side === 'left') {
        // LEFT: Rosa Aurora
        h = 330 + (entropy * 20)
        s = 85
        l = 60
      } else {
        // RIGHT: Cian Hielo
        h = 185 + (entropy * 15)
        s = 100
        l = 55
      }
    } else {
      // PARs: Azul profundo
      h = 210 + (timeDrift * 15)
      s = 85 - (adjustedIntensity * 10)
      l = Math.max(45, 35 + (adjustedIntensity * 35))
    }
    
    return { h, s, l }
  }

  /**
   * SELVA (Tropical Storm)
   * Verdes + magenta/dorado en móviles
   */
  private calculateSelva(
    zoneType: ZoneType,
    side: Side,
    timeDrift: number,
    entropy: number,
    intensity: number
  ): { h: number; s: number; l: number } {
    let h: number, s: number, l: number
    
    if (zoneType === 'spot') {
      // ESPEJO CROMÁTICO: LEFT y RIGHT diferentes
      if (side === 'left') {
        // LEFT: Magenta Orquídea
        h = 320 + (entropy * 25)
        s = 100
        l = 58
      } else {
        // RIGHT: Amarillo Sol Tropical
        h = 58 + (entropy * 6)
        s = 95
        l = 70
      }
    } else {
      // PARs: Verde selva
      h = 120 + (timeDrift * 25) - (intensity * 20)
      s = 85 + (intensity * 15)
      l = Math.max(40, 30 + (intensity * 30))
    }
    
    return { h, s, l }
  }

  /**
   * NEON (Cyberpunk)
   * Ciclo lento de 60s entre colores neón
   */
  private calculateNeon(
    zoneType: ZoneType,
    side: Side,
    intensity: number
  ): { h: number; s: number; l: number } {
    let h: number, s: number, l: number
    
    // Ciclo de 60 segundos
    const cycleTime = Date.now() / 60000
    const cycleProgress = cycleTime % 1
    const cycleIndex = Math.floor(cycleTime) % this.NEON_PAIRS.length
    const nextCycleIndex = (cycleIndex + 1) % this.NEON_PAIRS.length
    
    const currentPair = this.NEON_PAIRS[cycleIndex]
    const nextPair = this.NEON_PAIRS[nextCycleIndex]
    
    // Transición suave en últimos 20% del ciclo
    const transitionStart = 0.8
    let blendFactor = 0
    if (cycleProgress > transitionStart) {
      blendFactor = (cycleProgress - transitionStart) / (1 - transitionStart)
    }
    
    if (zoneType === 'spot') {
      // ESPEJO CROMÁTICO: LEFT usa accent, RIGHT usa primary
      const currentHue = side === 'left' ? currentPair.accent : currentPair.primary
      const nextHue = side === 'left' ? nextPair.accent : nextPair.primary
      h = this.lerpHue(currentHue, nextHue, blendFactor)
      s = 95
      l = 55
    } else {
      // PARs: Color principal con transición
      h = this.lerpHue(currentPair.primary, nextPair.primary, blendFactor)
      s = 100
      l = Math.max(50, 45 + (intensity * 25))
    }
    
    return { h, s, l }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE: Utility Methods
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Genera entropía determinista basada en tiempo y audio
   * Reemplaza Math.random() para reproducibilidad
   */
  private getSystemEntropy(seedOffset: number = 0): number {
    const time = Date.now()
    const audioNoise = (this.personality.energy * 1000) % 1
    const combinedSeed = time * 0.001 + audioNoise * 100 + seedOffset * 7.3
    const entropy = (Math.sin(combinedSeed) + Math.cos(combinedSeed * 0.7) + 2) / 4
    
    this.entropyState.timeSeed = (time % 100000) / 100000
    this.entropyState.audioSeed = audioNoise
    
    return Math.max(0, Math.min(1, entropy))
  }

  /**
   * Interpola entre dos hues manejando wrap-around del círculo cromático
   */
  private lerpHue(from: number, to: number, t: number): number {
    const diff = to - from
    if (Math.abs(diff) > 180) {
      if (diff > 0) {
        from += 360
      } else {
        to += 360
      }
    }
    return ((from + (to - from) * t) + 360) % 360
  }

  /**
   * Optimiza el rango amarillo para evitar verde oliva
   * HSL(60, 95, 50) = verde oliva (malo)
   * HSL(60, 95, 70) = amarillo sol (bueno)
   */
  private optimizeYellowRange(h: number, s: number, l: number): { h: number; s: number; l: number } {
    if (h >= 40 && h <= 75) {
      // Centrar en amarillo puro (H:58-65)
      if (h < 55) h = 55 + (h - 40) * 0.2
      if (h > 68) h = 68 - (75 - h) * 0.3
      
      // Luminosidad óptima: 65-75%
      l = Math.max(65, Math.min(75, l))
      
      // Saturación 90-95%
      s = Math.max(90, Math.min(95, s))
    }
    return { h, s, l }
  }

  /** Convierte HSL a RGB */
  private hslToRgb(h: number, s: number, l: number): RGBColor {
    let r: number, g: number, b: number
    
    if (s === 0) {
      r = g = b = l
    } else {
      const hue2rgb = (p: number, q: number, t: number): number => {
        if (t < 0) t += 1
        if (t > 1) t -= 1
        if (t < 1/6) return p + (q - p) * 6 * t
        if (t < 1/2) return q
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
        return p
      }
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s
      const p = 2 * l - q
      r = hue2rgb(p, q, h + 1/3)
      g = hue2rgb(p, q, h)
      b = hue2rgb(p, q, h - 1/3)
    }
    
    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255),
    }
  }

  /** Aplica boost de brillo a un color */
  private boostColor(color: RGBColor, factor: number): RGBColor {
    return {
      r: Math.min(255, Math.round(color.r * factor)),
      g: Math.min(255, Math.round(color.g * factor)),
      b: Math.min(255, Math.round(color.b * factor)),
    }
  }

  /** Obtiene colores de la paleta actual en formato HEX */
  private getPaletteHexColors(): string[] {
    const colors = this.calculateZoneColors(0.7)
    return [
      this.rgbToHex(colors.front),
      this.rgbToHex(colors.back),
      this.rgbToHex(colors.movingLeft),
      this.rgbToHex(colors.movingRight),
    ]
  }

  /** Obtiene la temperatura de la paleta activa */
  private getPaletteTemperature(): number {
    return this.PALETTES[this.activePalette]?.temperature ?? 0.5
  }
}
