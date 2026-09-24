/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 FIELD ENGINE — WAVE 8030-P2: EL MOTOR DE CAMPOS
 *                WAVE 8193: MULTI-PLANO (Crux 2 — Phase 2, §3.3)
 *
 * Evalúa el Gesture Stack a planos escalares POR PARÁMETRO — la
 * representación intermedia entre la pila no destructiva y el
 * AsteriaCompiler:
 *
 *   stack: Gesture[]  ──►  fieldEngine.evaluate()  ──►  FieldPlanes
 *                          O(N·G) ~0.2 ms                 scalar: Map<param,
 *                          N=400, G=8                      ScalarPlane>
 *
 * COMPOSITOR EN DOS ETAPAS (§3.3):
 *   Etapa 1 — KERNEL GEOMÉTRICO: cada gesto escribe su geometría cruda
 *             (delay, gain, claim, cobertura, canal) en UN único buffer
 *             `scratch` preasignado, sin importar qué params targetea.
 *             La matemática espacial de applyWave/applySlice/… es intacta.
 *   Etapa 2 — COMPOSITOR: para cada plano escalar p ∈ effectivePaint(g)
 *             .params, `blendInto(plane_p, scratch, g.op, canal)` mezcla
 *             el scratch en ese plano y `owner_p[i]` recibe el índice de
 *             la capa donde claim[i] y cov[i] ≥ 0.5 — dueño por plano,
 *             no global (routing de synth local en WAVE 8195).
 *
 * DOGMA ZERO-ALLOC: `createFieldEngine(atlas)` devuelve un closure que
 * pre-asigna TODOS los TypedArrays una sola vez (sized to atlas) y los
 * muta in-place en cada evaluate. `ensurePlanes(activeParams)` reasigna
 * buffers SOLO si el conjunto de params activos cambia — el hot path no
 * genera garbage: mismo FieldPlanes, mismos planos, mismos arrays (===).
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
import type { HephParamId } from '../../../../../core/hephaestus/types'
import { hash01, applySymmetry } from '../../../../../core/hephaestus/phase/PhaseConfigPro'
import { hexToLinearRgb } from './colorMath'
import { createDefaultPaint } from './AsteriaProject'
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
  LayerPaint,
} from './AsteriaProject'
import {
  rasterizeText,
  sampleGlyphCoverage,
  worldToGlyphCell,
  GLYPH_DELAY_MS_PER_M,
  type GlyphBitmap,
} from './glyphRaster'

// ═══════════════════════════════════════════════════════════════════════════
// FIELD PLANES — el campo evaluado, por parámetro (§3.3)
// ═══════════════════════════════════════════════════════════════════════════

/** owner === OWNER_NONE → ningún gesto reclamó el nodo con cov ≥ 0.5. */
export const OWNER_NONE = 0xffff

/**
 * Paint por omisión cuando `evaluate` se llama sin `defaultPaint`
 * (tests y one-shots — el camino vivo siempre pasa project.defaultPaint).
 * Instancia única: la trata el engine como read-only.
 */
const FALLBACK_PAINT: LayerPaint = createDefaultPaint()

/**
 * Buffers mínimos que los consumidores leen (cuantizador, planner).
 * FieldSnapshot (legacy) y ScalarPlane lo satisfacen.
 */
export interface PlaneField {
  /** Retardo por nodo en ms — el eje temporal del campo. */
  readonly delayMs: Float32Array
  /** Ganancia por nodo [0..∞], identidad = 1 — el eje de intensidad. */
  readonly gain: Float32Array
  /** Cobertura: 1 si algún gesto reclamó el nodo, 0 si no. */
  readonly mask: Uint8Array
}

/** Plano escalar de UN parámetro (intensity, pan, tilt, zoom…). */
export interface ScalarPlane extends PlaneField {
  /**
   * Índice en project.stack de la capa dominante — último gesto que
   * reclamó el nodo con cobertura ≥ 0.5. OWNER_NONE si ninguno.
   * Routing de la forma de onda local (§4.4) — partición de clases.
   */
  readonly owner: Uint16Array
}

