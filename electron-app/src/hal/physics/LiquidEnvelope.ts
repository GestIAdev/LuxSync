/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌊 WAVE 2401: LIQUID ENVELOPE — The Universal Band Physics Abstraction
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * UNA clase. SIETE instancias. TODA la morfología del God Mode encapsulada.
 *
 * Cada instancia de LiquidEnvelope procesa UNA banda del GodEarFFT
 * con su propia configuración de:
 *   - Velocity Gate (attack-only trigger + Undertow grace frame)
 *   - Asymmetric EMA (averaged signal tracking)
 *   - Peak Memory + Tidal Gate (adaptive floor decay)
 *   - Dynamic Gate + Ignition Squelch (anti-pad-ghost)
 *   - Soft Knee (ghostPower subliminal glow)
 *   - Crush Exponent + Boost (dynamics shaping)
 *   - Smooth Fade (anti-guillotine low-end filter)
 *
 * HERENCIA: Toda la matemática viene directamente de TechnoStereoPhysics.ts
 * (God Mode WAVE 2377-2394). No se inventó nada nuevo — se ABSTRAJO.
 *
 * @module hal/physics/LiquidEnvelope
 * @version WAVE 2401 — THE LIQUID STEREO
 */

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════════════════

export interface LiquidEnvelopeConfig {
  /** Identificador legible de la banda */
  readonly name: string

  /** Umbral de activación del gate (0-1) */
  readonly gateOn: number
  // gateOff: PURGADO (WAVE 2435) — nunca se leyó en process(). El apagado
  // lo maneja el decay exponencial (etapa 6) + fadeZone cuadrático (etapa 9).
  /** Multiplicador de ganancia post-gate */
  readonly boost: number
  /** Exponente de compresión base (>1 = selectivo, <1 = expansivo) */
  readonly crushExponent: number

  /** Factor de decay por frame en morph=0 (0-1, más alto = decay más lento) */
  readonly decayBase: number
  /** Rango de modulación de decay por morphFactor */
  readonly decayRange: number

  /** Cap de intensidad máxima de salida (0-1) */
  readonly maxIntensity: number

  /** Umbral de ignition squelch en morph=0 (anti-pad-ghost) */
  readonly squelchBase: number
  /** Pendiente de squelch — cuánto baja con morphFactor */
  readonly squelchSlope: number

  /** Cap de ghostPower en morph=1 (soft knee subliminal glow) */
  readonly ghostCap: number
  /** Margen fijo añadido sobre gate adaptativo */
  readonly gateMargin: number
}

// ═══════════════════════════════════════════════════════════════════════════
// ESTADO INTERNO
// ═══════════════════════════════════════════════════════════════════════════

interface LiquidEnvelopeState {
  /** Intensidad de salida con decay aplicado (frame anterior) */
  intensity: number
  /** EMA asimétrico de la señal de entrada */
  avgSignal: number
  /** Pico rastreado con Tidal Gate decay */
  avgSignalPeak: number
  /** Timestamp (ms) del último disparo exitoso */
  lastFireTime: number
  /** Señal del frame anterior (para Velocity Gate) */
  lastSignal: number
  /** Flag de grace frame para The Undertow */
  wasAttacking: boolean
}

// ═══════════════════════════════════════════════════════════════════════════
// CLASE
// ═══════════════════════════════════════════════════════════════════════════

export class LiquidEnvelope {

  private readonly config: LiquidEnvelopeConfig
  private state: LiquidEnvelopeState

  constructor(config: LiquidEnvelopeConfig) {
    this.config = config
    this.state = LiquidEnvelope.freshState()
  }

