/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🚀 LAUNCHER IPC — WAVE 7580: VANGUARD LAUNCHER
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Dedicated IPC surface for the pre-boot Launcher window.
 *
 * WHY DEDICATED CHANNELS (blueprint §0.2):
 * The pre-existing config channels cannot be reused.
 *  - `lux:get-config`  → has NO handler registered anywhere; `invoke` rejects.
 *  - `lux:save-config` → its handler calls `configManager.saveConfig()`, a method
 *                        that does not exist on ConfigManagerV2, so the guard is
 *                        always falsy and it always returns `{ success: false }`.
 *  - `config:get` / `config:set` / `config:save` → these DO work, but they are
 *                        registered inside `setupIPCHandlers()`, which runs in
 *                        `initTitan()` — and `initTitan()` has not run yet while
 *                        the Launcher is open.
 *
 * Hence: four self-contained `launcher:*` channels, registered before the
 * Launcher window loads.
 *
 * LIFECYCLE WARNING:
 * `launcher:probe`, `launcher:commit` and `launcher:cancel` are only meaningful
 * while the Launcher window lives, but `launcher:getProfile` is called later by
 * the MAIN APP renderer to hydrate `usePerformanceStore`. All four are therefore
 * registered unconditionally and NONE are ever removed. Registering them inside
 * an `if (shouldShowLauncher)` branch would leave `launcher:getProfile` missing
 * whenever the Launcher is skipped, and hydration would silently fall back to HQ
 * (blueprint risk #5).
 *
 * @module electron/launcher/launcherIpc
 * @version 7580.0.0
 */

import { app, ipcMain, BrowserWindow } from 'electron'

import { configManager } from '../../src/core/config/ConfigManagerV2'
import type {
  HardwareProfile,
  PerformanceProfile,
  PerformanceTier,
} from '../../src/core/config/performanceTiers'
import { isPerformanceTier, scoreHardware } from '../../src/core/config/performanceTiers'
import { probeHardware } from './probeHardware'

// ═══════════════════════════════════════════════════════════════════════════════
// IPC PAYLOAD CONTRACTS
// ═══════════════════════════════════════════════════════════════════════════════

/** Response of `launcher:probe` — everything the Launcher UI needs to render. */
export interface LauncherProbePayload {
  /** Probed capabilities of this machine */
  hardware: HardwareProfile
  /** Heuristic recommendation from `scoreHardware()` — gets the RECOMMENDED pill */
  recommendedTier: PerformanceTier
  /** Currently persisted tier — the default selection in the UI */
  currentTier: PerformanceTier
  /** App version, for the Launcher footer */
  appVersion: string
}

/** Request body of `launcher:commit`. Arrives from a renderer: treat as untrusted. */
export interface LauncherCommitRequest {
  tier: PerformanceTier
  /** The "Don't ask again on this machine" checkbox */
  skipLauncher: boolean
}

/** Response of `launcher:commit`. */
export interface LauncherCommitResult {
  ok: boolean
  error?: string
}

/** Response of `launcher:getProfile` — consumed by `usePerformanceStore.hydrate()`. */
export interface LauncherGetProfileResult {
  tier: PerformanceTier
  hardware: HardwareProfile | null
}

/** Dependencies injected by `main.ts`. */
export interface LauncherIpcDeps {
  /** Returns the live Launcher window, or null once it is gone */
  getLauncherWindow: () => BrowserWindow | null
  /**
   * Optional secondary signal fired after a commit or cancel.
   *
   * `main.ts` should treat the window's own `'closed'` event as the single
   * funnel for resuming boot (blueprint invariant #3) — every exit path
   * (commit, cancel, OS close) passes through it. This hook exists only for
   * logging/telemetry and must not be the sole resume trigger.
   */
  onDecided?: (outcome: 'committed' | 'cancelled') => void
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE STATE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Idempotency guard. `app.on('activate')` (macOS) can re-enter the boot path,
 * and a second `ipcMain.handle()` on the same channel throws
 * "Attempted to register a second handler" (blueprint risk #7).
 */
let registered = false

/**
 * Hardware snapshot, probed once and reused.
 *
 * Cached so that `launcher:probe` and `launcher:commit` are guaranteed to agree:
 * re-probing on commit could theoretically yield a different GPU status (the GPU
 * process can change state) and persist a `recommendedTier` that never matched
 * what the operator was shown.
 */
let cachedHardware: HardwareProfile | null = null

/** Lazily probe and memoize. */
function getHardware(): HardwareProfile {
  if (!cachedHardware) {
    cachedHardware = probeHardware()
  }
  return cachedHardware
}

/**
 * Expose the memoized snapshot to `main.ts` so the skip-path can refresh the
 * persisted `hardware` field without triggering a second probe.
 */
export function getProbedHardware(): HardwareProfile {
  return getHardware()
}

/** Close the Launcher window if it is still alive. Safe to call repeatedly. */
function closeLauncher(deps: LauncherIpcDeps): void {
  const win = deps.getLauncherWindow()
  if (win && !win.isDestroyed()) {
    win.close()
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// REGISTRATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Register the four `launcher:*` channels.
 *
 * Call once, from the Launcher gate in `main.ts`, BEFORE the Launcher window
 * loads (its inline script calls `launcher:probe` on `DOMContentLoaded`), and
 * unconditionally — including when the Launcher is skipped.
 */
export function registerLauncherIpc(deps: LauncherIpcDeps): void {
  if (registered) {
    console.log('[Vanguard] IPC already registered, skipping')
    return
  }
  registered = true

  // ───────────────────────────────────────────────────────────────────────────
  // launcher:probe — renderer → main, invoke
  // ───────────────────────────────────────────────────────────────────────────
  ipcMain.handle('launcher:probe', (): LauncherProbePayload => {
    const hardware = getHardware()
    const profile = configManager.getPerformanceProfile()

    return {
      hardware,
      recommendedTier: scoreHardware(hardware),
      currentTier: profile.tier,
      appVersion: app.getVersion(),
    }
  })

  // ───────────────────────────────────────────────────────────────────────────
  // launcher:commit — renderer → main, invoke
  // ───────────────────────────────────────────────────────────────────────────
  ipcMain.handle(
    'launcher:commit',
    async (_event, request: unknown): Promise<LauncherCommitResult> => {
      try {
        // ── Validate the trust boundary ──
        // `request` crosses from a renderer process. Narrow it; never cast.
        const req = request as Partial<LauncherCommitRequest> | null | undefined

        if (!req || !isPerformanceTier(req.tier)) {
          const error = `Invalid tier received: ${JSON.stringify(req?.tier)}`
          console.error('[Vanguard]', error)
          return { ok: false, error }
        }

        const hardware = getHardware()

        const patch: Partial<PerformanceProfile> = {
          tier: req.tier,
          skipLauncher: req.skipLauncher === true,
          userConfirmed: true,
          hardware,
          recommendedTier: scoreHardware(hardware),
          decidedAt: new Date().toISOString(),
        }

        // Awaited atomic write — the renderer reads this back over
        // `launcher:getProfile` right after mount (invariant #4).
        const saved = await configManager.setPerformanceProfile(patch)

        if (!saved) {
          const error = 'Failed to write luxsync-config.json'
          console.error('[Vanguard]', error)
          // Leave the window OPEN so the operator can retry.
          return { ok: false, error }
        }

        console.log(
          `[Vanguard] ✅ Tier committed: ${patch.tier} ` +
            `(recommended=${patch.recommendedTier}, skipLauncher=${patch.skipLauncher})`
        )

        closeLauncher(deps)
        deps.onDecided?.('committed')

        return { ok: true }
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err)
        console.error('[Vanguard] Commit threw:', error)
        return { ok: false, error }
      }
    }
  )

  // ───────────────────────────────────────────────────────────────────────────
  // launcher:cancel — renderer → main, send (fire-and-forget)
  //
  // Esc / dismiss. Persists nothing: boot continues on the currently stored
  // tier. Deliberately does NOT call app.quit() — unlike the license activation
  // window, dismissing the Launcher must never be able to block startup
  // (blueprint invariant #6).
  // ───────────────────────────────────────────────────────────────────────────
  ipcMain.on('launcher:cancel', () => {
    console.log('[Vanguard] Launcher cancelled — booting with the persisted tier')
    closeLauncher(deps)
    deps.onDecided?.('cancelled')
  })

  // ───────────────────────────────────────────────────────────────────────────
  // launcher:getProfile — MAIN APP renderer → main, invoke
  //
  // Consumed by `usePerformanceHydration()` at app mount. Must stay registered
  // for the whole app lifetime, long after the Launcher window is gone.
  // ───────────────────────────────────────────────────────────────────────────
  ipcMain.handle('launcher:getProfile', (): LauncherGetProfileResult => {
    const profile = configManager.getPerformanceProfile()
    return {
      tier: profile.tier,
      hardware: profile.hardware,
    }
  })

  console.log('[Vanguard] IPC registered: probe, commit, cancel, getProfile')
}
