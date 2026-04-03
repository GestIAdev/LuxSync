/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 2435: LiquidEngineBase — Clase Abstracta del Omni-Liquid Engine
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Toda la matemática pesada:
 *  - 6 instancias de LiquidEnvelope
 *  - MorphFactor calculation
 *  - Silence / AGC rebound
 *  - Kick edge detection + veto
 *  - Transient Shaper (WAVE 2427)
 *  - Strobe logic
 *  - Sidechain Guillotine
 *  - Apocalypse Mode
 *
 * Las clases hijas (LiquidEngine41, LiquidEngine71) solo implementan
 * routeZones() — el mapeo de bandas procesadas a zonas de salida.
 *
 * WAVE 2435: layout '4.1'|'7.1' inyectado en constructor.
 * fuseProfileFor41() fusiona overrides en setProfile().
 * El hot-path (applyBands, process) es layout-agnostic.
 *
 * @module hal/physics/LiquidEngineBase
 * @version WAVE 2435 — OMNILIQUID OVERRIDES
 */

import { LiquidEnvelope, type LiquidEnvelopeConfig } from './LiquidEnvelope'
import type { GodEarBands } from '../../workers/GodEarFFT'
import type { ILiquidProfile } from './profiles/ILiquidProfile'
import { TECHNO_PROFILE } from './profiles/techno'
import type { LiquidStereoInput, LiquidStereoResult } from './LiquidStereoPhysics'

// ═══════════════════════════════════════════════════════════════════════════
// PROCESSED FRAME — Lo que la base entrega a routeZones()
// ═══════════════════════════════════════════════════════════════════════════

export interface ProcessedFrame {
  bands: GodEarBands
  morphFactor: number
  recoveryFactor: number
  isBreakdown: boolean
  isVetoed: boolean
  isKick: boolean        // Señal cruda del IntervalBPMTracker — fonte del candado
  isKickEdge: boolean
  acidMode: boolean
  noiseMode: boolean
  harshness: number
  flatness: number
  spectralCentroid: number  // Hz — brillo tonal (0 si no disponible)
  rawTrebleDelta: number    // trebleDelta puro — pre-filtro, pre-multiplicador (oro crudo para Monte Carlo)
  now: number

  // Señales pre-procesadas por la base
  frontLeft: number       // SubBass → envSubBass
  frontRight: number      // KickEdge → envKick
  backRight: number       // Transient Shaper → envSnare
  snareAttack: number     // Para sidechain en Mover R
  backLeft: number        // mid cross-filter → envHighMid
  moverLeft: number       // melody tonal gate → envTreble
  moverRight: number      // vocal EQ balancer → envVocal

  // Strobe
  strobeActive: boolean
  strobeIntensity: number
}

// ═══════════════════════════════════════════════════════════════════════════
// AGC REBOUND — Constante de hardware, invariante entre perfiles
// ═══════════════════════════════════════════════════════════════════════════

const RECOVERY_DURATION = 2000

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 2435: PROFILE FUSION — Pura, sin side-effects, O(n) constante
// ═══════════════════════════════════════════════════════════════════════════

/** Tipo de layout físico del rig */
export type LiquidLayout = '4.1' | '7.1'

/**
 * Fusiona un envelope config base con overrides parciales.
 * Retorna el config original si no hay overrides para este bloque.
 */
function fuseEnvelope(
  base: LiquidEnvelopeConfig,
  override?: Partial<LiquidEnvelopeConfig>,
): LiquidEnvelopeConfig {
  if (!override) return base
  return { ...base, ...override }
}

/**
 * Fusiona un perfil base (7.1) con sus overrides para layout 4.1.
 * Retorna un ILiquidProfile NUEVO — el original queda intacto.
 *
 * Complejidad: O(n) donde n = campos del perfil (~40) — constante.
 * Se llama UNA VEZ en setProfile(). NUNCA en el hot-path.
 */
