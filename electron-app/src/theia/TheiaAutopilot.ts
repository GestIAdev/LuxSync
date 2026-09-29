/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ✈️ TheiaAutopilot — WAVE 8306 (Blueprint Ola D1 · §6.2–6.3)
 *
 * Secuenciador mecánico de la playlist. Vive FUERA del ciclo de render de
 * React: un tick por rAF (~60 Hz, zero-alloc) que lee el ring de telemetría
 * del orquestador vía `TelemetryWireReader` — la fase de beat/bar llega del
 * DSP, no de `setTimeout`, así que los cortes no derivan.
 *
 * Modos:
 *   OFF     — motor parado.
 *   SEQ     — continuo hacia adelante; al llegar al final se detiene (END).
 *   LOOP    — wrap al primer ítem no-skip.
 *   SHUFFLE — bolsa Fisher-Yates sobre ítems no-skip: agota la lista sin
 *             repetir; al re-barajar, el primer ítem nuevo ≠ último tocado.
 *
 * DWELL  — permanencia por ítem en compases (anclada a BAR_COUNT+BAR_PHASE)
 *          o segundos (performance.now). Sin reloj de audio vivo, 'bars'
 *          cae a segundos estimados por BPM (fallback 120).
 * QUANT  — al vencer el dwell no se corta de inmediato: se espera la
 *          frontera 'beat' | 'bar' | 'phrase' (=4 compases) detectada por
 *          flanco de fase/contador del ring. Guardia anti-glitch: si el
 *          overshoot supera dwell+4 bars (u 8 s), dispara igual.
 * DROP   — con dropSnap activo, un `drop_incoming` (enums.predictionType=1)
 *          o CREST_EVENT arma el corte anticipado al próximo downbeat
 *          (bar edge) ignorando el dwell restante.
 *
 * Disparo: `playAt(target, xFadeSec*1000)` del playlist store — misma vía
 * que el click manual, por lo que STRICT LIVE GATE y la resurrección de
 * `core#seed` aplican igual. Si el operador dispara a mano otro ítem, el
 * dwell se re-ancla sobre él (manual siempre gana).
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { getThetaOrchestrator } from './ThetaOrchestrator'
import {
  TELEMETRY_SLOT,
  TEL_FLAG,
  telFlag,
  unpackEnums,
  TelemetryWireReader,
  type TelemetryEnums,
} from './telemetry/TheiaTelemetryRing'
import { useTheiaPlaylistStore } from '../stores/useTheiaPlaylistStore'
import { useTheiaAutopilotStore } from '../stores/useTheiaAutopilotStore'

/** Frase musical = 4 compases (convención VJ del blueprint §6.2). */
const PHRASE_BARS = 4
/** Overshoot máximo sobre el dwell antes de disparar sin frontera. */
const MAX_OVERSHOOT_BARS = 4
const MAX_OVERSHOOT_SEC = 8
/** BPM de emergencia cuando el reloj de audio está muerto. */
const FALLBACK_BPM = 120

/** Snapshot de telemetría que consume el tick (inyectable en tests). */
export interface AutopilotTelemetry {
  readonly bpm: number
  readonly beatPhase: number
  readonly barPhase: number
  readonly barCount: number
  readonly audioLive: boolean
  readonly onBeat: boolean
  readonly dropIncoming: boolean
  readonly crestEvent: boolean
}

export interface AutopilotDeps {
  /** Fuente de telemetría — default: reader propio sobre el SAB del
   *  orquestador. Devolver null = sin frame válido aún (audio muerto). */
  readonly telemetry?: () => AutopilotTelemetry | null
  /** Disparo — default: `useTheiaPlaylistStore.playAt`. */
  readonly fire?: (index: number, crossfadeMs: number) => boolean
  /** Reloj de pared — default: performance.now. */
  readonly now?: () => number
}

interface SeqState {
  prevBeatPhase: number
  prevBarPhase: number
  prevBarCount: number
  firedAtMs: number
  firedBarFloat: number
  firedItemIndex: number
  syncWaiting: boolean
  dropArmed: boolean
  bag: number[]
  exhausted: boolean
  started: boolean
}

function freshSeq(): SeqState {
  return {
    prevBeatPhase: -1,
    prevBarPhase: -1,
    prevBarCount: -1,
    firedAtMs: 0,
    firedBarFloat: 0,
    firedItemIndex: -1,
    syncWaiting: false,
    dropArmed: false,
    bag: [],
    exhausted: false,
    started: false,
  }
}

/** Fisher-Yates sobre los índices no-skip; el primer elemento nuevo jamás
 *  es `avoid` (último reproducido de la bolsa anterior) salvo lista única. */
