/**
 * 🏛️ CATHEDRAL FOOTER — Groups quickbar + Lock status (WAVE 4561)
 *
 * Barra inferior de la KineticsCathedral.
 * Chips de grupos para selección rápida sin salir de la Cathedral.
 * Indicador de candados Aether (L2 override count).
 */

import React, { useMemo, useCallback } from 'react'
import { useStageStore } from '../../../stores/stageStore'
import { useSelectionStore } from '../../../stores/selectionStore'
import { useProgrammerStore } from '../../../stores/programmerStore'

export const CathedralFooter: React.FC = () => {
  const stageFixtures = useStageStore(s => s.fixtures)
  const selectedIds = useSelectionStore(s => s.selectedIds)
  const fixtureOverrides = useProgrammerStore(s => s.fixtureOverrides)
  const activeFixtureIds = useProgrammerStore(s => s.activeFixtureIds)

  // Agrupar fixtures por zona/tipo para chips rápidos
  const groupChips = useMemo(() => {
    const groups: Map<string, string[]> = new Map()
    groups.set('ALL', stageFixtures.map(f => f.id))

    // Agrupar por tipo
    for (const f of stageFixtures) {
      const type = (f.type ?? 'other').toUpperCase()
      if (!groups.has(type)) groups.set(type, [])
      groups.get(type)!.push(f.id)
    }

    return Array.from(groups.entries()).map(([label, ids]) => ({ label, ids }))
  }, [stageFixtures])

  const handleGroupClick = useCallback((ids: string[]) => {
    useSelectionStore.getState().selectMultiple(ids, 'replace')
  }, [])

  // Contar fixtures con kinetic override activo
  const lockedCount = useMemo(() => {
    let count = 0
    for (const id of activeFixtureIds) {
      const overrides = fixtureOverrides.get(id)
      if (overrides && (overrides.pan !== null || overrides.tilt !== null)) {
        count++
      }
    }
    return count
  }, [fixtureOverrides, activeFixtureIds])

  const totalActive = activeFixtureIds.length

  const handleUnlockAll = useCallback(() => {
    useProgrammerStore.getState().releasePosition()
  }, [])

  return (
    <div className="cathedral-footer">
      {/* Groups quickbar */}
      <div className="cathedral-footer__groups">
        <span className="cathedral-footer__groups-label">GROUPS:</span>
        <div className="cathedral-footer__chips">
          {groupChips.map(({ label, ids }) => {
            const isActive = ids.every(id => selectedIds.has(id))
            return (
              <button
                key={label}
                className={`cathedral-footer__chip ${isActive ? 'cathedral-footer__chip--active' : ''}`}
                onClick={() => handleGroupClick(ids)}
                title={`${label} (${ids.length})`}
              >
                {label} <span className="cathedral-footer__chip-count">({ids.length})</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Lock status */}
      {lockedCount > 0 && (
        <div className="cathedral-footer__locks">
          <span className="cathedral-footer__lock-icon">🔒</span>
          <span className="cathedral-footer__lock-text">
            L2 OVERRIDE: {lockedCount}/{totalActive} locked
          </span>
          <button
            className="cathedral-footer__unlock-btn"
            onClick={handleUnlockAll}
            title="Liberar todas las posiciones → AI controla"
          >
            🔓 UNLOCK ALL
          </button>
        </div>
      )}
    </div>
  )
}
