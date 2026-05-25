/**
 * WAVE 4829 — THE LAZARUS PATCH (COGNITIVE REPAIR)
 *
 * Script de un solo uso. Itera los 49 archivos .lfx en src/core/arsenal/builtins/
 * y aplica tres mutaciones genéticas:
 *
 *   1. aggressionRange: convierte el punto exacto en banda de tolerancia ±0.15
 *   2. validSections:   inyecta secciones lógicas según el arquetipo del efecto
 *   3. fatigueImpact + gpuCost: restaura pesos físicos reales (rompe el RSK=0.00)
 *
 * Por último recalcula el SHA-256 de raw.clip y actualiza raw.checksum para que
 * el Gatekeeper no rechace los archivos por manipulación de código.
 *
 * Ejecución:
 *   node scripts/patchLfxMetadata.js
 */

'use strict'

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const BUILTINS_DIR = path.resolve(__dirname, '../src/core/arsenal/builtins')
const AGGRESSION_BAND = 0.15   // ± de expansión del rango

// ─────────────────────────────────────────────────────────────────────────────
// TABLAS DE MUTACIÓN POR ARQUETIPO
// ─────────────────────────────────────────────────────────────────────────────

/** Secciones de show que el arquetipo puede liderar */
const VALID_SECTIONS_BY_ARCHETYPE = {
  strobe:  ['drop', 'peak'],
  heavy:   ['buildup', 'drop', 'peak'],
  ambient: ['intro', 'breakdown', 'valley', 'outro'],
  utility: ['intro', 'buildup', 'drop', 'peak', 'valley', 'outro'],
}

/** Pesos físicos reales — rompen el monopolio RSK=0.00 */
const PHYSICS_BY_ARCHETYPE = {
  strobe:  { fatigueImpact: 0.85, gpuCost: 0.60 },
  heavy:   { fatigueImpact: 0.50, gpuCost: 0.40 },
  ambient: { fatigueImpact: 0.10, gpuCost: 0.20 },
  utility: { fatigueImpact: 0.30, gpuCost: 0.30 },
}

// ─────────────────────────────────────────────────────────────────────────────
// DETECCIÓN DE ARQUETIPO
//
// Orden de prioridad:
//   1. isStrobe → strobe
//   2. isHeavyCandidate → heavy
//   3. tags include 'atmospheric' OR category 'chill' → ambient
//   4. todo lo demás → utility
// ─────────────────────────────────────────────────────────────────────────────

function detectArchetype(clip) {
  const sm = clip.simulationMeta || {}
  const tags = clip.tags || []
  const cat  = (clip.category || '').toLowerCase()

  if (sm.isStrobe === true)                         return 'strobe'
  if (sm.isHeavyCandidate === true)                 return 'heavy'
  if (tags.includes('atmospheric') || cat.includes('chill')) return 'ambient'
  return 'utility'
}

// ─────────────────────────────────────────────────────────────────────────────
// MUTACIONES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * MUTACIÓN 1 — Expansión del rango de agresión.
 * Convierte el punto exacto [agg, agg] en [agg-0.15, agg+0.15] (clamped a [0,1]).
 */
function patchAggressionRange(cognitiveDNA) {
  const agg = cognitiveDNA.genome?.aggression ?? 0.5
  cognitiveDNA.aggressionRange = {
    min: parseFloat(Math.max(0, agg - AGGRESSION_BAND).toFixed(3)),
    max: parseFloat(Math.min(1, agg + AGGRESSION_BAND).toFixed(3)),
  }
}

/**
 * MUTACIÓN 2 — Inyección de secciones válidas basadas en el arquetipo.
 * Reemplaza el array vacío [] con secciones lógicas reales.
 */
function patchValidSections(cognitiveDNA, archetype) {
  cognitiveDNA.validSections = VALID_SECTIONS_BY_ARCHETYPE[archetype]
}

/**
 * MUTACIÓN 3 — Restauración de pesos físicos reales.
 * fatigueImpact y gpuCost diferenciados por arquetipo → RSK deja de ser 0.
 * Preserva todos los demás campos de simulationMeta (cooldownMs, zScoreGuards…).
 */
