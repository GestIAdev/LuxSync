/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎛️ THEIA TRANSPORT STORE — WAVE 8239 (Hybrid Deck · Fase U1)
 *
 * Estado REACTIVO del transporte de vídeo del motor Theia. El
 * `ThetaOrchestrator` es la fuente de verdad: alimenta este store desde los
 * eventos del `HTMLVideoElement` oculto (play / pause / timeupdate / ended)
 * y la UI consume sin conocer el elemento.
 *
 * Semántica:
 *   - `isPlaying`   ← eventos 'play'/'pause' del elemento.
 *   - `loop`        → preferencia UI; el orchestrator la aplica al elemento
 *                     (`video.loop`) en cada loadVideo y en cada toggle.
 *   - `currentTime` ← 'timeupdate' (segundos). Solo lectura para la UI;
 *                     el scrub va por `theta.getVideoElement().currentTime`.
 *   - `duration`    ← 'loadedmetadata'/'durationchange' (segundos).
 *   - `hasVideo`    → false si el medio activo es un átomo `kind:'shader'`
 *                     (el transporte se atenúa — el autómata no tiene scrub).
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { create } from 'zustand'

interface TheiaTransportState {
  readonly isPlaying: boolean
  readonly loop: boolean
  readonly currentTime: number
  readonly duration: number
  /** ¿Hay un HTMLVideoElement cargado? (false → medio shader o vacío). */
  readonly hasVideo: boolean
}

interface TheiaTransportActions {
  /**
   * Canal interno orchestrator→UI. Aplica un patch parcial del estado.
   * Llamado por `ThetaOrchestrator` en los listeners del video element.
   */
  syncFromVideo(patch: Partial<TheiaTransportState>): void
  /** Toggle LOOP — la UI lo fija aquí y el orchestrator lo aplica. */
  setLoop(loop: boolean): void
  /** Reset al desconectar el medio (blackout / unload / stop). */
  resetTransport(): void
}

export type TheiaTransportStore = TheiaTransportState & TheiaTransportActions

const INITIAL: TheiaTransportState = {
  isPlaying: false,
  loop: true, // VJ default: el átomo activo loopea hasta nueva orden
  currentTime: 0,
  duration: 0,
  hasVideo: false,
}

export const useTheiaTransportStore = create<TheiaTransportStore>((set) => ({
  ...INITIAL,

  syncFromVideo(patch) {
    set(patch)
  },

  setLoop(loop) {
    set({ loop })
  },

  resetTransport() {
    set({ isPlaying: false, currentTime: 0, duration: 0, hasVideo: false })
  },
}))
