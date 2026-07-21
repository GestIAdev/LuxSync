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
  const stageFixtures = useStageStore(s => s.fixtures)
  const canvasMountRef = useRef<HTMLDivElement>(null)

  // Stage dimensions for coordinate mapping
  const stageWidth = showFile?.stage?.width ?? 12
  const stageDepth = showFile?.stage?.depth ?? 8

  useEffect(() => {
    loadFromDisk(true)
  }, [loadFromDisk])

  useEffect(() => {
    if (!showFile) {
      newShow('Untitled Show')
    }
  }, [showFile, newShow])

  // ── Drag-drop from FixtureCard to canvas ──────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const libraryId = e.dataTransfer.getData('application/x-fixture-library-id')
      if (!libraryId) return

      // Find fixture in library
      const libState = useLibraryStore.getState()
      const libFixture = [...libState.systemFixtures, ...libState.userFixtures].find(
        f => f.id === libraryId,
      )
      if (!libFixture) return

      // Compute drop position relative to canvas mount
      const rect = canvasMountRef.current?.getBoundingClientRect()
      if (!rect) return

      // Normalize to 0..1 within canvas
      const ndcX = (e.clientX - rect.left) / rect.width
      const ndcY = (e.clientY - rect.top) / rect.height

      // Map to stage coordinates (center origin for 3D, top-left for 2D)
      // For 3D: center of stage = (stageWidth/2, stageDepth/2)
      // For 2D: same mapping as BlueprintCanvas viewBox
      const stageX = ndcX * stageWidth
      const stageZ = ndcY * stageDepth

      const fixtureCount = stageFixtures.length
      const newFixture = createDefaultFixture(
        `fix-${Date.now()}`,
        fixtureCount * 4 + 1,
        {
          name: libFixture.name,
          model: libFixture.name,
          manufacturer: libFixture.manufacturer,
          type: libFixture.type as any,
          profileId: libFixture.id,
          channelCount: libFixture.channels?.length ?? 1,
          position: { x: stageX, y: 3, z: stageZ },
          isPlaced: true,
          placementMode: '3d',
        },
      )
      addFixture(newFixture)
    },
    [stageFixtures, addFixture, stageWidth, stageDepth],
  )

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

      const fixtureCount = useStageStore.getState().fixtures.length
      const newFixture = createDefaultFixture(
        `fix-${Date.now()}`,
        fixtureCount * 4 + 1,
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
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* 3D Canvas — mounted during 3D mode and during transitions */}
        {transition.mount3D && (
          <Suspense fallback={null}>
            <StudioCanvas
              quality="HQ"
              opacity={transition.opacity3D}
              isTransitioning={transition.isTransitioning}
              getCameraKeyframe={transition.getCameraKeyframe}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
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
              onDragOver={handleDragOver}
              onDrop={handleDrop}
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
