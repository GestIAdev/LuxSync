/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 2407: MONTE CARLO CALIBRATION — THE LIQUID SWEET SPOT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Simulación determinista de la pipeline LiquidEnvelope con datos reales
 * de telemetría de 3 géneros (Hard Techno, Melodic House, Melodic Techno).
 *
 * OBJETIVO:
 *   Front L (SubBass): Eliminar el efecto "esponja" — no quedarse pegado a 0.85
 *   Front R (Kick):    Confirmar que solo EDGE kicks producen output significativo
 *
 * SIN Math.random(). SIN mocks. SIN heurísticas.
 * Barrido de grid exhaustivo sobre los parámetros del envelope.
 */

// ─────────────────────────────────────────────────────────────────────
// TELEMETRY DATA — Extraído directamente de los 3 logs del workspace
// Cada frame: [subBass, bass, isKick, kickIntervalMs]
// ─────────────────────────────────────────────────────────────────────

// Hard Techno (Boris Brejcha) — frontcalib.md
const HARD_TECHNO: [number, number, boolean, number][] = [
  [0.16, 0.68, false, 0], [0.19, 0.71, false, 0], [0.22, 0.75, true, 416],
  [0.25, 0.80, true, 39], [0.28, 0.82, true, 39], [0.30, 0.80, false, 0],
  [0.27, 0.72, false, 0], [0.23, 0.65, false, 0], [0.18, 0.55, false, 0],
  [0.14, 0.44, false, 0], [0.11, 0.35, false, 0], [0.09, 0.28, false, 0],
  [0.10, 0.32, false, 0], [0.12, 0.40, false, 0], [0.15, 0.55, true, 480],
  [0.18, 0.72, true, 39], [0.21, 0.78, true, 40], [0.23, 0.80, false, 0],
  [0.20, 0.70, false, 0], [0.17, 0.58, false, 0], [0.13, 0.45, false, 0],
  [0.10, 0.34, false, 0], [0.09, 0.27, false, 0], [0.10, 0.30, true, 384],
  [0.14, 0.55, true, 42], [0.17, 0.68, true, 39], [0.20, 0.75, false, 0],
  [0.18, 0.65, false, 0], [0.14, 0.50, false, 0], [0.11, 0.38, false, 0],
  [0.09, 0.30, false, 0], [0.16, 0.62, true, 448], [0.20, 0.76, true, 40],
  [0.24, 0.81, true, 39], [0.26, 0.78, false, 0], [0.22, 0.68, false, 0],
  [0.18, 0.55, false, 0], [0.14, 0.42, false, 0], [0.11, 0.33, false, 0],
  [0.09, 0.26, false, 0], [0.12, 0.45, true, 416], [0.16, 0.65, true, 42],
  [0.19, 0.74, true, 39], [0.21, 0.77, false, 0], [0.18, 0.63, false, 0],
  [0.15, 0.50, false, 0], [0.12, 0.38, false, 0], [0.10, 0.30, false, 0],
]

// Melodic House (Rüfüs Du Sol / Inner Bloom) — innerbloomrufus.md
const MELODIC_HOUSE: [number, number, boolean, number][] = [
  [0.20, 0.60, false, 0], [0.24, 0.68, false, 0], [0.28, 0.75, true, 500],
  [0.32, 0.80, true, 42], [0.35, 0.82, true, 40], [0.37, 0.78, false, 0],
  [0.33, 0.70, false, 0], [0.28, 0.60, false, 0], [0.23, 0.50, false, 0],
  [0.18, 0.40, false, 0], [0.14, 0.32, false, 0], [0.11, 0.26, false, 0],
  [0.13, 0.30, false, 0], [0.16, 0.42, false, 0], [0.20, 0.58, true, 480],
  [0.25, 0.72, true, 39], [0.30, 0.78, true, 42], [0.33, 0.80, false, 0],
  [0.29, 0.68, false, 0], [0.24, 0.55, false, 0], [0.19, 0.42, false, 0],
  [0.15, 0.34, false, 0], [0.12, 0.27, false, 0], [0.10, 0.22, false, 0],
  [0.14, 0.38, true, 520], [0.19, 0.60, true, 42], [0.24, 0.72, true, 39],
  [0.28, 0.76, false, 0], [0.24, 0.64, false, 0], [0.20, 0.50, false, 0],
  [0.16, 0.40, false, 0], [0.12, 0.30, false, 0], [0.22, 0.65, true, 440],
  [0.27, 0.76, true, 40], [0.32, 0.80, true, 42], [0.35, 0.77, false, 0],
  [0.30, 0.66, false, 0], [0.25, 0.54, false, 0], [0.20, 0.42, false, 0],
  [0.16, 0.33, false, 0], [0.12, 0.25, false, 0], [0.15, 0.45, true, 460],
  [0.20, 0.64, true, 39], [0.26, 0.75, true, 42], [0.30, 0.78, false, 0],
  [0.25, 0.65, false, 0], [0.20, 0.52, false, 0], [0.16, 0.40, false, 0],
]

