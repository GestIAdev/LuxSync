import React from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// DockRail — Satélite Izquierdo
// Barra vertical pegada a la izquierda (48px), separada de los bordes.
// Contenido temporal: iconos mock de categorías (Moving, PAR, Rigging).
// ═══════════════════════════════════════════════════════════════════════════

const CATEGORIES = [
  { id: 'moving', label: 'Moving Heads', icon: '◐' },
  { id: 'par', label: 'PAR / Wash', icon: '▭' },
  { id: 'strobe', label: 'Strobe / Blinder', icon: '◇' },
  { id: 'laser', label: 'Laser', icon: '✳' },
  { id: 'rigging', label: 'Rigging', icon: '─' },
  { id: 'ingenio', label: 'Ingenios', icon: '◈' },
]

export const DockRail: React.FC = () => {
  return (
    <div className="erebus-dock-rail">
      {CATEGORIES.map((cat, i) => (
        <React.Fragment key={cat.id}>
          <button
            className="erebus-rail-btn"
            title={cat.label}
          >
            <span style={{ fontSize: 16 }}>{cat.icon}</span>
          </button>
          {i === 3 && <div className="erebus-rail-divider" />}
        </React.Fragment>
      ))}
    </div>
  )
}

export default DockRail
