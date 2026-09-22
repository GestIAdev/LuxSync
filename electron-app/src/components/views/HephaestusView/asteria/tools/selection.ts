/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 SELECTION QUERIES — WAVE 8020: SPATIAL PICKING (PURO)
 *
 * Funciones puras de consulta espacial sobre el Node Atlas para las
 * herramientas de selección. Todas operan en METROS del mundo (plano XZ)
 * salvo `nearestNodeToScreen`, que toma un punto en píxeles de canvas.
 *
 * Nodos sin `position` se ignoran en todas las queries — no se puede
 * seleccionar lo que no está en el plano.
 *
 * @module HephaestusView/asteria/tools/selection
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { NodeAtlas } from '../store/useAsteriaStore'
import type { WorldTransform } from '../canvas/useWorldTransform'

// ─────────────────────────────────────────────────────────────────────────────
// QUERIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Nodo más cercano a un punto de PANTALLA dentro de `radiusPx`.
 * Devuelve el nodeId o null. La distancia se mide en px (pick radius
 * constante en pantalla, independiente del zoom).
 */
export function nearestNodeToScreen(
  atlas: NodeAtlas | null,
  t: WorldTransform,
  sx: number,
  sy: number,
  radiusPx = 10,
): string | null {
  if (!atlas) return null
  const halfW = t.canvasW / 2
  const halfH = t.canvasH / 2
  const zoom = t.cam.zoom
  const r2 = radiusPx * radiusPx

  let best: string | null = null
  let bestD2 = r2

  const entries = atlas.entries
  for (let i = 0; i < entries.length; i++) {
    const pos = entries[i].position
    if (!pos) continue
    const dx = (pos.x - t.cam.panX) * zoom + halfW - sx
    const dy = (pos.z - t.cam.panY) * zoom + halfH - sy
    const d2 = dx * dx + dy * dy
    if (d2 < bestD2) {
      bestD2 = d2
      best = entries[i].nodeId
    }
  }
  return best
}

/** Nodos dentro de un rectángulo del mundo {minX, minZ, maxX, maxZ}. */
export function nodesInWorldRect(
  atlas: NodeAtlas | null,
  minX: number,
  minZ: number,
  maxX: number,
  maxZ: number,
  out: Set<string>,
): Set<string> {
  if (!atlas) return out
  const entries = atlas.entries
  for (let i = 0; i < entries.length; i++) {
    const pos = entries[i].position
    if (!pos) continue
    if (pos.x >= minX && pos.x <= maxX && pos.z >= minZ && pos.z <= maxZ) {
      out.add(entries[i].nodeId)
    }
  }
  return out
}

/**
 * Nodos dentro de un polígono del mundo (lasso). Ray-casting par/impar.
 * `poly` = array plano [x0, z0, x1, z1, ...] en metros.
 */
export function nodesInWorldPolygon(
  atlas: NodeAtlas | null,
  poly: readonly number[],
  out: Set<string>,
): Set<string> {
  if (!atlas || poly.length < 6) return out
  const entries = atlas.entries
  const n = poly.length / 2
  for (let i = 0; i < entries.length; i++) {
    const pos = entries[i].position
    if (!pos) continue
    const x = pos.x
    const z = pos.z
    let inside = false
    for (let a = 0, b = n - 1; a < n; b = a++) {
      const ax = poly[a * 2]
      const az = poly[a * 2 + 1]
      const bx = poly[b * 2]
      const bz = poly[b * 2 + 1]
      if (az > z !== bz > z && x < ((bx - ax) * (z - az)) / (bz - az) + ax) {
        inside = !inside
      }
    }
    if (inside) out.add(entries[i].nodeId)
  }
  return out
}

/** Nodos dentro de un radio en metros desde (cx, cz) del mundo. */
export function nodesInWorldRadius(
  atlas: NodeAtlas | null,
  cx: number,
  cz: number,
  radiusM: number,
  out: Set<string>,
): Set<string> {
  if (!atlas) return out
  const r2 = radiusM * radiusM
  const entries = atlas.entries
  for (let i = 0; i < entries.length; i++) {
    const pos = entries[i].position
    if (!pos) continue
    const dx = pos.x - cx
    const dz = pos.z - cz
    if (dx * dx + dz * dz <= r2) out.add(entries[i].nodeId)
  }
  return out
}
