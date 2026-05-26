/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🎬 THEIA FILE LOADER — WAVE 4902 (Phase 2/3 of WAVE-4900-THEIADNA)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Parser + validador de archivos `.theia v1.0`. Inyecta los assets aceptados
 * en el `TheiaRegistry` (singleton del Main Process).
 *
 * GATES (idénticos en filosofía a los de `LfxFileLoader`):
 *   G1  — Schema base: `$schema === 'luxsync.theia/1.0'` + bloque `clip` válido.
 *   G2  — (Reservado para checksum SHA-256, opt-in en futuras revisiones).
 *   G3  — Cuepoints: `endMs > startMs`, sin solapamientos, exactamente UNO con
 *         `default: true`, `validSections` array.
 *   G4  — Genoma: `aggression/chaos/organicity ∈ [0, 1]` (global y por cuepoint).
 *   G5  — (Reservado: existencia del asset binario en disco — solo cuando
 *         loader corre con FS access).
 *   G6  — (Reservado para safetyDeclaration cross-check).
 *   G7  — `compatibleVibes.length > 0`.
 *
 * Las rejections logean `[TheiaFileLoader ⚠️]` + razón. Nunca lanzan.
 * ════════════════════════════════════════════════════════════════════════════
 */
import { ENERGY_ZONE_ORDINAL, isValidGenome } from '../../types/theiaTypes';
// ─── LOADER ──────────────────────────────────────────────────────────────────
export class TheiaFileLoader {
    constructor(_registry) {
        this._registry = _registry;
    }
    /**
     * Parsea + valida un payload `.theia` y, si es aceptado, lo registra.
     *
     * Acepta tanto string JSON como objeto ya parseado (útil en tests).
     * @returns un `TheiaLoadResult` describing acceptance + asset (o error).
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
        // ── G1 — Schema + estructura base ────────────────────────────────────
        const validated = this._validateSchema(parsed, opts.filePath);
        if (!validated)
            return { ok: false, asset: null, error: 'G1 schema fail' };
        // ── G3 — Cuepoints sanity ────────────────────────────────────────────
        if (!this._validateCuepoints(validated.cuePoints, opts.filePath)) {
            return { ok: false, asset: null, error: 'G3 cuepoint fail' };
        }
        // ── G4 — Genome ranges (global + per cuepoint) ───────────────────────
        if (!isValidGenome(validated.globalDNA)) {
            return _fail('G4: invalid globalDNA', opts.filePath);
        }
        for (const cp of validated.cuePoints) {
            if (!isValidGenome(cp.dna)) {
                return _fail(`G4: invalid dna in cuepoint '${cp.id}'`, opts.filePath);
            }
        }
        // ── G7 — compatibleVibes non-empty ───────────────────────────────────
        if (validated.compatibleVibes.length === 0) {
            return _fail('G7: empty compatibleVibes', opts.filePath);
        }
        // ── Inyectar en el registry ──────────────────────────────────────────
        const registered = this._registry.register(validated);
        if (!registered) {
            return _fail('registry rejected (structural validation failed)', opts.filePath);
        }
        console.log(`[TheiaFileLoader 🎬] accepted: ${registered.id}` +
            (opts.filePath ? ` (${opts.filePath})` : ''));
        return { ok: true, asset: registered };
    }
    // ─────────────────────────────────────────────────────────────────────────
    // GATE IMPLEMENTATIONS
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Gate G1: Schema base + estructura mínima.
     * Devuelve un `ITheiaAsset` parcialmente normalizado, o null si falla.
     */
    _validateSchema(parsed, filePath) {
        if (!parsed || typeof parsed !== 'object') {
            _warn('G1: payload is not an object', filePath);
            return null;
        }
        const wrapper = parsed;
        if (wrapper.$schema !== 'luxsync.theia/1.0') {
            _warn(`G1: $schema !== 'luxsync.theia/1.0' (got '${wrapper.$schema}')`, filePath);
            return null;
        }
        const clip = wrapper.clip;
        if (!clip || typeof clip !== 'object') {
            _warn('G1: missing clip block', filePath);
            return null;
        }
        if (typeof clip.id !== 'string' || clip.id.length === 0) {
            _warn('G1: clip.id missing/empty', filePath);
            return null;
        }
        // El asset binario puede declararse como string directo (legacy) o
        // como bloque { filePath, ... } (formato V1 canonical del blueprint).
        const assetFilePath = _resolveAssetFilePath(clip, filePath);
        if (!assetFilePath) {
            _warn('G1: cannot resolve asset filePath', filePath);
            return null;
        }
        // globalDNA puede vivir directo o dentro de cognitiveDNA.genome (V1 blueprint).
        const globalDNA = _resolveGlobalDNA(clip);
        if (!globalDNA) {
            _warn('G1: cannot resolve globalDNA', filePath);
            return null;
        }
        const compatibleVibes = _resolveCompatibleVibes(clip);
        if (!compatibleVibes) {
            _warn('G1: cannot resolve compatibleVibes', filePath);
            return null;
        }
        const cuePoints = _resolveCuePoints(clip);
        if (!cuePoints) {
            _warn('G1: cannot resolve cuePoints', filePath);
            return null;
        }
        return {
            id: clip.id,
            filePath: assetFilePath,
            globalDNA,
            compatibleVibes,
            cuePoints,
        };
    }
    /**
     * Gate G3: cuepoints temporales válidos, sin solapamientos, default único.
     */
    _validateCuepoints(cps, filePath) {
        if (cps.length === 0) {
            _warn('G3: zero cuepoints', filePath);
            return false;
        }
        let defaultCount = 0;
        const seenIds = new Set();
        for (const cp of cps) {
            if (!cp.id || seenIds.has(cp.id)) {
                _warn(`G3: duplicate or empty cuepoint id '${cp.id}'`, filePath);
                return false;
            }
            seenIds.add(cp.id);
            if (!Number.isFinite(cp.startMs) || cp.startMs < 0) {
                _warn(`G3: bad startMs in '${cp.id}'`, filePath);
                return false;
            }
            if (!Number.isFinite(cp.endMs) || cp.endMs <= cp.startMs) {
                _warn(`G3: endMs <= startMs in '${cp.id}'`, filePath);
                return false;
            }
            if (!cp.energyZone || !_isEnergyZoneStr(cp.energyZone.min) || !_isEnergyZoneStr(cp.energyZone.max)) {
                _warn(`G3: invalid energyZone in '${cp.id}'`, filePath);
                return false;
            }
            if (ENERGY_ZONE_ORDINAL[cp.energyZone.min] > ENERGY_ZONE_ORDINAL[cp.energyZone.max]) {
                _warn(`G3: energyZone min>max in '${cp.id}'`, filePath);
                return false;
            }
            if (cp.default === true)
                defaultCount++;
        }
        // Solapamientos temporales (O(N²) — N << 32 típicamente)
        for (let i = 0; i < cps.length; i++) {
            for (let j = i + 1; j < cps.length; j++) {
                if (_rangesOverlap(cps[i].startMs, cps[i].endMs, cps[j].startMs, cps[j].endMs)) {
                    _warn(`G3: cuepoints '${cps[i].id}' and '${cps[j].id}' overlap`, filePath);
                    return false;
                }
            }
        }
        if (defaultCount !== 1) {
            _warn(`G3: expected exactly 1 default cuepoint, got ${defaultCount}`, filePath);
            return false;
        }
        return true;
    }
}
// ─── RESOLVERS DE FORMATO V1 ─────────────────────────────────────────────────
// El blueprint WAVE-4900 declaró un layout específico para el JSON. Este loader
// es PERMISIVO con formas legacy (campos planos) por conveniencia de autoría.
function _resolveAssetFilePath(clip, manifestPath) {
    // Forma 1: clip.filePath directo (canonical interna del registry).
    if (typeof clip.filePath === 'string' && clip.filePath.length > 0)
        return clip.filePath;
    // Forma 2: clip.asset.filePath (blueprint WAVE-4900).
    const asset = clip.asset;
    if (asset && typeof asset.filePath === 'string' && asset.filePath.length > 0) {
        return asset.filePath;
    }
    void manifestPath; // Reservado: resolución relativa al manifest (futuro G5).
    return null;
}
function _resolveGlobalDNA(clip) {
    // Forma canonical: clip.globalDNA: ITheiaGenome
    if (clip.globalDNA && isValidGenome(clip.globalDNA))
        return clip.globalDNA;
    // Blueprint: clip.cognitiveDNA.genome
    const cdna = clip.cognitiveDNA;
    if (cdna && cdna.genome && isValidGenome(cdna.genome)) {
        return cdna.genome;
    }
    return null;
}
function _resolveCompatibleVibes(clip) {
    if (Array.isArray(clip.compatibleVibes))
        return clip.compatibleVibes;
    const cdna = clip.cognitiveDNA;
    if (cdna && Array.isArray(cdna.compatibleVibes))
        return cdna.compatibleVibes;
    return null;
}
function _resolveCuePoints(clip) {
    // Forma canonical: clip.cuePoints (blueprint usa cuepoints lowercase también).
    const raw = (clip.cuePoints ?? clip.cuepoints);
    if (!Array.isArray(raw))
        return null;
    const out = [];
    for (const r of raw) {
        if (!r || typeof r !== 'object')
            return null;
        const x = r;
        const id = typeof x.id === 'string' ? x.id : null;
        if (!id)
            return null;
        const name = typeof x.name === 'string'
            ? x.name
            : (typeof x.label === 'string' ? x.label : id);
        const startMs = typeof x.startMs === 'number' ? x.startMs : NaN;
        const endMs = typeof x.endMs === 'number' ? x.endMs : NaN;
        // dna puede venir como `dna` o como `genome`
        const dnaRaw = (x.dna ?? x.genome);
        if (!isValidGenome(dnaRaw))
            return null;
        const ez = x.energyZone;
        if (!ez || !_isEnergyZoneStr(ez.min) || !_isEnergyZoneStr(ez.max))
            return null;
        const validSections = Array.isArray(x.validSections)
            ? x.validSections
            : [];
        out.push({
            id,
            name,
            startMs,
            endMs,
            dna: dnaRaw,
            energyZone: { min: ez.min, max: ez.max },
            validSections,
            default: x.default === true,
            isDivineCandidate: x.isDivineCandidate === true,
            isHeavyCandidate: x.isHeavyCandidate === true,
            preferredVibes: Array.isArray(x.preferredVibes)
                ? x.preferredVibes
                : undefined,
        });
    }
    return out;
}
// ─── HELPERS ─────────────────────────────────────────────────────────────────
function _isEnergyZoneStr(v) {
    return typeof v === 'string' && Object.prototype.hasOwnProperty.call(ENERGY_ZONE_ORDINAL, v);
}
function _rangesOverlap(a0, a1, b0, b1) {
    return a0 < b1 && b0 < a1;
}
function _warn(reason, filePath) {
    console.warn(`[TheiaFileLoader ⚠️] ${reason}` + (filePath ? ` (${filePath})` : ''));
}
function _fail(reason, filePath) {
    _warn(reason, filePath);
    return { ok: false, asset: null, error: reason };
}
