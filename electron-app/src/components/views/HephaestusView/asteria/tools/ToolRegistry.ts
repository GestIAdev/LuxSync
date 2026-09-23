/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 TOOL REGISTRY — WAVE 8020: CONTRATO DE HERRAMIENTAS DEL LIENZO
 *
 * Contrato base de una herramienta del Tactical Canvas + el registro de
 * las herramientas de selección (select / lasso / radial).
 *
 * Modelo de eventos: el canvas pasa coordenadas en PÍXELES CSS
 * (offsetX/offsetY) + el pointer event nativo (para shiftKey/button).
 * Las herramientas convierten a metros via ctx.transform() (snapshot
 * no reactivo — las herramientas corren fuera de React).
 *
 * La geometría del gesto EN CURSO (marquee, lasso, radio) vive en el
 * singleton mutable `gesturePreview` — GestureLayer lo lee por referencia
 * dentro del RAF. Ninguna herramienta toca React durante el drag.
 * Solo el commit escribe la selección al store (una vez, en pointerup —
 * o en vivo durante el drag para el feedback, deduplicado por firma).
 *
 * @module HephaestusView/asteria/tools/ToolRegistry
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { WorldTransform } from '../canvas/useWorldTransform'
import type { NodeAtlas, AsteriaToolId } from '../store/useAsteriaStore'
import type { Gesture } from '../model/AsteriaProject'

// ─────────────────────────────────────────────────────────────────────────────
// GESTURE PREVIEW — geometría del gesto en curso (mutable, leída por RAF)
// ─────────────────────────────────────────────────────────────────────────────

export interface GesturePreview {
  /** Marquee rectangular en METROS del mundo (dos esquinas). */
  marquee: { x0: number; z0: number; x1: number; z1: number } | null
  /** Polígono del lasso en metros: array plano [x0,z0,x1,z1,…]. */
  lasso: number[] | null
  /** Radio expansivo: centro + radio en metros. */
  radial: { cx: number; cz: number; r: number } | null
  /** 🜨 T3 Chrono-Brush: trazo en curso — array plano [x0,z0,…] + radio. */
  chrono: { pts: number[]; radiusM: number } | null
  /** 🜨 T5 Glyph Stamper: rect del texto en curso (centro + alto + canal). */
  glyph: {
    x: number; z: number; scaleM: number; rotDeg: number
    text: string; channel: 'delay' | 'gain'
  } | null
  /**
   * 🜨 8150-F4 Polygon: vértices committed (plano [x,z,…]) + cursor
   * para la banda elástica del último vértice.
   */
  polygon: { pts: number[]; hoverX: number; hoverZ: number } | null
  /** 🜨 8150-F4 Line: segmento en curso + media anchura de la banda. */
  line: { ax: number; az: number; bx: number; bz: number; halfWidthM: number } | null
  /**
   * 🜨 8182 Wavefront: emisor anclado (metros) + dirección del frente
   * si el drag supera el umbral de click (hasDir → shape 'line').
   */
  wave: { x: number; z: number; dirDeg: number; hasDir: boolean } | null
}

/** Singleton mutable — las tools escriben, GestureLayer lee. */
export const gesturePreview: GesturePreview = {
  marquee: null,
  lasso: null,
  radial: null,
  chrono: null,
  glyph: null,
  polygon: null,
  line: null,
  wave: null,
}

/** Limpia toda la geometría de gesto (al soltar / cambiar de herramienta). */
export function clearGesturePreview(): void {
  gesturePreview.marquee = null
  gesturePreview.lasso = null
  gesturePreview.radial = null
  gesturePreview.chrono = null
  gesturePreview.glyph = null
  gesturePreview.polygon = null
  gesturePreview.line = null
  gesturePreview.wave = null
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT & CONTRACT
// ─────────────────────────────────────────────────────────────────────────────

/** Servicios que el canvas inyecta a cada herramienta. */
export interface AsteriaToolContext {
  /** Transform mundo↔pantalla actual (snapshot del RAF). */
  transform: () => WorldTransform
  /** Atlas del NodeGraph (referencia estable del store). */
  atlas: () => NodeAtlas | null
  /** Commit de selección. additive = unir a la existente (Shift). */
  setSelection: (nodeIds: Iterable<string>, additive: boolean) => void
  /** Hover set — firma-deduplicado en el store. */
  setHover: (nodeIds: Iterable<string>) => void
  /** Preview de selección en vivo durante el drag (marquee/radial). */
  previewSelection: (nodeIds: Iterable<string>) => void
  /** 🜨 8040B: selección committed actual (snapshot del store). */
  selection: () => ReadonlySet<string>
  /** 🜨 8040B: empuja un gesto al Gesture Stack (no destructivo). */
  addGesture: (gesture: Gesture) => void
  /** 🜨 8040B (T7): expande/cierra el inspector celular de un fixture. */
  setSurgeonDevice: (deviceId: string | null) => void
  /** 🜨 8040B (T7): encuadra un rect del mundo (expansión del bisturí). */
  fitRect: (
    centerX: number,
    centerZ: number,
    widthM: number,
    depthM: number,
    marginPx?: number,
  ) => void
}

export interface AsteriaTool {
  readonly id: AsteriaToolId
  readonly label: string
  /** Glifo del botón del toolbox. */
  readonly icon: string
  /** Cursor CSS mientras la herramienta está activa. */
  readonly cursor: string
  /** Tecla de atajo (key lowercase). */
  readonly hotkey: string

  /**
   * 🜨 8150-F4: la tool quiere pointermove SIN botón (banda elástica
   * del Polygon entre clics). Cuando es true, el canvas le pasa los
   * moves en reposo y suprime el hover-pick (evita pokes fantasma).
   */
  readonly trackIdlePointer?: boolean

  onPointerDown?(sx: number, sy: number, e: PointerEvent | React.PointerEvent, ctx: AsteriaToolContext): void
  onPointerMove?(sx: number, sy: number, e: PointerEvent | React.PointerEvent, ctx: AsteriaToolContext): void
  onPointerUp?(sx: number, sy: number, e: PointerEvent | React.PointerEvent, ctx: AsteriaToolContext): void
  /** 🜨 8040B (T7): doble clic sobre el lienzo (Cell Surgeon expande). */
  onDoubleClick?(sx: number, sy: number, e: MouseEvent | React.MouseEvent, ctx: AsteriaToolContext): void
  /** 🜨 8150-F4: tecla dirigida a la tool activa (Enter cierra, Esc cancela). */
  onKeyDown?(e: KeyboardEvent, ctx: AsteriaToolContext): void
  /** Cancela/limpia el gesto en curso (cambio de herramienta, Esc). */
  cancel?(): void
}

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRY — las tools se importan perezosamente para evitar ciclos
// ─────────────────────────────────────────────────────────────────────────────

/** Registro poblado por AsteriaCanvas en su primer render (ver abajo). */
export const TOOL_REGISTRY: Partial<Record<AsteriaToolId, AsteriaTool>> = {}

export function registerTool(tool: AsteriaTool): void {
  TOOL_REGISTRY[tool.id] = tool
}

export function getTool(id: AsteriaToolId): AsteriaTool | undefined {
  return TOOL_REGISTRY[id]
}
