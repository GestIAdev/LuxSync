/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🚀 WAVE 2083: CHRONOS TEST ARMY — PERIPHERAL COVERAGE
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Suite 9: ChronosStageDispatcher
 * Tests: Singleton, subscribe/emit, tick with vibe change detection,
 * tick with FX trigger/stop, Hephaestus diamond data propagation,
 * state diffing (no duplicate emissions), reset.
 * 
 * AXIOMA ANTI-SIMULACIÓN: Zero Math.random(). All assertions deterministic.
 * 
 * @module chronos/__tests__/ChronosStageDispatcher
 * @version WAVE 2083
 */

import { describe, test, expect, beforeEach, vi } from 'vitest'
import {
  ChronosStageDispatcher,
  getChronosStageDispatcher,
  getChronosInjector,
} from '../core/ChronosStageDispatcher'
import type { StageCommand } from '../core/ChronosStageDispatcher'
import type { VibeClip, FXClip } from '../core/TimelineClip'

// ═══════════════════════════════════════════════════════════════════════════
// 🏗️ DETERMINISTIC FIXTURES
// ═══════════════════════════════════════════════════════════════════════════

function makeVibeClip(overrides: Partial<VibeClip> = {}): VibeClip {
  return {
    id: 'vibe-clip-001',
    type: 'vibe',
    startMs: 0,
    endMs: 5000,
    trackId: 'track-vibe-001',
    vibeType: 'techno-club',
    label: 'Techno Drop',
    color: '#ff0000',
    intensity: 0.8,
    fadeInMs: 200,
    fadeOutMs: 200,
    ...overrides,
  }
}

