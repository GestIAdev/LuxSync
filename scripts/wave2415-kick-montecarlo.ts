/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 2415: MONTE CARLO KICK CALIBRATION — GARBAGE INFILTRATION EXTERMINATOR
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * PROBLEMA: Un solo bombo físico genera múltiples flags isKick=true espaciados
 * por 41ms, 47ms, 52ms (onda residual del subgrave rebotando en el detector).
 * Un bombo doble real en techno ocurre a ~140ms mínimo.
 *
 * DATOS: Extraídos 1:1 del log frontcalib.md — 100+ frames reales.
 *
 * OBJETIVO:
 *   1. MAXIMIZAR el output en kicks EDGE (intervalo >= threshold)
 *   2. MINIMIZAR cualquier output en resonancias intra-kick (<100ms)
 *   3. Decay ultrarrápido: un flash = UN frame brillante y caída inmediata
 *
 * BARRIDO: kickEdgeMinInterval × envelopeKick (7 params) × morphFactor
 * SIN Math.random(). Determinista. Grid exhaustivo.
 */

// ─────────────────────────────────────────────────────────────────────
// TELEMETRY DATA — Extraído del log real frontcalib.md
// Cada frame: [bass, subBass, isKick, edgeIntervalMs]
// ─────────────────────────────────────────────────────────────────────

const REAL_TELEMETRY: [number, number, boolean, number][] = [
  // KICK #92 cluster
  [0.804, 0.238, true,  41],
  [0.776, 0.265, true,  52],
  [0.848, 0.292, true,  141],
  [0.837, 0.345, true,  47],
  [0.787, 0.430, false, 47],
  [0.748, 0.411, false, 47],
  // Post-cluster decay
  [0.841, 0.273, true,  225],
  [0.831, 0.264, false, 225],
  // KICK #93
  [0.871, 0.256, true,  227],
  [0.861, 0.368, true,  41],
  [0.832, 0.452, true,  45],
  [0.805, 0.422, false, 45],
  // KICK #94 gap
  [0.824, 0.416, true,  439],
  [0.789, 0.438, false, 439],
  // KICK #95
  [0.806, 0.353, true,  458],
  [0.751, 0.339, false, 458],
  // KICK #96
  [0.788, 0.287, true,  256],
  [0.768, 0.283, false, 256],
  // KICK #97 cluster
  [0.855, 0.300, true,  172],
  [0.845, 0.318, true,  42],
  [0.813, 0.416, true,  47],
  [0.738, 0.397, false, 47],
  // KICK #98
  [0.798, 0.294, true,  409],
  [0.781, 0.348, true,  40],
  [0.721, 0.355, false, 40],
  // KICK #99
  [0.762, 0.221, true,  424],
  [0.719, 0.282, false, 424],
  [0.626, 0.327, false, 424],
  // KICK #100
  [0.819, 0.219, true,  466],
  [0.776, 0.293, true,  47],
  [0.709, 0.311, false, 47],
  [0.727, 0.207, true,  237],
  [0.678, 0.210, false, 237],
  // KICK #101
  [0.784, 0.203, true,  234],
  [0.747, 0.257, false, 234],
  // KICK #102
  [0.801, 0.185, true,  451],
  [0.769, 0.246, true,  42],
  [0.753, 0.268, false, 42],
  [0.696, 0.284, false, 42],
  // KICK #103
  [0.823, 0.209, true,  441],
  [0.763, 0.258, false, 441],
  [0.723, 0.154, true,  259],
  [0.708, 0.167, true,  41],
  // KICK #104 breakdown
  [0.729, 0.057, true,  648],
  [0.663, 0.069, true,  41],
  // KICK #105
  [0.759, 0.063, true,  394],
  [0.699, 0.080, true,  46],
  // KICK #106
  [0.727, 0.053, true,  237],
  [0.711, 0.064, false, 237],
  // KICK #107
  [0.803, 0.229, true,  753],
  [0.739, 0.224, false, 753],
  // KICK #108
  [0.785, 0.176, true,  235],
  [0.745, 0.179, false, 235],
  // KICK #109 cluster
  [0.835, 0.234, true,  186],
  [0.802, 0.310, true,  47],
  // KICK #110 drop
  [0.788, 0.306, true,  195],
  [0.750, 0.404, true,  39],
  [0.764, 0.222, true,  186],
  [0.746, 0.227, false, 186],
  [0.723, 0.232, false, 186],
  // KICK #111
  [0.804, 0.219, true,  227],
  [0.759, 0.314, false, 227],
  [0.737, 0.385, false, 227],
  // KICK #112
  [0.725, 0.213, true,  298],
  [0.675, 0.203, false, 298],
  // KICK #113
  [0.761, 0.244, true,  226],
  [0.719, 0.205, false, 226],
  [0.778, 0.163, true,  232],
  [0.760, 0.182, true,  42],
  // KICK #114
  [0.836, 0.319, true,  194],
  [0.753, 0.309, false, 194],
  // KICK #115
  [0.757, 0.240, true,  234],
  [0.734, 0.270, true,  47],
  [0.671, 0.241, false, 47],
  // KICK #116
  [0.859, 0.208, true,  140],
  [0.796, 0.279, true,  48],
  [0.726, 0.331, true,  45],
  // KICK #117
  [0.809, 0.216, true,  423],
  [0.758, 0.308, true,  42],
  // KICK #118
  [0.774, 0.178, true,  482],
  [0.712, 0.227, false, 482],
  // KICK #119 cluster
  [0.740, 0.239, true,  482],
  [0.694, 0.248, false, 482],
  [0.648, 0.255, false, 482],
  [0.707, 0.192, false, 482],
  [0.687, 0.199, false, 482],
  [0.778, 0.224, true,  485],
  [0.729, 0.212, false, 485],
  // KICK #120
  [0.753, 0.197, true,  463],
  [0.732, 0.249, false, 463],
  // KICK #121
  [0.783, 0.205, true,  487],
  [0.689, 0.226, false, 487],
  // KICK #122 cluster
  [0.782, 0.211, true,  470],
  [0.732, 0.286, true,  46],
  [0.774, 0.198, true,  188],
  [0.749, 0.221, true,  44],
  [0.832, 0.303, true,  191],
  [0.782, 0.397, true,  44],
  // KICK #123
  [0.867, 0.182, true,  376],
  [0.841, 0.203, true,  46],
  [0.802, 0.329, true,  46],
  [0.737, 0.318, false, 46],
  // KICK #124
  [0.848, 0.207, true,  409],
  [0.808, 0.267, true,  42],
  [0.744, 0.276, false, 42],
]

