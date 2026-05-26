/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧬 THEIA EDITOR STORE — WAVE 4910.1
 * Estado global del editor de assets .theia (modo AUTHOR).
 *
 * Deliberadamente separado de truthStore / controlStore porque:
 *  - El estado de edición es transiente; no contamina el runtime de Selene.
 *  - Tiene autosave propio a localStorage (no al IPC backend).
 *  - Completamente ignorado cuando editorMode === 'perform'.
 *
 * TIPOS DRAFT: versiones mutables de los tipos readonly de theiaTypes.ts.
 * IDs de cuepoints: contador monótonamente creciente. Sin Math.random().
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { ITheiaAsset, ITheiaCuePoint, ITheiaGenome } from '../types/theiaTypes'

// ─── MUTABLE DRAFT TYPES ──────────────────────────────────────────────────────

export type EditorMode = 'perform' | 'author'

/** Versión mutable de ITheiaGenome para edición en el DNA Lab. */
export interface DraftGenome {
  aggression: number
  chaos: number
  organicity: number
}

/** Versión mutable de ITheiaCuePoint para edición en el Timeline. */
export interface DraftCuePoint {
  id: string
  name: string
  startMs: number
  endMs: number
  dna: DraftGenome
  energyZone: { min: string; max: string }
  validSections: string[]
  default?: boolean
  isDivineCandidate?: boolean
  isHeavyCandidate?: boolean
  preferredVibes?: string[]
  /** Flag UI: true si fue creado en esta sesión y aún no exportado. */
  isNew: boolean
}

/** Versión mutable de ITheiaAsset para edición. */
export interface DraftAsset {
  id: string
  filePath: string
  globalDNA: DraftGenome
  compatibleVibes: string[]
  cuePoints: DraftCuePoint[]
}

// ─── STORE INTERFACE ───────────────────────────────────────────────────────────

interface TheiaEditorState {
  editorMode: EditorMode
  draftAsset: DraftAsset | null
  selectedCueId: string | null
  isDirty: boolean
}

interface TheiaEditorActions {
  setEditorMode: (mode: EditorMode) => void
  selectCue: (id: string | null) => void
  loadDraft: (asset: ITheiaAsset) => void
  newDraftFromPath: (filePath: string, durationMs: number) => void
  updateGlobalDNA: (patch: Partial<DraftGenome>) => void
  addCuePoint: (cue: Omit<DraftCuePoint, 'id' | 'isNew'>) => void
  updateCuePoint: (id: string, patch: Partial<Omit<DraftCuePoint, 'id'>>) => void
  deleteCuePoint: (id: string) => void
  /** Divide un cuepoint en dos en el instante `atMs`. Guard: atMs debe estar dentro del rango del cue. */
  splitCuePoint: (cueId: string, atMs: number) => void
  /** Reinicia el editor a estado limpio (sin draft). */
  clearDraft: () => void
  markClean: () => void
}

export type TheiaEditorStore = TheiaEditorState & TheiaEditorActions

// ─── ID GENERATION (determinista, sin Math.random) ────────────────────────────

let _cueIdCounter = 0

function nextCueId(): string {
  return `cue-${Date.now()}-${++_cueIdCounter}`
}

// ─── CLONE HELPERS ────────────────────────────────────────────────────────────

function cloneGenome(g: ITheiaGenome | DraftGenome): DraftGenome {
  return { aggression: g.aggression, chaos: g.chaos, organicity: g.organicity }
}

function cloneCuePoint(cp: ITheiaCuePoint): DraftCuePoint {
  return {
    id: cp.id,
    name: cp.name,
    startMs: cp.startMs,
    endMs: cp.endMs,
    dna: cloneGenome(cp.dna),
    energyZone: { min: cp.energyZone.min, max: cp.energyZone.max },
    validSections: [...cp.validSections],
    default: cp.default,
    isDivineCandidate: cp.isDivineCandidate,
    isHeavyCandidate: cp.isHeavyCandidate,
    preferredVibes: cp.preferredVibes ? [...cp.preferredVibes] : undefined,
    isNew: false,
  }
}

function cloneAsset(asset: ITheiaAsset): DraftAsset {
  return {
    id: asset.id,
    filePath: asset.filePath,
    globalDNA: cloneGenome(asset.globalDNA),
    compatibleVibes: [...asset.compatibleVibes],
    cuePoints: asset.cuePoints.map(cloneCuePoint),
  }
}

// ─── AUTOSAVE ─────────────────────────────────────────────────────────────────

const AUTOSAVE_DEBOUNCE_MS = 2_000
const AUTOSAVE_KEY_PREFIX = 'luxsync.theia.draft.'

let _autosaveTimer: ReturnType<typeof setTimeout> | null = null

function scheduleAutosave(draft: DraftAsset): void {
  if (_autosaveTimer !== null) clearTimeout(_autosaveTimer)
  _autosaveTimer = setTimeout(() => {
    _autosaveTimer = null
    try {
      localStorage.setItem(AUTOSAVE_KEY_PREFIX + draft.id, JSON.stringify(draft))
    } catch {
      // localStorage lleno o no disponible — fallo silencioso
    }
  }, AUTOSAVE_DEBOUNCE_MS)
}

/** Borra el autosave tras un export exitoso. */
export function clearAutosave(draftId: string): void {
  localStorage.removeItem(AUTOSAVE_KEY_PREFIX + draftId)
  if (_autosaveTimer !== null) {
    clearTimeout(_autosaveTimer)
    _autosaveTimer = null
  }
}

