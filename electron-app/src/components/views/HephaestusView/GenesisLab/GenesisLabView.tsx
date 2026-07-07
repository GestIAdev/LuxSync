// ═══════════════════════════════════════════════════════════════════════════
// 🧬 WAVE 5000.V3 — ERA V: GenesisLabView
// ═══════════════════════════════════════════════════════════════════════════
//  Main container for the Genetic Laboratory tab inside Hephaestus V3.
//
//  Layout:
//  ┌──────────────────────────────────────────────────────────────────┐
//  │  HEADER: Title + Maintenance button + species count              │
//  ├───────────────────────────────────────────┬──────────────────────┤
//  │  HALL OF FAME PANEL (top, collapsible)    │  LINEAGE INSPECTOR   │
//  ├───────────────────────────────────────────┤  (sidebar, 300px)    │
//  │  LOOT TRAY (grid of organism cards)       │                      │
//  │  Filterable by rarity + status            │                      │
//  └───────────────────────────────────────────┴──────────────────────┘
//
//  WYSIWYG: "Preview in Canvas" dispatches a CustomEvent that the
//  HephaestusView shell can listen to for injecting the materialized clip.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useEffect, useCallback } from 'react'
import { useGenesisStore } from '../../../../stores/useGenesisStore'
import { LootTray } from './LootTray'
import { LineageInspector } from './LineageInspector'
import { HallOfFamePanel } from './HallOfFamePanel'
import './GenesisLab.css'

// ─── COMPONENT ──────────────────────────────────────────────────────────────

