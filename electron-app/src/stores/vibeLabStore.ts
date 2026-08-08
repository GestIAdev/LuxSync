/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧬 vibeLabStore.ts — CANAL A (EDICIÓN, BAJA FRECUENCIA)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Store Zustand del Vibe Lab. Contiene el draft del `.luxvibe` en edición,
 * estado de UI, y acciones para mutar genes. La telemetría va por el Canal B
 * (`telemetryBus.ts`) para no re-renderizar la UI a 60 Hz.
 *
 * ── MIDDLEWARE ─────────────────────────────────────────────────────────────
 * - `immer`: para escribir en rutas profundas del draft sparse.
 * - `subscribeWithSelector`: para que el coalescer rAF se suscriba sin
 *   montar un componente React (patrón de stageStore, programmerStore).
 * - `persist` NO se usa: la biblioteca vive en disco vía IPC.
 *
 * ── SELECTORES DE ALTA GRANULARIDAD ─────────────────────────────────────────
 * Un `GeneSlider` jamás se suscribe al `draft` entero. Usa `useGene(path)`
 * que sólo re-renderiza cuando ese gen concreto cambia.
 *
 * @module stores/vibeLabStore
 * @version FASE 1B — The Fusion Core
 */

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { useShallow } from 'zustand/shallow'
import type { WritableDraft } from 'immer'

import type {
  CustomVibeOverride,
  CustomVibeMeta,
  CustomVibeKey,
  BaseDNA,
  MacroGeneId,
  EnvelopeSlot,
  GoldenPatternId,
  ResolveDiagnostic,
} from '../types/CustomVibe'
import { createEmptyCustomVibe, isBaseDNA } from '../types/CustomVibe'

import { setByPath, deleteByPath, deleteByPrefix, countLeaves, getByPath } from '../engine/vibe/custom/pathUtils'
import { expandMacroClamped } from '../engine/vibe/custom/macroGenes'

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════════════

export type GenomeTab = 'physics' | 'color' | 'movement'
export type InterlockMode = 'shielded' | 'raw'

/** Ruta con puntos dentro del documento: 'physics.envelopes.envelopeKick.boost' */
export type GenePath = string

export interface VibeLabState {
  // ── DOCUMENTO ─────────────────────────────────────────────────────
  /** null = no hay sesión de edición abierta. */
  draft: CustomVibeOverride | null
  /** Snapshot del último estado guardado, para dirty-check y descarte. */
  pristine: CustomVibeOverride | null
  isDirty: boolean

  // ── UI ────────────────────────────────────────────────────────────
  activeTab: GenomeTab
  interlock: InterlockMode
  /** Paneles abiertos por id, por tab. */
  expandedPanels: Record<GenomeTab, string[]>
  /** Envelope seleccionado en THE SIX CHAMBERS. */
  focusedEnvelope: EnvelopeSlot | null
  /** Patrón seleccionado en THE ORBIT VAULT. */
  focusedPattern: GoldenPatternId | null

  // ── PREVIEW ───────────────────────────────────────────────────────
  /** Si false, las ediciones no se envían al motor (modo offline). */
  livePreview: boolean
  /** A/B: 'mutation' aplica el draft, 'base' aplica el baseDNA puro. */
  abMode: 'mutation' | 'base'
  /** Diagnostics del último resolve. */
  diagnostics: ResolveDiagnostic[]
  /** Nº de genes mutados (derivado, cacheado en cada write). */
  mutationCount: number

  // ── BIBLIOTECA ────────────────────────────────────────────────────
  vault: CustomVibeMeta[]
  vaultLoading: boolean

  // ── ACCIONES: sesión ──────────────────────────────────────────────
  beginSession: (baseDNA: BaseDNA, name: string) => void
  openFromVault: (key: CustomVibeKey) => Promise<void>
  closeSession: (discard: boolean) => void
  rebase: (newBase: BaseDNA, keepMutations: boolean) => void

  // ── ACCIONES: genes ───────────────────────────────────────────────
  /** Escribe un gen. `undefined` borra el override (vuelve a heredar). */
  setGene: (path: GenePath, value: unknown) => void
  revertGene: (path: GenePath) => void
  revertPanel: (pathPrefix: string) => void
  revertAll: () => void
  applyMacro: (id: MacroGeneId, value: number) => void

