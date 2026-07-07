// ═══════════════════════════════════════════════════════════════════════════
// 🧬 WAVE 5000.V3 — ERA V: HallOfFamePanel
// ═══════════════════════════════════════════════════════════════════════════
//  Highlighted section for legendary/mythic organisms that qualify for
//  canonization. Features the "Bautizar y Canonizar" button.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react'
import type { HallOfFameCandidate } from '../../../../stores/useGenesisStore'

// ─── COMPONENT ──────────────────────────────────────────────────────────────

interface HallOfFamePanelProps {
  candidates: HallOfFameCandidate[]
  onCanonize: (organismId: string, customName: string) => Promise<boolean>
  onSelectOrganism: (id: string) => void
}

export const HallOfFamePanel: React.FC<HallOfFamePanelProps> = ({
  candidates,
  onCanonize,
  onSelectOrganism,
}) => {
  const [canonizingId, setCanonizingId] = useState<string | null>(null)
  const [customName, setCustomName] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [suggestedName, setSuggestedName] = useState('')
  const [isLoadingName, setIsLoadingName] = useState(false)

  const handleCanonizeClick = async (candidate: HallOfFameCandidate) => {
    setCanonizingId(candidate.organism_id)
    setCustomName(candidate.custom_name ?? '')
    setShowModal(true)

    if (!candidate.custom_name) {
      setIsLoadingName(true)
      try {
        const api = (window as any).luxsync?.genesis
        if (api?.suggestName) {
          const result = await api.suggestName(candidate.organism_id)
          if (result.success && result.name) {
            setSuggestedName(result.name)
            setCustomName(result.name)
          }
        }
      } catch {
        // IPC not available — silent
      } finally {
        setIsLoadingName(false)
      }
    }
  }

  const handleConfirmCanonize = async () => {
    if (!canonizingId) return
    const success = await onCanonize(canonizingId, customName)
    if (success) {
      setShowModal(false)
      setCanonizingId(null)
      setCustomName('')
      setSuggestedName('')
    }
  }

  return (
    <div className="hof-panel">
      <div className="hof-panel__title">
        <span>👑</span>
        <span>HALL OF FAME</span>
        <span style={{ fontSize: '9px', color: '#666', fontWeight: 400 }}>
          ({candidates.length})
        </span>
      </div>

      {candidates.length === 0 ? (
        <div style={{ fontSize: '10px', color: '#444', padding: '8px 0' }}>
          No legendary organisms have proven themselves yet.
          <br />
          Organisms with 25+ trials and &gt;85% survival will appear here.
        </div>
      ) : (
        candidates.map((candidate) => {
          const survivalRate = candidate.trials_count > 0
            ? (candidate.passes_count / candidate.trials_count * 100).toFixed(0)
            : '—'
          const displayName = candidate.custom_name ?? candidate.organism_id.slice(0, 12)

          return (
            <div key={candidate.organism_id} className="hof-card">
              <div
                className="hof-card__info"
                onClick={() => onSelectOrganism(candidate.organism_id)}
                style={{ cursor: 'pointer' }}
              >
                <span className="hof-card__name">{displayName}</span>
                <span className="hof-card__stats">
                  {candidate.rarity_tier} · F{candidate.fitness_score.toFixed(3)} · S{survivalRate}% · T{candidate.trials_count}
                </span>
              </div>
              <div className="hof-card__actions">
                <button
                  type="button"
                  className="hof-card__btn"
                  onClick={() => handleCanonizeClick(candidate)}
                >
                  👑 CANONIZE
                </button>
              </div>
            </div>
          )
        })
      )}

      {/* Canonize Modal */}
      {showModal && canonizingId && (
        <div
          className="genesis-modal-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false) }}
        >
          <div className="genesis-modal">
            <div className="genesis-modal__title">👑 Bautizar y Canonizar</div>
            <div style={{ fontSize: '11px', color: '#888' }}>
              This organism will become an immutable blueprint in the catalog.
              Choose a definitive name for this legendary effect.
            </div>
            {suggestedName && (
              <div style={{ fontSize: '10px', color: '#5a9', marginTop: '4px' }}>
                🎲 Suggested: {suggestedName}
              </div>
            )}
            <input
              type="text"
              className="genesis-modal__input"
              placeholder={isLoadingName ? 'Generating name...' : 'Enter legendary name...'}
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmCanonize()
                if (e.key === 'Escape') setShowModal(false)
              }}
              maxLength={48}
            />
            <div className="genesis-modal__actions">
              <button
                type="button"
                className="genesis-lab__btn"
                onClick={() => setShowModal(false)}
              >
                CANCEL
              </button>
              <button
                type="button"
                className="genesis-lab__btn genesis-lab__btn--primary"
                onClick={handleConfirmCanonize}
                disabled={!customName.trim()}
              >
                👑 CANONIZE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
