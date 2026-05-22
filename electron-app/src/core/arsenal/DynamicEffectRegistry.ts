// ════════════════════════════════════════════════════════════════════════════
// 🏛️ WAVE 2482 — INFINITE ARSENAL · DYNAMIC EFFECT REGISTRY
// ════════════════════════════════════════════════════════════════════════════
//  Almacén in-memory zero-alloc para `.lfx v2.1`.
//
//  POLÍTICA:
//    - TODA allocación ocurre en `registerEffect()` / `clear()` / hot-reload.
//    - CERO allocaciones en lookups (`getEffectsForVibe`, `getDNA`, etc.).
//    - Cada `RegistryEntry` se congela con Object.freeze() al ingresar.
//    - Los índices `vibeIndex`, `divinePool`, `heavyPool` son arrays
//      pre-construidos que el Registry mantiene actualizados en escritura.
//
//  POLÍTICA ACTUAL (WAVE 4825):
//    - Este registry ES la fuente de verdad única. EFFECT_DNA_REGISTRY purgado.
//    - Todos los módulos leen DNA, textureAffinity y energyZone desde aquí.
// ════════════════════════════════════════════════════════════════════════════

import {
  DEFAULT_IK_COMPATIBILITY,
  DEFAULT_SAFETY_DECLARATION,
  DEFAULT_SIMULATION_META,
  hasCognitiveDNA,
  isSeleneEligible,
  type CognitiveDNA,
  type ExecutionHints,
  type FrozenGenome,
  type LfxClipV2,
  type RegistryEntry,
  type SimulationMeta,
} from './lfxTypes'

// ─── OPCIONES DE INGESTA ────────────────────────────────────────────────────

export interface RegisterOptions {
  /** Path absoluto del .lfx en disco (null si fue inyectado in-memory). */
  filePath?: string | null
  /** Marcar como builtin (carga desde `/builtin-effects/`). */
  isBuiltin?: boolean
  /** Conservar referencia al clip completo para carga lazy de curvas. */
  keepSource?: boolean
}

// ─── REGISTRY ───────────────────────────────────────────────────────────────

/**
 * Singleton de efectos cognitivos cargados.
 *
 * NO es un singleton tipo módulo-global por defecto: exponemos clase + factory
 * para facilitar testing. Existe `getDynamicEffectRegistry()` al final.
 */
export class DynamicEffectRegistry {
  // ── Índices primarios ────────────────────────────────────────────────────
  private readonly _byId = new Map<string, RegistryEntry>()
  private readonly _byVibe = new Map<string, RegistryEntry[]>()
  private readonly _divineByVibe = new Map<string, RegistryEntry[]>()
  private readonly _heavyByVibe = new Map<string, RegistryEntry[]>()

  /** Snapshot inmutable plano (refrescado solo en mutaciones). */
  private _allEntries: readonly RegistryEntry[] = Object.freeze<RegistryEntry[]>([])

  /** Vista vacía pre-congelada — devolverla en lookups miss evita alloc. */
  private static readonly _EMPTY_ENTRIES: readonly RegistryEntry[] = Object.freeze<RegistryEntry[]>([])

  // ─────────────────────────────────────────────────────────────────────────
  // INGESTA / MUTACIÓN
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Registra un `.lfx v2.1` en el registry.
   *
   * Validaciones aplicadas (gates G1..G7 del Blueprint V2):
   *   G1: schema correcto y `effectType === 'heph_custom'`.
   *   G3: rangos del genoma ∈ [0,1].
   *   G4: `compatibleVibes` no vacío.
   *
   * Gates G2 (checksum), G5 (curve sanity), G6 (strobe consistency), G7
   * (offset range) corren ANTES de llamar a este método, en el cargador FS.
   *
   * @returns la entry congelada si fue aceptada, o `null` si fue rechazada.
   */
  public registerEffect(clip: LfxClipV2, options: RegisterOptions = {}): RegistryEntry | null {
    if (!isSeleneEligible(clip)) {
      // Clip Hephaestus puro (v1, o v2 sin DNA) → invisible para Selene.
      // No es error, no es warning — es by-design.
      return null
    }

    // Type narrow: hasCognitiveDNA garantiza presencia.
    if (!hasCognitiveDNA(clip)) return null
    const dna: CognitiveDNA = clip.clip.cognitiveDNA

    if (!_validateGenomeRanges(dna)) {
      console.warn(`[DynamicEffectRegistry ⚠️] G3 fail: genome out of range for "${clip.clip.id}"`)
      return null
    }
    if (dna.compatibleVibes.length === 0) {
      console.warn(`[DynamicEffectRegistry ⚠️] G4 fail: empty compatibleVibes for "${clip.clip.id}"`)
      return null
    }

    const entry = _buildEntry(clip, dna, options)

    // Reemplazo idempotente: si ya existía, removerlo de los índices antes.
    const prev = this._byId.get(entry.id)
    if (prev) this._removeFromIndices(prev)

    this._byId.set(entry.id, entry)
    this._appendToIndices(entry)
    this._rebuildAllEntries()

    return entry
  }