// Melodic Techno (Anyma / Animalog) — animalog.md
const MELODIC_TECHNO: [number, number, boolean, number][] = [
  [0.30, 0.76, false, 0], [0.36, 0.82, false, 0], [0.42, 0.88, true, 480],
  [0.46, 0.90, true, 42], [0.50, 0.90, true, 40], [0.51, 0.86, false, 0],
  [0.46, 0.78, false, 0], [0.40, 0.68, false, 0], [0.34, 0.56, false, 0],
  [0.28, 0.46, false, 0], [0.22, 0.38, false, 0], [0.18, 0.30, false, 0],
  [0.20, 0.35, false, 0], [0.25, 0.48, false, 0], [0.32, 0.66, true, 500],
  [0.38, 0.80, true, 40], [0.44, 0.86, true, 42], [0.48, 0.88, false, 0],
  [0.42, 0.76, false, 0], [0.36, 0.62, false, 0], [0.30, 0.50, false, 0],
  [0.24, 0.40, false, 0], [0.20, 0.33, false, 0], [0.18, 0.28, false, 0],
  [0.24, 0.50, true, 460], [0.32, 0.72, true, 42], [0.39, 0.82, true, 40],
  [0.44, 0.85, false, 0], [0.38, 0.74, false, 0], [0.32, 0.60, false, 0],
  [0.26, 0.48, false, 0], [0.21, 0.37, false, 0], [0.35, 0.75, true, 480],
  [0.42, 0.84, true, 40], [0.48, 0.88, true, 42], [0.50, 0.85, false, 0],
  [0.44, 0.74, false, 0], [0.37, 0.60, false, 0], [0.30, 0.48, false, 0],
  [0.24, 0.38, false, 0], [0.20, 0.30, false, 0], [0.28, 0.58, true, 440],
  [0.35, 0.76, true, 42], [0.42, 0.84, true, 40], [0.46, 0.86, false, 0],
  [0.40, 0.72, false, 0], [0.33, 0.58, false, 0], [0.26, 0.45, false, 0],
]

// ─────────────────────────────────────────────────────────────────────
// LIQUID ENVELOPE SIMULATOR — Réplica exacta de LiquidEnvelope.ts
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

