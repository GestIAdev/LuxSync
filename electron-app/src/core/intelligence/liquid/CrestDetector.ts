/**
 * SELENE V3 — LIQUID COGNITION
 * TRUE CREST DETECTOR — proceso de conteo para Π (percusividad)
 *
 * Descarga el TODO de FluidDescriptors.ts:91 («se refinará con detector de
 * crestas CF > 2/s explícito»). El proxy `rhythmicIntensity` medía una
 * MAGNITUD; el contrato de Π pide una DENSIDAD — la intensidad λ de un
 * proceso de conteo. Son objetos matemáticos distintos.
 *
 * ⚠️ NO confundir con CF̂ de CognitiveFluidState (peakWindow/rmsEMA): ese es
 * un NIVEL de cresta instantáneo y sigue siendo la entrada de I(t). Este
 * módulo cuenta EVENTOS de cresta por segundo. Ambos coexisten.
 *
 * Pipeline — tres etapas, una línea de matemática cada una:
 *
 *   L(t) = ln( (ε+E) / (ε+B) )              ← cresta en dominio log
 *   Schmitt(θ, h) + refractario              ← proceso de conteo
 *   R(t) = Σᵢ (wᵢ/τ)·e^(−(t−tᵢ)/τ)          ← estimador de tasa sin sesgo
 *
 * Tres decisiones deliberadas:
 *
 * (1) DOMINIO LOG. `CF > 2` se convierte en `L > ln2 = 0.6931`. Un test de
 *     ratio pasa a ser una resta y una comparación: cero divisiones en el hot
 *     path, y la misma disciplina aditiva-log de SensorFusionChamber.
 *
 * (2) BASELINE ASIMÉTRICA. B debe seguir el SUELO: sube lento (α_up, vida
 *     media ~1s — un transitorio no puede arrastrar su propia referencia) y
 *     baja más rápido (α_down, ~190ms — una caída de sección no deja un techo
 *     rancio suprimiendo la detección). Mismo idioma que _impact en
 *     CognitiveFluidState.ts:100-102.
 *
 * (3) EL KERNEL DE TASA ES EXACTO, NO HEURÍSTICO. R(t) = Σ (1/τ)e^(−Δt/τ)
 *     cumple E[R] = λ para un proceso de Poisson estacionario: R está en
 *     eventos/segundo por construcción, no por tuning. La constante de
 *     normalización se DERIVA, no se calibra.
 */

// ═══════════════════════════════════════════════════════════════════════════
// Constantes — calibrables por Simulated Annealing sobre el corpus de 10 tracks
// (misma metodología que ILiquidCognitionProfile WAVE 7004.4)
// ═══════════════════════════════════════════════════════════════════════════

/** Suelo del dominio logarítmico */
const EPS_E = 1e-4
/** Umbral CF = 2 en dominio log */
const LN2 = 0.6931471805599453
/** Subida de la baseline (vida media ≈ 1.0s @ 44Hz) */
const A_UP = 0.015
/** Bajada de la baseline (vida media ≈ 190ms @ 44Hz) */
const A_DOWN = 0.080
/** Tracker de dispersión — solo se actualiza mientras está desarmado */
const A_STAT = 0.010
/** Sensibilidad del suelo adaptativo */
const MAD_K = 1.5
/** MAD → σ para residuos gaussianos */
const MAD_SIG = 1.2533
/** Caída del Schmitt = ln(1.25) — 25% por debajo de θ */
const HYST = 0.2231435513
/** Refractario 40ms → techo 25 ev/s (semicorcheas @174 BPM = 11.6 ev/s) */
const T_REF = 0.040
/** τ del estimador de tasa = 1.5s */
const INV_TAU = 1 / 1.5
/** Tasa (eventos/s) a la que Π_raw = 0.5 — saturación de Hill n=1 */
const R_REF = 3.5
/** Gate de energía absoluta — espeja el 0.15 de CognitiveFluidState.ts:235 */
const E_GATE = 0.12

