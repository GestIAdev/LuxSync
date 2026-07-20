import React, { Suspense } from 'react'
import type { ToolMode } from '../ErebusShell'

// ═══════════════════════════════════════════════════════════════════════════
// ContextInspector — Satélite Derecho
// Tarjeta flotante a la derecha (320px).
//
// Misión Crítica: Recupera el componente CalibrationDock creado en M5
// y lo monta condicionalmente si el modo de herramienta es 'calibrate'.
// Si no hay selección o modo activo, retorna null (se desvanece).
// ═══════════════════════════════════════════════════════════════════════════

const CalibrationDock = React.lazy(() => import('../calibration/CalibrationDock'))

interface ContextInspectorProps {
  toolMode: ToolMode
}

export const ContextInspector: React.FC<ContextInspectorProps> = ({ toolMode }) => {
  // Phase 1: Only render when calibrate mode is active.
  // Future phases will add fixture/rig/multi inspectors.
  if (toolMode !== 'calibrate') return null

  return (
    <div className="erebus-context-inspector">
      <div className="erebus-inspector-header">
        <span className="erebus-inspector-title">Calibration</span>
      </div>
      <div className="erebus-inspector-body">
        <Suspense fallback={<div style={{ color: 'var(--obs-ink)', fontSize: 11 }}>Loading...</div>}>
          <CalibrationDock />
        </Suspense>
      </div>
    </div>
  )
}

export default ContextInspector
