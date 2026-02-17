/**
 * 🧭 NAVIGATION STORE - WAVE 1110: THE GREAT UNBUNDLING
 * 7 Tabs Architecture - Forge as First-Class Citizen
 * 
 * STAGES:
 *   - dashboard: Session management, show load, power control
 *   - live: Performance hub with simulator
 *   - calibration: Hardware setup (pan/tilt offsets)
 * 
 * TOOLS:
 *   - constructor: Stage layout builder (Build)
 *   - forge: Fixture definition editor (The Blacksmith)
 *   - setup: Audio Input + DMX configuration
 *   - core: LUX CORE monitoring (visible, not hidden)
 */

import { create } from 'zustand'

// ============================================
// TYPES - WAVE 1110: 3 Stages + 4 Tools (Forge promoted)
// ============================================

export type StageId = 'dashboard' | 'live' | 'calibration' | 'chronos'
export type ToolId = 'constructor' | 'forge' | 'hephaestus' | 'nexus' | 'core'
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
  
  // WAVE 1112: Target fixture for Forge
  targetFixtureId: string | null
  
  // WAVE 2044: Target Hephaestus clip for Chronos → Hephaestus bridge
  targetHephClipId: string | null
  
  // WAVE 2044.5: BPM UNITY — Pass BPM from Chronos to Hephaestus via THE HANDOFF
  targetBpm: number | null
  
  // Actions
  setActiveTab: (tab: TabId) => void
  goBack: () => void
  nextTab: () => void
  prevTab: () => void
  
  // WAVE 1112: Edit fixture action (Builder -> Forge bridge)
  editFixture: (fixtureId: string) => void
  clearTargetFixture: () => void
  
  // WAVE 2044: Edit clip in Hephaestus (Chronos -> Hephaestus bridge)
  editInHephaestus: (clipId: string) => void
  editInHephaestusWithBpm: (clipId: string, bpm: number) => void  // WAVE 2044.5
  clearTargetHephClip: () => void
}

// ============================================
// TAB CONFIGURATION - WAVE 1110: 3 Stages + 4 Tools (Forge promoted)
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
  {
    id: 'chronos',
    label: 'CHRONOS',
    icon: 'chronos',        // IconChronos (custom SVG) - WAVE 2004
    customIcon: true,
    type: 'stage',
    shortcut: 'Alt+4',
    description: 'Chronos Studio - Offline Timeline Editor',
  },
  
  // === TOOLS (4 utilidades - WAVE 1110: Forge promoted) ===
  {
    id: 'constructor',
    label: 'BUILD',
    icon: 'construct',      // IconConstruct (custom SVG)
    customIcon: true,
    type: 'tool',
    shortcut: 'Alt+5',      // WAVE 2004: Shifted for Chronos
    description: 'Stage Layout - Position & Group Fixtures',
  },
  {
    id: 'forge',
    label: 'FORGE',
    icon: 'forge',          // IconForge (custom SVG) - WAVE 1110
    customIcon: true,
    type: 'tool',
    shortcut: 'Alt+6',      // WAVE 2004: Shifted
    description: 'Fixture Forge - Create & Edit Definitions',
  },
  {
    id: 'hephaestus',
    label: 'HEPHAESTUS',
    icon: 'hephaestus',     // IconHephaestus (custom SVG) - WAVE 2030.3
    customIcon: true,
    type: 'tool',
    shortcut: 'Alt+7',
    description: 'Hephaestus Studio - FX Curve Automation Editor',
  },
  // {
  //   id: 'setup',
  //   label: 'SETUP',
  //   icon: 'settings',       // IconSetup (custom SVG)
  //   customIcon: true,
  //   type: 'tool',
  //   shortcut: 'Alt+7',
  //   description: 'Audio Input & DMX Configuration',
  // },
  {
    id: 'nexus',
    label: 'DMX NEXUS',
    icon: 'plug',
    customIcon: true,
    type: 'tool',
    shortcut: 'Alt+8',      // WAVE 2030.3: Shifted for Hephaestus
    description: 'Visual Patching & Fixture Location',
  },
  {
    id: 'core',
    label: 'LUX CORE',
    icon: 'brain',          // IconLuxCore (custom SVG)
    customIcon: true,
    type: 'tool',
    shortcut: 'Alt+9',      // WAVE 2030.3: Shifted for Hephaestus
    description: 'Selene AI Monitoring & Telemetry',
  },
]

