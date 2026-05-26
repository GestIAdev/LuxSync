/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🎬 THEIA TYPES — WAVE 4901 (Phase 1/3 of WAVE-4900-THEIADNA)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Tipos canónicos para el formato `.theia v1.0`. Este módulo es la fuente
 * de verdad estructural — paralelo a `core/arsenal/lfxTypes.ts` para `.lfx`.
 *
 * PRINCIPIO RECTOR (WAVE 4900):
 *   El `.theia` HEREDA el genoma cognitivo de `.lfx V3`. Selene no aprende
 *   dos vocabularios — aprende uno y lo aplica a dos dominios (luz / vídeo).
 *
 *   - `ITheiaGenome` ≡ shape de `FrozenGenome` (`lfxTypes.ts`).
 *   - `EnergyZone` reusado de `core/protocol/MusicalContext.ts`.
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

// ─── CUEPOINT (sub-genoma temporal dentro de un .mp4) ────────────────────────

/**
 * Sub-genoma cognitivo de una zona temporal dentro del asset de vídeo.
 *
 * Cada cuepoint actúa como un mini-`.lfx` con un rango `[startMs, endMs]`
 * y su propio ADN. El `SeleneTheiaAdapter` (WAVE 4903) usa estos cuepoints
 * para decidir SEEKs precisos basados en distancia euclidiana al targetDNA.
 *
 * REGLAS estructurales (validadas por TheiaFileLoader, WAVE 4902):
 *   - `startMs >= 0`
 *   - `endMs > startMs`
 *   - `endMs <= asset.durationMs`
 *   - cuepoints de un mismo asset NO pueden solaparse
 *   - exactamente UNO debe tener `default: true`
 */
export interface ITheiaCuePoint {
  /** ID único dentro del clip (ej. 'intro', 'lift', 'drop-01'). */
  readonly id: string

  /** Etiqueta legible para UI (ej. 'The Big Drop'). */
  readonly name: string

  // ── Rango temporal ──────────────────────────────────────────────────────
  /** Inicio del cuepoint en ms (offset dentro del .mp4). */
  readonly startMs: number
  /** Fin del cuepoint en ms (exclusivo). */
  readonly endMs: number

  // ── ADN cognitivo ──────────────────────────────────────────────────────
  /** Genoma específico de este segmento de vídeo. */
  readonly dna: ITheiaGenome

  /** Rango de zonas energéticas en las que este cuepoint es elegible. */
  readonly energyZone: IEnergyZoneRange

  /** Secciones musicales válidas (subset de los strings que emite Selene). */
  readonly validSections: readonly string[]

  // ── Flags opcionales ───────────────────────────────────────────────────
  /** True si es el cuepoint de fallback cuando ningún otro matchea. */
  readonly default?: boolean
  /** True si es candidato a DIVINE strikes. */
  readonly isDivineCandidate?: boolean
  /** True si es candidato a HEAVY strikes. */
  readonly isHeavyCandidate?: boolean
  /** Hint opcional: vibes en los que este cuepoint brilla especialmente. */
  readonly preferredVibes?: readonly string[]
}

// ─── ASSET (manifiesto completo del .theia) ───────────────────────────────────

/**
 * Manifiesto cognitivo de un clip de vídeo `.theia v1.0`.
 *
 * Es la forma INTERNA del registry — pre-validada y pre-congelada por
 * `TheiaFileLoader` (WAVE 4902). El binario .mp4 NO está aquí; este objeto
 * solo declara metadatos cognitivos y la ruta al asset.
 */
export interface ITheiaAsset {
  /** ID único del asset en el registry. */
  readonly id: string

  /** Ruta absoluta al .mp4/.webm en disco. */
  readonly filePath: string

  /**
   * ADN del CLIP COMPLETO. Fallback cuando ningún cuepoint específico aplica.
   * Equivalente a `cognitiveDNA.genome` de un `.lfx`.
   */
  readonly globalDNA: ITheiaGenome

  /**
   * Vibes musicales en los que este asset es elegible.
   * Idéntica semántica que `compatibleVibes` de un `.lfx`.
   */
  readonly compatibleVibes: readonly string[]

  /** Cuepoints declarados dentro del asset (length >= 1). */
  readonly cuePoints: readonly ITheiaCuePoint[]
}

// ─── RESULTADO DEL MATCHING ───────────────────────────────────────────────────

/**
 * Resultado canónico de `TheiaRegistry.findBestMatch()`.
 *
 * - `assetId` + `cuePointId`: identifican unívocamente qué reproducir.
 * - `distance`: distancia euclidiana 3D al `targetDNA` (∈ [0, √3]).
 * - `score`: relevancia normalizada en [0, 1] (1 = match perfecto).
 */
export interface ITheiaMatch {
  readonly assetId: string
  readonly cuePointId: string
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
