/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 NODE LAYER — WAVE 8010-P2 + 8170 (M2/M3): ICONOGRAFÍA HYPERION
 *
 * Glifos por TIPO DE FIXTURE padre (FixtureV2.type), portados del
 * TacticalCanvas2D de Hyperion a primitivas puras de Canvas2D — cero
 * sprites, cero gradientes, cero allocs en el hot loop:
 *
 *   moving-head / spot / scanner → ♢ diamante direccional, rotado por
 *     rotation.yaw (convención Erebus: dir = (cos yaw, sin yaw) en XZ —
 *     yaw=0 apunta a +x; la punta dibujada arriba se gira +π/2).
 *   fan                          → hélice de 3 aspas + núcleo (estática —
 *     Asteria no anima rpm; la rotación viva es dominio de Hyperion).
 *   laser                        → barra direccional rotada por yaw +
 *     núcleo blanco (la firma del haz).
 *   par / wash / strobe / resto  → doble anillo concéntrico.
 *
 * El color sigue siendo el acento por NodeFamily (dominio de la celda) —
 * la geometría dice QUÉ es el aparato, el color dice QUÉ controla el nodo.
 *
 * M3 — drawHoverTag: etiqueta flotante 10px monospace sobre el nodo en
 * hover (se dibuja al final del pipeline — cromo, no contenido).
 *
 * @module HephaestusView/asteria/canvas/layers/NodeLayer
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { WorldTransform } from '../useWorldTransform'
import type { NodeAtlas } from '../../store/useAsteriaStore'
import { NodeFamily } from '../../../../../../core/aether/types'
import type { FixtureV2 } from '../../../../../../core/stage/ShowFileV2'

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Acento por familia de nodo — legibilidad del dominio de cada celda. */
const FAMILY_COLORS: Record<string, string> = {
  [NodeFamily.COLOR]: '#c084fc',      // violeta claro — dominio cromático
  [NodeFamily.IMPACT]: '#ffb347',     // ámbar — intensidad/strobo
  [NodeFamily.KINETIC]: '#4fd8e8',    // cian — movimiento
  [NodeFamily.BEAM]: '#e8ecff',       // blanco frío — conformación de haz
  [NodeFamily.ATMOSPHERE]: '#7ddb8a', // verde — atmósfera
}
const FAMILY_FALLBACK = '#9aa3b5'

/** Margen de culling en px — un glifo a ≤8px del borde aún puede verse. */
const CULL_MARGIN_PX = 12

/** Radio base del glifo (px de pantalla — tamaño fijo, estilo táctico). */
const GLYPH_R = 5.4

// ─────────────────────────────────────────────────────────────────────────────
// DEVICE META — tipo+yaw por fixture, cacheado por referencia del array
// ─────────────────────────────────────────────────────────────────────────────

export interface DeviceGlyphMeta {
  /** FixtureV2.type ('moving-head' | 'fan' | 'laser' | 'par' | …). */
  readonly type: string
  /** rotation.yaw en radianes (convención Erebus: dir=(cos,sin) en XZ). */
  readonly yawRad: number
}

const EMPTY_META = new Map<string, DeviceGlyphMeta>()
let metaCache: {
  ref: readonly FixtureV2[]
  map: Map<string, DeviceGlyphMeta>
} | null = null

/**
 * deviceId → {type, yawRad}. La referencia del array `fixtures` ES la
 * clave: stageStore lo reemplaza entero al mutar → el cache invalida solo
 * y el hot path (RAF con ref estable) no aloca nada.
 */
export function getDeviceMeta(
  fixtures: readonly FixtureV2[] | null | undefined,
): Map<string, DeviceGlyphMeta> {
  if (!fixtures || fixtures.length === 0) return EMPTY_META
  if (metaCache && metaCache.ref === fixtures) return metaCache.map
  const map = new Map<string, DeviceGlyphMeta>()
  for (const f of fixtures) {
    if (!f || typeof f.id !== 'string') continue
    map.set(f.id, {
      type: typeof f.type === 'string' ? f.type : 'generic',
      yawRad: ((f.rotation?.yaw ?? 0) * Math.PI) / 180,
    })
  }
  metaCache = { ref: fixtures, map }
  return map
}

