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
}

/** Singleton mutable — las tools escriben, GestureLayer lee. */
export const gesturePreview: GesturePreview = {
  marquee: null,
  lasso: null,
  radial: null,
}

/** Limpia toda la geometría de gesto (al soltar / cambiar de herramienta). */
export function clearGesturePreview(): void {
  gesturePreview.marquee = null
  gesturePreview.lasso = null
  gesturePreview.radial = null
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

  onPointerDown?(sx: number, sy: number, e: PointerEvent | React.PointerEvent, ctx: AsteriaToolContext): void
  onPointerMove?(sx: number, sy: number, e: PointerEvent | React.PointerEvent, ctx: AsteriaToolContext): void
  onPointerUp?(sx: number, sy: number, e: PointerEvent | React.PointerEvent, ctx: AsteriaToolContext): void
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
