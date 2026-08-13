/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎚️ BPM DERIVATION TESTS — OPERATION ACADEMIC EXORCISM
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Tests for the median-filtered outlier rejection in deriveBpm().
 * Verifies that single-outlier jitter from USB-MIDI stacks does not
 * distort the BPM estimate, while steady-state accuracy is preserved.
 *
 * @module chronos/__tests__/bpmDerivation.test
 */

import { describe, test, expect } from 'vitest'
import {
  createBpmDerivationState,
  deriveBpm,
  BPM_WINDOW_SIZE,
  BPM_HYSTERESIS,
  resetBpmDerivation,
} from '../utils/bpmDerivation'

describe('🎚️ bpmDerivation — Median-Filtered Outlier Rejection', () => {
  test('steady-state intervals produce correct BPM', () => {
    const state = createBpmDerivationState()
    // 120 BPM → 500ms per beat
    for (let i = 0; i < BPM_WINDOW_SIZE; i++) {
      deriveBpm(state, 500)
    }
    // Last call should have reported 120.0
    expect(state.lastReportedBpm).toBe(120.0)
  })

  test('single outlier interval is rejected and does not skew BPM', () => {
    const state = createBpmDerivationState()
    // 120 BPM → 500ms per beat, with one 1000ms outlier (would imply 60 BPM)
    const intervals = [500, 500, 500, 500, 500, 500, 500, 1000]
    for (const iv of intervals) {
      deriveBpm(state, iv)
    }
    // The outlier (1000ms) deviates 100% from the 500ms median — well beyond
    // the 15% rejection threshold. The BPM should remain ~120, not drop toward 60.
    expect(state.lastReportedBpm).toBe(120.0)
  })

  test('two outliers in a small window still rejected when median is clear', () => {
    const state = createBpmDerivationState()
    // 6 clean intervals at 500ms (120 BPM) + 2 outliers at 900ms
    const intervals = [500, 500, 500, 500, 500, 500, 900, 900]
    for (const iv of intervals) {
      deriveBpm(state, iv)
    }
    // Median = 500, outliers at 900 deviate 80% — rejected.
    expect(state.lastReportedBpm).toBe(120.0)
  })

  test('gradual tempo change is tracked (not rejected as outlier)', () => {
    const state = createBpmDerivationState()
    // Start at 120 BPM (500ms), drift to ~130 BPM (461ms) over 8 beats.
    // Each step deviates <15% from the running median, so all are accepted.
    const intervals = [500, 495, 490, 485, 475, 470, 465, 461]
    let lastResult: number | null = null
    for (const iv of intervals) {
      const result = deriveBpm(state, iv)
      if (result !== null) lastResult = result
    }
    // Should have drifted upward from 120 toward ~130
    expect(state.lastReportedBpm).toBeGreaterThan(120)
    expect(state.lastReportedBpm).toBeLessThanOrEqual(131)
  })

  test('all-intervals-rejected falls back to full-window mean', () => {
    const state = createBpmDerivationState()
    // Every interval is wildly different — no clear median cluster.
    // The fallback path uses the full window mean.
    const intervals = [300, 600, 200, 700, 350, 650, 250, 750]
    for (const iv of intervals) {
      deriveBpm(state, iv)
    }
    // Should still produce a valid BPM (no NaN, no crash).
    // Mean ≈ 475ms → ~126.3 BPM
    expect(state.lastReportedBpm).toBeGreaterThan(0)
    expect(Number.isFinite(state.lastReportedBpm)).toBe(true)
  })

  test('hysteresis still prevents micro-jitter reporting', () => {
    const state = createBpmDerivationState()
    // 120 BPM with tiny ±0.5ms variations — all within hysteresis band
    const intervals = [500, 500.3, 499.8, 500.1, 499.9, 500.2, 500.0, 499.7]
    let reportCount = 0
    let lastReport = 0
    for (const iv of intervals) {
      const result = deriveBpm(state, iv)
      if (result !== null) {
        reportCount++
        lastReport = result
      }
    }
    // The first report establishes the baseline. Subsequent reports should
    // be rare because variations are within the 0.5 BPM hysteresis.
    expect(reportCount).toBeLessThanOrEqual(2)
    expect(lastReport).toBe(120.0)
  })

  test('resetBpmDerivation clears state', () => {
    const state = createBpmDerivationState()
    for (let i = 0; i < BPM_WINDOW_SIZE; i++) {
      deriveBpm(state, 500)
    }
    expect(state.lastReportedBpm).toBe(120.0)
    expect(state.beatIntervals.length).toBe(BPM_WINDOW_SIZE)

    resetBpmDerivation(state)
    expect(state.lastReportedBpm).toBe(0)
    expect(state.beatIntervals.length).toBe(0)
  })

  test('insufficient data returns null', () => {
    const state = createBpmDerivationState()
    expect(deriveBpm(state, 500)).toBeNull() // only 1 interval
  })
})
