/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 2434: LATINO 4.1 MONTE CARLO — DEMBOW & CLAVE CALIBRATION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Calibra LATINO_PROFILE corriendo sobre LiquidEngine41 (modo 4.1).
 * Input: archivo de log generado por LiquidEngine41Telemetry.ts
 *        (formato [LATINO-41] ...) guardado en docs/logs/latinocalib41.md
 *
 * CUATRO ZONAS DE EXPLORACIÓN (patrón 3-3-2 / Dembow / Clave de Salsa):
 *
 *   A) Front PAR (SubBass):
 *      - gateOn    ∈ [0.15, 0.28]  step 0.01  → 14 valores
 *      - decayBase ∈ [0.30, 0.45]  step 0.025 → 7 valores
 *      Total: 98 combinaciones
 *
 *   B) Back PAR (Transient Shaper — percGate):
 *      - percGate  ∈ [0.005, 0.020] step 0.001 → 16 valores
 *      Total: 16 combinaciones
 *
 *   C) Mover L — El Galán (moverLTonalThreshold):
 *      - threshold ∈ [0.45, 0.65]  step 0.025 → 9 valores
 *      Total: 9 combinaciones
 *
 *   D) Mover R — La Dama (vocal gateOn):
 *      - gateOn    ∈ [0.25, 0.40]  step 0.025 → 7 valores
 *      Total: 7 combinaciones
 *
 * SCORING por zona:
 *   A) Front PAR:
 *      - pulseScore:  avg frontPar ∈ [0.35, 0.60] (bombo gordo, no muro)
 *      - peakScore:   frames con frontPar > 0.60 ∈ [15%, 35%] del total
 *      - leakPenalty: frames donde subBass < gateOn pero frontPar > 0.10
 *                     (bajo melódico continuo encendiendo el PAR = MALO)
 *
 *   B) Back PAR (percGate):
 *      - hitScore:   frames con backPar > 0.20 SOLO cuando percRaw > 0.35
 *                    (TAcka real detectado)
 *      - falseAlarm: frames con backPar > 0.10 cuando percRaw < 0.15
 *                    (ruido de fondo disparando latigazos = MALO)
 *
 *   C) Mover L (tonalThreshold):
 *      - presenceScore: avg moverL ∈ [0.20, 0.50] (presente pero no dominante)
 *      - tonalidadOk:   % frames donde isTonal=1 ∈ [40%, 80%] del total
 *                       (música latina ES armónica — si es <40% el gate es demasiado estricto)
 *
 *   D) Mover R (vocal gateOn):
 *      - expressScore: frames con moverR > 0.25 SOLO cuando treble > gateOn × 0.85
 *                      (La Dama canta con fuerza real)
 *      - silencePen:   frames con moverR > 0.15 cuando treble < 0.18
 *                      (parpadeo con susurros = MALO)
 *
 * EJECUCIÓN:
 *   npx tsx scripts/wave2434-latino-montecarlo.ts
 *   (requiere docs/logs/latinocalib41.md con al menos 200 frames)
 *
 * SIN Math.random(). Grid exhaustivo determinista.
 *
 * @version WAVE 2434 — LATINO CALIBRATION
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ═══════════════════════════════════════════════════════════════════════════
// 1. PARSE TELEMETRY LOG
// ═══════════════════════════════════════════════════════════════════════════

interface Latino41Frame {
  subBass:       number
  mid:           number
  highMid:       number
  treble:        number
  morphFactor:   number
  trebleDelta:   number   // tDelta del log
  percRaw:       number   // percRaw = trebleDelta × 4
  frontPar:      number
  backPar:       number
  moverL:        number
  moverR:        number
  sidechainFired: boolean
}

