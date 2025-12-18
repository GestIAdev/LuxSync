/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎨 FRONTEND COLOR ENGINE - WAVE 34.1: Living Palette Generator (Lightweight)
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Esta es una versión ligera del ColorEngine del backend, diseñada para
 * correr en el renderer process y dar feedback visual instantáneo.
 * 
 * Genera colores "vivos" basados en:
 * - Paleta activa (fuego, hielo, selva, neon)
 * - Zona del fixture (front, back, left, right)
 * - Tiempo (drift suave para evolución)
 * - Intensidad
 * 
 * @module utils/frontendColorEngine
 * @version 34.1.0
 */

import { LivingPaletteId } from '../stores/controlStore'

export interface RGBColor {
  r: number
  g: number
  b: number
}

export type ZoneType = 'wash' | 'spot'
export type Side = 'left' | 'right' | 'front' | 'back'

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/** Convert HSL to RGB */
function hslToRgb(h: number, s: number, l: number): RGBColor {
  let r: number, g: number, b: number

  if (s === 0) {
    r = g = b = l
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
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

/** Simple deterministic noise based on seed */
function noise(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}

/** 
 * 🔄 WAVE 34.5: Lerp Hue through shortest path on color wheel
 * Handles 0-360 wraparound properly (e.g., red to magenta goes through pink, not cyan)
 */
function lerpHue(h1: number, h2: number, t: number): number {
  // Normalize to 0-360
  h1 = ((h1 % 360) + 360) % 360
  h2 = ((h2 % 360) + 360) % 360
  
  // Calculate the difference
  let diff = h2 - h1
  
  // If the difference is more than 180, go the other way
  if (diff > 180) {
    diff -= 360
  } else if (diff < -180) {
    diff += 360
  }
  
  // Interpolate
  let result = h1 + diff * t
  
  // Normalize result to 0-360
  return ((result % 360) + 360) % 360
}

/** Linear interpolation */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

// ═══════════════════════════════════════════════════════════════════════════
// PALETTE GENERATORS
// ═══════════════════════════════════════════════════════════════════════════

interface HSLResult {
  h: number
  s: number
  l: number
}

/** 🔥 FUEGO: Warm reds, oranges, yellows */
function calculateFuego(
  zoneType: ZoneType,
  side: Side,
  timeDrift: number,
  intensity: number
): HSLResult {
  // Base hue: 0 (red) to 60 (yellow)
  let baseHue = 15 // Orange center
  
  // Zone variation
  if (side === 'left') {
    baseHue = 0 + timeDrift * 20 // Red end, drifts towards orange
  } else if (side === 'right') {
    baseHue = 40 + timeDrift * 15 // Orange-Yellow end
  } else if (side === 'front') {
    baseHue = 10 + timeDrift * 25 // Red-orange, wider drift
  } else if (side === 'back') {
    baseHue = 30 + timeDrift * 20 // More orange
  }
  
  // Spot fixtures get more saturated, narrower hue
  const saturation = zoneType === 'spot' ? 100 : 90
  const luminosity = 45 + intensity * 20
  
  return { h: baseHue, s: saturation, l: luminosity }
}

/** ❄️ HIELO: Cold blues with aurora accents */
function calculateHielo(
  zoneType: ZoneType,
  side: Side,
  timeDrift: number,
  intensity: number
): HSLResult {
  // Base hue: 180 (cyan) to 270 (purple-blue)
  let baseHue = 200 // Blue center
  
  // Zone variation - aurora effect
  if (side === 'left') {
    baseHue = 180 + timeDrift * 30 // Cyan → Blue
  } else if (side === 'right') {
    baseHue = 240 + timeDrift * 40 // Blue → Pink aurora
  } else if (side === 'front') {
    baseHue = 190 + timeDrift * 20 // Stable cyan-blue
  } else if (side === 'back') {
    baseHue = 260 + timeDrift * 50 // Purple → Pink drift
  }
  
  const saturation = zoneType === 'spot' ? 85 : 75
  const luminosity = 50 + intensity * 15
  
  return { h: baseHue % 360, s: saturation, l: luminosity }
}

/** 🌴 SELVA: Tropical greens with magenta/gold accents */
function calculateSelva(
  zoneType: ZoneType,
  side: Side,
  timeDrift: number,
  intensity: number
): HSLResult {
  // Base hue: 90 (yellow-green) to 160 (cyan-green) with magenta accents
  let baseHue = 120 // Green center
  
  // Zone variation
  if (side === 'left') {
    baseHue = 100 + timeDrift * 40 // Yellow-green → Green
  } else if (side === 'right') {
    // Magenta accent on right side
    baseHue = timeDrift > 0.7 ? 300 + (timeDrift - 0.7) * 100 : 140 + timeDrift * 30
  } else if (side === 'front') {
    baseHue = 130 + timeDrift * 25 // Pure tropical green
  } else if (side === 'back') {
    // Gold accent on back
    baseHue = timeDrift > 0.8 ? 45 : 110 + timeDrift * 30
  }
  
  const saturation = zoneType === 'spot' ? 95 : 85
  const luminosity = 45 + intensity * 20
  
  return { h: baseHue % 360, s: saturation, l: luminosity }
}

/** ⚡ NEON: Cyberpunk cycling colors */
function calculateNeon(
  zoneType: ZoneType,
  side: Side,
  timeDrift: number,
  intensity: number
): HSLResult {
  // Cycle through magenta → cyan → green → back
  const cycleSpeed = 60000 // 60 second full cycle
  const cyclePosition = ((Date.now() % cycleSpeed) / cycleSpeed) * 360
  
  // Side offset creates wave effect
  let offset = 0
  if (side === 'left') offset = 0
  else if (side === 'right') offset = 90
  else if (side === 'front') offset = 180
  else if (side === 'back') offset = 270
  
  const baseHue = (cyclePosition + offset) % 360
  
  // Neon is always high saturation
  const saturation = 100
  const luminosity = 50 + intensity * 10
  
  return { h: baseHue, s: saturation, l: luminosity }
}

/**
 * 🎨 WAVE 34.5: Calculate HSL for any palette (extracted helper)
 * Used for blending between palettes during transitions
 */
function calculatePaletteHSL(
  palette: LivingPaletteId,
  zoneType: ZoneType,
  side: Side,
  timeDrift: number,
  intensity: number
): HSLResult {
  switch (palette) {
    case 'fuego':
      return calculateFuego(zoneType, side, timeDrift, intensity)
    case 'hielo':
      return calculateHielo(zoneType, side, timeDrift, intensity)
    case 'selva':
      return calculateSelva(zoneType, side, timeDrift, intensity)
    case 'neon':
      return calculateNeon(zoneType, side, timeDrift, intensity)
    default:
      return calculateFuego(zoneType, side, timeDrift, intensity)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🎨 Get a "living" color for a fixture based on palette, zone, and time
 * WAVE 34.5: Now supports smooth transitions between palettes
 * 
 * @param palette - Active palette ID (source)
 * @param intensity - Light intensity 0-1
 * @param zone - Fixture zone (determines color variation)
 * @param globalSaturation - Global saturation modifier 0-1
 * @param targetPalette - Target palette during transition (optional)
 * @param transitionProgress - Transition progress 0-1 (optional)
 * @returns RGB color
 */
export function getLivingColor(
  palette: LivingPaletteId,
  intensity: number = 1,
  zone: Side = 'front',
  globalSaturation: number = 1,
  targetPalette: LivingPaletteId | null = null,
  transitionProgress: number = 1
): RGBColor {
  // Time drift for smooth evolution
  const driftSpeed = 15000 // 15 second cycle
  const timeDrift = (Date.now() / driftSpeed) % 1
  
  // Determine zone type from zone position
  const zoneType: ZoneType = (zone === 'left' || zone === 'right') ? 'spot' : 'wash'
  
  // Calculate source palette HSL
  const sourceHSL = calculatePaletteHSL(palette, zoneType, zone, timeDrift, intensity)
  
  let finalHSL: HSLResult
  
  // 🔄 WAVE 34.5: Blend between palettes during transition
  if (targetPalette && transitionProgress < 1) {
    const targetHSL = calculatePaletteHSL(targetPalette, zoneType, zone, timeDrift, intensity)
    
    // Interpolate HSL using lerpHue for Hue (shortest path on color wheel)
    finalHSL = {
      h: lerpHue(sourceHSL.h, targetHSL.h, transitionProgress),
      s: lerp(sourceHSL.s, targetHSL.s, transitionProgress),
      l: lerp(sourceHSL.l, targetHSL.l, transitionProgress),
    }
  } else {
    finalHSL = sourceHSL
  }
  
  // Apply global saturation
  finalHSL.s = finalHSL.s * globalSaturation
  
  // Convert to RGB
  return hslToRgb(finalHSL.h / 360, finalHSL.s / 100, finalHSL.l / 100)
}

/**
 * Map fixture zone string to Side type
 */
export function mapZoneToSide(zone: string): Side {
  const zoneUpper = (zone || '').toUpperCase()
  
  if (zoneUpper.includes('LEFT')) return 'left'
  if (zoneUpper.includes('RIGHT')) return 'right'
  if (zoneUpper.includes('FRONT')) return 'front'
  if (zoneUpper.includes('BACK')) return 'back'
  
  // Default based on common naming
  return 'front'
}
