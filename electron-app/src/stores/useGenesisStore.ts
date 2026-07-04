// ═══════════════════════════════════════════════════════════════════════════
// 🧬 WAVE 5000.V3 — ERA V: Genesis Store (Zustand)
// ═══════════════════════════════════════════════════════════════════════════
//  Renderer state for the Genetic Laboratory UI.
//  Communicates with the main process via window.luxsync.genesis IPC bridge.
// ═══════════════════════════════════════════════════════════════════════════

import { create } from 'zustand'

// ─── TYPES ──────────────────────────────────────────────────────────────────

export interface GenesisOrganism {
  organism_id: string
  blueprint_id: string
  parent_organism_id: string | null
  generation: number
  custom_name: string | null
  rarity_score: number
  rarity_tier: string
  l2_distance_parent: number
  operator_used: string
  neonatal_shield_until: number
  fitness_score: number
  trials_count: number
  wins_count: number
  vetoes_count: number
  passes_count: number
  status: string
  species_id: string | null
  born_at: number
  last_evaluated_at: number | null
  last_fired_at: number | null
}

export interface HallOfFameCandidate extends GenesisOrganism {
  survival_rate: number
}

export interface LineageNode {
  node_id: number
  organism_id: string
  blueprint_id: string
  ancestor_path: string
  depth: number
  peak_rarity_in_line: string | null
  is_extinct: number
  rarity_tier: string | null
  fitness_score: number | null
  status: string | null
  custom_name: string | null
  generation: number | null
  trials_count: number | null
  passes_count: number | null
}

export interface SpeciesInfo {
  species_id: string
  count: number
  avg_fitness: number
  max_fitness: number
}

export interface GenesisStoreState {
  // Data
  organisms: GenesisOrganism[]
  hallOfFame: HallOfFameCandidate[]
  lineage: LineageNode[]
  species: SpeciesInfo[]

  // UI State
  selectedOrganismId: string | null
  isLoading: boolean
  error: string | null
  lastMaintenanceAt: number | null

  // Filter
  filterRarityTier: string | null
  filterStatus: string | null

  // Actions
  fetchOrganisms: () => Promise<void>
  fetchHallOfFame: () => Promise<void>
  fetchLineage: (organismId: string) => Promise<void>
  fetchSpecies: () => Promise<void>
  selectOrganism: (organismId: string | null) => void
  cullOrganism: (organismId: string) => Promise<void>
  canonizeOrganism: (organismId: string, customName: string) => Promise<boolean>
  runMaintenance: () => Promise<void>
  setFilterRarityTier: (tier: string | null) => void
  setFilterStatus: (status: string | null) => void
  refreshAll: () => Promise<void>
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

function getGenesisApi(): any {
  return (window as any).luxsync?.genesis
}

// ─── STORE ──────────────────────────────────────────────────────────────────

export const useGenesisStore = create<GenesisStoreState>((set, get) => ({
  // Data
  organisms: [],
  hallOfFame: [],
  lineage: [],
  species: [],

  // UI State
  selectedOrganismId: null,
  isLoading: false,
  error: null,
  lastMaintenanceAt: null,

  // Filter
  filterRarityTier: null,
  filterStatus: null,

  // Actions
  fetchOrganisms: async () => {
    const api = getGenesisApi()
    if (!api) {
      set({ error: 'Genesis IPC not available (demo mode)' })
      return
    }

    set({ isLoading: true, error: null })
    try {
      const filter: Record<string, unknown> = {}
      const state = get()
      if (state.filterRarityTier) filter.rarityTier = state.filterRarityTier
      if (state.filterStatus) filter.status = state.filterStatus

      const result = await api.getOrganisms(Object.keys(filter).length > 0 ? filter : undefined)
      if (result.success) {
        set({ organisms: result.organisms as GenesisOrganism[], isLoading: false })
      } else {
        set({ error: result.error ?? 'Failed to fetch organisms', isLoading: false })
      }
    } catch (err) {
      set({ error: String(err), isLoading: false })
    }
  },

  fetchHallOfFame: async () => {
    const api = getGenesisApi()
    if (!api) return

    try {
      const result = await api.getHallOfFame()
      if (result.success) {
        set({ hallOfFame: result.candidates as HallOfFameCandidate[] })
      }
    } catch (err) {
      console.error('[GenesisStore] fetchHallOfFame error:', err)
    }
  },

  fetchLineage: async (organismId: string) => {
    const api = getGenesisApi()
    if (!api) return

    try {
      const result = await api.getLineageTree(organismId)
      if (result.success) {
        set({ lineage: result.lineage as LineageNode[] })
      }
    } catch (err) {
      console.error('[GenesisStore] fetchLineage error:', err)
    }
  },

  fetchSpecies: async () => {
    const api = getGenesisApi()
    if (!api) return

    try {
      const result = await api.getSpecies()
      if (result.success) {
        set({ species: result.species as SpeciesInfo[] })
      }
    } catch (err) {
      console.error('[GenesisStore] fetchSpecies error:', err)
    }
  },

  selectOrganism: (organismId) => {
    set({ selectedOrganismId: organismId })
    if (organismId) {
      get().fetchLineage(organismId)
    } else {
      set({ lineage: [] })
    }
  },

  cullOrganism: async (organismId: string) => {
    const api = getGenesisApi()
    if (!api) return

    try {
      const result = await api.cullOrganism(organismId)
      if (result.success) {
        // Remove from organisms list
        set((state) => ({
          organisms: state.organisms.filter((o) => o.organism_id !== organismId),
          selectedOrganismId: state.selectedOrganismId === organismId ? null : state.selectedOrganismId,
        }))
        console.log(`[GenesisStore] 🗑️ Culled: ${organismId}`)
      }
    } catch (err) {
      console.error('[GenesisStore] cullOrganism error:', err)
    }
  },

  canonizeOrganism: async (organismId: string, customName: string): Promise<boolean> => {
    const api = getGenesisApi()
    if (!api) return false

    try {
      const result = await api.canonizeOrganism(organismId, customName)
      if (result.success) {
        // Update organism status in local state
        set((state) => ({
          organisms: state.organisms.map((o) =>
            o.organism_id === organismId
              ? { ...o, status: 'canonized', custom_name: result.customName ?? customName }
              : o,
          ),
          hallOfFame: state.hallOfFame.filter((o) => o.organism_id !== organismId),
        }))
        console.log(`[GenesisStore] 👑 Canonized: ${organismId} as "${result.customName}"`)
        return true
      }
      return false
    } catch (err) {
      console.error('[GenesisStore] canonizeOrganism error:', err)
      return false
    }
  },

  runMaintenance: async () => {
    const api = getGenesisApi()
    if (!api) return

    set({ isLoading: true, error: null })
    try {
      const result = await api.runMaintenance()
      if (result.success) {
        set({ lastMaintenanceAt: Date.now(), isLoading: false })
        // Refresh data after maintenance
        await get().refreshAll()
      } else {
        set({ error: result.error ?? 'Maintenance failed', isLoading: false })
      }
    } catch (err) {
      set({ error: String(err), isLoading: false })
    }
  },

  setFilterRarityTier: (tier) => {
    set({ filterRarityTier: tier })
    get().fetchOrganisms()
  },

  setFilterStatus: (status) => {
    set({ filterStatus: status })
    get().fetchOrganisms()
  },

  refreshAll: async () => {
    await Promise.all([
      get().fetchOrganisms(),
      get().fetchHallOfFame(),
      get().fetchSpecies(),
    ])
  },
}))
