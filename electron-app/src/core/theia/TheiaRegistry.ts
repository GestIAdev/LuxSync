/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🎬 THEIA REGISTRY — WAVE 4921 (Atomic Paradigm · Fase 2)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Singleton que indexa los `ITheiaAtom` cargados y resuelve el matching
 * cognitivo entre el `targetDNA` que pide Selene y el átomo de vídeo más
 * cercano en el espacio 3D del genoma.
 *
 * PARALELO ARQUITECTÓNICO:
 *   `core/arsenal/DynamicEffectRegistry` ↔  `core/theia/TheiaRegistry`
 *
 * COSTE COMPUTACIONAL:
 *   - register / unregister: O(V) — V = compatibleVibes del átomo.
 *   - findBestMatch:          O(N) — N = átomos del vibe.
 *                             Típicamente 30 distancias 3D + min lineal.
 *                             ≈ 0.02 ms en V8 moderno → invisible al hot-path.
 *
 * OPTIMIZACIÓN MATEMÁTICA:
 *   La distancia euclidiana se compara internamente como **distancia² (sin sqrt)**
 *   porque (sqrt es monotónico): argmin(d) = argmin(d²). El sqrt solo se aplica
 *   al ganador para reportar el valor real al consumer.
 *
 * NOTA DE COMPATIBILIDAD:
 *   El método legacy `getAsset(id)` se conserva como alias de `getAtom(id)`
 *   hasta que toda la UI consuma el nuevo nombre. Se eliminará en una fase
 *   posterior junto con el AuthorAssetDeck legacy.
 * ════════════════════════════════════════════════════════════════════════════
 */

import type {
  ITheiaAtom,
  ITheiaGenome,
  ITheiaMatch,
  EnergyZone,
} from '../../types/theiaTypes'
import { ENERGY_ZONE_ORDINAL, isValidGenome } from '../../types/theiaTypes'

// ─── ESCALA Y CONSTANTES ─────────────────────────────────────────────────────

/**
 * Distancia 3D máxima posible entre dos puntos del cubo unitario [0,1]³.
 * Usada para normalizar `distance → score ∈ [0, 1]`.
 */
const MAX_DISTANCE_3D = Math.sqrt(3)

/** Snapshot vacío pre-congelado — devolverlo en lookups miss evita alloc. */
const EMPTY_ATOMS: readonly ITheiaAtom[] = Object.freeze<ITheiaAtom[]>([])

// ─── REGISTRY ────────────────────────────────────────────────────────────────

/**
 * Singleton de átomos `.theia` cargados.
 *
 * NO es un singleton tipo módulo-global por construcción: exponemos clase +
 * factory para facilitar testing. La instancia compartida vive en
 * `getTheiaRegistry()` al final del archivo.
 */
export class TheiaRegistry {
  // ── Índices primarios ──────────────────────────────────────────────────
  private readonly _byId = new Map<string, ITheiaAtom>()
  private readonly _byVibe = new Map<string, ITheiaAtom[]>()

  /** Snapshot inmutable plano (refrescado solo en mutaciones). */
  private _allAtoms: readonly ITheiaAtom[] = EMPTY_ATOMS

  // ─────────────────────────────────────────────────────────────────────────
  // INGESTA / MUTACIÓN
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Registra un átomo `.theia` ya validado en el registry.
   *
   * Validaciones mínimas (gates ESTRUCTURALES — los gates de archivo A1..A5
   * corren ANTES en `TheiaFileLoader`):
   *   - `id` no vacío y único
   *   - genoma (aggression/chaos/organicity) ∈ [0, 1]
   *   - `compatibleVibes.length > 0`
   *   - `trim.endMs > trim.startMs`
   *   - `energyZone.min ≤ energyZone.max`
   *
   * @returns el átomo congelado si fue aceptado, o `null` si fue rechazado.
   */
  public register(atom: ITheiaAtom): ITheiaAtom | null {
    if (!this._validateStructure(atom)) return null

    // Reemplazo idempotente: si ya existía, removerlo de los índices antes.
    const prev = this._byId.get(atom.id)
    if (prev) this._removeFromIndices(prev)

    const frozen = this._freezeAtom(atom)
    this._byId.set(frozen.id, frozen)
    this._appendToIndices(frozen)
    this._rebuildAllAtoms()

    return frozen
  }

