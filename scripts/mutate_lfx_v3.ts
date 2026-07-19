/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧬 LFX V3 MASS MUTATOR — WAVE 7160
 * ═══════════════════════════════════════════════════════════════════════════
 * One-shot script that mutates all 49 .lfx files from pseudo-V2.1 to
 * canonical V3 structure, resolving discrepancies D1-D10 from the audit.
 *
 * Transformations applied:
 *   1. Inject pressureRange into cognitiveDNA (D1)
 *   2. Fix spatial targeting: zones["all"] → paramId-specific (D3)
 *   3. Translate vibeCompat to canonical VibeIds (D4)
 *   4. Enforce REGLA 7 for divine candidates (D5)
 *   5. Remove EnergyZone IDs from tracks[].zones, recalc spatialZones (D6/D8)
 *   6. Ensure blendMode + curve.range on every track (D7/D9)
 *   7. Inject schemaVersion: '3.0' at clip root (D10)
 *   8. Recalculate SHA-256 checksum
 *
 * Usage: npx tsx scripts/mutate_lfx_v3.ts
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

const CANONICAL_ZONES = new Set([
  'front', 'back', 'floor',
  'movers-left', 'movers-right',
  'center', 'air', 'ambient', 'unassigned',
])

const COMPOSITE_ZONES = new Set([
  'all', 'all-pars', 'all-movers', 'pars',
])

const ENERGY_ZONES = new Set([
  'silence', 'valley', 'gentle', 'active', 'intense', 'peak',
])

/** All valid spatial zone tags (canonical + composite) */
const VALID_SPATIAL_ZONES = new Set([...CANONICAL_ZONES, ...COMPOSITE_ZONES])

/**
 * VIBE_ALIAS_MAP — mirrors the runtime map in engine/vibe/profiles/index.ts.
 * Maps legacy/free-form vibe labels to canonical VibeIds.
 */
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
  // Direct (already canonical)
  'fiesta-latina': 'fiesta-latina',
  'techno-club': 'techno-club',
  'chill-lounge': 'chill-lounge',
  'pop-rock': 'pop-rock',
  'idle': 'idle',
}

const CANONICAL_VIBES = new Set([
  'fiesta-latina', 'techno-club', 'chill-lounge', 'pop-rock', 'idle',
])

// ─── TYPES (minimal, for safe JSON access) ──────────────────────────────────

interface Keyframe {
  timeMs: number
  value: number | { h: number; s: number; l: number }
  interpolation: string
  bezierHandles?: [number, number, number, number]
  audioBinding?: unknown
}

interface Curve {
  paramId: string
  valueType: 'number' | 'color'
  range?: [number, number]
  defaultValue: number | { h: number; s: number; l: number }
  keyframes: Keyframe[]
  mode?: string
}

interface Track {
  id: string
  paramId: string
  zones: string[]
  blendMode?: string
  curve: Curve
  dimmerScale?: number
  colorOverride?: { h: number; s: number; l: number }
  phaseConfig?: unknown
}

interface SimulationMeta {
  cooldownMs: number
  fatigueImpact: number
  isDivineCandidate: boolean
  isHeavyCandidate: boolean
  isStrobe: boolean
  zScoreGuards: {
    requireRising: boolean
    minimumZ: number | null
    minimumEnergy: number | null
  }
  beautyWeights: { base: number; energyMultiplier: number; vibeBonus: number }
  gpuCost: number
  minDurationMs: number
}

interface CognitiveDNA {
  genome: { aggression: number; chaos: number; organicity: number }
  textureAffinity: string
  compatibleVibes: string[]
  validSections: string[]
  energyZone: { min: string; max: string }
  aggressionRange: { min: number; max: number }
  spatialBehavior: string
  pressureRange?: { min: number; max: number }
}

interface Clip {
  id: string
  name: string
  author: string
  category: string
  tags: string[]
  vibeCompat: string[]
  durationMs: number
  effectType: string
  tracks: Track[]
  spatialZones?: string[]
  mixBus?: string
  priority?: number
  staticParams?: Record<string, unknown>
  cognitiveDNA?: CognitiveDNA
  simulationMeta?: SimulationMeta
  schemaVersion?: string
}

interface LFXFile {
  $schema: string
  clip: Clip
  checksum?: string
}

// ─── TRANSFORMATIONS ────────────────────────────────────────────────────────

/** D1: Derive pressureRange from DNA + simMeta classification */
function injectPressureRange(dna: CognitiveDNA, simMeta: SimulationMeta | undefined): { min: number; max: number } {
  const isHard = simMeta?.isDivineCandidate || simMeta?.isHeavyCandidate || dna.genome.aggression > 0.7
  if (isHard) return { min: 0.5, max: 1.0 }

  const isAmbient = dna.energyZone.max === 'ambient' || dna.energyZone.max === 'gentle'
  if (isAmbient) return { min: 0.0, max: 0.5 }

  return { min: 0.0, max: 1.0 }
}

