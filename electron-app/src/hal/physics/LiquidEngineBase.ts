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

import { LiquidEnvelope, type LiquidEnvelopeConfig, type LiquidEnvelopeProbe } from './LiquidEnvelope'
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
  isKick: boolean        // WAVE 2439.6: Detección local 44Hz (bass > gateOn) — zero-latency
  isKickEdge: boolean
  acidMode: boolean
  noiseMode: boolean
  harshness: number
  flatness: number
  spectralCentroid: number  // Hz — brillo tonal (0 si no disponible)
  rawTrebleDelta: number    // trebleDelta puro — pre-filtro, pre-multiplicador (oro crudo para Monte Carlo)
  rawHighMidDelta: number   // highMidDelta puro — energía caja/rimshot (oro crudo para telemetría)
  rawMidDelta: number       // midDelta puro — cuerpo del snare gordo, kick resonante
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

  // WAVE 4520.2: 9-zone expansion — computed by LiquidEngineBase, passed through routeZones()
  /** Floor — (subBass × 0.65 + lowMid × 0.35) × recoveryFactor */
  floorIntensity: number
  /** Ambient — slow EMA of (bass × 0.4 + mid × 0.6) blended with morphFactor */
  ambientIntensity: number
  /** Air — soft-compressed EMA of (treble × 0.6 + highMid × 0.4) × recoveryFactor */
  airIntensity: number
}

// ═══════════════════════════════════════════════════════════════════════════
// AGC REBOUND — Constante de hardware, invariante entre perfiles
// ═══════════════════════════════════════════════════════════════════════════

