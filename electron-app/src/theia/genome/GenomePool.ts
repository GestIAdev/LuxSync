/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧬 WAVE 8234 — INFINITE GENOME · Fase G2: Genome Pool (variantes core#seed)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Capa de pegamento sobre `GenomeExpander`: instancia átomos variante
 * `core#seed` (Infinite Genome §4.1/§4.5) en el `TheiaRegistry` y el pack
 * store del LiveDeck.
 *
 * Flujo:
 *   1. Resuelve el átomo core (`source.kind='shader'`) y parsea su meta.
 *   2. `expandGenome(meta, glsl, seed)` → genes + genomeId + ADN retroproyectado.
 *   3. Dedupe §4.5: si ese genomeId ya existe, devuelve el atomId previo —
 *      dos semillas que expresan el mismo fenotipo colapsan al mismo átomo.
 *   4. Registra el `ITheiaAtom` variante con su ADN REAL (retroproyectado) —
 *      Selene/Cassandra lo clasifican honestamente (§4.4) — y `source.genes`
 *      (el fenotipo efectivo que G1 ya transporta hasta el shader).
 *
 * Zero-alloc hot path: el spawn NO corre por frame — solo al crear variantes.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { getTheiaRegistry, type TheiaRegistry } from '../../core/theia/TheiaRegistry'
import { useTheiaPackStore } from '../../stores/useTheiaPackStore'
import { parseEuclidMeta, type EuclidMeta } from '../shader/ShaderAssembler'
import {
  crossoverGenome,
  expandGenome,
  type ExpandedPhenotype,
} from './GenomeExpander'
import type { ITheiaAtom, ITheiaPack } from '../../types/theiaTypes'

/** genomeId → atomId registrado (dedupe §4.5). Persiste por sesión. */
const _genomeIndex = new Map<string, string>()
/** atomId core → meta parseado (las fuentes son estáticas). */
const _metaCache = new Map<string, EuclidMeta>()

/** Átomo variante listo para registrar — puro, testeable sin stores. */
export function buildVariantAtom(
  core: ITheiaAtom,
  seed: number,
  phenotype: ExpandedPhenotype,
): ITheiaAtom {
  const s32 = seed >>> 0
  return {
    id: `${core.id}#${s32}`,
    packId: core.packId,
    // path virtual — el medio es GLSL embebido; el path lleva la identidad.
    filePath: `${core.filePath}#${s32}`,
    // §4.4 — ADN RETROPROYECTADO: el individuo declara lo que expresó.
    aggression: phenotype.dna.aggression,
    chaos: phenotype.dna.chaos,
    organicity: phenotype.dna.organicity,
    energyZone: { ...core.energyZone },
    validSections: [...core.validSections],
    trim: { ...core.trim },
    compatibleVibes: [...core.compatibleVibes],
    isDivineCandidate: core.isDivineCandidate,
    isHeavyCandidate: core.isHeavyCandidate,
    source: {
      kind: 'shader',
      glsl: core.source?.glsl,
      genes: { ...phenotype.genes }, // fenotipo efectivo → #define (G1)
    },
  }
}

export interface SpawnResult {
  /** atomId del individuo (existente si colapsó por genomeId). */
  atomId: string
  /** genomeId §4.5 — identidad del fenotipo. */
  genomeId: string
  /** true si se registró un átomo nuevo; false si colapsó en uno previo. */
  created: boolean
  /** Fenotipo expresado (genes + ADN retroproyectado). */
  phenotype: ExpandedPhenotype
}

/**
 * Instancia (o reutiliza) el átomo variante `coreAtomId#seed`.
 *
 * @param seed semilla u32; `0` = fenotipo canónico (devuelve el propio core).
 * @param registry inyectable para tests; por defecto el singleton.
 * @returns null si el core no existe o no es un shader-atom con genes.
 */
export function spawnGenomeVariant(
  coreAtomId: string,
  seed: number,
  registry: TheiaRegistry = getTheiaRegistry(),
): SpawnResult | null {
  const core = registry.getAtom(coreAtomId)
  const glsl = core?.source?.glsl
  if (!core || core.source?.kind !== 'shader' || !glsl) return null

  let meta = _metaCache.get(coreAtomId)
  if (!meta) {
    meta = parseEuclidMeta(glsl)
    _metaCache.set(coreAtomId, meta)
  }
  if (meta.genes.length === 0) return null // core no declara genes — nada que expandir

  const s32 = seed >>> 0
  const phenotype = expandGenome(meta, glsl, s32)
  if (s32 === 0) {
    // Fenotipo canónico: sin variante — el core ya ES ese individuo.
    return { atomId: core.id, genomeId: phenotype.genomeId, created: false, phenotype }
  }

  const known = _genomeIndex.get(phenotype.genomeId)
  if (known !== undefined && registry.getAtom(known)) {
    return { atomId: known, genomeId: phenotype.genomeId, created: false, phenotype }
  }

  const variant = buildVariantAtom(core, s32, phenotype)
  if (!registry.register(variant)) return null // rechazo estructural
  _genomeIndex.set(phenotype.genomeId, variant.id)

  // LiveDeck — el variante aparece junto a su core en el mismo pack.
  const store = useTheiaPackStore.getState()
  const pack = store.packs.get(core.packId)
  if (pack && !pack.atoms.some((a) => a.id === variant.id)) {
    const next: ITheiaPack = {
      ...pack,
      atoms: [...pack.atoms, variant],
      manifest: pack.manifest
        ? {
            ...pack.manifest,
            atomOrder: [...(pack.manifest.atomOrder ?? []), variant.id],
          }
        : pack.manifest,
    }
    store.upsertPack(next)
  }

  return {
    atomId: variant.id,
    genomeId: phenotype.genomeId,
    created: true,
    phenotype,
  }
}

/** Lookup inverso §4.5 — ¿qué átomo expresa este fenotipo? */
export function atomIdForGenome(genomeId: string): string | undefined {
  return _genomeIndex.get(genomeId)
}

/**
 * 🧬 WAVE 8235 · G3 — crossover §4.6: hijo de dos individuos del MISMO
 * core (genes homólogos). Los padres pueden ser el core (`core`), una
 * variante (`core#seed`) o cualquier fenotipo registrado — su fenotipo
 * efectivo vive en `atom.source.genes` (G1).
 *
 * @returns null si los padres no son del mismo core o el hijo ya existe.
 */
export function spawnCrossoverVariant(
  coreAtomId: string,
  parentAId: string,
  parentBId: string,
  seed: number,
  registry: TheiaRegistry = getTheiaRegistry(),
): SpawnResult | null {
  const core = registry.getAtom(coreAtomId)
  const glsl = core?.source?.glsl
  if (!core || core.source?.kind !== 'shader' || !glsl) return null

  const resolveGenes = (atomId: string): Record<string, number> | null => {
    const atom = registry.getAtom(atomId)
    if (!atom || atom.source?.kind !== 'shader') return null
    if (atom.source.genes) return atom.source.genes
    if (atomId === core.id) return null // core = canónico → defaults
    return null
  }
  // El fenotipo del core canónico son los defaults declarados.
  let meta = _metaCache.get(coreAtomId)
  if (!meta) {
    meta = parseEuclidMeta(glsl)
    _metaCache.set(coreAtomId, meta)
  }
  if (meta.genes.length === 0) return null

  const atomA = registry.getAtom(parentAId)
  const atomB = registry.getAtom(parentBId)
  if (!atomA || !atomB) return null
  // Homología §4.6: solo entre individuos del mismo core.
  if (
    (atomA.id !== core.id && !atomA.id.startsWith(`${core.id}#`)) ||
    (atomB.id !== core.id && !atomB.id.startsWith(`${core.id}#`))
  ) {
    return null
  }
  const defaults: Record<string, number> = {}
  for (const g of meta.genes) defaults[g.name] = g.defaultValue
  const genesA =
    resolveGenes(parentAId) ?? (parentAId === core.id ? defaults : null)
  const genesB =
    resolveGenes(parentBId) ?? (parentBId === core.id ? defaults : null)
  if (!genesA || !genesB) return null

  const s32 = seed >>> 0
  const phenotype = crossoverGenome(meta, glsl, genesA, genesB, s32)

  const known = _genomeIndex.get(phenotype.genomeId)
  if (known !== undefined && registry.getAtom(known)) {
    return { atomId: known, genomeId: phenotype.genomeId, created: false, phenotype }
  }

  const variant = buildVariantAtom(core, s32, phenotype)
  if (!registry.register(variant)) return null
  _genomeIndex.set(phenotype.genomeId, variant.id)

  const store = useTheiaPackStore.getState()
  const pack = store.packs.get(core.packId)
  if (pack && !pack.atoms.some((a) => a.id === variant.id)) {
    const next: ITheiaPack = {
      ...pack,
      atoms: [...pack.atoms, variant],
      manifest: pack.manifest
        ? {
            ...pack.manifest,
            atomOrder: [...(pack.manifest.atomOrder ?? []), variant.id],
          }
        : pack.manifest,
    }
    store.upsertPack(next)
  }

  return {
    atomId: variant.id,
    genomeId: phenotype.genomeId,
    created: true,
    phenotype,
  }
}

/** Test hook — vacía índices de dedupe y caché de metas. */
export function resetGenomePool(): void {
  _genomeIndex.clear()
  _metaCache.clear()
}
