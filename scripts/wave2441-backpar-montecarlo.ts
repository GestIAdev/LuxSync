/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 2441 — MONTE CARLO: BACK PAR (SNARE / PERCUSSION SLAP) CALIBRATION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * DATOS: docs/logs/technolab.md — telemetría [LAB-DATA] real de sample
 *        estéril Techno 135 BPM.
 *
 * MOTOR A CALIBRAR:
 *   cleanTrb = max(0, trbD - MIN_TRB_DELTA)
 *   baseSnare = cleanTrb * MULT_BASE
 *   clapBonus = baseSnare * harsh * MULT_HARSH
 *   hybridSnare = baseSnare + clapBonus
 *   if (cent > CENTROID_THRESHOLD || isK === 0) → aplica
 *   if (hybridSnare > GATE_ON) → simOB = min(1.0, hybridSnare * BOOST)
 *
 * ESPACIO DE BÚSQUEDA (grid exhaustivo, determinista):
 *   CENTROID_THRESHOLD: [800 - 1500] step 100
 *   MIN_TRB_DELTA:     [0.010 - 0.050] step 0.005
 *   MULT_BASE:         [2.0 - 6.0] step 0.5
 *   MULT_HARSH:        [1.0 - 4.0] step 0.5
 *   GATE_ON:           [0.15 - 0.35] step 0.025
 *
 * FITNESS:
 *   -1000 si isK=1 y simOB > 0.1 (kick crosstalk — LETAL)
 *   +100  si isK=0 y trbD>0.15 y 0.8<=simOB<=1.0 (impacto claro → brillo)
 *   +50   si isK=0 y 0.05<trbD<0.15 y 0.2<=simOB<=0.6 (dinámica proporcional)
 *
 * SIN Math.random(). SIN simulación. Grid exhaustivo + telemetría real.
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

interface LabFrame {
  cent: number
  isK: number
  bass: number
  trbD: number
  harsh: number
  oB: number  // output real del engine para comparación
}

