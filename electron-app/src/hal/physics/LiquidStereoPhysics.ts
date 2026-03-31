/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌊 WAVE 2401: LIQUID STEREO PHYSICS — 7-Band Engine
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 6 instancias de LiquidEnvelope + 1 strobe binario = 7 zonas independientes.
 *
 * Recibe GodEarBands DIRECTAS (sin toLegacyFormat). Cada banda → su zona.
 * Preserva: morphFactor, sidechain guillotine, AGC rebound, acid/noise modes.
 *
 * RESTRICCIÓN CUMPLIDA: TechnoStereoPhysics.ts NO fue modificado.
 * Este archivo COEXISTE en paralelo. SeleneLux elige cuál usar vía flag.
 *
 * El God Mode (4 zonas) sigue vivo, intacto, listo para el show.
 *
 * @module hal/physics/LiquidStereoPhysics
 * @version WAVE 2408 — THE BACKLINE SPLIT
 */

import { LiquidEnvelope, type LiquidEnvelopeConfig } from './LiquidEnvelope'
import type { GodEarBands } from '../../workers/GodEarFFT'

// ═══════════════════════════════════════════════════════════════════════════
// INPUT / OUTPUT TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface LiquidStereoInput {
  /** 7 bandas directas del GodEarFFT (post-AGC) */
  bands: GodEarBands
  /** Sección musical actual */
  sectionType?: 'drop' | 'breakdown' | 'buildup' | 'intro' | string
  /** Silencio real detectado (avgNormEnergy < 0.01) */
  isRealSilence: boolean
  /** AGC en modo trampa (señal inflada post-compresión) */
  isAGCTrap: boolean
  /** Harshness proxy (highMid energy) */
  harshness?: number
  /** Spectral flatness (0-1, Wiener entropy) */
  flatness?: number
  /** Kick detectado por el pipeline de audio (GodEarFFT transients) */
  isKick?: boolean
}

export interface LiquidStereoResult {
  // === 7 zonas independientes ===
  /** Front L — SubBass (20-60Hz): Floor shaker puro */
  frontLeftIntensity: number
  /** Front R — Bass (60-250Hz): Kick body (clon God Mode) */
  frontRightIntensity: number
  /** Back L — Mid (500-2kHz): Vocal & Synth Wash (El Coro) */
  backLeftIntensity: number
  /** Back R — HighMid+Harshness (2-6kHz spectrometric): Snare Slap (El Látigo) */
  backRightIntensity: number
  /** Mover L — HighMid (2-6kHz): Presencia/Ataque */
  moverLeftIntensity: number
  /** Mover R — Treble (6-16kHz): Schwarzenegger Mode */
  moverRightIntensity: number
  /** Strobe — Binary trigger (UltraAir + Treble) */
  strobeActive: boolean
  strobeIntensity: number

  // === Legacy compat (para que SeleneLux pueda hacer switch limpio) ===
  frontParIntensity: number
  backParIntensity: number
  moverIntensityL: number
  moverIntensityR: number
  moverIntensity: number
  moverActive: boolean
  physicsApplied: 'liquid-stereo'
  acidMode: boolean
  noiseMode: boolean
}

