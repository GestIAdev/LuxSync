/**
 * WAVE 2489 — THE OBSIDIAN VAULT
 * LicenseValidator: Two-Gate Bootloader Pattern
 *
 * Este archivo se compila a bytecode V8 (.jsc) via bytenode.
 * El .js intermedio se destruye en el build. Solo queda el binario.
 *
 * Gate 1: Hardware ID (MAC address) vs licencia
 * Gate 2: Firma RSA-2048/SHA-256 vs clave pública embebida
 *
 * CommonJS exports — requerido por bytenode.
 */

'use strict'

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const os = require('os')

// ═══════════════════════════════════════════════════════════════════════════
// CLAVE PÚBLICA RSA — EMBEBIDA EN BYTECODE
// Se extrae de scripts/keys/luxsync-public.pem y se pega aquí.
// Cuando se compile a .jsc, estos bytes quedarán dentro del bytecode V8.
// ═══════════════════════════════════════════════════════════════════════════

const PUBLIC_KEY = `%%LUXSYNC_PUBLIC_KEY%%`

// ═══════════════════════════════════════════════════════════════════════════
// PHANTOM GATE — Hash de integridad de main.js
// forge-jsc.js inyecta el SHA-256 de main.js ANTES de compilar a .jsc
// Si alguien parchea main.js para saltarse el require, este hash falla.
// ═══════════════════════════════════════════════════════════════════════════

const EXPECTED_MAIN_HASH = '%%MAIN_JS_HASH%%'

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS (inline — no imports, esto es CommonJS standalone)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @typedef {'DJ_FOUNDER' | 'FULL_SUITE'} LicenseTier
 *
 * @typedef {Object} LuxLicense
 * @property {string} client
 * @property {string} hardwareId
 * @property {LicenseTier} tier
 * @property {string} issuedAt
 * @property {string} signature
 *
 * @typedef {Object} LicenseValidationResult
 * @property {boolean} valid
 * @property {boolean} gate1
 * @property {boolean} gate2
 * @property {boolean} phantomGate
 * @property {string} detectedHwId
 * @property {string} [client]
 * @property {LicenseTier} [tier]
 * @property {string} [error]
 */

const VALID_TIERS = ['DJ_FOUNDER', 'FULL_SUITE']

// ═══════════════════════════════════════════════════════════════════════════
// GATE 1 — HARDWARE FINGERPRINT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Captura la MAC address de la primera interfaz de red no-interna.
 * Node.js nativo: os.networkInterfaces(). Zero dependencias externas.
 * @returns {string} MAC normalizada (lowercase, separada por ':')
 */
function getHardwareId() {
  const interfaces = os.networkInterfaces()
  const names = Object.keys(interfaces)

  for (const name of names) {
    const addrs = interfaces[name]
    if (!addrs) continue

    for (const addr of addrs) {
      if (
        addr.family === 'IPv4' &&
        !addr.internal &&
        addr.mac &&
        addr.mac !== '00:00:00:00:00:00'
      ) {
        return addr.mac.toLowerCase()
      }
    }
  }

  // Fallback: ninguna interfaz encontrada
  return 'UNKNOWN_HARDWARE'
}

// ═══════════════════════════════════════════════════════════════════════════
// SERIALIZACIÓN DETERMINISTA (duplicada del VeritasRSA — standalone)
// ═══════════════════════════════════════════════════════════════════════════

function serializePayload(payload) {
  const ordered = {}
  const keys = Object.keys(payload).sort()
  for (const key of keys) {
    ordered[key] = payload[key]
  }
  return JSON.stringify(ordered)
}

function hashPayload(payload) {
  const serialized = serializePayload(payload)
  return crypto.createHash('sha256').update(serialized).digest('hex')
}

// ═══════════════════════════════════════════════════════════════════════════
// GATE 2 — VERIFICACIÓN RSA
// ═══════════════════════════════════════════════════════════════════════════