function parseLog(filePath: string): Latino41Frame[] {
  const raw = readFileSync(filePath, 'utf-8')
  const frames: Latino41Frame[] = []
  // Formato: [LATINO-41] sB:0.234 mid:0.412 hMid:0.180 tr:0.091 | morph:0.278 tDelta:0.0120 percRaw:0.048 | fPar:0.612 bPar:0.234 mL:0.091 mR:0.178 | sc:0 scDuck:1.000
  const regex = /\[LATINO-41\] sB:([\d.]+) mid:([\d.]+) hMid:([\d.]+) tr:([\d.]+) \| morph:([\d.]+) tDelta:([\d.]+) percRaw:([\d.]+) \| fPar:([\d.]+) bPar:([\d.]+) mL:([\d.]+) mR:([\d.]+) \| sc:(\d) scDuck:([\d.]+)/g
  let m: RegExpExecArray | null
  while ((m = regex.exec(raw)) !== null) {
    frames.push({
      subBass:        parseFloat(m[1]),
      mid:            parseFloat(m[2]),
      highMid:        parseFloat(m[3]),
      treble:         parseFloat(m[4]),
      morphFactor:    parseFloat(m[5]),
      trebleDelta:    parseFloat(m[6]),
      percRaw:        parseFloat(m[7]),
      frontPar:       parseFloat(m[8]),
      backPar:        parseFloat(m[9]),
      moverL:         parseFloat(m[10]),
      moverR:         parseFloat(m[11]),
      sidechainFired: parseInt(m[12], 10) === 1,
    })
  }
  return frames
}

const LOG_PATH = join(__dirname, '..', 'docs', 'logs', 'latinocalib41.md')
let frames: Latino41Frame[]

try {
  frames = parseLog(LOG_PATH)
  console.log(`✓ Parsed ${frames.length} [LATINO-41] frames from latinocalib41.md`)
} catch {
  console.error(`✗ No se encontró docs/logs/latinocalib41.md`)
  console.error(`  Activa LiquidEngine41Telemetry.setTelemetryEnabled(true) y captura un log primero.`)
  console.error(`  Redirige la salida: electron-app > docs/logs/latinocalib41.md`)
  process.exit(1)
}

if (frames.length < 200) {
  console.error(`✗ Solo ${frames.length} frames — necesito al menos 200 para el Monte Carlo.`)
  console.error(`  Captura ~30 segundos de música latina a 20fps.`)
  process.exit(1)
}

// ─────────────────────────────────────────────────────────────────────
// Stats previas de los datos reales (orientan el scoring)
// ─────────────────────────────────────────────────────────────────────
const n = frames.length
const statsFields = ['subBass', 'mid', 'highMid', 'treble', 'morphFactor', 'percRaw'] as const
console.log(`\n── STATS DE INPUTS REALES (${n} frames) ──`)
for (const key of statsFields) {
  let min = Infinity, max = -Infinity, sum = 0
  for (const f of frames) { const v = f[key]; if (v < min) min = v; if (v > max) max = v; sum += v }
  console.log(`  ${key.padEnd(12)}: min=${min.toFixed(3)}  max=${max.toFixed(3)}  avg=${(sum/n).toFixed(3)}`)
}
const sidechainPct = frames.filter(f => f.sidechainFired).length / n * 100
console.log(`  sidechainFired : ${sidechainPct.toFixed(1)}% de frames`)

// ═══════════════════════════════════════════════════════════════════════════
// 2. LIQUID ENVELOPE REPLICA (idéntica a LiquidEnvelope.process)
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

