/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🚀 HARDWARE PROBE — WAVE 7580: VANGUARD LAUNCHER
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Electron-side hardware capability probe for the pre-boot Launcher gate.
 *
 * This module DOES import `electron`, so it can only be loaded inside a live
 * main process. The pure scoring heuristic it re-exports lives in
 * `src/core/config/performanceTiers.ts` precisely so that it stays unit-testable
 * without an Electron runtime (see the header of that file for the rationale).
 *
 * @module electron/launcher/probeHardware
 * @version 7580.0.0
 */

import { app, screen } from 'electron'
import * as os from 'os'

import type { HardwareProfile } from '../../src/core/config/performanceTiers'

// Re-exported so callers get the whole probe+score surface from one import,
// matching the contract described in the blueprint.
export {
  scoreHardware,
  shouldShowLauncher,
  isPerformanceTier,
  coercePerformanceTier,
  createDefaultPerformanceProfile,
  PERFORMANCE_TIERS,
  FORCE_LAUNCHER_FLAG,
} from '../../src/core/config/performanceTiers'

export type {
  HardwareProfile,
  PerformanceProfile,
  PerformanceTier,
} from '../../src/core/config/performanceTiers'

// ═══════════════════════════════════════════════════════════════════════════════
// GPU FEATURE KEYS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Chromium reports each feature as one of: 'enabled', 'enabled_readback',
 * 'enabled_force', 'software', 'disabled_software', 'disabled_off',
 * 'disabled_off_ok', 'unavailable_software', 'unavailable_off'.
 *
 * Only the 'enabled*' family means real hardware acceleration. Everything else
 * — including the deceptively named 'software' — is CPU rasterization, which is
 * exactly the condition that produces the degradation documented in
 * hyperion_performance_audit2.md.
 */
function isHardwareAccelerated(status: string | undefined): boolean {
  return typeof status === 'string' && status.startsWith('enabled')
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROBE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Probe the machine's rendering capabilities.
 *
 * MUST be called after `app.whenReady()` — `app.getGPUFeatureStatus()` throws
 * before the GPU process has reported in, and `screen` is unavailable earlier.
 * The Launcher gate in `main.ts` satisfies this.
 *
 * Never throws: every individual probe is guarded so that a driver quirk on an
 * exotic machine degrades to a conservative reading rather than aborting boot.
 * A failed GPU probe reports `false` (i.e. "not accelerated"), which biases the
 * recommendation toward ECO — the safe direction.
 */
export function probeHardware(): HardwareProfile {
  // ── GPU ──
  let gpuFeatures: Record<string, string> = {}
  try {
    // Electron types this as `unknown`-ish in some versions; it is a flat
    // string map in practice.
    gpuFeatures = app.getGPUFeatureStatus() as unknown as Record<string, string>
  } catch (error) {
    console.warn('[Vanguard] GPU feature probe failed, assuming no acceleration:', error)
    gpuFeatures = {}
  }

  // ── CPU ──
  let cpuCores = 1
  try {
    cpuCores = os.cpus().length || 1
  } catch (error) {
    console.warn('[Vanguard] CPU probe failed, assuming 1 core:', error)
  }

  // ── Memory ──
  let totalMemoryGB = 0
  try {
    totalMemoryGB = Math.round((os.totalmem() / 1024 ** 3) * 10) / 10
  } catch (error) {
    console.warn('[Vanguard] Memory probe failed, assuming 0 GB:', error)
  }

  // ── Display ──
  // DIP, not physical pixels — this is what CSS media queries compare against,
  // so it is the correct unit for the 1366px compression breakpoints.
  let screenWidth = 0
  let screenHeight = 0
  try {
    const { width, height } = screen.getPrimaryDisplay().size
    screenWidth = width
    screenHeight = height
  } catch (error) {
    console.warn('[Vanguard] Display probe failed, assuming 0x0:', error)
  }

  const profile: HardwareProfile = {
    cpuCores,
    totalMemoryGB,
    gpuCompositing: isHardwareAccelerated(gpuFeatures['gpu_compositing']),
    accelerated2dCanvas: isHardwareAccelerated(gpuFeatures['2d_canvas']),
    gpuFeatures,
    screenWidth,
    screenHeight,
    probedAt: new Date().toISOString(),
  }

  console.log(
    `[Vanguard] Hardware probe: ${profile.cpuCores} cores, ${profile.totalMemoryGB} GB, ` +
      `${profile.screenWidth}x${profile.screenHeight}, ` +
      `gpu_compositing=${profile.gpuCompositing}, 2d_canvas=${profile.accelerated2dCanvas}`
  )

  return profile
}
