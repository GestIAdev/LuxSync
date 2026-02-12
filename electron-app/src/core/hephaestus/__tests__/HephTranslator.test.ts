/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚒️ WAVE 2030.21: THE TRANSLATOR - UNIT TESTS
 * 
 * Tests for DMX scaling (scaleToDMX) and HSL→RGB conversion (hslToRgb).
 * These are the bridge functions that turn Hephaestus curve values
 * into DMX-ready output for TitanOrchestrator.
 * 
 * NO MOCKS. NO SIMULATIONS. PURE MATH.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect } from 'vitest'
import { hslToRgb, scaleToDMX } from '../runtime/HephaestusRuntime'

// ═══════════════════════════════════════════════════════════════════════════
// hslToRgb - COLOR TRANSLATION
// ═══════════════════════════════════════════════════════════════════════════

describe('⚒️ WAVE 2030.21: hslToRgb - HSL → RGB Conversion', () => {

  describe('🎨 Primary Colors', () => {
    it('pure red: H=0, S=1, L=0.5', () => {
      const rgb = hslToRgb(0, 1, 0.5)
      expect(rgb).toEqual({ r: 255, g: 0, b: 0 })
    })

    it('pure green: H=120, S=1, L=0.5', () => {
      const rgb = hslToRgb(120, 1, 0.5)
      expect(rgb).toEqual({ r: 0, g: 255, b: 0 })
    })

    it('pure blue: H=240, S=1, L=0.5', () => {
      const rgb = hslToRgb(240, 1, 0.5)
      expect(rgb).toEqual({ r: 0, g: 0, b: 255 })
    })
  })

  describe('🔲 Achromatic', () => {
    it('white: H=0, S=0, L=1', () => {
      const rgb = hslToRgb(0, 0, 1)
      expect(rgb).toEqual({ r: 255, g: 255, b: 255 })
    })

    it('black: H=0, S=0, L=0', () => {
      const rgb = hslToRgb(0, 0, 0)
      expect(rgb).toEqual({ r: 0, g: 0, b: 0 })
    })

    it('mid gray: H=0, S=0, L=0.5', () => {
      const rgb = hslToRgb(0, 0, 0.5)
      expect(rgb).toEqual({ r: 128, g: 128, b: 128 })
    })
  })

  describe('🌈 Secondary Colors', () => {
    it('yellow: H=60, S=1, L=0.5', () => {
      const rgb = hslToRgb(60, 1, 0.5)
      expect(rgb).toEqual({ r: 255, g: 255, b: 0 })
    })

    it('cyan: H=180, S=1, L=0.5', () => {
      const rgb = hslToRgb(180, 1, 0.5)
      expect(rgb).toEqual({ r: 0, g: 255, b: 255 })
    })

    it('magenta: H=300, S=1, L=0.5', () => {
      const rgb = hslToRgb(300, 1, 0.5)
      expect(rgb).toEqual({ r: 255, g: 0, b: 255 })
    })
  })

  describe('🎯 Edge Cases & Hue Wrapping', () => {
    it('H=360 wraps to same as H=0 (red)', () => {
      const rgb360 = hslToRgb(360, 1, 0.5)
      const rgb0 = hslToRgb(0, 1, 0.5)
      expect(rgb360).toEqual(rgb0)
    })

    it('H=720 wraps to same as H=0 (double wrap)', () => {
      const rgb = hslToRgb(720, 1, 0.5)
      expect(rgb).toEqual({ r: 255, g: 0, b: 0 })
    })

    it('negative hue wraps correctly: H=-60 → same as H=300', () => {
      const rgbNeg = hslToRgb(-60, 1, 0.5)
      const rgb300 = hslToRgb(300, 1, 0.5)
      expect(rgbNeg).toEqual(rgb300)
    })

    it('zero saturation always produces gray regardless of hue', () => {
      const rgb1 = hslToRgb(0, 0, 0.5)
      const rgb2 = hslToRgb(120, 0, 0.5)
      const rgb3 = hslToRgb(240, 0, 0.5)
      expect(rgb1).toEqual(rgb2)
      expect(rgb2).toEqual(rgb3)
    })
  })

  describe('🔧 DMX-Relevant Colors', () => {
    it('warm amber: H=30, S=1, L=0.5 → orange', () => {
      const rgb = hslToRgb(30, 1, 0.5)
      // Should be orange-ish: high R, medium G, no B
      expect(rgb.r).toBe(255)
      expect(rgb.g).toBe(128)
      expect(rgb.b).toBe(0)
    })

    it('deep violet: H=270, S=1, L=0.5', () => {
      const rgb = hslToRgb(270, 1, 0.5)
      expect(rgb.r).toBe(128)
      expect(rgb.g).toBe(0)
      expect(rgb.b).toBe(255)
    })

    it('low lightness dims the color', () => {
      const full = hslToRgb(0, 1, 0.5)    // Full red
      const dim = hslToRgb(0, 1, 0.25)     // Dimmed red
      expect(dim.r).toBeLessThan(full.r)
      expect(dim.r).toBeGreaterThan(0)
    })
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// scaleToDMX - VALUE SCALING
// ═══════════════════════════════════════════════════════════════════════════

describe('⚒️ WAVE 2030.21: scaleToDMX - Curve Value → DMX Scaling', () => {

  describe('📊 DMX-Scaled Parameters (0-1 → 0-255)', () => {
    const dmxParams = ['intensity', 'strobe', 'white', 'amber', 'pan', 'tilt', 'zoom', 'focus', 'iris', 'gobo1', 'gobo2', 'prism']
    
    for (const param of dmxParams) {
      it(`${param}: 0 → 0`, () => {
        expect(scaleToDMX(param, 0)).toBe(0)
      })

      it(`${param}: 1 → 255`, () => {
        expect(scaleToDMX(param, 1)).toBe(255)
      })

      it(`${param}: 0.5 → 128`, () => {
        expect(scaleToDMX(param, 0.5)).toBe(128)
      })
    }
  })

  describe('🔧 Float Passthrough Parameters (stay 0-1)', () => {
    const floatParams = ['speed', 'width', 'direction', 'globalComp']
    
    for (const param of floatParams) {
      it(`${param}: 0.5 stays 0.5`, () => {
        expect(scaleToDMX(param, 0.5)).toBe(0.5)
      })

      it(`${param}: 1 stays 1`, () => {
        expect(scaleToDMX(param, 1)).toBe(1)
      })

      it(`${param}: 0 stays 0`, () => {
        expect(scaleToDMX(param, 0)).toBe(0)
      })
    }
  })

  describe('🛡️ Clamping & Edge Cases', () => {
    it('clamps negative values to 0 for DMX params', () => {
      expect(scaleToDMX('intensity', -0.5)).toBe(0)
    })

    it('clamps values > 1 to 255 for DMX params', () => {
      expect(scaleToDMX('intensity', 1.5)).toBe(255)
    })

    it('clamps negative values to 0 for float params', () => {
      expect(scaleToDMX('speed', -0.3)).toBe(0)
    })

    it('clamps values > 1 to 1 for float params', () => {
      expect(scaleToDMX('speed', 2.0)).toBe(1)
    })

    it('unknown parameter treated as float passthrough', () => {
      // Future-proofing: unknown params don't scale to 255
      expect(scaleToDMX('unknownParam', 0.7)).toBe(0.7)
    })

    it('DMX rounding: 0.999 → 255, not 254', () => {
      expect(scaleToDMX('intensity', 0.999)).toBe(255)
    })

    it('DMX rounding: 0.001 → 0', () => {
      expect(scaleToDMX('intensity', 0.001)).toBe(0)
    })

    it('DMX precise: 128/255 ≈ 0.502 → 128', () => {
      expect(scaleToDMX('intensity', 128 / 255)).toBe(128)
    })
  })
})
