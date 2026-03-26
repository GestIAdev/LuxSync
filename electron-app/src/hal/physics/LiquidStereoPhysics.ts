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
 * @version WAVE 2401 — THE LIQUID STEREO
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
}

export interface LiquidStereoResult {
  // === 7 zonas independientes ===
  /** Front L — SubBass (20-60Hz): Floor shaker puro */
  frontLeftIntensity: number
  /** Front R — Bass (60-250Hz): Kick body (clon God Mode) */
  frontRightIntensity: number
  /** Back L — LowMid (250-500Hz): Warmth atmosférico */
  backLeftIntensity: number
  /** Back R — Mid (500-2kHz): Snare Sniper */
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

const SUBBASS_CONFIG: LiquidEnvelopeConfig = {
  name: 'Front L (SubBass)',
  gateOn: 0.55,
  gateOff: 0.40,
  boost: 2.5,
  crushExponent: 1.5,
  decayBase: 0.55,
  decayRange: 0.20,
  maxIntensity: 0.85,
  squelchBase: 0.25,
  squelchSlope: 0.80,
  ghostCap: 0.03,
  gateMargin: 0.02,
}

const BASS_CONFIG: LiquidEnvelopeConfig = {
  name: 'Front R (Bass)',
  gateOn: 0.50,
  gateOff: 0.35,
  boost: 3.0,
  crushExponent: 1.5,
  decayBase: 0.60,
  decayRange: 0.20,
  maxIntensity: 0.80,
  squelchBase: 0.20,
  squelchSlope: 0.80,
  ghostCap: 0.04,
  gateMargin: 0.02,
}

const LOWMID_CONFIG: LiquidEnvelopeConfig = {
  name: 'Back L (LowMid)',
  gateOn: 0.45,
  gateOff: 0.30,
  boost: 2.0,
  crushExponent: 1.8,
  decayBase: 0.70,
  decayRange: 0.15,
  maxIntensity: 0.65,
  squelchBase: 0.15,
  squelchSlope: 0.60,
  ghostCap: 0.06,
  gateMargin: 0.02,
}

const MID_CONFIG: LiquidEnvelopeConfig = {
  name: 'Back R (Mid)',
  gateOn: 0.58,
  gateOff: 0.18,
  boost: 2.0,
  crushExponent: 2.0,
  decayBase: 0.65,
  decayRange: 0.20,
  maxIntensity: 1.0,
  squelchBase: 0.10,
  squelchSlope: 0.50,
  ghostCap: 0.03,
  gateMargin: 0.02,
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
  private readonly envSubBass = new LiquidEnvelope(SUBBASS_CONFIG)
  private readonly envBass = new LiquidEnvelope(BASS_CONFIG)
  private readonly envLowMid = new LiquidEnvelope(LOWMID_CONFIG)
  private readonly envMid = new LiquidEnvelope(MID_CONFIG)
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
    // 1. MORPHFACTOR — Idéntico al God Mode (WAVE 2340)
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
    // 5. PROCESS 6 ENVELOPES — Cada banda → su LiquidEnvelope
    // ═══════════════════════════════════════════════════════════════════
    let frontLeft = this.envSubBass.process(bands.subBass, morphFactor, now, isBreakdown)
    let frontRight = this.envBass.process(bands.bass, morphFactor, now, isBreakdown)
    let backLeft = this.envLowMid.process(bands.lowMid, morphFactor, now, isBreakdown)
    let backRight = this.envMid.process(bands.mid, morphFactor, now, isBreakdown)
    let moverLeft = this.envHighMid.process(bands.highMid, morphFactor, now, isBreakdown)
    let moverRight = this.envTreble.process(bands.treble, morphFactor, now, isBreakdown)

    // ═══════════════════════════════════════════════════════════════════
    // 6. SIDECHAIN GUILLOTINE — Ley Absoluta (God Mode idéntico)
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
    this.envBass.reset()
    this.envLowMid.reset()
    this.envMid.reset()
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
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════

export const liquidStereoPhysics = new LiquidStereoPhysics()