  private static freshState(): LiquidEnvelopeState {
    return {
      intensity: 0,
      avgSignal: 0,
      avgSignalPeak: 0,
      lastFireTime: 0,
      lastSignal: 0,
      wasAttacking: false,
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Procesa un frame de señal y devuelve la intensidad de salida (0 – maxIntensity).
   *
   * Toda la pipeline es DETERMINISTA — mismo input produce mismo output.
   * No hay Math.random(), no hay heurísticas, no hay mocks.
   *
   * @param signal      - Energía de la banda (0-1), directo del GodEarFFT
   * @param morphFactor - Factor de morfología global (0=Hard, 1=Melodic)
   * @param now         - Timestamp en ms (Date.now() o simulado)
   * @param isBreakdown - true si sectionType es 'breakdown' o 'buildup'
   */
  process(signal: number, morphFactor: number, now: number, isBreakdown: boolean): number {
    const c = this.config
    const s = this.state

    // ═══════════════════════════════════════════════════════════════════
    // 1. VELOCITY GATE — Cinemática de ataque puro
    //    Herencia: WAVE 2380/2381/2386 (attack-only trigger + Undertow)
    // ═══════════════════════════════════════════════════════════════════
    const velocity = signal - s.lastSignal
    s.lastSignal = signal

    // isRisingAttack: la onda está subiendo (margen -0.005 para micro-fluctuaciones)
    const isRisingAttack = velocity >= -0.005
    // isGraceFrame: THE UNDERTOW — 1 frame de gracia si el anterior fue ataque real
    const isGraceFrame = s.wasAttacking && velocity >= -0.03
    const isAttacking = isRisingAttack || isGraceFrame
    // Solo marcamos wasAttacking si fue genuinamente positivo (>0.01)
    s.wasAttacking = isRisingAttack && velocity > 0.01

    // ═══════════════════════════════════════════════════════════════════
    // 2. ASYMMETRIC EMA — Tracking de señal con attack/decay asimétrico
    //    Herencia: WAVE 2386 (The Undertow — decay 0.88/0.12)
    // ═══════════════════════════════════════════════════════════════════
    if (signal > s.avgSignal) {
      // Attack: sube lento para no perseguir picos individuales
      s.avgSignal = s.avgSignal * 0.98 + signal * 0.02
    } else {
      // Decay: baja rápido para detectar valles entre kicks
      s.avgSignal = s.avgSignal * 0.88 + signal * 0.12
    }

    // ═══════════════════════════════════════════════════════════════════
    // 3. PEAK MEMORY + TIDAL GATE — Adaptive peak decay
    //    Herencia: WAVE 2385 (Tidal Gate — conditional peak release)
    // ═══════════════════════════════════════════════════════════════════
    const timeSinceLastFire = s.lastFireTime > 0 ? now - s.lastFireTime : 0
    const isDrySpell = timeSinceLastFire > 2000

    // Peak decay: normal 0.993 (~4.7s half-life), dry spell 0.985 (~1.5s)
    const peakDecay = isDrySpell ? 0.985 : 0.993
    if (s.avgSignal > s.avgSignalPeak) {
      s.avgSignalPeak = s.avgSignal
    } else {
      s.avgSignalPeak = s.avgSignalPeak * peakDecay + s.avgSignal * (1 - peakDecay)
    }

    // ═══════════════════════════════════════════════════════════════════
    // 4. ADAPTIVE FLOOR — Tidal Gate floor degradation
    //    Herencia: WAVE 2385 (3s→6s dry spell floor degradation)
    // ═══════════════════════════════════════════════════════════════════
    const drySpellFloorDecay = timeSinceLastFire > 3000
      ? Math.min(1.0, (timeSinceLastFire - 3000) / 3000)
      : 0
    const adaptiveFloor = c.gateOn - (0.12 * drySpellFloorDecay)
    const avgEffective = Math.max(s.avgSignal, s.avgSignalPeak * 0.55, adaptiveFloor)

    // ═══════════════════════════════════════════════════════════════════
    // 5. DYNAMIC GATE — Gate adaptativo con margen fijo
    //    Herencia: WAVE 2394 (margen fijo 0.02, revert de dinámico)
    // ═══════════════════════════════════════════════════════════════════
    const dynamicGate = avgEffective + c.gateMargin

    // ═══════════════════════════════════════════════════════════════════
    // 6. DECAY — Morfología líquida
    //    Herencia: WAVE 2392/2394 (decay base + range × morph)
    // ═══════════════════════════════════════════════════════════════════
    const decay = c.decayBase + c.decayRange * morphFactor
    s.intensity *= decay

    // ═══════════════════════════════════════════════════════════════════
    // 7. MAIN GATE — Crush exponent + breakdown penalty
    //    Herencia: WAVE 2387/2394 (Return to Origins, crush 1.5-1.8)
    // ═══════════════════════════════════════════════════════════════════
    const breakdownPenalty = isBreakdown ? 0.06 : 0
    let kickPower = 0
    let ghostPower = 0

    if (signal > dynamicGate && isAttacking && signal > 0.15) {
      // Above gate + attacking → main power path
      const requiredJump = 0.14 - 0.07 * morphFactor + breakdownPenalty
      let rawPower = (signal - dynamicGate) / requiredJump
      rawPower = Math.min(1.0, Math.max(0, rawPower))

      // Crush exponent: base + 0.3*(1-morph) → más agresivo en morph bajo
      const crushExp = c.crushExponent + 0.3 * (1.0 - morphFactor)
      kickPower = Math.pow(rawPower, crushExp)
    } else if (signal > avgEffective && signal > 0.15 && !isBreakdown) {
      // Below gate but above average → Soft Knee ghost path
      // Herencia: WAVE 2383/2393 (ghostCap × morphFactor)
      // WAVE 2990: Removed Math.max(morphFactor, 0.1) floor — ghostCap scales to 0 at morph=0.
      const ghostCapDynamic = c.ghostCap * morphFactor
      const proximity = (signal - avgEffective) / 0.02
      ghostPower = Math.max(ghostCapDynamic, Math.min(ghostCapDynamic, proximity * ghostCapDynamic))
    }

    // ═══════════════════════════════════════════════════════════════════
    // 8. IGNITION SQUELCH — Anti-pad-ghost rampa
    //    Herencia: WAVE 2394 (squelchBase - squelchSlope × morph)
    // ═══════════════════════════════════════════════════════════════════
    const squelch = Math.max(0.02, c.squelchBase - c.squelchSlope * morphFactor)

    if (kickPower > squelch) {
      s.lastFireTime = now
      const hit = Math.min(
        c.maxIntensity,
        kickPower * (1.2 + 0.8 * morphFactor) * c.boost
      )
      s.intensity = Math.max(s.intensity, hit)
    } else if (ghostPower > 0) {
      s.intensity = Math.max(s.intensity, ghostPower)
    }

    // ═══════════════════════════════════════════════════════════════════
    // 9. SMOOTH FADE — Anti-guillotine low-end filter
    //    Herencia: WAVE 2383 (quadratic fade below 0.08)
    // ═══════════════════════════════════════════════════════════════════
    const fadeZone = 0.08
    const fadeFactor = s.intensity >= fadeZone
      ? 1.0
      : Math.pow(s.intensity / fadeZone, 2)

    const faded = Math.min(c.maxIntensity, s.intensity * fadeFactor)

    // WAVE 2990: GHOST CAP FLOOR ELIMINATED.
    // The artificial dimmer floor (ghostCap * max(morph, 0.1)) prevented DMX 0.
    // If audio energy is zero, output must be zero. No residual glow.
    return faded
  }

  /** Resetea todo el estado interno a valores iniciales */
  reset(): void {
    this.state = LiquidEnvelope.freshState()
  }

  /** Nombre de la banda (para telemetría/debug) */
  get bandName(): string {
    return this.config.name
  }
}