function processEnvelope(c: Config, s: EnvState, signal: number, morphFactor: number, now: number, isBreakdown: boolean): number {
  // 1. VELOCITY GATE
  const velocity = signal - s.lastSignal
  s.lastSignal = signal
  const isRisingAttack = velocity >= -0.005
  const isGraceFrame = s.wasAttacking && velocity >= -0.03
  const isAttacking = isRisingAttack || isGraceFrame
  s.wasAttacking = isRisingAttack && velocity > 0.01

  // 2. ASYMMETRIC EMA
  if (signal > s.avgSignal) {
    s.avgSignal = s.avgSignal * 0.98 + signal * 0.02
  } else {
    s.avgSignal = s.avgSignal * 0.88 + signal * 0.12
  }

  // 3. PEAK MEMORY + TIDAL GATE
  const timeSinceLastFire = s.lastFireTime > 0 ? now - s.lastFireTime : 0
  const isDrySpell = timeSinceLastFire > 2000
  const peakDecay = isDrySpell ? 0.985 : 0.993
  if (s.avgSignal > s.avgSignalPeak) {
    s.avgSignalPeak = s.avgSignal
  } else {
    s.avgSignalPeak = s.avgSignalPeak * peakDecay + s.avgSignal * (1 - peakDecay)
  }

  // 4. ADAPTIVE FLOOR
  const drySpellFloorDecay = timeSinceLastFire > 3000 ? Math.min(1.0, (timeSinceLastFire - 3000) / 3000) : 0
  const adaptiveFloor = c.gateOn - (0.12 * drySpellFloorDecay)
  const avgEffective = Math.max(s.avgSignal, s.avgSignalPeak * 0.55, adaptiveFloor)

  // 5. DYNAMIC GATE
  const dynamicGate = avgEffective + c.gateMargin

  // 6. DECAY
  const decay = c.decayBase + c.decayRange * morphFactor
  s.intensity *= decay

  // 7. MAIN GATE
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

  // 8. IGNITION SQUELCH
  const squelch = Math.max(0.02, c.squelchBase - c.squelchSlope * morphFactor)

  if (kickPower > squelch) {
    s.lastFireTime = now
    const hit = Math.min(c.maxIntensity, kickPower * (1.2 + 0.8 * morphFactor) * c.boost)
    s.intensity = Math.max(s.intensity, hit)
  } else if (ghostPower > 0) {
    s.intensity = Math.max(s.intensity, ghostPower)
  }

  // 9. SMOOTH FADE
  const fadeZone = 0.08
  const fadeFactor = s.intensity >= fadeZone ? 1.0 : Math.pow(s.intensity / fadeZone, 2)
  return Math.min(c.maxIntensity, s.intensity * fadeFactor)
}

// ─────────────────────────────────────────────────────────────────────
// SCORING FUNCTIONS
// ─────────────────────────────────────────────────────────────────────

interface SubBassScore {
  /** Ratio de frames en que output >= maxIntensity - 0.01 (saturación) */
  saturationRatio: number
  /** Duración máxima consecutiva de frames saturados */
  maxConsecutiveSaturated: number
  /** Peak output alcanzado */
  peakOutput: number
  /** Output promedio durante frames activos */
  avgActiveOutput: number
  /** Ratio de frames en silencio (output < 0.02) cuando subBass < gateOn */
  silenceAccuracy: number
  /** Score compuesto (menor = mejor) */
  penalty: number
}

function scoreSubBass(config: Config, data: [number, number, boolean, number][], morphFactor: number): SubBassScore {
  const state = freshState()
  const outputs: number[] = []
  let saturatedCount = 0
  let maxConsec = 0
  let curConsec = 0
  let activeSum = 0
  let activeCount = 0
  let silenceCorrect = 0
  let silenceTotal = 0
  const frameMs = 33 // ~30fps

  for (let i = 0; i < data.length; i++) {
    const [subBass] = data[i]
    const now = 1000 + i * frameMs
    const out = processEnvelope(config, state, subBass, morphFactor, now, false)
    outputs.push(out)

    const isSaturated = out >= config.maxIntensity - 0.01
    if (isSaturated) {
      saturatedCount++
      curConsec++
      maxConsec = Math.max(maxConsec, curConsec)
    } else {
      curConsec = 0
    }

    if (out > 0.02) {
      activeSum += out
      activeCount++
    }

    if (subBass < config.gateOn) {
      silenceTotal++
      if (out < 0.05) silenceCorrect++
    }
  }

  const saturationRatio = saturatedCount / data.length
  const avgActiveOutput = activeCount > 0 ? activeSum / activeCount : 0
  const silenceAccuracy = silenceTotal > 0 ? silenceCorrect / silenceTotal : 1.0
  const peakOutput = Math.max(...outputs)

  // PENALTY: penalizar saturación excesiva, premiar dinamismo
  // Saturación > 8% es "esponja", consecutivos > 2 es pegajoso
  const satPenalty = Math.max(0, saturationRatio - 0.08) * 20
  const consecPenalty = Math.max(0, maxConsec - 2) * 4
  // Premiar output activo alto (queremos que DISPARE cuando debe)
  const activeReward = avgActiveOutput > 0.25 ? 0 : (0.25 - avgActiveOutput) * 5
  // Premiar silencio correcto
  const silencePenalty = (1 - silenceAccuracy) * 3
  // Queremos rango dinámico: peakOutput alto pero sin saturación
  const dynamicReward = peakOutput > 0.50 ? 0 : (0.50 - peakOutput) * 3

  const penalty = satPenalty + consecPenalty + activeReward + silencePenalty + dynamicReward

  return { saturationRatio, maxConsecutiveSaturated: maxConsec, peakOutput, avgActiveOutput, silenceAccuracy, penalty }
}

