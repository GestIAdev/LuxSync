/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📦 THEIA PACK STORE — WAVE 4922 (Atomic Paradigm · Fase 3)
 *    🎛️ WAVE 8239 · U1 — Universal Media Pool (Theia es 100% LIVE)
 *
 * Estado de sesión para Packs y clips del MEDIA POOL.
 *
 * Dos cubos de estado independientes:
 *
 *   1. `packs`     → Packs *ya consolidados* (cada uno con ≥1 átomo válido).
 *                    Es lo que ve el LIVE Deck. Los vídeos ingestados, los
 *                    `.theia` y los `.glsl` nacen directamente como átomos
 *                    dentro de su pack — sin paso intermedio.
 *
 *   2. `rawClips`  → Tracking de los archivos de vídeo dropeados (blob URL,
 *                    duración una vez medida). Cada uno lleva pareado un
 *                    átomo `kind:'video'` ya jugable en el deck.
 *
 * Es deliberadamente *sólo* memoria de la sesión activa.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { create } from 'zustand'
import { getTheiaRegistry } from '../core/theia/TheiaRegistry'
import { parseEuclidMeta } from '../theia/shader/ShaderAssembler'
import { ENERGY_ZONE_ORDINAL } from '../types/theiaTypes'
import type { EnergyZone, ITheiaAtom, ITheiaPack } from '../types/theiaTypes'

// ─── MEDIA POOL ───────────────────────────────────────────────────────────────

/** Estado de un raw clip (vídeo ingestado, aún sin duración medida). */
export type RawClipState = 'queued' | 'editing' | 'exported'

/** 🎛️ WAVE 8239 · U1 — extensiones aceptadas por el Universal Media Pool. */
export const MEDIA_POOL_VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mkv', '.mov', '.avi'] as const
export const MEDIA_POOL_ATOM_EXTENSIONS = ['.theia', '.glsl'] as const
export const MEDIA_POOL_ACCEPT =
  [...MEDIA_POOL_VIDEO_EXTENSIONS, ...MEDIA_POOL_ATOM_EXTENSIONS].join(',')

/** ¿El filename pertenece al conjunto aceptado por el media pool? */
export function isSupportedMediaFile(fileName: string): boolean {
  const lower = fileName.toLowerCase()
  return [...MEDIA_POOL_VIDEO_EXTENSIONS, ...MEDIA_POOL_ATOM_EXTENSIONS]
    .some((ext) => lower.endsWith(ext))
}

