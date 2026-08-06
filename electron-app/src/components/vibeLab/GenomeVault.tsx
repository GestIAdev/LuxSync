/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🏦 GenomeVault.tsx — Biblioteca de .luxvibe guardados
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Lista los vibes custom guardados en userData/vibes/. Permite cargar,
 * duplicar, borrar, exportar e importar.
 *
 * @module components/vibeLab/GenomeVault
 * @version FASE 4.2
 */

import React, { memo, useEffect, useCallback } from 'react'
import { FolderOpen, Copy, Trash2, FileDown, FileUp } from 'lucide-react'
import { useVibeLabStore } from '../../stores/vibeLabStore'
import type { CustomVibeKey, CustomVibeMeta } from '../../types/CustomVibe'
import './genome-vault.css'

export const GenomeVault: React.FC = memo(() => {
  const vault = useVibeLabStore((s) => s.vault)
  const vaultLoading = useVibeLabStore((s) => s.vaultLoading)
  const loadVault = useVibeLabStore((s) => s.loadVault)
  const openFromVault = useVibeLabStore((s) => s.openFromVault)
  const deleteFromVault = useVibeLabStore((s) => s.deleteFromVault)
  const duplicate = useVibeLabStore((s) => s.duplicate)
  const exportToFile = useVibeLabStore((s) => s.exportToFile)
  const importFromFile = useVibeLabStore((s) => s.importFromFile)

  useEffect(() => {
    loadVault()
  }, [loadVault])

  const handleLoad = useCallback(
    (key: CustomVibeKey) => { openFromVault(key) },
    [openFromVault],
  )

  const handleDelete = useCallback(
    (key: CustomVibeKey) => {
      if (confirm(`Delete this vibe? This cannot be undone.`)) {
        deleteFromVault(key)
      }
    },
    [deleteFromVault],
  )

  const handleDuplicate = useCallback(
    (key: CustomVibeKey) => { duplicate(key) },
    [duplicate],
  )

  const handleExport = useCallback(
    (key: CustomVibeKey) => { exportToFile(key) },
    [exportToFile],
  )

  return (
    <div className="genome-vault">
      <div className="genome-vault-header">
        <span className="genome-vault-title">
          <FolderOpen size={12} /> GENOME VAULT
        </span>
        <div className="genome-vault-actions">
          <button onClick={() => importFromFile()} type="button" title="Import .luxvibe">
            <FileUp size={12} />
          </button>
        </div>
      </div>

      {vaultLoading && <p className="genome-vault-empty">Loading...</p>}

      {!vaultLoading && vault.length === 0 && (
        <p className="genome-vault-empty">No saved vibes yet. Mint one to get started.</p>
      )}

      {!vaultLoading && vault.length > 0 && (
        <div className="genome-vault-list">
          {vault.map((entry: CustomVibeMeta) => (
            <div key={entry.key} className="genome-vault-item">
              <div
                className="genome-vault-item-info"
                onClick={() => handleLoad(entry.key)}
              >
                <span className="genome-vault-item-name">{entry.name}</span>
                <span className="genome-vault-item-meta">
                  {entry.author} · {new Date(entry.updatedAt).toLocaleDateString()}
                </span>
              </div>
              <div className="genome-vault-item-actions">
                <button onClick={() => handleDuplicate(entry.key)} type="button" title="Duplicate">
                  <Copy size={11} />
                </button>
                <button onClick={() => handleExport(entry.key)} type="button" title="Export">
                  <FileDown size={11} />
                </button>
                <button
                  onClick={() => handleDelete(entry.key)}
                  type="button"
                  title="Delete"
                  className="danger"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
})

GenomeVault.displayName = 'GenomeVault'
