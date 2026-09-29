/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ✈️ useTheiaAutopilotStore — WAVE 8306 (Blueprint Ola D1 · §6.3)
 *
 * Configuración del secuenciador mecánico (Auto-Pilot) + readout escrito por
 * el engine a baja frecuencia (≤ ~8 Hz — label/fracción, ruta fría).
 *
 * El MOTOR vive en `src/theia/TheiaAutopilot.ts` — fuera de React, con su
 * propio TelemetryWireReader sobre el SAB del orquestador. Este store es
 * solo la superficie de control del AutoPilotBar.
 *
 *   mode     : off | seq | loop | shuffle
 *   dwell    : permanencia por ítem — {unit:'bars'|'sec', value}
 *   quant    : frontera de corte — 'beat' | 'bar' | 'phrase' (4 compases)
 *   xFadeSec : crossfade del disparo automático (0–8 s)
 *   dropSnap : si la telemetría anuncia drop inminente (predictionType=1 o
 *              CREST_EVENT), adelanta el corte al próximo downbeat ignorando
 *              el dwell restante.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { create } from 'zustand'

export type AutopilotMode = 'off' | 'seq' | 'loop' | 'shuffle'
export type AutopilotQuant = 'beat' | 'bar' | 'phrase'
export type AutopilotDwellUnit = 'bars' | 'sec'

export interface AutopilotDwell {
  readonly unit: AutopilotDwellUnit
  readonly value: number
}

/** Presets del selector DWELL (bars: 4–64 · sec: 5–120). */
export const DWELL_PRESETS_BARS = [4, 8, 16, 32, 64] as const
export const DWELL_PRESETS_SEC = [5, 10, 20, 30, 60, 120] as const

export interface TheiaAutopilotState {
  readonly mode: AutopilotMode
  readonly dwell: AutopilotDwell
  readonly quant: AutopilotQuant
  /** Crossfade del disparo automático en segundos (0–8). */
  readonly xFadeSec: number
  readonly dropSnap: boolean

  // ── Readout del engine (ruta fría — no telemetría por frame) ──
  /** Texto "12.4 bars" / "SYNC"/"—" para el indicador de cuenta atrás. */
  readonly countdownLabel: string
  /** 0..1 — progreso del dwell actual (mini barra). */
  readonly dwellFrac: number
  /** true cuando el dwell venció y el engine espera la frontera quant. */
  readonly syncWaiting: boolean
  /** true mientras el engine tiene ítems navegables y el reloj corre. */
  readonly engineRunning: boolean

  setMode: (mode: AutopilotMode) => void
  setDwell: (dwell: AutopilotDwell) => void
  setQuant: (quant: AutopilotQuant) => void
  setXFadeSec: (sec: number) => void
  setDropSnap: (on: boolean) => void

  /** Escritura interna del engine — no llamar desde UI. */
  __engineReport: (patch: {
    countdownLabel?: string
    dwellFrac?: number
    syncWaiting?: boolean
    engineRunning?: boolean
  }) => void
}

export const useTheiaAutopilotStore = create<TheiaAutopilotState>((set) => ({
  mode: 'off',
  dwell: { unit: 'bars', value: 32 },
  quant: 'phrase',
  xFadeSec: 2,
  dropSnap: true,

  countdownLabel: '—',
  dwellFrac: 0,
  syncWaiting: false,
  engineRunning: false,

  setMode: (mode) => set({ mode }),
  setDwell: (dwell) => set({ dwell }),
  setQuant: (quant) => set({ quant }),
  setXFadeSec: (sec) => set({ xFadeSec: Math.max(0, Math.min(8, sec)) }),
  setDropSnap: (on) => set({ dropSnap: on }),

  __engineReport: (patch) => {
    // Anti-churn: solo set si algo cambió (el engine reporta cada tick).
    const s = useTheiaAutopilotStore.getState()
    const dirty =
      (patch.countdownLabel !== undefined && patch.countdownLabel !== s.countdownLabel) ||
      (patch.dwellFrac !== undefined && Math.abs(patch.dwellFrac - s.dwellFrac) > 0.005) ||
      (patch.syncWaiting !== undefined && patch.syncWaiting !== s.syncWaiting) ||
      (patch.engineRunning !== undefined && patch.engineRunning !== s.engineRunning)
    if (dirty) set(patch)
  },
}))