function makeFXClip(overrides: Partial<FXClip> = {}): FXClip {
  return {
    id: 'fx-clip-001',
    type: 'fx',
    startMs: 1000,
    endMs: 3000,
    trackId: 'track-fx-001',
    fxType: 'strobe',
    label: 'Strobe Burst',
    color: '#ffffff',
    keyframes: [],
    params: {},
    ...overrides,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 🚀 STAGE DISPATCHER TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('🚀 ChronosStageDispatcher — Timeline → Stage Bridge', () => {

  let dispatcher: ChronosStageDispatcher

  beforeEach(() => {
    dispatcher = new ChronosStageDispatcher()
    dispatcher.setDebug(false) // Silenciar logs en tests
  })

  // ─────────────────────────────────────────────────────────────────────
  // SINGLETON
  // ─────────────────────────────────────────────────────────────────────

  describe('🔒 Singleton Pattern', () => {

    test('getChronosStageDispatcher returns same instance', () => {
      const a = getChronosStageDispatcher()
      const b = getChronosStageDispatcher()
      expect(a).toBe(b)
      expect(a).toBeInstanceOf(ChronosStageDispatcher)
    })

    test('getChronosInjector is alias of getChronosStageDispatcher', () => {
      expect(getChronosInjector).toBe(getChronosStageDispatcher)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // SUBSCRIBE / UNSUBSCRIBE
  // ─────────────────────────────────────────────────────────────────────

  describe('📡 Subscribe / Unsubscribe', () => {

    test('subscribe returns unsubscribe function', () => {
      const listener = vi.fn()
      const unsub = dispatcher.subscribe(listener)
      expect(typeof unsub).toBe('function')
    })

    test('unsubscribe stops future emissions', () => {
      const listener = vi.fn()
      const unsub = dispatcher.subscribe(listener)

      const vibe = makeVibeClip()
      dispatcher.tick([vibe], 500)
      expect(listener).toHaveBeenCalledTimes(1) // vibe-change

      unsub()
      listener.mockClear()

      // Change vibe → should NOT call listener
      dispatcher.tick([], 6000) // vibe ends (no clips active)
      expect(listener).not.toHaveBeenCalled()
    })

    test('multiple listeners all receive commands', () => {
      const listenerA = vi.fn()
      const listenerB = vi.fn()
      dispatcher.subscribe(listenerA)
      dispatcher.subscribe(listenerB)

      dispatcher.tick([makeVibeClip()], 500)

      expect(listenerA).toHaveBeenCalledTimes(1)
      expect(listenerB).toHaveBeenCalledTimes(1)
    })

    test('listener error does not break other listeners', () => {
      const badListener = vi.fn(() => { throw new Error('boom') })
      const goodListener = vi.fn()

      dispatcher.subscribe(badListener)
      dispatcher.subscribe(goodListener)

      // Should not throw despite badListener
      expect(() => dispatcher.tick([makeVibeClip()], 500)).not.toThrow()
      expect(goodListener).toHaveBeenCalledTimes(1)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // VIBE CHANGE DETECTION
  // ─────────────────────────────────────────────────────────────────────

  describe('🎭 Vibe Change Detection', () => {

    test('emits vibe-change when vibe clip becomes active', () => {
      const listener = vi.fn()
      dispatcher.subscribe(listener)

      const vibe = makeVibeClip({ vibeType: 'chill-lounge', label: 'Chill Zone', intensity: 0.6 })
      dispatcher.tick([vibe], 500)

      expect(listener).toHaveBeenCalledTimes(1)
      const cmd: StageCommand = listener.mock.calls[0][0]
      expect(cmd.type).toBe('vibe-change')
      expect(cmd.effectId).toBe('chill-lounge')
      expect(cmd.displayName).toBe('Chill Zone')
      expect(cmd.intensity).toBe(0.6)
    })

    test('does NOT re-emit if same vibe is still active (diffing)', () => {
      const listener = vi.fn()
      dispatcher.subscribe(listener)

      const vibe = makeVibeClip()
      dispatcher.tick([vibe], 500)  // First tick → emit
      dispatcher.tick([vibe], 1000) // Second tick → same vibe → NO emit
      dispatcher.tick([vibe], 1500) // Third tick → same vibe → NO emit

      expect(listener).toHaveBeenCalledTimes(1)
    })

    test('emits new vibe-change when vibe clip changes', () => {
      const listener = vi.fn()
      dispatcher.subscribe(listener)

      const vibeA = makeVibeClip({ id: 'vibe-A', vibeType: 'techno-club', label: 'Techno' })
      const vibeB = makeVibeClip({ id: 'vibe-B', vibeType: 'chill-lounge', label: 'Chill', startMs: 5000, endMs: 10000 })

      dispatcher.tick([vibeA], 500) // vibeA active
      dispatcher.tick([vibeB], 6000) // vibeB active (vibeA ended)

      expect(listener).toHaveBeenCalledTimes(2)
      expect(listener.mock.calls[0][0].effectId).toBe('techno-club')
      expect(listener.mock.calls[1][0].effectId).toBe('chill-lounge')
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // FX TRIGGER / STOP DETECTION
  // ─────────────────────────────────────────────────────────────────────

  describe('⚡ FX Trigger & Stop Detection', () => {

    test('emits fx-trigger when FX clip starts', () => {
      const listener = vi.fn()
      dispatcher.subscribe(listener)

      const fx = makeFXClip({ fxType: 'strobe', label: 'Strobe Burst', color: '#fff', startMs: 1000, endMs: 3000 })
      dispatcher.tick([fx], 1500) // Inside the clip range

      expect(listener).toHaveBeenCalledTimes(1)
      const cmd: StageCommand = listener.mock.calls[0][0]
      expect(cmd.type).toBe('fx-trigger')
      expect(cmd.effectId).toBe('strobe')
      expect(cmd.displayName).toBe('Strobe Burst')
      expect(cmd.color).toBe('#fff')
      expect(cmd.durationMs).toBe(2000) // endMs - startMs
    })

    test('does NOT re-trigger same FX on next tick (diffing)', () => {
      const listener = vi.fn()
      dispatcher.subscribe(listener)

      const fx = makeFXClip()
      dispatcher.tick([fx], 1500) // trigger
      dispatcher.tick([fx], 2000) // still active → no re-trigger

      expect(listener).toHaveBeenCalledTimes(1) // Only the initial trigger
    })

    test('emits fx-stop when FX clip ends', () => {
      const listener = vi.fn()
      dispatcher.subscribe(listener)

      const fx = makeFXClip({ startMs: 1000, endMs: 3000 })
      dispatcher.tick([fx], 1500) // trigger
      listener.mockClear()

      dispatcher.tick([], 4000) // clip no longer active → stop

      expect(listener).toHaveBeenCalledTimes(1)
      const cmd: StageCommand = listener.mock.calls[0][0]
      expect(cmd.type).toBe('fx-stop')
      expect(cmd.effectId).toBe('strobe') // Must be fxType, NOT clipId
    })

    test('fx-stop emits fxType not clipId (WAVE 2030+ fix)', () => {
      const listener = vi.fn()
      dispatcher.subscribe(listener)

      const fx = makeFXClip({ id: 'clip-unique-123', fxType: 'sweep' })
      dispatcher.tick([fx], 1500)
      listener.mockClear()

      dispatcher.tick([], 4000)

      const stopCmd = listener.mock.calls[0][0]
      expect(stopCmd.effectId).toBe('sweep')     // ← fxType
      expect(stopCmd.effectId).not.toBe('clip-unique-123') // ← NOT clipId
    })

    test('multiple FX clips trigger independently', () => {
      const listener = vi.fn()
      dispatcher.subscribe(listener)

      const fxA = makeFXClip({ id: 'fx-A', fxType: 'strobe', label: 'Strobe', startMs: 1000, endMs: 5000 })
      const fxB = makeFXClip({ id: 'fx-B', fxType: 'chase', label: 'Chase', startMs: 2000, endMs: 6000 })

      dispatcher.tick([fxA], 1500) // Only fxA
      expect(listener).toHaveBeenCalledTimes(1)

      dispatcher.tick([fxA, fxB], 2500) // fxB starts, fxA already tracked
      expect(listener).toHaveBeenCalledTimes(2) // +1 for fxB trigger
      expect(listener.mock.calls[1][0].effectId).toBe('chase')
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // ⚒️ HEPHAESTUS DIAMOND DATA
  // ─────────────────────────────────────────────────────────────────────

  describe('⚒️ Hephaestus Diamond Data Propagation', () => {

    test('fx-trigger carries hephCurves if present', () => {
      const listener = vi.fn()
      dispatcher.subscribe(listener)

      const hephData = { curve1: { points: [{ t: 0, v: 1 }] } }
      const fx = makeFXClip({ hephClip: hephData as any })
      dispatcher.tick([fx], 1500)

      const cmd = listener.mock.calls[0][0]
      expect(cmd.hephCurves).toBe(hephData)
    })

    test('fx-trigger carries hephFilePath if present', () => {
      const listener = vi.fn()
      dispatcher.subscribe(listener)

      const fx = makeFXClip({ hephFilePath: '/path/to/custom.lfx' })
      dispatcher.tick([fx], 1500)

      expect(listener.mock.calls[0][0].hephFilePath).toBe('/path/to/custom.lfx')
    })

    test('isHephCustom flag propagates on trigger and stop (WAVE 2040.22)', () => {
      const listener = vi.fn()
      dispatcher.subscribe(listener)

      const fx = makeFXClip({ isHephCustom: true, fxType: 'heph-custom' })
      dispatcher.tick([fx], 1500) // trigger
      const triggerCmd = listener.mock.calls[0][0]
      expect(triggerCmd.isHephCustom).toBe(true)

      listener.mockClear()
      dispatcher.tick([], 4000) // stop
      const stopCmd = listener.mock.calls[0][0]
      expect(stopCmd.isHephCustom).toBe(true)
    })

    test('non-heph FX has isHephCustom falsy on stop', () => {
      const listener = vi.fn()
      dispatcher.subscribe(listener)

      const fx = makeFXClip({ isHephCustom: false })
      dispatcher.tick([fx], 1500)
      listener.mockClear()

      dispatcher.tick([], 4000)
      const stopCmd = listener.mock.calls[0][0]
      expect(stopCmd.isHephCustom).toBe(false)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // RESET
  // ─────────────────────────────────────────────────────────────────────

  describe('🔄 Reset', () => {

    test('reset emits fx-stop for all active FX', () => {
      const listener = vi.fn()
      dispatcher.subscribe(listener)

      const fxA = makeFXClip({ id: 'fx-A', fxType: 'strobe' })
      const fxB = makeFXClip({ id: 'fx-B', fxType: 'chase', startMs: 1000, endMs: 4000 })
      dispatcher.tick([fxA, fxB], 1500) // Both trigger
      listener.mockClear()

      dispatcher.reset()

      // Should emit fx-stop for both
      const stopCmds = listener.mock.calls.map(c => c[0])
      expect(stopCmds).toHaveLength(2)
      expect(stopCmds.every((c: StageCommand) => c.type === 'fx-stop')).toBe(true)

      const stoppedTypes = stopCmds.map((c: StageCommand) => c.effectId).sort()
      expect(stoppedTypes).toEqual(['chase', 'strobe'])
    })

    test('reset clears state so next tick re-detects vibes', () => {
      const listener = vi.fn()
      dispatcher.subscribe(listener)

      const vibe = makeVibeClip()
      dispatcher.tick([vibe], 500)
      expect(listener).toHaveBeenCalledTimes(1)

      dispatcher.reset()
      listener.mockClear()

      // Same vibe should trigger again after reset
      dispatcher.tick([vibe], 500)
      expect(listener).toHaveBeenCalledTimes(1)
      expect(listener.mock.calls[0][0].type).toBe('vibe-change')
    })

    test('reset with no active FX does not emit anything', () => {
      const listener = vi.fn()
      dispatcher.subscribe(listener)

      dispatcher.reset()
      expect(listener).not.toHaveBeenCalled()
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // EDGE CASES
  // ─────────────────────────────────────────────────────────────────────

  describe('🧪 Edge Cases', () => {

    test('tick with empty clips array does nothing on first call', () => {
      const listener = vi.fn()
      dispatcher.subscribe(listener)

      dispatcher.tick([], 0)
      expect(listener).not.toHaveBeenCalled()
    })

    test('clip at exact startMs is active, at exact endMs is NOT', () => {
      const listener = vi.fn()
      dispatcher.subscribe(listener)

      const fx = makeFXClip({ startMs: 1000, endMs: 2000 })

      dispatcher.tick([fx], 1000) // Exactly at startMs → active
      expect(listener).toHaveBeenCalledTimes(1)
      expect(listener.mock.calls[0][0].type).toBe('fx-trigger')

      listener.mockClear()
      dispatcher.tick([fx], 2000) // Exactly at endMs → NOT active (exclusive)
      // The clip won't be in activeClips → fx-stop emitted
      expect(listener).toHaveBeenCalledTimes(1)
      expect(listener.mock.calls[0][0].type).toBe('fx-stop')
    })

    test('setDebug toggles debug mode without error', () => {
      expect(() => dispatcher.setDebug(true)).not.toThrow()
      expect(() => dispatcher.setDebug(false)).not.toThrow()
    })
  })
})
