/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🎬 THEIA TYPES — WAVE 4921 (Atomic Paradigm · Fase 1)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Tipos canónicos para el formato `.theia v2.0`. Esta wave abandona el
 * modelo multi-cuepoint de v1 en favor del paradigma ATÓMICO descrito en
 * el blueprint WAVE 4920:
 *
 *   - Un `.theia` = un único loop visual con un único genoma cognitivo.
 *   - El genoma vive EN LA RAÍZ del átomo (sin anidar en cuepoints).
 *   - El recorte temporal se reduce a `trim: { startMs, endMs }`.
 *   - Los átomos se agrupan en `Pack`s (carpetas del filesystem).
 *
 * Importante: este archivo SOLO declara tipos. No expone runtime ni
 * dependencias. Puede ser consumido tanto por main como por renderer.
 * ════════════════════════════════════════════════════════════════════════════
 */

import type { EnergyZone } from '../core/protocol/MusicalContext'

// ─── RE-EXPORT para conveniencia de consumidores Theia ────────────────────────
export type { EnergyZone }

// ─── GENOMA COGNITIVO (3D unit cube) ──────────────────────────────────────────

/**
 * Coordenadas inmutables del cubo unitario cognitivo.
 *
 * Equivalente estructural a `FrozenGenome` en `lfxTypes.ts`. Replicado aquí
 * (en lugar de importado) para evitar acoplamiento circular entre el dominio
 * de luz (`core/arsenal`) y el dominio de vídeo (`core/theia`).
 *
 * Cada componente ∈ [0, 1].
 */
export interface ITheiaGenome {
  readonly aggression: number
  readonly chaos: number
  readonly organicity: number
}

// ─── ZONAS ENERGÉTICAS ────────────────────────────────────────────────────────

/**
 * Rango de zonas energéticas en el termómetro Selene.
 * Equivalente a `EnergyZoneRange` en `lfxTypes.ts`.
 */
export interface IEnergyZoneRange {
  readonly min: EnergyZone
  readonly max: EnergyZone
}

/**
 * Mapa ordinal de zonas energéticas para comparación rápida.
 *
 * `silence` < `valley` < `ambient` < `gentle` < `active` < `intense` < `peak`
 *
 * Usado por `TheiaRegistry.findBestMatch()` para validar
 * `range.min ≤ currentZone ≤ range.max` con O(1) lookup numérico.
 */
export const ENERGY_ZONE_ORDINAL: Readonly<Record<EnergyZone, number>> = Object.freeze({
  silence: 0,
  valley: 1,
  ambient: 2,
  gentle: 3,
  active: 4,
  intense: 5,
  peak: 6,
})

// ─── ATOM (manifiesto completo del .theia v2) ────────────────────────────────

/**
 * Manifiesto cognitivo de un átomo `.theia v2.0`.
 *
 * Un `ITheiaAtom` es la unidad indivisible del paradigma WAVE 4920:
 * un único micro-vídeo (loop) con un único estado cognitivo. Sin cuepoints,
 * sin secciones internas. Si necesitas comportamientos cognitivos distintos
 * en el mismo material, créalos como átomos separados en el mismo Pack.
 *
 * REGLAS estructurales (validadas por el loader):
 *   - `id` no vacío, único dentro del pack
 *   - `trim.endMs > trim.startMs + 250`
 *   - `aggression / chaos / organicity` ∈ [0, 1]
 *   - `energyZone.min ≤ energyZone.max`
 *   - `validSections.length >= 1`
 */
export interface ITheiaAtom {
  /** ID único del átomo dentro de su pack (slug local). */
  readonly id: string

  /** Slug del pack al que pertenece (folder name). Vacío si todavía es draft. */
  readonly packId: string

  /** Ruta absoluta al .mp4/.webm en disco. */
  readonly filePath: string

  // ── Genoma al ROOT (antes ITheiaCuePoint.dna) ─────────────────────────────
  /** Combatividad visual percibida. 0..1. */
  readonly aggression: number
  /** Densidad de eventos / desorden organizado. 0..1. */
  readonly chaos: number
  /** Suavidad y respiración. 0..1. */
  readonly organicity: number

