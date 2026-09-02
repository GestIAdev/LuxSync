/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 7749 — SNARE VETO HYPERPLANE ANALYSIS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Statistical analysis of the Monte Carlo JSONL to find the optimal
 * floor/knee thresholds for the 3-axis Tonality Veto (flatness, wns, flux).
 *
 * Methodology:
 *   1. Load JSONL, group by label (snare, vocal, synth, bass, mix)
 *   2. For each axis, compute percentile distributions per label
 *   3. Floor = p5 of snare samples (95% of snares pass)
 *   4. Knee = p50 of snare samples (50% of snares at full pass)
 *   5. Separation gap = snare_p5 - non_snare_p95 (positive = good separation)
 *   6. False positive simulation: what % of non-snare frames pass all 3 gates?
 *
 * No external ML library needed — pure statistical percentile analysis.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

// ─────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
let inputFile = ''
let outputFile = ''

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--input' && args[i + 1]) inputFile = resolve(args[i + 1])
  if (args[i] === '--output' && args[i + 1]) outputFile = resolve(args[i + 1])
}

if (!inputFile) {
  console.error('Usage: npx tsx scripts/analyze-snare-veto.ts --input <jsonl> [--output <md>]')
  process.exit(1)
}

// ─────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────

interface TelemetryRecord {
  snare_energy: number
  flatness: number
  whiteNoiseScore: number
  spectralFlux: number
  spectralCentroid: number
  hybridSnare: number
  isSnareOnset: boolean
  label: string
  file: string
}

