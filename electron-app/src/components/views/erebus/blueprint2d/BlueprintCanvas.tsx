import React, { useMemo, useState, useCallback, useRef, useLayoutEffect, useEffect } from 'react'
import { useStageStore } from '../../../../stores/stageStore'
import { useSelectionStore } from '../../../../stores/selectionStore'
import { useLibraryStore } from '../../../../stores/libraryStore'
import { useSnapStore } from '../../../../stores/snapStore'
import { createDefaultFixture } from '../../../../core/stage/ShowFileV2'
import { PaperLayer } from './layers/PaperLayer'
import { GridLayer } from './layers/GridLayer'
import { RulerLayer } from './layers/RulerLayer'
import { ArchitectureLayer } from './layers/ArchitectureLayer'
import { ZoneLayer } from './layers/ZoneLayer'
import { SymbolLayer, type FixtureSymbolData } from './layers/SymbolLayer'
import { DimensionLayer } from './layers/DimensionLayer'
import { DragDropController2D, type DragState2D, type DragHandlers } from './interaction/DragDropController2D'
import { LassoSelection } from './interaction/LassoSelection'
import { CoverageRing } from './interaction/CoverageRing'
import { ElevationScrubber, type ElevationState } from './elevation/ElevationScrubber'
import { SectionProfileGhost } from './elevation/SectionProfileGhost'
import { RigPlanLayer } from './layers/RigPlanLayer'
import { MeasureLayer2D } from './interaction/MeasureLayer2D'
import { useScreenToSVG } from './interaction/screenToSVG'
import type { ToolMode } from '../ErebusShell'

// ═══════════════════════════════════════════════════════════════════════════
// BlueprintCanvas — El Viewport SVG
// PROYECTO EREBUS — FASE 4 + FASE 7 + WAVE 7649 + 7651 + 7653
//
// Contenedor raíz del lienzo 2D (Blueprint Mode).
// Ocupa el 100% del espacio bajo el HUD.
// viewBox en METROS — paridad matemática exacta con R3F.
//
// Coordinate system (matches 3D):
//   X: Left (-) to Right (+) — stage width
//   Z: Back (-) to Front (+) — stage depth
//   SVG Y axis = 3D Z axis (top-down view)
//
// WAVE 7653: ZERO-LAG EXECUTION
//   1. Layout thrashing eradicated: container rect cached in a ref, updated
//      only by ResizeObserver. Wheel handler reads from the ref — never
//      calls getBoundingClientRect.
//   2. Cursor state decoupled from React: spaceHeld/isPanning are refs.
//      Cursor is mutated directly via svgRef.current.style.cursor.
//   3. viewBox ownership surrendered to DOM: no viewBox prop on <svg>.
//      Initial value set via useLayoutEffect; applyViewBoxDOM() has
//      exclusive control. React can never overwrite it during re-renders.
//   4. scheduleSync uses trailing debounce: only fires after the user
//      STOPS zooming for 150ms — no continuous re-renders during scroll.
// ═══════════════════════════════════════════════════════════════════════════

interface BlueprintCanvasProps {
  /** Stage width in meters (default 12) */
  stageWidth?: number
  /** Stage depth in meters (default 8) */
  stageDepth?: number
  /** Padding around stage in meters (default 2) */
  padding?: number
  /** Inline style override (for crossfade opacity during transition) */
  style?: React.CSSProperties
  /** Active tool mode */
  toolMode?: ToolMode
}

// ── Zoom bounds ───────────────────────────────────────────────────────────
const MIN_ZOOM = 0.1
const MAX_ZOOM = 5.0
const ZOOM_FACTOR = 1.1
const SYNC_DEBOUNCE_MS = 150

interface ViewportState {
  zoom: number
  panX: number
  panZ: number
}

/** Cached container geometry — updated only by ResizeObserver, never in event handlers */
interface ContainerRect {
  left: number
  top: number
  width: number
  height: number
}