  /** Rango de zonas energéticas en las que este átomo es elegible. */
  readonly energyZone: IEnergyZoneRange

  /** Secciones musicales válidas (subset de los strings que emite Selene). */
  readonly validSections: readonly string[]

  // ── Recorte temporal del .mp4 (define EL LOOP) ───────────────────────────
  /**
   * Define qué fragmento del .mp4 ES el loop:
   *   - El video se reproduce desde `startMs` y vuelve a `startMs` al llegar
   *     a `endMs`.
   *   - Si `endMs === durationMs`, el loop es el clip completo.
   *   - Mínimo 250ms entre IN y OUT (validation gate).
   */
  readonly trim: {
    readonly startMs: number
    readonly endMs: number
  }

  /**
   * Vibes musicales en los que este átomo es elegible.
   * Idéntica semántica que `compatibleVibes` de un `.lfx`.
   */
  readonly compatibleVibes: readonly string[]

  // ── Flags opcionales ───────────────────────────────────────────────────
  /** True si es candidato a DIVINE strikes. */
  readonly isDivineCandidate?: boolean
  /** True si es candidato a HEAVY strikes. */
  readonly isHeavyCandidate?: boolean

  /**
   * 🔮 WAVE 8230 — EUCLID · E4 / Hybrid Deck: origen del átomo. Ausente =
   * `'video'` implícito (átomo `.theia` + `.mp4` clásico).
   * `kind: 'shader'` = átomo generativo Euclid — el medio cambia pero el
   * ADN (genoma/zona/secciones) es idéntico: Selene/Cassandra no distinguen.
   */
  readonly source?: ITheiaAtomSource
}

/**
 * Origen físico de un átomo (propuesta Hybrid Deck de WAVE 8210):
 *   - `video`  → `filePath` apunta al .mp4 (pipeline Modo A, 8207).
 *   - `shader` → `glsl` lleva el cuerpo `mainImage()` del shader Euclid
 *     (luego `.glsl` compilado por el ShaderAssembler §4.1).
 */
export interface ITheiaAtomSource {
  readonly kind: 'video' | 'shader'
  /** Cuerpo GLSL del artista (con cabeceras `@euclid`). Solo shader atoms. */
  readonly glsl?: string
  /**
   * 🧬 WAVE 8233 · G1 — fenotipo del átomo variante (`G_* → valor`) para
   * `kind:'shader'` (Infinite Genome §4.5: átomos `core#seed`). Ausente =
   * fenotipo canónico (defaults declarados en `@euclid gene`).
   */
  readonly genes?: Record<string, number>
}

// ─── PACK (carpeta-contenedor del filesystem) ───────────────────────────────

/**
 * Manifiesto opcional `pack.theiapack.json` a la raíz de la carpeta del Pack.
 * Si está ausente, el Pack se reconstruye dinámicamente desde los `.theia`
 * encontrados en su directorio (modo zero-conf).
 */
export interface ITheiaPackManifest {
  readonly schemaVersion: 1
  readonly displayName: string
  readonly description?: string
  /** Color de acento (HEX) que tinta el slot en el LiveDeck. */
  readonly accentColor?: string
  /** Orden explícito de átomos (slugs). Los no listados quedan al final. */
  readonly atomOrder?: readonly string[]
  /**
   * 🌊 WAVE 8299 — ajustes del Inspector persistidos por átomo (atomId →
   * overrides). El store los hidrata en `atomGeneValues`/`atomParamValues`
   * al escanear la librería y los reescribe debounced cuando el operador
   * mueve los faders genéticos o los `@euclid param`.
   */
  readonly atomOverrides?: Record<string, ITheiaAtomOverrides>
}

/** 🌊 WAVE 8299 — ajustes persistidos de un átomo en `pack.theiapack.json`. */
export interface ITheiaAtomOverrides {
  readonly genes?: Record<string, number>
  readonly params?: Record<string, number>
}

