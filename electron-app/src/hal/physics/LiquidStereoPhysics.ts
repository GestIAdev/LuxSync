/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌊 WAVE 2411: LIQUID STEREO PHYSICS — 7-Band Omni-Liquid Engine
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 6 instancias de LiquidEnvelope + 1 strobe binario = 7 zonas independientes.
 * TODA la parametría viene del ILiquidProfile inyectado en constructor.
 * Zero constantes numéricas propias — perfecto para hot-swap por género.
 *
 * ASYMMETRIC SPLIT 2411:
 *   HEMISFERIO DERECHO (Ritmo + Elemento Humano):
 *     Front R → Kick edge (El Francotirador)
 *     Back R  → Schwarzenegger Mode (El Látigo percusivo)
 *     Mover R → Voces (Bass Subtractor + Veto, El Coro)
 *   HEMISFERIO IZQUIERDO (Armonía + Atmósfera):
 *     Front L → SubBass continuo (El Océano)
 *     Back L  → Mid Synths (lowMid+mid−treble cross-filter)
 *     Mover L → Melodías tonales (highMid+treble × isTonal)
 *
 * Coexiste con TechnoStereoPhysics (God Mode). SeleneLux elige vía flag.
 *
 * @module hal/physics/LiquidStereoPhysics
 * @version WAVE 2411 — THE ARCHITECTURE FORGE
 */

import { LiquidEnvelope } from './LiquidEnvelope'
import type { GodEarBands } from '../../workers/GodEarFFT'
import type { ILiquidProfile } from './profiles/ILiquidProfile'
import { TECHNO_PROFILE } from './profiles/techno'

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
  /** Hz - Centro de masa espectral (brillo tonal, para telemetría LAB-DATA) */
  spectralCentroid?: number
  /**
   * WAVE 2470 — HYDROSTATIC BRIDGE
   * Override externo del morphFactor calculado por centroid espectral.
   * Cuando se suministra, LiquidEngineBase lo usa en lugar del avgMidProfiler.
   *
   * Caso de uso: chill-lounge inyecta la profundidad oceánica de la tide machine.
   *   morphFactor = 1.0 - (oceanDepth / MAX_DEPTH)
   *   Superficie (depth≈0)  → morphFactor≈1.0 → envelopes tienen máximo decay range
   *   Abismo (depth=10000m) → morphFactor≈0.0 → envelopes se aplanan (presión hidrostática)
   *
   * undefined = comportamiento standard (calculado desde avgMidProfiler)
   */
  morphFactorOverride?: number
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
// AGC REBOUND — Constante de hardware, invariante entre perfiles
// ═══════════════════════════════════════════════════════════════════════════

const RECOVERY_DURATION = 2000