function rsaVerify(dataHash, signatureHex, publicKeyPem) {
  return crypto.verify(
    'sha256',
    Buffer.from(dataHash),
    publicKeyPem,
    Buffer.from(signatureHex, 'hex')
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// PHANTOM GATE — INTEGRIDAD DE main.js
// ═══════════════════════════════════════════════════════════════════════════

function verifyMainIntegrity() {
  // En dev o sin hash inyectado, pasar
  if (EXPECTED_MAIN_HASH === '%%MAIN_JS_HASH%%') return true

  try {
    // En el paquete, este .jsc vive en app.asar.unpacked/dist-electron/license/
    // pero main.js vive dentro de app.asar/dist-electron/main.js.
    // Reescribir la ruta para apuntar al asar real.
    let baseDir = path.join(__dirname, '..')
    baseDir = baseDir.replace('app.asar.unpacked', 'app.asar')
    const mainPath = path.join(baseDir, 'main.js')
    const mainContent = fs.readFileSync(mainPath)
    const actualHash = crypto.createHash('sha256').update(mainContent).digest('hex')
    return actualHash === EXPECTED_MAIN_HASH
  } catch {
    // Si no se puede leer main.js, algo va muy mal
    return false
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// VALIDACIÓN ESTRUCTURAL
// ═══════════════════════════════════════════════════════════════════════════

function isValidStructure(data) {
  if (typeof data !== 'object' || data === null) return false
  if (typeof data.client !== 'string' || data.client.length === 0 || data.client.length > 128) return false
  if (typeof data.hardwareId !== 'string' || data.hardwareId.length === 0) return false
  if (typeof data.tier !== 'string' || !VALID_TIERS.includes(data.tier)) return false
  if (typeof data.issuedAt !== 'string' || isNaN(Date.parse(data.issuedAt))) return false
  if (typeof data.signature !== 'string' || data.signature.length === 0) return false
  return true
}

// ═══════════════════════════════════════════════════════════════════════════
// FUNCIÓN PRINCIPAL — TWO-GATE VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Valida la licencia completa. Se llama desde main.ts al arranque.
 *
 * @param {string} [licensePath] — Ruta al .luxlicense. Si no se pasa, busca en userData.
 * @returns {LicenseValidationResult}
 */
function validateLicense(licensePath) {
  const detectedHwId = getHardwareId()

  // Phantom Gate primero — si main.js fue parcheado, rechazar
  const phantomOk = verifyMainIntegrity()
  if (!phantomOk) {
    return {
      valid: false,
      gate1: false,
      gate2: false,
      phantomGate: false,
      detectedHwId,
      error: 'TAMPER_DETECTED: main.js integrity check failed'
    }
  }

  // Resolver ruta del archivo de licencia
  let resolvedPath = licensePath
  if (!resolvedPath) {
    // Buscar en la ubicación canónica: userData/license/license.luxlicense
    // app.getPath('userData') no está disponible aquí (no tenemos Electron app object).
    // Recibimos la ruta como argumento desde main.ts.
    return {
      valid: false,
      gate1: false,
      gate2: false,
      phantomGate: true,
      detectedHwId,
      error: 'NO_LICENSE_PATH: licensePath argument is required'
    }
  }

  // Intentar leer archivo
  if (!fs.existsSync(resolvedPath)) {
    return {
      valid: false,
      gate1: false,
      gate2: false,
      phantomGate: true,
      detectedHwId,
      error: `LICENSE_NOT_FOUND: ${resolvedPath}`
    }
  }

  let rawContent
  try {
    rawContent = fs.readFileSync(resolvedPath, 'utf-8')
  } catch {
    return {
      valid: false,
      gate1: false,
      gate2: false,
      phantomGate: true,
      detectedHwId,
      error: 'LICENSE_READ_ERROR: Could not read license file'
    }
  }

  let license
  try {
    license = JSON.parse(rawContent)
  } catch {
    return {
      valid: false,
      gate1: false,
      gate2: false,
      phantomGate: true,
      detectedHwId,
      error: 'LICENSE_PARSE_ERROR: Invalid JSON in license file'
    }
  }

  // Validar estructura
  if (!isValidStructure(license)) {
    return {
      valid: false,
      gate1: false,
      gate2: false,
      phantomGate: true,
      detectedHwId,
      error: 'LICENSE_STRUCTURE_ERROR: Missing or invalid fields'
    }
  }

  // ═══════════════════════════
  // GATE 1 — Hardware ID Match
  // ═══════════════════════════
  const gate1 = license.hardwareId.toLowerCase() === detectedHwId

  // ═══════════════════════════
  // GATE 2 — RSA Signature
  // ═══════════════════════════
  let gate2 = false
  try {
    const payload = {
      client: license.client,
      hardwareId: license.hardwareId,
      tier: license.tier,
      issuedAt: license.issuedAt
    }
    const dataHash = hashPayload(payload)
    gate2 = rsaVerify(dataHash, license.signature, PUBLIC_KEY)
  } catch {
    gate2 = false
  }

  const valid = gate1 && gate2

  return {
    valid,
    gate1,
    gate2,
    phantomGate: true,
    detectedHwId,
    client: license.client,
    tier: license.tier,
    error: valid ? undefined :
      !gate1 ? 'GATE1_FAILED: Hardware ID mismatch' :
      'GATE2_FAILED: RSA signature verification failed'
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS — CommonJS (requerido por bytenode)
// ═══════════════════════════════════════════════════════════════════════════

module.exports = { validateLicense, getHardwareId }
