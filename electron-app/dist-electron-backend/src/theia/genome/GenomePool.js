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
import { getTheiaRegistry } from '../../core/theia/TheiaRegistry';
import { useTheiaPackStore } from '../../stores/useTheiaPackStore';
import { parseEuclidMeta } from '../shader/ShaderAssembler';
import { crossoverGenome, expandGenome, pcg32, } from './GenomeExpander';
/** genomeId → atomId registrado (dedupe §4.5). Persiste por sesión. */
const _genomeIndex = new Map();
/** atomId core → meta parseado (las fuentes son estáticas). */
const _metaCache = new Map();
/** Átomo variante listo para registrar — puro, testeable sin stores. */
export function buildVariantAtom(core, seed, phenotype) {
    const s32 = seed >>> 0;
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
    };
}
/**
 * Instancia (o reutiliza) el átomo variante `coreAtomId#seed`.
 *
 * @param seed semilla u32; `0` = fenotipo canónico (devuelve el propio core).
 * @param registry inyectable para tests; por defecto el singleton.
 * @param protectedId individuo a proteger de la extinción §4.6 (el activo).
 * @returns null si el core no existe o no es un shader-atom con genes.
 */
export function spawnGenomeVariant(coreAtomId, seed, registry = getTheiaRegistry(), protectedId) {
    const core = registry.getAtom(coreAtomId);
    const glsl = core?.source?.glsl;
    if (!core || core.source?.kind !== 'shader' || !glsl)
        return null;
    let meta = _metaCache.get(coreAtomId);
    if (!meta) {
        meta = parseEuclidMeta(glsl);
        _metaCache.set(coreAtomId, meta);
    }
    if (meta.genes.length === 0)
        return null; // core no declara genes — nada que expandir
    const s32 = seed >>> 0;
    const phenotype = expandGenome(meta, glsl, s32);
    if (s32 === 0) {
        // Fenotipo canónico: sin variante — el core ya ES ese individuo.
        _recordIndividual(core.id, core.id);
        return { atomId: core.id, genomeId: phenotype.genomeId, created: false, phenotype };
    }
    const known = _genomeIndex.get(phenotype.genomeId);
    if (known !== undefined && registry.getAtom(known)) {
        _recordIndividual(core.id, known);
        return { atomId: known, genomeId: phenotype.genomeId, created: false, phenotype };
    }
    const variant = buildVariantAtom(core, s32, phenotype);
    if (!registry.register(variant))
        return null; // rechazo estructural
    _genomeIndex.set(phenotype.genomeId, variant.id);
    _genomeOfAtom.set(variant.id, phenotype.genomeId);
    _recordIndividual(core.id, variant.id);
    // LiveDeck — el variante aparece junto a su core en el mismo pack.
    const store = useTheiaPackStore.getState();
    const pack = store.packs.get(core.packId);
    if (pack && !pack.atoms.some((a) => a.id === variant.id)) {
        const next = {
            ...pack,
            atoms: [...pack.atoms, variant],
            manifest: pack.manifest
                ? {
                    ...pack.manifest,
                    atomOrder: [...(pack.manifest.atomOrder ?? []), variant.id],
                }
                : pack.manifest,
        };
        store.upsertPack(next);
    }
    // §4.6 — el recién nacido entra protegido; los peores se extinguen.
    const keep = new Set([variant.id]);
    if (protectedId)
        keep.add(protectedId);
    _enforcePopulationLimit(core.id, keep, registry);
    return {
        atomId: variant.id,
        genomeId: phenotype.genomeId,
        created: true,
        phenotype,
    };
}
// ─────────── Población viva + Fitness (§4.6 — WAVE 8236 · G4) ───────────
/** Máximo de individuos vivos por core — paridad con la LRU del worker. */
export const GENOME_POPULATION_MAX = 8;
/** Tamaño del torneo (§4.6: torneo de 3). */
export const GENOME_TOURNAMENT_SIZE = 3;
/** EMA del fitness: `F ← 0.9·F + 0.1·score`. */
export const FITNESS_EMA_ALPHA = 0.9;
/** Pesos del score: belleza Selene, favorito y skip del operador. */
export const FITNESS_W_BEAUTY = 1.0;
export const FITNESS_W_FAV = 1.0;
export const FITNESS_W_SKIP = 1.0;
/** atomId → fitness. */
const _fitness = new Map();
/** coreId → atomIds vivos (core incluido). */
const _populations = new Map();
/** atomId → genomeId (para poder retirar la entrada de `_genomeIndex`). */
const _genomeOfAtom = new Map();
function _freshRecord() {
    return { F: 0, beautySum: 0, beautyN: 0, fav: 0, skip: 0 };
}
/** Registra un individuo en la población de su core (idempotente). */
function _recordIndividual(coreId, atomId) {
    let pop = _populations.get(coreId);
    if (!pop) {
        pop = new Set();
        _populations.set(coreId, pop);
    }
    if (!pop.has(coreId)) {
        pop.add(coreId);
        _fitness.set(coreId, _fitness.get(coreId) ?? _freshRecord());
    }
    pop.add(atomId);
    if (!_fitness.has(atomId))
        _fitness.set(atomId, _freshRecord());
}
/**
 * §4.6 — observación continua: el `u_beauty` que Selene mide mientras el
 * individuo está en pantalla. Se acumula en la ventana y se consume en el
 * siguiente `stepFitness` (frontera de frase).
 */