/** Intenta recuperar un draft autosaved. Retorna null si no existe o está corrupto. */
export function loadAutosave(draftId: string): DraftAsset | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY_PREFIX + draftId)
    if (!raw) return null
    return JSON.parse(raw) as DraftAsset
  } catch {
    return null
  }
}

// ─── STORE ────────────────────────────────────────────────────────────────────

export const useTheiaEditorStore = create<TheiaEditorStore>()(
  subscribeWithSelector((set, get) => ({
    // ── State defaults ──────────────────────────────────────────────────────
    editorMode: 'perform',
    draftAsset: null,
    selectedCueId: null,
    isDirty: false,

    // ── Actions ────────────────────────────────────────────────────────────

    setEditorMode(mode) {
      set({ editorMode: mode })
    },

    selectCue(id) {
      set({ selectedCueId: id })
    },

    /** Carga un ITheiaAsset existente (read-only) como draft editable. */
    loadDraft(asset) {
      set({ draftAsset: cloneAsset(asset), selectedCueId: null, isDirty: false })
    },

    /**
     * Crea un draft nuevo desde la ruta de un .mp4 recién dropeado.
     * Genera un cuepoint default que cubre la duración completa.
     */
    newDraftFromPath(filePath, durationMs) {
      const id = `draft-${Date.now()}`
      const defaultCue: DraftCuePoint = {
        id: nextCueId(),
        name: 'default',
        startMs: 0,
        endMs: durationMs,
        dna: { aggression: 0.5, chaos: 0.5, organicity: 0.5 },
        energyZone: { min: 'silence', max: 'peak' },
        validSections: [],
        default: true,
        isNew: true,
      }
      const draft: DraftAsset = {
        id,
        filePath,
        globalDNA: { aggression: 0.5, chaos: 0.5, organicity: 0.5 },
        compatibleVibes: ['unspecified'],
        cuePoints: [defaultCue],
      }
      set({ draftAsset: draft, selectedCueId: defaultCue.id, isDirty: true })
    },

    updateGlobalDNA(patch) {
      const { draftAsset } = get()
      if (!draftAsset) return
      set({
        draftAsset: { ...draftAsset, globalDNA: { ...draftAsset.globalDNA, ...patch } },
        isDirty: true,
      })
    },

    addCuePoint(cue) {
      const { draftAsset } = get()
      if (!draftAsset) return
      const newCue: DraftCuePoint = { ...cue, id: nextCueId(), isNew: true }
      set({
        draftAsset: { ...draftAsset, cuePoints: [...draftAsset.cuePoints, newCue] },
        selectedCueId: newCue.id,
        isDirty: true,
      })
    },

    updateCuePoint(id, patch) {
      const { draftAsset } = get()
      if (!draftAsset) return
      set({
        draftAsset: {
          ...draftAsset,
          cuePoints: draftAsset.cuePoints.map((cp) =>
            cp.id === id ? { ...cp, ...patch } : cp,
          ),
        },
        isDirty: true,
      })
    },

    /**
     * Borra un cuepoint. Guard: el draft debe conservar al menos 1.
     * Si se borra el `default`, el primero restante hereda automáticamente ese flag.
     */
    deleteCuePoint(id) {
      const { draftAsset, selectedCueId } = get()
      if (!draftAsset || draftAsset.cuePoints.length <= 1) return

      const remaining = draftAsset.cuePoints.filter((cp) => cp.id !== id)
      const deletedWasDefault = draftAsset.cuePoints.find((cp) => cp.id === id)?.default
      const updatedCues = deletedWasDefault
        ? remaining.map((cp, i) => (i === 0 ? { ...cp, default: true } : cp))
        : remaining

      set({
        draftAsset: { ...draftAsset, cuePoints: updatedCues },
        selectedCueId: selectedCueId === id ? (updatedCues[0]?.id ?? null) : selectedCueId,
        isDirty: true,
      })
    },

    splitCuePoint(cueId, atMs) {
      const { draftAsset } = get()
      if (!draftAsset) return

      const cue = draftAsset.cuePoints.find((cp) => cp.id === cueId)
      if (!cue) return
      // Guard: split point must be strictly inside the cue's range
      if (atMs <= cue.startMs || atMs >= cue.endMs) return

      const firstHalf: DraftCuePoint = { ...cue, id: nextCueId(), endMs: atMs, isNew: true }
      const secondHalf: DraftCuePoint = {
        ...cue,
        id: nextCueId(),
        startMs: atMs,
        default: false, // default stays on first half
        isNew: true,
      }

      const updated = draftAsset.cuePoints.flatMap((cp) =>
        cp.id === cueId ? [firstHalf, secondHalf] : [cp],
      )

      set({
        draftAsset: { ...draftAsset, cuePoints: updated },
        selectedCueId: secondHalf.id,
        isDirty: true,
      })
    },

    clearDraft() {
      set({ draftAsset: null, selectedCueId: null, isDirty: false })
    },

    markClean() {
      set({ isDirty: false })
    },
  })),
)

// ─── AUTOSAVE SUBSCRIPTION ────────────────────────────────────────────────────
// Se dispara cada vez que cambia isDirty o draftAsset. Debounced a 2s.

useTheiaEditorStore.subscribe(
  (s) => ({ draft: s.draftAsset, dirty: s.isDirty }),
  ({ draft, dirty }) => {
    if (dirty && draft) scheduleAutosave(draft)
  },
)
