/**
 * WAVE 2489 — THE OBSIDIAN VAULT
 * forge-jsc.js: El Compilador Oscuro
 *
 * Pipeline:
 *   1. Lee main.js post-build de dist-electron/
 *   2. Calcula su SHA-256 (Phantom Gate)
 *   3. Lee LicenseValidator.js source
 *   4. Inyecta el hash de main.js en el placeholder
 *   5. Inyecta la clave pública RSA en el placeholder
 *   6. Compila .js → .jsc con bytenode
 *   7. Destruye el .js intermedio
 *
 * Se ejecuta en el pipeline de build DESPUÉS de vite build y ANTES de electron-builder.
 */

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

// Bytenode está en electron-app/node_modules — resolverlo explícitamente
const electronAppNodeModules = path.join(__dirname, '..', 'electron-app', 'node_modules')
const bytenodePath = require.resolve('bytenode', { paths: [electronAppNodeModules] })
const bytenode = require(bytenodePath)

const DIST = path.join(__dirname, '..', 'electron-app', 'dist-electron')
const MAIN_JS = path.join(DIST, 'main.js')
const LICENSE_SRC = path.join(__dirname, '..', 'electron-app', 'electron', 'license', 'LicenseValidator.js')
const LICENSE_DIST_DIR = path.join(DIST, 'license')
const LICENSE_DIST_JS = path.join(LICENSE_DIST_DIR, 'LicenseValidator.js')
const LICENSE_DIST_JSC = path.join(LICENSE_DIST_DIR, 'LicenseValidator.jsc')
const PUBLIC_KEY_PATH = path.join(__dirname, 'keys', 'luxsync-public.pem')

// WAVE 2491: Activation screen assets
const ACTIVATION_HTML_SRC = path.join(__dirname, '..', 'electron-app', 'electron', 'license', 'activation.html')
const ACTIVATION_HTML_DIST = path.join(LICENSE_DIST_DIR, 'activation.html')
const PRELOAD_ACTIVATION_SRC = path.join(__dirname, '..', 'electron-app', 'electron', 'license', 'preload-activation.js')
const PRELOAD_ACTIVATION_DIST = path.join(LICENSE_DIST_DIR, 'preload-activation.js')

console.log('')
console.log('  ╔══════════════════════════════════════════════╗')
console.log('  ║   🛡️  OBSIDIAN VAULT — FORGE JSC            ║')
console.log('  ╠══════════════════════════════════════════════╣')

// ═══════════════════════════════════════════════════════════════════════════
// PASO 1: Verificar que main.js existe (post-vite-build)
// ═══════════════════════════════════════════════════════════════════════════

if (!fs.existsSync(MAIN_JS)) {
  console.error('  ║  ❌ main.js no encontrado en dist-electron/  ║')
  console.error('  ║     Ejecuta "vite build" primero.             ║')
  console.error('  ╚══════════════════════════════════════════════╝')
  process.exit(1)
}

// ═══════════════════════════════════════════════════════════════════════════
// PASO 2: Calcular SHA-256 de main.js (Phantom Gate)
// ═══════════════════════════════════════════════════════════════════════════

const mainContent = fs.readFileSync(MAIN_JS)
const mainHash = crypto.createHash('sha256').update(mainContent).digest('hex')
console.log(`  ║  main.js hash: ${mainHash.substring(0, 24)}...      ║`)

// ═══════════════════════════════════════════════════════════════════════════
// PASO 3: Cargar clave pública RSA
// ═══════════════════════════════════════════════════════════════════════════

if (!fs.existsSync(PUBLIC_KEY_PATH)) {
  console.error('  ║  ❌ luxsync-public.pem no encontrado          ║')
  console.error('  ║     Genera las llaves RSA primero.            ║')
  console.error('  ╚══════════════════════════════════════════════╝')
  process.exit(1)
}

const publicKey = fs.readFileSync(PUBLIC_KEY_PATH, 'utf-8').trim()
console.log(`  ║  Public key loaded (${publicKey.length} chars)            ║`)

// ═══════════════════════════════════════════════════════════════════════════
// PASO 4: Leer LicenseValidator.js source e inyectar valores
// ═══════════════════════════════════════════════════════════════════════════