  // ── ACCIONES: meta ────────────────────────────────────────────────
  setMeta: (patch: Partial<CustomVibeMeta>) => void

  // ── ACCIONES: UI ──────────────────────────────────────────────────
  setTab: (tab: GenomeTab) => void
  setInterlock: (mode: InterlockMode) => void
  togglePanel: (tab: GenomeTab, panelId: string) => void
  setFocusedEnvelope: (slot: EnvelopeSlot | null) => void
  setFocusedPattern: (p: GoldenPatternId | null) => void

  // ── ACCIONES: preview ─────────────────────────────────────────────
  setLivePreview: (on: boolean) => void
  setAbMode: (m: 'mutation' | 'base') => void
  /** Fuerza un resolve+graft inmediato (usado por el rAF coalescer). */
  flushToEngine: () => void

  // ── ACCIONES: persistencia (stubs — Fase 4) ───────────────────────
  loadVault: () => Promise<void>
  mint: () => Promise<{ ok: boolean; path?: string; error?: string }>
  deleteFromVault: (key: CustomVibeKey) => Promise<void>
  duplicate: (key: CustomVibeKey) => Promise<CustomVibeKey | null>
  importFromFile: () => Promise<boolean>
  exportToFile: (key: CustomVibeKey) => Promise<boolean>
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/** Genera una CustomVibeKey única con hash6 aleatorio. */
function generateKey(name: string): CustomVibeKey {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30) || 'unnamed'
  const hash = Math.random().toString(36).slice(2, 8).padStart(6, '0')
  return `custom:${slug}-${hash}`
}

/** Cuenta las mutaciones de un draft (excluyendo meta y campos raíz). */
function countMutations(draft: CustomVibeOverride | null): number {
  if (!draft) return 0
  let count = 0
  if (draft.physics) count += countLeaves(draft.physics)
  if (draft.color) count += countLeaves(draft.color)
  if (draft.movement) count += countLeaves(draft.movement)
  return count
}

// ═══════════════════════════════════════════════════════════════════════════
// STUBS DE PERSISTENCIA (Fase 4)
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// PUENTE IPC (renderer → main → VibeLabPersistence)
// ═══════════════════════════════════════════════════════════════════════════

interface VibeLabIPC {
  list: () => Promise<unknown[]>
  read: (key: CustomVibeKey) => Promise<{ ok: boolean; data?: CustomVibeOverride; error?: string }>
  save: (data: CustomVibeOverride) => Promise<{ ok: boolean; path?: string; error?: string }>
  delete: (key: CustomVibeKey) => Promise<{ ok: boolean; error?: string }>
  export: (data: CustomVibeOverride) => Promise<{ ok: boolean; path?: string; error?: string }>
  import: () => Promise<{ ok: boolean; data?: CustomVibeOverride; error?: string }>
}

/** Acceso lazy al bridge IPC expuesto por preload (window.luxsync.vibeLab). */
function getVibeLabIPC(): VibeLabIPC | null {
  const w = window as unknown as { luxsync?: { vibeLab?: VibeLabIPC } }
  const ipc = w.luxsync?.vibeLab
  if (!ipc) {
    console.warn('[vibeLabStore] window.luxsync.vibeLab no disponible — ¿preload?')
    return null
  }
  return ipc
}

// ═══════════════════════════════════════════════════════════════════════════
// STORE
// ═══════════════════════════════════════════════════════════════════════════

