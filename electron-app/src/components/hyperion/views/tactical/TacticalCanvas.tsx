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
import { useAudioStore } from '../../../../stores/audioStore'
import { useSelectionStore } from '../../../../stores/selectionStore'
import { useFixtureData } from './useFixtureData'
import { getTransientTruth } from '../../../../stores/transientStore'
import { calculateFixtureRenderValues } from '../../../../hooks/useFixtureRender'
import { useControlStore, selectCinemaControl } from '../../../../stores/controlStore'
import { useOverrideStore } from '../../../../stores/overrideStore'
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

import RenderWorkerConstructor from '../../../../workers/hyperion-render.worker?worker'

function createRenderWorker(): Worker {
  return new RenderWorkerConstructor()
}

// ═══════════════════════════════════════════════════════════════════════════
// FRAME DATA PACKING — Main thread → Worker (Transferrable)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Pack fixture frame data into Float32Array for zero-copy transfer.
 * Called every frame in the data pump (~44Hz from hot-frame or ~12.5Hz fallback).
 */
function packFrameData(
  fixtureCount: number,
  fixtureIds: string[],
  transientMap: Map<string, any> | null,
  controlState: ReturnType<typeof useControlStore.getState>,
  overrides: Map<string, any>,
): Float32Array {
  const buffer = new Float32Array(fixtureCount * FLOATS_PER_FIXTURE)
  const cinema = selectCinemaControl(controlState)

  for (let i = 0; i < fixtureCount; i++) {
    const id = fixtureIds[i]
    const transientState = transientMap?.get(id)
    const offset = i * FLOATS_PER_FIXTURE

    if (transientState) {
      const fixtureOverride = overrides.get(id)
      const renderData = calculateFixtureRenderValues(
        transientState,
        cinema.globalMode,
        cinema.flowParams,
        cinema.activePaletteId,
        cinema.globalIntensity,
        cinema.globalSaturation,
        i,
        fixtureOverride?.values,
        fixtureOverride?.mask,
        cinema.targetPalette,
        cinema.transitionProgress
      )

      const rawInt = renderData.intensity ?? 0
      const normInt = !Number.isFinite(rawInt) ? 0 : rawInt > 1.0 ? rawInt / 255 : rawInt

      buffer[offset + FIXTURE_FIELD.R] = Number.isFinite(renderData.color.r) ? renderData.color.r : 0
      buffer[offset + FIXTURE_FIELD.G] = Number.isFinite(renderData.color.g) ? renderData.color.g : 0
      buffer[offset + FIXTURE_FIELD.B] = Number.isFinite(renderData.color.b) ? renderData.color.b : 0
      buffer[offset + FIXTURE_FIELD.INTENSITY] = Math.max(0, Math.min(1, normInt))
      buffer[offset + FIXTURE_FIELD.PHYSICAL_PAN] = Number.isFinite(renderData.physicalPan) ? renderData.physicalPan : 0.5
      buffer[offset + FIXTURE_FIELD.PHYSICAL_TILT] = Number.isFinite(renderData.physicalTilt) ? renderData.physicalTilt : 0.5
      buffer[offset + FIXTURE_FIELD.ZOOM] = Number.isFinite(renderData.zoom) ? renderData.zoom : 127
      buffer[offset + FIXTURE_FIELD.FOCUS] = Number.isFinite(renderData.focus) ? renderData.focus : 127
      buffer[offset + FIXTURE_FIELD.PAN_VELOCITY] = Number.isFinite(renderData.panVelocity) ? renderData.panVelocity : 0
      buffer[offset + FIXTURE_FIELD.TILT_VELOCITY] = Number.isFinite(renderData.tiltVelocity) ? renderData.tiltVelocity : 0
    } else {
      // No transient data — zero fill (fixture appears dark)
      buffer[offset + FIXTURE_FIELD.PHYSICAL_PAN] = 0.5
      buffer[offset + FIXTURE_FIELD.PHYSICAL_TILT] = 0.5
      buffer[offset + FIXTURE_FIELD.ZOOM] = 127
      buffer[offset + FIXTURE_FIELD.FOCUS] = 127
    }
  }

  return buffer
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const TacticalCanvas = memo(function TacticalCanvas({
  quality = 'HQ',
  showGrid = true,
  showZoneLabels = true,
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

  // ── Beat envelope detection (main thread → worker via FRAME msg) ──────
  const lastOnBeatRef = useRef(false)

  // ── State ───────────────────────────────────────────────────────────────
  
  const [isReady, setIsReady] = useState(false)
  const [hoveredFixtureId, setHoveredFixtureId] = useState<string | null>(null)
  const [isLassoActive, setIsLassoActive] = useState(false)

  // ── Store Subscriptions ─────────────────────────────────────────────────
  
  const selectedIds = useSelectionStore(state => state.selectedIds)
  const select = useSelectionStore(state => state.select)
  const selectMultiple = useSelectionStore(state => state.selectMultiple)
  const toggleSelection = useSelectionStore(state => state.toggleSelection)
  const deselectAll = useSelectionStore(state => state.deselectAll)

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
                  tooltipRef.current.onFixtureEnter(fixture.id, {
                    id: fixture.id,
                    name: fixture.id,
                    type: fixture.type === 'moving' ? 'moving-head' as const : fixture.type as any,
                    zone: fixture.zone,
                    dmxAddress: 1,
                    intensity: fixture.intensity,
                    color: { r: fixture.r, g: fixture.g, b: fixture.b },
                    pan: fixture.physicalPan,
                    tilt: fixture.physicalTilt,
                    zoom: fixture.zoom / 255,
                    focus: fixture.focus / 255,
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

    // ── IMMORTAL CLEANUP ───────────────────────────────────────────────
    // This function is intentionally a no-op for Strict Mode survival.
    // The worker and canvas transfer must persist across the fake unmount.
    // In a true production unmount (hot reload, route change), the browser
    // will GC the worker anyway. If we ever need explicit teardown, use the
    // observerRef and workerRef directly from outside this effect.
    return () => {
      // Intentionally empty — The Immortal Worker survives Strict Mode.
      // See architecture note above (CSS persistence, session lifetime).
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
    })
  }, [selectedIds, hoveredFixtureId, isReady, postToWorker])

  // ── Send options changes to worker ────────────────────────────────────
  useEffect(() => {
    if (!isReady) return
    postToWorker({ type: 'OPTIONS', quality, showGrid, showZoneLabels })
  }, [quality, showGrid, showZoneLabels, isReady, postToWorker])

  // ── WAVE 2515: Hibernation Protocol ───────────────────────────────────
  // When the 2D view is CSS-hidden, pause the worker RAF and stop the
  // main-thread data pump. Zero GPU/CPU burn in background.
  useEffect(() => {
    if (!isReady) return
    postToWorker({ type: 'HIBERNATE', sleep: !isVisible })
  }, [isVisible, isReady, postToWorker])

  // ═══════════════════════════════════════════════════════════════════════
  // DATA PUMP — Feed fixture frame data to worker at IPC rate
  // ═══════════════════════════════════════════════════════════════════════
  // This runs on a RAF loop on main thread but does NO rendering.
  // It reads transientStore + controlStore + overrideStore,
  // packs into Float32Array, and transfers to worker.
  // When Phase 2 hot-frame is active, this will be replaced by
  // direct hot-frame → worker forwarding in useSeleneTruth.

  useEffect(() => {
    if (!isReady || !isVisible) return

    let frameNumber = 0
    let rafId = 0

    const pump = () => {
      const currentFixtures = fixturesRef.current
      if (currentFixtures.length === 0) {
        rafId = requestAnimationFrame(pump)
        return
      }

      // Read transient truth
      const transientTruth = getTransientTruth()
      const transientFixtures = transientTruth?.hardware?.fixtures
      let transientMap: Map<string, any> | null = null
      if (transientFixtures && Array.isArray(transientFixtures)) {
        transientMap = new Map()
        for (const f of transientFixtures) {
          if (f?.id) transientMap.set(f.id, f)
        }
      }

      // Beat detection (rising edge)
      const audioState = useAudioStore.getState()
      const currentOnBeat = audioState.onBeat
      const isNewBeat = currentOnBeat && !lastOnBeatRef.current
      lastOnBeatRef.current = currentOnBeat

      // Pack frame data
      const fixtureIds = currentFixtures.map(f => f.id)
      const controlState = useControlStore.getState()
      const overrides = useOverrideStore.getState().overrides
      const frameData = packFrameData(
        currentFixtures.length,
        fixtureIds,
        transientMap,
        controlState,
        overrides,
      )

      frameNumber++

      // Send to worker with Transferrable (zero-copy)
      const msg: WorkerInboundMessage = {
        type: 'FRAME',
        frameNumber,
        timestamp: performance.now(),
        onBeat: isNewBeat,
        beatIntensity: isNewBeat ? 1.0 : 0,
        fixtureCount: currentFixtures.length,
        frameData,
      }
      postToWorker(msg, [frameData.buffer])

      rafId = requestAnimationFrame(pump)
    }

    rafId = requestAnimationFrame(pump)

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [isReady, isVisible, postToWorker])

  // ── Mouse Handlers (DOM → Worker) ─────────────────────────────────────
  
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
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
  }, [postToWorker])

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
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

  // ── Cursor Class ────────────────────────────────────────────────────────
  
  const cursorClass = useMemo(() => {
    if (isLassoActive) return 'selecting'
    if (hoveredFixtureId) return 'hovering'
    return ''
  }, [isLassoActive, hoveredFixtureId])

  // ── Render ──────────────────────────────────────────────────────────────
  
  return (
    <div 
      ref={containerRef}
      className={`tactical-canvas-container ${isReady ? '' : 'loading'} ${className}`}
    >
      <canvas
        ref={canvasRef}
        className={`tactical-canvas ${cursorClass}`}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />

      {/* Tooltip Overlay */}
      <div className="tactical-canvas-overlay">
        <FixtureTooltip
          data={tooltip.data}
          position={tooltip.position}
          visible={tooltip.visible}
        />
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