/** D3: Replace generic ["all"] with paramId-specific zones */
function deriveZonesForTrack(paramId: string, currentZones: string[]): string[] {
  // Only transform if zones is exactly ["all"]
  if (currentZones.length !== 1 || currentZones[0] !== 'all') return currentZones

  switch (paramId) {
    case 'intensity':
    case 'color':
      return ['all-pars']
    case 'strobeRate':
    case 'pan':
    case 'tilt':
      return ['all-movers']
    default:
      return currentZones
  }
}

/** D4: Translate vibeCompat to canonical VibeIds */
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
  return result.length > 0 ? result : ['techno-club'] // fallback
}

/** D5: Enforce REGLA 7 for divine candidates */
function enforceDivineRules(clip: Clip): void {
  const simMeta = clip.simulationMeta
  if (!simMeta?.isDivineCandidate) return

  if (simMeta.cooldownMs < 15000) simMeta.cooldownMs = 15000
  if (simMeta.fatigueImpact < 0.8) simMeta.fatigueImpact = 0.8
  if (simMeta.zScoreGuards) {
    if (simMeta.zScoreGuards.minimumZ === null || simMeta.zScoreGuards.minimumZ < 2.20) {
      simMeta.zScoreGuards.minimumZ = 2.20
    }
  }
}

/** D6/D8: Remove EnergyZone IDs from tracks[].zones, recalc spatialZones */
function cleanZonesAndRecalc(clip: Clip): void {
  const allZones = new Set<string>()

  for (const track of clip.tracks) {
    // Remove energy zone IDs that are NOT also canonical zones
    // 'ambient' is both — keep it (it's a valid spatial zone)
    track.zones = track.zones.filter(z => {
      const lower = z.toLowerCase().trim()
      // If it's a valid spatial zone, keep it
      if (VALID_SPATIAL_ZONES.has(lower)) return true
      // If it's an energy zone that's NOT a spatial zone, remove it
      if (ENERGY_ZONES.has(lower) && !CANONICAL_ZONES.has(lower)) return false
      // Unknown zone — keep it (might be a custom zone)
      return true
    })

    // Collect for spatialZones recalc
    for (const z of track.zones) {
      allZones.add(z)
    }
  }

  // Recalculate spatialZones as union of all track zones
  clip.spatialZones = [...allZones]
}

/** D7: Ensure every track has an explicit blendMode */
function ensureBlendMode(track: Track): void {
  if (!track.blendMode) {
    track.blendMode = track.paramId === 'intensity' ? 'max' : 'replace'
  }
}

/** D9: Ensure every track.curve has a range */
function ensureCurveRange(track: Track): void {
  if (!track.curve.range) {
    if (track.curve.valueType === 'color') {
      track.curve.range = [0, 360]
    } else {
      track.curve.range = [0, 1]
    }
  }
}

/** D10: Inject schemaVersion at clip root */
function ensureSchemaVersion(clip: Clip): void {
  if (!clip.schemaVersion) {
    clip.schemaVersion = '3.0'
  }
}

/** Compute SHA-256 checksum over canonical JSON of clip */
function computeChecksum(clip: Clip): string {
  const canonical = JSON.stringify(clip)
  return createHash('sha256').update(canonical).digest('hex')
}

// ─── MAIN ───────────────────────────────────────────────────────────────────

function findLfxFiles(root: string): string[] {
  const results: string[] = []
  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(fullPath)
      } else if (entry.name.endsWith('.lfx')) {
        results.push(fullPath)
      }
    }
  }
  walk(root)
  return results
}