interface KickScore {
  /** Output en frames de kick EDGE (interval > 150ms) */
  edgeOutputs: number[]
  /** Output en frames de kick non-EDGE (interval <= 150ms, basura) */
  garbageOutputs: number[]
  /** Promedio de output en EDGE kicks */
  avgEdgeOutput: number
  /** Promedio de output en garbage kicks */
  avgGarbageOutput: number
  /** Ratio de aislamiento (edge/garbage) — mayor = mejor */
  isolationRatio: number
  /** Score compuesto (menor = mejor) */
  penalty: number
}

function scoreKick(config: Config, data: [number, number, boolean, number][], morphFactor: number): KickScore {
  const state = freshState()
  const edgeOutputs: number[] = []
  const garbageOutputs: number[] = []
  const frameMs = 33
  let lastKickTime = 0
  let kickIntervalMs = 0

  for (let i = 0; i < data.length; i++) {
    const [, bass, isKick, intervalFromLog] = data[i]
    const now = 1000 + i * frameMs

    if (isKick && lastKickTime > 0) {
      kickIntervalMs = now - lastKickTime
    }
    if (isKick) lastKickTime = now
    const isKickEdge = isKick && kickIntervalMs > 150

    // Front R routing: solo inyecta bass en kick edges
    const kickSignal = isKickEdge ? bass : 0
    const out = processEnvelope(config, state, kickSignal, morphFactor, now, false)

    if (isKick) {
      if (isKickEdge) {
        edgeOutputs.push(out)
      } else {
        garbageOutputs.push(out)
      }
    }
  }

  const avgEdgeOutput = edgeOutputs.length > 0 ? edgeOutputs.reduce((a, b) => a + b, 0) / edgeOutputs.length : 0
  const avgGarbageOutput = garbageOutputs.length > 0 ? garbageOutputs.reduce((a, b) => a + b, 0) / garbageOutputs.length : 0
  const isolationRatio = avgGarbageOutput > 0.001 ? avgEdgeOutput / avgGarbageOutput : avgEdgeOutput > 0 ? 999 : 0

  // PENALTY: queremos edges fuertes y basura extinta
  const edgePenalty = avgEdgeOutput < 0.60 ? (0.60 - avgEdgeOutput) * 10 : 0
  const garbagePenalty = avgGarbageOutput * 20 // cualquier basura es penalización fuerte
  const isolationPenalty = isolationRatio < 10 ? (10 - isolationRatio) * 0.5 : 0

  const penalty = edgePenalty + garbagePenalty + isolationPenalty

  return { edgeOutputs, garbageOutputs, avgEdgeOutput, avgGarbageOutput, isolationRatio, penalty }
}

// ─────────────────────────────────────────────────────────────────────
// MONTE CARLO GRID SWEEP — SubBass
// ─────────────────────────────────────────────────────────────────────

console.log('═══════════════════════════════════════════════════════════════')
console.log(' WAVE 2407: MONTE CARLO CALIBRATION — THE LIQUID SWEET SPOT')
console.log('═══════════════════════════════════════════════════════════════')
console.log()

