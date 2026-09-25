/**
 * 🎬 WAVE 4860 — THETA WORKER (Web Worker, renderer-side)
 *
 * Esqueleto del worker de vídeo. Phase 1: cero decodificación, solo:
 *  - Recibe el SharedArrayBuffer del FrameContext en INIT.
 *  - Lee el tickId maestro vía Atomics @ 44Hz (sin IPC en hot-path).
 *  - Responde a heartbeat con latency.
 *  - Acepta (y guarda referencia a) un OffscreenCanvas para Phase 2.
 *  - Reporta drift / ticks observados a su orquestador.
 *
 * 🌊 WAVE 8207 — QUARANTINE LIFT + WEBGL PLUMBING:
 *  - Render path migrado de Canvas2D/getImageData (culpable del OILPAN OOM
 *    de WAVE-7569) a WebGL con `gl.readPixels` → escritura directa sobre la
 *    vista del SharedVideoFrameBuffer (zero-copy GPU→SAB).
 *  - Canvas GL interno propiedad del worker — el pipeline HDMI/SAB ya no
 *    depende de que la UI transfiera un canvas a tiempo.
 *  - Shader procedural "hello-world" (plasma anclado al reloj maestro) como
 *    standby: sin vídeo, el proyector cicla color en vez de negro muerto.
 *  - VideoFrame → textura GPU (`texImage2D`) conserva el path de vídeo.
 *  - El OffscreenCanvas transferido desde la UI (init o `theia:attach-canvas`)
 *    se usa como espejo 2D del framebuffer GL para el viewport in-app.
 *
 * NOTA — entorno: este archivo se carga vía
 *   `new Worker(new URL('./theta.worker.ts', import.meta.url), { type: 'classic' })`
 * desde el bundle del renderer (Vite emite el chunk como IIFE — compatible con
 * `file://` en builds empaquetadas).
 */

import { FrameContextReader, type FrameContextSnapshot } from './FrameContextRing'
import {
  makeThetaMessage,
  type ThetaAssetStatePayload,
  type ThetaAttachCanvasPayload,
  type ThetaErrorPayload,
  type ThetaForceStatePayload,
  type ThetaHeartbeatAckPayload,
  type ThetaHeartbeatPayload,
  type ThetaInitPayload,
  type ThetaLoadStreamPayload,
  type ThetaMessage,
  type ThetaSeekAckPayload,
  type ThetaSeekPayload,
  type ThetaSetUniformPayload,
  type ThetaStateReportPayload,
  type ThetaVideoPortPayload,
  type ThetaVideoStatusPayload,
} from './protocol'
// 🎬 WAVE 4864: Phase 4 — Asset State Machine + Crossfade Unit
import { AssetStateMachine, type AssetStateId } from './AssetStateMachine'
import { CrossfadeUnit, type CrossfadeCurve } from './CrossfadeUnit'
// � WAVE 8215 — Glass Bridge: transferable frame writers (ping-pong pool)
import {
  createVideoFrameBuffer,
  isAckMessage,
  THEIA_VIDEO_FRAME_MSG,
  VideoFrameWriter,
} from './SharedVideoFrameBuffer'
// 🎬 WAVE 4867: Phase 6 — Thumb SAB writer (64×64 → AetherCanvasManager twin-output)
import { ThumbFrameWriter } from './TheiaThumbBuffer'

// ─────────────────────────────────────────────────────────────────────────
// 🛡️ WAVE 7569: OILPAN GUARD — Safety limits to prevent OOM from getImageData
// ─────────────────────────────────────────────────────────────────────────
const MAX_CANVAS_WIDTH = 1920
const MAX_CANVAS_HEIGHT = 1080

// ─────────────────────────────────────────────────────────────────────────
// 🌊 WAVE 8207 — WEBGL PLUMBING
// Fullscreen-triangle procedural renderer. GLSL ES 1.00 — compiles under both
// WebGL1 and WebGL2 contexts. Plasma phase is derived from the MASTER CLOCK
// timestamp, wrapped to a 16s cycle so `mediump float` keeps full precision.
// ─────────────────────────────────────────────────────────────────────────

type GLContext = WebGLRenderingContext | WebGL2RenderingContext

const PLASMA_PERIOD_MS = 16000
const TAU = 6.283185307179586

const VERT_SRC = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`

const FRAG_SRC = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_videoTex;
uniform sampler2D u_prevTex;
uniform float u_hasVideo;
uniform float u_hasPrev;
uniform float u_blend;
uniform float u_phase;
// 🌊 WAVE 8211 — master controls (theia:set-uniform bridge)
uniform float u_brightness;
uniform float u_contrast;
uniform float u_blackout;

void main() {
  // Procedural standby — slow RGB plasma driven by the master clock phase.
  vec3 plasma = 0.5 + 0.5 * cos(u_phase + v_uv.xyx * 4.0 + vec3(0.0, 2.094, 4.188));
  vec3 current = mix(plasma, texture2D(u_videoTex, v_uv).rgb, step(0.5, u_hasVideo));
  vec3 prev = texture2D(u_prevTex, v_uv).rgb;
  vec3 col = mix(current, prev, clamp((1.0 - u_blend) * u_hasPrev, 0.0, 1.0));
  // Master epilogue — applies to plasma AND video alike.
  col = (col - 0.5) * u_contrast + 0.5;
  col *= u_brightness;
  col *= 1.0 - u_blackout;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`