export function trackBeauty(atomId, beauty) {
    if (!Number.isFinite(beauty))
        return;
    // Auto-adscripción: un átomo cargado sin pasar por el pool se une a la
    // población de su prefijo core (`core#seed` → `core`; sin '#' → self).
    const rec = _ensureRecord(atomId);
    rec.beautySum += beauty;
    rec.beautyN++;
}
/** Asegura record + adscripción a población (sin observación de belleza). */
function _ensureRecord(atomId) {
    let rec = _fitness.get(atomId);
    if (!rec) {
        rec = _freshRecord();
        _fitness.set(atomId, rec);
        const hashIdx = atomId.lastIndexOf('#');
        _recordIndividual(hashIdx >= 0 ? atomId.slice(0, hashIdx) : atomId, atomId);
    }
    return rec;
}
/** §4.6 — impulso del operador: FAVORITO (LiveDeck). */
export function favoriteAtom(atomId) {
    _ensureRecord(atomId).fav++;
}
/** §4.6 — impulso del operador: SKIP (LiveDeck). */
export function skipAtom(atomId) {
    _ensureRecord(atomId).skip++;
}
/** Fitness EMA actual de un individuo (0 = sin evaluar todavía). */
export function getFitness(atomId) {
    return _fitness.get(atomId)?.F ?? 0;
}
/** Individuos vivos del core (core incluido) — orden de incorporación. */
export function getPopulation(coreId) {
    const pop = _populations.get(coreId);
    return pop ? [...pop] : [];
}
/**
 * §4.6 — paso de la EMA del fitness:
 *   `F ← 0.9·F + 0.1·(w_b·ū_beauty + w_f·fav − w_s·skip)`
 * donde `ū_beauty` es la media de la ventana (solo si hubo observaciones)
 * y `fav`/`skip` son impulsos pendientes del operador. Sin señal en la
 * ventana → sin paso (un individuo no observado no decae a la deriva).
 */
export function stepFitness(atomId) {
    const rec = _fitness.get(atomId);
    if (!rec)
        return;
    if (rec.beautyN === 0 && rec.fav === 0 && rec.skip === 0)
        return;
    const mean = rec.beautyN > 0 ? rec.beautySum / rec.beautyN : 0;
    const score = (rec.beautyN > 0 ? FITNESS_W_BEAUTY * mean : 0) +
        FITNESS_W_FAV * rec.fav -
        FITNESS_W_SKIP * rec.skip;
    rec.F = FITNESS_EMA_ALPHA * rec.F + (1 - FITNESS_EMA_ALPHA) * score;
    rec.beautySum = 0;
    rec.beautyN = 0;
    rec.fav = 0;
    rec.skip = 0;
}
/** Consume las ventanas de TODOS los individuos del core (frontera §4.6). */
export function stepFitnessAll(coreId) {
    const pop = _populations.get(coreId);
    if (!pop)
        return;
    for (const id of pop)
        stepFitness(id);
}
/**
 * §4.6 — extinción: el individuo sale de la población viva, del índice de
 * dedupe, del registry y del pack (LiveDeck). Protegidos: el propio core
 * (la especie raíz) y los atomIds en `protectedIds` (activo en pantalla,
 * hijo recién nacido).
 */
