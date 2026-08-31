import React, { Suspense, lazy, useCallback, useState, useEffect, useRef } from 'react'
import { CommandStrip } from './hud/CommandStrip'
import { DockRail } from './hud/DockRail'
import { ContextInspector } from './hud/ContextInspector'
import { StatusRibbon } from './hud/StatusRibbon'
import { RadialMenu } from './hud/RadialMenu'
import { CommandPalette } from './hud/CommandPalette'
import { useViewTransition } from './transition/ViewTransitionDirector'
import { useLibraryStore } from '../../../stores/libraryStore'
import { useStageStore } from '../../../stores/stageStore'
import { useSelectionStore } from '../../../stores/selectionStore'
import { createDefaultFixture } from '../../../core/stage/ShowFileV2'
import './erebus.css'

// Lazy load the heavy canvases
const StudioCanvas = lazy(() => import('./studio3d/StudioCanvas'))
const BlueprintCanvas = lazy(() => import('./blueprint2d/BlueprintCanvas'))

// ═══════════════════════════════════════════════════════════════════════════
// ErebusShell — Layout Raíz
// PROYECTO EREBUS — FASE 1 + FASE 2 + FASE 5
//
// 100vw / 100vh, sin márgenes. Fondo: var(--obs-floor).
// Contenedor relativo que aloja de forma absoluta a los cuatro satélites.
// El centro aloja el Canvas R3F (Studio Mode) o Blueprint (2D Mode).
// FASE 5: Transición cinematográfica 2D↔3D de 600ms con crossfade.
// ═══════════════════════════════════════════════════════════════════════════

export type ToolMode = 'select' | 'move' | 'rig' | 'calibrate' | 'measure'
export type ViewMode = '3d' | '2d'

export interface ErebusContextValue {
  toolMode: ToolMode
  setToolMode: (mode: ToolMode) => void
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
}

export const ErebusShell: React.FC = () => {
  const [toolMode, setToolMode] = useState<ToolMode>('select')
  const [viewMode, setViewMode] = useState<ViewMode>('3d')

  // ── Bootstrap: load library + ensure show file exists ────────────────────
  const loadFromDisk = useLibraryStore(s => s.loadFromDisk)
  const showFile = useStageStore(s => s.showFile)
  const newShow = useStageStore(s => s.newShow)
  const addFixture = useStageStore(s => s.addFixture)
  const canvasMountRef = useRef<HTMLDivElement>(null)

  // Stage dimensions for coordinate mapping
  const stageWidth = showFile?.stage?.width ?? 50
  const stageDepth = showFile?.stage?.depth ?? 25

  useEffect(() => {
    loadFromDisk(true)
  }, [loadFromDisk])

  useEffect(() => {
    if (!showFile) {
      newShow('Untitled Show')
    }
  }, [showFile, newShow])

  // ── RadialMenu action: calibrate → switch tool mode ──────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.fixtureId) {
        useSelectionStore.getState().select(detail.fixtureId, 'replace')
      }
      setToolMode('calibrate')
    }
    window.addEventListener('erebus:action-calibrate', handler)
    return () => window.removeEventListener('erebus:action-calibrate', handler)
  }, [])

  // ── Drop for new fixtures is handled by BlueprintCanvas via onDrop ────────
  // (uses screenToSVG + offset inverse for pixel-perfect placement)

  // Attach native listeners on canvas mount — capture phase to intercept
  // before R3F's canvas can swallow the events.
  // ONLY in 3D mode: BlueprintCanvas handles its own onDrop in 2D mode.
  // Without this guard, both the native listener (capture, parent div) and
  // BlueprintCanvas's React onDrop fire → double fixture creation.
  useEffect(() => {
    if (viewMode !== '3d') return

    const el = canvasMountRef.current
    if (!el) return

    const handleDragOverNative = (e: DragEvent) => {
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    }

    const handleDropNative = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const libraryId = e.dataTransfer?.getData('application/x-fixture-library-id')
      if (!libraryId) return

      const libState = useLibraryStore.getState()
      const libFixture = [...libState.systemFixtures, ...libState.userFixtures].find(
        f => f.id === libraryId,
      )
      if (!libFixture) return

      // 3D mode: approximate placement at center of stage
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
          position: { x: 0, y: 3, z: 0 },
          isPlaced: true,
          placementMode: '3d',
        },
      )
      addFixture(newFixture)
    }

    const opts = { capture: true }

    el.addEventListener('dragenter', handleDragOverNative, opts)
    el.addEventListener('dragover', handleDragOverNative, opts)
    el.addEventListener('drop', handleDropNative, opts)

    return () => {
      el.removeEventListener('dragenter', handleDragOverNative, opts)
      el.removeEventListener('dragover', handleDragOverNative, opts)
      el.removeEventListener('drop', handleDropNative, opts)
    }
  }, [addFixture, viewMode])

  // ── Quick-add via double-click on FixtureCard ─────────────────────────────
  useEffect(() => {
    const handleQuickAdd = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (!detail?.libraryId) return

      const libState = useLibraryStore.getState()
      const libFixture = [...libState.systemFixtures, ...libState.userFixtures].find(
        f => f.id === detail.libraryId,
      )
      if (!libFixture) return

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
          position: { x: stageWidth / 2, y: 3, z: stageDepth / 2 },
          isPlaced: true,
          placementMode: '3d',
        },
      )
      addFixture(newFixture)
    }
    window.addEventListener('erebus:quick-add-fixture', handleQuickAdd)
    return () => window.removeEventListener('erebus:quick-add-fixture', handleQuickAdd)
  }, [addFixture, stageWidth, stageDepth])

  // ── FASE 5: Transition director ──────────────────────────────────────────
  const handleViewChange = useCallback((newView: ViewMode) => {
    setViewMode(newView)
  }, [])

  const transition = useViewTransition(viewMode, handleViewChange)

  // Intercept view mode changes to trigger transition instead of instant swap
  const handleSetViewMode = useCallback(
    (target: ViewMode) => {
      if (target === viewMode) return
      transition.transitionTo(target)
    },
    [viewMode, transition],
  )

  return (
    <div className="erebus-shell">
      {/* ═══ Canvas — Studio Mode (3D) / Blueprint Mode (2D) ═══ */}
      {/* FASE 5: Both canvases coexist during 600ms transition, crossfade opacities */}
      <div
        className="erebus-canvas-mount"
        ref={canvasMountRef}
      >
        {/* 3D Canvas — mounted during 3D mode and during transitions */}
        {transition.mount3D && (
          <Suspense fallback={null}>
            <StudioCanvas
              quality="HQ"
              opacity={transition.opacity3D}
              isTransitioning={transition.isTransitioning}
              getCameraKeyframe={transition.getCameraKeyframe}
              toolMode={toolMode}
            />
          </Suspense>
        )}

        {/* 2D Canvas — mounted during 2D mode and during transitions */}
        {transition.mount2D && (
          <Suspense fallback={null}>
            <BlueprintCanvas
              style={{
                opacity: transition.opacity2D,
                pointerEvents: transition.opacity2D < 0.5 ? 'none' : 'auto',
              }}
              toolMode={toolMode}
            />
          </Suspense>
        )}
      </div>

      {/* ═══ HUD Satellites (absolute positioned, z-index above canvas) ═══ */}
      <CommandStrip
        toolMode={toolMode}
        setToolMode={setToolMode}
        viewMode={viewMode}
        setViewMode={handleSetViewMode}
      />
      <DockRail />
      <ContextInspector toolMode={toolMode} />
      <StatusRibbon />
      <RadialMenu />
      <CommandPalette />
    </div>
  )
}

export default ErebusShell
