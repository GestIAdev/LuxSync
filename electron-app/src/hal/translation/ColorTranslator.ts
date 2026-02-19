/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎨 WAVE 1000: COLOR TRANSLATOR - EL INTÉRPRETE
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Traduce intenciones artísticas (RGB) a realidades físicas (DMX).
 * 
 * PROBLEMA QUE RESUELVE:
 * Selene sueña en "#00FFFF" (Cian Cyberpunk), pero el Beam 2R solo
 * tiene 8 colores fijos en su rueda. ¿Qué hacemos?
 * 
 * SOLUCIÓN:
 * 1. Calculamos la "distancia" del color pedido a cada color de la rueda
 * 2. Elegimos el color más cercano (vecino más próximo)
 * 3. Enviamos el DMX de ese color
 * 
 * ALGORITMOS DE DISTANCIA:
 * - Euclidiana RGB: Simple pero no perceptualmente uniforme
 * - CIE Delta E 2000: Perceptualmente uniforme, más complejo
 * - Usamos RGB por eficiencia (suficiente para ruedas de 8-12 colores)
 * 
 * @module hal/translation/ColorTranslator
 * @version WAVE 1000
 */

import { 
  type FixtureProfile, 
  type WheelColor,
  type ColorWheelDefinition,
  needsColorTranslation,
} from './FixtureProfiles'

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════════════

export interface RGB {
  r: number  // 0-255
  g: number  // 0-255
  b: number  // 0-255
}

export interface ColorTranslationResult {
  /** El color de destino (pass-through para RGB, traducido para wheel) */
  outputRGB: RGB
  /** Valor DMX para canal de color wheel (solo si es wheel) */
  colorWheelDmx?: number
  /** Nombre del color seleccionado (solo si es wheel) */
  colorName?: string
  /** Distancia al color original (0 = perfecto, mayor = más lejano) */
  colorDistance: number
  /** Si se aplicó traducción */
  wasTranslated: boolean
  /** Si el color es muy diferente al pedido (puede ser mejor usar blanco) */
  poorMatch: boolean
}

// ═══════════════════════════════════════════════════════════════════════════
// ALGORITMOS DE DISTANCIA DE COLOR
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Distancia Euclidiana en espacio RGB
 * 
 * Simple y rápida. Suficiente para ruedas de pocos colores.
 * No es perceptualmente uniforme (verde se percibe diferente a rojo)
 * pero para nuestro caso (8-12 colores) funciona bien.
 * 
 * Distancia máxima posible: sqrt(255² + 255² + 255²) ≈ 441.67
 */