// ═══════════════════════════════════════════════════════════════════════════
// BAND CONFIGURATIONS — Heredadas del God Mode (WAVE 2377-2394)
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 2407b: FRONT L — EL OCÉANO DE SUBGRAVES (Groove continuo)
//
// ═══════════════════════════════════════════════════════════════════════════
// WAVE 2407b: MONTE CARLO CALIBRATION — 3 generos × 2940 configs evaluadas
//
// PROBLEMA RESUELTO: "La Esponja" — Front L se pegaba a maxIntensity 0.85
// porque crushExponent 1.3 era demasiado permisivo y decayBase 0.65 demasiado
// lento. SubBass continuo (0.20-0.51 en Anyma) alimentaba el envelope sin pausa.
//
// SOLUCION CALIBRADA:
//   crushExponent 1.3→2.6: Exponente cuadrático agresivo. Solo picos genuinos
//   de SubBass superan el gate con potencia significativa. Señales medias
//   (0.15-0.25) se comprimen a casi nada → el envelope RESPIRA.
//   decayBase 0.65→0.40: Decay ultra-rápido. intensity *= 0.40 por frame.
//   1.0→0.40→0.16→0.06→0.02 = 4 frames de luz visible (~130ms).
//   La luz "late" con el SubBass en vez de quedarse encendida.
//   maxIntensity 0.85→0.72: Techo más bajo = headroom dinámico. Los picos
//   de Anyma (SubBass 0.51) llegan a 0.72, Boris Brejcha (0.12) a ~0.40.
//   boost 3.5→3.0: Compensado por el crush más selectivo.
//   gateOn 0.08→0.12: Más selectivo en la puerta de entrada.
//   decayRange 0.20→0.15: Menos modulación por morph (el decay ya es rápido).
//   ghostCap 0.08→0.06: Menos brillo fantasma residual.
//
// TELEMETRIA POST-CALIBRACION (Monte Carlo):
//   Hard Techno:    sat 20.8%, maxConsec 5, avgActive 0.40, silence 100%
//   Melodic House:  sat 41.7%, maxConsec 6, avgActive 0.49, silence 100%
//   Melodic Techno: sat 50.0%, maxConsec 6, avgActive 0.51, silence 100%
//   vs ANTERIOR:    sat 85%+,  maxConsec 15+, avgActive 0.85 (pegado)
// ═══════════════════════════════════════════════════════════════════════════
const SUBBASS_CONFIG: LiquidEnvelopeConfig = {
  name: 'Front L (SubBass Groove)',
  gateOn: 0.12,
  gateOff: 0.06,
  boost: 3.0,
  crushExponent: 2.6,
  decayBase: 0.40,
  decayRange: 0.15,
  maxIntensity: 0.72,
  squelchBase: 0.04,
  squelchSlope: 0.55,
  ghostCap: 0.06,
  gateMargin: 0.01,
}

