/**
 * 🧭 NAVIGATION STORE - Commander Layout Navigation
 * WAVE 9: Gestión de tabs y navegación global
 */

import { create } from 'zustand'

// ============================================
// TYPES
// ============================================

export type TabId = 'live' | 'simulate' | 'selene' | 'setup'

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
// TAB CONFIGURATION
// ============================================

export const TABS: TabConfig[] = [
  {
    id: 'live',
    label: 'LIVE',
    icon: '🎛️',
    shortcut: 'Alt+1',
    description: 'Control en vivo con paletas y movimiento',
  },
  {
    id: 'simulate',
    label: 'SIMULATE',
    icon: '🔭',
    shortcut: 'Alt+2',
    description: 'Visualización 3D del escenario',
  },
  {
    id: 'selene',
    label: 'SELENE LUX',
    icon: '🧠',
    shortcut: 'Alt+3',
    description: 'Inteligencia artificial y métricas',
  },
  {
    id: 'setup',
    label: 'SETUP',
    icon: '⚙️',
    shortcut: 'Alt+4',
    description: 'Configuración de audio, DMX y fixtures',
  },
]

const TAB_ORDER: TabId[] = ['live', 'simulate', 'selene', 'setup']

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
