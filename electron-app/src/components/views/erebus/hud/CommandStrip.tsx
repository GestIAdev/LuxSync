import React from 'react'
import type { ToolMode, ViewMode } from '../ErebusShell'

// ═══════════════════════════════════════════════════════════════════════════
// CommandStrip — Satélite Superior
// Cápsula flotante centrada en la parte superior (40px).
// backdrop-filter: blur(12px), fondo var(--obs-surface) al 75%.
// Contenido temporal: botones mock para 2D/3D, Select, Move, Calibrate.
// ═══════════════════════════════════════════════════════════════════════════

interface CommandStripProps {
  toolMode: ToolMode
  setToolMode: (mode: ToolMode) => void
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
}

const TOOLS: { mode: ToolMode; label: string }[] = [
  { mode: 'select', label: 'Select' },
  { mode: 'move', label: 'Move' },
  { mode: 'rig', label: 'Rig' },
  { mode: 'calibrate', label: 'Calibrate' },
  { mode: 'measure', label: 'Measure' },
]

export const CommandStrip: React.FC<CommandStripProps> = ({
  toolMode,
  setToolMode,
  viewMode,
  setViewMode,
}) => {
  return (
    <div className="erebus-command-strip">
      {/* View toggle */}
      <div className="erebus-cmd-group">
        <button
          className={`erebus-cmd-btn ${viewMode === '2d' ? 'erebus-cmd-btn--active' : ''}`}
          onClick={() => setViewMode('2d')}
        >
          2D
        </button>
        <button
          className={`erebus-cmd-btn ${viewMode === '3d' ? 'erebus-cmd-btn--active' : ''}`}
          onClick={() => setViewMode('3d')}
        >
          3D
        </button>
      </div>

      {/* Tool modes */}
      <div className="erebus-cmd-group">
        {TOOLS.map(t => (
          <button
            key={t.mode}
            className={`erebus-cmd-btn ${toolMode === t.mode ? 'erebus-cmd-btn--active' : ''}`}
            onClick={() => setToolMode(t.mode)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Snap placeholder */}
      <div className="erebus-cmd-group">
        <button className="erebus-cmd-btn" title="Snap settings">
          Snap
        </button>
      </div>
    </div>
  )
}

export default CommandStrip
