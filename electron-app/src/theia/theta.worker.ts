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
  type ThetaPerfReportPayload,
  type ThetaResizePreviewPayload,
  type ThetaSeekAckPayload,
  type ThetaSeekPayload,
  type ThetaSetUniformPayload,
  type ThetaShaderStatusPayload,
  type ThetaLoadShaderPayload,
  type ThetaActivateShaderPayload,
  type ThetaStateReportPayload,
  type ThetaVideoPortPayload,
  type ThetaVideoStatusPayload,
} from './protocol'
// 🎬 WAVE 4864: Phase 4 — Asset State Machine + Crossfade Unit
import { AssetStateMachine, type AssetStateId } from './AssetStateMachine'
import { CrossfadeUnit, type CrossfadeCurve, type CrossfadeStep } from './CrossfadeUnit'
// 🔮 WAVE 8229 — Euclid Oracle · E3: Shader Contract & Governor (§4.x)
import {
  assembleFragmentShader,
  assembleSimFragmentShader,
  exprGeneValues,
  parseStepsHint,
  hasMainImage,
  hasMainState,
  hashSource,
  remapShaderLog,
  GEN_VERTEX_SRC,
  BLIT_VERTEX_SRC,
  BLIT_FRAG_SRC,
  FLASH_STATS_FRAG_SRC,
  DEFAULT_MAX_STEPS,
  DEFAULT_FLASH_MAX_DELTA,
  FLASH_BUDGET,
  FLASH_BUDGET_RATE,
} from './shader/ShaderAssembler'
import { RenderGovernor } from './shader/RenderGovernor'
// 🧬 WAVE 8237 · G5 — Materia Viva: ping-pong RGBA16F por programa.
import { FloatStatePool } from './shader/FloatStatePool'
// � WAVE 8215 — Glass Bridge: transferable frame writers (ping-pong pool)
import {
  createVideoFrameBuffer,
  isAckMessage,
  THEIA_VIDEO_FRAME_MSG,
  VIDEO_FRAME_BUFFER_BYTES,
  VIDEO_SLOT_BYTES,
  VIDEO_MAX_WIDTH,
  VIDEO_MAX_HEIGHT,
  VideoFrameWriter,
  // 🔮 WAVE 8231 · E5 — control generativo por el mismo port (Modo B §6)
  THEIA_GEN_LOAD_MSG,
  THEIA_GEN_ACTIVATE_MSG,
  THEIA_GEN_UNIFORM_MSG,
} from './SharedVideoFrameBuffer'
// 🎬 WAVE 4867: Phase 6 — Thumb SAB writer (64×64 → AetherCanvasManager twin-output)
import { ThumbFrameWriter } from './TheiaThumbBuffer'
// 🔮 WAVE 8228 — Euclid Oracle · E2: Uniform Bridge (reader wire + smoother)
import {
  TEL_FLAG,
  TelemetryWireReader,
} from './telemetry/TheiaTelemetryRing'
import { TelemetrySmoother } from './telemetry/TelemetrySmoother'

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

// 🔮 WAVE 8228 — EUCLID ORACLE · E2: Uniform Bridge (§3.4/§3.5)
// u_tel[60] = payload del anillo (índice = slot − 4), una sola subida
// uniform1fv. u_flags/u_enums llegan empaquetados; los derivados llegan
// ya calculados por el TelemetrySmoother del worker.
uniform float u_tel[60];
uniform int   u_flags;
uniform ivec4 u_enums;              // x=schema y=predictionType z=huntState w=energyZone
uniform float u_time;               // segundos monotónicos de render
uniform float u_dt;                 // delta del frame (s)
uniform vec3  u_resolution;         // (w, h, pixelRatio)
uniform float u_beatTime;           // beats acumulados continuos
uniform float u_kickPulse;          // exp(−t/τ) desde flanco KICK_EDGE
uniform float u_snarePulse;         // idem flanco SNARE
uniform float u_predictiveETA;      // ETA fluido (s), extrapolado
uniform float u_approach;           // rampa oráculo 0→1 antes del drop
uniform float u_impact;             // pulso en el instante del evento

// Macros nombre→slot (índice = slot − 4). La numeración NUNCA se escribe a
// mano fuera del schema — estas se derivan de TELEMETRY_SCHEMA (§3.5).
#define u_bpm              u_tel[1]
#define u_beatPhase        u_tel[2]
#define u_energy           u_tel[5]
#define u_bass             u_tel[7]
#define u_treble           u_tel[11]
#define u_chromaHue        u_tel[20]
#define u_kickEnergy       u_tel[22]
#define u_seleneConfidence u_tel[26]
#define u_predictionProb   u_tel[27]
#define u_morphFactor      u_tel[34]

// GLSL ES 1.00 no tiene operadores de bits: test por división/módulo
// (u_flags ≤ 2^13 → exacto en float).
float telFlag(int bit) {
  return step(0.5, mod(floor(float(u_flags) / exp2(float(bit))), 2.0));
}
#define PREDICTING telFlag(7)
#define BREAKDOWN  telFlag(8)
#define APOCALYPSE telFlag(9)

void main() {
  // Procedural standby — plasma anclado al master clock, ahora consciente
  // del oráculo: la tonalidad tinta la paleta, la energía/bombos pulsan,
  // y u_approach tensa el espacio antes del drop (torsión pre-evento).
  vec2 uv = v_uv;
  // Compresión pre-drop: el espacio se contrae hacia el centro.
  uv = (uv - 0.5) / (1.0 - 0.18 * u_approach) + 0.5;
  // Glitch APOCALYPSE: desplazamiento por aspereza espectral.
  if (APOCALYPSE > 0.5) {
    uv.x += (fract(sin(floor(uv.y * 80.0) + floor(u_time * 30.0)) * 43758.5453)
             - 0.5) * u_tel[16] * 0.08;
  }
  float hue = u_chromaHue;
  float speed = 1.0 + u_approach * 1.5;
  vec3 plasma = 0.5 + 0.5 * cos(
    u_phase * speed + u_beatTime * 0.5
    + uv.xyx * (3.0 + u_morphFactor * 6.0)
    + vec3(hue * 6.2831, hue * 6.2831 + 2.094, hue * 6.2831 + 4.188));
  plasma *= 0.45 + u_energy * 0.8 + u_kickPulse * 0.55 + u_snarePulse * 0.30;
  // Destello radial en el impacto del oráculo.
  plasma += u_impact * 0.5 * exp(-3.5 * distance(uv, vec2(0.5)));
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
  /** 🌊 WAVE 8218 — última petición de resize (aplicada al attach). */
  pendingPreviewDims: { width: number; height: number } | null
  // Phase 2: 64x64 downscaler
  thumbCanvas: OffscreenCanvas | null
  thumbCtx: OffscreenCanvasRenderingContext2D | null
  // � WAVE 8215 — Glass Bridge video link (worker ↔ TheiaOutputView).
  // El puerto llega transferido vía `theia:video-port`; los frames se
  // publican por ownership transfer sobre un pool de doble buffer.
  videoPort: MessagePort | null
  /** Writers cuyo buffer está EN MANO (disponibles para el próximo tick). */
  videoPool: VideoFrameWriter[]
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
  // 🔮 WAVE 8228 — EUCLID ORACLE · E2 (Uniform Bridge & Smoother)
  /** Reader gen-guarded sobre el espejo local del wire buffer (mismo SAB
   *  que `frameContextSAB` — los slots 4..63 transportan el payload Euclid). */
  telReader: TelemetryWireReader | null
  /** Smoother + derivados — `out` se sube entero vía uniform1fv. */
  smoother: TelemetrySmoother
  /** Render clock propio (§3.1): rAF del DedicatedWorkerGlobalScope. */
  rafHandle: number | null
  /** true mientras el rAF esté disparando (watchdog: decay a los 250ms). */
  rafActive: boolean
  /** performance.now() del último frame rAF (watchdog del fallback). */
  lastRafAt: number
  /** performance.now() del último render — fuente del dt real. */
  lastRenderPerfMs: number
  /** Locations del bridge Euclid cacheadas en link (una vez por programa). */
  euTel: WebGLUniformLocation | null
  euFlags: WebGLUniformLocation | null
  euEnums: WebGLUniformLocation | null
  euTime: WebGLUniformLocation | null
  euDt: WebGLUniformLocation | null
  euResolution: WebGLUniformLocation | null
  euBeatTime: WebGLUniformLocation | null
  euKickPulse: WebGLUniformLocation | null
  euSnarePulse: WebGLUniformLocation | null
  euPredictiveETA: WebGLUniformLocation | null
  euApproach: WebGLUniformLocation | null
  euImpact: WebGLUniformLocation | null
  // 🔮 WAVE 8229 — EUCLID ORACLE · E3 (Shader Contract & Governor)
  /** El contexto GL es WebGL2 — requisito del camino generativo (§4.1). */
  glIsWebGL2: boolean
  /** Caché LRU de programas compilados (máx 8 — §4.4). Clave = programKey
   *  (hash fuente+genes) — variantes del mismo átomo coexisten. */
  genPrograms: Map<string, GenProgram>
  /** Fuentes de artista por shaderId — rebuild tras context-loss (§4.5). */
  genSources: Map<string, GenSourceSpec>
  /** Compilaciones en vuelo (KHR_parallel_shader_compile). Clave = programKey. */
  genPending: Map<string, PendingGenCompile>
  /** Programa generativo activo — null = plasma interno (Modo A legacy). */
  genActive: GenProgram | null
  genActiveId: string
  /** Activación diferida a la finalización de una compilación paralela. */
  genPendingActivate: { shaderId: string; programKey: string; crossfadeMs: number } | null
  /** 🧬 WAVE 8235 · G3 — genes `expr` del fenotipo activo → `u_gene[8]`
   *  por frame. El programa compartido entre fenotipos expr-only lee
   *  distintos valores sin recompilar (fast-path §4.6). */
  genGeneValues: Float32Array
  /** FBO escalado del governor (renderScale × resolución canvas). */
  genFbo: WebGLFramebuffer | null
  genFboTex: WebGLTexture | null
  genFboW: number
  genFboH: number
  /** Frame anterior del path generativo (canvas-res, crossfade §4.3). */
  genPrevTex: WebGLTexture | null
  genPrevW: number
  genPrevH: number
  genPrevValid: boolean
  /** 🌊 WAVE 8250 — reloj gobernado (AUDIO_LIVE ? 1.0 : 0.5, exponencial). */
  genShaderTimeSec: number
  genTimeScale: number
  /** Programa passthrough FBO→canvas. */
  blitProgram: WebGLProgram | null
  blitTexLoc: WebGLUniformLocation | null
  blitPos: number
  /** Stats fotosensibles — texel 1×1 {mean,budgetNorm} ping-pong (§4.6). */
  statsProgram: WebGLProgram | null
  statsTexA: WebGLTexture | null
  statsTexB: WebGLTexture | null
  statsFboA: WebGLFramebuffer | null
  statsFboB: WebGLFramebuffer | null
  statsFlip: boolean
  statsSceneLoc: WebGLUniformLocation | null
  statsPrevLoc: WebGLUniformLocation | null
  statsDtLoc: WebGLUniformLocation | null
  statsBudgetLoc: WebGLUniformLocation | null
  statsRateLoc: WebGLUniformLocation | null
  statsPos: number
  /** KHR_parallel_shader_compile (si existe). */
  khrCompile: { COMPLETION_STATUS_KHR: number } | null
  /** EXT_disjoint_timer_query_webgl2 + query en vuelo (GPU real, §4.5). */
  timerExt: { TIME_ELAPSED_EXT: number } | null
  gpuQuery: WebGLQuery | null
  gpuMs: number
  /** Governor adaptativo (renderScale). */
  governor: RenderGovernor
  /** Contador para LRU y fps del perf-report. */
  renderSeq: number
  framesRendered: number
  /** 🔮 WAVE 8231 · E5 — slots PBO de readback asíncrono (Modo A, WebGL2). */
  pboSlots: PboReadbackSlot[]
}

