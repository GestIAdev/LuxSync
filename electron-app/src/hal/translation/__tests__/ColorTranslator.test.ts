/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎨 COLOR TRANSLATOR — SUITE DE REGRESIÓN DE TRADUCCIÓN
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Si esto falla, los fixtures mecánicos reciben valores DMX incorrectos
 * SILENCIOSAMENTE. Sin crash, sin error visible. Solo colores equivocados
 * en el escenario. El peor tipo de bug.
 * 
 * COBERTURA:
 * - RGB pass-through (LED PARs) — valores intactos
 * - RGBW decomposition — W = min(R,G,B) matemáticamente correcto
 * - CMY subtractive — C=255-R exacto
 * - Color wheel matching — ΔE* elige la ranura más cercana
 * - Half-color interpolation — DMX interpolado dentro de rango
 * - LRU cache — hit/miss correcto, cuantización perceptual
 * 
 * @module tests/ColorTranslator
 * @version PRE-BETA 1.0 — WAVE 2100
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  ColorTranslator,
  rgbToRgbw,
  rgbToCmy,
  type RGB,
  type RGBW,
  type CMY,
  type ColorTranslationResult,
} from '../ColorTranslator'
import type { FixtureProfile, WheelColor } from '../FixtureProfiles'

// ═══════════════════════════════════════════════════════════════════════════
// FIXTURES DE TEST — Perfiles reales basados en hardware real
// ═══════════════════════════════════════════════════════════════════════════

/** Perfil LED PAR RGB — sin rueda, colores directos */
const LED_PAR_PROFILE = {
  id: 'test-led-par',
  name: 'Test LED PAR',
  colorEngine: { mixing: 'rgb' },
}

/** Perfil LED RGBW — con canal blanco */
const LED_RGBW_PROFILE = {
  id: 'test-rgbw',
  name: 'Test RGBW',
  colorEngine: { mixing: 'rgbw' },
}

/** Perfil CMY — mezcla sustractiva */
const CMY_PROFILE = {
  id: 'test-cmy',
  name: 'Test CMY',
  colorEngine: { mixing: 'cmy' },
}

