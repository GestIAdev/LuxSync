// ═══════════════════════════════════════════════════════════════════════════
// 🧬 WAVE 5000.V3 — ERA V: LineageInspector
// ═══════════════════════════════════════════════════════════════════════════
//  Sidebar panel showing the ancestor chain, generation, and delta summary
//  for the selected organism.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useMemo } from 'react'
import type { GenesisOrganism, LineageNode } from '../../../../stores/useGenesisStore'

// ─── COMPONENT ──────────────────────────────────────────────────────────────

interface LineageInspectorProps {
  organism: GenesisOrganism | null
  lineage: LineageNode[]
  onPreviewInCanvas: (organismId: string) => void
  onCull: (organismId: string) => void
  onCanonizeToBuiltins?: (organismId: string) => void
}

export const LineageInspector: React.FC<LineageInspectorProps> = ({
  organism,
  lineage,
  onPreviewInCanvas,
  onCull,
  onCanonizeToBuiltins,
}) => {
  const sortedLineage = useMemo(() => {
    return [...lineage].sort((a, b) => a.depth - b.depth)
  }, [lineage])

  if (!organism) {
    return (
      <div className="genesis-empty" style={{ padding: '24px 16px' }}>
        <span className="genesis-empty__icon">🔬</span>
        <span className="genesis-empty__text">Select an organism to inspect its lineage</span>
      </div>
    )
  }

  const survivalRate = organism.trials_count > 0
    ? (organism.passes_count / organism.trials_count * 100).toFixed(1)
    : '—'

  return (
    <div className="lineage-inspector">
      {/* Organism Identity */}
      <div className="lineage-inspector__section">
        <div className="lineage-inspector__label">Organism</div>
        <div className="lineage-inspector__value">
          {organism.custom_name ?? organism.organism_id.slice(0, 12)}
        </div>
        <div style={{ fontSize: '9px', color: '#555', marginTop: '2px' }}>
          ID: {organism.organism_id}
        </div>
      </div>

      {/* Stats */}
      <div className="lineage-inspector__section">
        <div className="lineage-inspector__label">Vital Stats</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#666' }}>Fitness</span>
            <span style={{ color: '#00ff88', fontFamily: 'var(--font-mono, monospace)' }}>
              {organism.fitness_score.toFixed(3)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#666' }}>Survival</span>
            <span style={{ color: '#aaa', fontFamily: 'var(--font-mono, monospace)' }}>
              {survivalRate}% ({organism.passes_count}/{organism.trials_count})
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#666' }}>Rarity</span>
            <span className={`loot-card__badge rarity--${organism.rarity_tier}`} style={{ fontSize: '8px' }}>
              {organism.rarity_tier}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#666' }}>Generation</span>
            <span style={{ color: '#aaa', fontFamily: 'var(--font-mono, monospace)' }}>
              GEN-{organism.generation}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#666' }}>Species</span>
            <span style={{ color: '#aaa', fontFamily: 'var(--font-mono, monospace)' }}>
              {organism.species_id ?? 'unassigned'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#666' }}>Operator</span>
            <span style={{ color: '#aaa', fontFamily: 'var(--font-mono, monospace)' }}>
              {organism.operator_used}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#666' }}>L2 Distance</span>
            <span style={{ color: '#aaa', fontFamily: 'var(--font-mono, monospace)' }}>
              {organism.l2_distance_parent.toFixed(4)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#666' }}>Status</span>
            <span className={`status--${organism.status}`} style={{ fontWeight: 700 }}>
              {organism.status}
            </span>
          </div>
        </div>
      </div>

      {/* Lineage Path */}
      <div className="lineage-inspector__section">
        <div className="lineage-inspector__label">Ancestral Path</div>
        {sortedLineage.length === 0 ? (
          <div style={{ fontSize: '10px', color: '#444' }}>No lineage data available</div>
        ) : (
          <div className="lineage-inspector__path">
            {sortedLineage.map((node, idx) => {
              const isCurrent = node.organism_id === organism.organism_id
              const name = node.custom_name ?? node.organism_id.slice(0, 10)
              return (
                <React.Fragment key={node.node_id}>
                  {idx > 0 && <div className="lineage-node__connector" />}
                  <div className={`lineage-node ${isCurrent ? 'lineage-node--current' : ''}`}>
                    <span className="lineage-node__depth">{node.depth}</span>
                    <span className="lineage-node__name">{name}</span>
                    {node.rarity_tier && (
                      <span className={`loot-card__badge rarity--${node.rarity_tier}`} style={{ fontSize: '7px' }}>
                        {node.rarity_tier.slice(0, 3)}
                      </span>
                    )}
                  </div>
                </React.Fragment>
              )
            })}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="lineage-inspector__section" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <button
          type="button"
          className="genesis-lab__btn genesis-lab__btn--primary"
          onClick={() => onPreviewInCanvas(organism.organism_id)}
          disabled={organism.status === 'culled'}
        >
          ▶ PREVIEW IN CANVAS
        </button>
        {onCanonizeToBuiltins && (organism.status === 'alive' || organism.status === 'champion') && (
          <button
            type="button"
            className="genesis-lab__btn"
            style={{ background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.3)', color: '#ffd700' }}
            onClick={() => onCanonizeToBuiltins(organism.organism_id)}
          >
            💾 CANONIZE TO DISK
          </button>
        )}
        {organism.status === 'alive' || organism.status === 'champion' ? (
          <button
            type="button"
            className="genesis-lab__btn genesis-lab__btn--danger"
            onClick={() => onCull(organism.organism_id)}
          >
            🗑️ CULL ORGANISM
          </button>
        ) : null}
      </div>
    </div>
  )
}