/** 🔮 WAVE 8231 · E5 — un readback en vuelo: readPixels→PBO + fenceSync;
 *  el `getBufferSubData` se difiere al frame siguiente (§6, Misión 3). */
interface PboReadbackSlot {
  pbo: WebGLBuffer | null
  fence: WebGLSync | null
  /** Writer retenido hasta que el fence señale — su payload es el destino
   *  del getBufferSubData; luego commit + transfer al pool del consumidor. */
  writer: VideoFrameWriter | null
  w: number
  h: number
  tickId: number
  seq: number
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
  pendingPreviewDims: null,
  thumbCanvas: null,
  thumbCtx: null,
  // � WAVE 8215 / 🎬 WAVE 4867
  videoPort: null,
  videoPool: [],
  videoFrameSeq: 0,
  framesNoBuffer: 0,
  thumbWriter: null,
  fsm: new AssetStateMachine(),
  crossfade: new CrossfadeUnit(),
  prevSnapshotValid: false,
  assetStateReportHandle: null,
  // 🔮 WAVE 8228 — EUCLID · E2
  telReader: null,
  smoother: new TelemetrySmoother(),
  rafHandle: null,
  rafActive: false,
  lastRafAt: 0,
  lastRenderPerfMs: 0,
  euTel: null,
  euFlags: null,
  euEnums: null,
  euTime: null,
  euDt: null,
  euResolution: null,
  euBeatTime: null,
  euKickPulse: null,
  euSnarePulse: null,
  euPredictiveETA: null,
  euApproach: null,
  euImpact: null,
  // 🔮 WAVE 8229 — EUCLID · E3
  glIsWebGL2: false,
  genPrograms: new Map(),
  genSources: new Map(),
  genPending: new Map(),
  genActive: null,
  genActiveId: 'builtin',
  genPendingActivate: null,
  genGeneValues: new Float32Array(8),
  genFbo: null,
  genFboTex: null,
  genFboW: 0,
  genFboH: 0,
  genPrevTex: null,
  genPrevW: 0,
  genPrevH: 0,
  genPrevValid: false,
  genShaderTimeSec: 0,
  genTimeScale: 0.5,
  blitProgram: null,
  blitTexLoc: null,
  blitPos: -1,
  statsProgram: null,
  statsTexA: null,
  statsTexB: null,
  statsFboA: null,
  statsFboB: null,
  statsFlip: false,
  statsSceneLoc: null,
  statsPrevLoc: null,
  statsDtLoc: null,
  statsBudgetLoc: null,
  statsRateLoc: null,
  statsPos: -1,
  khrCompile: null,
  timerExt: null,
  gpuQuery: null,
  gpuMs: 0,
  governor: new RenderGovernor(),
  renderSeq: 0,
  framesRendered: 0,
  pboSlots: [],
}

// ─────────────────────────────────────────────────────────────────────────
// 🔮 WAVE 8229 — EUCLID · E3: tipos del pipeline generativo
// ─────────────────────────────────────────────────────────────────────────

/** Locations estándar del contrato §3.5/§4 — cacheadas en link (una vez). */
interface GenUniformLocs {
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

interface GenProgram {
  program: WebGLProgram
  locs: GenUniformLocs
  /** Locations de uniforms de artista (`@euclid param`) — lazy per nombre. */
  paramLocs: Map<string, WebGLUniformLocation | null>
  /** Location del atributo a_pos (fullscreen triangle). */
  posLoc: number
  /** Marca de uso para la evicción LRU. */
  lastUsed: number
  /** MAX_STEPS con que se ensambló (hint @euclid steps). */
  steps: number
  /** 🧬 WAVE 8237 · G5 — programa de simulación (mainState) si existe. */
  simProgram: WebGLProgram | null
  simLocs: SimLocs | null
  simPosLoc: number
  /** Params de artista en el programa de sim — lazy per nombre. */
  simParamLocs: Map<string, WebGLUniformLocation | null>
  /** Ping-pong RGBA16F propio del programa — null si no hay mainState. */
  statePool: FloatStatePool | null
}

/**
 * 🧬 WAVE 8233 · G1 — especificación de variante por shaderId (átomo).
 * `programKey` = hash FNV-1a del fragSource ENSAMBLADO — el bloque
 * `#define G_*` inyectado forma parte del hash: cada fenotipo es un
 * programa distinto que la LRU retiene (§4.2/§4.5 Infinite Genome).
 */
interface GenSourceSpec {
  source: string
  steps: number
  genes?: Record<string, number>
  /**
   * 🧬 WAVE 8235 · G3 — genes `expr` en el orden de `u_gene[8]`
   * (`layoutExprGenes`). Su `#define` es `u_gene[k]` → mutarlos no
   * cambia el programKey.
   */
  exprGenes?: readonly string[]
  /** Valores `expr` efectivos precomputados (8 slots) — cero-alloc en activate. */
  exprValues?: Float32Array
  programKey: string
}

/** Compilación en vuelo (KHR_parallel_shader_compile — §4.4). */
interface PendingGenCompile {
  shaderId: string
  /** Clave de caché del programa (fuente+genes) — NO el atomId. */
  programKey: string
  source: string
  steps: number
  program: WebGLProgram
  vs: WebGLShader
  fs: WebGLShader
  preambleLines: number
  bodyLines: number
  t0: number
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
  if (snap !== null) {
    onFrameContextTick(snap)
    return
  }
  // 🌊 WAVE 8223 — RENDER INDEPENDENCE: el render NO es esclavo del master
  // tick. Si `readIfChanged` devuelve null (motor Selene parado → tickId/gen
  // congelados, pump sirviendo snapshots stale) el frame se dibuja igual:
  // el plasma sigue animado (reloj local como fase), los `set-uniform`
  // nuevos se aplican en este tick y un `video-port` hot-plug empieza a
  // publicar de inmediato — sin esperar a que Titan despierte.
  driveRender(Date.now())
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

