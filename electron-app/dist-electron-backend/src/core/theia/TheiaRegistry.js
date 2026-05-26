/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🎬 THEIA REGISTRY — WAVE 4901 (Phase 1/3 of WAVE-4900-THEIADNA)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Singleton del Main Process que indexa los `ITheiaAsset` cargados y resuelve
 * el matching cognitivo entre el `targetDNA` que pide Selene y el cuepoint
 * de vídeo más cercano en el espacio 3D del genoma.
 *
 * PARALELO ARQUITECTÓNICO:
 *   `core/arsenal/DynamicEffectRegistry` ↔  `core/theia/TheiaRegistry`
 *
 *   Ambos exponen lookup O(1) por vibe, gates de validación al registrar y
 *   un snapshot inmutable para consumidores. La diferencia: este registry
 *   opera sobre cuepoints temporales en vez de tracks/curves.
 *
 * COSTE COMPUTACIONAL (ver §3.2 del blueprint WAVE-4900):
 *   - register / unregister: O(V) — V = compatibleVibes del asset.
 *   - findBestMatch:          O(N × M) — N = assets del vibe, M = cuepoints/asset.
 *                             Típicamente 10 × 4 = 40 distancias 3D + sort.
 *                             ≈ 0.05 ms en V8 moderno → invisible al hot-path.
 *
 * OPTIMIZACIÓN MATEMÁTICA:
 *   La distancia euclidiana se compara internamente como **distancia² (sin sqrt)**
 *   porque (sqrt es monotónico): argmin(d) = argmin(d²). El sqrt solo se aplica
 *   al ganador para reportar el valor real al consumer.
 * ════════════════════════════════════════════════════════════════════════════
 */
import { ENERGY_ZONE_ORDINAL, isValidGenome } from '../../types/theiaTypes';
// ─── ESCALA Y CONSTANTES ─────────────────────────────────────────────────────
/**
 * Distancia 3D máxima posible entre dos puntos del cubo unitario [0,1]³.
 * Usada para normalizar `distance → score ∈ [0, 1]`.
 */
const MAX_DISTANCE_3D = Math.sqrt(3);
/** Snapshot vacío pre-congelado — devolverlo en lookups miss evita alloc. */
const EMPTY_ASSETS = Object.freeze([]);
// ─── REGISTRY ────────────────────────────────────────────────────────────────
/**
 * Singleton de assets `.theia` cargados.
 *
 * NO es un singleton tipo módulo-global por construcción: exponemos clase +
 * factory para facilitar testing. La instancia compartida vive en
 * `getTheiaRegistry()` al final del archivo.
 */
