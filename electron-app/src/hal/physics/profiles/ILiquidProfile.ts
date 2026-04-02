/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 2435: ILiquidProfile — Contrato de Perfil para el Omni-Liquid Engine
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Contiene TODA la parametría que varía entre géneros musicales.
 * El motor LiquidStereoPhysics no tiene ni una constante numérica propia —
 * todo viene del perfil inyectado.
 *
 * Un perfil es puro dato: sin lógica, sin funciones, sin imports pesados.
 * Misma mecánica, resultado completamente distinto según los números.
 *
 * WAVE 2435: Añade overrides41 — parametría específica para layout 4.1.
 * La fusión ocurre en setProfile(), NO en el hot-path.
 *
 * @module hal/physics/profiles/ILiquidProfile
 * @version WAVE 2435 — OMNILIQUID OVERRIDES
 */

import type { LiquidEnvelopeConfig } from '../LiquidEnvelope'

export interface ILiquidProfile {
  /** Identificador único del perfil (para telemetría y debug) */
  readonly id: string
  /** Nombre legible ('Techno Industrial', 'Reggaetón Club', etc.) */
  readonly name: string

  // ═══════════════════════════════════════════════════════════════
  // ENVELOPE CONFIGS — Las 6 personalidades de los LiquidEnvelope
  // ═══════════════════════════════════════════════════════════════

  /** Front L — SubBass continuo (El Océano) */
  readonly envelopeSubBass: LiquidEnvelopeConfig
  /** Front R — Kick edge (El Francotirador) */
  readonly envelopeKick: LiquidEnvelopeConfig
  /** Mover R — Voces / Mid con bass subtractor (El Coro) */
  readonly envelopeVocal: LiquidEnvelopeConfig
  /** Back R — Percusión aguda / Schwarzenegger (El Látigo) */
  readonly envelopeSnare: LiquidEnvelopeConfig
  /** Back L — Mid Synths / Atmósfera (Teclados) */
  readonly envelopeHighMid: LiquidEnvelopeConfig
  /** Mover L — Melodías tonales (Brillo filtrado) */
  readonly envelopeTreble: LiquidEnvelopeConfig

  // ═══════════════════════════════════════════════════════════════
  // BACK R: SCHWARZENEGGER — Aislamiento percusivo de agudos
  // rawRight = max(0, treble - mid × percMidSubtract)
  // if (rawRight > percGate) → pow(gated, percExponent) × percBoost
  // ═══════════════════════════════════════════════════════════════

  /** Penalización de mid en el aislamiento de treble para Back R */
  readonly percMidSubtract: number
  /** Gate duro: umbral que rawRight debe superar */
  readonly percGate: number
  /** Boost: multiplicador post-gate+exponent */
  readonly percBoost: number
  /** Exponente de la curva post-gate (1.0=lineal, >1=convexa) */
  readonly percExponent: number

  // ═══════════════════════════════════════════════════════════════
  // MOVER R (VOCES): BASS SUBTRACTOR ADAPTATIVO
  // subtractFactor = bassSubtractBase - morphFactor × bassSubtractRange
  // cleanMid = max(0, mid - bass × subtractFactor)
  // ═══════════════════════════════════════════════════════════════

  /** Factor base de resta de bass (morph=0) */
  readonly bassSubtractBase: number
  /** Rango de modulación por morph */
  readonly bassSubtractRange: number

  // ═══════════════════════════════════════════════════════════════
  // BACK L (MID SYNTHS): Cross-filter coefficients
  // input = max(0, lowMid × backLLowMidWeight + mid × backLMidWeight
  //              - treble × backLTrebleSub)
  // ═══════════════════════════════════════════════════════════════

  /** Peso de lowMid en la mezcla de Back L */
  readonly backLLowMidWeight: number
  /** Peso de mid en la mezcla de Back L */
  readonly backLMidWeight: number
  /** Factor de resta de treble en Back L */
  readonly backLTrebleSub: number
  /** Factor de resta de bass en Back L (Techno: bass ensucia mid synths) */
  readonly backLBassSub: number

  // ═══════════════════════════════════════════════════════════════
  // MOVER L (MELODÍAS): Cross-filter + tonal gate
  // input = max(0, highMid × moverLHighMidWeight + treble × moverLTrebleWeight)
  // La señal se multiplica por isTonal (flatness < moverLTonalThreshold ? 1 : 0)
  // ═══════════════════════════════════════════════════════════════

  /** Peso de highMid en la mezcla de Mover L */
  readonly moverLHighMidWeight: number
  /** Peso de treble en la mezcla de Mover L */
  readonly moverLTrebleWeight: number
  /** Peso de mid en la mezcla de Mover L (para géneros con mid melódico) */
  readonly moverLMidWeight: number
  /** Umbral de flatness para el gate tonal (por debajo = tonal = pasa) */
  readonly moverLTonalThreshold: number

  // ═══════════════════════════════════════════════════════════════
  // MOVER R (VOCES): Cross-filter coefficient para resta de treble
  // input = max(0, cleanMid - treble × moverRTrebleSub)
  // ═══════════════════════════════════════════════════════════════

  /** Factor de resta de treble en Mover R para limpiar sibilantes */
  readonly moverRTrebleSub: number

  // ═══════════════════════════════════════════════════════════════
  // SIDECHAIN GUILLOTINE
  // ═══════════════════════════════════════════════════════════════

  /** Umbral de frontMax para activar ducking sobre movers */
  readonly sidechainThreshold: number
  /** Profundidad del ducking (0=nada, 1=kill total) */
  readonly sidechainDepth: number
  /** Profundidad del sidechain del snare sobre Mover R (voces) */
  readonly snareSidechainDepth: number