  // 🔮 WAVE 8228 · E2 — el poll ya no dibuja directamente: conduce el
  // render al rAF si está vivo, o al fallback si el host no lo soporta.
  driveRender(snap.timestamp)
}

// ─────────────────────────────────────────────────────────────────────────
// 🔮 WAVE 8228 · E2 — RENDER CLOCK (§3.1)
//
// requestAnimationFrame en el DedicatedWorker corre a la frecuencia del
// display (60/90/144 Hz), desacoplado del master tick (44 Hz) — el
// telemetry clock queda en el poll; el render clock vive aquí. Si el host
// no soporta rAF en workers o el callback se congela (watchdog 250ms), el
// poll retoma el render a ~44 Hz — misma semántica que WAVE 8223.
// ─────────────────────────────────────────────────────────────────────────

/** Watchdog: si el rAF no dispara en esta ventana, el poll retoma render. */
const RAF_STALE_MS = 250

function startRenderLoop(): void {
  if (state.rafHandle !== null) return
  const g = self as unknown as {
    requestAnimationFrame?: (cb: (time: number) => void) => number
    cancelAnimationFrame?: (handle: number) => void
  }
  if (typeof g.requestAnimationFrame !== 'function') return
  const loop = (): void => {
    state.rafHandle = null
    state.rafActive = true
    state.lastRafAt = performance.now()
    renderCurrentFrame(Date.now())
    state.rafHandle = g.requestAnimationFrame!(loop)
  }
  state.rafHandle = g.requestAnimationFrame(loop)
}

function stopRenderLoop(): void {
  if (state.rafHandle !== null) {
    const g = self as unknown as {
      cancelAnimationFrame?: (handle: number) => void
    }
    if (typeof g.cancelAnimationFrame === 'function') {
      g.cancelAnimationFrame(state.rafHandle)
    }
    state.rafHandle = null
  }
  state.rafActive = false
}

/**
 * Conduce un render: si el rAF del worker está vivo, él es el reloj de
 * render y esta llamada no dibuja (evita doble-draw con el poll); si no,
 * renderiza en el tick del poll (fallback WAVE 8223) y reintenta armar el
 * rAF por si el host lo habilita tarde.
 */
function driveRender(timestampMs: number): void {
  if (state.rafActive && performance.now() - state.lastRafAt < RAF_STALE_MS) {
    return
  }
  state.rafActive = false
  startRenderLoop()
  renderCurrentFrame(timestampMs)
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
    // 🔮 WAVE 8229 · E3 — perf-report del governor (§4.3, ~1 Hz):
    // fps = frames renderizados en la ventana; frameMs = EMA del governor;
    // gpuMs solo si EXT_disjoint_timer_query_webgl2 está disponible.
    const perf: ThetaPerfReportPayload = {
      fps: state.framesRendered,
      frameMs: state.governor.frameEmaMs,
      gpuMs: state.timerExt && state.gpuMs > 0 ? state.gpuMs : undefined,
      renderScale: state.governor.renderScale,
      activeShader: state.genActiveId,
      downgrades: state.governor.downgrades,
      upgrades: state.governor.upgrades,
    }
    send('theia:perf-report', perf)
    // Reset per-window counters.
    state.ticksObserved = 0
    state.framesRendered = 0
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
  // 🔮 WAVE 8228 · E2 — cachear locations del Euclid Uniform Bridge en el
  // link (una vez por programa; rebuild tras context-restore). Los uniforms
  // que el compilador optimice fuera devuelven null → uploads no-op seguros.
  state.euTel = gl.getUniformLocation(prog, 'u_tel')
  state.euFlags = gl.getUniformLocation(prog, 'u_flags')
  state.euEnums = gl.getUniformLocation(prog, 'u_enums')
  state.euTime = gl.getUniformLocation(prog, 'u_time')
  state.euDt = gl.getUniformLocation(prog, 'u_dt')
  state.euResolution = gl.getUniformLocation(prog, 'u_resolution')
  state.euBeatTime = gl.getUniformLocation(prog, 'u_beatTime')
  state.euKickPulse = gl.getUniformLocation(prog, 'u_kickPulse')
  state.euSnarePulse = gl.getUniformLocation(prog, 'u_snarePulse')
  state.euPredictiveETA = gl.getUniformLocation(prog, 'u_predictiveETA')
  state.euApproach = gl.getUniformLocation(prog, 'u_approach')
  state.euImpact = gl.getUniformLocation(prog, 'u_impact')

  // 🔮 WAVE 8229 · E3 — programa blit FBO→canvas (passthrough ES 3.00).
  // Solo bajo WebGL2; el camino generativo cae al plasma sin él.
  if (state.glIsWebGL2) {
    state.blitProgram = null
    state.blitTexLoc = null
    state.blitPos = -1
    const bvs = compileShader(gl, gl.VERTEX_SHADER, BLIT_VERTEX_SRC)
    const bfs = compileShader(gl, gl.FRAGMENT_SHADER, BLIT_FRAG_SRC)
    if (bvs && bfs) {
      const bprog = gl.createProgram()
      if (bprog) {
        gl.attachShader(bprog, bvs)
        gl.attachShader(bprog, bfs)
        gl.linkProgram(bprog)
        if (gl.getProgramParameter(bprog, gl.LINK_STATUS)) {
          state.blitProgram = bprog
          state.blitTexLoc = gl.getUniformLocation(bprog, 'u_tex')
          state.blitPos = gl.getAttribLocation(bprog, 'a_pos')
        } else {
          gl.deleteProgram(bprog)
        }
      }
      gl.deleteShader(bvs)
      gl.deleteShader(bfs)
    }
    // Pass de stats fotosensibles 1×1 (§4.6) — texel {mean,budgetNorm}
    // ping-pong; el epílogo lo lee como u_flashState.
    state.statsProgram = null
    const svs = compileShader(gl, gl.VERTEX_SHADER, GEN_VERTEX_SRC)
    const sfs = compileShader(gl, gl.FRAGMENT_SHADER, FLASH_STATS_FRAG_SRC)
    if (svs && sfs) {
      const sprog = gl.createProgram()
      if (sprog) {
        gl.attachShader(sprog, svs)
        gl.attachShader(sprog, sfs)
        gl.linkProgram(sprog)
        if (gl.getProgramParameter(sprog, gl.LINK_STATUS)) {
          state.statsProgram = sprog
          state.statsSceneLoc = gl.getUniformLocation(sprog, 'u_scene')
          state.statsPrevLoc = gl.getUniformLocation(sprog, 'u_statsPrev')
          state.statsDtLoc = gl.getUniformLocation(sprog, 'u_dt')
          state.statsBudgetLoc = gl.getUniformLocation(sprog, 'u_flashBudget')
          state.statsRateLoc = gl.getUniformLocation(sprog, 'u_budgetRate')
          state.statsPos = gl.getAttribLocation(sprog, 'a_pos')
        } else {
          gl.deleteProgram(sprog)
        }
      }
      gl.deleteShader(svs)
      gl.deleteShader(sfs)
    }
    const gl2 = gl as WebGL2RenderingContext
    const initStatsTexel = (): WebGLTexture | null => {
      const t = gl2.createTexture()
      if (!t) return null
      gl2.bindTexture(gl2.TEXTURE_2D, t)
      // {mean=0.5, budget=full} — el primer frame arranca sin miedo.
      gl2.texImage2D(
        gl2.TEXTURE_2D, 0, gl2.RGBA, 1, 1, 0,
        gl2.RGBA, gl2.UNSIGNED_BYTE, new Uint8Array([128, 255, 0, 255]),
      )
      gl2.texParameteri(gl2.TEXTURE_2D, gl2.TEXTURE_MIN_FILTER, gl2.NEAREST)
      gl2.texParameteri(gl2.TEXTURE_2D, gl2.TEXTURE_MAG_FILTER, gl2.NEAREST)
      gl2.texParameteri(gl2.TEXTURE_2D, gl2.TEXTURE_WRAP_S, gl2.CLAMP_TO_EDGE)
      gl2.texParameteri(gl2.TEXTURE_2D, gl2.TEXTURE_WRAP_T, gl2.CLAMP_TO_EDGE)
      return t
    }
    state.statsTexA = initStatsTexel()
    state.statsTexB = initStatsTexel()
    state.statsFboA = gl2.createFramebuffer()
    state.statsFboB = gl2.createFramebuffer()
    state.statsFlip = false
    if (state.statsFboA && state.statsTexA) {
      gl2.bindFramebuffer(gl2.FRAMEBUFFER, state.statsFboA)
      gl2.framebufferTexture2D(
        gl2.FRAMEBUFFER, gl2.COLOR_ATTACHMENT0, gl2.TEXTURE_2D, state.statsTexA, 0,
      )
    }
    if (state.statsFboB && state.statsTexB) {
      gl2.bindFramebuffer(gl2.FRAMEBUFFER, state.statsFboB)
      gl2.framebufferTexture2D(
        gl2.FRAMEBUFFER, gl2.COLOR_ATTACHMENT0, gl2.TEXTURE_2D, state.statsTexB, 0,
      )
    }
    gl2.bindFramebuffer(gl2.FRAMEBUFFER, null)
    // Context-restore (§4.5): los programas generativos murieron con el
    // contexto — reconstruir la caché desde las fuentes guardadas y
    // re-activar el shader que estaba en pantalla.
    if (state.genSources.size > 0) {
      for (const [id, s] of state.genSources) {
        loadShaderSource(id, s.source, s.steps, s.genes, s.exprGenes)
      }
      const activeId = state.genActiveId
      const activeSpec = state.genSources.get(activeId)
      if (activeId !== BUILTIN_SHADER_ID && activeSpec && !state.khrCompile) {
        // Sin KHR ext la compilación fue síncrona → activación inmediata.
        const ent = state.genPrograms.get(activeSpec.programKey)
        if (ent) activateGenProgram(ent, activeId, 0)
      } else if (activeSpec) {
        state.genPendingActivate = {
          shaderId: activeId,
          programKey: activeSpec.programKey,
          crossfadeMs: 0,
        }
      }
      state.genActive = null
    }
    state.genPrevValid = false
  }

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
      // 🔮 WAVE 8229 · E3 — recursos del path generativo
      for (const ent of state.genPrograms.values()) {
        gl_deleteGenEntry(gl as WebGL2RenderingContext, ent)
      }
      if (state.blitProgram) gl.deleteProgram(state.blitProgram)
      if (state.statsProgram) gl.deleteProgram(state.statsProgram)
      if (state.genFboTex) gl.deleteTexture(state.genFboTex)
      if (state.genPrevTex) gl.deleteTexture(state.genPrevTex)
      if (state.statsTexA) gl.deleteTexture(state.statsTexA)
      if (state.statsTexB) gl.deleteTexture(state.statsTexB)
      if (state.genFbo) (gl as WebGL2RenderingContext).deleteFramebuffer?.(state.genFbo)
      if (state.statsFboA) (gl as WebGL2RenderingContext).deleteFramebuffer?.(state.statsFboA)
      if (state.statsFboB) (gl as WebGL2RenderingContext).deleteFramebuffer?.(state.statsFboB)
      if (state.gpuQuery) (gl as WebGL2RenderingContext).deleteQuery?.(state.gpuQuery)
      for (const p of state.genPending.values()) {
        gl.deleteProgram(p.program)
        gl.deleteShader(p.vs)
        gl.deleteShader(p.fs)
      }
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
  // 🔮 E3 — punteros GL inválidos tras teardown
  state.genPrograms.clear()
  state.genPending.clear()
  state.genFbo = null
  state.genFboTex = null
  state.genFboW = 0
  state.genFboH = 0
  state.genPrevTex = null
  state.genPrevW = 0
  state.genPrevH = 0
  state.genPrevValid = false
  state.blitProgram = null
  state.blitTexLoc = null
  state.blitPos = -1
  state.statsProgram = null
  state.statsTexA = null
  state.statsTexB = null
  state.statsFboA = null
  state.statsFboB = null
  state.statsFlip = false
  state.gpuQuery = null
  state.glIsWebGL2 = false
  // 🔮 WAVE 8231 · E5 — PBOs + fences mueren con el contexto; los writers
  // retenidos vuelven al pool (el buffer nunca se transfirió).
  releasePboSlots()
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
  // 🔮 WAVE 8229 · E3 — el camino generativo exige WebGL2 (§4.1); WebGL1
  // queda como fallback del plasma interno únicamente.
  const gl2 = canvas.getContext('webgl2', attrs) as WebGL2RenderingContext | null
  const gl =
    gl2 ?? (canvas.getContext('webgl', attrs) as WebGLRenderingContext | null)

  if (!gl) {
    sendError('WebGL unavailable in theta worker — no video output this session', false)
    return false
  }
  state.glIsWebGL2 = gl2 !== null
  if (gl2) {
    // Extensiones §4.4/§4.5 — ambas opcionales, degradación elegante.
    state.khrCompile =
      (gl2.getExtension('KHR_parallel_shader_compile') as {
        COMPLETION_STATUS_KHR: number
      } | null) ?? null
    state.timerExt =
      (gl2.getExtension('EXT_disjoint_timer_query_webgl2') as {
        TIME_ELAPSED_EXT: number
      } | null) ?? null
  }

  canvas.addEventListener('webglcontextlost', (ev) => {
    ev.preventDefault()
    state.glContextLost = true
    sendError('WebGL context lost — waiting for restore', false)
  })
  canvas.addEventListener('webglcontextrestored', () => {
    state.glContextLost = false
    // 🔮 E5 — los PBOs/fences murieron con el contexto anterior: soltar
    // los handles y reciclar los writers retenidos antes de reconstruir.
    releasePboSlots()
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

// ─────────────────────────────────────────────────────────────────────────
// 🔮 WAVE 8229 — EUCLID ORACLE · E3: GENERATIVE SHADER PIPELINE (§4.x)
//
//   load-shader → assemble(preamble+body+epilogue) → compile
//     KHR_parallel ext presente → pending set (sondeo por frame, §4.4)
//     ausente → finalize sync
//   activate-shader → genPrevTex snapshot + crossfade ramp (§4.3)
//   render → FBO escalado (governor §4.5) → blit → canvas
// ─────────────────────────────────────────────────────────────────────────

const BUILTIN_SHADER_ID = 'builtin'
const GEN_CACHE_MAX = 8

/** Uniforms estándar del contrato — no se resuelven como params de artista. */
const GEN_STD_UNIFORMS = new Set([
  'u_tel', 'u_flags', 'u_enums', 'u_time', 'u_dt', 'u_resolution',
  'u_beatTime', 'u_kickPulse', 'u_snarePulse', 'u_predictiveETA',
  'u_approach', 'u_impact', 'u_brightness', 'u_contrast', 'u_blackout',
  'u_renderScale', 'u_prevFrame', 'u_flashState', 'u_hasPrev', 'u_blend',
  'u_flashGuard', 'u_flashMaxDelta', 'u_flashBudget', 'u_gene',
  'u_state', 'u_stateInit',
])

function emitShaderStatus(payload: ThetaShaderStatusPayload): void {
  send('theia:shader-status', payload)
}

/** compileShader que devuelve el log (el FS lleva las líneas del artista). */
function compileShaderEx(
  gl: GLContext,
  type: number,
  src: string,
): { shader: WebGLShader; ok: boolean; log: string } {
  const sh = gl.createShader(type)!
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    return { shader: sh, ok: false, log: gl.getShaderInfoLog(sh) ?? 'unknown' }
  }
  return { shader: sh, ok: true, log: '' }
}

function cacheGenLocs(prog: WebGLProgram): GenUniformLocs {
  const gl = state.gl!
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
    // u_gene es array — 'u_gene[0]' da la location base del slot 0.
    gene: gl.getUniformLocation(prog, 'u_gene[0]'),
    // 🧬 WAVE 8237 · G5 — estado RGBA16F (u_state/u_stateInit).
    state: gl.getUniformLocation(prog, 'u_state'),
    stateInit: gl.getUniformLocation(prog, 'u_stateInit'),
  }
}

/** Locations del pase de simulación (G5 — subconjunto sin epílogo). */
function cacheSimLocs(prog: WebGLProgram): SimLocs {
  const gl = state.gl!
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

/** Libera todos los recursos GL de una entrada (programa + sim + pool). */
function gl_deleteGenEntry(gl: WebGL2RenderingContext, ent: GenProgram): void {
  gl.deleteProgram(ent.program)
  if (ent.simProgram) gl.deleteProgram(ent.simProgram)
  ent.statePool?.dispose()
  ent.statePool = null
}

/** Evicción LRU — el programa ACTIVO nunca sale (§4.4, máx 8). */
function evictGenCache(): void {
  while (state.genPrograms.size > GEN_CACHE_MAX) {
    let oldestId = ''
    let oldest = Infinity
    for (const [id, ent] of state.genPrograms) {
      if (ent === state.genActive) continue
      if (ent.lastUsed < oldest) {
        oldest = ent.lastUsed
        oldestId = id
      }
    }
    if (oldestId === '') break
    const ent = state.genPrograms.get(oldestId)!
    if (state.gl) {
      try {
        gl_deleteGenEntry(state.gl as WebGL2RenderingContext, ent)
      } catch { /* context may be lost */ }
    }
    state.genPrograms.delete(oldestId)
  }
}

/**
 * Compila + linkea un shader de artista. Con `KHR_parallel_shader_compile`
 * queda en `genPending` (sondeado por frame — el programa anterior sigue
 * renderizando); sin la extensión se finaliza aquí (§4.4).
 */
function loadShaderSource(
  shaderId: string,
  source: string,
  steps: number,
  genes?: Record<string, number>,
  exprGenes?: readonly string[],
): void {
  const gl = state.gl as WebGL2RenderingContext | null
  if (!gl || !state.glIsWebGL2) {
    emitShaderStatus({
      shaderId,
      ok: false,
      unsupported: true,
      log: 'generative path requires WebGL2 — builtin plasma stays active',
    })
    return
  }
  // 🧬 WAVE 8233 · G1 — el genoma va DENTRO del fragSource → el programKey
  // (hash FNV del fuente ensamblado) incluye los G_* inyectados (§4.2).
  // 🧬 WAVE 8235 · G3 — los `expr` emiten `#define G_X u_gene[k]` (texto
  // constante): mutar su valor NO cambia el programKey (§4.2 v2).
  const asm = assembleFragmentShader(source, steps, genes, exprGenes)
  const programKey = hashSource(asm.fragSource)

  // 🧬 WAVE 8235 · G3 — el spec se actualiza SIEMPRE antes del dedupe:
  // una recarga expr-only conserva programKey pero trae exprValues nuevos
  // que deben quedar registrados para el próximo activate (u_gene).
  state.genSources.set(shaderId, {
    source,
    steps,
    genes,
    exprGenes,
    exprValues: exprGenes?.length ? exprGeneValues(exprGenes, genes) : undefined,
    programKey,
  })

  // Re-carga idempotente / variante ya compilada por otro átomo (misma
  // programKey) / reactivación tras evicción → se reusa — el shader
  // activo nunca se interrumpe.
  if (state.genPrograms.has(programKey) || state.genPending.has(programKey)) {
    emitShaderStatus({
      shaderId,
      ok: true,
      pending: state.genPending.has(programKey) || undefined,
    })
    return
  }

  const t0 = performance.now()
  const vs = compileShaderEx(gl, gl.VERTEX_SHADER, GEN_VERTEX_SRC)
  const fs = compileShaderEx(gl, gl.FRAGMENT_SHADER, asm.fragSource)
  if (!vs.ok || !fs.ok) {
    // §4.4/§4.6 — el log del FS referencia el source ENSAMBLADO: restar
    // las líneas del preámbulo para que el error apunte al código artista.
    const badFs = !fs.ok
    const mapped = badFs
      ? remapShaderLog(fs.log, asm.preambleLines, asm.bodyLines)
      : { log: vs.log, line: null }
    gl.deleteShader(vs.shader)
    gl.deleteShader(fs.shader)
    emitShaderStatus({
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
  const pending: PendingGenCompile = {
    shaderId,
    programKey,
    source,
    steps,
    program: prog,
    vs: vs.shader,
    fs: fs.shader,
    preambleLines: asm.preambleLines,
    bodyLines: asm.bodyLines,
    t0,
  }
  if (state.khrCompile) {
    state.genPending.set(programKey, pending)
    emitShaderStatus({ shaderId, ok: true, pending: true })
  } else {
    finalizeGenCompile(pending)
  }
}

/** Cierra una compilación: link status → caché+status o error mapeado. */
function finalizeGenCompile(p: PendingGenCompile): void {
  const gl = state.gl as WebGL2RenderingContext
  // Logs ANTES de borrar shaders — el FS log lleva las líneas artista.
  const fsLog = gl.getShaderInfoLog(p.fs) ?? ''
  const progLog = gl.getProgramInfoLog(p.program) ?? ''
  const ok = !!gl.getProgramParameter(p.program, gl.LINK_STATUS)
  gl.deleteShader(p.vs)
  gl.deleteShader(p.fs)
  const compileMs = performance.now() - p.t0
  if (ok) {
    const ent: GenProgram = {
      program: p.program,
      locs: cacheGenLocs(p.program),
      paramLocs: new Map(),
      posLoc: gl.getAttribLocation(p.program, 'a_pos'),
      lastUsed: state.renderSeq,
      steps: p.steps,
      simProgram: null,
      simLocs: null,
      simPosLoc: -1,
      simParamLocs: new Map(),
      statePool: null,
    }
    // 🧬 WAVE 8237 · G5 — Materia Viva: si el artista declara `mainState`,
    // compila el pase de simulación (fuente pequeña — sync, fuera del
    // critical path del KHR del shader visual). Si falla, el shader visual
    // sigue vivo — el autómata simplemente no corre.
    if (hasMainState(p.source)) {
      const spec = state.genSources.get(p.shaderId)
      const sim = compileSimProgram(
        gl,
        p.source,
        p.steps,
        spec?.genes,
        spec?.exprGenes,
      )
      if (sim) {
        ent.simProgram = sim.program
        ent.simLocs = cacheSimLocs(sim.program)
        ent.simPosLoc = gl.getAttribLocation(sim.program, 'a_pos')
        ent.statePool = new FloatStatePool(gl)
      }
    }
    state.genPrograms.set(p.programKey, ent)
    evictGenCache()
    emitShaderStatus({ shaderId: p.shaderId, ok: true, compileMs })
    const pa = state.genPendingActivate
    if (pa && pa.programKey === p.programKey) {
      state.genPendingActivate = null
      activateGenProgram(ent, pa.shaderId, pa.crossfadeMs)
    }
  } else {
    const raw = fsLog.length > 0 ? fsLog : progLog || 'link failed'
    const mapped = remapShaderLog(raw, p.preambleLines, p.bodyLines)
    try {
      gl.deleteProgram(p.program)
    } catch { /* noop */ }
    emitShaderStatus({
      shaderId: p.shaderId,
      ok: false,
      log: mapped.log,
      line: mapped.line ?? undefined,
    })
  }
}

/**
 * 🧬 WAVE 8237 · G5 — compila el pase de simulación (`mainState`):
 * misma fuente de artista, epílogo crudo (sin masters ni sRGB) — el
 * fragColor va directo al ping-pong RGBA16F. Devuelve null en error
 * (no fatal: el shader visual sigue operativo).
 */
function compileSimProgram(
  gl: WebGL2RenderingContext,
  source: string,
  steps: number,
  genes?: Record<string, number>,
  exprGenes?: readonly string[],
): { program: WebGLProgram } | null {
  const asm = assembleSimFragmentShader(source, steps, genes, exprGenes)
  const vs = compileShaderEx(gl, gl.VERTEX_SHADER, GEN_VERTEX_SRC)
  const fs = compileShaderEx(gl, gl.FRAGMENT_SHADER, asm.fragSource)
  if (!vs.ok || !fs.ok) {
    gl.deleteShader(vs.shader)
    gl.deleteShader(fs.shader)
    sendError(`sim pass compile failed: ${fs.log || vs.log}`, false)
    return null
  }
  const prog = gl.createProgram()!
  gl.attachShader(prog, vs.shader)
  gl.attachShader(prog, fs.shader)
  gl.linkProgram(prog)
  gl.deleteShader(vs.shader)
  gl.deleteShader(fs.shader)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    sendError(`sim pass link failed: ${gl.getProgramInfoLog(prog) ?? ''}`, false)
    try { gl.deleteProgram(prog) } catch { /* noop */ }
    return null
  }
  return { program: prog }
}

/** Sondeo por frame — §4.4: el render nunca se congela compilando. */
function probeGenCompiles(): void {
  if (state.genPending.size === 0) return
  const gl = state.gl as WebGL2RenderingContext | null
  const ext = state.khrCompile
  if (!gl || !ext) return
  for (const [id, p] of state.genPending) {
    if (gl.getProgramParameter(p.program, ext.COMPLETION_STATUS_KHR)) {
      state.genPending.delete(id)
      finalizeGenCompile(p)
    }
  }
}

function handleLoadShader(p: ThetaLoadShaderPayload): void {
  if (!p || typeof p.shaderId !== 'string' || typeof p.source !== 'string') return
  const steps = p.meta?.steps ?? parseStepsHint(p.source) ?? DEFAULT_MAX_STEPS
  if (!hasMainImage(p.source)) {
    emitShaderStatus({
      shaderId: p.shaderId,
      ok: false,
      log: 'missing `void mainImage(out vec4, in vec2)` — Euclid contract §4.1',
    })
    return
  }
  const genes = p.meta?.genes
  const exprGenes = p.meta?.exprGenes
  loadShaderSource(p.shaderId, p.source, steps, genes, exprGenes)
  // 🔮 WAVE 8231 · E5 — Modo B: la ventana HDMI compila su copia nativa.
  // 🧬 WAVE 8233 · G1 — con el mismo fenotipo (genes) que el worker.
  state.videoPort?.postMessage({
    type: THEIA_GEN_LOAD_MSG,
    shaderId: p.shaderId,
    source: p.source,
    steps,
    genes,
    exprGenes,
  })
}

function handleActivateShader(p: ThetaActivateShaderPayload): void {
  if (!p || typeof p.shaderId !== 'string') return
  const fadeMs = Math.max(0, p.crossfadeMs ?? 0)
  // 🔮 WAVE 8231 · E5 — Modo B: la ventana HDMI sigue la misma activación
  // ('builtin' la devuelve al blit de vídeo del Modo A).
  state.videoPort?.postMessage({
    type: THEIA_GEN_ACTIVATE_MSG,
    shaderId: p.shaderId,
    crossfadeMs: fadeMs,
  })
  if (p.shaderId === BUILTIN_SHADER_ID) {
    if (state.genActive) {
      // Vuelta al plasma: snapshot del frame generativo actual en prevTex
      // (mecanismo crossfade 8207) — la salida no parpadea.
      captureCurrentSnapshot()
      if (fadeMs > 0) {
        state.crossfade.start({
          totalTicks: Math.max(2, Math.round(fadeMs / 16.7)),
        })
      }
    }
    state.genActive = null
    state.genActiveId = BUILTIN_SHADER_ID
    return
  }
  // 🧬 WAVE 8233 · G1 — shaderId es el átomo; la caché va por programKey
  // (fuente+genes). Sin spec cargada → el shader nunca llegó al worker.
  const spec = state.genSources.get(p.shaderId)
  const ent = spec ? state.genPrograms.get(spec.programKey) : undefined
  if (!ent) {
    if (spec && state.genPending.has(spec.programKey)) {
      // Aún compilando en paralelo → activar al finalizar (§4.4).
      state.genPendingActivate = {
        shaderId: p.shaderId,
        programKey: spec.programKey,
        crossfadeMs: fadeMs,
      }
      return
    }
    emitShaderStatus({ shaderId: p.shaderId, ok: false, log: 'shader not loaded' })
    return
  }
  activateGenProgram(ent, p.shaderId, fadeMs)
}

/** Conmuta el programa activo: snapshot prev-frame + rampa crossfade. */
function activateGenProgram(ent: GenProgram, id: string, fadeMs: number): void {
  // 🧬 WAVE 8235 · G3 — fast-path §4.6: si la variante entrante comparte
  // programKey con la activa, SOLO cambiaron genes `expr` → se fijan por
  // `u_gene` sin recompilar, sin snapshot y sin crossfade.
  if (ent === state.genActive) {
    state.genActiveId = id
    ent.lastUsed = state.renderSeq
    const spec = state.genSources.get(id)
    if (spec?.exprValues) state.genGeneValues.set(spec.exprValues)
    else state.genGeneValues.fill(0)
    return
  }
  captureGenPrevFrame() // el shader saliente queda como u_prevFrame
  state.genActive = ent
  state.genActiveId = id
  const spec = state.genSources.get(id)
  if (spec?.exprValues) state.genGeneValues.set(spec.exprValues)
  else state.genGeneValues.fill(0)
  ent.lastUsed = state.renderSeq
  if (fadeMs > 0) {
    state.crossfade.start({ totalTicks: Math.max(2, Math.round(fadeMs / 16.7)) })
  } else {
    state.crossfade.abort()
    state.prevSnapshotValid = false
  }
  state.governor.reset()
}

// ── Render target escalado del governor + prev-frame mipmapped ─────────────

function ensureGenFbo(w: number, h: number): boolean {
  const gl = state.gl as WebGL2RenderingContext
  if (!state.genFbo) {
    state.genFbo = gl.createFramebuffer()
    state.genFboTex = gl.createTexture()
    state.genFboW = 0
    state.genFboH = 0
    if (!state.genFbo || !state.genFboTex) return false
  }
  if (state.genFboW === w && state.genFboH === h) return true
  state.genFboW = w
  state.genFboH = h
  gl.bindTexture(gl.TEXTURE_2D, state.genFboTex)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.bindFramebuffer(gl.FRAMEBUFFER, state.genFbo)
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, state.genFboTex, 0,
  )
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  return ok
}

/** Textura prev-frame del path generativo (crossfade + referencia visual). */
function ensureGenPrevTex(w: number, h: number): void {
  const gl = state.gl as WebGL2RenderingContext
  if (!state.genPrevTex) {
    state.genPrevTex = gl.createTexture()
    state.genPrevW = 0
    state.genPrevH = 0
  }
  if (state.genPrevW === w && state.genPrevH === h) return
  state.genPrevW = w
  state.genPrevH = h
  gl.bindTexture(gl.TEXTURE_2D, state.genPrevTex)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
}

/** Captura el canvas actual en genPrevTex (crossfade + presencia de prev). */
function captureGenPrevFrame(): void {
  const gl = state.gl as WebGL2RenderingContext
  const canvas = state.glCanvas
  if (!gl || !canvas || canvas.width <= 0 || canvas.height <= 0) return
  ensureGenPrevTex(canvas.width, canvas.height)
  // 🌊 WAVE 8244 — fuente = backbuffer RGBA8 SIEMPRE: si un FBO ajeno quedó
  // bound (early-return, excepción a mitad de pase, pool RGBA16F del G5),
  // copyTexImage2D leería un source 16F → INVALID copy texture format
  // combination, y el error se repite cada captura → consola inundada.
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  gl.bindTexture(gl.TEXTURE_2D, state.genPrevTex)
  gl.copyTexImage2D(
    gl.TEXTURE_2D, 0, gl.RGBA, 0, 0, canvas.width, canvas.height, 0,
  )
  state.genPrevValid = true
}

/** Resultado del GPU timer query (EXT_disjoint_timer_query_webgl2, §4.5). */
function pollGpuTimer(): void {
  const gl = state.gl as WebGL2RenderingContext | null
  const q = state.gpuQuery
  if (!gl || !q || !state.timerExt) return
  if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) {
    const ns = Number(gl.getQueryParameter(q, gl.QUERY_RESULT))
    state.gpuMs = ns / 1e6
    gl.deleteQuery(q)
    state.gpuQuery = null
  }
}

/** 🔮 WAVE 8231 · E5 — resolución del gemelo Modo B (§6): con un átomo
 *  `kind:'shader'` activo el worker solo renderiza el thumb DMX + preview. */
const GEN_THUMB_RES = 64

/**
 * Frame generativo: escena del artista a FBO escalado (governor) → blit a
 * canvas → capture del frame para el limitador/crossfade del siguiente.
 *
 * 🔮 WAVE 8231 · E5 — MODO B: el FBO de escena queda fijado a 64×64 — el
 * único consumidor local es el thumb DMX + el preview espejo; la ventana
 * HDMI renderiza el mismo .glsl a resolución nativa (§6). El governor sigue
 * corriendo para el perf-report pero no influye en el gemelo.
 */
function renderGenerativeFrame(
  xfStep: CrossfadeStep,
  w: number,
  h: number,
  dtMs: number,
  perfNow: number,
): void {
  const gl = state.gl as WebGL2RenderingContext
  const ent = state.genActive
  if (!ent || !state.blitProgram) return
  const scale = state.governor.renderScale
  const sw = GEN_THUMB_RES
  const sh = GEN_THUMB_RES
  if (!ensureGenFbo(sw, sh)) {
    sendError('generative FBO incomplete — falling back to builtin plasma', false)
    state.genActive = null
    state.genActiveId = BUILTIN_SHADER_ID
    return
  }
  const sm = state.smoother

  // 🌊 WAVE 8250 — gobernador de tiempo acumulativo (paridad con
  // GenRuntime): `u_time` crece a la velocidad del audio — AUDIO_LIVE →
  // 1.0, sordo → 0.5 — suavizado exponencial independiente del frame-rate
  // (τ=160ms ≈ 10%/frame @60fps). `u_dt` sigue siendo el dt físico.
  const audioLive = (sm.flags & (1 << TEL_FLAG.AUDIO_LIVE)) !== 0
  state.genTimeScale +=
    ((audioLive ? 1.0 : 0.5) - state.genTimeScale) * (1 - Math.exp(-dtMs / 160))
  state.genShaderTimeSec += dtMs * 0.001 * state.genTimeScale
  const shaderTimeSec = state.genShaderTimeSec

  // ── 🧬 WAVE 8237 · G5 — pase de SIMULACIÓN (Materia Viva) ──────────
  // Si el shader declara `mainState`, el autómata itera un paso sobre su
  // ping-pong RGBA16F propio (lineal, sin epílogo). La escena visual lee
  // el estado YA actualizado como `u_state`.
  let stateInitF = 0
  const pool = ent.statePool
  if (ent.simProgram && pool && pool.ensure(sw, sh)) {
    stateInitF = pool.needsInit ? 1 : 0
    const SL = ent.simLocs!
    gl.bindFramebuffer(gl.FRAMEBUFFER, pool.writeFramebuffer)
    gl.viewport(0, 0, sw, sh)
    gl.useProgram(ent.simProgram)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, pool.readTexture ?? state.dummyTex)
    gl.uniform1fv(SL.tel, sm.out)
    gl.uniform1i(SL.flags, sm.flags)
    gl.uniform4i(SL.enums, sm.schemaVersion, sm.predictionType, sm.huntState, sm.energyZone)
    gl.uniform1f(SL.time, shaderTimeSec)
    gl.uniform1f(SL.dt, dtMs * 0.001)
    gl.uniform3f(SL.resolution, sw, sh, 1)
    gl.uniform1f(SL.beatTime, sm.beatTime)
    gl.uniform1f(SL.kickPulse, sm.kickPulse)
    gl.uniform1f(SL.snarePulse, sm.snarePulse)
    gl.uniform1f(SL.predictiveETA, sm.predictiveEtaSec)
    gl.uniform1f(SL.approach, sm.approach)
    gl.uniform1f(SL.impact, sm.impact)
    if (SL.gene) gl.uniform1fv(SL.gene, state.genGeneValues)
    gl.uniform1i(SL.state, 0)
    gl.uniform1f(SL.stateInit, stateInitF)
    for (const [name, value] of state.uniforms) {
      if (GEN_STD_UNIFORMS.has(name)) continue
      let loc = ent.simParamLocs.get(name)
      if (loc === undefined) {
        loc = gl.getUniformLocation(ent.simProgram, name)
        ent.simParamLocs.set(name, loc)
      }
      if (loc) gl.uniform1f(loc, value)
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, state.glVbo)
    gl.enableVertexAttribArray(ent.simPosLoc)
    gl.vertexAttribPointer(ent.simPosLoc, 2, gl.FLOAT, false, 0, 0)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    pool.swap()
    pool.needsInit = false
  }

  // ── Escena del artista → FBO escalado ──────────────────────────────
  gl.bindFramebuffer(gl.FRAMEBUFFER, state.genFbo)
  gl.viewport(0, 0, sw, sh)
  gl.useProgram(ent.program)
  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, state.genPrevTex ?? state.dummyTex)
  gl.activeTexture(gl.TEXTURE1)
  gl.bindTexture(
    gl.TEXTURE_2D,
    (state.statsFlip ? state.statsTexA : state.statsTexB) ?? state.dummyTex,
  )
  // 🧬 G5 — u_state = estado float actualizado (o dummy 1×1 si el shader
  // no tiene simulación). Jamás pasa por el epílogo → sigue lineal.
  gl.activeTexture(gl.TEXTURE2)
  gl.bindTexture(
    gl.TEXTURE_2D,
    (pool && pool.ready ? pool.readTexture : state.dummyTex) ?? state.dummyTex,
  )

  const L = ent.locs
  gl.uniform1fv(L.tel, sm.out)
  gl.uniform1i(L.flags, sm.flags)
  gl.uniform4i(L.enums, sm.schemaVersion, sm.predictionType, sm.huntState, sm.energyZone)
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
  if (L.gene) gl.uniform1fv(L.gene, state.genGeneValues)
  gl.uniform1f(L.brightness, state.uniforms.get('u_brightness') ?? 1.0)
  gl.uniform1f(L.contrast, state.uniforms.get('u_contrast') ?? 1.0)
  gl.uniform1f(L.blackout, state.uniforms.get('u_blackout') ?? 0.0)
  gl.uniform1f(L.renderScale, w > 0 ? sw / w : scale)
  gl.uniform1i(L.prevFrame, 0)
  gl.uniform1i(L.flashState, 1)
  gl.uniform1i(L.state, 2)
  gl.uniform1f(L.stateInit, stateInitF)
  gl.uniform1f(L.hasPrev, state.genPrevValid ? 1 : 0)
  // 🧬 WAVE 8232 · G0 (H1): `genPrevValid` queda true permanente (feedback
  // + limitador) — alphaSecondary=0 en reposo congelaba la salida sobre el
  // primer frame capturado. resolvedBlend devuelve 1 en idle.
  gl.uniform1f(L.blend, state.crossfade.resolvedBlend(xfStep))
  gl.uniform1f(L.flashGuard, state.uniforms.get('u_flashGuard') ?? 1.0)
  gl.uniform1f(
    L.flashMaxDelta,
    state.uniforms.get('u_flashMaxDelta') ?? DEFAULT_FLASH_MAX_DELTA,
  )
  gl.uniform1f(
    L.flashBudget,
    state.uniforms.get('u_flashBudget') ?? FLASH_BUDGET,
  )
  // Params de artista (@euclid param → theia:set-uniform) — lazy locs.
  for (const [name, value] of state.uniforms) {
    if (GEN_STD_UNIFORMS.has(name)) continue
    let loc = ent.paramLocs.get(name)
    if (loc === undefined) {
      loc = gl.getUniformLocation(ent.program, name)
      ent.paramLocs.set(name, loc)
    }
    if (loc) gl.uniform1f(loc, value)
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, state.glVbo)
  gl.enableVertexAttribArray(ent.posLoc)
  gl.vertexAttribPointer(ent.posLoc, 2, gl.FLOAT, false, 0, 0)

  // GPU timer query (opcional — §4.5): un query en vuelo por frame.
  let q: WebGLQuery | null = null
  if (state.timerExt && state.gpuQuery === null) {
    q = gl.createQuery()
    if (q) gl.beginQuery(state.timerExt.TIME_ELAPSED_EXT, q)
  }
  gl.drawArrays(gl.TRIANGLES, 0, 3)
  if (q && state.timerExt) {
    gl.endQuery(state.timerExt.TIME_ELAPSED_EXT)
    state.gpuQuery = q
  }

  // ── Stats fotosensibles 1×1 (§4.6): media de luma + presupuesto
  // leaky-bucket — el epílogo del PRÓXIMO frame leerá este texel.
  const statsIn = state.statsFlip ? state.statsTexA : state.statsTexB
  const statsOutFbo = state.statsFlip ? state.statsFboB : state.statsFboA
  if (state.statsProgram && statsIn && statsOutFbo) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, statsOutFbo)
    gl.viewport(0, 0, 1, 1)
    gl.useProgram(state.statsProgram)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, state.genFboTex)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, statsIn)
    gl.uniform1i(state.statsSceneLoc, 0)
    gl.uniform1i(state.statsPrevLoc, 1)
    gl.uniform1f(state.statsDtLoc, dtMs * 0.001)
    gl.uniform1f(
      state.statsBudgetLoc,
      state.uniforms.get('u_flashBudget') ?? FLASH_BUDGET,
    )
    gl.uniform1f(
      state.statsRateLoc,
      state.uniforms.get('u_flashBudgetRate') ?? FLASH_BUDGET_RATE,
    )
    gl.bindBuffer(gl.ARRAY_BUFFER, state.glVbo)
    gl.enableVertexAttribArray(state.statsPos)
    gl.vertexAttribPointer(state.statsPos, 2, gl.FLOAT, false, 0, 0)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    state.statsFlip = !state.statsFlip
  }

  // ── Blit FBO→canvas (upscale lineal) ───────────────────────────────
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  gl.viewport(0, 0, w, h)
  gl.useProgram(state.blitProgram)
  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, state.genFboTex)
  gl.uniform1i(state.blitTexLoc, 0)
  gl.bindBuffer(gl.ARRAY_BUFFER, state.glVbo)
  gl.enableVertexAttribArray(state.blitPos)
  gl.vertexAttribPointer(state.blitPos, 2, gl.FLOAT, false, 0, 0)
  gl.drawArrays(gl.TRIANGLES, 0, 3)

  // Prev-frame continuo para el limitador fotosensible (mip 1×1) y el
  // crossfade de activaciones — el canvas completo pasa a genPrevTex.
  captureGenPrevFrame()
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
  // 🌊 WAVE 8218 — un resize pedido antes del attach queda pendiente y se
  // aplica ahora (el DOM no puede alcanzar el canvas transferido).
  if (state.pendingPreviewDims) {
    resizePreviewCanvas(state.pendingPreviewDims.width, state.pendingPreviewDims.height)
  }
}

