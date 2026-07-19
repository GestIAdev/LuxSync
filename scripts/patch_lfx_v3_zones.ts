/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧬 LFX V3 PATCH — Zone Regression + compatibleVibes Fix
 * ═══════════════════════════════════════════════════════════════════════════
 * Fixes two issues from the mass mutator:
 *
 * 1. ZONE REGRESSION: Clips with only intensity/color tracks had zones
 *    changed from ["all"] → ["all-pars"], excluding movers from the effect.
 *    Fix: If clip has NO mover-specific tracks (strobeRate, pan, tilt),
 *    revert "all-pars" back to "all" so movers get intensity/color too.
 *
 * 2. COMPATIBLE_VIBES NOT TRANSLATED: The mutator nested compatibleVibes
 *    translation inside the vibeCompat translation block. If vibeCompat was
 *    already canonical, compatibleVibes was never translated.
 *    Fix: Translate compatibleVibes independently.
 *
 * Usage: npx tsx scripts/patch_lfx_v3_zones.ts
 * ═══════════════════════════════════════════════════════════════════════════
 */

import * as fs from 'fs'
import * as path from 'path'
import { createHash } from 'crypto'
import { fileURLToPath } from 'url'

// ─── CONSTANTS ──────────────────────────────────────────────────────────────

const __filename_script = fileURLToPath(import.meta.url)
const __dirname_script = path.dirname(__filename_script)
const LFX_ROOT = path.resolve(__dirname_script, '../electron-app/src/core/arsenal/builtins')

const MOVER_PARAM_IDS = new Set(['strobeRate', 'pan', 'tilt'])

const VIBE_MAP: Record<string, string> = {
  'techno': 'techno-club',
  'chillout': 'chill-lounge',
  'rock': 'pop-rock',
  'ambient': 'chill-lounge',
  'electronic': 'techno-club',
  'ballad': 'chill-lounge',
  'hiphop': 'pop-rock',
  'latin': 'fiesta-latina',
  'fiesta': 'fiesta-latina',
  'latino-organic': 'fiesta-latina',
  'techno-dark': 'techno-club',
  'salsa': 'fiesta-latina',
  'cumbia': 'fiesta-latina',
  'tropical': 'fiesta-latina',
  'bachata': 'fiesta-latina',
  'chill': 'chill-lounge',
  'romantic': 'chill-lounge',
  'acid': 'techno-club',
  'minimal': 'techno-club',
  'industrial': 'techno-club',
  'dubstep': 'techno-club',
  'neurofunk': 'techno-club',
  'dark': 'techno-club',
  'cyberpunk': 'techno-club',
  'metal': 'pop-rock',
  'blues': 'pop-rock',
  'rock-anthem': 'pop-rock',
  'fiesta-latina': 'fiesta-latina',
  'techno-club': 'techno-club',
  'chill-lounge': 'chill-lounge',
  'pop-rock': 'pop-rock',
  'idle': 'idle',
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

function translateVibes(vibes: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const v of vibes) {
    const mapped = VIBE_MAP[v.toLowerCase().trim()]
    if (mapped && !seen.has(mapped)) {
      seen.add(mapped)
      result.push(mapped)
    }
  }
  return result.length > 0 ? result : ['techno-club']
}

function computeChecksum(clip: unknown): string {
  return createHash('sha256').update(JSON.stringify(clip)).digest('hex')
}

function findLfxFiles(root: string): string[] {
  const results: string[] = []
  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(fullPath)
      else if (entry.name.endsWith('.lfx')) results.push(fullPath)
    }
  }
  walk(root)
  return results
}

// ─── PATCH LOGIC ────────────────────────────────────────────────────────────

