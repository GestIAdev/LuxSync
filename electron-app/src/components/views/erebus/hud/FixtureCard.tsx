import React, { useCallback } from 'react'
import type { LibraryFixture } from '../../../../stores/libraryStore'
import { deriveFixtureTags } from '../../../../stores/assetAdapters'

// ═══════════════════════════════════════════════════════════════════════════
// FixtureCard — Tarjeta de fixture draggable dentro del DockFlyout
// PROYECTO EREBUS FASE 9
//
// Muestra nombre, fabricante y tags. Es draggable: al iniciar el arrastre
// emite un CustomEvent para que el DockFlyout se retraiga instantáneamente
// y el canvas tome el control del drag.
// ═══════════════════════════════════════════════════════════════════════════

interface FixtureCardProps {
  fixture: LibraryFixture
}

export const FixtureCard: React.FC<FixtureCardProps> = ({ fixture }) => {
  const tags = deriveFixtureTags(fixture)

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.setData('application/x-fixture-library-id', fixture.id)
      e.dataTransfer.setData('application/x-fixture-name', fixture.name)
      e.dataTransfer.setData('application/x-fixture-manufacturer', fixture.manufacturer)
      e.dataTransfer.setData('application/x-fixture-type', fixture.type)
      e.dataTransfer.effectAllowed = 'copy'

      // Retract flyout immediately — canvas takes over
      window.dispatchEvent(new CustomEvent('erebus:dock-flyout-retract'))
    },
    [fixture],
  )

  const handleDoubleClick = useCallback(() => {
    // Quick-add: emit event for instant patch at stage center
    window.dispatchEvent(
      new CustomEvent('erebus:quick-add-fixture', {
        detail: { libraryId: fixture.id },
      }),
    )
  }, [fixture])

  return (
    <div
      className="erebus-fixture-card"
      draggable
      onDragStart={handleDragStart}
      onDoubleClick={handleDoubleClick}
      title={`Drag to canvas or double-click to add — ${fixture.name}`}
    >
      <div className="erebus-fixture-card-header">
        <span className="erebus-fixture-card-name">{fixture.name}</span>
      </div>
      <div className="erebus-fixture-card-manufacturer">
        {fixture.manufacturer}
      </div>
      {tags.length > 0 && (
        <div className="erebus-fixture-card-tags">
          {tags.slice(0, 4).map((tag, i) => (
            <span key={`${tag}-${i}`} className="erebus-fixture-card-tag">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default FixtureCard
