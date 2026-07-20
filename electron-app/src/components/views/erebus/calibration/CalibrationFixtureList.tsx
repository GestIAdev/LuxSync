import React, { useMemo, useCallback } from 'react'
import { useStageStore } from '../../../../stores/stageStore'
import { useSelectionStore } from '../../../../stores/selectionStore'
import type { FixtureV2 } from '../../../../core/stage/ShowFileV2'

// ═══════════════════════════════════════════════════════════════════════════
// CalibrationFixtureList — list of IK-eligible fixtures (moving heads only).
// Single selection, syncs with selectionStore.
// ═══════════════════════════════════════════════════════════════════════════

interface CalibrationFixtureListProps {
  selectedFixtureId: string | null
  onSelect: (fixtureId: string) => void
}

const IK_ELIGIBLE_TYPES = new Set(['moving-head', 'scanner', 'spot'])

export const CalibrationFixtureList: React.FC<CalibrationFixtureListProps> = ({
  selectedFixtureId,
  onSelect,
}) => {
  const fixtures = useStageStore(state => state.fixtures)
  const select = useSelectionStore(state => state.select)

  const ikFixtures = useMemo(() => {
    return (fixtures || []).filter(
      (f: FixtureV2) => IK_ELIGIBLE_TYPES.has(f.type) && f.enabled,
    )
  }, [fixtures])

  const handleClick = useCallback(
    (id: string) => {
      select(id, 'replace')
      onSelect(id)
    },
    [select, onSelect],
  )

  if (ikFixtures.length === 0) {
    return (
      <div className="cal-fixture-list-empty">
        No IK-eligible fixtures on stage.
      </div>
    )
  }

  return (
    <div className="cal-fixture-list">
      <div className="cal-section-label">Fixtures</div>
      <div className="cal-fixture-list-items">
        {ikFixtures.map((f: FixtureV2) => (
          <button
            key={f.id}
            className={`cal-fixture-item ${selectedFixtureId === f.id ? 'cal-fixture-item--active' : ''}`}
            onClick={() => handleClick(f.id)}
          >
            <span className="cal-fixture-item-name">{f.name || f.model}</span>
            <span className="cal-fixture-item-type">{f.type}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default CalibrationFixtureList
