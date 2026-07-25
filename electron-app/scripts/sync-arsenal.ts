/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔁 SYNC ARSENAL — Dev Utility
 *
 * Reads all .lfx files from userData/arsenal/ and overwrites the matching
 * builtin files in src/core/arsenal/builtins/ by clip ID.
 *
 * Usage:
 *   npx ts-node scripts/sync-arsenal.ts
 *
 * Options:
 *   --dry-run   Show what would be synced without writing
 *   --verbose   Print every file comparison
 * ═══════════════════════════════════════════════════════════════════════════
 */

import * as fs from 'fs'
import * as path from 'path'

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const BUILTINS_DIR = path.resolve(__dirname, '..', 'src', 'core', 'arsenal', 'builtins')

// userData path resolution (same logic as Electron's app.getPath('userData'))
// On Windows: %APPDATA%/<appName>
// We read the app name from package.json to match Electron's convention
const pkg = require(path.resolve(__dirname, '..', 'package.json'))
const appName = pkg.productName || pkg.name || 'LuxSync'
const USERDATA_DIR = process.env.APPDATA
  ? path.join(process.env.APPDATA, appName)
  : path.resolve(__dirname, '..', 'userData')
const USER_ARSENAL_DIR = path.join(USERDATA_DIR, 'arsenal')

// ─── HELPERS ─────────────────────────────────────────────────────────────────

interface LFXFile {
  $schema: string
  version: string
  clip: { id: string; [k: string]: unknown }
  checksum: string
}

function readLfx(filePath: string): LFXFile | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/** Recursively collect all .lfx files under a directory. */
function collectLfxFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  const results: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...collectLfxFiles(full))
    } else if (entry.name.endsWith('.lfx')) {
      results.push(full)
    }
  }
  return results
}

/** Build a map of clipId → builtinFilePath from the builtins directory. */
function buildBuiltinIndex(): Map<string, string> {
  const index = new Map<string, string>()
  const files = collectLfxFiles(BUILTINS_DIR)
  for (const f of files) {
    const lfx = readLfx(f)
    if (lfx?.clip?.id) {
      index.set(lfx.clip.id, f)
    }
  }
  return index
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const verbose = args.includes('--verbose')

  console.log('═════════════════════════════════════════════════════════')
  console.log('  🔁 SYNC ARSENAL — userData → builtins')
  console.log('═════════════════════════════════════════════════════════')
  console.log(`  Builtins dir: ${BUILTINS_DIR}`)
  console.log(`  User arsenal: ${USER_ARSENAL_DIR}`)
  console.log(`  Mode:         ${dryRun ? 'DRY RUN (no writes)' : 'LIVE (will overwrite)'}`)
  console.log('═════════════════════════════════════════════════════════\n')

  if (!fs.existsSync(USER_ARSENAL_DIR)) {
    console.error(`❌ User arsenal directory not found: ${USER_ARSENAL_DIR}`)
    process.exit(1)
  }

  if (!fs.existsSync(BUILTINS_DIR)) {
    console.error(`❌ Builtins directory not found: ${BUILTINS_DIR}`)
    process.exit(1)
  }

  const builtinIndex = buildBuiltinIndex()
  console.log(`📦 Builtins indexed: ${builtinIndex.size} effects\n`)

  const userFiles = collectLfxFiles(USER_ARSENAL_DIR).filter(f => f.endsWith('.lfx'))
  console.log(`📂 User .lfx files found: ${userFiles.length}\n`)

  let synced = 0
  let skipped = 0
  let notFound = 0

  for (const userFile of userFiles) {
    const userLfx = readLfx(userFile)
    if (!userLfx?.clip?.id) {
      console.warn(`  ⚠️  Skipping (invalid JSON): ${path.basename(userFile)}`)
      skipped++
      continue
    }

    const clipId = userLfx.clip.id
    const builtinPath = builtinIndex.get(clipId)

    if (!builtinPath) {
      console.log(`  ⊘  ${clipId} — no matching builtin (user-only effect)`)
      notFound++
      continue
    }

    // Compare checksums to see if they differ
    const builtinLfx = readLfx(builtinPath)
    const userChecksum = userLfx.checksum
    const builtinChecksum = builtinLfx?.checksum

    if (userChecksum === builtinChecksum) {
      if (verbose) console.log(`  =  ${clipId} — already in sync`)
      skipped++
      continue
    }

    // Write user version to builtin path
    const targetDir = path.dirname(builtinPath)
    const targetFile = path.basename(builtinPath)

    if (dryRun) {
      console.log(`  🔄 [DRY] ${clipId} → ${path.relative(BUILTINS_DIR, builtinPath)}`)
    } else {
      fs.writeFileSync(builtinPath, JSON.stringify(userLfx, null, 2), 'utf-8')
      console.log(`  ✅ ${clipId} → ${path.relative(BUILTINS_DIR, builtinPath)}`)
    }
    synced++
  }

  console.log('\n═════════════════════════════════════════════════════════')
  console.log(`  RESULT: ${synced} synced | ${skipped} skipped (already in sync) | ${notFound} user-only (no builtin match)`)
  console.log('═════════════════════════════════════════════════════════\n')
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
