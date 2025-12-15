/**
 * 🎭 LIBRARY TAB - The Library Vault (Show Management)
 * WAVE 26 Phase 4: Complete Implementation
 * 
 * Features:
 * - Master-Detail layout (show list + details panel)
 * - Save/Load/Delete shows
 * - Show metadata display (name, description, fixtures, date)
 * - Auto-create Default.json if folder is empty
 */

import React, { useState, useEffect, useCallback } from 'react'
import { useSetupStore } from '../../../../stores/setupStore'
import './LibraryTab.css'

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
      {/* LEFT: SHOW LIST */}
      <div className="library-list">
        <div className="list-header">
          <h3>📂 Shows</h3>
          <button 
            className="new-show-btn"
            onClick={handleNewShow}
            title="Create new show"
          >
            ➕ NEW
          </button>
        </div>
        
        <div className="show-list">
          {shows.length === 0 ? (
            <div className="list-empty">
              <span>No shows found</span>
            </div>
          ) : (
            shows.map((show) => (
              <div
                key={show.filename}
                className={`show-item ${selectedShow?.filename === show.filename ? 'selected' : ''}`}
                onClick={() => handleSelectShow(show)}
              >
                <div className="show-item-icon">🎭</div>
                <div className="show-item-info">
                  <span className="show-item-name">{show.name}</span>
                  <span className="show-item-meta">
                    {show.fixtureCount} fixtures • {formatSize(show.sizeBytes)}
                  </span>
                </div>
                <div className="show-item-date">
                  {formatDate(show.modifiedAt)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* RIGHT: DETAIL PANEL */}
      <div className="library-detail">
        {/* MESSAGES */}
        {error && (
          <div className="detail-error">
            ⚠️ {error}
            <button onClick={() => setError(null)}>✕</button>
          </div>
        )}
        {successMessage && (
          <div className="detail-success">
            ✅ {successMessage}
          </div>
        )}

        {/* NO SELECTION */}
        {!selectedShow && !isCreatingNew && (
          <div className="detail-empty">
            <div className="empty-icon">📂</div>
            <p>Select a show or create a new one</p>
            <button className="primary-btn" onClick={handleNewShow}>
              ➕ Create New Show
            </button>
          </div>
        )}

        {/* DETAIL CARD */}
        {(selectedShow || isCreatingNew) && (
          <div className="detail-card">
            <div className="detail-header">
              <span className="detail-icon">🎭</span>
              <h2>{isCreatingNew ? 'New Show' : selectedShow?.name}</h2>
            </div>

            {/* FORM */}
            <div className="detail-form">
              <div className="form-group">
                <label>Show Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Enter show name..."
                  maxLength={64}
                />
              </div>
              
              <div className="form-group">
                <label>Description / Notes</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Add notes about this show..."
                  rows={4}
                />
              </div>
            </div>

            {/* METADATA (only for existing shows) */}
            {selectedShow && !isCreatingNew && (
              <div className="detail-metadata">
                <div className="meta-row">
                  <span className="meta-label">Fixtures:</span>
                  <span className="meta-value">{selectedShow.fixtureCount}</span>
                </div>
                <div className="meta-row">
                  <span className="meta-label">Created:</span>
                  <span className="meta-value">{formatDate(selectedShow.createdAt)}</span>
                </div>
                <div className="meta-row">
                  <span className="meta-label">Modified:</span>
                  <span className="meta-value">{formatDate(selectedShow.modifiedAt)}</span>
                </div>
                <div className="meta-row">
                  <span className="meta-label">File:</span>
                  <span className="meta-value filename">{selectedShow.filename}</span>
                </div>
              </div>
            )}

            {/* ACTION BUTTONS */}
            <div className="detail-actions">
              {isCreatingNew ? (
                <>
                  <button
                    className="action-btn cancel"
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
                    className="action-btn save"
                    onClick={handleSaveShow}
                    disabled={saving || !editName.trim()}
                  >
                    {saving ? '💾 Saving...' : '💾 CREATE & SAVE'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="action-btn delete"
                    onClick={handleDeleteShow}
                    disabled={saving || shows.length <= 1}
                    title={shows.length <= 1 ? 'Cannot delete the last show' : 'Delete this show'}
                  >
                    🗑️ DELETE
                  </button>
                  <button
                    className="action-btn save"
                    onClick={handleSaveShow}
                    disabled={saving || !editName.trim()}
                  >
                    {saving ? '💾 Saving...' : '💾 SAVE'}
                  </button>
                  <button
                    className="action-btn load"
                    onClick={handleLoadShow}
                    disabled={saving}
                  >
                    {saving ? '📂 Loading...' : '📂 LOAD'}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default LibraryTab
