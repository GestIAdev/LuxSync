// ═══════════════════════════════════════════════════════════════════════════
// 🧬 WAVE 5000.V3 — ERA V: LootTray
// ═══════════════════════════════════════════════════════════════════════════
//  Grid of organism cards with rarity-colored badges and survival stats.
//  Filterable by rarity tier and status.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useMemo, useState, useCallback } from 'react'
import type { GenesisOrganism } from '../../../../stores/useGenesisStore'
import { getOrganismTag } from '../../../../core/genesis/naming/OrganismTag'

// ─── CONSTANTS ──────────────────────────────────────────────────────────────

const RARITY_TIERS = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC'] as const
const STATUS_FILTERS = ['alive', 'champion', 'culled', 'canonized'] as const
const PAGE_SIZE = 12

// ─── COMPONENT ──────────────────────────────────────────────────────────────

interface LootTrayProps {
  organisms: GenesisOrganism[]
  selectedOrganismId: string | null
  filterRarityTier: string | null
  filterStatus: string | null
  onSelectOrganism: (id: string) => void
  onSetFilterRarityTier: (tier: string | null) => void
  onSetFilterStatus: (status: string | null) => void
  onPreviewInCanvas?: (organismId: string) => void
}

export const LootTray: React.FC<LootTrayProps> = ({
  organisms,
  selectedOrganismId,
  filterRarityTier,
  filterStatus,
  onSelectOrganism,
  onSetFilterRarityTier,
  onSetFilterStatus,
  onPreviewInCanvas,
}) => {
  const sortedOrganisms = useMemo(() => {
    return [...organisms].sort((a, b) => b.fitness_score - a.fitness_score)
  }, [organisms])

  // ─── PAGINATION ───────────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(0)
  const totalPages = Math.max(1, Math.ceil(sortedOrganisms.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages - 1)
  const pageStart = safePage * PAGE_SIZE
  const pageEnd = pageStart + PAGE_SIZE
  const pagedOrganisms = sortedOrganisms.slice(pageStart, pageEnd)

  const goToPrev = useCallback(() => setCurrentPage((p) => Math.max(0, p - 1)), [])
  const goToNext = useCallback(() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1)), [totalPages])

  // Reset page when filter results change drastically
  React.useEffect(() => {
    if (currentPage > totalPages - 1) setCurrentPage(0)
  }, [currentPage, totalPages])

  return (
    <div className="loot-tray">
      {/* Filters */}
      <div className="loot-tray__filters">
        {RARITY_TIERS.map((tier) => (
          <button
            key={tier}
            type="button"
            className={`loot-tray__filter-chip ${filterRarityTier === tier ? 'loot-tray__filter-chip--active' : ''}`}
            onClick={() => onSetFilterRarityTier(filterRarityTier === tier ? null : tier)}
          >
            {tier}
          </button>
        ))}
        <span style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.08)' }} />
        {STATUS_FILTERS.map((status) => (
          <button
            key={status}
            type="button"
            className={`loot-tray__filter-chip ${filterStatus === status ? 'loot-tray__filter-chip--active' : ''}`}
            onClick={() => onSetFilterStatus(filterStatus === status ? null : status)}
          >
            {status.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Grid */}
      {sortedOrganisms.length === 0 ? (
        <div className="genesis-empty">
          <span className="genesis-empty__icon">🧬</span>
          <span className="genesis-empty__text">No organisms match the current filter</span>
        </div>
      ) : (
        <div className="loot-tray__grid">
          {pagedOrganisms.map((org) => {
            const survivalRate = org.trials_count > 0
              ? (org.passes_count / org.trials_count * 100).toFixed(0)
              : '—'
            const isSelected = org.organism_id === selectedOrganismId
            const displayName = getOrganismTag({
              organism_id: org.organism_id,
              custom_name: org.custom_name,
              rarity_tier: org.rarity_tier,
            })

            return (
              <div
                key={org.organism_id}
                className={`loot-card ${isSelected ? 'loot-card--selected' : ''}`}
                onClick={() => onSelectOrganism(org.organism_id)}
              >
                <div className={`loot-card__rarity-bar rarity-bar--${org.rarity_tier}`} />

                <div className="loot-card__header">
                  <span className="loot-card__name">{displayName}</span>
                  <span className={`loot-card__badge rarity--${org.rarity_tier}`}>
                    {org.rarity_tier}
                  </span>
                </div>

                <div className="loot-card__ancestor">
                  ⚗️ {org.blueprint_id}
                </div>

                <div className="loot-card__stats">
                  <span className="loot-card__stat">
                    <span className={`status--${org.status}`}>●</span>
                    <span className="loot-card__stat-value">{org.status}</span>
                  </span>
                  <span className="loot-card__stat">
                    F<span className="loot-card__stat-value">{org.fitness_score.toFixed(3)}</span>
                  </span>
                  <span className="loot-card__stat">
                    S<span className="loot-card__stat-value">{survivalRate}%</span>
                  </span>
                  <span className="loot-card__stat">
                    T<span className="loot-card__stat-value">{org.trials_count}</span>
                  </span>
                </div>

                <div className="loot-card__stats">
                  <span className="loot-card__stat">
                    GEN<span className="loot-card__stat-value">{org.generation}</span>
                  </span>
                  {org.species_id && (
                    <span className="loot-card__stat">
                      SP<span className="loot-card__stat-value">{org.species_id.replace('species_', '')}</span>
                    </span>
                  )}
                </div>

                {onPreviewInCanvas && org.status !== 'culled' && (
                  <button
                    type="button"
                    className="loot-card__preview-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      onPreviewInCanvas(org.organism_id)
                    }}
                  >
                    ► PREVIEW IN CANVAS
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="loot-tray__pagination">
          <button
            type="button"
            className="loot-tray__page-btn"
            onClick={goToPrev}
            disabled={safePage === 0}
          >
            ◀ Anterior
          </button>
          <span className="loot-tray__page-info">
            Página {safePage + 1} / {totalPages} ({sortedOrganisms.length} organismos)
          </span>
          <button
            type="button"
            className="loot-tray__page-btn"
            onClick={goToNext}
            disabled={safePage >= totalPages - 1}
          >
            Siguiente ▶
          </button>
        </div>
      )}
    </div>
  )
}