function _extinguish(coreId, atomId, protectedIds, registry) {
    if (atomId === coreId || protectedIds.has(atomId))
        return false;
    const pop = _populations.get(coreId);
    if (!pop?.delete(atomId))
        return false;
    _fitness.delete(atomId);
    const genomeId = _genomeOfAtom.get(atomId);
    if (genomeId) {
        if (_genomeIndex.get(genomeId) === atomId)
            _genomeIndex.delete(genomeId);
        _genomeOfAtom.delete(atomId);
    }
    registry.unregister(atomId);
    // LiveDeck — sale del pack de su core.
    const core = registry.getAtom(coreId);
    const store = useTheiaPackStore.getState();
    const pack = core ? store.packs.get(core.packId) : undefined;
    if (pack && pack.atoms.some((a) => a.id === atomId)) {
        const next = {
            ...pack,
            atoms: pack.atoms.filter((a) => a.id !== atomId),
            manifest: pack.manifest
                ? {
                    ...pack.manifest,
                    atomOrder: (pack.manifest.atomOrder ?? []).filter((id) => id !== atomId),
                }
                : pack.manifest,
        };
        store.upsertPack(next);
    }
    return true;
}
/**
 * §4.6 — cota de población: mientras supere `GENOME_POPULATION_MAX`,
 * extingue el individuo de MENOR fitness no protegido. Los empatados se
 * purgan por antigüedad (orden del Set = orden de incorporación).
 */
function _enforcePopulationLimit(coreId, protectedIds, registry) {
    const pop = _populations.get(coreId);
    if (!pop)
        return;
    while (pop.size > GENOME_POPULATION_MAX) {
        let worstId = '';
        let worstF = Infinity;
        for (const id of pop) {
            if (id === coreId || protectedIds.has(id))
                continue;
            const f = _fitness.get(id)?.F ?? 0;
            if (f < worstF) {
                worstF = f;
                worstId = id;
            }
        }
        if (worstId === '' || !_extinguish(coreId, worstId, protectedIds, registry))
            break;
    }
}
/**
 * §4.6 — BUCLE DE DARWIN en frontera de frase:
 *   1. `stepFitnessAll` consume las ventanas (belleza + eventos operador).
 *   2. Torneo de `GENOME_TOURNAMENT_SIZE` individuos (muestra determinista
 *      por `seed`): los dos mejores del torneo se reproducen por
 *      `spawnCrossoverVariant`; con población < 2 el individuo muta
 *      (`spawnGenomeVariant`).
 *   3. Extinción: la población queda acotada a `GENOME_POPULATION_MAX`
 *      purgando a los peores (nunca el core, el activo ni el hijo nuevo).
 *
 * @returns el hijo resultante (o el individuo preexistente si el fenotipo
 *          colapsó por genomeId — revivir al mejor conocido también cuenta).
 */
export function darwinTournament(coreId, seed, protectedId, registry = getTheiaRegistry()) {
    const core = registry.getAtom(coreId);
    const glsl = core?.source?.glsl;
    if (!core || core.source?.kind !== 'shader' || !glsl)
        return null;
    let meta = _metaCache.get(coreId);
    if (!meta) {
        meta = parseEuclidMeta(glsl);
        _metaCache.set(coreId, meta);
    }
    if (meta.genes.length === 0)
        return null;
    const s32 = seed >>> 0;
    // La ventana de la frase se cierra aquí — el torneo ve el F más fresco.
    stepFitnessAll(coreId);
    const pop = _populations.get(coreId) ?? new Set([coreId]);
    const members = [...pop];
    let result = null;
    if (members.length >= 2) {
        // Torneo de 3 (o todos si la población es menor) — muestreo sin
        // reemplazo determinista por PCG(seed ⊕ lane).
        const k = Math.min(GENOME_TOURNAMENT_SIZE, members.length);
        const sample = [];
        for (let i = 0; i < k; i++) {
            let idx = pcg32((s32 ^ i) >>> 0) % members.length;
            let guard = 0;
            while (sample.includes(members[idx]) && guard++ < members.length) {
                idx = (idx + 1) % members.length;
            }
            if (!sample.includes(members[idx]))
                sample.push(members[idx]);
        }
        sample.sort((a, b) => getFitness(b) - getFitness(a));
        const [pA, pB] = sample;
        result =
            pA && pB && pA !== pB
                ? spawnCrossoverVariant(coreId, pA, pB, s32, registry, protectedId)
                : spawnGenomeVariant(coreId, s32, registry, protectedId);
    }
    else {
        // Población insuficiente para torneo → mutación directa (path G3).
        result = spawnGenomeVariant(coreId, s32, registry, protectedId);
    }
    // §4.6 — los peores se extinguen: la población nunca supera 8.
    const keep = new Set([coreId]);
    if (protectedId)
        keep.add(protectedId);
    if (result)
        keep.add(result.atomId);
    _enforcePopulationLimit(coreId, keep, registry);
    return result;
}
/** Lookup inverso §4.5 — ¿qué átomo expresa este fenotipo? */
export function atomIdForGenome(genomeId) {
    return _genomeIndex.get(genomeId);
}
/**
 * 🧬 WAVE 8235 · G3 — crossover §4.6: hijo de dos individuos del MISMO
 * core (genes homólogos). Los padres pueden ser el core (`core`), una
 * variante (`core#seed`) o cualquier fenotipo registrado — su fenotipo
 * efectivo vive en `atom.source.genes` (G1).
 *
 * @returns null si los padres no son del mismo core o el hijo ya existe.
 */
