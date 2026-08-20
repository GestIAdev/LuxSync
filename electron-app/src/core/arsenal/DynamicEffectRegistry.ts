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
  type CognitiveDNA,
  type ExecutionHints,
  type FrozenGenome,
  type LFXFileV3,
  type PixelExecutionHints,
  type RegistryEntry,
  type SimulationMeta,
} from './lfxTypes'
import type { HephAutomationClipV3 } from '../hephaestus/types'
import { VIBE_ALIAS_MAP } from '../../engine/vibe/profiles/index'
import { getSpeciesQuotaSelector } from '../genesis/ecology/SpeciesQuotaSelector'
import { getOrganismMaterializer } from '../genesis/OrganismMaterializer'

// ─── OPCIONES DE INGESTA ────────────────────────────────────────────────────

export interface RegisterOptions {
  /** Path absoluto del .lfx en disco (null si fue inyectado in-memory). */
  filePath?: string | null
  /** Marcar como builtin (carga desde `/builtin-effects/`). */
  isBuiltin?: boolean
  /** Conservar referencia al clip completo para carga lazy de curvas. */
  keepSource?: boolean
  /** 🧬 GENESIS: Organism ID from the Coliseum DB. Present only for evolved mutants. */
  organismId?: string
  /** 🧬 GENESIS: Number of times this organism has been fired in live shows. */
  trialsCount?: number
  /** 🧬 GENESIS: Organism status from the Coliseum DB ('alive' | 'champion' | 'canonized' | …). */
  organismStatus?: string
}

/**
 * Entrada serializable del catálogo de efectos — usada en el IPC
 * `lux:arsenal:getCatalog` para exponer el registry al renderer
 * (MidiLearn + KeyForge).
 */
