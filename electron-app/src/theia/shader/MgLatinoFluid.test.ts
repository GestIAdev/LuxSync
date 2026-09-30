/**
 * 🎨 WAVE 8401 — Pack Latino · átomo "MG Latino Fluid" + sampler `u_tex0`.
 *
 * Certifica:
 *  - Cabecera: ADN (0.5/0.3/0.9), vibes con comas para Selene V3, `tex0`.
 *  - Contrato de autor: sin u_impact/u_approach (prohibidos desde 8287),
 *    sin pow()/tonemap propio, mainImage canónico, u_tex0 gateado por
 *    u_hasTex0 (nunca pantalla negra mientras carga).
 *  - Ensamblado: el preámbulo declara `u_tex0` + `u_hasTex0`.
 *  - UserTextureCache: carga async una sola vez, degrada con gracia
 *    (null → dummy), no filtra texturas tras dispose().
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import MG_SRC from '../../../assets/shaders/mg_latino_fluid.glsl?raw'
import {
  assembleFragmentShader,
  buildPreamble,
  hasMainImage,
  parseEuclidMeta,
  parseTex0Hint,
} from './ShaderAssembler'
import { UserTextureCache, hasUserTexture, USER_TEX0_UNIT } from './UserTextures'

describe('WAVE 8401 — cabecera del átomo', () => {
  const meta = parseEuclidMeta(MG_SRC)

  it('ADN inicial: agresión media, caos bajo, organicidad alta', () => {
    expect(meta.genome).toEqual({ aggression: 0.5, chaos: 0.3, organicity: 0.9 })
  })

  it('vibes de Selene V3 (separadas por comas) + textura del logo', () => {
    expect(meta.vibes).toEqual(['fiesta-latina', 'reggaeton', 'cumbia', 'warm-groove'])
    expect(meta.tex0).toBe('logo-mg')
    expect(parseTex0Hint(MG_SRC)).toBe('logo-mg')
    expect(hasUserTexture('logo-mg')).toBe(true)
  })

  it('genes expr con guardia #ifndef y params neutros (Cero Neutro)', () => {
    expect(meta.genes.map((g) => g.name)).toEqual(['G_FREQ', 'G_ELASTIC', 'G_WARM'])
    expect(meta.params.map((p) => [p.name, p.defaultValue])).toEqual([
      ['u_liquid', 0],
      ['u_aura', 0],
    ])
    for (const g of ['G_FREQ', 'G_ELASTIC', 'G_WARM']) {
      expect(MG_SRC).toContain(`#ifndef ${g}`)
    }
  })

  it('parseTex0Hint ignora fuentes sin la directiva', () => {
    expect(parseTex0Hint('void mainImage(out vec4 c, in vec2 f){}')).toBeNull()
  })
})

describe('WAVE 8401 — contrato de autor', () => {
  const code = MG_SRC.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n')

  it('firma mainImage canónica', () => {
    expect(hasMainImage(MG_SRC)).toBe(true)
  })

  it('Clean Shot: sin u_impact / u_approach / predicción en el arte', () => {
    expect(code).not.toMatch(/u_impact|u_approach|u_predictiveETA|u_strobeGate/)
  })

  it('salida lineal: sin pow() ni tonemap propio', () => {
    expect(code).not.toMatch(/\bpow\s*\(/)
    expect(code).not.toMatch(/1\.0\s*-\s*exp\(\s*-\s*col/)
  })

  it('usa las señales pedidas: bass/mid + kick elástico + logo por u_tex0', () => {
    expect(code).toMatch(/u_bass/)
    expect(code).toMatch(/u_mid/)
    expect(code).toMatch(/u_kickPulse/)
    expect(code).toMatch(/texture\(\s*u_tex0/)
  })

  it('degrada sin textura: u_hasTex0 decide entre logo y disco procedural', () => {
    expect(code).toMatch(/u_hasTex0/)
  })

  it('fogonazo de downbeat cegado durante X-FADE (u_blend)', () => {
    expect(code).toMatch(/u_barPhase/)
    expect(code).toMatch(/u_blend/)
  })
})

describe('WAVE 8401 — ensamblado', () => {
  it('el preámbulo declara el sampler de artista', () => {
    const pre = buildPreamble()
    expect(pre).toContain('uniform sampler2D u_tex0;')
    expect(pre).toContain('uniform float u_hasTex0;')
  })

  it('el átomo ensambla con mainImage y sin colisión de símbolos', () => {
    const asm = assembleFragmentShader(MG_SRC, 64)
    expect(asm.fragSource).toContain('void mainImage')
    // El preámbulo (u_tex0) va ANTES del cuerpo del artista.
    expect(asm.fragSource.indexOf('uniform sampler2D u_tex0;')).toBeLessThan(
      asm.fragSource.indexOf('vec4 logoTap('),
    )
  })

  it('u_tex0 no colisiona con las unidades reservadas (0=prev 1=flash 2=state)', () => {
    expect(USER_TEX0_UNIT).toBe(3)
  })
})

describe('WAVE 8401 — UserTextureCache', () => {
  const flush = () => new Promise((r) => setTimeout(r, 0))

  function mockGL() {
    return {
      createTexture: vi.fn(() => ({ id: 'tex' })),
      deleteTexture: vi.fn(),
      bindTexture: vi.fn(),
      getParameter: vi.fn(() => null),
      texImage2D: vi.fn(),
      generateMipmap: vi.fn(),
      texParameteri: vi.fn(),
      TEXTURE_2D: 0x0de1,
      TEXTURE_BINDING_2D: 0x8069,
      RGBA: 0x1908,
      UNSIGNED_BYTE: 0x1401,
      TEXTURE_MIN_FILTER: 1,
      TEXTURE_MAG_FILTER: 2,
      TEXTURE_WRAP_S: 3,
      TEXTURE_WRAP_T: 4,
      LINEAR_MIPMAP_LINEAR: 5,
      LINEAR: 6,
      CLAMP_TO_EDGE: 7,
    } as unknown as WebGL2RenderingContext & Record<string, ReturnType<typeof vi.fn>>
  }

  afterEach(() => vi.unstubAllGlobals())

  it('carga async UNA vez: null mientras carga, textura después', async () => {
    const close = vi.fn()
    const fetchMock = vi.fn(async () => ({ blob: async () => new Blob(['x']) }))
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ close })))

    const gl = mockGL()
    const cache = new UserTextureCache()
    expect(cache.acquire(gl, 'logo-mg')).toBeNull() // dispara la carga
    expect(cache.acquire(gl, 'logo-mg')).toBeNull() // sigue cargando — sin 2ª carga
    await flush()

    const tex = cache.acquire(gl, 'logo-mg')
    expect(tex).toEqual({ id: 'tex' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(close).toHaveBeenCalledTimes(1) // el bitmap se libera tras subirlo
    expect(gl.generateMipmap).toHaveBeenCalledTimes(1)
    // Bitmap creado premultiplicado + flipY (el flip global de GL se ignora
    // para ImageBitmap).
    expect(vi.mocked(createImageBitmap)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ premultiplyAlpha: 'premultiply', imageOrientation: 'flipY' }),
    )
  })

  it('nombre desconocido → falla en silencio (null), sin reintentos', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const cache = new UserTextureCache()
    const gl = mockGL()
    expect(cache.acquire(gl, 'no-existe')).toBeNull()
    await flush()
    expect(cache.acquire(gl, 'no-existe')).toBeNull()
    expect(gl.createTexture).not.toHaveBeenCalled()
  })

  it('dispose() borra la textura y descarta cargas en vuelo de la era previa', async () => {
    const close = vi.fn()
    vi.stubGlobal('fetch', vi.fn(async () => ({ blob: async () => new Blob(['x']) })))
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ close })))

    const gl = mockGL()
    const cache = new UserTextureCache()
    cache.acquire(gl, 'logo-mg')
    cache.dispose(gl) // ANTES de que termine la carga
    await flush()
    expect(gl.createTexture).not.toHaveBeenCalled() // no se sube a un contexto muerto
    expect(close).toHaveBeenCalledTimes(1) // pero el bitmap sí se libera

    // Era nueva: vuelve a cargar y ahora dispose() sí borra la textura.
    cache.acquire(gl, 'logo-mg')
    await flush()
    expect(cache.acquire(gl, 'logo-mg')).not.toBeNull()
    cache.dispose(gl)
    expect(gl.deleteTexture).toHaveBeenCalledTimes(1)
  })
})
