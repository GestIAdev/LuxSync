/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🏭 SYNC FACTORY EFFECTS — Crypto-Sync Migration Utility (WAVE 7726)
 *
 * Migrates battle-tested .lfx effect files from the local userData/arsenal/
 * folder back to the repository's factory builtins/ directory. For each file:
 *   1. Parses the .lfx JSON
 *   2. Sanitizes author metadata to "LuxSync Factory"
 *   3. Recalculates the SHA-256 checksum over the sanitized clip
 *   4. Writes the sanitized + re-hashed file to the matching builtin path
 *   5. Rebuilds manifest.json with updated checksums and file sizes
 *
 * Usage:
 *   npx tsx scripts/sync-factory-effects.ts [options]
 *
 * Options:
 *   --dry-run    Show what would be synced without writing
 *   --verbose    Print every file comparison
 *   --author=X   Override the factory author string (default: "LuxSync Factory")
 *
 * npm run sync-effects
 * ═══════════════════════════════════════════════════════════════════════════
 */

import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const BUILTINS_DIR = path.resolve(__dirname, '..', 'src', 'core', 'arsenal', 'builtins')
const MANIFEST_PATH = path.join(BUILTINS_DIR, 'manifest.json')

// userData path resolution (same logic as Electron's app.getPath('userData'))
const pkg = require(path.resolve(__dirname, '..', 'package.json'))
const appName = pkg.productName || pkg.name || 'LuxSync'
const USERDATA_DIR = process.env.APPDATA
  ? path.join(process.env.APPDATA, appName)
  : path.resolve(__dirname, '..', 'userData')
const USER_ARSENAL_DIR = path.join(USERDATA_DIR, 'arsenal')

const DEFAULT_FACTORY_AUTHOR = 'LuxSync Factory'

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface LFXFile {
  $schema: string
  clip: {
    id: string
    author?: string
    [k: string]: unknown
  }
  checksum: string
}

interface ManifestEntry {
  relPath: string
  checksum: string
  size: number
}

interface ArsenalManifest {
  schema: 1
  version: string
  generatedAt: string
  count: number
  files: Record<string, ManifestEntry>
}

// ─── CRYPTO HELPERS ──────────────────────────────────────────────────────────

/**
 * Compute the .lfx integrity checksum: SHA-256 over JSON.stringify(clip).
 * Returns the canonical format: "sha256:<hex>".
 * This matches computeLfxChecksum() in LfxFileLoader.ts:480-515.
 */
function computeLfxChecksum(clip: unknown): string {
  const canonical = JSON.stringify(clip)
  const hex = crypto.createHash('sha256').update(canonical).digest('hex')
  return `sha256:${hex}`
}

/**
 * Compute the manifest checksum: first 16 hex chars of SHA-256 of raw file bytes.
 * This matches generate-arsenal-manifest.ts:46-49.
 */
function computeManifestChecksum(filePath: string): string {
  const content = fs.readFileSync(filePath)
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16)
}

// ─── FILE HELPERS ────────────────────────────────────────────────────────────

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

// ─── SANITIZATION ────────────────────────────────────────────────────────────

/**
 * Sanitize a user .lfx file for factory deployment:
 *   - Set author to the factory default
 *   - Recalculate the SHA-256 checksum over the sanitized clip
 *
 * Returns the sanitized LFXFile object (new object, does not mutate input).
 */
function sanitizeForFactory(
  lfx: LFXFile,
  factoryAuthor: string,
): LFXFile {
  // Deep copy the clip to avoid mutating the original
  const sanitizedClip = JSON.parse(JSON.stringify(lfx.clip)) as LFXFile['clip']

  // Sanitize author metadata
  sanitizedClip.author = factoryAuthor

  // Recalculate checksum over the sanitized clip
  const newChecksum = computeLfxChecksum(sanitizedClip)

  return {
    $schema: lfx.$schema || 'luxsync.lfx/3.0',
    clip: sanitizedClip,
    checksum: newChecksum,
  }
}

// ─── MANIFEST REBUILD ────────────────────────────────────────────────────────

/**
 * Rebuild manifest.json by scanning the builtins directory.
 * Same logic as generate-arsenal-manifest.ts but inlined to avoid
 * spawning a child process.
 */
function rebuildManifest(): number {
  if (!fs.existsSync(BUILTINS_DIR)) {
    console.error('[manifest] Builtins directory not found:', BUILTINS_DIR)
    return 0
  }

  const pkgPath = path.resolve(__dirname, '..', 'package.json')
  const pkgData = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
  const version = pkgData.version || '0.0.0'

  const files: Record<string, ManifestEntry> = {}
  const count = scanForManifest(BUILTINS_DIR, BUILTINS_DIR, files)

  const manifest: ArsenalManifest = {
    schema: 1,
    version,
    generatedAt: new Date().toISOString(),
    count,
    files,
  }

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2))
  return count
}

