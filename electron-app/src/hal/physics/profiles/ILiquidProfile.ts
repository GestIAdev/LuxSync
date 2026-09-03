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

  // ═══════════════════════════════════════════════════════════════════════════
  // ⚒️ WAVE 7749.52: ONSET-GATED ZONE ENVELOPES — Floor & Air
  // Optional with fallback defaults in LiquidEngineBase. Profiles that
  // want genre-specific zone kinematics can override these.
  // ═══════════════════════════════════════════════════════════════════════════

  /** Floor — Ground sweep laser: bassDelta onset-driven. Zero-attack, fast decay.
   *  Default: gateOn 0.08, decayBase 0.12, crushExponent 2.0, boost 3.0.
   *  Reacts to transient impact (bassDelta), not sustained amplitude. */
  readonly envelopeFloor?: LiquidEnvelopeConfig
  /** Air — Aerial laser: treble + ultraAir velocity-driven. Zero-attack, fast decay.
   *  Default: gateOn 0.35, decayBase 0.08, crushExponent 2.5, boost 4.0. */
  readonly envelopeAir?: LiquidEnvelopeConfig

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

  // WAVE 7748: HH Energy Adapter gain for Back L
  /** Gain applied to hh_energy impulse when max-blending into Back L.
   *  Default 0.6 — hi-hats are supportive, not dominant.
   *  Techno 0.8 (driving hats), Latino 0.5 (güira textural), Chill 0.0 (no hats). */
  readonly hhBlendGain?: number

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
   * WAVE 2439 — ESTRATEGIA DE ENRUTAMIENTO 4.1
   *
   * 'default'       — Comportamiento legacy: frontPar=max(subBass,kick), backPar=max(snare,highMid)
   *
   * 'strict-split'  — METRÓNOMO/LIENZO (Techno industrial):
   *   frontPar = envKick solo          → El Metrónomo. Pulso rítmico puro.
   *   backPar  = envSnare solo         → El Látigo. Percusión alta pura.
   *   moverL   = max(subBass, highMid, treble)  → Lienzo L: todo el muro atmosférico.
   *   moverR   = max(subBass, highMid, vocal)   → Lienzo R: muro + aire vocal.
   *
   * undefined / ausente → 'default'
   */
  readonly layout41Strategy?: 'default' | 'strict-split'

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
  // WAVE 7749: TONALITY VETO — Snare isolation thresholds
  // Multi-dimensional strict veto using physical properties (noise vs
  // tonality) rather than frequency bands alone. Three orthogonal axes:
  //   1. flatness (Wiener entropy) — tonal vs noise
  //   2. whiteNoiseScore (HF broadband) — snare sizzle vs vocal/synth
  //   3. spectralFlux (spectral change rate) — impulse vs sustain
  // The veto is a multiplicative AND-gate on hybridSnare.
  // ═══════════════════════════════════════════════════════════════

  /** Flatness below this = pure tonal (vocal/synth) → hard snare veto.
   *  Default 0.12. Techno 0.10 (allow slightly tonal claps), Latino 0.15. */
  readonly snareVetoFlatnessFloor?: number
  /** Flatness above this = noise-like → full snare pass.
   *  Default 0.25. Linear ramp between floor and knee. */
  readonly snareVetoFlatnessKnee?: number
  /** whiteNoiseScore below this = no HF broadband (vocal consonant) → hard veto.
   *  Default 0.15. */
  readonly snareVetoWnsFloor?: number
  /** whiteNoiseScore above this = strong broadband (snare/cymbal) → full pass.
   *  Default 0.35. */
  readonly snareVetoWnsKnee?: number
  /** spectralFlux below this = sustained (vocal tail) → hard veto.
   *  Default 0.10. */
  readonly snareVetoFluxFloor?: number
  /** spectralFlux above this = explosive (snare hit) → full pass.
   *  Default 0.30. */
  readonly snareVetoFluxKnee?: number

  // ═══════════════════════════════════════════════════════════════
  // WAVE 7749: SUSTAIN CHOKE — kills vocal bleed tails in envSnare
  // A snare explodes and decays in <100ms. A vocal sustains. If
  // snare_energy stays elevated without new onsets, choke the envelope.
  // ═══════════════════════════════════════════════════════════════

  /** Frames without new onset before sustain choke activates.
   *  Default 2 (~45ms at 44Hz). */
  readonly snareChokeFrames?: number
  /** Exponential choke rate per frame after threshold.
   *  Default 0.70 (~15ms half-life). Lower = faster choke. */
  readonly snareChokeRate?: number

  /** WAVE 7749.7: Impulse decay rate per frame. Default 0.04 (96% decay).
   *  Techno 0.30 — bridges micro-gaps between irregular onsets without
   *  creating the sawtooth flicker that 0.60 produced.
   *  Latino 0.15 — fast enough for staccato Latin percussion. */
  readonly snareImpulseDecay?: number

  /** WAVE 7749.64: Path 1 bass-impact floor (anti-hi-hat surfer).
   *  When WNS > 0.3 but SnareE < 0.15, Path 1 allows bassE > 0.40 as
   *  "rhythmic context." In techno, bass is continuous — every hi-hat
   *  has bassE > 0.40, so this clause fires on every hat. This floor
   *  requires the bass to be RISING (bassDelta > floor) to prove a real
   *  percussive hit, not a hi-hat surfing a sustained bassline.
   *  Techno: 0.005 (hi-hats have bassDelta ≤ +0.002, real snares > +0.009).
   *  Latino: omit / 0 = legacy behavior (bassE > 0.40 alone suffices,
   *  because Latin snares hit on the off-beat where bass is decaying). */
  readonly snarePath1BassDeltaFloor?: number

  /** ⚒️ WAVE 7749.65: EMA MOMENTUM SNARE DETECTOR (profile-gated).
   *  When snareMomentumThreshold is defined, the entire 5-path onset
   *  cascade is REPLACED by a dual-EMA crossover (MACD-style) on
   *  snare_energy. This is a pure-math detector with no if/else paths,
   *  no TCT flags, no cooldowns — the anti-retrigger is a topological
   *  property of the threshold crossing.
   *
   *  Formula:
   *    emaFast += αF · (SnareE − emaFast)     αF default 0.50 (τ ≈ 45 ms)
   *    emaSlow += αS · (SnareE − emaSlow)     αS default 0.05 (τ ≈ 450 ms)
   *    momentum = emaFast − emaSlow
   *    onset = (momentum > θ) ∧ (momentumPrev ≤ θ)
   *
   *  Why: in minimal techno, raw_snare_delta oscillates on the decay
   *  tail of real snares (micro-transients in the texture), causing
   *  3x jitter. The EMA momentum only fires when the band energy is
   *  genuinely RISING, eliminating re-triggers on the decay by
   *  construction. Hi-hats (SnareE = 0) never move either EMA, so
   *  they are excluded for free — no bassDelta floor or WNS gate
   *  needed.
   *
   *  Absent (undefined) = legacy 5-path cascade (latino, chill, etc.).
   *  Techno sets snareMomentumThreshold: 0.04. */
  readonly snareMomentumThreshold?: number
  /** EMA fast coefficient for momentum detector. Default 0.50. */
  readonly snareMomentumAlphaFast?: number
  /** EMA slow coefficient for momentum detector. Default 0.05. */
  readonly snareMomentumAlphaSlow?: number
  /** ⚒️ WAVE 7749.67: HYBRID RESET — partial baseline reset on strong snares.
   *  When momentum exceeds snareMomentumResetThreshold, emaSlow is pulled
   *  toward emaFast by snareMomentumResetRatio. This forces momentum back
   *  to ~0, allowing the detector to re-fire on the next snare in a dense
   *  burst (snareperfecto.md: 32→40 onsets, recovering off-beat 16ths).
   *  Weak snares (momentum < reset threshold) do NOT reset → anti-jitter
   *  preserved (imposiblesnare.md stays at 18).
   *  Absent = no reset (pure crossover, legacy EMA behavior). */
  readonly snareMomentumResetThreshold?: number
  /** Ratio of baseline reset on strong snare. Default 0.70. */
  readonly snareMomentumResetRatio?: number
  /** ⚒️ WAVE 7749.68: SNARE ENERGY FLOOR — minimum SnareE for onset firing.
   *  Prevents false onsets in silence/noise where SnareE rises from 0.001 to
   *  ~0.025 (background noise) and momentum crosses threshold.
   *  sinsnare.md: 4 falsos eliminados (SnareE 0.024-0.026).
   *  snarebueno.md: 7 falsos eliminados (SnareE 0.025-0.028).
   *  Absent = no floor (fire on any momentum crossing). */
  readonly snareMomentumFloor?: number

  // ═══════════════════════════════════════════════════════════════
  // WAVE 2488 — DT-02: MORPHOLOGY UNCHAINED
  // El morphFactor normaliza avgMidProfiler a [0,1] usando:
  //   morphFactor = clamp((avgMid - morphFloor) / (morphCeiling - morphFloor), 0, 1)
  //
  // Géneros de alta energía (Techno, Latino):
  //   morphFloor=0.30, morphCeiling=0.70  → rango estándar
  // Géneros de baja energía (Chill, Ambient):
  //   morphFloor=0.05, morphCeiling=0.35  → el motor percibe todo el espectro
  //   aunque el mid nunca supere 0.35. Sin esto, morphFactor≈0 siempre.
  // ═══════════════════════════════════════════════════════════════

  /**
   * Umbral inferior de avgMidProfiler para morphFactor=0.
   * Por debajo de este valor, el engine está en modo "puro percussion"
   * (sin componente melódico). Géneros chill: usar valor bajo (~0.05).
   */
  readonly morphFloor: number

  /**
   * Umbral superior de avgMidProfiler para morphFactor=1.
   * Por encima de este valor, el engine está en modo "puro melody".
   * Géneros chill: usar valor bajo (~0.35) para que alcancen richness completa.
   */
  readonly morphCeiling: number

  // ═══════════════════════════════════════════════════════════════
  // KICK DETECTION
  // ═══════════════════════════════════════════════════════════════

  /** Intervalo mínimo (ms) entre kicks para considerar edge */
  readonly kickEdgeMinInterval: number
  /** Frames de veto post-kick (input kill en Mover R) */
  readonly kickVetoFrames: number

  // ═══════════════════════════════════════════════════════════════
  // WAVE 4684: AMBIENT VISCOSITY — EMA time constants for the
  // ambient zone "giant lung" behavior. Attack = gentle rise,
  // Release = ultra-slow decay (milliseconds). At 44Hz:
  //   alpha = 1000 / (ms × 44). Default attack 800ms, release 10000ms.
  // ═══════════════════════════════════════════════════════════════

  /** Attack time constant for ambient EMA (ms). Lower = faster rise. */
  readonly ambientAttackMs?: number
  /** Release/decay time constant for ambient EMA (ms). Higher = slower fall. */
  readonly ambientReleaseMs?: number

  /**
   * WAVE 2522: AMBIENT MID INJECTION — peso de la banda mid en la mezcla
   * del ambient EMA. Default 0 = solo subBass (comportamiento WAVE 4812 M2).
   * > 0 inyecta energía de medios (guitarras, teclados) en el ambient.
   * Fórmula: _ambMix = bands.subBass + bands.mid × ambientMidWeight
   * Útil para géneros donde el "rugido constante" vive en medios, no graves.
   */
  readonly ambientMidWeight?: number

  /**
   * WAVE 2522: AMBIENT GAIN — ganancia global post-crush del ambient.
   * Default 1.35 (valor hardcodeado WAVE 4812 M2). > 1.35 boostea la
   * intensidad ambiental para perfiles que necesitan más presencia.
   * Fórmula: preGainAmbient = min(1.0, _ambientCrushed × ambientGain)
   */
  readonly ambientGain?: number

  /**
   * WAVE 7573: AMBIENT CRUSH EXPONENT — exponente de compresión de la
   * señal EMA del ambient antes del gain. Default 2.0 (WAVE 4814).
   * Valores más bajos (1.0-1.3) = menos compresión = más luz visible
   * con señales débiles. Valores más altos = más contraste (oscuridad
   * absoluta en pasajes suaves, brillo solo en picos).
   * Fórmula: _ambientCrushed = Math.pow(_ambientRaw, ambientCrushExponent)
   */
  readonly ambientCrushExponent?: number

  /**
   * WAVE 7573: AMBIENT OUTPUT EXPONENT — exponente final post-gain.
   * Default 1.3 (WAVE 4826.3). Valores más bajos = más lineal = más
   * luz en el rango medio. Valores más altos = más contraste.
   * Fórmula: ambientIntensity = Math.pow(preGainAmbient, ambientOutputExponent)
   */
  readonly ambientOutputExponent?: number

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

  // ═══════════════════════════════════════════════════════════════
  // WAVE 2513 — AMBIENT ISOLATION
  // ═══════════════════════════════════════════════════════════════

  /**
   * Modo Ambient Puro: ignora TODA señal de audio para calcular intensidades.
   * Los valores de salida son generados por osciladores basados en Date.now().
   * Esto garantiza que con volumen 0 o volumen 100 el comportamiento es idéntico.
   *
   * Efectos:
   *   - isKick / isKickEdge / kickSignal = 0 (bloqueado)
   *   - Sidechain Guillotine = desactivada (ducking = 1.0 siempre)
   *   - strobeActive = false (permanente)
   *   - frontRight, backRight driven by time oscillators [0.35–0.65]
   *   - frontLeft, backLeft driven by time oscillators [0.40–0.75]
   * Los envelopes (envKick, envSnare, etc.) SIGUEN procesando — para mantener
   * ghostCap activo y la luminosidad residual oceánica correcta.
   */
  readonly isPureAmbient?: boolean

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

    // WAVE 7748: HH Energy Adapter gain (4.1 override)
    readonly hhBlendGain?: number

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
    // WAVE 2439 — Estrategia de enrutamiento 4.1
    readonly layout41Strategy?: 'default' | 'strict-split'

    // WAVE 7749: Tonality Veto + Sustain Choke (4.1 override)
    readonly snareVetoFlatnessFloor?: number
    readonly snareVetoFlatnessKnee?: number
    readonly snareVetoWnsFloor?: number
    readonly snareVetoWnsKnee?: number
    readonly snareVetoFluxFloor?: number
    readonly snareVetoFluxKnee?: number
    readonly snareChokeFrames?: number
    readonly snareChokeRate?: number
    // WAVE 7749.7: Impulse decay (4.1 override)
    readonly snareImpulseDecay?: number
    // WAVE 7749.64: Path 1 bass-impact floor (4.1 override)
    readonly snarePath1BassDeltaFloor?: number
    // WAVE 7749.65: EMA momentum snare detector (4.1 override)
    readonly snareMomentumThreshold?: number
    readonly snareMomentumAlphaFast?: number
    readonly snareMomentumAlphaSlow?: number
    // WAVE 7749.67: Hybrid reset (4.1 override)
    readonly snareMomentumResetThreshold?: number
    readonly snareMomentumResetRatio?: number
    // WAVE 7749.68: Snare energy floor (4.1 override)
    readonly snareMomentumFloor?: number
  }
}