// ─────────────────────────────────────────────────────────────────────
// LIQUID ENVELOPE SIMULATOR — Réplica 1:1 de LiquidEnvelope.ts
// ─────────────────────────────────────────────────────────────────────

interface Config {
  gateOn: number; gateOff: number; boost: number; crushExponent: number
  decayBase: number; decayRange: number; maxIntensity: number
  squelchBase: number; squelchSlope: number; ghostCap: number; gateMargin: number
}

interface EnvState {
  intensity: number; avgSignal: number; avgSignalPeak: number
  lastFireTime: number; lastSignal: number; wasAttacking: boolean
}

function freshState(): EnvState {
  return { intensity: 0, avgSignal: 0, avgSignalPeak: 0, lastFireTime: 0, lastSignal: 0, wasAttacking: false }
}

function processEnvelope(c: Config, s: EnvState, signal: number, morphFactor: number, now: number): number {
  const velocity = signal - s.lastSignal
  s.lastSignal = signal
  const isRisingAttack = velocity >= -0.005
  const isGraceFrame = s.wasAttacking && velocity >= -0.03
  const isAttacking = isRisingAttack || isGraceFrame
  s.wasAttacking = isRisingAttack && velocity > 0.01

  if (signal > s.avgSignal) {
    s.avgSignal = s.avgSignal * 0.98 + signal * 0.02
  } else {
    s.avgSignal = s.avgSignal * 0.88 + signal * 0.12
  }

  const timeSinceLastFire = s.lastFireTime > 0 ? now - s.lastFireTime : 0
  const isDrySpell = timeSinceLastFire > 2000
  const peakDecay = isDrySpell ? 0.985 : 0.993
  if (s.avgSignal > s.avgSignalPeak) {
    s.avgSignalPeak = s.avgSignal
  } else {
    s.avgSignalPeak = s.avgSignalPeak * peakDecay + s.avgSignal * (1 - peakDecay)
  }

  const drySpellFloorDecay = timeSinceLastFire > 3000 ? Math.min(1.0, (timeSinceLastFire - 3000) / 3000) : 0
  const adaptiveFloor = c.gateOn - (0.12 * drySpellFloorDecay)
  const avgEffective = Math.max(s.avgSignal, s.avgSignalPeak * 0.55, adaptiveFloor)
  const dynamicGate = avgEffective + c.gateMargin

  const decay = c.decayBase + c.decayRange * 0 // morphFactor sera siempre param externo
  s.intensity *= decay

  let kickPower = 0

  if (signal > dynamicGate && isAttacking && signal > 0.15) {
    const requiredJump = 0.14
    let rawPower = (signal - dynamicGate) / requiredJump
    rawPower = Math.min(1.0, Math.max(0, rawPower))
    const crushExp = c.crushExponent + 0.3
    kickPower = Math.pow(rawPower, crushExp)
  }

  const squelch = Math.max(0.02, c.squelchBase)

  if (kickPower > squelch) {
    s.lastFireTime = now
    const hit = Math.min(c.maxIntensity, kickPower * 1.2 * c.boost)
    s.intensity = Math.max(s.intensity, hit)
  }

  const fadeZone = 0.08
  const fadeFactor = s.intensity >= fadeZone ? 1.0 : Math.pow(s.intensity / fadeZone, 2)
  return Math.min(c.maxIntensity, s.intensity * fadeFactor)
}

