/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 FIELD ENGINE — WAVE 8030-P2: EL MOTOR DE CAMPOS
 *
 * Evalúa el Gesture Stack a un campo escalar por nodo — la representación
 * intermedia entre la pila no destructiva y el AsteriaCompiler:
 *
 *   stack: Gesture[]  ──►  fieldEngine.evaluate()  ──►  FieldSnapshot
 *                          O(N·G) ~0.2 ms                 delayMs[i]
 *                          N=400, G=8                     gain[i]
 *                                                        mask[i]
 *
 * DOGMA ZERO-ALLOC: `createFieldEngine(atlas)` devuelve un closure que
 * pre-asigna TODOS los TypedArrays una sola vez (sized to atlas) y los
 * muta in-place en cada evaluate. La evaluación es patch-time (commit de
 * gesto / cambio de parámetro), pero ni aún así se tolera churn: los
 * buffers se reutilizan y el snapshot devuelto es SIEMPRE la misma
 * referencia — los consumidores deben leer antes del próximo evaluate().
 *
 * Índices: el campo se indexa por POSICIÓN en `atlas.entries` (0..N-1),
 * no por nodeId — el índice nodeId→i se pre-construye una vez al crear
 * el engine (el atlas es una referencia estable del store).
 *
 * WAVE 8030-P3: matemática espacial implementada —
 *   wave   → delay = dist/speed·1000 (point/ring radial, line = frente
 *            dirigido por dirDeg, Huygens = min(dist)), falloffM → gain
 *   chrono → delay = tMs del punto de trazo más cercano ≤ radiusM
 *            (captureRealTime=false → reparametrización arc-length)
 *   manual → entries directas por nodo (replace por canal presente)
 *   slice  → bucketing por eje (x/z/radius/angle/dmx/zone) + shuffleSeed
 *            con paridad hash01 de PhaseConfigPro + simetría
 *   noise  → value-noise fBm por posición → delay orgánico
 *   glyph  → cobertura del texto 5×7 → gain (imagen quieta) o delay
 *            (barrido 1 m/s por columna — WAVE 8050)
 *
 * @module HephaestusView/asteria/model/fieldEngine
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { NodeAtlas } from '../store/useAsteriaStore'
import type { NodeAtlasEntry } from '../../../../../core/aether/types'
import { hash01, applySymmetry } from '../../../../../core/hephaestus/phase/PhaseConfigPro'
import type {
  Gesture,
  BaseGesture,
  WaveGesture,
  ChronoGesture,
  GlyphGesture,
  SliceGesture,
  ManualGesture,
  NoiseGesture,
  NodeMask,
  BlendOp,
  FieldChannel,
} from './AsteriaProject'
import {
  rasterizeText,
  sampleGlyphCoverage,
  worldToGlyphCell,
  GLYPH_DELAY_MS_PER_M,
  type GlyphBitmap,
} from './glyphRaster'

// ═══════════════════════════════════════════════════════════════════════════
// FIELD SNAPSHOT — el campo evaluado (buffers compartidos del engine)
// ═══════════════════════════════════════════════════════════════════════════

export interface FieldSnapshot {
  /** Número de nodos (= atlas.entries.length). */
  readonly count: number
  /** Retardo por nodo en ms — el eje temporal del campo. */
  readonly delayMs: Float32Array
  /** Ganancia por nodo [0..∞], identidad = 1 — el eje de intensidad. */
  readonly gain: Float32Array
  /** Cobertura: 1 si algún gesto reclamó el nodo, 0 si no. */
  readonly mask: Uint8Array
}

export interface FieldEngine {
  /** Evalúa la pila completa in-place y devuelve el snapshot compartido. */
  evaluate(stack: readonly Gesture[]): FieldSnapshot
  /** Índice del nodo en los buffers, o -1 si no está en el atlas. */
  indexOf(nodeId: string): number
  /** Número de nodos del atlas que este engine cubre. */
  readonly size: number
}

