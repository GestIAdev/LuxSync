/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ✈️ useTheiaAutopilotStore — WAVE 8306/8307 (Blueprint Ola D · §6.3–6.4)
 *
 * Configuración del secuenciador (Auto-Pilot) + el DIRECTOR (árbitro de quién
 * decide lo siguiente) + readouts que escribe el engine a baja frecuencia.
 *
 * El MOTOR vive en `src/theia/TheiaAutopilot.ts` — fuera de React, con su
 * propio TelemetryWireReader. Este store es la superficie de control.
 *
 * DIRECTOR (excluyentes):
 *   manual   — solo el humano. El engine está parado.
 *   playlist — el Auto-Pilot mecánico (modo SEQ/LOOP/SHUFFLE).
 *   selene   — Selene elige el ganador de la playlist (o del catálogo si
 *              está vacía) al expirar el dwell.
 *   hold     — ⏸ estado transicional: el humano tocó algo; la automatización
 *              calla `holdBars` compases y luego reanuda `resumeDirector`.
 *
 * Coherencia modo⇄director (una sola fuente de verdad, aquí):
 *   - mode OFF  ⇒ director playlist pasa a manual.
 *   - mode ≠OFF ⇒ director manual pasa a playlist.
 *   - director playlist con mode OFF ⇒ mode LOOP (default sensato).
 *
 * dwell / quant / xFade:
 *   dwell    : permanencia por ítem — {unit:'bars'|'sec', value}
 *   quant    : frontera de corte — 'beat' | 'bar' | 'phrase' (4 compases)
 *   xFadeSec : crossfade del disparo automático (0–8 s)
 *
 * 🧹 WAVE 8405 · M1 — DROP SNAP extinto: la automatización solo responde
 * al dwell programado. No hay cortes anticipados por predicción de drop.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { create } from 'zustand'

export type AutopilotMode = 'off' | 'seq' | 'loop' | 'shuffle'
export type AutopilotQuant = 'beat' | 'bar' | 'phrase'
export type AutopilotDwellUnit = 'bars' | 'sec'
export type TheiaDirector = 'manual' | 'playlist' | 'selene' | 'hold'
/** Directores seleccionables desde la UI (hold es transicional). */
export type TheiaDirectorChoice = Exclude<TheiaDirector, 'hold'>
export type ResumableDirector = Exclude<TheiaDirector, 'hold' | 'manual'>

export interface AutopilotDwell {
  readonly unit: AutopilotDwellUnit
  readonly value: number
}

/** Presets del selector DWELL (bars: 4–64 · sec: 5–120). */
export const DWELL_PRESETS_BARS = [4, 8, 16, 32, 64] as const
export const DWELL_PRESETS_SEC = [5, 10, 20, 30, 60, 120] as const
/** Ventana de HOLD tras un disparo manual (compases). Default = 1 frase×4. */
export const HOLD_PRESETS_BARS = [4, 8, 16, 32] as const

export interface TheiaAutopilotState {
  readonly mode: AutopilotMode
  readonly dwell: AutopilotDwell
  readonly quant: AutopilotQuant
  /** Crossfade del disparo automático en segundos (0–8). */
  readonly xFadeSec: number

  // ── Director (Ola D2) ──
  readonly director: TheiaDirector
  /** Director al que se vuelve cuando expira/cancela el HOLD. */
  readonly resumeDirector: ResumableDirector | null
  /** Duración de la ventana HOLD en compases (default 16). */
  readonly holdBars: number
  /** Se incrementa en cada take-over: el engine re-ancla la ventana. */
  readonly holdEpoch: number
  /** "7.2 bars" / "12s" — cuenta atrás del HOLD (engine, ruta fría). */
  readonly holdLabel: string

  // ── Readout del engine (ruta fría — no telemetría por frame) ──
  /** Texto "12.4 bars" / "SYNC ▸" / "—" para el indicador de cuenta atrás. */
  readonly countdownLabel: string
  /** 0..1 — progreso del dwell actual (mini barra). */
  readonly dwellFrac: number
  /** true cuando el dwell venció y el engine espera la frontera quant. */
  readonly syncWaiting: boolean
  /** true mientras el engine tiene el reloj corriendo. */
  readonly engineRunning: boolean

