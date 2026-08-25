/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ☀️ HYPERION — Tactical Canvas (OffscreenCanvas + Web Worker)
 * "The 4th Worker — El Corazón Late en Otro Hilo"
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 2510: Operación Hyperion — Canvas moved to dedicated Web Worker.
 * Main thread ONLY handles: DOM events, React state, tooltip overlay.
 * ALL rendering (5 layers, physics, hit testing) runs in the worker.
 * 
 * ARCHITECTURE:
 * - Mount: transferControlToOffscreen → worker.postMessage('INIT')
 * - Resize: ResizeObserver → worker.postMessage('RESIZE')
 * - Mouse: DOM events → worker.postMessage('MOUSE')
 * - Data: useSeleneTruth hot-frame → worker.postMessage('FRAME')
 * - Selection: selectionStore changes → worker.postMessage('SELECTION')
 * - Worker sends back: HIT_TEST, LASSO_COMPLETE, METRICS
 * 
 * @module components/hyperion/views/tactical/TacticalCanvas
 * @since WAVE 2042.5 (Project Hyperion — Phase 3)
 * @rewrite WAVE 2510 (The 4th Worker — OffscreenCanvas architecture)
 */

import React, { 
  useRef, 
  useEffect, 
  useCallback, 
  useState,
  useMemo,
  memo 
} from 'react'
import { useSelectionStore } from '../../../../stores/selectionStore'
import { useStageStore, selectStageDimensions } from '../../../../stores/stageStore'
import { useFixtureData } from './useFixtureData'
import {
  getCanvasMousePosition,
} from './HitTestEngine'
import { FixtureTooltip, useFixtureTooltip } from '../../widgets'
import type { 
  RenderMetrics,
  QualityMode
} from './types'
import { DEFAULT_TACTICAL_OPTIONS } from './types'
import { type CanonicalZone } from '../../shared/ZoneLayoutEngine'
import { FLOATS_PER_FIXTURE, FIXTURE_FIELD } from '../../../../workers/hyperion-render.types'
import { getTransientFixture } from '../../../../stores/transientStore'
import type {
  WorkerInboundMessage,
  WorkerOutboundMessage,
  WorkerFixtureScaffold,
} from '../../../../workers/hyperion-render.types'
import './TacticalCanvas.css'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface TacticalCanvasProps {
  /** Quality mode */
  quality?: QualityMode
  /** Show tactical grid */
  showGrid?: boolean
  /** Show zone labels */
  showZoneLabels?: boolean
  /** Callback when fixture is selected */
  onFixtureSelect?: (fixtureId: string, additive: boolean) => void
  /** Callback when selection changes via lasso */
  onSelectionChange?: (fixtureIds: string[]) => void
  /** WAVE 2515: Hibernation — when false, pauses data pump + worker RAF */
  isVisible?: boolean
  /** Additional CSS class */
  className?: string
}

// ═══════════════════════════════════════════════════════════════════════════
// WORKER INSTANTIATION — Vite ?worker suffix (OPERACIÓN LÁZARO, WAVE 2520)
// Using the ?worker import syntax instead of new URL() — Vite bundles the
// worker correctly for Electron's renderer process with this pattern.
// ═══════════════════════════════════════════════════════════════════════════

import RenderWorkerConstructor from '../../../../workers/hyperion-render.worker?worker&inline'

interface RulerTick {
  value: number
  percent: number
}

function buildRulerTicks(sizeMeters: number): RulerTick[] {
  const safeSize = Number.isFinite(sizeMeters) && sizeMeters > 0 ? sizeMeters : 1
  const step = safeSize <= 12 ? 1 : safeSize <= 30 ? 2 : 5
  const ticks: RulerTick[] = []
  for (let v = 0; v <= safeSize; v += step) {
    ticks.push({ value: v, percent: (v / safeSize) * 100 })
  }
  if (ticks[ticks.length - 1]?.value !== safeSize) {
    ticks.push({ value: safeSize, percent: 100 })
  }
  return ticks
}

