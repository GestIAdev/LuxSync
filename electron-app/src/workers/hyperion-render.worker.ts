// 🧠 WORKER THREAD ALIVE — OPERACIÓN LÁZARO (WAVE 2520)
// 🔇 WAVE 3290: HYPERION RENDER WORKER — Silenciado. No pertenece al whitelist.
// DEBUG PROBE — Reactivar para auditoría del render worker 3D.
// ;(function(){const _n=()=>{};console.log=_n;console.info=_n;console.debug=_n;console.warn=_n;console.error=_n;})()
// [BLACKOUT] console.log('🧠 WORKER THREAD ALIVE')

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ☀️ HYPERION RENDER WORKER — "The 4th Worker"
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Web Worker (Chromium renderer-side) that owns the TacticalCanvas via
 * OffscreenCanvas. Runs its own RAF loop at 60fps, receives fixture data
 * via postMessage Transferrable at ~44Hz, interpolates the gap.
 * 
 * ARCHITECTURE:
 * - Main thread transfers OffscreenCanvas ownership on mount (irreversible)
 * - Scaffold (structural data) sent once on show load / fixture config change
 * - Hot frames (dynamic data) arrive as packed Float32Array Transferrable
 * - Physics interpolation (exponential smoothing + adaptive snap) in worker
 * - Hit testing runs here, results sent back via postMessage
 * - All 5 render layers execute here: Grid → Zone → Fixture → Selection → HUD
 * 
 * AGNOSTIC TO HARDWARE: This worker renders at 60fps regardless of whether
 * the DMX backend ticks at 25Hz, 30Hz, 44Hz, or anything else. It LERPS
 * between received snapshots to maintain smooth visual output.
 * 
 * @module workers/hyperion-render.worker
 * @since WAVE 2510 (Operación Hyperion — The 4th Worker)
 */

import {
  FLOATS_PER_FIXTURE,
  FIXTURE_FIELD,
  type WorkerInboundMessage,
  type WorkerOutboundMessage,
  type WorkerFixtureScaffold,
  type WorkerFixtureFrame,
  type WorkerMsgGlassPort,
} from './hyperion-render.types'

import {
  renderGridLayer,
  renderZoneLayer,
  renderFixtureLayer,
  renderSelectionLayer,
  renderHUDLayer,
  FIXTURE_CONFIG,
} from '../components/hyperion/views/tactical/layers'

import {
  hitTestFixtures,
  hitTestLasso,
} from '../components/hyperion/views/tactical/HitTestEngine'

import type { TacticalFixture, RenderMetrics, QualityMode } from '../components/hyperion/views/tactical/types'
import type { CanonicalZone } from '../components/hyperion/shared/ZoneLayoutEngine'

// ═══════════════════════════════════════════════════════════════════════════
// WORKER STATE
// ═══════════════════════════════════════════════════════════════════════════

let canvas: OffscreenCanvas | null = null
let ctx: OffscreenCanvasRenderingContext2D | null = null
let animFrameId: number = 0
let isRunning = false
let isHibernating = false

// Dimensions (CSS pixels, not physical)
let canvasWidth = 0
let canvasHeight = 0
let dpr = 1

// Render options
let quality: QualityMode = 'HQ'
let showGrid = true
let showZoneLabels = false

// 🩸 WAVE 7601: VIRTUAL CAMERA — Pan/Zoom applied to ctx, not CSS.
// The canvas DOM element stays at 100% width/height; the camera transform
// is applied inside the render loop so fixtures can render outside the
// nominal stage bounds and the grid expands to fill the visible viewport.
let cameraZoom = 1
let cameraPanX = 0
let cameraPanY = 0

// ── Scaffold (structural, rarely changes) ─────────────────────────────────
let scaffoldFixtures: WorkerFixtureScaffold[] = []
let zoneCounts: Map<CanonicalZone, number> = new Map()