// ─────────────────────────────────────────────────────────────────────────
// Worker-local state
// ─────────────────────────────────────────────────────────────────────────

interface WorkerState {
  isRunning: boolean
  startTime: number
  reader: FrameContextReader | null
  pollHandle: number | null
  pollIntervalMs: number
  lastTickId: number
  lastGeneration: number
  ticksObserved: number
  errors: number
  reportHandle: number | null
  // Phase 2: Video pipeline state
  videoState: 'idle' | 'streaming' | 'ended' | 'error'
  frameReader: ReadableStreamDefaultReader<VideoFrame> | null
  framePumpRunning: boolean
  currentFrame: VideoFrame | null
  framesDecoded: number
  framesDropped: number
  // 🌊 WAVE 8207 — GL state (worker-owned internal canvas)
  glCanvas: OffscreenCanvas | null
  gl: GLContext | null
  glProgram: WebGLProgram | null
  glVbo: WebGLBuffer | null
  glAttribPos: number
  glUniformVideoTex: WebGLUniformLocation | null
  glUniformPrevTex: WebGLUniformLocation | null
  glUniformHasVideo: WebGLUniformLocation | null
  glUniformHasPrev: WebGLUniformLocation | null
  glUniformBlend: WebGLUniformLocation | null
  glUniformPhase: WebGLUniformLocation | null
  glUniformBrightness: WebGLUniformLocation | null
  glUniformContrast: WebGLUniformLocation | null
  glUniformBlackout: WebGLUniformLocation | null
  /** 🌊 WAVE 8211 — master uniform values (theia:set-uniform). */
  uniforms: Map<string, number>
  videoTex: WebGLTexture | null
  prevTex: WebGLTexture | null
  prevTexW: number
  prevTexH: number
  dummyTex: WebGLTexture | null
  /** True desde el primer upload VideoFrame→textura (hold-frame semantics). */
  hasVideoTex: boolean
  glContextLost: boolean
  // 🌊 WAVE 8207 — UI preview mirror (optional, attaches anytime)
  previewCanvas: OffscreenCanvas | null
  previewCtx: OffscreenCanvasRenderingContext2D | null
  // Phase 2: 64x64 downscaler
  thumbCanvas: OffscreenCanvas | null
  thumbCtx: OffscreenCanvasRenderingContext2D | null
  // � WAVE 8215 — Glass Bridge video link (worker ↔ TheiaOutputView).
  // El puerto llega transferido vía `theia:video-port`; los frames se
  // publican por ownership transfer sobre un pool de doble buffer.
  videoPort: MessagePort | null
  /** Writers cuyo buffer está EN MANO (disponibles para el próximo tick). */
  videoPool: VideoFrameWriter[]
  /** Lookup buffer→writer para devoluciones ack sin re-alloc de vistas. */
  videoWritersByBuffer: Map<ArrayBuffer, VideoFrameWriter>
  /** Secuencia monotónica de frames publicados (espeja meta[META_SEQ]). */
  videoFrameSeq: number
  /** Ticks sin buffer disponible (consumidor lento → drop). Diagnóstico. */
  framesNoBuffer: number
  // 🎬 WAVE 4867 — Phase 6: SAB writer del thumb buffer (64×64) para AetherCanvas
  thumbWriter: ThumbFrameWriter | null
  // 🎬 WAVE 4864 — Phase 4: Asset State Machine + Crossfade
  fsm: AssetStateMachine
  crossfade: CrossfadeUnit
  /** True si hay snapshot válida (al menos un frame se ha capturado). */
  prevSnapshotValid: boolean
  assetStateReportHandle: number | null
}

const state: WorkerState = {
  isRunning: false,
  startTime: 0,
  reader: null,
  pollHandle: null,
  pollIntervalMs: 22,
  lastTickId: -1,
  lastGeneration: 0,
  ticksObserved: 0,
  errors: 0,
  reportHandle: null,
  // Phase 2
  videoState: 'idle',
  frameReader: null,
  framePumpRunning: false,
  currentFrame: null,
  framesDecoded: 0,
  framesDropped: 0,
  // 🌊 WAVE 8207 — GL state
  glCanvas: null,
  gl: null,
  glProgram: null,
  glVbo: null,
  glAttribPos: -1,
  glUniformVideoTex: null,
  glUniformPrevTex: null,
  glUniformHasVideo: null,
  glUniformHasPrev: null,
  glUniformBlend: null,
  glUniformPhase: null,
  glUniformBrightness: null,
  glUniformContrast: null,
  glUniformBlackout: null,
  uniforms: new Map<string, number>([
    ['u_brightness', 1.0],
    ['u_contrast', 1.0],
    ['u_blackout', 0.0],
    ['u_speed', 1.0],
  ]),
  videoTex: null,
  prevTex: null,
  prevTexW: 0,
  prevTexH: 0,
  dummyTex: null,
  hasVideoTex: false,
  glContextLost: false,
  previewCanvas: null,
  previewCtx: null,
  thumbCanvas: null,
  thumbCtx: null,
  // � WAVE 8215 / 🎬 WAVE 4867
  videoPort: null,
  videoPool: [],
  videoWritersByBuffer: new Map(),
  videoFrameSeq: 0,
  framesNoBuffer: 0,
  thumbWriter: null,
  fsm: new AssetStateMachine(),
  crossfade: new CrossfadeUnit(),
  prevSnapshotValid: false,
  assetStateReportHandle: null,
}

