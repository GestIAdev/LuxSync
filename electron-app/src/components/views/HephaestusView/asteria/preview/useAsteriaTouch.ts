/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 USE ASTERIA TOUCH — WAVE 8020: PROTOCOLO POKE
 *
 * Traduce el tacto del lienzo (hover ∪ selección) a la fuente 'touch' del
 * CalibrationBus, con la cadencia exacta que exige el backend:
 *
 *   hover / selección  →  union de nodeIds → bus.setTouchNodes()
 *                         (publica SOLO en cambio de set, coalescido a rAF)
 *   heartbeat 400 ms   →  bus.touchPulse() mientras haya nodos tocados —
 *                         mantiene vivo el watchdog de 500 ms del NodeArbiter
 *   release            →  fade-out lógico 180 ms → setTouchNodes(∅)
 *   Esc / unmount      →  panicClear() inmediato (kill-switch L3++)
 *   pokeEnabled=false  →  el tacto no publica (se comporta como ∅)
 *
 * El hook NO renderiza nada — es pura suscripción + timers. La suscripción
 * a Zustand con selector compone la unión por fuera de React.
 *
 * @module HephaestusView/asteria/preview/useAsteriaTouch
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useEffect } from 'react'
import { useAsteriaStore } from '../store/useAsteriaStore'
import { asteriaCalibrationBus } from './CalibrationBus'

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS — del blueprint §9.2 / §10
// ─────────────────────────────────────────────────────────────────────────────

/** Watchdog del NodeArbiter: 500 ms → heartbeat a 400 ms con margen. */
const POKE_HEARTBEAT_MS = 400
/** Fade-out lógico al soltar: el rig sostiene el flash ~6 frames antes
 *  de liberar la capa — evita el parpadeo hover→nada→hover. */
const POKE_RELEASE_FADE_MS = 180

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

export function useAsteriaTouch(): void {
  useEffect(() => {
    let heartbeatTimer: number | null = null
    let releaseTimer: number | null = null

    const stopHeartbeat = () => {
      if (heartbeatTimer !== null) {
        window.clearInterval(heartbeatTimer)
        heartbeatTimer = null
      }
    }

    const ensureHeartbeat = () => {
      if (heartbeatTimer !== null) return
      heartbeatTimer = window.setInterval(() => {
        asteriaCalibrationBus.touchPulse()
      }, POKE_HEARTBEAT_MS)
    }

    /**
     * Unión hover ∪ selección → fuente touch del bus.
     * Se invoca en cada cambio de cualquiera de los dos sets.
     */
    const emitTouch = () => {
      const s = useAsteriaStore.getState()

      if (!s.pokeEnabled) {
        // Kill-switch: comportarse como release inmediato
        stopHeartbeat()
        if (releaseTimer !== null) {
          window.clearTimeout(releaseTimer)
          releaseTimer = null
        }
        asteriaCalibrationBus.setTouchNodes([])
        return
      }

      // Unión sin alloc extra cuando uno de los sets está vacío
      const hover = s.hoverNodeIds
      const sel = s.selectionNodeIds
      const union =
        hover.size === 0 ? sel
        : sel.size === 0 ? hover
        : new Set<string>([...sel, ...hover])

      if (union.size > 0) {
        // Hay tacto vivo: cancelar un release pendiente, publicar, heartbeat
        if (releaseTimer !== null) {
          window.clearTimeout(releaseTimer)
          releaseTimer = null
        }
        asteriaCalibrationBus.setTouchNodes(union)
        ensureHeartbeat()
      } else if (releaseTimer === null) {
        // Release: fade-out lógico — el último set sigue publicado 180 ms
        // (y el heartbeat lo mantiene) antes de vaciar la fuente.
        releaseTimer = window.setTimeout(() => {
          releaseTimer = null
          asteriaCalibrationBus.setTouchNodes([])
          stopHeartbeat()
        }, POKE_RELEASE_FADE_MS)
      }
    }

    // Suscripción a cambios de hover / selección / pokeEnabled
    const unsubscribe = useAsteriaStore.subscribe((state, prev) => {
      if (
        state.hoverNodeIds !== prev.hoverNodeIds ||
        state.selectionNodeIds !== prev.selectionNodeIds ||
        state.pokeEnabled !== prev.pokeEnabled
      ) {
        emitTouch()
      }
    })
    // Estado preexistente (p.ej. remount con selección viva)
    emitTouch()

    // Esc = liberación total del tacto (kill-switch físico del operador)
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (releaseTimer !== null) {
        window.clearTimeout(releaseTimer)
        releaseTimer = null
      }
      stopHeartbeat()
      asteriaCalibrationBus.setTouchNodes([])
      const s = useAsteriaStore.getState()
      s.setHover([])
      s.setSelection([])
    }
    window.addEventListener('keydown', onKeyDown)

    return () => {
      unsubscribe()
      window.removeEventListener('keydown', onKeyDown)
      stopHeartbeat()
      if (releaseTimer !== null) window.clearTimeout(releaseTimer)
      // Desmontar la pestaña libera la fuente touch — jamás dejar un
      // fixture flasheando por un componente que ya no existe.
      asteriaCalibrationBus.setTouchNodes([])
    }
  }, [])
}
