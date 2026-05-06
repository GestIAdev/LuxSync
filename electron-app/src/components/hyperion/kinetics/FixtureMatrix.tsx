/**
 * 🔲 FIXTURE MATRIX — WAVE 4568
 *
 * Grid denso de chips para activar/desactivar fixtures sin salir de la
 * Cathedral. Elimina el flujo de 4 clicks + 2 cambios de contexto.
 *
 * Tres estados visuales por chip:
 *   • Sin selección: gris apagado
 *   • Moving head seleccionado: cyan activo
 *   • Fixture estático seleccionado: naranja + icono ⚠ (no tiene IK)
 *
 * Organización: grupos por tipo (moving heads primero, luego estáticos).
 *
 * @module components/hyperion/kinetics/FixtureMatrix
 * @version WAVE 4568
 */

import React, { useMemo, useCallback } from 'react'
import { useShallow } from 'zustand/shallow'
import { useSelectionStore } from '../../../stores/selectionStore'
import { useStageStore } from '../../../stores/stageStore'
import './FixtureMatrix.css'

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function isMovingHead(type: string): boolean {
  const t = type.toLowerCase()
  return t === 'moving-head' || t === 'moving_head' || t === 'spot'
    || t === 'beam' || t === 'scanner' || t === 'wash'
}

function typeLabel(type: string): string {
  const t = type.toLowerCase()
  if (t.includes('spot'))    return 'SPOTS'
  if (t.includes('beam'))    return 'BEAMS'
  if (t.includes('wash'))    return 'WASH'
  if (t.includes('scanner')) return 'SCANNERS'
  if (t.includes('moving'))  return 'MOVING'
  if (t.includes('par'))     return 'PARS'
  if (t.includes('led'))     return 'LED'
  if (t.includes('strobe'))  return 'STROBES'
  return type.toUpperCase() || 'OTROS'
}

interface FixtureGroup {
  label: string
  isMoving: boolean
  fixtures: Array<{ id: string; name: string; address?: number }>
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export const FixtureMatrix: React.FC = () => {
  const selectedIds = useSelectionStore(useShallow(s => Array.from(s.selectedIds)))
  const { toggleSelection, selectMultiple, deselectAll } = useSelectionStore(
    useShallow(s => ({
      toggleSelection: s.toggleSelection,
      selectMultiple: s.selectMultiple,
      deselectAll: s.deselectAll,
    })),
  )
  const stageFixtures = useStageStore(s => s.fixtures)

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  // Agrupar fixtures por tipo — moving heads primero
  const groups = useMemo((): FixtureGroup[] => {
    const map = new Map<string, FixtureGroup>()

    for (const sf of stageFixtures) {
      const moving = isMovingHead(sf.type ?? '')
      const label = typeLabel(sf.type ?? '')
      const key = `${moving ? '0' : '1'}_${label}` // moving primero

      if (!map.has(key)) {
        map.set(key, { label, isMoving: moving, fixtures: [] })
      }
      map.get(key)!.fixtures.push({
        id: sf.id,
        name: sf.name,
        address: (sf as any).address ?? undefined,
      })
    }

    // Sort de grupos: moving heads primero, luego estáticos; dentro de cada
    // grupo por nombre
    const groups = Array.from(map.values()).sort((a, b) => {
      if (a.isMoving !== b.isMoving) return a.isMoving ? -1 : 1
      return a.label.localeCompare(b.label)
    })

    for (const g of groups) {
      g.fixtures.sort((a, b) => a.name.localeCompare(b.name))
    }

    return groups
  }, [stageFixtures])

  const handleChipClick = useCallback((id: string, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      toggleSelection(id)
    } else {
      // Click simple: toggle sin perder la selección existente
      toggleSelection(id)
    }
  }, [toggleSelection])

  const handleSelectGroup = useCallback((group: FixtureGroup, e: React.MouseEvent) => {
    e.stopPropagation()
    const ids = group.fixtures.map(f => f.id)
    const allSelected = ids.every(id => selectedSet.has(id))
    if (allSelected) {
      // Si todos ya están seleccionados, deseleccionar el grupo
      for (const id of ids) {
        if (selectedSet.has(id)) toggleSelection(id)
      }
    } else {
      selectMultiple(ids, 'add')
    }
  }, [selectedSet, selectMultiple, toggleSelection])

  if (stageFixtures.length === 0) {
    return (
      <div className="fixture-matrix fixture-matrix--empty">
        <span className="fixture-matrix__empty-icon">◈</span>
        <span className="fixture-matrix__empty-text">No hay fixtures en el show</span>
      </div>
    )
  }

  return (
    <div className="fixture-matrix">
      {/* Barra de acciones rápidas */}
      <div className="fixture-matrix__toolbar">
        <button
          className="fixture-matrix__tool-btn"
          onClick={() => {
            const allIds = stageFixtures.map(f => f.id)
            const allMovingIds = stageFixtures
              .filter(f => isMovingHead(f.type ?? ''))
              .map(f => f.id)
            selectMultiple(allMovingIds, 'replace')
          }}
          title="Seleccionar todos los moving heads"
        >
          MOVING ×ALL
        </button>
        <button
          className="fixture-matrix__tool-btn"
          onClick={() => selectMultiple(stageFixtures.map(f => f.id), 'replace')}
          title="Seleccionar todos"
        >
          ALL
        </button>
        <button
          className="fixture-matrix__tool-btn fixture-matrix__tool-btn--clear"
          onClick={deselectAll}
          title="Limpiar selección"
          disabled={selectedIds.length === 0}
        >
          CLR
        </button>
        <span className="fixture-matrix__sel-count">
          {selectedIds.length}/{stageFixtures.length}
        </span>
      </div>

      {/* Grupos */}
      <div className="fixture-matrix__groups">
        {groups.map(group => (
          <div key={group.label} className="fixture-matrix__group">
            <div className="fixture-matrix__group-header">
              <span className={`fixture-matrix__group-label${group.isMoving ? ' fixture-matrix__group-label--moving' : ''}`}>
                {group.isMoving ? '⊕' : '◈'} {group.label}
              </span>
              <button
                className="fixture-matrix__group-select"
                onClick={e => handleSelectGroup(group, e)}
                title={`Seleccionar todos los ${group.label}`}
              >
                {group.fixtures.every(f => selectedSet.has(f.id)) ? '-ALL' : '+ALL'}
              </button>
            </div>

            <div className="fixture-matrix__chips">
              {group.fixtures.map(f => {
                const sel = selectedSet.has(f.id)
                const moving = group.isMoving
                return (
                  <button
                    key={f.id}
                    className={[
                      'fixture-matrix__chip',
                      sel && moving ? 'fixture-matrix__chip--moving' : '',
                      sel && !moving ? 'fixture-matrix__chip--static' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={e => handleChipClick(f.id, e)}
                    title={`${f.name}${f.address != null ? ` — DMX ${f.address}` : ''}${!moving ? ' ⚠ Sin IK' : ''}`}
                  >
                    <span className="fixture-matrix__chip-name">
                      {!moving && sel && <span className="fixture-matrix__chip-warn">⚠ </span>}
                      {f.name.length > 8 ? f.name.slice(0, 7) + '…' : f.name}
                    </span>
                    {f.address != null && (
                      <span className="fixture-matrix__chip-addr">{f.address}</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