/**
 * 🜨 WAVE 8194 (§3.3): el plano de color — un ScalarPlane más el color
 * acumulado por nodo. `rgb` es LINEAL (la luz se mezcla en lineal, no en
 * sRGB); `alpha` es la cobertura acumulada (over estándar). Un nodo con
 * `alpha = 0` queda fuera del plano (`mask = 0`) — lienzo transparente:
 * el fixture conserva el color que le dio Selene.
 *
 * El plano vive FUERA de `scalar` — el param 'color' se resuelve por
 * `field.color` (el compilador cae a `scalar.get('color')` solo para la
 * forma legacy envuelta de `flatFieldToPlanes`).
 */
export interface ColorPlane extends ScalarPlane {
  /** RGB LINEAL por nodo — 3 floats por nodo (r,g,b consecutivos). */
  readonly rgb: Float32Array
  /** Cobertura acumulada [0,1] — `a_i + alpha·(1−a_i)` por capa. */
  readonly alpha: Float32Array
}

/**
 * Resultado del engine: UN plano por parámetro activo
 * (∪ effectivePaint(g).params) + el plano de color opcional.
 */
export interface FieldPlanes {
  /** Número de nodos (= atlas.entries.length). */
  readonly count: number
  readonly scalar: ReadonlyMap<HephParamId, ScalarPlane>
  /** 🜨 WAVE 8194: presente iff 'color' ∈ ∪ effectivePaint(g).params. */
  readonly color: ColorPlane | null
}

/**
 * @deprecated FORMA PLANA V1 — el engine ya no la produce. `compile()`
 * acepta esta forma como input legacy y la envuelve como UN plano
 * compartido por todos los params (paridad con fixtures y documentos
 * pre-8193). Los planos reales los crea el engine.
 */
export interface FieldSnapshot extends PlaneField {
  /** Número de nodos (= atlas.entries.length). */
  readonly count: number
}

export interface FieldEngine {
  /**
   * Evalúa la pila completa in-place y devuelve los planos compartidos
   * (misma referencia siempre). `defaultPaint` resuelve la herencia de
   * los gestos sin `paint` (omisión → `createDefaultPaint()`).
   */
  evaluate(stack: readonly Gesture[], defaultPaint?: LayerPaint): FieldPlanes
  /**
   * (Re)asigna planos para el conjunto de params activos. NO toca los
   * buffers si el conjunto no cambió — llamarla por evaluate es gratis
   * (G-ZERO-ALLOC-RAF). También invocable a mano al mutar paint.
   */
  ensurePlanes(activeParams: ReadonlySet<HephParamId>): void
  /** Índice del nodo en los buffers, o -1 si no está en el atlas. */
  indexOf(nodeId: string): number
  /** Número de nodos del atlas que este engine cubre. */
  readonly size: number
}

// ═══════════════════════════════════════════════════════════════════════════
// BLEND — operaciones del stack sobre los planos
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
 *   scratch sDelay/sGain/sCov/sClaim/sChan — salida del kernel (geometría
 *                                           cruda del gesto en curso)
 *   scalarPlanes                           — UN ScalarPlane por param
 *                                            activo (Map estable — los
 *                                            planos se añaden/quitan solo
 *                                            cuando cambia el conjunto)
 *   posX / posZ / hasPosition              — geometría plana (P3)
 *   indexByNodeId                          — resolución O(1) por NodeId
 *   scratchIdx                             — lista de índices de máscara
 *
 * Re-crear el engine cuando cambie el atlas (topology_changed → nuevo
 * NodeAtlas) — los buffers dependen del tamaño N.
 */
