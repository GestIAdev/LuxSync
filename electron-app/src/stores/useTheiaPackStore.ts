/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📦 THEIA PACK STORE — WAVE 4922 (Atomic Paradigm · Fase 3)
 *
 * Estado de sesión para Packs y "raw clips" del WORKSHOP.
 *
 * Dos cubos de estado independientes:
 *
 *   1. `packs`     → Packs *ya consolidados* (cada uno con ≥1 átomo válido).
 *                    Es lo que ve el LIVE Deck. Pueden venir del filesystem
 *                    (exported) o quedarse en memoria como `pending` hasta
 *                    el primer export.
 *
 *   2. `rawClips`  → Archivos `.mp4/.webm/...` dropeados en la sesión actual
 *                    que aún no han pasado por el WORKSHOP (trim + ADN +
 *                    export). Es la cola del WORKSHOP Deck.
 *
 * Es deliberadamente *sólo* memoria de la sesión activa. La persistencia
 * real ocurre en el filesystem cuando el operador exporta.
 *
 * No mezclar con `useTheiaEditorStore`:
 *   - `useTheiaEditorStore`   → el ÁTOMO actualmente bajo edición (1).
 *   - `useTheiaPackStore`     → todo lo demás (N raw clips, N packs).
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { create } from 'zustand'
import type { ITheiaAtom, ITheiaPack } from '../types/theiaTypes'

// ─── RAW CLIP ────────────────────────────────────────────────────────────────

/** Estado de un raw clip a lo largo del flujo WORKSHOP. */
export type RawClipState = 'queued' | 'editing' | 'exported'

/**
 * Archivo bruto dropeado por el operador. No es un átomo todavía: el átomo
 * nace cuando se ejecuta el primer `newDraftFromPath` sobre él (estado
 * `editing`) y se materializa al exportarlo (`exported`).
 */
export interface RawClip {
  /** Slug único en la sesión (`<basename>-<ts>` por defecto). */
  readonly id: string
  /** Nombre legible (típicamente el filename con extensión). */
  readonly name: string
  /** Ruta absoluta o `blob:` URL. */
  readonly filePath: string
  /** Object URL para `loadVideo()`. Se revoca al unload. */
  readonly url: string
  /** Slug del Pack target. Vacío si no asignado todavía. */
  readonly packId: string
  /** Estado en el flujo. */
  readonly state: RawClipState
  /** Duración total del .mp4 (ms). Se rellena al cargarlo en el orchestrator. */
  readonly durationMs: number
  /** Timestamp de creación (ms). */
  readonly addedAt: number
}

// ─── STORE INTERFACE ─────────────────────────────────────────────────────────

interface TheiaPackState {
  /** Map packId → Pack. */
  readonly packs: ReadonlyMap<string, ITheiaPack>
  /** Lista ordenada de raw clips de la sesión. */
  readonly rawClips: readonly RawClip[]
  /** Pack actualmente "●live" (uno sólo a la vez en V1). */
  readonly livePackId: string | null
  /** Pack visualmente desplegado en LiveDeck (puede diferir del live). */
  readonly expandedPackId: string | null
}

interface TheiaPackActions {
  // ── Packs ────────────────────────────────────────────────────────────────
  upsertPack(pack: ITheiaPack): void
  removePack(packId: string): void
  setLivePack(packId: string | null): void
  setExpandedPack(packId: string | null): void

  // ── Raw clips ────────────────────────────────────────────────────────────
  addRawClips(clips: readonly RawClip[]): void
  updateRawClip(clipId: string, patch: Partial<RawClip>): void
  removeRawClip(clipId: string): void
  clearRawClips(): void

  // ── Bulk ingestion helper ────────────────────────────────────────────────
  /**
   * Convierte un FileList en raw clips agrupados por carpeta contenedora.
   * Devuelve los clips creados y el `packId` inferido para el primer file.
   *
   * Grouping rule:
   *   - Si `file.webkitRelativePath` viene definido (folder-pick),
   *     el primer segmento del path se usa como `packId`.
   *   - Si no, todos van al mismo Pack autogenerado `New_Pack_<n>`.
   *
   * WAVE 4924 — M2: Los archivos `.theia` se parsean como ITheiaAtom y se
   * adjuntan directamente al Pack correspondiente. El pack pierde el flag
   * `pending` en cuanto tiene ≥1 átomo real.
   */
  ingestFiles(files: readonly File[]): Promise<{
    clips: readonly RawClip[]
    packId: string
  }>
}

