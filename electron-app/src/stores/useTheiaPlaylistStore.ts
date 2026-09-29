/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎚️ useTheiaPlaylistStore — WAVE 8305 (Blueprint Ola C · §6)
 *
 * Playlist manual del Media Server: lista ordenada de ítems que el operador
 * arma arrastrando átomos del Media Browser (LiveDeck). Auto-Pilot/Dwell/
 * Quantize llegan en la Ola D — aquí solo disparo manual vía NEXT/PREV del
 * Context Strip o click directo en una tarjeta.
 *
 * Referencias del ítem (blueprint §6.1):
 *   - `atomId`   — átomo del registry/pack (vídeo `.theia` o shader `.glsl`,
 *                  incluidas mutaciones vivas `core#seed`).
 *   - `genome`   — {coreId, seed}: mutación INMORTAL. Si el átomo `core#seed`
 *                  fue borrado del Deck (WAVE 8302) o la sesión reinició, se
 *                  respawnea determinísticamente vía `spawnGenomeVariant`
 *                  antes de disparar — el setlist nunca se rompe.
 *   - `filePath` — medio directo (forward-compat para drops de archivos que
 *                  aún no son átomo; se dispara con urlResolver propio).
 *
 * Índices:
 *   - `activeIndex` — el ítem que está en LIVE (-1 = nada).
 *   - `cueIndex`    — el próximo que dispararía NEXT (-1 = sin cue).
 *
 * Flags:
 *   - `skip`   — NEXT/PREV lo saltan (sigue siendo disparable por click).
 *   - `pinned` — el lane no deja borrarlo (hay que des-pinear primero).
 *
 * El disparo usa `theta.playAtom` — la misma vía que el click del LiveDeck —
 * llamado DENTRO de las acciones (lazy deref): nada se toca en module-init,
 * igual que `removeAtom`/`getTheiaRegistry` en useTheiaPackStore.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { create } from 'zustand'
import { getThetaOrchestrator } from '../theia/ThetaOrchestrator'
import { spawnGenomeVariant } from '../theia/genome/GenomePool'
import { getTheiaRegistry } from '../core/theia/TheiaRegistry'
import { useTheiaAutopilotStore } from './useTheiaAutopilotStore'
import type { ITheiaAtom } from '../types/theiaTypes'

/** MIME propio del payload interno de átomos (DnD deck → playlist). */
export const THEIA_ATOM_MIME = 'application/x-theia-atom'

/** Crossfade al disparar desde la playlist — mismo que FORCE-TRIGGER. */
const PLAYLIST_CROSSFADE_MS = 500

export interface TheiaPlaylistGenomeRef {
  readonly coreId: string
  readonly seed: number
}

export interface TheiaPlaylistItem {
  /** uuid local del slot de playlist (≠ atomId — un átomo puede repetirse). */
  readonly id: string
  /** Átomo registrado (vídeo o shader; puede ser `core#seed` vivo). */
  readonly atomId?: string
  /** Referencia inmortal de mutación — respawnea si el átomo murió. */
  readonly genome?: TheiaPlaylistGenomeRef
  /** Medio directo sin átomo (forward-compat). */
  readonly filePath?: string
  readonly label: string
  /** Chip visual: 'shader' (GEN) o 'video' (VID). */
  readonly kind: 'shader' | 'video'
  readonly flags: {
    /** NEXT/PREV lo saltan (manual click sigue disparándolo). */
    readonly skip: boolean
    /** Protegido de borrado en el lane. */
    readonly pinned: boolean
  }
}

export type TheiaPlaylistDraft = Omit<TheiaPlaylistItem, 'id' | 'flags'> & {
  readonly flags?: Partial<TheiaPlaylistItem['flags']>
}

let __uid = 0
function uid(): string {
  return `pl_${Date.now().toString(36)}_${(++__uid).toString(36)}`
}

/**
 * Resuelve el ítem a un intent de playAtom. Respawnea mutaciones
 * `core#seed` caídas (inmortalidad del blueprint). Devuelve false si el
 * ítem no tiene medio resoluble.
 */
export function resolvePlaylistAtom(
  item: TheiaPlaylistItem,
): { atomId: string | null; atom: ITheiaAtom | undefined } {
  const registry = getTheiaRegistry()

  let atomId = item.atomId
    ?? (item.genome ? `${item.genome.coreId}#${item.genome.seed}` : null)

  // Resurrección: el `core#seed` no está en el registry (borrado del deck o
  // sesión nueva) pero tenemos su genoma → spawn determinístico.
  if (atomId && !registry.getAtom(atomId)) {
    const ref = item.genome
      ?? (atomId.includes('#')
        ? {
            coreId: atomId.split('#')[0],
            seed: Number(atomId.split('#')[1]),
          }
        : null)
    if (ref && Number.isFinite(ref.seed)) {
      const spawned = spawnGenomeVariant(ref.coreId, ref.seed)
      if (spawned) atomId = spawned.atomId
    }
  }

  return { atomId, atom: atomId ? registry.getAtom(atomId) : undefined }
}

