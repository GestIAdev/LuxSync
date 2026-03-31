/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 2417 — MONTE CARLO: HARMONY RESURRECTION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The Left Hemisphere is clinically dead. BL=0.00 ML=0.00 in EVERY frame.
 *
 * Root cause: midSynthInput and melodyInput average ~0.04, but gateOn=0.10.
 * The signal NEVER crosses the gate. The envelope decays to zero eternally.
 *
 * This Monte Carlo finds:
 *   1. Optimal routing coefficients c1-c6 for midSynthInput & melodyInput
 *   2. Optimal gateOn, gateOff, boost, decayBase, decayRange, crushExponent
 *      for envelopeHighMid (Back L) and envelopeTreble (Mover L)
 *
 * Scoring:
 *   - RESURRECTION: avg BL and ML must be in [0.30, 0.70]
 *   - DUCKING: when bass > 0.70, BL/ML should attenuate 30-50%, NOT die
 *   - MORPH AGNOSTIC: tested across morphFactor sweep [0, 0.5, 1.0]
 *
 * Data source: docs/logs/leftcalib.md — real telemetry from WAVE 2416
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ═══════════════════════════════════════════════════════════════════════════
// 1. PARSE REAL TELEMETRY
// ═══════════════════════════════════════════════════════════════════════════

interface HarmonyFrame {
  bass: number
  lMid: number
  mid: number
  hMid: number
  flat: number
  isTonal: number
}

function parseLog(filePath: string): HarmonyFrame[] {
  const raw = readFileSync(filePath, 'utf-8')
  const frames: HarmonyFrame[] = []
  const regex = /\[HARMONY-L\] bass: ([\d.]+) lMid: ([\d.]+) mid: ([\d.]+) hMid: ([\d.]+) flat: ([\d.]+) \| isTonal: (\d)/g
  let m: RegExpExecArray | null
  while ((m = regex.exec(raw)) !== null) {
    frames.push({
      bass: parseFloat(m[1]),
      lMid: parseFloat(m[2]),
      mid:  parseFloat(m[3]),
      hMid: parseFloat(m[4]),
      flat: parseFloat(m[5]),
      isTonal: parseInt(m[6], 10),
    })
  }
  return frames
}

const frames = parseLog(join(__dirname, '..', 'docs', 'logs', 'leftcalib.md'))
console.log(`Parsed ${frames.length} HARMONY-L frames from leftcalib.md`)

// ═══════════════════════════════════════════════════════════════════════════
// 2. LIQUID ENVELOPE REPLICA (exact copy of LiquidEnvelope.process)
// ═══════════════════════════════════════════════════════════════════════════

interface EnvConfig {
  gateOn: number
  gateOff: number
  boost: number
  crushExponent: number
  decayBase: number
  decayRange: number
  maxIntensity: number
  squelchBase: number
  squelchSlope: number
  ghostCap: number
  gateMargin: number
}

interface EnvState {
  intensity: number
  avgSignal: number
  avgSignalPeak: number
  lastFireTime: number
  lastSignal: number
  wasAttacking: boolean
}

function freshState(): EnvState {
  return { intensity: 0, avgSignal: 0, avgSignalPeak: 0, lastFireTime: 0, lastSignal: 0, wasAttacking: false }
}