// ─────────────────────────────────────────────────────────────────────────
// Outbound helper
// ─────────────────────────────────────────────────────────────────────────

function send<T>(type: Parameters<typeof makeThetaMessage>[0], payload: T): void {
  ;(self as unknown as Worker).postMessage(makeThetaMessage(type, payload))
}

function sendError(message: string, fatal: boolean, stack?: string): void {
  state.errors++
  const payload: ThetaErrorPayload = { message, fatal, stack }
  send('theia:error', payload)
}

// ─────────────────────────────────────────────────────────────────────────
// Frame context poll loop — 44Hz lock-free read of the master tickId
// ─────────────────────────────────────────────────────────────────────────

function pollFrameContext(): void {
  const reader = state.reader
  if (!reader) return
  const snap = reader.readIfChanged()
  if (snap === null) return // nothing new this tick
  onFrameContextTick(snap)
}

function onFrameContextTick(snap: FrameContextSnapshot): void {
  // Drift detection: tickId should advance by 1 per generation under healthy
  // conditions. Larger gaps mean main-thread stalled or worker poll lagged.
  if (state.lastTickId >= 0) {
    const gap = snap.tickId - state.lastTickId
    if (gap > 2) {
      // eslint-disable-next-line no-console
      console.warn(`[THETA ⚠️] tick gap=${gap} (lastTickId=${state.lastTickId} → ${snap.tickId})`)
    }
  }
  state.lastTickId = snap.tickId
  state.lastGeneration = snap.generation
  state.ticksObserved++

  // Phase 2: On each tick, render the latest valid frame to OffscreenCanvas
  renderCurrentFrame(snap.timestamp)
}

function startPollLoop(): void {
  if (state.pollHandle !== null) return
  state.pollHandle = (self as unknown as Window).setInterval(
    pollFrameContext,
    state.pollIntervalMs,
  ) as unknown as number
}

function stopPollLoop(): void {
  if (state.pollHandle !== null) {
    ;(self as unknown as Window).clearInterval(state.pollHandle as unknown as number)
    state.pollHandle = null
  }
}

// ─────────────────────────────────────────────────────────────────────────
// State reporting loop — orchestrator-facing telemetry
// ─────────────────────────────────────────────────────────────────────────

const STATE_REPORT_INTERVAL_MS = 1000

function startStateReports(): void {
  if (state.reportHandle !== null) return
  state.reportHandle = (self as unknown as Window).setInterval(() => {
    const payload: ThetaStateReportPayload = {
      lastTickId: state.lastTickId,
      lastGeneration: state.lastGeneration,
      ticksObserved: state.ticksObserved,
      errors: state.errors,
      uptimeMs: Date.now() - state.startTime,
    }
    send('theia:state-report', payload)
    // Reset ticksObserved so each report is per-window.
    state.ticksObserved = 0
  }, STATE_REPORT_INTERVAL_MS) as unknown as number
}

function stopStateReports(): void {
  if (state.reportHandle !== null) {
    ;(self as unknown as Window).clearInterval(state.reportHandle as unknown as number)
    state.reportHandle = null
  }
}

// ─────────────────────────────────────────────────────────────────────────
// 🌊 WAVE 8207 — WebGL plumbing: context, shaders, textures
// ─────────────────────────────────────────────────────────────────────────

function compileShader(gl: GLContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type)
  if (!sh) return null
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh) ?? 'unknown'
    sendError(`theta shader compile failed: ${log}`, false)
    gl.deleteShader(sh)
    return null
  }
  return sh
}

function makeTexture(gl: GLContext): WebGLTexture | null {
  const tex = gl.createTexture()
  if (!tex) return null
  gl.bindTexture(gl.TEXTURE_2D, tex)
  // NPOT-safe params (WebGL1 compatible): clamp + linear, no mipmaps.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  return tex
}

/**
 * (Re)builds all GL objects on the current context. Called on init and on
 * `webglcontextrestored` — all GPU objects die with the context.
 */
function buildGLResources(): boolean {
  const gl = state.gl
  if (!gl) return false

  const vs = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC)
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC)
  if (!vs || !fs) return false

  const prog = gl.createProgram()
  if (!prog) return false
  gl.attachShader(prog, vs)
  gl.attachShader(prog, fs)
  gl.linkProgram(prog)
  gl.deleteShader(vs)
  gl.deleteShader(fs)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog) ?? 'unknown'
    sendError(`theta shader link failed: ${log}`, false)
    gl.deleteProgram(prog)
    return false
  }
  state.glProgram = prog

  // Fullscreen triangle — single VBO, 3 verts × vec2.
  state.glVbo = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, state.glVbo)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)

  state.glAttribPos = gl.getAttribLocation(prog, 'a_pos')
  state.glUniformVideoTex = gl.getUniformLocation(prog, 'u_videoTex')
  state.glUniformPrevTex = gl.getUniformLocation(prog, 'u_prevTex')
  state.glUniformHasVideo = gl.getUniformLocation(prog, 'u_hasVideo')
  state.glUniformHasPrev = gl.getUniformLocation(prog, 'u_hasPrev')
  state.glUniformBlend = gl.getUniformLocation(prog, 'u_blend')
  state.glUniformPhase = gl.getUniformLocation(prog, 'u_phase')
  state.glUniformBrightness = gl.getUniformLocation(prog, 'u_brightness')
  state.glUniformContrast = gl.getUniformLocation(prog, 'u_contrast')
  state.glUniformBlackout = gl.getUniformLocation(prog, 'u_blackout')

  // VideoFrame upload target + crossfade snapshot texture + 1×1 black dummy.
  state.videoTex = makeTexture(gl)
  state.prevTex = makeTexture(gl)
  state.prevTexW = 0
  state.prevTexH = 0
  state.dummyTex = makeTexture(gl)
  if (state.dummyTex) {
    gl.bindTexture(gl.TEXTURE_2D, state.dummyTex)
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0,
      gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]),
    )
  }

  // VideoFrame uploads arrive top-down; FLIP_Y keeps GL-space orientation sane.
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1)
  gl.disable(gl.DEPTH_TEST)
  gl.disable(gl.BLEND)
  return true
}

