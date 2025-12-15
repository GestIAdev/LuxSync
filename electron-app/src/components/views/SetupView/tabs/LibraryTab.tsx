/**
 * 📚 LIBRARY TAB - The Memory Vault (AAA Game-Style UI)
 * WAVE 26 Phase 4.5: UI Facelift - Cyberpunk/Netflix Aesthetic
 * 
 * Features:
 * - Sidebar con tarjetas de show (300px fijo)
 * - Panel de detalle Glass-style
 * - SVG icons inline (Lucide-style)
 * - Botones con hierarchy: LOAD (primary cyan), SAVE (bordered), DELETE (danger)
 */

import React, { useState, useEffect, useCallback } from 'react'
import { useSetupStore } from '../../../../stores/setupStore'
import './LibraryTab.css'

// ═══════════════════════════════════════════════════════════════════════════
// SVG ICONS (Lucide-style, outline)
// ═══════════════════════════════════════════════════════════════════════════

const PlusIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
)

const TrashIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    <line x1="10" y1="11" x2="10" y2="17"></line>
    <line x1="14" y1="11" x2="14" y2="17"></line>
  </svg>
)

const SaveIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
    <polyline points="17 21 17 13 7 13 7 21"></polyline>
    <polyline points="7 3 7 8 15 8"></polyline>
  </svg>
)

const FolderIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
  </svg>
)

const PlayIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <polygon points="10 8 16 12 10 16 10 8"></polygon>
  </svg>
)

const XIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
)

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface ShowMetadata {
  filename: string
  name: string
  description: string
  createdAt: string
  modifiedAt: string
  sizeBytes: number
  fixtureCount: number
  version: string
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const getLuxApi = () => (window as any).lux

/**
 * Format date for display
 */
const formatDate = (isoDate: string): string => {
  try {
    const date = new Date(isoDate)
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return isoDate
  }
}

/**
 * Format file size
 */
const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const LibraryTab: React.FC = () => {
  // Store
  const setCurrentShowName = useSetupStore((s) => s.setCurrentShowName)
  
  // State
  const [shows, setShows] = useState<ShowMetadata[]>([])
  const [selectedShow, setSelectedShow] = useState<ShowMetadata | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  
  // Edit state
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [isCreatingNew, setIsCreatingNew] = useState(false)

  // ─────────────────────────────────────────────────────────────────────────
  // LOAD SHOWS
  // ─────────────────────────────────────────────────────────────────────────

  const loadShows = useCallback(async () => {
    try {
      const api = getLuxApi()
      if (!api?.listShows) {
        setError('Show API not available')
        setLoading(false)
        return
      }

      const result = await api.listShows()
      if (result.success) {
        setShows(result.shows)
        
        // Auto-select first show if none selected
        if (!selectedShow && result.shows.length > 0) {
          setSelectedShow(result.shows[0])
          setEditName(result.shows[0].name)
          setEditDescription(result.shows[0].description)
        }
      } else {
        setError(result.error || 'Failed to load shows')
      }
      
      setLoading(false)
    } catch (err) {
      console.error('[LibraryTab] Load error:', err)
      setError('Error loading shows')
      setLoading(false)
    }
  }, [selectedShow])

  useEffect(() => {
    loadShows()
  }, [loadShows])

  // ─────────────────────────────────────────────────────────────────────────
  // ACTIONS
  // ─────────────────────────────────────────────────────────────────────────

  const showSuccess = (message: string) => {
    setSuccessMessage(message)
    setTimeout(() => setSuccessMessage(null), 3000)
  }

  const handleSelectShow = (show: ShowMetadata) => {
    setSelectedShow(show)
    setEditName(show.name)
    setEditDescription(show.description)
    setIsCreatingNew(false)
    setError(null)
  }

  const handleLoadShow = async () => {
    if (!selectedShow) return
    
    const api = getLuxApi()
    if (!api?.loadShow) return

    try {
      setSaving(true)
      const result = await api.loadShow(selectedShow.filename)
      
      if (result.success && result.data) {
        setCurrentShowName(result.data.name)
        showSuccess(`Loaded "${result.data.name}"`)
        await loadShows()
      } else {
        setError(result.error || 'Failed to load show')
      }
    } catch (err) {
      setError('Error loading show')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveShow = async () => {
    if (!editName.trim()) {
      setError('Please enter a show name')
      return
    }

    const api = getLuxApi()
    if (!api?.saveShow) return

    try {
      setSaving(true)
      const result = await api.saveShow(editName.trim(), editDescription)
      
      if (result.success) {
        setCurrentShowName(editName.trim())
        showSuccess(`Saved "${editName.trim()}"`)
        setIsCreatingNew(false)
        await loadShows()
        
        // Select the new/updated show
        const newShows = (await api.listShows()).shows
        const saved = newShows.find((s: ShowMetadata) => s.name === editName.trim())
        if (saved) {
          setSelectedShow(saved)
        }
      } else {
        setError(result.error || 'Failed to save show')
      }
    } catch (err) {
      setError('Error saving show')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteShow = async () => {
    if (!selectedShow) return
    
    // Confirm deletion
    if (!confirm(`Delete "${selectedShow.name}"? This cannot be undone.`)) {
      return
    }

    const api = getLuxApi()
    if (!api?.deleteShow) return

    try {
      setSaving(true)
      const result = await api.deleteShow(selectedShow.filename)
      
      if (result.success) {
        showSuccess(`Deleted "${selectedShow.name}"`)
        setSelectedShow(null)
        setEditName('')
        setEditDescription('')
        await loadShows()
      } else {
        setError(result.error || 'Failed to delete show')
      }
    } catch (err) {
      setError('Error deleting show')
    } finally {
      setSaving(false)
    }
  }

  const handleNewShow = () => {
    setIsCreatingNew(true)
    setSelectedShow(null)
    setEditName('')
    setEditDescription('')
    setError(null)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="library-tab">
        <div className="library-loading">
          <div className="loading-spinner" />
          <span>Loading shows...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="library-tab">
      {/* ═══ SIDEBAR: SHOW LIST ═══ */}
      <aside className="library-sidebar">
        <div className="sidebar-header">
          <h3 className="sidebar-title">SHOWS</h3>
          <button 
            className="btn-new-show"
            onClick={handleNewShow}
            title="Create new show"
          >
            <PlusIcon />
            <span>NEW</span>
          </button>
        </div>
        
        <div className="show-cards">
          {shows.length === 0 ? (
            <div className="empty-sidebar">
              <FolderIcon />
              <p>No shows found</p>
            </div>
          ) : (
            shows.map((show) => (
              <div
                key={show.filename}
                className={`show-card ${selectedShow?.filename === show.filename ? 'active' : ''}`}
                onClick={() => handleSelectShow(show)}
              >
                <div className="card-header">
                  <h4 className="card-title">{show.name}</h4>
                </div>
                <div className="card-meta">
                  <span className="meta-fixtures">{show.fixtureCount} fixtures</span>
                  <span className="meta-divider">•</span>
                  <span className="meta-size">{formatSize(show.sizeBytes)}</span>
                </div>
                <div className="card-footer">
                  <span className="card-date">{formatDate(show.modifiedAt)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* ═══ MAIN: DETAIL PANEL ═══ */}
      <main className="library-content">
        {/* MESSAGES */}
        {error && (
          <div className="alert alert-error">
            <span>{error}</span>
            <button className="alert-close" onClick={() => setError(null)}>
              <XIcon />
            </button>
          </div>
        )}
        {successMessage && (
          <div className="alert alert-success">
            <span>{successMessage}</span>
          </div>
        )}

        {/* NO SELECTION STATE */}
        {!selectedShow && !isCreatingNew && (
          <div className="content-empty">
            <FolderIcon />
            <h3>Select a show to view details</h3>
            <p>or create a new one to get started</p>
            <button className="btn-primary btn-large" onClick={handleNewShow}>
              <PlusIcon />
              <span>Create New Show</span>
            </button>
          </div>
        )}

        {/* DETAIL VIEW */}
        {(selectedShow || isCreatingNew) && (
          <div className="detail-panel">
            {/* HEADER */}
            <header className="panel-header">
              <h1 className="panel-title">{isCreatingNew ? 'NEW SHOW' : selectedShow?.name}</h1>
              {!isCreatingNew && selectedShow && (
                <div className="panel-actions">
                  <button
                    className="btn-icon btn-danger"
                    onClick={handleDeleteShow}
                    disabled={saving || shows.length <= 1}
                    title={shows.length <= 1 ? 'Cannot delete the last show' : 'Delete this show'}
                  >
                    <TrashIcon />
                  </button>
                </div>
              )}
            </header>

            {/* FORM */}
            <div className="panel-body">
              <div className="form-section">
                <label className="form-label">Show Name</label>
                <input
                  type="text"
                  className="form-input glass"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Enter show name..."
                  maxLength={64}
                />
              </div>
              
              <div className="form-section">
                <label className="form-label">Description / Notes</label>
                <textarea
                  className="form-textarea glass"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Add notes about this show setup..."
                  rows={4}
                />
              </div>

              {/* METADATA GRID (only for existing shows) */}
              {selectedShow && !isCreatingNew && (
                <div className="metadata-grid">
                  <div className="meta-item">
                    <span className="meta-label">Fixtures</span>
                    <span className="meta-value">{selectedShow.fixtureCount}</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Size</span>
                    <span className="meta-value">{formatSize(selectedShow.sizeBytes)}</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Created</span>
                    <span className="meta-value">{formatDate(selectedShow.createdAt)}</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Modified</span>
                    <span className="meta-value">{formatDate(selectedShow.modifiedAt)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* FOOTER ACTIONS */}
            <footer className="panel-footer">
              {isCreatingNew ? (
                <>
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      setIsCreatingNew(false)
                      if (shows.length > 0) {
                        handleSelectShow(shows[0])
                      }
                    }}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn-primary"
                    onClick={handleSaveShow}
                    disabled={saving || !editName.trim()}
                  >
                    <SaveIcon />
                    <span>{saving ? 'Saving...' : 'CREATE & SAVE'}</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="btn-secondary"
                    onClick={handleSaveShow}
                    disabled={saving || !editName.trim()}
                  >
                    <SaveIcon />
                    <span>{saving ? 'Saving...' : 'SAVE CHANGES'}</span>
                  </button>
                  <button
                    className="btn-primary btn-glow"
                    onClick={handleLoadShow}
                    disabled={saving}
                  >
                    <PlayIcon />
                    <span>{saving ? 'Loading...' : 'LOAD SHOW'}</span>
                  </button>
                </>
              )}
            </footer>
          </div>
        )}
      </main>
    </div>
  )
}

export default LibraryTab
