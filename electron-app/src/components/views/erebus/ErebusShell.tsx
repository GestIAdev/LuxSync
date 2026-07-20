import React, { useState } from 'react'
import { CommandStrip } from './hud/CommandStrip'
import { DockRail } from './hud/DockRail'
import { ContextInspector } from './hud/ContextInspector'
import { StatusRibbon } from './hud/StatusRibbon'
import './erebus.css'

// ═══════════════════════════════════════════════════════════════════════════
// ErebusShell — Layout Raíz
// PROYECTO EREBUS FASE 1
//
// 100vw / 100vh, sin márgenes. Fondo: var(--obs-floor).
// Contenedor relativo que aloja de forma absoluta a los cuatro satélites.
// El centro del DOM queda completamente libre para el futuro Canvas 3D/2D.
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
      {/* ═══ Canvas placeholder — future StudioCanvas / BlueprintCanvas ═══ */}
      {/* The center is completely free. Canvas will mount here in Phase 2. */}

      {/* ═══ HUD Satellites (absolute positioned) ═══ */}
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