function teardownGL(): void {
  const gl = state.gl
  if (gl) {
    try {
      if (state.videoTex) gl.deleteTexture(state.videoTex)
      if (state.prevTex) gl.deleteTexture(state.prevTex)
      if (state.dummyTex) gl.deleteTexture(state.dummyTex)
      if (state.glVbo) gl.deleteBuffer(state.glVbo)
      if (state.glProgram) gl.deleteProgram(state.glProgram)
    } catch { /* context may already be lost */ }
  }
  state.gl = null
  state.glCanvas = null
  state.glProgram = null
  state.glVbo = null
  state.videoTex = null
  state.prevTex = null
  state.prevTexW = 0
  state.prevTexH = 0
  state.dummyTex = null
  state.hasVideoTex = false
  state.glContextLost = false
}

function initGL(): boolean {
  const canvas = new OffscreenCanvas(MAX_CANVAS_WIDTH, MAX_CANVAS_HEIGHT)
  const attrs: WebGLContextAttributes = {
    // Required: the GL canvas is blitted into the 2D thumb/preview mirrors
    // and sampled by copyTexImage2D outside the immediate draw task.
    preserveDrawingBuffer: true,
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false, // readPixels → straight RGBA8 into the SAB
    powerPreference: 'high-performance',
  }
  const gl =
    (canvas.getContext('webgl2', attrs) as WebGL2RenderingContext | null) ??
    (canvas.getContext('webgl', attrs) as WebGLRenderingContext | null)

  if (!gl) {
    sendError('WebGL unavailable in theta worker — no video output this session', false)
    return false
  }

  canvas.addEventListener('webglcontextlost', (ev) => {
    ev.preventDefault()
    state.glContextLost = true
    sendError('WebGL context lost — waiting for restore', false)
  })
  canvas.addEventListener('webglcontextrestored', () => {
    state.glContextLost = false
    if (buildGLResources()) {
      // eslint-disable-next-line no-console
      console.log('[THETA] WebGL context restored')
    } else {
      sendError('WebGL context restore failed to rebuild resources', false)
    }
  })

  state.glCanvas = canvas
  state.gl = gl
  if (!buildGLResources()) return false
  return true
}

/**
 * 🎬 WAVE 8207 — UI preview mirror: the transferred canvas (init-time or
 * `theia:attach-canvas`) receives a 2D blit of the GL framebuffer per tick.
 */
function attachPreviewCanvas(canvas: OffscreenCanvas): void {
  state.previewCanvas = canvas
  state.previewCtx = canvas.getContext('2d')
  if (!state.previewCtx) {
    sendError('preview canvas 2d context unavailable', false)
  }
}

// ─────────────────────────────────────────────────────────────────────────
// 🌊 WAVE 8215 — GLASS BRIDGE VIDEO LINK (producer side)
//
// El extremo producer del `MessageChannelMain` (brokereado por
// TheiaWindowManager) llega transferido como `theia:video-port`. El worker
// mantiene un pool de DOBLE BUFFER transferible (~8.3MB c/u):
//
//   tick ─► pop writer ─► readPixels ─► commit ─► postMessage(frame,[buf])
//   port ◄─ ack:{seq,buffer} ── el MISMO buffer vuelve al pool
//
// CERTIFICACIÓN ZERO-ALLOC: `new ArrayBuffer` solo se instancia en
// `topUpVideoPool()` — attach inicial o re-link tras unlink (lifecycle,
// acotado a POOL_SIZE). En el hot path JAMÁS se aloja: si el consumidor va
// lento y el pool se vacía, el frame se DESCARTA y se espera el retorno.
// ─────────────────────────────────────────────────────────────────────────

const VIDEO_POOL_SIZE = 2

function attachVideoPort(port: MessagePort): void {
  detachVideoLink()
  state.videoPort = port
  port.onmessage = (ev: MessageEvent) => {
    const data = ev.data
    if (isAckMessage(data)) returnVideoBuffer(data.buffer)
  }
  port.start()
  topUpVideoPool()
  // eslint-disable-next-line no-console
  console.log('[THETA] 🌉 video Glass-Bridge attached (double-buffer pool)')
}

function detachVideoLink(): void {
  if (state.videoPort) {
    try { state.videoPort.close() } catch { /* noop */ }
    state.videoPort = null
  }
  // Los buffers en vuelo sobre el canal muerto nunca volverán por ack:
  // purgar sus writers del mapa (los que siguen en pool se conservan).
  state.videoWritersByBuffer.clear()
  for (const w of state.videoPool) state.videoWritersByBuffer.set(w.transferable, w)
}

