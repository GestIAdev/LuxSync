/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 2411: ILiquidProfile — Contrato de Perfil para el Omni-Liquid 7.1
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Contiene TODA la parametría que varía entre géneros musicales.
 * El motor LiquidStereoPhysics no tiene ni una constante numérica propia —
 * todo viene del perfil inyectado.
 *
 * Un perfil es puro dato: sin lógica, sin funciones, sin imports pesados.
 * Misma mecánica, resultado completamente distinto según los números.
 *
 * @module hal/physics/profiles/ILiquidProfile
 * @version WAVE 2411 — THE ARCHITECTURE FORGE
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

  // ═══════════════════════════════════════════════════════════════
  // MOVER L (MELODÍAS): Cross-filter + tonal gate
  // input = max(0, highMid × moverLHighMidWeight + treble × moverLTrebleWeight)
  // La señal se multiplica por isTonal (flatness < moverLTonalThreshold ? 1 : 0)
  // ═══════════════════════════════════════════════════════════════

  /** Peso de highMid en la mezcla de Mover L */
  readonly moverLHighMidWeight: number
  /** Peso de treble en la mezcla de Mover L */
  readonly moverLTrebleWeight: number
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
}