function createRenderWorker(): Worker {
  return new RenderWorkerConstructor()
}

// ═══════════════════════════════════════════════════════════════════════════
// GLASS FRAME PACKING — Aether Glass → Worker 10-float layout
// ═══════════════════════════════════════════════════════════════════════════

// Glass buffer layout (from layout.ts FixField + TickEngine header)
// Header floats [0..9]: bass, mid, high, energy, isBeat, reserved×5
// Fixture block i starts at: GLASS_HEADER_FLOATS + i * GLASS_FLOATS_PER_FIX
const GLASS_HEADER_FLOATS = 10
const GLASS_FLOATS_PER_FIX = 16
const GF_R = 0, GF_G = 1, GF_B = 2
const GF_DIMMER = 5
const GF_PHYS_PAN = 8, GF_PHYS_TILT = 9
const GF_ZOOM = 10, GF_FOCUS = 11
const GF_PAN_VEL = 12, GF_TILT_VEL = 13

/**
 * Translate Aether Glass Float32Array (16 floats/fixture, raw DMX scale)
 * into the Worker's 10-float packed buffer (normalizes intensity/pan/tilt to 0-1).
 * Zero-allocation — writes into pre-allocated destBuffer.
 *
 * 🛡️ WAVE 7569: NaN SHIELD — every value is sanitized to 0 if non-finite
 * before writing to destBuffer. This prevents poisoned memory from reaching
 * the render worker, where NaN would silently disable fixture drawing
 * (ctx.lineTo(NaN, ...) is a silent no-op in Chromium).
 */