export const useVibeLabStore = create<VibeLabState>()(
  subscribeWithSelector(
    immer((set, get) => ({
      // ── INITIAL STATE ──────────────────────────────────────────────
      draft: null,
      pristine: null,
      isDirty: false,
      activeTab: 'physics',
      interlock: 'raw',
      expandedPanels: { physics: [], color: [], movement: [] },
      focusedEnvelope: null,
      focusedPattern: null,
      livePreview: true,
      abMode: 'mutation',
      diagnostics: [],
      mutationCount: 0,
      vault: [],
      vaultLoading: false,

      // ── ACCIONES: sesión ───────────────────────────────────────────
      beginSession: (baseDNA, name) => {
        if (!isBaseDNA(baseDNA)) {
          console.error(`[vibeLabStore] baseDNA inválido: ${baseDNA}`)
          return
        }
        const key = generateKey(name)
        const draft = createEmptyCustomVibe(key, baseDNA, name)
        set((state) => {
          state.draft = draft as WritableDraft<CustomVibeOverride>
          state.pristine = structuredCloneSafe(draft) as WritableDraft<CustomVibeOverride>
          state.isDirty = false
          state.mutationCount = 0
          state.diagnostics = []
          state.activeTab = 'physics'
          state.interlock = 'raw'
          state.expandedPanels = { physics: [], color: [], movement: [] }
          state.focusedEnvelope = null
          state.focusedPattern = null
          state.abMode = 'mutation'
        })
      },

      openFromVault: async (key) => {
        const ipc = getVibeLabIPC()
        if (!ipc) return
        set({ vaultLoading: true })
        try {
          const result = await ipc.read(key)
          if (result.ok && result.data) {
            const data = result.data
            set((state) => {
              state.draft = data as WritableDraft<CustomVibeOverride>
              state.pristine = structuredCloneSafe(data) as WritableDraft<CustomVibeOverride>
              state.isDirty = false
              state.mutationCount = countMutations(data)
              state.diagnostics = []
              state.activeTab = 'physics'
              state.interlock = 'raw'
              state.expandedPanels = { physics: [], color: [], movement: [] }
              state.focusedEnvelope = null
              state.focusedPattern = null
              state.abMode = 'mutation'
            })
          } else {
            console.error('[vibeLabStore] openFromVault failed:', result.error)
          }
        } finally {
          set({ vaultLoading: false })
        }
      },

      closeSession: (discard) => {
        const { pristine, draft } = get()
        if (!discard && pristine && draft) {
          // Guardar implícito: restaurar pristine como draft actual.
          // En Fase 4, esto disparará mint() si isDirty.
        }
        set((state) => {
          state.draft = null
          state.pristine = null
          state.isDirty = false
          state.mutationCount = 0
          state.diagnostics = []
          state.focusedEnvelope = null
          state.focusedPattern = null
        })
      },

      rebase: (newBase, keepMutations) => {
        if (!isBaseDNA(newBase)) return
        set((state) => {
          if (!state.draft) return
          const oldDraft = state.draft
          if (keepMutations) {
            // Mantener las mutaciones, sólo cambiar baseDNA.
            // Las mutaciones que no existan en el nuevo ADN se ignorarán
            // silenciosamente en el resolve (gen desconocido).
            state.draft = { ...oldDraft, baseDNA: newBase } as WritableDraft<CustomVibeOverride>
          } else {
            // Descartar todo: crear un draft vacío sobre el nuevo ADN.
            const key = oldDraft.meta.key
            const name = oldDraft.meta.name
            state.draft = createEmptyCustomVibe(key, newBase, name) as WritableDraft<CustomVibeOverride>
          }
          state.mutationCount = countMutations(state.draft)
          state.isDirty = true
        })
      },

      // ── ACCIONES: genes ────────────────────────────────────────────
      setGene: (path, value) => {
        set((state) => {
          if (!state.draft) return
          // path es relativo al draft: 'physics.transient.percBoost'
          const segs = path.split('.')
          const domain = segs[0] as 'physics' | 'color' | 'movement'
          const subPath = segs.slice(1).join('.')

          if (value === undefined) {
            // Borrar el gen (revertir a heredado)
            const current = state.draft[domain]
            if (current) {
              state.draft[domain] = deleteByPath(current as Record<string, unknown>, subPath) as typeof current
            }
          } else {
            // Escribir el gen
            const current = state.draft[domain] ?? {}
            state.draft[domain] = setByPath(current as Record<string, unknown>, subPath, value) as typeof current
          }

          state.mutationCount = countMutations(state.draft)
          state.isDirty = true
        })
      },

      revertGene: (path) => {
        get().setGene(path, undefined)
      },

      revertPanel: (pathPrefix) => {
        set((state) => {
          if (!state.draft) return
          const segs = pathPrefix.split('.')
          const domain = segs[0] as 'physics' | 'color' | 'movement'
          const subPrefix = segs.slice(1).join('.')
          const current = state.draft[domain]
          if (current) {
            state.draft[domain] = deleteByPrefix(current as Record<string, unknown>, subPrefix) as typeof current
          }
          state.mutationCount = countMutations(state.draft)
          state.isDirty = true
        })
      },

      revertAll: () => {
        set((state) => {
          if (!state.draft) return
          const { baseDNA, meta } = state.draft
          state.draft = createEmptyCustomVibe(meta.key, baseDNA, meta.name) as WritableDraft<CustomVibeOverride>
          state.draft.meta = meta // preservar meta (nombre, autor, etc.)
          state.mutationCount = 0
          state.isDirty = false
          state.diagnostics = []
        })
      },

      applyMacro: (id, value) => {
        const mutations = expandMacroClamped(id, value)
        set((state) => {
          if (!state.draft) return
          for (const { path, value: geneValue } of mutations) {
            const segs = path.split('.')
            const domain = segs[0] as 'physics' | 'color' | 'movement'
            const subPath = segs.slice(1).join('.')
            const current = state.draft[domain] ?? {}
            state.draft[domain] = setByPath(current as Record<string, unknown>, subPath, geneValue) as typeof current
          }
          state.mutationCount = countMutations(state.draft)
          state.isDirty = true
        })
      },

      // ── ACCIONES: meta ─────────────────────────────────────────────
      setMeta: (patch) => {
        set((state) => {
          if (!state.draft) return
          state.draft.meta = { ...state.draft.meta, ...patch, updatedAt: Date.now() }
          state.isDirty = true
        })
      },

      // ── ACCIONES: UI ───────────────────────────────────────────────
      setTab: (tab) => set({ activeTab: tab }),
      setInterlock: (mode) => set({ interlock: mode }),
      togglePanel: (tab, panelId) => {
        set((state) => {
          const panels = state.expandedPanels[tab]
          const idx = panels.indexOf(panelId)
          if (idx >= 0) {
            state.expandedPanels[tab] = panels.filter((p) => p !== panelId)
          } else {
            state.expandedPanels[tab] = [...panels, panelId]
          }
        })
      },
      setFocusedEnvelope: (slot) => set({ focusedEnvelope: slot }),
      setFocusedPattern: (p) => set({ focusedPattern: p }),

      // ── ACCIONES: preview ──────────────────────────────────────────
      setLivePreview: (on) => set({ livePreview: on }),
      setAbMode: (m) => set({ abMode: m }),
      flushToEngine: () => {
        // Delega al engineSync (importado perezosamente para evitar ciclo).
        // El engineSync se inicializa por separado al montar el Vibe Lab.
        // Aquí sólo marcamos que el draft cambió; el coalescer hace el flush.
      },

      // ── ACCIONES: persistencia (Fase 4.3 — vía IPC) ───────────────
      loadVault: async () => {
        const ipc = getVibeLabIPC()
        if (!ipc) { set({ vaultLoading: false }); return }
        set({ vaultLoading: true })
        try {
          // The backend returns VibeVaultEntry[] ({ key, meta, filename, ... }).
          // The store expects CustomVibeMeta[] for the vault array so GenomeVault
          // can access entry.name, entry.author, etc. directly.
          const entries = await ipc.list() as Array<{ meta?: CustomVibeMeta } & Partial<CustomVibeMeta>>
          const metas: CustomVibeMeta[] = (entries ?? []).map((e) =>
            e.meta ?? {
              key: (e as any).key ?? 'custom:unknown',
              name: (e as any).name ?? 'Unknown',
              description: (e as any).description ?? '',
              icon: (e as any).icon ?? '🧬',
              author: (e as any).author ?? 'unknown',
              createdAt: (e as any).createdAt ?? 0,
              updatedAt: (e as any).updatedAt ?? 0,
              tags: (e as any).tags ?? [],
              accentHex: (e as any).accentHex ?? '#00e5ff',
            },
          )
          set({ vault: metas })
        } catch (err) {
          console.error('[vibeLabStore] loadVault failed:', err)
          set({ vault: [] })
        } finally {
          set({ vaultLoading: false })
        }
      },
      mint: async () => {
        const { draft } = get()
        if (!draft) return { ok: false, error: 'No active draft' }
        const ipc = getVibeLabIPC()
        if (!ipc) return { ok: false, error: 'IPC bridge unavailable' }
        // Asegurar updatedAt fresco
        const toSave: CustomVibeOverride = {
          ...draft,
          meta: { ...draft.meta, updatedAt: Date.now() },
        }
        const result = await ipc.save(toSave)
        if (result.ok) {
          // Refrescar vault y marcar pristine
          set((state) => {
            state.pristine = structuredCloneSafe(toSave) as WritableDraft<CustomVibeOverride>
            state.isDirty = false
          })
          void get().loadVault()
        }
        return result
      },
      deleteFromVault: async (key) => {
        const ipc = getVibeLabIPC()
        if (!ipc) return
        await ipc.delete(key)
        // Refrescar vault
        void get().loadVault()
      },
      duplicate: async (key): Promise<CustomVibeKey | null> => {
        const ipc = getVibeLabIPC()
        if (!ipc) return null
        const readResult = await ipc.read(key)
        if (!readResult.ok || !readResult.data) return null
        const original = readResult.data
        // Generar nueva key y nombre
        const newKey = generateKey(original.meta.name + '-copy')
        const copy: CustomVibeOverride = {
          ...original,
          meta: {
            ...original.meta,
            key: newKey,
            name: `${original.meta.name} (copy)`,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        }
        const saveResult = await ipc.save(copy)
        if (!saveResult.ok) return null
        void get().loadVault()
        return newKey
      },
      importFromFile: async (): Promise<boolean> => {
        const ipc = getVibeLabIPC()
        if (!ipc) return false
        const result = await ipc.import()
        if (!result.ok || !result.data) return false
        // Cargar el importado como draft activo
        set((state) => {
          state.draft = result.data! as WritableDraft<CustomVibeOverride>
          state.pristine = structuredCloneSafe(result.data!) as WritableDraft<CustomVibeOverride>
          state.isDirty = false
          state.mutationCount = countMutations(result.data!)
        })
        void get().loadVault()
        return true
      },
      exportToFile: async (key): Promise<boolean> => {
        const ipc = getVibeLabIPC()
        if (!ipc) return false
        const readResult = await ipc.read(key)
        if (!readResult.ok || !readResult.data) return false
        const result = await ipc.export(readResult.data)
        return result.ok
      },
    }),
    ),
  ),
)

// ═══════════════════════════════════════════════════════════════════════════
// SELECTORES DE ALTA GRANULARIDAD
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Lee un gen resolviendo herencia: override → base → undefined.
 * Un `GeneSlider` usa este hook y SÓLO re-renderiza cuando este gen cambia.
 */
export function useGene<T>(path: GenePath, baseValue: T): {
  value: T
  isMutated: boolean
} {
  return useVibeLabStore(
    useShallow((s) => {
      const raw = s.draft ? getByPath(s.draft, path) : undefined
      return { value: (raw ?? baseValue) as T, isMutated: raw !== undefined }
    }),
  )
}

/** Selectores derivados estables (patrón truthStore.ts). */
export const selectMutationCount = (s: VibeLabState) => s.mutationCount
export const selectInterlock = (s: VibeLabState) => s.interlock
export const selectActiveTab = (s: VibeLabState) => s.activeTab
export const selectDiagnostics = (s: VibeLabState) => s.diagnostics
export const selectIsDirty = (s: VibeLabState) => s.isDirty
export const selectLivePreview = (s: VibeLabState) => s.livePreview
export const selectAbMode = (s: VibeLabState) => s.abMode
export const selectDraft = (s: VibeLabState) => s.draft

export const useMutationCount = () => useVibeLabStore(selectMutationCount)
export const useInterlock = () => useVibeLabStore(selectInterlock)
export const useActiveTab = () => useVibeLabStore(selectActiveTab)
export const useDiagnostics = () => useVibeLabStore(selectDiagnostics)
export const useIsDirty = () => useVibeLabStore(selectIsDirty)
export const useLivePreview = () => useVibeLabStore(selectLivePreview)
export const useAbMode = () => useVibeLabStore(selectAbMode)

// ═══════════════════════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════════════════════

/** structuredClone con fallback a JSON roundtrip (para entornos sin soporte). */
function structuredCloneSafe<T>(obj: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(obj)
  }
  return JSON.parse(JSON.stringify(obj)) as T
}