// ═══════════════════════════════════════════════════════════════════════════
// Detector — 7 escalares, zero-alloc, zero-latencia, cero transcendentales
// más allá de un ln por banda
// ═══════════════════════════════════════════════════════════════════════════

export class CrestDetector {
  private _base = 0      // B(t) — baseline en dominio log
  private _muL = 0       // E[L] — media del residuo
  private _madL = 0      // E[|L−μ|] — dispersión robusta
  private _rate = 0      // R(t) — eventos por segundo
  private _armed = 0     // estado del Schmitt trigger (0/1)
  private _tLast = -1e9  // timestamp del último evento aceptado (s)
  private _event = 0     // 1 en el frame en que dispara un evento
  private _theta = LN2   // umbral efectivo actual (telemetría)

  /**
   * Un frame. Hot path @44Hz.
   *
   * @param energy Energía cruda normalizada (0-1)
   * @param t      Timestamp en SEGUNDOS (monotónico)
   * @param dt     Delta del frame en segundos
   * @returns Π_raw ∈ [0,1) — densidad de transitorios normalizada, pre-EMA
   */
  tick(energy: number, t: number, dt: number): number {
    // ── 1. Nivel log y tracker asimétrico del suelo ──
    const l = Math.log(EPS_E + energy)
    const aB = l > this._base ? A_UP : A_DOWN   // ternario → cmov, sin salto
    this._base += aB * (l - this._base)

    // ── 2. Cresta en dominio log: L = ln CF ──
    const L = l - this._base

    // ── 3. Suelo adaptativo. Se actualiza SOLO mientras está desarmado, para
    //       que los eventos no inflen el propio umbral que los filtra.
    //       θ solo puede SUBIR por encima de LN2 — nunca bajar. Esto es
    //       esencial: un umbral plenamente adaptativo auto-normalizaría la
    //       tasa de eventos y volvería Π constante, es decir, sin información.
    //       Un master hipercomprimido reporta por tanto percusividad BAJA en
    //       vez de ser reescalado dentro de rango.
    if (this._armed === 0) {
      this._muL += A_STAT * (L - this._muL)
      this._madL += A_STAT * (Math.abs(L - this._muL) - this._madL)
    }
    const adaptive = this._muL + MAD_K * MAD_SIG * this._madL
    const theta = adaptive > LN2 ? adaptive : LN2
    this._theta = theta

    // ── 4. Schmitt trigger + refractario. Dispara en el CRUCE, no en el
    //       máximo local: cero latencia añadida, que es el punto de un motor
    //       de latencia negativa. El peak-picking costaría 1-2 frames por
    //       ~nada, ya que Π se promedia con EMA de 8s aguas abajo.
    this._event = 0
    if (this._armed === 0) {
      if (L >= theta && energy > E_GATE && (t - this._tLast) >= T_REF) {
        this._armed = 1
        this._tLast = t
        this._event = 1
        // Peso de severidad: satura una octava de CF por encima de θ. Suelo
        // 0.5 para que un transitorio marginal cuente como evento, pero no
        // como uno completo.
        const over = L - theta
        const w = 0.5 + 0.5 * (over < LN2 ? over / LN2 : 1)
        this._rate += w * INV_TAU   // impulso del kernel de Poisson: E[R] = λ
      }
    } else if (L <= theta - HYST) {
      this._armed = 0   // histéresis: sin chattering en la frontera
    }

    // ── 5. Decaimiento de la tasa. exp(−dt/τ) ≈ 1 − dt/τ con dt/τ ≈ 0.015
    //       → error 1e-4. Un multiply en vez de un transcendental.
    this._rate -= this._rate * dt * INV_TAU
    if (this._rate < 0) this._rate = 0

    // ── 6. Saturación de Hill n=1. Suave, monótona, C¹, nunca clipea, sin
    //       exp. Π_raw = 0.5 exactamente en R = R_REF.
    return this._rate / (this._rate + R_REF)
  }