/**
 * 🌊 WAVE 8218 — resize del espejo de preview. `transferControlToOffscreen`
 * congela el backing del canvas DOM al tamaño medido en el mount; los
 * resizes posteriores del layout no lo alcanzan, así que la UI reenvía los
 * rects del ResizeObserver vía `theia:resize-preview`. Cambiar width/height
 * re-aloja el bitmap del OffscreenCanvas (contenido limpiado — el próximo
 * tick lo repinta). NUNCA toca `glCanvas` (salida 1920×1080 intacta).
 */
const MAX_PREVIEW_DIM = 4096
function resizePreviewCanvas(width: number, height: number): void {
  const w = Math.min(Math.max(1, Math.floor(width)), MAX_PREVIEW_DIM)
  const h = Math.min(Math.max(1, Math.floor(height)), MAX_PREVIEW_DIM)
  state.pendingPreviewDims = { width: w, height: h }
  const canvas = state.previewCanvas
  if (!canvas || (canvas.width === w && canvas.height === h)) return
  canvas.width = w
  canvas.height = h
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
  // 🔮 WAVE 8231 · E5 — replay del estado generativo al consumidor Modo B:
  // fuentes → uniforms (masters + params de artista) → activación. La
  // ventana HDMI compila su copia local del .glsl y rinde nativa (§6).
  for (const [shaderId, s] of state.genSources) {
    port.postMessage({
      type: THEIA_GEN_LOAD_MSG,
      shaderId,
      source: s.source,
      steps: s.steps,
      genes: s.genes,
      exprGenes: s.exprGenes,
    })
  }
  for (const [name, value] of state.uniforms) {
    port.postMessage({ type: THEIA_GEN_UNIFORM_MSG, name, value })
  }
  if (state.genActiveId !== BUILTIN_SHADER_ID) {
    port.postMessage({
      type: THEIA_GEN_ACTIVATE_MSG,
      shaderId: state.genActiveId,
      crossfadeMs: 0,
    })
  }
  // eslint-disable-next-line no-console
  console.log('[THETA] 🌉 video Glass-Bridge attached (double-buffer pool)')
}

