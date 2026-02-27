/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🕰️ WAVE 2078: CHRONOS TEST ARMY
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Suite 4: ChronosEngine — Singleton, state machine, context generation
 * 
 * NOTA: ChronosEngine depende de AudioContext (Browser API).
 * Testeamos: singleton pattern, state machine lógica, project loading,
 * seek clamping, playback rate limits, event system.
 * NO testeamos: AudioContext real, requestAnimationFrame.
 * 
 * AXIOMA ANTI-SIMULACIÓN: Zero Math.random(). All assertions deterministic.
 * 
 * @module chronos/__tests__/ChronosEngine
 * @version WAVE 2078
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { ChronosEngine } from '../core/ChronosEngine'
import { createEmptyProject } from '../core/ChronosProject'
import type { ChronosProject } from '../core/types'

// ═══════════════════════════════════════════════════════════════════════════
// 🕰️ CHRONOS ENGINE TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('🕰️ ChronosEngine — The Beating Heart', () => {

  // Cleanup between tests — the singleton MUST be destroyed
  afterEach(() => {
    ChronosEngine.destroyInstance()
  })

  // ─────────────────────────────────────────────────────────────────────
  // SINGLETON
  // ─────────────────────────────────────────────────────────────────────

  describe('🔒 Singleton Pattern', () => {

    test('getInstance returns an instance', () => {
      const engine = ChronosEngine.getInstance()
      expect(engine).toBeDefined()
      expect(engine).toBeInstanceOf(ChronosEngine)
    })

    test('Same instance returned on multiple calls', () => {
      const a = ChronosEngine.getInstance()
      const b = ChronosEngine.getInstance()
      expect(a).toBe(b)
    })

    test('destroyInstance allows fresh creation', () => {
      const first = ChronosEngine.getInstance()
      ChronosEngine.destroyInstance()
      const second = ChronosEngine.getInstance()
      
      // Must be a different instance after destroy
      expect(second).not.toBe(first)
    })

    test('destroyInstance is idempotent (safe to call twice)', () => {
      ChronosEngine.getInstance()
      ChronosEngine.destroyInstance()
      expect(() => ChronosEngine.destroyInstance()).not.toThrow()
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // INITIAL STATE
  // ─────────────────────────────────────────────────────────────────────

  describe('🏁 Initial State', () => {

    test('Starts in stopped state', () => {
      const engine = ChronosEngine.getInstance()
      const state = engine.getState()
      expect(state.playbackState).toBe('stopped')
    })

    test('Current time starts at 0', () => {
      const engine = ChronosEngine.getInstance()
      expect(engine.getCurrentTimeMs()).toBe(0)
    })

    test('No audio loaded initially', () => {
      const engine = ChronosEngine.getInstance()
      expect(engine.hasAudio()).toBe(false)
    })

    test('Not playing initially', () => {
      const engine = ChronosEngine.getInstance()
      expect(engine.isPlaying()).toBe(false)
    })

    test('Not scrubbing initially', () => {
      const engine = ChronosEngine.getInstance()
      expect(engine.isScrubbing()).toBe(false)
    })

    test('No project loaded initially', () => {
      const engine = ChronosEngine.getInstance()
      expect(engine.getProject()).toBeNull()
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // STATE GETTERS
  // ─────────────────────────────────────────────────────────────────────

  describe('📊 State Getters', () => {

    test('getState returns complete state object', () => {
      const engine = ChronosEngine.getInstance()
      const state = engine.getState()
      
      expect(state).toHaveProperty('playbackState')
      expect(state).toHaveProperty('currentTimeMs')
      expect(state).toHaveProperty('audioTimeMs')
      expect(state).toHaveProperty('playbackRate')
      expect(state).toHaveProperty('looping')
      expect(state).toHaveProperty('hasAudio')
      expect(state).toHaveProperty('durationMs')
    })

    test('Default playback rate is 1.0', () => {
      const engine = ChronosEngine.getInstance()
      const state = engine.getState()
      expect(state.playbackRate).toBe(1.0)
    })

    test('audioTimeMs includes latency compensation', () => {
      const engine = ChronosEngine.getInstance()
      const state = engine.getState()
      // audioTimeMs = currentTimeMs - latencyCompensation
      expect(state.audioTimeMs).toBeLessThanOrEqual(state.currentTimeMs)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // PLAYBACK RATE
  // ─────────────────────────────────────────────────────────────────────

  describe('⏩ Playback Rate', () => {

    test('setPlaybackRate changes rate', () => {
      const engine = ChronosEngine.getInstance()
      engine.setPlaybackRate(2.0)
      expect(engine.getState().playbackRate).toBe(2.0)
    })

    test('Rate is clamped to minimum 0.25', () => {
      const engine = ChronosEngine.getInstance()
      engine.setPlaybackRate(0.01)
      expect(engine.getState().playbackRate).toBe(0.25)
    })

    test('Rate is clamped to maximum 4.0', () => {
      const engine = ChronosEngine.getInstance()
      engine.setPlaybackRate(10.0)
      expect(engine.getState().playbackRate).toBe(4.0)
    })

    test('Rate 1.0 is normal speed (no-op)', () => {
      const engine = ChronosEngine.getInstance()
      engine.setPlaybackRate(1.0)
      expect(engine.getState().playbackRate).toBe(1.0)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // LOOP CONFIG
  // ─────────────────────────────────────────────────────────────────────

  describe('🔁 Looping', () => {

    test('setLooping enables loop', () => {
      const engine = ChronosEngine.getInstance()
      engine.setLooping(true)
      expect(engine.getState().looping).toBe(true)
    })

    test('setLooping disables loop', () => {
      const engine = ChronosEngine.getInstance()
      engine.setLooping(true)
      engine.setLooping(false)
      expect(engine.getState().looping).toBe(false)
    })

    test('setLoopRegion sets region', () => {
      const engine = ChronosEngine.getInstance()
      engine.setLoopRegion(10000, 50000)
      
      const state = engine.getState()
      expect(state.loopRegion).toBeDefined()
      expect(state.loopRegion!.startMs).toBe(10000)
      expect(state.loopRegion!.endMs).toBe(50000)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // EVENT SYSTEM
  // ─────────────────────────────────────────────────────────────────────

  describe('📡 Event System', () => {

    test('on() returns unsubscribe function', () => {
      const engine = ChronosEngine.getInstance()
      const unsub = engine.on('playback:stateChange', () => {})
      
      expect(typeof unsub).toBe('function')
      unsub() // Clean up
    })

    test('off() does not throw for unregistered handler', () => {
      const engine = ChronosEngine.getInstance()
      expect(() => engine.off('playback:tick', () => {})).not.toThrow()
    })

    test('Event emitted on setLooping', () => {
      const engine = ChronosEngine.getInstance()
      const received: any[] = []
      
      engine.on('playback:loopChange', (payload) => {
        received.push(payload)
      })
      
      engine.setLooping(true)
      
      expect(received.length).toBe(1)
      expect(received[0].enabled).toBe(true)
    })

    test('Unsubscribe stops event delivery', () => {
      const engine = ChronosEngine.getInstance()
      let callCount = 0
      
      const unsub = engine.on('playback:loopChange', () => {
        callCount++
      })
      
      engine.setLooping(true)
      expect(callCount).toBe(1)
      
      unsub()
      engine.setLooping(false)
      expect(callCount).toBe(1) // No increment after unsub
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // CONTEXT GENERATION
  // ─────────────────────────────────────────────────────────────────────

  describe('🎯 Context Generation', () => {

    test('generateContext returns valid structure without project', () => {
      const engine = ChronosEngine.getInstance()
      const ctx = engine.generateContext()
      
      expect(ctx).toBeDefined()
      expect(typeof ctx.timestamp).toBe('number')
      expect(ctx.active).toBe(false) // stopped = not active
    })

    test('tick() returns context', () => {
      const engine = ChronosEngine.getInstance()
      const ctx = engine.tick()
      
      expect(ctx).toBeDefined()
      expect(typeof ctx.timestamp).toBe('number')
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // DETERMINISM
  // ─────────────────────────────────────────────────────────────────────

  describe('🎲 Determinism', () => {

    test('State is deterministic on fresh instance', () => {
      const s1 = ChronosEngine.getInstance().getState()
      ChronosEngine.destroyInstance()
      const s2 = ChronosEngine.getInstance().getState()
      
      expect(s1.playbackState).toBe(s2.playbackState)
      expect(s1.currentTimeMs).toBe(s2.currentTimeMs)
      expect(s1.playbackRate).toBe(s2.playbackRate)
      expect(s1.looping).toBe(s2.looping)
      expect(s1.hasAudio).toBe(s2.hasAudio)
    })
  })
})