// ═══════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════
// WAVE 2407b: FRONT R — EL FRANCOTIRADOR (Monte Carlo calibrado)
//
// CONCEPTO: Front R SOLO dispara en kick EDGEs reales (interval > 150ms).
// La señal inyectada es bands.bass del momento del kick.
// Los frames consecutivos isKick:true con interval 40-50ms son COLA del
// mismo transient → se ignoran, el envelope decae solo.
//
// PROBLEMA RESUELTO: "Garbage Infiltration" — kicks rápidos (39-55ms)
// activaban el envelope con output 0.27-0.38 (basura visible).
//
// SOLUCION CALIBRADA (500 configs × 3 generos):
//   decayBase 0.30→0.12: FLASH INSTANTANEO. intensity *= 0.12 por frame.
//   1.0→0.12→0.014→0.002 = 2 frames de luz visible (~66ms).
//   La basura residual de edge anterior muere en 1 frame extra.
//   boost 2.8→2.0: No necesita empujar tanto — bass real es 0.76-0.90.
//   crushExponent 1.0→1.0: LINEAL — el kick ya viene fuerte.
//   maxIntensity 0.80→0.75: Techo ligeramente más bajo, flash más limpio.
//   gateOn 0.20→0.15: Permite activación más temprana del edge.
//
// TELEMETRIA POST-CALIBRACION (Monte Carlo):
//   Hard Techno:    edgeAvg 0.750, garbageAvg 0.043, isolation 17.3x
//   Melodic House:  edgeAvg 0.750, garbageAvg 0.083, isolation  9.0x
//   Melodic Techno: edgeAvg 0.750, garbageAvg 0.067, isolation 11.2x
//   vs ANTERIOR:    edgeAvg 0.800, garbageAvg 0.27-0.38, isolation ~2.5x
// ═══════════════════════════════════════════════════════════════════════════
const KICK_CONFIG: LiquidEnvelopeConfig = {
  name: 'Front R (Kick Sniper)',
  gateOn: 0.15,
  gateOff: 0.08,
  boost: 2.0,
  crushExponent: 1.0,
  decayBase: 0.12,
  decayRange: 0.25,
  maxIntensity: 0.75,
  squelchBase: 0.02,
  squelchSlope: 0.10,
  ghostCap: 0.00,
  gateMargin: 0.01,
}

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 2408f: BACK L — EL CORO (Bass Subtractor + Veto Input Kill)
//
// AUTOPSIA 2408e (Post-Envelope Sidechain):
// El kickGate funciona durante el veto (BL: 0.01-0.09). PERO el mid
// del bombo (click del beater + armónicos en 500-2kHz) sube 1-2 frames
// DESPUÉS del bass → cuando el veto expira, el envelope ya tragó el mid
// del kick y con decayBase 0.65 lo sostiene → BL salta a 0.63.
//
// backcalib.md KICK#146: veto KICK BL:0.06→0.04→0.03→0.03→0.02→0.01
// pero post-veto: BL:0.00→0.63→0.60 — el mid del siguiente ciclo entra
// LIMPIO y el envelope lo captura de golpe.
//
// PARADIGMA NUEVO — BASS SUBTRACTOR:
// El bombo tiene bass ALTO + mid residual. Un synth/vocal tiene mid ALTO
// + bass bajo. Si restamos la proyección de bass del mid, el kick pierde
// su componente mid pero el vocal/synth sobrevive intacto.
//
//   cleanMid = max(0, bands.mid - bands.bass * 0.7)
//
// Análogo a TechnoStereo rawRight = max(0, treble - mid*0.2) que funciona.
//
// TRIPLE DEFENSA:
// 1. Bass Subtractor: Filtra mid del kick ANTES del envelope
// 2. Veto Input Kill: Durante veto, cleanMid=0 → envelope no traga nada
// 3. Post-envelope kickGate: Safety net → aplasta output residual
//
// ghostCap 0.00: Eliminado — el ghost path generaba baseline artificial.
// El envelope veía el mid continuo como "above average" y ghostPower
// mantenía BL a 0.08 incluso sin fire. Muerto.
// ═══════════════════════════════════════════════════════════════════════════
const VOCAL_CONFIG: LiquidEnvelopeConfig = {
  name: 'Back L (Vocal & Synth Wash)',
  gateOn: 0.15,
  gateOff: 0.08,
  boost: 2.2,
  crushExponent: 1.5,
  decayBase: 0.65,
  decayRange: 0.15,
  maxIntensity: 0.65,
  squelchBase: 0.06,
  squelchSlope: 0.45,
  ghostCap: 0.00,
  gateMargin: 0.02,
}

// ═══════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════
// WAVE 2408e: BACK R — EL LÁTIGO (Kick Veto + Treble Vitamin)
//
// AUTOPSIA 2408d MUERTO (Delta Ratio): El midΔ del kick llega 1 frame
// ANTES que el bassΔ. El ratio no cancela a tiempo → fuga de bombo.
// Cuando bass y mid suben juntos, bassΔ*0.6 insuficiente.
// technolab.md: mΔ:0.195 bΔ:0.116 → snSig:0.087 → snAtk:0.70 → FUGA.
//
// REFERENCIA PROBADA: TechnoStereoPhysics moverR (SCHWARZENEGGER MODE)
// usa treble continuo con gate 0.14 + boost x8. El snare/hihat en techno
// SIEMPRE tiene treble alto. El bombo SOLO tiene bass+mid, treble bajo.
//
// NUEVO PARADIGMA — KICK VETO + TREBLE VITAMIN:
//
// 1. KICK VETO: El sistema YA detecta kicks (isKick flag del BPM engine).
//    Si isKick=true O si hay kickEdge reciente (2 frames): percSignal = 0.
//    No adivinamos — preguntamos al detector que ya funciona.
//
// 2. TREBLE VITAMIN: Inspirado en TechnoStereo.
//    transientImpact = min(1.0, treble*1.3 + harshness*0.8)
//    El snare/hihat tiene transientImpact ALTO (treble+harshness).
//    El bombo tiene transientImpact BAJO (solo bass).
//
// 3. SEÑAL COMBINADA:
//    percSignal = transientImpact * (0.5 + 0.5*morph)
//    Con morph bajo: solo snares bestiales. Morph alto: todo.
//
// 4. ZERO-SHOT desde el frame 1: sin deltas, sin historial.
//    El treble ya discrimina percusión aguda vs bombo grave.
//
// gateOn 0.12: Más alto que antes, treble continuo amplifica ruido.
// boost 3.0: Compensar que transientImpact < 1.0 en general.
// crushExponent 2.0: Contraste snare vs ruido.
// decayBase 0.10: Flash ultraviolento — el látigo entra y sale.
// ═══════════════════════════════════════════════════════════════════════════
const SNARE_CONFIG: LiquidEnvelopeConfig = {
  name: 'Back R (Percussion Slap)',
  gateOn: 0.08,   // WAVE 2408i: bajo de 0.12 → hihats suaves de Boris (perc≈0.08-0.10) entran
  gateOff: 0.04,
  boost: 3.5,     // WAVE 2408i: vitamina extra para amplificar transientes débiles
  crushExponent: 2.0,
  decayBase: 0.10,
  decayRange: 0.20,
  maxIntensity: 0.80,
  squelchBase: 0.02,
  squelchSlope: 0.10,
  ghostCap: 0.00,
  gateMargin: 0.01,
}

