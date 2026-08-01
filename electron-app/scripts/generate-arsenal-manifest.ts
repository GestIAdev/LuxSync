/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARSENAL MANIFEST GENERATOR
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 2529: Generates a manifest.json in src/core/arsenal/builtins/ that
 * lists every .lfx file with a checksum. The bootstrapper uses this to
 * incrementally sync new/updated builtins into userData/arsenal/ without
 * overwriting user-created effects.
 *
 * Run via: npm run forge:manifest
 * (called automatically by the build pipeline before electron-builder)
 *
 * @author Devin + Raúl
 * @wave 2529
 */

import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'

const BUILTINS_DIR = path.resolve(__dirname, '..', 'src', 'core', 'arsenal', 'builtins')
const MANIFEST_PATH = path.join(BUILTINS_DIR, 'manifest.json')

interface ManifestEntry {
  /** Relative path from builtins/ root, e.g. "techno/gatling_raid.lfx" */
  relPath: string
  /** SHA-256 of file contents (first 16 chars for compactness) */
  checksum: string
  /** File size in bytes */
  size: number
}

interface ArsenalManifest {
  /** Manifest schema version */
  schema: 1
  /** Package version from package.json */
  version: string
  /** Timestamp when manifest was generated */
  generatedAt: string
  /** Total .lfx file count */
  count: number
  /** File entries keyed by relative path */
  files: Record<string, ManifestEntry>
}

function computeChecksum(filePath: string): string {
  const content = fs.readFileSync(filePath)
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16)
}

function scanDirectory(dir: string, basePath: string, files: Record<string, ManifestEntry>): number {
  let count = 0
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      count += scanDirectory(fullPath, basePath, files)
    } else if (entry.name.toLowerCase().endsWith('.lfx')) {
      const relPath = path.relative(basePath, fullPath).replace(/\\/g, '/')
      files[relPath] = {
        relPath,
        checksum: computeChecksum(fullPath),
        size: fs.statSync(fullPath).size,
      }
      count++
    }
  }
  return count
}

function main(): void {
  if (!fs.existsSync(BUILTINS_DIR)) {
    console.error('[forge:manifest] Builtins directory not found:', BUILTINS_DIR)
    process.exit(1)
  }

  // Read package.json version
  const pkgPath = path.resolve(__dirname, '..', 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
  const version = pkg.version || '0.0.0'

  const files: Record<string, ManifestEntry> = {}
  const count = scanDirectory(BUILTINS_DIR, BUILTINS_DIR, files)

  const manifest: ArsenalManifest = {
    schema: 1,
    version,
    generatedAt: new Date().toISOString(),
    count,
    files,
  }

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2))
  console.log(`[forge:manifest] ✅ Generated manifest.json: ${count} .lfx files, version=${version}`)
}

main()