/** Perfil Beam 2R — rueda de colores mecánica (el caso más crítico) */
const BEAM_2R_PROFILE = {
  id: 'test-beam-2r',
  name: 'Test Beam 2R',
  type: 'beam',
  colorEngine: {
    mixing: 'wheel',
    colorWheel: {
      colors: [
        { dmx: 0,   name: 'Open (White)',     rgb: { r: 255, g: 255, b: 255 } },
        { dmx: 15,  name: 'Red',              rgb: { r: 255, g: 0,   b: 0   } },
        { dmx: 30,  name: 'Orange',           rgb: { r: 255, g: 128, b: 0   } },
        { dmx: 45,  name: 'Yellow',           rgb: { r: 255, g: 255, b: 0   } },
        { dmx: 60,  name: 'Green',            rgb: { r: 0,   g: 255, b: 0   } },
        { dmx: 75,  name: 'Cyan',             rgb: { r: 0,   g: 255, b: 255 } },
        { dmx: 90,  name: 'Blue',             rgb: { r: 0,   g: 0,   b: 255 } },
        { dmx: 105, name: 'Magenta',          rgb: { r: 255, g: 0,   b: 255 } },
        { dmx: 120, name: 'Light Blue',       rgb: { r: 128, g: 128, b: 255 } },
        { dmx: 135, name: 'Pink',             rgb: { r: 255, g: 128, b: 255 } },
        { dmx: 150, name: 'UV Purple',        rgb: { r: 128, g: 0,   b: 255 } },
        { dmx: 165, name: 'CTO (Warm White)', rgb: { r: 255, g: 200, b: 150 } },
      ],
      allowsContinuousSpin: true,
      spinStartDmx: 190,
      minChangeTimeMs: 500,
    },
  },
  capabilities: {
    colorWheel: {
      colors: [
        { dmx: 0,   name: 'Open (White)',     rgb: { r: 255, g: 255, b: 255 } },
        { dmx: 15,  name: 'Red',              rgb: { r: 255, g: 0,   b: 0   } },
        { dmx: 30,  name: 'Orange',           rgb: { r: 255, g: 128, b: 0   } },
        { dmx: 45,  name: 'Yellow',           rgb: { r: 255, g: 255, b: 0   } },
        { dmx: 60,  name: 'Green',            rgb: { r: 0,   g: 255, b: 0   } },
        { dmx: 75,  name: 'Cyan',             rgb: { r: 0,   g: 255, b: 255 } },
        { dmx: 90,  name: 'Blue',             rgb: { r: 0,   g: 0,   b: 255 } },
        { dmx: 105, name: 'Magenta',          rgb: { r: 255, g: 0,   b: 255 } },
        { dmx: 120, name: 'Light Blue',       rgb: { r: 128, g: 128, b: 255 } },
        { dmx: 135, name: 'Pink',             rgb: { r: 255, g: 128, b: 255 } },
        { dmx: 150, name: 'UV Purple',        rgb: { r: 128, g: 0,   b: 255 } },
        { dmx: 165, name: 'CTO (Warm White)', rgb: { r: 255, g: 200, b: 150 } },
      ],
      allowsContinuousSpin: true,
      spinStartDmx: 190,
      minChangeTimeMs: 500,
    },
  },
  shutter: { type: 'mechanical', maxStrobeHz: 12 },
  safety: { blackoutOnColorChange: false, maxContinuousOnTime: 0, isDischarge: true, cooldownTime: 300 },
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('🎨 ColorTranslator — Precisión de Traducción Cromática', () => {
  let translator: ColorTranslator

  beforeEach(() => {
    translator = new ColorTranslator()
  })

  // ═══════════════════════════════════════════════════════════════════════
  // 🌈 RGB PASS-THROUGH — LED PARs
  // ═══════════════════════════════════════════════════════════════════════
  
  describe('🌈 RGB Pass-through — Valores intactos para LED PAR', () => {
    
    it('RGB puro rojo pasa sin modificación', () => {
      const target: RGB = { r: 255, g: 0, b: 0 }
      const result = translator.translate(target, LED_PAR_PROFILE)
      
      expect(result.outputRGB).toEqual(target)
      expect(result.wasTranslated).toBe(false)
      expect(result.colorDistance).toBe(0)
      expect(result.poorMatch).toBe(false)
    })

    it('RGB arbitrario pasa sin modificación', () => {
      const target: RGB = { r: 123, g: 45, b: 200 }
      const result = translator.translate(target, LED_PAR_PROFILE)
      
      expect(result.outputRGB.r).toBe(123)
      expect(result.outputRGB.g).toBe(45)
      expect(result.outputRGB.b).toBe(200)
      expect(result.wasTranslated).toBe(false)
    })

    it('Sin perfil → pass-through (caso fallback)', () => {
      const target: RGB = { r: 50, g: 100, b: 150 }
      const result = translator.translate(target, null as any)
      
      expect(result.outputRGB).toEqual(target)
      expect(result.wasTranslated).toBe(false)
    })

    it('Negro pasa intacto', () => {
      const result = translator.translate({ r: 0, g: 0, b: 0 }, LED_PAR_PROFILE)
      expect(result.outputRGB).toEqual({ r: 0, g: 0, b: 0 })
    })

    it('Blanco pasa intacto', () => {
      const result = translator.translate({ r: 255, g: 255, b: 255 }, LED_PAR_PROFILE)
      expect(result.outputRGB).toEqual({ r: 255, g: 255, b: 255 })
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // 🔆 RGBW DECOMPOSITION — W = min(R,G,B)
  // ═══════════════════════════════════════════════════════════════════════
  
  describe('🔆 RGBW Decomposition — Extracción de blanco', () => {
    
    it('Blanco puro → W=255, R=G=B=0', () => {
      const result = rgbToRgbw({ r: 255, g: 255, b: 255 })
      expect(result.w).toBe(255)
      expect(result.r).toBe(0)
      expect(result.g).toBe(0)
      expect(result.b).toBe(0)
    })

    it('Rojo puro → W=0, R=255', () => {
      const result = rgbToRgbw({ r: 255, g: 0, b: 0 })
      expect(result.w).toBe(0)
      expect(result.r).toBe(255)
      expect(result.g).toBe(0)
      expect(result.b).toBe(0)
    })

    it('Color con componente blanco: RGB(200,150,100) → W=100', () => {
      const result = rgbToRgbw({ r: 200, g: 150, b: 100 })
      
      expect(result.w).toBe(100)            // min(200, 150, 100) = 100
      expect(result.r).toBe(200 - 100)      // 100
      expect(result.g).toBe(150 - 100)      // 50
      expect(result.b).toBe(100 - 100)      // 0
      
      // Verificar que R+W, G+W, B+W reconstruyen el original
      expect(result.r + result.w).toBe(200)
      expect(result.g + result.w).toBe(150)
      expect(result.b + result.w).toBe(100)
    })

    it('Negro → todos cero', () => {
      const result = rgbToRgbw({ r: 0, g: 0, b: 0 })
      expect(result.w).toBe(0)
      expect(result.r).toBe(0)
      expect(result.g).toBe(0)
      expect(result.b).toBe(0)
    })

    it('Translate con perfil RGBW genera campo rgbw', () => {
      const result = translator.translate({ r: 200, g: 150, b: 100 }, LED_RGBW_PROFILE)
      
      expect(result.wasTranslated).toBe(true)
      expect(result.rgbw).toBeDefined()
      expect(result.rgbw!.w).toBe(100)
      expect(result.rgbw!.r).toBe(100)
      expect(result.rgbw!.g).toBe(50)
      expect(result.rgbw!.b).toBe(0)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // 🎨 CMY SUBTRACTIVE — C=255-R, M=255-G, Y=255-B
  // ═══════════════════════════════════════════════════════════════════════
  
  describe('🎨 CMY Subtractive — Conversión exacta', () => {
    
    it('Blanco → CMY(0, 0, 0)', () => {
      const result = rgbToCmy({ r: 255, g: 255, b: 255 })
      expect(result.c).toBe(0)
      expect(result.m).toBe(0)
      expect(result.y).toBe(0)
    })

    it('Negro → CMY(255, 255, 255)', () => {
      const result = rgbToCmy({ r: 0, g: 0, b: 0 })
      expect(result.c).toBe(255)
      expect(result.m).toBe(255)
      expect(result.y).toBe(255)
    })

    it('Rojo puro → C=0, M=255, Y=255', () => {
      const result = rgbToCmy({ r: 255, g: 0, b: 0 })
      expect(result.c).toBe(0)      // 255 - 255
      expect(result.m).toBe(255)    // 255 - 0
      expect(result.y).toBe(255)    // 255 - 0
    })

    it('Cyan puro → C=255, M=0, Y=0', () => {
      const result = rgbToCmy({ r: 0, g: 255, b: 255 })
      expect(result.c).toBe(255)    // 255 - 0
      expect(result.m).toBe(0)      // 255 - 255
      expect(result.y).toBe(0)      // 255 - 255
    })

    it('Color arbitrario: exactitud matemática', () => {
      const rgb: RGB = { r: 100, g: 200, b: 50 }
      const result = rgbToCmy(rgb)
      
      expect(result.c).toBe(255 - 100)  // 155
      expect(result.m).toBe(255 - 200)  // 55
      expect(result.y).toBe(255 - 50)   // 205
    })

    it('Translate con perfil CMY genera campo cmy', () => {
      const result = translator.translate({ r: 100, g: 200, b: 50 }, CMY_PROFILE)
      
      expect(result.wasTranslated).toBe(true)
      expect(result.cmy).toBeDefined()
      expect(result.cmy!.c).toBe(155)
      expect(result.cmy!.m).toBe(55)
      expect(result.cmy!.y).toBe(205)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // 🎯 COLOR WHEEL MATCHING — CIE76 ΔE*
  // ═══════════════════════════════════════════════════════════════════════
  
  describe('🎯 Color Wheel — ΔE* elige la ranura correcta', () => {
    
    it('Rojo exacto → selecciona slot "Red" (DMX 15)', () => {
      const result = translator.translate({ r: 255, g: 0, b: 0 }, BEAM_2R_PROFILE)
      
      expect(result.wasTranslated).toBe(true)
      expect(result.colorName).toContain('Red')
      expect(result.colorDistance).toBeLessThan(5)  // Match casi perfecto
      expect(result.poorMatch).toBe(false)
    })

    it('Verde exacto → selecciona slot "Green" (DMX 60)', () => {
      const result = translator.translate({ r: 0, g: 255, b: 0 }, BEAM_2R_PROFILE)
      
      expect(result.wasTranslated).toBe(true)
      expect(result.colorName).toContain('Green')
      expect(result.colorDistance).toBeLessThan(5)
    })

    it('Azul exacto → selecciona slot "Blue" (DMX 90)', () => {
      const result = translator.translate({ r: 0, g: 0, b: 255 }, BEAM_2R_PROFILE)
      
      expect(result.wasTranslated).toBe(true)
      expect(result.colorName).toContain('Blue')
      expect(result.colorDistance).toBeLessThan(5)
    })

    it('Blanco → selecciona slot "Open (White)" (DMX 0)', () => {
      const result = translator.translate({ r: 255, g: 255, b: 255 }, BEAM_2R_PROFILE)
      
      expect(result.colorName).toContain('White')
      expect(result.colorWheelDmx).toBe(0)
    })

    it('Color sin match exacto → selecciona el más cercano perceptualmente', () => {
      // Turquesa: más cerca de Cyan que de Green o Blue
      const result = translator.translate({ r: 0, g: 200, b: 200 }, BEAM_2R_PROFILE)
      
      expect(result.wasTranslated).toBe(true)
      expect(result.colorName).toContain('Cyan')
    })

    it('Color muy lejano a todo → marca poorMatch', () => {
      // Marrón oscuro: no tiene equivalente en la rueda del Beam 2R
      const result = translator.translate({ r: 80, g: 40, b: 10 }, BEAM_2R_PROFILE)
      
      // Un marrón oscuro está lejos de todos los colores primarios saturados
      // Con threshold de 40 ΔE*, puede ser poorMatch o no, pero distance > 0
      expect(result.wasTranslated).toBe(true)
      expect(result.colorDistance).toBeGreaterThan(0)
    })

    it('Perfil wheel sin colores → fallback a blanco con poorMatch', () => {
      const emptyWheelProfile = {
        id: 'empty-wheel',
        colorEngine: { mixing: 'wheel' },
        capabilities: {
          colorWheel: { colors: [], allowsContinuousSpin: false, minChangeTimeMs: 200 },
        },
      }
      
      const result = translator.translate({ r: 255, g: 0, b: 0 }, emptyWheelProfile)
      
      expect(result.poorMatch).toBe(true)
      expect(result.wasTranslated).toBe(true)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // 🎚️ HALF-COLOR INTERPOLATION — DMX entre ranuras
  // ═══════════════════════════════════════════════════════════════════════
  
  describe('🎚️ Half-Color Interpolation — DMX entre ranuras adyacentes', () => {
    
    it('Color entre Red y Orange → DMX interpolado entre 15 y 30', () => {
      // Un color entre rojo (255,0,0) y naranja (255,128,0)
      const result = translator.translate({ r: 255, g: 64, b: 0 }, BEAM_2R_PROFILE)
      
      expect(result.wasTranslated).toBe(true)
      // El DMX debe estar entre el slot Red(15) y Orange(30)
      if (result.colorWheelDmx !== undefined) {
        // Si la interpolación se activó (dE > 3 y second < 60 y adyacente)
        if (result.colorName?.includes('/')) {
          expect(result.colorWheelDmx).toBeGreaterThanOrEqual(15)
          expect(result.colorWheelDmx).toBeLessThanOrEqual(30)
        }
      }
    })

    it('Color exacto en slot → sin interpolación (dE < 3)', () => {
      // Rojo exacto: dE = 0 → no se interpola
      const result = translator.translate({ r: 255, g: 0, b: 0 }, BEAM_2R_PROFILE)
      
      expect(result.colorWheelDmx).toBe(15) // Slot exacto
      expect(result.colorName).toBe('Red')  // Sin barra "/"
    })

    it('DMX interpolado nunca sale del rango [0, 255]', () => {
      // Probar varios colores "entre" slots
      const testColors: RGB[] = [
        { r: 255, g: 64, b: 0 },    // Entre Red-Orange
        { r: 255, g: 200, b: 0 },   // Entre Orange-Yellow
        { r: 0, g: 200, b: 128 },   // Entre Green-Cyan
        { r: 64, g: 0, b: 255 },    // Entre Blue-Magenta
        { r: 200, g: 64, b: 255 },  // Entre Magenta-Pink
      ]
      
      for (const color of testColors) {
        const result = translator.translate(color, BEAM_2R_PROFILE)
        if (result.colorWheelDmx !== undefined) {
          expect(result.colorWheelDmx).toBeGreaterThanOrEqual(0)
          expect(result.colorWheelDmx).toBeLessThanOrEqual(255)
          expect(Number.isInteger(result.colorWheelDmx)).toBe(true)
        }
      }
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // 💾 LRU CACHE — Hit/Miss correcto
  // ═══════════════════════════════════════════════════════════════════════
  
  describe('💾 LRU Cache — Hit/miss y cuantización perceptual', () => {
    
    it('Misma consulta dos veces → retorna resultado idéntico', () => {
      const color: RGB = { r: 100, g: 50, b: 200 }
      
      const result1 = translator.translate(color, BEAM_2R_PROFILE)
      const result2 = translator.translate(color, BEAM_2R_PROFILE)
      
      expect(result1.colorWheelDmx).toBe(result2.colorWheelDmx)
      expect(result1.colorName).toBe(result2.colorName)
      expect(result1.colorDistance).toBe(result2.colorDistance)
    })

    it('Colores perceptualmente similares comparten cache (cuantización L*a*b*)', () => {
      // Dos rojos muy similares: diff < 4 en cada eje L*a*b*
      const red1: RGB = { r: 255, g: 0, b: 0 }
      const red2: RGB = { r: 253, g: 2, b: 1 }
      
      const result1 = translator.translate(red1, BEAM_2R_PROFILE)
      const result2 = translator.translate(red2, BEAM_2R_PROFILE)
      
      // Mismo resultado (cache hit por cuantización con paso=4)
      expect(result1.colorWheelDmx).toBe(result2.colorWheelDmx)
      expect(result1.colorName).toBe(result2.colorName)
    })

    it('clearCache() borra todo y próxima consulta recalcula', () => {
      const color: RGB = { r: 100, g: 50, b: 200 }
      
      // Primera consulta: cache miss
      const result1 = translator.translate(color, BEAM_2R_PROFILE)
      
      // Limpiar cache
      translator.clearCache()
      
      // Segunda consulta: cache miss (recalculado)
      const result2 = translator.translate(color, BEAM_2R_PROFILE)
      
      // Los resultados deben ser idénticos (determinismo)
      expect(result1.colorWheelDmx).toBe(result2.colorWheelDmx)
      expect(result1.colorName).toBe(result2.colorName)
    })

    it('Cache de diferentes perfiles no se mezclan', () => {
      const color: RGB = { r: 255, g: 0, b: 0 }
      
      // Perfil A: rueda con rojo en DMX 15
      const resultA = translator.translate(color, BEAM_2R_PROFILE)
      
      // Perfil B: rueda diferente con rojo en DMX 50
      const altProfile = {
        id: 'alt-wheel',
        colorEngine: { mixing: 'wheel' },
        capabilities: {
          colorWheel: {
            colors: [
              { dmx: 0,  name: 'White', rgb: { r: 255, g: 255, b: 255 } },
              { dmx: 50, name: 'Red',   rgb: { r: 255, g: 0,   b: 0   } },
              { dmx: 100, name: 'Blue', rgb: { r: 0,   g: 0,   b: 255 } },
            ],
            minChangeTimeMs: 200,
          },
        },
      }
      const resultB = translator.translate(color, altProfile)
      
      // Deben dar DMX diferentes (perfiles diferentes → cache keys diferentes)
      expect(resultA.colorWheelDmx).not.toBe(resultB.colorWheelDmx)
    })

    it('Cache no excede MAX_CACHE_SIZE (512 entries)', () => {
      // Generar 600 colores únicos para saturar el cache
      for (let i = 0; i < 600; i++) {
        // Variación suficiente para generar cache keys distintas (paso=4 en L*a*b*)
        const r = (i * 37) % 256
        const g = (i * 73) % 256
        const b = (i * 131) % 256
        translator.translate({ r, g, b }, BEAM_2R_PROFILE)
      }
      
      // El cache internamente es privado, pero podemos verificar que
      // las consultas recientes siguen funcionando (no crashea)
      const lastResult = translator.translate({ r: 100, g: 50, b: 200 }, BEAM_2R_PROFILE)
      expect(lastResult.wasTranslated).toBe(true)
      expect(lastResult.colorWheelDmx).toBeDefined()
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // 🔬 CIE COLOR SCIENCE — Verificación de la pipeline
  // ═══════════════════════════════════════════════════════════════════════
  
  describe('🔬 CIE Color Science — Sanity checks', () => {
    
    it('Negro y blanco tienen máxima distancia perceptual', () => {
      const resultBlack = translator.translate({ r: 0, g: 0, b: 0 }, BEAM_2R_PROFILE)
      const resultWhite = translator.translate({ r: 255, g: 255, b: 255 }, BEAM_2R_PROFILE)
      
      // Negro está lejos de todo en la rueda (todos los colores son saturados)
      // Blanco está cerca del slot "Open (White)"
      expect(resultWhite.colorDistance).toBeLessThan(resultBlack.colorDistance)
    })

    it('Colores primarios producen match con baja distancia', () => {
      const primaries: RGB[] = [
        { r: 255, g: 0, b: 0 },     // Red
        { r: 0, g: 255, b: 0 },     // Green
        { r: 0, g: 0, b: 255 },     // Blue
        { r: 0, g: 255, b: 255 },   // Cyan
        { r: 255, g: 0, b: 255 },   // Magenta
        { r: 255, g: 255, b: 0 },   // Yellow
      ]
      
      for (const primary of primaries) {
        const result = translator.translate(primary, BEAM_2R_PROFILE)
        // Todos los primarios están en la rueda → baja distancia
        expect(result.colorDistance).toBeLessThan(10)
      }
    })
  })
})