// ── Frame data (dynamic, every ~44Hz) ─────────────────────────────────────
let currentFrameData: Float32Array | null = null
let currentFrameNumber = 0
let currentTimestamp = 0
let currentFixtureCount = 0

// ── Beat envelope (decayed per RAF frame) ─────────────────────────────────
let beatVisualEnvelope = 0
let lastOnBeat = false
const BEAT_VISUAL_DECAY = 0.88 // per frame @ 60fps → ~130ms visible

// ── Selection state ───────────────────────────────────────────────────────
let selectedIds: Set<string> = new Set()
let mutedFixtureIds: Set<string> = new Set()
let hoveredId: string | null = null
let lassoBounds: { startX: number; startY: number; endX: number; endY: number } | null = null
let isLassoActive = false
let lassoStart: { x: number; y: number } | null = null

// ── Glass Bridge port (GLASS BYPASS Fase 1) ───────────────────────────────
let glassPort: MessagePort | null = null

// ── Physics memory (exponential smoothing) ────────────────────────────────
const physicsStore = new Map<string, { pan: number; tilt: number; zoom: number }>()

// ═══════════════════════════════════════════════════════════════════════════
// PHYSICS CONSTANTS — Adaptive Smoothing
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Base smoothing factor for pan/tilt/zoom.
 * 0.10 = slow/heavy butter (cinematographic movement)
 * Hard effects (strobes, gobo snaps) bypass this via SNAP_THRESHOLD.
 */
const SMOOTHING_FACTOR = 0.10

/**
 * Adaptive snap threshold (normalized 0-1 scale).
 * If a fixture's intensity delta exceeds this between frames,
 * we SNAP to the new value instead of interpolating.
 * This preserves strobe fidelity — no mushy fades on hard cuts.
 */
const INTENSITY_SNAP_THRESHOLD = 0.4 // 40% of range = hard cut detected

// ── FPS tracking ──────────────────────────────────────────────────────────
let lastFrameTime = 0
const fpsHistory: number[] = []
const metrics: RenderMetrics = {
  fps: 60,
  frameTime: 0,
  fixtureCount: 0,
  lastRenderTime: 0,
}
let metricsReportCounter = 0
const METRICS_REPORT_INTERVAL = 60 // report every 60 frames (~1s)

// ── Pre-allocated unpack buffer (zero-allocation per frame) ───────────────
const unpackBuffer: WorkerFixtureFrame = {
  r: 0, g: 0, b: 0,
  intensity: 0,
  physicalPan: 0.5, physicalTilt: 0.5,
  zoom: 127, focus: 127,
  panVelocity: 0, tiltVelocity: 0,
}

// ── Previous intensity map for snap detection ─────────────────────────────
const prevIntensity = new Map<string, number>()

// 🛡️ WAVE 7713: Pre-allocated TacticalFixture pool — zero allocation per frame.
// Before this fix, the render loop created `new Array(N)` + N object literals
// every frame at 60fps. With 200 fixtures: 60 × 201 = 12,060 objects/sec
// ≈ 1.5-2MB/sec of short-lived garbage that V8 GC couldn't keep up with.
// Now we reuse the same array and object slots, mutating in-place.
const smoothedFixturesPool: TacticalFixture[] = []
const hitTestFixturesPool: TacticalFixture[] = []

function getOrCreatePoolSlot(pool: TacticalFixture[], index: number): TacticalFixture {
  let slot = pool[index]
  if (!slot) {
    slot = {
      id: '', x: 0, y: 0, type: 'moving', zone: 'strobe',
      gobo: 0, prism: 0,
      r: 0, g: 0, b: 0,
      intensity: 0,
      physicalPan: 0.5, physicalTilt: 0.5,
      zoom: 127, focus: 127,
      panVelocity: 0, tiltVelocity: 0,
    }
    pool[index] = slot
  }
  return slot
}

// ═══════════════════════════════════════════════════════════════════════════
// RENDER LOOP
// ═══════════════════════════════════════════════════════════════════════════

