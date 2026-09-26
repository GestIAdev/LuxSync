/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔮 WAVE 8231 — EUCLID ORACLE · E5: GenRuntime (Modo B, §6)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Pipeline generativo AUTOSUFICIENTE para un segundo contexto WebGL2 — la
 * ventana de salida HDMI renderiza el MISMO `.glsl` del artista a su
 * resolución nativa mientras el worker mantiene solo el gemelo 64×64
 * (DMX thumb + preview). Preámbulo/epílogo idénticos al worker:
 * ShaderAssembler es la fuente única del contrato §4.1.
 *
 *   load(id,src,steps) → assemble → compile (KHR_parallel → probe por frame)
 *   activate(id,fade)  → snapshot prev-frame + rampa de crossfade temporal
 *   render(...)        → escena→FBO escalado → stats 1×1 → blit → prevTex
 *
 * Espejo intencional del path generativo de `theta.worker.ts` (misma
 * semántica, encapsulada en clase para el proceso de la ventana).
 * ═══════════════════════════════════════════════════════════════════════════
 */

import {
  assembleFragmentShader,
  assembleSimFragmentShader,
  exprGeneValues,
  remapShaderLog,
  hasMainImage,
  hasMainState,
  hashSource,
  parseStepsHint,
  GEN_VERTEX_SRC,
  BLIT_VERTEX_SRC,
  BLIT_FRAG_SRC,
  FLASH_STATS_FRAG_SRC,
  DEFAULT_MAX_STEPS,
  DEFAULT_FLASH_MAX_DELTA,
  FLASH_BUDGET,
  FLASH_BUDGET_RATE,
} from './ShaderAssembler'
// 🧬 WAVE 8237 · G5 — Materia Viva: ping-pong RGBA16F por programa.
import { FloatStatePool } from './FloatStatePool'
import { TEL_FLAG } from '../telemetry/TheiaTelemetryRing'
import type { TelemetrySmoother } from '../telemetry/TelemetrySmoother'

export const BUILTIN_SHADER_ID = 'builtin'

/** Uniforms del contrato §4 — nunca se resuelven como params de artista. */
const GEN_STD_UNIFORMS = new Set([
  'u_tel', 'u_flags', 'u_enums', 'u_time', 'u_dt', 'u_resolution',
  'u_beatTime', 'u_kickPulse', 'u_snarePulse', 'u_predictiveETA',
  'u_approach', 'u_impact', 'u_brightness', 'u_contrast', 'u_blackout',
  'u_renderScale', 'u_prevFrame', 'u_flashState', 'u_hasPrev', 'u_blend',
  'u_flashGuard', 'u_flashMaxDelta', 'u_flashBudget', 'u_flashBudgetRate',
  'u_gene', 'u_state', 'u_stateInit',
])

export interface GenRuntimeStatus {
  shaderId: string
  ok: boolean
  compileMs?: number
  log?: string
  line?: number
  pending?: boolean
  unsupported?: boolean
}

interface GenLocs {
  tel: WebGLUniformLocation | null
  flags: WebGLUniformLocation | null
  enums: WebGLUniformLocation | null
  time: WebGLUniformLocation | null
  dt: WebGLUniformLocation | null
  resolution: WebGLUniformLocation | null
  beatTime: WebGLUniformLocation | null
  kickPulse: WebGLUniformLocation | null
  snarePulse: WebGLUniformLocation | null
  predictiveETA: WebGLUniformLocation | null
  approach: WebGLUniformLocation | null
  impact: WebGLUniformLocation | null
  brightness: WebGLUniformLocation | null
  contrast: WebGLUniformLocation | null
  blackout: WebGLUniformLocation | null
  renderScale: WebGLUniformLocation | null
  prevFrame: WebGLUniformLocation | null
  flashState: WebGLUniformLocation | null
  hasPrev: WebGLUniformLocation | null
  blend: WebGLUniformLocation | null
  flashGuard: WebGLUniformLocation | null
  flashMaxDelta: WebGLUniformLocation | null
  flashBudget: WebGLUniformLocation | null
  /** 🧬 WAVE 8235 · G3 — `u_gene[8]` (genes `expr`, fast-path §4.2 v2). */
  gene: WebGLUniformLocation | null
  /** 🧬 WAVE 8237 · G5 — estado RGBA16F del autómata + flag de siembra. */
  state: WebGLUniformLocation | null
  stateInit: WebGLUniformLocation | null
}

/** Subconjunto de uniforms que consume el pase de simulación (G5). */
interface SimLocs {
  tel: WebGLUniformLocation | null
  flags: WebGLUniformLocation | null
  enums: WebGLUniformLocation | null
  time: WebGLUniformLocation | null
  dt: WebGLUniformLocation | null
  resolution: WebGLUniformLocation | null
  beatTime: WebGLUniformLocation | null
  kickPulse: WebGLUniformLocation | null
  snarePulse: WebGLUniformLocation | null
  predictiveETA: WebGLUniformLocation | null
  approach: WebGLUniformLocation | null
  impact: WebGLUniformLocation | null
  gene: WebGLUniformLocation | null
  state: WebGLUniformLocation | null
  stateInit: WebGLUniformLocation | null
}