// ─────────────────────────────────────────────────────────────────────────────
// GLYPHS — primitivas puras (moveTo/lineTo/arc/stroke), estilo Hyperion
// ─────────────────────────────────────────────────────────────────────────────

/** ♢ Mover: rombo direccional rotado por yaw (vértices inline, sin save/rotate). */
function drawDiamond(
  ctx: CanvasRenderingContext2D,
  sx: number, sy: number, yawRad: number, color: string,
): void {
  const dx = Math.cos(yawRad)
  const dz = Math.sin(yawRad)
  const px = -dz
  const pz = dx
  const r = GLYPH_R * 1.15 // paridad de área con el anillo PAR (Hyperion 7761.5.1)
  ctx.beginPath()
  ctx.moveTo(sx + dx * r, sy + dz * r)                    // punta = dirección
  ctx.lineTo(sx + px * r * 0.7, sy + pz * r * 0.7)        // derecha
  ctx.lineTo(sx - dx * r, sy - dz * r)                    // cola
  ctx.lineTo(sx - px * r * 0.7, sy - pz * r * 0.7)        // izquierda
  ctx.closePath()
  ctx.globalAlpha = 0.38
  ctx.fillStyle = color
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.strokeStyle = color
  ctx.lineWidth = 1.3
  ctx.stroke()
}

/** Fan: hélice de 3 aspas (span 102°, gap 18°) + núcleo — sprite Hyperion portado. */
function drawHelix(
  ctx: CanvasRenderingContext2D,
  sx: number, sy: number, color: string,
): void {
  const r = GLYPH_R * 1.25
  const span = ((Math.PI * 2) / 3) * 0.85
  ctx.fillStyle = color
  ctx.globalAlpha = 0.45
  for (let i = 0; i < 3; i++) {
    const a0 = ((Math.PI * 2) / 3) * i - Math.PI / 2
    ctx.beginPath()
    ctx.moveTo(sx, sy)
    ctx.arc(sx, sy, r, a0, a0 + span)
    ctx.closePath()
    ctx.fill()
  }
  ctx.globalAlpha = 1
  ctx.strokeStyle = color
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.arc(sx, sy, r, 0, Math.PI * 2)
  ctx.stroke()
  // Hub — el núcleo del motor
  ctx.beginPath()
  ctx.arc(sx, sy, r * 0.32, 0, Math.PI * 2)
  ctx.fill()
}

/** Láser: barra gruesa rotada por yaw + núcleo blanco (firma del haz). */
function drawLaser(
  ctx: CanvasRenderingContext2D,
  sx: number, sy: number, yawRad: number, color: string,
): void {
  const dx = Math.cos(yawRad)
  const dz = Math.sin(yawRad)
  const px = -dz
  const pz = dx
  const hl = GLYPH_R * 1.7  // media longitud
  const hw = GLYPH_R * 0.55 // media anchura
  ctx.beginPath()
  ctx.moveTo(sx + dx * hl + px * hw, sy + dz * hl + pz * hw)
  ctx.lineTo(sx + dx * hl - px * hw, sy + dz * hl - pz * hw)
  ctx.lineTo(sx - dx * hl - px * hw, sy - dz * hl - pz * hw)
  ctx.lineTo(sx - dx * hl + px * hw, sy - dz * hl + pz * hw)
  ctx.closePath()
  ctx.globalAlpha = 0.42
  ctx.fillStyle = color
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.strokeStyle = color
  ctx.lineWidth = 1.1
  ctx.stroke()
  // Núcleo del haz — línea blanca axial
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'
  ctx.lineWidth = 1.2
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(sx - dx * hl * 0.75, sy - dz * hl * 0.75)
  ctx.lineTo(sx + dx * hl * 0.75, sy + dz * hl * 0.75)
  ctx.stroke()
  ctx.lineCap = 'butt'
}

/** PAR / wash / strobe / genérico: doble anillo concéntrico. */
function drawDoubleRing(
  ctx: CanvasRenderingContext2D,
  sx: number, sy: number, color: string,
): void {
  ctx.strokeStyle = color
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.arc(sx, sy, GLYPH_R, 0, Math.PI * 2)
  ctx.stroke()
  ctx.globalAlpha = 0.8
  ctx.beginPath()
  ctx.arc(sx, sy, GLYPH_R * 0.45, 0, Math.PI * 2)
  ctx.stroke()
  ctx.globalAlpha = 1
}

