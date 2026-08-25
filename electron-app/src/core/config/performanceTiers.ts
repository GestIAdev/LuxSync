/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🚀 PERFORMANCE TIERS — WAVE 7580: VANGUARD LAUNCHER
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * PURE domain module. ZERO runtime imports — no `electron`, no `os`, no `fs`.
 *
 * WHY THIS FILE EXISTS (deviation from blueprint §2.7):
 * The blueprint placed `scoreHardware()` inside `electron/launcher/probeHardware.ts`.
 * That module must `import { app, screen } from 'electron'` in order to probe the
 * GPU, which makes it unloadable under Vitest's `node` environment — the very
 * environment the blueprint's Step 2 test requires. On top of that,
 * `vitest.config.ts` only globs `src/**`, so a spec placed under `electron/`
 * would never be collected by `npm run test`.
 *
 * Resolution: the scoring heuristic and its types live here, in `src/core/config`,
 * with zero imports. Both `ConfigManagerV2` and `electron/launcher/probeHardware`
 * consume this module; `probeHardware` re-exports the pure functions so the
 * import contract described in the blueprint still holds for callers.
 *
 * The dependency arrow points one way only: pure domain types at the bottom,
 * Electron plumbing on top. `ConfigManagerV2` imports these types with
 * `import type`, which the compiler erases entirely, so no cycle is created.
 *
 * @module core/config/performanceTiers
 * @version 7580.0.0 - Vanguard Launcher
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Render fidelity tier chosen in the Vanguard Launcher.
 *
 * - `'hq'`       → full glow/blur/animation stack, GPU canvas worker, 60 fps RAF
 * - `'balanced'` → CSS blur tax removed, all heavy components retained
 * - `'eco'`      → CSS overrides + React component fallbacks + throttled stores
 */
export type PerformanceTier = 'hq' | 'balanced' | 'eco'

/** All tiers, in descending fidelity order. Single source of truth for validation. */
export const PERFORMANCE_TIERS: readonly PerformanceTier[] = ['hq', 'balanced', 'eco'] as const

/**
 * Hardware capabilities probed once in the main process at boot.
 *
 * Persisted so the Launcher can be skipped on subsequent runs, and so support
 * can read the operator's real hardware straight out of the config file.
 */
export interface HardwareProfile {
  /** `os.cpus().length` */
  cpuCores: number
  /** Total system RAM in GB, rounded to 1 decimal (`os.totalmem() / 1024**3`) */
  totalMemoryGB: number
  /** `app.getGPUFeatureStatus()['gpu_compositing'] === 'enabled'` */
  gpuCompositing: boolean
  /**
   * `app.getGPUFeatureStatus()['2d_canvas'] === 'enabled'`.
   * Drives the canvas-worker decision: without this, `OffscreenCanvas`
   * 2D falls back to software skia and the render worker becomes a second
   * CPU-bound rasterizer.
   */
  accelerated2dCanvas: boolean
  /** Raw GPU feature map, retained verbatim for support diagnostics */
  gpuFeatures: Record<string, string>
  /** Primary display width in DIP — drives the 1366px compression breakpoints */
  screenWidth: number
  /** Primary display height in DIP */
  screenHeight: number
  /** ISO-8601 timestamp of this probe */
  probedAt: string
}

/**
 * The Launcher's persisted decision.
 */
export interface PerformanceProfile {
  /** The tier the app will boot with */
  tier: PerformanceTier
  /**
   * True when the operator explicitly picked a tier in the Launcher.
   * False means the value is still an auto-recommendation and the Launcher
   * should be shown again next boot.
   */
  userConfirmed: boolean
  /** Skip the Launcher on subsequent boots (the "Don't ask again" checkbox) */
  skipLauncher: boolean
  /** Snapshot of the hardware at the time of the decision */
  hardware: HardwareProfile | null
  /** The tier the scoring heuristic recommended — kept for telemetry/support */
  recommendedTier: PerformanceTier | null
  /** ISO-8601 timestamp of the decision */
  decidedAt: string
}

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Runtime type guard for `PerformanceTier`.
 *
 * Required in two untrusted paths:
 *  1. `luxsync-config.json` is plain JSON on disk and may be hand-edited.
 *  2. `launcher:commit` receives the tier from a renderer process.
 *
 * Never cast an incoming string to `PerformanceTier` — narrow it with this.
 */
