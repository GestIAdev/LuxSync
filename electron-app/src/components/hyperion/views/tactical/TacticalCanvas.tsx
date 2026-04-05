/**
 * ☀️ HYPERION — Tactical Canvas
 * 
 * EL CORAZÓN DE HYPERION: Vista 2D top-down del escenario.
 * Renderizado por capas, hit testing para selección, beat-reactive.
 * 
 * Arquitectura:
 * - Canvas único con composición de capas (Grid → Zone → Fixture → Selection → HUD)
 * - requestAnimationFrame loop con frame budget
 * - Hit testing para hover/click/lasso
 * - Integración con FixtureTooltip (del Phase 2)
 * 
 * @module components/hyperion/views/tactical/TacticalCanvas
 * @since WAVE 2042.5 (Project Hyperion — Phase 3)
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
  renderGridLayer, 
  renderZoneLayer, 
  renderFixtureLayer,
  renderSelectionLayer,
  renderHUDLayer,
  FIXTURE_CONFIG
} from './layers'
import { 
  hitTestFixtures, 
  hitTestLasso,
  getCanvasMousePosition,
  canvasToNormalized
} from './HitTestEngine'
import { FixtureTooltip, useFixtureTooltip } from '../../widgets'
import type { 
  TacticalCanvasOptions, 
  RenderMetrics,
  TacticalSelection,
  QualityMode
} from './types'
import { DEFAULT_TACTICAL_OPTIONS } from './types'
import { ZONE_LAYOUT_2D, type CanonicalZone } from '../../shared/ZoneLayoutEngine'
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
  /** Additional CSS class */
  className?: string
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const FRAME_BUDGET_MS = 16.67  // Target 60fps

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const TacticalCanvas = memo(function TacticalCanvas({
  quality = 'HQ',
  showGrid = true,
  showZoneLabels = true,
  onFixtureSelect,
  onSelectionChange,
  className = '',
}: TacticalCanvasProps) {
  // ── Refs ────────────────────────────────────────────────────────────────
  
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)
  const metricsRef = useRef<RenderMetrics>({
    fps: 60,
    frameTime: 0,
    fixtureCount: 0,
    lastRenderTime: 0,
  })
  const fpsHistoryRef = useRef<number[]>([])
  const lastFrameTimeRef = useRef<number>(0)

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PHYSICS MEMORY — Inercia táctica para pan/tilt suaves
  // Sin esto: saltos de 180° en 1 frame → triple-haz ghosting
  // Con esto: interpolación suave (mantequilla) → cinematografía real
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const physicsStoreRef = useRef<Map<string, { pan: number; tilt: number; zoom: number }>>(new Map())

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ⚡ WAVE 2464: BEAT VISUAL ENVELOPE — Decay suave a 60fps real
  //
  // PROBLEMA ANTERIOR: onBeat era un boolean. El RAF dibujaba beatScale=1.08
  // mientras onBeat=true (100ms), luego saltaba a 1.0 instantáneamente →
  // flash duro, no un halo que pulsa y se apaga.
  //
  // SOLUCIÓN: beatVisualEnvelopeRef decae cada frame del RAF (independiente
  // del IPC, independiente de React). Cuando llega un beat real, sube a 1.0.
  // Cada frame: env *= DECAY. Pasa a FixtureLayer como valor continuo 0-1.
  // FixtureLayer usa: beatScale = 1.0 + env * 0.08  (suave, no binario)
  //
  // DECAY = 0.88 por frame @ 60fps → dura ~8 frames (~130ms) visible
  // DECAY = 0.92 por frame @ 60fps → dura ~12 frames (~200ms) visible
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const beatVisualEnvelopeRef = useRef<number>(0)
  const lastOnBeatRef = useRef<boolean>(false)  // Detecta rising edge (false→true)

  // ── State ───────────────────────────────────────────────────────────────
  
  const [isReady, setIsReady] = useState(false)
  const [hoveredFixtureId, setHoveredFixtureId] = useState<string | null>(null)
  const [isLassoActive, setIsLassoActive] = useState(false)
  const [lassoBounds, setLassoBounds] = useState<{
    startX: number
    startY: number
    endX: number
    endY: number
  } | null>(null)

  // ── Store Subscriptions ─────────────────────────────────────────────────
  
  const selectedIds = useSelectionStore(state => state.selectedIds)
  const select = useSelectionStore(state => state.select)
  const selectMultiple = useSelectionStore(state => state.selectMultiple)
  const toggleSelection = useSelectionStore(state => state.toggleSelection)
  const deselectAll = useSelectionStore(state => state.deselectAll)
  
  // 🔥 WAVE 2405: Beat data read IMPERATIVELY in RAF loop via useAudioStore.getState()
  // No longer a reactive subscription — prevents RAF restart on every beat

  // ── Fixture Data ────────────────────────────────────────────────────────
  // Structural scaffold (~2fps from truthStore — positions, zones, types)
  // Dynamic data (intensity, color, pan/tilt) hydrated from transientStore in RAF
  
  const fixtures = useFixtureData()
  const fixturesRef = useRef(fixtures)
  fixturesRef.current = fixtures
  
  // ── Tooltip Hook ────────────────────────────────────────────────────────
  
  const tooltip = useFixtureTooltip({
    showDelay: 120,
    enabled: true,
  })

  // ── Canvas Setup ────────────────────────────────────────────────────────
  
  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    const updateSize = () => {
      const rect = container.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio, DEFAULT_TACTICAL_OPTIONS.maxDPR)
      
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`

      const ctx = canvas.getContext('2d')
      if (ctx) {
        // CRITICAL: Reset transform to identity BEFORE scaling
        // Otherwise scale accumulates on each resize → ghosting/triple-haz
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.scale(dpr, dpr)
      }
    }

    updateSize()
    setIsReady(true)

    const observer = new ResizeObserver(updateSize)
    observer.observe(container)

    return () => {
      observer.disconnect()
    }
  }, [])

  // ── Calculate Base Radius ───────────────────────────────────────────────
  
  const baseRadius = useMemo(() => {
    const canvas = canvasRef.current
    if (!canvas) return FIXTURE_CONFIG.MIN_RADIUS

    const rect = canvas.getBoundingClientRect()
    const minDim = Math.min(rect.width, rect.height)
    
    return Math.max(
      FIXTURE_CONFIG.MIN_RADIUS,
      Math.min(
        FIXTURE_CONFIG.MAX_RADIUS,
        minDim * FIXTURE_CONFIG.BASE_RADIUS_RATIO
      )
    )
  }, [isReady])

  // ── Zone Counts ─────────────────────────────────────────────────────────
  
  const zoneCounts = useMemo(() => {
    const counts = new Map<CanonicalZone, number>()
    for (const fixture of fixtures) {
      const current = counts.get(fixture.zone) ?? 0
      counts.set(fixture.zone, current + 1)
    }
    return counts
  }, [fixtures])
  const zoneCountsRef = useRef(zoneCounts)
  zoneCountsRef.current = zoneCounts

  // ── Render Loop ─────────────────────────────────────────────────────────
  
  useEffect(() => {
    if (!isReady) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const render = (timestamp: number) => {
      // Calculate FPS
      const delta = timestamp - lastFrameTimeRef.current
      lastFrameTimeRef.current = timestamp

      if (delta > 0) {
        const instantFps = 1000 / delta
        fpsHistoryRef.current.push(instantFps)
        if (fpsHistoryRef.current.length > 30) {
          fpsHistoryRef.current.shift()
        }
        const avgFps = fpsHistoryRef.current.reduce((a, b) => a + b, 0) / fpsHistoryRef.current.length
        metricsRef.current.fps = avgFps
      }

      // 🔥 WAVE 2405: Read structural scaffold from ref (updated by React at ~2fps)
      const currentFixtures = fixturesRef.current

      metricsRef.current.frameTime = delta
      metricsRef.current.fixtureCount = currentFixtures.length
      metricsRef.current.lastRenderTime = timestamp

      // ⚡ WAVE 2464: BEAT VISUAL ENVELOPE — Decay suave a 60fps
      // Rising edge detection: solo sube el envelope en la transición false→true.
      // Esto evita que el envelope se "resetee" a 1.0 en cada frame mientras
      // onBeat siga siendo true (100ms), que causaría un plateau plano en vez de decay.
      const audioState = useAudioStore.getState()
      const currentOnBeat = audioState.onBeat
      const BEAT_VISUAL_DECAY = 0.88  // per-frame @ 60fps → ~130ms de halo visible
      if (currentOnBeat && !lastOnBeatRef.current) {
        // Rising edge — nuevo beat real detectado
        beatVisualEnvelopeRef.current = 1.0
      }
      lastOnBeatRef.current = currentOnBeat
      // Decay cada frame, independiente de si hay beat o no
      beatVisualEnvelopeRef.current *= BEAT_VISUAL_DECAY
      const beatEnvelope = beatVisualEnvelopeRef.current

      // Get CSS dimensions
      const rect = canvas.getBoundingClientRect()
      const width = rect.width
      const height = rect.height

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // CRITICAL: Save context state BEFORE rendering
      // This prevents transform accumulation (ghosting/triple-haz bug)
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      ctx.save()

      // Clear canvas (must happen AFTER save, uses current transform)
      ctx.clearRect(0, 0, width, height)

      // ── LAYER 1: GRID ─────────────────────────────────────────────────
      if (showGrid) {
        renderGridLayer(ctx, width, height, {
          showReferenceLines: true,
          showStereoDivision: true,
        })
      }

      // ── LAYER 2: ZONE LABELS ──────────────────────────────────────────
      if (showZoneLabels) {
        renderZoneLayer(ctx, width, height, {
          showCounts: true,
          zoneCounts: zoneCountsRef.current,
        })
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 🔥 WAVE 2405: TRANSIENT HYDRATION — Fresh dynamic data every frame
      //
      // The scaffold (x, y, zone, type, id) comes from useFixtureData (~2fps).
      // Dynamic fields (intensity, color, pan/tilt/zoom) are OVERWRITTEN here
      // with fresh data from getTransientTruth() (~12.5fps IPC, zero React cost).
      //
      // This is the same pattern used by 3D components (HyperionPar3D, etc.)
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      const transientTruth = getTransientTruth()
      const transientFixtures = transientTruth?.hardware?.fixtures
      
      // Build a lookup map for O(1) access by fixture ID
      let transientMap: Map<string, any> | null = null
      if (transientFixtures && Array.isArray(transientFixtures)) {
        transientMap = new Map()
        for (const f of transientFixtures) {
          if (f?.id) transientMap.set(f.id, f)
        }
      }

      // Read control params imperatively for calculateFixtureRenderValues
      const controlState = useControlStore.getState()
      const cinema = selectCinemaControl(controlState)
      const overrides = useOverrideStore.getState().overrides

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // PHYSICS INTERPOLATION — Smooth pan/tilt/zoom (Inercia Táctica)
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // PROBLEMA: DMX values jump instantly (0° → 180° in 1 frame)
      // SOLUCIÓN: Remember previous values, interpolate smoothly
      // RESULTADO: Beams move like butter (cinematographic), no ghosting
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      
      const SMOOTHING_FACTOR = 0.10  // 0.1 = slow/heavy, 0.3 = fast/snappy
      
      const smoothedFixtures = currentFixtures.map((fixture, index) => {
        // 🔥 WAVE 2405: Hydrate with FRESH transient data
        let hydrated = fixture
        const transientState = transientMap?.get(fixture.id)
        if (transientState) {
          const fixtureOverride = overrides.get(fixture.id)
          const renderData = calculateFixtureRenderValues(
            transientState,
            cinema.globalMode,
            cinema.flowParams,
            cinema.activePaletteId,
            cinema.globalIntensity,
            cinema.globalSaturation,
            index,
            fixtureOverride?.values,
            fixtureOverride?.mask,
            cinema.targetPalette,
            cinema.transitionProgress
          )
          
          const rawIntensity = renderData.intensity ?? 0
          const normalizedIntensity = !Number.isFinite(rawIntensity)
            ? 0
            : rawIntensity > 1.0 ? rawIntensity / 255 : rawIntensity
          
          hydrated = {
            ...fixture,
            // Dynamic fields — FRESH from transient
            r: Number.isFinite(renderData.color.r) ? renderData.color.r : 0,
            g: Number.isFinite(renderData.color.g) ? renderData.color.g : 0,
            b: Number.isFinite(renderData.color.b) ? renderData.color.b : 0,
            intensity: Math.max(0, Math.min(1, normalizedIntensity)),
            physicalPan: Number.isFinite(renderData.physicalPan) ? renderData.physicalPan : 0.5,
            physicalTilt: Number.isFinite(renderData.physicalTilt) ? renderData.physicalTilt : 0.5,
            zoom: Number.isFinite(renderData.zoom) ? renderData.zoom : 127,
            focus: Number.isFinite(renderData.focus) ? renderData.focus : 127,
            panVelocity: Number.isFinite(renderData.panVelocity) ? renderData.panVelocity : 0,
            tiltVelocity: Number.isFinite(renderData.tiltVelocity) ? renderData.tiltVelocity : 0,
          }
        }
        
        // Get or initialize physics state for this fixture
        let state = physicsStoreRef.current.get(hydrated.id)
        
        if (!state) {
          // First frame: initialize with current values (no interpolation)
          state = {
            pan: hydrated.physicalPan,
            tilt: hydrated.physicalTilt,
            zoom: hydrated.zoom,
          }
          physicsStoreRef.current.set(hydrated.id, state)
        }

        // Interpolate towards target (exponential smoothing)
        // This creates the "inercia" effect — fixture remembers momentum
        state.pan += (hydrated.physicalPan - state.pan) * SMOOTHING_FACTOR
        state.tilt += (hydrated.physicalTilt - state.tilt) * SMOOTHING_FACTOR
        state.zoom += (hydrated.zoom - state.zoom) * SMOOTHING_FACTOR

        // Update physics memory for next frame
        physicsStoreRef.current.set(hydrated.id, state)

        // Return fixture with SMOOTHED values (not raw DMX)
        return {
          ...hydrated,
          physicalPan: state.pan,
          physicalTilt: state.tilt,
          zoom: state.zoom,
        }
      })

      // ── LAYER 3: FIXTURES (with smoothed physics + transient data) ────
      renderFixtureLayer(ctx, width, height, smoothedFixtures, {
        quality,
        onBeat: beatEnvelope > 0.05,       // true mientras el halo sea visible
        beatIntensity: beatEnvelope,        // 0-1 continuo para beatScale suave
      })

      // ── LAYER 4: SELECTION ────────────────────────────────────────────
      renderSelectionLayer(ctx, width, height, smoothedFixtures, baseRadius, {
        selectedIds,
        hoveredId: hoveredFixtureId,
        lassoBounds,
        animationPhase: (timestamp % 1000) / 1000,
      })

      // ── LAYER 5: HUD ──────────────────────────────────────────────────
      renderHUDLayer(ctx, width, height, metricsRef.current, quality)

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // CRITICAL: Restore context state AFTER rendering
      // Paired with ctx.save() at frame start
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      ctx.restore()

      // Schedule next frame
      animationRef.current = requestAnimationFrame(render)
    }

    animationRef.current = requestAnimationFrame(render)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  // 🔥 WAVE 2405: STABLE RAF DEPS
  // Removed: fixtures, onBeat, beatIntensity, zoneCounts
  // These are now read IMPERATIVELY via refs and getState() inside the RAF loop.
  // The RAF loop is mount-once, run-forever — no more destroy/recreate on data changes.
  }, [
    isReady,
    quality,
    showGrid,
    showZoneLabels,
    selectedIds,
    hoveredFixtureId,
    lassoBounds,
    baseRadius,
  ])

  // ── Mouse Handlers ──────────────────────────────────────────────────────
  
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const pos = getCanvasMousePosition(e.nativeEvent, canvas)

    // Update lasso if active
    if (isLassoActive && lassoBounds) {
      const normalized = canvasToNormalized(pos.x, pos.y, rect.width, rect.height)
      setLassoBounds({
        ...lassoBounds,
        endX: normalized.x,
        endY: normalized.y,
      })
      return
    }

    // Hit test for hover
    const hit = hitTestFixtures(
      pos.x,
      pos.y,
      fixtures,
      rect.width,
      rect.height,
      baseRadius
    )

    if (hit.fixtureId !== hoveredFixtureId) {
      setHoveredFixtureId(hit.fixtureId)
      
      if (hit.fixtureId) {
        // Find fixture and build tooltip data
        const fixture = fixtures.find(f => f.id === hit.fixtureId)
        if (fixture) {
          const tooltipData = {
            id: fixture.id,
            name: fixture.id,
            type: fixture.type === 'moving' ? 'moving-head' as const : fixture.type as any,
            zone: fixture.zone,
            dmxAddress: 1, // Would need to be fetched from stageStore
            intensity: fixture.intensity,
            color: { r: fixture.r, g: fixture.g, b: fixture.b },
            pan: fixture.physicalPan,
            tilt: fixture.physicalTilt,
            zoom: fixture.zoom / 255,
            focus: fixture.focus / 255,
            selected: selectedIds.has(fixture.id),
            hasOverride: false,
          }
          tooltip.onFixtureEnter(fixture.id, tooltipData, { x: e.clientX, y: e.clientY })
        }
      } else {
        tooltip.onFixtureLeave()
      }
    } else if (hit.fixtureId) {
      tooltip.onFixtureMove({ x: e.clientX, y: e.clientY })
    }
  }, [fixtures, baseRadius, isLassoActive, lassoBounds, hoveredFixtureId, tooltip, selectedIds])

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const pos = getCanvasMousePosition(e.nativeEvent, canvas)

    // Hit test for click
    const hit = hitTestFixtures(
      pos.x,
      pos.y,
      fixtures,
      rect.width,
      rect.height,
      baseRadius
    )

    if (hit.fixtureId) {
      // Click on fixture
      const isToggle = e.ctrlKey || e.metaKey
      const isAdditive = e.shiftKey
      
      if (isToggle) {
        toggleSelection(hit.fixtureId)
      } else if (isAdditive) {
        select(hit.fixtureId, 'add')
      } else {
        select(hit.fixtureId, 'replace')
      }
      onFixtureSelect?.(hit.fixtureId, isToggle || isAdditive)
    } else {
      // Start lasso selection
      if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
        deselectAll()
      }
      
      const normalized = canvasToNormalized(pos.x, pos.y, rect.width, rect.height)
      setIsLassoActive(true)
      setLassoBounds({
        startX: normalized.x,
        startY: normalized.y,
        endX: normalized.x,
        endY: normalized.y,
      })
    }
  }, [fixtures, baseRadius, toggleSelection, select, deselectAll, onFixtureSelect])

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isLassoActive && lassoBounds) {
      // Complete lasso selection
      const lassoedIds = hitTestLasso(lassoBounds, fixtures)
      
      if (lassoedIds.length > 0) {
        const additive = e.shiftKey || e.ctrlKey || e.metaKey
        selectMultiple(lassoedIds, additive ? 'add' : 'replace')
        onSelectionChange?.(lassoedIds)
      }
    }

    setIsLassoActive(false)
    setLassoBounds(null)
  }, [isLassoActive, lassoBounds, fixtures, selectMultiple, onSelectionChange])

  const handleMouseLeave = useCallback(() => {
    setHoveredFixtureId(null)
    tooltip.onFixtureLeave()
    
    if (isLassoActive) {
      setIsLassoActive(false)
      setLassoBounds(null)
    }
  }, [tooltip, isLassoActive])

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
