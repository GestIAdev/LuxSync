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
  
  const onBeat = useAudioStore(state => state.onBeat)
  // Beat intensity can be derived from onBeat (1.0 when on beat, 0 otherwise)
  const beatIntensity = onBeat ? 1.0 : 0

  // ── Fixture Data ────────────────────────────────────────────────────────
  
  const fixtures = useFixtureData()
  
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

      metricsRef.current.frameTime = delta
      metricsRef.current.fixtureCount = fixtures.length
      metricsRef.current.lastRenderTime = timestamp

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
          zoneCounts,
        })
      }

      // ── LAYER 3: FIXTURES ─────────────────────────────────────────────
      renderFixtureLayer(ctx, width, height, fixtures, {
        quality,
        onBeat,
        beatIntensity,
      })

      // ── LAYER 4: SELECTION ────────────────────────────────────────────
      renderSelectionLayer(ctx, width, height, fixtures, baseRadius, {
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
  }, [
    isReady,
    fixtures,
    quality,
    showGrid,
    showZoneLabels,
    onBeat,
    beatIntensity,
    selectedIds,
    hoveredFixtureId,
    lassoBounds,
    zoneCounts,
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