export function shuffleBag(candidates: number[], avoid: number, rand = Math.random): number[] {
  const bag = [...candidates]
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[bag[i], bag[j]] = [bag[j], bag[i]]
  }
  if (bag.length > 1 && bag[0] === avoid) {
    // swap con una posición aleatoria distinta de 0
    const j = 1 + Math.floor(rand() * (bag.length - 1))
    ;[bag[0], bag[j]] = [bag[j], bag[0]]
  }
  return bag
}

export class TheiaAutopilot {
  private readonly deps: Required<AutopilotDeps>
  private seq: SeqState = freshSeq()
  private rafHandle: number | null = null
  private timerHandle: ReturnType<typeof setInterval> | null = null
  private ticking = false
  private unsubscribe: (() => void)[] = []
  private readonly enumsOut: TelemetryEnums = {
    schemaVersion: 0,
    predictionType: 0,
    huntState: 0,
    energyZone: 0,
  }

  constructor(deps: AutopilotDeps = {}) {
    // Default telemetry: reader propio sobre el SAB del orquestador.
    let reader: TelemetryWireReader | null = null
    const defaultTelemetry = (): AutopilotTelemetry | null => {
      try {
        const theta = getThetaOrchestrator()
        if (!reader) reader = new TelemetryWireReader(theta.getTelemetryRing())
        reader.read() // consume si hay frame nuevo; scratch persiste si no
        const s = reader.getScratch()
        if (!s) return null
        const enums = unpackEnums(reader.enums, this.enumsOut)
        return {
          bpm: s[TELEMETRY_SLOT.BPM] || 0,
          beatPhase: s[TELEMETRY_SLOT.BEAT_PHASE] || 0,
          barPhase: s[TELEMETRY_SLOT.BAR_PHASE] || 0,
          barCount: s[TELEMETRY_SLOT.BAR_COUNT] || 0,
          audioLive: telFlag(reader.flags, TEL_FLAG.AUDIO_LIVE),
          onBeat: telFlag(reader.flags, TEL_FLAG.ON_BEAT),
          dropIncoming: enums.predictionType === 1,
          crestEvent: telFlag(reader.flags, TEL_FLAG.CREST_EVENT),
        }
      } catch {
        return null
      }
    }
    this.deps = {
      telemetry: deps.telemetry ?? defaultTelemetry,
      fire:
        deps.fire ??
        ((index, crossfadeMs) =>
          useTheiaPlaylistStore.getState().playAt(index, crossfadeMs)),
      now: deps.now ?? (() => performance.now()),
    }
  }

  /**
   * Conecta el motor: reacciona al modo del store y a la playlist.
   * Idempotente; devuelve dispose.
   */
  init(): () => void {
    if (this.unsubscribe.length > 0) return () => this.dispose()
    this.unsubscribe.push(
      useTheiaAutopilotStore.subscribe(() => this.syncClock()),
      useTheiaPlaylistStore.subscribe((s, prev) => {
        if (s.items.length !== prev.items.length) this.syncClock()
        // Manual override: el operador disparó otro ítem → re-anclar dwell.
        if (s.activeIndex !== prev.activeIndex) {
          this.onExternalFire(s.activeIndex)
        }
      }),
    )
    this.syncClock()
    return () => this.dispose()
  }

  dispose(): void {
    for (const off of this.unsubscribe) off()
    this.unsubscribe = []
    this.stopClock()
  }

  /** Arranca/detiene el tick según modo + contenido de la playlist. */
  private syncClock(): void {
    const { mode } = useTheiaAutopilotStore.getState()
    const hasItems = useTheiaPlaylistStore.getState().items.length > 0
    if (mode !== 'off' && hasItems && !this.ticking) {
      this.seq = freshSeq()
      this.startClock()
    } else if ((mode === 'off' || !hasItems) && this.ticking) {
      this.stopClock()
      useTheiaAutopilotStore.getState().__engineReport({
        countdownLabel: '—',
        dwellFrac: 0,
        syncWaiting: false,
        engineRunning: false,
      })
    }
  }

  private startClock(): void {
    this.ticking = true
    useTheiaAutopilotStore.getState().__engineReport({ engineRunning: true })
    const step = () => {
      if (!this.ticking) return
      this.tick()
      if (typeof requestAnimationFrame === 'function') {
        this.rafHandle = requestAnimationFrame(step)
      }
    }
    if (typeof requestAnimationFrame === 'function') {
      this.rafHandle = requestAnimationFrame(step)
    } else {
      // Entorno sin rAF (tests/node) — tick a ~30 Hz.
      this.timerHandle = setInterval(() => this.tick(), 33)
    }
  }

