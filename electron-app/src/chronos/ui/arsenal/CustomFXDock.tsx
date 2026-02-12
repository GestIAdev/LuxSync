/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚒️ CUSTOM FX DOCK - WAVE 2030.7: THE ARSENAL MEETS HEPHAESTUS
 * 
 * Panel de efectos personalizados (.lfx) de Hephaestus integrado en Chronos.
 * Los Titanes finalmente se conocen.
 * 
 * FEATURES:
 * - Mini-tabs por categoría (All, Phys, Col, Mov, Ctrl)
 * - Grid scrollable de clips .lfx
 * - Drag to Timeline (mismo payload que librería)
 * - Click para preview momentáneo
 * - Botón [+] NEW abre Hephaestus
 * 
 * @module chronos/ui/arsenal/CustomFXDock
 * @version WAVE 2030.7
 */

import React, { useState, useEffect, useCallback, useMemo, memo } from 'react'
import type { DragPayload } from '../../core/TimelineClip'
import { serializeDragPayload } from '../../core/TimelineClip'
import './CustomFXDock.css'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Metadata from HephFileIO.listClips() */
interface HephClipMetadata {
  id: string
  name: string
  author: string
  category: string
  tags: string[]
  durationMs: number
  effectType: string
  paramCount: number
  filePath: string
  modifiedAt: number
}

/** Filter tabs */
type FilterTab = 'all' | 'physics' | 'color' | 'movement' | 'control'

const FILTER_TABS: { id: FilterTab; label: string; icon: string }[] = [
  { id: 'all',      label: 'ALL',  icon: '⚒️' },
  { id: 'physics',  label: 'PHYS', icon: '🔧' },
  { id: 'color',    label: 'COL',  icon: '🎨' },
  { id: 'movement', label: 'MOV',  icon: '💫' },
  { id: 'control',  label: 'CTRL', icon: '🎛️' },
]

/** Category to icon mapping */
const CATEGORY_ICONS: Record<string, string> = {
  'atmospheric': '🌫️',
  'strobe':      '⚡',
  'color':       '🎨',
  'movement':    '💫',
  'physics':     '🔧',
  'control':     '🎛️',
  'pulse':       '💓',
  'chase':       '🏃',
  'fade':        '🌙',
  'default':     '⚒️',
}

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM FX PAD - Individual .lfx clip button
// ═══════════════════════════════════════════════════════════════════════════

interface CustomFXPadProps {
  clip: HephClipMetadata
  isRecording: boolean
  onDragStart?: (payload: DragPayload) => void
  onDragEnd?: () => void
  onClick?: (clip: HephClipMetadata) => void
}

const CustomFXPad: React.FC<CustomFXPadProps> = memo(({
  clip,
  isRecording,
  onDragStart,
  onDragEnd,
  onClick,
}) => {
  const icon = CATEGORY_ICONS[clip.category] ?? CATEGORY_ICONS['default']
  
  const handleDragStart = useCallback((e: React.DragEvent) => {
    // 🔥 WAVE 2030.17: THE BRIDGE - Hephaestus payload for timeline
    const payload: DragPayload = {
      source: 'hephaestus',
      clipType: 'fx',
      subType: clip.effectType,
      hephFilePath: clip.filePath,
      defaultDurationMs: clip.durationMs,
      name: clip.name, // WAVE 2030.17: Include name for display
    }
    
    // WAVE 2030.17: Send ALL required MIME types for drag recognition
    const serialized = serializeDragPayload(payload)
    e.dataTransfer.setData('application/luxsync-heph', serialized)   // Hephaestus specific
    e.dataTransfer.setData('application/luxsync-fx', serialized)     // FX type (timeline recognition)
    e.dataTransfer.setData('application/luxsync-clip', serialized)   // Generic clip
    e.dataTransfer.effectAllowed = 'copyMove'
    
    // Drag ghost
    const ghost = document.createElement('div')
    ghost.className = 'custom-fx-drag-ghost'
    ghost.textContent = `${icon} ${clip.name}`
    ghost.style.position = 'fixed'
    ghost.style.top = '-100px'
    document.body.appendChild(ghost)
    e.dataTransfer.setDragImage(ghost, 0, 0)
    setTimeout(() => document.body.removeChild(ghost), 0)
    
    onDragStart?.(payload)
  }, [clip, icon, onDragStart])
  
  const handleClick = useCallback(() => {
    // TODO: Preview momentáneo del clip
    onClick?.(clip)
  }, [clip, onClick])
  
  return (
    <div
      className={`custom-fx-pad ${isRecording ? 'rec-mode' : ''}`}
      draggable={!isRecording}
      onDragStart={isRecording ? undefined : handleDragStart}
      onDragEnd={isRecording ? undefined : onDragEnd}
      onClick={handleClick}
      title={`${clip.name} (${clip.author})\n${clip.paramCount} params • ${Math.round(clip.durationMs / 1000)}s`}
    >
      <span className="custom-fx-icon">{icon}</span>
      <span className="custom-fx-name">{clip.name}</span>
      <span className="custom-fx-params">{clip.paramCount}P</span>
    </div>
  )
})