export function isPerformanceTier(value: unknown): value is PerformanceTier {
  return typeof value === 'string' && (PERFORMANCE_TIERS as readonly string[]).includes(value)
}

/**
 * Coerce an unknown value to a valid tier, falling back to `fallback`.
 * Used when reading a possibly-corrupt config file.
 */
export function coercePerformanceTier(
  value: unknown,
  fallback: PerformanceTier = 'hq'
): PerformanceTier {
  return isPerformanceTier(value) ? value : fallback
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build a fresh default profile.
 *
 * A factory rather than a frozen module-level const so that `decidedAt` reflects
 * when the profile was actually created rather than when the module was loaded.
 *
 * `userConfirmed: false` is the flag that makes the Launcher appear on first run.
 */
export function createDefaultPerformanceProfile(): PerformanceProfile {
  return {
    tier: 'hq',
    userConfirmed: false,
    skipLauncher: false,
    hardware: null,
    recommendedTier: null,
    decidedAt: new Date().toISOString(),
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCORING HEURISTIC
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Recommend a tier from the probed hardware.
 *
 * Pure and deterministic — no `Math.random()`, no clock reads, per repo axioms.
 *
 * Thresholds are calibrated against the documented failure case in
 * `hyperion_performance_audit2.md`: a 13-year-old Intel i3, 4 GB RAM, legacy
 * Intel HD GPU with no accelerated 2D canvas.
 */
export function scoreHardware(hw: HardwareProfile): PerformanceTier {
  // ── Hard gate: GPU acceleration ──
  // Without an accelerated 2D canvas every box-shadow / backdrop-filter becomes
  // a CPU Gaussian blur, and the OffscreenCanvas render worker falls back to
  // software skia. This is the single strongest predictor of the observed
  // degradation, so it outranks every other signal.
  if (!hw.accelerated2dCanvas || !hw.gpuCompositing) return 'eco'

  // ── Hard gate: memory ──
  // 4 GB total means Chromium is already swapping before the show starts.
  if (hw.totalMemoryGB <= 4) return 'eco'

  // ── Hard gate: CPU ──
  // 2 cores cannot run the software compositor and the render worker
  // concurrently; they starve each other.
  if (hw.cpuCores <= 2) return 'eco'

  // ── Mid range ──
  if (hw.totalMemoryGB <= 8 || hw.cpuCores <= 4) return 'balanced'

  return 'hq'
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAUNCHER GATE
// ═══════════════════════════════════════════════════════════════════════════════

/** CLI flag that forces the Launcher open regardless of the persisted choice. */
export const FORCE_LAUNCHER_FLAG = '--force-launcher'

/**
 * Decide whether the Launcher window should be shown this boot.
 *
 * `argv` is injected (defaulting to `process.argv`) so this stays a pure
 * function under test. The `typeof process` guard mirrors the defensive pattern
 * already used in `src/core/arbiter/types.ts` and keeps the module safe to load
 * in a browser-like context where `process` is undefined.
 */
export function shouldShowLauncher(
  profile: PerformanceProfile,
  argv: readonly string[] = typeof process !== 'undefined' ? process.argv : []
): boolean {
  // Dev / support escape hatch — always wins.
  if (argv.includes(FORCE_LAUNCHER_FLAG)) return true

  // Only an explicit, confirmed opt-out suppresses the Launcher. A
  // `skipLauncher` flag without `userConfirmed` is meaningless (it can only
  // arise from a hand-edited or partially-migrated config) and is ignored.
  if (profile.skipLauncher && profile.userConfirmed) return false

  return true
}