const TAB_ORDER: TabId[] = ['dashboard', 'live', 'calibration', 'chronos', 'constructor', 'forge', 'hephaestus', 'nexus', 'core']

// ============================================
// STORE - WAVE 1112: Added targetFixtureId for Builder -> Forge bridge
// ============================================

export const useNavigationStore = create<NavigationState>((set, get) => ({
  activeTab: 'dashboard',  // WAVE 423: Start at Command Center
  previousTab: null,
  tabHistory: ['dashboard'],
  
  // WAVE 1112: Target fixture for Forge
  targetFixtureId: null,
  
  // WAVE 2044: Target Hephaestus clip for Chronos → Hephaestus bridge
  targetHephClipId: null,
  
  // WAVE 2044.5: BPM UNITY — Pass BPM from Chronos to Hephaestus
  targetBpm: null,
  
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
  
  // WAVE 1112: Edit fixture action - Builder -> Forge bridge
  editFixture: (fixtureId: string) => {
    console.log(`[NavigationStore] 🔨 Navigating to Forge with fixture: ${fixtureId}`)
    set({ targetFixtureId: fixtureId })
    get().setActiveTab('forge')
  },
  
  clearTargetFixture: () => {
    set({ targetFixtureId: null })
  },
  
  // WAVE 2044: Edit clip in Hephaestus — Chronos → Hephaestus bridge
  // Mirrors editFixture pattern: store targetId → navigate to tab → consumer auto-loads
  editInHephaestus: (clipId: string) => {
    console.log(`[NavigationStore] ⚒️ Navigating to Hephaestus with clip: ${clipId}`)
    set({ targetHephClipId: clipId })
    get().setActiveTab('hephaestus')
  },
  
  // WAVE 2044.5: BPM UNITY — Edit clip with BPM context
  editInHephaestusWithBpm: (clipId: string, bpm: number) => {
    console.log(`[NavigationStore] ⚒️ Navigating to Hephaestus with clip: ${clipId}, BPM: ${bpm}`)
    set({ targetHephClipId: clipId, targetBpm: bpm })
    get().setActiveTab('hephaestus')
  },
  
  clearTargetHephClip: () => {
    set({ targetHephClipId: null, targetBpm: null })  // WAVE 2044.5: Clear BPM too
  },
}))

// ═══════════════════════════════════════════════════════════════════════════
// 🛡️ WAVE 2042.13.4: REACT 19 FIX - Stable Selectors
// ═══════════════════════════════════════════════════════════════════════════

/** Selector: Active tab (string - stable) */
export const selectActiveTab = (state: NavigationState) => state.activeTab

/** Selector: setActiveTab function (stable reference) */
export const selectSetActiveTab = (state: NavigationState) => state.setActiveTab

/** Selector: MainLayout needs activeTab */
export const selectMainLayoutNav = (state: NavigationState) => ({
  activeTab: state.activeTab,
})

/** Selector: Sidebar needs activeTab + setActiveTab */
export const selectSidebarNav = (state: NavigationState) => ({
  activeTab: state.activeTab,
  setActiveTab: state.setActiveTab,
})

/** Selector: KeyboardProvider - tab navigation */
export const selectKeyboardNav = (state: NavigationState) => ({
  nextTab: state.nextTab,
  prevTab: state.prevTab,
})

/** Selector: StageConstructor - tab + fixture editing */
export const selectStageConstructorNav = (state: NavigationState) => ({
  setActiveTab: state.setActiveTab,
  editFixture: state.editFixture,
})

/** Selector: FixtureForge - target fixture navigation */
export const selectFixtureForgeNav = (state: NavigationState) => ({
  targetFixtureId: state.targetFixtureId,
  clearTargetFixture: state.clearTargetFixture,
})

/** Selector: HephaestusView - target clip navigation (WAVE 2044: TIME BRIDGE) */
export const selectHephaestusNav = (state: NavigationState) => ({
  targetHephClipId: state.targetHephClipId,
  clearTargetHephClip: state.clearTargetHephClip,
})

/** Selector: ChronosLayout - editInHephaestus action (WAVE 2044: TIME BRIDGE) */
export const selectChronosHephBridge = (state: NavigationState) => ({
  setActiveTab: state.setActiveTab,
  editInHephaestus: state.editInHephaestus,
})

// ═══════════════════════════════════════════════════════════════════════════
