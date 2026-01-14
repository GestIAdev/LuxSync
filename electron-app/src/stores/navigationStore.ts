/**
 * 🧭 NAVIGATION STORE - WAVE 423: Stage System
 * 3 Stages + 1 Tool Architecture
 * 
 * STAGES:
 *   - dashboard: Session management, power control
 *   - live: Performance hub with simulator
 *   - calibration: Hardware setup (absorbs constructor + setup)
 * 
 * TOOLS:
 *   - core: LUX CORE monitoring (visible, not hidden)
 */

import { create } from 'zustand'

// ============================================
// TYPES - WAVE 423: 3 Stages + 1 Tool
// ============================================

export type StageId = 'dashboard' | 'live' | 'calibration'
export type ToolId = 'core'
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
// TAB CONFIGURATION - WAVE 423: 3 Stages + 1 Tool
// ============================================

export const TABS: TabConfig[] = [
  // === STAGES (3 principales) ===
  {
    id: 'dashboard',
    label: 'COMMAND',
    icon: 'bolt',           // TODO: Usar IconDmxBolt (custom SVG)
    customIcon: true,
    type: 'stage',
    shortcut: 'Alt+1',
    description: 'Command Center - Session & Power Control',
  },
  {
    id: 'live',
    label: 'LIVE',
    icon: 'monitor',        // Lucide: Monitor (mantener por ahora)
    customIcon: false,
    type: 'stage',
    shortcut: 'Alt+2',
    description: 'Live Performance - Stage Simulator',
  },
  {
    id: 'calibration',
    label: 'CALIBRATE',
    icon: 'target',         // TODO: Crear SVG custom
    customIcon: true,
    type: 'stage',
    shortcut: 'Alt+3',
    description: 'Hardware Setup - Fixture Calibration',
  },
  
  // === TOOL (auxiliar visible - "es bonita") ===
  {
    id: 'core',
    label: 'LUX CORE',
    icon: 'brain',          // Lucide: Brain (mantener)
    customIcon: false,
    type: 'tool',
    shortcut: 'Alt+4',
    description: 'Selene AI Monitoring & Telemetry',
  },
]

const TAB_ORDER: TabId[] = ['dashboard', 'live', 'calibration', 'core']

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