  /** 🪟 Flag de transitorio real de latencia cero — para Glass Break / s_V */
  get event(): boolean { return this._event === 1 }
  /** R(t) — eventos de cresta (CF>2) por segundo */
  get rate(): number { return this._rate }
  /** θ(t) — umbral efectivo en dominio log (telemetría) */
  get theta(): number { return this._theta }

  reset(): void {
    this._base = 0
    this._muL = 0
    this._madL = 0
    this._rate = 0
    this._armed = 0
    this._tLast = -1e9
    this._event = 0
    this._theta = LN2
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Variante multibanda — la intensidad de Poisson de una superposición de
// procesos independientes es la SUMA de intensidades, así que fusionar tasas
// es exacto, no heurístico. Un kick y un hi-hat son dos transitorios; una
// envolvente de banda ancha registra uno.
// ═══════════════════════════════════════════════════════════════════════════

export class MultiBandCrestDetector {
  private readonly _b: Float32Array
  private readonly _mu: Float32Array
  private readonly _mad: Float32Array
  private readonly _r: Float32Array
  private readonly _arm: Uint8Array
  private readonly _tl: Float64Array
  private readonly _w: Float32Array
  private _event = 0
  private _rFused = 0

  constructor(weights: readonly number[]) {
    const n = weights.length
    this._b = new Float32Array(n)
    this._mu = new Float32Array(n)
    this._mad = new Float32Array(n)
    this._r = new Float32Array(n)
    this._arm = new Uint8Array(n)
    this._tl = new Float64Array(n).fill(-1e9)
    this._w = new Float32Array(weights)
  }

  /**
   * @param bands Energías por banda (0-1), longitud = weights.length
   * @param t     Timestamp en segundos
   * @param dt    Delta en segundos
   * @returns Π_raw ∈ [0,1)
   */
  tick(bands: ArrayLike<number>, t: number, dt: number): number {
    const nb = this._w.length
    const decay = dt * INV_TAU
    let rFused = 0
    let anyEvent = 0

    for (let k = 0; k < nb; k++) {
      const e = bands[k]
      const l = Math.log(EPS_E + e)
      const aB = l > this._b[k] ? A_UP : A_DOWN
      this._b[k] += aB * (l - this._b[k])
      const L = l - this._b[k]

      if (this._arm[k] === 0) {
        this._mu[k] += A_STAT * (L - this._mu[k])
        this._mad[k] += A_STAT * (Math.abs(L - this._mu[k]) - this._mad[k])
      }
      const adaptive = this._mu[k] + MAD_K * MAD_SIG * this._mad[k]
      const theta = adaptive > LN2 ? adaptive : LN2

      if (this._arm[k] === 0) {
        if (L >= theta && e > E_GATE && (t - this._tl[k]) >= T_REF) {
          this._arm[k] = 1
          this._tl[k] = t
          anyEvent = 1
          const over = L - theta
          const w = 0.5 + 0.5 * (over < LN2 ? over / LN2 : 1)
          this._r[k] += w * INV_TAU
        }
      } else if (L <= theta - HYST) {
        this._arm[k] = 0
      }

      let r = this._r[k]
      r -= r * decay
      this._r[k] = r < 0 ? 0 : r
      rFused += this._w[k] * this._r[k]
    }

    this._event = anyEvent
    this._rFused = rFused
    return rFused / (rFused + R_REF)
  }

  get event(): boolean { return this._event === 1 }
  get rate(): number { return this._rFused }
  /** Tasa por banda (eventos/s) — telemetría */
  bandRate(k: number): number { return this._r[k] }

  reset(): void {
    this._b.fill(0)
    this._mu.fill(0)
    this._mad.fill(0)
    this._r.fill(0)
    this._arm.fill(0)
    this._tl.fill(-1e9)
    this._event = 0
    this._rFused = 0
  }
}