function detachVideoLink(): void {
  if (state.videoPort) {
    try { state.videoPort.close() } catch { /* noop */ }
    state.videoPort = null
  }
  // Los buffers en vuelo sobre el canal muerto nunca volverán por ack —
  // pérdida acotada por diseño (el pool conserva solo los writers en mano).
}

/**
 * Rellena el pool hasta POOL_SIZE. ÚNICO lugar donde se instancian buffers
 * de frame — attach/re-link únicamente (bounded, fuera del hot path).
 */
function topUpVideoPool(): void {
  while (state.videoPool.length < VIDEO_POOL_SIZE) {
    state.videoPool.push(new VideoFrameWriter(createVideoFrameBuffer()))
  }
}

/**
 * 🩹 WAVE 8218 — ackFrame entrante: reclamación SIN identidad de objeto.
 *
 * La auditoría 8217-AUDIT probó que `postMessage` transfer NO preserva la
 * identidad JS del ArrayBuffer: cada cruce materializa un wrapper NUEVO en
 * el realm destino (el origen queda detached). Un Map<buffer,writer> jamás
 * acierta → starvation tras 2 frames. Fix: aceptar CUALQUIER buffer de
 * tamaño válido (un buffer solo puede volver una vez — el emisor lo perdió
 * en el transfer) y re-envolverlo en un `VideoFrameWriter` FRESCO — solo
 * aloja dos vistas (~100B); el payload de 8.3MB es el buffer retornado,
 * nunca una asignación nueva. Zero-alloc preservado.
 */