interface GenEntry {
  program: WebGLProgram
  locs: GenLocs
  paramLocs: Map<string, WebGLUniformLocation | null>
  posLoc: number
  lastUsed: number
  /** 🧬 WAVE 8237 · G5 — programa de simulación (mainState) si existe. */
  simProgram: WebGLProgram | null
  simLocs: SimLocs | null
  simPosLoc: number
  simParamLocs: Map<string, WebGLUniformLocation | null>
  /** Ping-pong RGBA16F propio del programa — null si no hay mainState. */
  statePool: FloatStatePool | null
}

interface GenPending {
  shaderId: string
  /** 🧬 WAVE 8233 · G1 — clave de caché (hash fuente+genes), NO el atomId. */
  programKey: string
  steps: number
  program: WebGLProgram
  vs: WebGLShader
  fs: WebGLShader
  preambleLines: number
  bodyLines: number
  t0: number
}

/** 🧬 WAVE 8233 · G1 — especificación por shaderId: fenotipo+programKey. */
interface GenSourceSpec {
  /** 🧬 WAVE 8237 · G5 — fuente cruda (para el pase de simulación). */
  source: string
  genes?: Record<string, number>
  /** 🧬 WAVE 8235 · G3 — orden `u_gene[8]` + valores `expr` efectivos. */
  exprGenes?: readonly string[]
  exprValues?: Float32Array
  programKey: string
}

const GEN_CACHE_MAX = 8

const FULLSCREEN_TRI = new Float32Array([-1, -1, 3, -1, -1, 3])

/**
 * Contexto WebGL2 + pipeline generativo sobre un canvas de ventana.
 * Devuelve null sin WebGL2 — el caller queda en Modo A (frames bridged).
 */
export class GenRuntime {
  /** Callback de estado (equivale a `theia:shader-status` local). */
  onStatus: (s: GenRuntimeStatus) => void = () => {}

  private readonly gl: WebGL2RenderingContext
  private readonly canvas: HTMLCanvasElement | OffscreenCanvas
  private readonly khrCompile: { COMPLETION_STATUS_KHR: number } | null

  /** Caché LRU por programKey (hash fuente+genes) — variantes coexisten. */
  private readonly programs = new Map<string, GenEntry>()
  private readonly pending = new Map<string, GenPending>()
  /** shaderId → fenotipo+programKey (para resolver `activate`). */
  private readonly sources = new Map<string, GenSourceSpec>()
  private pendingActivate: { id: string; programKey: string; fadeMs: number } | null = null
  private active: GenEntry | null = null
  private activeId = BUILTIN_SHADER_ID
  private seq = 0
  /** 🧬 WAVE 8235 · G3 — genes `expr` del fenotipo activo → `u_gene[8]`. */
  private readonly geneValues = new Float32Array(8)

  // Recursos GL compartidos
  private vbo: WebGLBuffer | null = null
  private dummyTex: WebGLTexture | null = null
  private fbo: WebGLFramebuffer | null = null
  private fboTex: WebGLTexture | null = null
  private fboW = 0
  private fboH = 0
  private prevTex: WebGLTexture | null = null
  private prevW = 0
  private prevH = 0
  private prevValid = false
  private blitProg: WebGLProgram | null = null
  private blitTexLoc: WebGLUniformLocation | null = null
  private blitPos = -1
  private statsProg: WebGLProgram | null = null
  private statsPos = -1
  private statsSceneLoc: WebGLUniformLocation | null = null
  private statsPrevLoc: WebGLUniformLocation | null = null
  private statsDtLoc: WebGLUniformLocation | null = null
  private statsBudgetLoc: WebGLUniformLocation | null = null
  private statsRateLoc: WebGLUniformLocation | null = null
  private statsTexA: WebGLTexture | null = null
  private statsTexB: WebGLTexture | null = null
  private statsFboA: WebGLFramebuffer | null = null
  private statsFboB: WebGLFramebuffer | null = null
  private statsFlip = false

  // Crossfade temporal (reloj propio — renderer tiene rAF real).
  private fadeT0 = -1
  private fadeDur = 0

  // 🌊 WAVE 8250 — gobernador de tiempo acumulativo (anti "Electric
  // Sheep"): `u_time` crece a la velocidad del audio — AUDIO_LIVE → 1.0,
  // sordo → 0.5 — con suavizado exponencial independiente del frame-rate
  // (τ=160ms ≈ 10%/frame @60fps). Acumulativo y jamás reseteado por
  // activate/deactivate → continuidad total, sin saltos al volver el audio.
  // `u_dt` se mantiene físico: los autómatas (mainState) integran con dt
  // real, no con el reloj gobernado.
  private shaderTimeSec = 0
  private timeScale = 0.5

  private constructor(
    gl: WebGL2RenderingContext,
    canvas: HTMLCanvasElement | OffscreenCanvas,
  ) {
    this.gl = gl
    this.canvas = canvas
    this.khrCompile =
      (gl.getExtension('KHR_parallel_shader_compile') as {
        COMPLETION_STATUS_KHR: number
      } | null) ?? null
    this.buildResources()
  }

