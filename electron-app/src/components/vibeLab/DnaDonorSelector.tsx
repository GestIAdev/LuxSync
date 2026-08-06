/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧬 DnaDonorSelector.tsx — Base DNA selector
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Dropdown para seleccionar el baseDNA (los 5 vibes canónicos). Al cambiar,
 * confirma si hay mutaciones no guardadas (rebase).
 *
 * @module components/vibeLab/DnaDonorSelector
 * @version FASE 3
 */

import React, { memo, useState, useCallback } from 'react'
import { ChevronDown } from 'lucide-react'
import { useVibeLabStore, useIsDirty, useMutationCount } from '../../stores/vibeLabStore'
import { VIBE_REGISTRY } from '../../engine/vibe/profiles/index'
import type { BaseDNA } from '../../types/CustomVibe'
import './dna-donor-selector.css'

// Los 5 vibes canónicos base
const CANONICAL_VIBES: BaseDNA[] = Object.keys(VIBE_REGISTRY).filter(
  (k) => !k.startsWith('custom:'),
) as BaseDNA[]

export const DnaDonorSelector: React.FC = memo(() => {
  const draft = useVibeLabStore((s) => s.draft)
  const rebase = useVibeLabStore((s) => s.rebase)
  const isDirty = useIsDirty()
  const mutationCount = useMutationCount()

  const [isOpen, setIsOpen] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [pendingDonor, setPendingDonor] = useState<BaseDNA | null>(null)

  const currentBase = draft?.baseDNA ?? 'techno-club'

  const handleSelect = useCallback(
    (donor: BaseDNA) => {
      setIsOpen(false)
      if (donor === currentBase) return

      if (isDirty || mutationCount > 0) {
        setPendingDonor(donor)
        setShowConfirm(true)
      } else {
        rebase(donor, false)
      }
    },
    [currentBase, isDirty, mutationCount, rebase],
  )

  const handleConfirmRebase = useCallback(
    (keepMutations: boolean) => {
      if (pendingDonor) {
        rebase(pendingDonor, keepMutations)
      }
      setShowConfirm(false)
      setPendingDonor(null)
    },
    [pendingDonor, rebase],
  )

  const handleCancelRebase = useCallback(() => {
    setShowConfirm(false)
    setPendingDonor(null)
  }, [])

  return (
    <div className="dna-donor-selector">
      <button
        className="dna-donor-button"
        onClick={() => setIsOpen(!isOpen)}
        type="button"
        title="Select base DNA donor"
      >
        <span className="dna-donor-label">DNA</span>
        <span className="dna-donor-value">{currentBase}</span>
        <ChevronDown size={12} className={`dna-donor-chevron ${isOpen ? 'open' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="dna-donor-overlay" onClick={() => setIsOpen(false)} />
          <div className="dna-donor-dropdown">
            {CANONICAL_VIBES.map((vibe) => (
              <button
                key={vibe}
                className={`dna-donor-option ${vibe === currentBase ? 'active' : ''}`}
                onClick={() => handleSelect(vibe)}
                type="button"
              >
                {vibe}
              </button>
            ))}
          </div>
        </>
      )}

      {/* ── Confirm rebase modal ─────────────────────────────────────── */}
      {showConfirm && (
        <div className="dna-donor-modal-overlay" onClick={handleCancelRebase}>
          <div className="dna-donor-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Re-base DNA</h3>
            <p>
              You have {mutationCount} {mutationCount === 1 ? 'mutation' : 'mutations'}.
              Switching to <strong>{pendingDonor}</strong>:
            </p>
            <div className="dna-donor-modal-actions">
              <button onClick={() => handleConfirmRebase(true)} type="button">
                Keep mutations
              </button>
              <button onClick={() => handleConfirmRebase(false)} type="button">
                Discard all
              </button>
              <button onClick={handleCancelRebase} type="button">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
})

DnaDonorSelector.displayName = 'DnaDonorSelector'
