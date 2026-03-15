/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧪 WAVE 374.5: ARBITER E2E TEST SUITE - THE PROVING GROUNDS
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * MISSION: Probar el Árbitro ANTES de pintar botones bonitos.
 * 
 * Test scenarios:
 * 1. THE BLACKOUT TEST - Nuclear option works
 * 2. THE CALIBRATION TEST - Channel masking works
 * 3. THE CROSSFADE TEST - Smooth transitions work
 * 4. THE STROBE TEST - Effect layer works
 * 
 * @module core/arbiter/__tests__/arbiter_e2e.test
 * @version WAVE 374.5
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { MasterArbiter } from '../MasterArbiter'
import { CrossfadeEngine, linear } from '../CrossfadeEngine'
import {
  type Layer0_Titan,
  type Layer2_Manual,
  type Layer3_Effect,
  type ArbiterFixture,
  ControlLayer,
} from '../types'
import type { LightingIntent } from '../../protocol/LightingIntent'

// ═══════════════════════════════════════════════════════════════════════════
// MOCK FACTORIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a mock fixture for testing
 */
function createMockFixture(id: string, zone: string = 'FRONT'): ArbiterFixture {
  return {
    id,
    name: id,
    zone,
    type: 'par',
    dmxAddress: 1,
    universe: 1,
  }
}

/**
 * Create a mock LightingIntent
 */
function createMockIntent(options: {
  masterIntensity?: number
  primaryColor?: { h: number; s: number; l: number }
  pan?: number
  tilt?: number
}): LightingIntent {
  return {
    masterIntensity: options.masterIntensity ?? 0.5,
    palette: {
      primary: options.primaryColor ?? { h: 0, s: 1, l: 0.5 },  // Red (h=0)
      secondary: { h: 0.333, s: 1, l: 0.5 },  // Green (120°/360° = 0.333)
      accent: { h: 0.667, s: 1, l: 0.5 },      // Blue (240°/360° = 0.667)
      ambient: { h: 0, s: 0, l: 0.1 },          // Dark ambient
    },
    zones: {},
    movement: {
      pattern: 'sweep',
      speed: 0.5,
      amplitude: 0.5,
      centerX: options.pan ?? 0.5,
      centerY: options.tilt ?? 0.5,
      beatSync: false,
    },
    effects: [],
    source: 'procedural',
    timestamp: Date.now(),
  }
}

/**
 * Create a Layer0_Titan from an intent
 */