// ═══════════════════════════════════════════════════════════════════════════
// BLEND — operaciones del stack sobre el campo
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Combina (d, g) sobre el nodo `i` según el BlendOp del gesto, restringido
 * al canal `ch`:
 *   - 'delay' → solo delayMs (wave/chrono/slice/noise: gestos temporales)
 *   - 'gain'  → solo gain   (glyph estático, entries parciales de manual)
 *   - 'both'  → ambos       (base, wave con falloffM, manual completo)
 * 'replace' pisa · 'min'/'max' recortan · 'add'/'mul' componen (§5.2).
 */
function blendInto(
  delayMs: Float32Array,
  gain: Float32Array,
  i: number,
  op: BlendOp,
  d: number,
  g: number,
  ch: FieldChannel,
): void {
  if (ch !== 'gain') {
    switch (op) {
      case 'replace': delayMs[i] = d; break
      case 'min': if (d < delayMs[i]) delayMs[i] = d; break
      case 'max': if (d > delayMs[i]) delayMs[i] = d; break
      case 'add': delayMs[i] += d; break
      case 'mul': delayMs[i] *= d; break
    }
  }
  if (ch !== 'delay') {
    switch (op) {
      case 'replace': gain[i] = g; break
      case 'min': if (g < gain[i]) gain[i] = g; break
      case 'max': if (g > gain[i]) gain[i] = g; break
      case 'add': gain[i] += g; break
      case 'mul': gain[i] *= g; break
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// VALUE NOISE — Perlin-style 2D sin tabla de permutación (stateless,
// determinista). El hash de celosía reutiliza la familia sin-fract de
// PhaseConfigPro (misma escuela, constantes propias por eje).
// ═══════════════════════════════════════════════════════════════════════════

/** Hash de celosía [-1,1) — determinista por (ix, iz, seed). */
function vhash(ix: number, iz: number, seed: number): number {
  const x = Math.sin(ix * 127.1 + iz * 311.7 + seed * 74.7) * 43758.5453
  return (x - Math.floor(x)) * 2 - 1
}

/** Value noise 2D con interpolación smoothstep — rango [-1, 1]. */
function vnoise2(x: number, z: number, seed: number): number {
  const ix = Math.floor(x)
  const iz = Math.floor(z)
  const fx = x - ix
  const fz = z - iz
  const ux = fx * fx * (3 - 2 * fx)
  const uz = fz * fz * (3 - 2 * fz)
  const a = vhash(ix, iz, seed)
  const b = vhash(ix + 1, iz, seed)
  const c = vhash(ix, iz + 1, seed)
  const d = vhash(ix + 1, iz + 1, seed)
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz
}

// ═══════════════════════════════════════════════════════════════════════════
// ENGINE FACTORY — closure con buffers pre-asignados
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Crea el motor para un atlas concreto. Pre-asigna:
 *   delayMs / gain / mask          — el snapshot (salida)
 *   posX / posZ / hasPosition      — geometría plana (P3: matemática espacial
 *                                    sin desreferenciar objetos en el loop)
 *   indexByNodeId                  — resolución O(1) de máscaras por NodeId
 *   scratchIdx                     — lista de índices cubiertos por gesto
 *
 * Re-crear el engine cuando cambie el atlas (topology_changed → nuevo
 * NodeAtlas) — los buffers dependen del tamaño N.
 */
export function createFieldEngine(atlas: NodeAtlas): FieldEngine {
  const n = atlas.entries.length

  const delayMs = new Float32Array(n)
  const gain = new Float32Array(n)
  const mask = new Uint8Array(n)

  // Geometría plana pre-extraída — los gestos espaciales (P3) iteran
  // Float32Arrays, nunca objetos NodeAtlasEntry.
  const posX = new Float32Array(n)
  const posZ = new Float32Array(n)
  const hasPosition = new Uint8Array(n)

  const indexByNodeId = new Map<string, number>()
  const entries: readonly NodeAtlasEntry[] = atlas.entries
  for (let i = 0; i < n; i++) {
    const e = entries[i]
    indexByNodeId.set(e.nodeId, i)
    if (e.position) {
      posX[i] = e.position.x
      posZ[i] = e.position.z
      hasPosition[i] = 1
    }
  }

  // Scratch: índices cubiertos por el gesto en curso (reutilizado por gesto)
  const scratchIdx = new Uint32Array(n)

  // Scratch para chrono: arc-length acumulado del trazo. Crece al trazo
  // más largo visto — se aloca on-demand UNA vez, no por evaluate.
  let chronoArcLen = new Float32Array(0)

  // Caché del bitmap de glifo (una entrada): rasterizar cuesta µs pero
  // el texto rara vez cambia entre evaluates — se re-rasteriza solo si
  // cambia el string. El buffer crece al texto más largo visto.
  let glyphBuf = new Uint8Array(0)
  let glyphCache: { text: string; bmp: GlyphBitmap } | null = null

  // Scratch para slice: escalar por eje de cada nodo (evita re-cómputo
  // entre el pase de min/max y el de cuantización).
  const axisScalar = new Float32Array(n)
  // Eje 'zone': ordinal del zoneId por orden de aparición canónica
  // en el atlas (determinista — el atlas llega en orden de familia).
  const zoneOrdinal = new Uint16Array(n)
  {
    const zoneIdx = new Map<string, number>()
    for (let i = 0; i < n; i++) {
      let z = zoneIdx.get(entries[i].zoneId)
      if (z === undefined) {
        z = zoneIdx.size
        zoneIdx.set(entries[i].zoneId, z)
      }
      zoneOrdinal[i] = z
    }
  }

  const snapshot: FieldSnapshot = { count: n, delayMs, gain, mask }

  /**
   * Resuelve una NodeMask a índices en scratchIdx. Devuelve el count.
   * NodeIds huérfanos (rig drift, atlas re-patcheado) se ignoran — el
   * fingerprint del proyecto los reporta por separado (§5.3).
   */
  function resolveMask(m: NodeMask): number {
    let cnt = 0
    const ids = m.nodeIds
    for (let k = 0; k < ids.length; k++) {
      const i = indexByNodeId.get(ids[k])
      if (i !== undefined) scratchIdx[cnt++] = i
    }
    return cnt
  }

  /** BASE: suelo uniforme — replace implícito, sin máscara (cubre todo). */
  function applyBase(g: BaseGesture): void {
    for (let i = 0; i < n; i++) {
      blendInto(delayMs, gain, i, 'replace', g.delayMs, g.gain, 'both')
      mask[i] = 1
    }
  }

  /**
   * WAVE (§5.2/T4): delay = dist / speedMps · 1000 — física en metros.
   *   shape 'point' | 'ring' → distancia euclídea radial al emisor
   *   shape 'line'           → frente dirigido: proyección de (p-emisor)
   *                            sobre dirDeg; detrás del plano → 0
   *   huygens                → min(dist) a cualquier emisor secundario
   *   falloffM               → gain = max(0, 1 - dist/falloffM) (canal gain)
   * Sin falloffM el gesto toca SOLO delay — no pisa el gain de capas previas.
   */
  function applyWave(g: WaveGesture): void {
    const cnt = resolveMask(g.mask)
    if (cnt === 0) return
    const ex = g.emitter.x
    const ez = g.emitter.z
    const msPerM = 1000 / Math.max(1e-6, g.speedMps)
    const isLine = g.shape === 'line'
    const dirRad = ((g.dirDeg ?? 0) * Math.PI) / 180
    const dirX = Math.cos(dirRad)
    const dirZ = Math.sin(dirRad)
    const hasFalloff = g.falloffM !== undefined && g.falloffM > 0
    const invFalloff = hasFalloff ? 1 / (g.falloffM as number) : 0
    const hy = g.huygens
    const hyLen = hy ? hy.length : 0

    for (let k = 0; k < cnt; k++) {
      const i = scratchIdx[k]
      if (!hasPosition[i]) continue
      const dx = posX[i] - ex
      const dz = posZ[i] - ez
      let dist: number
      if (isLine) {
        dist = dx * dirX + dz * dirZ
        if (dist < 0) dist = 0
      } else {
        dist = Math.sqrt(dx * dx + dz * dz)
      }
      for (let h = 0; h < hyLen; h++) {
        const hx = posX[i] - (hy as readonly { x: number; z: number }[])[h].x
        const hz = posZ[i] - (hy as readonly { x: number; z: number }[])[h].z
        const hd = Math.sqrt(hx * hx + hz * hz)
        if (hd < dist) dist = hd
      }
      const d = dist * msPerM
      const gv = hasFalloff ? Math.max(0, 1 - dist * invFalloff) : 1
      blendInto(delayMs, gain, i, g.op, d, gv, hasFalloff ? 'both' : 'delay')
      mask[i] = 1
    }
  }

  /**
   * CHRONO (§5.2/T3): el tempo del arrastre ES la coreografía.
   * Cada nodo a ≤ radiusM del trazo recibe el tMs del punto más cercano.
   *   captureRealTime=true  → tempo humano capturado
   *   captureRealTime=false → arcLength: reparametriza a velocidad
   *                           constante sobre la duración total del trazo
   * Nodos fuera del radio: sin cobertura (mask permanece 0 para ellos).
   * O(N·T) con distancias² — sin sqrt en el loop; T típico ~38 pts.
   */
  function applyChrono(g: ChronoGesture): void {
    const stroke = g.stroke
    const T = stroke.length
    if (T === 0 || g.radiusM <= 0) return
    const cnt = resolveMask(g.mask)
    if (cnt === 0) return
    const r2 = g.radiusM * g.radiusM

    // Reparametrización arc-length (modo "el dibujo manda, el tempo no")
    let arcLen: Float32Array | null = null
    if (!g.captureRealTime && T > 1) {
      if (chronoArcLen.length < T) chronoArcLen = new Float32Array(T)
      arcLen = chronoArcLen
      arcLen[0] = 0
      for (let t = 1; t < T; t++) {
        const ddx = stroke[t].x - stroke[t - 1].x
        const ddz = stroke[t].z - stroke[t - 1].z
        arcLen[t] = arcLen[t - 1] + Math.sqrt(ddx * ddx + ddz * ddz)
      }
    }
    const totalArc = arcLen ? arcLen[T - 1] : 0
    const totalMs = stroke[T - 1].tMs

    for (let k = 0; k < cnt; k++) {
      const i = scratchIdx[k]
      if (!hasPosition[i]) continue
      const nx = posX[i]
      const nz = posZ[i]
      let best = -1
      let bestD2 = r2
      for (let t = 0; t < T; t++) {
        const pdx = stroke[t].x - nx
        const pdz = stroke[t].z - nz
        const d2 = pdx * pdx + pdz * pdz
        if (d2 <= bestD2) {
          bestD2 = d2
          best = t
        }
      }
      if (best < 0) continue
      const d =
        arcLen !== null && totalArc > 0
          ? (arcLen[best] / totalArc) * totalMs
          : stroke[best].tMs
      blendInto(delayMs, gain, i, g.op, d, 1, 'delay')
      mask[i] = 1
    }
  }

  /**
   * MANUAL (§5.2): las entries SON el campo — replace directo por canal
   * presente (entry con solo delayMs no toca gain y viceversa).
   */
  function applyManual(g: ManualGesture): void {
    const list = g.entries
    for (let k = 0; k < list.length; k++) {
      const e = list[k]
      const i = indexByNodeId.get(e.nodeId)
      if (i === undefined) continue
      const hasD = e.delayMs !== undefined
      const hasG = e.gain !== undefined
      if (!hasD && !hasG) continue
      blendInto(
        delayMs, gain, i, 'replace',
        e.delayMs ?? 0, e.gain ?? 1,
        hasD && hasG ? 'both' : hasD ? 'delay' : 'gain',
      )
      mask[i] = 1
    }
  }

  /**
   * SLICE (§5.2/T-Slicer): rebanado del rig en `buckets` cubos con delay
   * escalonado sobre `spanMs`.
   *   axis 'x'|'z'|'radius'|'angle' → escalar espacial (requiere posición)
   *   axis 'dmx'                   → índice en el atlas (orden de patch
   *                                  canónico — no requiere posición)
   *   axis 'zone'                  → ordinal del zoneId (tampoco espacial)
   * normalize [min,max] → floor(u·buckets) → shuffleSeed remapea el bucket
   * con hash01 (MISMA función que PhaseConfigPro — paridad §7.5) →
   * symmetry → delay = s · spanMs. Canal: solo delay.
   */
  function applySlice(g: SliceGesture): void {
    const cnt = resolveMask(g.mask)
    if (cnt === 0) return
    const spatial =
      g.axis === 'x' || g.axis === 'z' ||
      g.axis === 'radius' || g.axis === 'angle'
    const buckets = Math.max(1, Math.floor(g.buckets))

    // Pase 1: escalar + min/max sobre el set filtrado (en axisScalar)
    let mn = Infinity
    let mx = -Infinity
    let covered = 0
    for (let k = 0; k < cnt; k++) {
      const i = scratchIdx[k]
      if (spatial && !hasPosition[i]) continue
      let v: number
      switch (g.axis) {
        case 'x':      v = posX[i]; break
        case 'z':      v = posZ[i]; break
        case 'radius': v = Math.sqrt(posX[i] * posX[i] + posZ[i] * posZ[i]); break
        case 'angle':  v = Math.atan2(posX[i], posZ[i]); break
        case 'dmx':    v = i; break
        default:       v = zoneOrdinal[i]; break // 'zone'
      }
      axisScalar[i] = v
      if (v < mn) mn = v
      if (v > mx) mx = v
      covered++
    }
    if (covered === 0) return
    const range = mx - mn
    const hasSeed = g.shuffleSeed !== undefined
    const seed = g.shuffleSeed ?? 0

    // Pase 2: cuantización → shuffle determinista → simetría → delay
    for (let k = 0; k < cnt; k++) {
      const i = scratchIdx[k]
      if (spatial && !hasPosition[i]) continue
      const u = range > 0 ? (axisScalar[i] - mn) / range : 0
      let b = Math.floor(u * buckets)
      if (b >= buckets) b = buckets - 1
      if (hasSeed) b = Math.floor(hash01(seed, b) * buckets)
      const ub = buckets > 1 ? b / (buckets - 1) : 0
      const s = applySymmetry(ub, g.symmetry)
      blendInto(delayMs, gain, i, g.op, s * g.spanMs, 1, 'delay')
      mask[i] = 1
    }
  }

  /**
   * NOISE (§5.2): value-noise fBm muestreado en la posición del nodo —
   * rompe la simetría perfecta ("orgánico", no "mecánico").
   *   f = 1/scaleM, octavas con amp ½·freq 2×, normalizado a [-1,1]
   *   → delay = (n·0.5+0.5) · amountMs. Canal: solo delay.
   * Determinista: mismo (seed, posición) → mismo valor siempre.
   */
  function applyNoise(g: NoiseGesture): void {
    const cnt = resolveMask(g.mask)
    if (cnt === 0) return
    const freq0 = 1 / Math.max(1e-6, g.scaleM)
    const octaves = g.octaves
    const amount = g.amountMs
    for (let k = 0; k < cnt; k++) {
      const i = scratchIdx[k]
      if (!hasPosition[i]) continue
      let sum = 0
      let amp = 1
      let freq = freq0
      let norm = 0
      for (let o = 0; o < octaves; o++) {
        sum += vnoise2(posX[i] * freq, posZ[i] * freq, g.seed + o) * amp
        norm += amp
        amp *= 0.5
        freq *= 2
      }
      const u = (sum / norm) * 0.5 + 0.5 // [-1,1] → [0,1]
      blendInto(delayMs, gain, i, g.op, u * amount, 1, 'delay')
      mask[i] = 1
    }
  }

  /**
   * GLYPH (§T5 — WAVE 8050): el texto 5×7 muestreado por posición.
   *   channel 'gain'  → gain = cobertura [0,1] (imagen quieta — Vía B)
   *   channel 'delay' → delay = distancia local-X desde el borde
   *                     izquierdo × 1000 ms/m (barrido 1 m/s — Vía Λ)
   *   threshold       → meseta dura {0,1}; antialias → bilinear
   * Solo los píxeles cubiertos (cov>0) reclaman el nodo — el overlay de
   * cobertura dibuja exactamente la forma del texto.
   * El bitmap se cachea por string — re-raster solo si cambia el texto.
   */
  function applyGlyph(g: GlyphGesture): void {
    const text = g.text ?? ''
    if (text.length === 0) return
    const cnt = resolveMask(g.mask)
    if (cnt === 0) return

    if (glyphCache === null || glyphCache.text !== text) {
      if (glyphBuf.length < text.length * 6 * 7) {
        glyphBuf = new Uint8Array(text.length * 6 * 7)
      }
      glyphCache = { text, bmp: rasterizeText(text, glyphBuf) }
    }
    const bmp = glyphCache.bmp
    const cellM = g.transform.scaleM / bmp.rows
    const writesDelay = g.channel !== 'gain'
    const writesGain = g.channel !== 'delay'

    for (let k = 0; k < cnt; k++) {
      const i = scratchIdx[k]
      if (!hasPosition[i]) continue
      const cov = sampleGlyphCoverage(posX[i], posZ[i], g, bmp)
      if (cov <= 0) continue
      // u (celdas desde el borde izq.) → metros → delay del barrido
      const { u } = worldToGlyphCell(posX[i], posZ[i], g, bmp)
      const d = u * cellM * GLYPH_DELAY_MS_PER_M
      blendInto(
        delayMs, gain, i, g.op,
        writesDelay ? d : 0,
        writesGain ? cov : 1,
        g.channel,
      )
      mask[i] = 1
    }
  }

  function evaluate(stack: readonly Gesture[]): FieldSnapshot {
    // Reset a la identidad: delay 0, gain 1, sin cobertura
    delayMs.fill(0)
    gain.fill(1)
    mask.fill(0)

    for (let g = 0; g < stack.length; g++) {
      const gesture = stack[g]
      switch (gesture.kind) {
        case 'base':
          applyBase(gesture)
          break
        case 'wave':
          applyWave(gesture)
          break
        case 'chrono':
          applyChrono(gesture)
          break
        case 'manual':
          applyManual(gesture)
          break
        case 'slice':
          applySlice(gesture)
          break
        case 'noise':
          applyNoise(gesture)
          break
        case 'glyph':
          applyGlyph(gesture)
          break

        default: {
          // Futuro kind: resuelve solo la huella (mask) — el canvas ya
          // visualiza qué nodos cubre el gesto. La unión es exhaustiva
          // hoy — el cast defensivo protege contra kinds futuros.
          const gm = (gesture as { mask?: NodeMask }).mask
          if (!gm) break
          const cnt = resolveMask(gm)
          for (let k = 0; k < cnt; k++) mask[scratchIdx[k]] = 1
          break
        }
      }
    }

    return snapshot
  }

  return {
    evaluate,
    indexOf: (nodeId) => indexByNodeId.get(nodeId) ?? -1,
    size: n,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CONVENIENCE — evaluación one-shot (aloca buffers por llamada; para uso
// repetido crear el engine y reusar)
// ═══════════════════════════════════════════════════════════════════════════

export function evaluateStack(stack: readonly Gesture[], atlas: NodeAtlas): FieldSnapshot {
  return createFieldEngine(atlas).evaluate(stack)
}
