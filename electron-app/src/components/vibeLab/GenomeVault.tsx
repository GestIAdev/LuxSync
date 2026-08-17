/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🏦 GenomeVault.tsx — Biblioteca de .luxvibe guardados
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Lista los vibes custom guardados en userData/vibes/. Permite cargar,
 * duplicar, borrar, exportar e importar.
 *
 * PROTEUS §6.8: Search/filter bar — filters the vault list by name and tags.
 *
 * @module components/vibeLab/GenomeVault
 * @version FASE 4.2 + PROTEUS §6.8
 */

import React, { memo, useEffect, useCallback, useState, useMemo } from 'react'
import { FolderOpen, Copy, Trash2, FileDown, FileUp, Search, X } from 'lucide-react'
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

  // PROTEUS §6.8: Search query state
  const [searchQuery, setSearchQuery] = useState('')

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

  // PROTEUS §6.8: Filter vault by search query against name + tags + author
  const filteredVault = useMemo(() => {
    if (!searchQuery.trim()) return vault
    const query = searchQuery.toLowerCase().trim()
    return vault.filter((entry) => {
      const nameMatch = entry.name.toLowerCase().includes(query)
      const tagMatch = entry.tags?.some((tag) => tag.toLowerCase().includes(query))
      const authorMatch = entry.author?.toLowerCase().includes(query)
      return nameMatch || tagMatch || authorMatch
    })
  }, [vault, searchQuery])

  const hasVault = vault.length > 0
  const hasResults = filteredVault.length > 0
  const isSearching = searchQuery.trim().length > 0

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

      {/* PROTEUS §6.8: Search/Filter bar — only shown when vault has items */}
      {hasVault && (
        <div className="genome-vault-search">
          <Search size={11} className="genome-vault-search-icon" />
          <input
            type="text"
            className="genome-vault-search-input"
            placeholder="Search name, tags, author..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search genome vault"
          />
          {searchQuery && (
            <button
              className="genome-vault-search-clear"
              onClick={() => setSearchQuery('')}
              type="button"
              title="Clear search"
              aria-label="Clear search"
            >
              <X size={11} />
            </button>
          )}
        </div>
      )}

      {vaultLoading && <p className="genome-vault-empty">Loading...</p>}

      {!vaultLoading && !hasVault && (
        <p className="genome-vault-empty">No saved vibes yet. Mint one to get started.</p>
      )}

      {/* PROTEUS §6.8: No results from search filter */}
      {!vaultLoading && hasVault && isSearching && !hasResults && (
        <p className="genome-vault-empty">No vibes match "{searchQuery}".</p>
      )}

      {!vaultLoading && hasResults && (
        <div className="genome-vault-list">
          {filteredVault.map((entry: CustomVibeMeta) => (
            <div key={entry.key} className="genome-vault-item">
              <div
                className="genome-vault-item-info"
                onClick={() => handleLoad(entry.key)}
              >
                <span className="genome-vault-item-name">{entry.name}</span>
                <span className="genome-vault-item-meta">
                  {entry.author} · {new Date(entry.updatedAt).toLocaleDateString()}
                  {entry.tags && entry.tags.length > 0 && ` · ${entry.tags.join(', ')}`}
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