/**
 * Rellena el pool hasta POOL_SIZE. ÚNICO lugar donde se instancian buffers
 * de frame — attach/re-link únicamente (bounded, fuera del hot path).
 */
function topUpVideoPool(): void {
  while (state.videoPool.length < VIDEO_POOL_SIZE) {
    const writer = new VideoFrameWriter(createVideoFrameBuffer())
    state.videoPool.push(writer)
    state.videoWritersByBuffer.set(writer.transferable, writer)
  }
}

/** ackFrame entrante: el buffer transferido de vuelta re-entra al pool. */
function returnVideoBuffer(buffer: ArrayBuffer): void {
  const writer = state.videoWritersByBuffer.get(buffer)
  if (writer) {
    state.videoPool.push(writer)
  }
  // Buffer desconocido (canal viejo / ajeno) → no reclamar: lo recoge el GC.
}

// ─────────────────────────────────────────────────────────────────────────
// Phase 2: Video stream pipeline — frame pump + SAB-synced rendering
// ─────────────────────────────────────────────────────────────────────────

/**
 * Render one frame to the internal GL canvas and publish it.
 * Called once per SAB tick (~44Hz). Hold-frame semantics: when no new
 * VideoFrame exists, the video texture keeps its last upload.
 *
 * 🌊 WAVE 8207 — the render content is now:
 *   video streaming → VideoFrame texture (texImage2D upload)
 *   idle            → procedural plasma anchored to the master clock phase
 *   crossfade       → mix(prevTex, current, blend) in the fragment shader
 *
 * Publishing: `gl.readPixels` writes rows directly into the inactive SAB
 * slot (zero-copy GPU→shared-memory). Rows land BOTTOM-UP; the output
 * window flips at blit time on the GPU.
 */
function renderCurrentFrame(timestampMs: number): void {
  const gl = state.gl
  const canvas = state.glCanvas
  const frame = state.currentFrame
  if (!gl || !canvas || !state.glProgram || state.glContextLost) {
    if (frame) {
      // No GL surface — still close to release GPU memory.
      frame.close()
      state.currentFrame = null
    }
    return
  }

  // Crossfade step (only meaningful if a crossfade is in progress) —
  // we step it BEFORE drawing so we know the alphas for THIS tick.
  const xfStep = state.crossfade.step()

  if (frame) {
    // 🛡️ WAVE 7569: OILPAN GUARD — Clamp render dimensions to MAX 1920×1080.
    const targetW = Math.min(frame.displayWidth, MAX_CANVAS_WIDTH)
    const targetH = Math.min(frame.displayHeight, MAX_CANVAS_HEIGHT)
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW
      canvas.height = targetH
    }

    // VideoFrame → GPU texture. texImage2D accepts VideoFrame as TexImageSource
    // and handles the YUV→RGB conversion on-GPU (zero CPU decode).
    gl.bindTexture(gl.TEXTURE_2D, state.videoTex)
    try {
      gl.texImage2D(
        gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE,
        frame as unknown as TexImageSource,
      )
      state.hasVideoTex = true
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      sendError(`videoTex upload failed: ${msg}`, false)
    }

    frame.close()
    state.currentFrame = null
    state.framesDecoded++
  }

  // ── Draw fullscreen triangle ──────────────────────────────────────────
  const w = canvas.width
  const h = canvas.height
  gl.viewport(0, 0, w, h)
  gl.useProgram(state.glProgram)

  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, state.videoTex ?? state.dummyTex)
  gl.activeTexture(gl.TEXTURE1)
  gl.bindTexture(gl.TEXTURE_2D, state.prevTex ?? state.dummyTex)

  gl.uniform1i(state.glUniformVideoTex, 0)
  gl.uniform1i(state.glUniformPrevTex, 1)
  gl.uniform1f(state.glUniformHasVideo, state.hasVideoTex ? 1 : 0)
  gl.uniform1f(state.glUniformHasPrev, state.prevSnapshotValid ? 1 : 0)
  gl.uniform1f(state.glUniformBlend, xfStep.alphaSecondary)
  gl.uniform1f(state.glUniformPhase, ((timestampMs % PLASMA_PERIOD_MS) / PLASMA_PERIOD_MS) * TAU)
  // 🌊 WAVE 8211 — masters (fall back to neutral defaults if unset)
  gl.uniform1f(state.glUniformBrightness, state.uniforms.get('u_brightness') ?? 1.0)
  gl.uniform1f(state.glUniformContrast, state.uniforms.get('u_contrast') ?? 1.0)
  gl.uniform1f(state.glUniformBlackout, state.uniforms.get('u_blackout') ?? 0.0)

  gl.bindBuffer(gl.ARRAY_BUFFER, state.glVbo)
  gl.enableVertexAttribArray(state.glAttribPos)
  gl.vertexAttribPointer(state.glAttribPos, 2, gl.FLOAT, false, 0, 0)
  gl.drawArrays(gl.TRIANGLES, 0, 3)

  if (xfStep.finished) {
    // Promote: from now on, prev snapshot stops being relevant.
    state.prevSnapshotValid = false
  }

  // ── UI preview mirror (optional) — 2D blit of the GL framebuffer ─────
  if (state.previewCtx && state.previewCanvas) {
    const pw = state.previewCanvas.width
    const ph = state.previewCanvas.height
    if (pw > 0 && ph > 0) {
      state.previewCtx.drawImage(canvas, 0, 0, pw, ph)
    }
  }

  // ── 64×64 thumb for AetherCanvas twin-output (top-down, tiny alloc) ──
  if (state.thumbCtx) {
    state.thumbCtx.drawImage(canvas, 0, 0, 64, 64)
    const thumb = state.thumbCtx.getImageData(0, 0, 64, 64)
    if (state.thumbWriter) {
      state.thumbWriter.publish(thumb.data)
    }
  }

  // ── Publish al Glass Bridge — readPixels directo a un buffer pooled,
  //    luego ownership transfer a la output window (zero-copy Mojo). ────
  const port = state.videoPort
  if (port) {
    const writer = state.videoPool.pop()
    if (!writer) {
      // Consumidor lento (acks pendientes) → frame drop intencional.
      // ZERO-ALLOC: nunca `new ArrayBuffer` aquí — se espera el retorno.
      state.framesNoBuffer++
    } else {
      const dst = writer.beginWrite(w, h)
      if (!dst) {
        state.videoPool.push(writer)
      } else {
        try {
          gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, dst)
          const seq = (state.videoFrameSeq + 1) | 0
          state.videoFrameSeq = seq
          writer.commit(w, h, state.lastTickId, seq)
          const msg = { type: THEIA_VIDEO_FRAME_MSG, seq, buffer: writer.transferable }
          port.postMessage(msg, [writer.transferable])
        } catch (err) {
          // readPixels o el transfer fallaron → el buffer sigue siendo
          // nuestro (si postMessage lanza, no hay detach): vuelve al pool.
          state.videoPool.push(writer)
          const msg = err instanceof Error ? err.message : String(err)
          sendError(`readPixels→transfer failed: ${msg}`, false)
        }
      }
    }
  }
}