// ═══════════════════════════════════════════════════════════════════════════
// ENGINE CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class LiquidStereoPhysics {

  /** Perfil activo — define TODA la parametría del motor */
  readonly profile: ILiquidProfile

  // 6 envelopes (strobe es binario, no necesita envelope)
  private readonly envSubBass: LiquidEnvelope
  private readonly envKick: LiquidEnvelope
  private readonly envVocal: LiquidEnvelope
  private readonly envSnare: LiquidEnvelope
  private readonly envHighMid: LiquidEnvelope
  private readonly envTreble: LiquidEnvelope

  // morphFactor state (identical to God Mode)
  private avgMidProfiler = 0.0

  // Silence / AGC rebound state
  private lastSilenceTime = 0
  private inSilence = false

  // Strobe state
  private strobeActive = false
  private strobeStartTime = 0

  // Kick edge detection state
  private _lastKickTime = 0
  private _kickIntervalMs = 0

  // Kick Veto state
  private _kickVetoFrames = 0

  // Transient Shaper state (WAVE 2427)
  private lastTreble: number = 0

  constructor(profile: ILiquidProfile = TECHNO_PROFILE) {
    this.profile = profile
    this.envSubBass = new LiquidEnvelope(profile.envelopeSubBass)
    this.envKick = new LiquidEnvelope(profile.envelopeKick)
    this.envVocal = new LiquidEnvelope(profile.envelopeVocal)
    this.envSnare = new LiquidEnvelope(profile.envelopeSnare)
    this.envHighMid = new LiquidEnvelope(profile.envelopeHighMid)
    this.envTreble = new LiquidEnvelope(profile.envelopeTreble)
  }

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
    const p = this.profile

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
    // 2. MODES — Acid / Noise (profile thresholds)
    // ═══════════════════════════════════════════════════════════════════
    const acidMode = harshness > p.harshnessAcidThreshold
    const noiseMode = flatness > p.flatnessNoiseThreshold

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
    // 5. PROCESS ENVELOPES — WAVE 2411: Asymmetric Split
    //
    // HEMISFERIO DERECHO (Ritmo + Elemento Humano):
    //   Front R → Kick edge → envKick
    //   Back R  → Schwarzenegger (treble - mid×perc) → envSnare
    //   Mover R → Voces (cleanMid con bass subtractor) → envVocal
    // HEMISFERIO IZQUIERDO (Armonía + Atmósfera):
    //   Front L → SubBass continuo → envSubBass
    //   Back L  → Mid Synths (lowMid+mid−treble) → envHighMid
    //   Mover L → Melodías tonales (highMid+treble×isTonal) → envTreble
    // ═══════════════════════════════════════════════════════════════════

    // --- FRONT L: SubBass continuo (El Océano) ---
    let frontLeft = this.envSubBass.process(bands.subBass, morphFactor, now, isBreakdown)

    // --- FRONT R: Kick edge detection (El Francotirador) ---
    const isKick = input.isKick ?? false
    if (isKick && this._lastKickTime > 0) {
      this._kickIntervalMs = now - this._lastKickTime
    }
    if (isKick) this._lastKickTime = now
    const isKickEdge = isKick && this._kickIntervalMs > p.kickEdgeMinInterval

    const kickSignal = isKickEdge ? bands.bass : 0
    let frontRight = this.envKick.process(kickSignal, morphFactor, now, isBreakdown)

    // --- KICK VETO: Silencio post-kick para Mover R (voces) ---
    if (isKick) {
      this._kickVetoFrames = p.kickVetoFrames
    }
    const isVetoed = this._kickVetoFrames > 0
    if (this._kickVetoFrames > 0) this._kickVetoFrames--

    // --- BACK R (El Látigo / Percusión Orgánica): WAVE 2427 TRANSIENT SHAPER ---
    // Delta del treble: solo las subidas bruscas disparan el foco. El ruido continuo
    // (platos, sintes) produce delta ≈0 porque no cambia entre frames. El snare/clap
    // genera un pico de delta limpio y determinista.
    const currentTreble = bands.treble
    const trebleDelta = Math.max(0, currentTreble - this.lastTreble)
    this.lastTreble = currentTreble
    const rawRight = trebleDelta * 4.0

    let trImp = 0.0
    if (rawRight > p.percGate) {
      const gated = (rawRight - p.percGate) / (1.0 - p.percGate)
      trImp = Math.pow(gated, p.percExponent) * p.percBoost
    }

    const rawPerc = Math.min(1.0, Math.max(0.0, trImp))
    const percSignal = rawPerc
    const snareAttack = percSignal

    let backRight = this.envSnare.process(rawPerc, 1.0, now, false)

    // --- MOVER R (El Alma y el Aire / Vocales y Sizzle): WAVE 2422 EQ BALANCER ---
    // treble×0.6 + highMid×0.4 mantienen texturas aéreas. lowMid×0.25 ducking suave del bombo.
    // Sin asfixia de bass, solo los bajos secundarios hacen ducking quirúrgico.
    const vocalInput = Math.max(0, (bands.treble * 0.6 + bands.highMid * 0.4) - (bands.lowMid * 0.25))
    const cleanVocal = isVetoed ? 0 : vocalInput
    const rawMoverR = this.envVocal.process(cleanVocal, morphFactor, now, isBreakdown)
    const kickGate = isVetoed ? (1.0 - bands.bass * 0.98) : 1.0
    const snareGate = 1.0 - snareAttack * p.snareSidechainDepth
    let moverRight = rawMoverR * kickGate * snareGate

    // --- BACK L (El Coro / Colchón de Sintes): WAVE 2417 RESURRECTION ---
    // Monte Carlo determinó: lMid es anémico (~0.05), mid es la banda viva (~0.46).
    // lMid×0.7 eliminado. mid amplificado a ×0.6. Bass subtractor ×0.2 mantenido.
    // Resultado: midSynthInput promedio ~0.14 → cruza gateOn=0.02 y threshold 0.15
    const midSynthInput = Math.max(0,
      bands.mid * 0.6
      - bands.bass * 0.2
    )
    let backLeft = this.envHighMid.process(midSynthInput, morphFactor, now, isBreakdown)

    // --- MOVER L (Melodías / Presencia): WAVE 2417 RESURRECTION ---
    // Monte Carlo: hMid multiplicado a ×1.0 (era ×0.6), bass subtractor bajado a ×0.1.
    // Resultado: melodyInput ~0.12 mediana. isTonal gate preservado.
    const isTonal = flatness < p.moverLTonalThreshold ? 1.0 : 0.0
    const melodyInput = Math.max(0,
      bands.mid * 0.4
      + bands.highMid * 1.0
      - bands.bass * 0.1
    ) * isTonal
    let moverLeft = this.envTreble.process(melodyInput, morphFactor, now, isBreakdown)

    // ═══════════════════════════════════════════════════════════════════
    // 6. SIDECHAIN GUILLOTINE — Ley Absoluta
    //    Front pair (SubBass + Bass) ducks Movers.
    //    Back PARs son LIBRES — ducking exterminado para el snare.
    // ═══════════════════════════════════════════════════════════════════
    const frontMax = Math.max(frontLeft, frontRight)

    if (frontMax > p.sidechainThreshold) {
      const ducking = 1.0 - frontMax * p.sidechainDepth
      moverLeft *= ducking
      moverRight *= ducking
    } else {
      // APOCALIPSIS MODE
      const isApocalypse = harshness > p.apocalypseHarshness && flatness > p.apocalypseFlatness
      if (isApocalypse) {
        const chaosEnergy = Math.max(bands.mid, bands.treble)
        backRight = Math.max(backRight, chaosEnergy)
        moverLeft = Math.max(moverLeft, chaosEnergy)
        moverRight = Math.max(moverRight, chaosEnergy)
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 7. STROBE — Binary trigger (treble + ultraAir expansion)
    // ═══════════════════════════════════════════════════════════════════
    const strobeResult = this.calculateStrobe(bands.treble, bands.ultraAir, noiseMode)

    // ═══════════════════════════════════════════════════════════════════
    // 8. AGC REBOUND ATTENUATION — Todas las zonas
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
    // WAVE 2411: TELEMETRY — Asymmetric Split routing
    // ═══════════════════════════════════════════════════════════════════
    // WAVE 2414: TELEMETRÍA QUIRÚRGICA — RHYTHM DIAGNOSTIC (Fase 1: Fronts ✅ CERTIFIED)
    // Log anterior comentado para aislar diagnóstico Front pair.
    // console.log(`LIQUID [${p.id}] | FL: ${frontLeft.toFixed(2)} FR: ${frontRight.toFixed(2)} | BL: ${backLeft.toFixed(2)} (bLin: ${midSynthInput.toFixed(3)}) BR: ${backRight.toFixed(2)} (rawR: ${rawRight.toFixed(3)} gate: ${rawRight > p.percGate ? 1 : 0}) | ML: ${moverLeft.toFixed(2)} (tonal: ${isTonal}) MR: ${moverRight.toFixed(2)} (cMid: ${cleanMid.toFixed(3)}) | morph: ${morphFactor.toFixed(2)} veto: ${isVetoed ? 'KICK' : '----'}`)
    // if (isKick || frontRight > 0.05 || frontLeft > 0.50) {
    //   console.log(`[RHYTHM] isKick: ${isKick ? 1 : 0} | edgeInt: ${this._kickIntervalMs}ms | bass: ${bands.bass.toFixed(3)} sub: ${bands.subBass.toFixed(3)} || FL(Sub): ${frontLeft.toFixed(2)} FR(Kick): ${frontRight.toFixed(2)}`)
    // }

    // WAVE 2416: TELEMETRÍA QUIRÚRGICA — HARMONY-L DIAGNOSTIC (Fase 2: Left ✅ CERTIFIED)
    // if (backLeft > 0.05 || moverLeft > 0.05 || bands.mid > 0.3) {
    //   console.log(`[HARMONY-L] bass: ${bands.bass.toFixed(3)} lMid: ${bands.lowMid.toFixed(3)} mid: ${bands.mid.toFixed(3)} hMid: ${bands.highMid.toFixed(3)} flat: ${(input.flatness ?? 0).toFixed(3)} | isTonal: ${isTonal} | midIn: ${midSynthInput.toFixed(3)} melIn: ${melodyInput.toFixed(3)} || BL(Coro): ${backLeft.toFixed(2)} ML(Melody): ${moverLeft.toFixed(2)}`)
    // }

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
    const p = this.profile

    // Duration check (profile-defined window)
    if (this.strobeActive && now - this.strobeStartTime > p.strobeDuration) {
      this.strobeActive = false
    }

    // Threshold with noise discount
    const effectiveThreshold = noiseMode
      ? p.strobeThreshold * p.strobeNoiseDiscount
      : p.strobeThreshold

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
// SINGLETON — Default TECHNO_PROFILE (backward compat)
// ═══════════════════════════════════════════════════════════════════════════
export const liquidStereoPhysics = new LiquidStereoPhysics()
