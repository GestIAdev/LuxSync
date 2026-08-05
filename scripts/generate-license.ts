/**
 * WAVE 2489 — THE OBSIDIAN VAULT
 * La Forja de Llaves: Generador offline de archivos .luxlicense
 *
 * Uso:
 *   npx tsx scripts/generate-license.ts --client "DJ_Pepito" --hwid "a1:b2:c3:d4:e5:f6" --tier DJ_FOUNDER --out ./licenses/DJ_Pepito.luxlicense
 *
 * Dependencias: CERO externas. Solo Node.js crypto + fs.
 * Este script NUNCA se distribuye. Vive en la máquina de Radwulf.
 */

import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

// Reutilizamos tipos y funciones del motor RSA
// (en ejecución directa con tsx/ts-node, el import funciona)
import {
  type LicenseTier,
  type LuxLicensePayload,
  type LuxLicense,
  serializePayload,
  hashPayload,
  rsaSign
} from '../electron-app/electron/license/VeritasRSA'

// ═══════════════════════════════════════════════════════════════════════════
// CLI ARGUMENT PARSER — Zero dependencias
// ═══════════════════════════════════════════════════════════════════════════

interface CLIArgs {
  client: string
  hwid: string
  tier: LicenseTier
  out: string
  expiresAt?: string  // 🔒 V-03: Optional expiration (ISO string). Omitted = perpetual.
}

function parseArgs(): CLIArgs {
  const args = process.argv.slice(2)
  const map = new Map<string, string>()

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]
    const value = args[i + 1]
    if (!key.startsWith('--') || value === undefined) {
      console.error(`❌ Argumento inválido: ${key} ${value ?? '(vacío)'}`)
      process.exit(1)
    }
    map.set(key.slice(2), value)
  }

  const client = map.get('client')
  const hwid = map.get('hwid')
  const tier = map.get('tier')
  const out = map.get('out')
  const expiresAt = map.get('expiresAt')  // 🔒 V-03: Optional

  if (!client || !hwid || !tier || !out) {
    console.error('❌ Uso: npx tsx scripts/generate-license.ts --client "nombre" --hwid "fingerprint-hash" --tier DJ_FOUNDER --out ./ruta.luxlicense [--expiresAt 2026-12-31T23:59:59Z]')
    console.error('   --client     Nombre/alias del DJ')
    console.error('   --hwid       Hardware ID (SHA-256 fingerprint hash from getHardwareId())')
    console.error('   --tier       DJ_FOUNDER | FULL_SUITE')
    console.error('   --out        Ruta del archivo .luxlicense a generar')
    console.error('   --expiresAt  (Opcional) Fecha de expiración ISO. Sin este flag = licencia vitalicia')
    process.exit(1)
  }

  const validTiers: LicenseTier[] = ['DJ_FOUNDER', 'FULL_SUITE']
  if (!validTiers.includes(tier as LicenseTier)) {
    console.error(`❌ Tier inválido: "${tier}". Debe ser DJ_FOUNDER o FULL_SUITE`)
    process.exit(1)
  }

  // 🔒 V-03: Validate expiresAt format if provided
  if (expiresAt && isNaN(Date.parse(expiresAt))) {
    console.error(`❌ expiresAt inválido: "${expiresAt}". Debe ser una fecha ISO válida.`)
    process.exit(1)
  }

  return { client, hwid, tier: tier as LicenseTier, out, expiresAt }
}

// ═══════════════════════════════════════════════════════════════════════════
// LA FORJA
// ═══════════════════════════════════════════════════════════════════════════

function forge(): void {
  const args = parseArgs()

  // 1. Cargar clave privada
  const privateKeyPath = path.join(__dirname, 'keys', 'luxsync-private.pem')
  if (!fs.existsSync(privateKeyPath)) {
    console.error(`❌ Clave privada no encontrada en: ${privateKeyPath}`)
    console.error('   Genera el par de llaves con:')
    console.error('   $ openssl genrsa -out scripts/keys/luxsync-private.pem 2048')
    console.error('   $ openssl rsa -in scripts/keys/luxsync-private.pem -pubout -out scripts/keys/luxsync-public.pem')
    process.exit(1)
  }

  const privateKeyPem = fs.readFileSync(privateKeyPath, 'utf-8')

  // 2. Construir payload
  const payload: LuxLicensePayload = {
    client: args.client,
    hardwareId: args.hwid.toLowerCase(),
    tier: args.tier,
    issuedAt: new Date().toISOString()
  }
  // 🔒 V-03: Include expiresAt in the signed payload if provided (perpetual if omitted)
  if (args.expiresAt) {
    (payload as any).expiresAt = args.expiresAt
  }

  // 3. Hash determinista
  const dataHash = hashPayload(payload)

  // 4. Firmar con RSA-2048
  const signature = rsaSign(dataHash, privateKeyPem)

  // 5. Ensamblar licencia completa
  const license: LuxLicense = {
    ...payload,
    signature
  }

  // 6. Escribir archivo
  const outDir = path.dirname(args.out)
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true })
  }
  fs.writeFileSync(args.out, JSON.stringify(license, null, 2), 'utf-8')

  // 7. Verificación cruzada: releer y comprobar estructura
  const written = JSON.parse(fs.readFileSync(args.out, 'utf-8'))
  const verifyPayload: any = {
    client: written.client,
    hardwareId: written.hardwareId,
    tier: written.tier,
    issuedAt: written.issuedAt
  }
  // 🔒 V-03: Include expiresAt in cross-verification if present
  if (written.expiresAt) {
    verifyPayload.expiresAt = written.expiresAt
  }
  const verifyHash = hashPayload(verifyPayload)

  // Cargar clave pública para verificación cruzada
  const publicKeyPath = path.join(__dirname, 'keys', 'luxsync-public.pem')
  if (fs.existsSync(publicKeyPath)) {
    const publicKeyPem = fs.readFileSync(publicKeyPath, 'utf-8')
    const isValid = crypto.verify(
      'sha256',
      Buffer.from(verifyHash),
      publicKeyPem,
      Buffer.from(written.signature, 'hex')
    )
    if (!isValid) {
      console.error('❌ FALLO CRÍTICO: La firma generada NO verifica. Revisa las llaves.')
      process.exit(1)
    }
  }

  // 8. Resumen
  console.log('')
  console.log('  ╔══════════════════════════════════════════════╗')
  console.log('  ║        🛡️  OBSIDIAN VAULT — FORJA           ║')
  console.log('  ╠══════════════════════════════════════════════╣')
  console.log(`  ║  Cliente:    ${args.client.padEnd(30)}║`)
  console.log(`  ║  Hardware:   ${args.hwid.substring(0, 30).padEnd(30)}║`)
  console.log(`  ║  Tier:       ${args.tier.padEnd(30)}║`)
  console.log(`  ║  Expira:     ${(args.expiresAt || 'Vitalicia').padEnd(30)}║`)
  console.log(`  ║  Hash:       ${dataHash.substring(0, 28)}... ║`)
  console.log(`  ║  Firma:      ${signature.substring(0, 28)}... ║`)
  console.log(`  ║  Archivo:    ${path.basename(args.out).padEnd(30)}║`)
  console.log('  ║                                              ║')
  console.log('  ║  ✅ Licencia forjada y verificada            ║')
  console.log('  ╚══════════════════════════════════════════════╝')
  console.log('')
}

forge()