  /**
   * Elimina un efecto del registry.
   * @returns true si existía.
   */
  public unregisterEffect(effectId: string): boolean {
    const prev = this._byId.get(effectId)
    if (!prev) return false
    this._byId.delete(effectId)
    this._removeFromIndices(prev)
    this._rebuildAllEntries()
    return true
  }

  /** Vacía completamente el registry. */
  public clear(): void {
    this._byId.clear()
    this._byVibe.clear()
    this._divineByVibe.clear()
    this._heavyByVibe.clear()
    this._allEntries = DynamicEffectRegistry._EMPTY_ENTRIES
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LOOKUPS O(1) — zero-alloc
  // ─────────────────────────────────────────────────────────────────────────

  /** Retorna efectos pre-filtrados por vibe (referencia al array indexado). */
  public getEffectsForVibe(vibe: string): readonly RegistryEntry[] {
    return this._byVibe.get(vibe) ?? DynamicEffectRegistry._EMPTY_ENTRIES
  }

  /** Retorna arsenal DIVINE pre-indexado por vibe. */
  public getDivineArsenal(vibe: string): readonly RegistryEntry[] {
    return this._divineByVibe.get(vibe) ?? DynamicEffectRegistry._EMPTY_ENTRIES
  }

  /** Retorna arsenal HEAVY pre-indexado por vibe. */
  public getHeavyArsenal(vibe: string): readonly RegistryEntry[] {
    return this._heavyByVibe.get(vibe) ?? DynamicEffectRegistry._EMPTY_ENTRIES
  }

  /** Lookup por ID. */
  public getEntry(effectId: string): RegistryEntry | undefined {
    return this._byId.get(effectId)
  }

  /** Conveniencia: genoma plano. */
  public getDNA(effectId: string): FrozenGenome | undefined {
    return this._byId.get(effectId)?.dna
  }

  /** Conveniencia: simulationMeta. */
  public getSimMeta(effectId: string): SimulationMeta | undefined {
    return this._byId.get(effectId)?.simMeta
  }

  /** Conveniencia: executionHints. */
  public getExecHints(effectId: string): ExecutionHints | undefined {
    return this._byId.get(effectId)?.execHints
  }

  /** Path al `.lfx` para carga lazy de curvas. */
  public getEffectFilePath(effectId: string): string | null | undefined {
    return this._byId.get(effectId)?.filePath
  }

  /** ¿Existe este effectId en el registry como clip cognitivo? */
  public has(effectId: string): boolean {
    return this._byId.has(effectId)
  }

  /** Snapshot inmutable de TODAS las entries. */
  public getAllEntries(): readonly RegistryEntry[] {
    return this._allEntries
  }

  public getEntryCount(): number {
    return this._byId.size
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INTERNALS — INDEX MAINTENANCE
  // ─────────────────────────────────────────────────────────────────────────

  private _appendToIndices(entry: RegistryEntry): void {
    for (const vibe of entry.compatibleVibes) {
      let bucket = this._byVibe.get(vibe)
      if (!bucket) { bucket = []; this._byVibe.set(vibe, bucket) }
      bucket.push(entry)

      if (entry.simMeta.isDivineCandidate) {
        let dBucket = this._divineByVibe.get(vibe)
        if (!dBucket) { dBucket = []; this._divineByVibe.set(vibe, dBucket) }
        dBucket.push(entry)
      }
      if (entry.simMeta.isHeavyCandidate) {
        let hBucket = this._heavyByVibe.get(vibe)
        if (!hBucket) { hBucket = []; this._heavyByVibe.set(vibe, hBucket) }
        hBucket.push(entry)
      }
    }
  }

  private _removeFromIndices(entry: RegistryEntry): void {
    for (const vibe of entry.compatibleVibes) {
      _spliceFrom(this._byVibe.get(vibe), entry)
      _spliceFrom(this._divineByVibe.get(vibe), entry)
      _spliceFrom(this._heavyByVibe.get(vibe), entry)
    }
  }

  private _rebuildAllEntries(): void {
    const next: RegistryEntry[] = []
    for (const e of this._byId.values()) next.push(e)
    this._allEntries = Object.freeze(next)
  }
}

// ─── HELPERS PRIVADOS ───────────────────────────────────────────────────────

function _validateGenomeRanges(dna: CognitiveDNA): boolean {
  const g = dna.genome
  if (!_in01(g.aggression) || !_in01(g.chaos) || !_in01(g.organicity)) return false
  if (!_in01(dna.aggressionRange.min) || !_in01(dna.aggressionRange.max)) return false
  if (dna.aggressionRange.min > dna.aggressionRange.max) return false
  return true
}

function _in01(n: number): boolean {
  return Number.isFinite(n) && n >= 0 && n <= 1
}

function _spliceFrom(arr: RegistryEntry[] | undefined, target: RegistryEntry): void {
  if (!arr) return
  const idx = arr.indexOf(target)
  if (idx >= 0) arr.splice(idx, 1)
}

function _buildEntry(
  clip: LfxClipV2,
  dna: CognitiveDNA,
  options: RegisterOptions,
): RegistryEntry {
  const c = clip.clip

  const simMeta: SimulationMeta = c.simulationMeta ?? DEFAULT_SIMULATION_META
  const execHints: ExecutionHints =
    c.executionHints ?? _DEFAULT_EXECUTION_HINTS
  const safetyDecl = c.safetyDeclaration ?? DEFAULT_SAFETY_DECLARATION
  const ikCompat = dna.ikCompatibility ?? DEFAULT_IK_COMPATIBILITY

  // Congelar arrays defensivamente para honrar `readonly` en runtime.
  const compatibleVibes = Object.freeze([...dna.compatibleVibes])
  const validSections = Object.freeze([...dna.validSections])
  const tags = Object.freeze([...c.tags])

  const entry: RegistryEntry = {
    id: c.id,
    name: c.name,
    author: c.author,
    category: c.category,
    tags,
    durationMs: c.durationMs,
    effectType: c.effectType,

    filePath: options.filePath ?? null,
    dna: Object.freeze({
      aggression: dna.genome.aggression,
      chaos: dna.genome.chaos,
      organicity: dna.genome.organicity,
    }),
    textureAffinity: dna.textureAffinity,
    compatibleVibes,
    validSections,
    energyZone: Object.freeze({ min: dna.energyZone.min, max: dna.energyZone.max }),
    aggressionRange: Object.freeze({
      min: dna.aggressionRange.min,
      max: dna.aggressionRange.max,
    }),
    spatialBehavior: dna.spatialBehavior,
    ikCompatibility: Object.freeze({ ...ikCompat }),

    simMeta: Object.freeze({
      ...simMeta,
      beautyWeights: Object.freeze({ ...simMeta.beautyWeights }),
      zScoreGuards: Object.freeze({ ...simMeta.zScoreGuards }),
    }) as SimulationMeta,
    execHints: Object.freeze({
      ...execHints,
      phaseConfig: Object.freeze({ ...execHints.phaseConfig }),
    }) as ExecutionHints,
    safetyDecl: Object.freeze({ ...safetyDecl }),

    isBuiltin: options.isBuiltin ?? false,
    loadedAt: Date.now(),
    source: options.keepSource ? clip : null,
  }

  return Object.freeze(entry)
}

const _DEFAULT_EXECUTION_HINTS: Readonly<ExecutionHints> = Object.freeze({
  overlayMode: 'absolute',
  phaseConfig: Object.freeze({
    spread: 0,
    symmetry: 'linear',
    wings: 1,
    direction: 1,
  }) as ExecutionHints['phaseConfig'],
  intensityScaling: 'proportional',
  fixtureTargeting: 'all',
}) as Readonly<ExecutionHints>

// ─── SINGLETON ──────────────────────────────────────────────────────────────

let _instance: DynamicEffectRegistry | null = null

/** Acceso al singleton compartido del proceso. */
export function getDynamicEffectRegistry(): DynamicEffectRegistry {
  if (_instance == null) _instance = new DynamicEffectRegistry()
  return _instance
}

/** SOLO para tests: resetea el singleton. */
export function __resetDynamicEffectRegistryForTests(): void {
  _instance = null
}