function patchSimulationMeta(clip, archetype) {
  if (!clip.simulationMeta) {
    clip.simulationMeta = {}
  }
  const physics = PHYSICS_BY_ARCHETYPE[archetype]
  clip.simulationMeta.fatigueImpact = physics.fatigueImpact
  clip.simulationMeta.gpuCost       = physics.gpuCost
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECKSUM
//
// El Gatekeeper (LfxFileLoader._validateChecksum) calcula:
//   sha256(JSON.stringify(clip.clip))
// y compara contra top-level `checksum` con formato "sha256:<hex>".
// ─────────────────────────────────────────────────────────────────────────────

function computeChecksum(clipInner) {
  const canonical = JSON.stringify(clipInner)
  const hash = crypto.createHash('sha256').update(canonical).digest('hex')
  return `sha256:${hash}`
}

// ─────────────────────────────────────────────────────────────────────────────
// PROCESSOR — aplica las 3 mutaciones + recalcula checksum
// ─────────────────────────────────────────────────────────────────────────────

function processFile(filePath) {
  const raw     = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  const clip    = raw.clip             // inner clip object (what gets hashed)
  const dna     = clip.cognitiveDNA

  if (!dna) {
    console.warn(`  [SKIP] ${path.basename(filePath)} — sin cognitiveDNA`)
    return false
  }

  const archetype = detectArchetype(clip)

  // Aplicar las 3 mutaciones sobre el objeto clip.clip (in-place)
  patchAggressionRange(dna)
  patchValidSections(dna, archetype)
  patchSimulationMeta(clip, archetype)

  // Recalcular checksum DESPUÉS de todas las mutaciones
  raw.checksum = computeChecksum(clip)

  // Serializar con 2 espacios para legibilidad (igual que gen-oro-solido.js)
  fs.writeFileSync(filePath, JSON.stringify(raw, null, 2), 'utf8')

  return { archetype, id: clip.id }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

function main() {
  console.log('╔══════════════════════════════════════════════════════════╗')
  console.log('║      WAVE 4829 — LAZARUS PATCH (COGNITIVE REPAIR)       ║')
  console.log('╚══════════════════════════════════════════════════════════╝\n')

  const files = fs.readdirSync(BUILTINS_DIR)
    .filter(f => f.endsWith('.lfx'))
    .map(f => path.join(BUILTINS_DIR, f))
    .sort()

  console.log(`» ${files.length} archivos .lfx encontrados en builtins/\n`)

  const stats = { patched: 0, skipped: 0, byArchetype: {} }

  for (const filePath of files) {
    const name = path.basename(filePath)
    try {
      const result = processFile(filePath)
      if (!result) {
        stats.skipped++
        continue
      }
      stats.patched++
      stats.byArchetype[result.archetype] = (stats.byArchetype[result.archetype] || 0) + 1
      console.log(`  ✓ [${result.archetype.padEnd(7)}] ${result.id}`)
    } catch (err) {
      console.error(`  ✗ ERROR en ${name}: ${err.message}`)
      stats.skipped++
    }
  }

  console.log('\n══════════════════════════════════════════════════════════')
  console.log(`  RESULTADO FINAL:`)
  console.log(`    Parcheados:  ${stats.patched}`)
  console.log(`    Saltados:    ${stats.skipped}`)
  console.log(`    Por arquetipo:`)
  for (const [arch, count] of Object.entries(stats.byArchetype)) {
    const sections = VALID_SECTIONS_BY_ARCHETYPE[arch].join(', ')
    const physics  = PHYSICS_BY_ARCHETYPE[arch]
    console.log(
      `      ${arch.padEnd(8)} → ${String(count).padStart(2)} efecto(s) | ` +
      `fatigue=${physics.fatigueImpact} gpu=${physics.gpuCost} | ` +
      `sections=[${sections}]`
    )
  }
  console.log('══════════════════════════════════════════════════════════\n')
  console.log('» Checksums SHA-256 recalculados. El Gatekeeper aprobará todos.')
}

main()
