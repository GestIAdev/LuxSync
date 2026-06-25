/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚒️ HEPHAESTUS CLIP INDEX — O(1) In-Memory Index for .lfx Clips
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * FASE 1 — Creación del índice.
 *
 * Singleton en el main process que mantiene dos Map<> para búsquedas
 * instantáneas por ID o por filePath. Reemplaza los escaneos lineales
 * O(N) de HephFileIO y el fs.readFileSync de HephaestusRuntime.
 *
 * @module core/hephaestus/HephaestusClipIndex
 */
import * as fs from 'fs/promises';
import { deserializeHephClip } from './types';
// ═══════════════════════════════════════════════════════════════════════════
// INTERNAL HELPERS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Discriminador de tipo en runtime para distinguir V2 (curves: Map) de V3 (tracks: []).
 */
function _isV3(clip) {
    return clip.tracks !== undefined;
}
/**
 * Construye un objeto HephClipMetadata a partir de un clip V2 o V3.
 */
function _buildMetadata(clip, filePath, modifiedAt) {
    if (_isV3(clip)) {
        return {
            id: clip.id,
            name: clip.name,
            author: clip.author,
            category: clip.category,
            tags: [...clip.tags],
            durationMs: clip.durationMs,
            effectType: clip.effectType,
            paramCount: clip.tracks.length,
            filePath,
            modifiedAt,
        };
    }
    return {
        id: clip.id,
        name: clip.name,
        author: clip.author,
        category: clip.category,
        tags: [...clip.tags],
        durationMs: clip.durationMs,
        effectType: clip.effectType,
        paramCount: clip.curves.size,
        filePath,
        modifiedAt,
    };
}
// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON CLASS
// ═══════════════════════════════════════════════════════════════════════════
class HephaestusClipIndex {
    constructor() {
        this._byId = new Map();
        this._byPath = new Map();
    }
    // ── O(1) Lookups (synchronous) ──────────────────────────────────────────
    getById(id) {
        return this._byId.get(id);
    }
    getByPath(filePath) {
        return this._byPath.get(filePath);
    }
    getAllMetadata() {
        const result = [];
        for (const loaded of this._byId.values()) {
            result.push(loaded.metadata);
        }
        return result;
    }
    // ── Mutations ───────────────────────────────────────────────────────────
    remove(id) {
        const loaded = this._byId.get(id);
        if (!loaded)
            return;
        this._byId.delete(id);
        this._byPath.delete(loaded.filePath);
    }
    clear() {
        this._byId.clear();
        this._byPath.clear();
    }
    // ── Async Ingest ────────────────────────────────────────────────────────
    /**
     * Lee, parsea y valida un archivo .lfx desde disco de forma asíncrona
     * (no bloqueante). Inserta el resultado en ambos mapas.
     *
     * @returns El `LoadedClip` si tuvo éxito, `null` si falló.
     */
    async upsert(filePath, source) {
        try {
            const raw = await fs.readFile(filePath, 'utf-8');
            if (!raw || raw.trim().length === 0) {
                console.error(`[HephClipIndex] ❌ Empty file: ${filePath}`);
                return null;
            }
            const parsed = JSON.parse(raw);
            const schema = parsed?.$schema;
            let clip = null;
            let schemaVersion;
            // ── V3 PATH ────────────────────────────────────────────────────────
            if (schema === 'luxsync.lfx/3.0' && parsed?.clip && typeof parsed.clip === 'object') {
                const v3 = parsed.clip;
                if (!Array.isArray(v3.tracks) || v3.tracks.length === 0) {
                    console.error(`[HephClipIndex] ❌ V3 clip in ${filePath} has no tracks[]`);
                    return null;
                }
                for (const t of v3.tracks) {
                    if (!t || typeof t !== 'object' || !t.curve || !Array.isArray(t.curve.keyframes)) {
                        console.error(`[HephClipIndex] ❌ Invalid V3 track in ${filePath}: missing curve/keyframes`);
                        return null;
                    }
                    if (!Array.isArray(t.zones) || t.zones.length === 0) {
                        console.error(`[HephClipIndex] ❌ Invalid V3 track in ${filePath}: track '${t.id}' has no zones`);
                        return null;
                    }
                }
                clip = v3;
                schemaVersion = 'luxsync.lfx/3.0';
            }
            else {
                // ── V2.1 PATH (legacy curves Record) ──────────────────────────────
                let serialized = null;
                if (parsed?.clip && typeof parsed.clip === 'object') {
                    serialized = parsed.clip;
                }
                else if (parsed?.curves && typeof parsed.curves === 'object') {
                    serialized = parsed;
                }
                else {
                    console.error(`[HephClipIndex] ❌ Invalid clip structure in ${filePath}: no V3 tracks[] and no V2 curves{}`);
                    return null;
                }
                if (!serialized.curves || typeof serialized.curves !== 'object') {
                    console.error(`[HephClipIndex] ❌ Invalid clip structure in ${filePath}: missing or invalid curves`);
                    return null;
                }
                for (const [paramId, curve] of Object.entries(serialized.curves)) {
                    if (!curve || typeof curve !== 'object') {
                        console.error(`[HephClipIndex] ❌ Invalid curve '${paramId}' in ${filePath}: not an object`);
                        return null;
                    }
                    const hephCurve = curve;
                    if (!Array.isArray(hephCurve.keyframes)) {
                        console.error(`[HephClipIndex] ❌ Invalid curve '${paramId}' in ${filePath}: keyframes is not an array`);
                        return null;
                    }
                }
                const v2 = deserializeHephClip(serialized);
                if (!v2 || !v2.curves || v2.curves.size === 0) {
                    console.error(`[HephClipIndex] ❌ Deserialization failed or empty curves in ${filePath}`);
                    return null;
                }
                clip = v2;
                schemaVersion = schema === 'hephaestus/v2.1' ? 'hephaestus/v2.1' : 'hephaestus/v1';
            }
            if (!clip)
                return null;
            // ── Stat for modifiedAt ──────────────────────────────────────────────
            let modifiedAt = Date.now();
            try {
                const stats = await fs.stat(filePath);
                modifiedAt = stats.mtimeMs;
            }
            catch {
                // stat falló — usar Date.now() como fallback
            }
            // ── Build LoadedClip ─────────────────────────────────────────────────
            const metadata = _buildMetadata(clip, filePath, modifiedAt);
            const loaded = {
                id: clip.id,
                filePath,
                schemaVersion,
                metadata,
                clip,
                modifiedAt,
                source,
            };
            // ── Upsert: si ya existía un clip con el mismo ID pero distinto path,
            //    eliminamos la entrada anterior del byPath para evitar stale entries.
            const existing = this._byId.get(clip.id);
            if (existing && existing.filePath !== filePath) {
                this._byPath.delete(existing.filePath);
            }
            this._byId.set(clip.id, loaded);
            this._byPath.set(filePath, loaded);
            return loaded;
        }
        catch (err) {
            console.error(`[HephClipIndex] ❌ Failed to upsert ${filePath}:`, err);
            return null;
        }
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON EXPORT
// ═══════════════════════════════════════════════════════════════════════════
let _instance = null;
export function getHephaestusClipIndex() {
    if (_instance == null)
        _instance = new HephaestusClipIndex();
    return _instance;
}
/** SOLO para tests: resetea el singleton y limpia los mapas. */
export function __resetHephaestusClipIndexForTests() {
    _instance?.clear();
    _instance = null;
}