function render(timestamp: number): void {
  if (!isRunning || !ctx) {
    return
  }

  // ── FPS calculation ─────────────────────────────────────────────────────
  const delta = timestamp - lastFrameTime
  lastFrameTime = timestamp

  if (delta > 0) {
    const instantFps = 1000 / delta
    fpsHistory.push(instantFps)
    if (fpsHistory.length > 30) fpsHistory.shift()
    metrics.fps = fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length
  }
  metrics.frameTime = delta
  metrics.lastRenderTime = timestamp

  // ── Beat visual envelope decay ──────────────────────────────────────────
  beatVisualEnvelope *= BEAT_VISUAL_DECAY
  const beatEnvelope = beatVisualEnvelope

  // ── Build TacticalFixture[] for render layers ───────────────────────────
  const fixtureCount = Math.min(scaffoldFixtures.length, currentFixtureCount)
  metrics.fixtureCount = fixtureCount

  // 🛡️ WAVE 7713: Reuse pre-allocated pool — mutate in-place, zero alloc/frame.
  const smoothedFixtures = smoothedFixturesPool

  for (let i = 0; i < fixtureCount; i++) {
    const scaffold = scaffoldFixtures[i]

    // Unpack dynamic data from Float32Array
    if (currentFrameData && i * FLOATS_PER_FIXTURE + FLOATS_PER_FIXTURE <= currentFrameData.length) {
      const offset = i * FLOATS_PER_FIXTURE
      unpackBuffer.r = currentFrameData[offset + FIXTURE_FIELD.R]
      unpackBuffer.g = currentFrameData[offset + FIXTURE_FIELD.G]
      unpackBuffer.b = currentFrameData[offset + FIXTURE_FIELD.B]
      unpackBuffer.intensity = currentFrameData[offset + FIXTURE_FIELD.INTENSITY]
      unpackBuffer.physicalPan = currentFrameData[offset + FIXTURE_FIELD.PHYSICAL_PAN]
      unpackBuffer.physicalTilt = currentFrameData[offset + FIXTURE_FIELD.PHYSICAL_TILT]
      unpackBuffer.zoom = currentFrameData[offset + FIXTURE_FIELD.ZOOM]
      unpackBuffer.focus = currentFrameData[offset + FIXTURE_FIELD.FOCUS]
      unpackBuffer.panVelocity = currentFrameData[offset + FIXTURE_FIELD.PAN_VELOCITY]
      unpackBuffer.tiltVelocity = currentFrameData[offset + FIXTURE_FIELD.TILT_VELOCITY]
    }

    // ── Adaptive smoothing ──────────────────────────────────────────────
    // Pan/tilt/zoom: always interpolate (butter movement)
    // Intensity: SNAP if delta > threshold (strobe fidelity)
    let physState = physicsStore.get(scaffold.id)
    if (!physState) {
      physState = {
        pan: unpackBuffer.physicalPan,
        tilt: unpackBuffer.physicalTilt,
        zoom: unpackBuffer.zoom,
      }
      physicsStore.set(scaffold.id, physState)
    }

    // Smooth pan/tilt/zoom (always — these are mechanical movements)
    physState.pan += (unpackBuffer.physicalPan - physState.pan) * SMOOTHING_FACTOR
    physState.tilt += (unpackBuffer.physicalTilt - physState.tilt) * SMOOTHING_FACTOR
    physState.zoom += (unpackBuffer.zoom - physState.zoom) * SMOOTHING_FACTOR
    physicsStore.set(scaffold.id, physState)

    // Intensity: snap detection — when delta > threshold it's a strobe/hard cut.
    // Color and intensity always pass through raw (no smoothing needed — only pan/tilt/zoom are mechanical).
    const prevInt = prevIntensity.get(scaffold.id) ?? unpackBuffer.intensity
    const intDelta = Math.abs(unpackBuffer.intensity - prevInt)
    prevIntensity.set(scaffold.id, unpackBuffer.intensity)
    // useSnap preserved for future strobe-specific rendering (e.g., flash frames)
    const useSnap = intDelta > INTENSITY_SNAP_THRESHOLD
    void useSnap

    // 🛡️ WAVE 7713: Mutate pool slot in-place — zero object allocation per frame.
    const fx = getOrCreatePoolSlot(smoothedFixturesPool, i)
    fx.id = scaffold.id
    fx.x = scaffold.x
    fx.y = scaffold.y
    fx.type = scaffold.type
    fx.zone = scaffold.zone
    fx.gobo = scaffold.gobo
    fx.prism = scaffold.prism
    // Dynamic data — color and intensity always pass through raw
    fx.r = unpackBuffer.r
    fx.g = unpackBuffer.g
    fx.b = unpackBuffer.b
    fx.intensity = unpackBuffer.intensity
    fx.physicalPan = physState.pan
    fx.physicalTilt = physState.tilt
    fx.zoom = physState.zoom
    fx.focus = unpackBuffer.focus
    fx.panVelocity = unpackBuffer.panVelocity
    fx.tiltVelocity = unpackBuffer.tiltVelocity
  }

  // Trim pool if fixture count shrank (keep slots for reuse but fix .length)
  if (smoothedFixturesPool.length > fixtureCount) {
    smoothedFixturesPool.length = fixtureCount
  }

  // ── Calculate base radius ───────────────────────────────────────────────
  const minDim = Math.min(canvasWidth, canvasHeight)
  const baseRadius = Math.max(
    FIXTURE_CONFIG.MIN_RADIUS,
    Math.min(FIXTURE_CONFIG.MAX_RADIUS, minDim * FIXTURE_CONFIG.BASE_RADIUS_RATIO)
  )

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER LAYERS — Exact same pipeline as the old main-thread RAF loop
  // 🩸 WAVE 7601: VIRTUAL CAMERA — ctx transform applied for all world-space
  // layers (grid, zones, fixtures, selection). HUD stays in screen space.
  // 🩸 WAVE 7602: CENTERED ORIGIN — stage center (0.5*canvasW, 0.5*canvasH
  // in world space) maps to canvas center at zoom=1, pan=0. Zoom scales
  // around the canvas center, revealing extra space symmetrically.
  // ═══════════════════════════════════════════════════════════════════════
  ctx.save()
  ctx.clearRect(0, 0, canvasWidth, canvasHeight)

  // ── 🩸 WAVE 7602: Centered camera transform ────────────────────────────
  // Transform chain (applied right-to-left to world coords):
  //   1. translate(-canvasW/2, -canvasH/2): move stage center to origin
  //   2. scale(zoom): zoom around origin
  //   3. translate(canvasW/2 + panX, canvasH/2 + panY): move to canvas center + pan
  // Result: screen = (world - canvasCenter) * zoom + canvasCenter + pan
  // At zoom=1, pan=0: screen = world (stage center at canvas center). ✓
  // At zoom=2, pan=0: scales around canvas center. ✓
  const cx = canvasWidth / 2
  const cy = canvasHeight / 2
  ctx.translate(cx + cameraPanX, cy + cameraPanY)
  ctx.scale(cameraZoom, cameraZoom)
  ctx.translate(-cx, -cy)

  // ── Compute visible world bounds for grid (inverse transform) ──────────
  // Inverse: world = (screen - canvasCenter - pan) / zoom + canvasCenter
  const worldLeft = (0 - cx - cameraPanX) / cameraZoom + cx
  const worldTop = (0 - cy - cameraPanY) / cameraZoom + cy
  const worldRight = (canvasWidth - cx - cameraPanX) / cameraZoom + cx
  const worldBottom = (canvasHeight - cy - cameraPanY) / cameraZoom + cy

  // LAYER 1: GRID (world space — ctx transform handles centering/zoom)
  if (showGrid) {
    renderGridLayer(ctx as unknown as CanvasRenderingContext2D, canvasWidth, canvasHeight, {
      showReferenceLines: true,
      showStereoDivision: true,
      // 🩸 WAVE 7602: visible world bounds for grid extent
      viewport: { left: worldLeft, top: worldTop, right: worldRight, bottom: worldBottom },
    })
  }

  // LAYER 2: ZONE LABELS
  if (showZoneLabels) {
    renderZoneLayer(ctx as unknown as CanvasRenderingContext2D, canvasWidth, canvasHeight, {
      showCounts: true,
      zoneCounts,
    })
  }

  // LAYER 3: FIXTURES
  renderFixtureLayer(ctx as unknown as CanvasRenderingContext2D, canvasWidth, canvasHeight, smoothedFixtures, {
    quality,
    onBeat: beatEnvelope > 0.05,
    beatIntensity: beatEnvelope,
  })

  // LAYER 4: SELECTION
  renderSelectionLayer(ctx as unknown as CanvasRenderingContext2D, canvasWidth, canvasHeight, smoothedFixtures, baseRadius, {
    selectedIds,
    mutedFixtureIds,
    hoveredId,
    lassoBounds,
    animationPhase: (timestamp % 1000) / 1000,
  })

  ctx.restore()

  // LAYER 5: HUD (screen space — restore for HUD so it stays fixed)
  ctx.save()
  renderHUDLayer(ctx as unknown as CanvasRenderingContext2D, canvasWidth, canvasHeight, metrics, quality)
  ctx.restore()

  // ── Metrics report ──────────────────────────────────────────────────────
  metricsReportCounter++
  if (metricsReportCounter >= METRICS_REPORT_INTERVAL) {
    metricsReportCounter = 0
    sendMessage({ type: 'METRICS', fps: metrics.fps, frameTime: metrics.frameTime, fixtureCount: metrics.fixtureCount })
  }

  // ── Schedule next frame ─────────────────────────────────────────────────
  animFrameId = requestAnimationFrame(render)
}