CustomFXPad.displayName = 'CustomFXPad'

// ═══════════════════════════════════════════════════════════════════════════
// NEW FX BUTTON - Opens Hephaestus
// ═══════════════════════════════════════════════════════════════════════════

const NewFXButton: React.FC = memo(() => {
  const handleClick = useCallback(() => {
    // 🔥 Navigate to Hephaestus view
    // Using window event since we're in Chronos context
    window.dispatchEvent(new CustomEvent('luxsync:navigate', {
      detail: { view: 'hephaestus' }
    }))
  }, [])
  
  return (
    <div
      className="custom-fx-pad new-fx-button"
      onClick={handleClick}
      title="Create new custom effect in Hephaestus"
    >
      <span className="custom-fx-icon">+</span>
      <span className="custom-fx-name">NEW</span>
    </div>
  )
})

NewFXButton.displayName = 'NewFXButton'

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export interface CustomFXDockProps {
  isRecording?: boolean
  onDragStart?: (payload: DragPayload) => void
  onDragEnd?: () => void
}

export const CustomFXDock: React.FC<CustomFXDockProps> = memo(({
  isRecording = false,
  onDragStart,
  onDragEnd,
}) => {
  const [clips, setClips] = useState<HephClipMetadata[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  
  // Load clips from Hephaestus on mount
  useEffect(() => {
    const loadClips = async () => {
      if (!window.luxsync?.hephaestus?.list) {
        console.warn('[CustomFXDock] Hephaestus IPC not available')
        setIsLoading(false)
        return
      }
      
      try {
        const result = await window.luxsync.hephaestus.list()
        if (result.success && result.clips) {
          setClips(result.clips)
          console.log(`[CustomFXDock] Loaded ${result.clips.length} custom FX`)
        }
      } catch (error) {
        console.error('[CustomFXDock] Failed to load clips:', error)
      } finally {
        setIsLoading(false)
      }
    }
    
    loadClips()
    
    // Refresh when Hephaestus saves a new clip
    const handleRefresh = () => loadClips()
    window.addEventListener('luxsync:heph-library-changed', handleRefresh)
    return () => window.removeEventListener('luxsync:heph-library-changed', handleRefresh)
  }, [])
  
  // Filter clips by active tab
  const filteredClips = useMemo(() => {
    if (activeTab === 'all') return clips
    
    return clips.filter(clip => {
      const cat = clip.category.toLowerCase()
      const tags = clip.tags.map(t => t.toLowerCase())
      
      switch (activeTab) {
        case 'physics':
          return cat.includes('physic') || tags.some(t => t.includes('physic'))
        case 'color':
          return cat.includes('color') || clip.effectType === 'color' || tags.some(t => t.includes('color'))
        case 'movement':
          return cat.includes('move') || cat.includes('chase') || tags.some(t => t.includes('move'))
        case 'control':
          return cat.includes('control') || tags.some(t => t.includes('control'))
        default:
          return true
      }
    })
  }, [clips, activeTab])
  
  return (
    <div className="custom-fx-dock">
      {/* Header with tabs */}
      <div className="custom-fx-header">
        <span className="custom-fx-title">CUSTOM FX</span>
        <div className="custom-fx-tabs">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.id}
              className={`custom-fx-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              title={tab.label}
            >
              {tab.icon}
            </button>
          ))}
        </div>
      </div>
      
      {/* Grid of custom FX */}
      <div className="custom-fx-scroll">
        {isLoading ? (
          <div className="custom-fx-loading">
            <span>⏳</span>
          </div>
        ) : (
          <div className="custom-fx-grid">
            {filteredClips.map(clip => (
              <CustomFXPad
                key={clip.id}
                clip={clip}
                isRecording={isRecording}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
              />
            ))}
            
            {/* Always show NEW button at the end */}
            <NewFXButton />
            
            {/* Empty state */}
            {filteredClips.length === 0 && !isLoading && (
              <div className="custom-fx-empty">
                <span>No custom FX yet</span>
                <span>Click + to create</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
})

CustomFXDock.displayName = 'CustomFXDock'

export default CustomFXDock
