/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 2419 — MONTE CARLO: RIGHT HEMISPHERE RESURRECTION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Eric Prydz: muro de sonido, cero vocales, percusión ahogada en mid.
 * BR=0.00 MR=0.00 en 100% de frames. Triple kill:
 *   1. percGate=0.14 con rIn max=0.155 → señal apenas roza el gate
 *   2. envelopeVocal gateOn=0.15 con vIn max=0.038 → NUNCA pasa
 *   3. kickVetoFrames=5 @ 161bpm → veto ON ~45% del tiempo
 *
 * Phase A: Back R routing (c1,c2) + percGate + percBoost + percExponent
 * Phase B: Mover R routing (c3-c6) + envelopeVocal + kickVetoFrames
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

interface HumanRFrame {
  hMid: number
  treble: number
  mid: number
  rIn: number    // current rIn for reference
  vIn: number    // current vIn for reference
  veto: number   // 0 or 1
}

function parseLog(filePath: string): HumanRFrame[] {
  const raw = readFileSync(filePath, 'utf-8')
  const frames: HumanRFrame[] = []
  const regex = /\[HUMAN-R\] hMid: ([\d.]+) treble: ([\d.]+) mid: ([\d.]+) \| rIn\(Snare\): ([\d.]+) vIn\(Vocal\): ([\d.]+) \|\| BR\(Latigo\): [\d.]+ MR\(Voz\): [\d.]+ \| veto: (\d)/g
  let m: RegExpExecArray | null
  while ((m = regex.exec(raw)) !== null) {
    frames.push({
      hMid: parseFloat(m[1]),
      treble: parseFloat(m[2]),
      mid: parseFloat(m[3]),
      rIn: parseFloat(m[4]),
      vIn: parseFloat(m[5]),
      veto: parseInt(m[6], 10),
    })
  }
  return frames
}

const frames = parseLog(join(__dirname, '..', 'docs', 'logs', 'rightcalib1.md'))
console.log(`Parsed ${frames.length} HUMAN-R frames from rightcalib1.md`)

// Quick stats
const stats = {
  hMid: { min: Infinity, max: -Infinity, sum: 0 },
  treble: { min: Infinity, max: -Infinity, sum: 0 },
  mid: { min: Infinity, max: -Infinity, sum: 0 },
  rIn: { min: Infinity, max: -Infinity, sum: 0 },
  vIn: { min: Infinity, max: -Infinity, sum: 0 },
  vetoCount: 0,
}
for (const f of frames) {
  for (const key of ['hMid', 'treble', 'mid', 'rIn', 'vIn'] as const) {
    if (f[key] < stats[key].min) stats[key].min = f[key]
    if (f[key] > stats[key].max) stats[key].max = f[key]
    stats[key].sum += f[key]
  }
  if (f.veto === 1) stats.vetoCount++
}
const n = frames.length
console.log(`\nSTATS (${n} frames):`)
for (const key of ['hMid', 'treble', 'mid', 'rIn', 'vIn'] as const) {
  console.log(`  ${key}: min=${stats[key].min.toFixed(3)} max=${stats[key].max.toFixed(3)} avg=${(stats[key].sum/n).toFixed(3)}`)
}
console.log(`  veto: ${stats.vetoCount}/${n} (${(stats.vetoCount/n*100).toFixed(0)}%)`)

// We also need bass and lowMid for Mover R routing.
// The HUMAN-R log doesn't include them directly, but we can extract from
// other log lines. For the Monte Carlo we'll infer approximate values:
// From the leftcalib log, bass avg ~0.67, lowMid avg ~0.05.
// From the INTERVAL lines, bass is clearly present (high kicks).
// We'll parse AGC/INTERVAL lines to get bass estimates, or use conservative values.

// Parse bass from KICK lines in the same log
function parseBassFromLog(filePath: string): number[] {
  const raw = readFileSync(filePath, 'utf-8')
  const bassValues: number[] = []
  // Extract from bassFlux in INTERVAL lines
  const regex = /bassFlux=([\d.]+)/g
  let m: RegExpExecArray | null
  while ((m = regex.exec(raw)) !== null) {
    bassValues.push(parseFloat(m[1]))
  }
  return bassValues
}