export function spawnCrossoverVariant(coreAtomId, parentAId, parentBId, seed, registry = getTheiaRegistry(), protectedId) {
    const core = registry.getAtom(coreAtomId);
    const glsl = core?.source?.glsl;
    if (!core || core.source?.kind !== 'shader' || !glsl)
        return null;
    const resolveGenes = (atomId) => {
        const atom = registry.getAtom(atomId);
        if (!atom || atom.source?.kind !== 'shader')
            return null;
        if (atom.source.genes)
            return atom.source.genes;
        if (atomId === core.id)
            return null; // core = canónico → defaults
        return null;
    };
    // El fenotipo del core canónico son los defaults declarados.
    let meta = _metaCache.get(coreAtomId);
    if (!meta) {
        meta = parseEuclidMeta(glsl);
        _metaCache.set(coreAtomId, meta);
    }
    if (meta.genes.length === 0)
        return null;
    const atomA = registry.getAtom(parentAId);
    const atomB = registry.getAtom(parentBId);
    if (!atomA || !atomB)
        return null;
    // Homología §4.6: solo entre individuos del mismo core.
    if ((atomA.id !== core.id && !atomA.id.startsWith(`${core.id}#`)) ||
        (atomB.id !== core.id && !atomB.id.startsWith(`${core.id}#`))) {
        return null;
    }
    const defaults = {};
    for (const g of meta.genes)
        defaults[g.name] = g.defaultValue;
    const genesA = resolveGenes(parentAId) ?? (parentAId === core.id ? defaults : null);
    const genesB = resolveGenes(parentBId) ?? (parentBId === core.id ? defaults : null);
    if (!genesA || !genesB)
        return null;
    const s32 = seed >>> 0;
    const phenotype = crossoverGenome(meta, glsl, genesA, genesB, s32);
    const known = _genomeIndex.get(phenotype.genomeId);
    if (known !== undefined && registry.getAtom(known)) {
        _recordIndividual(core.id, known);
        return { atomId: known, genomeId: phenotype.genomeId, created: false, phenotype };
    }
    const variant = buildVariantAtom(core, s32, phenotype);
    if (!registry.register(variant))
        return null;
    _genomeIndex.set(phenotype.genomeId, variant.id);
    _genomeOfAtom.set(variant.id, phenotype.genomeId);
    _recordIndividual(core.id, variant.id);
    const store = useTheiaPackStore.getState();
    const pack = store.packs.get(core.packId);
    if (pack && !pack.atoms.some((a) => a.id === variant.id)) {
        const next = {
            ...pack,
            atoms: [...pack.atoms, variant],
            manifest: pack.manifest
                ? {
                    ...pack.manifest,
                    atomOrder: [...(pack.manifest.atomOrder ?? []), variant.id],
                }
                : pack.manifest,
        };
        store.upsertPack(next);
    }
    // §4.6 — cota de población: los peores se extinguen (hijo y activo a salvo).
    const keep = new Set([variant.id]);
    if (protectedId)
        keep.add(protectedId);
    _enforcePopulationLimit(core.id, keep, registry);
    return {
        atomId: variant.id,
        genomeId: phenotype.genomeId,
        created: true,
        phenotype,
    };
}
/** Test hook — vacía índices de dedupe, caché de metas, fitness y poblaciones. */
export function resetGenomePool() {
    _genomeIndex.clear();
    _metaCache.clear();
    _fitness.clear();
    _populations.clear();
    _genomeOfAtom.clear();
}
