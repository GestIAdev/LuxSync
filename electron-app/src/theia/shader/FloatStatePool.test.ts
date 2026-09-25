/**
 * 🧬 WAVE 8237 — Infinite Genome · Phase G5 certification (Vitest, no GPU).
 *
 * Certifica FloatStatePool sobre un WebGL2 falso:
 *  - Reserva ping-pong RGBA16F + HALF_FLOAT bajo EXT_color_buffer_float.
 *  - Filtros NEAREST (vecinos texel-exactos para autómatas) + CLAMP.
 *  - Ping-pong read/write tras swap(); needsInit tras alloc/resize/dispose.
 *  - Degradación sin la extensión y liberación completa en dispose().
 */

import { describe, expect, it } from 'vitest'
import { FloatStatePool, floatStateSupported } from './FloatStatePool'

/** GL fake mínimo — solo lo que FloatStatePool toca. */
class FakeGL {
  readonly TEXTURE_2D = 0x0de1
  readonly RGBA16F = 0x881a
  readonly RGBA = 0x1908
  readonly HALF_FLOAT = 0x140b
  readonly NEAREST = 0x2600
  readonly LINEAR = 0x2601
  readonly CLAMP_TO_EDGE = 0x812f
  readonly FRAMEBUFFER = 0x8d40
  readonly COLOR_ATTACHMENT0 = 0x8ce0
  readonly FRAMEBUFFER_COMPLETE = 0x8cd5
  readonly TEXTURE_MIN_FILTER = 0x2801
  readonly TEXTURE_MAG_FILTER = 0x2800
  readonly TEXTURE_WRAP_S = 0x2802
  readonly TEXTURE_WRAP_T = 0x2803

  extOk = true
  fbComplete = true
  texAllocs: { internal: number; w: number; h: number; type: number }[] = []
  filters: number[] = []
  deletedTex = 0
  deletedFbo = 0
  private texSeq = 0
  private fboSeq = 0

  getExtension(name: string): object | null {
    return name === 'EXT_color_buffer_float' && this.extOk ? {} : null
  }
  createTexture(): object {
    return { __tex: ++this.texSeq }
  }
  createFramebuffer(): object {
    return { __fbo: ++this.fboSeq }
  }
  bindTexture(): void {}
  texImage2D(
    _t: number,
    _l: number,
    internal: number,
    w: number,
    h: number,
    _b: number,
    _f: number,
    type: number,
  ): void {
    this.texAllocs.push({ internal, w, h, type })
  }
  texParameteri(_t: number, pname: number, value: number): void {
    if (pname === this.TEXTURE_MIN_FILTER || pname === this.TEXTURE_MAG_FILTER) {
      this.filters.push(value)
    }
  }
  bindFramebuffer(): void {}
  framebufferTexture2D(): void {}
  checkFramebufferStatus(): number {
    return this.fbComplete ? this.FRAMEBUFFER_COMPLETE : 0
  }
  deleteTexture(): void {
    this.deletedTex++
  }
  deleteFramebuffer(): void {
    this.deletedFbo++
  }
}

function mkPool(extOk = true, fbComplete = true) {
  const gl = new FakeGL()
  gl.extOk = extOk
  gl.fbComplete = fbComplete
  const pool = new FloatStatePool(gl as unknown as WebGL2RenderingContext)
  return { gl, pool }
}

describe('G5 — FloatStatePool: ping-pong RGBA16F', () => {
  it('floatStateSupported consulta EXT_color_buffer_float', () => {
    const gl = new FakeGL()
    expect(
      floatStateSupported(gl as unknown as WebGL2RenderingContext),
    ).toBe(true)
    gl.extOk = false
    expect(
      floatStateSupported(gl as unknown as WebGL2RenderingContext),
    ).toBe(false)
  })

  it('ensure reserva DOS texturas RGBA16F+HALF_FLOAT con NEAREST', () => {
    const { gl, pool } = mkPool()
    expect(pool.ensure(320, 180)).toBe(true)
    expect(pool.ready).toBe(true)
    expect(gl.texAllocs.length).toBe(2)
    for (const a of gl.texAllocs) {
      expect(a.internal).toBe(gl.RGBA16F) // half-float lineal, no RGBA8
      expect(a.type).toBe(gl.HALF_FLOAT)
      expect(a.w).toBe(320)
      expect(a.h).toBe(180)
    }
    // NEAREST — los autómatas leen vecinos texel-exactos.
    expect(gl.filters.length).toBe(4)
    for (const f of gl.filters) expect(f).toBe(gl.NEAREST)
  })

  it('ping-pong: swap intercambia lectura/escritura', () => {
    const { pool } = mkPool()
    pool.ensure(64, 64)
    const read0 = pool.readTexture
    const write0 = pool.writeFramebuffer
    expect(read0).not.toBeNull()
    expect(write0).not.toBeNull()
    pool.swap()
    expect(pool.readTexture).not.toBe(read0)
    expect(pool.writeFramebuffer).not.toBe(write0)
    pool.swap()
    expect(pool.readTexture).toBe(read0)
    expect(pool.writeFramebuffer).toBe(write0)
  })

  it('needsInit: 1 tras alloc, se conserva tras swap, rearma al resize', () => {
    const { pool } = mkPool()
    expect(pool.needsInit).toBe(true)
    pool.ensure(64, 64)
    expect(pool.needsInit).toBe(true)
    pool.swap()
    pool.needsInit = false // el host la consume tras el primer frame
    expect(pool.needsInit).toBe(false)
    // Mismo tamaño → no realloc ni re-init.
    expect(pool.ensure(64, 64)).toBe(true)
    expect(pool.needsInit).toBe(false)
    // Resize → realloc + siembra de nuevo.
    expect(pool.ensure(128, 128)).toBe(true)
    expect(pool.needsInit).toBe(true)
  })

  it('sin EXT_color_buffer_float el pool degrada a no-listo', () => {
    const { gl, pool } = mkPool(false)
    expect(pool.ensure(64, 64)).toBe(false)
    expect(pool.ready).toBe(false)
    expect(gl.texAllocs.length).toBe(0) // jamás reserva sin soporte
  })

  it('FBO incompleto → no listo y no deja targets colgando', () => {
    const { gl, pool } = mkPool(true, false)
    expect(pool.ensure(64, 64)).toBe(false)
    expect(pool.ready).toBe(false)
    // mk() limpia lo suyo: cada intento borra tex+fbo que fallaron.
    expect(gl.deletedTex).toBeGreaterThanOrEqual(2)
    expect(gl.deletedFbo).toBeGreaterThanOrEqual(2)
  })

  it('dispose libera texturas y FBOs (evicción LRU / context-loss)', () => {
    const { gl, pool } = mkPool()
    pool.ensure(64, 64)
    pool.dispose()
    expect(pool.ready).toBe(false)
    expect(pool.needsInit).toBe(true)
    expect(gl.deletedTex).toBe(2)
    expect(gl.deletedFbo).toBe(2)
    // Idempotente.
    pool.dispose()
    expect(gl.deletedTex).toBe(2)
  })

  it('resize libera los targets anteriores antes de reservar los nuevos', () => {
    const { gl, pool } = mkPool()
    pool.ensure(64, 64)
    pool.ensure(320, 180)
    expect(gl.deletedTex).toBe(2)
    expect(gl.deletedFbo).toBe(2)
    expect(gl.texAllocs.length).toBe(4)
    expect(gl.texAllocs[2].w).toBe(320)
  })
})