export interface EffectCatalogEntry {
  readonly id: string
  readonly name: string
  /** Zona de energía pico declarada en el DNA (max del EnergyZoneRange). */
  readonly energyZone: string
  readonly compatibleVibes: string[]
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
   * Registra un `.lfx v3.0` nativo en el registry.
   *
   * Gates aplicados:
   *   G1: effectType === 'heph_custom' (no obligatorio en V3 — se acepta cualquier valor).
   *   G3: rangos del genoma ∈ [0,1].
   *   G4: `compatibleVibes` no vacío.
   *
   * Si `cognitiveDNA` está ausente, el clip es Hephaestus-only (invisible para Selene).
   *
   * @returns la entry congelada si fue aceptada, o `null` si fue rechazada.
   */
  public registerEffectV3(v3: LFXFileV3, options: RegisterOptions = {}): RegistryEntry | null {
    const clip = v3.clip
    if (!clip.cognitiveDNA) {
      // V3 sin DNA: clip Hephaestus puro — invisible para Selene por diseño.
      return null
    }
    const dna = clip.cognitiveDNA
    // WAVE 7176: Only polyfill pressureRange if the field is truly absent
    // (undefined or null). A value of {min:0, max:0} is a legitimate
    // "permissive" user choice and must NOT be overwritten with defaults.
    if (dna.pressureRange == null) {
      (dna as { pressureRange: { min: number; max: number } }).pressureRange = { min: 0.5, max: 1.0 }
    }
    if (!_validateGenomeRanges(dna)) {
      console.warn(`[DynamicEffectRegistry ⚠️] V3 G3 fail: genome out of range for "${clip.id}"`)
      return null
    }
    if (dna.compatibleVibes.length === 0) {
      console.warn(`[DynamicEffectRegistry ⚠️] V3 G4 fail: empty compatibleVibes for "${clip.id}"`)
      return null
    }

    const entry = _buildEntryFromV3(clip, options)

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

  /**
   * 🧬 WAVE 5000.V3 — ARENA GATES: Injects evolved organisms into the
   * DreamSimulator's selection pool.
   *
   * Calls SpeciesQuotaSelector.selectCandidates(10) to extract ≤10 elite
   * representatives across species, materializes each into a full
   * HephAutomationClipV3 via OrganismMaterializer, wraps it as an LFXFileV3,
   * and registers it in this registry alongside the base blueprints.
   *
   * This is the bridge between the ecological laboratory and the live arena:
   * only organisms that prove themselves in simulation get injected here.
   *
   * @param poolSize Max candidates to inject (default: 10)
   * @returns Number of candidates successfully injected
   */
  public refreshEvolutionaryCandidates(poolSize: number = 3): number {
    console.log('[ArenaInject 🧬] Fetching candidates from SpeciesQuotaSelector...')
    try {
      const selector = getSpeciesQuotaSelector()
      const materializer = getOrganismMaterializer()

      const result = selector.selectCandidates(poolSize)
      console.log(
        `[ArenaInject 🧬] SpeciesQuotaSelector returned ${result.candidates.length} candidates ` +
        `from pool of ${result.totalPool} (${result.speciesRepresented} species, ` +
        `${result.explorers} explorers)`,
      )
      if (result.candidates.length === 0) {
        console.warn('[ArenaInject 🧬] ⚠️ Zero candidates returned — no alive/champion organisms in vault')
        return 0
      }

      let injected = 0
      let rejected = 0
      for (const candidate of result.candidates) {
        try {
          const mat = materializer.materialize(candidate.organismId)
          const clip = mat.clip

          // Build a minimal LFXFileV3 wrapper for registerEffectV3
          const lfxWrapper = {
            $schema: 'luxsync.lfx/3.0' as const,
            clip,
            checksum: '',
          }

          const entry = this.registerEffectV3(lfxWrapper, {
            filePath: null,
            isBuiltin: false,
            organismId: candidate.organismId,
            trialsCount: candidate.trialsCount,
            organismStatus: candidate.status,
          })

          if (entry) {
            injected++
            console.log(
              `[ArenaInject 🧬] Registered mutant: ${clip.id} ` +
              `-> Vibe index: [${clip.cognitiveDNA?.compatibleVibes.join(', ')}]`,
            )
          } else {
            rejected++
            const hasDna = !!clip.cognitiveDNA
            const vibes = clip.cognitiveDNA?.compatibleVibes ?? []
            console.warn(
              `[ArenaInject 🧬] ⚠️ registerEffectV3 REJECTED organism ${candidate.organismId} ` +
              `(DNA: ${hasDna}, vibes: [${vibes.join(', ')}])`,
            )
          }
        } catch (matErr) {
          rejected++
          console.warn(
            `[ArenaInject 🧬] ⚠️ Materialization failed for ${candidate.organismId}:`,
            matErr,
          )
        }
      }

      console.log(
        `[ArenaInject 🧬] Cycle complete: ${injected} injected, ${rejected} rejected ` +
        `out of ${result.candidates.length} candidates ` +
        `(status: ${result.candidates.map(c => c.status).join(', ')})`,
      )

      return injected
    } catch (err) {
      console.error('[ArenaInject 🧬] 💥 FATAL — refreshEvolutionaryCandidates failed:', err)
      return 0
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LOOKUPS O(1) — zero-alloc
  // ─────────────────────────────────────────────────────────────────────────

  /** Retorna efectos pre-filtrados por vibe (referencia al array indexado). */
  public getEffectsForVibe(vibe: string): readonly RegistryEntry[] {
    return this._byVibe.get(vibe) ?? DynamicEffectRegistry._EMPTY_ENTRIES
  }

  /** Retorna arsenal DIVINE pre-indexado por vibe. 🧬 PURGATORY WALL: excludes 'alive' organisms. */
  public getDivineArsenal(vibe: string): readonly RegistryEntry[] {
    const raw = this._divineByVibe.get(vibe)
    if (!raw) return DynamicEffectRegistry._EMPTY_ENTRIES
    const filtered = raw.filter(e => !e.organismId || e.organismStatus !== 'alive')
    return filtered.length === raw.length ? raw : filtered
  }

  /** Retorna arsenal HEAVY pre-indexado por vibe. 🧬 PURGATORY WALL: excludes 'alive' organisms. */
  public getHeavyArsenal(vibe: string): readonly RegistryEntry[] {
    const raw = this._heavyByVibe.get(vibe)
    if (!raw) return DynamicEffectRegistry._EMPTY_ENTRIES
    const filtered = raw.filter(e => !e.organismId || e.organismStatus !== 'alive')
    return filtered.length === raw.length ? raw : filtered
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

  /**
   * 🔍 WAVE 7522: VIBE INDEX DIAGNOSTIC — Returns a map of vibe → count
   * showing how many effects are indexed per vibe bucket. Used at boot to
   * detect index corruption (e.g. effects alive in registry but missing
   * from the vibe index).
   */
  public getVibeIndexDiagnostic(): Record<string, number> {
    const result: Record<string, number> = {}
    for (const [vibe, entries] of this._byVibe) {
      result[vibe] = entries.length
    }
    return result
  }

  /**
   * Catálogo serializable para IPC renderer → MidiLearn / KeyForge.
   *
   * Devuelve solo los campos necesarios para construir la lista de acciones
   * disparables. `energyZone` es el `max` del rango declarado en el DNA
   * (zona pico del efecto — la más representativa para el catálogo de usuario).
   *
   * Nota: solo incluye efectos *cognitivos* (con DNA). Los clips Hephaestus-only
   * no son disparables via `forceStrike` desde el registry.
   */
  public getEffectCatalog(): EffectCatalogEntry[] {
    return this._allEntries.map(e => ({
      id:             e.id,
      name:           e.name,
      energyZone:     e.energyZone.max,
      compatibleVibes: [...e.compatibleVibes],
    }))
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INTERNALS — INDEX MAINTENANCE
  // ─────────────────────────────────────────────────────────────────────────

  private _appendToIndices(entry: RegistryEntry): void {
    // 🎯 WAVE 4865: Deduplicar por canonical vibe.
    // Un efecto puede declarar ['latin', 'fiesta-latina'] — ambos mapean al mismo canonical.
    // Sin este Set, el entry se insertaría DOS VECES en el mismo bucket → candidatos clonados.
    const seenCanonicalVibes = new Set<string>()

    for (const rawVibe of entry.compatibleVibes) {
      // Normalizar alias legacy → slug canónico del sistema (ej: 'latin' → 'fiesta-latina')
      const vibe = (VIBE_ALIAS_MAP as Record<string, string>)[rawVibe] ?? rawVibe

      // Saltar si ya procesamos este canonical vibe para este entry
      if (seenCanonicalVibes.has(vibe)) continue
      seenCanonicalVibes.add(vibe)

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
    for (const rawVibe of entry.compatibleVibes) {
      const vibe = (VIBE_ALIAS_MAP as Record<string, string>)[rawVibe] ?? rawVibe
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
  const pr = dna.pressureRange ?? { min: 0, max: 0 }
  if (!_in01(pr.min) || !_in01(pr.max)) return false
  if (pr.min > pr.max) return false
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

/**
 * Construye una RegistryEntry desde un clip V3 nativo.
 * Equivalente a `_buildEntry` para el formato hephaestus/v2.1.
 */
function _buildEntryFromV3(
  clip: HephAutomationClipV3,
  options: RegisterOptions,
): RegistryEntry {
  const dna = clip.cognitiveDNA!
  const simMeta: SimulationMeta = clip.simulationMeta ?? DEFAULT_SIMULATION_META
  const ikCompat = dna.ikCompatibility ?? DEFAULT_IK_COMPATIBILITY

  const compatibleVibes = Object.freeze([...dna.compatibleVibes])
  const validSections = Object.freeze([...dna.validSections])
  const tags = Object.freeze([...clip.tags])

  const entry: RegistryEntry = {
    id: clip.id,
    name: clip.name,
    author: clip.author,
    category: clip.category,
    tags,
    durationMs: clip.durationMs,
    effectType: clip.effectType,

    filePath: options.filePath ?? null,
    dna: Object.freeze({
      aggression: dna.genome.aggression,
      chaos: dna.genome.chaos,
      organicity: dna.genome.organicity,
    }),
    archetype: dna.archetype,
    textureAffinity: dna.textureAffinity,
    compatibleVibes,
    validSections,
    energyZone: Object.freeze({ min: dna.energyZone.min, max: dna.energyZone.max }),
    aggressionRange: Object.freeze({
      min: dna.aggressionRange.min,
      max: dna.aggressionRange.max,
    }),
    pressureRange: Object.freeze({
      min: dna.pressureRange?.min ?? 0.5,
      max: dna.pressureRange?.max ?? 1.0,
    }),
    spatialBehavior: dna.spatialBehavior,
    ikCompatibility: Object.freeze({ ...ikCompat }),

    simMeta: Object.freeze({
      ...simMeta,
      beautyWeights: Object.freeze({ ...simMeta.beautyWeights }),
      zScoreGuards: Object.freeze({ ...simMeta.zScoreGuards }),
    }) as SimulationMeta,
    // V3 no declara executionHints → usar default
    execHints: Object.freeze({
      ..._DEFAULT_EXECUTION_HINTS,
      phaseConfig: Object.freeze({ ..._DEFAULT_EXECUTION_HINTS.phaseConfig }),
    }) as ExecutionHints,
    // V3 no declara safetyDeclaration → usar default
    safetyDecl: Object.freeze({ ...DEFAULT_SAFETY_DECLARATION }),

    // V3 siempre vector en esta fase (pixel domain reservado)
    executionDomain: dna.executionDomain ?? 'vector',
    pixelHints: null,

    isBuiltin: options.isBuiltin ?? false,
    loadedAt: Date.now(),
    source: null,

    organismId: options.organismId,
    trialsCount: options.trialsCount,
    organismStatus: options.organismStatus,
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

/**
 * 🪞 WAVE 7003: Resolves an effect ID (which may be a raw UUID for evolved
 * organisms) into a short, human-readable name for logging.
 *
 * Priority: entry.name → entry.organismId short tag → truncated ID.
 * Returns the raw effectId unchanged if the registry is unavailable.
 */
export function effectDisplayName(effectId: string): string {
  try {
    const entry = getDynamicEffectRegistry().getEntry(effectId)
    if (entry?.name) return entry.name
    if (entry?.organismId) {
      const short = entry.organismId.includes(':')
        ? entry.organismId.split(':')[1]?.substring(0, 8) ?? entry.organismId.substring(0, 8)
        : entry.organismId.substring(0, 8)
      return `${short}`
    }
  } catch {
    // Registry not initialized — fall through
  }
  // Truncate long UUIDs to first 8 chars for readability
  return effectId.length > 16 ? effectId.substring(0, 8) : effectId
}
