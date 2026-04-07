/**
 * 🔒 WAVE 2490: THE TIER SEPARATION PROTOCOL — License Store
 *
 * Zustand store que mantiene el tier de licencia en el renderer.
 * Se hidrata una sola vez al boot via IPC → window.lux.getLicenseTier()
 *
 * Tiers:
 *   DJ_FOUNDER   → Dashboard, Live, Calibration, Build, Forge, Nexus, Core
 *   FULL_SUITE   → Todo lo anterior + Chronos + Hephaestus
 */

import { create } from 'zustand'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type LicenseTier = 'DJ_FOUNDER' | 'FULL_SUITE'

/** Tabs restringidos para DJ_FOUNDER */
const DJ_FOUNDER_RESTRICTED_TABS = new Set(['chronos', 'hephaestus'])

// ═══════════════════════════════════════════════════════════════════════════
// STORE
// ═══════════════════════════════════════════════════════════════════════════

interface LicenseState {
  tier: LicenseTier
  hydrated: boolean
  /** Hidrata el tier desde main process (llamar una vez al boot) */
  hydrate: () => Promise<void>
  /** ¿Este tab está permitido para el tier actual? */
  isTabAllowed: (tabId: string) => boolean
}

export const useLicenseStore = create<LicenseState>((set, get) => ({
  tier: 'FULL_SUITE',
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return
    try {
      const tier = await (window as any).lux.getLicenseTier()
      if (tier === 'DJ_FOUNDER' || tier === 'FULL_SUITE') {
        set({ tier, hydrated: true })
        const tierLabel = tier === 'FULL_SUITE' ? 'FULL SUITE ★' : 'DJ FOUNDER'
        const tierColor = tier === 'FULL_SUITE' ? '#00e5ff' : '#fbbf24'
        console.log(
          `%c🔑 OBSIDIAN VAULT%c ACTIVADO — Tier: %c${tierLabel}`,
          'color:#00ff90;font-weight:bold;font-family:monospace',
          'color:#aaa;font-family:monospace',
          `color:${tierColor};font-weight:bold;font-family:monospace`
        )
      } else {
        set({ hydrated: true })
      }
    } catch {
      // Dev mode o error — mantener FULL_SUITE por defecto
      set({ hydrated: true })
      console.log('%c🔑 OBSIDIAN VAULT%c modo dev — tier por defecto: FULL_SUITE', 'color:#00ff90;font-weight:bold', 'color:#666')
    }
  },

  isTabAllowed: (tabId: string) => {
    const { tier } = get()
    if (tier === 'FULL_SUITE') return true
    return !DJ_FOUNDER_RESTRICTED_TABS.has(tabId)
  },
}))
