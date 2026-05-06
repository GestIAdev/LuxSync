/**
 * 🔲 FIXTURE MATRIX — WAVE 4569
 *
 * Grid denso de chips para activar/desactivar MOVING HEADS en la Cathedral.
 * Los fixtures estáticos (pares, cegadoras, strobos) están excluidos — esta
 * vista es la Catedral de los Movers.
 *
 * Tres estados visuales por chip:
 *   • Sin selección: gris apagado
 *   • Moving head seleccionado: cyan activo
 *
 * Organización: grupos por tipo (SPOTS, BEAMS, WASH, SCANNERS…).
 * Header de grupo con botones +ALL/-ALL para disparos rápidos por zona.
 *
 * @module components/hyperion/kinetics/FixtureMatrix
 * @version WAVE 4569
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

  // Solo moving heads — estáticos excluidos de esta vista
  const moverFixtures = useMemo(
    () => stageFixtures.filter(f => isMovingHead(f.type ?? '')),
    [stageFixtures],
  )

  // Agrupar movers por tipo
  const groups = useMemo((): FixtureGroup[] => {
    const map = new Map<string, FixtureGroup>()

    for (const sf of moverFixtures) {
      const label = typeLabel(sf.type ?? '')

      if (!map.has(label)) {
        map.set(label, { label, isMoving: true, fixtures: [] })
      }
      map.get(label)!.fixtures.push({
        id: sf.id,
        name: sf.name,
        address: (sf as any).address ?? undefined,
      })
    }

    const groups = Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label))
    for (const g of groups) {
      g.fixtures.sort((a, b) => a.name.localeCompare(b.name))
    }

    return groups
  }, [moverFixtures])

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

  if (moverFixtures.length === 0) {
    return (
      <div className="fixture-matrix fixture-matrix--empty">
        <span className="fixture-matrix__empty-icon">⊕</span>
        <span className="fixture-matrix__empty-text">No hay moving heads en el show</span>
      </div>
    )
  }

  return (
    <div className="fixture-matrix">
      {/* Barra de acciones rápidas */}
      <div className="fixture-matrix__toolbar">
        <button
          className="fixture-matrix__tool-btn"
          onClick={() => selectMultiple(moverFixtures.map(f => f.id), 'replace')}
          title="Seleccionar todos los moving heads"
        >
          ALL MOVERS
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
          {selectedIds.length}/{moverFixtures.length}
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
                return (
                  <button
                    key={f.id}
                    className={[
                      'fixture-matrix__chip',
                      sel ? 'fixture-matrix__chip--moving' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={e => handleChipClick(f.id, e)}
                    title={`${f.name}${f.address != null ? ` — DMX ${f.address}` : ''}`}
                  >
                    <span className="fixture-matrix__chip-name">
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
