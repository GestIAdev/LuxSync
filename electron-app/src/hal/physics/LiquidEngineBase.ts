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

  // WAVE 6070: Frame Hold para snare — extiende el pulso de la caja ~90ms para hardware DMX
  private _snareHoldCounter: number = 0

  // WAVE 6070.2: Debounce Anti-Jitter — cooldown de 80ms para evitar re-triggers del mismo clap
  private _lastSnareTime: number = 0

  // WAVE 8008 ADAPTER: Pre-procesador snare_energy EMA → impulso binario
  // Convierte la señal continua del RhythmicPercussionTracker en impulsos
  // compatibles con LiquidEnvelope (diseñado para señales binarias 0/1)
  private _prevSnareEnergy: number = 0
  private _lastSnareOnset: number = 0
  private _snareImpulse: number = 0
  protected _lastHybridSnare: number = 0

  // WAVE 7748: HH ENERGY ADAPTER — Pre-allocated state for hi-hat impulse
  // Mirrors _prevSnareEnergy/_lastSnareOnset/_snareImpulse pattern.
  // All scalars, zero allocation in hot path.
  private _prevHhEnergy: number = 0
  private _lastHhOnset: number = 0
  private _hhImpulse: number = 0

  // Kick Veto state
  private _kickVetoFrames = 0

  // Transient Shaper state (WAVE 2427 → WAVE 2446)
  private lastTreble: number = 0
  private lastHighMid: number = 0
  private lastMid: number = 0

  // WAVE 4520.2: 9-zone EMA state
  // Ambient: slow follower of subBass. Attack ~5 frames, release ~33 frames.
  private _ambientEMA: number = 0
  // Air: soft-compressed follower of (treble × 0.6 + highMid × 0.4). Attack ~8 frames, release ~20 frames.
  private _airEMA: number = 0
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

    // Air EMA: soft-compressed follower of (treble × 0.6 + highMid × 0.4)
    // Compression: 1 - e^(-x*3) — prevents ultraAir spikes from causing hysterics
    // Attack alpha=0.12 (~8 frames), release alpha=0.05 (~20 frames)
    const _airSignal = 1.0 - Math.exp(-(bands.treble * 0.60 + bands.highMid * 0.40) * 3.0)
    if (_airSignal > this._airEMA) {
      this._airEMA = this._airEMA * 0.88 + _airSignal * 0.12
    } else {
      this._airEMA = this._airEMA * 0.95 + _airSignal * 0.05
    }

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

    // WAVE 6070: FUSIÓN HÍBRIDA — Transient Shaper (Tiempo) * Espectro Tolerante
    // 1. ESPECTRO TOLERANTE: Sumamos los agudos en lugar de multiplicarlos.
    // Así un clap con mucho harshness pero poco treble sobrevive.
    const rawSpike = highMidDelta + trebleDelta
    const snareSpectrum = bands.mid * ((bands.treble * 0.5) + harshness) // Anti-HiHat: treble puro a la mitad, harshness de cajas/claps intacto

    // rawSpike es el transitorio temporal calculado previamente
    const rawSnareCalc = (rawSpike * snareSpectrum * 10.0) > 0.19 // Anti-Compresión: ×10.0 + umbral 0.19 atrapa snares aplastados por mastering del drop

    // WAVE 6070.2: Debounce Anti-Jitter — 45ms permite fusas a 130 BPM (1 impacto = 1 disparo)
    const isSnareImpact = rawSnareCalc && (now - this._lastSnareTime > 45)

    if (isSnareImpact && this._snareHoldCounter === 0) {
      this._snareHoldCounter = 4 // ~90ms de retención para que el DMX respire
      this._lastSnareTime = now
    }

    const percRaw = this._snareHoldCounter > 0 ? 1.0 : 0.0

    if (this._snareHoldCounter > 0) {
      this._snareHoldCounter--
    }

    let hybridSnare = percRaw

    // ═══════════════════════════════════════════════════════════════════
    // WAVE 8008 ADAPTER: Pre-procesador snare_energy EMA → impulso binario
    // Cuando GodEarFFT V3 suministra snare_energy (EMA continua del
    // RhythmicPercussionTracker), convertirla a impulso binario con decay
    // rápido antes de alimentar LiquidEnvelope. Esto preserva la lógica
    // original del envelope sin modificaciones.
    // ═══════════════════════════════════════════════════════════════════
    if (input.snare_energy !== undefined) {
      const rawSnareEnergy = input.snare_energy
      const snareDelta = rawSnareEnergy - this._prevSnareEnergy

      // Detectar onset: derivada positiva significativa + umbral absoluto + cooldown 80ms
      // WAVE 8009.2: umbrales bajados 0.02→0.01 y 0.12→0.06 para capturar micro-percusión minimal
      const snareOnset = snareDelta > 0.01 && rawSnareEnergy > 0.06 && (now - this._lastSnareOnset > 80)

      if (snareOnset) {
        this._lastSnareOnset = now
        this._snareImpulse = 1.0
      }

      // Decay artificial rápido — 4% restante por frame (~90ms a 44Hz)
      this._snareImpulse *= 0.04
      this._prevSnareEnergy = rawSnareEnergy

      // WAVE 8009.4: Max-blend en lugar de reemplazo — el transient shaper original
      // sobrevive como respaldo cuando GodEarFFT no detecta snare (techno: body saturado por bombo)
      hybridSnare = Math.max(percRaw, this._snareImpulse)
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
    // floor: instant reaction to subBass+lowMid, gated by AGC recovery
    const floorIntensity = Math.min(1.0, Math.max(0.0,
      (bands.subBass * 0.65 + bands.lowMid * 0.35) * recoveryFactor
    ))
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
    // air: soft-compressed EMA, gated by AGC recovery to prevent rebound blasts
    // WAVE 4826.3 — BOOST AIR: 1.4x directo para resucitar con brillo
    const airIntensity = Math.min(1.0, Math.max(0.0, this._airEMA * recoveryFactor * 1.4))

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
    this.avgMidProfiler = 0
    this.lastSilenceTime = 0
    this.inSilence = false
    this._strobeActive = false
    this.strobeStartTime = 0
    this.lastTreble = 0
    this._ambientEMA = 0
    this._airEMA = 0
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
    this._airEMA = 0
    // WAVE 7748: Reset HH adapter state
    this._prevHhEnergy = 0
    this._lastHhOnset = 0
    this._hhImpulse = 0
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

