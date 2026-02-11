/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚒️ HEPHAESTUS CURVE TEMPLATES - WAVE 2030.6 TESTS
 * Pure mathematical curve generation - no randomness, no mocks
 * 
 * @module views/HephaestusView/__tests__/curveTemplates.test
 * @version WAVE 2030.6
 */

import { describe, it, expect } from 'vitest'
import { 
  CURVE_TEMPLATES, 
  createCurveFromTemplate, 
  getTemplateById, 
  getTemplatesByCategory,
  getCategoryIcon 
} from '../curveTemplates'

describe('⚒️ HEPHAESTUS: Curve Templates - WAVE 2030.6', () => {
  
  // ═══════════════════════════════════════════════════════════════════════
  // TEMPLATE REGISTRY
  // ═══════════════════════════════════════════════════════════════════════
  
  describe('📚 Template Registry', () => {
    
    it('should have all expected templates', () => {
      const ids = CURVE_TEMPLATES.map(t => t.id)
      expect(ids).toContain('sine')
      expect(ids).toContain('triangle')
      expect(ids).toContain('sawtooth')
      expect(ids).toContain('square')
      expect(ids).toContain('pulse')
      expect(ids).toContain('bounce')
      expect(ids).toContain('ease-in-out')
      expect(ids).toContain('ramp-up')
      expect(ids).toContain('ramp-down')
      expect(ids).toContain('constant')
    })
    
    it('should find template by ID', () => {
      const sine = getTemplateById('sine')
      expect(sine).toBeDefined()
      expect(sine?.name).toBe('Sine Wave')
      expect(sine?.category).toBe('oscillator')
    })
    
    it('should return undefined for unknown ID', () => {
      const unknown = getTemplateById('nonexistent')
      expect(unknown).toBeUndefined()
    })
    
    it('should filter by category', () => {
      const oscillators = getTemplatesByCategory('oscillator')
      expect(oscillators.length).toBeGreaterThanOrEqual(4)
      expect(oscillators.every(t => t.category === 'oscillator')).toBe(true)
      
      const utilities = getTemplatesByCategory('utility')
      expect(utilities.length).toBeGreaterThanOrEqual(2)
    })
    
    it('should have icons for all templates', () => {
      for (const template of CURVE_TEMPLATES) {
        expect(template.icon).toBeDefined()
        expect(template.icon.length).toBeGreaterThan(0)
      }
    })
  })
  
  // ═══════════════════════════════════════════════════════════════════════
  // MATHEMATICAL CORRECTNESS
  // ═══════════════════════════════════════════════════════════════════════
  
  describe('🔢 Mathematical Generators', () => {
    
    it('sine: generates smooth oscillation 0 → 1 → 0', () => {
      const sine = getTemplateById('sine')!
      const keyframes = sine.generate(1000, 1, 8)
      
      // Should have multiple keyframes
      expect(keyframes.length).toBeGreaterThan(4)
      
      // First keyframe at t=0 should be value 0.5 (sine starts at 0)
      expect(keyframes[0].timeMs).toBe(0)
      expect(keyframes[0].value).toBeCloseTo(0.5, 1)
      
      // Values should be bounded [0, 1]
      for (const kf of keyframes) {
        expect(kf.value).toBeGreaterThanOrEqual(0)
        expect(kf.value).toBeLessThanOrEqual(1)
      }
      
      // Last keyframe at duration
      expect(keyframes[keyframes.length - 1].timeMs).toBe(1000)
    })
    
    it('triangle: creates V-shaped linear oscillation', () => {
      const triangle = getTemplateById('triangle')!
      const keyframes = triangle.generate(1000, 1, 4)
      
      // Should have bottom → peak → bottom pattern
      expect(keyframes[0].value).toBe(0)  // Start at 0
      
      // Peak should be at 1
      const peak = keyframes.find(kf => kf.value === 1)
      expect(peak).toBeDefined()
      expect(peak!.timeMs).toBeCloseTo(500, -1) // Around midpoint
      
      // All should use linear interpolation
      for (const kf of keyframes) {
        expect(kf.interpolation).toBe('linear')
      }
    })
    
    it('sawtooth: linear ramp with instant drop', () => {
      const sawtooth = getTemplateById('sawtooth')!
      const keyframes = sawtooth.generate(1000, 1)
      
      // Should start at 0
      expect(keyframes[0].value).toBe(0)
      expect(keyframes[0].interpolation).toBe('linear')
      
      // Should reach 1 near end
      const nearEnd = keyframes.find(kf => kf.value === 1)
      expect(nearEnd).toBeDefined()
      expect(nearEnd!.interpolation).toBe('hold') // Instant drop
    })
    
    it('square: instant transitions between 0 and 1', () => {
      const square = getTemplateById('square')!
      const keyframes = square.generate(1000, 1)
      
      // All keyframes should have hold interpolation
      for (const kf of keyframes) {
        expect(kf.interpolation).toBe('hold')
      }
      
      // Values should only be 0 or 1
      for (const kf of keyframes) {
        expect([0, 1]).toContain(kf.value)
      }
    })
    
    it('bounce: damped oscillation with decay', () => {
      const bounce = getTemplateById('bounce')!
      const keyframes = bounce.generate(1000, 4, 8)
      
      // First keyframe should be at max (1)
      expect(keyframes[0].value).toBeCloseTo(1, 1)
      
      // Values should decrease over time (damping)
      const peaks = keyframes.filter((kf, i) => {
        if (i === 0 || i === keyframes.length - 1) return false
        return kf.value > keyframes[i - 1].value && kf.value > keyframes[i + 1].value
      })
      
      // Should have decreasing peaks
      if (peaks.length >= 2) {
        expect(peaks[0].value as number).toBeGreaterThan(peaks[peaks.length - 1].value as number)
      }
    })
    
    it('ease-in-out: S-curve from 0 to 1', () => {
      const easeInOut = getTemplateById('ease-in-out')!
      const keyframes = easeInOut.generate(1000)
      
      // Only 2 keyframes for bezier S-curve
      expect(keyframes.length).toBe(2)
      expect(keyframes[0].value).toBe(0)
      expect(keyframes[0].timeMs).toBe(0)
      expect(keyframes[1].value).toBe(1)
      expect(keyframes[1].timeMs).toBe(1000)
      
      // Should use bezier
      expect(keyframes[0].interpolation).toBe('bezier')
      expect(keyframes[0].bezierHandles).toBeDefined()
    })
    
    it('ramp-up: linear 0 → 1', () => {
      const rampUp = getTemplateById('ramp-up')!
      const keyframes = rampUp.generate(1000)
      
      expect(keyframes.length).toBe(2)
      expect(keyframes[0].value).toBe(0)
      expect(keyframes[1].value).toBe(1)
      expect(keyframes[0].interpolation).toBe('linear')
    })
    
    it('ramp-down: linear 1 → 0', () => {
      const rampDown = getTemplateById('ramp-down')!
      const keyframes = rampDown.generate(1000)
      
      expect(keyframes.length).toBe(2)
      expect(keyframes[0].value).toBe(1)
      expect(keyframes[1].value).toBe(0)
    })
    
    it('constant: flat line at max', () => {
      const constant = getTemplateById('constant')!
      const keyframes = constant.generate(1000)
      
      expect(keyframes.length).toBe(2)
      expect(keyframes[0].value).toBe(1)
      expect(keyframes[1].value).toBe(1)
      expect(keyframes[0].interpolation).toBe('hold')
    })
  })
  
  // ═══════════════════════════════════════════════════════════════════════
  // CURVE CREATION
  // ═══════════════════════════════════════════════════════════════════════
  
  describe('🏭 createCurveFromTemplate', () => {
    
    it('creates a complete HephCurve for number parameter', () => {
      const sine = getTemplateById('sine')!
      const curve = createCurveFromTemplate(sine, 'intensity', 2000, 2, 8)
      
      expect(curve.paramId).toBe('intensity')
      expect(curve.valueType).toBe('number')
      expect(curve.range).toEqual([0, 1])
      expect(curve.defaultValue).toBe(0)
      expect(curve.mode).toBe('absolute')
      expect(curve.keyframes.length).toBeGreaterThan(0)
    })
    
    it('creates color curve with correct defaults', () => {
      const ramp = getTemplateById('ramp-up')!
      const curve = createCurveFromTemplate(ramp, 'color', 1000)
      
      expect(curve.paramId).toBe('color')
      expect(curve.valueType).toBe('color')
      expect(curve.defaultValue).toEqual({ h: 0, s: 100, l: 50 })
    })
    
    it('respects cycles and resolution parameters', () => {
      const triangle = getTemplateById('triangle')!
      
      const curve1 = triangle.generate(1000, 1, 4)
      const curve2 = triangle.generate(1000, 2, 4)
      
      // 2 cycles should have more keyframes
      expect(curve2.length).toBeGreaterThan(curve1.length)
    })
  })
  
  // ═══════════════════════════════════════════════════════════════════════
  // DETERMINISM
  // ═══════════════════════════════════════════════════════════════════════
  
  describe('⚡ Determinism Guarantee', () => {
    
    it('generators produce identical results across calls', () => {
      const bounce = getTemplateById('bounce')!
      
      const result1 = bounce.generate(1000, 4, 8)
      const result2 = bounce.generate(1000, 4, 8)
      
      expect(result1).toEqual(result2)
    })
    
    it('no randomness in any template', () => {
      for (const template of CURVE_TEMPLATES) {
        const run1 = template.generate(1000, 2, 8)
        const run2 = template.generate(1000, 2, 8)
        
        expect(run1).toEqual(run2)
      }
    })
  })
  
  // ═══════════════════════════════════════════════════════════════════════
  // ICONS
  // ═══════════════════════════════════════════════════════════════════════
  
  describe('🎨 Category Icons', () => {
    
    it('returns icon for known categories', () => {
      expect(getCategoryIcon('oscillator')).toBe('∿')
      expect(getCategoryIcon('envelope')).toBe('📈')
      expect(getCategoryIcon('utility')).toBe('🔧')
    })
    
    it('returns default for unknown category', () => {
      expect(getCategoryIcon('unknown-category')).toBe('📦')
    })
  })
})