// ─────────────────────────────────────────────────────────────────────────────
// DRAW
// ─────────────────────────────────────────────────────────────────────────────

export function drawNodeLayer(
  ctx: CanvasRenderingContext2D,
  t: WorldTransform,
  atlas: NodeAtlas | null,
  deviceMeta?: Map<string, DeviceGlyphMeta>,
): void {
  if (!atlas) return

  const { canvasW, canvasH, cam } = t
  const halfW = canvasW / 2
  const halfH = canvasH / 2
  const entries = atlas.entries

  // Etiquetas solo con zoom cercano — a vista de conjunto ensucian
  const drawLabels = cam.zoom >= 90
  if (drawLabels) {
    ctx.font = '9px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
  }

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    const pos = entry.position
    if (!pos) continue

    const sx = (pos.x - cam.panX) * cam.zoom + halfW
    const sy = (pos.z - cam.panY) * cam.zoom + halfH

    // Culling de viewport
    if (
      sx < -CULL_MARGIN_PX || sx > canvasW + CULL_MARGIN_PX ||
      sy < -CULL_MARGIN_PX || sy > canvasH + CULL_MARGIN_PX
    ) {
      continue
    }

    const color = FAMILY_COLORS[entry.family] ?? FAMILY_FALLBACK
    const meta = deviceMeta?.get(entry.deviceId)

    switch (meta?.type) {
      case 'moving-head':
      case 'spot':
      case 'scanner':
        drawDiamond(ctx, sx, sy, meta.yawRad, color)
        break
      case 'fan':
        drawHelix(ctx, sx, sy, color)
        break
      case 'laser':
        drawLaser(ctx, sx, sy, meta.yawRad, color)
        break
      default:
        drawDoubleRing(ctx, sx, sy, color)
        break
    }

    if (drawLabels) {
      ctx.fillStyle = 'rgba(230, 235, 255, 0.55)'
      ctx.fillText(entry.customLabel ?? entry.cellSuffix, sx, sy - 8)
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 🜨 WAVE 8170 (M3): HOVER TAG — etiqueta flotante sobre el nodo bajo el cursor
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tooltip táctico: ID corto del nodo en una placa oscura con borde cian.
 * Se dibuja AL FINAL del pipeline (encima de anillos y ghost) — el
 * ghosting de capa manda en los nodos; esto es solo texto flotante.
 * Solo cuando hoverNodeIds tiene contenido (el pick ya es deduplicado
 * y solo corre con el puntero ocioso — nunca durante un gesto de tool).
 */
export function drawHoverTag(
  ctx: CanvasRenderingContext2D,
  t: WorldTransform,
  atlas: NodeAtlas | null,
  hover: ReadonlySet<string>,
): void {
  if (!atlas || hover.size === 0) return
  const { canvasW, canvasH, cam } = t

  for (const id of hover) {
    const entry = atlas.byNodeId.get(id)
    const pos = entry?.position
    if (!entry || !pos) continue

    const sx = (pos.x - cam.panX) * cam.zoom + canvasW / 2
    const sy = (pos.z - cam.panY) * cam.zoom + canvasH / 2
    const label = entry.customLabel ?? entry.cellSuffix

    ctx.font = '10px monospace'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    const w = ctx.measureText(label).width

    // Placa: arriba-derecha del nodo, clamped al canvas
    const padX = 5
    const bx = Math.min(Math.max(sx + 10, 2), canvasW - w - padX * 2 - 2)
    const by = Math.max(sy - 22, 4)

    ctx.fillStyle = 'rgba(7, 9, 16, 0.92)'
    ctx.strokeStyle = 'rgba(79, 216, 232, 0.55)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.rect(bx, by, w + padX * 2, 15)
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = 'rgba(200, 240, 255, 0.85)'
    ctx.fillText(label, bx + padX, by + 11)
    break // un solo tag — el hover es de un único nodo
  }
}