function returnVideoBuffer(buffer: ArrayBuffer): void {
  if (buffer.byteLength < VIDEO_FRAME_BUFFER_BYTES) return
  state.videoPool.push(new VideoFrameWriter(buffer))
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

  // 🔮 WAVE 8228 · E2 — UNIFORM BRIDGE (§3.2/§3.3): leer el espejo wire y
  // avanzar el smoother al reloj de render REAL (rAF 60-144Hz o poll ~44Hz
  // de fallback). `dt` es el delta real del frame → las curvas de decaimiento
  // son idénticas a cualquier frecuencia (k' = 1−(1−k)^(dt·60)).
  const perfNow = performance.now()
  const dtMs =
    state.lastRenderPerfMs > 0
      ? Math.min(perfNow - state.lastRenderPerfMs, 100) // clamp anti-stall
      : 16.7
  state.lastRenderPerfMs = perfNow
  const tel = state.telReader
  const telFresh = tel !== null && tel.read()
  state.smoother.step(
    tel !== null ? tel.scratch : null,
    tel !== null ? tel.flags : 0,
    tel !== null ? tel.enums : 0,
    telFresh,
    dtMs,
    perfNow,
  )

  // 🔮 WAVE 8229 · E3 — sondeo de compilaciones paralelas (§4.4) + governor
  // (§4.5): una evaluación por frame de render, sin bloquear el hilo.
  probeGenCompiles()
  pollGpuTimer()
  state.renderSeq++
  state.governor.step(
    state.timerExt !== null && state.gpuMs > 0 ? state.gpuMs : dtMs,
    perfNow,
  )

  // Crossfade step (only meaningful if a crossfade is in progress) —
  // we step it BEFORE drawing so we know the alphas for THIS tick.
  const xfStep = state.crossfade.step()

  // 🌊 WAVE 8242 · U4 — BLACKOUT total: con u_blackout≈1 el epílogo ya
  // multiplica por ~0 (`col *= 1-u_blackout`) — saltamos el pase pesado
  // completo (raymarch/video tex) y dejamos un clear a negro. La GPU
  // descansa; el smoother, el governor y la telemetría siguen vivos, así
  // que al bajar de 0.999 el render retorna sin discontinuidad.
  const blackoutNow = state.uniforms.get('u_blackout') ?? 0
  if (blackoutNow > 0.999) {
    if (frame) {
      frame.close()
      state.currentFrame = null
    }
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    return
  }

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

  // 🔮 WAVE 8229 · E3 — camino generativo (shader de artista activo y
  // contexto WebGL2): escena → FBO escalado → blit → canvas. En cualquier
  // otro caso, el plasma/video builtin de siempre.
  if (state.genActive && state.glIsWebGL2) {
    renderGenerativeFrame(xfStep, w, h, dtMs, perfNow)
    state.framesRendered++
  } else {
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

  // 🔮 WAVE 8228 · E2 — Euclid Uniform Bridge (§3.4/§3.5): el array
  // suavizado sube ENTERO en una llamada (60 floats); flags/enums van
  // empaquetados; los derivados del oráculo como escalares. Locations
  // cacheadas en link → null-safe.
  const sm = state.smoother
  if (state.euTel) gl.uniform1fv(state.euTel, sm.out)
  if (state.euFlags) gl.uniform1i(state.euFlags, sm.flags)
  if (state.euEnums) {
    gl.uniform4i(
      state.euEnums,
      sm.schemaVersion,
      sm.predictionType,
      sm.huntState,
      sm.energyZone,
    )
  }
  if (state.euTime) gl.uniform1f(state.euTime, perfNow * 0.001)
  if (state.euDt) gl.uniform1f(state.euDt, dtMs * 0.001)
  if (state.euResolution) gl.uniform3f(state.euResolution, w, h, 1)
  if (state.euBeatTime) gl.uniform1f(state.euBeatTime, sm.beatTime)
  if (state.euKickPulse) gl.uniform1f(state.euKickPulse, sm.kickPulse)
  if (state.euSnarePulse) gl.uniform1f(state.euSnarePulse, sm.snarePulse)
  if (state.euPredictiveETA) gl.uniform1f(state.euPredictiveETA, sm.predictiveEtaSec)
  if (state.euApproach) gl.uniform1f(state.euApproach, sm.approach)
  if (state.euImpact) gl.uniform1f(state.euImpact, sm.impact)

  gl.bindBuffer(gl.ARRAY_BUFFER, state.glVbo)
  gl.enableVertexAttribArray(state.glAttribPos)
  gl.vertexAttribPointer(state.glAttribPos, 2, gl.FLOAT, false, 0, 0)
  gl.drawArrays(gl.TRIANGLES, 0, 3)

    state.framesRendered++
  }

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

  // 🌊 WAVE 8246 — AGGRESSIVE IDLE SHORT-CIRCUIT: con el plasma builtin
  // como salida y SIN contenido real (ni átomo generativo ni vídeo), el
  // frame termina aquí. Todo lo que sigue lee el framebuffer — thumb
  // mirror, readbacks PBO asíncronos y la pierna síncrona WebGL1 — y era
  // la última fuente de `GL_INVALID_OPERATION: Invalid copy texture
  // format combination` por frame en reposo. El preview mirror de arriba
  // se mantiene: es el propio viewport, no una captura. Con vídeo activo
  // (Modo A) o gen activo (Modo B) el flujo continúa intacto.
  const port = state.videoPort
  if (!state.genActive && !state.hasVideoTex) {
    // Higiene: cosecha los fences que quedaran en vuelo de la última
    // publicación (devuelve writers al pool y borra los syncs) — no emite
    // lecturas nuevas, solo impide la muerte por starvation del pool.
    if (port && state.glIsWebGL2) flushPboReadbacks(port)
    return
  }

  // ── 64×64 thumb for AetherCanvas twin-output (top-down, tiny alloc) ──
  if (state.thumbCtx) {
    state.thumbCtx.drawImage(canvas, 0, 0, 64, 64)
    const thumb = state.thumbCtx.getImageData(0, 0, 64, 64)
    if (state.thumbWriter) {
      state.thumbWriter.publish(thumb.data)
    }
  }

  // ── Publish al Glass Bridge ──────────────────────────────────────────
  // 🔮 WAVE 8231 · E5 — MODO B (átomo kind:'shader' activo): la ventana
  // HDMI renderiza el .glsl nativamente a su resolución — el bridge NO
  // transporta los 8.3MB (§6); solo se drenan los PBOs que quedaran en
  // vuelo del último frame de vídeo antes del switch.
  // MODO A (vídeo/plasma): WebGL2 → readPixels ASÍNCRONO sobre PBO +
  // fenceSync (getBufferSubData diferido al frame siguiente — la GPU no
  // bloquea el hilo); WebGL1 → readPixels síncrono legacy.
  // 🌊 WAVE 8246 — el plasma vacío ya retornó arriba: aquí abajo siempre
  // hay contenido real (vídeo) o un gen activo.
  if (port) {
    if (state.glIsWebGL2) {
      flushPboReadbacks(port)
      if (!state.genActive) issuePboReadback(w, h)
    } else if (!state.genActive) {
      // WebGL1 — camino síncrono original (los shaders gen no existen aquí).
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
            gl.bindFramebuffer(gl.FRAMEBUFFER, null) // 🌊 WAVE 8244 — idem
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
}

// ─────────────────────────────────────────────────────────────────────────
// 🔮 WAVE 8231 · E5 — READBACK ASÍNCRONO PBO (Modo A · Misión 3, §6)
//
//   frame N   readPixels → PBO (la GPU vuelca sin bloquear) + fenceSync
//   frame N+1 fence SIGNALED → getBufferSubData → commit → transfer
//
// El stall síncrono desaparece: la CPU jamás espera al pipeline GL; solo
// cosecha fences ya señalados. Dos slots = un readback en vuelo mientras el
// anterior se extrae. Los PBOs se alojan una vez a tamaño máximo
// (VIDEO_SLOT_BYTES) — zero-alloc en el hot path preservado.
// ─────────────────────────────────────────────────────────────────────────

const PBO_POOL_SIZE = 2

function ensurePboSlots(): void {
  const gl = state.gl as WebGL2RenderingContext | null
  if (!gl || !state.glIsWebGL2) return
  while (state.pboSlots.length < PBO_POOL_SIZE) {
    const pbo = gl.createBuffer()
    if (!pbo) return
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pbo)
    gl.bufferData(gl.PIXEL_PACK_BUFFER, VIDEO_SLOT_BYTES, gl.STREAM_READ)
    state.pboSlots.push({
      pbo,
      fence: null,
      writer: null,
      w: 0,
      h: 0,
      tickId: 0,
      seq: 0,
    })
  }
  gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null)
}