// ═══════════════════════════════════════════════════════════════════════════
// HIT TESTING — Mouse interaction handled in worker
// ═══════════════════════════════════════════════════════════════════════════

function handleMouse(msg: { action: string; x: number; y: number; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }): void {
  const fixtures = buildCurrentFixtures()

  // 🩸 WAVE 7601: VIRTUAL CAMERA — inverse-transform mouse coords from
  // screen space to world space.
  // 🩸 WAVE 7602: Centered origin — inverse: world = (screen - canvasCenter - pan) / zoom + canvasCenter
  // Hit testing and lasso operate in world space (same as fixture.x*canvasWidth).
  const cx = canvasWidth / 2
  const cy = canvasHeight / 2
  const worldX = (msg.x - cx - cameraPanX) / cameraZoom + cx
  const worldY = (msg.y - cy - cameraPanY) / cameraZoom + cy

  if (msg.action === 'leave') {
    hoveredId = null
    isLassoActive = false
    lassoStart = null
    lassoBounds = null
    sendMessage({ type: 'HIT_TEST', fixtureId: null, fixtureIndex: null, distance: null, mouseX: msg.x, mouseY: msg.y, action: 'move', shiftKey: false, ctrlKey: false, metaKey: false })
    return
  }

  // 🩸 WAVE 7601: baseRadius must be scaled by zoom so hit targets grow
  // when zoomed in and shrink when zoomed out, matching visual size.
  const baseRadius = Math.max(
    FIXTURE_CONFIG.MIN_RADIUS,
    Math.min(FIXTURE_CONFIG.MAX_RADIUS, Math.min(canvasWidth, canvasHeight) * FIXTURE_CONFIG.BASE_RADIUS_RATIO)
  ) * cameraZoom

  if (msg.action === 'move') {
    if (isLassoActive && lassoStart) {
      // Update lasso bounds (normalized 0-1 in world space)
      const normX = worldX / canvasWidth
      const normY = worldY / canvasHeight
      lassoBounds = {
        startX: lassoStart.x,
        startY: lassoStart.y,
        endX: normX,
        endY: normY,
      }
      return
    }

    const hit = hitTestFixtures(worldX, worldY, fixtures, canvasWidth, canvasHeight, baseRadius)
    hoveredId = hit.fixtureId
    sendMessage({
      type: 'HIT_TEST',
      fixtureId: hit.fixtureId,
      fixtureIndex: hit.fixtureIndex,
      distance: hit.distance,
      mouseX: msg.x,
      mouseY: msg.y,
      action: 'move',
      shiftKey: msg.shiftKey,
      ctrlKey: msg.ctrlKey,
      metaKey: msg.metaKey,
    })
  } else if (msg.action === 'down') {
    const hit = hitTestFixtures(worldX, worldY, fixtures, canvasWidth, canvasHeight, baseRadius)

    if (hit.fixtureId) {
      // Click on fixture — let main thread handle selection logic
      sendMessage({
        type: 'HIT_TEST',
        fixtureId: hit.fixtureId,
        fixtureIndex: hit.fixtureIndex,
        distance: hit.distance,
        mouseX: msg.x,
        mouseY: msg.y,
        action: 'down',
        shiftKey: msg.shiftKey,
        ctrlKey: msg.ctrlKey,
        metaKey: msg.metaKey,
      })
    } else {
      // Start lasso (normalized 0-1 in world space)
      isLassoActive = true
      const normX = worldX / canvasWidth
      const normY = worldY / canvasHeight
      lassoStart = { x: normX, y: normY }
      lassoBounds = { startX: normX, startY: normY, endX: normX, endY: normY }
      // Notify main thread of click on empty space
      sendMessage({
        type: 'HIT_TEST',
        fixtureId: null,
        fixtureIndex: null,
        distance: null,
        mouseX: msg.x,
        mouseY: msg.y,
        action: 'down',
        shiftKey: msg.shiftKey,
        ctrlKey: msg.ctrlKey,
        metaKey: msg.metaKey,
      })
    }
  } else if (msg.action === 'up') {
    if (isLassoActive && lassoBounds) {
      const lassoedIds = hitTestLasso(lassoBounds, fixtures)
      if (lassoedIds.length > 0) {
        sendMessage({
          type: 'LASSO_COMPLETE',
          fixtureIds: lassoedIds,
          additive: msg.shiftKey || msg.ctrlKey || msg.metaKey,
        })
      }
    }
    isLassoActive = false
    lassoStart = null
    lassoBounds = null
  }
}