  /**
   * Crea el runtime sobre un canvas dedicado (WebGL2 propio).
   * `preserveDrawingBuffer` es obligatorio: el prev-frame se captura por
   * `copyTexImage2D` desde el framebuffer por defecto tras el blit.
   */
  static create(
    canvas: HTMLCanvasElement | OffscreenCanvas,
  ): GenRuntime | null {
    const gl = canvas.getContext('webgl2', {
      preserveDrawingBuffer: true,
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      powerPreference: 'high-performance',
    }) as WebGL2RenderingContext | null
    if (!gl) return null
    try {
      return new GenRuntime(gl, canvas)
    } catch {
      return null
    }
  }

  get activeShaderId(): string {
    return this.activeId
  }

  get isActive(): boolean {
    return this.active !== null || this.pendingActivate !== null
  }

  // ── Compilación ────────────────────────────────────────────────────────

  private compileShader(
    type: number,
    src: string,
  ): { shader: WebGLShader; ok: boolean; log: string } {
    const gl = this.gl
    const sh = gl.createShader(type)!
    gl.shaderSource(sh, src)
    gl.compileShader(sh)
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      return { shader: sh, ok: false, log: gl.getShaderInfoLog(sh) ?? 'unknown' }
    }
    return { shader: sh, ok: true, log: '' }
  }

  private cacheLocs(prog: WebGLProgram): GenLocs {
    const gl = this.gl
    return {
      tel: gl.getUniformLocation(prog, 'u_tel'),
      flags: gl.getUniformLocation(prog, 'u_flags'),
      enums: gl.getUniformLocation(prog, 'u_enums'),
      time: gl.getUniformLocation(prog, 'u_time'),
      dt: gl.getUniformLocation(prog, 'u_dt'),
      resolution: gl.getUniformLocation(prog, 'u_resolution'),
      beatTime: gl.getUniformLocation(prog, 'u_beatTime'),
      kickPulse: gl.getUniformLocation(prog, 'u_kickPulse'),
      snarePulse: gl.getUniformLocation(prog, 'u_snarePulse'),
      predictiveETA: gl.getUniformLocation(prog, 'u_predictiveETA'),
      approach: gl.getUniformLocation(prog, 'u_approach'),
      impact: gl.getUniformLocation(prog, 'u_impact'),
      brightness: gl.getUniformLocation(prog, 'u_brightness'),
      contrast: gl.getUniformLocation(prog, 'u_contrast'),
      blackout: gl.getUniformLocation(prog, 'u_blackout'),
      renderScale: gl.getUniformLocation(prog, 'u_renderScale'),
      prevFrame: gl.getUniformLocation(prog, 'u_prevFrame'),
      flashState: gl.getUniformLocation(prog, 'u_flashState'),
      hasPrev: gl.getUniformLocation(prog, 'u_hasPrev'),
      blend: gl.getUniformLocation(prog, 'u_blend'),
      flashGuard: gl.getUniformLocation(prog, 'u_flashGuard'),
      flashMaxDelta: gl.getUniformLocation(prog, 'u_flashMaxDelta'),
      flashBudget: gl.getUniformLocation(prog, 'u_flashBudget'),
      gene: gl.getUniformLocation(prog, 'u_gene[0]'),
      state: gl.getUniformLocation(prog, 'u_state'),
      stateInit: gl.getUniformLocation(prog, 'u_stateInit'),
    }
  }

  /** Locations del pase de simulación (G5 — subconjunto sin epílogo). */
  private cacheSimLocs(prog: WebGLProgram): SimLocs {
    const gl = this.gl
    return {
      tel: gl.getUniformLocation(prog, 'u_tel'),
      flags: gl.getUniformLocation(prog, 'u_flags'),
      enums: gl.getUniformLocation(prog, 'u_enums'),
      time: gl.getUniformLocation(prog, 'u_time'),
      dt: gl.getUniformLocation(prog, 'u_dt'),
      resolution: gl.getUniformLocation(prog, 'u_resolution'),
      beatTime: gl.getUniformLocation(prog, 'u_beatTime'),
      kickPulse: gl.getUniformLocation(prog, 'u_kickPulse'),
      snarePulse: gl.getUniformLocation(prog, 'u_snarePulse'),
      predictiveETA: gl.getUniformLocation(prog, 'u_predictiveETA'),
      approach: gl.getUniformLocation(prog, 'u_approach'),
      impact: gl.getUniformLocation(prog, 'u_impact'),
      gene: gl.getUniformLocation(prog, 'u_gene[0]'),
      state: gl.getUniformLocation(prog, 'u_state'),
      stateInit: gl.getUniformLocation(prog, 'u_stateInit'),
    }
  }

  /**
   * 🧬 WAVE 8237 · G5 — compila el pase de simulación (`mainState`):
   * misma fuente de artista, epílogo crudo — el fragColor va directo al
   * ping-pong RGBA16F. Sync (fuente pequeña, tras la barrera KHR del
   * shader visual). null en error — no fatal.
   */
  private compileSimProgram(
    shaderId: string,
    spec: GenSourceSpec,
    steps: number,
  ): WebGLProgram | null {
    const gl = this.gl
    const asm = assembleSimFragmentShader(
      spec.source, steps, spec.genes, spec.exprGenes,
    )
    const vs = this.compileShader(gl.VERTEX_SHADER, GEN_VERTEX_SRC)
    const fs = this.compileShader(gl.FRAGMENT_SHADER, asm.fragSource)
    if (!vs.ok || !fs.ok) {
      gl.deleteShader(vs.shader)
      gl.deleteShader(fs.shader)
      this.onStatus({
        shaderId,
        ok: false,
        log: `sim pass compile: ${fs.log || vs.log}`,
      })
      return null
    }
    const prog = gl.createProgram()!
    gl.attachShader(prog, vs.shader)
    gl.attachShader(prog, fs.shader)
    gl.linkProgram(prog)
    gl.deleteShader(vs.shader)
    gl.deleteShader(fs.shader)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      try { gl.deleteProgram(prog) } catch { /* noop */ }
      return null
    }
    return prog
  }

  /** Libera programa visual + simulación + ping-pong de una entrada. */
  private deleteEntry(ent: GenEntry): void {
    const gl = this.gl
    try {
      gl.deleteProgram(ent.program)
      if (ent.simProgram) gl.deleteProgram(ent.simProgram)
      ent.statePool?.dispose()
    } catch { /* noop */ }
  }

  /**
   * Compila un shader de artista. Con KHR_parallel → sondeo por frame.
   * 🧬 WAVE 8233 · G1 — `genes` va dentro del fragSource → la caché
   * distingue fenotipos (variantes del mismo átomo = programas LRU
   * independientes; la variante anterior NO se destruye).
   */
  load(
    shaderId: string,
    source: string,
    steps?: number,
    genes?: Record<string, number>,
    exprGenes?: readonly string[],
  ): void {
    const gl = this.gl
    const maxSteps = steps ?? parseStepsHint(source) ?? DEFAULT_MAX_STEPS
    if (!hasMainImage(source)) {
      this.onStatus({
        shaderId,
        ok: false,
        log: 'missing `void mainImage(out vec4, in vec2)` — Euclid §4.1',
      })
      return
    }
    const asm = assembleFragmentShader(source, maxSteps, genes, exprGenes)
    const programKey = hashSource(asm.fragSource)
    this.sources.set(shaderId, {
      source,
      genes,
      exprGenes,
      exprValues: exprGenes?.length
        ? exprGeneValues(exprGenes, genes)
        : undefined,
      programKey,
    })
    if (this.programs.has(programKey) || this.pending.has(programKey)) {
      // Re-carga idempotente o variante ya cacheada por otro átomo.
      this.onStatus({
        shaderId,
        ok: true,
        pending: this.pending.has(programKey) || undefined,
      })
      return
    }
    const t0 = performance.now()
    const vs = this.compileShader(gl.VERTEX_SHADER, GEN_VERTEX_SRC)
    const fs = this.compileShader(gl.FRAGMENT_SHADER, asm.fragSource)
    if (!vs.ok || !fs.ok) {
      const mapped = !fs.ok
        ? remapShaderLog(fs.log, asm.preambleLines, asm.bodyLines)
        : { log: vs.log, line: null }
      gl.deleteShader(vs.shader)
      gl.deleteShader(fs.shader)
      this.onStatus({
        shaderId,
        ok: false,
        log: mapped.log,
        line: mapped.line ?? undefined,
      })
      return
    }
    const prog = gl.createProgram()!
    gl.attachShader(prog, vs.shader)
    gl.attachShader(prog, fs.shader)
    gl.linkProgram(prog)
    const p: GenPending = {
      shaderId,
      programKey,
      steps: maxSteps,
      program: prog,
      vs: vs.shader,
      fs: fs.shader,
      preambleLines: asm.preambleLines,
      bodyLines: asm.bodyLines,
      t0,
    }
    if (this.khrCompile) {
      this.pending.set(programKey, p)
      this.onStatus({ shaderId, ok: true, pending: true })
    } else {
      this.finalize(p)
    }
  }

  private finalize(p: GenPending): void {
    const gl = this.gl
    const fsLog = gl.getShaderInfoLog(p.fs) ?? ''
    const progLog = gl.getProgramInfoLog(p.program) ?? ''
    const ok = !!gl.getProgramParameter(p.program, gl.LINK_STATUS)
    gl.deleteShader(p.vs)
    gl.deleteShader(p.fs)
    const compileMs = performance.now() - p.t0
    if (ok) {
      const ent: GenEntry = {
        program: p.program,
        locs: this.cacheLocs(p.program),
        paramLocs: new Map(),
        posLoc: gl.getAttribLocation(p.program, 'a_pos'),
        lastUsed: this.seq,
        simProgram: null,
        simLocs: null,
        simPosLoc: -1,
        simParamLocs: new Map(),
        statePool: null,
      }
      // 🧬 WAVE 8237 · G5 — Materia Viva: si el artista declara
      // `mainState`, compila el pase de simulación (epílogo crudo → el
      // fragColor va tal cual al ping-pong RGBA16F). No fatal si falla.
      const spec = this.sources.get(p.shaderId)
      if (spec && hasMainState(spec.source)) {
        const sim = this.compileSimProgram(
          p.shaderId, spec, p.steps,
        )
        if (sim) {
          ent.simProgram = sim
          ent.simLocs = this.cacheSimLocs(sim)
          ent.simPosLoc = gl.getAttribLocation(sim, 'a_pos')
          ent.statePool = new FloatStatePool(gl)
        }
      }
      this.programs.set(p.programKey, ent)
      this.evict()
      this.onStatus({ shaderId: p.shaderId, ok: true, compileMs })
      if (this.pendingActivate?.programKey === p.programKey) {
        const pa = this.pendingActivate
        this.pendingActivate = null
        this.activate(pa.id, pa.fadeMs)
      }
    } else {
      const raw = fsLog.length > 0 ? fsLog : progLog || 'link failed'
      const mapped = remapShaderLog(raw, p.preambleLines, p.bodyLines)
      try {
        gl.deleteProgram(p.program)
      } catch { /* noop */ }
      this.onStatus({
        shaderId: p.shaderId,
        ok: false,
        log: mapped.log,
        line: mapped.line ?? undefined,
      })
    }
  }

  /** Sondeo de compilaciones paralelas — llamar una vez por frame. */
  probe(): void {
    const ext = this.khrCompile
    if (!ext || this.pending.size === 0) return
    for (const [id, p] of this.pending) {
      if (this.gl.getProgramParameter(p.program, ext.COMPLETION_STATUS_KHR)) {
        this.pending.delete(id)
        this.finalize(p)
      }
    }
  }

  private evict(): void {
    while (this.programs.size > GEN_CACHE_MAX) {
      let oldestId = ''
      let oldest = Infinity
      for (const [id, ent] of this.programs) {
        if (ent === this.active) continue
        if (ent.lastUsed < oldest) {
          oldest = ent.lastUsed
          oldestId = id
        }
      }
      if (oldestId === '') break
      this.deleteEntry(this.programs.get(oldestId)!)
      this.programs.delete(oldestId)
    }
  }

  // ── Activación / crossfade ─────────────────────────────────────────────

  /**
   * Conmuta al shader `id`. `'builtin'` o id desconocido → desactiva (el
   * caller vuelve a mostrar el path de vídeo/Modo A).
   */
  activate(id: string, fadeMs = 0): void {
    if (id === BUILTIN_SHADER_ID) {
      this.deactivate()
      return
    }
    // 🧬 WAVE 8233 · G1 — la caché va por programKey; shaderId se resuelve
    // vía su spec (fenotipo cargado).
    const spec = this.sources.get(id)
    const ent = spec ? this.programs.get(spec.programKey) : undefined
    if (!ent) {
      if (spec && this.pending.has(spec.programKey)) {
        this.pendingActivate = { id, programKey: spec.programKey, fadeMs }
        return
      }
      this.onStatus({ shaderId: id, ok: false, log: 'shader not loaded' })
      return
    }
    // 🧬 WAVE 8235 · G3 — fast-path §4.6: misma programKey → solo `expr`
    // cambió → swap de u_gene sin crossfade ni recompile.
    if (ent === this.active) {
      this.activeId = id
      ent.lastUsed = this.seq
      if (spec?.exprValues) this.geneValues.set(spec.exprValues)
      else this.geneValues.fill(0)
      return
    }
    this.capturePrev()
    this.active = ent
    this.activeId = id
    if (spec?.exprValues) this.geneValues.set(spec.exprValues)
    else this.geneValues.fill(0)
    ent.lastUsed = this.seq
    if (fadeMs > 0) {
      this.fadeT0 = performance.now()
      this.fadeDur = fadeMs
    } else {
      this.fadeT0 = -1
      this.fadeDur = 0
    }
  }

  deactivate(): void {
    this.active = null
    this.activeId = BUILTIN_SHADER_ID
    this.pendingActivate = null
    this.fadeT0 = -1
    this.fadeDur = 0
    // Limpia el canvas gen — bajo el overlay no debe quedar frame stale.
    const gl = this.gl
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
  }

  // ── Recursos GL ────────────────────────────────────────────────────────

  private buildResources(): void {
    const gl = this.gl
    this.vbo = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo)
    gl.bufferData(gl.ARRAY_BUFFER, FULLSCREEN_TRI, gl.STATIC_DRAW)

    this.dummyTex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, this.dummyTex)
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 255]),
    )

    // Programa blit (FBO→canvas, upscale lineal).
    const bvs = this.compileShader(gl.VERTEX_SHADER, BLIT_VERTEX_SRC)
    const bfs = this.compileShader(gl.FRAGMENT_SHADER, BLIT_FRAG_SRC)
    if (bvs.ok && bfs.ok) {
      const prog = gl.createProgram()!
      gl.attachShader(prog, bvs.shader)
      gl.attachShader(prog, bfs.shader)
      gl.linkProgram(prog)
      if (gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        this.blitProg = prog
        this.blitTexLoc = gl.getUniformLocation(prog, 'u_tex')
        this.blitPos = gl.getAttribLocation(prog, 'a_pos')
      }
      gl.deleteShader(bvs.shader)
      gl.deleteShader(bfs.shader)
    }

    // Programa stats fotosensibles (§4.6): media de luma + leaky-bucket
    // en un texel 1×1 ping-pong — el epílogo lo lee en el próximo frame.
    const svs = this.compileShader(gl.VERTEX_SHADER, BLIT_VERTEX_SRC)
    const sfs = this.compileShader(gl.FRAGMENT_SHADER, FLASH_STATS_FRAG_SRC)
    if (svs.ok && sfs.ok) {
      const prog = gl.createProgram()!
      gl.attachShader(prog, svs.shader)
      gl.attachShader(prog, sfs.shader)
      gl.linkProgram(prog)
      if (gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        this.statsProg = prog
        this.statsPos = gl.getAttribLocation(prog, 'a_pos')
        this.statsSceneLoc = gl.getUniformLocation(prog, 'u_scene')
        this.statsPrevLoc = gl.getUniformLocation(prog, 'u_statsPrev')
        this.statsDtLoc = gl.getUniformLocation(prog, 'u_dt')
        this.statsBudgetLoc = gl.getUniformLocation(prog, 'u_flashBudget')
        this.statsRateLoc = gl.getUniformLocation(prog, 'u_budgetRate')
      }
      gl.deleteShader(svs.shader)
      gl.deleteShader(sfs.shader)
    }

    // Texels de estado 1×1 (ping-pong): {meanLuma, budgetNorm}.
    const mkStats = () => {
      const tex = gl.createTexture()
      const fb = gl.createFramebuffer()
      if (!tex || !fb) return null
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.texImage2D(
        gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
        new Uint8Array([0, 255, 0, 255]), // presupuesto inicial completo
      )
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0,
      )
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      return { tex, fb }
    }
    const a = mkStats()
    const b = mkStats()
    this.statsTexA = a?.tex ?? null
    this.statsFboA = a?.fb ?? null
    this.statsTexB = b?.tex ?? null
    this.statsFboB = b?.fb ?? null
  }

  private ensureFbo(w: number, h: number): boolean {
    const gl = this.gl
    if (!this.fbo) {
      this.fbo = gl.createFramebuffer()
      this.fboTex = gl.createTexture()
      if (!this.fbo || !this.fboTex) return false
    }
    if (this.fboW === w && this.fboH === h) return true
    this.fboW = w
    this.fboH = h
    gl.bindTexture(gl.TEXTURE_2D, this.fboTex)
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null,
    )
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo)
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.fboTex, 0,
    )
    const ok =
      gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    return ok
  }

  private ensurePrevTex(w: number, h: number): void {
    const gl = this.gl
    if (!this.prevTex) this.prevTex = gl.createTexture()
    if (!this.prevTex || (this.prevW === w && this.prevH === h)) return
    this.prevW = w
    this.prevH = h
    gl.bindTexture(gl.TEXTURE_2D, this.prevTex)
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null,
    )
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  }

  /** Captura el framebuffer por defecto en prevTex (crossfade/limitador). */
  private capturePrev(): void {
    const gl = this.gl
    const w = this.canvas.width
    const h = this.canvas.height
    if (w <= 0 || h <= 0) return
    this.ensurePrevTex(w, h)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.bindTexture(gl.TEXTURE_2D, this.prevTex)
    gl.copyTexImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 0, 0, w, h, 0)
    this.prevValid = true
  }

  // ── Frame ──────────────────────────────────────────────────────────────

  /**
   * Render de un frame generativo al framebuffer por defecto del canvas.
   * `sm` es el smoother local (Telemetría E2 alimentada por el ring de
   * 256B); `uniforms` lleva masters + params de artista; `renderScale`
   * escala el FBO de escena (governor externo — en la ventana puede ser
   * fijo 1.0 o adaptativo propio).
   */
  render(
    sm: TelemetrySmoother,
    uniforms: ReadonlyMap<string, number>,
    renderScale: number,
    dtMs: number,
    nowMs: number,
  ): void {
    this.probe()
    const gl = this.gl
    const ent = this.active
    const w = this.canvas.width
    const h = this.canvas.height
    if (!ent || !this.blitProg || w <= 0 || h <= 0) return
    const scale = Math.min(1, Math.max(0.05, renderScale))
    const sw = Math.max(1, Math.round(w * scale))
    const sh = Math.max(1, Math.round(h * scale))
    if (!this.ensureFbo(sw, sh)) {
      this.onStatus({
        shaderId: this.activeId,
        ok: false,
        log: 'generative FBO incomplete — output stays black',
      })
      this.deactivate()
      return
    }
    this.seq++

    // 🌊 WAVE 8250 — governor de tiempo: leer AUDIO_LIVE del smoother y
    // acumular el reloj gobernado UNA vez por frame (compartido por el
    // pase de sim y la escena visual).
    const audioLive = (sm.flags & (1 << TEL_FLAG.AUDIO_LIVE)) !== 0
    // 🌊 WAVE 8257 — MASTER SPEED: el fader multiplica el target del
    // gobernador — autoridad absoluta sobre el reloj del gemelo HDMI
    // sin romper el suavizado exponencial (sin time-jumps).
    const masterSpeed = uniforms.get('u_speed') ?? 1.0
    this.timeScale +=
      ((audioLive ? 1.0 : 0.5) * masterSpeed - this.timeScale) *
      (1 - Math.exp(-dtMs / 160))
    // 🌊 WAVE 8259 — y el reloj musical del smoother del gemelo (se aplica
    // al beatTime del PRÓXIMO frame — el step ya corrió en el caller).
    sm.masterSpeed = masterSpeed
    this.shaderTimeSec += dtMs * 0.001 * this.timeScale
    const shaderTimeSec = this.shaderTimeSec

    // Rampa de crossfade temporal (0→1 sobre fadeDur).
    const blend =
      this.fadeDur > 0 && this.fadeT0 >= 0
        ? Math.min(1, (nowMs - this.fadeT0) / this.fadeDur)
        : 1
    if (this.fadeDur > 0 && blend >= 1) {
      this.fadeDur = 0
      this.fadeT0 = -1
    }

    // ── 🧬 WAVE 8237 · G5 — pase de SIMULACIÓN (Materia Viva) ────────
    // Ping-pong RGBA16F propio del programa — lineal, sin epílogo.
    let stateInitF = 0
    const pool = ent.statePool
    if (ent.simProgram && pool && pool.ensure(sw, sh)) {
      stateInitF = pool.needsInit ? 1 : 0
      const SL = ent.simLocs!
      gl.bindFramebuffer(gl.FRAMEBUFFER, pool.writeFramebuffer)
      gl.viewport(0, 0, sw, sh)
      gl.useProgram(ent.simProgram)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, pool.readTexture ?? this.dummyTex)
      gl.uniform1fv(SL.tel, sm.out)
      gl.uniform1i(SL.flags, sm.flags)
      gl.uniform4i(
        SL.enums, sm.schemaVersion, sm.predictionType, sm.huntState, sm.energyZone,
      )
      gl.uniform1f(SL.time, shaderTimeSec)
      gl.uniform1f(SL.dt, dtMs * 0.001)
      gl.uniform3f(SL.resolution, sw, sh, 1)
      gl.uniform1f(SL.beatTime, sm.beatTime)
      gl.uniform1f(SL.kickPulse, sm.kickPulse)
      gl.uniform1f(SL.snarePulse, sm.snarePulse)
      gl.uniform1f(SL.predictiveETA, sm.predictiveEtaSec)
      gl.uniform1f(SL.approach, sm.approach)
      gl.uniform1f(SL.impact, sm.impact)
      if (SL.gene) gl.uniform1fv(SL.gene, this.geneValues)
      gl.uniform1i(SL.state, 0)
      gl.uniform1f(SL.stateInit, stateInitF)
      for (const [name, value] of uniforms) {
        if (GEN_STD_UNIFORMS.has(name)) continue
        let loc = ent.simParamLocs.get(name)
        if (loc === undefined) {
          loc = gl.getUniformLocation(ent.simProgram, name)
          ent.simParamLocs.set(name, loc)
        }
        if (loc) gl.uniform1f(loc, value)
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo)
      gl.enableVertexAttribArray(ent.simPosLoc)
      gl.vertexAttribPointer(ent.simPosLoc, 2, gl.FLOAT, false, 0, 0)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      pool.swap()
      pool.needsInit = false
    }

    // ── Escena del artista → FBO escalado ────────────────────────────
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo)
    gl.viewport(0, 0, sw, sh)
    gl.useProgram(ent.program)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.prevTex ?? this.dummyTex)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(
      gl.TEXTURE_2D,
      (this.statsFlip ? this.statsTexA : this.statsTexB) ?? this.dummyTex,
    )
    // 🧬 G5 — u_state = estado float actualizado (o dummy si no hay sim).
    gl.activeTexture(gl.TEXTURE2)
    gl.bindTexture(
      gl.TEXTURE_2D,
      (pool && pool.ready ? pool.readTexture : this.dummyTex) ?? this.dummyTex,
    )

    const L = ent.locs
    gl.uniform1fv(L.tel, sm.out)
    gl.uniform1i(L.flags, sm.flags)
    gl.uniform4i(
      L.enums,
      sm.schemaVersion,
      sm.predictionType,
      sm.huntState,
      sm.energyZone,
    )
    gl.uniform1f(L.time, shaderTimeSec)
    gl.uniform1f(L.dt, dtMs * 0.001)
    gl.uniform3f(L.resolution, sw, sh, 1)
    gl.uniform1f(L.beatTime, sm.beatTime)
    gl.uniform1f(L.kickPulse, sm.kickPulse)
    gl.uniform1f(L.snarePulse, sm.snarePulse)
    gl.uniform1f(L.predictiveETA, sm.predictiveEtaSec)
    gl.uniform1f(L.approach, sm.approach)
    gl.uniform1f(L.impact, sm.impact)
    // 🧬 WAVE 8235 · G3 — genes `expr` del fenotipo activo (§4.2 v2).
    if (L.gene) gl.uniform1fv(L.gene, this.geneValues)
    gl.uniform1f(L.brightness, uniforms.get('u_brightness') ?? 1.0)
    gl.uniform1f(L.contrast, uniforms.get('u_contrast') ?? 1.0)
    gl.uniform1f(L.blackout, uniforms.get('u_blackout') ?? 0.0)
    gl.uniform1f(L.renderScale, scale)
    gl.uniform1i(L.prevFrame, 0)
    gl.uniform1i(L.flashState, 1)
    gl.uniform1i(L.state, 2)
    gl.uniform1f(L.stateInit, stateInitF)
    gl.uniform1f(L.hasPrev, this.prevValid ? 1 : 0)
    gl.uniform1f(L.blend, blend)
    gl.uniform1f(L.flashGuard, uniforms.get('u_flashGuard') ?? 1.0)
    gl.uniform1f(
      L.flashMaxDelta,
      uniforms.get('u_flashMaxDelta') ?? DEFAULT_FLASH_MAX_DELTA,
    )
    gl.uniform1f(L.flashBudget, uniforms.get('u_flashBudget') ?? FLASH_BUDGET)

    // Params de artista (@euclid param → theia:gen-uniform) — lazy locs.
    for (const [name, value] of uniforms) {
      if (GEN_STD_UNIFORMS.has(name)) continue
      let loc = ent.paramLocs.get(name)
      if (loc === undefined) {
        loc = gl.getUniformLocation(ent.program, name)
        ent.paramLocs.set(name, loc)
      }
      if (loc) gl.uniform1f(loc, value)
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo)
    gl.enableVertexAttribArray(ent.posLoc)
    gl.vertexAttribPointer(ent.posLoc, 2, gl.FLOAT, false, 0, 0)
    gl.drawArrays(gl.TRIANGLES, 0, 3)

    // ── Stats fotosensibles 1×1 (§4.6): el epílogo del PRÓXIMO frame
    //    leerá este texel {meanLuma, budgetNorm}. ─────────────────────
    const statsIn = this.statsFlip ? this.statsTexA : this.statsTexB
    const statsOutFbo = this.statsFlip ? this.statsFboB : this.statsFboA
    if (this.statsProg && statsIn && statsOutFbo) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, statsOutFbo)
      gl.viewport(0, 0, 1, 1)
      gl.useProgram(this.statsProg)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, this.fboTex)
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, statsIn)
      gl.uniform1i(this.statsSceneLoc, 0)
      gl.uniform1i(this.statsPrevLoc, 1)
      gl.uniform1f(this.statsDtLoc, dtMs * 0.001)
      gl.uniform1f(
        this.statsBudgetLoc,
        uniforms.get('u_flashBudget') ?? FLASH_BUDGET,
      )
      gl.uniform1f(
        this.statsRateLoc,
        uniforms.get('u_flashBudgetRate') ?? FLASH_BUDGET_RATE,
      )
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo)
      gl.enableVertexAttribArray(this.statsPos)
      gl.vertexAttribPointer(this.statsPos, 2, gl.FLOAT, false, 0, 0)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      this.statsFlip = !this.statsFlip
    }

    // ── Blit FBO→canvas (upscale lineal a resolución nativa) ─────────
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, w, h)
    gl.useProgram(this.blitProg)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.fboTex)
    gl.uniform1i(this.blitTexLoc, 0)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo)
    gl.enableVertexAttribArray(this.blitPos)
    gl.vertexAttribPointer(this.blitPos, 2, gl.FLOAT, false, 0, 0)
    gl.drawArrays(gl.TRIANGLES, 0, 3)

    // Prev-frame para el crossfade de activaciones — el canvas completo.
    this.capturePrev()
  }

  /** Libera todos los objetos GL (unmount / contexto descartado). */
  dispose(): void {
    const gl = this.gl
    for (const ent of this.programs.values()) {
      this.deleteEntry(ent)
    }
    for (const p of this.pending.values()) {
      try {
        gl.deleteProgram(p.program)
        gl.deleteShader(p.vs)
        gl.deleteShader(p.fs)
      } catch { /* noop */ }
    }
    this.programs.clear()
    this.pending.clear()
    for (const obj of [
      this.fbo,
      this.statsFboA,
      this.statsFboB,
    ]) {
      if (obj) try { gl.deleteFramebuffer(obj) } catch { /* noop */ }
    }
    for (const t of [
      this.fboTex,
      this.prevTex,
      this.statsTexA,
      this.statsTexB,
      this.dummyTex,
    ]) {
      if (t) try { gl.deleteTexture(t) } catch { /* noop */ }
    }
    for (const p of [this.blitProg, this.statsProg]) {
      if (p) try { gl.deleteProgram(p) } catch { /* noop */ }
    }
    if (this.vbo) try { gl.deleteBuffer(this.vbo) } catch { /* noop */ }
    this.active = null
    this.activeId = BUILTIN_SHADER_ID
  }
}