/** Cosecha fences señalados: getBufferSubData → commit → ownership transfer. */
function flushPboReadbacks(port: MessagePort): void {
  const gl = state.gl as WebGL2RenderingContext | null
  if (!gl) return
  for (const slot of state.pboSlots) {
    if (!slot.fence || !slot.writer || !slot.pbo) continue
    if (
      gl.getSyncParameter(slot.fence, gl.SYNC_STATUS) !== gl.SIGNALED
    ) {
      continue // la GPU aún vuelca — el hilo no espera; próximo frame.
    }
    const writer = slot.writer
    const dst = writer.beginWrite(slot.w, slot.h)
    let sent = false
    if (dst) {
      try {
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, slot.pbo)
        gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, dst)
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null)
        writer.commit(slot.w, slot.h, slot.tickId, slot.seq)
        port.postMessage(
          {
            type: THEIA_VIDEO_FRAME_MSG,
            seq: slot.seq,
            buffer: writer.transferable,
          },
          [writer.transferable],
        )
        sent = true
      } catch (err) {
        try {
          gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null)
        } catch { /* noop */ }
        const msg = err instanceof Error ? err.message : String(err)
        sendError(`PBO getBufferSubData→transfer failed: ${msg}`, false)
      }
    }
    if (!sent) {
      // El writer nunca salió — vuelve al pool intacto (mismo contrato
      // que el camino síncrono: postMessage exitoso o buffer nuestro).
      state.videoPool.push(writer)
    }
    try {
      gl.deleteSync(slot.fence)
    } catch { /* noop */ }
    slot.fence = null
    slot.writer = null
  }
}

