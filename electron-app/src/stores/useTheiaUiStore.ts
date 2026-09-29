/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🖥️ THEIA UI STORE — WAVE 8303 (Layout Shell & Workspaces)
 *
 * Estado de *workspace* del Theia Engine View — el interruptor PERFORM/DESIGN
 * del blueprint Vengine 2.0 (THEIA-VENGINE-2-UI-ARCHITECTURE.md §2):
 *
 *   PERFORM  → pantalla de directo: Program grande, Masters fijos a la
 *              derecha (EXPANDED, nunca colapsan), Inspector HIDDEN, Media
 *              Browser como drawer plegado + lane placeholder de playlist.
 *   DESIGN   → laboratorio: Program ~45%, Inspector completo (telemetría,
 *              ecosistema, genoma), Masters en RAIL (36px), Media Browser
 *              expandido como panel inferior principal.
 *
 * Vive en store (no en estado local de la vista) porque varios sub-árboles
 * reaccionan al modo — Inspector, MastersPanel, LiveDeck/drawer — y Ola C
 * añadirá la playlist real sobre el mismo andamiaje.
 *
 * Regla P5 del blueprint: un panel en RAIL/HIDDEN no consume CPU. Lo que se
 * desmonta (Inspector en PERFORM, LiveDeck con el drawer cerrado) para sus
 * bucles rAF; lo que queda montado (Masters RAIL) solo tiene inputs pasivos.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { create } from 'zustand'

export type TheiaWorkspaceMode = 'perform' | 'design'

/**
 * 🌊 WAVE 8303 · M3 — estados de colapso del blueprint (§7.1):
 * `expanded` = panel completo · `rail` = tira fina con iconos/valores clave
 * · `hidden` = 0px (idealmente también desmontado).
 */
export type TheiaPanelCollapse = 'expanded' | 'rail' | 'hidden'

interface TheiaUiState {
  readonly mode: TheiaWorkspaceMode
  /** Drawer del Media Browser en modo PERFORM (en DESIGN siempre abierto). */
  readonly browserOpen: boolean
}

interface TheiaUiActions {
  setMode(mode: TheiaWorkspaceMode): void
  toggleMode(): void
  setBrowserOpen(open: boolean): void
  toggleBrowser(): void
}

export type TheiaUiStore = TheiaUiState & TheiaUiActions

export const useTheiaUiStore = create<TheiaUiStore>()((set, get) => ({
  mode: 'perform',
  browserOpen: false,

  setMode(mode) {
    if (mode === get().mode) return
    set({ mode })
  },

  toggleMode() {
    set({ mode: get().mode === 'perform' ? 'design' : 'perform' })
  },

  setBrowserOpen(open) {
    if (open !== get().browserOpen) set({ browserOpen: open })
  },

  toggleBrowser() {
    set({ browserOpen: !get().browserOpen })
  },
}))

/**
 * Mapa modo → estado de colapso por panel (blueprint §7.1, defaults).
 * Punto único de verdad para Ola A: los componentes no deciden su propio
 * colapso por modo, lo leen de aquí — así las waves siguientes solo tocan
 * esta tabla.
 */
export const WORKSPACE_PANEL_COLLAPSE = {
  masters: { perform: 'expanded', design: 'rail' },
  browser: { perform: 'rail', design: 'expanded' },
  inspector: { perform: 'hidden', design: 'expanded' },
  playlistLane: { perform: 'expanded', design: 'rail' },
} as const satisfies Record<
  string,
  Record<TheiaWorkspaceMode, TheiaPanelCollapse>
>

/** Helper de lectura del mapa anterior. */
export function panelCollapseFor(
  panel: keyof typeof WORKSPACE_PANEL_COLLAPSE,
  mode: TheiaWorkspaceMode,
): TheiaPanelCollapse {
  return WORKSPACE_PANEL_COLLAPSE[panel][mode]
}