if (!fs.existsSync(LICENSE_SRC)) {
  console.error('  ║  ❌ LicenseValidator.js source no encontrado  ║')
  console.error('  ╚══════════════════════════════════════════════╝')
  process.exit(1)
}

let validatorCode = fs.readFileSync(LICENSE_SRC, 'utf-8')

// Inyectar clave pública
if (!validatorCode.includes('%%LUXSYNC_PUBLIC_KEY%%')) {
  console.error('  ║  ❌ Placeholder PUBLIC_KEY no encontrado       ║')
  console.error('  ╚══════════════════════════════════════════════╝')
  process.exit(1)
}
validatorCode = validatorCode.replace('%%LUXSYNC_PUBLIC_KEY%%', publicKey)

// Inyectar hash de main.js
if (!validatorCode.includes('%%MAIN_JS_HASH%%')) {
  console.error('  ║  ❌ Placeholder MAIN_JS_HASH no encontrado    ║')
  console.error('  ╚══════════════════════════════════════════════╝')
  process.exit(1)
}
validatorCode = validatorCode.replace('%%MAIN_JS_HASH%%', mainHash)

// ═══════════════════════════════════════════════════════════════════════════
// PASO 5: Escribir el .js inyectado en dist-electron/license/
// ═══════════════════════════════════════════════════════════════════════════

if (!fs.existsSync(LICENSE_DIST_DIR)) {
  fs.mkdirSync(LICENSE_DIST_DIR, { recursive: true })
}

fs.writeFileSync(LICENSE_DIST_JS, validatorCode, 'utf-8')
console.log('  ║  LicenseValidator.js inyectado ✅              ║')

// ═══════════════════════════════════════════════════════════════════════════
// PASO 6: Compilar .js → .jsc con bytenode (usando el V8 de Electron)
// ═══════════════════════════════════════════════════════════════════════════

// CRÍTICO: compileFile con electron:true usa el binario de Electron como runtime,
// generando bytecode V8 compatible con la versión de Electron empaquetada.
// compileAsModule:true envuelve el código con Module.wrap() para que
// require, module, exports, __filename, __dirname estén disponibles.
;(async () => {
  await bytenode.compileFile({
    filename: LICENSE_DIST_JS,
    output: LICENSE_DIST_JSC,
    electron: true,
    compileAsModule: true,
  })
  console.log('  ║  LicenseValidator.jsc forjado  ✅              ║')

  // ═══════════════════════════════════════════════════════════════════════════
  // PASO 7: Destruir el .js intermedio
  // ═══════════════════════════════════════════════════════════════════════════

  fs.unlinkSync(LICENSE_DIST_JS)
  console.log('  ║  LicenseValidator.js destruido  🔥             ║')

  // ═══════════════════════════════════════════════════════════════════════════
  // PASO 8: Copiar Activation Screen assets (WAVE 2491)
  // ═══════════════════════════════════════════════════════════════════════════

  fs.copyFileSync(ACTIVATION_HTML_SRC, ACTIVATION_HTML_DIST)
  console.log('  ║  activation.html copiado       ✅              ║')

  fs.copyFileSync(PRELOAD_ACTIVATION_SRC, PRELOAD_ACTIVATION_DIST)
  console.log('  ║  preload-activation.js copiado ✅              ║')

  // ═══════════════════════════════════════════════════════════════════════════
  // VERIFICACIÓN FINAL
  // ═══════════════════════════════════════════════════════════════════════════

  const jscExists = fs.existsSync(LICENSE_DIST_JSC)
  const jsGone = !fs.existsSync(LICENSE_DIST_JS)
  const jscSize = jscExists ? fs.statSync(LICENSE_DIST_JSC).size : 0

  if (jscExists && jsGone) {
    console.log(`  ║  .jsc size: ${(jscSize / 1024).toFixed(1)}KB                          ║`)
    console.log('  ║                                              ║')
    console.log('  ║  ✅ FORGE COMPLETE — Source destroyed         ║')
  } else {
    console.error('  ║  ❌ FORGE FAILED — Verificación final KO     ║')
    process.exit(1)
  }

  console.log('  ╚══════════════════════════════════════════════╝')
  console.log('')
})()
