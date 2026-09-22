/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 CELL SURGEON — WAVE 8040B · T7 (`✜`): EL BISTURÍ MULTICELULAR
 *
 * Blueprint §5.7: doble clic sobre un fixture compuesto → el inspector de
 * celdas: el aparato se expande (`fitRect`) y sus nodos REALES (petal-*,
 * wash, impact, beam-color…) — incluido el anillo sintético de 0.15 m que
 * solo existe en el NodeGraph — quedan seleccionables por celda.
 *
 * INTERACCIÓN:
 *   - Doble clic en fixture compuesto → abrir cirugía (expande + selecciona
 *     todas sus celdas).
 *   - Clic en una celda del fixture abierto → selección EXCLUSIVA de esa
 *     celda (Shift = añade celdas del mismo aparato).
 *   - Arrastre → recoge celdas del aparato bajo el cursor.
 *   - Doble clic en OTRO fixture con patrón seleccionado → COPIA el
 *     patrón celular: las celdas seleccionadas (por cellSuffix) se aplican
 *     al nuevo aparato — "aplicar a los 6 Tungsten".
 *   - Doble clic en el fixture abierto / Esc / cambio de tool → cerrar.
 *
 * BANDA DE ESTADO (honestidad §T7):
 *   - MCC-Cell activo si Δ1–Δ3 están en el build (`MCC_CELL_AVAILABLE`).
 *   - Si no: MCC-Z — la selección por celda agrupa por `zoneId`
 *     (todas las celdas de esa zona, cross-fixture). Nunca se emite un
 *     `.lfx` que prometa independencia que el runtime colapsaría.
 *
 * @module HephaestusView/asteria/tools/CellSurgeonTool
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { AsteriaTool, AsteriaToolContext } from './ToolRegistry'
import { clearGesturePreview } from './ToolRegistry'
import { nearestNodeToScreen } from './selection'
import { MCC_CELL_AVAILABLE } from '../mccCapability'
import type { NodeAtlas } from '../store/useAsteriaStore'
import type { NodeAtlasEntry } from '../../../../../core/aether/types'

/** Radio de pick del clic celular en px de pantalla. */
const CELL_PICK_RADIUS_PX = 12
/** Radio de recogida del arrastre celular en metros del mundo. */
const CELL_DRAG_RADIUS_M = 0.15

