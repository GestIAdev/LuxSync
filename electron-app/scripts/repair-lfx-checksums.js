/**
 * WAVE 7520.1 — LFX CHECKSUM REPAIR
 *
 * Script de mantenimiento de un solo uso. Recalibra el campo `checksum` de
 * todos los archivos `.lfx` en builtins/ y userData/arsenal/ para que
 * coincida con el SHA-256 canónico del clip que contienen.
 *
 * NO toca el contenido del clip — solo reescribe el campo `checksum` con el
 * formato canónico `sha256:<hex>`.
 *
 * Casos que cubre:
 *   - Checksum ausente (`""` o campo faltante) → lo incrusta
 *   - Checksum sin prefijo (`38d146...`) → lo normaliza a `sha256:38d146...`
 *   - Checksum genuinamente incorrecto → lo recalcula
 *   - Checksum ya correcto → no reescribe el archivo (no-op)
 *
 * Ejecución:
 *   node scripts/repair-lfx-checksums.js
 */

'use strict'

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const BUILTINS_DIR = path.resolve(__dirname, '../src/core/arsenal/builtins')

// userData/arsenal — donde la app guarda los clips del usuario en runtime.
// En Windows: %APPDATA%/luxsync-electron/arsenal
const USERDATA_DIR = path.join(
  process.env.APPDATA || process.env.HOME || '',
  'luxsync-electron',
  'arsenal',
)

// ─────────────────────────────────────────────────────────────────────────────
// CHECKSUM (espejo de computeLfxChecksum en LfxFileLoader.ts)
// ─────────────────────────────────────────────────────────────────────────────

function computeChecksum(clip) {
  const canonical = JSON.stringify(clip)
  const hash = crypto.createHash('sha256').update(canonical).digest('hex')
  return `sha256:${hash}`
}

function stripPrefix(s) {
  return s.startsWith('sha256:') ? s.slice(7) : s
}

// ─────────────────────────────────────────────────────────────────────────────
// FILE WALKER (recursive)
// ─────────────────────────────────────────────────────────────────────────────

function walkDir(dir, results) {
  if (!fs.existsSync(dir)) return
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walkDir(fullPath, results)
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.lfx')) {
      results.push(fullPath)
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PROCESSOR
// ─────────────────────────────────────────────────────────────────────────────

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8')
  // Strip UTF-8 BOM (U+FEFF) if present — same as HephaestusClipIndex.upsert()
  if (content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1)
  }
  const raw = JSON.parse(content)
  const clip = raw.clip
  if (!clip || typeof clip !== 'object') {
    return { status: 'skip', reason: 'no clip object' }
  }

  const declared = typeof raw.checksum === 'string' ? raw.checksum : ''
  const correct = computeChecksum(clip)

  // Ya está correcto (mismo hex, mismo formato) — no reescribir
  if (declared === correct) {
    return { status: 'ok', id: clip.id }
  }

  // Si el hex coincide pero el prefijo falta, es solo normalización
  const wasPrefixOnly =
    declared.length > 0 && stripPrefix(declared) === stripPrefix(correct)

  raw.checksum = correct
  fs.writeFileSync(filePath, JSON.stringify(raw, null, 2), 'utf8')

  return {
    status: wasPrefixOnly ? 'prefix-fixed' : 'repaired',
    id: clip.id,
    oldChecksum: declared || '(empty)',
    newChecksum: correct,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

function main() {
  console.log('╔══════════════════════════════════════════════════════════╗')
  console.log('║   WAVE 7520.1 — LFX CHECKSUM REPAIR                      ║')
  console.log('╚══════════════════════════════════════════════════════════╝\n')

  const dirs = [
    { label: 'builtins', path: BUILTINS_DIR },
    { label: 'userData', path: USERDATA_DIR },
  ]

  const stats = { ok: 0, prefixFixed: 0, repaired: 0, skipped: 0 }

  for (const { label, path: dir } of dirs) {
    const files = []
    walkDir(dir, files)
    if (files.length === 0) {
      console.log(`[${label}] ${dir} — (no .lfx files found)\n`)
      continue
    }
    console.log(`[${label}] ${dir} — ${files.length} .lfx files\n`)

    for (const filePath of files) {
      const rel = path.relative(dir, filePath)
      try {
        const result = processFile(filePath)
        if (result.status === 'ok') {
          stats.ok++
        } else if (result.status === 'prefix-fixed') {
          stats.prefixFixed++
          console.log(`  ↻ prefix  ${rel}`)
        } else if (result.status === 'repaired') {
          stats.repaired++
          console.log(`  🔧 repair  ${rel}`)
          console.log(`     old: ${result.oldChecksum}`)
          console.log(`     new: ${result.newChecksum}`)
        } else {
          stats.skipped++
          console.log(`  ⚠ skip    ${rel} — ${result.reason}`)
        }
      } catch (err) {
        stats.skipped++
        console.log(`  ✗ ERROR   ${rel} — ${err.message}`)
      }
    }
    console.log()
  }

  console.log('══════════════════════════════════════════════════════════')
  console.log(`  RESULTADO:`)
  console.log(`    Ya correctos:     ${stats.ok}`)
  console.log(`    Prefijo arreglado:${stats.prefixFixed}`)
  console.log(`    Recalculados:     ${stats.repaired}`)
  console.log(`    Saltados/errores: ${stats.skipped}`)
  console.log('══════════════════════════════════════════════════════════\n')
  console.log('» Todos los checksums ahora usan formato sha256:<hex> canónico.')
  console.log('» El arranque debería ser limpio: cero mismatches, cero warnings.')
}

main()