function fuseProfileFor41(base: ILiquidProfile): ILiquidProfile {
  const ov = base.overrides41
  if (!ov) return base

  return {
    ...base,
    // Fusión de envelopes
    envelopeSubBass: fuseEnvelope(base.envelopeSubBass, ov.envelopeSubBass),
    envelopeKick: fuseEnvelope(base.envelopeKick, ov.envelopeKick),
    envelopeVocal: fuseEnvelope(base.envelopeVocal, ov.envelopeVocal),
    envelopeSnare: fuseEnvelope(base.envelopeSnare, ov.envelopeSnare),
    envelopeHighMid: fuseEnvelope(base.envelopeHighMid, ov.envelopeHighMid),
    envelopeTreble: fuseEnvelope(base.envelopeTreble, ov.envelopeTreble),
    // Fusión de escalares: override si presente, base si ausente
    percGate: ov.percGate ?? base.percGate,
    percBoost: ov.percBoost ?? base.percBoost,
    percExponent: ov.percExponent ?? base.percExponent,
    percMidSubtract: ov.percMidSubtract ?? base.percMidSubtract,
    backLLowMidWeight: ov.backLLowMidWeight ?? base.backLLowMidWeight,
    backLMidWeight: ov.backLMidWeight ?? base.backLMidWeight,
    backLTrebleSub: ov.backLTrebleSub ?? base.backLTrebleSub,
    backLBassSub: ov.backLBassSub ?? base.backLBassSub,
    moverLTonalThreshold: ov.moverLTonalThreshold ?? base.moverLTonalThreshold,
    moverLHighMidWeight: ov.moverLHighMidWeight ?? base.moverLHighMidWeight,
    moverLTrebleWeight: ov.moverLTrebleWeight ?? base.moverLTrebleWeight,
    moverLMidWeight: ov.moverLMidWeight ?? base.moverLMidWeight,
    bassSubtractBase: ov.bassSubtractBase ?? base.bassSubtractBase,
    bassSubtractRange: ov.bassSubtractRange ?? base.bassSubtractRange,
    moverRTrebleSub: ov.moverRTrebleSub ?? base.moverRTrebleSub,
    sidechainThreshold: ov.sidechainThreshold ?? base.sidechainThreshold,
    sidechainDepth: ov.sidechainDepth ?? base.sidechainDepth,
    snareSidechainDepth: ov.snareSidechainDepth ?? base.snareSidechainDepth,
    frontKickSidechainThreshold: ov.frontKickSidechainThreshold ?? base.frontKickSidechainThreshold,
    auraCapBase: ov.auraCapBase ?? base.auraCapBase,
    auraCapExponent: ov.auraCapExponent ?? base.auraCapExponent,
    layout41Strategy: ov.layout41Strategy ?? base.layout41Strategy,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ABSTRACT BASE
// ═══════════════════════════════════════════════════════════════════════════

export abstract class LiquidEngineBase {

  /** Perfil activo — define TODA la parametría del motor (post-fusión si 4.1) */
  profile: ILiquidProfile

  /** Layout físico del rig — inmutable para la vida del engine */
  readonly layout: LiquidLayout

  // 6 envelopes (strobe es binario, no necesita envelope)
  // WAVE 2432: mutable para hot-swap via setProfile()
  protected envSubBass: LiquidEnvelope
  protected envKick: LiquidEnvelope
  protected envVocal: LiquidEnvelope
  protected envSnare: LiquidEnvelope
  protected envHighMid: LiquidEnvelope
  protected envTreble: LiquidEnvelope

  // morphFactor state
  private avgMidProfiler = 0.0

  // Silence / AGC rebound state
  private lastSilenceTime = 0
  private inSilence = false

  // Strobe state
  private _strobeActive = false
  private strobeStartTime = 0

  // Kick edge detection state
  private _lastKickTime = 0
  private _kickIntervalMs = 0

  // Kick Veto state
  private _kickVetoFrames = 0

  // Transient Shaper state (WAVE 2427 → WAVE 2444)
  private lastTreble: number = 0
  private lastHighMid: number = 0

  constructor(profile: ILiquidProfile = TECHNO_PROFILE, layout: LiquidLayout = '7.1') {
    this.layout = layout
    // Fusión condicional: si layout === '4.1' y el perfil tiene overrides, aplicar
    const effective = layout === '4.1' ? fuseProfileFor41(profile) : profile
    this.profile = effective
    this.envSubBass = new LiquidEnvelope(effective.envelopeSubBass)
    this.envKick = new LiquidEnvelope(effective.envelopeKick)
    this.envVocal = new LiquidEnvelope(effective.envelopeVocal)
    this.envSnare = new LiquidEnvelope(effective.envelopeSnare)
    this.envHighMid = new LiquidEnvelope(effective.envelopeHighMid)
    this.envTreble = new LiquidEnvelope(effective.envelopeTreble)
  }

  // ─────────────────────────────────────────────────────────────────────
  // 🌊 WAVE 2435: HOT-SWAP PROFILE — Cambio de género sin destruir instancia
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Inyecta un nuevo perfil de género al motor en caliente.
   * La fusión con overrides41 ocurre aquí si el layout es 4.1.
   * Recrea las 6 envelopes con la configuración efectiva.
   * El estado interno (avgMid, silence, etc.) se preserva — el motor no "salta".
   */
  setProfile(profile: ILiquidProfile): void {
    const effective = this.layout === '4.1' ? fuseProfileFor41(profile) : profile
    this.profile = effective
    this.envSubBass = new LiquidEnvelope(effective.envelopeSubBass)
    this.envKick = new LiquidEnvelope(effective.envelopeKick)
    this.envVocal = new LiquidEnvelope(effective.envelopeVocal)
    this.envSnare = new LiquidEnvelope(effective.envelopeSnare)
    this.envHighMid = new LiquidEnvelope(effective.envelopeHighMid)
    this.envTreble = new LiquidEnvelope(effective.envelopeTreble)
  }

  // ─────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────────────

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
    // 1. MORPHFACTOR
    // ═══════════════════════════════════════════════════════════════════
    if (bands.mid > this.avgMidProfiler) {
      this.avgMidProfiler = this.avgMidProfiler * 0.85 + bands.mid * 0.15
    } else {
      this.avgMidProfiler = this.avgMidProfiler * 0.98 + bands.mid * 0.02
    }
    const morphFactor = Math.min(1.0, Math.max(0.0, (this.avgMidProfiler - 0.30) / 0.40))

    // ═══════════════════════════════════════════════════════════════════
    // 2. MODES
    // ═══════════════════════════════════════════════════════════════════
    const acidMode = harshness > p.harshnessAcidThreshold
    const noiseMode = flatness > p.flatnessNoiseThreshold

    // ═══════════════════════════════════════════════════════════════════
    // 3. SILENCE / AGC TRAP
    // ═══════════════════════════════════════════════════════════════════
    if (isRealSilence || isAGCTrap) {
      this.inSilence = true
      this.lastSilenceTime = now
      return this.buildSilenceResult(acidMode, noiseMode)
    } else if (this.inSilence) {
      this.inSilence = false
    }

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
    // 5. KICK DETECTION + VETO
    // ═══════════════════════════════════════════════════════════════════
    const isKick = input.isKick ?? false
    if (isKick && this._lastKickTime > 0) {
      this._kickIntervalMs = now - this._lastKickTime
    }
    if (isKick) this._lastKickTime = now
    const isKickEdge = isKick && this._kickIntervalMs > p.kickEdgeMinInterval

    if (isKick) {
      this._kickVetoFrames = p.kickVetoFrames
    }
    const isVetoed = this._kickVetoFrames > 0
    if (this._kickVetoFrames > 0) this._kickVetoFrames--

    // ═══════════════════════════════════════════════════════════════════
    // 6. PROCESS ALL ENVELOPES
    // ═══════════════════════════════════════════════════════════════════

    // --- FRONT L: SubBass continuo (El Océano) ---
    let frontLeft = this.envSubBass.process(bands.subBass, morphFactor, now, isBreakdown)

    // --- FRONT R: Kick edge detection (El Francotirador) ---
    // WAVE 2439.2: Candado del Metrónomo — en strict-split, el IntervalBPMTracker
    // es la única fuente de verdad. Si !isKick, energia = 0, sin excepciones.
    // En modo default la energía cruda del isKickEdge puede seguir disparando.
    const kickLocked = this.profile.layout41Strategy === 'strict-split' && !isKick
    const kickSignal = kickLocked ? 0 : (isKickEdge ? bands.bass : 0)
    let frontRight = this.envKick.process(kickSignal, morphFactor, now, isBreakdown)

    // --- BACK R (El Látigo): WAVE 2444 TRANSIENT SHAPER EXPANDIDO + CENTROID CALIBRADO ---
    // WAVE 2441 Monte Carlo: fitness=6260 | 0 leaks | coefs verificados en 616 frames reales.
    // WAVE 2443: Centroid Shield 5000Hz — demasiado alto. Technolab3 demuestra que bombos
    //   peligrosos rondan 400-800Hz y que, sin caja, incluso llegan a 4641Hz en decay.
    //   El umbral real bombo_oscuro vs bombo+caja está alrededor de 2500Hz.
    // WAVE 2444: Añadimos highMidDelta (la "carne" de la caja — rimshot, woodblock, clap grave).
    //   Un hi-hat es agudo puro (treble). Una caja minimal tiene su energía en highMid.
    //   impactDelta = trebleDelta + highMidDelta * 1.5 captura ambas texturas sin sesgo.
    const currentTreble = bands.treble
    const currentHighMid = bands.highMid
    const trebleDelta  = Math.max(0, currentTreble  - this.lastTreble)
    const highMidDelta = Math.max(0, currentHighMid - this.lastHighMid)
    this.lastTreble  = currentTreble
    this.lastHighMid = currentHighMid
    const spectralCentroid = input.spectralCentroid ?? 0

    // 1. Detector de Bofetadas — Transient Shaper Expandido
    // trebleDelta: hi-hats, crashes, platillos. highMidDelta: caja, rimshot, clap grave.
    const impactDelta = trebleDelta + (highMidDelta * 1.5)
    const MIN_DELTA = 0.020
    const cleanDelta = Math.max(0, impactDelta - MIN_DELTA)
    const baseSnare = cleanDelta * 2.0
    const clapBonus = baseSnare * harshness * 2.0
    let hybridSnare = baseSnare + clapBonus

    // 2. ESCUDO DE CENTROIDE DINÁMICO (umbral calibrado en technolab3)
    // Bombos oscuros solos: centroide 400–800Hz (subgrave), hasta 4641Hz en fase decay.
    // Bombo + caja simultáneos: centroide combinado supera 2500Hz por energía de la caja.
    // Clicks residuales falsos: cent < 2500Hz → silenciar. Legítimos: pasan intactos.
    if (isKick) {
      const KICK_CLICK_MAX_CENTROID = 2500  // Hz — calibrado sobre technolab2 + technolab3
      if (spectralCentroid < KICK_CLICK_MAX_CENTROID) {
        hybridSnare = 0.0
      }
      // Si cent >= 2500Hz: bombo + percusión brillante simultáneos → pasa intacto.
    }

    const snareAttack = hybridSnare
    let backRight = this.envSnare.process(hybridSnare, 1.0, now, false)

    // --- MOVER R (El Alma y el Aire): WAVE 2422 → WAVE 2430 PARAMETRIZADO ---
    const subtractFactor = p.bassSubtractBase - morphFactor * p.bassSubtractRange
    const vocalInput = Math.max(0,
      (bands.treble * 0.6 + bands.highMid * 0.4) - (bands.lowMid * subtractFactor)
    )
    const cleanVocal = isVetoed ? 0 : vocalInput
    const rawMoverR = this.envVocal.process(cleanVocal, morphFactor, now, isBreakdown)
    const kickGate = isVetoed ? (1.0 - bands.bass * 0.98) : 1.0
    const snareGate = 1.0 - snareAttack * p.snareSidechainDepth
    let moverRight = rawMoverR * kickGate * snareGate

    // --- BACK L (El Coro): WAVE 2417 RESURRECTION → WAVE 2430 PARAMETRIZADO ---
    const midSynthInput = Math.max(0,
      bands.lowMid * p.backLLowMidWeight + bands.mid * p.backLMidWeight
      - bands.treble * p.backLTrebleSub - bands.bass * p.backLBassSub
    )
    let backLeft = this.envHighMid.process(midSynthInput, morphFactor, now, isBreakdown)

    // --- MOVER L (Melodías): WAVE 2417 RESURRECTION → WAVE 2430 PARAMETRIZADO ---
    const isTonal = flatness < p.moverLTonalThreshold ? 1.0 : 0.0
    const melodyInput = Math.max(0,
      bands.mid * p.moverLMidWeight + bands.highMid * p.moverLHighMidWeight
      + bands.treble * p.moverLTrebleWeight - bands.bass * 0.1
    ) * isTonal
    let moverLeft = this.envTreble.process(melodyInput, morphFactor, now, isBreakdown)

    // ═══════════════════════════════════════════════════════════════════
    // 7. SIDECHAIN GUILLOTINE
    // ═══════════════════════════════════════════════════════════════════
    const frontMax = Math.max(frontLeft, frontRight)

    if (frontMax > p.sidechainThreshold) {
      const ducking = 1.0 - frontMax * p.sidechainDepth
      moverLeft *= ducking
      moverRight *= ducking
    } else {
      const isApocalypse = harshness > p.apocalypseHarshness && flatness > p.apocalypseFlatness
      if (isApocalypse) {
        const chaosEnergy = Math.max(bands.mid, bands.treble)
        backRight = Math.max(backRight, chaosEnergy)
        moverLeft = Math.max(moverLeft, chaosEnergy)
        moverRight = Math.max(moverRight, chaosEnergy)
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 8. STROBE
    // ═══════════════════════════════════════════════════════════════════
    const strobeResult = this.calculateStrobe(bands.treble, bands.ultraAir, noiseMode)

    // ═══════════════════════════════════════════════════════════════════
    // 9. AGC REBOUND ATTENUATION
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
    // 10. DELEGATE TO CHILD — routeZones()
    // ═══════════════════════════════════════════════════════════════════
    const frame: ProcessedFrame = {
      bands,
      morphFactor,
      recoveryFactor,
      isBreakdown,
      isVetoed,
      isKick,
      isKickEdge,
      acidMode,
      noiseMode,
      harshness,
      flatness,
      spectralCentroid: input.spectralCentroid ?? 0,
      rawTrebleDelta: trebleDelta,
      now,
      frontLeft,
      frontRight,
      backRight,
      snareAttack,
      backLeft,
      moverLeft,
      moverRight,
      strobeActive: strobeResult.active,
      strobeIntensity: strobeResult.intensity,
    }

    return this.routeZones(frame)
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
    this._strobeActive = false
    this.strobeStartTime = 0
    this.lastTreble = 0
  }

  // ─────────────────────────────────────────────────────────────────────
  // ABSTRACT — Las hijas implementan el mapeo de zonas
  // ─────────────────────────────────────────────────────────────────────

  protected abstract routeZones(frame: ProcessedFrame): LiquidStereoResult

  // ─────────────────────────────────────────────────────────────────────
  // PRIVATE
  // ─────────────────────────────────────────────────────────────────────

  private buildSilenceResult(acidMode: boolean, noiseMode: boolean): LiquidStereoResult {
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

    if (this._strobeActive && now - this.strobeStartTime > p.strobeDuration) {
      this._strobeActive = false
    }

    const effectiveThreshold = noiseMode
      ? p.strobeThreshold * p.strobeNoiseDiscount
      : p.strobeThreshold

    const isPureTreblePeak = treble > effectiveThreshold
    const isUltraAirCombo = ultraAir > 0.70 && treble > 0.60

    if ((isPureTreblePeak || isUltraAirCombo) && !this._strobeActive) {
      this._strobeActive = true
      this.strobeStartTime = now
    }

    return {
      active: this._strobeActive,
      intensity: this._strobeActive ? 1.0 : 0,
    }
  }
}
