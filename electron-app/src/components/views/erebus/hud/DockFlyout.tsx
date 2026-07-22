import React, { useMemo, useState, useCallback, useEffect } from 'react'
import { useLibraryStore, type LibraryFixture } from '../../../../stores/libraryStore'
import { useStageStore } from '../../../../stores/stageStore'
import { FixtureCard } from './FixtureCard'
import type { RigV2 } from '../../../../core/stage/ShowFileV2'

// ═══════════════════════════════════════════════════════════════════════════
// DockFlyout — Panel lateral de 280px con cards de fixtures
// PROYECTO EREBUS FASE 9
//
// Se despliega al hacer hover sobre un icono de categoría en el DockRail.
// Se retrae instantáneamente al iniciar un drag desde una FixtureCard.
// Soporta pin (doble click en icono) para sesiones de patch intensivo.
// ═══════════════════════════════════════════════════════════════════════════

const CATEGORY_MAP: Record<string, string[]> = {
  moving: ['moving-head', 'scanner'],
  par: ['par', 'wash', 'bar'],
  strobe: ['strobe', 'blinder'],
  laser: ['laser'],
  rigging: [],
  ingenio: ['fan', 'fog', 'mirror-ball', 'pyro', 'effect', 'generic'],
}

interface DockFlyoutProps {
  categoryId: string
  pinned: boolean
  visible: boolean
}

export const DockFlyout: React.FC<DockFlyoutProps> = ({ categoryId, pinned, visible }) => {
  const systemFixtures = useLibraryStore(s => s.systemFixtures)
  const userFixtures = useLibraryStore(s => s.userFixtures)
  const allFixtures = useMemo(
    () => [...systemFixtures, ...userFixtures],
    [systemFixtures, userFixtures],
  )
  const addRig = useStageStore(s => s.addRig)
  const [searchQuery, setSearchQuery] = useState('')
  const [retracted, setRetracted] = useState(false)

  // ── Listen for retract event from FixtureCard drag start ─────────────────
  useEffect(() => {
    const handleRetract = () => setRetracted(true)
    const handleRestore = () => setRetracted(false)

    window.addEventListener('erebus:dock-flyout-retract', handleRetract)
    window.addEventListener('erebus:dock-flyout-restore', handleRestore)
    return () => {
      window.removeEventListener('erebus:dock-flyout-retract', handleRetract)
      window.removeEventListener('erebus:dock-flyout-restore', handleRestore)
    }
  }, [])

  // ── Filter fixtures by category and search ────────────────────────────────
  const filteredFixtures = useMemo(() => {
    const categoryTypes = CATEGORY_MAP[categoryId] ?? []
    let fixtures: LibraryFixture[]

    if (categoryTypes.length === 0) {
      fixtures = []
    } else {
      fixtures = allFixtures.filter(f => categoryTypes.includes(f.type))
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      fixtures = fixtures.filter(
        f =>
          f.name.toLowerCase().includes(q) ||
          f.manufacturer.toLowerCase().includes(q),
      )
    }

    return fixtures
  }, [allFixtures, categoryId, searchQuery])

  const handleAddRig = useCallback((type: 'truss' | 'totem') => {
    const rigId = `rig-${Date.now()}`
    const rig: RigV2 = {
      id: rigId,
      position: { x: 0, y: 0, z: 0 },
      height: type === 'totem' ? 2.5 : 3.5,
      orientation: type === 'totem' ? 'totem' : 'truss-front' as any,
    }
    addRig(rig)
    window.dispatchEvent(new CustomEvent('erebus:rig-created', { detail: { rigId } }))
  }, [addRig])

  const shouldShow = (visible || pinned) && !retracted
  if (!shouldShow) return null

  return (
    <div className={`erebus-dock-flyout ${pinned ? 'erebus-dock-flyout--pinned' : ''}`}>
      {/* Search bar */}
      <div className="erebus-dock-flyout-search">
        <input
          type="text"
          placeholder="Search fixtures..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="erebus-dock-flyout-input"
        />
      </div>

      {/* Fixture cards or rig cards */}
      <div className="erebus-dock-flyout-list">
        {categoryId === 'rigging' ? (
          <div className="erebus-rig-cards">
            <button
              className="erebus-rig-card"
              onClick={() => handleAddRig('truss')}
              title="Add a 3m truss at stage center"
            >
              <span className="erebus-rig-card-icon">─</span>
              <span className="erebus-rig-card-name">Truss (3m)</span>
              <span className="erebus-rig-card-desc">Horizontal truss, 3.5m height</span>
            </button>
            <button
              className="erebus-rig-card"
              onClick={() => handleAddRig('totem')}
              title="Add a 2.5m totem at stage center"
            >
              <span className="erebus-rig-card-icon">│</span>
              <span className="erebus-rig-card-name">Totem (2.5m)</span>
              <span className="erebus-rig-card-desc">Vertical tower, 2.5m height</span>
            </button>
          </div>
        ) : filteredFixtures.length === 0 ? (
          <div className="erebus-dock-flyout-empty">
            No fixtures found
          </div>
        ) : (
          filteredFixtures.map(fixture => (
            <FixtureCard key={fixture.id} fixture={fixture} />
          ))
        )}
      </div>

      {/* Pin indicator */}
      {pinned && (
        <div className="erebus-dock-flyout-pin-badge">Pinned</div>
      )}
    </div>
  )
}

export default DockFlyout