/**
 * Archivo de vídeo dropeado por el operador. Cada clip lleva pareado un
 * átomo `source.kind='video'` (mismo `id`) que ya es jugable en el LiveDeck:
 * `filePath` del átomo apunta a la blob URL de este clip.
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

  // ── Atoms ────────────────────────────────────────────────────────────────
  /** 🎛️ U1 — parchea el trim de un átomo dentro de su pack (p.ej. tras medir
   *  la duración real de un vídeo). Re-registra en el TheiaRegistry. */
  updateAtomTrim(atomId: string, packId: string, endMs: number): void

  // ── Bulk ingestion helper ────────────────────────────────────────────────
  /**
   * 🎛️ WAVE 8239 · U1 — Universal Media Pool ingestion.
   *
   * Convierte un FileList en átomos jugables agrupados por carpeta:
   *
   *   - Video (`.mp4 .webm .mkv .mov .avi`) → `RawClip` (blob URL) + átomo
   *     `source.kind='video'` adjunto al pack del bucket.
   *   - `.theia` → ITheiaAtom parseado y adjunto al pack correspondiente.
   *   - `.glsl`  → lee el texto, parsea `@euclid` y nace un átomo
   *     `source.kind='shader'` registrado en el TheiaRegistry.
   *
   * Grouping rule:
   *   - Si `file.webkitRelativePath` viene definido (folder-pick),
   *     el primer segmento del path se usa como `packId`.
   *   - Si no, todos van al mismo Pack autogenerado `New_Pack_<n>`.
   *
   * Devuelve clips creados, átomos adjuntados y el packId del primer file.
   */
  ingestFiles(files: readonly File[]): Promise<{
    clips: readonly RawClip[]
    atoms: readonly ITheiaAtom[]
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
 * 🎛️ U1 — trim nominal de un átomo vídeo recién ingestado (la duración real
 * se parchea con `updateAtomTrim` cuando `loadedmetadata` llega).
 */
const NOMINAL_VIDEO_TRIM_MS = 60_000

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

  // ── Atoms ────────────────────────────────────────────────────────────────
  updateAtomTrim(atomId, packId, endMs) {
    const pack = get().packs.get(packId)
    const atom = pack?.atoms.find((a) => a.id === atomId)
    if (!pack || !atom || !Number.isFinite(endMs) || endMs <= atom.trim.startMs) return
    const nextAtom: ITheiaAtom = { ...atom, trim: { ...atom.trim, endMs } }
    const nextPacks = new Map(get().packs)
    nextPacks.set(packId, {
      ...pack,
      atoms: pack.atoms.map((a) => (a.id === atomId ? nextAtom : a)),
    })
    set({ packs: nextPacks })
    getTheiaRegistry().register(nextAtom) // re-freeze con el trim real
  },

  // ── Bulk ingestion ───────────────────────────────────────────────────────
  async ingestFiles(files) {
    if (files.length === 0) {
      return { clips: [], atoms: [], packId: '' }
    }

    const state = get()
    const ts = Date.now()

    // Separar por familia: vídeo / .theia (átomo serializado) / .glsl (shader)
    const isExt = (f: File, ext: string): boolean => f.name.toLowerCase().endsWith(ext)
    const videoFiles = files.filter((f) => !isExt(f, '.theia') && !isExt(f, '.glsl'))
    const theiaFiles = files.filter((f) => isExt(f, '.theia'))
    const glslFiles = files.filter((f) => isExt(f, '.glsl'))

    // STEP 1 — Determinar packId (carpeta) por archivo.
    const groupKeys = new Map<File, string>(
      files.map((f) => [f, _packIdFromPath(f) ?? '']),
    )
    const allEmpty = [...groupKeys.values()].every((k) => k === '')
    const autoPackId = allEmpty ? _nextAutoPackId(state.packs) : ''

    const packIdFor = (f: File, fallback = ''): string =>
      groupKeys.get(f) || fallback || autoPackId

    // STEP 2 — Construir clips + asegurar Packs `pending` para cada bucket.
    const nextPacks = new Map(state.packs)
    const clips: RawClip[] = []
    const atoms: ITheiaAtom[] = []
    const ensuredPacks = new Set<string>()
    const registry = getTheiaRegistry()

    const ensurePack = (packId: string): void => {
      if (ensuredPacks.has(packId)) return
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

    const attach = (atom: ITheiaAtom): void => {
      ensurePack(atom.packId)
      const pack = nextPacks.get(atom.packId)!
      nextPacks.set(atom.packId, {
        ...pack,
        atoms: [...pack.atoms.filter((a) => a.id !== atom.id), atom],
        scannedAt: ts,
      })
      registry.register(atom) // resoluble por playAtom (clip/shader resolver)
      atoms.push(atom)
    }

    videoFiles.forEach((file, idx) => {
      const packId = packIdFor(file)
      const base = _safeBasename(file.name)
      const clipId = `${packId}__${base}__${ts}_${idx}`
      const url = URL.createObjectURL(file)

      clips.push({
        id: clipId,
        name: file.name,
        filePath:
          (file as File & { path?: string }).path ??
          (file as File & { webkitRelativePath?: string }).webkitRelativePath ??
          file.name,
        url,
        packId,
        state: 'queued',
        durationMs: 0,
        addedAt: ts + idx,
      })

      // 🎛️ U1 — el vídeo nace como átomo jugable: filePath = blob URL (el
      // clipUrlResolver lo pasa intacto a loadVideo). Genoma neutro — los
      // genes del shader no aplican a un medio decodificado.
      // trim nominal: la duración real se mide tras el primer loadVideo y se
      // parchea vía updateAtomTrim. `compatibleVibes:['generic']` — untagged
      // media no reclama vibes de Selene (el trigger manual es su vía).
      attach({
        id: clipId,
        packId,
        filePath: url,
        aggression: 0.5,
        chaos: 0.5,
        organicity: 0.5,
        energyZone: { min: 'gentle', max: 'peak' },
        validSections: ['verse', 'buildup', 'drop', 'breakdown', 'outro'],
        trim: { startMs: 0, endMs: NOMINAL_VIDEO_TRIM_MS },
        compatibleVibes: ['generic'],
        source: { kind: 'video' },
      })
    })

    // STEP 3 — Archivos .theia: átomo serializado directo al pack.
    for (const file of theiaFiles) {
      try {
        const text = await file.text()
        const parsed: unknown = JSON.parse(text)
        if (!_isValidTheiaAtom(parsed)) {
          console.warn(`[PackStore] ingestFiles: .theia inválido (schema), ignorado: ${file.name}`)
          continue
        }
        const atom = parsed as ITheiaAtom
        attach({ ...atom, packId: _packIdFromPath(file) ?? atom.packId })
      } catch (err) {
        console.warn(`[PackStore] ingestFiles: error al parsear .theia: ${file.name}`, err)
      }
    }

    // STEP 4 — Archivos .glsl: leer texto → meta @euclid → átomo shader.
    for (const file of glslFiles) {
      try {
        const glsl = await file.text()
        attach(_buildGlslAtom(file.name, glsl, packIdFor(file, 'glsl_pool')))
      } catch (err) {
        console.warn(`[PackStore] ingestFiles: error al leer .glsl: ${file.name}`, err)
      }
    }

    set({
      packs: nextPacks,
      rawClips: [...state.rawClips, ...clips],
    })

    return { clips, atoms, packId: clips[0]?.packId ?? atoms[0]?.packId ?? autoPackId }
  },
}))