// ─────────────────────────────────────────────────────────────────────
// SCORING — Optimizado para el problema de Garbage Infiltration
// ─────────────────────────────────────────────────────────────────────

interface KickResult {
  edgeFlashes: number          // Cuántos edge kicks produjeron output >= 0.50
  totalEdges: number           // Total de kicks EDGE
  garbageFlashes: number       // Cuántos garbage frames produjeron output > 0.05
  totalGarbage: number         // Total de frames garbage
  avgEdgeOutput: number        // Promedio de output en edges
  avgGarbageOutput: number     // Promedio de output en garbage
  maxDecayFrames: number       // Frames que tarda en caer de 0.75 a 0.10 (flash speed)
  penalty: number
}

function evaluateConfig(
  config: Config,
  minInterval: number,
  data: typeof REAL_TELEMETRY
): KickResult {
  const state = freshState()
  const frameMs = 33
  let lastKickTime = 0
  let kickIntervalMs = 0

  let edgeOutputs: number[] = []
  let garbageOutputs: number[] = []
  let totalEdges = 0
  let totalGarbage = 0

  // Track decay speed: after a strong hit, how many frames to drop below 0.10?
  let decayTracking = false
  let decayFrameCount = 0
  let maxDecayFrames = 0

  for (let i = 0; i < data.length; i++) {
    const [bass, , isKick, edgeIntFromLog] = data[i]
    const now = 1000 + i * frameMs

    // Replicar la lógica del motor exactamente
    if (isKick && lastKickTime > 0) {
      kickIntervalMs = now - lastKickTime
    }
    if (isKick) lastKickTime = now

    const isKickEdge = isKick && kickIntervalMs > minInterval

    const kickSignal = isKickEdge ? bass : 0
    const out = processEnvelope(config, state, kickSignal, 0, now)

    // Clasificar
    if (isKick) {
      if (isKickEdge) {
        totalEdges++
        edgeOutputs.push(out)
      } else {
        totalGarbage++
        garbageOutputs.push(out)
      }
    } else if (out > 0.05) {
      // Frame no-kick con output residual = también basura
      garbageOutputs.push(out)
      totalGarbage++
    }

    // Decay tracking
    if (out >= 0.70 && !decayTracking) {
      decayTracking = true
      decayFrameCount = 0
    }
    if (decayTracking) {
      decayFrameCount++
      if (out < 0.10) {
        maxDecayFrames = Math.max(maxDecayFrames, decayFrameCount)
        decayTracking = false
      }
    }
  }

  const avgEdge = edgeOutputs.length > 0 ? edgeOutputs.reduce((a, b) => a + b, 0) / edgeOutputs.length : 0
  const avgGarbage = garbageOutputs.length > 0 ? garbageOutputs.reduce((a, b) => a + b, 0) / garbageOutputs.length : 0
  const edgeFlashes = edgeOutputs.filter(v => v >= 0.50).length
  const garbageFlashes = garbageOutputs.filter(v => v > 0.05).length

  // PENALTY FUNCTION — Los 6 mandamientos del Francotirador:
  
  // 1. Cada edge kick DEBE producir un flash (>= 0.50) → penaliza misses
  const missRatio = totalEdges > 0 ? 1 - (edgeFlashes / totalEdges) : 1
  const missPenalty = missRatio * 30

  // 2. La basura DEBE ser cero → cada garbage flash es una falta grave
  const garbageRatio = totalGarbage > 0 ? garbageFlashes / totalGarbage : 0
  const garbagePenalty = garbageRatio * 40

  // 3. El output medio de edges debe ser alto (idealmente >= 0.65)
  const edgePenalty = avgEdge < 0.65 ? (0.65 - avgEdge) * 20 : 0

  // 4. El decay debe ser RÁPIDO (idealmente <= 2 frames = ~66ms)
  const decayPenalty = maxDecayFrames > 2 ? (maxDecayFrames - 2) * 3 : 0

  // 5. BONUS: premiar configs con más edges detectados (robustez)
  //    6 edges mínimo es el piso del dataset actual, premiar si detecta más
  const edgeCountBonus = totalEdges > 6 ? -totalEdges * 0.1 : 0

  // 6. FLASH UNIFORMITY: penalizar si los edge outputs varían mucho
  //    Queremos que TODOS los kicks den el mismo flash brillante
  if (edgeOutputs.length > 1) {
    const edgeMin = Math.min(...edgeOutputs)
    const edgeMax = Math.max(...edgeOutputs)
    const uniformityPenalty = (edgeMax - edgeMin) * 5
    const penalty = missPenalty + garbagePenalty + edgePenalty + decayPenalty + edgeCountBonus + uniformityPenalty
    return {
      edgeFlashes,
      totalEdges,
      garbageFlashes,
      totalGarbage,
      avgEdgeOutput: avgEdge,
      avgGarbageOutput: avgGarbage,
      maxDecayFrames,
      penalty,
    }
  }

  const penalty = missPenalty + garbagePenalty + edgePenalty + decayPenalty + edgeCountBonus

  return {
    edgeFlashes,
    totalEdges,
    garbageFlashes,
    totalGarbage,
    avgEdgeOutput: avgEdge,
    avgGarbageOutput: avgGarbage,
    maxDecayFrames,
    penalty,
  }
}

