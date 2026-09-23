/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 NODE LAYER — WAVE 8010-P2 + 8170 (M2/M3) + 8171: ICONOGRAFÍA HYPERION
 *
 * Glifos por TIPO DE FIXTURE padre (FixtureV2.type), portados del
 * TacticalCanvas2D de Hyperion a primitivas puras de Canvas2D — cero
 * sprites, cero gradientes, cero allocs en el hot loop:
 *
 *   moving-head / spot / scanner → ♢ diamante direccional, rotado por
 *     rotation.yaw (convención Erebus: dir = (cos yaw, sin yaw) en XZ).
 *   fan                          → hélice de 3 aspas + núcleo (estática —
 *     Asteria no anima rpm; la rotación viva es dominio de Hyperion).
 *   laser                        → barra direccional rotada por yaw +
 *     núcleo axial claro (la firma del haz).
 *   par / wash / strobe / resto  → doble anillo concéntrico.
 *
 * 🜨 WAVE 8171 (M1): SCREEN-SPACE SCALING — el radio es
 *   `clamp(FIXTURE_R_M·zoom, 7px, 22px)`: el icono crece con el mundo
 *   hasta su escala física pero JAMÁS colapsa bajo el suelo de
 *   legibilidad ni explota en primer plano (paridad Hyperion 8–24px).
 *
 * 🜨 WAVE 8171 (M2): ESTÉTICA INDUSTRIAL — fuera los colores por
 *   NodeFamily. Chasis = relleno oscuro + contorno técnico acero/cian
 *   tenue. El color agresivo lo ponen EXCLUSIVAMENTE los anillos de
 *   selección/hover y el ghosting de capa (GestureLayer).
 *
 * 🜨 WAVE 8171 (M3): TEXTOS INMUTABLES — las etiquetas se dibujan en
 *   coordenadas de pantalla proyectadas a mano con fuente px fija;
 *   jamás escalan con la matriz del mundo.
 *
 * @module HephaestusView/asteria/canvas/layers/NodeLayer
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { WorldTransform } from '../useWorldTransform'
import type { NodeAtlas } from '../../store/useAsteriaStore'
import type { FixtureV2 } from '../../../../../../core/stage/ShowFileV2'

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS — paleta industrial Hyperion (WAVE 8171-M2)
// ─────────────────────────────────────────────────────────────────────────────

/** Chasis apagado: relleno casi negro — el "metal" del aparato. */
const CHASSIS_FILL = 'rgba(10, 15, 25, 0.85)'
/** Contorno técnico: cian acero tenue — legible sin competir con la selección. */
const TECH_STROKE = 'rgba(170, 200, 220, 0.75)'
/** Núcleo del láser / punto de vida del nodo. */
const CORE_TINT = 'rgba(190, 225, 245, 0.7)'
/** Etiquetas de zoom — gris hielo, por debajo de la selección. */
const LABEL_TINT = 'rgba(200, 215, 235, 0.6)'

/** Margen de culling en px. */
const CULL_MARGIN_PX = 16

/** Radio físico nominal del chasis en METROS (un PAR/mover típico ~36 cm Ø). */
const FIXTURE_RADIUS_M = 0.18
/** Suelo de legibilidad: el icono jamás colapsa bajo 7 px (Hyperion usa 8). */
const GLYPH_MIN_PX = 7
/** Techo: el icono nunca crece más allá de 22 px (Hyperion tope 24). */
const GLYPH_MAX_PX = 22

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN-SPACE SCALE (WAVE 8171-M1)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Radio del glifo en píxeles: escala con el mundo (FIXTURE_R_M·zoom)
 * clampeado al suelo/techo de legibilidad. Exportada para que los
 * anillos de estado (GestureLayer) queden EXACTAMENTE fuera del glifo
 * a cualquier zoom.
 */
export function nodeGlyphRadiusPx(zoom: number): number {
  const r = FIXTURE_RADIUS_M * zoom
  return r < GLYPH_MIN_PX ? GLYPH_MIN_PX : r > GLYPH_MAX_PX ? GLYPH_MAX_PX : r
}

/**
 * 🜨 WAVE 8172 (M1): fuente semidinámica — crece suavemente con el
 * zoom (HiDPI/primer plano) pero clampeada a [12, 24] px: nunca queda
 * ilegible al alejarse ni grotesca al acercarse.
 */