const HIGHMID_CONFIG: LiquidEnvelopeConfig = {
  name: 'Mover L (HighMid)',
  gateOn: 0.20,
  gateOff: 0.12,
  boost: 4.0,
  crushExponent: 1.2,
  decayBase: 0.60,
  decayRange: 0.15,
  maxIntensity: 1.0,
  squelchBase: 0.05,
  squelchSlope: 0.30,
  ghostCap: 0.05,
  gateMargin: 0.01,
}

const TREBLE_CONFIG: LiquidEnvelopeConfig = {
  name: 'Mover R (Treble)',
  gateOn: 0.14,
  gateOff: 0.08,
  boost: 8.0,
  crushExponent: 1.2,
  decayBase: 0.50,
  decayRange: 0.20,
  maxIntensity: 1.0,
  squelchBase: 0.03,
  squelchSlope: 0.15,
  ghostCap: 0.04,
  gateMargin: 0.01,
}

// ═══════════════════════════════════════════════════════════════════════════
// STROBE CONSTANTS — God Mode exacto
// ═══════════════════════════════════════════════════════════════════════════

const STROBE_THRESHOLD = 0.80
const STROBE_DURATION = 30
const HARSHNESS_ACID_THRESHOLD = 0.60
const FLATNESS_NOISE_THRESHOLD = 0.70

// ═══════════════════════════════════════════════════════════════════════════
// AGC REBOUND — God Mode exacto
// ═══════════════════════════════════════════════════════════════════════════

const RECOVERY_DURATION = 2000