function patchFile(filePath: string): { success: boolean; error?: string; changes: string[] } {
  const changes: string[] = []
  let raw: string
  try {
    raw = fs.readFileSync(filePath, 'utf-8')
  } catch (e) {
    return { success: false, error: `Read error: ${(e as Error).message}`, changes }
  }

  let file: any
  try {
    file = JSON.parse(raw)
  } catch (e) {
    return { success: false, error: `JSON parse error: ${(e as Error).message}`, changes }
  }

  const clip = file?.clip
  if (!clip) return { success: false, error: 'Missing clip object', changes }

  // ── FIX 1: Zone regression ──
  // Check if clip has any mover-specific tracks
  const hasMoverTracks = clip.tracks.some((t: any) => MOVER_PARAM_IDS.has(t.paramId))

  if (!hasMoverTracks) {
    // No mover tracks → revert "all-pars" back to "all" so movers get intensity/color
    let zonesChanged = false
    for (const track of clip.tracks) {
      if (Array.isArray(track.zones) && track.zones.length === 1 && track.zones[0] === 'all-pars') {
        track.zones = ['all']
        zonesChanged = true
      }
    }
    if (zonesChanged) {
      changes.push('zones reverted: all-pars → all (no mover tracks in clip)')
    }
  }

  // ── FIX 2: compatibleVibes translation (independent of vibeCompat) ──
  const dna = clip.cognitiveDNA
  if (dna && Array.isArray(dna.compatibleVibes)) {
    const original = dna.compatibleVibes
    const translated = translateVibes(original)
    if (JSON.stringify(original) !== JSON.stringify(translated)) {
      dna.compatibleVibes = translated
      changes.push(`compatibleVibes translated: [${original.join(', ')}] → [${translated.join(', ')}]`)
    }
  }

  // ── Recalculate spatialZones ──
  if (changes.length > 0) {
    const allZones = new Set<string>()
    for (const track of clip.tracks) {
      if (Array.isArray(track.zones)) {
        for (const z of track.zones) allZones.add(z)
      }
    }
    clip.spatialZones = [...allZones]

    // ── Recalculate checksum ──
    file.checksum = computeChecksum(clip)
    changes.push(`checksum recalculated: ${file.checksum.substring(0, 12)}...`)

    // ── Write back ──
    try {
      const output = JSON.stringify(file, null, 2) + '\n'
      fs.writeFileSync(filePath, output, 'utf-8')
    } catch (e) {
      return { success: false, error: `Write error: ${(e as Error).message}`, changes }
    }
  }

  return { success: true, changes }
}

// ─── MAIN ───────────────────────────────────────────────────────────────────

function main() {
  console.log('═'.repeat(80))
  console.log('  🧬 LFX V3 PATCH — Zone Regression + compatibleVibes Fix')
  console.log('═'.repeat(80))
  console.log()

  const files = findLfxFiles(LFX_ROOT)
  console.log(`Found ${files.length} .lfx files in ${LFX_ROOT}`)
  console.log()

  let successCount = 0
  let errorCount = 0
  let patchedCount = 0
  let skippedCount = 0
  const errors: { file: string; error: string }[] = []

  for (const filePath of files) {
    const relative = path.relative(LFX_ROOT, filePath)
    const result = patchFile(filePath)

    if (result.success) {
      successCount++
      if (result.changes.length > 0) {
        patchedCount++
        console.log(`  🔧 ${relative} — ${result.changes.length} fixes`)
        for (const c of result.changes) {
          console.log(`       • ${c}`)
        }
      } else {
        skippedCount++
        console.log(`  ⏭️  ${relative} — no fixes needed`)
      }
    } else {
      errorCount++
      errors.push({ file: relative, error: result.error! })
      console.log(`  ❌ ${relative} — ERROR: ${result.error}`)
    }
  }

  console.log()
  console.log('═'.repeat(80))
  console.log(`  RESULTS: ${patchedCount} patched, ${skippedCount} skipped, ${errorCount} errors (of ${successCount} total)`)
  if (errors.length > 0) {
    console.log()
    console.log('  ERRORS:')
    for (const e of errors) {
      console.log(`    • ${e.file}: ${e.error}`)
    }
  }
  console.log('═'.repeat(80))
}

main()