const RECOVERY_DURATION = 250

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
    // WAVE 7749: Tonality Veto + Sustain Choke — fusionar overrides41 al perfil efectivo
    snareVetoFlatnessFloor: ov.snareVetoFlatnessFloor ?? base.snareVetoFlatnessFloor,
    snareVetoFlatnessKnee: ov.snareVetoFlatnessKnee ?? base.snareVetoFlatnessKnee,
    snareVetoWnsFloor: ov.snareVetoWnsFloor ?? base.snareVetoWnsFloor,
    snareVetoWnsKnee: ov.snareVetoWnsKnee ?? base.snareVetoWnsKnee,
    snareVetoFluxFloor: ov.snareVetoFluxFloor ?? base.snareVetoFluxFloor,
    snareVetoFluxKnee: ov.snareVetoFluxKnee ?? base.snareVetoFluxKnee,
    snareChokeFrames: ov.snareChokeFrames ?? base.snareChokeFrames,
    snareChokeRate: ov.snareChokeRate ?? base.snareChokeRate,
    // WAVE 7749.7: Impulse decay — fusionar al perfil efectivo
    snareImpulseDecay: ov.snareImpulseDecay ?? base.snareImpulseDecay,
    // WAVE 7749.64: Path 1 bass-impact floor — fusionar al perfil efectivo
    snarePath1BassDeltaFloor: ov.snarePath1BassDeltaFloor ?? base.snarePath1BassDeltaFloor,
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

  // ⚒️ WAVE 7749.52: Onset-gated Floor & Air envelopes.
  // Floor: bassDelta-driven (transient impact only, no sustained amplitude).
  // Air: treble+highMid velocity-driven (zero-attack, fast decay).
  protected envFloor: LiquidEnvelope
  protected envAir: LiquidEnvelope

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

  // WAVE 2439.8: Naked Delta — estado para filtrar aceleración pura del bombo
  private _prevBassEnergy: number = 0

  // WAVE 2439.9: Frame Hold — extiende el pulso del bombo ~110ms para hardware DMX
  // Un único fotograma (22ms) es indigerible para dimmers/LEDs físicos.
  private _kickHoldCounter: number = 0

  // WAVE 8010: Kick debounce temporal — después del hold counter, esperar
  // KICK_COOLDOWN_MS antes de permitir un nuevo impacto. Evita que el tail
  // del bombo o un sinte re-disparen el detector en el mismo beat.
  private _lastKickImpactTime: number = 0
  private static readonly KICK_COOLDOWN_MS = 150

  // ⚒️ WAVE 7749.52: Default envelope configs for Floor & Air zones.
  // Used when the profile doesn't declare envelopeFloor/envelopeAir.
  // Floor: bassDelta-driven onset gate. Zero-attack, fast decay (0.12),
  //   high crush (2.0). Reacts to transient impact, not sustained amplitude.
  // Air: treble+highMid velocity-driven. Zero-attack (riseRate=1.0),
  //   fast decay (0.08, ~45-65ms), high gate (0.35), high crush (2.5).
  private static readonly DEFAULT_ENVELOPE_FLOOR: LiquidEnvelopeConfig = {
    name: 'Floor',
    gateOn: 0.08,           // low — bassDelta transients are small but sharp
    boost: 3.0,             // amplify the small delta signal
    crushExponent: 2.0,     // selective — suppresses sub-threshold noise
    decayBase: 0.12,        // fast decay (~65ms) — floor lasers respond to hits, not sustain
    decayRange: 0.05,       // minimal morph influence
    maxIntensity: 1.0,
    squelchBase: 0.30,
    squelchSlope: 0.20,
    ghostCap: 0.01,         // minimal ghost glow — floor should be dark between hits
    gateMargin: 0.02,       // tight hysteresis — fast response
    attackSlopeMin: 0.0,    // no minimum velocity — bassDelta already encodes velocity
  }
  private static readonly DEFAULT_ENVELOPE_AIR: LiquidEnvelopeConfig = {
    name: 'Air',
    gateOn: 0.35,           // high — only sharp treble transients pass
    boost: 4.0,             // amplify gated signal
    crushExponent: 2.5,     // very selective — aerial lasers need crisp stabs
    decayBase: 0.08,        // very fast decay (~45ms) — laser stabs are instantaneous
    decayRange: 0.03,       // minimal morph influence
    maxIntensity: 1.0,
    squelchBase: 0.40,
    squelchSlope: 0.20,
    ghostCap: 0.01,         // minimal ghost glow — air should be dark between stabs
    gateMargin: 0.05,       // moderate hysteresis — prevents flicker
    attackSlopeMin: 0.0,
  }

  // WAVE 8008 ADAPTER: Pre-procesador snare_energy EMA → impulso binario
  // Convierte la señal continua del RhythmicPercussionTracker en impulsos
  // compatibles con LiquidEnvelope (diseñado para señales binarias 0/1)
  private _prevSnareEnergy: number = 0
  private _snareImpulse: number = 0
  // WAVE 7749.16: WNS confirmation window — pending onset waiting for WNS.
  private _snarePendingWns: boolean = false
  protected _lastHybridSnare: number = 0

  // WAVE 7749.21: OPUS AUDIT — Slow EMA of spectralFlux to track buildup density
  private _fluxBaseline: number = 0
  // WAVE 7749.21: OPUS AUDIT — Temp fields for diagnostic logging
  private _diagBassEnergy: number = 0
  private _diagBassDelta: number = 0
  private _diagIsKick: boolean = false
  // ⚒️ WAVE 7749.74: Bass-decorrelation telemetry
  private _diagCrackBleedK: number = 0
  private _diagSnareResidual: number = 0
  private _diagCrackFlux: number = 0
  private _diagSnareDrive: number = 0
  // ⚒️ WAVE 7749.77: Body Factor — continuous algebraic gate [0.1, 2.0]
  private _diagBodyFactor: number = 1.0
  // ⚒️ WAVE 7749.78: SnareEnergyFactor — strict coincidence gate as soft multiplier
  private _diagSnareEnergyFactor: number = 1.0
  private _diagSnareEnergy: number = 0
  // ⚒️ WAVE 7749.80: Macro-awareness diagnostics
  private _diagDynamicMomoTh: number = 0.010
  private _diagSpectralDensity: number = 0
  private _diagRawHhDelta: number = 0
  private _diagTrebleGhost: number = 0
  // ⚒️ WAVE 7749.69: Ungated snare energy for diagnostic log
  private _diagSnareEnergyUngated: number = 0
  private _diagRawSnareDelta: number = 0
  private _diagFlux: number = 0
  private _diagWns: number = 0
  private _diagSnareOnset: boolean = false
  private _diagFinalThreshold: number = 0.12
  private _diagFluxGate: number = 0.15
  // ⚒️ WAVE 7749.53: FINESSE_AUDIT — tonality veto factor for diagnostic
  private _diagVetoFactor: number = 1.0

  // WAVE 7748: HH ENERGY ADAPTER — Pre-allocated state for hi-hat impulse
  // Mirrors _prevSnareEnergy/_lastSnareOnset/_snareImpulse pattern.
  // All scalars, zero allocation in hot path.
  private _prevHhEnergy: number = 0
  private _lastHhOnset: number = 0
  private _hhImpulse: number = 0

  // WAVE 7749: SUSTAIN CHOKE — kills vocal bleed tails in envSnare
  // Tracks how long snare_energy has been elevated without a new onset.
  // If it sustains > chokeFrames (~50ms at 44Hz = ~2 frames), choke the envelope.
  private _snareSustainFrames: number = 0
  private _snareChokeFactor: number = 1.0

  // ⚒️ WAVE 7749.52: SELECTIVE TCT — Morphological lock for synth bypasses.
  // A real snare transient spikes rawSnareDelta and decays within 1-2 frames.
  // A sustained synth sweep keeps rawSnareDelta elevated frame after frame.
  // The High-Flux and Energy bypasses (Paths 2 & 3) must ONLY fire when the
  // previous frame's delta has settled — proving a sharp transient, not a
  // sustained signal. The WNS path (Path 1) is exempt: WNS already proves
  // broadband noise, which no synth sweep produces.
  private _prevRawSnareDelta: number = 0
  private _snareReArmed: boolean = true

  // ⚒️ WAVE 7749.65: EMA MOMENTUM SNARE DETECTOR state.
  // Dual-EMA crossover (MACD-style) on snare_energy. Used only when
  // profile.snareMomentumThreshold is defined (techno). Replaces the
  // 5-path onset cascade with pure math — anti-retrigger is a
  // topological property of the threshold crossing, not a flag.
  private _snareEmaFast: number = 0
  private _snareEmaSlow: number = 0
  private _snarePrevMomentum: number = 0
  // ⚒️ WAVE 7749.79: SILENCE RESET REFINEMENT — frame counter to prevent
  // double-triggers caused by 1-2 frame silence gaps in snare decay tails.
  // The previous 1-frame reset nuked emaSlow the instant Drive < 0.01,
  // eliminating the MACD's inertia and letting the next kick/artifact cross
  // the threshold unopposed. Requiring 8 consecutive frames (~182ms @ 44fps)
  // of genuine silence preserves emaSlow through normal inter-onset gaps.
  private _snareSilenceFrames: number = 0
  private static readonly SILENCE_RESET_FRAMES = 8

  // ⚒️ WAVE 7749.74: BASS-DECORRELATION state — adaptive kick→crack bleed coefficient.
  // The kick bleeds into the crack band (2-5kHz) via its upper harmonics. That
  // bleed is *linearly predictable* from bass energy, so we subtract the
  // predictable part and keep only the residual — which is the snare.
  // This is NOT ducking: no gain envelope, no time constant on the output.
  // It is a projection in the measurement domain (one scalar, zero allocation).
  private _crackBleedK: number = 0
  /** Positive error (crack above prediction = possible snare) adapts SLOWLY, so
   *  genuine snares never drag the estimate up and cancel themselves out.
   *  ⚒️ WAVE 7749.76: raised 0.002→0.015 so k converges to the real kick→crack
   *  coupling within ~3 beats instead of ~20. Snares are ~50ms transients — too
   *  brief to move k meaningfully even at 7.5x the old rate. */
  private static readonly BLEED_MU_UP = 0.015
  /** Negative error (over-prediction) adapts FAST, so k tracks the bleed floor. */
  private static readonly BLEED_MU_DOWN = 0.05
  /** NLMS regularizer — prevents division blow-up when bass is silent. */
  private static readonly BLEED_EPS = 1e-3
  private static readonly BLEED_K_MAX = 3.0

  // Kick Veto state
  private _kickVetoFrames = 0

  // Transient Shaper state (WAVE 2427 → WAVE 2446)
  private lastTreble: number = 0
  private lastHighMid: number = 0
  private lastMid: number = 0

  // WAVE 4520.2: 9-zone EMA state
  // Ambient: slow follower of subBass. Attack ~5 frames, release ~33 frames.
  private _ambientEMA: number = 0
  // 🩸 WAVE 7749.52: _airEMA removed — Air zone now uses envAir (LiquidEnvelope).
  // WAVE 4812 M3: Vocal Sustain Detector — EMA rápida de mid para detectar vocales sostenidas.
  // Attack muy rápido (alpha=0.25, ~4 frames) para capturar vocales al instante.
  // Release lento (alpha=0.04, ~25 frames) para que la penalización persista post-frase vocal.
  private _vocalSustainEMA: number = 0

  // WAVE 4521.3: El último ProcessedFrame producido por applyBands().
  // Expuesto para que LiquidAetherAdapter pueda consumirlo sin re-llamar al engine.
  // Nunca es null después del primer frame procesado.
  lastFrame: ProcessedFrame | null = null

  // WAVE 4521.3: El último LiquidStereoResult producido por routeZones().
  // Disponible tras el primer applyBands(). LiquidAetherAdapter lo consume como L0 input.
  lastResult: LiquidStereoResult | null = null

  // ─────────────────────────────────────────────────────────────────────
  // WAVE 9001: PASSIVE TELEMETRY ACCESSORS — read-only probes for observers.
  // These expose the internal envelope state AFTER applyBands() has run,
  // allowing a passive observer to collect metrics without being a motor.
  // ─────────────────────────────────────────────────────────────────────

  getEnvelopeProbes(): {
    kick: LiquidEnvelopeProbe
    snare: LiquidEnvelopeProbe
    highMid: LiquidEnvelopeProbe
    subBass: LiquidEnvelopeProbe
    treble: LiquidEnvelopeProbe
    vocal: LiquidEnvelopeProbe
  } {
    return {
      kick: this.envKick.probe,
      snare: this.envSnare.probe,
      highMid: this.envHighMid.probe,
      subBass: this.envSubBass.probe,
      treble: this.envTreble.probe,
      vocal: this.envVocal.probe,
    }
  }

  get lastHybridSnare(): number {
    return this._lastHybridSnare
  }

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
    // ⚒️ WAVE 7749.52: Onset-gated Floor & Air envelopes with fallback defaults.
    this.envFloor = new LiquidEnvelope(effective.envelopeFloor ?? LiquidEngineBase.DEFAULT_ENVELOPE_FLOOR)
    this.envAir = new LiquidEnvelope(effective.envelopeAir ?? LiquidEngineBase.DEFAULT_ENVELOPE_AIR)
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
    // ⚒️ WAVE 7749.52: hot-swap air & floor envelopes
    this.envFloor = new LiquidEnvelope(effective.envelopeFloor ?? LiquidEngineBase.DEFAULT_ENVELOPE_FLOOR)
    this.envAir = new LiquidEnvelope(effective.envelopeAir ?? LiquidEngineBase.DEFAULT_ENVELOPE_AIR)
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

    // [WAVE 4941.5] HARMONIC REJECTION GATE + WHISPER GATE
    const harmonicBase = bands.mid
    // midHigh/air en la directiva -> highMid/ultraAir en GodEarBands.
    const transientTop = bands.highMid + bands.treble + (bands.ultraAir * 0.5)

    let tonalSquelch = 1.0
    let percussiveRatio = 0 // hoisted para telemetría y probes

    // 1. BAJAMOS EL SUELO: evaluamos ratio incluso en susurros y pianos suaves.
    if (harmonicBase > 0.05) {
      percussiveRatio = transientTop / (harmonicBase || 0.01)

      // WAVE 4948 — LATINO VOCAL KILL HARDENING
      // Endurece el rechazo armónico para cortar voz/autotune en back pars.
      if (percussiveRatio < 0.88) {
        tonalSquelch = 0.30 // WAVE 8009.2: 0.0→0.30 — sin muerte absoluta, transitorios sutiles conservan escala
      } else if (percussiveRatio < 1.12) {
        tonalSquelch = 0.50 // WAVE 8009.2: 0.22→0.50 — zona mixta menos castigada
      }
      // Ratio >= 1.12 -> tonalSquelch queda en 1.0 (transiente realmente percusivo)
    }

    // 2. THE WHISPER GATE: anti-fantasmas en pasajes de baja energía.
    if (transientTop < 0.15 && harmonicBase < 0.3) {
      tonalSquelch = 0.0 // WAVE 4945: cero puro en apagones
    }

    // [WAVE 4941.3→4] DSP SQUELCH PROBE silenciado (WAVE 4947.2)
    // if (bands.highMid > 0.45) {
    //   console.log(`[DSP PROBE] 🥁 Snare Hit Validado`, {
    //     ratio: percussiveRatio.toFixed(3),
    //     squelch: tonalSquelch,
    //   })
    // }

    // Entradas rítmicas crudas filtradas ANTES de los envelopes de percusión.
    // WAVE 6050: resta de graves directa — corta resonancia del bombo en medios
    const bassLeakage = bands.lowMid * 1.5 // detecta resonancia del bombo en medios
    const rawSnare = Math.max(0, bands.highMid * tonalSquelch - bassLeakage)
    const rawHat = bands.treble * tonalSquelch

    // ═══════════════════════════════════════════════════════════════════
    // 1. MORPHFACTOR
    // WAVE 2470 — HYDROSTATIC BRIDGE:
    //   Si el input suministra morphFactorOverride (chill-lounge inyecta la
    //   profundidad oceánica), lo usamos directamente y saltamos el avgMidProfiler.
    //   Para todos los demás vibes, comportamiento estándar sin cambios.
    // ═══════════════════════════════════════════════════════════════════
    let morphFactor: number
    if (input.morphFactorOverride !== undefined) {
      morphFactor = Math.min(1.0, Math.max(0.0, input.morphFactorOverride))
      // El avgMidProfiler sigue actualizándose en background para cuando
      // se vuelva a un vibe no-chill (sin salto brusco en la transición)
      if (bands.mid > this.avgMidProfiler) {
        this.avgMidProfiler = this.avgMidProfiler * 0.85 + bands.mid * 0.15
      } else {
        this.avgMidProfiler = this.avgMidProfiler * 0.98 + bands.mid * 0.02
      }
    } else {
      if (bands.mid > this.avgMidProfiler) {
        this.avgMidProfiler = this.avgMidProfiler * 0.85 + bands.mid * 0.15
      } else {
        this.avgMidProfiler = this.avgMidProfiler * 0.98 + bands.mid * 0.02
      }
      morphFactor = Math.min(1.0, Math.max(0.0, (this.avgMidProfiler - p.morphFloor) / Math.max(0.0001, (p.morphCeiling - p.morphFloor))))
    }

    // ═══════════════════════════════════════════════════════════════════
    // WAVE 4845 — THE ABSOLUTE ZERO (CHILLOUT ISOLATION)
    // Modo chill/ambient: cortocircuito total del flujo audio-reactivo.
    // Nada de kick, transientes, strobe ni sidechain entra en L0.
    // ═══════════════════════════════════════════════════════════════════
    if (this.isAbsoluteChillProfile()) {
      this.clearAudioTransients()
      const glacierMorph = this.applyGlacierPalette(morphFactor)
      return this.renderPureGlacierPayload(glacierMorph, now)
    }

    // ═══════════════════════════════════════════════════════════════════
    // 2. MODES
    // ═══════════════════════════════════════════════════════════════════
    const acidMode = harshness > p.harshnessAcidThreshold
    const noiseMode = flatness > p.flatnessNoiseThreshold

    // ═══════════════════════════════════════════════════════════════════
    // WAVE 4520.2: EMA UPDATES — run every frame, before silence check
    // Updates happen unconditionally so EMA decays naturally during silence,
    // avoiding a hard-freeze of the state when audio resumes.
    // ═══════════════════════════════════════════════════════════════════
    // WAVE 4684: Ambient EMA — profile-configurable viscosity.
    // Attack/Release time constants in ms → alpha = 1000/(ms×44).
    // Default: attack ~800ms (gentle rise), release ~10000ms (ultra-slow lung).
    // WAVE 4812 M2: EL OCÉANO — El ambient se alimenta exclusivamente de subBass.
    // Antes: bass×0.40 + mid×0.60 (contaminado por vocales).
    // Ahora: subBass puro — late con el graves del reguetón, invisáble a voces.
    // WAVE 2522: AMBIENT MID INJECTION — perfiles con ambientMidWeight > 0
    // inyectan energía de medios (guitarras rock, teclados) en el ambient.
    // Default 0 = comportamiento WAVE 4812 M2 (solo subBass).
    const _ambAttackAlpha = Math.min(1.0, 1000 / ((p.ambientAttackMs ?? 800) * 44))
    const _ambReleaseAlpha = Math.min(1.0, 1000 / ((p.ambientReleaseMs ?? 10000) * 44))
    const _ambMidWeight = p.ambientMidWeight ?? 0
    const _ambMix = bands.subBass + bands.mid * _ambMidWeight
    if (_ambMix > this._ambientEMA) {
      this._ambientEMA = this._ambientEMA * (1 - _ambAttackAlpha) + _ambMix * _ambAttackAlpha
    } else {
      this._ambientEMA = this._ambientEMA * (1 - _ambReleaseAlpha) + _ambMix * _ambReleaseAlpha
    }
    // WAVE 4812 M3: Vocal Sustain EMA — detecta energía mid sostenida (vocales continuas).
    // La vocal tiene EMA alta + delta baja. El snare tiene delta alta + EMA baja.
    if (bands.mid > this._vocalSustainEMA) {
      this._vocalSustainEMA = this._vocalSustainEMA * 0.75 + bands.mid * 0.25
    } else {
      this._vocalSustainEMA = this._vocalSustainEMA * 0.96 + bands.mid * 0.04
    }

    // ⚒️ WAVE 7749.52: Air EMA REMOVED — Air zone now processed by envAir
    // (LiquidEnvelope with zero-attack, fast decay, high gate, high crush).
    // The old _airEMA soft-follower had ~8 frame attack delay, causing aerial
    // lasers to lag behind treble stabs. envAir responds in 1 frame.
    // The airIntensity is now computed in the 9-ZONE FINAL SIGNALS section below.

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
    // WAVE 2439.8: Naked Delta — filtro de aceleración pura sin time-locks.
    // El sinte oscila con deltas de ~0.01. El bombo salta violentamente (>0.05).
    // Esto decapita el sustain del sintetizador y aisla transitorios verticales.

    // DESCONTAMINACIÓN EXACTA: Revertimos la inyección de WAVE 3421
    // Le quitamos el 40% de lowMid para aislar el grave original (0-250Hz)
    const pureBassEnergy = Math.max(0, bands.bass - (bands.lowMid * 0.40))
    const bassDelta = pureBassEnergy - this._prevBassEnergy
    this._prevBassEnergy = pureBassEnergy

    // WAVE 7749.21: OPUS AUDIT — capture kick-side metrics for diagnostic
    this._diagBassEnergy = pureBassEnergy
    this._diagBassDelta = bassDelta

    // WAVE 2439.10: Reload Lock + Shielded Delta
    // RELOAD LOCK: Solo evaluamos impacto si el hold está inactivo.
    // Esto impide que el pumping del sidechain extienda o reinicie el contador.
    // ADAPTIVE DELTA: Curva inversa de compresión sobre señal purificada.
    // Bass 1.0 → delta 0.040 | Bass 0.5 → delta 0.080. Evita falsos positivos en build-ups.
    let isImpact = false
    // WAVE 8010: Cooldown temporal además del hold counter.
    // El hold counter (6 frames ~136ms) bloquea re-detección durante el pulso,
    // pero tras expirar, el tail del bombo o un sinte pueden re-disparar.
    // 150ms de cooldown asegura un único disparo por beat (>400ms a 130 BPM).
    if (this._kickHoldCounter === 0 && (now - this._lastKickImpactTime > LiquidEngineBase.KICK_COOLDOWN_MS)) {
      const dynamicDelta = 0.120 - (pureBassEnergy * 0.080)

      isImpact = pureBassEnergy > p.envelopeKick.gateOn && bassDelta > dynamicDelta

      if (isImpact) {
        this._kickHoldCounter = 6
        this._lastKickImpactTime = now
      }
    }

    const isKick = this._kickHoldCounter > 0
    if (this._kickHoldCounter > 0) this._kickHoldCounter--
    this._diagIsKick = isKick

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

    // --- FRONT R: Kick Naked Delta (El Francotirador) ---
    // WAVE 2439.8: kickSignal alimentado solo por transitorios verticales (delta > 0.05).
    // El envelope con su decayBase ultrarrápido y maxIntensity dará forma al impulso.
    const kickSignal = isKick ? pureBassEnergy : 0
    let frontRight = this.envKick.process(kickSignal, morphFactor, now, isBreakdown)

    // WAVE 8005.2: PHOTON STROBE — Front Channel modulation (overlay, not replace)
    // On-phase: flash to full brightness on top of normal physics.
    // Off-phase: normal physics preserved (no override).
    if (input.photon?.strobe?.active) {
      const _strobe = input.photon.strobe
      const _periodMs = 1000 / Math.max(0.1, _strobe.rateHz)
      const _phase = (now % _periodMs) / _periodMs
      if (_phase < _strobe.duty) frontRight = Math.max(frontRight, 1.0)
    }

    // --- BACK R (El Látigo): WAVE 2449 MORPHOLOGIC CENTROID SHIELD ---
    // WAVE 2441 Monte Carlo: fitness=6260 | 0 leaks | coefs verificados en 616 frames reales.
    // WAVE 2443: Centroid Shield 5000Hz → demasiado alto.
    // WAVE 2444: highMidDelta incorporado. WAVE 2445: Centroid Shield condicional (isKick only).
    // WAVE 2446: midDelta * 0.8 añadido (snare gordo 808-style).
    // WAVE 2447: Centroid Shield Universal → elimina snare invertido (cent < 900Hz → 0).
    // WAVE 2449: animalog.md revela que Anyma vive en cent:240-600Hz — el escudo de 900Hz fijo
    //   lo mataba en techno melódico. El centroide del stab de Anyma ≡ centroide del bombo.
    //   No se puede separar por frecuencia fija. Se separa por MORFOLOGÍA.
    //   centroidFloor = 900 * (1 - morphFactor): en Anyma el suelo cae a ~180Hz (todo pasa),
    //   en techno industrial sube a ~810Hz (bloqueo total del cuerpo del bombo).
    //   El Salvoconducto Dubstep (harshness ≥ 0.024) permite snare fills sobre el bombo.
    const currentTreble  = rawHat
    const currentHighMid = rawSnare
    const currentMid     = bands.mid
    const trebleDelta    = Math.max(0, currentTreble  - this.lastTreble)
    const highMidDelta   = Math.max(0, currentHighMid - this.lastHighMid)
    const midDelta       = Math.max(0, currentMid     - this.lastMid)
    this.lastTreble  = currentTreble
    this.lastHighMid = currentHighMid
    this.lastMid     = currentMid

    // WAVE 7749.9: LEGACY TRANSIENT SHAPER EXTERMINATED.
    // The old isSnareImpact / _snareHoldCounter / percRaw path was a separate
    // detection logic (rawSpike * snareSpectrum * 10.0 > 0.19) that fired on
    // spectral spikes from hi-hats, synths, and noise — not just snares.
    // It held percRaw=1.0 for ~90ms (4 frames) after ANY spectral spike,
    // causing the "fairground lights" effect. Now fully removed.
    // The ONLY snare detection path is the pure physics rawOnset below.
    let hybridSnare = 0

    // ═══════════════════════════════════════════════════════════════════
    // WAVE 8008 ADAPTER: Pre-procesador snare_energy EMA → impulso binario
    // Cuando GodEarFFT V3 suministra snare_energy (EMA continua del
    // RhythmicPercussionTracker), convertirla a impulso binario con decay
    // rápido antes de alimentar LiquidEnvelope. Esto preserva la lógica
    // original del envelope sin modificaciones.
    // ═══════════════════════════════════════════════════════════════════
    let snareOnsetThisFrame = false
    if (input.snare_energy !== undefined) {
      const rawSnareEnergy = input.snare_energy

      // WAVE 7749.3: Reset prev energy on silence — after a break/drop, the
      // _prevSnareEnergy was stuck high from the last beat. When audio resumes,
      // the delta was negative → no onset → slow recovery. Reset to 0 when
      // energy drops to near-silence so the first returning beat triggers.
      if (this._prevSnareEnergy > 0.10 && rawSnareEnergy < 0.03) {
        this._prevSnareEnergy = 0
      }

      // ═══════════════════════════════════════════════════════════════════════════
      // WAVE 7749.7: RAW TRANSIENT ONSET DETECTION — The isKick methodology
      // ═══════════════════════════════════════════════════════════════════════════
      //
      // PROBLEM (WAVE 7749.0-7749.4): snare_energy is an EMA from GodEarFFT's
      // RhythmicPercussionTracker. In dense compressed techno, the EMA smoothing
      // destroys the transient edge — frame-to-frame deltas are <0.008 even when
      // real snares are firing. The deltaOnset and fluxOnset triggers were deaf.
      //
      // SOLUTION: GodEarFFT now exports raw_snare_delta — the frame-to-frame delta
      // of the RAW (pre-EMA) snare energy. This is the same principle as isKick:
      //   isKick:  bassDelta = pureBassEnergy - _prevBassEnergy  (raw FFT band)
      //   snare:   rawSnareDelta = snareEnergyRaw - _prevSnareEnergyRaw  (raw FFT sub-band)
      //
      // The raw signal has sharp transients even under heavy compression because
      // compression reduces amplitude but doesn't eliminate the transient edge.
      //
      // THREE triggers (all agnostic, no profile brute-force):
      //
      // WAVE 7749.9: THE PURIST METRONOME — No cooldowns, no hacks.
      // The engine operates on pure physics. If the raw signal dictates 4 rapid
      // hits, the lights flood. If it double-triggers falsely, we see it in
      // telemetry and fix the math — we don't hide it with cooldowns.
      //
      // All legacy EMA-based triggers (emaOnset, fluxOnset) have been exterminated.
      // They were firing on negative raw deltas and spectral flux noise during
      // decays — physically impossible false positives.
      //
      // The snare onset is now a single line of physics:
      //   1. raw_snare_delta > 0.08 — a real positive transient edge in the crack band
      //   2. snare_energy > 0.05   — sufficient total energy (not a near-zero jump)
      //
      // The Tonality Veto (downstream) acts as the Liquid Morphology filter,
      // scaling the intensity based on the track's fluid density.
      // WAVE 7749.16: WNS CONFIRMATION WINDOW — The 1-Frame Latency Fix
      // The WNS detector has a 1-frame latency: on the first frame of a snare
      // hit, crack-delta and spectral flux fire immediately, but WNS is still 0
      // (the HF noise content hasn't been integrated yet). On the next frame,
      // WNS spikes to 0.1-0.7. In ~90% of cases, RawΔ stays > 0.12 on frame 2
      // and the onset fires normally. In ~10% of cases, RawΔ drops below 0.12
      // by frame 2 and the snare is missed — the "1 negro" in a 3-4-1 pattern.
      //
      // Solution: when crack+flux say snare but WNS hasn't arrived, set a
      // "pending" flag. On the next frame, if WNS > 0.05 AND Flux is still
      // active (> 0.15), fire retroactively — the snare body is still
      // resonating. If WNS stays 0, it was a kick — discard the pending.
      //
      // This is physically motivated: the crack band and flux are fast
      // detectors (1-frame response), while WNS is a slower detector (2-frame
      // response). We give WNS 1 extra frame to confirm. Kicks never confirm
      // because their WNS stays 0 on both frames.
      const rawSnareDelta = input.raw_snare_delta ?? 0
      const photon = input.photon
      const spectralFlux = photon?.spectralFlux ?? 1  // fallback: allow if no photon
      const wns = photon?.whiteNoiseScore ?? 1        // fallback: allow if no photon
      const snareEnergy = input.snare_energy ?? 0

      // WAVE 7749.21: OPUS AUDIT — capture for diagnostic log outside this block
      this._diagSnareEnergy = snareEnergy
      this._diagSnareEnergyUngated = input.snare_energy_ungated ?? snareEnergy
      this._diagRawSnareDelta = rawSnareDelta
      this._diagFlux = spectralFlux
      this._diagWns = wns

      // WAVE 7749.22: DYNAMIC FBL THRESHOLD — Opus Paradox resolved.
      // During massive buildups (Eric Prydz "Opus"), snare_energy EMA dies to 0
      // because white noise asphyxiates the RhythmicPercussionTracker. But
      // spectralFlux baseline (fBL) rises from 0.044 (normal) to 0.06-0.076
      // (buildup). This is the reliable density signal.
      // Formula: threshold = 0.12 - max(0, fBL - 0.05) × 2.0, clamped to 0.06.
      //   fBL = 0.05 (normal) → threshold = 0.12 (strict, hi-hats blocked)
      //   fBL = 0.06 (buildup) → threshold = 0.10
      //   fBL = 0.07 (peak)    → threshold = 0.08
      // Empirical: 8 of 10 missed roll snares (RawΔ 0.08-0.11, Flux 0.22-0.41)
      // would pass with this scaling. Hi-hats (Flux < 0.15) still blocked by
      // the spectralFlux gate regardless of threshold.
      this._fluxBaseline = this._fluxBaseline * 0.98 + spectralFlux * 0.02  // tau ~500ms at 44Hz
      const dynamicSnareThreshold = 0.12 - (Math.max(0, this._fluxBaseline - 0.05) * 2.0)
      const finalSnareThreshold = Math.max(0.06, dynamicSnareThreshold)
      this._diagFinalThreshold = finalSnareThreshold

      // WAVE 7749.23: DYNAMIC FLUX GATE — Opus Paradox Part 2.
      // The delta threshold fix (7749.22) worked, but ~150 snares in the roll
      // have Flux 0.10-0.15 and are blocked by the static 0.15 Flux gate.
      // During dense buildups, the AGC compresses individual hit flux — a snare
      // that normally has Flux 0.20 gets crushed to 0.12.
      // Empirical: kicks max out at Flux 0.097. Snares in the roll: 0.10-0.15.
      // Gap is clean at 0.10. Dynamic gate scales with fBL, clamped to 0.10.
      //   fBL = 0.05 (normal)  → Flux gate = 0.15 (strict, hi-hats blocked)
      //   fBL = 0.08 (buildup) → Flux gate = 0.12
      //   fBL = 0.10+ (peak)   → Flux gate = 0.08 (clamp — kicks still blocked)
      // ⚒️ WAVE 7749.56: clamp lowered 0.10 → 0.08 to recover real snares with
      // marginal Flux (0.08-0.10). Safe because OMNI-GATE v2 contextual gates
      // (SnareE/WNS/BassE) already filter false positives downstream.
      const dynamicFluxGate = Math.max(0.08, 0.15 - (Math.max(0, this._fluxBaseline - 0.05) * 1.0))
      this._diagFluxGate = dynamicFluxGate

      // ⚒️ WAVE 7749.52: SELECTIVE TCT — Delta Decay Test (morphological lock).
      // A real snare transient spikes rawSnareDelta and decays within 1-2 frames.
      // A sustained synth sweep keeps rawSnareDelta elevated frame after frame.
      // We re-arm the detector when the previous frame's delta has settled below
      // 0.02 (near-zero). This proves a sharp transient edge, not a sustained
      // signal. The High-Flux (Path 2) and Energy (Path 3) bypasses require
      // _snareReArmed to fire — they cannot re-trigger on a sustained sweep.
      // The WNS path (Path 1) is EXEMPT: WNS already proves broadband noise,
      // which no synth sweep produces. WNS-confirmed onsets fire regardless.
      if (Math.abs(this._prevRawSnareDelta) < 0.02) {
        this._snareReArmed = true
      }

      // ⚒️ WAVE 7749.54 → 7749.55: OMNI-GATE v2 — Hybrid gates for ALL paths.
      // Path 1 (WNS): requires crack-band energy (SnareE > 0.15) OR bass context
      //   (BassE > 0.40) in addition to WNS > 0.3. Prevents broadband synth sweeps
      //   in breakdowns from firing — sweeps have SnareE ≈ 0 and BassE < 0.30.
      // Path 2 (High-Flux): OMNI-GATE v2 adds contextual gate — SnareE > 0.15 OR
      //   (WNS > 0.10 AND BassE > 0.40). Blocks Gravity kicks (WNS ≈ 0, SnareE = 0,
      //   Flux 0.20-0.35) and Tehnominimal breakdown sweeps (SnareE < 0.15,
      //   BassE < 0.40). Allows Anyma synth snares (SnareE 0.46+) and Gravity
      //   real snares (WNS 0.12+, BassE 0.70+). WNS threshold 0.10 (not 0.05)
      //   because Gravity kicks have WNS 0.00-0.05 — clean gap at 0.08-0.10.
      // Path 3 (Energy): AGC-aware hybrid. SnareE > 0.80 always passes (saturated
      //   snare = dembow). Otherwise requires AGC < 2.5x (low compression) or
      //   WNS > 0.15 (broadband confirmation). Blocks AGC-amplified piano/kick
      //   tails in quiet sections (Brejcha "bombo fantasma").
      const agcGain = input.agcGainFactor ?? 1.0
      const bassE = pureBassEnergy

      let rawOnset = false
      // ⚒️ WAVE 7749.65: EMA MOMENTUM SNARE DETECTOR (profile-gated).
      // When snareMomentumThreshold is defined (techno), replace the entire
      // 5-path onset cascade with a dual-EMA crossover on snare_energy.
      // Pure math: no TCT flags, no cooldowns, no WNS/Flux/BassE gates.
      // Anti-retrigger is a topological property of the threshold crossing
      // — momentum can only cross θ upward once per genuine energy rise.
      // Hi-hats (SnareE = 0) never move either EMA → excluded for free.
      // Forensic data (imposiblesnare.md): 61 onsets → 19, eliminating the
      // 3x jitter caused by RawΔ oscillating on snare decay tails.
      // Absent (undefined) = legacy 5-path cascade (latino, chill, etc.).
      const momoTh = p.snareMomentumThreshold
      if (momoTh !== undefined) {
        const aF = p.snareMomentumAlphaFast ?? 0.50
        const aS = p.snareMomentumAlphaSlow ?? 0.05
        // ⚒️ WAVE 7749.74: CRACK DESCORRELADO Y BLANQUEADO.
        //
        // Why the previous taps failed:
        //  • snareEnergy (gated) is starved: the GodEarFFT gate needs
        //    body > 2.0×bodyEMA, but in techno the KICK itself inflates bodyEMA
        //    (it fires every beat into 150-250Hz), so the snare is judged
        //    against the kick's own loudness and the AND-gate stays shut.
        //    It is then smoothed by a ~330ms release envelope, which destroys
        //    the transient before the MACD ever sees it. Measured separability
        //    onset/no-onset on 4 logs: 0.4x–1.1x — i.e. NO information.
        //  • snare_energy_ungated (raw crack) is flooded: every synth, hat and
        //    kick harmonic lives in 2-5kHz too. Separability 1.3x–3.1x.
        //
        // The fix is algebraic, O(1), zero-allocation — no cooldowns, no ducking.
        const crack = input.snare_energy_ungated ?? snareEnergy

        // ── TÉRMINO A: descorrelación de graves (NLMS asimétrico) ───────────
        // Kick bleed into the crack band is linearly predictable from bassE.
        // A snare is the part of the crack energy that the bass CANNOT explain.
        // Asymmetric step: positive error adapts slowly (μ=0.015) so real snares
        // don't teach the filter to cancel them; negative error adapts fast
        // (μ=0.05) so k converges to the *floor* of the coupling.
        // ⚒️ WAVE 7749.76: μ_up raised 0.002→0.015 (7.5x) so k converges fast
        // enough to track the real kick→crack coupling within ~3 beats instead
        // of ~20. Snares are too brief (~50ms) to move k meaningfully even at
        // this higher rate — the filter learns the floor, not the spikes.
        const bleedErr = crack - this._crackBleedK * bassE
        const bleedMu = bleedErr > 0
          ? LiquidEngineBase.BLEED_MU_UP
          : LiquidEngineBase.BLEED_MU_DOWN
        this._crackBleedK += bleedMu * bleedErr * bassE /
          (LiquidEngineBase.BLEED_EPS + bassE * bassE)
        if (this._crackBleedK < 0) this._crackBleedK = 0
        else if (this._crackBleedK > LiquidEngineBase.BLEED_K_MAX) {
          this._crackBleedK = LiquidEngineBase.BLEED_K_MAX
        }
        const residual = bleedErr > 0 ? bleedErr : 0

        // ── TÉRMINO B: crack-band flux (domain-localized transient) ─────────
        // A snare fires broadband noise INTO 2-5kHz → crackFlux spikes. A hi-hat
        // at 10kHz does NOT move 2-5kHz bins → crackFlux stays low. A breakdown
        // section change shifts the whole spectrum but not specifically 2-5kHz.
        // This is the domain-isolated transient detector that killed the global
        // spectralFlux's hi-hat and breakdown contamination.
        // ⚒️ WAVE 7749.76: replaced global spectralFlux with crack-band flux.
        // ⚒️ WAVE 7749.77: added bodyFactor as third multiplicative term. A real
        // snare vibrates the drum membrane (150-250Hz) → body > EMA → factor > 1.
        // A clap/rimshot has crack but no body → body ≈ EMA → factor ≈ 0.5 (penalty).
        // This is the continuous algebraic replacement for the hard SnareE gate.
        // ⚒️ WAVE 7749.78: added snareEnergyFactor as fourth multiplicative term.
        // bodyFactor checks body/bodyEMA (1.5× threshold), but a rimshot/tom/stab
        // can have body resonance between 1.5×-2.0× bodyEMA (bodyFactor > 1) AND
        // crack localized (crackFlux high) yet NOT open the GodEarFFT AND-gate
        // (body > 2.0× AND crack > 1.8×). snareEnergy is the EMA of that gated
        // sqrt(body×crack) — it's 0 when the gate is shut, ~0.5-0.6 for real
        // snares. This factor is the only signal that encodes the strict
        // coincidence gate as a continuous multiplier.
        //   Real snare:  SnareE ≈ 0.56 → sEF = 1.0 (transparent)
        //   FP clean:    SnareE ≈ 0.01 → sEF = 0.05 (aplastado, no veto)
        const crackFlux = input.snare_crack_flux ?? spectralFlux
        const bodyFactor = input.snare_body_factor ?? 1.0

        // ═══════════════════════════════════════════════════════════════════
        // ⚒️ WAVE 7749.80: MACRO-AWARENESS — El Umbral Respira con la Canción
        // ═══════════════════════════════════════════════════════════════════
        // The fixed momoTh (0.04 in techno profile) was a compromise that
        // over-triggered on dense tracks (Brejcha) and under-triggered on
        // clean EDM (Tiesto). Now the threshold breathes with the spectral
        // density of the track, computed from real GodEarFFT variables that
        // arrive every frame via LiquidStereoInput.
        //
        //   spectralDensity = 0.4×harshness + 0.3×flatness + 0.3×hh_energy
        //   dynamicMomoTh   = 0.010 + 0.020 × spectralDensity
        //   sectionBonus    = ×1.2 if drop/chorus (errors more visible)
        //
        // Measured behavior (from simulation):
        //   Tiesto (clean EDM):  density ~0.27 → dynTh ~0.0169 (contracts)
        //   Brejcha (dense):     density ~0.46 → dynTh ~0.0216 (expands)
        //   Minimal (medium):    density ~0.39 → dynTh ~0.0197 (neutral)
        const hhEnergy = input.hh_energy ?? 0
        const harsh = input.harshness ?? 0.45
        const flat = input.flatness ?? 0.35
        const spectralDensity = Math.max(0, Math.min(1,
          0.4 * harsh + 0.3 * flat + 0.3 * hhEnergy))
        let dynamicMomoTh = 0.010 + (0.020 * spectralDensity)
        const sectionType = input.sectionType ?? 'verse'
        if (sectionType === 'drop' || sectionType === 'chorus') {
          dynamicMomoTh *= 1.2
        }

        // ═══════════════════════════════════════════════════════════════════
        // ⚒️ WAVE 7749.80: SMART sEF — Treble Bypass Natural
        // ═══════════════════════════════════════════════════════════════════
        // When the track has strong treble presence (hh_energy high), the snare
        // may not have body resonance (SnareE=0) but still be a real synthetic
        // snare. The original sEF floor of 0.05 kills these. We relax the floor
        // proportionally to treble presence, up to 0.40 when hh_energy is maxed.
        //   Normal track:  treblePresence=0.0 → relaxedMin=0.05 (unchanged)
        //   Tiesto:        treblePresence=0.5 → relaxedMin=0.225 (rescued)
        //   Brejcha:       treblePresence=0.3 → relaxedMin=0.155 (mild lift)
        const treblePresence = Math.max(0, Math.min(1, hhEnergy * 2.0))
        const relaxedMinSef = 0.05 + (0.35 * treblePresence)
        const smartSef = Math.max(relaxedMinSef, Math.min(1.0, snareEnergy * 2.0))

        // ═══════════════════════════════════════════════════════════════════
        // ⚒️ WAVE 7749.80: TREBLE-GHOST INJECTION — EDM Snare Rescue
        // ═══════════════════════════════════════════════════════════════════
        // In EDM tracks like Tiesto, the snare is synthetic: no body resonance
        // (bFct ≈ 0.1), no crack-band transient (cFx ≈ 0.04), and the NLMS
        // residual is zero (k converges to match the bass→crack coupling).
        // The Drive equation:  Drive = Res × cFx × bFct × sEF  →  0 × 0.04 × 0.1 × 0.2 = 0
        //
        // But the snare's reverb tail lives in 5-15kHz (the hh band). When a
        // synthetic snare fires, raw_hh_delta spikes sharply even though the
        // crack band is dead. We inject this treble-ghost as a parallel drive
        // path that bypasses the NLMS and crack-band entirely:
        //
        //   trebleGhost = raw_hh_delta × smartSef × (1 - spectralDensity)
        //
        // The (1 - spectralDensity) factor ensures the ghost only contributes
        // in CLEAN tracks (Tiesto: density 0.27 → ghost weight 0.73). In dense
        // tracks (Brejcha: density 0.46 → ghost weight 0.54) the ghost is
        // attenuated because the crack band already carries the signal and
        // hi-hats would contaminate the ghost path.
        //
        // The final Drive is the max of the crack path and the ghost path:
        //   snareDrive = max(crackDrive, trebleGhost)
        //
        // This preserves the original behavior for acoustic snares (crack path
        // dominates) while rescuing synthetic snares (ghost path dominates).
        const rawHhDelta = input.raw_hh_delta ?? 0
        const crackDrive = residual * crackFlux * bodyFactor * smartSef
        const ghostWeight = 1.0 - spectralDensity
        const trebleGhost = rawHhDelta * smartSef * ghostWeight
        const snareDrive = Math.max(crackDrive, trebleGhost)

        // ── TÉRMINO C: sin envolvente ───────────────────────────────────────
        // snareDrive is per-frame and raw. The MACD does its own smoothing;
        // pre-smoothing it (as snareEnergy did) is what killed the transient.
        this._snareEmaFast += aF * (snareDrive - this._snareEmaFast)
        this._snareEmaSlow += aS * (snareDrive - this._snareEmaSlow)
        let momentum = this._snareEmaFast - this._snareEmaSlow

        // ── CRUCE TOPOLÓGICO (MACD, intacto) ────────────────────────────────
        // momentum can only cross θ upward once per genuine energy rise; decay
        // tails cross downward. Anti-retrigger is topology, not a cooldown.
        // ⚒️ WAVE 7749.80: momoTh → dynamicMomoTh (breathes with spectral density)
        const isCrossover = momentum > dynamicMomoTh && this._snarePrevMomentum <= dynamicMomoTh

        // Noise floor on the decorrelated+fluxed drive (not on raw energy).
        const snareFloor = p.snareMomentumFloor ?? 0
        rawOnset = isCrossover && snareDrive >= snareFloor

        this._diagCrackBleedK = this._crackBleedK
        this._diagSnareResidual = residual
        this._diagCrackFlux = crackFlux
        this._diagBodyFactor = bodyFactor
        this._diagSnareEnergyFactor = smartSef
        this._diagSnareDrive = snareDrive
        // ⚒️ WAVE 7749.80: macro-awareness diagnostics
        this._diagDynamicMomoTh = dynamicMomoTh
        this._diagSpectralDensity = spectralDensity
        this._diagRawHhDelta = rawHhDelta
        this._diagTrebleGhost = trebleGhost
        // ⚒️ WAVE 7749.67: HYBRID RESET — on strong snares (momentum > reset
        // threshold), pull emaSlow toward emaFast by resetRatio. This forces
        // momentum back toward 0, allowing re-fire on the next snare in a
        // dense burst. Weak snares do NOT reset → anti-jitter preserved.
        // snareperfecto.md: 32→40 onsets (off-beat 16ths recovered).
        // imposiblesnare.md: stays at 18 (no jitter regression).
        if (rawOnset) {
          const resetTh = p.snareMomentumResetThreshold
          if (resetTh !== undefined && momentum > resetTh) {
            const ratio = p.snareMomentumResetRatio ?? 0.70
            this._snareEmaSlow += ratio * (this._snareEmaFast - this._snareEmaSlow)
            momentum = this._snareEmaFast - this._snareEmaSlow
          }
        }
        this._snarePrevMomentum = momentum
        // WAVE 7749.3: Reset prev energy on silence — after a break/drop,
        // both EMAs were stuck high from the last beat. When audio resumes,
        // the momentum was negative → no onset → slow recovery. Reset to 0
        // when energy drops to near-silence so the first returning beat fires.
        // ⚒️ WAVE 7749.74: condition now tracks snareDrive (what the EMAs eat),
        // not snareEnergy — the gated energy no longer drives this detector.
        // ⚒️ WAVE 7749.79: SILENCE RESET REFINEMENT — require 8 consecutive
        // frames (~182ms @ 44fps) of Drive < 0.01 before resetting. The
        // previous 1-frame reset nuked emaSlow in the 1-2 frame silence gap
        // between a snare's decay tail and the next kick, eliminating the
        // MACD's inertia and causing double-triggers. With 8 frames, emaSlow
        // decays naturally (5% per frame → ~34% over 8 frames) and blocks
        // spurious crossings from kick bleed or decay artifacts. Resets only
        // fire in genuine breaks/drops (>182ms of silence).
        if (this._snareEmaSlow > 0.10 && snareDrive < 0.01) {
          this._snareSilenceFrames++
          if (this._snareSilenceFrames >= LiquidEngineBase.SILENCE_RESET_FRAMES) {
            this._snareEmaFast = 0
            this._snareEmaSlow = 0
            this._snarePrevMomentum = 0
            this._snareSilenceFrames = 0
          }
        } else {
          this._snareSilenceFrames = 0
        }
      } else if (rawSnareDelta > finalSnareThreshold && spectralFlux > dynamicFluxGate && this._snareImpulse < 0.15) {
        // ⚒️ WAVE 7749.64: PROFILE-GATED BASSΔ FLOOR — anti-hi-hat surfer.
        //   In techno, bass is continuous → every hi-hat has bassE > 0.40.
        //   The bassE > 0.40 clause alone fires on every hat. This profile
        //   param (snarePath1BassDeltaFloor) requires the bass to be RISING
        //   to prove a real percussive hit. Techno sets 0.005; Latino omits
        //   (default 0 = legacy behavior, preserves off-beat snares).
        //   Data: techno hi-hats have bassDelta ≤ +0.002; real snares > +0.009.
        //         Latin off-beat snares have bassDelta -0.02 to +0.01 (need 0).
        const path1BassDeltaFloor = p.snarePath1BassDeltaFloor ?? 0
        if (wns > 0.3 && (snareEnergy > 0.15 || (bassE > 0.40 && bassDelta > path1BassDeltaFloor))) {
          // Path 1: WNS-confirmed — OMNI-GATE: WNS + contextual confirmation.
          // WNS > 0.3 proves broadband noise. SnareE > 0.15 proves crack-band
          // energy (real snare). BassE > 0.40 (+ bassDelta > floor per profile)
          // proves rhythmic context (snare co-occurs with a real bass hit,
          // not just surfing a continuous bassline). Sweeps fail both.
          // NO TCT restriction — WNS already proves broadband noise.
          rawOnset = true
        } else if (spectralFlux > 0.20 && this._snareReArmed && (snareEnergy > 0.45 || (snareEnergy > 0.15 && wns > 0.05) || (wns > 0.10 && bassE > 0.40 && snareEnergy > 0.05))) {
          // WAVE 7749.18 → 7749.56 → 7749.58 → 7749.60: HIGH-FLUX BYPASS — OMNI-GATE v3.
          // In melodic techno (Anyma, Tale of Us, etc.), snares are synthesized
          // noise bursts or electronic claps that don't produce the broadband HF
          // noise content WNS expects. They have WNS = 0 across ALL frames.
          // But they DO have explosive spectral flux (> 0.20) that kicks never
          // reach (kicks are bass-band only, Flux < 0.10) and synth stabs never
          // reach (stabs are 0.10-0.15). The Flux > 0.20 threshold cleanly
          // separates synthesized snares from kicks/stabs in the WNS = 0 zone.
          // Empirical data from techno14melodic (Anyma): 27 synth snares with
          // Flux 0.20-0.32, WNS = 0 — all blocked by old WNS gate. 0 kicks with
          // Flux > 0.20. Genre-agnostic: works for acoustic (WNS path) and
          // electronic (Flux bypass) snares.
          // ⚒️ WAVE 7749.52: TCT guard — only fire if previous delta settled.
          // Prevents sustained synth sweeps from holding the onset open.
          // ⚒️ WAVE 7749.55 → 7749.56: OMNI-GATE v2 → v3 — hybrid clause 1 +
          // SnareE floor on clause 2.
          // ⚒️ WAVE 7749.58: BREJCHA BASSΔ DISCRIMINATOR — added bassDelta < 0.05
          //   to clause 1a to block kick-bleed. 
          // ⚒️ WAVE 7749.60: BASSΔ LOCK REMOVED — the HF "click" of Brejcha's
          //   kick hits the FFT 1-2 frames BEFORE the LF sub-bass boom peaks.
          //   At onset frame, BassDelta is still near zero (the bass hasn't
          //   risen yet), so the lock was useless AND blocked real snares
          //   whose bass ducking (sidechain) hadn't registered yet. Reverted
          //   clause 1a to pure SnareE > 0.45.
          //   Clause 1a (SnareE > 0.45): saturated synth snares (Anyma 0.46+)
          //     pass without WNS. Brejcha kick-bleed (SnareE 0.7-1.0) also
          //     passes — accepted trade-off; the WNS paths (1b, 2) and the
          //     Path 3 rescue handle the discrimination.
          //   Clause 1b (SnareE > 0.15 AND WNS > 0.05): acoustic snares with
          //     crack-band energy + broadband noise. WNS > 0.05 separates
          //     real snares (WNS 0.10+) from Gravity kicks (WNS 0.00-0.05).
          //   Clause 2 (WNS > 0.10 AND BassE > 0.40 AND SnareE > 0.05):
          //     broadband + rhythmic context + minimum crack energy. The
          //     SnareE > 0.05 floor blocks bass transients with SnareE = 0
          //     (gravityverse kicks with WNS 0.12-0.58 from broadband content
          //     but zero crack-band energy). Real snares always have SnareE > 0.05.
          // Blocks:
          //   - Tehnominimal sweeps: SnareE < 0.15, BassE < 0.40 → all fail.
          //   - Gravityverse bass transients: SnareE = 0 → clause 2 fails
          //     (SnareE > 0.05 required), clause 1 fails (SnareE = 0).
          rawOnset = true
          this._snareReArmed = false
        } else if (this._snareReArmed && (
          snareEnergy > 0.75 ||
          (snareEnergy > 0.25 && wns > 0.05)
        )) {
          // WAVE 7749.19 → 7749.62: ENERGY BYPASS — SnareE-grounded (no AGC).
          // Two conditions, any one sufficient:
          //   1. SnareE > 0.75 — saturated snare (dembow electronic, acoustic
          //      strike) = almost certainly real. Never occurs in Brejcha piano
          //      (max 0.66) or Anyma synth bleed (sporadic). Dembow saturates
          //      1.000. Acoustic snares hit 0.85-1.0.
          //   2. SnareE > 0.25 AND WNS > 0.05 — moderate crack-band energy
          //      with ANY broadband noise confirmation. This replaces the old
          //      AGC < 2.5 gate (which was too permissive at verse AGC ~1.6x,
          //      letting Brejcha kicks with click bleed through). WNS > 0.05
          //      is a minimal noise floor — kicks have WNS 0.000, so even a
          //      tiny WNS reading proves it's not a kick. This is stricter
          //      than AGC < 2.5 because AGC doesn't measure snare-ness, it
          //      measures compression. WNS measures noise content = physical
          //      evidence of a real percussion hit.
          // ⚒️ WAVE 7749.52: TCT guard — only fire if previous delta settled.
          rawOnset = true
          this._snareReArmed = false
        } else {
          // Pending: crack+flux say snare, but WNS hasn't arrived yet.
          // Wait 1 frame for WNS confirmation.
          this._snarePendingWns = true
        }
      } else if (this._snarePendingWns && wns > 0.05 && rawSnareDelta > 0.02 && (snareEnergy > 0.15 || bassE > 0.40) && this._snareImpulse < 0.15) {
        // WAVE 7749.17: Confirmation — WNS arrived 1 frame late.
        // OMNI-GATE: apply same contextual gate as Path 1 (SnareE > 0.15 OR
        // BassE > 0.40) to block sweeps. WNS threshold stays at 0.05 because
        // WNS may still be ramping (0.28-0.70 on confirmation frame). The
        // contextual gate is what blocks sweeps — they have SnareE ≈ 0 and
        // BassE < 0.30 regardless of WNS value.
        // ⚒️ WAVE 7749.56: rawSnareDelta > 0.02 — sign-of-attack veto. A real
        // snare confirmation must still show rising energy (RawΔ > 0). Noise
        // tails in gravityverse verse have WNS 0.10-0.96 but RawΔ ≤ 0 (decay).
        // Requiring RawΔ > 0.02 fulminates phantom snares in noise tails.
        rawOnset = true
        this._snarePendingWns = false
      } else if (this._snareReArmed && wns > 0.50 && snareEnergy > 0.10 && rawSnareDelta > 0.05 && spectralFlux > dynamicFluxGate && this._snareImpulse < 0.15) {
        // WAVE 7749.58: PATH 3 — WNS-confirmed soft snare.
        // In latin genres (reggaeton, bachata, cumbia), snares can be soft
        // with RawΔ below finalSnareThreshold (~0.15) but WNS very high
        // (> 0.50 = pure broadband noise = real snare/cymbal/güira).
        // When WNS is this high, we have physical certainty of a real
        // percussion hit. We can lower the RawΔ requirement to 0.05.
        // This catches missed snares like reguetonsnare1.md L589
        // (WNS 0.758, RawΔ 0.097) without opening the door to kicks
        // (kicks have WNS 0.000 in latin mixes).
        // ⚒️ WAVE 7749.62: snareEnergy > 0.10 floor — HI-HAT SILENCER.
        //   Minimal techno hi-hats have WNS = 1.0 (pure broadband noise) but
        //   SnareE = 0.000 (zero crack-band energy). Without this floor, Path 3
        //   was triggering on every hi-hat in minimal techno. A real snare
        //   ALWAYS has some crack-band energy (SnareE > 0.10), even soft latin
        //   snares. Hi-hats/cymbals never do.
        // TCT guard (_snareReArmed) prevents sustained noise tails from
        // holding the onset open.
        rawOnset = true
        this._snarePendingWns = false
        this._snareReArmed = false
      } else if (this._snareReArmed && snareEnergy > 0.25 && rawSnareDelta > 0.05 && spectralFlux > 0.10 && agcGain < 2.5) {
        // ⚒️ WAVE 7749.61: PATH 4 — Hybrid Minimal Snare (Valley of Death).
        // Brejcha-style minimal techno uses hybrid snares that sit in a
        // "valley of death" between all existing thresholds:
        //   - SnareE 0.32 (moderate crack-band, below clause 1a's 0.45)
        //   - RawΔ 0.07-0.10 (below main threshold 0.15)
        //   - Flux 0.12-0.16 (below high-flux bypass 0.20)
        //   - WNS 0.00-0.05 (below Path 3's 0.50)
        // None of the existing paths catch them. But they ARE real snares —
        // the SnareE > 0.25 floor proves crack-band energy (kicks never have
        // SnareE > 0.25 without also having Flux < 0.05), and Flux > 0.10
        // separates them from kicks (Brejcha kicks: Flux 0.03-0.05).
        // The agcGain < 2.5 safeguard is critical: in quiet breakdowns, AGC
        // inflates to 3.0x+ and kicks' Flux rises to 0.10-0.15. Without this
        // guard, Path 4 would false-trigger on AGC-amplified kicks. The 2.5
        // threshold matches Path 2's existing AGC safeguard (line 857).
        // Empirical data from curioso.md (Brejcha verse):
        //   4 missed snares: SnareE 0.32-0.36, RawΔ 0.07-0.10, Flux 0.12-0.16,
        //   WNS 0.00-0.05, AGC 1.77-1.81x → ALL caught by Path 4. ✅
        //   0 kicks false-triggered: kicks have Flux 0.03-0.10 but SnareE
        //   0.04-0.25 (borderline) — SnareE > 0.25 floor blocks them. ✅
        rawOnset = true
        this._snarePendingWns = false
        this._snareReArmed = false
      } else {
        // No onset and no pending confirmation — clear the pending flag.
        this._snarePendingWns = false
      }
      snareOnsetThisFrame = rawOnset
      this._diagSnareOnset = rawOnset

      if (rawOnset) {
        this._snareImpulse = 1.0
      }

      // WAVE 7749.3: Use pre-decay impulse for THIS frame's output.
      // WAVE 7749.7: Impulse decay is now profile-tunable (snareImpulseDecay).
      // ⚒️ WAVE 7749.60: Default 0.65 (smooth tail — ~200ms to decay 1.0→0.01).
      //   Was 0.40 (~120ms) which caused a 3-frame visual stutter (1.0→0.45→0.19)
      //   perceived as "3 broken hits per beat". 0.65 gives a single cohesive
      //   strike with a natural fade: 1.0→0.65→0.42→0.27→0.18.
      const snareImpulseThisFrame = this._snareImpulse
      this._snareImpulse *= (p.snareImpulseDecay ?? 0.65)
      this._prevSnareEnergy = rawSnareEnergy
      // ⚒️ WAVE 7749.52: Track previous delta for TCT re-arm discriminator.
      this._prevRawSnareDelta = rawSnareDelta

      // WAVE 7749.9: hybridSnare is driven EXCLUSIVELY by the pure physics
      // impulse. No max-blend with the legacy percRaw (which was exterminated).
      hybridSnare = snareImpulseThisFrame
    }

    // ═══════════════════════════════════════════════════════════════════
    // WAVE 7749: SUSTAIN CHOKE — A snare explodes and decays in <100ms.
    // A vocal sustains. If snare_energy stays elevated without new onsets,
    // it's a vocal/synth tail, not a snare. Choke the envelope exponentially.
    //
    // Mechanism: Track frames since last TRUE onset. If frames > chokeThreshold,
    // apply exponential decay to hybridSnare. The choke releases instantly
    // when a new true onset fires. This kills sustained tails within ~100ms.
    //
    // WAVE 7749.3: HIGH-ENERGY GUARD — In dense techno, snare_energy stays
    // high (0.3-0.6) but flat (no delta → no onsets). The choke was killing
    // real continuous percussion. Fix: if snare_energy > 0.15, the percussion
    // is still active — don't choke. Only choke when energy is actually fading
    // (low energy sustained = vocal/synth tail, not percussion).
    // ZERO-ALLOC: All state is pre-allocated on the class.
    // ═══════════════════════════════════════════════════════════════════
    if (input.snare_energy !== undefined) {
      const rawSnareEnergy = input.snare_energy
      if (snareOnsetThisFrame) {
        // New true onset — reset sustain counter, release choke
        this._snareSustainFrames = 0
        this._snareChokeFactor = 1.0
      } else {
        this._snareSustainFrames++
        // After chokeThreshold frames without a new onset, start choking —
        // BUT only if snare_energy has faded below 0.15.
        // High sustained energy = continuous percussion (techno), not a tail.
        const chokeThreshold = p.snareChokeFrames ?? 2
        if (this._snareSustainFrames > chokeThreshold && rawSnareEnergy < 0.15) {
          // Exponential choke: 0.70 per frame (~15ms half-life at 44Hz)
          this._snareChokeFactor *= (p.snareChokeRate ?? 0.70)
        } else if (rawSnareEnergy >= 0.15) {
          // Energy still high — percussion is active, not a tail. Hold the choke.
          this._snareChokeFactor = 1.0
        }
      }
      hybridSnare *= this._snareChokeFactor
    }

    // ═══════════════════════════════════════════════════════════════════
    // WAVE 7749: TONALITY VETO — Multi-dimensional snare isolation
    // A snare is broadband noise. A vocal/synth is tonal. If a snare
    // onset is detected in frequency but the signal is tonal, VETO it.
    // This kills vocal consonants, synth stabs, and bass pops that
    // masquerade as snares in the frequency-band detector.
    //
    // THREE ORTHOGONAL AXES:
    //   1. flatness (Wiener entropy) — tonal vs noise
    //   2. whiteNoiseScore (HF broadband) — cymbal/snare sizzle vs vocal/synth
    //   3. spectralFlux (spectral change rate) — impulse vs sustain
    //
    // The veto is a multiplicative AND-gate, not a binary kill. This
    // preserves snare hits that are slightly tonal (rimshots, claps)
    // while killing sustained tonal bleed. ZERO-ALLOC: scalar math only.
    // ═══════════════════════════════════════════════════════════════════
    const photon = input.photon
    if (photon !== undefined && hybridSnare > 0) {
      const wns = photon.whiteNoiseScore   // [0,1] — HF broadband
      const flux = photon.spectralFlux     // [0,~1] — spectral change rate

      // AXIS 1: Flatness gate — tonal signals get penalized
      // flatness < floor = pure tonal (vocal/synth) → veto factor 0
      // flatness floor-knee = mixed → linear ramp
      // flatness > knee = noise-like (snare/cymbal) → full pass
      // WAVE 7749.8: Defaults raised — 0.12→0.04 floor for flatness, 0.15→0.04 for wns,
      // 0.10→0.05 for flux. These are the fallbacks when no profile override exists.
      // Profile overrides (techno/latino) now also use 0.04/0.04/0.05.
      const flatFloor = p.snareVetoFlatnessFloor ?? 0.04
      const flatKnee = p.snareVetoFlatnessKnee ?? 0.25
      const flatnessGate = flatness < flatFloor
        ? 0.0
        : flatness < flatKnee
          ? (flatness - flatFloor) / (flatKnee - flatFloor)
          : 1.0

      // AXIS 2: whiteNoiseScore gate — broadband HF discriminates snare from vocal
      // wns < floor = no HF broadband (vocal consonant) → veto
      // wns floor-knee = partial (rimshot, clap) → partial pass
      // wns > knee = strong broadband (snare, cymbal) → full pass
      const wnsFloor = p.snareVetoWnsFloor ?? 0.04
      const wnsKnee = p.snareVetoWnsKnee ?? 0.35
      const wnsGate = wns < wnsFloor
        ? 0.0
        : wns < wnsKnee
          ? (wns - wnsFloor) / (wnsKnee - wnsFloor)
          : 1.0

      // AXIS 3: spectralFlux gate — sustained tonal energy has low flux
      // A snare hit = explosive flux spike. A vocal sustain = low flux.
      // flux < floor = sustained (vocal tail) → veto
      // flux > knee = explosive (snare) → full pass
      const fluxFloor = p.snareVetoFluxFloor ?? 0.05
      const fluxKnee = p.snareVetoFluxKnee ?? 0.30
      const fluxGate = flux < fluxFloor
        ? 0.0
        : flux < fluxKnee
          ? (flux - fluxFloor) / (fluxKnee - fluxFloor)
          : 1.0

      // COMBINED VETO: AVERAGE (not multiplication) — WAVE 7749.4
      // Real-world dense techno (Brejcha @ 100% volume) proves flatness and WNS
      // are crushed by sub-bass density (flatness 0.03-0.07, WNS mostly 0.000).
      // Only spectralFlux survives as a discriminator. The average lets 1 strong
      // axis compensate for 2 weak axes. Soft-knee at 0.15 lets borderline hits through.
      // A vocal consonant: flatnessGate=0.02, wnsGate=0, fluxGate=0.05 → avg=0.02 (suppressed)
      // A techno snare:    flatnessGate=0.34, wnsGate=0, fluxGate=0.97 → avg=0.44 (PASSES)
      const vetoFactor = (flatnessGate + wnsGate + fluxGate) / 3.0
      // ⚒️ WAVE 7749.53: capture veto factor for FINESSE_AUDIT
      this._diagVetoFactor = vetoFactor
      // WAVE 7749.4: Soft-knee lowered 0.20→0.15. Below 0.15, ramp up linearly
      // (vetoFactor / 0.15) instead of 2x gain, for smoother transition.
      hybridSnare *= (vetoFactor > 0.15 ? 1.0 : (vetoFactor / 0.15))

      // WAVE 7749.9: Telemetry Transparency — log EVERY frame with no throttling.
      // We need to see the absolute raw truth of what the math is detecting
      // frame-by-frame. If there are false positives, we see them and fix the math.
      // WAVE 7749.22: DISABLED — snare 4D is now production-ready across all
      // genres (techno acoustic, techno melodic/Anyma, latino). Back R is perfect.
      // Commented out to stop console spam. Re-enable for future debugging.
      // console.log(
      //   `[SNARE_TELEMETRY] ` +
      //   `E:${input.snare_energy?.toFixed(3) ?? 'N/A'} | ` +
      //   `RawΔ:${input.raw_snare_delta === undefined ? 'UNDEF' : input.raw_snare_delta.toFixed(3)} | ` +
      //   `Flat:${flatness.toFixed(3)} (Gate:${flatnessGate.toFixed(2)}) | ` +
      //   `WNS:${wns.toFixed(3)} (Gate:${wnsGate.toFixed(2)}) | ` +
      //   `Flux:${flux.toFixed(3)} (Gate:${fluxGate.toFixed(2)}) | ` +
      //   `Veto:${vetoFactor.toFixed(3)} -> Out:${hybridSnare.toFixed(3)}` +
      //   (snareOnsetThisFrame ? ' [ONSET]' : '')
      // )

    }

    // 2. THE MORPHOLOGIC CENTROID SHIELD (WAVE 2449)
    // El bombo puede coexistir con synths en techno melódico (Anyma) porque el bombo
    // es el instrumento melódico — mismo centroide, indistinguibles con frecuencia fija.
    // morphFactor resuelve la ambigüedad: en Anyma es alto, el suelo baja, los synths pasan.
    // En techno industrial el suelo sube y bloquea el cuerpo del bombo sin compasión.
    //
    // morphFactor 0.1 (militar/duro)     → centroidFloor ≈ 810 Hz (bloqueo total)
    // morphFactor 0.8 (melódico/líquido) → centroidFloor ≈ 180 Hz (puerta abierta)
    //
    // El Salvoconducto Dubstep: harshness alto sobre un bombo = snare fill / efecto brutal.
    // Si harshness < 0.024 es bombo puro o decay — se bloquea. Si ≥ 0.024 hay acción real.
    if (isKick) {
      const centroidFloor = 900 * (1.0 - morphFactor)
      const currentCentroid = input.spectralCentroid ?? 0
      const DUBSTEP_SNARE_MIN_HARSHNESS = 0.024
      if (currentCentroid < centroidFloor && harshness < DUBSTEP_SNARE_MIN_HARSHNESS) {
        hybridSnare = 0.0
      }
    }

    this._lastHybridSnare = hybridSnare
    const snareAttack = hybridSnare
    // WAVE 2451: morphFactor real (antes 1.0 hardcodeado).
    // En Anyma (morph≈0.8) el decay = decayBase + decayRange×0.8 → más flote, más relleno.
    // En techno industrial (morph≈0.1) el decay = decayBase + decayRange×0.1 → percutivo.
    let backRight = this.envSnare.process(hybridSnare, morphFactor, now, false)

    // ⚒️ WAVE 7749.53: FINESSE_AUDIT — High-precision telemetry for leakage diagnosis.
    // Logs ONLY on frames with snare onset, kick activity, or significant snare output.
    // Purpose: see exactly why massive kicks (Brejcha) cross-talk into the snare band,
    // and why autotune voices/synths sneak past the tonality veto.
    // Metrics:
    //   SnareE  — snare_energy (crack band 2-5kHz)
    //   RawΔ    — raw_snare_delta (pre-EMA transient edge)
    //   Flux    — spectralFlux (spectral change rate)
    //   WNS     — whiteNoiseScore (broadband HF noise)
    //   fBL     — fluxBaseline EMA (density tracker)
    //   Gate    — dynamic snare threshold (finalSnareThreshold)
    //   Veto    — tonality veto factor (0=blocked, >0.15=passes)
    //   BassE   — pureBassEnergy (kick band)
    //   BassΔ   — bassDelta (kick transient edge)
    //   OutSnare— final backRight (after envSnare)
    //   OutKick — final frontRight (after envKick)
    if (this._diagSnareOnset || this._diagIsKick || hybridSnare > 0.1) {
      console.log(
        `[FINESSE_AUDIT] ` +
        `SnareE:${this._diagSnareEnergy.toFixed(3)} ` +
        `UnG:${this._diagSnareEnergyUngated.toFixed(3)} ` +
        `RawΔ:${this._diagRawSnareDelta.toFixed(3)} ` +
        `Flux:${this._diagFlux.toFixed(3)} ` +
        `WNS:${this._diagWns.toFixed(3)} ` +
        `fBL:${this._fluxBaseline.toFixed(3)} ` +
        `Gate:${this._diagFinalThreshold.toFixed(3)} ` +
        `Veto:${this._diagVetoFactor.toFixed(3)} ` +
        `BassE:${this._diagBassEnergy.toFixed(3)} ` +
        `BassΔ:${this._diagBassDelta.toFixed(3)} ` +
        // ⚒️ WAVE 7749.76: bass-decorrelation chain — k=bleed coeff learned by
        // NLMS (μ_up=0.015 fast convergence), Res=residual after subtracting kick
        // bleed, cFx=crack-band spectral flux (2-5kHz localized), bFct=body factor
        // [0.1,2.0] (continuous algebraic gate from snareBody/snareBodyEMA),
        // Drive=Res*cFx*bFct = what the MACD actually eats. cFx replaces global
        // Flux to avoid hi-hat (10kHz) and breakdown contamination. bFct replaces
        // the hard SnareE gate — claps/rimshots (no body) get penalized toward 0.1,
        // real snares (body > EMA) get boosted up to 2.0.
        `k:${this._diagCrackBleedK.toFixed(3)} ` +
        `Res:${this._diagSnareResidual.toFixed(3)} ` +
        `cFx:${this._diagCrackFlux.toFixed(3)} ` +
        `bFct:${this._diagBodyFactor.toFixed(3)} ` +
        `sEF:${this._diagSnareEnergyFactor.toFixed(3)} ` +
        `Drive:${this._diagSnareDrive.toFixed(3)} ` +
        `dynTh:${this._diagDynamicMomoTh.toFixed(3)} ` +
        `hhDlt:${this._diagRawHhDelta.toFixed(3)} ` +
        `ghst:${this._diagTrebleGhost.toFixed(3)} ` +
        `OutSnare:${backRight.toFixed(3)} ` +
        `OutKick:${frontRight.toFixed(3)}` +
        (this._diagSnareOnset ? ' [ONSET]' : '') +
        (this._diagIsKick ? ' [KICK]' : '')
      )
    }

    // ═══════════════════════════════════════════════════════════════════
    // MOVERS: WAVE 911 (strict-split) vs ENVELOPE CROSS-FILTER (otros)
    // ═══════════════════════════════════════════════════════════════════
    //
    // El motor es AGNOSTICO — cada perfil define su propio ADN de movers.
    // 'strict-split' (techno industrial) usa WAVE 911: raw math de bandas,
    //   hardcodeado para el espectro especifico de techno (mid-heavy, sin highMid).
    // Cualquier otro perfil usa el sistema de envolventes parametrizado:
    //   - Mover L: cross-filter (highMid × weight + treble × weight + mid × weight)
    //              filtrado por gate tonal (flatness < moverLTonalThreshold)
    //              procesado por envTreble (El Galan, decay largo latino)
    //   - Mover R: cleanMid (mid - bass × subtractFactor) - treble × moverRTrebleSub
    //              procesado por envVocal (La Dama, brillo + trompetas)
    // Esto garantiza que Latino, Pop-Rock, Chill y futuros perfiles tengan su
    // fisica propia sin tocar una sola linea del motor.

    let moverLeft: number
    let moverRight: number

    // --- ENVELOPE CROSS-FILTER — Motor Parametrizado por Perfil (WAVE 2457) ---
    // WAVE 6064: Desacoplado de layout41Strategy. Todos los perfiles usan envelopes.
    // El layout solo decide enrutamiento espacial (frontPar/backPar), no física.

    // MOVER L: cross-filter tonal (El Galan / Melodista / segun perfil)
    //   input = max(0, highMid×mH + treble×tW + mid×mW)
    //   Gate tonal: si flatness >= moverLTonalThreshold → ruido, cortar
    const moverLRaw = Math.max(0,
      bands.highMid * p.moverLHighMidWeight +
      bands.treble  * p.moverLTrebleWeight  +
      bands.mid     * p.moverLMidWeight
    )
    const isTonal = flatness < p.moverLTonalThreshold ? 1.0 : 0.0
    const moverLInput = moverLRaw * isTonal
    moverLeft = this.envTreble.process(moverLInput, morphFactor, now, isBreakdown)

    // MOVER R: cleanMid con bass-subtractor adaptativo (La Dama / Terminator vocal)
    //   subtractFactor = base - morphFactor × range
    //   cleanMid = max(0, mid - bass × subtractFactor)
    //   crossInput = max(0, cleanMid - treble × moverRTrebleSub)
    const subtractFactor = p.bassSubtractBase - morphFactor * p.bassSubtractRange
    const cleanMid = Math.max(0, bands.mid - bands.bass * subtractFactor)
    const moverRInput = Math.max(0, cleanMid - bands.treble * p.moverRTrebleSub)
    moverRight = this.envVocal.process(moverRInput, morphFactor, now, isBreakdown)

    // Sidechain del kick inline — universal (WAVE 2439)
    if (isKick) {
      moverLeft  *= (1.0 - p.sidechainDepth)
      moverRight *= (1.0 - p.sidechainDepth)
    }

    // WAVE 4812 M3: BACK L VOCAL GATE — vocalPenalty reubicado desde transient shaper legacy.
    // OPERACIÓN: Bypass para techno — no hay vocales dominantes, los sintes activan falsamente este mute.
    const isTechnoProfile = this.profile.id === 'techno-industrial'
    const vocalPenalty = isTechnoProfile ? 0 : Math.min(0.75, this._vocalSustainEMA * Math.max(0, 1.0 - midDelta / Math.max(0.001, this._vocalSustainEMA)))
    // --- BACK L (El Coro): WAVE 2417 RESURRECTION → WAVE 2430 PARAMETRIZADO ---
    // WAVE 4812 M3: BACK L VOCAL GATE — vocalPenalty suprime el componente mid
    // cuando hay vocal sostenida. El lowMid se conserva (instrumentos de armonia,
    // sintetizadores de cuerpo) pero el mid puro se atenúa junto con las vocales.
    // DMZ ACÚSTICA: sustracción espectral del bombo en medios antes de envHighMid
    const dmzFactor = isTechnoProfile ? 0.55 : 0.30 // WAVE 6065: DMZ adaptativa — techno bombo seco (0.55), latino bombo con cuerpo (0.30)
    const cleanMidL = Math.max(0, bands.mid - (bands.bass * dmzFactor))
    const midSynthInput = Math.max(0,
      bands.lowMid * p.backLLowMidWeight + cleanMidL * p.backLMidWeight * (1.0 - vocalPenalty * 0.80)
      - bands.treble * p.backLTrebleSub - bands.bass * p.backLBassSub
    )
    // WAVE 7748: HH ENERGY ADAPTER — Back L hi-hat isolation
    // Mirror of WAVE 8008 snare adapter. Converts hh_energy EMA from
    // RhythmicPercussionTracker into a shaped impulse and max-blends it
    // with midSynthInput. Preserves the mid-synth pad texture while letting
    // isolated hi-hat transients punch through Back L.
    // ZERO-ALLOC: All state is pre-allocated on the class. No closures,
    // no object spreading, no arrays. Only scalar math in the hot path.
    let hhBlendInput = midSynthInput
    if (input.hh_energy !== undefined) {
      const rawHhEnergy = input.hh_energy
      const hhDelta = rawHhEnergy - this._prevHhEnergy

      // Onset detection: derivative + absolute threshold + 60ms cooldown
      // Hi-hats fire faster than snares — 60ms allows 16th notes at 160 BPM
      const hhOnset = hhDelta > 0.008 && rawHhEnergy > 0.04 && (now - this._lastHhOnset > 60)

      if (hhOnset) {
        this._lastHhOnset = now
        this._hhImpulse = 1.0
      }

      // Fast decay — 3% retained per frame (~70ms at 44Hz)
      // Shorter hold than snare (4% / ~90ms) — hi-hats are staccato
      this._hhImpulse *= 0.03
      this._prevHhEnergy = rawHhEnergy

      // Max-blend: existing midSynthInput survives as pad texture,
      // hhImpulse punches isolated hi-hat transients on top.
      hhBlendInput = Math.max(midSynthInput, this._hhImpulse * (p.hhBlendGain ?? 0.6))
    }
    const backLeftGain = isTechnoProfile ? 1.45 : 1.75 // WAVE 6065: gain adaptativo — latino necesita más empuje para llegar a 1.0
    let backLeft = Math.min(1.0, this.envHighMid.process(hhBlendInput, morphFactor, now, isBreakdown) * backLeftGain) // OPERACIÓN: Gain para cruzar el umbral hacia 1.0 en pico

    // moverLeft y moverRight calculados por envelopes cross-filter arriba

    // WAVE 8005.2: PHOTON STROBE — Back channels preserved (strobe only affects front)

    // ═══════════════════════════════════════════════════════════════════
    // 7. APOCALYPSE MODE (universal)
    // ═══════════════════════════════════════════════════════════════════
    const isApocalypse = harshness > p.apocalypseHarshness && flatness > p.apocalypseFlatness
    if (isApocalypse) {
      const chaosEnergy = Math.max(bands.mid, bands.treble)
      backRight = Math.max(backRight, chaosEnergy)
      moverLeft = Math.max(moverLeft, chaosEnergy)
      moverRight = Math.max(moverRight, chaosEnergy)
    }

    // ═══════════════════════════════════════════════════════════════════
    // 8. STROBE
    // ═══════════════════════════════════════════════════════════════════
    const strobeResult = this.calculateStrobe(bands.treble, bands.ultraAir, noiseMode)

    // WAVE 4826.5 — EFECTO GÜIRO INYECTADO EN STROBE (El verdadero FLASH dorado)
    // Detectar drops realistas e inyectar trebleDelta puro para flashes dorados en Tungsten
    const isDrop = bands.bass < 0.35 && bands.lowMid < 0.4
    if (isDrop && trebleDelta > 0.25) {
      strobeResult.active = true
      strobeResult.intensity = Math.min(1.0, strobeResult.intensity + trebleDelta * 2.0)
    }

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
    // ═══════════════════════════════════════════════════════════════════
    // WAVE 4520.2: 9-ZONE FINAL SIGNALS
    // ═══════════════════════════════════════════════════════════════════
    // ⚒️ WAVE 7749.52: Floor — bassDelta onset-driven, envFloor processed.
    // The old raw passthrough (subBass × 0.65 + lowMid × 0.35) reacted to
    // sustained amplitude, causing the Front Par to strobe on sustained
    // sub-bass notes (reggaeton wobble, synth bass). Now we feed ONLY the
    // bassDelta (transient impact) through envFloor, which has a strict
    // gate + fast decay. A sustained bassline has bassDelta ≈ 0 after the
    // first frame → envFloor decays to 0 → no strobe. A kick or note onset
    // has a sharp bassDelta spike → envFloor fires → floor laser pulses.
    const _floorInput = Math.max(0, bassDelta) * 2.0  // amplify the small delta
    const floorIntensity = this.envFloor.process(_floorInput, morphFactor, now, isBreakdown)
    // ambient: slow EMA of subBass, no morphGain baseline — NOT gated by recoveryFactor.
    // WAVE 4812 M2: gain=1.0 — el ambient no tiene onda estática; solo brilla cuando
    // hay energía sub-grave real. El morphFactor ya no infla el baseline.
    const _ambientRaw = Math.min(1.0, Math.max(0.0, this._ambientEMA))
    // 🌊 WAVE 4814: Curva cuadrática (antes cúbica ^3.5) + noise-gate bajado.
    // ^2.0: subBass=0.40 → 0.16, subBass=0.60 → 0.36. El sub-grave real brilla.
    // gate=0.03 (antes 0.15): valores típicos de subBass (0.25-0.50) ahora pasan.
    // WAVE 7573: exponentes configurables via perfil (defaults 2.0 / 1.3).
    const _ambientCrushExp = p.ambientCrushExponent ?? 2.0
    const _ambientCrushed = Math.pow(_ambientRaw, _ambientCrushExp)
    // WAVE 4826.3 — PRE-GAIN + CONTRASTE EXTREMO
    // Ganancia pre-curva para compensar falta de graves en latino (1.35x boost)
    // Luego expansión ^1.3 para contraste más suave (es ^1.6 era demasiado agresivo)
    // WAVE 2522: ambientGain configurable — default 1.35 (valor WAVE 4826.3).
    // Perfiles con ambientGain > 1.35 boostean la intensidad ambiental.
    const _ambientGain = p.ambientGain ?? 1.35
    let preGainAmbient = Math.min(1.0, _ambientCrushed * _ambientGain)
    const _ambientOutputExp = p.ambientOutputExponent ?? 1.3
    let ambientIntensity = Math.pow(preGainAmbient, _ambientOutputExp)
    // WAVE 4826.1 — Reemplazar gate binario por fade exponencial suave para Tungsten en Ambient
    if (ambientIntensity < 0.03) {
      ambientIntensity *= 0.85
      if (ambientIntensity < 0.001) ambientIntensity = 0
    }
    // ⚒️ WAVE 7749.52: Air — envAir processed (zero-attack, fast decay).
    // The old _airEMA soft-follower is replaced by envAir (LiquidEnvelope).
    // Input: treble × 0.6 + highMid × 0.4 (same spectral source as before,
    // but now with strict gate + crush instead of soft EMA).
    // envAir gives zero-attack (riseRate=1.0), fast decay (0.08, ~45-65ms),
    // high gate (0.35), high crush (2.5). Spectrally isolated above the snare
    // body (2-6kHz). Ideal for aerial laser stabs and sharp beams.
    const _airInput = bands.treble * 0.60 + bands.highMid * 0.40
    const airIntensity = this.envAir.process(_airInput, morphFactor, now, isBreakdown)

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
      rawHighMidDelta: highMidDelta,
      rawMidDelta: midDelta,
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
      floorIntensity,
      ambientIntensity,
      airIntensity,
    }

    this.lastFrame = frame
    const result = this.routeZones(frame)
    this.lastResult = result
    return result
  }

  /** Resetea todo el estado interno */
  reset(): void {
    this.envSubBass.reset()
    this.envKick.reset()
    this.envVocal.reset()
    this.envSnare.reset()
    this.envHighMid.reset()
    this.envTreble.reset()
    // ⚒️ WAVE 7749.52: reset air & floor envelopes
    this.envAir.reset()
    this.envFloor.reset()
    this.avgMidProfiler = 0
    this.lastSilenceTime = 0
    this.inSilence = false
    this._strobeActive = false
    this.strobeStartTime = 0
    this.lastTreble = 0
    this._ambientEMA = 0
    // 🩸 WAVE 7749.52: _airEMA removed — envAir.reset() handles this
    // ⚒️ WAVE 7749.52: reset TCT re-arm state
    this._prevRawSnareDelta = 0
    this._snareReArmed = true
    // ⚒️ WAVE 7749.65: reset EMA momentum state
    this._snareEmaFast = 0
    this._snareEmaSlow = 0
    this._snarePrevMomentum = 0
    // ⚒️ WAVE 7749.74: reset learned kick→crack bleed coefficient
    this._crackBleedK = 0
  }

  // ─────────────────────────────────────────────────────────────────────
  // ABSTRACT — Las hijas implementan el mapeo de zonas
  // ─────────────────────────────────────────────────────────────────────

  protected abstract routeZones(frame: ProcessedFrame): LiquidStereoResult

  // ─────────────────────────────────────────────────────────────────────
  // WAVE 2513 — AMBIENT GENERATIVE ENGINE
  // Motor trigonométrico puro: sin GodEar, sin kicks, sin strobe.
  // Los seis osciladores tienen períodos primos entre sí (ms) para que
  // NUNCA coincidan en fase → nunca producen periodicidad perceptible.
  // El resultado es idéntico con música, en silencio o a 0 de volumen.
  // ─────────────────────────────────────────────────────────────────────

  private applyAmbientGenerative(morphFactor: number, now: number): LiquidStereoResult {
    // WAVE 2516 — THE ABSOLUTE SWELL: valores absolutos hardcodeados.
    // Sin dependencias de morphVariance ni variables dinámicas que puedan ser 0
    // cuando el audio está desconectado. Cada oscilador es completamente autónomo.

    // PARES — mínimo 0.10, rango 0.50 → [0.10 .. 0.60]
    const frontLeft  = 0.10 + ((Math.sin(now / 4003 + 0.000) + 1) / 2) * 0.50 // El Pulso del Abismo
    const frontRight = 0.10 + ((Math.sin(now / 3109 + 1.047) + 1) / 2) * 0.50 // La Corriente
    const backLeft   = 0.10 + ((Math.sin(now / 5303 + 0.628) + 1) / 2) * 0.50 // Las Algas
    const backRight  = 0.10 + ((Math.sin(now / 1901 + 1.571) + 1) / 2) * 0.20 // El Destello (rango estrecho)

    // MOVERS — mínimo 0.05, rango 0.55 → [0.05 .. 0.60]
    const moverLeft  = 0.05 + ((Math.sin(now / 9109  + 2.094) + 1) / 2) * 0.55 // La Voz del Mar
    const moverRight = 0.05 + ((Math.sin(now / 10303 + 3.926) + 1) / 2) * 0.55 // La Bioluminiscencia

    // Construimos el ProcessedFrame con GodEar vacío y osciladores como señales
    const frame: ProcessedFrame = {
      bands: { subBass: 0, bass: 0, lowMid: 0, mid: 0, highMid: 0, treble: 0, ultraAir: 0 },
      morphFactor,
      recoveryFactor: 1.0,
      isBreakdown: false,
      isVetoed: false,
      isKick: false,
      isKickEdge: false,
      acidMode: false,
      noiseMode: false,
      harshness: 0,
      flatness: 0,
      spectralCentroid: 0,
      rawTrebleDelta: 0,
      rawHighMidDelta: 0,
      rawMidDelta: 0,
      now,
      frontLeft,
      frontRight,
      backRight,
      snareAttack: 0,
      backLeft,
      moverLeft,
      moverRight,
      strobeActive: false,
      strobeIntensity: 0,
      // WAVE 4520.2: pure ambient — no audio, no floor/air reaction
      // ambient is driven by morphFactor directly (ocean depth = ambient depth)
      floorIntensity:   0,
      ambientIntensity: Math.min(1.0, morphFactor * 0.60),
      airIntensity:     0,
    }

    this.lastFrame = frame
    const ambResult = this.routeZones(frame)
    this.lastResult = ambResult
    return ambResult
  }

  private isAbsoluteChillProfile(): boolean {
    if (this.profile.isPureAmbient) return true
    const id = this.profile.id.toLowerCase()
    return id.includes('chill') || id.includes('ambient')
  }

  private clearAudioTransients(): void {
    this._kickVetoFrames = 0
    this._kickIntervalMs = 0
    this._lastKickTime = 0
    this._lastKickImpactTime = 0
    this._strobeActive = false
    this.strobeStartTime = 0
    this.lastTreble = 0
    this._vocalSustainEMA = 0
    // 🩸 WAVE 7749.52: _airEMA removed — envAir.reset() handles Air state
    // ⚒️ WAVE 7749.52: reset TCT re-arm state
    this._prevRawSnareDelta = 0
    this._snareReArmed = true
    // ⚒️ WAVE 7749.65: reset EMA momentum state
    this._snareEmaFast = 0
    this._snareEmaSlow = 0
    this._snarePrevMomentum = 0
    // ⚒️ WAVE 7749.74: reset learned kick→crack bleed coefficient
    this._crackBleedK = 0
    // WAVE 7748: Reset HH adapter state
    this._prevHhEnergy = 0
    this._lastHhOnset = 0
    this._hhImpulse = 0
    // WAVE 7749: Reset Sustain Choke state
    this._snareSustainFrames = 0
    this._snareChokeFactor = 1.0
  }

  private applyGlacierPalette(morphFactor: number): number {
    return Math.min(1.0, Math.max(0.0, morphFactor))
  }

  private renderPureGlacierPayload(morphFactor: number, now: number): LiquidStereoResult {
    return this.applyAmbientGenerative(morphFactor, now)
  }

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
      floorIntensity:   0,
      ambientIntensity: 0,
      airIntensity:     0,
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