// SUBBASS parameter grid — Phase 3: ULTRA-AGRESIVO anti-esponja
// El problema clave: decay alto + señal continua = saturación eterna
// Necesitamos crush alto (mata señales débiles) + decay rápido (suelta rápido)
const crushExponents = [1.8, 2.0, 2.2, 2.4, 2.6, 2.8, 3.0]
const decayBases = [0.40, 0.42, 0.45, 0.48, 0.50, 0.52, 0.55]
const maxIntensities = [0.68, 0.72, 0.75, 0.78]
const boosts = [3.0, 3.5, 4.0, 4.5, 5.0]
const gateOns = [0.08, 0.10, 0.12]

const datasets: { name: string; data: typeof HARD_TECHNO; morph: number }[] = [
  { name: 'Hard Techno', data: HARD_TECHNO, morph: 0.15 },
  { name: 'Melodic House', data: MELODIC_HOUSE, morph: 0.60 },
  { name: 'Melodic Techno', data: MELODIC_TECHNO, morph: 0.45 },
]

interface SubBassCandidate {
  config: Config
  totalPenalty: number
  scores: { genre: string; score: SubBassScore }[]
}

console.log('╔═══════════════════════════════════════════════════════════╗')
console.log('║  PHASE 1: SUBBASS GRID SWEEP                            ║')
console.log('╚═══════════════════════════════════════════════════════════╝')

let subBassCandidates: SubBassCandidate[] = []
let totalConfigs = 0

for (const crush of crushExponents) {
  for (const decay of decayBases) {
    for (const maxI of maxIntensities) {
      for (const boost of boosts) {
        for (const gateOn of gateOns) {
          totalConfigs++
          const config: Config = {
            gateOn, gateOff: gateOn * 0.5, boost, crushExponent: crush,
            decayBase: decay, decayRange: 0.15, maxIntensity: maxI,
            squelchBase: 0.04, squelchSlope: 0.55, ghostCap: 0.06, gateMargin: 0.01,
          }

          let totalPenalty = 0
          const scores: { genre: string; score: SubBassScore }[] = []
          for (const ds of datasets) {
            const score = scoreSubBass(config, ds.data, ds.morph)
            totalPenalty += score.penalty
            scores.push({ genre: ds.name, score })
          }

          subBassCandidates.push({ config, totalPenalty, scores })
        }
      }
    }
  }
}

console.log(`Evaluated ${totalConfigs} SubBass configurations across 3 genres`)
subBassCandidates.sort((a, b) => a.totalPenalty - b.totalPenalty)

console.log()
console.log('── TOP 5 SUBBASS CONFIGURATIONS ──')
for (let i = 0; i < Math.min(5, subBassCandidates.length); i++) {
  const c = subBassCandidates[i]
  console.log(`\n#${i + 1} — Total Penalty: ${c.totalPenalty.toFixed(4)}`)
  console.log(`  crushExponent: ${c.config.crushExponent}`)
  console.log(`  decayBase: ${c.config.decayBase}`)
  console.log(`  maxIntensity: ${c.config.maxIntensity}`)
  console.log(`  boost: ${c.config.boost}`)
  console.log(`  gateOn: ${c.config.gateOn}`)
  for (const s of c.scores) {
    console.log(`  [${s.genre}] sat: ${(s.score.saturationRatio * 100).toFixed(1)}%, maxConsec: ${s.score.maxConsecutiveSaturated}, peak: ${s.score.peakOutput.toFixed(3)}, avgActive: ${s.score.avgActiveOutput.toFixed(3)}, silence: ${(s.score.silenceAccuracy * 100).toFixed(1)}%`)
  }
}

const bestSubBass = subBassCandidates[0]

// ─────────────────────────────────────────────────────────────────────
// MONTE CARLO GRID SWEEP — Kick
// ─────────────────────────────────────────────────────────────────────

console.log()
console.log('╔═══════════════════════════════════════════════════════════╗')
console.log('║  PHASE 2: KICK GRID SWEEP                               ║')
console.log('╚═══════════════════════════════════════════════════════════╝')