export function nodeLabelFontPx(zoom: number): number {
  return Math.min(24, Math.max(12, Math.round(10 + zoom * 0.04)))
}

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
 * 🜨 WAVE 8172 (M2): tipos con glifo propio — si `FixtureV2.type` ya es
 * uno de estos, la heurística de ventilador JAMÁS lo toca: el diamante
 * del mover y el doble anillo del PAR son intocables.
 */
const EXPLICIT_GLYPH_TYPES = new Set([
  'moving-head', 'spot', 'scanner', 'laser',
  'par', 'wash', 'strobe', 'blinder', 'bar',
])

/**
 * Resuelve el tipo de glifo. Jerarquía:
 *   1. type explícito ('fan' incluido) → se respeta siempre.
 *   2. Tipo no concluyente ('effect','generic','custom','pyro'…) + la
 *      palabra "fan" en name/model (el "Fan Tungsten" del operador) → fan.
 *   3. Canal de motor continuo (fan/spin/rotat…) → fan (heurística).
 *   4. Resto → type tal cual (cae al doble anillo en el dispatch).
 */
export function resolveGlyphType(f: FixtureV2): string {
  const t = typeof f.type === 'string' ? f.type : 'generic'
  if (t === 'fan') return 'fan'
  if (EXPLICIT_GLYPH_TYPES.has(t)) return t
  const nameModel = `${f.name ?? ''} ${f.model ?? ''}`
  if (/fan/i.test(nameModel)) return 'fan'
  const channels = f.channels
  if (channels) {
    for (const ch of channels) {
      if (ch && /fan|spin|rotat/i.test(ch.name ?? '')) return 'fan'
    }
  }
  return t
}

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
      type: resolveGlyphType(f),
      yawRad: ((f.rotation?.yaw ?? 0) * Math.PI) / 180,
    })
  }
  metaCache = { ref: fixtures, map }
  return map
}

// ─────────────────────────────────────────────────────────────────────────────
// GLYPHS — primitivas puras, estética chasis-industrial
// ─────────────────────────────────────────────────────────────────────────────

/** ♢ Mover: rombo direccional rotado por yaw (vértices inline, sin save/rotate). */
function drawDiamond(
  ctx: CanvasRenderingContext2D,
  sx: number, sy: number, r: number, yawRad: number,
): void {
  const dx = Math.cos(yawRad)
  const dz = Math.sin(yawRad)
  const px = -dz
  const pz = dx
  const rr = r * 1.15 // paridad de área con el anillo PAR (Hyperion 7761.5.1)
  ctx.beginPath()
  ctx.moveTo(sx + dx * rr, sy + dz * rr)                 // punta = dirección
  ctx.lineTo(sx + px * rr * 0.7, sy + pz * rr * 0.7)     // derecha
  ctx.lineTo(sx - dx * rr, sy - dz * rr)                 // cola
  ctx.lineTo(sx - px * rr * 0.7, sy - pz * rr * 0.7)     // izquierda
  ctx.closePath()
  ctx.fillStyle = CHASSIS_FILL
  ctx.fill()
  ctx.strokeStyle = TECH_STROKE
  ctx.lineWidth = 1.3
  ctx.stroke()
}

