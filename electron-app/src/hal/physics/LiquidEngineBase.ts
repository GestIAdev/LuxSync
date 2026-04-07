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

  // Transient Shaper state (WAVE 2427 → WAVE 2446)
  private lastTreble: number = 0
  private lastHighMid: number = 0
  private lastMid: number = 0

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
      morphFactor = Math.min(1.0, Math.max(0.0, (this.avgMidProfiler - p.morphFloor) / (p.morphCeiling - p.morphFloor)))
    }

    // ═══════════════════════════════════════════════════════════════════
    // WAVE 2513 — AMBIENT ISOLATION: BYPASS TOTAL DE GodEarFFT
    // Si el perfil es isPureAmbient, el motor ignora TODA señal de audio
    // y genera intensidades puramente desde osciladores trigonométricos.
    // El resultado es idéntico con volumen=0 o volumen=100.
    //
    // Arquitectura: early-return completo. El hot-path de GodEar (kicks,
    // strobe, sidechain, transient shaper) NUNCA se ejecuta para este vibe.
    // Los envelopes SÍ se ejecutan para mantener ghostCap oceánico activo.
    // ═══════════════════════════════════════════════════════════════════
    if (p.isPureAmbient) {
      return this.applyAmbientGenerative(morphFactor, now)
    }

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
    const currentTreble  = bands.treble
    const currentHighMid = bands.highMid
    const currentMid     = bands.mid
    const trebleDelta    = Math.max(0, currentTreble  - this.lastTreble)
    const highMidDelta   = Math.max(0, currentHighMid - this.lastHighMid)
    const midDelta       = Math.max(0, currentMid     - this.lastMid)
    this.lastTreble  = currentTreble
    this.lastHighMid = currentHighMid
    this.lastMid     = currentMid

    // 1. Detector de Bofetadas — Transient Shaper Full-Spectrum
    // trebleDelta: hi-hats, crashes, platillos.
    // highMidDelta: rimshot, clap grave, caja minimal.
    // midDelta: snare gordo 808-style, caja con cuerpo, snare acústico.
    // WAVE 2451: midDelta peso morfológico por centroide.
    //   En Anyma (cent > 1500Hz) los synths mid son los "percutores" — midDelta×1.5.
    //   En techno industrial (cent < 500Hz = bombo puro) — midDelta×0.8 como antes.
    const MIN_DELTA = 0.020
    const midCentWeight = Math.min(1.0, (input.spectralCentroid ?? 0) / 1500)
    const impactDelta = trebleDelta + (highMidDelta * 1.5) + (midDelta * (0.8 + 0.7 * midCentWeight))
    const cleanDelta = Math.max(0, impactDelta - MIN_DELTA)
    const baseSnare = cleanDelta * 2.0
    const clapBonus = baseSnare * harshness * 2.0
    let hybridSnare = baseSnare + clapBonus

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

    if (p.layout41Strategy === 'strict-split') {
      // --- WAVE 911 LEGACY — TechnoStereoPhysics (WAVE 2456) ---
      // Exclusivo para techno industrial en modo strict-split.
      // Roles espectrales calibrados contra espectro real del techno industrial.
      //
      // MOVER L = EL OSCURO (200Hz - 800Hz: mid tonal del synth)
      //   GOD EAR confirma: centroid 630-680Hz, rolloff 85% en ~1.2kHz.
      //   rawMoverL = mid - bass*0.50 (separa synth del bombo).
      //   Gate 0.06 (calibrado al piso real ~0.040-0.065 en silencio).
      //   Boost 12.0 (senal pequena pero real — boost agresivo para visibilidad).
      //
      // MOVER R = EL TERMINATOR (2kHz - 20kHz: treble puro)
      //   Verificado correcto en movercalib logs.

      const calculateMover = (signal: number, gate: number, boost: number): number => {
        if (signal < gate) return 0.0
        const gated = (signal - gate) / (1.0 - gate)
        return Math.min(1.0, Math.max(0, Math.pow(gated, 1.2) * boost))
      }

      const rawMoverL = Math.max(0, bands.mid - bands.bass * 0.50)
      const rawMoverR = bands.treble

      moverLeft  = calculateMover(rawMoverL, 0.06, 12.0)
      moverRight = calculateMover(rawMoverR, 0.18, 9.0)

      // Sidechain del kick inline (strict-split: guillotina directa)
      if (isKick) {
        moverLeft  *= (1.0 - p.sidechainDepth)
        moverRight *= (1.0 - p.sidechainDepth)
      }

    } else {
      // --- ENVELOPE CROSS-FILTER — Motor Parametrizado por Perfil (WAVE 2457) ---
      // Latino, Pop-Rock, Chill, etc. usan su ADN definido en ILiquidProfile.

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
    }

    // --- BACK L (El Coro): WAVE 2417 RESURRECTION → WAVE 2430 PARAMETRIZADO ---
    const midSynthInput = Math.max(0,
      bands.lowMid * p.backLLowMidWeight + bands.mid * p.backLMidWeight
      - bands.treble * p.backLTrebleSub - bands.bass * p.backLBassSub
    )
    let backLeft = this.envHighMid.process(midSynthInput, morphFactor, now, isBreakdown)

    // moverLeft y moverRight ya calculados arriba (WAVE 911 legacy block)

    // ═══════════════════════════════════════════════════════════════════
    // 7. SIDECHAIN GUILLOTINE
    // ═══════════════════════════════════════════════════════════════════
    // ═══════════════════════════════════════════════════════════════════
    // 7. SIDECHAIN GUILLOTINE
    // ═══════════════════════════════════════════════════════════════════
    // strict-split ya aplico sidechain inline en el bloque WAVE 911 arriba.
    // Para otros perfiles, la Guillotina general actua aqui.
    const frontMax = Math.max(frontLeft, frontRight)

    if (p.layout41Strategy !== 'strict-split' && frontMax > p.sidechainThreshold) {
      const ducking = 1.0 - frontMax * p.sidechainDepth
      moverLeft *= ducking
      moverRight *= ducking
    } else if (p.layout41Strategy !== 'strict-split') {
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
  // WAVE 2513 — AMBIENT GENERATIVE ENGINE
  // Motor trigonométrico puro: sin GodEar, sin kicks, sin strobe.
  // Los seis osciladores tienen períodos primos entre sí (ms) para que
  // NUNCA coincidan en fase → nunca producen periodicidad perceptible.
  // El resultado es idéntico con música, en silencio o a 0 de volumen.
  // ─────────────────────────────────────────────────────────────────────

  private applyAmbientGenerative(morphFactor: number, now: number): LiquidStereoResult {
    // Oscillator helper: mapea sin(t) de [-1,1] a [lo, hi]
    const osc = (period: number, phase: number, lo: number, hi: number): number => {
      const raw = Math.sin((now / period) + phase)
      return lo + (raw + 1.0) * 0.5 * (hi - lo)
    }

    // Períodos en ms — todos primos entre sí para evitar aliasing periódico.
    // Modulados levemente por morphFactor para que la "profundidad oceánica"
    // afecte el rango dinámico (superficie = más variación, abismo = más flat)
    const morphVariance = 0.8 + morphFactor * 0.4   // [0.8 .. 1.2] scaling del rango

    const loBase = 0.38
    const hiBase = 0.68
    const lo = loBase
    const hi = loBase + (hiBase - loBase) * morphVariance

    const frontLeft  = osc(4003,  0.000, lo + 0.04, hi + 0.04) // El Pulso del Abismo
    const frontRight = osc(3109,  1.047, lo,         hi - 0.06) // La Corriente
    const backLeft   = osc(5303,  0.628, lo + 0.02, hi)         // Las Algas
    const backRight  = osc(1901,  1.571, lo - 0.08, lo + 0.12)  // El Destello (rango estrecho)

    // WAVE 2514 — THE MAJESTIC SWELL: movers a escala de marea
    // Períodos primos largos (7-9 segundos) → la corriente oceánica nunca tiene prisa.
    // Rango [0.20 .. 0.45] — pulso suave sin picos abruptos. La fórmula garantiza
    // que el seno mapeado a [0,1] se multiplica por swellRange sin discontinuidades.
    const SWELL_BASE  = 0.20                            // Dimmer mínimo de marea
    const swellRange  = 0.25 * morphVariance            // Rango modulado por profundidad
    const moverLeft  = SWELL_BASE + ((Math.sin(now / 7901 + 2.094) + 1) / 2) * swellRange  // La Voz del Mar
    const moverRight = SWELL_BASE + ((Math.sin(now / 8803 + 3.926) + 1) / 2) * swellRange  // La Bioluminiscencia

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
    }

    return this.routeZones(frame)
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