// ─────────────────────────────────────────────────────────────────────
// GRID SWEEP — kickEdgeMinInterval × envelopeKick params
// ─────────────────────────────────────────────────────────────────────

console.log('═══════════════════════════════════════════════════════════════')
console.log(' WAVE 2415: MONTE CARLO KICK CALIBRATION')
console.log(' GARBAGE INFILTRATION EXTERMINATOR')
console.log('═══════════════════════════════════════════════════════════════')
console.log()

// Grid ranges — PHASE 2: fine-tuned around Monte Carlo Phase 1 convergence zone
// Phase 1 converged on: decay=0.04, crush=0.6, boost=2.5, maxI=0.75
// Phase 2: zoom into that neighborhood + explore adjacents
const intervals = [80, 100, 110, 120, 130, 140]
const boosts = [2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 6.0]
const decays = [0.02, 0.04, 0.06, 0.08, 0.10]
const crushs = [0.4, 0.6, 0.8, 1.0, 1.2, 1.5]
const maxIs = [0.70, 0.75, 0.80, 0.85, 0.90, 0.95, 1.00]
const gateOns = [0.10, 0.12, 0.15, 0.18, 0.20, 0.25]
const squelches = [0.02, 0.04, 0.06, 0.08]

interface Candidate {
  interval: number
  config: Config
  result: KickResult
}