function processEnvelope(
  signal: number,
  morphFactor: number,
  now: number,
  isBreakdown: boolean,
  c: EnvConfig,
  s: EnvState,
): number {
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

  const drySpellFloorDecay = timeSinceLastFire > 3000
    ? Math.min(1.0, (timeSinceLastFire - 3000) / 3000)
    : 0
  const adaptiveFloor = c.gateOn - 0.12 * drySpellFloorDecay
  const avgEffective = Math.max(s.avgSignal, s.avgSignalPeak * 0.55, adaptiveFloor)

  const dynamicGate = avgEffective + c.gateMargin

  const decay = c.decayBase + c.decayRange * morphFactor
  s.intensity *= decay

  let kickPower = 0
  let ghostPower = 0

  if (signal > dynamicGate && isAttacking && signal > 0.15) {
    const requiredJump = 0.14 - 0.07 * morphFactor + (isBreakdown ? 0.06 : 0)
    let rawPower = (signal - dynamicGate) / requiredJump
    rawPower = Math.min(1.0, Math.max(0, rawPower))
    const crushExp = c.crushExponent + 0.3 * (1.0 - morphFactor)
    kickPower = Math.pow(rawPower, crushExp)
  } else if (signal > avgEffective && signal > 0.15 && !isBreakdown) {
    const ghostCapDynamic = c.ghostCap * morphFactor
    const proximity = (signal - avgEffective) / 0.02
    ghostPower = Math.min(ghostCapDynamic, proximity * ghostCapDynamic)
  }

  const squelch = Math.max(0.02, c.squelchBase - c.squelchSlope * morphFactor)
  if (kickPower > squelch) {
    s.lastFireTime = now
    const hit = Math.min(c.maxIntensity, kickPower * (1.2 + 0.8 * morphFactor) * c.boost)
    s.intensity = Math.max(s.intensity, hit)
  } else if (ghostPower > 0) {
    s.intensity = Math.max(s.intensity, ghostPower)
  }

  const fadeZone = 0.08
  const fadeFactor = s.intensity >= fadeZone ? 1.0 : Math.pow(s.intensity / fadeZone, 2)
  return Math.min(c.maxIntensity, s.intensity * fadeFactor)
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. ZONA A — FRONT PAR (SubBass: gateOn × decayBase)
// Objetivo: bombo gordo sin bajo melódico continuo encendido
// ═══════════════════════════════════════════════════════════════════════════

interface FrontParResult {
  gateOn:       number
  decayBase:    number
  avgFront:     number
  peakFraction: number   // % frames con frontPar > 0.60
  leakFraction: number   // % frames donde subBass < gateOn pero output > 0.10 (fuga)
  score:        number
}

function sweepFrontPar(): FrontParResult[] {
  const results: FrontParResult[] = []

  // Base config del LATINO_PROFILE actual — solo gateOn y decayBase varían
  const BASE_ENV: Omit<EnvConfig, 'gateOn' | 'decayBase'> = {
    gateOff: 0.05, boost: 2.5, crushExponent: 2.0,
    decayRange: 0.10, maxIntensity: 0.75,
    squelchBase: 0.03, squelchSlope: 0.50,
    ghostCap: 0.08, gateMargin: 0.01,
  }

  for (let gateOn = 0.15; gateOn <= 0.281; gateOn += 0.01) {
    for (let decayBase = 0.30; decayBase <= 0.451; decayBase += 0.025) {
      const cfg: EnvConfig = { ...BASE_ENV, gateOn: parseFloat(gateOn.toFixed(3)), decayBase: parseFloat(decayBase.toFixed(3)) }
      const s = freshState()

      let sumFront = 0
      let peakCount = 0
      let leakCount = 0

      for (let i = 0; i < n; i++) {
        const f = frames[i]
        const now = 1000 + i * 50   // 20fps = 50ms/frame
        const out = processEnvelope(f.subBass, f.morphFactor, now, false, cfg, s)

        sumFront += out
        if (out > 0.60) peakCount++
        // Fuga: subBass < gateOn (no es un bombo real) pero el PAR está encendido
        if (f.subBass < gateOn && out > 0.10) leakCount++
      }

      const avgFront     = sumFront / n
      const peakFraction = peakCount / n
      const leakFraction = leakCount / n

      // SCORING — buscamos bombo gordo (avg 0.35-0.60) sin luz permanente
      let score = 0
      // Premio: avg en rango saludable
      if (avgFront >= 0.35 && avgFront <= 0.60) score += 40
      else if (avgFront > 0.25 && avgFront < 0.70) score += 20
      // Premio: picos frecuentes pero no saturados
      if (peakFraction >= 0.15 && peakFraction <= 0.35) score += 30
      else if (peakFraction > 0.10 && peakFraction < 0.45) score += 15
      // Penalización por fuga (bajo melódico manteniendo luz)
      score -= leakFraction * 80

      results.push({ gateOn: cfg.gateOn, decayBase: cfg.decayBase, avgFront, peakFraction, leakFraction, score })
    }
  }

  return results.sort((a, b) => b.score - a.score)
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. ZONA B — BACK PAR (Transient Shaper: percGate)
// Objetivo: TAcka real aislado, latigazos falsos eliminados
// ═══════════════════════════════════════════════════════════════════════════

interface BackParResult {
  percGate:      number
  hitScore:      number   // hits reales (percRaw > 0.35) que producen backPar > 0.20
  falseAlarms:   number   // frames con backPar > 0.10 cuando percRaw < 0.15
  avgBackPar:    number
  score:         number
}

function sweepBackPar(): BackParResult[] {
  const results: BackParResult[] = []

  // Config del envSnare del LATINO_PROFILE — solo percGate varía aquí
  // El envSnare recibe rawPerc = f(trebleDelta, percGate) directamente
  const ENV_SNARE: EnvConfig = {
    gateOn: 0.28, gateOff: 0.04, boost: 3.5, crushExponent: 1.0,
    decayBase: 0.25, decayRange: 0.10, maxIntensity: 0.85,
    squelchBase: 0.03, squelchSlope: 0.15, ghostCap: 0.04, gateMargin: 0.01,
  }

  // percBoost y percExponent del perfil actual
  const PERC_BOOST = 4.0
  const PERC_EXPONENT = 0.6

  for (let percGate = 0.005; percGate <= 0.0201; percGate += 0.001) {
    const pg = parseFloat(percGate.toFixed(4))
    const s = freshState()

    let sumBack = 0, hitCount = 0, falseAlarmCount = 0

    for (let i = 0; i < n; i++) {
      const f = frames[i]
      const now = 1000 + i * 50

      // Transient shaper con el percGate candidato
      let trImp = 0.0
      if (f.percRaw > pg) {
        const gated = (f.percRaw - pg) / (1.0 - pg)
        trImp = Math.pow(gated, PERC_EXPONENT) * PERC_BOOST
      }
      const rawPerc = Math.min(1.0, Math.max(0.0, trImp))

      // envSnare procesa rawPerc (morphFactor=1.0 fijo para percusión)
      const bpOut = processEnvelope(rawPerc, 1.0, now, false, ENV_SNARE, s)

      sumBack += bpOut
      // Hit real: percRaw alto (TAcka real) → output visible
      if (f.percRaw >= 0.35 && bpOut > 0.20) hitCount++
      // Falsa alarma: percRaw bajo (ruido) → output visible
      if (f.percRaw < 0.15 && bpOut > 0.10) falseAlarmCount++
    }

    const realHitFrames = frames.filter(f => f.percRaw >= 0.35).length
    const noiseFrames   = frames.filter(f => f.percRaw < 0.15).length

    const hitScore    = realHitFrames > 0 ? hitCount / realHitFrames : 0
    const falseAlarms = noiseFrames   > 0 ? falseAlarmCount / noiseFrames : 0
    const avgBackPar  = sumBack / n

    // SCORING
    let score = 0
    score += hitScore * 50         // Premio: detectar el TAcka real
    score -= falseAlarms * 80      // Penalización dura: latigazos falsos
    if (avgBackPar > 0.05 && avgBackPar < 0.35) score += 20  // Presencia moderada
    else if (avgBackPar >= 0.35) score -= 20  // Demasiado siempre encendido

    results.push({ percGate: pg, hitScore, falseAlarms, avgBackPar, score })
  }

  return results.sort((a, b) => b.score - a.score)
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. ZONA C — MOVER L, EL GALÁN (moverLTonalThreshold)
// Objetivo: congas y voces masculinas, ignorar noise no tonal
// ═══════════════════════════════════════════════════════════════════════════

interface MoverLResult {
  tonalThreshold: number
  avgMoverL:      number
  tonalFraction:  number  // % frames donde isTonal=1 con este threshold
  score:          number
}

function sweepMoverL(): MoverLResult[] {
  const results: MoverLResult[] = []

  // Config del envTreble del LATINO_PROFILE — threshold varía
  const ENV_TREBLE: EnvConfig = {
    gateOn: 0.30, gateOff: 0.10, boost: 2.5, crushExponent: 1.0,
    decayBase: 0.45, decayRange: 0.05, maxIntensity: 0.85,
    squelchBase: 0.04, squelchSlope: 0.15, ghostCap: 0.05, gateMargin: 0.01,
  }

  // Cross-filter del Galán (del LATINO_PROFILE)
  const HIGHMID_W = 0.80
  const TREBLE_W  = 0.20
  const MID_W     = 0.30
  const BASS_SUB  = 0.10

  for (let threshold = 0.45; threshold <= 0.651; threshold += 0.025) {
    const thr = parseFloat(threshold.toFixed(3))
    const s = freshState()

    let sumML = 0, tonalCount = 0

    for (let i = 0; i < n; i++) {
      const f = frames[i]
      const now = 1000 + i * 50

      // Recalcular isTonal con el threshold candidato
      // flatness no está en el log [LATINO-41] — usamos morfFactor como proxy inverso
      // (morph bajo ≈ flatness alta — percusivo, morph alto ≈ tonal)
      // La relación exacta: isTonal = flatness < threshold. En el log tenemos morphFactor.
      // Como flatness no está en el log LATINO-41, la invertimos desde morph:
      // flatness_proxy = 1.0 - morphFactor  (conservador pero correcto para scoring)
      const flatnessProxy = 1.0 - f.morphFactor
      const isTonal = flatnessProxy < thr ? 1.0 : 0.0

      if (isTonal > 0) tonalCount++

      // melodyInput con cross-filter del LATINO_PROFILE
      // (bass no está en LATINO-41, usamos 0 como conservador — no cambia el ranking relativo)
      const melodyInput = Math.max(0,
        f.mid * MID_W + f.highMid * HIGHMID_W + f.treble * TREBLE_W
      ) * isTonal

      const mlOut = processEnvelope(melodyInput, f.morphFactor, now, false, ENV_TREBLE, s)
      sumML += mlOut
    }

    const avgMoverL     = sumML / n
    const tonalFraction = tonalCount / n

    // SCORING
    let score = 0
    // Premio: presencia moderada del Galán
    if (avgMoverL >= 0.20 && avgMoverL <= 0.50) score += 40
    else if (avgMoverL > 0.10 && avgMoverL < 0.60) score += 20
    // Premio: la música latina ES armónica — tonalFraction debe ser alta
    if (tonalFraction >= 0.40 && tonalFraction <= 0.80) score += 35
    else if (tonalFraction > 0.25 && tonalFraction < 0.90) score += 15
    else if (tonalFraction < 0.25) score -= 20  // demasiado silencioso
    else score -= 10  // siempre tonal (threshold demasiado alto)

    results.push({ tonalThreshold: thr, avgMoverL, tonalFraction, score })
  }

  return results.sort((a, b) => b.score - a.score)
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. ZONA D — MOVER R, LA DAMA (vocal gateOn)
// Objetivo: brilla con fuerza real, silencio en susurros
// ═══════════════════════════════════════════════════════════════════════════

interface MoverRResult {
  gateOn:        number
  expressScore:  number  // hits fuertes (treble > gateOn×0.85) → moverR visible
  silencePenalty: number  // parpadeos con treble bajo
  avgMoverR:     number
  score:         number
}

function sweepMoverR(): MoverRResult[] {
  const results: MoverRResult[] = []

  // Config base del envVocal — solo gateOn varía
  const BASE_VOCAL: Omit<EnvConfig, 'gateOn'> = {
    gateOff: 0.08, boost: 4.0, crushExponent: 1.2,
    decayBase: 0.50, decayRange: 0.05, maxIntensity: 0.85,
    squelchBase: 0.03, squelchSlope: 0.15, ghostCap: 0.00, gateMargin: 0.01,
  }

  // Cross-filter vocal del LATINO_PROFILE
  // bassSubtractBase = 0.30, bassSubtractRange = 0.20
  // vocalInput = max(0, treble×0.6 + highMid×0.4 - lowMid×subtractFactor)
  // lowMid no está en el log — usamos 0 (sin resta, conservador)
  const TREBLE_W  = 0.6
  const HIGHMID_W = 0.4

  for (let gateOn = 0.25; gateOn <= 0.401; gateOn += 0.025) {
    const go = parseFloat(gateOn.toFixed(3))
    const cfg: EnvConfig = { ...BASE_VOCAL, gateOn: go }
    const s = freshState()

    let sumMR = 0
    let expressCount = 0, silenceCount = 0
    let expressTotal = 0, silenceTotal = 0

    for (let i = 0; i < n; i++) {
      const f = frames[i]
      const now = 1000 + i * 50

      // vocalInput
      const vocalInput = Math.max(0, f.treble * TREBLE_W + f.highMid * HIGHMID_W)
      const mrOut = processEnvelope(vocalInput, f.morphFactor, now, false, cfg, s)

      sumMR += mrOut

      // Express: treble real fuerte → La Dama brilla
      const trebleThreshold = go * 0.85
      if (f.treble > trebleThreshold) {
        expressTotal++
        if (mrOut > 0.25) expressCount++
      }
      // Silencio: treble bajo → La Dama no debería parpadear
      if (f.treble < 0.18) {
        silenceTotal++
        if (mrOut > 0.15) silenceCount++
      }
    }

    const expressScore   = expressTotal > 0 ? expressCount / expressTotal : 0
    const silencePenalty = silenceTotal > 0 ? silenceCount / silenceTotal : 0
    const avgMoverR      = sumMR / n

    // SCORING
    let score = 0
    score += expressScore  * 50    // Premio: canta cuando debe cantar
    score -= silencePenalty * 80   // Penalización: parpadea cuando no debe
    if (avgMoverR >= 0.10 && avgMoverR <= 0.45) score += 20  // Presencia equilibrada

    results.push({ gateOn: go, expressScore, silencePenalty, avgMoverR, score })
  }

  return results.sort((a, b) => b.score - a.score)
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. EJECUCIÓN Y REPORTE
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n' + '═'.repeat(76))
console.log(' WAVE 2434 — LATINO 4.1 MONTE CARLO RESULTS')
console.log('═'.repeat(76))

// ─── ZONA A: FRONT PAR ────────────────────────────────────────────────────
console.log('\n── ZONA A: FRONT PAR (SubBass gateOn × decayBase) ──')
console.log('   Top 5 combinaciones (bombo gordo, bajo melódico apagado):')
console.log('   Rank  gateOn  decay  avgFront  peakFrac  leakFrac  score')
const frontResults = sweepFrontPar()
for (let i = 0; i < Math.min(5, frontResults.length); i++) {
  const r = frontResults[i]
  console.log(
    `   #${String(i+1).padEnd(3)}` +
    `  ${r.gateOn.toFixed(2).padEnd(6)}` +
    `  ${r.decayBase.toFixed(3).padEnd(5)}` +
    `  ${r.avgFront.toFixed(3).padEnd(8)}` +
    `  ${(r.peakFraction*100).toFixed(1).padEnd(8)}%` +
    `  ${(r.leakFraction*100).toFixed(1).padEnd(8)}%` +
    `  ${r.score.toFixed(1)}`
  )
}
const bestFront = frontResults[0]
console.log(`\n  ★ WINNER: gateOn=${bestFront.gateOn}  decayBase=${bestFront.decayBase}`)
console.log(`    → avgFront=${bestFront.avgFront.toFixed(3)}, picos=${(bestFront.peakFraction*100).toFixed(1)}%, fugas=${(bestFront.leakFraction*100).toFixed(1)}%`)

// ─── ZONA B: BACK PAR ─────────────────────────────────────────────────────
console.log('\n── ZONA B: BACK PAR (percGate del Transient Shaper) ──')
console.log('   Top 5 (TAcka detectado, latigazos falsos = 0):')
console.log('   Rank  percGate  hitRate  falseAlrm  avgBack  score')
const backResults = sweepBackPar()
for (let i = 0; i < Math.min(5, backResults.length); i++) {
  const r = backResults[i]
  console.log(
    `   #${String(i+1).padEnd(3)}` +
    `  ${r.percGate.toFixed(4).padEnd(8)}` +
    `  ${(r.hitScore*100).toFixed(1).padEnd(7)}%` +
    `  ${(r.falseAlarms*100).toFixed(1).padEnd(9)}%` +
    `  ${r.avgBackPar.toFixed(3).padEnd(7)}` +
    `  ${r.score.toFixed(1)}`
  )
}
const bestBack = backResults[0]
console.log(`\n  ★ WINNER: percGate=${bestBack.percGate}`)
console.log(`    → hitRate=${(bestBack.hitScore*100).toFixed(1)}%, falseAlarms=${(bestBack.falseAlarms*100).toFixed(1)}%, avgBack=${bestBack.avgBackPar.toFixed(3)}`)

// ─── ZONA C: MOVER L ──────────────────────────────────────────────────────
console.log('\n── ZONA C: MOVER L — El Galán (moverLTonalThreshold) ──')
console.log('   Top 5 (congas/voz masculina presente, ruido ignorado):')
console.log('   Rank  threshold  avgMoverL  tonalFrac  score')
const moverLResults = sweepMoverL()
for (let i = 0; i < Math.min(5, moverLResults.length); i++) {
  const r = moverLResults[i]
  console.log(
    `   #${String(i+1).padEnd(3)}` +
    `  ${r.tonalThreshold.toFixed(3).padEnd(9)}` +
    `  ${r.avgMoverL.toFixed(3).padEnd(9)}` +
    `  ${(r.tonalFraction*100).toFixed(1).padEnd(9)}%` +
    `  ${r.score.toFixed(1)}`
  )
}
const bestMoverL = moverLResults[0]
console.log(`\n  ★ WINNER: moverLTonalThreshold=${bestMoverL.tonalThreshold}`)
console.log(`    → avgMoverL=${bestMoverL.avgMoverL.toFixed(3)}, tonalFraction=${(bestMoverL.tonalFraction*100).toFixed(1)}%`)

// ─── ZONA D: MOVER R ──────────────────────────────────────────────────────
console.log('\n── ZONA D: MOVER R — La Dama (vocal gateOn) ──')
console.log('   Top 5 (canta con fuerza, silencio en susurros):')
console.log('   Rank  gateOn  expressRate  silencePen  avgMoverR  score')
const moverRResults = sweepMoverR()
for (let i = 0; i < Math.min(5, moverRResults.length); i++) {
  const r = moverRResults[i]
  console.log(
    `   #${String(i+1).padEnd(3)}` +
    `  ${r.gateOn.toFixed(3).padEnd(6)}` +
    `  ${(r.expressScore*100).toFixed(1).padEnd(11)}%` +
    `  ${(r.silencePenalty*100).toFixed(1).padEnd(10)}%` +
    `  ${r.avgMoverR.toFixed(3).padEnd(9)}` +
    `  ${r.score.toFixed(1)}`
  )
}
const bestMoverR = moverRResults[0]
console.log(`\n  ★ WINNER: vocal gateOn=${bestMoverR.gateOn}`)
console.log(`    → expressRate=${(bestMoverR.expressScore*100).toFixed(1)}%, silencePenalty=${(bestMoverR.silencePenalty*100).toFixed(1)}%, avgMoverR=${bestMoverR.avgMoverR.toFixed(3)}`)

// ─── RESUMEN FINAL ─────────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(76))
console.log(' RESUMEN — PARÁMETROS SWEET SPOT PARA latino.ts (4.1)')
console.log('═'.repeat(76))
console.log(`
  envelopeSubBass: {
    gateOn:    ${bestFront.gateOn},   // WAVE 2434 winner
    decayBase: ${bestFront.decayBase},  // WAVE 2434 winner
  },
  percGate: ${bestBack.percGate},       // WAVE 2434 winner

  moverLTonalThreshold: ${bestMoverL.tonalThreshold},  // WAVE 2434 winner

  envelopeVocal: {
    gateOn: ${bestMoverR.gateOn},    // WAVE 2434 winner (La Dama)
  },
`)
console.log('  Aplica estos valores en profiles/latino.ts y re-captura telemetría para confirmar.')
console.log('═'.repeat(76))