  setMode: (mode: AutopilotMode) => void
  setDwell: (dwell: AutopilotDwell) => void
  setQuant: (quant: AutopilotQuant) => void
  setXFadeSec: (sec: number) => void

  /** Selección explícita del operador (cancela cualquier HOLD). */
  setDirector: (director: TheiaDirectorChoice) => void
  setHoldBars: (bars: number) => void
  /**
   * 🖐 REGLA DE ORO — cualquier disparo manual llama aquí. PLAYLIST/SELENE
   * pasan a HOLD; un take-over dentro de un HOLD re-arma la ventana.
   * Con director MANUAL es no-op.
   */
  takeOver: () => void
  /** Cancela el HOLD y reanuda el director original al instante (click en
   *  el indicador) — también lo usa el engine al expirar la ventana. */
  cancelHold: () => void

  /** Escritura interna del engine — no llamar desde UI. */
  __engineReport: (patch: {
    countdownLabel?: string
    dwellFrac?: number
    syncWaiting?: boolean
    engineRunning?: boolean
    holdLabel?: string
  }) => void
}

export const useTheiaAutopilotStore = create<TheiaAutopilotState>((set, get) => ({
  mode: 'off',
  dwell: { unit: 'bars', value: 32 },
  quant: 'phrase',
  xFadeSec: 2,

  director: 'manual',
  resumeDirector: null,
  holdBars: 16,
  holdEpoch: 0,
  holdLabel: '',

  countdownLabel: '—',
  dwellFrac: 0,
  syncWaiting: false,
  engineRunning: false,

  setMode: (mode) => {
    const { director, resumeDirector } = get()
    if (mode === 'off') {
      if (director === 'playlist') return set({ mode, director: 'manual' })
      if (director === 'hold' && resumeDirector === 'playlist') {
        return set({ mode, director: 'manual', resumeDirector: null, holdLabel: '' })
      }
      return set({ mode })
    }
    set(director === 'manual' ? { mode, director: 'playlist' } : { mode })
  },
  setDwell: (dwell) => set({ dwell }),
  setQuant: (quant) => set({ quant }),
  setXFadeSec: (sec) => set({ xFadeSec: Math.max(0, Math.min(8, sec)) }),

  setDirector: (director) => {
    const { mode } = get()
    set({
      director,
      resumeDirector: null,
      holdLabel: '',
      mode: director === 'playlist' && mode === 'off' ? 'loop' : mode,
    })
  },
  setHoldBars: (bars) => set({ holdBars: Math.max(1, Math.min(64, Math.round(bars))) }),

  takeOver: () => {
    const { director, holdEpoch } = get()
    if (director === 'manual') return
    if (director === 'hold') return set({ holdEpoch: holdEpoch + 1 })
    set({ director: 'hold', resumeDirector: director, holdEpoch: holdEpoch + 1 })
  },

  cancelHold: () => {
    const { director, resumeDirector } = get()
    if (director !== 'hold') return
    set({ director: resumeDirector ?? 'manual', resumeDirector: null, holdLabel: '' })
  },

  __engineReport: (patch) => {
    // Anti-churn: solo set si algo cambió (el engine reporta cada tick).
    const s = useTheiaAutopilotStore.getState()
    const dirty =
      (patch.countdownLabel !== undefined && patch.countdownLabel !== s.countdownLabel) ||
      (patch.dwellFrac !== undefined && Math.abs(patch.dwellFrac - s.dwellFrac) > 0.005) ||
      (patch.syncWaiting !== undefined && patch.syncWaiting !== s.syncWaiting) ||
      (patch.engineRunning !== undefined && patch.engineRunning !== s.engineRunning) ||
      (patch.holdLabel !== undefined && patch.holdLabel !== s.holdLabel)
    if (dirty) set(patch)
  },
}))
