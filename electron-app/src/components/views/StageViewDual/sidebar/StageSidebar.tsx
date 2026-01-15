/**
 * 
 *  STAGE SIDEBAR - WAVE 432.5: UNIFIED SIDEBAR
 * Panel lateral con 3 tabs: CONTROLS | GROUPS | SCENES
 * 
 * 
 * WAVE 432.5 Changes:
 * - 3 tabs unificadas (eliminada duplicación)
 * - CONTROLS: TheProgrammerContent SIN tabs internas
 * - GROUPS: GroupsPanel con auto-switch
 * - SCENES: SceneBrowser
 * - Iconos custom LuxIcons
 * 
 */

import React, { useMemo, useState, useCallback } from 'react'
import { useSelectionStore } from '../../../../stores/selectionStore'
import { useSceneStore, selectSceneCount } from '../../../../stores/sceneStore'
import { TheProgrammerContent, GroupsPanel } from '../../../programmer'
import { SceneBrowser } from './SceneBrowser'
import { ControlsIcon, GroupIcon, ScenesIcon } from '../../../icons/LuxIcons'
import './StageSidebar.css'

// 
// TYPES
// 

type SidebarTab = 'controls' | 'groups' | 'scenes'

export interface StageSidebarProps {
  isVisible?: boolean
  onClose?: () => void
}

export const StageSidebar: React.FC<StageSidebarProps> = ({
  isVisible = true,
  onClose
}) => {
  // Store State
  const selectedIds = useSelectionStore(state => state.selectedIds)
  const sceneCount = useSceneStore(selectSceneCount)
  
  // Local State
  const [activeTab, setActiveTab] = useState<SidebarTab>('controls')
  
  // Computed
  const selectedCount = useMemo(() => selectedIds.size, [selectedIds])
  
  // Handlers
  const handleClose = useCallback(() => {
    if (onClose) onClose()
  }, [onClose])
  
  const handleSwitchToControls = useCallback(() => {
    setActiveTab('controls')
  }, [])
  
  if (!isVisible) return null
  
  return (
    <div className="stage-sidebar">
      {/* HEADER WITH TABS */}
      <div className="sidebar-header">
        <div className="header-tabs">
          <button
            className={`header-tab ${activeTab === 'controls' ? 'active' : ''}`}
            onClick={() => setActiveTab('controls')}
          >
            <ControlsIcon size={14} />
            <span>CONTROLS</span>
            {selectedCount > 0 && <span className="tab-badge">{selectedCount}</span>}
          </button>
          
          <button
            className={`header-tab ${activeTab === 'groups' ? 'active' : ''}`}
            onClick={() => setActiveTab('groups')}
          >
            <GroupIcon size={14} />
            <span>GROUPS</span>
          </button>
          
          <button
            className={`header-tab ${activeTab === 'scenes' ? 'active' : ''}`}
            onClick={() => setActiveTab('scenes')}
          >
            <ScenesIcon size={14} />
            <span>SCENES</span>
            {sceneCount > 0 && <span className="tab-badge">{sceneCount}</span>}
          </button>
        </div>
        
        <button className="close-btn" onClick={handleClose} title="Close Sidebar">
          
        </button>
      </div>
      
      {/* CONTENT */}
      <div className="sidebar-content">
        {activeTab === 'controls' && <TheProgrammerContent />}
        {activeTab === 'groups' && <GroupsPanel onSwitchToControls={handleSwitchToControls} />}
        {activeTab === 'scenes' && <SceneBrowser />}
      </div>
    </div>
  )
}

export default StageSidebar