/** Lanza el readback asíncrono del frame actual (solo Modo A / WebGL2). */
function issuePboReadback(w: number, h: number): void {
  const gl = state.gl as WebGL2RenderingContext | null
  if (!gl) return
  if (w <= 0 || h <= 0 || w > VIDEO_MAX_WIDTH || h > VIDEO_MAX_HEIGHT) return
  ensurePboSlots()
  let free: PboReadbackSlot | null = null
  for (const s of state.pboSlots) {
    if (s.fence === null) {
      free = s
      break
    }
  }
  if (!free || !free.pbo) {
    // Ambos PBOs en vuelo — drop intencional (el consumidor va a su ritmo).
    state.framesNoBuffer++
    return
  }
  const writer = state.videoPool.pop()
  if (!writer) {
    // Pool agotado (acks pendientes) → drop. ZERO-ALLOC: nunca alojar aquí.
    state.framesNoBuffer++
    return
  }
  try {
    // 🌊 WAVE 8244 — la lectura es del backbuffer RGBA8: si un FBO float
    // (pool RGBA16F del G5) quedó bound por un early-return, readPixels
    // emitiría "Invalid copy texture format combination" por frame.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, free.pbo)
    // Offset- overload: el destino es el PBO, NO memoria CPU — asíncrono.
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, 0)
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null)
    const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)
    if (!fence) throw new Error('fenceSync returned null')
    const seq = (state.videoFrameSeq + 1) | 0
    state.videoFrameSeq = seq
    free.writer = writer
    free.w = w
    free.h = h
    free.tickId = state.lastTickId
    free.seq = seq
    free.fence = fence
  } catch (err) {
    try {
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null)
    } catch { /* noop */ }
    state.videoPool.push(writer)
    const msg = err instanceof Error ? err.message : String(err)
    sendError(`PBO readPixels→fence failed: ${msg}`, false)
  }
}

/** Limpieza del readback (shutdown/teardown): writers retenidos → pool. */
function releasePboSlots(): void {
  const gl = state.gl as WebGL2RenderingContext | null
  for (const slot of state.pboSlots) {
    if (slot.fence && gl) {
      try {
        gl.deleteSync(slot.fence)
      } catch { /* noop */ }
    }
    if (slot.pbo && gl) {
      try {
        gl.deleteBuffer(slot.pbo)
      } catch { /* noop */ }
    }
    if (slot.writer) {
      // Nunca se posteó — el buffer sigue siendo nuestro: reciclar.
      state.videoPool.push(slot.writer)
      slot.writer = null
    }
    slot.fence = null
    slot.pbo = null
  }
  state.pboSlots = []
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

  // 🌊 WAVE 8244 — el snapshot lee el backbuffer (RGBA8): rebind defensivo.
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
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
  // 🔮 WAVE 8228 · E2 — el mismo SAB es el wire mirror (256B: FC header +
  // payload Euclid). Reader gen-guarded + smoother fresco para el bridge.
  state.telReader = new TelemetryWireReader(payload.frameContextSAB)
  state.telReader.resync()
  state.smoother = new TelemetrySmoother()
  state.lastRenderPerfMs = 0
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
  // 🌊 WAVE 8225 — willReadFrequently: el thumb se lee con getImageData
  // cada tick (44Hz). Sin el flag, Chromium mantiene el backing en GPU y
  // cada lectura es un readback con pipeline stall (+warning en consola).
  // El flag mueve el backing a RAM — la lectura es una copia barata.
  state.thumbCtx = state.thumbCanvas.getContext('2d', { willReadFrequently: true })

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
  startRenderLoop() // 🔮 E2 — render clock propio a la frecuencia del display
  startStateReports()

  send('theia:ready', { nodeId: 'theta' })
}

function handleShutdown(): void {
  state.isRunning = false
  stopRenderLoop()
  stopPollLoop()
  stopStateReports()
  teardownVideoStream()
  state.reader = null
  state.telReader = null
  state.smoother = new TelemetrySmoother()
  state.lastRenderPerfMs = 0
  state.previewCanvas = null
  state.previewCtx = null
  state.pendingPreviewDims = null
  state.thumbCanvas = null
  state.thumbCtx = null
  // � WAVE 8215 — Glass Bridge cleanup: cerrar el link de video. Los
  // buffers del pool mueren con el worker (el GC del renderer los reclama).
  detachVideoLink()
  state.videoPool.length = 0
  // 🎬 WAVE 4867 — Phase 6 cleanup
  if (state.thumbWriter) state.thumbWriter.clear()
  state.thumbWriter = null
  state.prevSnapshotValid = false
  state.crossfade.abort()
  state.fsm.reset()
  // 🔮 WAVE 8229 · E3 — el contexto GL muere con el worker: los objetos
  // quedan inválidos, pero las FUENTES se conservan en genSources (el
  // siguiente init/restart las recompila vía loadShaderSource).
  state.genPending.clear()
  state.genPrograms.clear()
  state.genActive = null
  state.genActiveId = 'builtin'
  state.genPendingActivate = null
  state.genPrevValid = false
  state.gpuQuery = null
  state.gpuMs = 0
  state.khrCompile = null
  state.timerExt = null
  state.governor = new RenderGovernor()
  state.framesRendered = 0
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
          // 🔮 WAVE 8231 · E5 — relay al render nativo de la ventana (Modo B):
          // masters y params de artista se aplican al programa local.
          state.videoPort?.postMessage({
            type: THEIA_GEN_UNIFORM_MSG,
            name: p.name,
            value: p.value,
          })
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
      // 🌊 WAVE 8218 — resize dinámico del espejo de preview (el DOM ya no
      // puede tocar el canvas transferido — el ResizeObserver de la UI
      // reenvía los rects vivos por aquí).
      case 'theia:resize-preview': {
        const p = msg.payload as ThetaResizePreviewPayload
        if (p && typeof p.width === 'number' && typeof p.height === 'number') {
          resizePreviewCanvas(p.width, p.height)
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
      // 🔮 WAVE 8229 · E3 — shader contract (§4.3)
      case 'theia:load-shader':
        handleLoadShader(msg.payload as ThetaLoadShaderPayload)
        break
      case 'theia:activate-shader':
        handleActivateShader(msg.payload as ThetaActivateShaderPayload)
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