export type TheiaPackStore = TheiaPackState & TheiaPackActions

// ─── HELPERS ─────────────────────────────────────────────────────────────────

let _autopackCounter = 1

/** Genera un nombre de pack válido para un nuevo bundle autogenerado. */
function _nextAutoPackId(existing: ReadonlyMap<string, ITheiaPack>): string {
  while (existing.has(`New_Pack_${_autopackCounter}`)) _autopackCounter++
  const id = `New_Pack_${_autopackCounter}`
  _autopackCounter++
  return id
}

/** Inferir el packId del primer segmento de `webkitRelativePath`. */
function _packIdFromPath(file: File): string | null {
  // webkitRelativePath = "MyFolder/sub/file.mp4" — el browser lo expone
  // cuando se usa `<input webkitdirectory>` o se hace drag&drop de carpeta.
  const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath
  if (!rel) return null
  const segments = rel.split(/[\\/]/).filter(Boolean)
  if (segments.length <= 1) return null
  return segments[0]
}

function _safeBasename(name: string): string {
  return name.replace(/\.[^.]+$/, '').replace(/[^\w\-]+/g, '_') || 'clip'
}

/**
 * Validación mínima runtime de un objeto como ITheiaAtom.
 * No carga el modelo completo — sólo comprueba campos críticos del paradigma atómico.
 */
function _isValidTheiaAtom(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object') return false
  const a = obj as Record<string, unknown>
  return (
    typeof a.id === 'string' && a.id.length > 0 &&
    typeof a.packId === 'string' &&
    typeof a.filePath === 'string' &&
    typeof a.aggression === 'number' &&
    typeof a.chaos === 'number' &&
    typeof a.organicity === 'number' &&
    typeof a.energyZone === 'object' && a.energyZone !== null &&
    typeof a.trim === 'object' && a.trim !== null
  )
}

// ─── STORE ───────────────────────────────────────────────────────────────────