function mutateFile(filePath: string): { success: boolean; error?: string; changes: string[] } {
  const changes: string[] = []
  let raw: string
  try {
    raw = fs.readFileSync(filePath, 'utf-8')
  } catch (e) {
    return { success: false, error: `Read error: ${(e as Error).message}`, changes }
  }

  let file: LFXFile
  try {
    file = JSON.parse(raw) as LFXFile
  } catch (e) {
    return { success: false, error: `JSON parse error: ${(e as Error).message}`, changes }
  }

  if (file.$schema !== 'luxsync.lfx/3.0') {
    return { success: false, error: `Not a V3 file (schema: ${file.$schema})`, changes }
  }

  const clip = file.clip
  if (!clip) {
    return { success: false, error: 'Missing clip object', changes }
  }

  // ── 1. Inject pressureRange (D1) ──
  if (clip.cognitiveDNA) {
    const dna = clip.cognitiveDNA
    if (!dna.pressureRange) {
      const pr = injectPressureRange(dna, clip.simulationMeta)
      dna.pressureRange = pr
      changes.push(`pressureRange injected: {${pr.min}, ${pr.max}}`)
    }

    // ── 3. Translate vibeCompat (D4) — also sync compatibleVibes ──
    const originalVibes = clip.vibeCompat
    const translatedVibes = translateVibes(clip.vibeCompat)
    if (JSON.stringify(originalVibes) !== JSON.stringify(translatedVibes)) {
      clip.vibeCompat = translatedVibes
      // Sync compatibleVibes in DNA if present
      if (dna.compatibleVibes) {
        const dnaTranslated = translateVibes(dna.compatibleVibes)
        if (JSON.stringify(dna.compatibleVibes) !== JSON.stringify(dnaTranslated)) {
          dna.compatibleVibes = dnaTranslated
          changes.push(`compatibleVibes translated: [${dnaTranslated.join(', ')}]`)
        }
      }
      changes.push(`vibeCompat translated: [${originalVibes.join(', ')}] → [${translatedVibes.join(', ')}]`)
    }
  }

  // ── 4. Enforce REGLA 7 (D5) ──
  if (clip.simulationMeta?.isDivineCandidate) {
    const before = {
      cooldown: clip.simulationMeta.cooldownMs,
      fatigue: clip.simulationMeta.fatigueImpact,
      minZ: clip.simulationMeta.zScoreGuards?.minimumZ,
    }
    enforceDivineRules(clip)
    const after = {
      cooldown: clip.simulationMeta.cooldownMs,
      fatigue: clip.simulationMeta.fatigueImpact,
      minZ: clip.simulationMeta.zScoreGuards?.minimumZ,
    }
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      changes.push(`REGLA 7 enforced: cooldown ${before.cooldown}→${after.cooldown}, fatigue ${before.fatigue}→${after.fatigue}, minZ ${before.minZ}→${after.minZ}`)
    }
  }

  // ── 2. Fix spatial targeting (D3) ──
  for (const track of clip.tracks) {
    const originalZones = [...track.zones]
    track.zones = deriveZonesForTrack(track.paramId, track.zones)
    if (JSON.stringify(originalZones) !== JSON.stringify(track.zones)) {
      changes.push(`track ${track.paramId} zones: [${originalZones.join(',')}] → [${track.zones.join(',')}]`)
    }
  }

  // ── 5. Clean zones + recalc spatialZones (D6/D8) ──
  const beforeSpatial = JSON.stringify(clip.spatialZones)
  cleanZonesAndRecalc(clip)
  const afterSpatial = JSON.stringify(clip.spatialZones)
  if (beforeSpatial !== afterSpatial) {
    changes.push(`spatialZones recalculated: ${afterSpatial}`)
  }

  // ── 6. Ensure blendMode + curve.range (D7/D9) ──
  for (const track of clip.tracks) {
    ensureBlendMode(track)
    ensureCurveRange(track)
  }

  // ── 7. Inject schemaVersion (D10) ──
  ensureSchemaVersion(clip)

  // ── 8. Recalculate checksum ──
  const newChecksum = computeChecksum(clip)
  if (file.checksum !== newChecksum) {
    changes.push(`checksum updated: ${file.checksum?.substring(0, 12) ?? 'none'} → ${newChecksum.substring(0, 12)}...`)
    file.checksum = newChecksum
  }

  // ── Write back ──
  try {
    const output = JSON.stringify(file, null, 2) + '\n'
    fs.writeFileSync(filePath, output, 'utf-8')
  } catch (e) {
    return { success: false, error: `Write error: ${(e as Error).message}`, changes }
  }

  return { success: true, changes }
}

// ─── ENTRY POINT ────────────────────────────────────────────────────────────

function main() {
  console.log('═'.repeat(80))
  console.log('  🧬 LFX V3 MASS MUTATOR — WAVE 7160')
  console.log('═'.repeat(80))
  console.log()

  const files = findLfxFiles(LFX_ROOT)
  console.log(`Found ${files.length} .lfx files in ${LFX_ROOT}`)
  console.log()

  let successCount = 0
  let errorCount = 0
  const errors: { file: string; error: string }[] = []
  let totalChanges = 0

  for (const filePath of files) {
    const relative = path.relative(LFX_ROOT, filePath)
    const result = mutateFile(filePath)

    if (result.success) {
      successCount++
      totalChanges += result.changes.length
      if (result.changes.length > 0) {
        console.log(`  ✅ ${relative} — ${result.changes.length} changes`)
        for (const c of result.changes) {
          console.log(`       • ${c}`)
        }
      } else {
        console.log(`  ⏭️  ${relative} — no changes needed`)
      }
    } else {
      errorCount++
      errors.push({ file: relative, error: result.error! })
      console.log(`  ❌ ${relative} — ERROR: ${result.error}`)
    }
  }

  console.log()
  console.log('═'.repeat(80))
  console.log(`  RESULTS: ${successCount} mutated, ${errorCount} errors, ${totalChanges} total changes`)
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
