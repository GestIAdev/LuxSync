/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🎬 THEIA FILE LOADER — WAVE 4921 (Atomic Paradigm · Fase 2)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Parser + validador de archivos `.theia v2.0` (atómicos).
 * Inyecta los átomos aceptados en el `TheiaRegistry` singleton.
 *
 * GATES (paralelos en filosofía a los de `LfxFileLoader`):
 *   A1 — Schema base: `$schema === 'luxsync.theia/2.0'` + bloque `atom` válido.
 *   A2 — Trim: `trim.endMs > trim.startMs + 250`.
 *   A3 — Genoma: `aggression/chaos/organicity` ∈ [0, 1].
 *   A4 — EnergyZone: `min ≤ max`, ambos strings válidos.
 *   A5 — `compatibleVibes.length > 0`.
 *
 * Permite formato legacy de campos planos (sin envoltura `{ $schema, atom }`)
 * para draft-to-disk sin fricción.
 *
 * Las rejections logean `[TheiaFileLoader ⚠️]` + razón. Nunca lanzan.
 * ════════════════════════════════════════════════════════════════════════════
 */
import { ENERGY_ZONE_ORDINAL } from '../../types/theiaTypes';
const MIN_TRIM_DURATION_MS = 250;
// ─── LOADER ──────────────────────────────────────────────────────────────────
export class TheiaFileLoader {
    constructor(_registry) {
        this._registry = _registry;
    }
    /**
     * Parsea + valida un payload `.theia` atómico y, si es aceptado, lo registra.
     *
     * Acepta tanto string JSON como objeto ya parseado (útil en tests).
     */
    load(rawOrParsed, opts = {}) {
        // ── Parse ────────────────────────────────────────────────────────────
        let parsed;
        if (typeof rawOrParsed === 'string') {
            try {
                parsed = JSON.parse(rawOrParsed);
            }
            catch (err) {
                return _fail('JSON parse error: ' + err.message, opts.filePath);
            }
        }
        else {
            parsed = rawOrParsed;
        }
        // ── A1 — Schema + estructura base ────────────────────────────────────
        const atom = this._normalize(parsed, opts.filePath);
        if (!atom)
            return { ok: false, atom: null, error: 'A1 schema fail' };
        // ── A2 — Trim sanity ─────────────────────────────────────────────────
        if (atom.trim.endMs - atom.trim.startMs < MIN_TRIM_DURATION_MS) {
            return _fail(`A2: trim duration < ${MIN_TRIM_DURATION_MS}ms ` +
                `(start=${atom.trim.startMs}, end=${atom.trim.endMs})`, opts.filePath);
        }
        // ── A3 — Genoma ──────────────────────────────────────────────────────
        if (!_in01(atom.aggression) || !_in01(atom.chaos) || !_in01(atom.organicity)) {
            return _fail('A3: genome out of [0,1] range', opts.filePath);
        }
        // ── A4 — EnergyZone ──────────────────────────────────────────────────
        if (ENERGY_ZONE_ORDINAL[atom.energyZone.min] > ENERGY_ZONE_ORDINAL[atom.energyZone.max]) {
            return _fail('A4: energyZone min > max', opts.filePath);
        }
        // ── A5 — compatibleVibes non-empty ───────────────────────────────────
        if (atom.compatibleVibes.length === 0) {
            return _fail('A5: empty compatibleVibes', opts.filePath);
        }
        // ── Inyectar en el registry ──────────────────────────────────────────
        const registered = this._registry.register(atom);
        if (!registered) {
            return _fail('registry rejected (structural validation failed)', opts.filePath);
        }
        console.log(`[TheiaFileLoader 🎬] accepted atom: ${registered.id}` +
            (opts.filePath ? ` (${opts.filePath})` : ''));
        return { ok: true, atom: registered };
    }
    // ─────────────────────────────────────────────────────────────────────────
    // NORMALIZER (acepta layout v2 canónico o flat-fields)
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Convierte un payload arbitrario en `ITheiaAtom`. Acepta dos formas:
     *
     *   1) Wrapper canónico v2:
     *      { "$schema": "luxsync.theia/2.0", "atom": { ... } }
     *
     *   2) Objeto plano (draft autosave): el propio `ITheiaAtom` ya en root.
     */
    _normalize(parsed, filePath) {
        if (!parsed || typeof parsed !== 'object') {
            _warn('A1: payload is not an object', filePath);
            return null;
        }
        const root = parsed;
        // Wrapper canónico
        let atomRaw = null;
        if (root.$schema === 'luxsync.theia/2.0' && root.atom && typeof root.atom === 'object') {
            atomRaw = root.atom;
        }
        else if (typeof root.id === 'string' && root.trim && typeof root.trim === 'object') {
            // Flat-form (autosave draft)
            atomRaw = root;
        }
        else {
            _warn('A1: unrecognized layout (expected v2 wrapper or flat atom)', filePath);
            return null;
        }
        if (typeof atomRaw.id !== 'string' || atomRaw.id.length === 0) {
            _warn('A1: atom.id missing/empty', filePath);
            return null;
        }
        if (typeof atomRaw.filePath !== 'string' || atomRaw.filePath.length === 0) {
            _warn('A1: atom.filePath missing/empty', filePath);
            return null;
        }
        const trim = atomRaw.trim;
        if (!trim || typeof trim.startMs !== 'number' || typeof trim.endMs !== 'number') {
            _warn('A1: atom.trim missing', filePath);
            return null;
        }
        const energyZone = atomRaw.energyZone;
        if (!energyZone || !_isEnergyZone(energyZone.min) || !_isEnergyZone(energyZone.max)) {
            _warn('A1: atom.energyZone missing/invalid', filePath);
            return null;
        }
        const compatibleVibes = Array.isArray(atomRaw.compatibleVibes)
            ? atomRaw.compatibleVibes
            : [];
        const validSections = Array.isArray(atomRaw.validSections)
            ? atomRaw.validSections
            : [];
        return {
            id: atomRaw.id,
            packId: typeof atomRaw.packId === 'string' ? atomRaw.packId : '',
            filePath: atomRaw.filePath,
            aggression: Number(atomRaw.aggression),
            chaos: Number(atomRaw.chaos),
            organicity: Number(atomRaw.organicity),
            energyZone: {
                min: energyZone.min,
                max: energyZone.max,
            },
            validSections,
            trim: {
                startMs: trim.startMs,
                endMs: trim.endMs,
            },
            compatibleVibes,
            isDivineCandidate: atomRaw.isDivineCandidate === true,
            isHeavyCandidate: atomRaw.isHeavyCandidate === true,
        };
    }
}
// ─── HELPERS ─────────────────────────────────────────────────────────────────
function _isEnergyZone(v) {
    return typeof v === 'string' && Object.prototype.hasOwnProperty.call(ENERGY_ZONE_ORDINAL, v);
}
function _in01(n) {
    return Number.isFinite(n) && n >= 0 && n <= 1;
}
function _warn(reason, filePath) {
    console.warn(`[TheiaFileLoader ⚠️] ${reason}` + (filePath ? ` (${filePath})` : ''));
}
function _fail(reason, filePath) {
    _warn(reason, filePath);
    return { ok: false, atom: null, error: reason };
}
