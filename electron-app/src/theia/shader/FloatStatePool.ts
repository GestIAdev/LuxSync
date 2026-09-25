/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧬 WAVE 8237 — INFINITE GENOME · Fase G5: Float State Pool (Materia Viva)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Ping-pong RGBA16F sobre `EXT_color_buffer_float` — el sustrato de estado
 * persistente para autómatas reales (Gray-Scott, Physarum, *Materia Viva*).
 *
 * Diferencias honestas respecto a `u_prevFrame` (§5 blueprint):
 *   - RGBA16F + HALF_FLOAT: precisión float lineal, no RGBA8 cuantizado.
 *   - NEAREST: el autómata lee vecinos texel-exactos (`texelFetch`); la
 *     filtración bilineal de un half-float además exigiría otra extensión.
 *   - SIN epílogo: el shader de simulación escribe el estado crudo — ni
 *     masters, ni crossfade, ni limitador, ni sRGB.
 *
 * Una instancia por PROGRAMA (GenProgram/GenEntry): el estado pertenece al
 * genoma compilado — mutación `expr`-only (mismo programKey) conserva la
 * colonia; cambiar de programa reinicia la siembra (`needsInit` →
 * `u_stateInit` = 1 durante el primer frame).
 *
 * Zero-alloc por frame: texturas/FBOs se crean en `ensure()` (solo al
 * primer frame o tras un resize); el loop caliente hace bind + swap.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** ¿El contexto soporta render targets float16? (EXT_color_buffer_float) */
export function floatStateSupported(gl: WebGL2RenderingContext): boolean {
  try {
    return !!gl.getExtension('EXT_color_buffer_float')
  } catch {
    return false
  }
}

export class FloatStatePool {
  private readonly gl: WebGL2RenderingContext
  /** Sondaje único por pool — `ensure()` no repite `getExtension` por frame. */
  private readonly extOk: boolean
  private texA: WebGLTexture | null = null
  private texB: WebGLTexture | null = null
  private fboA: WebGLFramebuffer | null = null
  private fboB: WebGLFramebuffer | null = null
  private w = 0
  private h = 0
  private flip = false
  private alive = false
  /**
   * `true` tras alloc/realloc — el próximo frame sube `u_stateInit = 1`
   * (la sim siembra; el visual ve estado recién inicializado).
   */
  needsInit = true

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl
    this.extOk = floatStateSupported(gl)
  }

  /** ¿Pool listo para renderizar? (extensión + FBOs completos) */
  get ready(): boolean {
    return this.alive
  }

  /** Textura del estado del frame ANTERIOR (la lee `u_state`). */
  get readTexture(): WebGLTexture | null {
    return this.flip ? this.texB : this.texA
  }

  /** FBO donde escribir el estado NUEVO este frame. */
  get writeFramebuffer(): WebGLFramebuffer | null {
    return this.flip ? this.fboA : this.fboB
  }

  /**
   * (Re)asigna el par de texturas RGBA16F si cambia el tamaño.
   * Devuelve false si la extensión falta o el FBO queda incompleto.
   */
  ensure(w: number, h: number): boolean {
    const gl = this.gl
    if (!this.extOk) {
      this.alive = false
      return false
    }
    if (this.alive && this.w === w && this.h === h) return true
    this.disposeTargets()
    this.w = w
    this.h = h

    const mk = (): { tex: WebGLTexture; fb: WebGLFramebuffer } | null => {
      const tex = gl.createTexture()
      const fb = gl.createFramebuffer()
      if (!tex || !fb) return null
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.texImage2D(
        gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null,
      )
      // NEAREST — los autómatas necesitan vecinos texel-exactos.
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0,
      )
      const ok =
        gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      if (!ok) {
        gl.deleteTexture(tex)
        gl.deleteFramebuffer(fb)
        return null
      }
      return { tex, fb }
    }

    const a = mk()
    const b = mk()
    this.texA = a?.tex ?? null
    this.fboA = a?.fb ?? null
    this.texB = b?.tex ?? null
    this.fboB = b?.fb ?? null
    this.flip = false
    this.needsInit = true
    this.alive = !!a && !!b
    return this.alive
  }

  /** Tras el pase de simulación: lo escrito pasa a ser el "frame previo". */
  swap(): void {
    this.flip = !this.flip
  }

  /** Libera texturas + FBOs (evicción LRU / context-loss). */
  dispose(): void {
    this.disposeTargets()
    this.alive = false
    this.w = 0
    this.h = 0
  }

  private disposeTargets(): void {
    const gl = this.gl
    try {
      if (this.texA) gl.deleteTexture(this.texA)
      if (this.texB) gl.deleteTexture(this.texB)
      if (this.fboA) gl.deleteFramebuffer(this.fboA)
      if (this.fboB) gl.deleteFramebuffer(this.fboB)
    } catch { /* context may be lost */ }
    this.texA = null
    this.texB = null
    this.fboA = null
    this.fboB = null
    this.alive = false
    this.needsInit = true
  }
}