/** Fan: hélice de 3 aspas (span 102°, gap 18°) + núcleo — sprite Hyperion portado. */
function drawHelix(
  ctx: CanvasRenderingContext2D,
  sx: number, sy: number, r: number,
): void {
  const rr = r * 1.25
  const span = ((Math.PI * 2) / 3) * 0.85
  ctx.fillStyle = CHASSIS_FILL
  ctx.strokeStyle = TECH_STROKE
  ctx.lineWidth = 1.2
  for (let i = 0; i < 3; i++) {
    const a0 = ((Math.PI * 2) / 3) * i - Math.PI / 2
    ctx.beginPath()
    ctx.moveTo(sx, sy)
    ctx.arc(sx, sy, rr, a0, a0 + span)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }
  // Hub — el núcleo del motor
  ctx.beginPath()
  ctx.arc(sx, sy, rr * 0.32, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
}

/** Láser: barra gruesa rotada por yaw + núcleo axial claro (firma del haz). */
function drawLaser(
  ctx: CanvasRenderingContext2D,
  sx: number, sy: number, r: number, yawRad: number,
): void {
  const dx = Math.cos(yawRad)
  const dz = Math.sin(yawRad)
  const px = -dz
  const pz = dx
  const hl = r * 1.7  // media longitud
  const hw = r * 0.55 // media anchura
  ctx.beginPath()
  ctx.moveTo(sx + dx * hl + px * hw, sy + dz * hl + pz * hw)
  ctx.lineTo(sx + dx * hl - px * hw, sy + dz * hl - pz * hw)
  ctx.lineTo(sx - dx * hl - px * hw, sy - dz * hl - pz * hw)
  ctx.lineTo(sx - dx * hl + px * hw, sy - dz * hl + pz * hw)
  ctx.closePath()
  ctx.fillStyle = CHASSIS_FILL
  ctx.fill()
  ctx.strokeStyle = TECH_STROKE
  ctx.lineWidth = 1.1
  ctx.stroke()
  // Núcleo del haz — línea axial clara
  ctx.strokeStyle = CORE_TINT
  ctx.lineWidth = 1.2
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(sx - dx * hl * 0.75, sy - dz * hl * 0.75)
  ctx.lineTo(sx + dx * hl * 0.75, sy + dz * hl * 0.75)
  ctx.stroke()
  ctx.lineCap = 'butt'
}

/** PAR / wash / strobe / genérico: doble anillo concéntrico + punto de vida. */
function drawDoubleRing(
  ctx: CanvasRenderingContext2D,
  sx: number, sy: number, r: number,
): void {
  ctx.fillStyle = CHASSIS_FILL
  ctx.strokeStyle = TECH_STROKE
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.arc(sx, sy, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(sx, sy, r * 0.5, 0, Math.PI * 2)
  ctx.stroke()
  // Punto de vida — el aparato existe
  ctx.fillStyle = CORE_TINT
  ctx.beginPath()
  ctx.arc(sx, sy, Math.max(r * 0.16, 1), 0, Math.PI * 2)
  ctx.fill()
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
  const r = nodeGlyphRadiusPx(cam.zoom)

  // Etiquetas solo con zoom cercano — fuente px con clamp estricto
  // [12,24], jamás escala libre con la matriz del mundo (8171-M3/8172-M1).
  const drawLabels = cam.zoom >= 90
  if (drawLabels) {
    ctx.font = `${nodeLabelFontPx(cam.zoom)}px monospace`
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

    const meta = deviceMeta?.get(entry.deviceId)
    switch (meta?.type) {
      case 'moving-head':
      case 'spot':
      case 'scanner':
        drawDiamond(ctx, sx, sy, r, meta.yawRad)
        break
      case 'fan':
        drawHelix(ctx, sx, sy, r)
        break
      case 'laser':
        drawLaser(ctx, sx, sy, r, meta.yawRad)
        break
      default:
        drawDoubleRing(ctx, sx, sy, r)
        break
    }

    if (drawLabels) {
      ctx.fillStyle = LABEL_TINT
      ctx.fillText(entry.customLabel ?? entry.cellSuffix, sx, sy - r - 3)
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 🜨 WAVE 8170/8171 (M3): HOVER TAG — etiqueta flotante, px absolutos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tooltip táctico: ID corto del nodo en una placa oscura con borde cian.
 * Se dibuja AL FINAL del pipeline (encima de anillos y ghost) — el
 * ghosting de capa manda en los nodos; esto es solo texto flotante.
 * Fuente fija 12px monospace: nítida a cualquier distancia de cámara.
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

    ctx.font = '14px monospace'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    const w = ctx.measureText(label).width

    // Placa: arriba-derecha del nodo, clamped al canvas
    const padX = 6
    const bx = Math.min(Math.max(sx + 12, 2), canvasW - w - padX * 2 - 2)
    const by = Math.max(sy - 30, 4)

    ctx.fillStyle = 'rgba(7, 9, 16, 0.92)'
    ctx.strokeStyle = 'rgba(79, 216, 232, 0.55)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.rect(bx, by, w + padX * 2, 20)
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = 'rgba(200, 240, 255, 0.85)'
    ctx.fillText(label, bx + padX, by + 15)
    break // un solo tag — el hover es de un único nodo
  }
}
