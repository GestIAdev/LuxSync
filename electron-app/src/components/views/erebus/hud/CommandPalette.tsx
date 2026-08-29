import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useLibraryStore } from '../../../../stores/libraryStore'
import { useStageStore } from '../../../../stores/stageStore'
import { deriveFixtureTags } from '../../../../stores/assetAdapters'
import type { FixtureV2 } from '../../../../core/stage/ShowFileV2'
import { createDefaultFixture, nextAvailableAddress } from '../../../../core/stage/ShowFileV2'

// ═══════════════════════════════════════════════════════════════════════════
// CommandPalette — Spotlight de Patch
// PROYECTO EREBUS FASE 9
//
// Modal central invocado con Ctrl+K. Buscador estilo Spotlight con fondo
// de cristal (--obs-surface). Filtra fixtures por nombre/tag y emite
// eventos de patch directo sin tocar el ratón.
//
// Navegación: Flechas ↑↓ para moverse, Enter para seleccionar, Esc para cerrar.
// ═══════════════════════════════════════════════════════════════════════════

interface CommandResult {
  id: string
  label: string
  sublabel: string
  type: 'library' | 'fixture' | 'action'
  data?: any
}

export const CommandPalette: React.FC = () => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const systemFixtures = useLibraryStore(s => s.systemFixtures)
  const userFixtures = useLibraryStore(s => s.userFixtures)
  const allLibraryFixtures = useMemo(
    () => [...systemFixtures, ...userFixtures],
    [systemFixtures, userFixtures],
  )
  const stageFixtures = useStageStore(s => s.fixtures)
  const addFixture = useStageStore(s => s.addFixture)

  // ── Ctrl+K to toggle ───────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        e.stopPropagation()
        setOpen(prev => !prev)
      }
      if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open])

  // ── Focus input when opened ────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  // ── Build results ──────────────────────────────────────────────────────────
  const results = useMemo<CommandResult[]>(() => {
    const q = query.toLowerCase().trim()
    const libraryResults: CommandResult[] = allLibraryFixtures
      .filter(f => !q || f.name.toLowerCase().includes(q) || f.manufacturer.toLowerCase().includes(q))
      .slice(0, 8)
      .map(f => ({
        id: `lib-${f.id}`,
        label: f.name,
        sublabel: `${f.manufacturer} · Library`,
        type: 'library' as const,
        data: f,
      }))

    const stageResults: CommandResult[] = stageFixtures
      .filter(f => !q || f.name.toLowerCase().includes(q) || f.id.toLowerCase().includes(q))
      .slice(0, 5)
      .map((f: FixtureV2) => ({
        id: `stage-${f.id}`,
        label: f.name,
        sublabel: `${f.id} · Stage`,
        type: 'fixture' as const,
        data: f,
      }))

    const actionResults: CommandResult[] = q
      ? []
      : [
          { id: 'action-add', label: 'Add Generic Fixture', sublabel: 'Quick patch', type: 'action' as const },
        ]

    return [...libraryResults, ...stageResults, ...actionResults]
  }, [query, allLibraryFixtures, stageFixtures])

  // ── Reset selection when results change ────────────────────────────────────
  useEffect(() => {
    setSelectedIndex(0)
  }, [results])

  // ── Handle selection ───────────────────────────────────────────────────────
  const handleSelect = useCallback(
    (result: CommandResult) => {
      if (result.type === 'library' && result.data) {
        const libFixture = result.data
        const libChCount = libFixture.channels?.length ?? 1
        // WAVE 7729: Use nextAvailableAddress instead of fixtureCount * 4 + 1.
        const addr = nextAvailableAddress(stageFixtures, libChCount)
        const newFixture = createDefaultFixture(
          `fix-${Date.now()}`,
          addr,
          {
            name: libFixture.name,
            model: libFixture.name,
            manufacturer: libFixture.manufacturer,
            type: libFixture.type as any,
            profileId: libFixture.id,
            channelCount: libFixture.channels?.length ?? 1,
            position: { x: 6, y: 3, z: 4 },
            isPlaced: true,
            placementMode: '3d',
          },
        )
        addFixture(newFixture)
      } else if (result.type === 'fixture' && result.data) {
        // Select the fixture on stage
        window.dispatchEvent(
          new CustomEvent('erebus:select-fixture', { detail: { fixtureId: result.data.id } }),
        )
      } else if (result.type === 'action' && result.id === 'action-add') {
        const newFixture = createDefaultFixture(`fix-${Date.now()}`, stageFixtures.length + 1, {
          position: { x: 6, y: 3, z: 4 },
          isPlaced: true,
          placementMode: '3d',
        })
        addFixture(newFixture)
      }
      setOpen(false)
    },
    [stageFixtures, addFixture],
  )

  // ── Keyboard navigation ─────────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => Math.min(prev + 1, results.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (results[selectedIndex]) {
          handleSelect(results[selectedIndex])
        }
      }
    },
    [results, selectedIndex, handleSelect],
  )

  // ── Scroll selected item into view ──────────────────────────────────────────
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const item = list.children[selectedIndex] as HTMLElement
    if (item) {
      item.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  if (!open) return null

  return createPortal(
    <div className="erebus-command-palette-overlay" onClick={() => setOpen(false)}>
      <div className="erebus-command-palette" onClick={e => e.stopPropagation()}>
        {/* Search input */}
        <div className="erebus-cp-input-wrapper">
          <span className="erebus-cp-icon">⌕</span>
          <input
            ref={inputRef}
            type="text"
            className="erebus-cp-input"
            placeholder="Search fixtures, rigs, actions..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <span className="erebus-cp-hint">Esc to close</span>
        </div>

        {/* Results */}
        <div ref={listRef} className="erebus-cp-results">
          {results.length === 0 ? (
            <div className="erebus-cp-empty">No results found</div>
          ) : (
            results.map((result, i) => (
              <div
                key={result.id}
                className={`erebus-cp-result ${i === selectedIndex ? 'erebus-cp-result--active' : ''}`}
                onClick={() => handleSelect(result)}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <div className="erebus-cp-result-main">
                  <span className="erebus-cp-result-label">{result.label}</span>
                  <span className="erebus-cp-result-type">{result.type}</span>
                </div>
                <span className="erebus-cp-result-sublabel">{result.sublabel}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default CommandPalette