// ─────────────────────────────────────────────────────────────────────
// STATS HELPERS
// ─────────────────────────────────────────────────────────────────────

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = (p / 100) * (sorted.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  const frac = idx - lo
  return sorted[lo] * (1 - frac) + sorted[hi] * frac
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function std(arr: number[]): number {
  if (arr.length === 0) return 0
  const m = mean(arr)
  const variance = arr.reduce((a, b) => a + (b - m) * (b - m), 0) / arr.length
  return Math.sqrt(variance)
}

// ─────────────────────────────────────────────────────────────────────
// GATE SIMULATION — replicates the engine's veto logic
// ─────────────────────────────────────────────────────────────────────

function flatnessGate(val: number, floor: number, knee: number): number {
  if (val < floor) return 0.0
  if (val < knee) return (val - floor) / (knee - floor)
  return 1.0
}

function wnsGate(val: number, floor: number, knee: number): number {
  if (val < floor) return 0.0
  if (val < knee) return (val - floor) / (knee - floor)
  return 1.0
}

function fluxGate(val: number, floor: number, knee: number): number {
  if (val < floor) return 0.0
  if (val < knee) return (val - floor) / (knee - floor)
  return 1.0
}

// ─────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────

function main() {
  console.log('[WAVE 7749] Snare Veto Hyperplane Analysis')
  console.log(`  Input: ${inputFile}`)

  const raw = readFileSync(inputFile, 'utf-8')
  const lines = raw.trim().split('\n')
  const records: TelemetryRecord[] = []

  for (const line of lines) {
    try {
      const r = JSON.parse(line) as TelemetryRecord
      if (r.label && typeof r.flatness === 'number') {
        records.push(r)
      }
    } catch { /* skip malformed */ }
  }

  console.log(`  Loaded ${records.length} records`)

  // Group by label
  const groups: Map<string, TelemetryRecord[]> = new Map()
  for (const r of records) {
    if (!groups.has(r.label)) groups.set(r.label, [])
    groups.get(r.label)!.push(r)
  }

  console.log(`  Labels: ${[...groups.keys()].map(k => `${k}(${groups.get(k)!.length})`).join(', ')}`)

  // ── PER-AXIS PERCENTILE ANALYSIS ──────────────────────────────────
  // CRITICAL: The veto only operates when hybridSnare > 0 (a snare onset
  // is already detected). We must compare ONLY active onset frames:
  //   - Snare stems where hybridSnare > 0 = TRUE POSITIVES (should pass veto)
  //   - Non-snare stems where hybridSnare > 0 = FALSE POSITIVES (should be vetoed)
  // Comparing all frames (including silence/decay) dilutes the signal.
  const axes = ['flatness', 'whiteNoiseScore', 'spectralFlux'] as const
  type Axis = typeof axes[number]

  const allSnareData = groups.get('snare') ?? []
  const allNonSnareData = records.filter(r => r.label !== 'snare')

  // Filter to active onset frames only (hybridSnare > 0)
  const snareData = allSnareData.filter(r => r.hybridSnare > 0)
  const nonSnareData = allNonSnareData.filter(r => r.hybridSnare > 0)

  console.log(`\n═══ PER-AXIS PERCENTILE ANALYSIS (active onset frames only) ═══`)
  console.log(`  snare onsets: ${snareData.length}/${allSnareData.length} frames | non-snare onsets: ${nonSnareData.length}/${allNonSnareData.length} frames`)
  console.log(`  (veto only operates when hybridSnare > 0 — silence/decay excluded)`)

  const thresholds: Record<Axis, { floor: number; knee: number }> = {
    flatness: { floor: 0, knee: 0 },
    whiteNoiseScore: { floor: 0, knee: 0 },
    spectralFlux: { floor: 0, knee: 0 },
  }

  for (const axis of axes) {
    const snareVals = snareData.map(r => r[axis]).sort((a, b) => a - b)
    const nonSnareVals = nonSnareData.map(r => r[axis]).sort((a, b) => a - b)

    const snareP5 = percentile(snareVals, 5)
    const snareP25 = percentile(snareVals, 25)
    const snareP50 = percentile(snareVals, 50)
    const snareP75 = percentile(snareVals, 75)
    const snareP95 = percentile(snareVals, 95)

    const nonSnareP5 = percentile(nonSnareVals, 5)
    const nonSnareP50 = percentile(nonSnareVals, 50)
    const nonSnareP95 = percentile(nonSnareVals, 95)

    // Per-label breakdown (active onsets only)
    const perLabel: Record<string, { p5: number; p50: number; p95: number }> = {}
    for (const [label, recs] of groups) {
      const active = recs.filter(r => r.hybridSnare > 0)
      const vals = active.map(r => r[axis]).sort((a, b) => a - b)
      perLabel[label] = {
        p5: percentile(vals, 5),
        p50: percentile(vals, 50),
        p95: percentile(vals, 95),
      }
    }

    // Floor = snare p5 (95% of snares above this)
    // Knee = snare p50 (50% of snares at full pass)
    const floor = snareP5
    const knee = snareP50
    thresholds[axis] = { floor, knee }

    // Separation gap: snare_p5 - nonSnare_p95
    // Positive = snare p5 is above non-snare p95 = excellent separation
    const gap = snareP5 - nonSnareP95

    console.log(`\n  ── ${axis} ──`)
    console.log(`    Snare:  p5=${snareP5.toFixed(4)}  p25=${snareP25.toFixed(4)}  p50=${snareP50.toFixed(4)}  p75=${snareP75.toFixed(4)}  p95=${snareP95.toFixed(4)}`)
    console.log(`    NonSnare: p5=${nonSnareP5.toFixed(4)}  p50=${nonSnareP50.toFixed(4)}  p95=${nonSnareP95.toFixed(4)}`)
    console.log(`    Separation gap (snare_p5 - nonSnare_p95): ${gap.toFixed(4)} ${gap > 0 ? '✅ GOOD' : '⚠️ OVERLAP'}`)
    console.log(`    Per-label p5/p50/p95:`)
    for (const [label, stats] of Object.entries(perLabel)) {
      console.log(`      ${label.padEnd(8)} p5=${stats.p5.toFixed(4)}  p50=${stats.p50.toFixed(4)}  p95=${stats.p95.toFixed(4)}`)
    }
    console.log(`    → Floor (snare p5) = ${floor.toFixed(4)}`)
    console.log(`    → Knee (snare p50) = ${knee.toFixed(4)}`)
  }

  // ── FALSE POSITIVE SIMULATION ─────────────────────────────────────
  console.log(`\n═══ FALSE POSITIVE SIMULATION ═══`)
  console.log(`  Testing veto gates with calculated thresholds:`)
  console.log(`    flatness:        floor=${thresholds.flatness.floor.toFixed(4)}  knee=${thresholds.flatness.knee.toFixed(4)}`)
  console.log(`    whiteNoiseScore: floor=${thresholds.whiteNoiseScore.floor.toFixed(4)}  knee=${thresholds.whiteNoiseScore.knee.toFixed(4)}`)
  console.log(`    spectralFlux:    floor=${thresholds.spectralFlux.floor.toFixed(4)}  knee=${thresholds.spectralFlux.knee.toFixed(4)}`)

  // Simulate: for each non-snare frame, does it pass all 3 gates?
  let nonSnarePass = 0
  let nonSnareTotal = 0
  const perLabelPass: Record<string, { pass: number; total: number }> = {}

  for (const r of nonSnareData) {
    nonSnareTotal++
    if (!perLabelPass[r.label]) perLabelPass[r.label] = { pass: 0, total: 0 }
    perLabelPass[r.label].total++

    const fg = flatnessGate(r.flatness, thresholds.flatness.floor, thresholds.flatness.knee)
    const wg = wnsGate(r.whiteNoiseScore, thresholds.whiteNoiseScore.floor, thresholds.whiteNoiseScore.knee)
    const flg = fluxGate(r.spectralFlux, thresholds.spectralFlux.floor, thresholds.spectralFlux.knee)
    const veto = fg * wg * flg

    // "Pass" = vetoFactor > 0.1 (some signal gets through)
    if (veto > 0.1) {
      nonSnarePass++
      perLabelPass[r.label].pass++
    }
  }

  // Snare recall: what % of snare frames pass?
  let snarePass = 0
  for (const r of snareData) {
    const fg = flatnessGate(r.flatness, thresholds.flatness.floor, thresholds.flatness.knee)
    const wg = wnsGate(r.whiteNoiseScore, thresholds.whiteNoiseScore.floor, thresholds.whiteNoiseScore.knee)
    const flg = fluxGate(r.spectralFlux, thresholds.spectralFlux.floor, thresholds.spectralFlux.knee)
    const veto = fg * wg * flg
    if (veto > 0.1) snarePass++
  }

  const fpRate = (nonSnarePass / nonSnareTotal * 100).toFixed(2)
  const recall = (snarePass / snareData.length * 100).toFixed(2)

  console.log(`\n  Non-snare frames passing veto (FP rate): ${nonSnarePass}/${nonSnareTotal} = ${fpRate}%`)
  console.log(`  Snare frames passing veto (recall):      ${snarePass}/${snareData.length} = ${recall}%`)
  console.log(`\n  Per-label FP breakdown:`)
  for (const [label, stats] of Object.entries(perLabelPass)) {
    const rate = (stats.pass / stats.total * 100).toFixed(2)
    console.log(`    ${label.padEnd(8)} ${stats.pass}/${stats.total} = ${rate}%`)
  }

  // ── THRESHOLD OPTIMIZATION (Grid Search) ─────────────────────────
  // Grid search: find floor/knee combos that minimize FP while keeping recall > 70%
  console.log(`\n═══ THRESHOLD OPTIMIZATION (Grid Search) ═══`)
  console.log(`  Target: FP < 15% with recall > 70%`)

  const flatFloors = [0.08, 0.10, 0.12, 0.14, 0.16, 0.18, 0.20]
  const flatKnees = [0.18, 0.20, 0.22, 0.25, 0.28, 0.30]
  const wnsFloors = [0.15, 0.20, 0.25, 0.30, 0.35, 0.40]
  const wnsKnees = [0.50, 0.60, 0.70, 0.80, 0.90, 1.00]
  const fluxFloors = [0.05, 0.08, 0.10, 0.12, 0.15]
  const fluxKnees = [0.15, 0.20, 0.25, 0.30, 0.35]

  let bestFp = 100
  let bestRecall = 0
  let best: Record<Axis, { floor: number; knee: number }> = {
    flatness: { floor: 0, knee: 0 },
    whiteNoiseScore: { floor: 0, knee: 0 },
    spectralFlux: { floor: 0, knee: 0 },
  }

  for (const ff of flatFloors) for (const fk of flatKnees) {
    if (fk <= ff) continue
    for (const wf of wnsFloors) for (const wk of wnsKnees) {
      if (wk <= wf) continue
      for (const flf of fluxFloors) for (const flk of fluxKnees) {
        if (flk <= flf) continue

        let sPass = 0, nsPass = 0
        for (const r of snareData) {
          const v = flatnessGate(r.flatness, ff, fk) * wnsGate(r.whiteNoiseScore, wf, wk) * fluxGate(r.spectralFlux, flf, flk)
          if (v > 0.1) sPass++
        }
        for (const r of nonSnareData) {
          const v = flatnessGate(r.flatness, ff, fk) * wnsGate(r.whiteNoiseScore, wf, wk) * fluxGate(r.spectralFlux, flf, flk)
          if (v > 0.1) nsPass++
        }

        const recall = sPass / snareData.length * 100
        const fp = nsPass / nonSnareData.length * 100

        // Optimize: minimize FP subject to recall > 70%
        if (recall > 70 && fp < bestFp) {
          bestFp = fp
          bestRecall = recall
          best = {
            flatness: { floor: ff, knee: fk },
            whiteNoiseScore: { floor: wf, knee: wk },
            spectralFlux: { floor: flf, knee: flk },
          }
        }
      }
    }
  }

  const optimizedThresholds = best
  const optFpRate = bestFp.toFixed(2)
  const optRecall = bestRecall.toFixed(2)

  console.log(`  Optimized (grid search) thresholds:`)
  console.log(`    flatness:        floor=${optimizedThresholds.flatness.floor.toFixed(4)}  knee=${optimizedThresholds.flatness.knee.toFixed(4)}`)
  console.log(`    whiteNoiseScore: floor=${optimizedThresholds.whiteNoiseScore.floor.toFixed(4)}  knee=${optimizedThresholds.whiteNoiseScore.knee.toFixed(4)}`)
  console.log(`    spectralFlux:    floor=${optimizedThresholds.spectralFlux.floor.toFixed(4)}  knee=${optimizedThresholds.spectralFlux.knee.toFixed(4)}`)
  console.log(`  Optimized FP rate: ${optFpRate}%  |  Recall: ${optRecall}%`)

  // ── FINAL RECOMMENDATION ──────────────────────────────────────────
  // Pick the better set (lower FP with recall > 65%)
  const useOptimized = parseFloat(optFpRate) < parseFloat(fpRate) && parseFloat(optRecall) > 65
  const final = useOptimized ? optimizedThresholds : thresholds

  console.log(`\n═══ FINAL RECOMMENDED THRESHOLDS (${useOptimized ? 'grid search optimized' : 'default p5/p50'}) ═══`)
  console.log(`  snareVetoFlatnessFloor: ${final.flatness.floor.toFixed(4)}`)
  console.log(`  snareVetoFlatnessKnee:  ${final.flatness.knee.toFixed(4)}`)
  console.log(`  snareVetoWnsFloor:      ${final.whiteNoiseScore.floor.toFixed(4)}`)
  console.log(`  snareVetoWnsKnee:       ${final.whiteNoiseScore.knee.toFixed(4)}`)
  console.log(`  snareVetoFluxFloor:     ${final.spectralFlux.floor.toFixed(4)}`)
  console.log(`  snareVetoFluxKnee:      ${final.spectralFlux.knee.toFixed(4)}`)

  // ── WRITE OUTPUT ──────────────────────────────────────────────────
  if (outputFile) {
    const md = generateReport(records.length, groups, thresholds, optimizedThresholds,
      { fpRate: parseFloat(fpRate), recall: parseFloat(recall) },
      { fpRate: parseFloat(optFpRate), recall: parseFloat(optRecall) },
      final, useOptimized)
    writeFileSync(outputFile, md, 'utf-8')
    console.log(`\n  Report written to: ${outputFile}`)
  }
}

function generateReport(
  totalRecords: number,
  groups: Map<string, TelemetryRecord[]>,
  thresholds: Record<string, { floor: number; knee: number }>,
  optimized: Record<string, { floor: number; knee: number }>,
  defaultPerf: { fpRate: number; recall: number },
  optPerf: { fpRate: number; recall: number },
  final: Record<string, { floor: number; knee: number }>,
  useOptimized: boolean,
): string {
  const lines: string[] = []
  lines.push('# WAVE 7749 — Monte Carlo Snare Veto Calibration Results')
  lines.push('')
  lines.push(`**Dataset:** ${totalRecords} frames from ${groups.size} categories`)
  lines.push(`**Categories:** ${[...groups.keys()].map(k => `${k} (${groups.get(k)!.length})`).join(', ')}`)
  lines.push('')
  lines.push('## Final Recommended Thresholds')
  lines.push('')
  lines.push(`| Parameter | Value |`)
  lines.push(`|---|---|`)
  lines.push(`| snareVetoFlatnessFloor | ${final.flatness.floor.toFixed(4)} |`)
  lines.push(`| snareVetoFlatnessKnee  | ${final.flatness.knee.toFixed(4)} |`)
  lines.push(`| snareVetoWnsFloor      | ${final.whiteNoiseScore.floor.toFixed(4)} |`)
  lines.push(`| snareVetoWnsKnee       | ${final.whiteNoiseScore.knee.toFixed(4)} |`)
  lines.push(`| snareVetoFluxFloor     | ${final.spectralFlux.floor.toFixed(4)} |`)
  lines.push(`| snareVetoFluxKnee      | ${final.spectralFlux.knee.toFixed(4)} |`)
  lines.push('')
  lines.push(`**Strategy:** ${useOptimized ? 'Optimized (p10/p40)' : 'Default (p5/p50)'}`)
  lines.push(`**False Positive Rate:** ${useOptimized ? optPerf.fpRate : defaultPerf.fpRate}%`)
  lines.push(`**Snare Recall:** ${useOptimized ? optPerf.recall : defaultPerf.recall}%`)
  lines.push('')
  lines.push('## Performance Comparison')
  lines.push('')
  lines.push('| Strategy | FP Rate | Recall |')
  lines.push('|---|---|---|')
  lines.push(`| Default (p5/p50) | ${defaultPerf.fpRate}% | ${defaultPerf.recall}% |`)
  lines.push(`| Optimized (p10/p40) | ${optPerf.fpRate}% | ${optPerf.recall}% |`)
  lines.push('')
  return lines.join('\n')
}

main()