/**
 * Build TacticalFixture[] from current scaffold + frame data.
 * Simplified version for hit testing (no physics smoothing needed).
 * 🛡️ WAVE 7713: Reuses pre-allocated pool — zero allocation per mouse event.
 */
function buildCurrentFixtures(): TacticalFixture[] {
  const count = Math.min(scaffoldFixtures.length, currentFixtureCount)
  const result = hitTestFixturesPool

  for (let i = 0; i < count; i++) {
    const s = scaffoldFixtures[i]
    const fx = getOrCreatePoolSlot(hitTestFixturesPool, i)
    fx.id = s.id
    fx.x = s.x
    fx.y = s.y
    fx.type = s.type
    fx.zone = s.zone
    fx.gobo = s.gobo
    fx.prism = s.prism
    fx.r = 0; fx.g = 0; fx.b = 0
    fx.intensity = 0
    fx.physicalPan = 0.5
    fx.physicalTilt = 0.5
    fx.zoom = 127
    fx.focus = 127
    fx.panVelocity = 0
    fx.tiltVelocity = 0
  }

  if (hitTestFixturesPool.length > count) {
    hitTestFixturesPool.length = count
  }

  return result
}

// ═══════════════════════════════════════════════════════════════════════════
// MESSAGE HANDLER
// ═══════════════════════════════════════════════════════════════════════════

