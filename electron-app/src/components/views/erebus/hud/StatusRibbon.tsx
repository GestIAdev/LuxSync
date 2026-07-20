import React from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// StatusRibbon — Satélite Inferior
// Línea flotante inferior, sin fondo de caja, texto alineado a la izquierda.
// Tipografía: monoespaciada, color var(--obs-ink).
// Contenido temporal: "x:0.00 y:0.00 z:0.00 | Erebus Engine Ready".
// ═══════════════════════════════════════════════════════════════════════════

export const StatusRibbon: React.FC = () => {
  return (
    <div className="erebus-status-ribbon">
      <span>x:0.00 y:0.00 z:0.00</span>
      <span className="erebus-status-sep">│</span>
      <span className="erebus-status-accent">Erebus Engine Ready</span>
    </div>
  )
}

export default StatusRibbon
