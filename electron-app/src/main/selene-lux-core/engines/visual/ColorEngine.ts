/**
 * COLOR ENGINE V15.2 - LIVING PALETTES
 * 
 * MIGRADO desde: demo/selene-integration.js - getLivingColor()
 * 
 * Genera colores PROCEDURALMENTE usando         if (zoneType === 'spot') {
          // ?? ESPEJO CROM�TICO: LEFT y RIGHT siempre diferentes
          if (side === 'left') {
            // ?? LEFT: Rosa Aurora
            h = 330 + (entropy * 20) // Rosa (330-350)
            s = 85
            l = 60
          } else {
            // ?? RIGHT: Cian Hielo
            h = 185 + (entropy * 15) // Cian (185-200)
            s = 100
            l = 55
          }
          break
        }
        
        // PARs: Azul profundoEVOLUCIONA con el tiempo (no es estatico)
 * - Reacciona a la musica (intensidad, entropia)
 * - Sistema de lateralidad (side) para romper simetria
 * - SIN Math.random() - usa getSystemEntropy() determinista
 * 
 * Paletas: fuego, hielo, selva, neon
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

export interface ColorOutput {
  primary: RGBColor
  secondary: RGBColor
  accent: RGBColor
  ambient: RGBColor
  intensity: number
  saturation: number
}

export type ZoneType = 'wash' | 'spot'
export type Side = 'left' | 'right' | 'front' | 'back'
export type LivingPaletteId = 'fuego' | 'hielo' | 'selva' | 'neon'

interface PaletteDefinition {
  name: string
  redirect?: LivingPaletteId
  minIntensity?: number
}

interface EntropyState {
  timeSeed: number
  audioSeed: number
}

interface PersonalityState {
  creativity: number
  energy: number
}

export class ColorEngine {
  private activePalette: LivingPaletteId = 'fuego'
  private transitionProgress = 1
  private transitionDuration: number
  private targetPalette: LivingPaletteId | null = null
  
  private entropyState: EntropyState = {
    timeSeed: 0,
    audioSeed: 0,
  }
  
  private personality: PersonalityState = {
    creativity: 0.7,
    energy: 0.5,
  }
  
  private readonly PALETTES: Record<string, PaletteDefinition> = {
    fuego: { name: 'Fuego' },
    hielo: { name: 'Hielo', minIntensity: 0.25 },
    selva: { name: 'Selva' },
    neon: { name: 'Neon' },
    default: { name: 'Default', redirect: 'fuego' },
  }
  
  private readonly moodToTemperature: Record<EmotionalTone, number> = {
    peaceful: 0.3,
    energetic: 0.8,
    chaotic: 0.5,
    harmonious: 0.5,
    building: 0.6,
    dropping: 0.7,
  }
  
  private readonly elementToColor: Record<ElementType, RGBColor> = {
    fire: { r: 255, g: 68, b: 68 },
    water: { r: 68, g: 200, b: 255 },
    earth: { r: 139, g: 90, b: 43 },
    air: { r: 200, g: 200, b: 255 },
  }
  
  constructor(config: VisualConfig) {
    this.transitionDuration = config.transitionTime || 500
  }
  
  getLivingColor(
    paletteName: string,
    intensity: number,
    zoneType: ZoneType = 'wash',
    side: Side = 'left'
  ): RGBColor {
    const creativityBoost = 0.5 + (this.personality.creativity * 0.5)
    const driftSpeed = 15000 / creativityBoost
    const timeDrift = (Date.now() / driftSpeed) % 1
    
    let resolvedPalette = paletteName
    const palette = this.PALETTES[paletteName]
    if (palette && palette.redirect) {
      resolvedPalette = palette.redirect
    }
    if (!palette) resolvedPalette = 'fuego'
    
    const frameSeed = Date.now() + intensity * 1000 + (side === 'right' ? 500 : 0)
    const entropy = this.getSystemEntropy(frameSeed)
    
    let h = 0, s = 100, l = 50

    switch (resolvedPalette) {
      // -----------------------------------------------------------------------
      // ?? FUEGO (Latino Heat) - Rojos/Naranjas + Acento Caribe�o en m�viles
      // ?? GOLDEN FIX: Amarillo Solar (H:50-58) en vez de Ocre (H:40-45)
      // -----------------------------------------------------------------------
      case 'fuego': {
        if (zoneType === 'spot') {
          // ?? ESPEJO CROM�TICO: LEFT y RIGHT siempre diferentes
          if (side === 'left') {
            // ?? LEFT: Amarillo Sol Ardiente
            h = 58 + (timeDrift * 6) + (entropy * 4) // Amarillo (58-68)
            s = 95
            l = 70
          } else {
            // ?? RIGHT: Naranja-Rojo Fuego (complemento c�lido)
            h = 15 + (timeDrift * 10) + (entropy * 5) // Naranja-Rojo (15-30)
            s = 100
            l = 55
          }
          break
        }

        // PARs: Rojo-Naranja c�lido
        const baseDrift = Math.sin(timeDrift * Math.PI * 2) * 20
        h = 10 + baseDrift + (intensity * 15) // Rojo-naranja (0-35)
        s = 95 + (intensity * 5)
        l = Math.max(45, 30 + (intensity * 35))
        break
      }
      
      // -----------------------------------------------------------------------
      // ?? HIELO (Arctic Dreams) - Azules + Aurora Rosa en m�viles
      // -----------------------------------------------------------------------
      case 'hielo': {
        const minIntensity = this.PALETTES.hielo?.minIntensity || 0.25
        intensity = Math.max(intensity, minIntensity)
        
        if (zoneType === 'spot') {
          // 🪞 ESPEJO CROMÁTICO: LEFT Rosa, RIGHT Cian
          if (side === 'left') {
            // 💗 LEFT: Rosa Aurora
            h = 330 + (entropy * 20) // Rosa (330-350)
            s = 85
            l = 60
          } else {
            // 🩵 RIGHT: Cian Hielo
            h = 185 + (entropy * 15) // Cian (185-200)
            s = 100
            l = 55
          }
          break
        }
        
        // PARs: Azul profundo
        h = 210 + (timeDrift * 15) // Azul (210-225)
        s = 85 - (intensity * 10)
        l = Math.max(45, 35 + (intensity * 35))
        break
      }
      
      // -----------------------------------------------------------------------
      // ?? SELVA (Tropical Storm) - Verde + Magenta/Dorado alternante en m�viles
      // -----------------------------------------------------------------------
      case 'selva': {
        if (zoneType === 'spot') {
          // ESPEJO CROMATICO: LEFT y RIGHT siempre diferentes
          if (side === 'left') {
            // LEFT: Magenta Orquidea
            h = 320 + (entropy * 25)
            s = 100
            l = 58
          } else {
            // RIGHT: Amarillo Sol Tropical
            h = 58 + (entropy * 6)
            s = 95
            l = 70
          }
          break
        }
        
        // PARs: Verde selva
        h = 120 + (timeDrift * 25) - (intensity * 20)
        s = 85 + (intensity * 15)
        l = Math.max(40, 30 + (intensity * 30))
        break
      }
      
      // -----------------------------------------------------------------------
      // NEON (Cyberpunk) - Ciclo lento 60s + transiciones suaves
      // -----------------------------------------------------------------------
      case 'neon': {
        // Ciclo de 60 segundos (era 10s - muy fren�tico)
        const cycleTime = Date.now() / 60000
        const cycleProgress = cycleTime % 1 // 0-1 a lo largo de 60s
        const cycleIndex = Math.floor(cycleTime) % 4
        const nextCycleIndex = (cycleIndex + 1) % 4
        
        const colorPairs = [
          { primary: 300, accent: 180 },  // Magenta ? Cian
          { primary: 180, accent: 330 },  // Cian ? Rosa Hot
          { primary: 270, accent: 120 },  // P�rpura ? VERDE L�SER ??
          { primary: 120, accent: 300 },  // Verde ? Magenta
        ]
        
        const currentPair = colorPairs[cycleIndex]
        const nextPair = colorPairs[nextCycleIndex]
        
        // Transici�n suave entre ciclos (�ltimos 20% del ciclo)
        const transitionStart = 0.8
        let blendFactor = 0
        if (cycleProgress > transitionStart) {
          blendFactor = (cycleProgress - transitionStart) / (1 - transitionStart)
        }
        
        if (zoneType === 'spot') {
          // 🪞 ESPEJO CROMÁTICO: LEFT usa accent, RIGHT usa primary (complementario)
          const currentHue = side === 'left' ? currentPair.accent : currentPair.primary
          const nextHue = side === 'left' ? nextPair.accent : nextPair.primary
          h = this.lerpHue(currentHue, nextHue, blendFactor)
          s = 95
          l = 55
          break
        }
        
        // PARs: Color principal con transici�n suave
        const currentHuePar = currentPair.primary
        const nextHuePar = nextPair.primary
        h = this.lerpHue(currentHuePar, nextHuePar, blendFactor)
        s = 100
        l = Math.max(50, 45 + (intensity * 25))
        break
      }
      
      default: 
        h = 20; s = 90; l = 50
    }
    
    if (side === 'back') {
      h = (h - 15 + 360) % 360
    }
    
    h = ((h % 360) + 360) % 360
    s = Math.max(0, Math.min(100, s))
    l = Math.max(0, Math.min(100, l))
    
    // -----------------------------------------------------------------------
    // ?? YELLOW BRILLIANCE FIX V4: Solo aplicar si L es bajo
    // El amarillo necesita L:65-75% para brillar, pero NO m�s
    // HSL(60, 95, 50) = verde oliva ??
    // HSL(60, 95, 70) = AMARILLO SOL ??
    // HSL(60, 95, 90) = BLANCO ??
    // -----------------------------------------------------------------------
    if (h >= 40 && h <= 75) {
      // ZONA AMARILLA/LIMA: Ajustar luminosidad al rango �ptimo
      
      // 1. Centrar en amarillo puro (H:58-65)
      if (h < 55) h = 55 + (h - 40) * 0.2  // 40-55 ? 55-58
      if (h > 68) h = 68 - (75 - h) * 0.3  // 68-75 ? 65-68
      
      // 2. Luminosidad en rango �PTIMO: 65-75% (ni m�s ni menos)
      if (l < 65) l = 65      // M�nimo 65% (evitar verde moco)
      if (l > 75) l = 75      // M�ximo 75% (evitar blanco)
      
      // 3. Saturaci�n 90-95% (no 100% que se ve artificial)
      s = Math.max(90, Math.min(95, s))
    }
    
    return this.hslToRgb(h / 360, s / 100, l / 100)
  }
  
  /**
   * Interpola entre dos hues (maneja el wrap-around del c�rculo crom�tico)
   */
  private lerpHue(from: number, to: number, t: number): number {
    const diff = to - from
    if (Math.abs(diff) > 180) {
      // Ir por el camino corto
      if (diff > 0) {
        from += 360
      } else {
        to += 360
      }
    }
    return ((from + (to - from) * t) + 360) % 360
  }

  getSystemEntropy(seedOffset: number = 0): number {
    const time = Date.now()
    const audioNoise = (this.personality.energy * 1000) % 1
    const combinedSeed = time * 0.001 + audioNoise * 100 + seedOffset * 7.3
    const entropy = (Math.sin(combinedSeed) + Math.cos(combinedSeed * 0.7) + 2) / 4
    
    this.entropyState.timeSeed = (time % 100000) / 100000
    this.entropyState.audioSeed = audioNoise
    
    return Math.max(0, Math.min(1, entropy))
  }

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
    
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) }
  }

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
      saturation: 0.9,
    }
  }

  private boostColor(color: RGBColor, factor: number): RGBColor {
    return {
      r: Math.min(255, Math.round(color.r * factor)),
      g: Math.min(255, Math.round(color.g * factor)),
      b: Math.min(255, Math.round(color.b * factor)),
    }
  }

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

  setPalette(palette: LivingPaletteId): void {
    if (this.activePalette === palette) return
    this.targetPalette = palette
    this.transitionProgress = 0
  }
  
  setPaletteImmediate(palette: LivingPaletteId): void {
    this.activePalette = palette
    this.targetPalette = null
    this.transitionProgress = 1
  }

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

  getCurrentPalette(): LivingPaletteId {
    return this.activePalette
  }

  getPaletteState(): PaletteState {
    return {
      id: this.activePalette,
      colors: this.getPaletteHexColors(),
      saturation: 0.9,
      intensity: 1.0,
      temperature: this.getPaletteTemperature(),
    }
  }

  private getPaletteHexColors(): string[] {
    const colors = this.calculateZoneColors(0.7)
    return [
      this.rgbToHex(colors.front),
      this.rgbToHex(colors.back),
      this.rgbToHex(colors.movingLeft),
      this.rgbToHex(colors.movingRight),
    ]
  }

  private getPaletteTemperature(): number {
    switch (this.activePalette) {
      case 'fuego': return 0.85
      case 'hielo': return 0.2
      case 'selva': return 0.5
      case 'neon': return 0.5
      default: return 0.5
    }
  }

  rgbToHex(color: RGBColor): string {
    return '#' + [color.r, color.g, color.b]
      .map(x => x.toString(16).padStart(2, '0'))
      .join('')
  }

  hexToRgb(hex: string): RGBColor {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    } : { r: 255, g: 255, b: 255 }
  }

  getMoodTemperature(mood: EmotionalTone): number {
    return this.moodToTemperature[mood] ?? 0.5
  }

  getElementColor(element: ElementType): RGBColor {
    return { ...this.elementToColor[element] }
  }
}