function triggerPlaylistItem(
  item: TheiaPlaylistItem,
  crossfadeMs = PLAYLIST_CROSSFADE_MS,
  reasonKind: 'manual' | 'auto' = 'manual',
): boolean {
  const theta = getThetaOrchestrator()
  const { atomId, atom } = resolvePlaylistAtom(item)
  if (!atom && !item.filePath) {
    // eslint-disable-next-line no-console
    console.warn(`[PLAYLIST] item '${item.id}' sin medio resoluble — skip`)
    return false
  }

  void theta
    .playAtom({
      atomId: atomId ?? `playlist-item:${item.id}`,
      startMs: atom?.trim.startMs ?? 0,
      crossfadeMs,
      reason: `playlist:${reasonKind}|item=${item.id}`,
      // Medio `file` puro: su filePath ES la URL (mismo contrato que el
      // defaultResolver de SeleneTheiaWiring).
      urlResolver:
        !atom && item.filePath ? () => item.filePath! : undefined,
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error(`[PLAYLIST] playAtom '${item.id}' failed:`, err)
    })
  return true
}

/**
 * Busca el primer índice no-`skip` desde `from` (inclusive) caminando en
 * `dir` con wrap. `exclude` = activeIndex: solo lo acepta si es el único
 * candidato (playlist de un solo ítem → NEXT lo redispara). -1 si nada.
 */
function findPlayable(
  items: readonly TheiaPlaylistItem[],
  from: number,
  dir: 1 | -1,
  exclude: number,
): number {
  const n = items.length
  if (n === 0) return -1
  for (let step = 0; step < n; step++) {
    const i = (((from + dir * step) % n) + n) % n
    if (i === exclude) continue
    if (!items[i].flags.skip) return i
  }
  // Único candidato posible: el propio activo (loop de un solo ítem).
  return exclude >= 0 && exclude < n && !items[exclude].flags.skip
    ? exclude
    : -1
}

export interface TheiaPlaylistState {
  readonly items: readonly TheiaPlaylistItem[]
  /** Ítem en LIVE (-1 = vacío/standby). */
  readonly activeIndex: number
  /** Próximo ítem que dispararía NEXT (-1 = sin cue). */
  readonly cueIndex: number

  insertItem: (draft: TheiaPlaylistDraft, index?: number) => TheiaPlaylistItem
  removeItem: (itemId: string) => void
  reorderItems: (fromIndex: number, toIndex: number) => void
  setActiveIndex: (index: number) => void
  setCueIndex: (index: number) => void
  toggleSkip: (itemId: string) => void
  togglePinned: (itemId: string) => void
  clearPlaylist: () => void

  /** Dispara el ítem en `index` (manual override — ignora `skip`).
   *  `crossfadeMs` opcional — el Auto-Pilot pasa su X-FADE propio. */
  playAt: (
    index: number,
    crossfadeMs?: number,
    opts?: { auto?: boolean },
  ) => boolean
  /** NEXT: dispara el cue (o el siguiente al activo), saltando `skip`. */
  playNext: () => boolean
  /** PREV: dispara el anterior al activo, saltando `skip`. */
  playPrev: () => boolean
}

