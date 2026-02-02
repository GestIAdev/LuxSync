/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📚 LIBRARY TAB - WAVE 1113: HARDWARE BINDING & REAL FS
 * "The Blueprint Library" - Browse, search, select fixtures
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * First tab in Forge. Lists all available fixture definitions.
 * - System fixtures (read-only, from /librerias)
 * - User fixtures (editable, from userData/fixtures)
 * 
 * WAVE 1113: Now loads from filesystem via IPC, not localStorage
 * 
 * @module components/views/ForgeView/LibraryTab
 * @version WAVE 1113
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react'
import './LibraryTab.css'
import { 
  Search, 
  Plus, 
  Copy, 
  Trash2, 
  Lock, 
  User,
  Cpu,
  Palette,
  Server,
  ChevronRight,
  AlertCircle,
  RefreshCw,
  Loader
} from 'lucide-react'
import { useLibraryStore, LibraryFixture } from '../../../stores/libraryStore'
import { FixtureDefinition } from '../../../types/FixtureDefinition'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface LibraryTabProps {
  onSelectFixture: (fixture: FixtureDefinition) => void
  onNewFromScratch: () => void
  selectedFixtureId?: string | null
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function getFixtureTypeIcon(type: string): React.ReactNode {
  const lowerType = type?.toLowerCase() || ''
  if (lowerType.includes('moving') || lowerType.includes('beam') || lowerType.includes('spot')) {
    return <Cpu size={16} />
  }
  if (lowerType.includes('wash') || lowerType.includes('par')) {
    return <Palette size={16} />
  }
  return <Server size={16} />
}

function getChannelSummary(fixture: FixtureDefinition): string {
  const channelTypes = fixture.channels
    .filter(ch => ch.type !== 'unknown')
    .map(ch => ch.type)
  
  const hasPan = channelTypes.includes('pan')
  const hasTilt = channelTypes.includes('tilt')
  const hasRGB = channelTypes.includes('red') && channelTypes.includes('green') && channelTypes.includes('blue')
  const hasWheel = channelTypes.includes('color_wheel')
  
  const summary: string[] = []
  if (hasPan && hasTilt) summary.push('P/T')
  if (hasRGB) summary.push('RGB')
  if (hasWheel) summary.push('Wheel')
  if (channelTypes.includes('dimmer')) summary.push('Dim')
  if (channelTypes.includes('strobe')) summary.push('Strb')
  
  return summary.join(' • ') || `${fixture.channels.length}ch`
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const LibraryTab: React.FC<LibraryTabProps> = ({
  onSelectFixture,
  onNewFromScratch,
  selectedFixtureId
}) => {
  // State
  const [searchQuery, setSearchQuery] = useState('')
  const [filterSource, setFilterSource] = useState<'all' | 'system' | 'user'>('all')
  const [cloneDialogFixture, setCloneDialogFixture] = useState<LibraryFixture | null>(null)
  const [cloneName, setCloneName] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  
  // Store
  const { 
    systemFixtures,
    userFixtures,
    isLoading,
    lastError,
    loadFromDisk,
    deleteUserFixture, 
    saveUserFixture,
    isSystemFixture,
    getAllFixtures
  } = useLibraryStore()
  
  // Load fixtures on mount
  useEffect(() => {
    console.log('[LibraryTab] 📂 Loading fixtures from disk...')
    loadFromDisk()
  }, [loadFromDisk])
  
  // Computed: Filtered fixtures
  // WAVE 1116.3 FIX: Add systemFixtures + userFixtures as dependencies
  // so memo recomputes when store loads new data
  const filteredFixtures = useMemo((): LibraryFixture[] => {
    // Use arrays directly instead of getAllFixtures() for proper reactivity
    let fixtures: LibraryFixture[] = [...systemFixtures, ...userFixtures]
    
    // Filter by source
    if (filterSource !== 'all') {
      fixtures = fixtures.filter((f: LibraryFixture) => f.source === filterSource)
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      fixtures = fixtures.filter((f: LibraryFixture) => 
        f.name.toLowerCase().includes(query) ||
        f.manufacturer?.toLowerCase().includes(query) ||
        f.type?.toLowerCase().includes(query)
      )
    }
    
    // Sort: User fixtures first, then by name
    return fixtures.sort((a: LibraryFixture, b: LibraryFixture) => {
      if (a.source !== b.source) {
        return a.source === 'user' ? -1 : 1
      }
      return a.name.localeCompare(b.name)
    })
  }, [systemFixtures, userFixtures, filterSource, searchQuery])
  
  // Handlers
  const handleSelectFixture = useCallback((fixture: LibraryFixture) => {
    console.log(`[LibraryTab] 📖 Selected fixture: ${fixture.name} (${fixture.source})`)
    onSelectFixture(fixture)
  }, [onSelectFixture])
  
  const handleClone = useCallback((fixture: LibraryFixture) => {
    setCloneDialogFixture(fixture)
    setCloneName(`${fixture.name} (Copy)`)
  }, [])
  
  const handleConfirmClone = useCallback(async () => {
    if (!cloneDialogFixture || !cloneName.trim()) return
    
    // Clone by saving a copy with new name and ID
    const clonedFixture: FixtureDefinition = {
      ...cloneDialogFixture,
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: cloneName,
    }
    delete (clonedFixture as any).source
    delete (clonedFixture as any).filePath
    
    const result = await saveUserFixture(clonedFixture)
    if (result.success) {
      console.log(`[LibraryTab] 📋 Cloned fixture: ${cloneName}`)
      onSelectFixture(clonedFixture)
    } else {
      console.error(`[LibraryTab] ❌ Failed to clone: ${result.error}`)
    }
    setCloneDialogFixture(null)
    setCloneName('')
  }, [cloneDialogFixture, cloneName, saveUserFixture, onSelectFixture])
  
  const handleDelete = useCallback((fixtureId: string) => {
    if (isSystemFixture(fixtureId)) {
      console.warn('[LibraryTab] ⚠️ Cannot delete system fixture')
      return
    }
    setDeleteConfirmId(fixtureId)
  }, [isSystemFixture])
  
  const handleConfirmDelete = useCallback(async () => {
    if (!deleteConfirmId) return
    await deleteUserFixture(deleteConfirmId)
    setDeleteConfirmId(null)
  }, [deleteConfirmId, deleteUserFixture])
  
  const handleRefresh = useCallback(() => {
    console.log('[LibraryTab] 🔄 Manual refresh...')
    loadFromDisk()
  }, [loadFromDisk])
  
  // Stats
  const systemCount = systemFixtures.length
  const userCount = userFixtures.length
  
  return (
    <div className="library-tab">
      {/* Header */}
      <div className="library-header">
        <div className="library-title">
          <h2>📚 BLUEPRINT LIBRARY</h2>
          <span className="library-stats">
            {systemCount} System • {userCount} User
          </span>
        </div>
        
        <div className="library-header-actions">
          <button 
            className="library-refresh-btn" 
            onClick={handleRefresh}
            disabled={isLoading}
            title="Refresh Library"
          >
            {isLoading ? <Loader size={16} className="spinning" /> : <RefreshCw size={16} />}
          </button>
          <button className="library-new-btn" onClick={onNewFromScratch}>
            <Plus size={18} />
            <span>New from Scratch</span>
          </button>
        </div>
      </div>
      
      {/* Error message */}
      {lastError && (
        <div className="library-error">
          <AlertCircle size={14} />
          <span>{lastError}</span>
        </div>
      )}
      
      {/* WAVE 1114: System Library Warning Banner */}
      {!isLoading && systemCount === 0 && (
        <div className="library-warning">
          <AlertCircle size={14} />
          <span>
            ⚠️ System Library not found! Check backend console for path details.
            Expected locations: <code>librerias/</code>, <code>resources/librerias/</code>
          </span>
        </div>
      )}
      
      {/* Search & Filter */}
      <div className="library-toolbar">
        <div className="library-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search fixtures..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="library-filter">
          <button 
            className={filterSource === 'all' ? 'active' : ''}
            onClick={() => setFilterSource('all')}
          >
            All
          </button>
          <button 
            className={filterSource === 'system' ? 'active' : ''}
            onClick={() => setFilterSource('system')}
          >
            <Lock size={12} /> System
          </button>
          <button 
            className={filterSource === 'user' ? 'active' : ''}
            onClick={() => setFilterSource('user')}
          >
            <User size={12} /> User
          </button>
        </div>
      </div>
      
      {/* Fixture List */}
      <div className="library-list">
        {filteredFixtures.length === 0 ? (
          <div className="library-empty">
            <AlertCircle size={32} />
            <p>No fixtures found</p>
            <span>Try adjusting your search or filter</span>
          </div>
        ) : (
          filteredFixtures.map(fixture => (
            <div 
              key={`${fixture.source}-${fixture.id}`}
              className={`library-item ${selectedFixtureId === fixture.id ? 'selected' : ''} ${fixture.source}`}
              onClick={() => handleSelectFixture(fixture)}
            >
              <div className="library-item-icon">
                {getFixtureTypeIcon(fixture.type)}
              </div>
              
              <div className="library-item-info">
                <div className="library-item-name">
                  {fixture.name}
                  {fixture.source === 'system' && (
                    <span title="System fixture (read-only)">
                      <Lock size={12} className="system-badge" />
                    </span>
                  )}
                </div>
                <div className="library-item-meta">
                  <span className="manufacturer">{fixture.manufacturer || 'Generic'}</span>
                  <span className="divider">•</span>
                  <span className="type">{fixture.type}</span>
                  <span className="divider">•</span>
                  <span className="channels">{getChannelSummary(fixture)}</span>
                </div>
              </div>
              
              <div className="library-item-actions">
                <button 
                  className="action-btn clone"
                  onClick={(e) => { e.stopPropagation(); handleClone(fixture) }}
                  title={fixture.source === 'system' ? 'Clone to User Library' : 'Duplicate'}
                >
                  <Copy size={14} />
                </button>
                
                {fixture.source === 'user' && (
                  <button 
                    className="action-btn delete"
                    onClick={(e) => { e.stopPropagation(); handleDelete(fixture.id) }}
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
                
                <ChevronRight size={16} className="action-arrow" />
              </div>
            </div>
          ))
        )}
      </div>
      
      {/* Clone Dialog */}
      {cloneDialogFixture && (
        <div className="library-dialog-overlay" onClick={() => setCloneDialogFixture(null)}>
          <div className="library-dialog" onClick={e => e.stopPropagation()}>
            <h3>Clone Fixture</h3>
            <p>Create an editable copy of "{cloneDialogFixture.name}"</p>
            <input
              type="text"
              placeholder="New fixture name..."
              value={cloneName}
              onChange={(e) => setCloneName(e.target.value)}
              autoFocus
            />
            <div className="dialog-actions">
              <button className="cancel" onClick={() => setCloneDialogFixture(null)}>
                Cancel
              </button>
              <button className="confirm" onClick={handleConfirmClone}>
                <Copy size={14} />
                Clone
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Delete Confirmation Dialog */}
      {deleteConfirmId && (
        <div className="library-dialog-overlay" onClick={() => setDeleteConfirmId(null)}>
          <div className="library-dialog delete" onClick={e => e.stopPropagation()}>
            <h3>⚠️ Delete Fixture</h3>
            <p>Are you sure you want to delete this fixture? This action cannot be undone.</p>
            <div className="dialog-actions">
              <button className="cancel" onClick={() => setDeleteConfirmId(null)}>
                Cancel
              </button>
              <button className="confirm delete" onClick={handleConfirmDelete}>
                <Trash2 size={14} />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default LibraryTab