/**
 * 🎬 WAVE 4864 — Phase 4: Captura el contenido actual del framebuffer GL como
 * textura "primaria" antes de iniciar un crossfade. Llamado por
 * `handleForceState` / `handleSeek`.
 *
 * 🌊 WAVE 8207: `copyTexImage2D` copia framebuffer→textura on-GPU (sin
 * readback CPU). La textura `prevTex` se muestrea en el fragment shader con
 * peso `(1 - u_blend) * u_hasPrev` mientras corre el crossfade.
 */
function captureCurrentSnapshot(): void {
  const gl = state.gl
  const canvas = state.glCanvas
  if (!gl || !canvas || !state.prevTex || state.glContextLost) return
  const w = canvas.width
  const h = canvas.height
  if (w <= 0 || h <= 0) return

  // (Re)allocate the snapshot texture if the framebuffer size changed.
  if (state.prevTexW !== w || state.prevTexH !== h) {
    gl.bindTexture(gl.TEXTURE_2D, state.prevTex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    state.prevTexW = w
    state.prevTexH = h
  }

  gl.bindTexture(gl.TEXTURE_2D, state.prevTex)
  gl.copyTexImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 0, 0, w, h, 0)
  state.prevSnapshotValid = true
}

/**
 * 🎬 WAVE 4864 — Phase 4: Recibe `theia:force-state` desde el orchestrator.
 * Solicita la transición a la FSM y, si es aceptada, captura snapshot del
 * canvas y arranca el CrossfadeUnit.
 */
function handleForceState(payload: ThetaForceStatePayload): void {
  if (!payload || typeof payload.state !== 'string') {
    sendError('force-state payload missing state', false)
    return
  }
  const target = payload.state as AssetStateId
  // From IDLE → AMBIENT we boot. Other transitions go via transition().
  let result
  if (state.fsm.currentState === 'idle' && target === 'ambient') {
    result = state.fsm.bootToAmbient()
  } else {
    result = state.fsm.transition(target, { manual: !!payload.manual })
  }

  if (!result.accepted) {
    // Soft — no error, the orchestrator can retry. Notify state regardless.
    sendAssetState()
    return
  }

  if (result.needsCrossfade) {
    // Snapshot the current canvas BEFORE we change anything.
    captureCurrentSnapshot()
    state.crossfade.start({
      totalTicks: payload.totalTicks,
      curve: (payload.curve as CrossfadeCurve | undefined) ?? 'easeInOut',
      waitAnchor: !!payload.waitAnchor,
    })
  } else {
    // Hard cut (e.g. boot to ambient) — ensure no leftover crossfade.
    state.crossfade.abort()
    state.prevSnapshotValid = false
  }

  sendAssetState()
}

/**
 * 🎬 WAVE 4903 — Phase 7: Cognitive Seek handler.
 *
 * El orchestrator ya hizo `videoElement.currentTime = startMs/1000` y, si el
 * `clipId` cambió, recargó el .mp4 vía `loadVideo()`. Cuando este mensaje
 * llega al worker, el frame pump ya está siendo reabastecido con frames
 * de la nueva posición temporal.
 *
 * Responsabilidad del worker:
 *   1. Capturar snapshot del último frame visible (lo que el espectador
 *      "ve" justo antes del salto cognitivo).
 *   2. Iniciar el `CrossfadeUnit` con la duración recibida en `crossfadeMs`.
 *      `renderCurrentFrame` (44Hz) blendea el snapshot vs los nuevos frames.
 *   3. Emitir `theia:seek-ack` con la latencia y el conteo de ticks.
 */
