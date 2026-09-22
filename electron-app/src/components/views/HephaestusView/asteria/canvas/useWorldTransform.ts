/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 WORLD TRANSFORM — WAVE 8010-P1: MATEMÁTICAS DEL LIENZO (PURO)
 *
 * Conversión entre coordenadas del MUNDO (metros, plano XZ top-down) y
 * coordenadas de PANTALLA (píxeles CSS del canvas).
 *
 * Regla de ejes (D-3 del blueprint):
 *   - Mundo +X  → pantalla derecha
 *   - Mundo +Z  → pantalla ABAJO (el canvas no tiene eje Y del mundo;
 *                la altura de los fixtures se ignora en la proyección)
 *   - La cámara (`panX`/`panY` del store) es el punto del MUNDO en metros
 *     que queda en el centro del viewport. `zoom` = px por metro.
 *
 * Todas las funciones de conversión son PURAS y sin dependencias de React:
 * el loop RAF las consume via `getWorldTransform()` (snapshot no reactivo,
 * zero-alloc-friendly). `useWorldTransform()` es el wrapper reactivo para
 * componentes React que necesiten redibujar UI con la cámara.
 *
 * @module HephaestusView/asteria/canvas/useWorldTransform
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useAsteriaStore, type AsteriaCamera } from '../store/useAsteriaStore'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Contexto completo de transformación: cámara + tamaño del viewport. */
export interface WorldTransform {
  cam: AsteriaCamera
  /** Ancho del canvas en píxeles CSS. */
  canvasW: number
  /** Alto del canvas en píxeles CSS. */
  canvasH: number
}

export interface ScreenPoint {
  x: number
  y: number
}

export interface WorldPoint {
  /** Metros en el eje X del stage. */
  x: number
  /** Metros en el eje Z del stage (profundidad). */
  z: number
}

// ═══════════════════════════════════════════════════════════════════════════
// CONVERSIONES PURAS — mundo (m) ↔ pantalla (px CSS)
// ═══════════════════════════════════════════════════════════════════════════

/** Mundo (x, z) en metros → punto de pantalla en píxeles CSS. */
export function worldToScreen(wx: number, wz: number, t: WorldTransform): ScreenPoint {
  return {
    x: (wx - t.cam.panX) * t.cam.zoom + t.canvasW / 2,
    y: (wz - t.cam.panY) * t.cam.zoom + t.canvasH / 2,
  }
}

/** Pantalla (px CSS) → punto del mundo en metros (x, z). */
export function screenToWorld(sx: number, sy: number, t: WorldTransform): WorldPoint {
  return {
    x: (sx - t.canvasW / 2) / t.cam.zoom + t.cam.panX,
    z: (sy - t.canvasH / 2) / t.cam.zoom + t.cam.panY,
  }
}

/** Longitud en metros → píxeles (solo escala, sin pan). */
export function metersToPx(m: number, t: WorldTransform): number {
  return m * t.cam.zoom
}

/** Píxeles → metros (solo escala, sin pan). */
export function pxToMeters(px: number, t: WorldTransform): number {
  return px / t.cam.zoom
}

/**
 * Rectángulo visible del mundo en metros {minX, minZ, maxX, maxZ}.
 * Útil para culling de capas y para dibujar la grid solo en rango visible.
 */
export function visibleWorldRect(t: WorldTransform): {
  minX: number
  minZ: number
  maxX: number
  maxZ: number
} {
  const halfW = t.canvasW / 2 / t.cam.zoom
  const halfH = t.canvasH / 2 / t.cam.zoom
  return {
    minX: t.cam.panX - halfW,
    maxX: t.cam.panX + halfW,
    minZ: t.cam.panY - halfH,
    maxZ: t.cam.panY + halfH,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ACCESO AL STORE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Snapshot NO reactivo del transform actual — para el loop RAF y handlers
 * de eventos que no deben re-renderizar React por frame.
 */
export function getWorldTransform(): WorldTransform {
  const s = useAsteriaStore.getState()
  return {
    cam: { panX: s.panX, panY: s.panY, zoom: s.zoom },
    canvasW: s.canvasW,
    canvasH: s.canvasH,
  }
}

/**
 * Hook reactivo: devuelve el transform actual y helpers ya ligados a él.
 * Cada cambio de cámara o tamaño re-renderiza el consumidor — usar solo en
 * UI React (HUD, overlays), NUNCA dentro del loop de dibujo.
 */
export function useWorldTransform(): WorldTransform & {
  worldToScreen: (wx: number, wz: number) => ScreenPoint
  screenToWorld: (sx: number, sy: number) => WorldPoint
  metersToPx: (m: number) => number
} {
  const panX = useAsteriaStore((s) => s.panX)
  const panY = useAsteriaStore((s) => s.panY)
  const zoom = useAsteriaStore((s) => s.zoom)
  const canvasW = useAsteriaStore((s) => s.canvasW)
  const canvasH = useAsteriaStore((s) => s.canvasH)

  const t: WorldTransform = { cam: { panX, panY, zoom }, canvasW, canvasH }
  return {
    ...t,
    worldToScreen: (wx, wz) => worldToScreen(wx, wz, t),
    screenToWorld: (sx, sy) => screenToWorld(sx, sy, t),
    metersToPx: (m) => metersToPx(m, t),
  }
}
