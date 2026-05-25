// ════════════════════════════════════════════════════════════════════════════
// 🎨 WAVE 4812 — PIXEL MAP AETHER ADAPTER (L3 PRODUCER)
// ════════════════════════════════════════════════════════════════════════════
//
//  Convierte Virtual Frame Buffers (RGBA8) en `INodeIntent[]` que se inyectan
//  en la capa L3 del NodeArbiter (`setEffectIntents`).
//
//  PIPELINE POR FRAME (44 Hz, hot path):
//    1. ingest(arbiter, mgr)
//    2. Por cada canvas activo:
//       a. Lee el `front` buffer del manager.
//       b. Para cada NodeSampler pre-cuantizado, lee 4 bytes (RGBA).
//       c. Acquire un intent del pool zero-alloc, popula values, push.
//    3. arbiter.setEffectIntents(this._intents)  // capa L3
//
//  ZERO-ALLOC: el pool de intents crece en warm-up y se reutiliza para
//  siempre. Reset por frame: `_intentCursor = 0`, `_intents.length = 0`.
//
//  PATCH-TIME: `bindCanvas()` y `bindWorldSamplers()` pre-computan los
//  samplers (UVs + nodeId + family) una sola vez. El hot path solo hace
//  desreferencia de índices y escritura en Records.
//
//  CAPA OBJETIVO: L3 (`setEffectIntents`) — directiva WAVE 4850 sprint 1.
//  El blueprint WAVE-4812 §3.2 también permite L3+ (`setHephaestusIntents`)
//  para mayor supremacy; se conserva como modo opcional vía `targetLayer`.
// ════════════════════════════════════════════════════════════════════════════

import { NodeFamily, type IntentSource, type NodeId, type Position3D } from '../types'
import type { INodeArbiter, INodeIntent } from '../intent-bus'
import type { INodeGraph } from '../node-graph'
import type { MergeStrategy } from '../types'
import type { AetherCanvasManager, VirtualFrameBuffer } from './AetherCanvasManager'

// ─── PRIORIDADES POR CAPA ───────────────────────────────────────────────────

/** Capa L3 (Effects). ABSOLUTE L3 OVERRIDE (WAVE 4829) bloquea L0/L1 en canal. */
const L3_EFFECT_PRIORITY = 320
/** Capa L3+ (Hephaestus). LTP supremacy + L3 luminance gag. */
const L3_HEPH_PRIORITY = 350

const L3_EFFECT_SOURCE: IntentSource = 'effect'
const L3_HEPH_SOURCE: IntentSource = 'hephaestus'
const L3_CONFIDENCE = 1.0

// ─── TIPOS PÚBLICOS ─────────────────────────────────────────────────────────

/**
 * Pre-cuantización de un nodo en un canvas: nodeId + UV en pixel coords.
 * Construido en patch-time, leído en hot-path.
 */
export interface NodeSampler {
  readonly nodeId: NodeId
  /** NodeFamily.COLOR | NodeFamily.IMPACT — define qué canales escribir. */
  readonly family: NodeFamily.COLOR | NodeFamily.IMPACT
  /** Columna del pixel a muestrear [0..width-1]. */
  readonly u: number
  /** Fila del pixel a muestrear [0..height-1]. */
  readonly v: number
}

/**
 * Parámetros mínimos que el adapter necesita por canvas.
 * Subconjunto de `ResolvedPixelParams` del bridge — no requerimos importar
 * el tipo completo para mantener el adapter desacoplado del arsenal.
 */
export interface BoundCanvasParams {
  /** Multiplicador de salida [0..1]. Se aplica a R, G, B y al dimmer. */
  readonly intensity: number
  /** Si true, alpha del pixel modula `dimmer`/`brightness`. */
  readonly alphaToDimmer: boolean
  /**
   * 'replace' (default) — LTP supremacy en L3 (WAVE 4829 absolute override).
   * 'add' / 'multiply' / 'screen' — reservados para futuras fases. Hoy se
   * tratan como 'replace' (el productor puede pre-blend en su propio render).
   */
  readonly blend?: 'replace' | 'multiply' | 'add' | 'screen'
}

/** Rectángulo del stage en metros usado para UV mapping en world-space. */
export interface WorldRect {
  readonly x0: number
  readonly z0: number
  readonly x1: number
  readonly z1: number
}