function processEnvelope(signal: number, morphFactor: number, now: number, isBreakdown: boolean, c: EnvConfig, s: EnvState): number {
  // 1. Velocity Gate
  const velocity = signal - s.lastSignal
  s.lastSignal = signal
  const isRisingAttack = velocity >= -0.005
  const isGraceFrame = s.wasAttacking && velocity >= -0.03
  const isAttacking = isRisingAttack || isGraceFrame
  s.wasAttacking = isRisingAttack && velocity > 0.01

  // 2. Asymmetric EMA
  if (signal > s.avgSignal) {
    s.avgSignal = s.avgSignal * 0.98 + signal * 0.02
  } else {
    s.avgSignal = s.avgSignal * 0.88 + signal * 0.12
  }

  // 3. Peak Memory + Tidal Gate
  const timeSinceLastFire = s.lastFireTime > 0 ? now - s.lastFireTime : 0
  const isDrySpell = timeSinceLastFire > 2000
  const peakDecay = isDrySpell ? 0.985 : 0.993
  if (s.avgSignal > s.avgSignalPeak) {
    s.avgSignalPeak = s.avgSignal
  } else {
    s.avgSignalPeak = s.avgSignalPeak * peakDecay + s.avgSignal * (1 - peakDecay)
  }

  // 4. Adaptive Floor
  const drySpellFloorDecay = timeSinceLastFire > 3000
    ? Math.min(1.0, (timeSinceLastFire - 3000) / 3000)
    : 0
  const adaptiveFloor = c.gateOn - (0.12 * drySpellFloorDecay)
  const avgEffective = Math.max(s.avgSignal, s.avgSignalPeak * 0.55, adaptiveFloor)

  // 5. Dynamic Gate
  const dynamicGate = avgEffective + c.gateMargin

  // 6. Decay
  const decay = c.decayBase + c.decayRange * morphFactor
  s.intensity *= decay

  // 7. Main Gate + Crush
  const breakdownPenalty = isBreakdown ? 0.06 : 0
  let kickPower = 0
  let ghostPower = 0

  if (signal > dynamicGate && isAttacking && signal > 0.15) {
    const requiredJump = 0.14 - 0.07 * morphFactor + breakdownPenalty
    let rawPower = (signal - dynamicGate) / requiredJump
    rawPower = Math.min(1.0, Math.max(0, rawPower))
    const crushExp = c.crushExponent + 0.3 * (1.0 - morphFactor)
    kickPower = Math.pow(rawPower, crushExp)
  } else if (signal > avgEffective && signal > 0.15 && !isBreakdown) {
    const ghostCapDynamic = c.ghostCap * morphFactor
    const proximity = (signal - avgEffective) / 0.02
    ghostPower = Math.min(ghostCapDynamic, proximity * ghostCapDynamic)
  }

  // 8. Ignition Squelch
  const squelch = Math.max(0.02, c.squelchBase - c.squelchSlope * morphFactor)
  if (kickPower > squelch) {
    s.lastFireTime = now
    const hit = Math.min(c.maxIntensity, kickPower * (1.2 + 0.8 * morphFactor) * c.boost)
    s.intensity = Math.max(s.intensity, hit)
  } else if (ghostPower > 0) {
    s.intensity = Math.max(s.intensity, ghostPower)
  }

  // 9. Smooth Fade
  const fadeZone = 0.08
  const fadeFactor = s.intensity >= fadeZone ? 1.0 : Math.pow(s.intensity / fadeZone, 2)
  return Math.min(c.maxIntensity, s.intensity * fadeFactor)
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. SIMULATION: run full pipeline for one config across all frames
// ═══════════════════════════════════════════════════════════════════════════

interface RoutingCoeffs {
  // Back L: (lMid * c1) + (mid * c2) - (bass * c3)
  c1: number; c2: number; c3: number
  // Mover L: (mid * c4) + (hMid * c5) - (bass * c6)
  c4: number; c5: number; c6: number
}

interface SimResult {
  avgBL: number
  avgML: number
  // High-bass frames (bass > 0.70)
  avgBL_highBass: number
  avgML_highBass: number
  // Low-bass frames (bass <= 0.70)
  avgBL_lowBass: number
  avgML_lowBass: number
  // Frames alive (> 0.01)
  aliveBL: number
  aliveML: number
}

function simulate(
  routing: RoutingCoeffs,
  envBL: EnvConfig,
  envML: EnvConfig,
  morphFactor: number,
): SimResult {
  const stateBL = freshState()
  const stateML = freshState()

  let sumBL = 0, sumML = 0
  let sumBL_hi = 0, sumML_hi = 0, countHi = 0
  let sumBL_lo = 0, sumML_lo = 0, countLo = 0
  let aliveBL = 0, aliveML = 0

  for (let i = 0; i < frames.length; i++) {
    const f = frames[i]
    const now = 1000 + i * 33 // ~30fps

    // Back L routing
    const midSynthInput = Math.max(0,
      f.lMid * routing.c1 + f.mid * routing.c2 - f.bass * routing.c3
    )
    const bl = processEnvelope(midSynthInput, morphFactor, now, false, envBL, stateBL)

    // Mover L routing (with tonal gate)
    const melodyInput = Math.max(0,
      f.mid * routing.c4 + f.hMid * routing.c5 - f.bass * routing.c6
    ) * f.isTonal
    const ml = processEnvelope(melodyInput, morphFactor, now, false, envML, stateML)

    sumBL += bl
    sumML += ml
    if (bl > 0.01) aliveBL++
    if (ml > 0.01) aliveML++

    if (f.bass > 0.70) {
      sumBL_hi += bl; sumML_hi += ml; countHi++
    } else {
      sumBL_lo += bl; sumML_lo += ml; countLo++
    }
  }

  const n = frames.length
  return {
    avgBL: sumBL / n,
    avgML: sumML / n,
    avgBL_highBass: countHi > 0 ? sumBL_hi / countHi : 0,
    avgML_highBass: countHi > 0 ? sumML_hi / countHi : 0,
    avgBL_lowBass: countLo > 0 ? sumBL_lo / countLo : 0,
    avgML_lowBass: countLo > 0 ? sumML_lo / countLo : 0,
    aliveBL: aliveBL / n,
    aliveML: aliveML / n,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. SCORING FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

function score(routing: RoutingCoeffs, envBL: EnvConfig, envML: EnvConfig): number {
  const morphLevels = [0.0, 0.5, 1.0]
  let totalPenalty = 0

  for (const morph of morphLevels) {
    const r = simulate(routing, envBL, envML, morph)

    // OBJECTIVE 1: RESURRECTION — avg intensity in [0.30, 0.70]
    const targetLow = 0.30
    const targetHigh = 0.70

    // BL resurrection
    if (r.avgBL < targetLow) totalPenalty += (targetLow - r.avgBL) * 10
    else if (r.avgBL > targetHigh) totalPenalty += (r.avgBL - targetHigh) * 5

    // ML resurrection
    if (r.avgML < targetLow) totalPenalty += (targetLow - r.avgML) * 10
    else if (r.avgML > targetHigh) totalPenalty += (r.avgML - targetHigh) * 5

    // Alive ratio: at least 60% of frames should have signal
    if (r.aliveBL < 0.60) totalPenalty += (0.60 - r.aliveBL) * 5
    if (r.aliveML < 0.60) totalPenalty += (0.60 - r.aliveML) * 5

    // OBJECTIVE 2: ACOUSTIC DUCKING
    // High-bass frames should be 30-50% lower than low-bass frames
    // But NOT dead (> 0.10)
    if (r.avgBL_lowBass > 0.01 && r.avgBL_highBass > 0.01) {
      const duckRatioBL = r.avgBL_highBass / r.avgBL_lowBass
      // Ideal: 0.50-0.70 (30-50% attenuation)
      if (duckRatioBL < 0.30) totalPenalty += (0.30 - duckRatioBL) * 8  // Over-ducked
      else if (duckRatioBL > 0.85) totalPenalty += (duckRatioBL - 0.85) * 4  // Under-ducked
    } else if (r.avgBL_highBass < 0.05) {
      // Dead during bass hits = bad
      totalPenalty += 3.0
    }

    if (r.avgML_lowBass > 0.01 && r.avgML_highBass > 0.01) {
      const duckRatioML = r.avgML_highBass / r.avgML_lowBass
      if (duckRatioML < 0.30) totalPenalty += (0.30 - duckRatioML) * 8
      else if (duckRatioML > 0.85) totalPenalty += (duckRatioML - 0.85) * 4
    } else if (r.avgML_highBass < 0.05) {
      totalPenalty += 3.0
    }

    // OBJECTIVE 3: MORPH STABILITY — don't die at any morph level
    if (r.avgBL < 0.10) totalPenalty += 5.0  // Clinically dead = huge penalty
    if (r.avgML < 0.10) totalPenalty += 5.0
  }

  return totalPenalty
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. TWO-PHASE GRID SEARCH
// ═══════════════════════════════════════════════════════════════════════════
// Phase A: Find optimal routing (c1-c6) with a reasonable fixed envelope
// Phase B: Refine envelope params with the winning routing
// This reduces from ~3.8M to ~35K configs = viable on 16GB laptop

interface Candidate {
  penalty: number
  routing: RoutingCoeffs
  envBL: EnvConfig
  envML: EnvConfig
  diag: SimResult
}

function makeEnvBL(gateOn: number, boost: number, crush: number, decayBase: number, decayRange: number): EnvConfig {
  return {
    gateOn, gateOff: gateOn * 0.5,
    boost, crushExponent: crush,
    decayBase, decayRange,
    maxIntensity: 1.0,
    squelchBase: 0.02, squelchSlope: 0.10,
    ghostCap: 0.05, gateMargin: 0.005,
  }
}

function makeEnvML(gateOn: number, boost: number, crush: number, decayBase: number, decayRange: number): EnvConfig {
  return {
    gateOn, gateOff: gateOn * 0.5,
    boost, crushExponent: crush,
    decayBase, decayRange,
    maxIntensity: 1.0,
    squelchBase: 0.02, squelchSlope: 0.10,
    ghostCap: 0.04, gateMargin: 0.005,
  }
}

// ─── PHASE A: Routing sweep with fixed "generous" envelope ───────────────
console.log('\n══════ PHASE A: ROUTING SWEEP ══════')

const c1_grid = [0.0, 0.3, 0.5, 1.0, 2.0, 3.0, 5.0]
const c2_grid = [0.4, 0.6, 0.8, 1.0, 1.2, 1.5, 2.0]
const c3_grid = [0.0, 0.05, 0.10, 0.15, 0.20]

const c4_grid = [0.4, 0.6, 0.8, 1.0, 1.2, 1.5, 2.0]
const c5_grid = [0.0, 1.0, 3.0, 5.0, 8.0, 12.0, 15.0]
const c6_grid = [0.0, 0.05, 0.10, 0.15, 0.20]

const phaseAConfigs = c1_grid.length * c2_grid.length * c3_grid.length *
  c4_grid.length * c5_grid.length * c6_grid.length
console.log(`Phase A: ${phaseAConfigs} routing configs`)

// Fixed envelope: low gateOn, moderate boost/decay
const fixedBL = makeEnvBL(0.03, 4.0, 0.7, 0.88, 0.08)
const fixedML = makeEnvML(0.03, 3.0, 0.7, 0.85, 0.08)

const topRouting: Candidate[] = []
let evaluated = 0

for (const c1 of c1_grid) {
  for (const c2 of c2_grid) {
    for (const c3 of c3_grid) {
      for (const c4 of c4_grid) {
        for (const c5 of c5_grid) {
          for (const c6 of c6_grid) {
            const routing: RoutingCoeffs = { c1, c2, c3, c4, c5, c6 }
            const penalty = score(routing, fixedBL, fixedML)

            if (topRouting.length < 20 || penalty < topRouting[topRouting.length - 1].penalty) {
              const diag = simulate(routing, fixedBL, fixedML, 0.0)
              const candidate: Candidate = { penalty, routing, envBL: fixedBL, envML: fixedML, diag }
              let inserted = false
              for (let i = 0; i < topRouting.length; i++) {
                if (penalty < topRouting[i].penalty) { topRouting.splice(i, 0, candidate); inserted = true; break }
              }
              if (!inserted) topRouting.push(candidate)
              if (topRouting.length > 20) topRouting.pop()
            }
            evaluated++
          }
        }
      }
    }
  }
}

console.log(`Phase A: evaluated ${evaluated} configs`)
console.log('\nTop 5 routing candidates:')
for (let i = 0; i < Math.min(5, topRouting.length); i++) {
  const t = topRouting[i]
  const d = t.diag
  console.log(`  #${i + 1} pen=${t.penalty.toFixed(3)} | BL: lMid×${t.routing.c1}+mid×${t.routing.c2}-bass×${t.routing.c3} | ML: mid×${t.routing.c4}+hMid×${t.routing.c5}-bass×${t.routing.c6}`)
  console.log(`       avgBL=${d.avgBL.toFixed(3)} aliveBL=${(d.aliveBL*100).toFixed(0)}% | avgML=${d.avgML.toFixed(3)} aliveML=${(d.aliveML*100).toFixed(0)}%`)
}

// ─── PHASE B: Envelope sweep with winning routing ────────────────────────
console.log('\n══════ PHASE B: ENVELOPE REFINEMENT ══════')

const winRouting = topRouting[0].routing

const gateOn_grid = [0.01, 0.02, 0.03, 0.05, 0.07]
const boostBL_grid = [2.0, 3.0, 4.0, 5.0, 6.0, 8.0]
const boostML_grid = [1.5, 2.0, 3.0, 4.0, 5.0, 6.0]
const decayBL_grid = [0.75, 0.82, 0.88, 0.92, 0.95]
const decayML_grid = [0.70, 0.78, 0.85, 0.90, 0.93]
const decayRange_grid = [0.03, 0.06, 0.10]
const crush_grid = [0.3, 0.5, 0.7, 1.0]

const phaseBConfigs = gateOn_grid.length * boostBL_grid.length * boostML_grid.length *
  decayBL_grid.length * decayML_grid.length * decayRange_grid.length * crush_grid.length
console.log(`Phase B: ${phaseBConfigs} envelope configs (routing locked: c1=${winRouting.c1} c2=${winRouting.c2} c3=${winRouting.c3} c4=${winRouting.c4} c5=${winRouting.c5} c6=${winRouting.c6})`)

const topN = 10
const top: Candidate[] = []
let evaluated2 = 0

for (const gateOn of gateOn_grid) {
  for (const bBL of boostBL_grid) {
    for (const bML of boostML_grid) {
      for (const dBL of decayBL_grid) {
        for (const dML of decayML_grid) {
          for (const dr of decayRange_grid) {
            for (const crush of crush_grid) {
              const envBL = makeEnvBL(gateOn, bBL, crush, dBL, dr)
              const envML = makeEnvML(gateOn, bML, crush, dML, dr)
              const penalty = score(winRouting, envBL, envML)

              if (top.length < topN || penalty < top[top.length - 1].penalty) {
                const diag = simulate(winRouting, envBL, envML, 0.0)
                const candidate: Candidate = { penalty, routing: winRouting, envBL, envML, diag }
                let inserted = false
                for (let i = 0; i < top.length; i++) {
                  if (penalty < top[i].penalty) { top.splice(i, 0, candidate); inserted = true; break }
                }
                if (!inserted) top.push(candidate)
                if (top.length > topN) top.pop()
              }
              evaluated2++
            }
          }
        }
      }
    }
  }
}

console.log(`Phase B: evaluated ${evaluated2} configs`)

// ═══════════════════════════════════════════════════════════════════════════
// 6. RESULTS
// ═══════════════════════════════════════════════════════════════════════════

console.log(`Total configurations evaluated: ${evaluated}`)
console.log(`\n${'═'.repeat(70)}`)
console.log('  TOP 10 CANDIDATES — HARMONY RESURRECTION')
console.log('═'.repeat(70))

for (let i = 0; i < top.length; i++) {
  const t = top[i]
  const r = t.routing

  // Run all morph levels for display
  const d0 = simulate(r, t.envBL, t.envML, 0.0)
  const d5 = simulate(r, t.envBL, t.envML, 0.5)
  const d1 = simulate(r, t.envBL, t.envML, 1.0)

  console.log(`\n#${i + 1} — Penalty: ${t.penalty.toFixed(4)}`)
  console.log(`  ROUTING Back L:  lMid×${r.c1} + mid×${r.c2} - bass×${r.c3}`)
  console.log(`  ROUTING Mover L: mid×${r.c4} + hMid×${r.c5} - bass×${r.c6}`)
  console.log(`  ENV BL: gateOn=${t.envBL.gateOn} boost=${t.envBL.boost} decay=${t.envBL.decayBase}+${t.envBL.decayRange}*m crush=${t.envBL.crushExponent}`)
  console.log(`  ENV ML: gateOn=${t.envML.gateOn} boost=${(t.envBL.boost * 0.8).toFixed(1)} decay=${t.envML.decayBase.toFixed(2)}+${t.envML.decayRange}*m crush=${t.envML.crushExponent}`)
  console.log(`  ── morph=0.0: BL avg=${d0.avgBL.toFixed(3)} alive=${(d0.aliveBL*100).toFixed(0)}% | ML avg=${d0.avgML.toFixed(3)} alive=${(d0.aliveML*100).toFixed(0)}%`)
  console.log(`                 BL hi-bass=${d0.avgBL_highBass.toFixed(3)} lo-bass=${d0.avgBL_lowBass.toFixed(3)} duck=${d0.avgBL_lowBass > 0 ? (d0.avgBL_highBass/d0.avgBL_lowBass).toFixed(2) : 'N/A'}`)
  console.log(`                 ML hi-bass=${d0.avgML_highBass.toFixed(3)} lo-bass=${d0.avgML_lowBass.toFixed(3)} duck=${d0.avgML_lowBass > 0 ? (d0.avgML_highBass/d0.avgML_lowBass).toFixed(2) : 'N/A'}`)
  console.log(`  ── morph=0.5: BL avg=${d5.avgBL.toFixed(3)} | ML avg=${d5.avgML.toFixed(3)}`)
  console.log(`  ── morph=1.0: BL avg=${d1.avgBL.toFixed(3)} | ML avg=${d1.avgML.toFixed(3)}`)
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. WINNER — Optimal config for application
// ═══════════════════════════════════════════════════════════════════════════

if (top.length > 0) {
  const w = top[0]
  console.log(`\n${'═'.repeat(70)}`)
  console.log('  GOLDEN CONFIG — APPLY TO CODE')
  console.log('═'.repeat(70))
  console.log('\n// LiquidStereoPhysics.ts — NEW ROUTING:')
  console.log(`// Back L: midSynthInput = max(0, lMid * ${w.routing.c1} + mid * ${w.routing.c2} - bass * ${w.routing.c3})`)
  console.log(`// Mover L: melodyInput = max(0, mid * ${w.routing.c4} + hMid * ${w.routing.c5} - bass * ${w.routing.c6}) * isTonal`)
  console.log('\n// profiles/techno.ts — envelopeHighMid (Back L):')
  console.log(`//   gateOn: ${w.envBL.gateOn}, gateOff: ${w.envBL.gateOff}, boost: ${w.envBL.boost}`)
  console.log(`//   crushExponent: ${w.envBL.crushExponent}, decayBase: ${w.envBL.decayBase}, decayRange: ${w.envBL.decayRange}`)
  console.log(`//   maxIntensity: ${w.envBL.maxIntensity}, squelchBase: ${w.envBL.squelchBase}, squelchSlope: ${w.envBL.squelchSlope}`)
  console.log(`//   ghostCap: ${w.envBL.ghostCap}, gateMargin: ${w.envBL.gateMargin}`)
  console.log('\n// profiles/techno.ts — envelopeTreble (Mover L):')
  console.log(`//   gateOn: ${w.envML.gateOn}, gateOff: ${w.envML.gateOff}, boost: ${(w.envBL.boost * 0.8).toFixed(1)}`)
  console.log(`//   crushExponent: ${w.envML.crushExponent}, decayBase: ${w.envML.decayBase.toFixed(2)}, decayRange: ${w.envML.decayRange}`)
  console.log(`//   maxIntensity: ${w.envML.maxIntensity}, squelchBase: ${w.envML.squelchBase}, squelchSlope: ${w.envML.squelchSlope}`)
  console.log(`//   ghostCap: ${w.envML.ghostCap}, gateMargin: ${w.envML.gateMargin}`)
}