function sendMessage(msg: WorkerOutboundMessage): void {
  (self as unknown as { postMessage: (msg: WorkerOutboundMessage) => void }).postMessage(msg)
}

self.onmessage = (e: MessageEvent<WorkerInboundMessage>) => {
  const msg = e.data

  switch (msg.type) {
    case 'INIT': {
      // 🛡️ WAVE 7568: OffscreenCanvas nullability guard.
      // The contract types msg.canvas as non-null, but on legacy/low-VRAM GPUs
      // (e.g. Intel HD 3000 on a 13-year-old i3) transferControlToOffscreen()
      // can silently yield a null/detached canvas. Without this guard the very
      // next line (canvas.width = ...) throws a null reference that kills the
      // worker before it can report ERROR back to the main thread — leaving
      // TacticalCanvas stuck on "INITIALIZING..." forever.
      const offscreen = msg.canvas as OffscreenCanvas | null
      if (!offscreen) {
        sendMessage({ type: 'ERROR', message: 'INIT received null OffscreenCanvas — transferControlToOffscreen failed on this GPU' })
        return
      }
      canvas = offscreen
      canvasWidth = msg.width
      canvasHeight = msg.height
      dpr = msg.dpr
      quality = msg.quality
      showGrid = msg.showGrid
      showZoneLabels = msg.showZoneLabels

      // Set physical pixel size
      canvas.width = msg.width * dpr
      canvas.height = msg.height * dpr

      ctx = canvas.getContext('2d')
      if (!ctx) {
        sendMessage({ type: 'ERROR', message: 'Failed to get 2d context from OffscreenCanvas' })
        return
      }

      // Apply DPR scale (same as main thread setup)
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.scale(dpr, dpr)

      // Start render loop
      isRunning = true
      lastFrameTime = performance.now()
      animFrameId = requestAnimationFrame(render)

      sendMessage({ type: 'READY' })
      break
    }

    case 'RESIZE': {
      canvasWidth = msg.width
      canvasHeight = msg.height
      dpr = msg.dpr

      if (canvas) {
        canvas.width = msg.width * dpr
        canvas.height = msg.height * dpr
      }
      if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.scale(dpr, dpr)
      }
      break
    }

    case 'SCAFFOLD': {
      scaffoldFixtures = msg.fixtures
      zoneCounts = new Map(msg.zoneCounts as Iterable<[CanonicalZone, number]>)
      // Reset physics for fixtures that no longer exist
      const activeIds = new Set(msg.fixtures.map(f => f.id))
      for (const id of physicsStore.keys()) {
        if (!activeIds.has(id)) {
          physicsStore.delete(id)
          prevIntensity.delete(id)
        }
      }
      break
    }

    case 'FRAME': {
      currentFrameData = msg.frameData
      currentFrameNumber = msg.frameNumber
      currentTimestamp = msg.timestamp
      currentFixtureCount = msg.fixtureCount

      // Beat envelope — rising edge detection
      if (msg.onBeat && !lastOnBeat) {
        beatVisualEnvelope = 1.0
      }
      lastOnBeat = msg.onBeat
      sendMessage({ type: 'FRAME_ACK', frameNumber: msg.frameNumber })
      break
    }

    case 'SELECTION': {
      selectedIds = new Set(msg.selectedIds)
      mutedFixtureIds = new Set(msg.mutedFixtureIds)
      hoveredId = msg.hoveredId
      // Lasso bounds are managed by the worker during mouse events
      // but can be externally set if needed
      if (msg.lassoBounds) {
        lassoBounds = msg.lassoBounds
      }
      // DEBUG: log which muted IDs are present in the fixture scaffold
      if (mutedFixtureIds.size > 0) {
        const fixtureIdSet = new Set(scaffoldFixtures.map((f: import('./hyperion-render.types').WorkerFixtureScaffold) => f.id))
        const matched = [...mutedFixtureIds].filter(id => fixtureIdSet.has(id))
        const missing = [...mutedFixtureIds].filter(id => !fixtureIdSet.has(id))
        console.log(
          `[Worker] muted=${mutedFixtureIds.size}, matched=${matched.length}, missing=[${missing.join(',')}]`
        )
      }
      break
    }

    case 'MOUSE': {
      handleMouse(msg)
      break
    }

    case 'OPTIONS': {
      if (msg.quality !== undefined) quality = msg.quality
      if (msg.showGrid !== undefined) showGrid = msg.showGrid
      if (msg.showZoneLabels !== undefined) showZoneLabels = msg.showZoneLabels
      break
    }

    case 'CAMERA': {
      // 🩸 WAVE 7601: VIRTUAL CAMERA — update pan/zoom state.
      // Applied in the render loop via ctx.translate/ctx.scale.
      cameraZoom = msg.zoom
      cameraPanX = msg.panX
      cameraPanY = msg.panY
      break
    }

    case 'HIBERNATE': {
      if (msg.sleep && !isHibernating) {
        // Enter hibernation — pause RAF loop
        isHibernating = true
        if (animFrameId) cancelAnimationFrame(animFrameId)
        animFrameId = 0
      } else if (!msg.sleep && isHibernating) {
        // Wake up — resume RAF loop
        isHibernating = false
        if (isRunning && ctx) {
          lastFrameTime = performance.now()
          animFrameId = requestAnimationFrame(render)
        }
      }
      break
    }

    case 'GLASS_PORT': {
      // ═════════════════════════════════════════════════════════════════════════
      // GLASS BYPASS Fase 1: worker reads hot frames directly from the port
      // that TacticalCanvas feeds from window.glass.onFrame (Aether Glass SAB).
      // Replaces the FRAME postMessage path from the React data pump.
      // ═════════════════════════════════════════════════════════════════════════
      const typedMsg = msg as unknown as WorkerMsgGlassPort
      if (glassPort) {
        glassPort.close()
      }
      glassPort = typedMsg.port
      const port = glassPort
      port.onmessage = (e: MessageEvent) => {
        const { frameData, fixtureCount, onBeat } = e.data as {
          frameData: Float32Array
          fixtureCount: number
          onBeat: boolean
        }

        // 🏓 OOM-FIX: Return the PREVIOUS frame's buffer to the main thread.
        // The render loop (60fps) has already consumed it at least once since
        // the last frame arrived (44Hz < 60fps), so it's safe to transfer back.
        // This completes the ping-pong: main → worker → main → worker → ...
        if (currentFrameData) {
          const oldBuffer = currentFrameData.buffer
          port.postMessage({ type: 'BUFFER_RETURN', buffer: oldBuffer }, [oldBuffer])
        }

        currentFrameData = frameData
        currentFixtureCount = fixtureCount
        currentFrameNumber++
        currentTimestamp = performance.now()
        if (onBeat && !lastOnBeat) {
          beatVisualEnvelope = 1.0
        }
        lastOnBeat = onBeat
      }
      glassPort.start()
      break
    }

    case 'SHUTDOWN': {
      isRunning = false
      isHibernating = false
      if (animFrameId) cancelAnimationFrame(animFrameId)
      ctx = null
      canvas = null
      physicsStore.clear()
      prevIntensity.clear()
      if (glassPort) {
        // 🏓 Return any held buffer before closing the port
        if (currentFrameData) {
          const heldBuffer = currentFrameData.buffer
          try {
            glassPort.postMessage({ type: 'BUFFER_RETURN', buffer: heldBuffer }, [heldBuffer])
          } catch {}
        }
        glassPort.close()
        glassPort = null
      }
      currentFrameData = null
      break
    }
  }
}
