/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧬 HelixBar.tsx — Header bar
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Cabecera del Vibe Lab: DNA donor selector, nombre del vibe, autor,
 * SafetyInterlock, y acciones (save, export, import — Fase 4).
 *
 * @module components/vibeLab/HelixBar
 * @version FASE 4.3
 */

import React, { memo, useCallback } from 'react'
import { Dna, Save, Upload, FolderOpen } from 'lucide-react'
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
  const importFromFile = useVibeLabStore((s) => s.importFromFile)
  const interlock = useInterlock()
  const mutationCount = useMutationCount()
  const isDirty = useIsDirty()

  const vibeName = draft?.meta?.name ?? 'Untitled Vibe'
  const author = draft?.meta?.author ?? 'Unknown'

  // Save → opens the MintDialog (which calls mint() on confirm)
  const handleSave = useCallback(() => {
    window.dispatchEvent(new CustomEvent('vibeLab:openMint'))
  }, [])

  // Vault → opens the GenomeVault drawer (which has export per-item + import)
  const handleOpenVault = useCallback(() => {
    window.dispatchEvent(new CustomEvent('vibeLab:toggleVault'))
  }, [])

  // Import → directly calls the IPC import dialog
  const handleImport = useCallback(() => {
    void importFromFile()
  }, [importFromFile])

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
          <button
            className="helix-bar-action-btn"
            title="Save to Vault"
            onClick={handleSave}
            type="button"
          >
            <Save size={14} />
          </button>
          <button
            className="helix-bar-action-btn"
            title="Open Genome Vault"
            onClick={handleOpenVault}
            type="button"
          >
            <FolderOpen size={14} />
          </button>
          <button
            className="helix-bar-action-btn"
            title="Import .luxvibe"
            onClick={handleImport}
            type="button"
          >
            <Upload size={14} />
          </button>
        </div>
      </div>
    </header>
  )
})

HelixBar.displayName = 'HelixBar'