// ─── BULK HELPERS (free functions) ───────────────────────────────────────────

/** Zona de energía válida o fallback defensivo. */
function _toEnergyZone(s: string | undefined, fallback: EnergyZone): EnergyZone {
  return s && s in ENERGY_ZONE_ORDINAL ? (s as EnergyZone) : fallback
}

/**
 * 🎛️ WAVE 8239 · U1 — construye un `ITheiaAtom` `source.kind='shader'`
 * desde un `.glsl` dropeado. El shader es su propio manifiesto: genoma y
 * zona se derivan del header `@euclid` (defaults neutros si ausente).
 * `id` estable por basename → re-dropear el mismo archivo reemplaza.
 */
export function buildGlslAtom(fileName: string, glsl: string, packId: string): ITheiaAtom {
  const meta = parseEuclidMeta(glsl)
  const base = _safeBasename(fileName)
  return {
    id: `glsl_${base}`,
    packId,
    filePath: `file://${fileName}`, // identidad simbólica — el medio es el glsl embebido
    aggression: meta.genome.aggression ?? 0.5,
    chaos: meta.genome.chaos ?? 0.5,
    organicity: meta.genome.organicity ?? 0.5,
    energyZone: {
      min: _toEnergyZone(meta.zone?.from, 'gentle'),
      max: _toEnergyZone(meta.zone?.to, 'peak'),
    },
    validSections: ['verse', 'buildup', 'drop', 'breakdown', 'outro'],
    trim: { startMs: 0, endMs: 8000 }, // loop infinito — trim nominal
    compatibleVibes: ['generic'], // untagged — el trigger manual es su vía
    source: { kind: 'shader', glsl },
  }
}

// alias interno usado por ingestFiles
const _buildGlslAtom = buildGlslAtom

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