export const useTheiaPlaylistStore = create<TheiaPlaylistState>((set, get) => ({
  items: [],
  activeIndex: -1,
  cueIndex: -1,

  insertItem: (draft, index) => {
    const item: TheiaPlaylistItem = {
      id: uid(),
      atomId: draft.atomId,
      genome: draft.genome,
      filePath: draft.filePath,
      label: draft.label,
      kind: draft.kind,
      flags: { skip: draft.flags?.skip ?? false, pinned: draft.flags?.pinned ?? false },
    }
    set((s) => {
      const at = index === undefined ? s.items.length : Math.max(0, Math.min(s.items.length, index))
      const items = [...s.items.slice(0, at), item, ...s.items.slice(at)]
      // Los índices se desplazan si la inserción va por delante de ellos.
      const shift = (i: number) => (i >= at ? i + 1 : i)
      const cueIndex =
        s.cueIndex < 0 && s.items.length === 0 ? 0 : shift(s.cueIndex)
      return {
        items,
        activeIndex: shift(s.activeIndex),
        cueIndex,
      }
    })
    return item
  },

  removeItem: (itemId) => {
    set((s) => {
      const idx = s.items.findIndex((it) => it.id === itemId)
      if (idx < 0) return s
      const items = s.items.filter((it) => it.id !== itemId)
      const remap = (i: number) => (i === idx ? -1 : i > idx ? i - 1 : i)
      const activeIndex = remap(s.activeIndex)
      return {
        items,
        activeIndex,
        cueIndex: remap(s.cueIndex),
      }
    })
  },

  reorderItems: (fromIndex, toIndex) => {
    set((s) => {
      const n = s.items.length
      const from = Math.max(0, Math.min(n - 1, fromIndex))
      const to = Math.max(0, Math.min(n - 1, toIndex))
      if (from === to) return s
      const items = [...s.items]
      const [moved] = items.splice(from, 1)
      items.splice(to, 0, moved)
      // Re-map de índices: el ítem activo/cue sigue siendo el mismo ítem.
      const remap = (i: number) => {
        if (i < 0) return i
        if (i === from) return to
        if (from < to && i > from && i <= to) return i - 1
        if (to < from && i >= to && i < from) return i + 1
        return i
      }
      return { items, activeIndex: remap(s.activeIndex), cueIndex: remap(s.cueIndex) }
    })
  },

  setActiveIndex: (index) => set({ activeIndex: index }),
  setCueIndex: (index) => set({ cueIndex: index }),

  toggleSkip: (itemId) =>
    set((s) => ({
      items: s.items.map((it) =>
        it.id === itemId
          ? { ...it, flags: { ...it.flags, skip: !it.flags.skip } }
          : it,
      ),
    })),

  togglePinned: (itemId) =>
    set((s) => ({
      items: s.items.map((it) =>
        it.id === itemId
          ? { ...it, flags: { ...it.flags, pinned: !it.flags.pinned } }
          : it,
      ),
    })),

  clearPlaylist: () => set({ items: [], activeIndex: -1, cueIndex: -1 }),

  playAt: (index, crossfadeMs, opts) => {
    const { items } = get()
    const item = items[index]
    if (!item) return false
    const auto = opts?.auto === true
    if (!triggerPlaylistItem(item, crossfadeMs, auto ? 'auto' : 'manual')) return false
    // 🖐 WAVE 8307 — regla de oro: disparo humano ⇒ el Director calla (HOLD).
    if (!auto) useTheiaAutopilotStore.getState().takeOver()
    set({
      activeIndex: index,
      cueIndex: findPlayable(items, index + 1, 1, index),
    })
    return true
  },

  playNext: () => {
    const { items, activeIndex, cueIndex } = get()
    const start =
      cueIndex >= 0 && cueIndex < items.length ? cueIndex : activeIndex + 1
    const target = findPlayable(items, start, 1, activeIndex)
    if (target < 0) return false
    if (!triggerPlaylistItem(items[target])) return false
    useTheiaAutopilotStore.getState().takeOver()
    set({
      activeIndex: target,
      cueIndex: findPlayable(items, target + 1, 1, target),
    })
    return true
  },

  playPrev: () => {
    const { items, activeIndex } = get()
    const target = findPlayable(items, activeIndex - 1, -1, activeIndex)
    if (target < 0) return false
    if (!triggerPlaylistItem(items[target])) return false
    useTheiaAutopilotStore.getState().takeOver()
    set({
      activeIndex: target,
      cueIndex: findPlayable(items, target + 1, 1, target),
    })
    return true
  },
}))

/** Payload serializado que emite un tile del deck al arrastrar. */
export interface TheiaAtomDragPayload {
  readonly atomId: string
  readonly label: string
  readonly kind: 'shader' | 'video'
  /** Presente si el átomo es una mutación `core#seed` (inmortal). */
  readonly genome?: TheiaPlaylistGenomeRef
}

/** Parsea un payload de drag interno; null si no es nuestro MIME. */
export function parseTheiaAtomPayload(
  dt: DataTransfer,
): TheiaAtomDragPayload | null {
  const raw = dt.getData(THEIA_ATOM_MIME)
  if (!raw) return null
  try {
    const p = JSON.parse(raw) as TheiaAtomDragPayload
    if (typeof p.atomId !== 'string' || !p.atomId) return null
    return {
      atomId: p.atomId,
      label: typeof p.label === 'string' && p.label ? p.label : p.atomId,
      kind: p.kind === 'video' ? 'video' : 'shader',
      genome:
        p.genome && typeof p.genome.coreId === 'string' && Number.isFinite(p.genome.seed)
          ? { coreId: p.genome.coreId, seed: p.genome.seed }
          : undefined,
    }
  } catch {
    return null
  }
}
