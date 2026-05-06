/**
 * 🔲 FIXTURE MATRIX — WAVE 4570
 *
 * Grid denso de chips para activar/desactivar MOVING HEADS en la Cathedral.
 * Los fixtures estáticos (pares, cegadoras, strobos) están excluidos — esta
 * vista es la Catedral de los Movers.
 *
 * Jerarquía de agrupación (en orden de prioridad):
 *   1. Groups del show (si tienen movers) — ej. "Mover Left", "Mover Right"
 *   2. Zone canónica del fixture — ej. "movers-left", "movers-right", "air"
 *   3. Tipo de fixture — SPOTS, BEAMS, WASH, SCANNERS…
 *
 * Header de grupo con botones +ALL/-ALL para disparos rápidos por zona.
 *
 * @module components/hyperion/kinetics/FixtureMatrix
 * @version WAVE 4570
 */

import React, { useMemo, useCallback } from 'react'
import { useShallow } from 'zustand/shallow'
import { useSelectionStore } from '../../../stores/selectionStore'
import { useStageStore } from '../../../stores/stageStore'
import { normalizeZone, ZONE_LABELS } from '../../../core/stage/ShowFileV2'
import type { FixtureV2, FixtureGroup as ShowFixtureGroup } from '../../../core/stage/ShowFileV2'
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
  if (t.includes('moving'))  return 'MOVERS'
  return type.toUpperCase() || 'MOVERS'
}

interface MatrixGroup {
  label: string
  key: string
  fixtures: Array<{ id: string; name: string; address?: number }>
}

function buildGroupsFromShowGroups(
  moverIds: Set<string>,
  stageFixtures: FixtureV2[],
  showGroups: ShowFixtureGroup[],
): MatrixGroup[] | null {
  // Solo usamos show groups que contengan al menos 1 mover
  const relevant = showGroups.filter(g => g.fixtureIds.some(id => moverIds.has(id)))
  if (relevant.length === 0) return null

  const result: MatrixGroup[] = []
  const covered = new Set<string>()

  for (const g of relevant) {
    const fixtures = g.fixtureIds
      .filter(id => moverIds.has(id))
      .map(id => {
        const sf = stageFixtures.find(f => f.id === id)
        covered.add(id)
        return {
          id,
          name: sf?.name ?? id,
          address: (sf as any)?.address,
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name))

    if (fixtures.length > 0) {
      result.push({ label: g.name.toUpperCase(), key: g.id, fixtures })
    }
  }

  // Fixtures movers que no caben en ningún grupo → grupo OTROS
  const uncovered = Array.from(moverIds)
    .filter(id => !covered.has(id))
    .map(id => {
      const sf = stageFixtures.find(f => f.id === id)
      return { id, name: sf?.name ?? id, address: (sf as any)?.address }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  if (uncovered.length > 0) {
    result.push({ label: 'OTROS', key: '__otros__', fixtures: uncovered })
  }

  return result
}

function buildGroupsByZone(
  moverFixtures: FixtureV2[],
): MatrixGroup[] {
  const map = new Map<string, MatrixGroup>()

  for (const sf of moverFixtures) {
    const zone = normalizeZone((sf as any).zone as string | undefined ?? undefined)
    // Solo movers relevantes: movers-left, movers-right, air, center, unassigned, front, back
    const label = zone === 'unassigned'
      ? typeLabel(sf.type ?? '')
      : ZONE_LABELS[zone].replace(/^[^\s]+ /, '')  // strip emoji prefix

    const key = zone === 'unassigned' ? `type_${typeLabel(sf.type ?? '')}` : zone

    if (!map.has(key)) {
      map.set(key, { label: label.toUpperCase(), key, fixtures: [] })
    }
    map.get(key)!.fixtures.push({
      id: sf.id,
      name: sf.name,
      address: (sf as any).address,
    })
  }

  const groups = Array.from(map.values())
  // movers-left / movers-right primero, luego air/center, luego resto
  const PRIORITY: Record<string, number> = {
    'movers-left': 0, 'movers-right': 1, 'air': 2, 'center': 3,
    'front': 4, 'back': 5, 'floor': 6, 'ambient': 7,
  }
  groups.sort((a, b) => {
    const pa = PRIORITY[a.key] ?? 10
    const pb = PRIORITY[b.key] ?? 10
    if (pa !== pb) return pa - pb
    return a.label.localeCompare(b.label)
  })
  for (const g of groups) {
    g.fixtures.sort((a, b) => a.name.localeCompare(b.name))
  }

  return groups
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
  const showGroups = useStageStore(s => s.groups)

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  // Solo moving heads — estáticos excluidos de esta vista
  const moverFixtures = useMemo(
    () => stageFixtures.filter(f => isMovingHead(f.type ?? '')),
    [stageFixtures],
  )

  const moverIds = useMemo(() => new Set(moverFixtures.map(f => f.id)), [moverFixtures])

  // Agrupación: show groups → zones → type (orden de prioridad)
  const groups = useMemo((): MatrixGroup[] => {
    if (moverFixtures.length === 0) return []

    // Intento 1: grupos del show
    const fromShowGroups = buildGroupsFromShowGroups(moverIds, stageFixtures, (showGroups as ShowFixtureGroup[]) ?? [])
    if (fromShowGroups && fromShowGroups.length > 1) return fromShowGroups

    // Intento 2: zonas canónicas
    return buildGroupsByZone(stageFixtures.filter(f => moverIds.has(f.id)))
  }, [moverFixtures, moverIds, stageFixtures, showGroups])

  const handleChipClick = useCallback((id: string) => {
    toggleSelection(id)
  }, [toggleSelection])

  const handleSelectGroup = useCallback((group: MatrixGroup, e: React.MouseEvent) => {
    e.stopPropagation()
    const ids = group.fixtures.map(f => f.id)
    const allSelected = ids.every(id => selectedSet.has(id))
    if (allSelected) {
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
          <div key={group.key} className="fixture-matrix__group">
            <div className="fixture-matrix__group-header">
              <span className="fixture-matrix__group-label fixture-matrix__group-label--moving">
                ⊕ {group.label}
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
                    onClick={() => handleChipClick(f.id)}
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
