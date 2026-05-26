// ════════════════════════════════════════════════════════════════════════════
// 🎬 WAVE 4867 — THEIA VIDEO RENDERER (Bridge: THETA → AetherCanvasManager)
// ════════════════════════════════════════════════════════════════════════════
//
//  Conecta el thumb buffer SAB de 64×64 producido por theta.worker.ts con el
//  AetherCanvasManager (WAVE-4812). Actúa como un productor más del pipeline
//  de Pixel Mapping: escribe el frame downscale en el `back` buffer y llama
//  `flip()`, dejando al PixelMapAetherAdapter recogerlo en el hot-path normal.
//
//  DISEÑO:
//    - Zero-alloc en hot-path: el back buffer es el `Uint8ClampedArray` del
//      VirtualFrameBuffer (ya asignado en patch-time por `acquire()`).
//    - El SAB es SPSC, el reader usa `readIfNew()` para evitar copias inútiles
//      cuando el worker no ha producido frame nuevo en este tick.
//    - El canvasId ('theia:active' por defecto) se registra en el
//      PixelMapAetherAdapter durante el patch-time del operador (el adapter
//      ya existe y su API de binding está definida en PixelMapAetherAdapter).
//    - `active` es un flag mutable que TitanOrchestrator puede bajar cuando
//      el usuario desactiva Theia, sin necesitar re-wiring de SABs.
//
//  USO (TitanOrchestrator, patch-time):
//    const renderer = new TheiaVideoRenderer(
//      'theia:active', this._aetherCanvasManager, thumbSAB,
//    )
//    this._aetherCanvasManager.acquire('theia:active', 64, 64)
//    this._pixelMapAdapter.bindWorldSamplers('theia:active', ...)
//
//  USO (TitanOrchestrator, hot-path, antes de pixelMapAdapter.ingest):
//    renderer.tick()
//
// ════════════════════════════════════════════════════════════════════════════

import type { AetherCanvasManager } from '../AetherCanvasManager'
import {
  ThumbFrameReader,
  THUMB_W,
  THUMB_H,
} from '../../../../theia/TheiaThumbBuffer'

// ─── RENDERER ───────────────────────────────────────────────────────────────

export class TheiaVideoRenderer {
  private readonly _canvasId: string
  private readonly _manager: AetherCanvasManager
  private readonly _reader: ThumbFrameReader

  /** Si false, tick() es no-op: el canvas queda con el último frame publicado. */
  public active = true

  /** Frames copiados al AetherCanvas (para telemetría). */
  private _framesIngested = 0

  constructor(
    canvasId: string,
    manager: AetherCanvasManager,
    thumbSAB: SharedArrayBuffer,
  ) {
    this._canvasId = canvasId
    this._manager  = manager
    this._reader   = new ThumbFrameReader(thumbSAB)

    // Garantizar que el VirtualFrameBuffer exista antes del primer tick.
    // Si ya fue adquirido con la misma resolución, `acquire()` es idempotente.
    this._manager.acquire(canvasId, THUMB_W, THUMB_H)
  }

  // ── Hot-path (44 Hz) ────────────────────────────────────────────────────

  /**
   * Lee el frame más reciente del SAB (si hay uno nuevo desde el último tick)
   * y lo escribe en el `back` buffer del VirtualFrameBuffer, luego llama
   * `flip()`. Si no hay frame nuevo, no hace nada — el front buffer retiene
   * el último frame presentado (hold-frame).
   *
   * **Zero-alloc**: usa `readIfNew()` que devuelve una vista directa al SAB.
   * El `set()` sobre `back` es una copia de 16 KB pero sin allocaciones.
   */
  public tick(): void {
    if (!this.active) return

    const pixels = this._reader.readIfNew()
    if (!pixels) return

    const buf = this._manager.get(this._canvasId)
    if (!buf) return

    // Escribir al back buffer — la longitud de `pixels` es siempre 16384 bytes
    // (64*64*4) por contrato de ThumbFrameWriter. Misma longitud que back.
    buf.back.set(pixels)
    buf.hasAlpha = false   // el vídeo es siempre opaco salvo overlays explícitos

    this._manager.flip(this._canvasId)
    this._framesIngested++
  }

  // ── Control ─────────────────────────────────────────────────────────────

  /**
   * Fuerza una re-lectura en el próximo tick aunque el seq no haya cambiado.
   * Útil después de un reload de show o reconexión del worker.
   */
  public resync(): void {
    this._reader.resync()
  }

  /**
   * Apaga el renderer y limpia el canvas a negro. Llamar al desactivar Theia.
   */
  public stop(): void {
    this.active = false
    this._manager.clear(this._canvasId, 0, 0, 0, 255)
    this._manager.flip(this._canvasId)
  }

  // ── Telemetría ──────────────────────────────────────────────────────────

  public getTelemetry(): {
    readonly canvasId: string
    readonly active: boolean
    readonly framesIngested: number
    readonly readerHasData: boolean
  } {
    return {
      canvasId: this._canvasId,
      active: this.active,
      framesIngested: this._framesIngested,
      readerHasData: this._reader.hasData,
    }
  }
}