/** Configuración del adapter en construcción. */
export interface PixelMapAetherAdapterOptions {
  /**
   * Capa del arbiter destino:
   *   - 'effect' (default) → `setEffectIntents()` — L3 ABSOLUTE OVERRIDE.
   *   - 'hephaestus'       → `setHephaestusIntents()` — L3+ LTP supremacy.
   */
  readonly targetLayer?: 'effect' | 'hephaestus'
}

// ─── ADAPTER ────────────────────────────────────────────────────────────────

interface MutableNodeIntent {
  nodeId: NodeId
  values: Record<string, number>
  priority: number
  confidence: number
  source: IntentSource
  mergeStrategy: MergeStrategy
}

export class PixelMapAetherAdapter {
  private readonly _targetLayer: 'effect' | 'hephaestus'
  private readonly _priority: number
  private readonly _source: IntentSource

  /** Vinculación canvasId → params declarados por el productor. */
  private readonly _activeCanvases = new Map<string, BoundCanvasParams>()
  /** Vinculación canvasId → samplers pre-cuantizados. */
  private readonly _samplers = new Map<string, ReadonlyArray<NodeSampler>>()

  /** Pool de intents reutilizable. Crece en warm-up, se estabiliza. */
  private readonly _intentPool: MutableNodeIntent[] = []
  private _intentCursor = 0
  /** Array que se entrega al arbiter cada frame (mutado, mismo identity). */
  private readonly _frameIntents: INodeIntent[] = []

  /** Lista vacía pre-congelada — devolverla en clear() evita alloc. */
  private readonly _emptyIntents: readonly INodeIntent[] = Object.freeze([])

  /** Telemetría. */
  private _samplesEmittedTotal = 0
  private _framesIngested = 0

  constructor(opts: PixelMapAetherAdapterOptions = {}) {
    this._targetLayer = opts.targetLayer ?? 'effect'
    if (this._targetLayer === 'hephaestus') {
      this._priority = L3_HEPH_PRIORITY
      this._source = L3_HEPH_SOURCE
    } else {
      this._priority = L3_EFFECT_PRIORITY
      this._source = L3_EFFECT_SOURCE
    }
  }

  // ── Patch-time API ──────────────────────────────────────────────────────

  /**
   * Vincula un canvas con un array explícito de samplers pre-cuantizados.
   *
   * Para uso de `RenderHook`s avanzados que ya conocen las UVs (p.ej.
   * mapeo `'local'` por cellIndex de fixtures multi-cell).
   *
   * Idempotente — sobrescribe vinculación previa para el mismo canvasId.
   *
   * @param canvasId — ID del Virtual Frame Buffer.
   * @param params   — Hints de blend e intensidad.
   * @param samplers — Array (possiblemente compartido) de samplers.
   */
  public bindCanvas(
    canvasId: string,
    params: BoundCanvasParams,
    samplers: ReadonlyArray<NodeSampler>,
  ): void {
    this._activeCanvases.set(canvasId, params)
    this._samplers.set(canvasId, samplers)
  }

  /**
   * Helper de world-mapping: construye samplers a partir del NodeGraph
   * proyectando la posición 3D (x,z) de cada nodo COLOR/IMPACT al UV del
   * rectángulo de stage `rect`.
   *
   * Y (altura) se IGNORA — el stage se trata como plano top-down 2D.
   * Nodos sin `position` se omiten silenciosamente.
   *
   * **Solo en patch-time.**
   *
   * @param canvasId  — ID del Virtual Frame Buffer ya adquirido en el manager.
   * @param params    — Hints de blend e intensidad.
   * @param graph     — NodeGraph para enumerar nodos COLOR/IMPACT.
   * @param rect      — Rectángulo del stage (metros) que cubre la textura.
   * @param textureW  — Ancho del buffer en pixels.
   * @param textureH  — Alto del buffer en pixels.
   * @returns Número de samplers creados.
   */
  public bindWorldSamplers(
    canvasId: string,
    params: BoundCanvasParams,
    graph: INodeGraph,
    rect: WorldRect,
    textureW: number,
    textureH: number,
  ): number {
    if (!Number.isInteger(textureW) || textureW < 1 ||
        !Number.isInteger(textureH) || textureH < 1) {
      throw new RangeError(`PixelMapAetherAdapter.bindWorldSamplers: invalid texture size ${textureW}x${textureH}`)
    }

    const samplers: NodeSampler[] = []

    // COLOR nodes
    const colorView = graph.getView(NodeFamily.COLOR)
    colorView.forEach((node) => {
      const pos = node.position
      if (!pos) return
      const uv = _worldToUV(pos, rect, textureW, textureH)
      samplers.push({
        nodeId: node.nodeId,
        family: NodeFamily.COLOR,
        u: uv.u,
        v: uv.v,
      })
    })

    // IMPACT nodes
    const impactView = graph.getView(NodeFamily.IMPACT)
    impactView.forEach((node) => {
      const pos = node.position
      if (!pos) return
      const uv = _worldToUV(pos, rect, textureW, textureH)
      samplers.push({
        nodeId: node.nodeId,
        family: NodeFamily.IMPACT,
        u: uv.u,
        v: uv.v,
      })
    })

    this.bindCanvas(canvasId, params, samplers)
    return samplers.length
  }