let candidates: Candidate[] = []
let total = 0

for (const interval of intervals) {
  for (const boost of boosts) {
    for (const decay of decays) {
      for (const crush of crushs) {
        for (const maxI of maxIs) {
          for (const gateOn of gateOns) {
            for (const squelch of squelches) {
              total++
              const config: Config = {
                gateOn,
                gateOff: gateOn * 0.5,
                boost,
                crushExponent: crush,
                decayBase: decay,
                decayRange: 0,  // morphFactor = 0 para techno puro
                maxIntensity: maxI,
                squelchBase: squelch,
                squelchSlope: 0.10,
                ghostCap: 0.00,
                gateMargin: 0.01,
              }

              const result = evaluateConfig(config, interval, REAL_TELEMETRY)
              candidates.push({ interval, config, result })
            }
          }
        }
      }
    }
  }
}

// Sort by penalty (ascending)
candidates.sort((a, b) => a.result.penalty - b.result.penalty)

console.log(`Total configurations evaluated: ${total}`)
console.log()

// TOP 10
console.log('╔═══════════════════════════════════════════════════════════╗')
console.log('║  TOP 10 CONFIGURATIONS                                  ║')
console.log('╚═══════════════════════════════════════════════════════════╝')

for (let i = 0; i < Math.min(10, candidates.length); i++) {
  const c = candidates[i]
  console.log(`\n#${i + 1} — Penalty: ${c.result.penalty.toFixed(4)}`)
  console.log(`  kickEdgeMinInterval: ${c.interval}ms`)
  console.log(`  gateOn: ${c.config.gateOn}  boost: ${c.config.boost}  crush: ${c.config.crushExponent}`)
  console.log(`  decay: ${c.config.decayBase}  maxI: ${c.config.maxIntensity}  squelch: ${c.config.squelchBase}`)
  console.log(`  → EDGES: ${c.result.edgeFlashes}/${c.result.totalEdges} flashed (avg: ${c.result.avgEdgeOutput.toFixed(3)})`)
  console.log(`  → GARBAGE: ${c.result.garbageFlashes}/${c.result.totalGarbage} leaked (avg: ${c.result.avgGarbageOutput.toFixed(3)})`)
  console.log(`  → DECAY: ${c.result.maxDecayFrames} frames to silence`)
}

// WINNER
const winner = candidates[0]
console.log()
console.log('═══════════════════════════════════════════════════════════════')
console.log(' 🏆 GOLDEN COEFFICIENTS — WAVE 2415')
console.log('═══════════════════════════════════════════════════════════════')
console.log()
console.log(`kickEdgeMinInterval: ${winner.interval}`)
console.log()
console.log('envelopeKick: {')
console.log(`  name: 'Front R (Kick Sniper)',`)
console.log(`  gateOn: ${winner.config.gateOn},`)
console.log(`  gateOff: ${+(winner.config.gateOn * 0.5).toFixed(2)},`)
console.log(`  boost: ${winner.config.boost},`)
console.log(`  crushExponent: ${winner.config.crushExponent},`)
console.log(`  decayBase: ${winner.config.decayBase},`)
console.log(`  decayRange: 0.25,`)
console.log(`  maxIntensity: ${winner.config.maxIntensity},`)
console.log(`  squelchBase: ${winner.config.squelchBase},`)
console.log(`  squelchSlope: 0.10,`)
console.log(`  ghostCap: 0.00,`)
console.log(`  gateMargin: 0.01,`)
console.log('}')
console.log()
console.log(`Penalty: ${winner.result.penalty.toFixed(4)}`)
console.log(`Edges hit: ${winner.result.edgeFlashes}/${winner.result.totalEdges}`)
console.log(`Garbage leaked: ${winner.result.garbageFlashes}/${winner.result.totalGarbage}`)
console.log(`Decay frames: ${winner.result.maxDecayFrames}`)
