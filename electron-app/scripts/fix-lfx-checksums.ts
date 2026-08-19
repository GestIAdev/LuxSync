/**
 * WAVE 7553.1: Fix .lfx checksums after batch edit (minimumZ → null)
 *
 * The batch PowerShell edit changed minimumZ values inside .lfx files but
 * did not update the embedded `checksum` field. This script recomputes
 * the checksum for every .lfx in builtins/ (excluding custom/) and writes
 * it back.
 *
 * Run: npx tsx scripts/fix-lfx-checksums.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'

const BUILTINS_DIR = path.resolve(__dirname, '..', 'src', 'core', 'arsenal', 'builtins')

function computeChecksum(clip: unknown): string {
  const canonical = JSON.stringify(clip)
  const hex = crypto.createHash('sha256').update(canonical).digest('hex')
  return `sha256:${hex}`
}

function processFile(filePath: string): boolean {
  const raw = fs.readFileSync(filePath, 'utf-8')
  let parsed: any
  try {
    parsed = JSON.parse(raw)
  } catch {
    console.warn(`[skip] Not valid JSON: ${filePath}`)
    return false
  }

  // .lfx structure: { clip: { ... }, checksum: "sha256:...", ... }
  // Some may have different structures — handle gracefully
  if (!parsed.clip) {
    console.warn(`[skip] No clip field: ${filePath}`)
    return false
  }

  // Blank the checksum field inside clip before computing
  const clipCopy = { ...parsed.clip }
  delete clipCopy.checksum

  const newChecksum = computeChecksum(clipCopy)
  const oldChecksum = parsed.checksum ?? ''

  if (oldChecksum === newChecksum) {
    return false // already correct
  }

  parsed.checksum = newChecksum
  fs.writeFileSync(filePath, JSON.stringify(parsed, null, 2), 'utf-8')
  console.log(`[fixed] ${path.basename(filePath)}: ${oldChecksum.slice(0, 20)}... → ${newChecksum.slice(0, 20)}...`)
  return true
}

function scanDirectory(dir: string): number {
  let fixed = 0
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'custom') continue // user-space, skip
      fixed += scanDirectory(fullPath)
    } else if (entry.name.endsWith('.lfx')) {
      if (processFile(fullPath)) fixed++
    }
  }
  return fixed
}

console.log(`[fix-lfx-checksums] Scanning ${BUILTINS_DIR}...`)
const fixed = scanDirectory(BUILTINS_DIR)
console.log(`[fix-lfx-checksums] ✅ Fixed ${fixed} .lfx files`)
