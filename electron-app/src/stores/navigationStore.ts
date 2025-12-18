/**
 * 🧭 NAVIGATION STORE - Commander Layout Navigation
 * WAVE 9: Gestión de tabs y navegación global
 */

import { create } from 'zustand'

// ============================================
// TYPES
// ============================================

export type TabId = 'live' | 'simulate' | 'core' | 'setup'

export interface TabConfig {
  id: TabId
  label: string
  icon: string
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
// TAB CONFIGURATION - WAVE 10.6: Pro Icons
// ============================================

export const TABS: TabConfig[] = [
  {
    id: 'live',
    label: 'COMMAND',  // 🔄 WAVE 35.2: Rebranded from LIVE
    icon: 'activity',  // Lucide: Activity (pulse wave)
    shortcut: 'Alt+1',
    description: 'Centro de comando y monitorización',
  },
  {
    id: 'simulate',
    label: 'LUX STAGE',  // 🔄 WAVE 34.5: Rebranded from SIMULATE
    icon: 'monitor',   // Lucide: Monitor (screen)
    shortcut: 'Alt+2',
    description: 'Visualización del escenario - Canvas 2.0',
  },
  {
    id: 'core',
    label: 'LUX CORE',
    icon: 'brain',     // Lucide: Brain (AI core)
    shortcut: 'Alt+3',
    description: 'Centro de monitorización y diagnóstico de Selene',
  },
  {
    id: 'setup',
    label: 'SETUP',
    icon: 'settings',  // Lucide: Settings (gear)
    shortcut: 'Alt+4',
    description: 'Configuración de audio, DMX y fixtures',
  },
]

const TAB_ORDER: TabId[] = ['live', 'simulate', 'core', 'setup']

// ============================================
// STORE
// ============================================

export const useNavigationStore = create<NavigationState>((set, get) => ({
  activeTab: 'live',
  previousTab: null,
  tabHistory: ['live'],
  
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