export const GenesisLabView: React.FC = () => {
  // Store state
  const organisms = useGenesisStore((s) => s.organisms)
  const hallOfFame = useGenesisStore((s) => s.hallOfFame)
  const lineage = useGenesisStore((s) => s.lineage)
  const species = useGenesisStore((s) => s.species)
  const selectedOrganismId = useGenesisStore((s) => s.selectedOrganismId)
  const isLoading = useGenesisStore((s) => s.isLoading)
  const error = useGenesisStore((s) => s.error)
  const lastMaintenanceAt = useGenesisStore((s) => s.lastMaintenanceAt)
  const filterRarityTier = useGenesisStore((s) => s.filterRarityTier)
  const filterStatus = useGenesisStore((s) => s.filterStatus)

  // Store actions
  const fetchOrganisms = useGenesisStore((s) => s.fetchOrganisms)
  const fetchHallOfFame = useGenesisStore((s) => s.fetchHallOfFame)
  const fetchSpecies = useGenesisStore((s) => s.fetchSpecies)
  const selectOrganism = useGenesisStore((s) => s.selectOrganism)
  const cullOrganism = useGenesisStore((s) => s.cullOrganism)
  const canonizeOrganism = useGenesisStore((s) => s.canonizeOrganism)
  const runMaintenance = useGenesisStore((s) => s.runMaintenance)
  const purgeEcosystem = useGenesisStore((s) => s.purgeEcosystem)
  const setFilterRarityTier = useGenesisStore((s) => s.setFilterRarityTier)
  const setFilterStatus = useGenesisStore((s) => s.setFilterStatus)

  // Initial load
  useEffect(() => {
    fetchOrganisms()
    fetchHallOfFame()
    fetchSpecies()
  }, [fetchOrganisms, fetchHallOfFame, fetchSpecies])

  // Selected organism object
  const selectedOrganism = organisms.find((o) => o.organism_id === selectedOrganismId) ?? null

  // Preview in Canvas — dispatch event for HephaestusView shell to catch
  const handlePreviewInCanvas = useCallback((organismId: string) => {
    window.dispatchEvent(
      new CustomEvent('luxsync:genesis-preview-organism', {
        detail: { organismId },
      }),
    )
    console.log(`[GenesisLab] 🎬 Preview request dispatched for ${organismId}`)
  }, [])

  const handleCull = useCallback((organismId: string) => {
    cullOrganism(organismId)
  }, [cullOrganism])

  const handleCanonize = useCallback(async (organismId: string, customName: string): Promise<boolean> => {
    return canonizeOrganism(organismId, customName)
  }, [canonizeOrganism])

  const handleCanonizeToBuiltins = useCallback(async (organismId: string) => {
    const genesisApi = (window as any).luxsync?.genesis
    if (!genesisApi?.canonizeToBuiltins) {
      console.warn('[GenesisLab] genesis.canonizeToBuiltins IPC not available')
      return
    }

    try {
      const matResult = await genesisApi.materializeClip(organismId)
      if (!matResult.success || !matResult.clip) {
        console.warn(`[GenesisLab] Cannot canonize — materialization failed: ${matResult.error}`)
        return
      }

      const canonResult = await genesisApi.canonizeToBuiltins(matResult.clip, organismId)
      if (canonResult.success) {
        console.log(`[GenesisLab] 💾 Canonized to disk: ${organismId} → ${canonResult.fileName}`)
        useGenesisStore.getState().refreshAll()
      } else {
        console.warn(`[GenesisLab] Canonization failed: ${canonResult.error}`)
      }
    } catch (err) {
      console.error('[GenesisLab] Canonize to builtins error:', err)
    }
  }, [])

  const handleMaintenance = useCallback(() => {
    runMaintenance()
  }, [runMaintenance])

  const handlePurge = useCallback(() => {
    if (window.confirm('☢️ PURGE ECOSYSTEM?\n\nThis will permanently delete ALL organisms except canonized masterpieces. This cannot be undone.')) {
      purgeEcosystem()
    }
  }, [purgeEcosystem])

  const handleDeleteCanonized = useCallback(async (organismId: string) => {
    const genesisApi = (window as any).luxsync?.genesis
    if (!genesisApi?.deleteCanonized) {
      console.warn('[GenesisLab] genesis.deleteCanonized IPC not available')
      return
    }

    if (!window.confirm('🗑️ DELETE CANONIZED ORGANISM?\n\nThis will permanently remove:\n• The organism from the database\n• The .lfx file from builtins/\n• The blueprint entry\n• The effect from the arsenal\n\nThis cannot be undone.')) {
      return
    }

    try {
      const result = await genesisApi.deleteCanonized(organismId)
      if (result.success) {
        console.log(`[GenesisLab] 🗑️ Deleted canonized organism: ${organismId} (file: ${result.deletedFile ? 'yes' : 'no'})`)
        useGenesisStore.getState().refreshAll()
      } else {
        console.warn(`[GenesisLab] Delete failed: ${result.error}`)
      }
    } catch (err) {
      console.error('[GenesisLab] Delete canonized error:', err)
    }
  }, [])

  return (
    <div className="genesis-lab">
      {/* HEADER */}
      <header className="genesis-lab__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className="genesis-lab__title">🧬 GENESIS LABORATORY</span>
          <span style={{ fontSize: '10px', color: '#555' }}>
            {organisms.length} organisms · {species.length} species
          </span>
          {lastMaintenanceAt && (
            <span style={{ fontSize: '9px', color: '#333' }}>
              Last maintenance: {new Date(lastMaintenanceAt).toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="genesis-lab__header-actions">
          {error && (
            <span style={{ fontSize: '9px', color: '#ef4444' }}>⚠ {error}</span>
          )}
          <button
            type="button"
            className="genesis-lab__btn genesis-lab__btn--primary"
            onClick={handleMaintenance}
            disabled={isLoading}
          >
            {isLoading ? '⏳ RUNNING...' : '🧬 RUN MAINTENANCE'}
          </button>
          <button
            type="button"
            className="genesis-lab__btn genesis-lab__btn--danger"
            onClick={handlePurge}
            disabled={isLoading}
          >
            ☢️ PURGE
          </button>
        </div>
      </header>

      {/* BODY */}
      <div className="genesis-lab__body">
        {/* MAIN: Hall of Fame + Loot Tray */}
        <div className="genesis-lab__main">
          <HallOfFamePanel
            candidates={hallOfFame}
            onCanonize={handleCanonize}
            onSelectOrganism={selectOrganism}
          />
          <LootTray
            organisms={organisms}
            selectedOrganismId={selectedOrganismId}
            filterRarityTier={filterRarityTier}
            filterStatus={filterStatus}
            onSelectOrganism={selectOrganism}
            onSetFilterRarityTier={setFilterRarityTier}
            onSetFilterStatus={setFilterStatus}
            onPreviewInCanvas={handlePreviewInCanvas}
          />
        </div>

        {/* SIDEBAR: Lineage Inspector */}
        <div className="genesis-lab__sidebar">
          <LineageInspector
            organism={selectedOrganism}
            lineage={lineage}
            onPreviewInCanvas={handlePreviewInCanvas}
            onCull={handleCull}
            onCanonizeToBuiltins={handleCanonizeToBuiltins}
            onDeleteCanonized={handleDeleteCanonized}
          />
        </div>
      </div>
    </div>
  )
}

export default GenesisLabView
