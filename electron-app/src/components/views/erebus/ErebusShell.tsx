import React, { Suspense, lazy, useState } from 'react'
import { CommandStrip } from './hud/CommandStrip'
import { DockRail } from './hud/DockRail'
import { ContextInspector } from './hud/ContextInspector'
import { StatusRibbon } from './hud/StatusRibbon'
import './erebus.css'

// Lazy load the heavy canvases
const StudioCanvas = lazy(() => import('./studio3d/StudioCanvas'))
const BlueprintCanvas = lazy(() => import('./blueprint2d/BlueprintCanvas'))

// ═══════════════════════════════════════════════════════════════════════════
// ErebusShell — Layout Raíz
// PROYECTO EREBUS — FASE 1 + FASE 2
//
// 100vw / 100vh, sin márgenes. Fondo: var(--obs-floor).
// Contenedor relativo que aloja de forma absoluta a los cuatro satélites.
// El centro aloja el Canvas R3F (Studio Mode) o Blueprint (2D Mode).
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

  return (
    <div className="erebus-shell">
      {/* ═══ Canvas — Studio Mode (3D) / Blueprint Mode (2D) ═══ */}
      <div className="erebus-canvas-mount">
        {viewMode === '3d' && (
          <Suspense fallback={null}>
            <StudioCanvas quality="HQ" />
          </Suspense>
        )}
        {viewMode === '2d' && (
          <Suspense fallback={null}>
            <BlueprintCanvas />
          </Suspense>
        )}
      </div>

      {/* ═══ HUD Satellites (absolute positioned, z-index above canvas) ═══ */}
      <CommandStrip
        toolMode={toolMode}
        setToolMode={setToolMode}
        viewMode={viewMode}
        setViewMode={setViewMode}
      />
      <DockRail />
      <ContextInspector toolMode={toolMode} />
      <StatusRibbon />
    </div>
  )
}

export default ErebusShell