function rgbDistance(c1: RGB, c2: RGB): number {
  const dr = c1.r - c2.r
  const dg = c1.g - c2.g
  const db = c1.b - c2.b
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

/**
 * Distancia ponderada perceptualmente
 * 
 * Los humanos son más sensibles al verde, luego al rojo, luego al azul.
 * Esta fórmula compensa esa diferencia.
 */
function weightedRgbDistance(c1: RGB, c2: RGB): number {
  const dr = c1.r - c2.r
  const dg = c1.g - c2.g
  const db = c1.b - c2.b
  
  // Pesos basados en sensibilidad humana
  const rWeight = 0.299
  const gWeight = 0.587
  const bWeight = 0.114
  
  return Math.sqrt(
    rWeight * dr * dr +
    gWeight * dg * dg +
    bWeight * db * db
  )
}

/**
 * Calcula la luminosidad percibida de un color
 */
function getLuminance(c: RGB): number {
  return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b
}

/**
 * Calcula la saturación aproximada de un color
 */
function getSaturation(c: RGB): number {
  const max = Math.max(c.r, c.g, c.b)
  const min = Math.min(c.r, c.g, c.b)
  if (max === 0) return 0
  return (max - min) / max
}

// ═══════════════════════════════════════════════════════════════════════════
// COLOR TRANSLATOR CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class ColorTranslator {
  // Cache de traducciones para evitar recalcular cada frame
  private translationCache = new Map<string, ColorTranslationResult>()
  
  // Umbral de "poor match" - si la distancia supera esto, es mejor usar blanco
  // 441 es la distancia máxima (negro a blanco), usamos ~40% como umbral
  private readonly POOR_MATCH_THRESHOLD = 180
  
  // Tamaño máximo del cache
  private readonly MAX_CACHE_SIZE = 256
  
  constructor() {
    console.log('[ColorTranslator] 🎨 WAVE 1000: Initialized')
  }
  
  /**
   * 🎯 MÉTODO PRINCIPAL: Traduce un color RGB al formato físico del fixture
   * 
   * @param targetRGB - Color que Selene quiere
   * @param profile - Perfil del fixture (define sus capacidades)
   * @returns Resultado de la traducción
   */
  public translate(targetRGB: RGB, profile: any): ColorTranslationResult {
   
    // CASO 1: Sin perfil
    if (!profile) {
      return { outputRGB: targetRGB, colorDistance: 0, wasTranslated: false, poorMatch: false }
    }
    
    // 🚑 WAVE 2058: EXTRACCIÓN SEGURA (Puente entre Forja V1 y V2)
    // Detectamos si es un fixture de rueda mirando en el formato nuevo y en el viejo
    const isWheelEngine = profile.capabilities?.colorEngine === 'wheel' || 
                          profile.colorEngine === 'wheel' ||
                          profile.colorEngine?.mixing === 'wheel';
                          
    // Buscamos dónde están guardados los colores exactamente
    const colorWheel = profile.capabilities?.colorWheel || 
                       profile.wheels || 
                       profile.colorEngine?.colorWheel;

    const hasWheelData = colorWheel && colorWheel.colors && colorWheel.colors.length > 0;

    // CASO 2: Si es RGB puro (no es rueda), pass-through directo sin tocar el DMX
    if (!isWheelEngine && !hasWheelData) {
      return { outputRGB: targetRGB, colorDistance: 0, wasTranslated: false, poorMatch: false }
    }
    
    // CASO 3: Es rueda, pero está vacía (Fallback a blanco)
    if (!hasWheelData) {
      console.warn(`[ColorTranslator] ⚠️ Profile ${profile.id} is 'wheel' but has no colors mapped`)
      return {
        outputRGB: { r: 255, g: 255, b: 255 },
        colorWheelDmx: 0,
        colorName: 'Open (Fallback)',
        colorDistance: 441,
        wasTranslated: true,
        poorMatch: true,
      }
    }
    
    // CASO 4: Traducción real a la rueda (Encontramos los datos)
    const cacheKey = this.getCacheKey(targetRGB, profile.id)
    const cached = this.translationCache.get(cacheKey)
    if (cached) return cached
    
    // Buscar el color más cercano usando nuestro array de colores
    const result = this.findNearestColor(targetRGB, colorWheel)
    this.cacheResult(cacheKey, result)
    
    return result
  }
  
  /**
   * 🔍 Busca el color más cercano en la rueda
   */
  private findNearestColor(target: RGB, wheel: ColorWheelDefinition): ColorTranslationResult {
    let nearestColor: WheelColor = wheel.colors[0]
    let smallestDistance = Infinity
    
    for (const wheelColor of wheel.colors) {
      // Usamos distancia ponderada para mejor percepción
      const distance = weightedRgbDistance(target, wheelColor.rgb)
      
      if (distance < smallestDistance) {
        smallestDistance = distance
        nearestColor = wheelColor
      }
    }
    
    // Determinar si es un "poor match"
    const poorMatch = smallestDistance > this.POOR_MATCH_THRESHOLD
    
    // Si es muy malo el match y el color pedido es saturado, considerar alternativas
    let finalColor = nearestColor
    if (poorMatch && getSaturation(target) < 0.3) {
      // Color poco saturado + poor match = probablemente mejor usar blanco
      const whiteColor = wheel.colors.find(c => c.name.toLowerCase().includes('white') || c.name.toLowerCase().includes('open'))
      if (whiteColor) {
        finalColor = whiteColor
        smallestDistance = weightedRgbDistance(target, whiteColor.rgb)
      }
    }
    
    return {
      outputRGB: finalColor.rgb,
      colorWheelDmx: finalColor.dmx,
      colorName: finalColor.name,
      colorDistance: smallestDistance,
      wasTranslated: true,
      poorMatch,
    }
  }
  
  /**
   * 🎲 Genera una clave de cache
   */
  private getCacheKey(rgb: RGB, profileId: string): string {
    // Cuantizamos el color para aumentar hits de cache
    // (colores muy similares comparten resultado)
    const qr = Math.round(rgb.r / 8) * 8
    const qg = Math.round(rgb.g / 8) * 8
    const qb = Math.round(rgb.b / 8) * 8
    return `${profileId}:${qr},${qg},${qb}`
  }
  
  /**
   * 💾 Guarda resultado en cache con límite de tamaño
   */
  private cacheResult(key: string, result: ColorTranslationResult): void {
    // Evitar que el cache crezca infinitamente
    if (this.translationCache.size >= this.MAX_CACHE_SIZE) {
      // Eliminar el primer elemento (LRU simple)
      const firstKey = this.translationCache.keys().next().value
      if (firstKey) {
        this.translationCache.delete(firstKey)
      }
    }
    this.translationCache.set(key, result)
  }
  
  /**
   * 🧹 Limpia el cache de traducciones
   */
  public clearCache(): void {
    this.translationCache.clear()
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // MÉTODOS DE UTILIDAD
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Obtiene todos los colores disponibles en un perfil
   */
  public getAvailableColors(profile: any): WheelColor[] {
    const colorWheel = profile?.capabilities?.colorWheel || profile?.wheels || profile?.colorEngine?.colorWheel;
    
    if (colorWheel && colorWheel.colors && colorWheel.colors.length > 0) {
      return colorWheel.colors;
    }
    
    // Para RGB, devolvemos colores primarios y secundarios como referencia
    return [
      { dmx: 0,   name: 'Red',     rgb: { r: 255, g: 0,   b: 0   } },
      { dmx: 0,   name: 'Green',   rgb: { r: 0,   g: 255, b: 0   } },
      { dmx: 0,   name: 'Blue',    rgb: { r: 0,   g: 0,   b: 255 } },
      { dmx: 0,   name: 'Yellow',  rgb: { r: 255, g: 255, b: 0   } },
      { dmx: 0,   name: 'Cyan',    rgb: { r: 0,   g: 255, b: 255 } },
      { dmx: 0,   name: 'Magenta', rgb: { r: 255, g: 0,   b: 255 } },
      { dmx: 0,   name: 'White',   rgb: { r: 255, g: 255, b: 255 } },
    ]
  }
  
  /**
   * Debug: muestra la distancia de un color a cada color de la rueda
   */
  public debugDistances(target: RGB, profile: FixtureProfile): void {
    const colors = this.getAvailableColors(profile)
    console.log(`[ColorTranslator] 🔬 Distances from RGB(${target.r}, ${target.g}, ${target.b}):`)
    
    for (const color of colors) {
      const dist = weightedRgbDistance(target, color.rgb)
      const bar = '█'.repeat(Math.round(dist / 10))
      console.log(`  ${color.name.padEnd(15)} DMX:${color.dmx.toString().padStart(3)} | Distance: ${dist.toFixed(1).padStart(6)} | ${bar}`)
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON EXPORT
// ═══════════════════════════════════════════════════════════════════════════

let instance: ColorTranslator | null = null

export function getColorTranslator(): ColorTranslator {
  if (!instance) {
    instance = new ColorTranslator()
  }
  return instance
}