  /** Desvincula un canvas del adapter. **Solo en patch-time.** */
  public unbindCanvas(canvasId: string): void {
    this._activeCanvases.delete(canvasId)
    this._samplers.delete(canvasId)
  }

  /** Limpia todas las vinculaciones (teardown / show change). */
  public unbindAll(): void {
    this._activeCanvases.clear()
    this._samplers.clear()
  }

  // ── Hot path (44 Hz) ────────────────────────────────────────────────────

  /**
   * Lee los `front` buffers de todos los canvas activos, muestrea cada
   * NodeSampler, emite intents al arbiter en la capa configurada.
   *
   * **Zero-alloc**: el array `_frameIntents` y el pool `_intentPool` se
   * reutilizan. Cada `INodeIntent` es un Record reutilizado entre frames.
   *
   * Si no hay canvases activos, llama a `_writeIntents([])` igualmente para
   * que el arbiter limpie su slot L3 (idempotente cuando ya estaba vacío).
   *
   * @param arbiter — NodeArbiter receptor.
   * @param mgr     — AetherCanvasManager fuente de los buffers.
   */
  public ingest(arbiter: INodeArbiter, mgr: AetherCanvasManager): void {
    this._intentCursor = 0
    this._frameIntents.length = 0

    if (this._activeCanvases.size === 0) {
      this._writeIntents(arbiter, this._emptyIntents)
      return
    }

    let samplesThisFrame = 0

    for (const [canvasId, params] of this._activeCanvases) {
      const buf = mgr.get(canvasId)
      if (!buf) continue
      const samplers = this._samplers.get(canvasId)
      if (!samplers || samplers.length === 0) continue

      const intensity = _clamp01(params.intensity)
      const alphaToDimmer = params.alphaToDimmer === true

      const front = buf.front
      const w = buf.width
      const h = buf.height

      for (let i = 0; i < samplers.length; i++) {
        const s = samplers[i]
        // Bounds-check perezoso: el sampler se construyó con UVs ya
        // clampeadas, pero protegemos contra resoluciones cambiadas en vivo.
        if (s.u < 0 || s.u >= w || s.v < 0 || s.v >= h) continue

        const off = (s.v * w + s.u) << 2
        const r8 = front[off]
        const g8 = front[off + 1]
        const b8 = front[off + 2]
        const a8 = front[off + 3]

        const intent = this._acquireIntent(s.nodeId)
        const v = intent.values

        if (s.family === NodeFamily.COLOR) {
          // Convertir 0..255 → 0..1 y escalar por intensity.
          v['red'] = (r8 / 255) * intensity
          v['green'] = (g8 / 255) * intensity
          v['blue'] = (b8 / 255) * intensity
          if (alphaToDimmer) {
            v['brightness'] = (a8 / 255) * intensity
          }
        } else {
          // IMPACT: derivamos luminance perceptual (Rec. 709) → dimmer.
          // Si alphaToDimmer, el alpha gana (el productor lo declaró autoridad).
          const lum = alphaToDimmer
            ? a8 / 255
            : (0.2126 * r8 + 0.7152 * g8 + 0.0722 * b8) / 255
          v['dimmer'] = lum * intensity
        }

        this._frameIntents.push(intent as INodeIntent)
        samplesThisFrame++
      }
    }

    this._writeIntents(arbiter, this._frameIntents)

    // Telemetría barata, sin logs en hot path.
    this._samplesEmittedTotal += samplesThisFrame
    this._framesIngested++
  }

  /**
   * Limpia la capa destino (envía un array vacío). Útil cuando un caller
   * sabe que no habrá productores activos durante varios frames.
   */
  public clear(arbiter: INodeArbiter): void {
    this._intentCursor = 0
    this._frameIntents.length = 0
    this._writeIntents(arbiter, this._emptyIntents)
  }

  // ── Telemetría ──────────────────────────────────────────────────────────

