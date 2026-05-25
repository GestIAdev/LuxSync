// ════════════════════════════════════════════════════════════════════════════
// 🎨 WAVE 4812 — AETHER CANVAS · VIRTUAL FRAME BUFFER MANAGER
// ════════════════════════════════════════════════════════════════════════════
//
//  Gestiona Frame Buffers virtuales (RGBA8 interleaved) para el motor de
//  Pixel Mapping. Cada buffer es un `Uint8ClampedArray(W·H·4)` con doble
//  búfer (`front`/`back`) y flip atómico.
//
//  PRINCIPIOS:
//    - UN buffer por canvasId activo. Idempotente en `acquire()`.
//    - Doble buffer: el productor escribe a `back`, el consumidor lee `front`.
//    - `flip()` es una swap de referencias — sin copia.
//    - Zero-alloc en hot path: `acquire()` corre solo en patch-time.
//    - Compatible con `OffscreenCanvas.getContext('2d').getImageData()` y
//      con WebGL `texSubImage2D` sin conversión (formato lingua-franca).
//
//  PRODUCTORES SOPORTADOS (todos escriben en `back` y llaman `flip()`):
//    - Renderers nativos JS (Plasma, Perlin, StrobeMask).
//    - OffscreenCanvas 2D (`ctx.getImageData(0,0,w,h).data` → set sobre back).
//    - WebGL/WebGPU (`gl.readPixels` directo a back).
//    - Vídeo / imagen (`drawImage` → getImageData → set).
//
//  CONSUMIDOR PRIMARIO: `PixelMapAetherAdapter` (lee `front`, muestrea por
//  UVs pre-cuantizadas, emite `INodeIntent[]` al `NodeArbiter`).
// ════════════════════════════════════════════════════════════════════════════

/**
 * Estructura de un Frame Buffer virtual.
 *
 * `front` y `back` se intercambian con `flip()` — NO copies, solo swap de
 * referencias. El productor reusa el `back` cada frame.
 */
export interface VirtualFrameBuffer {
  /** Identificador único asignado por el caller. */
  readonly canvasId: string
  /** Ancho en pixels (>= 1). */
  readonly width: number
  /** Alto en pixels (>= 1). */
  readonly height: number
  /**
   * Buffer presentable. El consumidor (`PixelMapAetherAdapter`) lo lee.
   * Mutable solo por `AetherCanvasManager.flip()`.
   */
  front: Uint8ClampedArray
  /**
   * Buffer en construcción. El productor escribe aquí cada frame.
   * Tras escribir, llama `flip(canvasId)` para promoverlo a `front`.
   */
  back: Uint8ClampedArray
  /** Contador monotonic incrementado en cada `flip()`. Útil para staleness. */
  frameSeq: number
  /** Timestamp del último flip (`performance.now()`). */
  lastFlipMs: number
  /** Hint para el muestreador: ¿hay alpha real o todo es 255? */
  hasAlpha: boolean
}

// ─── CANVAS MANAGER ─────────────────────────────────────────────────────────

export class AetherCanvasManager {
  private readonly _buffers = new Map<string, VirtualFrameBuffer>()

  /**
   * Adquiere o reutiliza un Virtual Frame Buffer para `canvasId`.
   *
   * Idempotente: si ya existe uno con la misma resolución, lo devuelve.
   * Si las dimensiones cambian, descarta el anterior y crea uno nuevo.
   *
   * **Solo en patch-time** — never call from hot path (44Hz).
   *
   * @param canvasId — Identificador único (ej. `'lfx:plasma:42'`).
   * @param width    — Ancho en pixels (1..4096 razonable).
   * @param height   — Alto en pixels.
   * @returns El buffer adquirido (front=back=zeros la primera vez).
   */
  public acquire(canvasId: string, width: number, height: number): VirtualFrameBuffer {
    if (!Number.isInteger(width) || width < 1) {
      throw new RangeError(`AetherCanvasManager.acquire: width must be positive integer, got ${width}`)
    }
    if (!Number.isInteger(height) || height < 1) {
      throw new RangeError(`AetherCanvasManager.acquire: height must be positive integer, got ${height}`)
    }

    const existing = this._buffers.get(canvasId)
    if (existing && existing.width === width && existing.height === height) {
      return existing
    }

    const len = width * height * 4
    const buf: VirtualFrameBuffer = {
      canvasId,
      width,
      height,
      front: new Uint8ClampedArray(len),
      back: new Uint8ClampedArray(len),
      frameSeq: 0,
      lastFlipMs: 0,
      hasAlpha: false,
    }
    this._buffers.set(canvasId, buf)
    return buf
  }

  /**
   * Promueve `back` a `front` mediante swap atómico de referencias.
   *
   * Un consumidor que esté leyendo `front` cuando se llame `flip()` puede
   * recibir el frame anterior o el nuevo según el orden de operaciones JS,
   * pero NUNCA un frame parcial: la asignación de referencia es atómica
   * en el modelo de memoria de V8 single-threaded.
   *
   * Si el `canvasId` no existe, no-op silencioso.
   *
   * @param canvasId — ID del buffer a flipear.
   */
  public flip(canvasId: string): void {
    const b = this._buffers.get(canvasId)
    if (!b) return
    const tmp = b.front
    b.front = b.back
    b.back = tmp
    b.frameSeq++
    b.lastFlipMs = performance.now()
  }