const kickBoosts = [2.0, 2.3, 2.5, 2.8, 3.0]
const kickDecays = [0.12, 0.15, 0.18, 0.20, 0.22]
const kickCrushs = [0.7, 0.8, 0.9, 1.0, 1.1]
const kickMaxIs = [0.75, 0.80, 0.85, 0.90]

interface KickCandidate {
  config: Config
  totalPenalty: number
  scores: { genre: string; score: KickScore }[]
}

let kickCandidates: KickCandidate[] = []
let kickConfigs = 0

for (const boost of kickBoosts) {
  for (const decay of kickDecays) {
    for (const crush of kickCrushs) {
      for (const maxI of kickMaxIs) {
        kickConfigs++
        const config: Config = {
          gateOn: 0.15, gateOff: 0.08, boost, crushExponent: crush,
          decayBase: decay, decayRange: 0.25, maxIntensity: maxI,
          squelchBase: 0.02, squelchSlope: 0.10, ghostCap: 0.00, gateMargin: 0.01,
        }

        let totalPenalty = 0
        const scores: { genre: string; score: KickScore }[] = []
        for (const ds of datasets) {
          const score = scoreKick(config, ds.data, ds.morph)
          totalPenalty += score.penalty
          scores.push({ genre: ds.name, score })
        }

        kickCandidates.push({ config, totalPenalty, scores })
      }
    }
  }
}

console.log(`Evaluated ${kickConfigs} Kick configurations across 3 genres`)
kickCandidates.sort((a, b) => a.totalPenalty - b.totalPenalty)

console.log()
console.log('── TOP 5 KICK CONFIGURATIONS ──')
for (let i = 0; i < Math.min(5, kickCandidates.length); i++) {
  const c = kickCandidates[i]
  console.log(`\n#${i + 1} — Total Penalty: ${c.totalPenalty.toFixed(4)}`)
  console.log(`  crushExponent: ${c.config.crushExponent}`)
  console.log(`  decayBase: ${c.config.decayBase}`)
  console.log(`  maxIntensity: ${c.config.maxIntensity}`)
  console.log(`  boost: ${c.config.boost}`)
  for (const s of c.scores) {
    console.log(`  [${s.genre}] edgeAvg: ${s.score.avgEdgeOutput.toFixed(3)}, garbageAvg: ${s.score.avgGarbageOutput.toFixed(3)}, isolation: ${s.score.isolationRatio.toFixed(1)}x`)
  }
}

const bestKick = kickCandidates[0]

// ─────────────────────────────────────────────────────────────────────
// FINAL RESULTS
// ─────────────────────────────────────────────────────────────────────
console.log()
console.log('═══════════════════════════════════════════════════════════════')
console.log(' GOLDEN COEFFICIENTS — WAVE 2407 CALIBRATION RESULT')
console.log('═══════════════════════════════════════════════════════════════')
console.log()
console.log('SUBBASS_CONFIG (Front L — El Océano):')
console.log(JSON.stringify({
  name: 'Front L (SubBass Groove)',
  gateOn: bestSubBass.config.gateOn,
  gateOff: +(bestSubBass.config.gateOn * 0.5).toFixed(2),
  boost: bestSubBass.config.boost,
  crushExponent: bestSubBass.config.crushExponent,
  decayBase: bestSubBass.config.decayBase,
  decayRange: 0.15,
  maxIntensity: bestSubBass.config.maxIntensity,
  squelchBase: 0.04,
  squelchSlope: 0.55,
  ghostCap: 0.06,
  gateMargin: 0.01,
}, null, 2))
console.log()
console.log('KICK_CONFIG (Front R — El Francotirador):')
console.log(JSON.stringify({
  name: 'Front R (Kick Sniper)',
  gateOn: bestKick.config.gateOn,
  gateOff: 0.08,
  boost: bestKick.config.boost,
  crushExponent: bestKick.config.crushExponent,
  decayBase: bestKick.config.decayBase,
  decayRange: 0.25,
  maxIntensity: bestKick.config.maxIntensity,
  squelchBase: 0.02,
  squelchSlope: 0.10,
  ghostCap: 0.00,
  gateMargin: 0.01,
}, null, 2))
