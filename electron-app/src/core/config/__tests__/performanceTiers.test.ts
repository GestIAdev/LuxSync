/**
 * WAVE 7580 — VANGUARD LAUNCHER
 * Unit coverage for the pure tier-scoring heuristic.
 *
 * Location note: this spec lives under `src/**` because `vitest.config.ts`
 * globs `['src/**\/*.spec.ts', 'src/**\/*.test.ts']` only — a spec placed under
 * `electron/` (as the blueprint's Step 2 suggested) would never be collected.
 *
 * `performanceTiers.ts` has zero runtime imports, so nothing here touches
 * Electron singletons and the whole file runs in Vitest's `node` environment.
 */

import { describe, it, expect } from 'vitest'
import {
  scoreHardware,
  shouldShowLauncher,
  isPerformanceTier,
  coercePerformanceTier,
  createDefaultPerformanceProfile,
  PERFORMANCE_TIERS,
  FORCE_LAUNCHER_FLAG,
  type HardwareProfile,
  type PerformanceProfile,
} from '../performanceTiers'

// ═══════════════════════════════════════════════════════════════════════════════
// FIXTURES
// ═══════════════════════════════════════════════════════════════════════════════

/** A healthy modern workstation. Override fields to model weaker machines. */
function hw(overrides: Partial<HardwareProfile> = {}): HardwareProfile {
  return {
    cpuCores: 16,
    totalMemoryGB: 32,
    gpuCompositing: true,
    accelerated2dCanvas: true,
    gpuFeatures: { gpu_compositing: 'enabled', '2d_canvas': 'enabled' },
    screenWidth: 2560,
    screenHeight: 1440,
    probedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function profile(overrides: Partial<PerformanceProfile> = {}): PerformanceProfile {
  return { ...createDefaultPerformanceProfile(), ...overrides }
}

// ═══════════════════════════════════════════════════════════════════════════════
// scoreHardware — the four blueprint cases
// ═══════════════════════════════════════════════════════════════════════════════

describe('scoreHardware', () => {
  it('returns eco when the 2D canvas is not accelerated', () => {
    expect(scoreHardware(hw({ accelerated2dCanvas: false }))).toBe('eco')
  })

  it('returns eco when GPU compositing is unavailable', () => {
    expect(scoreHardware(hw({ gpuCompositing: false }))).toBe('eco')
  })

  it('returns eco for the documented legacy i3 (4GB, 2 cores, no GPU accel)', () => {
    const legacyI3 = hw({
      cpuCores: 2,
      totalMemoryGB: 4,
      gpuCompositing: false,
      accelerated2dCanvas: false,
      gpuFeatures: { gpu_compositing: 'disabled_software', '2d_canvas': 'unavailable_software' },
      screenWidth: 1366,
      screenHeight: 768,
    })
    expect(scoreHardware(legacyI3)).toBe('eco')
  })

  it('returns balanced for a mid-range machine (8GB, 4 cores, GPU ok)', () => {
    expect(scoreHardware(hw({ totalMemoryGB: 8, cpuCores: 4 }))).toBe('balanced')
  })

  it('returns hq for a modern workstation (32GB, 16 cores, GPU ok)', () => {
    expect(scoreHardware(hw())).toBe('hq')
  })

  // ── Gate precedence ──

  it('prioritises the GPU gate over abundant CPU and RAM', () => {
    const beefyButNoGpu = hw({
      cpuCores: 32,
      totalMemoryGB: 128,
      accelerated2dCanvas: false,
    })
    expect(scoreHardware(beefyButNoGpu)).toBe('eco')
  })

  // ── Boundary conditions ──

  it('treats exactly 4GB as eco and 4.1GB as at-best balanced', () => {
    expect(scoreHardware(hw({ totalMemoryGB: 4 }))).toBe('eco')
    expect(scoreHardware(hw({ totalMemoryGB: 4.1 }))).toBe('balanced')
  })

  it('treats exactly 2 cores as eco and 3 cores as at-best balanced', () => {
    expect(scoreHardware(hw({ cpuCores: 2 }))).toBe('eco')
    expect(scoreHardware(hw({ cpuCores: 3 }))).toBe('balanced')
  })

  it('treats exactly 8GB as balanced and 8.1GB with many cores as hq', () => {
    expect(scoreHardware(hw({ totalMemoryGB: 8 }))).toBe('balanced')
    expect(scoreHardware(hw({ totalMemoryGB: 8.1 }))).toBe('hq')
  })

  it('treats exactly 4 cores as balanced and 5 cores with ample RAM as hq', () => {
    expect(scoreHardware(hw({ cpuCores: 4 }))).toBe('balanced')
    expect(scoreHardware(hw({ cpuCores: 5 }))).toBe('hq')
  })

  // ── Purity ──

  it('is deterministic across repeated calls', () => {
    const fixture = hw({ totalMemoryGB: 8, cpuCores: 4 })
    const results = Array.from({ length: 20 }, () => scoreHardware(fixture))
    expect(new Set(results).size).toBe(1)
  })

  it('does not mutate its input', () => {
    const fixture = hw({ totalMemoryGB: 8 })
    const snapshot = structuredClone(fixture)
    scoreHardware(fixture)
    expect(fixture).toEqual(snapshot)
  })

  it('only ever returns a declared tier', () => {
    const permutations: HardwareProfile[] = [
      hw({ cpuCores: 1, totalMemoryGB: 1 }),
      hw({ cpuCores: 2, totalMemoryGB: 4, gpuCompositing: false }),
      hw({ cpuCores: 6, totalMemoryGB: 6 }),
      hw({ cpuCores: 8, totalMemoryGB: 16 }),
      hw({ cpuCores: 64, totalMemoryGB: 256 }),
    ]
    for (const p of permutations) {
      expect(PERFORMANCE_TIERS).toContain(scoreHardware(p))
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// shouldShowLauncher
// ═══════════════════════════════════════════════════════════════════════════════

describe('shouldShowLauncher', () => {
  it('shows the launcher on a fresh default profile', () => {
    expect(shouldShowLauncher(createDefaultPerformanceProfile(), [])).toBe(true)
  })

  it('hides the launcher once the operator confirmed and opted out', () => {
    const p = profile({ userConfirmed: true, skipLauncher: true })
    expect(shouldShowLauncher(p, [])).toBe(false)
  })

  it('still shows the launcher when confirmed but not opted out', () => {
    const p = profile({ userConfirmed: true, skipLauncher: false })
    expect(shouldShowLauncher(p, [])).toBe(true)
  })

  it('ignores skipLauncher when the choice was never confirmed', () => {
    // Only reachable via a hand-edited or partially-migrated config.
    const p = profile({ userConfirmed: false, skipLauncher: true })
    expect(shouldShowLauncher(p, [])).toBe(true)
  })

  it('honours the force flag over a confirmed opt-out', () => {
    const p = profile({ userConfirmed: true, skipLauncher: true })
    expect(shouldShowLauncher(p, ['electron', '.', FORCE_LAUNCHER_FLAG])).toBe(true)
  })

  it('is unaffected by unrelated argv entries', () => {
    const p = profile({ userConfirmed: true, skipLauncher: true })
    expect(shouldShowLauncher(p, ['electron', '.', '--inspect', '--no-sandbox'])).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Tier validation — guards the config-file and IPC trust boundaries
// ═══════════════════════════════════════════════════════════════════════════════

describe('isPerformanceTier', () => {
  it('accepts every declared tier', () => {
    for (const tier of PERFORMANCE_TIERS) {
      expect(isPerformanceTier(tier)).toBe(true)
    }
  })

  it('rejects unknown strings, casing variants and non-strings', () => {
    const bad: unknown[] = ['HQ', 'ECO', 'ultra', '', null, undefined, 0, 1, {}, [], true]
    for (const value of bad) {
      expect(isPerformanceTier(value)).toBe(false)
    }
  })
})

describe('coercePerformanceTier', () => {
  it('passes valid tiers through untouched', () => {
    expect(coercePerformanceTier('eco')).toBe('eco')
  })

  it('falls back to hq by default for garbage input', () => {
    expect(coercePerformanceTier('nonsense')).toBe('hq')
    expect(coercePerformanceTier(undefined)).toBe('hq')
  })

  it('honours an explicit fallback', () => {
    expect(coercePerformanceTier(null, 'eco')).toBe('eco')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// createDefaultPerformanceProfile
// ═══════════════════════════════════════════════════════════════════════════════

describe('createDefaultPerformanceProfile', () => {
  it('defaults to hq, unconfirmed, launcher-visible', () => {
    const p = createDefaultPerformanceProfile()
    expect(p.tier).toBe('hq')
    expect(p.userConfirmed).toBe(false)
    expect(p.skipLauncher).toBe(false)
    expect(p.hardware).toBeNull()
    expect(p.recommendedTier).toBeNull()
  })

  it('stamps a parseable ISO timestamp', () => {
    const p = createDefaultPerformanceProfile()
    expect(Number.isNaN(Date.parse(p.decidedAt))).toBe(false)
  })

  it('returns a fresh object each call (not a shared frozen const)', () => {
    const a = createDefaultPerformanceProfile()
    const b = createDefaultPerformanceProfile()
    expect(a).not.toBe(b)
    a.tier = 'eco'
    expect(b.tier).toBe('hq')
  })
})
