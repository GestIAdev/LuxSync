/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 FIELD LAYER — WAVE 8182 (M1): EL OPERADOR VE EL TIEMPO
 *
 * Mapa térmico del campo evaluado + contornos isócronos, leídos DIRECTO
 * de los Float32Array del FieldSnapshot (buffers compartidos del engine
 * — mutan in-place en cada evaluate, el RAF siempre ve valores frescos).
 *
 *   - HEAT: disco translúcido por nodo enmascarado; el delayMs mapea a
 *     una LUT de 16 colores PRECOMPUTADA a nivel de módulo (violeta en
 *     t=0 → cian → ámbar → magenta caliente). Cero strings nuevos por
 *     frame: fillStyle recibe la referencia cacheada de la LUT.
 *
 *   - ISÓCRONAS: sin marching squares — en su lugar, bandas de fase:
 *     un nodo cuyo delay cae dentro de ±ISO_BAND del múltiplo del
 *     intervalo dibuja un anillo brillante. Con nodos densos, los
 *     anillos contiguos forman visualmente la línea de contorno.
 *     Mayor = 250 ms (cian brillante), menor = 100 ms (tenue).
 *
 * Coste: ~1 fill + ~0–1 stroke por nodo → ~500 fills/frame en un rig de
 * 500 nodos. Trivial para canvas2d; cero allocs, cero arrays nuevos.
 *
 * El toggle `heatEnabled` del store decide si esta capa entra al
 * pipeline — el cálculo en sí es barato, pero el dogma Zero-Alloc
 * prohíbe recorridos extra si el operador la apaga.
 *
 * @module HephaestusView/asteria/canvas/layers/FieldLayer
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { WorldTransform } from '../useWorldTransform'
import type { NodeAtlas } from '../../store/useAsteriaStore'
import type { FieldPlanes } from '../../model/fieldEngine'
import { nodeGlyphRadiusPx } from './NodeLayer'

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS — todo precomputado a nivel de módulo (zero-alloc por frame)
// ─────────────────────────────────────────────────────────────────────────────

/** Pasos de la LUT de calor (16 entradas → 0–4 s de delay). */
const HEAT_STEPS = 16
/** Ventana de normalización del delay — más allá se clampa al último color. */
const HEAT_WINDOW_MS = 4000
/** Isócronas: intervalo mayor (brillante) y menor (tenue), en ms. */
const ISO_MAJOR_MS = 250
const ISO_MINOR_MS = 100
/** Semiancho de la banda de fase como fracción del intervalo (12 %). */
const ISO_BAND = 0.12

const ISO_MAJOR_COLOR = 'rgba(140, 235, 255, 0.8)'
const ISO_MINOR_COLOR = 'rgba(140, 235, 255, 0.28)'

/**
 * LUT de calor: violeta (frío, t≈0) → cian → ámbar → magenta caliente.
 * Construida UNA vez interpolando los stops — strings estables que el
 * RAF reutiliza sin alocar.
 */
const HEAT_LUT: readonly string[] = (() => {
  const stops: readonly (readonly [number, number, number, number])[] = [
    [0.0, 123, 92, 255],   // violeta — frente de onda en el emisor
    [0.35, 92, 200, 255],  // cian
    [0.65, 255, 195, 92],  // ámbar
    [1.0, 255, 92, 140],   // magenta caliente — cola del campo
  ]
  const lut: string[] = []
  for (let i = 0; i < HEAT_STEPS; i++) {
    const t = i / (HEAT_STEPS - 1)
    let a = stops[0]
    let b = stops[stops.length - 1]
    for (let s = 0; s < stops.length - 1; s++) {
      if (t >= stops[s][0] && t <= stops[s + 1][0]) {
        a = stops[s]
        b = stops[s + 1]
        break
      }
    }
    const span = b[0] - a[0] || 1
    const f = (t - a[0]) / span
    const r = Math.round(a[1] + (b[1] - a[1]) * f)
    const g = Math.round(a[2] + (b[2] - a[2]) * f)
    const bl = Math.round(a[3] + (b[3] - a[3]) * f)
    lut.push(`rgba(${r}, ${g}, ${bl}, 0.16)`)
  }
  return lut
})()

// ─────────────────────────────────────────────────────────────────────────────
// DRAW
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dibuja el mapa térmico + isócronas del campo sobre los nodos
 * enmascarados. Va DESPUÉS de NodeLayer (el calor tiñe el glifo) y
 * ANTES de Feedback/Gesture (los halos físicos y los anillos de
 * selección mandan encima).
 */
export function drawFieldLayer(
  ctx: CanvasRenderingContext2D,
  t: WorldTransform,
  atlas: NodeAtlas | null,
  planes: FieldPlanes | null,
): void {
  if (!atlas || !planes) return
  // 🜨 WAVE 8193: el overlay dibuja el plano 'intensity' (la envolvente
  // visible); si no existe, el primer plano escalar disponible.
  const field =
    planes.scalar.get('intensity') ??
    planes.scalar.values().next().value ??
    null
  if (!field) return
  const { cam, canvasW, canvasH } = t
  const halfW = canvasW / 2
  const halfH = canvasH / 2
  const zoom = cam.zoom

  // El disco de calor envuelve el glifo — mismo radio + halo
  const heatR = nodeGlyphRadiusPx(zoom) + 3
  const majorBand = ISO_MAJOR_MS * ISO_BAND
  const minorBand = ISO_MINOR_MS * ISO_BAND

  const entries = atlas.entries
  const { mask, delayMs } = field
  const n = Math.min(entries.length, planes.count)

  for (let i = 0; i < n; i++) {
    if (mask[i] === 0) continue
    const pos = entries[i].position
    if (!pos) continue
    const sx = (pos.x - cam.panX) * zoom + halfW
    const sy = (pos.z - cam.panY) * zoom + halfH
    if (sx < -heatR || sx > canvasW + heatR || sy < -heatR || sy > canvasH + heatR) {
      continue
    }

    const d = delayMs[i]

    // ── HEAT: disco del color del delay ──
    const step = d >= HEAT_WINDOW_MS
      ? HEAT_STEPS - 1
      : ((d / HEAT_WINDOW_MS) * HEAT_STEPS) | 0
    ctx.fillStyle = HEAT_LUT[step]
    ctx.beginPath()
    ctx.arc(sx, sy, heatR, 0, Math.PI * 2)
    ctx.fill()

    // ── ISÓCRONA: el nodo cae en la banda de fase del múltiplo ──
    const qMaj = d % ISO_MAJOR_MS
    if (qMaj < majorBand || qMaj > ISO_MAJOR_MS - majorBand) {
      ctx.strokeStyle = ISO_MAJOR_COLOR
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.arc(sx, sy, heatR - 0.5, 0, Math.PI * 2)
      ctx.stroke()
      continue // la banda mayor manda — no doble anillo
    }
    const qMin = d % ISO_MINOR_MS
    if (qMin < minorBand || qMin > ISO_MINOR_MS - minorBand) {
      ctx.strokeStyle = ISO_MINOR_COLOR
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(sx, sy, heatR - 0.5, 0, Math.PI * 2)
      ctx.stroke()
    }
  }
}
