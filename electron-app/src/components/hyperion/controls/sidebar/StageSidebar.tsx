/**
 *
 *  STAGE SIDEBAR - WAVE 7568: CATHEDRAL SHIFT
 * Panel lateral con 3 tabs: CONTROLS | KINETICS | SCENES
 *
 *
 * WAVE 7568 Changes:
 * - GROUPS tab replaced by KINETICS (KineticsCathedral migrated from
 *   HyperionView split-view mode into the sidebar as a native tab)
 * - Eliminado el toggle ⊕ KIN del toolbar y el estado global sidebarMode
 * - CONTROLS: TheProgrammer (componente unificado post-WAVE-4529)
 * - KINETICS: KineticsCathedral (sin onClose — el tab system maneja el cierre)
 * - SCENES: SceneBrowser
 * - Iconos custom LuxIcons
 *
 */

import React, { useMemo, useState, useCallback } from 'react'
import { useSelectionStore } from '../../../../stores/selectionStore'
import { useSceneStore, selectSceneCount } from '../../../../stores/sceneStore'
import { TheProgrammer } from '../index'
import { SceneBrowser } from './SceneBrowser'
import { KineticsCathedral } from '../../kinetics'
// ⚡ WAVE 7566.3: ScenePlayerProvider now lives in HyperionView (above both
// sidebar modes). StageSidebar just consumes the context via SceneBrowser.
import { ControlsIcon, ScenesIcon, MovingHeadIcon } from '../../../icons/LuxIcons'
import './StageSidebar.css'

//
// TYPES
//

type SidebarTab = 'controls' | 'kinetics' | 'scenes'

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
            className={`header-tab ${activeTab === 'kinetics' ? 'active' : ''}`}
            onClick={() => setActiveTab('kinetics')}
          >
            <MovingHeadIcon size={14} />
            <span>KINETICS</span>
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
      {/* ⚡ WAVE 7566.3: ScenePlayerProvider is now in HyperionView (wraps
          the sidebar). No provider needed here. */}
      <div className="sidebar-content">
        {/* WAVE 2051: IMMORTALITY — Keep all tabs mounted, toggle visibility
            Scene player must stay alive when switching tabs (audio/clock persist) */}
        <div style={{ display: activeTab === 'controls' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
          <TheProgrammer isActive={activeTab === 'controls'} />
        </div>
        {/* 🏛️ WAVE 7568: Kinetics Cathedral now lives as a sidebar tab.
            No onClose prop — the close button is handled by the tab system. */}
        <div style={{ display: activeTab === 'kinetics' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
          <KineticsCathedral />
        </div>
        <div style={{ display: activeTab === 'scenes' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
          <SceneBrowser />
        </div>
      </div>
    </div>
  )
}

export default StageSidebar