  public getTelemetry(): {
    readonly framesIngested: number
    readonly samplesEmittedTotal: number
    readonly activeCanvases: number
    readonly poolSize: number
  } {
    return {
      framesIngested: this._framesIngested,
      samplesEmittedTotal: this._samplesEmittedTotal,
      activeCanvases: this._activeCanvases.size,
      poolSize: this._intentPool.length,
    }
  }

  public resetTelemetry(): void {
    this._framesIngested = 0
    this._samplesEmittedTotal = 0
  }

  // ── Internals ──────────────────────────────────────────────────────────

  private _writeIntents(arbiter: INodeArbiter, intents: readonly INodeIntent[]): void {
    if (this._targetLayer === 'hephaestus') {
      arbiter.setHephaestusIntents(intents)
    } else {
      arbiter.setEffectIntents(intents)
    }
  }

  /**
   * Obtiene un intent del pool y lo "limpia" antes de devolverlo.
   * Crece el pool una unidad si está agotado.
   */
  private _acquireIntent(nodeId: NodeId): MutableNodeIntent {
    let intent = this._intentPool[this._intentCursor]
    if (intent === undefined) {
      intent = {
        nodeId,
        values: {},
        priority: this._priority,
        confidence: L3_CONFIDENCE,
        source: this._source,
        mergeStrategy: 'LTP',
      }
      this._intentPool.push(intent)
    } else {
      // Reset values (clave por clave; Object.keys produce un alloc, así que
      // sobreescribimos solo las llaves que esperamos. Para el caso COLOR
      // pisamos red/green/blue/brightness; para IMPACT sólo dimmer. Las
      // llaves no escritas en este frame conservan el valor previo, lo
      // cual es BENIGNO porque el arbiter consume `values` justo después
      // y nunca relee el intent antes del próximo populate).
      // No obstante, para evitar fugas semánticas (un nodo que dejó de
      // recibir RGB y aún muestra el último), limpiamos las claves típicas.
      const v = intent.values
      v['red'] = 0
      v['green'] = 0
      v['blue'] = 0
      v['brightness'] = 0
      v['dimmer'] = 0
      intent.nodeId = nodeId
      intent.priority = this._priority
      intent.confidence = L3_CONFIDENCE
      intent.source = this._source
      intent.mergeStrategy = 'LTP'
    }
    this._intentCursor++
    return intent
  }
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

/**
 * Proyecta una posición 3D al UV de un rectángulo de stage.
 *
 * - Usa `pos.x` y `pos.z` (plano horizontal — `y` es altura, ignorada).
 * - Clamp a [0..1] para garantizar UV dentro del buffer.
 * - Devuelve enteros [0..w-1] / [0..h-1].
 */
export function _worldToUV(
  pos: Position3D,
  rect: WorldRect,
  w: number,
  h: number,
): { readonly u: number; readonly v: number } {
  const dx = rect.x1 - rect.x0
  const dz = rect.z1 - rect.z0
  // Si el rect está degenerado, mapear al centro.
  const fx = dx === 0 ? 0.5 : (pos.x - rect.x0) / dx
  const fz = dz === 0 ? 0.5 : (pos.z - rect.z0) / dz
  const cu = fx < 0 ? 0 : fx > 1 ? 1 : fx
  const cv = fz < 0 ? 0 : fz > 1 ? 1 : fz
  const u = (cu * w) | 0
  const v = (cv * h) | 0
  return {
    u: u >= w ? w - 1 : u,
    v: v >= h ? h - 1 : v,
  }
}

function _clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  if (n < 0) return 0
  if (n > 1) return 1
  return n
}

/**
 * Helper local-mapping: dado un `cellIndex` y la geometría del grid,
 * devuelve el UV del centro de la celda en pixel coords. Útil cuando un
 * fixture multi-cell expone N cells lineales.
 */
export function _localCellToUV(
  cellIndex: number,
  rows: number,
  cols: number,
  textureW: number,
  textureH: number,
): { readonly u: number; readonly v: number } {
  const safeRows = rows < 1 ? 1 : rows
  const safeCols = cols < 1 ? 1 : cols
  const col = cellIndex % safeCols
  const row = Math.floor(cellIndex / safeCols)
  const u = (((col + 0.5) / safeCols) * textureW) | 0
  const v = (((row + 0.5) / safeRows) * textureH) | 0
  return {
    u: u >= textureW ? textureW - 1 : u,
    v: v >= textureH ? textureH - 1 : v,
  }
}