function scanForManifest(
  dir: string,
  basePath: string,
  files: Record<string, ManifestEntry>,
): number {
  let count = 0
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      // custom/ is exclusive user-space — never include in factory manifest
      if (entry.name === 'custom') continue
      count += scanForManifest(fullPath, basePath, files)
    } else if (entry.name.toLowerCase().endsWith('.lfx')) {
      const relPath = path.relative(basePath, fullPath).replace(/\\/g, '/')
      files[relPath] = {
        relPath,
        checksum: computeManifestChecksum(fullPath),
        size: fs.statSync(fullPath).size,
      }
      count++
    }
  }
  return count
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const verbose = args.includes('--verbose')

  // Parse --author=X override
  let factoryAuthor = DEFAULT_FACTORY_AUTHOR
  for (const arg of args) {
    if (arg.startsWith('--author=')) {
      factoryAuthor = arg.slice('--author='.length)
    }
  }

  console.log('═════════════════════════════════════════════════════════')
  console.log('  🏭 SYNC FACTORY EFFECTS — Crypto-Sync Migration')
  console.log('  WAVE 7726 — userData/arsenal → builtins + manifest')
  console.log('═════════════════════════════════════════════════════════')
  console.log(`  Builtins dir:  ${BUILTINS_DIR}`)
  console.log(`  User arsenal:  ${USER_ARSENAL_DIR}`)
  console.log(`  Factory author: "${factoryAuthor}"`)
  console.log(`  Mode:          ${dryRun ? 'DRY RUN (no writes)' : 'LIVE (will overwrite)'}`)
  console.log('═════════════════════════════════════════════════════════\n')

  if (!fs.existsSync(USER_ARSENAL_DIR)) {
    console.error(`❌ User arsenal directory not found: ${USER_ARSENAL_DIR}`)
    console.error(`   Expected: %APPDATA%\\${appName}\\arsenal\\`)
    process.exit(1)
  }

  if (!fs.existsSync(BUILTINS_DIR)) {
    console.error(`❌ Builtins directory not found: ${BUILTINS_DIR}`)
    process.exit(1)
  }

  // ─── STEP 1: Index builtins by clip ID ───────────────────────────────────
  const builtinIndex = buildBuiltinIndex()
  console.log(`📦 Builtins indexed: ${builtinIndex.size} effects\n`)

  // ─── STEP 2: Collect user .lfx files ─────────────────────────────────────
  const userFiles = collectLfxFiles(USER_ARSENAL_DIR).filter(f => f.endsWith('.lfx'))
  console.log(`📂 User .lfx files found: ${userFiles.length}\n`)

  let synced = 0
  let skipped = 0
  let notFound = 0
  let checksumsRecalculated = 0

  // ─── STEP 3: Migrate each user file ──────────────────────────────────────
  for (const userFile of userFiles) {
    const userLfx = readLfx(userFile)
    if (!userLfx?.clip?.id) {
      console.warn(`  ⚠️  Skipping (invalid JSON or no clip.id): ${path.basename(userFile)}`)
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

    // Sanitize: set factory author + recalculate checksum
    const sanitizedLfx = sanitizeForFactory(userLfx, factoryAuthor)

    // Compare with existing builtin
    const builtinLfx = readLfx(builtinPath)
    const oldChecksum = builtinLfx?.checksum ?? ''
    const newChecksum = sanitizedLfx.checksum

    if (oldChecksum === newChecksum && builtinLfx?.clip?.author === factoryAuthor) {
      if (verbose) console.log(`  =  ${clipId} — already in sync (checksum + author match)`)
      skipped++
      continue
    }

    const relPath = path.relative(BUILTINS_DIR, builtinPath)

    if (dryRun) {
      console.log(`  🔄 [DRY] ${clipId} → ${relPath}`)
      if (oldChecksum !== newChecksum) {
        console.log(`         checksum: ${oldChecksum.slice(0, 25)}... → ${newChecksum.slice(0, 25)}...`)
      }
      if (builtinLfx?.clip?.author !== factoryAuthor) {
        console.log(`         author: "${builtinLfx?.clip?.author}" → "${factoryAuthor}"`)
      }
    } else {
      // Write sanitized + re-hashed file to builtin path
      fs.writeFileSync(builtinPath, JSON.stringify(sanitizedLfx, null, 2), 'utf-8')
      console.log(`  ✅ ${clipId} → ${relPath}`)
      if (oldChecksum !== newChecksum) {
        console.log(`     checksum recalculated: ${newChecksum.slice(0, 25)}...`)
        checksumsRecalculated++
      }
    }
    synced++
  }

  // ─── STEP 4: Rebuild manifest.json ───────────────────────────────────────
  console.log('\n───────────────────────────────────────────────────────────')
  console.log('  📋 Rebuilding manifest.json...')
  console.log('───────────────────────────────────────────────────────────')

  if (dryRun) {
    console.log('  [DRY] Would rebuild manifest.json with updated checksums')
  } else {
    const manifestCount = rebuildManifest()
    console.log(`  ✅ manifest.json rebuilt: ${manifestCount} .lfx files indexed`)
  }

  // ─── SUMMARY ─────────────────────────────────────────────────────────────
  console.log('\n═════════════════════════════════════════════════════════')
  console.log(`  RESULT: ${synced} synced | ${skipped} skipped | ${notFound} user-only`)
  console.log(`  Checksums recalculated: ${checksumsRecalculated}`)
  console.log(`  Manifest: ${dryRun ? 'NOT rebuilt (dry run)' : 'REBUILT'}`)
  console.log('═════════════════════════════════════════════════════════\n')
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
