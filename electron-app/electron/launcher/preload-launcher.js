/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🚀 WAVE 7580 — VANGUARD LAUNCHER
 * Minimal preload for the pre-boot render fidelity window.
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Exposes exactly THREE methods on `window.vanguard`:
 *   - probe()       → hardware readout + recommended/current tier + app version
 *   - commit(req)   → persist the chosen tier, then main closes this window
 *   - cancel()      → dismiss without persisting; boot continues on the stored tier
 *
 * ZERO access to `luxsync`, `lux`, `electron` or `luxDebug`. In particular the
 * raw `ipcRenderer` passthrough that the main preload exposes as
 * `window.electron` is deliberately NOT mirrored here — it would let this window
 * reach any channel in the app.
 *
 * ─── COMMONJS ON PURPOSE ──────────────────────────────────────────────────────
 * This file is plain CJS (`require`, not `import`) and is shipped verbatim: it is
 * NOT listed as a `vite-plugin-electron` entry in `vite.config.ts`. It is copied
 * byte-for-byte into `dist-electron/launcher/` by `scripts/copy-launcher.cjs`.
 * Adding it as a Vite entry would transpile it to ESM and break `require` at
 * runtime. This mirrors `electron/license/preload-activation.js` exactly.
 *
 * @module electron/launcher/preload-launcher
 * @version 7580.0.0
 */

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('vanguard', {
  /** @returns {Promise<{hardware:object,recommendedTier:string,currentTier:string,appVersion:string}>} */
  probe: () => ipcRenderer.invoke('launcher:probe'),

  /**
   * @param {{tier:string, skipLauncher:boolean}} req
   * @returns {Promise<{ok:boolean,error?:string}>}
   */
  commit: (req) => ipcRenderer.invoke('launcher:commit', req),

  /** Fire-and-forget dismiss. */
  cancel: () => ipcRenderer.send('launcher:cancel'),
})
