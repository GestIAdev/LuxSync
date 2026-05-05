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
import { useMovementStore } from '../../../stores/movementStore'

export const CathedralFooter: React.FC = () => {
  const stageFixtures = useStageStore(s => s.fixtures)
  const selectedIds = useSelectionStore(s => s.selectedIds)
  const fixtureOverrides = useProgrammerStore(s => s.fixtureOverrides)
  const activeFixtureIds = useProgrammerStore(s => s.activeFixtureIds)
  const lockedFixtureIds = useMovementStore(s => s.lockedFixtureIds)

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

  // Fixtures bloqueados por motor superior (Chronos/Selene L0/L1 evicción)
  const externalLockCount = useMemo(() => {
    let count = 0
    for (const id of activeFixtureIds) {
      if (lockedFixtureIds.has(id)) count++
    }
    return count
  }, [lockedFixtureIds, activeFixtureIds])
  return (
    <div className="cathedral-footer">
      {/* Groups quickbar */}
      <div className="cathedral-footer__groups">
        <span className="cathedral-footer__groups-label">GROUPS:</span>
        <div className="cathedral-footer__chips">
          {groupChips.map(({ label, ids }) => {
            const selCount = ids.filter(id => selectedIds.has(id)).length
            const isActive = selCount === ids.length && ids.length > 0
            const isPartial = selCount > 0 && selCount < ids.length
            return (
              <button
                key={label}
                className={[
                  'cathedral-footer__chip',
                  isActive  ? 'cathedral-footer__chip--active'  : '',
                  isPartial ? 'cathedral-footer__chip--partial' : '',
                ].join(' ')}
                onClick={() => handleGroupClick(ids)}
                title={`${label}: ${selCount}/${ids.length} seleccionados`}
              >
                {label}{' '}
                <span className="cathedral-footer__chip-count">
                  {selCount > 0 ? `${selCount}/${ids.length}` : ids.length}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Lock status — L2 programmer overrides */}
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

      {/* Lock status — Motor superior evicción (Chronos/Selene) */}
      {externalLockCount > 0 && (
        <div className="cathedral-footer__locks cathedral-footer__locks--external">
          <span className="cathedral-footer__lock-icon">⛔</span>
          <span className="cathedral-footer__lock-text">
            MOTOR OVERRIDE: {externalLockCount} fixture{externalLockCount !== 1 ? 's' : ''} bajo control superior
          </span>
        </div>
      )}
    </div>
  )
}
