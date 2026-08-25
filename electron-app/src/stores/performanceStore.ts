/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🚀 PERFORMANCE STORE — WAVE 7580: VANGUARD LAUNCHER
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Holds the render fidelity tier chosen in the pre-boot Launcher.
 * Hydrated ONCE at app mount from the main process via `launcher:getProfile`
 * (see `usePerformanceHydration`).
 *
 * Persistence is NOT handled here — `ConfigManagerV2` owns the on-disk state
 * (blueprint §2.3 / launcher_architecture_context.md §4.2). This store is a
 * read-mostly mirror for the React tree.
 *
 * House style: `create` from `zustand`, no middleware, no `persist`, plus
 * exported stable selectors — the codebase relies on these for React 19
 * correctness (see `luxsyncStore.ts:376`). Subscribe with a single primitive
 * selector (`usePerformanceStore(selectIsPerformanceMode)`); never
 * `usePerformanceStore((s) => ({ ... }))`, which allocates a fresh object each
 * render and re-renders forever.
 *
 * @module stores/performanceStore
 * @version 7580.0.0 - Vanguard Launcher
 */

import { create } from 'zustand'

export type PerformanceTier = 'hq' | 'balanced' | 'eco'

export interface HardwareProfile {
  cpuCores: number
  totalMemoryGB: number
  gpuCompositing: boolean
  accelerated2dCanvas: boolean
  gpuFeatures: Record<string, string>
  screenWidth: number
  screenHeight: number
  probedAt: string
}

interface PerformanceState {
  // ─── STATE ───
  tier: PerformanceTier
  hardware: HardwareProfile | null
  /** False until hydrate() resolves. Gate Eco swaps on this. */
  isHydrated: boolean

  // ─── DERIVED (kept as plain fields, recomputed in setters) ───
  /** tier === 'eco' — the master switch for React component fallbacks */
  isPerformanceMode: boolean
  /** tier !== 'hq' — the switch for the CSS blur-tax override layer */
  isBlurDisabled: boolean
  /** tier === 'eco' — bypass transferControlToOffscreen, use the DOM tactical view */
  isCanvasWorkerDisabled: boolean

  // ─── ACTIONS ───
  setTier: (tier: PerformanceTier) => void
  hydrate: (payload: { tier: PerformanceTier; hardware: HardwareProfile | null }) => void
}

/** Single source of truth for tier → capability flags. */
function deriveFlags(tier: PerformanceTier) {
  return {
    tier,
    isPerformanceMode: tier === 'eco',
    isBlurDisabled: tier !== 'hq',
    isCanvasWorkerDisabled: tier === 'eco',
  }
}

export const usePerformanceStore = create<PerformanceState>((set) => ({
  ...deriveFlags('hq'),
  hardware: null,
  isHydrated: false,

  setTier: (tier) => set(deriveFlags(tier)),

  hydrate: ({ tier, hardware }) =>
    set({ ...deriveFlags(tier), hardware, isHydrated: true }),
}))

// ═══════════════════════════════════════════════════════════════════════════════
// STABLE SELECTORS — React 19 correctness (mirrors luxsyncStore.ts pattern)
// ═══════════════════════════════════════════════════════════════════════════════

export const selectIsPerformanceMode      = (s: PerformanceState) => s.isPerformanceMode
export const selectIsBlurDisabled         = (s: PerformanceState) => s.isBlurDisabled
export const selectIsCanvasWorkerDisabled = (s: PerformanceState) => s.isCanvasWorkerDisabled
export const selectTier                   = (s: PerformanceState) => s.tier
export const selectIsHydrated             = (s: PerformanceState) => s.isHydrated
