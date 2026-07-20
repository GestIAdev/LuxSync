import React, { Suspense, lazy, useCallback, useState, useEffect } from 'react'
import { CommandStrip } from './hud/CommandStrip'
import { DockRail } from './hud/DockRail'
import { ContextInspector } from './hud/ContextInspector'
import { StatusRibbon } from './hud/StatusRibbon'
import { RadialMenu } from './hud/RadialMenu'
import { CommandPalette } from './hud/CommandPalette'
import { useViewTransition } from './transition/ViewTransitionDirector'
import { useLibraryStore } from '../../../stores/libraryStore'
import { useStageStore } from '../../../stores/stageStore'
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

  useEffect(() => {
    loadFromDisk(true)
  }, [loadFromDisk])

  useEffect(() => {
    if (!showFile) {
      newShow('Untitled Show')
    }
  }, [showFile, newShow])

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
      <div className="erebus-canvas-mount">
        {/* 3D Canvas — mounted during 3D mode and during transitions */}
        {transition.mount3D && (
          <Suspense fallback={null}>
            <StudioCanvas
              quality="HQ"
              opacity={transition.opacity3D}
              isTransitioning={transition.isTransitioning}
              getCameraKeyframe={transition.getCameraKeyframe}
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