// Since we don't have per-frame bass in HUMAN-R lines, we'll use
// a conservative estimate. From the leftcalib log of the same session,
// bass averaged ~0.67 for techno. For Eric Prydz (heavier), likely ~0.65-0.75.
const ESTIMATED_BASS = 0.70
const ESTIMATED_LOWMID = 0.05  // Always anemic in techno

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

function processEnvelope(signal: number, morphFactor: number, now: number, _isBreakdown: boolean, c: EnvConfig, s: EnvState): number {
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
  let kickPower = 0
  let ghostPower = 0

  if (signal > dynamicGate && isAttacking && signal > 0.15) {
    const requiredJump = 0.14 - 0.07 * morphFactor
    let rawPower = (signal - dynamicGate) / requiredJump
    rawPower = Math.min(1.0, Math.max(0, rawPower))
    const crushExp = c.crushExponent + 0.3 * (1.0 - morphFactor)
    kickPower = Math.pow(rawPower, crushExp)
  } else if (signal > avgEffective && signal > 0.15 && !_isBreakdown) {
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
// 3. BACK R SIMULATION (Schwarzenegger pipeline)
// ═══════════════════════════════════════════════════════════════════════════

interface BackRConfig {
  c1: number  // treble multiplier
  c2: number  // highMid multiplier
  percMidSubtract: number
  percGate: number
  percBoost: number
  percExponent: number
  envSnare: EnvConfig
}

interface BackRResult {
  avgBR: number
  peakBR: number
  aliveBR: number   // fraction of frames > 0.01
  peakCount: number  // frames with BR > 0.30
}

function simulateBackR(cfg: BackRConfig, morphFactor: number): BackRResult {
  const state = freshState()
  let sumBR = 0, aliveBR = 0, peakCount = 0, peakBR = 0

  for (let i = 0; i < frames.length; i++) {
    const f = frames[i]
    const now = 1000 + i * 33

    // Routing
    const rawRight = Math.max(0, (f.treble * cfg.c1 + f.hMid * cfg.c2) - (f.mid * cfg.percMidSubtract))

    // Schwarzenegger gate + boost
    let trImp = 0.0
    if (rawRight > cfg.percGate) {
      const gated = (rawRight - cfg.percGate) / (1.0 - cfg.percGate)
      trImp = Math.pow(gated, cfg.percExponent) * cfg.percBoost
    }
    const rawPerc = Math.min(1.0, Math.max(0.0, trImp))

    // Envelope
    const br = processEnvelope(rawPerc, morphFactor, now, false, cfg.envSnare, state)

    sumBR += br
    if (br > 0.01) aliveBR++
    if (br > 0.30) peakCount++
    if (br > peakBR) peakBR = br
  }

  return {
    avgBR: sumBR / frames.length,
    peakBR,
    aliveBR: aliveBR / frames.length,
    peakCount,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. MOVER R SIMULATION (Vocal/Air pipeline)
// ═══════════════════════════════════════════════════════════════════════════

interface MoverRConfig {
  c3: number  // highMid multiplier
  c4: number  // treble multiplier
  c5: number  // lowMid subtractor
  c6: number  // bass subtractor
  kickVetoFrames: number
  envVocal: EnvConfig
}

interface MoverRResult {
  avgMR: number
  aliveMR: number
  vetoKillRate: number  // fraction of frames killed by veto
}

function simulateMoverR(cfg: MoverRConfig, morphFactor: number): MoverRResult {
  const state = freshState()
  let sumMR = 0, aliveMR = 0, vetoKills = 0
  let vetoCounter = 0

  for (let i = 0; i < frames.length; i++) {
    const f = frames[i]
    const now = 1000 + i * 33

    // Simulate kick veto from log (use the original veto pattern but
    // adjust for different kickVetoFrames)
    // We know kicks happen when veto transitions 0→1.
    // Approximate: use original veto=1 as kick indicator for first frame
    const isKickFrame = i > 0 && f.veto === 1 && frames[i - 1].veto === 0
    if (isKickFrame) {
      vetoCounter = cfg.kickVetoFrames
    }
    const isVetoed = vetoCounter > 0
    if (vetoCounter > 0) vetoCounter--

    // Routing
    const vocalInput = Math.max(0,
      (f.hMid * cfg.c3 + f.treble * cfg.c4) -
      (ESTIMATED_LOWMID * cfg.c5 + ESTIMATED_BASS * cfg.c6)
    )
    const cleanVocal = isVetoed ? 0 : vocalInput

    // Envelope
    const rawMoverR = processEnvelope(cleanVocal, morphFactor, now, false, cfg.envVocal, state)

    // Sidechain gates (simplified — kickGate + snareGate)
    const kickGate = isVetoed ? (1.0 - ESTIMATED_BASS * 0.98) : 1.0
    const mr = rawMoverR * kickGate

    sumMR += mr
    if (mr > 0.01) aliveMR++
    if (isVetoed && vocalInput > 0.01) vetoKills++
  }

  return {
    avgMR: sumMR / frames.length,
    aliveMR: aliveMR / frames.length,
    vetoKillRate: vetoKills / frames.length,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. SCORING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function scoreBackR(cfg: BackRConfig): number {
  const morphLevels = [0.0, 0.5, 1.0]
  let penalty = 0

  for (const morph of morphLevels) {
    const r = simulateBackR(cfg, morph)

    // OBJECTIVE: Transient peaks — BR should fire on snare/perc hits
    // We want peakCount > 20% of frames (percussive, not constant)
    // and avg between 0.10-0.40 (not a wall of light, but visible pulses)
    if (r.avgBR < 0.08) penalty += (0.08 - r.avgBR) * 20   // Dead
    else if (r.avgBR > 0.50) penalty += (r.avgBR - 0.50) * 5  // Too hot

    // Peak count: at least 15% of frames should have visible hits
    const peakRatio = r.peakCount / frames.length
    if (peakRatio < 0.10) penalty += (0.10 - peakRatio) * 15

    // Alive ratio: at least 30% (snare is transient, not constant)
    if (r.aliveBR < 0.25) penalty += (0.25 - r.aliveBR) * 8

    // Maximum peak should reach at least 0.50
    if (r.peakBR < 0.40) penalty += (0.40 - r.peakBR) * 5

    // Dead = catastrophic
    if (r.avgBR < 0.02) penalty += 10.0
  }

  return penalty
}

function scoreMoverR(cfg: MoverRConfig): number {
  const morphLevels = [0.0, 0.5, 1.0]
  let penalty = 0

  for (const morph of morphLevels) {
    const r = simulateMoverR(cfg, morph)

    // OBJECTIVE: Breathing air — avg between 0.15-0.50
    if (r.avgMR < 0.15) penalty += (0.15 - r.avgMR) * 15
    else if (r.avgMR > 0.50) penalty += (r.avgMR - 0.50) * 5

    // Alive ratio: at least 40% (air is more sustained than snare)
    if (r.aliveMR < 0.35) penalty += (0.35 - r.aliveMR) * 8

    // Veto kill rate should be < 20% (not asfixiating)
    if (r.vetoKillRate > 0.20) penalty += (r.vetoKillRate - 0.20) * 10

    // Dead = catastrophic
    if (r.avgMR < 0.05) penalty += 10.0
  }

  return penalty
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. PHASE A: BACK R — TWO-PASS GRID SEARCH
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n══════ PHASE A: BACK R (SNARE RESURRECTION) ══════')

// Pass 1: Pure routing (no envelope) — find best signal extraction
console.log('  Pass 1: Routing coefficients...')

interface RoutingScore {
  c1: number; c2: number; pms: number; pg: number; pb: number; pe: number
  avgRaw: number; peakRaw: number; alive: number
}

const c1_grid = [0.5, 0.7, 1.0, 1.3, 1.5, 2.0]
const c2_grid = [0.0, 0.3, 0.5, 0.8, 1.0, 1.5, 2.0]
const percMidSub_grid = [0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.35]
const percGate_grid = [0.01, 0.02, 0.04, 0.06, 0.08, 0.10]
const percBoost_grid = [3.0, 5.0, 8.0, 10.0, 15.0]
const percExp_grid = [0.5, 0.8, 1.0, 1.2, 1.5]

const routingResults: RoutingScore[] = []
let evalP1 = 0

for (const c1 of c1_grid)
for (const c2 of c2_grid)
for (const pms of percMidSub_grid)
for (const pg of percGate_grid)
for (const pb of percBoost_grid)
for (const pe of percExp_grid) {
  let sumRaw = 0, aliveCount = 0, peakRaw = 0
  for (const f of frames) {
    const rawRight = Math.max(0, (f.treble * c1 + f.hMid * c2) - (f.mid * pms))
    let trImp = 0.0
    if (rawRight > pg) {
      const gated = (rawRight - pg) / (1.0 - pg)
      trImp = Math.pow(gated, pe) * pb
    }
    const out = Math.min(1.0, Math.max(0.0, trImp))
    sumRaw += out
    if (out > 0.15) aliveCount++  // signal > 0.15 threshold in envelope
    if (out > peakRaw) peakRaw = out
  }
  const avg = sumRaw / frames.length
  const alive = aliveCount / frames.length
  // Pre-score: we need high alive rate and moderate avg, with strong peaks
  if (alive > 0.15 && avg > 0.05 && peakRaw > 0.30) {
    routingResults.push({ c1, c2, pms, pg, pb, pe, avgRaw: avg, peakRaw: peakRaw, alive })
  }
  evalP1++
}

// Sort by a composite score: high alive + moderate avg + high peak
routingResults.sort((a, b) => {
  const scoreA = a.alive * 3 + Math.min(a.avgRaw, 0.5) * 2 + a.peakRaw
  const scoreB = b.alive * 3 + Math.min(b.avgRaw, 0.5) * 2 + b.peakRaw
  return scoreB - scoreA
})

console.log(`  Pass 1: ${evalP1} routing configs → ${routingResults.length} survivors`)

// Show top 5 routing
for (let i = 0; i < Math.min(5, routingResults.length); i++) {
  const r = routingResults[i]
  console.log(`    #${i+1}: treble×${r.c1}+hMid×${r.c2}-mid×${r.pms} | gate=${r.pg} boost=${r.pb} exp=${r.pe} | avg=${r.avgRaw.toFixed(3)} peak=${r.peakRaw.toFixed(2)} alive=${(r.alive*100).toFixed(0)}%`)
}

// Pass 2: Best routing × envelope grid
console.log('\n  Pass 2: Envelope optimization on top 50 routings...')

const topRoutings = routingResults.slice(0, 50)
const snareDecay_grid = [0.05, 0.10, 0.20, 0.35]
const snareBoost_grid = [2.0, 3.5, 5.0, 8.0]
const snareGateOn_grid = [0.02, 0.04, 0.06, 0.08]
const snareCrush_grid = [1.0, 1.5, 2.0]

interface BackRCandidate {
  penalty: number
  cfg: BackRConfig
  diag: BackRResult
}

const topBackR: BackRCandidate[] = []
let evalA = 0

for (const rt of topRoutings)
for (const sd of snareDecay_grid)
for (const sb of snareBoost_grid)
for (const sg of snareGateOn_grid)
for (const sc of snareCrush_grid) {
  const cfg: BackRConfig = {
    c1: rt.c1, c2: rt.c2, percMidSubtract: rt.pms,
    percGate: rt.pg, percBoost: rt.pb, percExponent: rt.pe,
    envSnare: {
      gateOn: sg, gateOff: sg * 0.5,
      boost: sb, crushExponent: sc,
      decayBase: sd, decayRange: 0.15,
      maxIntensity: 0.80,
      squelchBase: 0.02, squelchSlope: 0.10,
      ghostCap: 0.00, gateMargin: 0.01,
    },
  }
  const penalty = scoreBackR(cfg)

  if (topBackR.length < 10 || penalty < topBackR[topBackR.length - 1].penalty) {
    const diag = simulateBackR(cfg, 0.0)
    const cand: BackRCandidate = { penalty, cfg, diag }
    let ins = false
    for (let i = 0; i < topBackR.length; i++) {
      if (penalty < topBackR[i].penalty) { topBackR.splice(i, 0, cand); ins = true; break }
    }
    if (!ins) topBackR.push(cand)
    if (topBackR.length > 10) topBackR.pop()
  }
  evalA++
}

console.log(`  Pass 2: evaluated ${evalA} full configs`)
console.log('\nTop 5 Back R candidates:')
for (let i = 0; i < Math.min(5, topBackR.length); i++) {
  const t = topBackR[i]
  const c = t.cfg
  const d0 = simulateBackR(c, 0.0)
  const d5 = simulateBackR(c, 0.5)
  const d1 = simulateBackR(c, 1.0)
  console.log(`  #${i+1} pen=${t.penalty.toFixed(3)}`)
  console.log(`    ROUTING: treble×${c.c1}+hMid×${c.c2}-mid×${c.percMidSubtract}`)
  console.log(`    GATE: percGate=${c.percGate} boost=${c.percBoost} exp=${c.percExponent}`)
  console.log(`    ENV: gateOn=${c.envSnare.gateOn} boost=${c.envSnare.boost} crush=${c.envSnare.crushExponent} decay=${c.envSnare.decayBase}`)
  console.log(`    m=0.0: avg=${d0.avgBR.toFixed(3)} peak=${d0.peakBR.toFixed(2)} alive=${(d0.aliveBR*100).toFixed(0)}% peaks=${d0.peakCount}`)
  console.log(`    m=0.5: avg=${d5.avgBR.toFixed(3)} | m=1.0: avg=${d1.avgBR.toFixed(3)}`)
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. PHASE B: MOVER R — TWO-PASS GRID SEARCH
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n══════ PHASE B: MOVER R (AIR/VOCAL RESURRECTION) ══════')

// Pass 1: Pure routing — find how much signal we can extract
console.log('  Pass 1: Routing coefficients...')

interface VocalRoutingScore {
  c3: number; c4: number; c5: number; c6: number
  avgRaw: number; peakRaw: number; alive: number
}

const c3_grid = [0.3, 0.6, 1.0, 1.5, 2.0, 3.0, 5.0]
const c4_grid = [0.3, 0.5, 0.7, 1.0, 1.3, 1.5, 2.0]
const c5_grid = [0.0, 0.1, 0.2, 0.3, 0.4]
const c6_grid = [0.0, 0.02, 0.05, 0.10, 0.15]
let evalP1B = 0

const vocalRoutingResults: VocalRoutingScore[] = []

for (const c3 of c3_grid)
for (const c4 of c4_grid)
for (const c5 of c5_grid)
for (const c6 of c6_grid) {
  let sumRaw = 0, aliveCount = 0, peakRaw = 0
  for (const f of frames) {
    const raw = Math.max(0,
      (f.hMid * c3 + f.treble * c4) -
      (ESTIMATED_LOWMID * c5 + ESTIMATED_BASS * c6)
    )
    sumRaw += raw
    if (raw > 0.15) aliveCount++  // needs to pass signal > 0.15 in envelope
    if (raw > peakRaw) peakRaw = raw
  }
  const avg = sumRaw / frames.length
  const alive = aliveCount / frames.length
  if (alive > 0.10 && avg > 0.05) {
    vocalRoutingResults.push({ c3, c4, c5, c6, avgRaw: avg, peakRaw, alive })
  }
  evalP1B++
}

vocalRoutingResults.sort((a, b) => {
  // Prefer alive > 50% with avg in [0.2, 0.6] sweet spot
  const scoreA = a.alive * 3 + Math.min(a.avgRaw, 0.6) * 2
  const scoreB = b.alive * 3 + Math.min(b.avgRaw, 0.6) * 2
  return scoreB - scoreA
})

console.log(`  Pass 1B: ${evalP1B} routing configs → ${vocalRoutingResults.length} survivors`)
for (let i = 0; i < Math.min(5, vocalRoutingResults.length); i++) {
  const r = vocalRoutingResults[i]
  console.log(`    #${i+1}: hMid×${r.c3}+treble×${r.c4}-lowMid×${r.c5}-bass×${r.c6} | avg=${r.avgRaw.toFixed(3)} peak=${r.peakRaw.toFixed(2)} alive=${(r.alive*100).toFixed(0)}%`)
}

// Pass 2: Best routing × envelope + veto grid
console.log('\n  Pass 2: Envelope + veto optimization on top 50 routings...')

const topVocalRoutings = vocalRoutingResults.slice(0, 50)
const vetoFrames_grid = [0, 1, 2, 3, 5]
const vocalGateOn_grid = [0.01, 0.02, 0.03, 0.05]
const vocalBoost_grid = [1.5, 2.0, 3.0, 4.0, 5.0]
const vocalDecay_grid = [0.70, 0.78, 0.85, 0.90, 0.93]
const vocalCrush_grid = [1.0, 1.5]

interface MoverRCandidate {
  penalty: number
  cfg: MoverRConfig
  diag: MoverRResult
}

const topMoverR: MoverRCandidate[] = []
let evalB = 0

for (const rt of topVocalRoutings)
for (const vf of vetoFrames_grid)
for (const vg of vocalGateOn_grid)
for (const vb of vocalBoost_grid)
for (const vd of vocalDecay_grid)
for (const vc of vocalCrush_grid) {
  const cfg: MoverRConfig = {
    c3: rt.c3, c4: rt.c4, c5: rt.c5, c6: rt.c6, kickVetoFrames: vf,
    envVocal: {
      gateOn: vg, gateOff: vg * 0.5,
      boost: vb, crushExponent: vc,
      decayBase: vd, decayRange: 0.05,
      maxIntensity: 0.80,
      squelchBase: 0.02, squelchSlope: 0.10,
      ghostCap: 0.00, gateMargin: 0.01,
    },
  }
  const penalty = scoreMoverR(cfg)

  if (topMoverR.length < 10 || penalty < topMoverR[topMoverR.length - 1].penalty) {
    const diag = simulateMoverR(cfg, 0.0)
    const cand: MoverRCandidate = { penalty, cfg, diag }
    let ins = false
    for (let i = 0; i < topMoverR.length; i++) {
      if (penalty < topMoverR[i].penalty) { topMoverR.splice(i, 0, cand); ins = true; break }
    }
    if (!ins) topMoverR.push(cand)
    if (topMoverR.length > 10) topMoverR.pop()
  }
  evalB++
}

console.log(`  Pass 2: evaluated ${evalB} full configs`)
console.log('\nTop 5 Mover R candidates:')
for (let i = 0; i < Math.min(5, topMoverR.length); i++) {
  const t = topMoverR[i]
  const c = t.cfg
  const d0 = simulateMoverR(c, 0.0)
  const d5 = simulateMoverR(c, 0.5)
  const d1 = simulateMoverR(c, 1.0)
  console.log(`  #${i+1} pen=${t.penalty.toFixed(3)}`)
  console.log(`    ROUTING: hMid×${c.c3}+treble×${c.c4}-lowMid×${c.c5}-bass×${c.c6}`)
  console.log(`    VETO: kickVetoFrames=${c.kickVetoFrames}`)
  console.log(`    ENV: gateOn=${c.envVocal.gateOn} boost=${c.envVocal.boost} crush=${c.envVocal.crushExponent} decay=${c.envVocal.decayBase} maxI=${c.envVocal.maxIntensity}`)
  console.log(`    m=0.0: avg=${d0.avgMR.toFixed(3)} alive=${(d0.aliveMR*100).toFixed(0)}% vetoKill=${(d0.vetoKillRate*100).toFixed(0)}%`)
  console.log(`    m=0.5: avg=${d5.avgMR.toFixed(3)} | m=1.0: avg=${d1.avgMR.toFixed(3)}`)
}

// ═══════════════════════════════════════════════════════════════════════════
// 8. GOLDEN CONFIG
// ═══════════════════════════════════════════════════════════════════════════

if (topBackR.length > 0 && topMoverR.length > 0) {
  const wBR = topBackR[0]
  const wMR = topMoverR[0]
  console.log(`\n${'═'.repeat(70)}`)
  console.log('  GOLDEN CONFIG — APPLY TO CODE')
  console.log('═'.repeat(70))

  console.log('\n// === BACK R (Schwarzenegger) ===')
  console.log(`// Routing: rawRight = max(0, treble×${wBR.cfg.c1} + hMid×${wBR.cfg.c2} - mid×${wBR.cfg.percMidSubtract})`)
  console.log(`// percGate: ${wBR.cfg.percGate}  percBoost: ${wBR.cfg.percBoost}  percExponent: ${wBR.cfg.percExponent}`)
  console.log(`// envelopeSnare: gateOn=${wBR.cfg.envSnare.gateOn} boost=${wBR.cfg.envSnare.boost} decay=${wBR.cfg.envSnare.decayBase} maxI=${wBR.cfg.envSnare.maxIntensity}`)

  console.log('\n// === MOVER R (Vocal/Air) ===')
  console.log(`// Routing: vocalInput = max(0, hMid×${wMR.cfg.c3} + treble×${wMR.cfg.c4} - lowMid×${wMR.cfg.c5} - bass×${wMR.cfg.c6})`)
  console.log(`// kickVetoFrames: ${wMR.cfg.kickVetoFrames}`)
  console.log(`// envelopeVocal: gateOn=${wMR.cfg.envVocal.gateOn} boost=${wMR.cfg.envVocal.boost} decay=${wMR.cfg.envVocal.decayBase} maxI=${wMR.cfg.envVocal.maxIntensity}`)
}
