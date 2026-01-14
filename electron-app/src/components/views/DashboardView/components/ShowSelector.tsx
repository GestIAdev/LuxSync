/**
 * 📁 SHOW SELECTOR - WAVE 428
 * Load saved shows from disk
 * 
 * Shows are saved in the shows/ folder as JSON files
 * Each show contains fixture configurations + layouts
 */

import React, { useEffect, useState } from 'react'
import { Folder, Play, FileJson, RefreshCw } from 'lucide-react'
import './ShowSelector.css'

interface ShowInfo {
  filename: string
  name: string
  fixtureCount: number
  lastModified?: string
}

export const ShowSelector: React.FC = () => {
  const [shows, setShows] = useState<ShowInfo[]>([])
  const [selectedShow, setSelectedShow] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [currentShow, setCurrentShow] = useState<string | null>(null)

  // Fetch available shows on mount
  useEffect(() => {
    fetchShows()
  }, [])

  const fetchShows = async () => {
    setIsLoading(true)
    try {
      // WAVE 428: API may not exist yet - graceful degradation
      const luxApi = window.lux as any
      if (luxApi?.getAvailableShows) {
        const availableShows = await luxApi.getAvailableShows()
        setShows(availableShows || [])
      } else {
        // Fallback: Check if we have any loaded show info
        console.log('[ShowSelector] No getAvailableShows API - using fallback')
        setShows([])
      }
    } catch (err) {
      console.error('[ShowSelector] Error fetching shows:', err)
      setShows([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleLoadShow = async () => {
    if (!selectedShow) return
    
    setIsLoading(true)
    try {
      const luxApi = window.lux as any
      if (luxApi?.loadShow) {
        await luxApi.loadShow(selectedShow)
        setCurrentShow(selectedShow)
        console.log(`[ShowSelector] ✅ Loaded show: ${selectedShow}`)
      } else {
        console.warn('[ShowSelector] loadShow API not available')
      }
    } catch (err) {
      console.error('[ShowSelector] Error loading show:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenFolder = async () => {
    try {
      const luxApi = window.lux as any
      if (luxApi?.openShowsFolder) {
        await luxApi.openShowsFolder()
      } else {
        console.warn('[ShowSelector] openShowsFolder API not available')
      }
    } catch (err) {
      console.error('[ShowSelector] Error opening folder:', err)
    }
  }

  return (
    <div className="show-selector">
      <div className="show-selector-header">
        <span className="show-label">SHOW</span>
        <div className="show-actions-mini">
          <button 
            className="icon-btn" 
            onClick={fetchShows}
            title="Refresh list"
            disabled={isLoading}
          >
            <RefreshCw size={14} className={isLoading ? 'spinning' : ''} />
          </button>
          <button 
            className="icon-btn" 
            onClick={handleOpenFolder}
            title="Open shows folder"
          >
            <Folder size={14} />
          </button>
        </div>
      </div>

      <div className="show-list">
        {shows.length === 0 ? (
          <div className="show-empty">
            <FileJson size={24} opacity={0.4} />
            <span>No shows found</span>
            <span className="show-hint">Create fixtures in BUILD tab</span>
          </div>
        ) : (
          shows.map((show) => (
            <button
              key={show.filename}
              className={`show-item ${selectedShow === show.filename ? 'selected' : ''} ${currentShow === show.filename ? 'loaded' : ''}`}
              onClick={() => setSelectedShow(show.filename)}
            >
              <FileJson size={14} />
              <span className="show-name">{show.name}</span>
              <span className="show-fixtures">{show.fixtureCount} fixtures</span>
            </button>
          ))
        )}
      </div>

      <button
        className="load-show-btn"
        onClick={handleLoadShow}
        disabled={!selectedShow || isLoading || selectedShow === currentShow}
      >
        <Play size={16} />
        <span>{currentShow === selectedShow ? 'LOADED' : 'LOAD SHOW'}</span>
      </button>
    </div>
  )
}

export default ShowSelector