  /**
   * WAVE 2438 — GUILLOTINA 4.1: Sidechain Interno Exclusivo
   * Umbral de frontRight (kick) por encima del cual frontLeft (subBass) es
   * guillotinado a cero antes del max(). Solo aplica en routeZones() del 4.1.
   * 0 = desactivado (comportamiento legacy).
   */
  readonly frontKickSidechainThreshold: number

  /**
   * WAVE 2438 — GUILLOTINA 4.1: Aura Cap Morfológico
   * Exponente (>0) del auraCap. El techo del subBass en modo industrial:
   *   auraCap = auraCapBase * Math.pow(morphFactor, auraCapExponent)
   * Con morphFactor~0 (industrial puro), el cap aplasta el subBass al suelo.
   * Con morphFactor~1 (melódico), el cap sube a auraCapBase (sin efecto real).
   * 0 = desactivado.
   */
  readonly auraCapBase: number
  readonly auraCapExponent: number

  /**
   * WAVE 2439 — KICK WINDOW 4.1: Ventana temporal post-kick
   * Número de frames tras un isKickEdge donde fL (subBass) puede pasar al frontPar.
   * Fuera de esa ventana, fL = 0: el front solo vive cuando hay kick activo o su eco.
   * 0 = desactivado (comportamiento legacy — subBass siempre visible).
   * A 60fps: 6 frames ≈ 100ms de ventana (sigue al kick sin corte abrupto).
   */
  readonly kickWindowFrames: number

  /**
   * WAVE 2439 — KICK BOOST 4.1: Amplificación del pulso en el momento del kick
   * Multiplicador sobre fR (envKick) aplicado en el frame del isKickEdge.
   * Crea un impacto visual más contundente y define el ritmo con claridad.
   * 1.0 = sin boost. 1.5 = +50% en el momento del golpe.
   */
  readonly kickBoost: number

  // ═══════════════════════════════════════════════════════════════
  // STROBE
  // ═══════════════════════════════════════════════════════════════

  /** Umbral base de treble para trigger */
  readonly strobeThreshold: number
  /** Duración del strobe en ms */
  readonly strobeDuration: number
  /** Multiplicador de descuento en noiseMode (0.80 = 20% menos threshold) */
  readonly strobeNoiseDiscount: number

  // ═══════════════════════════════════════════════════════════════
  // MODES — Acid / Noise / Apocalypse
  // ═══════════════════════════════════════════════════════════════

  readonly harshnessAcidThreshold: number
  readonly flatnessNoiseThreshold: number
  /** Harshness mínimo para Apocalypse Mode */
  readonly apocalypseHarshness: number
  /** Flatness mínimo para Apocalypse Mode */
  readonly apocalypseFlatness: number

  // ═══════════════════════════════════════════════════════════════
  // KICK DETECTION
  // ═══════════════════════════════════════════════════════════════

  /** Intervalo mínimo (ms) entre kicks para considerar edge */
  readonly kickEdgeMinInterval: number
  /** Frames de veto post-kick (input kill en Mover R) */
  readonly kickVetoFrames: number

  // ═══════════════════════════════════════════════════════════════
  // WAVE 2435: OVERRIDES DE LAYOUT 4.1
  //
  // Cuando un perfil 7.1 corre en layout 4.1, routeZones() compacta
  // las zonas con max(). El tumbao continuo (backLeft) asfixia al
  // TAcka impulsivo (backRight) porque max() nunca se apaga.
  //
  // Estos overrides permiten ajustar la parametría para compensar
  // la compactación. Se fusionan UNA VEZ en setProfile() cuando
  // el engine tiene layout '4.1'. El hot-path no se entera.
  //
  // Solo los campos que necesitan cambiar. Los ausentes se heredan
  // del perfil base sin modificación.
  // ═══════════════════════════════════════════════════════════════

  readonly overrides41?: {
    // Envelopes — Partial permite overridear campos individuales
    // sin repetir los 12 campos del envelope completo
    readonly envelopeSubBass?: Partial<LiquidEnvelopeConfig>
    readonly envelopeKick?: Partial<LiquidEnvelopeConfig>
    readonly envelopeVocal?: Partial<LiquidEnvelopeConfig>
    readonly envelopeSnare?: Partial<LiquidEnvelopeConfig>
    readonly envelopeHighMid?: Partial<LiquidEnvelopeConfig>
    readonly envelopeTreble?: Partial<LiquidEnvelopeConfig>

    // Transient Shaper
    readonly percGate?: number
    readonly percBoost?: number
    readonly percExponent?: number
    readonly percMidSubtract?: number

    // Back L: Cross-filter
    readonly backLLowMidWeight?: number
    readonly backLMidWeight?: number
    readonly backLTrebleSub?: number
    readonly backLBassSub?: number

    // Mover L: Melody Gate
    readonly moverLTonalThreshold?: number
    readonly moverLHighMidWeight?: number
    readonly moverLTrebleWeight?: number
    readonly moverLMidWeight?: number

    // Mover R: Bass Subtractor
    readonly bassSubtractBase?: number
    readonly bassSubtractRange?: number
    readonly moverRTrebleSub?: number

    // Sidechain
    readonly sidechainThreshold?: number
    readonly sidechainDepth?: number
    readonly snareSidechainDepth?: number
    // WAVE 2438 — Guillotina 4.1
    readonly frontKickSidechainThreshold?: number
    readonly auraCapBase?: number
    readonly auraCapExponent?: number
    // WAVE 2439 — Kick Window + Boost
    readonly kickWindowFrames?: number
    readonly kickBoost?: number
  }
}