  /**
   * Elimina un átomo del registry.
   * @returns true si existía.
   */
  public unregister(atomId: string): boolean {
    const prev = this._byId.get(atomId)
    if (!prev) return false
    this._byId.delete(atomId)
    this._removeFromIndices(prev)
    this._rebuildAllAtoms()
    return true
  }

  /** Vacía completamente el registry. */
  public clear(): void {
    this._byId.clear()
    this._byVibe.clear()
    this._allAtoms = EMPTY_ATOMS
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LOOKUPS O(1)
  // ─────────────────────────────────────────────────────────────────────────

  public getAtom(atomId: string): ITheiaAtom | undefined {
    return this._byId.get(atomId)
  }

  /**
   * @deprecated WAVE 4921 — alias legacy de `getAtom`. Se eliminará cuando
   * `TheiaEngineView` y consumidores migren a la nomenclatura atómica.
   */
  public getAsset(atomId: string): ITheiaAtom | undefined {
    return this._byId.get(atomId)
  }

  public has(atomId: string): boolean {
    return this._byId.has(atomId)
  }

  /** Átomos pre-filtrados por vibe (referencia al array indexado). */
  public getAtomsForVibe(vibe: string): readonly ITheiaAtom[] {
    return this._byVibe.get(vibe) ?? EMPTY_ATOMS
  }

  /** Snapshot inmutable de TODOS los átomos registrados. */
  public getAllAtoms(): readonly ITheiaAtom[] {
    return this._allAtoms
  }

  /**
   * @deprecated WAVE 4921 — alias legacy. Migrar callers a `getAllAtoms()`.
   */
  public getAllAssets(): readonly ITheiaAtom[] {
    return this._allAtoms
  }

  public getAtomCount(): number {
    return this._byId.size
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CORE — MATCHING COGNITIVO 3D
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Encuentra el átomo cuyo ADN minimiza la distancia euclidiana 3D al
   * `targetDNA` solicitado por Selene.
   *
   * Pipeline:
   *   1. Filtrar átomos por `vibe` (lookup O(1)).
   *   2. Descartar los cuya `energyZone` no incluya `currentZone`.
   *   3. Calcular distancia² entre `targetDNA` y el genoma plano del átomo.
   *   4. Memorizar el mínimo (sin sort — single pass O(N)).
   *   5. Aplicar sqrt solo al ganador y normalizar `score ∈ [0, 1]`.
   *
   * @returns El match más cercano, o `null` si no hay átomos elegibles.
   */
  public findBestMatch(
    targetDNA: ITheiaGenome,
    currentZone: EnergyZone,
    vibe: string,
  ): ITheiaMatch | null {
    if (!isValidGenome(targetDNA)) return null

    const atoms = this._byVibe.get(vibe)
    if (!atoms || atoms.length === 0) return null

    const tA = targetDNA.aggression
    const tC = targetDNA.chaos
    const tO = targetDNA.organicity
    const zoneOrd = ENERGY_ZONE_ORDINAL[currentZone]

    let bestDistSq = Infinity
    let bestAtomId = ''

    for (let i = 0; i < atoms.length; i++) {
      const atom = atoms[i]

      // Filtro hard: la zona actual debe estar dentro del rango del átomo.
      if (!_zoneInRange(zoneOrd, atom.energyZone)) continue

      const dA = tA - atom.aggression
      const dC = tC - atom.chaos
      const dO = tO - atom.organicity
      const distSq = dA * dA + dC * dC + dO * dO

      if (distSq < bestDistSq) {
        bestDistSq = distSq
        bestAtomId = atom.id
      }
    }

    if (bestDistSq === Infinity) return null

    const distance = Math.sqrt(bestDistSq)
    const score = 1 - distance / MAX_DISTANCE_3D

    return {
      atomId: bestAtomId,
      distance,
      score,
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INTERNALS
  // ─────────────────────────────────────────────────────────────────────────

  private _validateStructure(atom: ITheiaAtom): boolean {
    if (!atom || typeof atom !== 'object') return false
    if (typeof atom.id !== 'string' || atom.id.length === 0) return false
    if (typeof atom.filePath !== 'string' || atom.filePath.length === 0) return false

    // Genoma plano al root
    if (typeof atom.aggression !== 'number' || !_in01(atom.aggression)) return false
    if (typeof atom.chaos !== 'number' || !_in01(atom.chaos)) return false
    if (typeof atom.organicity !== 'number' || !_in01(atom.organicity)) return false

    // Trim
    if (!atom.trim || typeof atom.trim !== 'object') return false
    if (typeof atom.trim.startMs !== 'number' || atom.trim.startMs < 0) return false
    if (typeof atom.trim.endMs !== 'number' || atom.trim.endMs <= atom.trim.startMs) return false

    // EnergyZone
    if (!atom.energyZone) return false
    if (!_isEnergyZone(atom.energyZone.min)) return false
    if (!_isEnergyZone(atom.energyZone.max)) return false
    if (ENERGY_ZONE_ORDINAL[atom.energyZone.min] > ENERGY_ZONE_ORDINAL[atom.energyZone.max]) return false

    // Listas
    if (!_isReadonlyArray(atom.compatibleVibes) || atom.compatibleVibes.length === 0) return false
    if (!_isReadonlyArray(atom.validSections)) return false

    return true
  }

  private _freezeAtom(atom: ITheiaAtom): ITheiaAtom {
    return Object.freeze({
      id: atom.id,
      packId: atom.packId,
      filePath: atom.filePath,
      aggression: atom.aggression,
      chaos: atom.chaos,
      organicity: atom.organicity,
      energyZone: Object.freeze({ ...atom.energyZone }),
      validSections: Object.freeze([...atom.validSections]),
      trim: Object.freeze({ ...atom.trim }),
      compatibleVibes: Object.freeze([...atom.compatibleVibes]),
      isDivineCandidate: atom.isDivineCandidate,
      isHeavyCandidate: atom.isHeavyCandidate,
    })
  }

  private _appendToIndices(atom: ITheiaAtom): void {
    const seen = new Set<string>()
    for (const vibe of atom.compatibleVibes) {
      if (seen.has(vibe)) continue
      seen.add(vibe)
      let bucket = this._byVibe.get(vibe)
      if (!bucket) {
        bucket = []
        this._byVibe.set(vibe, bucket)
      }
      bucket.push(atom)
    }
  }

  private _removeFromIndices(atom: ITheiaAtom): void {
    for (const vibe of atom.compatibleVibes) {
      const bucket = this._byVibe.get(vibe)
      if (!bucket) continue
      const idx = bucket.indexOf(atom)
      if (idx >= 0) bucket.splice(idx, 1)
      if (bucket.length === 0) this._byVibe.delete(vibe)
    }
  }

  private _rebuildAllAtoms(): void {
    const next: ITheiaAtom[] = []
    for (const a of this._byId.values()) next.push(a)
    this._allAtoms = Object.freeze(next)
  }
}

function _in01(n: number): boolean {
  return Number.isFinite(n) && n >= 0 && n <= 1
}

// ─── HELPERS PRIVADOS ────────────────────────────────────────────────────────

/**
 * Narrowing-friendly array check.
 *
 * `Array.isArray` en TS lib estándar widena `readonly T[]` a `any[]` —
 * lo cual destruye el tipado intra-loop. Este helper no llama a `Array.isArray`
 * sobre el valor tipado: comprueba el shape mínimo (length numérico iterable)
 * sin alterar el type narrowing del compilador.
 */
function _isReadonlyArray<T>(v: readonly T[] | null | undefined): v is readonly T[] {
  return v != null && typeof (v as { length?: unknown }).length === 'number'
}

function _isEnergyZone(v: unknown): v is EnergyZone {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(ENERGY_ZONE_ORDINAL, v)
}

function _zoneInRange(zoneOrd: number, range: { min: EnergyZone; max: EnergyZone }): boolean {
  const minOrd = ENERGY_ZONE_ORDINAL[range.min]
  const maxOrd = ENERGY_ZONE_ORDINAL[range.max]
  return zoneOrd >= minOrd && zoneOrd <= maxOrd
}

// ─── SINGLETON ───────────────────────────────────────────────────────────────

let _instance: TheiaRegistry | null = null

/**
 * Obtiene la instancia compartida del `TheiaRegistry`.
 *
 * Para tests: importar la clase directamente y construirla con `new`.
 */
export function getTheiaRegistry(): TheiaRegistry {
  if (!_instance) _instance = new TheiaRegistry()
  return _instance
}

/** Reset destructivo del singleton — solo tests. */
export function __resetTheiaRegistryForTests(): void {
  _instance = null
}