function handleSeek(payload: ThetaSeekPayload): void {
  const recvAt = Date.now()
  const latency = Math.max(0, recvAt - payload.emittedAt)

  // Capturar el frame actual ANTES de cualquier cambio (será el `prev` del fade).
  captureCurrentSnapshot()
  const snapshotOk = state.prevSnapshotValid

  // Traducir crossfadeMs → ticks. pollIntervalMs ~ 22ms = 1 tick.
  // Mínimo 1 tick (corte casi duro), máximo 200 ticks (~4.4s) por seguridad.
  const ms = Number.isFinite(payload.crossfadeMs) ? Math.max(0, payload.crossfadeMs) : 500
  const totalTicks = Math.min(200, Math.max(1, Math.round(ms / Math.max(1, state.pollIntervalMs))))

  // Curva acorde a la urgencia: cortes duros = lineal; transiciones suaves = easeInOut.
  const curve: CrossfadeCurve = totalTicks <= 4 ? 'linear' : 'easeInOut'

  if (snapshotOk) {
    state.crossfade.start({ totalTicks, curve, waitAnchor: false })
  } else {
    // Sin snapshot válido (primer cue del show, canvas vacío) → corte duro.
    state.crossfade.abort()
    state.prevSnapshotValid = false
  }

  // Si el átomo destino es vacío => blackout: forzar FSM a idle.
  if (!payload.atomId) {
    state.fsm.reset()
  }

  const ack: ThetaSeekAckPayload = {
    atomId: payload.atomId,
    latencyMs: latency,
    snapshotOk,
    crossfadeTicks: snapshotOk ? totalTicks : 0,
  }
  send('theia:seek-ack', ack)
}

function sendAssetState(): void {
  const xf = state.crossfade
  const payload: ThetaAssetStatePayload = {
    state: state.fsm.currentState,
    pendingState: xf.isDone() ? null : state.fsm.currentState,
    crossfadeProgress: xf.progress(),
    waitingAnchor: xf.isWaitingAnchor(),
  }
  send('theia:asset-state', payload)
}

/**
 * Send a video status report to the orchestrator.
 */
function sendVideoStatus(): void {
  const payload: ThetaVideoStatusPayload = {
    state: state.videoState,
    framesDecoded: state.framesDecoded,
    framesDropped: state.framesDropped,
  }
  send('theia:video-status', payload)
}

/**
 * Handle 'theia:load-stream': receive the transferred ReadableStream<VideoFrame>
 * and start the async frame pump that continuously reads frames.
 */
function handleLoadStream(payload: ThetaLoadStreamPayload): void {
  // Tear down any existing stream first
  teardownVideoStream()

  if (!payload.stream) {
    sendError('load-stream payload missing stream', false)
    return
  }

  state.frameReader = payload.stream.getReader()
  state.videoState = 'streaming'
  state.framesDecoded = 0
  state.framesDropped = 0
  state.framePumpRunning = true

  // 🎬 WAVE 4864 — boot the FSM to AMBIENT on first stream load.
  if (state.fsm.currentState === 'idle') {
    state.fsm.bootToAmbient()
    sendAssetState()
  }

  sendVideoStatus()

  // Start the async frame pump
  void runFramePump()
}

/**
 * Async pump that continuously reads VideoFrame objects from the
 * ReadableStream. Each new frame replaces the previous one (latest-wins).
 * Old unrendered frames are closed immediately to avoid GPU memory leaks.
 */