/**
 * Agrupación lógica de átomos. Equivale a una *carpeta* del filesystem.
 *
 *   `<packs-root>/<packId>/<atomId>.theia + .mp4`
 *
 * En la sesión actual el Pack puede estar en memoria sin haberse exportado
 * todavía (sus átomos vienen del WORKSHOP); el flag `pending` lo marca.
 */
export interface ITheiaPack {
  /** Slug del Pack — coincide con el nombre del directorio. */
  readonly id: string
  /** Ruta absoluta al directorio raíz del Pack en disco. Vacío si pending. */
  readonly rootPath: string
  /** Átomos contenidos (orden visible). */
  readonly atoms: readonly ITheiaAtom[]
  /** Manifiesto opcional. */
  readonly manifest: ITheiaPackManifest | null
  /** Timestamp (ms) de la última ingestión / refresh. */
  readonly scannedAt: number
  /**
   * True si el Pack vive sólo en memoria (todavía sin export-to-disk).
   * Útil para que la UI distinga "sesión actual" vs "Pack del filesystem".
   */
  readonly pending?: boolean
}

// ─── WAVE 8299 · LIBRARY SCAN (Main → Renderer payload) ─────────────────────

/** Extensión aceptada por el escáner de packs de disco. */
export type TheiaScannedFileKind = 'glsl' | 'theia'

/**
 * Un archivo de átomo encontrado en disco por `theia:library:scan`.
 * `text` viaja inline (eager): un `.glsl`/`.theia` pesa ~10-30KB — trivial
 * sobre IPC y evita un segundo round-trip por átomo.
 */
export interface ITheiaScannedAtomFile {
  /** Nombre del archivo con extensión (`mandala.glsl`). */
  readonly fileName: string
  /** Ruta relativa al pack root (`media/mandala.glsl`). */
  readonly relPath: string
  /** Ruta absoluta en disco — se convierte en `atom.filePath` real. */
  readonly absPath: string
  readonly kind: TheiaScannedFileKind
  /** Contenido UTF-8 del archivo. */
  readonly text: string
}

/** Un directorio-pack escaneado dentro de `userData/theia/packs/`. */
export interface ITheiaScannedPack {
  /** packId = nombre del directorio (o `loose` para archivos a nivel raíz). */
  readonly id: string
  /** Ruta absoluta del directorio del pack. */
  readonly rootPath: string
  /** Manifest parseado de `pack.theiapack.json`, null si ausente/malformado. */
  readonly manifest: ITheiaPackManifest | null
  readonly files: readonly ITheiaScannedAtomFile[]
}

/** Resultado completo de `theia:library:scan`. */
export interface ITheiaLibraryScan {
  /** Ruta absoluta al root escaneado (`userData/theia/packs`). */
  readonly packsRoot: string
  readonly packs: readonly ITheiaScannedPack[]
}

// ─── RESULTADO DEL MATCHING ───────────────────────────────────────────────────

/**
 * Resultado canónico del `AtomMatcher` (sucesor cognitivo de
 * `TheiaRegistry.findBestMatch()`).
 *
 * - `atomId`: identifica unívocamente qué átomo reproducir.
 * - `distance`: distancia euclidiana 3D al `targetDNA` (∈ [0, √3]).
 * - `score`: relevancia normalizada en [0, 1] (1 = match perfecto).
 */
export interface ITheiaMatch {
  readonly atomId: string
  readonly distance: number
  readonly score: number
}

// ─── TYPE GUARDS ─────────────────────────────────────────────────────────────

/** Validación runtime: ¿el objeto es un `ITheiaGenome` con valores en [0,1]? */
export function isValidGenome(g: unknown): g is ITheiaGenome {
  if (!g || typeof g !== 'object') return false
  const x = g as Record<string, unknown>
  return (
    _in01(x.aggression) &&
    _in01(x.chaos) &&
    _in01(x.organicity)
  )
}

function _in01(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1
}
