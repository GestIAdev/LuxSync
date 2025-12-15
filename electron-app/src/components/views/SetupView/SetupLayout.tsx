/**
 * 🏗️ SETUP LAYOUT - The Dashboard Skeleton
 * WAVE 26 Phase 1: Edge-to-Edge Container
 * 
 * Estructura:
 * - SetupStatusBar (44px fixed)
 * - SetupTabsNavigation (botones grandes)
 * - Content Area (flex-grow)
 */

import React from 'react'
import { SetupStatusBar } from './SetupStatusBar'
import { useSetupStore, SetupTab } from '../../../stores/setupStore'
import './SetupLayout.css'

// ============================================
// TAB CONFIGURATION
// ============================================

interface TabConfig {
  id: SetupTab
  label: string
  icon: string
}

const TABS: TabConfig[] = [
  { id: 'devices', label: 'DEVICES', icon: '🔌' },
  { id: 'patch',   label: 'PATCH',   icon: '💡' },
  { id: 'library', label: 'LIBRARY', icon: '📚' },
]

// ============================================
// TABS NAVIGATION
// ============================================

const SetupTabsNavigation: React.FC = () => {
  const activeTab = useSetupStore((s) => s.activeTab)
  const setActiveTab = useSetupStore((s) => s.setActiveTab)
  
  return (
    <nav className="setup-tabs-nav">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          className={`setup-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => setActiveTab(tab.id)}
        >
          <span className="tab-icon">{tab.icon}</span>
          <span className="tab-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}

// ============================================
// MAIN LAYOUT
// ============================================

interface SetupLayoutProps {
  children: React.ReactNode
}

export const SetupLayout: React.FC<SetupLayoutProps> = ({ children }) => {
  return (
    <div className="setup-layout">
      <SetupStatusBar />
      <SetupTabsNavigation />
      <div className="setup-content">
        {children}
      </div>
    </div>
  )
}

export default SetupLayout