async function runFramePump(): Promise<void> {
  const reader = state.frameReader
  if (!reader) return

  try {
    while (state.framePumpRunning) {
      const { value, done } = await reader.read()
      if (done) {
        state.videoState = 'ended'
        sendVideoStatus()
        break
      }
      // Latest-frame strategy: if a previous frame wasn't consumed by the
      // render tick yet, close it (drop) and replace with the new one.
      if (state.currentFrame) {
        state.currentFrame.close()
        state.framesDropped++
      }
      state.currentFrame = value
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // Stream cancelled (e.g. teardown) is not a fatal error
    if (!msg.includes('cancel')) {
      state.videoState = 'error'
      sendError(`Frame pump error: ${msg}`, false)
      sendVideoStatus()
    }
  }
}

/**
 * Tear down the video stream: cancel the reader, close any pending frame,
 * reset state to idle.
 */
function teardownVideoStream(): void {
  state.framePumpRunning = false
  if (state.frameReader) {
    try {
      state.frameReader.cancel().catch(() => {})
    } catch { /* noop */ }
    state.frameReader = null
  }
  if (state.currentFrame) {
    try { state.currentFrame.close() } catch { /* noop */ }
    state.currentFrame = null
  }
  state.videoState = 'idle'
  state.framesDecoded = 0
  state.framesDropped = 0
  // 🌊 WAVE 8207 — back to procedural standby once the texture stops feeding.
  state.hasVideoTex = false
  sendVideoStatus()
}

// ─────────────────────────────────────────────────────────────────────────
// Message handler
// ─────────────────────────────────────────────────────────────────────────

function handleInit(payload: ThetaInitPayload): void {
  if (state.isRunning) {
    sendError('INIT received while already running — ignoring duplicate init', false)
    return
  }
  if (!(payload.frameContextSAB instanceof SharedArrayBuffer)) {
    sendError('INIT payload missing valid SharedArrayBuffer (frameContextSAB)', true)
    return
  }
  state.reader = new FrameContextReader(payload.frameContextSAB)
  state.reader.resync() // discard whatever tick was published before we attached
  state.pollIntervalMs = payload.pollIntervalMs > 0 ? payload.pollIntervalMs : 22
  state.startTime = Date.now()
  state.isRunning = true

  // 🌊 WAVE 8207 — the render target is a worker-OWNED WebGL canvas; the
  // transferred canvas is only a 2D mirror for the in-app viewport.
  initGL()
  if (payload.offscreenCanvas) {
    attachPreviewCanvas(payload.offscreenCanvas)
  }
  // 64x64 thumbnail canvas for downscaling
  state.thumbCanvas = new OffscreenCanvas(64, 64)
  state.thumbCtx = state.thumbCanvas.getContext('2d')

  // 🎬 WAVE 4867 — Phase 6: Attach ThumbFrameWriter if SAB provided.
  // (El video pipeline ya NO se adjunta aquí: llega por `theia:video-port`
  // — Glass Bridge WAVE 8215, transferible ping-pong.)
  if ((payload as ThetaInitPayload).thumbPixelSAB instanceof SharedArrayBuffer) {
    try {
      state.thumbWriter = new ThumbFrameWriter((payload as ThetaInitPayload).thumbPixelSAB!)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      sendError(`thumbPixelSAB attach failed: ${msg}`, false)
      state.thumbWriter = null
    }
  }

  startPollLoop()
  startStateReports()

  send('theia:ready', { nodeId: 'theta' })
}

function handleShutdown(): void {
  state.isRunning = false
  stopPollLoop()
  stopStateReports()
  teardownVideoStream()
  state.reader = null
  state.previewCanvas = null
  state.previewCtx = null
  state.thumbCanvas = null
  state.thumbCtx = null
  // � WAVE 8215 — Glass Bridge cleanup: cerrar el link de video. Los
  // buffers del pool mueren con el worker (el GC del renderer los reclama).
  detachVideoLink()
  state.videoPool.length = 0
  state.videoWritersByBuffer.clear()
  // 🎬 WAVE 4867 — Phase 6 cleanup
  if (state.thumbWriter) state.thumbWriter.clear()
  state.thumbWriter = null
  state.prevSnapshotValid = false
  state.crossfade.abort()
  state.fsm.reset()
  // 🌊 WAVE 8207 — GL cleanup (textures, program, VBO, internal canvas)
  teardownGL()
  // No process.exit() — Web Workers are torn down by `worker.terminate()` on
  // the orchestrator side. We just stop work and let GC run.
}

function handleHeartbeat(payload: ThetaHeartbeatPayload): void {
  const now = Date.now()
  const ack: ThetaHeartbeatAckPayload = {
    originalTimestamp: payload.timestamp,
    ackTimestamp: now,
    sequence: payload.sequence,
    latencyMs: now - payload.timestamp,
  }
  send('theia:heartbeat-ack', ack)
}

self.addEventListener('message', (ev: MessageEvent<ThetaMessage>) => {
  const msg = ev.data
  if (!msg || typeof msg.type !== 'string') return
  try {
    switch (msg.type) {
      case 'theia:init':
        handleInit(msg.payload as ThetaInitPayload)
        break
      case 'theia:shutdown':
        handleShutdown()
        break
      case 'theia:heartbeat':
        handleHeartbeat(msg.payload as ThetaHeartbeatPayload)
        break
      case 'theia:load-stream':
        handleLoadStream(msg.payload as ThetaLoadStreamPayload)
        break
      case 'theia:unload-stream':
        teardownVideoStream()
        break
      case 'theia:force-state':
        handleForceState(msg.payload as ThetaForceStatePayload)
        break
      case 'theia:seek':
        handleSeek(msg.payload as ThetaSeekPayload)
        break
      case 'theia:set-uniform': {
        const p = msg.payload as ThetaSetUniformPayload
        if (p && typeof p.name === 'string' && typeof p.value === 'number') {
          state.uniforms.set(p.name, p.value)
        }
        break
      }
      case 'theia:attach-canvas': {
        const p = msg.payload as ThetaAttachCanvasPayload
        if (p && p.canvas instanceof OffscreenCanvas) {
          attachPreviewCanvas(p.canvas)
        } else {
          sendError('attach-canvas payload missing canvas', false)
        }
        break
      }
      // 🌊 WAVE 8215 — Glass Bridge: el extremo producer del canal de video
      // llega como transferible desde la página (relay del preload).
      case 'theia:video-port': {
        const p = msg.payload as ThetaVideoPortPayload
        if (p && p.port instanceof MessagePort) {
          attachVideoPort(p.port)
        } else {
          sendError('video-port payload missing MessagePort', false)
        }
        break
      }
      // La output window murió / se cerró — los buffers en vuelo se pierden.
      case 'theia:video-unlink':
        detachVideoLink()
        break
      default:
        sendError(`Unknown message type: ${msg.type}`, false)
    }
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err))
    sendError(e.message, true, e.stack)
  }
})

// Surface uncaught errors back to the orchestrator so the circuit breaker
// can react. Web Workers do not have `process.on('uncaughtException')`.
self.addEventListener('error', (ev: ErrorEvent) => {
  sendError(ev.message ?? 'unknown worker error', true, ev.error?.stack)
})
self.addEventListener('unhandledrejection', (ev: PromiseRejectionEvent) => {
  const reason = ev.reason
  const msg = reason instanceof Error ? reason.message : String(reason)
  const stack = reason instanceof Error ? reason.stack : undefined
  sendError(msg, false, stack)
})
