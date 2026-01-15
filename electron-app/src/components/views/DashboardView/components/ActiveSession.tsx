/**
 * 💾 ACTIVE SESSION - WAVE 438: MEMORY RECALL
 * "The Current Show Card"
 * 
 * Horizontal card showing active show info + quick actions
 * FULLY WIRED TO STAGE PERSISTENCE V2!
 * 
 * Features:
 * - Show name, date, fixture count (reactive from stageStore)
 * - LOAD SHOW button → window.lux.stage.openDialog() → stageStore.loadShowFile
 * - NEW PROJECT button → Redirects to Constructor tab
 * - No Save button (auto-save philosophy)
 * - Auto-migration from v1 handled by stageStore
 */

import React, { useCallback, useState, useEffect } from 'react'
import { useNavigationStore } from '../../../../stores/navigationStore'
import { useStageStore } from '../../../../stores/stageStore'
import { FileIcon } from '../../../icons/LuxIcons'
import './ActiveSession.css'

interface ShowInfo {
  name: string
  filename: string
  fixtureCount: number
  lastModified: string
  size: string
}

export const ActiveSession: React.FC = () => {
  const { setActiveTab } = useNavigationStore()
  const showFile = useStageStore(state => state.showFile)
  const fixtures = useStageStore(state => state.fixtures)
  
  const [currentShow, setCurrentShow] = useState<ShowInfo | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  
  // Update show info from stage store
  useEffect(() => {
    if (showFile) {
      setCurrentShow({
        name: showFile.name || 'Untitled Project',
        filename: `${showFile.name || 'untitled'}.luxshow`,
        fixtureCount: fixtures.length,
        lastModified: showFile.modifiedAt 
          ? new Date(showFile.modifiedAt).toLocaleDateString() 
          : new Date().toLocaleDateString(),
        size: '0 KB' // TODO: calculate from file size if needed
      })
    } else {
      setCurrentShow({
        name: 'Untitled Project',
        filename: 'untitled.lux',
        fixtureCount: 0,
        lastModified: new Date().toLocaleDateString(),
        size: '0 KB'
      })
    }
  }, [showFile, fixtures])
  
  const handleLoadShow = useCallback(async () => {
    setIsLoading(true)
    try {
      // WAVE 438: Use proper window.lux.stage.openDialog API
      const luxApi = (window as any).lux
      if (!luxApi?.stage?.openDialog) {
        console.error('❌ [ActiveSession] window.lux.stage.openDialog not available')
        return
      }
      
      // 1. Invoke native file dialog + auto-load
      // NOTE: The IPC handler automatically loads the file and broadcasts 'lux:stage:loaded'
      const result = await luxApi.stage.openDialog()
      
      if (result?.success) {
        // 2. File loaded successfully by backend
        console.log(`✅ [ActiveSession] Show loaded: ${result.filePath}`)
        if (result.migrated) {
          console.log('🔄 [ActiveSession] Show migrated from v1 to v2')
        }
      } else if (!result?.cancelled) {
        console.error('❌ [ActiveSession] Failed to load show')
      }
    } catch (err) {
      console.error('❌ [ActiveSession] Error in load dialog:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])
  
  const handleNewProject = useCallback(() => {
    setActiveTab('constructor')
  }, [setActiveTab])
  
  return (
    <div className="active-session">
      <div className="session-header">
        <span className="session-icon">💾</span>
        <span className="session-label">ACTIVE SESSION</span>
      </div>
      
      <div className="session-card">
        {/* File Icon */}
        <div className="session-file-icon">
          <FileIcon size={32} color="#00ffff" />
        </div>
        
        {/* Show Info */}
        <div className="session-info">
          <h3 className="session-name">
            {currentShow?.name || 'No Project Loaded'}
          </h3>
          <div className="session-meta">
            {currentShow && (
              <>
                <span className="meta-item">
                  <span className="meta-icon">📅</span>
                  {currentShow.lastModified}
                </span>
                <span className="meta-separator">•</span>
                <span className="meta-item">
                  <span className="meta-icon">💡</span>
                  {currentShow.fixtureCount} fixtures
                </span>
                <span className="meta-separator">•</span>
                <span className="meta-item">
                  <span className="meta-icon">📦</span>
                  {currentShow.size}
                </span>
              </>
            )}
          </div>
        </div>
        
        {/* Actions */}
        <div className="session-actions">
          <button 
            className="session-btn primary"
            onClick={handleLoadShow}
            disabled={isLoading}
          >
            <span className="btn-icon">📂</span>
            <span className="btn-text">LOAD SHOW</span>
          </button>
          
          <button 
            className="session-btn secondary"
            onClick={handleNewProject}
          >
            <span className="btn-icon">✨</span>
            <span className="btn-text">NEW PROJECT</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default ActiveSession
