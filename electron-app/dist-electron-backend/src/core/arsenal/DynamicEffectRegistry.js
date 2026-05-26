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
import { DEFAULT_IK_COMPATIBILITY, DEFAULT_SAFETY_DECLARATION, DEFAULT_SIMULATION_META, hasCognitiveDNA, isSeleneEligible, } from './lfxTypes';
import { VIBE_ALIAS_MAP } from '../../engine/vibe/profiles/index';
// ─── REGISTRY ───────────────────────────────────────────────────────────────
/**
 * Singleton de efectos cognitivos cargados.
 *
 * NO es un singleton tipo módulo-global por defecto: exponemos clase + factory
 * para facilitar testing. Existe `getDynamicEffectRegistry()` al final.
 */
export class DynamicEffectRegistry {
    constructor() {
        // ── Índices primarios ────────────────────────────────────────────────────
        this._byId = new Map();
        this._byVibe = new Map();
        this._divineByVibe = new Map();
        this._heavyByVibe = new Map();
        /** Snapshot inmutable plano (refrescado solo en mutaciones). */
        this._allEntries = Object.freeze([]);
    }
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
    registerEffect(clip, options = {}) {
        if (!isSeleneEligible(clip)) {
            // Clip Hephaestus puro (v1, o v2 sin DNA) → invisible para Selene.
            // No es error, no es warning — es by-design.
            return null;
        }
        // Type narrow: hasCognitiveDNA garantiza presencia.
        if (!hasCognitiveDNA(clip))
            return null;
        const dna = clip.clip.cognitiveDNA;
        if (!_validateGenomeRanges(dna)) {
            console.warn(`[DynamicEffectRegistry ⚠️] G3 fail: genome out of range for "${clip.clip.id}"`);
            return null;
        }
        if (dna.compatibleVibes.length === 0) {
            console.warn(`[DynamicEffectRegistry ⚠️] G4 fail: empty compatibleVibes for "${clip.clip.id}"`);
            return null;
        }
        const entry = _buildEntry(clip, dna, options);
        // Reemplazo idempotente: si ya existía, removerlo de los índices antes.
        const prev = this._byId.get(entry.id);
        if (prev)
            this._removeFromIndices(prev);
        this._byId.set(entry.id, entry);
        this._appendToIndices(entry);
        this._rebuildAllEntries();
        return entry;
    }
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
    registerEffectV3(v3, options = {}) {
        const clip = v3.clip;
        if (!clip.cognitiveDNA) {
            // V3 sin DNA: clip Hephaestus puro — invisible para Selene por diseño.
            return null;
        }
        const dna = clip.cognitiveDNA;
        if (!_validateGenomeRanges(dna)) {
            console.warn(`[DynamicEffectRegistry ⚠️] V3 G3 fail: genome out of range for "${clip.id}"`);
            return null;
        }
        if (dna.compatibleVibes.length === 0) {
            console.warn(`[DynamicEffectRegistry ⚠️] V3 G4 fail: empty compatibleVibes for "${clip.id}"`);
            return null;
        }
        const entry = _buildEntryFromV3(clip, options);
        const prev = this._byId.get(entry.id);
        if (prev)
            this._removeFromIndices(prev);
        this._byId.set(entry.id, entry);
        this._appendToIndices(entry);
        this._rebuildAllEntries();
        return entry;
    }
    /**
     * Elimina un efecto del registry.
     * @returns true si existía.
     */
    unregisterEffect(effectId) {
        const prev = this._byId.get(effectId);
        if (!prev)
            return false;
        this._byId.delete(effectId);
        this._removeFromIndices(prev);
        this._rebuildAllEntries();
        return true;
    }
    /** Vacía completamente el registry. */
    clear() {
        this._byId.clear();
        this._byVibe.clear();
        this._divineByVibe.clear();
        this._heavyByVibe.clear();
        this._allEntries = DynamicEffectRegistry._EMPTY_ENTRIES;
    }
    // ─────────────────────────────────────────────────────────────────────────
    // LOOKUPS O(1) — zero-alloc
    // ─────────────────────────────────────────────────────────────────────────
    /** Retorna efectos pre-filtrados por vibe (referencia al array indexado). */
    getEffectsForVibe(vibe) {
        return this._byVibe.get(vibe) ?? DynamicEffectRegistry._EMPTY_ENTRIES;
    }
    /** Retorna arsenal DIVINE pre-indexado por vibe. */
    getDivineArsenal(vibe) {
        return this._divineByVibe.get(vibe) ?? DynamicEffectRegistry._EMPTY_ENTRIES;
    }
    /** Retorna arsenal HEAVY pre-indexado por vibe. */
    getHeavyArsenal(vibe) {
        return this._heavyByVibe.get(vibe) ?? DynamicEffectRegistry._EMPTY_ENTRIES;
    }
    /** Lookup por ID. */
    getEntry(effectId) {
        return this._byId.get(effectId);
    }
    /** Conveniencia: genoma plano. */
    getDNA(effectId) {
        return this._byId.get(effectId)?.dna;
    }
    /** Conveniencia: simulationMeta. */
    getSimMeta(effectId) {
        return this._byId.get(effectId)?.simMeta;
    }
    /** Conveniencia: executionHints. */
    getExecHints(effectId) {
        return this._byId.get(effectId)?.execHints;
    }
    /** Path al `.lfx` para carga lazy de curvas. */
    getEffectFilePath(effectId) {
        return this._byId.get(effectId)?.filePath;
    }
    /** ¿Existe este effectId en el registry como clip cognitivo? */
    has(effectId) {
        return this._byId.has(effectId);
    }
    /** Snapshot inmutable de TODAS las entries. */
    getAllEntries() {
        return this._allEntries;
    }
    getEntryCount() {
        return this._byId.size;
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
    getEffectCatalog() {
        return this._allEntries.map(e => ({
            id: e.id,
            name: e.name,
            energyZone: e.energyZone.max,
            compatibleVibes: [...e.compatibleVibes],
        }));
    }
    // ─────────────────────────────────────────────────────────────────────────
    // INTERNALS — INDEX MAINTENANCE
    // ─────────────────────────────────────────────────────────────────────────
    _appendToIndices(entry) {
        // 🎯 WAVE 4865: Deduplicar por canonical vibe.
        // Un efecto puede declarar ['latin', 'fiesta-latina'] — ambos mapean al mismo canonical.
        // Sin este Set, el entry se insertaría DOS VECES en el mismo bucket → candidatos clonados.
        const seenCanonicalVibes = new Set();
        for (const rawVibe of entry.compatibleVibes) {
            // Normalizar alias legacy → slug canónico del sistema (ej: 'latin' → 'fiesta-latina')
            const vibe = VIBE_ALIAS_MAP[rawVibe] ?? rawVibe;
            // Saltar si ya procesamos este canonical vibe para este entry
            if (seenCanonicalVibes.has(vibe))
                continue;
            seenCanonicalVibes.add(vibe);
            let bucket = this._byVibe.get(vibe);
            if (!bucket) {
                bucket = [];
                this._byVibe.set(vibe, bucket);
            }
            bucket.push(entry);
            if (entry.simMeta.isDivineCandidate) {
                let dBucket = this._divineByVibe.get(vibe);
                if (!dBucket) {
                    dBucket = [];
                    this._divineByVibe.set(vibe, dBucket);
                }
                dBucket.push(entry);
            }
            if (entry.simMeta.isHeavyCandidate) {
                let hBucket = this._heavyByVibe.get(vibe);
                if (!hBucket) {
                    hBucket = [];
                    this._heavyByVibe.set(vibe, hBucket);
                }
                hBucket.push(entry);
            }
        }
    }
    _removeFromIndices(entry) {
        for (const rawVibe of entry.compatibleVibes) {
            const vibe = VIBE_ALIAS_MAP[rawVibe] ?? rawVibe;
            _spliceFrom(this._byVibe.get(vibe), entry);
            _spliceFrom(this._divineByVibe.get(vibe), entry);
            _spliceFrom(this._heavyByVibe.get(vibe), entry);
        }
    }
    _rebuildAllEntries() {
        const next = [];
        for (const e of this._byId.values())
            next.push(e);
        this._allEntries = Object.freeze(next);
    }
}
/** Vista vacía pre-congelada — devolverla en lookups miss evita alloc. */
DynamicEffectRegistry._EMPTY_ENTRIES = Object.freeze([]);
// ─── HELPERS PRIVADOS ───────────────────────────────────────────────────────
function _validateGenomeRanges(dna) {
    const g = dna.genome;
    if (!_in01(g.aggression) || !_in01(g.chaos) || !_in01(g.organicity))
        return false;
    if (!_in01(dna.aggressionRange.min) || !_in01(dna.aggressionRange.max))
        return false;
    if (dna.aggressionRange.min > dna.aggressionRange.max)
        return false;
    return true;
}
function _in01(n) {
    return Number.isFinite(n) && n >= 0 && n <= 1;
}
function _spliceFrom(arr, target) {
    if (!arr)
        return;
    const idx = arr.indexOf(target);
    if (idx >= 0)
        arr.splice(idx, 1);
}
/**
 * Construye una RegistryEntry desde un clip V3 nativo.
 * Equivalente a `_buildEntry` para el formato hephaestus/v2.1.
 */
function _buildEntryFromV3(clip, options) {
    const dna = clip.cognitiveDNA;
    const simMeta = clip.simulationMeta ?? DEFAULT_SIMULATION_META;
    const ikCompat = dna.ikCompatibility ?? DEFAULT_IK_COMPATIBILITY;
    const compatibleVibes = Object.freeze([...dna.compatibleVibes]);
    const validSections = Object.freeze([...dna.validSections]);
    const tags = Object.freeze([...clip.tags]);
    const entry = {
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
        }),
        // V3 no declara executionHints → usar default
        execHints: Object.freeze({
            ..._DEFAULT_EXECUTION_HINTS,
            phaseConfig: Object.freeze({ ..._DEFAULT_EXECUTION_HINTS.phaseConfig }),
        }),
        // V3 no declara safetyDeclaration → usar default
        safetyDecl: Object.freeze({ ...DEFAULT_SAFETY_DECLARATION }),
        // V3 siempre vector en esta fase (pixel domain reservado)
        executionDomain: dna.executionDomain ?? 'vector',
        pixelHints: null,
        isBuiltin: options.isBuiltin ?? false,
        loadedAt: Date.now(),
        source: null,
    };
    return Object.freeze(entry);
}
function _buildEntry(clip, dna, options) {
    const c = clip.clip;
    const simMeta = c.simulationMeta ?? DEFAULT_SIMULATION_META;
    const execHints = c.executionHints ?? _DEFAULT_EXECUTION_HINTS;
    const safetyDecl = c.safetyDeclaration ?? DEFAULT_SAFETY_DECLARATION;
    const ikCompat = dna.ikCompatibility ?? DEFAULT_IK_COMPATIBILITY;
    // Congelar arrays defensivamente para honrar `readonly` en runtime.
    const compatibleVibes = Object.freeze([...dna.compatibleVibes]);
    const validSections = Object.freeze([...dna.validSections]);
    const tags = Object.freeze([...c.tags]);
    const entry = {
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
        }),
        execHints: Object.freeze({
            ...execHints,
            phaseConfig: Object.freeze({ ...execHints.phaseConfig }),
        }),
        safetyDecl: Object.freeze({ ...safetyDecl }),
        // 🎨 WAVE 4812: Pixel mapping aliases (default 'vector' / null).
        executionDomain: dna.executionDomain ?? 'vector',
        pixelHints: dna.pixelHints != null
            ? Object.freeze({
                ...dna.pixelHints,
                preferredResolution: Object.freeze({ ...dna.pixelHints.preferredResolution }),
                hybridChannels: dna.pixelHints.hybridChannels != null
                    ? Object.freeze([...dna.pixelHints.hybridChannels])
                    : undefined,
            })
            : null,
        isBuiltin: options.isBuiltin ?? false,
        loadedAt: Date.now(),
        source: options.keepSource ? clip : null,
    };
    return Object.freeze(entry);
}
const _DEFAULT_EXECUTION_HINTS = Object.freeze({
    overlayMode: 'absolute',
    phaseConfig: Object.freeze({
        spread: 0,
        symmetry: 'linear',
        wings: 1,
        direction: 1,
    }),
    intensityScaling: 'proportional',
    fixtureTargeting: 'all',
});
// ─── SINGLETON ──────────────────────────────────────────────────────────────
let _instance = null;
/** Acceso al singleton compartido del proceso. */
export function getDynamicEffectRegistry() {
    if (_instance == null)
        _instance = new DynamicEffectRegistry();
    return _instance;
}
/** SOLO para tests: resetea el singleton. */
export function __resetDynamicEffectRegistryForTests() {
    _instance = null;
}