function packGlassFrameInto(
  destBuffer: Float32Array,
  glassView: Float32Array,
  fixtureCount: number,
): void {
  for (let i = 0; i < fixtureCount; i++) {
    const gOff = GLASS_HEADER_FLOATS + i * GLASS_FLOATS_PER_FIX
    const wOff = i * FLOATS_PER_FIXTURE
    const r   = glassView[gOff + GF_R]
    const g   = glassView[gOff + GF_G]
    const b   = glassView[gOff + GF_B]
    const dim = glassView[gOff + GF_DIMMER]
    const pPan  = glassView[gOff + GF_PHYS_PAN]
    const pTilt = glassView[gOff + GF_PHYS_TILT]
    const zoom  = glassView[gOff + GF_ZOOM]
    const focus = glassView[gOff + GF_FOCUS]
    const panV  = glassView[gOff + GF_PAN_VEL]
    const tiltV = glassView[gOff + GF_TILT_VEL]
    destBuffer[wOff + FIXTURE_FIELD.R]             = Number.isFinite(r) ? r : 0
    destBuffer[wOff + FIXTURE_FIELD.G]             = Number.isFinite(g) ? g : 0
    destBuffer[wOff + FIXTURE_FIELD.B]             = Number.isFinite(b) ? b : 0
    destBuffer[wOff + FIXTURE_FIELD.INTENSITY]     = Number.isFinite(dim) ? dim / 255 : 0
    destBuffer[wOff + FIXTURE_FIELD.PHYSICAL_PAN]  = Number.isFinite(pPan) ? pPan / 255 : 0
    destBuffer[wOff + FIXTURE_FIELD.PHYSICAL_TILT] = Number.isFinite(pTilt) ? pTilt / 255 : 0
    destBuffer[wOff + FIXTURE_FIELD.ZOOM]          = Number.isFinite(zoom) ? zoom : 0
    destBuffer[wOff + FIXTURE_FIELD.FOCUS]         = Number.isFinite(focus) ? focus : 0
    destBuffer[wOff + FIXTURE_FIELD.PAN_VELOCITY]  = Number.isFinite(panV) ? panV : 0
    destBuffer[wOff + FIXTURE_FIELD.TILT_VELOCITY] = Number.isFinite(tiltV) ? tiltV : 0
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const TacticalCanvas = memo(function TacticalCanvas({
  quality = 'HQ',
  showGrid = true,
  showZoneLabels = false,
  onFixtureSelect,
  onSelectionChange,
  isVisible = true,
  className = '',
}: TacticalCanvasProps) {
  // ── Refs ────────────────────────────────────────────────────────────────
  
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const workerRef = useRef<Worker | null>(null)
  // ⚠️ WAVE 2520 — THE IMMORTAL WORKER (Strict Mode solution):
  // transferControlToOffscreen() is a one-shot, irreversible operation per DOM node.
  // React Strict Mode runs Setup→Cleanup→Setup in rapid succession on the SAME node.
  // The canvasKey workaround fails because setState is async — the second Setup fires
  // before React repaints with the new key.
  //
  // Solution: check workerRef.current at the top of the init useEffect.
  // If the worker already exists (Strict Mode second run), bail out immediately.
  // No transfer, no re-instantiation, no crash.
  //
  // This is safe because TacticalCanvas is CSS-persisted (visibility:hidden, never
  // unmounted in production). The worker lives for the entire session lifetime.
  const observerRef = useRef<ResizeObserver | null>(null)
  const isTransferredRef = useRef(false)
  const metricsRef = useRef<RenderMetrics>({
    fps: 60,
    frameTime: 0,
    fixtureCount: 0,
    lastRenderTime: 0,
  })

  // 🏓 OOM-FIX: Double-Buffer Ping-Pong pool — zero allocation in the hot path.
  // Two Float32Array slots alternate: one is transferred to the worker, the other
  // is ready for the next frame. The worker returns the consumed buffer via
  // BUFFER_RETURN, which is placed back into the pool.
  // If a slot is null (buffer in-flight), a new one is allocated as fallback.
  const bufferPool = useRef<(Float32Array | null)[]>([null, null])
  const poolIdx = useRef(0)

  // ── State ───────────────────────────────────────────────────────────────

  const [isReady, setIsReady] = useState(false)
  const [hoveredFixtureId, setHoveredFixtureId] = useState<string | null>(null)
  const [isLassoActive, setIsLassoActive] = useState(false)

  // 🩸 WAVE 7600: TACTICAL ZOOM & PAN — for high-density fixture counts.
  // zoom: 1 = default, 0.5 = zoomed out, 5 = zoomed in
  // pan: {x, y} pixel offset for panning the viewport
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  // Refs for pan-drag (middle-click or spacebar+drag) — avoid re-renders during drag
  const isPanningRef = useRef(false)
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 })
  const [isSpaceDown, setIsSpaceDown] = useState(false)
  const [isPanning, setIsPanning] = useState(false)

  // ── Store Subscriptions ─────────────────────────────────────────────────
  
  const selectedIds = useSelectionStore(state => state.selectedIds)
  const mutedFixtureIds = useSelectionStore(state => state.mutedFixtureIds)
  const select = useSelectionStore(state => state.select)
  const selectMultiple = useSelectionStore(state => state.selectMultiple)
  const toggleSelection = useSelectionStore(state => state.toggleSelection)
  const deselectAll = useSelectionStore(state => state.deselectAll)
  const stageDims = useStageStore(selectStageDimensions)

  const stageWidthMeters = stageDims?.width ?? 12
  const stageDepthMeters = stageDims?.depth ?? 8
  const rulerTicksX = useMemo(() => buildRulerTicks(stageWidthMeters), [stageWidthMeters])
  const rulerTicksY = useMemo(() => buildRulerTicks(stageDepthMeters), [stageDepthMeters])

  // ── Fixture Data (structural scaffold) ──────────────────────────────────
  
  const fixtures = useFixtureData()
  const fixturesRef = useRef(fixtures)
  fixturesRef.current = fixtures
  
  // ── Tooltip Hook ────────────────────────────────────────────────────────
  
  const tooltip = useFixtureTooltip({
    showDelay: 120,
    enabled: true,
  })

  // ── Zone Counts ─────────────────────────────────────────────────────────
  
  const zoneCounts = useMemo(() => {
    const counts = new Map<CanonicalZone, number>()
    for (const fixture of fixtures) {
      const current = counts.get(fixture.zone) ?? 0
      counts.set(fixture.zone, current + 1)
    }
    return counts
  }, [fixtures])

  // ═══════════════════════════════════════════════════════════════════════
  // WORKER LIFECYCLE — Init, communication, crash recovery
  // ═══════════════════════════════════════════════════════════════════════

  // Helper to post message to worker (safe — checks worker exists)
  const postToWorker = useCallback((msg: WorkerInboundMessage, transfer?: Transferable[]) => {
    const w = workerRef.current
    if (!w) return
    if (transfer && transfer.length > 0) {
      w.postMessage(msg, transfer)
    } else {
      w.postMessage(msg)
    }
  }, [])

  // ── Worker Init & Canvas Transfer ─────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    // ── THE IMMORTAL GUARD ─────────────────────────────────────────────
    // Strict Mode fires Setup→Cleanup→Setup on the same DOM node.
    // If the worker already exists, we survived the fake unmount — bail out.
    // transferControlToOffscreen() must NEVER be called twice on the same node.
    if (workerRef.current) return

    const rect = container.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio, DEFAULT_TACTICAL_OPTIONS.maxDPR)

    // Set CSS display size (worker controls physical pixels)
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`

    // Transfer canvas ownership to worker (irreversible, one-shot per node)
    let offscreen: OffscreenCanvas
    try {
      offscreen = canvas.transferControlToOffscreen()
    } catch (e) {
      const detail = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
      console.error('[Hyperion] OffscreenCanvas transfer failed —', detail)
      return
    }
    isTransferredRef.current = true

    // Create worker
    const worker = createRenderWorker()
    workerRef.current = worker

    // Handle messages from worker
    worker.onmessage = (e: MessageEvent<WorkerOutboundMessage>) => {
      const msg = e.data
      switch (msg.type) {
        case 'READY':
          setIsReady(true)
          break

        case 'HIT_TEST': {
          if (msg.action === 'move') {
            if (msg.fixtureId !== hoveredFixtureIdRef.current) {
              setHoveredFixtureId(msg.fixtureId)
              if (msg.fixtureId) {
                const fixture = fixturesRef.current.find(f => f.id === msg.fixtureId)
                if (fixture) {
                  // Read live physics from transientStore (zero-cost imperative read)
                  const liveState = getTransientFixture(fixture.id)
                  tooltipRef.current.onFixtureEnter(fixture.id, {
                    id: fixture.id,
                    name: fixture.id,
                    type: fixture.type === 'moving' ? 'moving-head' as const : fixture.type as any,
                    zone: fixture.zone,
                    dmxAddress: 1,
                    intensity: liveState ? Math.min(1, liveState.dimmer / 255) : fixture.intensity,
                    color: liveState?.color
                      ? { r: liveState.color.r, g: liveState.color.g, b: liveState.color.b }
                      : { r: fixture.r, g: fixture.g, b: fixture.b },
                    pan: liveState?.physicalPan ?? fixture.physicalPan,
                    tilt: liveState?.physicalTilt ?? fixture.physicalTilt,
                    zoom: (liveState?.zoom ?? fixture.zoom) / 255,
                    focus: (liveState?.focus ?? fixture.focus) / 255,
                    selected: useSelectionStore.getState().selectedIds.has(fixture.id),
                    hasOverride: false,
                  }, { x: msg.mouseX, y: msg.mouseY })
                }
              } else {
                tooltipRef.current.onFixtureLeave()
              }
            } else if (msg.fixtureId) {
              tooltipRef.current.onFixtureMove({ x: msg.mouseX, y: msg.mouseY })
            }
          } else if (msg.action === 'down' && msg.fixtureId) {
            const isToggle = msg.ctrlKey || msg.metaKey
            const isAdditive = msg.shiftKey
            if (isToggle) {
              toggleSelection(msg.fixtureId)
            } else if (isAdditive) {
              select(msg.fixtureId, 'add')
            } else {
              select(msg.fixtureId, 'replace')
            }
            onFixtureSelect?.(msg.fixtureId, isToggle || isAdditive)
          } else if (msg.action === 'down' && !msg.fixtureId) {
            if (!msg.shiftKey && !msg.ctrlKey && !msg.metaKey) {
              deselectAll()
            }
            setIsLassoActive(true)
          }
          break
        }

        case 'LASSO_COMPLETE': {
          setIsLassoActive(false)
          if (msg.fixtureIds.length > 0) {
            selectMultiple(msg.fixtureIds, msg.additive ? 'add' : 'replace')
            onSelectionChange?.(msg.fixtureIds)
          }
          break
        }

        case 'METRICS':
          metricsRef.current = {
            fps: msg.fps,
            frameTime: msg.frameTime,
            fixtureCount: msg.fixtureCount,
            lastRenderTime: performance.now(),
          }
          break

        case 'ERROR':
          console.error('[Hyperion Worker]', msg.message)
          break
      }
    }

    worker.onerror = (err) => {
      console.error('[Hyperion Worker CRASH]', err.message)
    }

    // Send INIT with transferred OffscreenCanvas
    const initMsg: WorkerInboundMessage = {
      type: 'INIT',
      canvas: offscreen,
      width: rect.width,
      height: rect.height,
      dpr,
      quality,
      showGrid,
      showZoneLabels,
    }
    worker.postMessage(initMsg, [offscreen])

    // ResizeObserver — forward to worker
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        const currentDpr = Math.min(window.devicePixelRatio, DEFAULT_TACTICAL_OPTIONS.maxDPR)
        if (canvas) {
          canvas.style.width = `${width}px`
          canvas.style.height = `${height}px`
        }
        postToWorker({ type: 'RESIZE', width, height, dpr: currentDpr })
      }
    })
    observer.observe(container)
    observerRef.current = observer

    // ── DETERMINISTIC CLEANUP ───────────────────────────────────────────
    // WAVE 3502: Explicit teardown to avoid residual queues/listeners.
    return () => {
      // En dev (React Strict Mode), el fake unmount no debe destruir el worker
      // porque OffscreenCanvas no puede transferirse dos veces sobre el mismo nodo.
      if (import.meta.env.DEV) {
        return
      }

      try {
        observerRef.current?.disconnect()
      } catch {}
      observerRef.current = null

      const activeWorker = workerRef.current
      if (activeWorker) {
        try {
          activeWorker.postMessage({ type: 'SHUTDOWN' })
        } catch {}
        activeWorker.onmessage = null
        activeWorker.onerror = null
        activeWorker.terminate()
      }
      workerRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Stable refs for worker message handler closures ────────────────────
  const hoveredFixtureIdRef = useRef(hoveredFixtureId)
  hoveredFixtureIdRef.current = hoveredFixtureId
  const tooltipRef = useRef(tooltip)
  tooltipRef.current = tooltip

  // ── Send scaffold to worker when fixtures change ──────────────────────
  useEffect(() => {
    if (!isReady) return

    const scaffold: WorkerFixtureScaffold[] = fixtures.map(f => ({
      id: f.id,
      x: f.x,
      y: f.y,
      type: f.type,
      zone: f.zone,
      gobo: f.gobo,
      prism: f.prism,
    }))

    const zoneCountsArray = Array.from(zoneCounts.entries())
    postToWorker({ type: 'SCAFFOLD', fixtures: scaffold, zoneCounts: zoneCountsArray })
  }, [fixtures, zoneCounts, isReady, postToWorker])

  // ── Send selection state to worker ────────────────────────────────────
  useEffect(() => {
    if (!isReady) return
    postToWorker({
      type: 'SELECTION',
      selectedIds: Array.from(selectedIds),
      hoveredId: hoveredFixtureId,
      lassoBounds: null,
      mutedFixtureIds: Array.from(mutedFixtureIds),
    })
  }, [selectedIds, mutedFixtureIds, hoveredFixtureId, isReady, postToWorker])

  // ── Send options changes to worker ────────────────────────────────────
  useEffect(() => {
    if (!isReady) return
    postToWorker({ type: 'OPTIONS', quality, showGrid, showZoneLabels })
  }, [quality, showGrid, showZoneLabels, isReady, postToWorker])

  // ── 🩸 WAVE 7601: Send camera state (zoom/pan) to worker ──────────────
  // The worker applies ctx.translate/ctx.scale inside its render loop.
  // This keeps the canvas DOM element at 100% width/height (no dead space).
  useEffect(() => {
    if (!isReady) return
    postToWorker({ type: 'CAMERA', zoom, panX: pan.x, panY: pan.y })
  }, [zoom, pan, isReady, postToWorker])

  // ── WAVE 2515: Hibernation Protocol ───────────────────────────────────
  // When the 2D view is CSS-hidden, pause the worker RAF and stop the
  // main-thread data pump. Zero GPU/CPU burn in background.
  useEffect(() => {
    if (!isReady) return
    postToWorker({ type: 'HIBERNATE', sleep: !isVisible })
  }, [isVisible, isReady, postToWorker])

  // ═══════════════════════════════════════════════════════════════════════
  // GLASS PIPELINE — Connect Aether Glass directly to worker (GLASS BYPASS Fase 2)
  // ═══════════════════════════════════════════════════════════════════════
  // Replaces the old RAF data pump (React/IPC chain) with a direct subscription
  // to window.glass.onFrame (Aether Glass SAB). Translation from Glass 16-float
  // layout → Worker 10-float layout happens here on the main thread, then the
  // packed buffer is forwarded to the worker via a dedicated MessageChannel port.

  useEffect(() => {
    if (!isReady) return
    const worker = workerRef.current
    if (!worker) return

    // Create a dedicated MessageChannel: port2 lives in the worker, port1 here.
    const channel = new MessageChannel()
    worker.postMessage({ type: 'GLASS_PORT', port: channel.port2 }, [channel.port2])

    // 🏓 OOM-FIX: Listen for BUFFER_RETURN from worker — reclaim transferred buffers.
    // The worker returns the previous frame's buffer when a new frame arrives.
    // We wrap it back into a Float32Array view and place it in the first null pool slot.
    channel.port1.onmessage = (e: MessageEvent) => {
      if (e.data?.type === 'BUFFER_RETURN' && e.data.buffer instanceof ArrayBuffer) {
        const view = new Float32Array(e.data.buffer)
        for (let i = 0; i < bufferPool.current.length; i++) {
          if (bufferPool.current[i] === null) {
            bufferPool.current[i] = view
            break
          }
        }
      }
    }

    let glassUnsub: (() => void) | null = null

    const startGlassPipeline = () => {
      const g = (window as any).glass
      if (!g) return
      glassUnsub = g.onFrame((view: Float32Array) => {
        const count = fixturesRef.current.length

        // WAVE 6061 FIX: Always post to worker, even with count===0.
        // If we return early, the worker's currentFixtureCount stays stale
        // (e.g. at 0 from bootstrap). When fixtures load later, the canvas
        // stays blank because Math.min(scaffoldFixtures.length, 0) = 0.
        const needed = count * FLOATS_PER_FIXTURE

        // 🏓 Ping-Pong: take the current slot from the pool.
        // If it's null (buffer in-flight) or too small, allocate a fresh one.
        let buf = bufferPool.current[poolIdx.current]
        if (!buf || buf.length < needed) {
          buf = new Float32Array(needed)
        }

        if (count > 0) {
          // Translate Glass 16-float layout → Worker 10-float layout
          packGlassFrameInto(buf, view, count)
        }
        const onBeat = view.length > 4 && view[4] > 0.5

        // 🏓 Transfer the buffer to the worker (zero-copy).
        // Mark this pool slot as in-flight (null) and advance to the next slot.
        // The worker will return it via BUFFER_RETURN when the next frame arrives.
        channel.port1.postMessage({ frameData: buf, fixtureCount: count, onBeat }, [buf.buffer])
        bufferPool.current[poolIdx.current] = null
        poolIdx.current = (poolIdx.current + 1) % 2
      })
    }

    if ((window as any).glass) {
      startGlassPipeline()
    } else {
      window.addEventListener('glass:ready', startGlassPipeline, { once: true })
    }

    return () => {
      glassUnsub?.()
      window.removeEventListener('glass:ready', startGlassPipeline)
      channel.port1.close()
    }
  }, [isReady])

  // ── Mouse Handlers (DOM → Worker) ─────────────────────────────────────
  // 🩸 WAVE 7601: VIRTUAL CAMERA — mouse coords are now in raw canvas space
  // (0..canvasWidth). The worker applies the inverse camera transform
  // internally to map them into the virtual world space for hit testing.

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    // 🩸 WAVE 7600: Pan-drag takes priority over worker mouse events
    if (isPanningRef.current) {
      const dx = e.clientX - panStartRef.current.x
      const dy = e.clientY - panStartRef.current.y
      setPan({ x: panStartRef.current.panX + dx, y: panStartRef.current.panY + dy })
      return
    }

    const pos = getCanvasMousePosition(e.nativeEvent, canvas)
    postToWorker({
      type: 'MOUSE',
      action: 'move',
      x: pos.x,
      y: pos.y,
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey,
    })
  }, [postToWorker])

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    // 🩸 WAVE 7600: Middle-click OR spacebar+click → start panning
    if (e.button === 1 || isSpaceDown) {
      e.preventDefault()
      isPanningRef.current = true
      setIsPanning(true)
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        panX: pan.x,
        panY: pan.y,
      }
      return
    }

    const pos = getCanvasMousePosition(e.nativeEvent, canvas)
    postToWorker({
      type: 'MOUSE',
      action: 'down',
      x: pos.x,
      y: pos.y,
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey,
    })
  }, [postToWorker, isSpaceDown, pan])

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // 🩸 WAVE 7600: End pan-drag
    if (isPanningRef.current) {
      isPanningRef.current = false
      setIsPanning(false)
      return
    }
    postToWorker({
      type: 'MOUSE',
      action: 'up',
      x: 0,
      y: 0,
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey,
    })
    setIsLassoActive(false)
  }, [postToWorker])

  const handleMouseLeave = useCallback(() => {
    // 🩸 WAVE 7600: Don't fire leave if panning
    if (isPanningRef.current) return
    postToWorker({
      type: 'MOUSE',
      action: 'leave',
      x: 0,
      y: 0,
      shiftKey: false,
      ctrlKey: false,
      metaKey: false,
    })
    setHoveredFixtureId(null)
    tooltip.onFixtureLeave()
    setIsLassoActive(false)
  }, [postToWorker, tooltip])

  // ── Zoom & Pan Handlers (WAVE 7600) ────────────────────────────────────

  const ZOOM_MIN = 0.5
  const ZOOM_MAX = 5
  const ZOOM_STEP = 0.25

  const clampZoom = useCallback((z: number) => {
    return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z))
  }, [])

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    // 🩸 WAVE 7600: Ctrl+wheel = zoom (prevent default page scroll)
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
      setZoom(prev => clampZoom(prev + delta))
    }
  }, [clampZoom])

  // Non-passive wheel listener — React's onWheel is passive by default in
  // some browsers, so we need a native listener to call preventDefault().
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const nativeWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
        setZoom(prev => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, prev + delta)))
      }
    }
    container.addEventListener('wheel', nativeWheel, { passive: false })
    return () => container.removeEventListener('wheel', nativeWheel)
  }, [])

  // Spacebar pan mode
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        // Don't intercept if focus is in an input/textarea
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
        e.preventDefault()
        setIsSpaceDown(true)
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpaceDown(false)
        // Also end any active pan
        if (isPanningRef.current) {
          isPanningRef.current = false
          setIsPanning(false)
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  // Floating UI button handlers
  const handleZoomIn = useCallback(() => {
    setZoom(prev => clampZoom(prev + ZOOM_STEP))
  }, [clampZoom])

  const handleZoomOut = useCallback(() => {
    setZoom(prev => clampZoom(prev - ZOOM_STEP))
  }, [clampZoom])

  const handleZoomReset = useCallback(() => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [])

  // ── Cursor Class ────────────────────────────────────────────────────────
  
  const cursorClass = useMemo(() => {
    if (isPanning || isSpaceDown) return 'panning'
    if (isLassoActive) return 'selecting'
    if (hoveredFixtureId) return 'hovering'
    return ''
  }, [isLassoActive, hoveredFixtureId, isPanning, isSpaceDown])

  // ── Render ──────────────────────────────────────────────────────────────
  
  return (
    <div
      ref={containerRef}
      className={`tactical-canvas-container ${isReady ? '' : 'loading'} ${className}`}
      onWheel={handleWheel}
    >
      {/* 🩸 WAVE 7601: VIRTUAL CAMERA — canvas stays at 100% width/height.
          Pan/Zoom is applied inside the worker's ctx transform, NOT via CSS.
          This avoids dead black space when zooming out. */}
      <canvas
        ref={canvasRef}
        className={`tactical-canvas ${cursorClass}`}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />

      <div className="tactical-rulers" aria-hidden="true">
        <div className="tactical-ruler tactical-ruler--top">
          {rulerTicksX.map((tick) => (
            <div
              key={`x-${tick.value}`}
              className="tactical-ruler-tick tactical-ruler-tick--x"
              style={{ left: `${tick.percent}%` }}
            >
              <span className="tactical-ruler-label">{tick.value}m</span>
            </div>
          ))}
        </div>
        <div className="tactical-ruler tactical-ruler--left">
          {rulerTicksY.map((tick) => (
            <div
              key={`y-${tick.value}`}
              className="tactical-ruler-tick tactical-ruler-tick--y"
              style={{ top: `${tick.percent}%` }}
            >
              <span className="tactical-ruler-label">{tick.value}m</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tooltip Overlay */}
      <div className="tactical-canvas-overlay">
        <FixtureTooltip
          data={tooltip.data}
          position={tooltip.position}
          visible={tooltip.visible}
        />
      </div>

      {/* 🩸 WAVE 7600: Floating Zoom Controls — bottom-right corner.
          Dark minimalist aesthetic matching Hyperion UI. */}
      <div className="tactical-zoom-controls">
        <button
          className="tactical-zoom-btn"
          onClick={handleZoomIn}
          aria-label="Zoom in"
          title="Zoom in (Ctrl+Scroll)"
        >
          +
        </button>
        <span className="tactical-zoom-level">{Math.round(zoom * 100)}%</span>
        <button
          className="tactical-zoom-btn"
          onClick={handleZoomOut}
          aria-label="Zoom out"
          title="Zoom out (Ctrl+Scroll)"
        >
          −
        </button>
        <button
          className="tactical-zoom-btn tactical-zoom-btn--reset"
          onClick={handleZoomReset}
          aria-label="Reset zoom and pan"
          title="Reset (1:1)"
        >
          ⟲
        </button>
      </div>

      {/* Empty State */}
      {isReady && fixtures.length === 0 && (
        <div className="tactical-canvas-empty">
          NO FIXTURES LOADED
        </div>
      )}
    </div>
  )
})

TacticalCanvas.displayName = 'TacticalCanvas'
