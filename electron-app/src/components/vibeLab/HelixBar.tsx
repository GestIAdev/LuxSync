/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧬 HelixBar.tsx — Header bar
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Cabecera del Vibe Lab: DNA donor selector, nombre del vibe, autor,
 * SafetyInterlock, y acciones (save, export, etc — Fase 4).
 *
 * @module components/vibeLab/HelixBar
 * @version FASE 3
 */

import React, { memo } from 'react'
import { Dna, Save, Upload, Download } from 'lucide-react'
import { DnaDonorSelector } from './DnaDonorSelector'
import { SafetyInterlock, MutationBadge } from './kit'
import {
  useVibeLabStore,
  useInterlock,
  useMutationCount,
  useIsDirty,
} from '../../stores/vibeLabStore'
import './helix-bar.css'

export const HelixBar: React.FC = memo(() => {
  const draft = useVibeLabStore((s) => s.draft)
  const setInterlock = useVibeLabStore((s) => s.setInterlock)
  const setMeta = useVibeLabStore((s) => s.setMeta)
  const interlock = useInterlock()
  const mutationCount = useMutationCount()
  const isDirty = useIsDirty()

  const vibeName = draft?.meta?.name ?? 'Untitled Vibe'
  const author = draft?.meta?.author ?? 'Unknown'

  return (
    <header className="helix-bar">
      {/* ── Left: DNA donor + name ───────────────────────────────────── */}
      <div className="helix-bar-left">
        <DnaDonorSelector />
        <div className="helix-bar-title-block">
          <div className="helix-bar-name-row">
            <Dna size={14} className="helix-bar-dna-icon" />
            <input
              className="helix-bar-name-input"
              value={vibeName}
              onChange={(e) => setMeta({ name: e.target.value })}
              placeholder="Untitled Vibe"
              aria-label="Vibe name"
            />
            {isDirty && <span className="helix-bar-dirty-dot" title="Unsaved changes" />}
          </div>
          <span className="helix-bar-author">by {author}</span>
        </div>
      </div>

      {/* ── Center: Mutation badge ───────────────────────────────────── */}
      <div className="helix-bar-center">
        <MutationBadge count={mutationCount} accent="#00e5ff" />
        <span className="helix-bar-mutation-label">
          {mutationCount} {mutationCount === 1 ? 'mutation' : 'mutations'}
        </span>
      </div>

      {/* ── Right: Interlock + actions ───────────────────────────────── */}
      <div className="helix-bar-right">
        <SafetyInterlock mode={interlock} onChange={setInterlock} />
        <div className="helix-bar-actions">
          <button className="helix-bar-action-btn" title="Save to Vault (Fase 4)" disabled type="button">
            <Save size={14} />
          </button>
          <button className="helix-bar-action-btn" title="Export (Fase 4)" disabled type="button">
            <Download size={14} />
          </button>
          <button className="helix-bar-action-btn" title="Import (Fase 4)" disabled type="button">
            <Upload size={14} />
          </button>
        </div>
      </div>
    </header>
  )
})

HelixBar.displayName = 'HelixBar'