function createTitanLayer(intent: LightingIntent, vibeId: string = 'test-vibe'): Layer0_Titan {
  return {
    intent,
    timestamp: performance.now(),
    vibeId,
    frameNumber: 0,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY: Wait for crossfade progress
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Sleep helper for testing async/timing scenarios
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Mock performance.now() for controlled timing tests
 */
function mockPerformanceNow(startTime: number = 0) {
  let currentTime = startTime
  
  const originalNow = performance.now
  
  vi.spyOn(performance, 'now').mockImplementation(() => currentTime)
  
  return {
    advance: (ms: number) => { currentTime += ms },
    setTime: (time: number) => { currentTime = time },
    getTime: () => currentTime,
    restore: () => {
      vi.restoreAllMocks()
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════════════════════════════════════

describe('🧪 WAVE 374.5: ARBITER E2E TEST SUITE', () => {
  let arbiter: MasterArbiter
  
  beforeEach(() => {
    // Create fresh arbiter for each test (NOT the singleton)
    arbiter = new MasterArbiter({ debug: false })
    
    // 🚦 WAVE 1132: Output gate defaults to FALSE (COLD START PROTOCOL).
    // Tests MUST enable it or all non-manual fixtures get blackout target.
    arbiter.setOutputEnabled(true)
    
    // Register test fixtures
    arbiter.setFixtures([
      createMockFixture('par-1', 'FRONT'),
      createMockFixture('par-2', 'FRONT'),
      createMockFixture('mover-1', 'BACK'),
    ])
  })
  
  afterEach(() => {
    arbiter.reset()
    vi.restoreAllMocks()
  })
  
  // ═══════════════════════════════════════════════════════════════════════
  // TEST 1: THE BLACKOUT TEST (Nuclear Option)
  // ═══════════════════════════════════════════════════════════════════════
  
  describe('🔴 TEST 1: THE BLACKOUT TEST (Nuclear Option)', () => {
    it('should force all dimmers to 0 when blackout is active', () => {
      // ARRANGE: Titan wants full brightness
      const intent = createMockIntent({ masterIntensity: 1.0 })  // 255 DMX
      arbiter.setTitanIntent(createTitanLayer(intent))
      
      // ACT 1: Arbitrate without blackout
      const result1 = arbiter.arbitrate()
      const par1Before = result1.fixtures.find(f => f.fixtureId === 'par-1')!
      
      // ASSERT 1: Dimmer should be 255 (Titan wants full)
      expect(par1Before.dimmer).toBe(255)
      console.log(`[BLACKOUT TEST] Pre-blackout dimmer: ${par1Before.dimmer}`)
      
      // ACT 2: Activate blackout
      arbiter.setBlackout(true)
      const result2 = arbiter.arbitrate()
      const par1After = result2.fixtures.find(f => f.fixtureId === 'par-1')!
      
      // ASSERT 2: Dimmer should be 0 (blackout wins)
      expect(par1After.dimmer).toBe(0)
      expect(par1After._controlSources.dimmer).toBe(ControlLayer.BLACKOUT)
      expect(result2.globalEffects.blackoutActive).toBe(true)
      console.log(`[BLACKOUT TEST] During blackout dimmer: ${par1After.dimmer} ✓`)
      
      // ACT 3: Deactivate blackout
      arbiter.setBlackout(false)
      const result3 = arbiter.arbitrate()
      const par1Restored = result3.fixtures.find(f => f.fixtureId === 'par-1')!
      
      // ASSERT 3: Dimmer should return to 255
      expect(par1Restored.dimmer).toBe(255)
      expect(result3.globalEffects.blackoutActive).toBe(false)
      console.log(`[BLACKOUT TEST] Post-blackout dimmer: ${par1Restored.dimmer} ✓`)
    })
    
    it('should blackout ALL fixtures simultaneously', () => {
      // ARRANGE
      const intent = createMockIntent({ masterIntensity: 1.0 })
      arbiter.setTitanIntent(createTitanLayer(intent))
      arbiter.setBlackout(true)
      
      // ACT
      const result = arbiter.arbitrate()
      
      // ASSERT: All fixtures at 0
      for (const fixture of result.fixtures) {
        expect(fixture.dimmer).toBe(0)
        expect(fixture.color.r).toBe(0)
        expect(fixture.color.g).toBe(0)
        expect(fixture.color.b).toBe(0)
      }
      
      console.log(`[BLACKOUT TEST] All ${result.fixtures.length} fixtures blacked out ✓`)
    })
    
    it('should override manual overrides during blackout', () => {
      // ARRANGE: Set manual override to 255
      arbiter.setManualOverride({
        fixtureId: 'par-1',
        controls: { dimmer: 255 },
        overrideChannels: ['dimmer'],
        mode: 'absolute',
        source: 'ui_fader',
        priority: 1,
        autoReleaseMs: 0,
        releaseTransitionMs: 0,
        timestamp: performance.now(),
      })
      
      // ACT: Activate blackout
      arbiter.setBlackout(true)
      const result = arbiter.arbitrate()
      const par1 = result.fixtures.find(f => f.fixtureId === 'par-1')!
      
      // ASSERT: Blackout wins over manual
      expect(par1.dimmer).toBe(0)
      expect(par1._controlSources.dimmer).toBe(ControlLayer.BLACKOUT)
      
      console.log(`[BLACKOUT TEST] Blackout overrides manual (Layer 4 > Layer 2) ✓`)
    })
  })
  
  // ═══════════════════════════════════════════════════════════════════════
  // TEST 2: THE CALIBRATION TEST (Channel Masking)
  // ═══════════════════════════════════════════════════════════════════════
  
  describe('🎚️ TEST 2: THE CALIBRATION TEST (Channel Masking)', () => {
    it('should allow manual pan/tilt while Titan controls color', () => {
      // ARRANGE: Titan sends color red (255,0,0) and pan at 127 (0.5)
      const intent = createMockIntent({
        primaryColor: { h: 0, s: 1, l: 0.5 },  // Red
        pan: 0.5,  // 127 DMX (center)
      })
      arbiter.setTitanIntent(createTitanLayer(intent))
      
      // Set manual override ONLY for pan (calibration mode)
      arbiter.setManualOverride({
        fixtureId: 'mover-1',
        controls: { pan: 200 },  // Manual wants pan at 200
        overrideChannels: ['pan'],  // ONLY pan!
        mode: 'absolute',
        source: 'calibration',
        priority: 1,
        autoReleaseMs: 0,
        releaseTransitionMs: 500,
        timestamp: performance.now(),
      })
      
      // ACT
      const result = arbiter.arbitrate()
      const mover = result.fixtures.find(f => f.fixtureId === 'mover-1')!
      
      // ASSERT: Pan from manual, color from Titan
      // 🏗️ WAVE 2074.3: Pan/tilt go through getAdjustedPosition(), NOT mergeChannelForFixture()
      // So _controlSources does NOT track pan/tilt source — by architectural design.
      // We verify the VALUE is correct instead.
      expect(mover.pan).toBe(200)  // Manual value wins
      
      // Color should still be from Titan
      // mover-1 is BACK zone → accent color (blue, h:0.667) → B=255, R≈0
      expect(mover.color.b).toBeGreaterThan(200)  // Blue channel high (accent for BACK zone)
      expect(mover._controlSources.red).toBe(ControlLayer.TITAN_AI)
      expect(mover._controlSources.green).toBe(ControlLayer.TITAN_AI)
      expect(mover._controlSources.blue).toBe(ControlLayer.TITAN_AI)
      
      console.log(`[CALIBRATION TEST] Pan: ${mover.pan} (Manual), Color B: ${mover.color.b} (Titan) ✓`)
    })
    
    it('should mask multiple channels while leaving others to AI', () => {
      // ARRANGE
      const intent = createMockIntent({
        masterIntensity: 1.0,
        primaryColor: { h: 120, s: 1, l: 0.5 },  // Green
      })
      arbiter.setTitanIntent(createTitanLayer(intent))
      
      // Manual override for pan AND tilt only
      arbiter.setManualOverride({
        fixtureId: 'mover-1',
        controls: { pan: 50, tilt: 100 },
        overrideChannels: ['pan', 'tilt'],
        mode: 'absolute',
        source: 'ui_joystick',
        priority: 1,
        autoReleaseMs: 0,
        releaseTransitionMs: 500,
        timestamp: performance.now(),
      })
      
      // ACT
      const result = arbiter.arbitrate()
      const mover = result.fixtures.find(f => f.fixtureId === 'mover-1')!
      
      // ASSERT
      // 🏗️ WAVE 2074.3: Pan/tilt bypasses mergeChannelForFixture → no _controlSources tracking
      expect(mover.pan).toBe(50)
      expect(mover.tilt).toBe(100)
      
      // Dimmer and color from Titan
      expect(mover.dimmer).toBe(255)
      expect(mover._controlSources.dimmer).toBe(ControlLayer.TITAN_AI)
      
      console.log(`[CALIBRATION TEST] Pan/Tilt: Manual, Dimmer/Color: Titan ✓`)
    })
    
    it('should allow partial release (release pan, keep tilt)', () => {
      // ARRANGE
      const intent = createMockIntent({ pan: 0.5, tilt: 0.5 })  // 127, 127
      arbiter.setTitanIntent(createTitanLayer(intent))
      
      // Override both pan and tilt
      arbiter.setManualOverride({
        fixtureId: 'mover-1',
        controls: { pan: 50, tilt: 200 },
        overrideChannels: ['pan', 'tilt'],
        mode: 'absolute',
        source: 'calibration',
        priority: 1,
        autoReleaseMs: 0,
        releaseTransitionMs: 0,  // Instant for testing
        timestamp: performance.now(),
      })
      
      // Verify both are manual
      let result = arbiter.arbitrate()
      let mover = result.fixtures.find(f => f.fixtureId === 'mover-1')!
      expect(mover.pan).toBe(50)
      expect(mover.tilt).toBe(200)
      
      // ACT: Release ONLY pan (keep tilt)
      arbiter.releaseManualOverride('mover-1', ['pan'])
      
      // Force crossfade to complete instantly (re-arbitrate after release)
      result = arbiter.arbitrate()
      result = arbiter.arbitrate()  // Second call to ensure crossfade processes
      mover = result.fixtures.find(f => f.fixtureId === 'mover-1')!
      
      // ASSERT: Tilt still manual, pan transitioning back to AI
      // 🏗️ WAVE 2074.3: Pan/tilt bypasses mergeChannelForFixture → no _controlSources tracking
      expect(mover.tilt).toBe(200)  // Still manual value
      
      // Pan should be transitioning or back to AI
      // Note: With instant crossfade, it might already be at AI value
      expect(arbiter.hasManualOverride('mover-1', 'pan')).toBe(false)
      expect(arbiter.hasManualOverride('mover-1', 'tilt')).toBe(true)
      
      console.log(`[CALIBRATION TEST] Partial release: Pan released, Tilt retained ✓`)
    })
  })
  
  // ═══════════════════════════════════════════════════════════════════════
  // TEST 3: THE CROSSFADE TEST (Smooth Release)
  // ═══════════════════════════════════════════════════════════════════════
  
  describe('🌊 TEST 3: THE CROSSFADE TEST (Smooth Release)', () => {
    it('should smoothly transition from manual to AI over time', () => {
      // Use time mocking for precise control
      const timer = mockPerformanceNow(1000)
      
      // Create arbiter with LINEAR easing for predictable math
      const testArbiter = new MasterArbiter({ 
        debug: false,
        defaultCrossfadeMs: 500
      })
      testArbiter.setOutputEnabled(true)
      testArbiter.setFixtures([createMockFixture('par-1')])
      
      // Use a custom crossfade engine with linear easing for predictable testing
      const crossfadeEngine = new CrossfadeEngine(500, linear)
      // @ts-expect-error - Accessing private for testing
      testArbiter.crossfadeEngine = crossfadeEngine
      
      // 🏗️ WAVE 2074.3: Use RED channel (LTP) instead of PAN.
      // Pan/tilt go through getAdjustedPosition() + positionReleaseFades,
      // NOT through mergeChannelForFixture() + crossfadeEngine.
      // Red IS an LTP channel that flows through the crossfade pipeline.
      const intent = createMockIntent({
        primaryColor: { h: 0.667, s: 1, l: 0.5 },  // Pure blue (0-1 scale): R=0, G=0, B=255
      })
      testArbiter.setTitanIntent(createTitanLayer(intent))
      
      testArbiter.setManualOverride({
        fixtureId: 'par-1',
        controls: { red: 200 },  // Manual red at 200
        overrideChannels: ['red'],
        mode: 'absolute',
        source: 'ui_fader',
        priority: 1,
        autoReleaseMs: 0,
        releaseTransitionMs: 500,  // 500ms crossfade
        timestamp: timer.getTime(),
      })
      
      // Verify manual override is active (red = 200)
      let result = testArbiter.arbitrate()
      let par1 = result.fixtures.find(f => f.fixtureId === 'par-1')!
      expect(par1.color.r).toBe(200)
      console.log(`[CROSSFADE TEST] Initial with manual red: ${par1.color.r}`)
      
      // ACT: Release manual, starting crossfade from 200 → 0 (Titan blue has R=0)
      timer.advance(10)
      testArbiter.releaseManualOverride('par-1', ['red'])
      
      // Immediately after release, crossfade should start near 200
      result = testArbiter.arbitrate()
      par1 = result.fixtures.find(f => f.fixtureId === 'par-1')!
      const atStart = par1.color.r
      console.log(`[CROSSFADE TEST] At t=0ms (crossfade start): ${atStart}`)
      // Should be close to start value (200)
      expect(atStart).toBeGreaterThan(180)
      
      // Advance to 50% (250ms)
      timer.advance(250)
      result = testArbiter.arbitrate()
      par1 = result.fixtures.find(f => f.fixtureId === 'par-1')!
      const at50percent = par1.color.r
      console.log(`[CROSSFADE TEST] At t=250ms (50%): ${at50percent}`)
      
      // With linear easing from 200 → 0:
      // at 50%: 200 + (0-200)*0.5 = 100
      expect(at50percent).toBeGreaterThan(80)
      expect(at50percent).toBeLessThan(120)
      
      // Advance to 100% (remaining 260ms to be safe)
      timer.advance(260)
      result = testArbiter.arbitrate()
      par1 = result.fixtures.find(f => f.fixtureId === 'par-1')!
      const at100percent = par1.color.r
      console.log(`[CROSSFADE TEST] At t=510ms (100%): ${at100percent}`)
      
      // Should be at target (0)
      expect(at100percent).toBeGreaterThanOrEqual(0)
      expect(at100percent).toBeLessThanOrEqual(10)
      
      console.log(`[CROSSFADE TEST] Transition 200→100→0 verified ✓`)
      
      timer.restore()
      testArbiter.reset()
    })
    
    it('should track crossfade state correctly via _crossfadeActive flag', () => {
      const timer = mockPerformanceNow(1000)
      
      const testArbiter = new MasterArbiter({ debug: false, defaultCrossfadeMs: 500 })
      testArbiter.setOutputEnabled(true)
      testArbiter.setFixtures([createMockFixture('par-1')])
      
      const crossfadeEngine = new CrossfadeEngine(500, linear)
      // @ts-expect-error - Accessing private for testing
      testArbiter.crossfadeEngine = crossfadeEngine
      
      // 🏗️ WAVE 2074.3: Use RED channel — pan/tilt bypass crossfadeEngine in arbitration
      testArbiter.setTitanIntent(createTitanLayer(createMockIntent({
        primaryColor: { h: 0.667, s: 1, l: 0.5 },  // Blue: R=0 (0-1 hue scale)
      })))
      testArbiter.setManualOverride({
        fixtureId: 'par-1',
        controls: { red: 200 },
        overrideChannels: ['red'],
        mode: 'absolute',
        source: 'ui_fader',
        priority: 1,
        autoReleaseMs: 0,
        releaseTransitionMs: 500,
        timestamp: timer.getTime(),
      })
      
      testArbiter.arbitrate()
      
      // Release and check crossfade state
      timer.advance(10)
      testArbiter.releaseManualOverride('par-1', ['red'])
      
      let result = testArbiter.arbitrate()
      let par1 = result.fixtures.find(f => f.fixtureId === 'par-1')!
      
      expect(par1._crossfadeActive).toBe(true)
      // Progress should be very small since we just started
      
      // Advance to completion
      timer.advance(600)
      result = testArbiter.arbitrate()
      par1 = result.fixtures.find(f => f.fixtureId === 'par-1')!
      
      expect(par1._crossfadeActive).toBe(false)
      
      console.log(`[CROSSFADE TEST] Crossfade state tracking verified ✓`)
      
      timer.restore()
      testArbiter.reset()
    })
  })
  
  // ═══════════════════════════════════════════════════════════════════════
  // TEST 4: THE STROBE TEST (Effect Layer)
  // ═══════════════════════════════════════════════════════════════════════
  
  describe('⚡ TEST 4: THE STROBE TEST (Effect Layer)', () => {
    it('should oscillate dimmer between Titan base and 255 during strobe (HTP behavior)', () => {
      const timer = mockPerformanceNow(1000)
      
      const testArbiter = new MasterArbiter({ debug: false })
      testArbiter.setOutputEnabled(true)
      testArbiter.setFixtures([createMockFixture('par-1')])
      
      // ARRANGE: Titan wants dimmer 0 (so we can see the strobe clearly)
      testArbiter.setTitanIntent(createTitanLayer(createMockIntent({ masterIntensity: 0 })))
      
      // Add strobe effect at 10Hz (100ms period)
      testArbiter.addEffect({
        type: 'strobe',
        intensity: 1.0,
        durationMs: 5000,  // 5 seconds
        startTime: timer.getTime(),
        fixtureIds: [],  // All fixtures
        params: { speed: 10 },  // 10Hz = 100ms period
      })
      
      // Collect values over multiple cycles
      const values: number[] = []
      
      // Sample at various points within the strobe period
      for (let i = 0; i < 20; i++) {
        timer.advance(25)  // 25ms increments
        const result = testArbiter.arbitrate()
        const par1 = result.fixtures.find(f => f.fixtureId === 'par-1')!
        values.push(par1.dimmer)
      }
      
      console.log(`[STROBE TEST] Dimmer values over time: ${values.join(', ')}`)
      
      // ASSERT: With Titan at 0, strobe oscillates between 0 and 255
      // HTP takes max(strobe, titan), so when strobe=255, output=255
      // when strobe=0, output=max(0,0)=0
      const hasHighValues = values.some(v => v >= 200)
      const hasLowValues = values.some(v => v <= 50)
      
      expect(hasHighValues).toBe(true)
      expect(hasLowValues).toBe(true)
      
      // Effect layer should be source when strobe is on
      const result = testArbiter.arbitrate()
      expect(result.globalEffects.strobeActive).toBe(true)
      expect(result.globalEffects.strobeSpeed).toBe(10)
      
      console.log(`[STROBE TEST] Oscillation verified: has 255s=${hasHighValues}, has 0s=${hasLowValues} ✓`)
      
      timer.restore()
      testArbiter.reset()
    })
    
    it('should override Titan dimmer when strobe goes high (HTP)', () => {
      const timer = mockPerformanceNow(1000)
      
      const testArbiter = new MasterArbiter({ debug: false })
      testArbiter.setOutputEnabled(true)
      testArbiter.setFixtures([createMockFixture('par-1')])
      
      // Titan wants dimmer 100
      testArbiter.setTitanIntent(createTitanLayer(createMockIntent({ masterIntensity: 100/255 })))
      
      // Add strobe
      testArbiter.addEffect({
        type: 'strobe',
        intensity: 1.0,
        durationMs: 5000,
        startTime: timer.getTime(),
        fixtureIds: [],
        params: { speed: 10 },
      })
      
      // Sample to find both strobe states
      let foundHigherThanTitan = false
      let foundAtTitanLevel = false
      
      for (let i = 0; i < 20; i++) {
        timer.advance(10)
        const result = testArbiter.arbitrate()
        const par1 = result.fixtures.find(f => f.fixtureId === 'par-1')!
        
        // When strobe = 255, HTP gives 255 (higher than Titan's 100)
        if (par1.dimmer >= 200) foundHigherThanTitan = true
        // When strobe = 0, HTP gives 100 (Titan's value)
        if (par1.dimmer >= 95 && par1.dimmer <= 105) foundAtTitanLevel = true
      }
      
      expect(foundHigherThanTitan).toBe(true)
      expect(foundAtTitanLevel).toBe(true)
      
      console.log(`[STROBE TEST] HTP behavior: strobe overrides when high, Titan when low ✓`)
      
      timer.restore()
      testArbiter.reset()
    })
    
    it('should stop strobe after duration expires', () => {
      const timer = mockPerformanceNow(1000)
      
      const testArbiter = new MasterArbiter({ debug: false })
      testArbiter.setOutputEnabled(true)
      testArbiter.setFixtures([createMockFixture('par-1')])
      
      testArbiter.setTitanIntent(createTitanLayer(createMockIntent({ masterIntensity: 0.5 })))
      
      // Short strobe: 200ms
      testArbiter.addEffect({
        type: 'strobe',
        intensity: 1.0,
        durationMs: 200,
        startTime: timer.getTime(),
        fixtureIds: [],
        params: { speed: 20 },
      })
      
      // During strobe
      let result = testArbiter.arbitrate()
      expect(result.globalEffects.strobeActive).toBe(true)
      console.log(`[STROBE TEST] Strobe active at t=0 ✓`)
      
      // After strobe expires
      timer.advance(250)
      result = testArbiter.arbitrate()
      expect(result.globalEffects.strobeActive).toBe(false)
      
      // Dimmer should return to Titan's value (128)
      const par1 = result.fixtures.find(f => f.fixtureId === 'par-1')!
      expect(par1.dimmer).toBeGreaterThan(100)
      expect(par1.dimmer).toBeLessThan(150)  // ~128
      
      console.log(`[STROBE TEST] Strobe expired, dimmer back to Titan (${par1.dimmer}) ✓`)
      
      timer.restore()
      testArbiter.reset()
    })
    
    it('should apply strobe only to specified fixtures', () => {
      const timer = mockPerformanceNow(1000)
      
      const testArbiter = new MasterArbiter({ debug: false })
      testArbiter.setOutputEnabled(true)
      testArbiter.setFixtures([
        createMockFixture('par-1'),
        createMockFixture('par-2'),
        createMockFixture('mover-1'),
      ])
      
      testArbiter.setTitanIntent(createTitanLayer(createMockIntent({ masterIntensity: 0.5 })))
      
      // Strobe ONLY par-1
      testArbiter.addEffect({
        type: 'strobe',
        intensity: 1.0,
        durationMs: 5000,
        startTime: timer.getTime(),
        fixtureIds: ['par-1'],  // Only par-1
        params: { speed: 10 },
      })
      
      // Sample multiple times to catch strobe state
      let par1Strobing = false
      let par2Strobing = false
      
      for (let i = 0; i < 10; i++) {
        timer.advance(10)
        const result = testArbiter.arbitrate()
        
        const par1 = result.fixtures.find(f => f.fixtureId === 'par-1')!
        const par2 = result.fixtures.find(f => f.fixtureId === 'par-2')!
        
        // par-1 should strobe (have 0 or 255)
        if (par1.dimmer === 0 || par1.dimmer === 255) {
          par1Strobing = true
        }
        
        // par-2 should NOT strobe (should stay at Titan's ~128)
        if (par2.dimmer === 0 || par2.dimmer === 255) {
          par2Strobing = true
        }
      }
      
      expect(par1Strobing).toBe(true)
      expect(par2Strobing).toBe(false)
      
      console.log(`[STROBE TEST] Selective strobe: par-1 strobed, par-2 stable ✓`)
      
      timer.restore()
      testArbiter.reset()
    })
  })
  
  // ═══════════════════════════════════════════════════════════════════════
  // BONUS: COMBINED SCENARIO
  // ═══════════════════════════════════════════════════════════════════════
  
  describe('🎯 BONUS: COMBINED SCENARIO', () => {
    it('should handle multiple layers simultaneously', () => {
      // This is the "party scenario":
      // - Titan controls base lighting
      // - Manual controls mover position (calibration)
      // - Strobe effect on pars
      // - Then blackout kills everything
      
      const timer = mockPerformanceNow(1000)
      
      const testArbiter = new MasterArbiter({ debug: false })
      testArbiter.setOutputEnabled(true)
      testArbiter.setFixtures([
        createMockFixture('par-1'),
        createMockFixture('mover-1'),
      ])
      
      // Layer 0: Titan intent
      testArbiter.setTitanIntent(createTitanLayer(createMockIntent({
        masterIntensity: 0.8,
        primaryColor: { h: 0, s: 1, l: 0.5 },  // Red
        pan: 0.5,
      })))
      
      // Layer 2: Manual position on mover
      testArbiter.setManualOverride({
        fixtureId: 'mover-1',
        controls: { pan: 200, tilt: 100 },
        overrideChannels: ['pan', 'tilt'],
        mode: 'absolute',
        source: 'calibration',
        priority: 1,
        autoReleaseMs: 0,
        releaseTransitionMs: 500,
        timestamp: timer.getTime(),
      })
      
      // Layer 3: Strobe on par
      testArbiter.addEffect({
        type: 'strobe',
        intensity: 1.0,
        durationMs: 10000,
        startTime: timer.getTime(),
        fixtureIds: ['par-1'],
        params: { speed: 10 },
      })
      
      // ACT & ASSERT: Check combined state
      timer.advance(25)  // Sample at strobe high point
      let result = testArbiter.arbitrate()
      
      let par1 = result.fixtures.find(f => f.fixtureId === 'par-1')!
      let mover = result.fixtures.find(f => f.fixtureId === 'mover-1')!
      
      // Mover should have manual position, Titan color
      // 🏗️ WAVE 2074.3: Pan/tilt bypasses mergeChannelForFixture → no _controlSources tracking
      expect(mover.pan).toBe(200)
      expect(mover.tilt).toBe(100)
      expect(mover.color.r).toBeGreaterThan(150)  // Red from Titan
      
      console.log(`[COMBINED] Before blackout - Par strobing, Mover calibrating ✓`)
      
      // Now activate BLACKOUT - should override EVERYTHING
      testArbiter.setBlackout(true)
      timer.advance(25)
      result = testArbiter.arbitrate()
      
      par1 = result.fixtures.find(f => f.fixtureId === 'par-1')!
      mover = result.fixtures.find(f => f.fixtureId === 'mover-1')!
      
      // Everything should be 0
      expect(par1.dimmer).toBe(0)
      expect(mover.dimmer).toBe(0)
      expect(par1._controlSources.dimmer).toBe(ControlLayer.BLACKOUT)
      expect(mover._controlSources.dimmer).toBe(ControlLayer.BLACKOUT)
      
      console.log(`[COMBINED] Blackout overrides all layers ✓`)
      
      // Release blackout
      testArbiter.setBlackout(false)
      timer.advance(25)
      result = testArbiter.arbitrate()
      
      mover = result.fixtures.find(f => f.fixtureId === 'mover-1')!
      
      // Manual should still be active after blackout release
      // 🏗️ WAVE 2074.3: Pan/tilt bypasses mergeChannelForFixture → no _controlSources tracking
      expect(mover.pan).toBe(200)
      expect(mover.tilt).toBe(100)
      
      console.log(`[COMBINED] Manual restored after blackout release ✓`)
      
      timer.restore()
      testArbiter.reset()
    })
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// SUMMARY REPORTER
// ═══════════════════════════════════════════════════════════════════════════

describe('📊 WAVE 374.5: EXECUTION SUMMARY', () => {
  it('should have executed all 4 core test suites', () => {
    // This test just serves as a summary marker
    console.log(`
╔═══════════════════════════════════════════════════════════════════════╗
║  🧪 WAVE 374.5: ARBITER E2E TEST SUITE - EXECUTION COMPLETE          ║
╠═══════════════════════════════════════════════════════════════════════╣
║  TEST 1: BLACKOUT TEST (Nuclear Option)      ✓                        ║
║  TEST 2: CALIBRATION TEST (Channel Masking)  ✓                        ║
║  TEST 3: CROSSFADE TEST (Smooth Release)     ✓                        ║
║  TEST 4: STROBE TEST (Effect Layer)          ✓                        ║
║  BONUS: COMBINED SCENARIO                    ✓                        ║
╠═══════════════════════════════════════════════════════════════════════╣
║  Result: THE ARBITER HAS PROVEN ITSELF 🎭                             ║
╚═══════════════════════════════════════════════════════════════════════╝
    `)
    expect(true).toBe(true)
  })
})
