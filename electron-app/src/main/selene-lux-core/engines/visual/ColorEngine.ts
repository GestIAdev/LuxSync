/**
 * COLOR ENGINE V15.2 - LIVING PALETTES
 * 
 * MIGRADO desde: demo/selene-integration.js - getLivingColor()
 * 
 * Genera colores PROCEDURALMENTE usando HSL:
 * - El color EVOLUCIONA con el tiempo (no es estatico)
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
      case 'fuego': {
        const baseDrift = Math.sin(timeDrift * Math.PI * 2) * 25
        let baseHue = 5 + baseDrift + (intensity * 20)
        
        if (zoneType === 'spot' && side === 'left') {
          if (intensity > 0.6) {
            baseHue = entropy > 0.5 ? 50 : 330
          }
        }

        h = baseHue
        const normH = ((h % 360) + 360) % 360
        if (normH > 55 && normH < 280) h = 20

        s = 90 + (intensity * 10)
        l = 25 + (intensity * 40)

        if (zoneType === 'spot' && side === 'right' && intensity > 0.7) {
          h = 280; s = 85; l = 50
        }
        break
      }
      
      case 'hielo': {
        const minIntensity = this.PALETTES.hielo?.minIntensity || 0.25
        intensity = Math.max(intensity, minIntensity)
        h = 200 + (timeDrift * 20) + (intensity * 10)
        s = 90 - (intensity * 20)
        l = 40 + (intensity * 45)
        
        if (zoneType === 'spot' && side === 'right' && intensity > 0.5) {
          h = 330; s = 80; l = 55 + (intensity * 15)
        }
        
        if (zoneType === 'wash' && intensity > 0.6 && entropy > 0.7) {
          h = 170 + (entropy * 20); s = 70
        }
        break
      }
      
      case 'selva': {
        h = 140 - (intensity * 95) + (timeDrift * 10)
        
        if (h < 60) {
          l = 45 + (intensity * 30)
        } else {
          l = 30 + (intensity * 25)
        }
        s = 80 + (intensity * 20)
        
        if (zoneType === 'spot' && intensity > 0.75) {
          h = 320 + (entropy * 30); s = 90; l = 50
        }
        break
      }
      
      case 'neon': {
        if (intensity < 0.3) return { r: 0, g: 0, b: 0 }
        
        const cycle = Math.floor(Date.now() / 10000) % 4
        const colorPairs = [
          { primary: 120, secondary: 280 },
          { primary: 310, secondary: 180 },
          { primary: 270, secondary: 110 },
          { primary: 220, secondary: 250 },
        ]
        
        const pair = colorPairs[cycle]
        const isSecondary = (side === 'right' || zoneType === 'spot') 
          ? entropy > 0.3 
          : entropy > 0.7
        
        h = isSecondary ? pair.secondary : pair.primary
        s = 100
        l = 50 + (intensity * 15)
        
        if (intensity > 0.95) l = 100
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
    
    return this.hslToRgb(h / 360, s / 100, l / 100)
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