export const BlueprintCanvas: React.FC<BlueprintCanvasProps> = ({
  stageWidth: stageWidthProp,
  stageDepth: stageDepthProp,
  padding = 2,
  style,
  toolMode = 'select',
}) => {
  const fixtures = useStageStore(s => s.fixtures)
  const addFixture = useStageStore(s => s.addFixture)
  const deselectAll = useSelectionStore(s => s.deselectAll)
  const snap = useSnapStore(s => s.snap)
  const svgRef = useRef<SVGSVGElement | null>(null)

  // WAVE 7647: Read actual stage dimensions from the store. Falls back to
  // props (for tests/transitions) or the warehouse-scale default (50×25).
  const storeStage = useStageStore(s => s.showFile?.stage)
  const stageWidth = stageWidthProp ?? storeStage?.width ?? 50
  const stageDepth = stageDepthProp ?? storeStage?.depth ?? 25

  // ── FASE 7: Interaction state ─────────────────────────────────────────────
  const [dragState, setDragState] = useState<DragState2D | null>(null)
  const [elevationState, setElevationState] = useState<ElevationState | null>(null)
  const [dragHandlers, setDragHandlers] = useState<DragHandlers | null>(null)

  // ── WAVE 7651/7653: Pan & Zoom viewport — ALL REFS, zero React state ──────
  // The live viewport lives in a ref. During pan/zoom, we mutate the SVG
  // viewBox directly via setAttribute, bypassing React. A separate
  // `syncedViewport` state is updated only when the user STOPS zooming
  // (trailing debounce) or on pan end — so child layers re-render after
  // the gesture, not during it.
  const viewportRef = useRef<ViewportState>({ zoom: 1.0, panX: 0, panZ: 0 })
  const [syncedViewport, setSyncedViewport] = useState<ViewportState>({ zoom: 1.0, panX: 0, panZ: 0 })

  // WAVE 7653: Cursor state is refs-only — no useState, no React re-renders.
  // Cursor is mutated directly on the DOM element.
  const spaceHeldRef = useRef(false)
  const isPanningRef = useRef(false)
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panZ: 0 })
  const justPannedRef = useRef(false)
  const pxPerMRef = useRef(20)
  const syncTimerRef = useRef<number | null>(null)

  // WAVE 7653: Cached container geometry — updated ONLY by ResizeObserver.
  // Wheel handler reads from this ref instead of calling getBoundingClientRect.
  const containerRectRef = useRef<ContainerRect>({ left: 0, top: 0, width: 1200, height: 800 })

  // ── Shared coordinate conversion (DOM → SVG user space) ──────────────────
  // getScreenCTM() automatically reflects the current viewBox (even when
  // mutated directly via DOM), so pan/zoom is transparent to all consumers.
  const screenToSVG = useScreenToSVG(svgRef)

  // ── Base viewBox dimensions (unzoomed) ────────────────────────────────────
  const VIEWBOX_PADDING = padding + 0.5
  const baseW = useMemo(() => stageWidth + VIEWBOX_PADDING * 2, [stageWidth, VIEWBOX_PADDING])
  const baseH = useMemo(() => stageDepth + VIEWBOX_PADDING * 2, [stageDepth, VIEWBOX_PADDING])

  // ── Compute viewBox from a viewport state ─────────────────────────────────
  const computeViewBox = useCallback((vp: ViewportState) => {
    const vWidth = baseW / vp.zoom
    const vHeight = baseH / vp.zoom
    const centerX = stageWidth / 2 + vp.panX
    const centerZ = stageDepth / 2 + vp.panZ
    return {
      x: centerX - vWidth / 2,
      z: centerZ - vHeight / 2,
      w: vWidth,
      h: vHeight,
    }
  }, [baseW, baseH, stageWidth, stageDepth])

  // ── Apply viewBox directly to the DOM (bypasses React) ───────────────────
  // WAVE 7653: This function has EXCLUSIVE ownership of the viewBox attribute.
  // React never sets viewBox on the <svg> element — no prop in JSX.
  const applyViewBoxDOM = useCallback(() => {
    const el = svgRef.current
    if (!el) return
    const vb = computeViewBox(viewportRef.current)
    el.setAttribute('viewBox', `${vb.x} ${vb.z} ${vb.w} ${vb.h}`)
  }, [computeViewBox])

  // ── WAVE 7653: Cursor mutation via DOM — no React state ──────────────────
  const updateCursorDOM = useCallback(() => {
    const el = svgRef.current
    if (!el) return
    el.style.cursor = isPanningRef.current ? 'grabbing' : spaceHeldRef.current ? 'grab' : 'default'
  }, [])

  // ── Sync to React state (for child components) ────────────────────────────
  // WAVE 7653: syncToReact is called on pan END (pointerup) — immediate.
  const syncToReact = useCallback(() => {
    if (syncTimerRef.current !== null) {
      clearTimeout(syncTimerRef.current)
      syncTimerRef.current = null
    }
    setSyncedViewport({ ...viewportRef.current })
  }, [])

  // WAVE 7653: scheduleSync uses trailing debounce — the timer is RESET on
  // every wheel event. setSyncedViewport only fires after the user STOPS
  // scrolling for SYNC_DEBOUNCE_MS. During continuous scrolling, no React
  // re-render occurs at all.
  const scheduleSync = useCallback(() => {
    if (syncTimerRef.current !== null) clearTimeout(syncTimerRef.current)
    syncTimerRef.current = window.setTimeout(() => {
      syncTimerRef.current = null
      setSyncedViewport({ ...viewportRef.current })
    }, SYNC_DEBOUNCE_MS)
  }, [])

  // ── Synced viewBox for React-rendered children ────────────────────────────
  const viewBox = useMemo(() => computeViewBox(syncedViewport), [computeViewBox, syncedViewport])

  // ── WAVE 7655: ResizeObserver — sole owner of container geometry ─────────
  // Caches rect in containerRectRef AND derives basePxPerM. No event handler
  // ever calls getBoundingClientRect — they all read from the ref.
  //
  // WAVE 7655: basePxPerM starts as null. Child layers (Grid, Ruler, Paper)
  // are NOT rendered until the ResizeObserver provides the real value. This
  // eliminates the mount double-render (was: render with default 20 → RO
  // fires → re-render with real value → 1,358 nodes generated twice).
  const [basePxPerM, setBasePxPerM] = useState<number | null>(null)
  useLayoutEffect(() => {
    const el = svgRef.current
    if (!el) return
    let rafId: number | null = null
    const update = () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0) {
          // Cache geometry for wheel handler (no more sync reflows)
          containerRectRef.current = {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
          }
          const ppm = Math.min(rect.width / baseW, rect.height / baseH)
          setBasePxPerM(prev => {
            if (prev === null) return ppm
            return Math.abs(prev - ppm) < 0.5 ? prev : ppm
          })
        }
      })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      ro.disconnect()
    }
  }, [baseW, baseH])

  // WAVE 7655: Guard — don't render heavy child layers until we have a real
  // pixelsPerMeter from the ResizeObserver. This prevents the mount
  // double-render that was generating 1,358 SVG nodes twice.
  const pixelsPerMeter = basePxPerM === null ? 0 : basePxPerM * syncedViewport.zoom
  const layersReady = basePxPerM !== null
  useEffect(() => {
    if (basePxPerM !== null) pxPerMRef.current = basePxPerM * viewportRef.current.zoom
  }, [basePxPerM])

  // ── WAVE 7653: Set initial viewBox via useLayoutEffect (DOM owns it) ──────
  // No viewBox prop on the <svg> JSX. This runs once on mount (and when
  // baseW/baseH change due to stage dimension changes) to set the initial
  // viewBox. After this, applyViewBoxDOM() has exclusive control.
  useLayoutEffect(() => {
    applyViewBoxDOM()
  }, [applyViewBoxDOM])

  // ── WAVE 7653: Zoom-toward-cursor — ZERO sync reflows ────────────────────
  // Reads container geometry from containerRectRef (cached by ResizeObserver).
  // No getBoundingClientRect call. No React state update during scroll.
  // scheduleSync uses trailing debounce → fires only when scrolling stops.
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      // WAVE 7653: Read from cached ref — NO synchronous reflow
      const cr = containerRectRef.current
      if (cr.width <= 0 || cr.height <= 0) return
      const mx = (e.clientX - cr.left) / cr.width
      const my = (e.clientY - cr.top) / cr.height

      const vp = viewportRef.current
      const factor = e.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, vp.zoom * factor))
      if (newZoom === vp.zoom) return

      // Zoom-toward-cursor: keep the world point under the cursor fixed
      const dw = baseW * (1 / vp.zoom - 1 / newZoom)
      const dh = baseH * (1 / vp.zoom - 1 / newZoom)

      viewportRef.current = {
        zoom: newZoom,
        panX: vp.panX + (mx - 0.5) * dw,
        panZ: vp.panZ + (my - 0.5) * dh,
      }
      pxPerMRef.current = (basePxPerM ?? 20) * viewportRef.current.zoom
      applyViewBoxDOM()
      scheduleSync()
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [baseW, baseH, basePxPerM, applyViewBoxDOM, scheduleSync])

  // ── WAVE 7653: Spacebar tracking — refs only, cursor via DOM ─────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
        e.preventDefault()
        spaceHeldRef.current = true
        updateCursorDOM()
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceHeldRef.current = false
        updateCursorDOM()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [updateCursorDOM])

  // ── WAVE 7651/7653: Capture-phase pointerdown to intercept lasso ─────────
  // Cursor is mutated via DOM — no setIsPanning, no React re-render.
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const onPointerDownCapture = (e: PointerEvent) => {
      const isPanGesture = e.button === 1 || (e.button === 0 && spaceHeldRef.current)
      if (!isPanGesture) return

      // Block lasso and any other target-phase handlers
      e.preventDefault()
      e.stopPropagation()

      // Start panning — refs only, no React state
      isPanningRef.current = true
      updateCursorDOM()
      const vp = viewportRef.current
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        panX: vp.panX,
        panZ: vp.panZ,
      }

      // Capture pointer so we get move/up events even outside the SVG
      try { el.setPointerCapture(e.pointerId) } catch { /* noop */ }
    }
    el.addEventListener('pointerdown', onPointerDownCapture, { capture: true })
    return () => el.removeEventListener('pointerdown', onPointerDownCapture, { capture: true })
  }, [updateCursorDOM])

  // ── WAVE 7651/7653: Pan move/up via window listeners ─────────────────────
  // Always attached (not gated by isPanning state). Checks isPanningRef for
  // early return. No React state per-move. Cursor via DOM on pan end.
  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      if (!isPanningRef.current) return
      const ppm = pxPerMRef.current
      const dx = (e.clientX - panStartRef.current.x) / ppm
      const dz = (e.clientY - panStartRef.current.y) / ppm
      viewportRef.current = {
        zoom: viewportRef.current.zoom,
        panX: panStartRef.current.panX - dx,
        panZ: panStartRef.current.panZ - dz,
      }
      applyViewBoxDOM()
    }
    const onPointerUp = (e: PointerEvent) => {
      if (!isPanningRef.current) return
      isPanningRef.current = false
      updateCursorDOM()
      justPannedRef.current = true
      setTimeout(() => { justPannedRef.current = false }, 0)

      const el = svgRef.current
      if (el) { try { el.releasePointerCapture(e.pointerId) } catch { /* noop */ } }

      // Sync to React so child layers update with final viewport
      syncToReact()
    }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [applyViewBoxDOM, syncToReact, updateCursorDOM])

  // ── Drop handler for new fixtures from tool panel ──────────────────────────
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const libraryId = e.dataTransfer.getData('application/x-fixture-library-id')
      if (!libraryId) return

      const libState = useLibraryStore.getState()
      const libFixture = [...libState.systemFixtures, ...libState.userFixtures].find(
        f => f.id === libraryId,
      )
      if (!libFixture) return

      // Convert screen pixels → SVG user space (meters, top-left origin)
      // screenToSVG uses getScreenCTM() which reflects current pan/zoom.
      const { x: svgX, y: svgZ } = screenToSVG(e.clientX, e.clientY)

      // SVG top-left origin → 3D center-origin
      const worldX = snap(svgX - stageWidth / 2)
      const worldZ = snap(svgZ - stageDepth / 2)

      // 🏗️ WAVE 7731: Erebus no longer auto-patches DMX addresses.
      // Fixtures are born UNPATCHED (address=0). Routing authority lives
      // exclusively in DMX Nexus / Patchbay.
      const newFixture = createDefaultFixture(
        `fix-${Date.now()}`,
        0,
        {
          name: libFixture.name,
          model: libFixture.name,
          manufacturer: libFixture.manufacturer,
          type: libFixture.type as any,
          profileId: libFixture.id,
          channelCount: libFixture.channels?.length ?? 1,
          position: { x: worldX, y: 3, z: worldZ },
          isPlaced: true,
          placementMode: '3d',
        },
      )
      addFixture(newFixture)
    },
    [screenToSVG, snap, stageWidth, stageDepth, addFixture],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleDragUpdate = useCallback((state: DragState2D) => setDragState(state), [])
  const handleDragEnd = useCallback(() => setDragState(null), [])
  const handleElevationChange = useCallback((state: ElevationState | null) => setElevationState(state), [])

  // Neighbor positions for DimensionLayer
  const neighborPositions = useMemo(
    () => fixtures.map(f => ({
      id: f.id,
      x: f.position.x + stageWidth / 2,
      z: f.position.z + stageDepth / 2,
    })),
    [fixtures, stageWidth, stageDepth],
  )

  // Map fixtures to symbol data for SymbolLayer
  // Transform from 3D center-origin (0,0 = stage center) to SVG top-left-origin
  // (0,0 = top-left corner of stage rect)
  const symbolFixtures = useMemo<FixtureSymbolData[]>(
    () =>
      fixtures.map(f => ({
        id: f.id,
        type: (f.type === 'bar' ? 'wash' : ['effect', 'generic', 'fan', 'fog', 'mirror-ball', 'pyro'].includes(f.type) ? 'effect' : f.type) as FixtureSymbolData['type'],
        x: f.position.x + stageWidth / 2,
        z: f.position.z + stageDepth / 2,
        yaw: f.rotation.yaw,
        name: f.name,
        dmx: `U${f.universe}.${f.address}`,
      })),
    [fixtures, stageWidth, stageDepth],
  )

  return (
    <svg
      ref={svgRef}
      className="blueprint-canvas"
      // WAVE 7653: No viewBox prop — DOM owns it via applyViewBoxDOM().
      // Initial value set in useLayoutEffect. React can never overwrite it.
      preserveAspectRatio="xMidYMid meet"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={(e) => {
        // Only deselect if clicking the SVG background itself (not a child)
        // and not immediately after a pan operation
        if (e.target === e.currentTarget && !justPannedRef.current) deselectAll()
      }}
      style={{
        ...style,
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'var(--obs-floor)',
        zIndex: 1,
        // WAVE 7659: Force SVG onto its own GPU compositor layer.
        // Without this, the SVG is CPU-rasterized and any overlay element
        // (HUD panels, etc.) forces re-capture of the SVG backdrop every frame.
        // translateZ(0) promotes the SVG to a GPU texture, enabling hardware-
        // accelerated compositing.
        willChange: 'transform',
        transform: 'translateZ(0)',
        // WAVE 7653: Initial cursor — updated via DOM mutation, not React state
        cursor: 'default',
        touchAction: 'none',
      }}
    >
      {/* ═══ Global <defs> — declarados una sola vez en la raíz del SVG ═══ */}
      <defs>
        {/* Zone dot fill — for hover/drag-over highlight */}
        <pattern id="zone-dot-fill" x="0" y="0" width="0.3" height="0.3" patternUnits="userSpaceOnUse">
          <circle cx="0.15" cy="0.15" r="0.015" fill="var(--obs-accent)" opacity="0.03" />
        </pattern>
      </defs>

      {/* Layer 0: Paper (background + noise) — sin defs propios */}
      <PaperLayer width={viewBox.w} height={viewBox.h} x={viewBox.x} y={viewBox.z} />

      {/* WAVE 7655: Heavy layers gated until ResizeObserver provides real pxPerM.
          This eliminates the mount double-render (was: 1,358 nodes generated
          twice — once with default pxPerM=20, once with real value). */}
      {layersReady && (<>
        {/* WAVE 7658: Standard CAD occlusion order (bottom → top):
            1. Architecture (floor + hatch background) — must be BELOW grid
            2. Grid (lines on top of floor)
            3. Zones (spatial matrix overlay)
            4. Rulers (measurement, top-most of the static layers) */}
        <ArchitectureLayer
          stageWidth={stageWidth}
          stageDepth={stageDepth}
          padding={padding}
          pixelsPerMeter={pixelsPerMeter}
        />

        <GridLayer
          stageWidth={stageWidth}
          stageDepth={stageDepth}
          padding={padding}
          pixelsPerMeter={pixelsPerMeter}
        />

        <ZoneLayer
          stageWidth={stageWidth}
          stageDepth={stageDepth}
          pixelsPerMeter={pixelsPerMeter}
        />

        {/* WAVE 7651: Rulers drawn INWARDS from viewBox edges to avoid clipping */}
        <RulerLayer
          viewBoxX={viewBox.x}
          viewBoxZ={viewBox.z}
          viewBoxWidth={viewBox.w}
          viewBoxHeight={viewBox.h}
          stageWidth={stageWidth}
          stageDepth={stageDepth}
          pixelsPerMeter={pixelsPerMeter}
        />
      </>)}

      {/* Layer 4: Cotas Vivas (only during drag) */}
      <DimensionLayer
        dragState={dragState}
        neighborPositions={neighborPositions}
        stageWidth={stageWidth}
        stageDepth={stageDepth}
        padding={padding}
      />

      {/* Coverage Ring (only during elevation scrubbing) */}
      <CoverageRing elevationState={elevationState} />

      {/* Layer 4b: Lasso capture rect — BELOW symbols so fixture clicks don't trigger lasso */}
      <LassoSelection
        svgRef={svgRef}
        stageWidth={stageWidth}
        stageDepth={stageDepth}
        padding={padding}
        toolMode={toolMode}
      />

      {/* Layer 5: Symbols (fixture simbology) — interactive, receives pointer events */}
      <SymbolLayer
        fixtures={symbolFixtures}
        onFixturePointerDown={dragHandlers?.onFixturePointerDown}
        onFixturePointerEnter={dragHandlers?.onFixturePointerEnter}
        onFixturePointerLeave={dragHandlers?.onFixturePointerLeave}
        onFixtureContextMenu={dragHandlers?.onFixtureContextMenu}
        pixelsPerMeter={pixelsPerMeter}
      />

      {/* Layer 5b: Rig Plan (trusses + totems in 2D) */}
      <RigPlanLayer />

      {/* Layer 6: Drag feedback (alignment line + ghost) — above symbols, pointerEvents none */}
      <DragDropController2D
        svgRef={svgRef}
        stageWidth={stageWidth}
        stageDepth={stageDepth}
        padding={padding}
        onDragUpdate={handleDragUpdate}
        onDragEnd={handleDragEnd}
        toolMode={toolMode}
        onHandlersReady={setDragHandlers}
        pixelsPerMeter={pixelsPerMeter}
      />

      {/* Measure Tool (2D) */}
      <MeasureLayer2D
        svgRef={svgRef}
        stageWidth={stageWidth}
        stageDepth={stageDepth}
        padding={padding}
        toolMode={toolMode}
      />
      <ElevationScrubber
        fixtures={fixtures}
        onElevationChange={handleElevationChange}
      />

      {/* Section Profile Ghost (only during elevation scrubbing) */}
      <SectionProfileGhost
        elevationState={elevationState}
        stageWidth={stageWidth}
        stageDepth={stageDepth}
        padding={padding}
      />
    </svg>
  )
}

export default BlueprintCanvas
