/**
 * 🧭 NAVIGATION STORE - WAVE 428: Full System Restore
 * 6 Tabs Architecture
 * 
 * STAGES:
 *   - dashboard: Session management, show load, power control
 *   - constructor: Fixture creation/editing
 *   - live: Performance hub with simulator
 *   - calibration: Hardware setup (pan/tilt offsets)
 * 
 * TOOLS:
 *   - setup: Audio Input + DMX configuration
 *   - core: LUX CORE monitoring (visible, not hidden)
 */

import { create } from 'zustand'

// ============================================
// TYPES - WAVE 428: 4 Stages + 2 Tools
// ============================================

export type StageId = 'dashboard' | 'constructor' | 'live' | 'calibration'
export type ToolId = 'setup' | 'core'
export type TabId = StageId | ToolId

export interface TabConfig {
  id: TabId
  label: string
  icon: string
  customIcon?: boolean  // true = usar SVG custom (no Lucide)
  type: 'stage' | 'tool'
  shortcut: string
  description: string
}

export interface NavigationState {
  activeTab: TabId
  previousTab: TabId | null
  tabHistory: TabId[]
  
  // Actions
  setActiveTab: (tab: TabId) => void
  goBack: () => void
  nextTab: () => void
  prevTab: () => void
}

// ============================================
// TAB CONFIGURATION - WAVE 428.1: 3 Stages + 3 Tools
// ============================================

export const TABS: TabConfig[] = [
  // === STAGES (3 principales - flujo de trabajo) ===
  {
    id: 'dashboard',
    label: 'COMMAND',
    icon: 'bolt',           // IconDashboard (custom SVG)
    customIcon: true,
    type: 'stage',
    shortcut: 'Alt+1',
    description: 'Command Center - Session & Show Load',
  },
  {
    id: 'live',
    label: 'LIVE',
    icon: 'monitor',        // IconLiveStage (custom SVG)
    customIcon: true,
    type: 'stage',
    shortcut: 'Alt+2',
    description: 'Live Performance - Stage Simulator',
  },
  {
    id: 'calibration',
    label: 'CALIBRATE',
    icon: 'target',         // IconCalibration (custom SVG)
    customIcon: true,
    type: 'stage',
    shortcut: 'Alt+3',
    description: 'Hardware Setup - Pan/Tilt Offsets',
  },
  
  // === TOOLS (3 utilidades) ===
  {
    id: 'constructor',
    label: 'BUILD',
    icon: 'construct',      // IconConstruct (custom SVG)
    customIcon: true,
    type: 'tool',           // WAVE 428.1: BUILD es TOOL, no stage
    shortcut: 'Alt+4',
    description: 'Fixture Constructor - Create & Edit Fixtures',
  },
  {
    id: 'setup',
    label: 'SETUP',
    icon: 'settings',       // IconSetup (custom SVG)
    customIcon: true,
    type: 'tool',
    shortcut: 'Alt+5',
    description: 'Audio Input & DMX Configuration',
  },
  {
    id: 'core',
    label: 'LUX CORE',
    icon: 'brain',          // IconLuxCore (custom SVG)
    customIcon: true,
    type: 'tool',
    shortcut: 'Alt+6',
    description: 'Selene AI Monitoring & Telemetry',
  },
]

const TAB_ORDER: TabId[] = ['dashboard', 'constructor', 'live', 'calibration', 'setup', 'core']

// ============================================
// STORE - WAVE 423
// ============================================

export const useNavigationStore = create<NavigationState>((set, get) => ({
  activeTab: 'dashboard',  // WAVE 423: Start at Command Center
  previousTab: null,
  tabHistory: ['dashboard'],
  
  setActiveTab: (tab: TabId) => {
    const { activeTab, tabHistory } = get()
    if (tab === activeTab) return
    
    set({
      previousTab: activeTab,
      activeTab: tab,
      tabHistory: [...tabHistory.slice(-9), tab], // Keep last 10
    })
  },
  
  goBack: () => {
    const { previousTab, tabHistory } = get()
    if (previousTab) {
      set({
        activeTab: previousTab,
        previousTab: tabHistory.length > 2 ? tabHistory[tabHistory.length - 3] : null,
        tabHistory: tabHistory.slice(0, -1),
      })
    }
  },
  
  nextTab: () => {
    const { activeTab } = get()
    const currentIndex = TAB_ORDER.indexOf(activeTab)
    const nextIndex = (currentIndex + 1) % TAB_ORDER.length
    get().setActiveTab(TAB_ORDER[nextIndex])
  },
  
  prevTab: () => {
    const { activeTab } = get()
    const currentIndex = TAB_ORDER.indexOf(activeTab)
    const prevIndex = (currentIndex - 1 + TAB_ORDER.length) % TAB_ORDER.length
    get().setActiveTab(TAB_ORDER[prevIndex])
  },
}))