function parseLabData(filePath: string): LabFrame[] {
  const raw = readFileSync(filePath, 'utf-8')
  const frames: LabFrame[] = []
  const regex = /\[LAB-DATA\] cent:(\d+) \| isK:(\d) bass:([\d.]+) \| trbD:([\d.]+) harsh:([\d.]+) \| oF:[\d.]+ oB:([\d.]+)/g
  let m: RegExpExecArray | null
  while ((m = regex.exec(raw)) !== null) {
    frames.push({
      cent:  parseInt(m[1], 10),
      isK:   parseInt(m[2], 10),
      bass:  parseFloat(m[3]),
      trbD:  parseFloat(m[4]),
      harsh: parseFloat(m[5]),
      oB:    parseFloat(m[6]),
    })
  }
  return frames
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. ENGINE SIMULATION (deterministic, mirrors LiquidEngineBase.applyBands)
// ═══════════════════════════════════════════════════════════════════════════

interface Params {
  centroidThreshold: number
  minTrbDelta: number
  multBase: number
  multHarsh: number
  gateOn: number
  boost: number
}

function simulateFrame(f: LabFrame, p: Params): number {
  // IRON WALL: kick frame = back PAR ALWAYS off
  // The kick transient click produces trebleDelta — that's physics, not percussion.
  // The strict-split architecture dictates: kick → Front PAR, percussion → Back PAR.
  // No centroid check needed here — isK=1 means the detector already confirmed kick.
  if (f.isK === 1) {
    return 0
  }

  const cleanTrb = Math.max(0, f.trbD - p.minTrbDelta)
  const baseSnare = cleanTrb * p.multBase
  const clapBonus = baseSnare * f.harsh * p.multHarsh
  const hybridSnare = baseSnare + clapBonus

  if (hybridSnare > p.gateOn) {
    return Math.min(1.0, hybridSnare * p.boost)
  }
  return 0
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. FITNESS FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

interface FitnessResult {
  score: number
  kickLeaks: number
  strongHits: number
  dynamicHits: number
  silentOnSilence: number
  totalFrames: number
  avgStrongOB: number
  avgDynamicOB: number
}

function evaluateFitness(frames: LabFrame[], p: Params): FitnessResult {
  let score = 0
  let kickLeaks = 0
  let strongHits = 0
  let dynamicHits = 0
  let silentOnSilence = 0
  let strongOBsum = 0
  let dynamicOBsum = 0

  for (const f of frames) {
    const simOB = simulateFrame(f, p)

    // LETHAL: kick crosstalk — bombo NO debe encender Back PAR
    if (f.isK === 1 && simOB > 0.1) {
      score -= 1000
      kickLeaks++
    }

    // STRONG HIT: impacto claro de percusión aguda → brillo total
    if (f.isK === 0 && f.trbD > 0.15 && simOB >= 0.8 && simOB <= 1.0) {
      score += 100
      strongHits++
      strongOBsum += simOB
    }

    // DYNAMIC: micro-hats y ghost notes → respuesta proporcional
    if (f.isK === 0 && f.trbD > 0.05 && f.trbD <= 0.15 && simOB >= 0.2 && simOB <= 0.6) {
      score += 50
      dynamicHits++
      dynamicOBsum += simOB
    }

    // SILENCE: cuando no hay transient, el output debe ser 0
    if (f.trbD <= 0.01 && simOB === 0) {
      silentOnSilence++
    }
  }

  // TIEBREAKER: prefer configs where strong hits have range (not all 1.000)
  // and dynamic hits are centered around 0.4 (not all 0.2 or 0.6)
  if (strongHits > 0) {
    const avgStrong = strongOBsum / strongHits
    // Sweet spot: 0.85-0.95 (not all clipped to 1.0)
    if (avgStrong >= 0.85 && avgStrong <= 0.95) score += 10
  }
  if (dynamicHits > 0) {
    const avgDyn = dynamicOBsum / dynamicHits
    // Sweet spot: centered 0.3-0.5
    if (avgDyn >= 0.3 && avgDyn <= 0.5) score += 10
  }

  return {
    score, kickLeaks, strongHits, dynamicHits, silentOnSilence,
    totalFrames: frames.length,
    avgStrongOB: strongHits > 0 ? strongOBsum / strongHits : 0,
    avgDynamicOB: dynamicHits > 0 ? dynamicOBsum / dynamicHits : 0,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. GRID SEARCH — EXHAUSTIVO, DETERMINISTA
// ═══════════════════════════════════════════════════════════════════════════

function linspace(start: number, end: number, step: number): number[] {
  const arr: number[] = []
  for (let v = start; v <= end + step * 0.01; v += step) {
    arr.push(Math.round(v * 10000) / 10000)  // fix float precision
  }
  return arr
}

function runMonteCarlo(frames: LabFrame[]): void {
  const centroidRange   = linspace(800, 1500, 100)      // 8 values
  const minTrbRange     = linspace(0.010, 0.050, 0.005)  // 9 values
  const multBaseRange   = linspace(2.0, 8.0, 0.5)       // 13 values — expanded
  const multHarshRange  = linspace(1.0, 4.0, 0.5)       // 7 values
  const gateOnRange     = linspace(0.05, 0.35, 0.025)   // 13 values — expanded low
  const boostRange      = linspace(2.0, 5.0, 0.5)       // 7 values

  const totalCombinations =
    centroidRange.length *
    minTrbRange.length *
    multBaseRange.length *
    multHarshRange.length *
    gateOnRange.length *
    boostRange.length

  console.log(`═══════════════════════════════════════════════════════════`)
  console.log(`  WAVE 2441 — MONTE CARLO BACK PAR (SNARE/CLAP)`)
  console.log(`═══════════════════════════════════════════════════════════`)
  console.log(`  Frames parseados: ${frames.length}`)
  console.log(`  Kick frames:      ${frames.filter(f => f.isK === 1).length}`)
  console.log(`  Strong trbD>0.15: ${frames.filter(f => f.isK === 0 && f.trbD > 0.15).length}`)
  console.log(`  Dynamic range:    ${frames.filter(f => f.isK === 0 && f.trbD > 0.05 && f.trbD <= 0.15).length}`)
  console.log(`  Combinaciones:    ${totalCombinations.toLocaleString()}`)
  console.log(`═══════════════════════════════════════════════════════════`)

  let bestScore = -Infinity
  let bestParams: Params | null = null
  let bestResult: FitnessResult | null = null
  let evaluated = 0
  const startTime = Date.now()

  // TOP 10 leaderboard
  const top10: { params: Params; result: FitnessResult }[] = []

  for (const centroidThreshold of centroidRange) {
    for (const minTrbDelta of minTrbRange) {
      for (const multBase of multBaseRange) {
        for (const multHarsh of multHarshRange) {
          for (const gateOn of gateOnRange) {
            for (const boost of boostRange) {
              const params: Params = { centroidThreshold, minTrbDelta, multBase, multHarsh, gateOn, boost }
              const result = evaluateFitness(frames, params)
              evaluated++

              if (result.score > bestScore) {
                bestScore = result.score
                bestParams = { ...params }
                bestResult = { ...result }
              }

              // Track top 10
              if (top10.length < 10 || result.score > top10[top10.length - 1].result.score) {
                top10.push({ params: { ...params }, result: { ...result } })
                top10.sort((a, b) => b.result.score - a.result.score)
                if (top10.length > 10) top10.pop()
              }

              // Progress every 500k
              if (evaluated % 500_000 === 0) {
                const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
                const pct = ((evaluated / totalCombinations) * 100).toFixed(1)
                console.log(`  [${pct}%] ${evaluated.toLocaleString()} evaluados | best=${bestScore} | ${elapsed}s`)
              }
            }
          }
        }
      }
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(2)

  // ═══════════════════════════════════════════════════════════════════════
  // 5. RESULTS
  // ═══════════════════════════════════════════════════════════════════════

  console.log(`\n═══════════════════════════════════════════════════════════`)
  console.log(`  RESULTADO FINAL — ${evaluated.toLocaleString()} combinaciones en ${totalTime}s`)
  console.log(`═══════════════════════════════════════════════════════════`)

  if (bestParams && bestResult) {
    console.log(`\n  🏆 COEFICIENTES GANADORES:`)
    console.log(`  ─────────────────────────────────────────────────────`)
    console.log(`  CENTROID_THRESHOLD : ${bestParams.centroidThreshold}`)
    console.log(`  MIN_TRB_DELTA     : ${bestParams.minTrbDelta}`)
    console.log(`  MULT_BASE         : ${bestParams.multBase}`)
    console.log(`  MULT_HARSH        : ${bestParams.multHarsh}`)
    console.log(`  GATE_ON           : ${bestParams.gateOn}`)
    console.log(`  BOOST             : ${bestParams.boost}`)
    console.log(`  ─────────────────────────────────────────────────────`)
    console.log(`  FITNESS SCORE     : ${bestResult.score}`)
    console.log(`  Kick leaks        : ${bestResult.kickLeaks} (debe ser 0)`)
    console.log(`  Strong hits       : ${bestResult.strongHits} / ${frames.filter(f => f.isK === 0 && f.trbD > 0.15).length}`)
    console.log(`  Dynamic hits      : ${bestResult.dynamicHits} / ${frames.filter(f => f.isK === 0 && f.trbD > 0.05 && f.trbD <= 0.15).length}`)
    console.log(`  Silent on silence : ${bestResult.silentOnSilence} / ${frames.filter(f => f.trbD <= 0.01).length}`)
    console.log(`  Avg strong oB     : ${bestResult.avgStrongOB.toFixed(3)}`)
    console.log(`  Avg dynamic oB    : ${bestResult.avgDynamicOB.toFixed(3)}`)

    // ─── Frame-by-frame validation del ganador ───
    console.log(`\n  ═══ FRAME-BY-FRAME VALIDATION (solo frames con trbD > 0) ═══`)
    console.log(`  ${'#'.padStart(4)} | ${'isK'.padStart(3)} | ${'cent'.padStart(5)} | ${'trbD'.padStart(6)} | ${'harsh'.padStart(6)} | ${'realOB'.padStart(6)} | ${'simOB'.padStart(6)} | STATUS`)
    console.log(`  ${'─'.repeat(70)}`)

    let frameIdx = 0
    for (const f of frames) {
      frameIdx++
      if (f.trbD <= 0.0) continue
      const simOB = simulateFrame(f, bestParams)
      const realOB = f.oB
      let status = ''
      if (f.isK === 1 && simOB > 0.1) status = '💀 KICK LEAK'
      else if (f.isK === 0 && f.trbD > 0.15 && simOB >= 0.8) status = '✅ STRONG'
      else if (f.isK === 0 && f.trbD > 0.05 && f.trbD <= 0.15 && simOB >= 0.2 && simOB <= 0.6) status = '✅ DYNAMIC'
      else if (f.trbD > 0 && simOB === 0) status = '⬛ FILTERED'
      else status = `⚠️ sim=${simOB.toFixed(3)}`

      console.log(
        `  ${frameIdx.toString().padStart(4)} | ` +
        `${f.isK.toString().padStart(3)} | ` +
        `${f.cent.toString().padStart(5)} | ` +
        `${f.trbD.toFixed(3).padStart(6)} | ` +
        `${f.harsh.toFixed(3).padStart(6)} | ` +
        `${realOB.toFixed(3).padStart(6)} | ` +
        `${simOB.toFixed(3).padStart(6)} | ` +
        `${status}`
      )
    }

    // ─── TOP 10 ───
    console.log(`\n  ═══ TOP 10 CONFIGURACIONES ═══`)
    for (let i = 0; i < top10.length; i++) {
      const t = top10[i]
      console.log(
        `  #${(i + 1).toString().padStart(2)} | ` +
        `score=${t.result.score.toString().padStart(5)} | ` +
        `leaks=${t.result.kickLeaks} | ` +
        `strong=${t.result.strongHits} | ` +
        `dynamic=${t.result.dynamicHits} | ` +
        `cent=${t.params.centroidThreshold} minD=${t.params.minTrbDelta} mB=${t.params.multBase} mH=${t.params.multHarsh} gO=${t.params.gateOn} B=${t.params.boost}`
      )
    }
  }

  // ─── DATOS CRUDOS PARA TRANSFERIR A ENGINE ───
  if (bestParams) {
    console.log(`\n  ═══ COPY-PASTE PARA LiquidEngineBase.ts ═══`)
    console.log(`  const CENTROID_THRESHOLD = ${bestParams.centroidThreshold}`)
    console.log(`  const MIN_TREBLE_DELTA = ${bestParams.minTrbDelta}`)
    console.log(`  // baseSnare = cleanTrebleDelta * ${bestParams.multBase}`)
    console.log(`  // clapBonus = baseSnare * harshness * ${bestParams.multHarsh}`)
    console.log(``)
    console.log(`  ═══ COPY-PASTE PARA techno.ts envelopeSnare ═══`)
    console.log(`  gateOn: ${bestParams.gateOn},`)
    console.log(`  boost: ${bestParams.boost},`)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

const logPath = join(__dirname, '..', 'docs', 'logs', 'technolab.md')
const frames = parseLabData(logPath)

if (frames.length === 0) {
  console.error('ERROR: No se parsearon frames [LAB-DATA] del log')
  process.exit(1)
}

runMonteCarlo(frames)
