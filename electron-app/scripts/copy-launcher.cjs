/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🚀 WAVE 7580 — VANGUARD LAUNCHER: ASSET COPY STEP
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Copies the Launcher's two hand-written assets into `dist-electron/launcher/`:
 *   - launcher.html          (self-contained HTML + CSS + JS)
 *   - preload-launcher.js    (CommonJS, shipped verbatim)
 *
 * WHY A COPY STEP IS REQUIRED
 * `vite.config.ts` only compiles the TypeScript entries listed in its
 * `electron([...])` array. Neither of these files is such an entry — and
 * `preload-launcher.js` deliberately must NOT be one, because Vite would
 * transpile it to ESM and break its `require('electron')` call at runtime.
 * Without this script the Launcher works in dev (if dist-electron happens to be
 * warm) and shows a blank window in production. That is blueprint risk #3.
 *
 * This mirrors how the license activation window's assets reach the build:
 * `scripts/forge-jsc.cjs` copies `activation.html` + `preload-activation.js`
 * into `dist-electron/license/`. The Launcher gets its own script rather than
 * riding along in the license forge, which has a different responsibility and
 * only runs for packaged builds.
 *
 * PACKAGING
 * No `package.json > build` change is needed: `build.files` already globs
 * `dist-electron/**\/*`, so anything landing here is packaged. The assets do NOT
 * need `asarUnpack` — Electron reads HTML via `loadFile()` and preload scripts
 * from inside `app.asar` natively. (The license folder is unpacked only because
 * bytenode needs a real filesystem path for its `.jsc`.)
 *
 * FAILS LOUD ON PURPOSE: a silent copy failure is the exact bug this step
 * exists to prevent, so a missing source file exits non-zero and breaks the
 * build rather than shipping a broken Launcher.
 *
 * Usage: node scripts/copy-launcher.cjs        (cwd must be electron-app/)
 */

const fs = require('fs')
const path = require('path')

const APP_ROOT = path.join(__dirname, '..')
const SRC_DIR = path.join(APP_ROOT, 'electron', 'launcher')
const DEST_DIR = path.join(APP_ROOT, 'dist-electron', 'launcher')

/** Hand-written assets that Vite does not process. */
const ASSETS = ['launcher.html', 'preload-launcher.js']

function main() {
  const missing = ASSETS.filter((f) => !fs.existsSync(path.join(SRC_DIR, f)))

  if (missing.length > 0) {
    console.error('[copy-launcher] ❌ Missing source asset(s):')
    for (const f of missing) {
      console.error('                  ' + path.join(SRC_DIR, f))
    }
    process.exit(1)
  }

  fs.mkdirSync(DEST_DIR, { recursive: true })

  for (const file of ASSETS) {
    const from = path.join(SRC_DIR, file)
    const to = path.join(DEST_DIR, file)
    fs.copyFileSync(from, to)

    // Verify the write actually landed — a copy into a path that a later build
    // step wipes is the failure mode we are guarding against.
    if (!fs.existsSync(to)) {
      console.error(`[copy-launcher] ❌ Copy reported success but ${to} is absent`)
      process.exit(1)
    }

    const bytes = fs.statSync(to).size
    console.log(`[copy-launcher] ✅ ${file} → dist-electron/launcher/ (${bytes} bytes)`)
  }
}

main()