  /**
   * Alias semántico de `flip()`. Algunos productores prefieren la palabra
   * 'swap' por simetría con APIs gráficas tradicionales.
   */
  public swapBuffers(canvasId: string): void {
    this.flip(canvasId)
  }

  // ── Escritura rápida (para productores nativos JS) ──────────────────────

  /**
   * Escribe un frame completo al `back` buffer.
   *
   * Espera que `data.length === width * height * 4`. Si la longitud es
   * menor, se copia parcialmente (no rellena el resto). Si es mayor,
   * se trunca.
   *
   * **NO llama `flip()` automáticamente** — el productor decide cuándo
   * presentar el frame.
   *
   * @param canvasId — ID del buffer destino.
   * @param data     — Frame RGBA8 interleaved.
   * @param hasAlpha — (opcional) hint para el muestreador. Default: false.
   */
  public writeFrame(canvasId: string, data: Uint8ClampedArray, hasAlpha = false): void {
    const b = this._buffers.get(canvasId)
    if (!b) return
    // `set` recorta o copia parcialmente según longitud — comportamiento estándar.
    b.back.set(data.length > b.back.length ? data.subarray(0, b.back.length) : data)
    b.hasAlpha = hasAlpha
  }

  /**
   * Escribe un único pixel en `back` con coordenadas enteras.
   *
   * Bounds-check: si (x,y) está fuera del rango, no-op silencioso.
   *
   * Coste: 4 escrituras Uint8 + 1 cálculo de offset. ~1-2 ns en V8.
   *
   * @param canvasId — ID del buffer destino.
   * @param x        — Columna [0..width-1].
   * @param y        — Fila [0..height-1].
   * @param r        — Rojo [0..255].
   * @param g        — Verde [0..255].
   * @param b        — Azul [0..255].
   * @param a        — Alpha [0..255]. Default: 255.
   */
  public setPixel(
    canvasId: string,
    x: number,
    y: number,
    r: number,
    g: number,
    b: number,
    a = 255,
  ): void {
    const buf = this._buffers.get(canvasId)
    if (!buf) return
    if (x < 0 || x >= buf.width || y < 0 || y >= buf.height) return
    const off = (y * buf.width + x) << 2
    buf.back[off] = r
    buf.back[off + 1] = g
    buf.back[off + 2] = b
    buf.back[off + 3] = a
    if (a !== 255) buf.hasAlpha = true
  }

  /**
   * Llena el `back` buffer con un color sólido. Útil para clears
   * pre-render o blackouts locales del productor.
   *
   * @param canvasId — ID del buffer destino.
   * @param r,g,b,a  — Valores [0..255]. `a` default=255.
   */
  public clear(canvasId: string, r: number, g: number, b: number, a = 255): void {
    const buf = this._buffers.get(canvasId)
    if (!buf) return
    const back = buf.back
    const len = back.length
    for (let i = 0; i < len; i += 4) {
      back[i] = r
      back[i + 1] = g
      back[i + 2] = b
      back[i + 3] = a
    }
    buf.hasAlpha = a !== 255
  }

  // ── Lifecycle / lookup ──────────────────────────────────────────────────

  /**
   * Libera un buffer. Llamar al desactivar un clip pixel-mapped.
   *
   * **Solo en patch-time**.
   */
  public release(canvasId: string): void {
    this._buffers.delete(canvasId)
  }

  /** Devuelve el buffer si existe; `undefined` en caso contrario. */
  public get(canvasId: string): VirtualFrameBuffer | undefined {
    return this._buffers.get(canvasId)
  }

  /** True si `canvasId` está actualmente registrado. */
  public has(canvasId: string): boolean {
    return this._buffers.has(canvasId)
  }

  /**
   * Itera todos los buffers activos. Pensado para el adaptador L3, que
   * necesita recorrer cada canvas activo cada tick.
   *
   * Devuelve un iterable directo del Map — zero-alloc.
   */
  public activeBuffers(): IterableIterator<VirtualFrameBuffer> {
    return this._buffers.values()
  }

  /** Número de buffers activos. */
  public get size(): number {
    return this._buffers.size
  }

  /**
   * Limpia todos los buffers. Útil en teardown (cierre de show, tests).
   * **No usar en hot path.**
   */
  public clearAll(): void {
    this._buffers.clear()
  }
}

// ─── SINGLETON OPCIONAL ─────────────────────────────────────────────────────

let _instance: AetherCanvasManager | null = null

/**
 * Acceso al manager compartido — útil cuando el orchestrator y el adapter
 * viven en módulos distintos y prefieren no inyectar la instancia.
 */
export function getAetherCanvasManager(): AetherCanvasManager {
  if (_instance == null) _instance = new AetherCanvasManager()
  return _instance
}

/** SOLO para tests: resetea el singleton. */
export function __resetAetherCanvasManagerForTests(): void {
  _instance = null
}