export interface CellSurgeonDeps {
  /** Capacidad MCC-Cell del build (test inyecta false → modo MCC-Z). */
  mccCellAvailable?: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS PUROS (testeables sin canvas)
// ─────────────────────────────────────────────────────────────────────────────

/** Celdas (nodos) de un device en orden canónico del atlas. */
export function deviceCells(
  atlas: NodeAtlas | null,
  deviceId: string,
): NodeAtlasEntry[] {
  if (!atlas) return []
  return atlas.entries.filter((e) => e.deviceId === deviceId)
}

/** ¿Fixture compuesto? (>1 nodo físico en el NodeGraph). */
export function isCompoundDevice(
  atlas: NodeAtlas | null,
  deviceId: string,
): boolean {
  return deviceCells(atlas, deviceId).length > 1
}

/** Bounding box en metros de las celdas posicionadas de un device. */
export function deviceBounds(
  atlas: NodeAtlas | null,
  deviceId: string,
): { cx: number; cz: number; w: number; d: number } | null {
  const cells = deviceCells(atlas, deviceId)
  let minX = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxZ = -Infinity
  let any = false
  for (const c of cells) {
    if (!c.position) continue
    any = true
    minX = Math.min(minX, c.position.x)
    maxX = Math.max(maxX, c.position.x)
    minZ = Math.min(minZ, c.position.z)
    maxZ = Math.max(maxZ, c.position.z)
  }
  if (!any) return null
  return {
    cx: (minX + maxX) / 2,
    cz: (minZ + maxZ) / 2,
    w: Math.max(0.4, maxX - minX + 0.4),
    d: Math.max(0.4, maxZ - minZ + 0.4),
  }
}

/**
 * Copia de patrón celular (§T7 "aplicar a los 6 Tungsten"): toma los
 * `cellSuffix` de los nodeIds seleccionados y devuelve los nodeIds del
 * device destino que comparten sufijo. Determinista, orden del atlas.
 */
export function mapCellPattern(
  atlas: NodeAtlas | null,
  sourceNodeIds: Iterable<string>,
  targetDeviceId: string,
): string[] {
  if (!atlas) return []
  const suffixes = new Set<string>()
  for (const id of sourceNodeIds) {
    const e = atlas.byNodeId.get(id)
    if (e) suffixes.add(e.cellSuffix)
  }
  return atlas.entries
    .filter((e) => e.deviceId === targetDeviceId && suffixes.has(e.cellSuffix))
    .map((e) => e.nodeId)
}

/**
 * Grupo MCC-Z (modo degradado): todos los nodos del atlas que comparten
 * la zona del nodo picado — "todos los pétalos" por clase, no por celda.
 */
export function zoneGroup(
  atlas: NodeAtlas | null,
  zoneId: string,
): string[] {
  if (!atlas || !zoneId) return []
  return atlas.entries.filter((e) => e.zoneId === zoneId).map((e) => e.nodeId)
}

// ─────────────────────────────────────────────────────────────────────────────
// TOOL
// ─────────────────────────────────────────────────────────────────────────────

export function createCellSurgeonTool(deps: CellSurgeonDeps = {}): AsteriaTool {
  const mccCell = deps.mccCellAvailable ?? MCC_CELL_AVAILABLE

  /** Device en cirugía — sincronizado al store vía ctx.setSurgeonDevice. */
  let deviceId: string | null = null
  let dragging = false
  let additive = false
  let dragSet: Set<string> = new Set()

  const close = (ctx: AsteriaToolContext) => {
    deviceId = null
    dragging = false
    dragSet = new Set()
    ctx.setSurgeonDevice(null)
    clearGesturePreview()
  }

  /** Expande el device: selecciona sus celdas + encuadre + estado. */
  const openSurgery = (ctx: AsteriaToolContext, dev: string) => {
    deviceId = dev
    ctx.setSurgeonDevice(dev)
    ctx.setSelection(deviceCells(ctx.atlas(), dev).map((e) => e.nodeId), false)
    const b = deviceBounds(ctx.atlas(), dev)
    if (b) ctx.fitRect(b.cx, b.cz, b.w, b.d)
  }

  /** Re-enfoca la cirugía a otro device sin pisar la selección (paste). */
  const retargetSurgery = (ctx: AsteriaToolContext, dev: string) => {
    deviceId = dev
    ctx.setSurgeonDevice(dev)
    const b = deviceBounds(ctx.atlas(), dev)
    if (b) ctx.fitRect(b.cx, b.cz, b.w, b.d)
  }

  return {
    id: 'cell',
    label: 'Cell Surgeon',
    icon: '✜',
    cursor: 'crosshair',
    hotkey: 'x',

    onPointerDown(sx, sy, e, ctx) {
      const atlas = ctx.atlas()
      if (!atlas) return
      // Sin cirugía abierta el clic no hace nada — el bisturí entra por
      // doble clic (onDoubleClick). Evita selecciones accidentales.
      if (!deviceId) return

      const hit = nearestNodeToScreen(
        atlas, ctx.transform(), sx, sy, CELL_PICK_RADIUS_PX,
      )
      if (!hit) return
      const entry = atlas.byNodeId.get(hit)
      if (!entry || entry.deviceId !== deviceId) return

      additive = e.shiftKey === true

      if (!mccCell) {
        // MCC-Z: la celda no es targeteable sola — agrupa por zona (§T7).
        ctx.setSelection(zoneGroup(atlas, entry.zoneId), additive)
        return
      }

      // MCC-Cell: selección exclusiva a nivel de celda
      dragSet = new Set([hit])
      dragging = true
      ctx.setSelection([hit], additive)
    },

    onPointerMove(sx, sy, _e, ctx) {
      if (!dragging || !deviceId || !mccCell) return
      const atlas = ctx.atlas()
      if (!atlas) return
      const t = ctx.transform()
      const wx = (sx - t.canvasW / 2) / t.cam.zoom + t.cam.panX
      const wz = (sy - t.canvasH / 2) / t.cam.zoom + t.cam.panY
      const r2 = CELL_DRAG_RADIUS_M * CELL_DRAG_RADIUS_M
      for (const c of atlas.entries) {
        if (c.deviceId !== deviceId || !c.position) continue
        const dx = c.position.x - wx
        const dz = c.position.z - wz
        if (dx * dx + dz * dz <= r2) dragSet.add(c.nodeId)
      }
      ctx.previewSelection(dragSet)
    },

    onPointerUp(_sx, _sy, _e, ctx) {
      if (!dragging) return
      dragging = false
      if (dragSet.size > 0) ctx.setSelection(dragSet, additive)
      dragSet = new Set()
      ctx.previewSelection([])
    },

    onDoubleClick(sx, sy, e, ctx) {
      const atlas = ctx.atlas()
      if (!atlas) return
      const hit = nearestNodeToScreen(
        atlas, ctx.transform(), sx, sy, CELL_PICK_RADIUS_PX * 2,
      )
      if (!hit) {
        close(ctx)
        return
      }
      const entry = atlas.byNodeId.get(hit)
      if (!entry) return

      // Doble clic sobre el device abierto → cerrar cirugía
      if (entry.deviceId === deviceId) {
        close(ctx)
        return
      }

      // Doble clic sobre OTRO device con selección celular viva →
      // pegar patrón ("aplicar a los 6 Tungsten"): los cellSuffix
      // seleccionados se mapean a las celdas del nuevo aparato.
      if (deviceId) {
        const sel = ctx.selection()
        const onSource = [...sel].filter(
          (id) => atlas.byNodeId.get(id)?.deviceId === deviceId,
        )
        if (onSource.length > 0) {
          const mapped = mapCellPattern(atlas, onSource, entry.deviceId)
          if (mapped.length > 0) {
            const keep = mccCell
              ? mapped
              : mapped.flatMap((id) => {
                  const e = atlas.byNodeId.get(id)
                  return e ? zoneGroup(atlas, e.zoneId) : []
                })
            // Shift+dblclick = añade el patrón a la selección (los 6
            // Tungsten acumulados); sin Shift = reemplazo exclusivo.
            ctx.setSelection(keep, e.shiftKey === true)
            retargetSurgery(ctx, entry.deviceId)
            return
          }
        }
      }

      if (!isCompoundDevice(atlas, entry.deviceId)) return
      openSurgery(ctx, entry.deviceId)
    },

    cancel() {
      dragging = false
      dragSet = new Set()
      deviceId = null
      clearGesturePreview()
      // Nota: cancel no tiene ctx — el store se sincroniza desde la vista
      // al cambiar de herramienta (setActiveTool limpia surgeonDeviceId).
    },
  }
}

/** Instancia por defecto registrada en el toolbox. */
export const CellSurgeonTool = createCellSurgeonTool()
