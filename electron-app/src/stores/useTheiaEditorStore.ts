/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧬 THEIA EDITOR STORE — WAVE 4921 (Atomic Paradigm · Fase 1)
 * Estado global del editor del WORKSHOP de Theia.
 *
 * Refactor desde WAVE 4910.1: el draft ya NO es un asset multi-cuepoint;
 * es un ÁTOMO único (`draftAtom`) con genoma plano y trim simple {in, out}.
 *
 * Sigue siendo deliberadamente independiente de truthStore / controlStore:
 *  - El estado de edición es transiente; no contamina el runtime de Selene.
 *  - Tiene autosave propio a localStorage (no al IPC backend).
 *  - Completamente ignorado cuando editorMode === 'live'.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { EnergyZone, ITheiaAtom } from '../types/theiaTypes'

// ─── MUTABLE DRAFT TYPES ──────────────────────────────────────────────────────

/**
 * Modo del editor.
 *  - `live`     → performance en tiempo real (Selene + manual triggers).
 *  - `workshop` → taller offline (drop, trim, tunear ADN, exportar).
 */
export type EditorMode = 'live' | 'workshop'

/** Versión mutable del genoma cognitivo (subset del átomo). */
export interface DraftGenome {
  aggression: number
  chaos: number
  organicity: number
}

/** Versión mutable de `ITheiaAtom` para edición en el Workshop. */
export interface DraftAtom {
  id: string
  packId: string
  filePath: string
  /**
   * ID del RawClip correspondiente en `useTheiaPackStore`.
   * Se asigna cuando el draft nace de un drop (newDraftFromPath). Permite
   * marcar el clip como 'exported' tras un export exitoso.
   */
  rawClipId?: string

  // ── Genoma al ROOT ───────────────────────────────────────────────────────
  aggression: number
  chaos: number
  organicity: number
  energyZone: { min: EnergyZone; max: EnergyZone }
  validSections: string[]

  // ── Recorte temporal del .mp4 ───────────────────────────────────────────
  trim: {
    startMs: number
    endMs: number
  }

  compatibleVibes: string[]
  isDivineCandidate?: boolean
  isHeavyCandidate?: boolean
}

// ─── STORE INTERFACE ───────────────────────────────────────────────────────────

interface TheiaEditorState {
  editorMode: EditorMode
  draftAtom: DraftAtom | null
  isDirty: boolean
}

interface TheiaEditorActions {
  setEditorMode: (mode: EditorMode) => void
  /** Carga un átomo existente (read-only) como draft editable. */
  loadDraft: (atom: ITheiaAtom) => void
  /** Crea un draft nuevo desde la ruta de un .mp4 recién dropeado. */
  newDraftFromPath: (filePath: string, durationMs: number, rawClipId?: string) => void
  /** Aplica un patch parcial al genoma (`aggression / chaos / organicity`). */
  updateGenome: (patch: Partial<DraftGenome>) => void
  /** Actualiza los handles IN/OUT del trim. Clamp interno a [0, ∞). */
  updateTrim: (startMs: number, endMs: number) => void
  /** Cambia un edge de la energy zone. Mantiene `min ≤ max`. */
  updateEnergyZone: (edge: 'min' | 'max', value: EnergyZone) => void
  /** Reemplaza la lista de secciones válidas. */
  setValidSections: (sections: string[]) => void
  /** Reinicia el editor a estado limpio (sin draft). */
  clearDraft: () => void
  markClean: () => void
}

export type TheiaEditorStore = TheiaEditorState & TheiaEditorActions

// ─── CLONE HELPERS ────────────────────────────────────────────────────────────

function cloneAtomToDraft(atom: ITheiaAtom): DraftAtom {
  return {
    id: atom.id,
    packId: atom.packId,
    filePath: atom.filePath,
    aggression: atom.aggression,
    chaos: atom.chaos,
    organicity: atom.organicity,
    energyZone: { min: atom.energyZone.min, max: atom.energyZone.max },
    validSections: [...atom.validSections],
    trim: { startMs: atom.trim.startMs, endMs: atom.trim.endMs },
    compatibleVibes: [...atom.compatibleVibes],
    isDivineCandidate: atom.isDivineCandidate,
    isHeavyCandidate: atom.isHeavyCandidate,
  }
}

// ─── ENERGY ZONE GUARD ────────────────────────────────────────────────────────

const ENERGY_ZONES_ORDER: readonly EnergyZone[] = [
  'silence', 'valley', 'ambient', 'gentle', 'active', 'intense', 'peak',
]

