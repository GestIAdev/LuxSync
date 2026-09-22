/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 ASTERIA STORE — WAVE 8010-P1: CÁMARA DEL LIENZO TÁCTICO
 *
 * Estado de la cámara del Tactical Canvas (proyección top-down del plano XZ).
 *
 * Semántica de la cámara:
 *   - `panX` / `panY` = el punto del MUNDO (en METROS) situado en el centro
 *     del viewport. `panX` es el eje X del stage; `panY` es el eje Z (depth)
 *     — el eje Y (altura) se ignora por decisión D-3 del blueprint.
 *   - `zoom` = píxeles de canvas por metro (px/m). 40 px/m ≈ vista 1:40.
 *
 * El tamaño del canvas (`canvasW`/`canvasH`, CSS px) vive aquí porque las
 * matemáticas mundo↔pantalla lo necesitan; `AsteriaCanvas` lo actualiza
 * vía ResizeObserver.
 *
 * El store es plano y efímero — NO se persiste en el `.lfx` (la cámara es
 * estado de UI, no de documento).
 *
 * @module HephaestusView/asteria/store/useAsteriaStore
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { create } from 'zustand'
import type { NodeAtlasEntry } from '../../../../../core/aether/types'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES & CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🜨 WAVE 8010-P2: el Node Atlas consumible por las capas del canvas.
 * `useNodeAtlas` lo construye UNA vez por fetch (patch-time) y lo deposita
 * aquí — las capas RAF lo leen via `useAsteriaStore.getState().nodeAtlas`
 * como REFERENCIA ESTABLE, sin suscripciones ni re-renders de React.
 */
export interface NodeAtlas {
  readonly entries: readonly NodeAtlasEntry[]
  readonly byNodeId: ReadonlyMap<string, NodeAtlasEntry>
}

/** Límites de zoom en píxeles por metro. */
export const ASTERIA_ZOOM_MIN = 4
export const ASTERIA_ZOOM_MAX = 600
/** Zoom inicial: 40 px/m — un stage de ~12 m cabe holgado en ~800 px. */
export const ASTERIA_ZOOM_DEFAULT = 40

export interface AsteriaCamera {
  /** Eje X del mundo (m) en el centro del viewport. */
  panX: number
  /** Eje Z del mundo (m) en el centro del viewport (+Z = abajo en pantalla). */
  panY: number
  /** Píxeles de canvas por metro. */
  zoom: number
}

export interface AsteriaStore extends AsteriaCamera {
  /** Tamaño CSS del canvas en píxeles (lo fija el ResizeObserver). */
  canvasW: number
  canvasH: number

  /**
   * 🜨 WAVE 8010-P2: fotografía del NodeGraph real (WAVE 8000) depositada
   * por useNodeAtlas. Referencia estable entre fetches — las capas de
   * dibujo la consumen por getState() dentro del RAF (zero React cost).
   * null = atlas aún no cargado o fetch fallido.
   */
  nodeAtlas: NodeAtlas | null
  /** Deposita el atlas tras un fetch exitoso (patch-time only). */
  setNodeAtlas: (atlas: NodeAtlas | null) => void

  /** Merge parcial de cámara con clamp de zoom. */
  setCamera: (cam: Partial<AsteriaCamera>) => void
  /** Pan gestual: desplaza la vista por un delta en PÍXELES de pantalla. */
  panByScreen: (dxPx: number, dyPx: number) => void
  /**
   * Zoom centrado en un punto de pantalla (cursor): el punto del mundo bajo
   * el cursor permanece fijo mientras cambia la escala.
   */
  zoomAtScreen: (sxPx: number, syPx: number, factor: number) => void
  /** Actualiza el tamaño CSS del canvas (ResizeObserver). */
  setCanvasSize: (w: number, h: number) => void
  /** Vuelve a la cámara por defecto (centrada en el origen del stage). */
  resetCamera: () => void
  /**
   * Encuadra un rectángulo del mundo (centro + tamaño en metros) con un
   * margen en píxeles. Pensado para el Crystal Box del stage en P2.
   */
  fitRect: (centerX: number, centerZ: number, widthM: number, depthM: number, marginPx?: number) => void
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function clampZoom(z: number): number {
  return Math.min(ASTERIA_ZOOM_MAX, Math.max(ASTERIA_ZOOM_MIN, z))
}

// ═══════════════════════════════════════════════════════════════════════════
// STORE
// ═══════════════════════════════════════════════════════════════════════════

export const useAsteriaStore = create<AsteriaStore>((set, get) => ({
  panX: 0,
  panY: 0,
  zoom: ASTERIA_ZOOM_DEFAULT,
  canvasW: 0,
  canvasH: 0,
  nodeAtlas: null,

  setNodeAtlas: (atlas) => set({ nodeAtlas: atlas }),

  setCamera: (cam) =>
    set((s) => ({
      panX: cam.panX ?? s.panX,
      panY: cam.panY ?? s.panY,
      zoom: cam.zoom !== undefined ? clampZoom(cam.zoom) : s.zoom,
    })),

  panByScreen: (dxPx, dyPx) =>
    set((s) => ({
      panX: s.panX - dxPx / s.zoom,
      panY: s.panY - dyPx / s.zoom,
    })),

  zoomAtScreen: (sxPx, syPx, factor) =>
    set((s) => {
      const zoom = clampZoom(s.zoom * factor)
      if (zoom === s.zoom || s.canvasW <= 0 || s.canvasH <= 0) {
        return { zoom }
      }
      // Punto del mundo bajo el cursor ANTES del zoom
      const wx = (sxPx - s.canvasW / 2) / s.zoom + s.panX
      const wz = (syPx - s.canvasH / 2) / s.zoom + s.panY
      // Nuevo pan para que ese mismo punto quede bajo el cursor tras el zoom
      return {
        zoom,
        panX: wx - (sxPx - s.canvasW / 2) / zoom,
        panY: wz - (syPx - s.canvasH / 2) / zoom,
      }
    }),

  setCanvasSize: (w, h) => set({ canvasW: w, canvasH: h }),

  resetCamera: () =>
    set({ panX: 0, panY: 0, zoom: ASTERIA_ZOOM_DEFAULT }),

  fitRect: (centerX, centerZ, widthM, depthM, marginPx = 48) => {
    const { canvasW, canvasH } = get()
    if (canvasW <= 0 || canvasH <= 0 || widthM <= 0 || depthM <= 0) return
    const zoom = clampZoom(
      Math.min((canvasW - marginPx * 2) / widthM, (canvasH - marginPx * 2) / depthM),
    )
    set({ panX: centerX, panY: centerZ, zoom })
  },
}))