export const useTheiaPackStore = create<TheiaPackStore>((set, get) => ({
  // ── Initial state ────────────────────────────────────────────────────────
  packs: new Map(),
  rawClips: [],
  livePackId: null,
  expandedPackId: null,

  // ── Packs ────────────────────────────────────────────────────────────────
  upsertPack(pack) {
    const next = new Map(get().packs)
    next.set(pack.id, pack)
    set({ packs: next })
  },

  removePack(packId) {
    const next = new Map(get().packs)
    if (!next.delete(packId)) return
    const { livePackId, expandedPackId } = get()
    set({
      packs: next,
      livePackId: livePackId === packId ? null : livePackId,
      expandedPackId: expandedPackId === packId ? null : expandedPackId,
    })
  },

  setLivePack(packId) {
    if (packId !== null && !get().packs.has(packId)) {
      console.warn(`[useTheiaPackStore] setLivePack('${packId}') — pack desconocido`)
      return
    }
    set({ livePackId: packId })
  },

  setExpandedPack(packId) {
    if (packId !== null && !get().packs.has(packId)) return
    set({ expandedPackId: packId })
  },

  // ── Raw clips ────────────────────────────────────────────────────────────
  addRawClips(clips) {
    if (clips.length === 0) return
    set({ rawClips: [...get().rawClips, ...clips] })
  },

  updateRawClip(clipId, patch) {
    const next = get().rawClips.map((c) =>
      c.id === clipId ? { ...c, ...patch } : c
    )
    set({ rawClips: next })
  },

  removeRawClip(clipId) {
    set({ rawClips: get().rawClips.filter((c) => c.id !== clipId) })
  },

  clearRawClips() {
    // Importante: revocar URLs para no leakear blobs.
    for (const c of get().rawClips) {
      if (c.url.startsWith('blob:')) {
        try { URL.revokeObjectURL(c.url) } catch { /* noop */ }
      }
    }
    set({ rawClips: [] })
  },

  // ── Bulk ingestion ───────────────────────────────────────────────────────
  async ingestFiles(files) {
    if (files.length === 0) {
      return { clips: [], packId: '' }
    }

    const state = get()
    const ts = Date.now()

    // Separar archivos de vídeo de archivos .theia
    const videoFiles = files.filter((f) => !f.name.toLowerCase().endsWith('.theia'))
    const theiaFiles = files.filter((f) => f.name.toLowerCase().endsWith('.theia'))

    // STEP 1 — Determinar packId (carpeta) por archivo de vídeo.
    const groupKeys: string[] = videoFiles.map((f) => _packIdFromPath(f) ?? '')
    const allEmpty = groupKeys.every((k) => k === '')
    const autoPackId = allEmpty ? _nextAutoPackId(state.packs) : ''

    // STEP 2 — Construir clips + asegurar Packs `pending` para cada bucket.
    const nextPacks = new Map(state.packs)
    const clips: RawClip[] = []
    const ensuredPacks = new Set<string>()

    videoFiles.forEach((file, idx) => {
      const explicit = groupKeys[idx]
      const packId = explicit || autoPackId
      const base = _safeBasename(file.name)
      const clipId = `${packId}__${base}__${ts}_${idx}`

      const fp =
        (file as File & { path?: string }).path ??
        (file as File & { webkitRelativePath?: string }).webkitRelativePath ??
        file.name

      clips.push({
        id: clipId,
        name: file.name,
        filePath: fp,
        url: URL.createObjectURL(file),
        packId,
        state: 'queued',
        durationMs: 0,
        addedAt: ts + idx,
      })

      if (!ensuredPacks.has(packId)) {
        ensuredPacks.add(packId)
        if (!nextPacks.has(packId)) {
          nextPacks.set(packId, {
            id: packId,
            rootPath: '',
            atoms: [],
            manifest: null,
            scannedAt: ts,
            pending: true,
          })
        }
      }
    })

    // STEP 3 — Parsear archivos .theia y adjuntar sus átomos al pack.
    for (const file of theiaFiles) {
      try {
        const text = await file.text()
        const parsed: unknown = JSON.parse(text)
        if (!_isValidTheiaAtom(parsed)) {
          console.warn(`[PackStore] ingestFiles: .theia inválido (schema), ignorado: ${file.name}`)
          continue
        }
        const atom = parsed as ITheiaAtom

        // packId: preferir el segmento de carpeta sobre el packId embebido en el .theia
        const packId = _packIdFromPath(file) ?? atom.packId

        if (!ensuredPacks.has(packId)) {
          ensuredPacks.add(packId)
          if (!nextPacks.has(packId)) {
            nextPacks.set(packId, {
              id: packId,
              rootPath: '',
              atoms: [],
              manifest: null,
              scannedAt: ts,
              pending: false,
            })
          }
        }

        // Adjuntar átomo al pack (dedup por id).
        const existingPack = nextPacks.get(packId)!
        const dedupAtoms = existingPack.atoms.filter((a) => a.id !== atom.id)
        nextPacks.set(packId, {
          ...existingPack,
          atoms: [...dedupAtoms, atom],
          pending: false,
          scannedAt: ts,
        })
      } catch (err) {
        console.warn(`[PackStore] ingestFiles: error al parsear .theia: ${file.name}`, err)
      }
    }

    set({
      packs: nextPacks,
      rawClips: [...state.rawClips, ...clips],
    })

    return { clips, packId: clips[0]?.packId ?? autoPackId }
  },
}))

// ─── BULK HELPERS (free functions) ───────────────────────────────────────────

/**
 * Adjunta un átomo recién exportado a su Pack. Si el Pack no existe lo crea
 * (marcado como NO-pending, ya que ya hay un átomo materializado).
 */
export function attachAtomToPack(atom: ITheiaAtom, rootPath: string): void {
  const { packs, upsertPack } = useTheiaPackStore.getState()
  const existing = packs.get(atom.packId)
  if (existing) {
    const dedupAtoms = existing.atoms.filter((a) => a.id !== atom.id)
    upsertPack({
      ...existing,
      atoms: [...dedupAtoms, atom],
      scannedAt: Date.now(),
      pending: false,
    })
  } else {
    upsertPack({
      id: atom.packId,
      rootPath,
      atoms: [atom],
      manifest: null,
      scannedAt: Date.now(),
      pending: false,
    })
  }
}