function clampInRange(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

// ─── AUTOSAVE ─────────────────────────────────────────────────────────────────

const AUTOSAVE_DEBOUNCE_MS = 2_000
const AUTOSAVE_KEY_PREFIX = 'luxsync.theia.atomDraft.'

let _autosaveTimer: ReturnType<typeof setTimeout> | null = null

function scheduleAutosave(draft: DraftAtom): void {
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
export function loadAutosave(draftId: string): DraftAtom | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY_PREFIX + draftId)
    if (!raw) return null
    return JSON.parse(raw) as DraftAtom
  } catch {
    return null
  }
}

// ─── STORE ────────────────────────────────────────────────────────────────────

export const useTheiaEditorStore = create<TheiaEditorStore>()(
  subscribeWithSelector((set, get) => ({
    // ── State defaults ──────────────────────────────────────────────────────
    editorMode: 'live',
    draftAtom: null,
    isDirty: false,

    // ── Actions ────────────────────────────────────────────────────────────

    setEditorMode(mode) {
      set({ editorMode: mode })
    },

    /** Carga un ITheiaAtom existente como draft editable. */
    loadDraft(atom) {
      set({ draftAtom: cloneAtomToDraft(atom), isDirty: false })
    },

    /**
     * Crea un draft nuevo desde la ruta de un .mp4 recién dropeado.
     * Trim inicial = clip completo. Genoma centrado (0.5).
     */
    newDraftFromPath(filePath, durationMs, rawClipId) {
      const rawName = filePath.split(/[\\/]/).pop() ?? 'untitled'
      const baseName = rawName.replace(/\.[^.]+$/, '')
      const id = baseName || `draft-${Date.now()}`
      const draft: DraftAtom = {
        id,
        packId: '', // pack target se asigna en el momento del export
        filePath,
        rawClipId,
        aggression: 0.5,
        chaos: 0.5,
        organicity: 0.5,
        energyZone: { min: 'silence', max: 'peak' },
        validSections: [],
        trim: { startMs: 0, endMs: Math.max(250, Math.round(durationMs)) },
        compatibleVibes: ['unspecified'],
      }
      set({ draftAtom: draft, isDirty: true })
    },

    updateGenome(patch) {
      const { draftAtom } = get()
      if (!draftAtom) return
      const next: DraftAtom = { ...draftAtom }
      if (patch.aggression !== undefined) next.aggression = clampInRange(patch.aggression, 0, 1)
      if (patch.chaos !== undefined) next.chaos = clampInRange(patch.chaos, 0, 1)
      if (patch.organicity !== undefined) next.organicity = clampInRange(patch.organicity, 0, 1)
      set({ draftAtom: next, isDirty: true })
    },

    /**
     * Actualiza el rango de trim del átomo.
     * - Garantiza `endMs > startMs + 250` (gate A2 del blueprint).
     * - Clamp inferior a 0; clamp superior se delega al caller (conoce duración real).
     */
    updateTrim(startMs, endMs) {
      const { draftAtom } = get()
      if (!draftAtom) return
      const MIN_DURATION_MS = 250
      const safeStart = Math.max(0, Math.round(startMs))
      const safeEnd = Math.max(safeStart + MIN_DURATION_MS, Math.round(endMs))
      set({
        draftAtom: { ...draftAtom, trim: { startMs: safeStart, endMs: safeEnd } },
        isDirty: true,
      })
    },

    updateEnergyZone(edge, value) {
      const { draftAtom } = get()
      if (!draftAtom) return
      const minIdx = ENERGY_ZONES_ORDER.indexOf(draftAtom.energyZone.min)
      const maxIdx = ENERGY_ZONES_ORDER.indexOf(draftAtom.energyZone.max)
      const newIdx = ENERGY_ZONES_ORDER.indexOf(value)
      if (edge === 'min' && newIdx > maxIdx) return
      if (edge === 'max' && newIdx < minIdx) return
      set({
        draftAtom: {
          ...draftAtom,
          energyZone: { ...draftAtom.energyZone, [edge]: value },
        },
        isDirty: true,
      })
    },

    setValidSections(sections) {
      const { draftAtom } = get()
      if (!draftAtom) return
      set({
        draftAtom: { ...draftAtom, validSections: [...sections] },
        isDirty: true,
      })
    },

    clearDraft() {
      set({ draftAtom: null, isDirty: false })
    },

    markClean() {
      set({ isDirty: false })
    },
  })),
)

// ─── AUTOSAVE SUBSCRIPTION ────────────────────────────────────────────────────
// Se dispara cada vez que cambia isDirty o draftAtom. Debounced a 2s.

useTheiaEditorStore.subscribe(
  (s) => ({ draft: s.draftAtom, dirty: s.isDirty }),
  ({ draft, dirty }) => {
    if (dirty && draft) scheduleAutosave(draft)
  },
)