export class TheiaRegistry {
    constructor() {
        // ── Índices primarios ──────────────────────────────────────────────────
        this._byId = new Map();
        this._byVibe = new Map();
        /** Snapshot inmutable plano (refrescado solo en mutaciones). */
        this._allAssets = EMPTY_ASSETS;
    }
    // ─────────────────────────────────────────────────────────────────────────
    // INGESTA / MUTACIÓN
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Registra un asset `.theia` ya validado en el registry.
     *
     * Validaciones mínimas (gates ESTRUCTURALES — los gates de archivo G1..G7
     * corren ANTES en `TheiaFileLoader`):
     *   - `id` no vacío y único
     *   - `globalDNA` con valores ∈ [0, 1]
     *   - `compatibleVibes.length > 0`
     *   - `cuePoints.length > 0` y cada uno con `dna` válido
     *
     * @returns el asset congelado si fue aceptado, o `null` si fue rechazado.
     */
    register(asset) {
        if (!this._validateStructure(asset))
            return null;
        // Reemplazo idempotente: si ya existía, removerlo de los índices antes.
        const prev = this._byId.get(asset.id);
        if (prev)
            this._removeFromIndices(prev);
        const frozen = this._freezeAsset(asset);
        this._byId.set(frozen.id, frozen);
        this._appendToIndices(frozen);
        this._rebuildAllAssets();
        return frozen;
    }
    /**
     * Elimina un asset del registry.
     * @returns true si existía.
     */
    unregister(assetId) {
        const prev = this._byId.get(assetId);
        if (!prev)
            return false;
        this._byId.delete(assetId);
        this._removeFromIndices(prev);
        this._rebuildAllAssets();
        return true;
    }
    /** Vacía completamente el registry. */
    clear() {
        this._byId.clear();
        this._byVibe.clear();
        this._allAssets = EMPTY_ASSETS;
    }
    // ─────────────────────────────────────────────────────────────────────────
    // LOOKUPS O(1)
    // ─────────────────────────────────────────────────────────────────────────
    getAsset(assetId) {
        return this._byId.get(assetId);
    }
    has(assetId) {
        return this._byId.has(assetId);
    }
    /** Assets pre-filtrados por vibe (referencia al array indexado). */
    getAssetsForVibe(vibe) {
        return this._byVibe.get(vibe) ?? EMPTY_ASSETS;
    }
    /** Snapshot inmutable de TODOS los assets registrados. */
    getAllAssets() {
        return this._allAssets;
    }
    getAssetCount() {
        return this._byId.size;
    }
    // ─────────────────────────────────────────────────────────────────────────
    // CORE — MATCHING COGNITIVO 3D
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Encuentra el cuepoint cuyo ADN minimiza la distancia euclidiana 3D al
     * `targetDNA` solicitado por Selene.
     *
     * Pipeline:
     *   1. Filtrar assets por `vibe` (lookup O(1)).
     *   2. Iterar cuepoints; descartar los cuya `energyZone` no incluya `currentZone`.
     *   3. Calcular distancia² entre `targetDNA` y `cuepoint.dna`.
     *   4. Memorizar el mínimo (sin sort — single pass O(N×M)).
     *   5. Aplicar sqrt solo al ganador y normalizar `score ∈ [0, 1]`.
     *
     * @param targetDNA  ADN deseado por Selene (`DNAAnalyzer.deriveTargetDNA`).
     * @param currentZone Zona energética actual (de `EnergyConsciousness`).
     * @param vibe        Vibe musical actual (de `VibeProfile`).
     * @returns El match más cercano, o `null` si no hay cuepoints elegibles.
     */
    findBestMatch(targetDNA, currentZone, vibe) {
        if (!isValidGenome(targetDNA))
            return null;
        const assets = this._byVibe.get(vibe);
        if (!assets || assets.length === 0)
            return null;
        const tA = targetDNA.aggression;
        const tC = targetDNA.chaos;
        const tO = targetDNA.organicity;
        const zoneOrd = ENERGY_ZONE_ORDINAL[currentZone];
        // Acumuladores zero-alloc del mínimo encontrado.
        let bestDistSq = Infinity;
        let bestAssetId = '';
        let bestCueId = '';
        // Single-pass O(N×M). Sin sort. Sin allocs intermedios.
        for (let i = 0; i < assets.length; i++) {
            const asset = assets[i];
            const cps = asset.cuePoints;
            for (let j = 0; j < cps.length; j++) {
                const cp = cps[j];
                // Filtro hard: la zona actual debe estar dentro del rango del cuepoint.
                if (!_zoneInRange(zoneOrd, cp.energyZone))
                    continue;
                const dA = tA - cp.dna.aggression;
                const dC = tC - cp.dna.chaos;
                const dO = tO - cp.dna.organicity;
                const distSq = dA * dA + dC * dC + dO * dO;
                if (distSq < bestDistSq) {
                    bestDistSq = distSq;
                    bestAssetId = asset.id;
                    bestCueId = cp.id;
                }
            }
        }
        if (bestDistSq === Infinity)
            return null;
        const distance = Math.sqrt(bestDistSq);
        const score = 1 - distance / MAX_DISTANCE_3D;
        return {
            assetId: bestAssetId,
            cuePointId: bestCueId,
            distance,
            score,
        };
    }
    // ─────────────────────────────────────────────────────────────────────────
    // INTERNALS
    // ─────────────────────────────────────────────────────────────────────────
    _validateStructure(asset) {
        if (!asset || typeof asset !== 'object')
            return false;
        if (typeof asset.id !== 'string' || asset.id.length === 0)
            return false;
        if (typeof asset.filePath !== 'string' || asset.filePath.length === 0)
            return false;
        if (!isValidGenome(asset.globalDNA))
            return false;
        if (!_isReadonlyArray(asset.compatibleVibes) || asset.compatibleVibes.length === 0)
            return false;
        if (!_isReadonlyArray(asset.cuePoints) || asset.cuePoints.length === 0)
            return false;
        for (const cp of asset.cuePoints) {
            if (!cp || typeof cp.id !== 'string' || cp.id.length === 0)
                return false;
            if (typeof cp.startMs !== 'number' || !Number.isFinite(cp.startMs) || cp.startMs < 0)
                return false;
            if (typeof cp.endMs !== 'number' || !Number.isFinite(cp.endMs) || cp.endMs <= cp.startMs)
                return false;
            if (!isValidGenome(cp.dna))
                return false;
            if (!cp.energyZone)
                return false;
            if (!_isEnergyZone(cp.energyZone.min))
                return false;
            if (!_isEnergyZone(cp.energyZone.max))
                return false;
            if (ENERGY_ZONE_ORDINAL[cp.energyZone.min] > ENERGY_ZONE_ORDINAL[cp.energyZone.max])
                return false;
            if (!Array.isArray(cp.validSections))
                return false;
        }
        return true;
    }
    _freezeAsset(asset) {
        const frozenCps = asset.cuePoints.map(cp => Object.freeze({
            ...cp,
            dna: Object.freeze({ ...cp.dna }),
            energyZone: Object.freeze({ ...cp.energyZone }),
            validSections: Object.freeze([...cp.validSections]),
            preferredVibes: cp.preferredVibes
                ? Object.freeze([...cp.preferredVibes])
                : undefined,
        }));
        return Object.freeze({
            id: asset.id,
            filePath: asset.filePath,
            globalDNA: Object.freeze({ ...asset.globalDNA }),
            compatibleVibes: Object.freeze([...asset.compatibleVibes]),
            cuePoints: Object.freeze(frozenCps),
        });
    }
    _appendToIndices(asset) {
        const seen = new Set();
        for (const vibe of asset.compatibleVibes) {
            if (seen.has(vibe))
                continue;
            seen.add(vibe);
            let bucket = this._byVibe.get(vibe);
            if (!bucket) {
                bucket = [];
                this._byVibe.set(vibe, bucket);
            }
            bucket.push(asset);
        }
    }
    _removeFromIndices(asset) {
        for (const vibe of asset.compatibleVibes) {
            const bucket = this._byVibe.get(vibe);
            if (!bucket)
                continue;
            const idx = bucket.indexOf(asset);
            if (idx >= 0)
                bucket.splice(idx, 1);
            if (bucket.length === 0)
                this._byVibe.delete(vibe);
        }
    }
    _rebuildAllAssets() {
        const next = [];
        for (const a of this._byId.values())
            next.push(a);
        this._allAssets = Object.freeze(next);
    }
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
function _isReadonlyArray(v) {
    return v != null && typeof v.length === 'number';
}
function _isEnergyZone(v) {
    return typeof v === 'string' && Object.prototype.hasOwnProperty.call(ENERGY_ZONE_ORDINAL, v);
}
function _zoneInRange(zoneOrd, range) {
    const minOrd = ENERGY_ZONE_ORDINAL[range.min];
    const maxOrd = ENERGY_ZONE_ORDINAL[range.max];
    return zoneOrd >= minOrd && zoneOrd <= maxOrd;
}
// ─── SINGLETON ───────────────────────────────────────────────────────────────
let _instance = null;
/**
 * Obtiene la instancia compartida del `TheiaRegistry`.
 *
 * Para tests: importar la clase directamente y construirla con `new`.
 */
export function getTheiaRegistry() {
    if (!_instance)
        _instance = new TheiaRegistry();
    return _instance;
}
/** Reset destructivo del singleton — solo tests. */
export function __resetTheiaRegistryForTests() {
    _instance = null;
}