  private stopClock(): void {
    this.ticking = false
    if (this.rafHandle !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.rafHandle)
      this.rafHandle = null
    }
    if (this.timerHandle !== null) {
      clearInterval(this.timerHandle)
      this.timerHandle = null
    }
  }

  /** El operador disparó otro ítem a mano → el dwell re-arranca sobre él.
   *  Público: lo llama la suscripción de init() y los tests. El gate es el
   *  modo del piloto, no el clock — el método también es llamable en tests
   *  sin init(). */
  onExternalFire(activeIndex: number): void {
    if (useTheiaAutopilotStore.getState().mode === 'off') return
    if (activeIndex === this.seq.firedItemIndex) return
    this.seq.firedItemIndex = activeIndex
    this.seq.firedAtMs = this.deps.now()
    this.seq.firedBarFloat = -1 // se re-ancla en el próximo tick con fase real
    this.seq.syncWaiting = false
    this.seq.dropArmed = false
    this.seq.exhausted = false
    this.seq.started = true
  }

  // ── Núcleo ──────────────────────────────────────────────────────────

  /** Un paso del motor. Público para tests deterministas (sin reloj). */
  tick(): void {
    const ap = useTheiaAutopilotStore.getState()
    const pl = useTheiaPlaylistStore.getState()
    const now = this.deps.now()
    const tel = this.deps.telemetry()

    if (pl.items.length === 0) return

    const bpm = tel && tel.bpm > 0 ? tel.bpm : FALLBACK_BPM
    const audioAlive = !!tel && tel.audioLive
    const barSec = (4 * 60) / bpm // segundos por compás (4/4)
    const barFloat = tel ? tel.barCount + tel.barPhase : 0

    // Flancos de frontera (wrap de fase / incremento de contador).
    const beatEdge =
      !!tel && this.seq.prevBeatPhase >= 0 && tel.beatPhase < this.seq.prevBeatPhase - 0.5
    const barEdge = !!tel && this.seq.prevBarCount >= 0 && tel.barCount > this.seq.prevBarCount
    const phraseEdge = barEdge && tel.barCount % PHRASE_BARS === 0
    if (tel) {
      this.seq.prevBeatPhase = tel.beatPhase
      this.seq.prevBarPhase = tel.barPhase
      this.seq.prevBarCount = tel.barCount
    }

    // ── Arranque: sin LIVE → dispara el primer ítem no-skip de inmediato ──
    if (!this.seq.started) {
      this.seq.started = true
      if (pl.activeIndex < 0) {
        const first = pl.items.findIndex((it) => !it.flags.skip)
        if (first < 0) return this.report('—', 0, false, false)
        this.fireAt(first, tel)
        return
      }
      // Ya hay algo en LIVE: el dwell arranca sobre él.
      this.seq.firedItemIndex = pl.activeIndex
      this.seq.firedAtMs = now
      this.seq.firedBarFloat = barFloat
    }
    if (this.seq.firedBarFloat < 0) this.seq.firedBarFloat = barFloat
    if (this.seq.exhausted) {
      return this.report('END', 1, false, true)
    }

    // ── Dwell elapsed ──
    const dwellBars =
      ap.dwell.unit === 'bars'
        ? ap.dwell.value
        : ap.dwell.value / barSec // 'sec' → equivalente en compases
    const elapsedBars = audioAlive
      ? barFloat - this.seq.firedBarFloat
      : (now - this.seq.firedAtMs) / 1000 / barSec
    const dwellDone = elapsedBars >= dwellBars

    // ── DROP SNAP — arma corte anticipado al próximo downbeat ──
    if (
      ap.dropSnap &&
      !this.seq.dropArmed &&
      (tel?.dropIncoming || tel?.crestEvent)
    ) {
      this.seq.dropArmed = true
      this.seq.syncWaiting = true
    }

    // ── Frontera quant ──
    const boundaryHit =
      ap.quant === 'beat' ? beatEdge : ap.quant === 'bar' ? barEdge : phraseEdge

    // Anti-glitch: overshoot duro — la frontera nunca llegó.
    const overshootBars = elapsedBars - dwellBars
    const overshootSec = overshootBars * barSec
    const forced =
      this.seq.syncWaiting &&
      (overshootBars > MAX_OVERSHOOT_BARS || overshootSec > MAX_OVERSHOOT_SEC)

    const wantFire =
      this.seq.dropArmed
        ? barEdge || !audioAlive || forced // drop snap → próximo downbeat
        : dwellDone && (boundaryHit || !audioAlive || forced)

    if (dwellDone && !this.seq.syncWaiting) this.seq.syncWaiting = true

    if (wantFire) {
      const target = this.nextTarget(ap.mode)
      if (target < 0) {
        // SEQ llegó al final — motor exhausto hasta nueva acción.
        this.seq.exhausted = true
        return this.report('END', 1, false, true)
      }
      this.fireAt(target, tel)
      return
    }

    // ── Readout ──
    const remain = Math.max(0, dwellBars - elapsedBars)
    if (this.seq.dropArmed) {
      this.report('DROP ▸', 1, true, true)
    } else if (this.seq.syncWaiting) {
      this.report('SYNC ▸', 1, true, true)
    } else if (ap.dwell.unit === 'bars' && audioAlive) {
      this.report(`${remain.toFixed(1)} bars`, elapsedBars / dwellBars, false, true)
    } else {
      const remainSec = Math.max(0, remain * barSec)
      this.report(`${remainSec.toFixed(0)}s`, elapsedBars / dwellBars, false, true)
    }
  }

  private report(label: string, frac: number, sync: boolean, running: boolean): void {
    useTheiaAutopilotStore.getState().__engineReport({
      countdownLabel: label,
      dwellFrac: Math.max(0, Math.min(1, frac)),
      syncWaiting: sync,
      engineRunning: running,
    })
  }

  /** Índice del próximo ítem según el modo (con skip). -1 = agotado. */
  private nextTarget(mode: 'off' | 'seq' | 'loop' | 'shuffle'): number {
    const pl = useTheiaPlaylistStore.getState()
    const n = pl.items.length
    const cur = pl.activeIndex

    const playableFwd = (fromExclusive: number, wrap: boolean): number => {
      for (let i = Math.max(0, fromExclusive); i < n; i++) {
        if (!pl.items[i].flags.skip) return i
      }
      if (wrap) {
        for (let i = 0; i <= cur && i < n; i++) {
          if (!pl.items[i].flags.skip) return i
        }
      }
      return -1
    }

    switch (mode) {
      case 'seq':
        return playableFwd(cur + 1, false)
      case 'loop':
        return playableFwd(cur + 1, true)
      case 'shuffle': {
        const next = this.peekShuffle(pl.items)
        if (next >= 0) this.seq.bag.shift() // consumo real
        return next
      }
      default:
        return -1
    }
  }

  /** Cabeza de la bolsa shuffle sin consumir (para el cue del lane). */
  private peekShuffle(items: readonly { flags: { skip: boolean } }[]): number {
    const pl = useTheiaPlaylistStore.getState()
    if (this.seq.bag.length === 0) {
      const candidates: number[] = []
      for (let i = 0; i < items.length; i++) {
        if (!items[i].flags.skip) candidates.push(i)
      }
      // La primera carta de la bolsa nueva nunca repite el último LIVE.
      this.seq.bag = shuffleBag(candidates, this.seq.firedItemIndex)
    }
    // La bolsa puede contener ítems borrados/skippeados después del shuffle —
    // purga perezosa sin tocar el orden de los que quedan.
    this.seq.bag = this.seq.bag.filter(
      (i) => i < pl.items.length && !pl.items[i].flags.skip,
    )
    return this.seq.bag[0] ?? -1
  }

  private fireAt(index: number, tel: AutopilotTelemetry | null): void {
    const ap = useTheiaAutopilotStore.getState()
    const xfadeMs = Math.round(ap.xFadeSec * 1000)
    const ok = this.deps.fire(index, xfadeMs)
    if (!ok) {
      // El ítem no pudo disparar — lo marcamos skip implícito y seguimos.
      this.seq.syncWaiting = false
      return
    }
    this.seq.firedItemIndex = index
    this.seq.firedAtMs = this.deps.now()
    this.seq.firedBarFloat = tel ? tel.barCount + tel.barPhase : -1
    this.seq.syncWaiting = false
    this.seq.dropArmed = false
    // El cue del lane refleja lo que dispararía el PRÓXIMO ciclo del piloto —
    // peek sin consumir la bolsa shuffle.
    const pl = useTheiaPlaylistStore.getState()
    const peek =
      ap.mode === 'shuffle'
        ? this.peekShuffle(pl.items)
        : this.nextTarget(ap.mode)
    useTheiaPlaylistStore.getState().setCueIndex(peek)
  }
}

// ─────────────────────────── Singleton + init ───────────────────────────

let __autopilot: TheiaAutopilot | null = null

/** Singleton del motor — arranca perezoso; `init()` lo conecta a los stores. */
export function getTheiaAutopilot(): TheiaAutopilot {
  if (!__autopilot) __autopilot = new TheiaAutopilot()
  return __autopilot
}
