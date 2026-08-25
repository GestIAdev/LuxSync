/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🚀 usePerformanceHydration — WAVE 7580: VANGUARD LAUNCHER
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Pulls the render fidelity tier chosen in the pre-boot Launcher out of the
 * main process (`launcher:getProfile`) and pushes it into `usePerformanceStore`
 * exactly once, as high in the React tree as possible.
 *
 * React 19 Strict Mode double-mounts effects in development: the mount →
 * unmount → mount cycle would fire the IPC call twice and hydrate twice. The
 * module-scoped `_hasHydrated` flag survives that remount (modules are
 * singletons across the Strict Mode remount), so the second pass is a no-op.
 * This mirrors the `_hasInitialized` pattern in `useDevicePersistence`
 * (hooks/useDevicePersistence.ts:152-186) — the blueprint's required pattern.
 *
 * On any failure (IPC missing, renderer in a non-Electron context, rejected
 * invoke) the store stays on its HQ defaults and `isHydrated` remains false.
 * The future Eco wave's swaps gate on `selectIsHydrated`, so a failed hydrate
 * degrades gracefully to full fidelity rather than to a half-hydrated ECO state
 * (blueprint §2.3 consumption rule).
 *
 * @module hooks/usePerformanceHydration
 * @version 7580.0.0 - Vanguard Launcher
 */

import { useEffect } from 'react'
import { usePerformanceStore } from '../stores/performanceStore'

/**
 * Module-scoped hydration guard. Survives React 19 Strict Mode's mount →
 * unmount → mount cycle because ES modules are singletons across remounts.
 */
let _hasHydrated = false

/**
 * Call once, as high in the tree as possible — the same always-mounted
 * component that runs the other boot-time hooks. See `AppContent` in
 * `AppCommander.tsx`.
 */
export function usePerformanceHydration(): void {
  useEffect(() => {
    if (_hasHydrated) return
    _hasHydrated = true

    ;(async () => {
      try {
        const res = await window.lux?.getPerformanceProfile?.()
        if (res) {
          usePerformanceStore.getState().hydrate(res)
        }
      } catch (err) {
        console.error('[PerformanceHydration] failed, staying on HQ defaults:', err)
      }
    })()
  }, [])
}