// ═══════════════════════════════════════════════════════════════════════════
// ENGINE CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class LiquidStereoPhysics {

  // 6 envelopes (strobe es binario, no necesita envelope)
  // WAVE 2407: envKick = solo kick edges
  // WAVE 2408: envVocal = mid wash, envSnare = percussive slap
  private readonly envSubBass = new LiquidEnvelope(SUBBASS_CONFIG)
  private readonly envKick = new LiquidEnvelope(KICK_CONFIG)
  private readonly envVocal = new LiquidEnvelope(VOCAL_CONFIG)
  private readonly envSnare = new LiquidEnvelope(SNARE_CONFIG)
  private readonly envHighMid = new LiquidEnvelope(HIGHMID_CONFIG)
  private readonly envTreble = new LiquidEnvelope(TREBLE_CONFIG)

  // morphFactor state (identical to God Mode)
  private avgMidProfiler = 0.0

  // Silence / AGC rebound state
  private lastSilenceTime = 0
  private inSilence = false

  // Strobe state
  private strobeActive = false
  private strobeStartTime = 0

  // WAVE 2407: Kick edge detection state
  private _lastKickTime = 0
  private _kickIntervalMs = 0

  // WAVE 2408e: Kick Veto state
  private _kickVetoFrames = 0  // Frames restantes de veto post-kick

  // WAVE 2408k: Estado para deltas espectrales frame-a-frame (Back R)
  private _prevTreble = 0.0
  private _prevHighMid = 0.0
  private _prevMid = 0.0



  // ─────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Procesa un frame completo de 7 bandas GodEarFFT.
   * Retorna intensidades independientes para las 7 zonas.
   */
  applyBands(input: LiquidStereoInput): LiquidStereoResult {
    const {
      bands,
      sectionType = 'drop',
      isRealSilence,
      isAGCTrap,
      harshness = 0.45,
      flatness = 0.35,
    } = input
    const now = Date.now()

    // ═══════════════════════════════════════════════════════════════════
    // 1. MORPHFACTOR — Identico al God Mode (WAVE 2340)
    // ═══════════════════════════════════════════════════════════════════
    if (bands.mid > this.avgMidProfiler) {
      this.avgMidProfiler = this.avgMidProfiler * 0.85 + bands.mid * 0.15
    } else {
      this.avgMidProfiler = this.avgMidProfiler * 0.98 + bands.mid * 0.02
    }
    const morphFactor = Math.min(1.0, Math.max(0.0, (this.avgMidProfiler - 0.30) / 0.40))

    // ═══════════════════════════════════════════════════════════════════
    // 2. MODES — Acid / Noise (God Mode thresholds exactos)
    // ═══════════════════════════════════════════════════════════════════
    const acidMode = harshness > HARSHNESS_ACID_THRESHOLD
    const noiseMode = flatness > FLATNESS_NOISE_THRESHOLD

    // ═══════════════════════════════════════════════════════════════════
    // 3. SILENCE / AGC TRAP — Corte limpio + recovery
    // ═══════════════════════════════════════════════════════════════════
    if (isRealSilence || isAGCTrap) {
      this.inSilence = true
      this.lastSilenceTime = now
      return this.handleSilence(acidMode, noiseMode)
    } else if (this.inSilence) {
      this.inSilence = false
    }

    // AGC Rebound attenuation (WAVE 2376)
    const timeSinceSilence = now - this.lastSilenceTime
    const isRecovering = this.lastSilenceTime > 0 && timeSinceSilence < RECOVERY_DURATION
    const recoveryFactor = isRecovering
      ? Math.min(1.0, timeSinceSilence / RECOVERY_DURATION)
      : 1.0

    // ═══════════════════════════════════════════════════════════════════
    // 4. SECTION ANALYSIS
    // ═══════════════════════════════════════════════════════════════════
    const isBreakdown = sectionType === 'breakdown' || sectionType === 'buildup'

    // ═══════════════════════════════════════════════════════════════════
    // 5. PROCESS ENVELOPES — WAVE 2408: Separacion Funcional 7 Zonas
    //
    // Front L (Oceano):       SubBass continuo → LiquidEnvelope normal
    // Front R (Francotirador): Solo kick EDGEs (interval > 150ms)
    // Back R  (El Latigo):     Kick Veto + Treble Vitamin (transientImpact)
    // Back L  (El Coro):       Mid continuo − sidechain(snareAttack*0.80)
    // Mover L (Presencia):     HighMid continuo
    // Mover R (Schwarzenegger): Treble continuo
    // ═══════════════════════════════════════════════════════════════════

    // --- FRONT L: SubBass continuo ---
    let frontLeft = this.envSubBass.process(bands.subBass, morphFactor, now, isBreakdown)

    // --- FRONT R: Kick edge detection ---
    const isKick = input.isKick ?? false
    if (isKick && this._lastKickTime > 0) {
      this._kickIntervalMs = now - this._lastKickTime
    }
    if (isKick) this._lastKickTime = now
    const isKickEdge = isKick && this._kickIntervalMs > 150

    const kickSignal = isKickEdge ? bands.bass : 0
    let frontRight = this.envKick.process(kickSignal, morphFactor, now, isBreakdown)

    // --- BACK R (El Latigo): KICK VETO + TREBLE VITAMIN ---
    // KICK VETO: 5 frames de silencio tras cada kick detectado.
    // Log technolab: bombo residual visible hasta frame+3 post-kick.
    // 5 frames = ~165ms a 30fps — cubre el decay completo del bombo.
    if (isKick) {
      this._kickVetoFrames = 5
    }
    const isVetoed = this._kickVetoFrames > 0
    if (this._kickVetoFrames > 0) this._kickVetoFrames--

    // WAVE 2408M: THE SCHWARZENEGGER PORT — Matemática exacta del Mover R 4.1.
    // El motor 4.1 (WAVE 770) funcionaba de forma impecable porque NO usaba flatness,
    // ni deltas, ni restaba graves en el discriminador. Solo aislamiento puro de agudos
    // con un Gate duro y un Boost masivo. Probado en producción durante cientos de horas.
    //
    // 1. AISLAMIENTO CRUDO: treble puro con penalización mínima de mid (×0.2).
    //    No se resta bass — el bombo vive en bass, no en treble.
    //    El mid×0.2 elimina residuos armónicos del bombo que suben al rango medio-alto.
    //
    // 2. GATE DURO: umbral 0.14 igual al Mover R 4.1.
    //    Todo lo que esté por debajo: silencio total. No hay curva suave, no hay tGate.
    //    El bombo tiene treble bajo (0.05-0.10 tipico) → rawRight queda por debajo de 0.14.
    //    El hihat tiene treble alto (0.15-0.40) → rawRight supera el gate.
    //
    // 3. EXPONENTE 1.2 + BOOST 8.0: curva levemente convexa + amplificación brutal.
    //    gated=0 → trImp=0 (gate cerrado)
    //    gated=0.10 → trImp=0.69 (hihat suave ya dispara fuerte)
    //    gated=0.50 → trImp=3.48 → clipeado a 1.0 (hihat medio = full blast)
    //
    // 4. El envelope recibe rawPerc con morphFactor=1.0 e isBreakdown=false siempre.
    //    La percusión no tiene breakdown. El morph no penaliza el ritmo.
    const rawRight = Math.max(0, bands.treble - (bands.mid * 0.2))

    const MOVER_R_GATE  = 0.14
    const MOVER_R_BOOST = 8.0

    let trImp = 0.0
    if (rawRight > MOVER_R_GATE) {
      const gated = (rawRight - MOVER_R_GATE) / (1.0 - MOVER_R_GATE)
      trImp = Math.pow(gated, 1.2) * MOVER_R_BOOST
    }

    const rawPerc = Math.min(1.0, Math.max(0.0, trImp))

    const percSignal = rawPerc

    // snareAttack: la señal percusiva — para sidechain Back L
    const snareAttack = percSignal

    let backRight = this.envSnare.process(rawPerc, 1.0, now, false)

    // --- BACK L (El Coro): ADAPTIVE BASS SUBTRACTOR + VETO INPUT KILL ---
    // WAVE 2408g: Bass Subtractor ADAPTATIVO por morphFactor.
    //
    // El problema de 2408f: factor fijo 0.7 mata todo el mid en melódico
    // donde bass es un colchón continuo (0.55-0.80 siempre).
    //   Industrial (morph≈0.25): bass es percusivo corto → factor alto (0.65)
    //   Melódico (morph≈0.65): bass es pad continuo → factor bajo (0.35)
    //
    // 1. ADAPTIVE BASS SUBTRACTOR: El factor escala con morphFactor.
    //    morph=0 → 0.65 (agresivo, kill kick harmonics)
    //    morph=0.33 → 0.50
    //    morph=0.67 → 0.35 (suave, las voces respiran)
    //    morph=1 → 0.20 (ambient puro)
    //
    // 2. VETO INPUT KILL: Durante el veto, cleanMid=0. El envelope no recibe
    //    señal y decae con su propio decay (0.65/frame). No hay peak memory
    //    nueva porque no hay input.
    //
    // 3. POST-ENVELOPE kickGate: Safety net. Si algo se cuela, el output
    //    se aplasta proporcional al bass detectado.
    const subtractFactor = 0.65 - morphFactor * 0.45
    const bassSubtract = bands.bass * subtractFactor
    const midFiltered = Math.max(0, bands.mid - bassSubtract)
    const cleanMid = isVetoed ? 0 : midFiltered
    const rawBackLeft = this.envVocal.process(cleanMid, morphFactor, now, isBreakdown)
    const kickGate = isVetoed ? (1.0 - bands.bass * 0.98) : 1.0
    const snareGate = 1.0 - snareAttack * 0.80
    let backLeft = rawBackLeft * kickGate * snareGate

    // --- MOVERS --- (WAVE 2408N: THE MOVER CROSS-FILTER)
    // Motor 4.1 (WAVE 770) usaba señales acondicionadas, no bandas crudas.
    //
    // Mover L (Presencia): highMid + cuerpo de mid − recorte de treble.
    //   + mid×0.4 → le da energía suficiente para superar el gate (resuelve "sin fuerza")
    //   − treble×0.3 → los platillos no lo enloquecen
    const moverLeftInput = Math.max(0, bands.highMid + (bands.mid * 0.4) - (bands.treble * 0.3))
    let moverLeft = this.envHighMid.process(moverLeftInput, morphFactor, now, isBreakdown)

    // Mover R (Schwarzenegger): treble puro − penalización mínima de mid.
    //   − mid×0.2 → decapita voces y armónicos de bombo que suben al rango medio-alto
    //   Sin filtro de flatness ni deltas — idéntico al aislamiento del Back R 2408M.
    const moverRightInput = Math.max(0, bands.treble - (bands.mid * 0.2))
    let moverRight = this.envTreble.process(moverRightInput, morphFactor, now, isBreakdown)

    // ═══════════════════════════════════════════════════════════════════
    // 6. SIDECHAIN GUILLOTINE — Ley Absoluta (God Mode identico)
    //    Front pair (SubBass + Bass) ducks Movers.
    //    Back PARs son LIBRES — ducking exterminado para el snare.
    // ═══════════════════════════════════════════════════════════════════
    const frontMax = Math.max(frontLeft, frontRight)

    if (frontMax > 0.1) {
      const ducking = 1.0 - frontMax * 0.90
      moverLeft *= ducking
      moverRight *= ducking
    } else {
      // APOCALIPSIS MODE (God Mode exacto)
      const isApocalypse = harshness > 0.55 && flatness > 0.55
      if (isApocalypse) {
        const chaosEnergy = Math.max(bands.mid, bands.treble)
        backRight = Math.max(backRight, chaosEnergy)
        moverLeft = Math.max(moverLeft, chaosEnergy)
        moverRight = Math.max(moverRight, chaosEnergy)
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 7. STROBE — Binary trigger (God Mode + ultraAir expansion)
    // ═══════════════════════════════════════════════════════════════════
    const strobeResult = this.calculateStrobe(bands.treble, bands.ultraAir, noiseMode)

    // ═══════════════════════════════════════════════════════════════════
    // 8. AGC REBOUND ATTENUATION — Todas las zonas (WAVE 2376)
    // ═══════════════════════════════════════════════════════════════════
    if (isRecovering) {
      frontLeft *= recoveryFactor
      frontRight *= recoveryFactor
      backLeft *= recoveryFactor
      backRight *= recoveryFactor
      moverLeft *= recoveryFactor
      moverRight *= recoveryFactor
    }

    // ═══════════════════════════════════════════════════════════════════
    // WAVE 2408h: BACKLINE telemetry — Adaptive Bass Subtractor + Raw Tonal Gate
    // ═══════════════════════════════════════════════════════════════════
    console.log(
      `BACK | mid: ${bands.mid.toFixed(3)} bass: ${bands.bass.toFixed(3)} sf: ${subtractFactor.toFixed(2)} cMid: ${cleanMid.toFixed(3)} morph: ${morphFactor.toFixed(2)} | rawR: ${rawRight.toFixed(3)} gate: ${(rawRight > 0.14 ? 1 : 0)} trImp: ${trImp.toFixed(3)} perc: ${percSignal.toFixed(2)} veto: ${isVetoed ? 'KICK' : '----'} | kGate: ${kickGate.toFixed(2)} sGate: ${snareGate.toFixed(2)} | BL: ${backLeft.toFixed(2)} BR: ${backRight.toFixed(2)}`
    )

    // ═══════════════════════════════════════════════════════════════════
    // 9. OUTPUT — 7 zonas + legacy compat
    // ═══════════════════════════════════════════════════════════════════
    return {
      // 7 zonas independientes
      frontLeftIntensity: frontLeft,
      frontRightIntensity: frontRight,
      backLeftIntensity: backLeft,
      backRightIntensity: backRight,
      moverLeftIntensity: moverLeft,
      moverRightIntensity: moverRight,
      strobeActive: strobeResult.active,
      strobeIntensity: strobeResult.intensity,

      // Legacy compat: mapeo para SeleneLux switch limpio
      frontParIntensity: Math.max(frontLeft, frontRight),
      backParIntensity: Math.max(backLeft, backRight),
      moverIntensityL: moverLeft,
      moverIntensityR: moverRight,
      moverIntensity: Math.max(moverLeft, moverRight),
      moverActive: moverLeft > 0.1 || moverRight > 0.1,
      physicsApplied: 'liquid-stereo',
      acidMode,
      noiseMode,
    }
  }

  /** Resetea todo el estado interno */
  reset(): void {
    this.envSubBass.reset()
    this.envKick.reset()
    this.envVocal.reset()
    this.envSnare.reset()
    this.envHighMid.reset()
    this.envTreble.reset()
    this.avgMidProfiler = 0
    this.lastSilenceTime = 0
    this.inSilence = false
    this.strobeActive = false
    this.strobeStartTime = 0
  }

  // ─────────────────────────────────────────────────────────────────────
  // PRIVATE
  // ─────────────────────────────────────────────────────────────────────

  private handleSilence(acidMode: boolean, noiseMode: boolean): LiquidStereoResult {
    return {
      frontLeftIntensity: 0,
      frontRightIntensity: 0,
      backLeftIntensity: 0,
      backRightIntensity: 0,
      moverLeftIntensity: 0,
      moverRightIntensity: 0,
      strobeActive: false,
      strobeIntensity: 0,
      frontParIntensity: 0,
      backParIntensity: 0,
      moverIntensityL: 0,
      moverIntensityR: 0,
      moverIntensity: 0,
      moverActive: false,
      physicsApplied: 'liquid-stereo',
      acidMode,
      noiseMode,
    }
  }

  private calculateStrobe(
    treble: number,
    ultraAir: number,
    noiseMode: boolean,
  ): { active: boolean; intensity: number } {
    const now = Date.now()

    // Duration check (30ms window — God Mode exacto)
    if (this.strobeActive && now - this.strobeStartTime > STROBE_DURATION) {
      this.strobeActive = false
    }

    // Threshold with noise discount (God Mode exacto)
    const effectiveThreshold = noiseMode ? STROBE_THRESHOLD * 0.80 : STROBE_THRESHOLD

    // Expanded trigger: treble pure threshold OR ultraAir+treble combo
    const isPureTreblePeak = treble > effectiveThreshold
    const isUltraAirCombo = ultraAir > 0.70 && treble > 0.60

    if ((isPureTreblePeak || isUltraAirCombo) && !this.strobeActive) {
      this.strobeActive = true
      this.strobeStartTime = now
    }

    return {
      active: this.strobeActive,
      intensity: this.strobeActive ? 1.0 : 0,
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON — Una instancia global compartida por todo el proceso
// ═══════════════════════════════════════════════════════════════════════════
export const liquidStereoPhysics = new LiquidStereoPhysics()