export function createFieldEngine(atlas: NodeAtlas): FieldEngine {
  const n = atlas.entries.length

  // ── Planos escalares por param — Map de referencia ESTABLE: se muta
  //    por dentro (delete/set) para preservar la identidad de
  //    `planesResult.scalar` y de los planos supervivientes. ──
  const scalarPlanes = new Map<HephParamId, ScalarPlane>()
  // 🜨 WAVE 8194: el plano de color vive fuera del Map escalar (su
  // mask = alpha>0, no claim). `planesResult.color` se reasigna SOLO
  // cuando 'color' entra/sale del conjunto activo — el objeto result
  // es siempre el mismo.
  let colorPlane: ColorPlane | null = null
  const planesResult: {
    count: number
    scalar: Map<HephParamId, ScalarPlane>
    color: ColorPlane | null
  } = { count: n, scalar: scalarPlanes, color: null }

  // ── Scratch del kernel — geometría cruda del gesto en curso (§3.3).
  //    sClaim: el gesto reclama el nodo · sChan: bits 1=delay 2=gain
  //    (manual escribe canales por entry; kind desconocido reclama sin
  //    canales) · sCov: cobertura [0,1] (glyph antialias) para el umbral
  //    de owner ≥ 0.5 · sDelay/sGain: solo se leen donde sChan lo indica. ──
  const sDelay = new Float32Array(n)
  const sGain = new Float32Array(n)
  const sCov = new Float32Array(n)
  const sClaim = new Uint8Array(n)
  const sChan = new Uint8Array(n)

  // Conjunto de params activos — Set persistente (clear+add = cero alloc
  // en el hot path; los paramId son strings constantes).
  const activeParams = new Set<HephParamId>()

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

  /**
   * (Re)asigna planos para `activeParams`. Hot path = comparación de
   * conjunto sobre la Map estable: mismo conjunto → early return, cero
   * alloc. Si cambia, los planos supervivientes conservan su identidad
   * (=== estable por param) y solo los nuevos alocan buffers.
   * 🜨 8194: 'color' se desvía al ColorPlane dedicado — nunca entra al
   * Map escalar (su composición es rgb/alpha, no delay/gain).
   */
  function ensurePlanes(active: ReadonlySet<HephParamId>): void {
    const wantColor = active.has('color')
    let cnt = 0
    let dirty = false
    for (const p of active) {
      if (p === 'color') continue
      cnt++
      if (!scalarPlanes.has(p)) dirty = true
    }
    if (!dirty && cnt === scalarPlanes.size && wantColor === (colorPlane !== null)) {
      planesResult.color = colorPlane
      return
    }
    for (const p of [...scalarPlanes.keys()]) {
      if (p === 'color' || !active.has(p)) scalarPlanes.delete(p)
    }
    for (const p of active) {
      if (p === 'color') continue
      if (!scalarPlanes.has(p)) {
        scalarPlanes.set(p, {
          delayMs: new Float32Array(n),
          gain: new Float32Array(n),
          mask: new Uint8Array(n),
          owner: new Uint16Array(n),
        })
      }
    }
    if (wantColor && colorPlane === null) {
      colorPlane = {
        delayMs: new Float32Array(n),
        gain: new Float32Array(n),
        mask: new Uint8Array(n),
        owner: new Uint16Array(n),
        rgb: new Float32Array(n * 3),
        alpha: new Float32Array(n),
      }
    } else if (!wantColor) {
      colorPlane = null
    }
    planesResult.color = colorPlane
  }

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
      sDelay[i] = g.delayMs
      sGain[i] = g.gain
      sChan[i] = 3 // both
      sCov[i] = 1
      sClaim[i] = 1
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
    // 🜨 8181: gain de capa — multiplica el resultado del falloff.
    // 🜨 8196 (Phantom Gain): la capa SIEMPRE posee su amplitud —
    // `gain` undefined ≡ 1.0, jamás herencia silenciosa de la capa
    // inferior (el inspector muestra 100% — el kernel lo escribe).
    const layerGain = g.gain ?? 1
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
      const gv = (hasFalloff ? Math.max(0, 1 - dist * invFalloff) : 1) * layerGain
      sDelay[i] = d
      sGain[i] = gv
      sChan[i] = 3
      sCov[i] = 1
      sClaim[i] = 1
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
    // 🜨 8181 (post-proceso §T3): escala temporal + inversión — el
    // trazo crudo queda intacto en el gesto, el post-proceso es un
    // parámetro no destructivo más.
    const tScale = g.timeScale ?? 1
    const invert = g.invert === true
    // 🜨 8196 (Phantom Gain): la capa SIEMPRE posee su amplitud —
    // `gain` undefined ≡ 1.0 (el inspector muestra 100% — el kernel
    // lo escribe; nunca hereda el gain de la capa inferior).
    const layerGain = g.gain ?? 1

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
      // 🜨 8197 (Time Arrow): delay = RETARDO real — el primer punto del
      // trazo (tMs=0) recibe el menor delay y dispara primero. `invert`
      // simplemente refleja la asignación: el final del trazo dispara
      // primero. La corrección de signo vive en el compilador (rotación
      // y phase bus), no aquí.
      let d =
        arcLen !== null && totalArc > 0
          ? (arcLen[best] / totalArc) * totalMs
          : stroke[best].tMs
      if (invert) d = totalMs - d
      if (tScale !== 1) d *= tScale
      sDelay[i] = d
      sGain[i] = layerGain
      sChan[i] = 3
      sCov[i] = 1
      sClaim[i] = 1
    }
  }

  /**
   * MANUAL (§5.2): las entries SON el campo — replace directo por canal
   * presente. 🜨 8196 (Phantom Gain): toda entry no-vacía también estampa
   * el gain de capa (`(e.gain ?? 1) * layerGain`, layerGain ≡ `g.gain ?? 1`)
   * — la capa posee la amplitud de los nodos que toca; una entry solo-
   * delay nunca hereda el gain de la capa inferior.
   */
  function applyManual(g: ManualGesture): void {
    const list = g.entries
    const layerGain = g.gain ?? 1
    for (let k = 0; k < list.length; k++) {
      const e = list[k]
      const i = indexByNodeId.get(e.nodeId)
      if (i === undefined) continue
      const hasD = e.delayMs !== undefined
      const hasE = e.gain !== undefined
      if (!hasD && !hasE) continue
      if (hasD) sDelay[i] = e.delayMs ?? 0
      sGain[i] = (e.gain ?? 1) * layerGain
      sChan[i] = (hasD ? 1 : 0) | 2
      sCov[i] = 1
      sClaim[i] = 1
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
   * symmetry → delay = s · spanMs. Canal: delay + gain de capa
   * (🜨 8196 — la capa siempre posee su amplitud, `gain` undefined ≡ 1).
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
    // 🜨 8196 (Phantom Gain): la capa SIEMPRE posee su amplitud —
    // `gain` undefined ≡ 1.0; un SLICE sin gain explícito estampa 1.0,
    // nunca hereda el gain de la capa inferior (BASE oscura ≠ SLICE mudo).
    const layerGain = g.gain ?? 1

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
      sDelay[i] = s * g.spanMs
      sGain[i] = layerGain
      sChan[i] = 3
      sCov[i] = 1
      sClaim[i] = 1
    }
  }

  /**
   * NOISE (§5.2): value-noise fBm muestreado en la posición del nodo —
   * rompe la simetría perfecta ("orgánico", no "mecánico").
   *   f = 1/scaleM, octavas con amp ½·freq 2×, normalizado a [-1,1]
   *   → delay = (n·0.5+0.5) · amountMs. Canal: delay + gain de capa
   *   (🜨 8196 — `gain` undefined ≡ 1).
   * Determinista: mismo (seed, posición) → mismo valor siempre.
   */
  function applyNoise(g: NoiseGesture): void {
    const cnt = resolveMask(g.mask)
    if (cnt === 0) return
    const freq0 = 1 / Math.max(1e-6, g.scaleM)
    const octaves = g.octaves
    const amount = g.amountMs
    // 🜨 8196 (Phantom Gain): la capa SIEMPRE posee su amplitud.
    const layerGain = g.gain ?? 1
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
      sDelay[i] = u * amount
      sGain[i] = layerGain
      sChan[i] = 3
      sCov[i] = 1
      sClaim[i] = 1
    }
  }

  /**
   * GLYPH (§T5 — WAVE 8050): el texto 5×7 muestreado por posición.
   *   channel 'gain'  → gain = cobertura [0,1] (imagen quieta — Vía B)
   *   channel 'delay' → delay = distancia local-X desde el borde
   *                     izquierdo × 1000 ms/m (barrido 1 m/s — Vía Λ)
   *   threshold       → meseta dura {0,1}; antialias → bilinear
   *   invert          → 🜨 8183: cov negada dentro del rect (fondo
   *                     encendido, letras a oscuras). En canal gain los
   *                     nodos del rect con cov'=0 SÍ se reclaman — el
   *                     texto debe escribir gain 0 para bloquear la luz;
   *                     en canal delay solo el fondo barre (las letras
   *                     quedan congeladas fuera del frente).
   * Solo los píxeles cubiertos reclaman el nodo — el overlay de
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
    const layerGain = g.gain ?? 1
    const inv = g.invert === true

    for (let k = 0; k < cnt; k++) {
      const i = scratchIdx[k]
      if (!hasPosition[i]) continue
      const cov = sampleGlyphCoverage(posX[i], posZ[i], g, bmp)
      // u (celdas desde el borde izq.) → metros → delay del barrido
      const { u, v } = worldToGlyphCell(posX[i], posZ[i], g, bmp)
      // 🜨 8183: invertido + canal gain → el rect entero reclama: las
      // letras escriben gain 0 (bloqueo real), no "sin cobertura".
      const insideRect =
        inv && u >= 0 && u < bmp.cols && v >= 0 && v < bmp.rows
      if (cov <= 0 && !(insideRect && writesGain)) continue
      const d = u * cellM * GLYPH_DELAY_MS_PER_M
      if (writesDelay) sDelay[i] = d
      if (writesGain) sGain[i] = cov * layerGain
      sChan[i] = (writesDelay ? 1 : 0) | (writesGain ? 2 : 0)
      sCov[i] = cov
      sClaim[i] = 1
    }
  }

  /**
   * Etapa 1 — KERNEL GEOMÉTRICO: escribe la geometría cruda del gesto
   * en el scratch compartido. La matemática es independiente de los
   * params targeteados — el gesto se evalúa UNA sola vez.
   */
  function kernel(gesture: Gesture): void {
    sClaim.fill(0)
    sChan.fill(0)
    sCov.fill(0)
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
        for (let k = 0; k < cnt; k++) {
          sClaim[scratchIdx[k]] = 1
          sCov[scratchIdx[k]] = 1
        }
        break
      }
    }
  }

  // 🜨 WAVE 8194 (§3.4): color lineal del gesto en curso — convertido
  // sRGB→lineal UNA vez por gesto, jamás por nodo.
  const sLin = new Float32Array(3)

  /**
   * Etapa 2 — COMPOSITOR (§3.3): para cada plano p ∈ effectivePaint(g)
   * .params, mezcla el scratch con la semántica (g.op, canal por nodo).
   * `owner_p[i]` = índice del gesto donde claim y cov ≥ 0.5 — el dueño
   * decide la forma de onda local en el compilador (§4.4).
   *
   * 🜨 8194: 'color' se desvía al ColorPlane — el delay/gain escalar
   * siguen `blendInto` (los usa el color animado), pero rgb/alpha van
   * por el álgebra de luz §3.4 y el mask se deriva de alpha>0 al final
   * de evaluate (lienzo transparente).
   */
  function composite(
    gesture: Gesture,
    gi: number,
    params: readonly HephParamId[],
    defaultPaint: LayerPaint,
  ): void {
    const op: BlendOp =
      'op' in gesture && gesture.op !== undefined ? gesture.op : 'replace'
    // Una conversión por gesto (§3.4): el hex del paint a RGB lineal.
    if (colorPlane !== null && params.indexOf('color') !== -1) {
      hexToLinearRgb(
        gesture.paint?.color ?? defaultPaint.color ?? '#ff0000',
        sLin,
      )
    }
    const opacity = gesture.paint?.opacity ?? defaultPaint.opacity ?? 1
    for (let k = 0; k < params.length; k++) {
      const p = params[k]
      if (p === 'color') {
        const cp = colorPlane
        if (cp === null) continue
        const crgb = cp.rgb
        const cal = cp.alpha
        const co = cp.owner
        const lr = sLin[0]
        const lg = sLin[1]
        const lb = sLin[2]
        for (let i = 0; i < n; i++) {
          if (sClaim[i] === 0) continue
          // Los ejes delay/gain del plano sí siguen la geometría —
          // el color animado los usa como la intensidad (§3.5-3).
          const ch = sChan[i]
          if (ch !== 0) {
            blendInto(
              cp.delayMs, cp.gain, i, op, sDelay[i], sGain[i],
              ch === 3 ? 'both' : ch === 1 ? 'delay' : 'gain',
            )
          }
          // El color se compone donde el gesto reclama — el canal
          // (delay/gain) de la geometría no aplica al plano de color.
          const a = sCov[i] * opacity
          if (a <= 0) continue
          const ia = 1 - a
          const j = i * 3
          switch (op) {
            case 'replace': // Normal
              crgb[j] = crgb[j] * ia + lr * a
              crgb[j + 1] = crgb[j + 1] * ia + lg * a
              crgb[j + 2] = crgb[j + 2] * ia + lb * a
              break
            case 'add': // Linear Dodge — suma de luz
              crgb[j] = Math.min(1, crgb[j] + lr * a)
              crgb[j + 1] = Math.min(1, crgb[j + 1] + lg * a)
              crgb[j + 2] = Math.min(1, crgb[j + 2] + lb * a)
              break
            case 'max': // Lighten
              crgb[j] = Math.max(crgb[j], lr * a)
              crgb[j + 1] = Math.max(crgb[j + 1], lg * a)
              crgb[j + 2] = Math.max(crgb[j + 2], lb * a)
              break
            case 'min': // Darken — lerp(1, C_L, a) como techo
              crgb[j] = Math.min(crgb[j], 1 + (lr - 1) * a)
              crgb[j + 1] = Math.min(crgb[j + 1], 1 + (lg - 1) * a)
              crgb[j + 2] = Math.min(crgb[j + 2], 1 + (lb - 1) * a)
              break
            case 'mul': // Multiply — filtro sobre lo acumulado
              crgb[j] = crgb[j] * (1 + (lr - 1) * a)
              crgb[j + 1] = crgb[j + 1] * (1 + (lg - 1) * a)
              crgb[j + 2] = crgb[j + 2] * (1 + (lb - 1) * a)
              break
          }
          // Over estándar: alpha_i ← a_i + alpha_i·(1−a_i)
          cal[i] = a + cal[i] * ia
          if (sCov[i] >= 0.5) co[i] = gi
        }
        continue
      }
      const plane = scalarPlanes.get(p)
      if (plane === undefined) continue
      const pd = plane.delayMs
      const pg = plane.gain
      const pm = plane.mask
      const po = plane.owner
      for (let i = 0; i < n; i++) {
        if (sClaim[i] === 0) continue
        const ch = sChan[i]
        if (ch !== 0) {
          blendInto(
            pd, pg, i, op, sDelay[i], sGain[i],
            ch === 3 ? 'both' : ch === 1 ? 'delay' : 'gain',
          )
        }
        pm[i] = 1
        if (sCov[i] >= 0.5) po[i] = gi
      }
    }
  }

  function evaluate(
    stack: readonly Gesture[],
    defaultPaint: LayerPaint = FALLBACK_PAINT,
  ): FieldPlanes {
    // ∪ effectivePaint(g).params — Set persistente, cero alloc estable.
    activeParams.clear()
    for (let g = 0; g < stack.length; g++) {
      const ps = stack[g].paint?.params ?? defaultPaint.params
      for (let k = 0; k < ps.length; k++) activeParams.add(ps[k])
    }
    ensurePlanes(activeParams)

    // Reset de planos a la identidad: delay 0, gain 1, sin cobertura
    for (const plane of scalarPlanes.values()) {
      plane.delayMs.fill(0)
      plane.gain.fill(1)
      plane.mask.fill(0)
      plane.owner.fill(OWNER_NONE)
    }
    // 🜨 8194: el lienzo de color vuelve a transparente (rgb 0, alpha 0)
    if (colorPlane !== null) {
      colorPlane.delayMs.fill(0)
      colorPlane.gain.fill(1)
      colorPlane.mask.fill(0)
      colorPlane.owner.fill(OWNER_NONE)
      colorPlane.rgb.fill(0)
      colorPlane.alpha.fill(0)
    }

    for (let g = 0; g < stack.length; g++) {
      const gesture = stack[g]
      kernel(gesture)
      composite(
        gesture,
        g,
        gesture.paint?.params ?? defaultPaint.params,
        defaultPaint,
      )
    }

    // 🜨 8194: sellado del lienzo — mask ← alpha>0. Un nodo sin capa de
    // color queda fuera del plano: jamás recibe pista de color y no
    // "pisa" los colores base de Selene en el resto del rig.
    if (colorPlane !== null) {
      const cm = colorPlane.mask
      const ca = colorPlane.alpha
      for (let i = 0; i < n; i++) cm[i] = ca[i] > 0 ? 1 : 0
    }

    return planesResult
  }

  return {
    evaluate,
    ensurePlanes,
    indexOf: (nodeId) => indexByNodeId.get(nodeId) ?? -1,
    size: n,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CONVENIENCE — evaluación one-shot (aloca buffers por llamada; para uso
// repetido crear el engine y reusar)
// ═══════════════════════════════════════════════════════════════════════════

export function evaluateStack(
  stack: readonly Gesture[],
  atlas: NodeAtlas,
  defaultPaint: LayerPaint = createDefaultPaint(),
): FieldPlanes {
  return createFieldEngine(atlas).evaluate(stack, defaultPaint)
}
