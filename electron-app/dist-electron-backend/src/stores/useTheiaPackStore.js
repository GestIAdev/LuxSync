/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📦 THEIA PACK STORE — WAVE 4922 (Atomic Paradigm · Fase 3)
 *    🎛️ WAVE 8239 · U1 — Universal Media Pool (Theia es 100% LIVE)
 *
 * Estado de sesión para Packs y clips del MEDIA POOL.
 *
 * Dos cubos de estado independientes:
 *
 *   1. `packs`     → Packs *ya consolidados* (cada uno con ≥1 átomo válido).
 *                    Es lo que ve el LIVE Deck. Los vídeos ingestados, los
 *                    `.theia` y los `.glsl` nacen directamente como átomos
 *                    dentro de su pack — sin paso intermedio.
 *
 *   2. `rawClips`  → Tracking de los archivos de vídeo dropeados (blob URL,
 *                    duración una vez medida). Cada uno lleva pareado un
 *                    átomo `kind:'video'` ya jugable en el deck.
 *
 * Es deliberadamente *sólo* memoria de la sesión activa.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { create } from 'zustand';
import { getTheiaRegistry } from '../core/theia/TheiaRegistry';
// 🌊 WAVE 8302 · M3 — ciclo store↔GenomePool consciente: el pool ya
// importa este store (spawn/_extinguish); ambos solo usan los bindings
// dentro de funciones → ESM live-bindings lo resuelve sin TDZ.
import { releaseGenomeAtom } from '../theia/genome/GenomePool';
import { parseEuclidMeta } from '../theia/shader/ShaderAssembler';
import { ENERGY_ZONE_ORDINAL } from '../types/theiaTypes';
/** 🎛️ WAVE 8239 · U1 — extensiones aceptadas por el Universal Media Pool. */
export const MEDIA_POOL_VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mkv', '.mov', '.avi'];
export const MEDIA_POOL_ATOM_EXTENSIONS = ['.theia', '.glsl'];
export const MEDIA_POOL_ACCEPT = [...MEDIA_POOL_VIDEO_EXTENSIONS, ...MEDIA_POOL_ATOM_EXTENSIONS].join(',');
/** ¿El filename pertenece al conjunto aceptado por el media pool? */
export function isSupportedMediaFile(fileName) {
    const lower = fileName.toLowerCase();
    return [...MEDIA_POOL_VIDEO_EXTENSIONS, ...MEDIA_POOL_ATOM_EXTENSIONS]
        .some((ext) => lower.endsWith(ext));
}
// ─── HELPERS ─────────────────────────────────────────────────────────────────
let _autopackCounter = 1;
/** Genera un nombre de pack válido para un nuevo bundle autogenerado. */
function _nextAutoPackId(existing) {
    while (existing.has(`New_Pack_${_autopackCounter}`))
        _autopackCounter++;
    const id = `New_Pack_${_autopackCounter}`;
    _autopackCounter++;
    return id;
}
/** Inferir el packId del primer segmento de `webkitRelativePath`. */
function _packIdFromPath(file) {
    // webkitRelativePath = "MyFolder/sub/file.mp4" — el browser lo expone
    // cuando se usa `<input webkitdirectory>` o se hace drag&drop de carpeta.
    const rel = file.webkitRelativePath;
    if (!rel)
        return null;
    const segments = rel.split(/[\\/]/).filter(Boolean);
    if (segments.length <= 1)
        return null;
    return segments[0];
}
function _safeBasename(name) {
    return name.replace(/\.[^.]+$/, '').replace(/[^\w\-]+/g, '_') || 'clip';
}
/**
 * 🎛️ U1 — trim nominal de un átomo vídeo recién ingestado (la duración real
 * se parchea con `updateAtomTrim` cuando `loadedmetadata` llega).
 */
const NOMINAL_VIDEO_TRIM_MS = 60000;
/**
 * Validación mínima runtime de un objeto como ITheiaAtom.
 * No carga el modelo completo — sólo comprueba campos críticos del paradigma atómico.
 */
function _isValidTheiaAtom(obj) {
    if (!obj || typeof obj !== 'object')
        return false;
    const a = obj;
    return (typeof a.id === 'string' && a.id.length > 0 &&
        typeof a.packId === 'string' &&
        typeof a.filePath === 'string' &&
        typeof a.aggression === 'number' &&
        typeof a.chaos === 'number' &&
        typeof a.organicity === 'number' &&
        typeof a.energyZone === 'object' && a.energyZone !== null &&
        typeof a.trim === 'object' && a.trim !== null);
}
// ─── STORE ───────────────────────────────────────────────────────────────────
export const useTheiaPackStore = create((set, get) => ({
    // ── Initial state ────────────────────────────────────────────────────────
    packs: new Map(),
    rawClips: [],
    livePackId: null,
    expandedPackId: null,
    armedAtomId: null,
    activeAtomId: null,
    atomGeneValues: new Map(),
    atomParamValues: new Map(),
    libraryScanning: false,
    // ── Packs ────────────────────────────────────────────────────────────────
    upsertPack(pack) {
        const next = new Map(get().packs);
        next.set(pack.id, pack);
        set({ packs: next });
    },
    removePack(packId) {
        const next = new Map(get().packs);
        if (!next.delete(packId))
            return;
        const { livePackId, expandedPackId, armedAtomId } = get();
        const removed = get().packs.get(packId);
        set({
            packs: next,
            livePackId: livePackId === packId ? null : livePackId,
            expandedPackId: expandedPackId === packId ? null : expandedPackId,
            // Si el pack borrado contenía el átomo armado, desarma (el intent del
            // orchestrator fallará limpio al disparar → queda log, sin zombie UI).
            armedAtomId: armedAtomId && removed?.atoms.some((a) => a.id === armedAtomId)
                ? null
                : armedAtomId,
        });
    },
    removeAtom(atomId) {
        const st = get();
        let owner;
        for (const p of st.packs.values()) {
            if (p.atoms.some((a) => a.id === atomId)) {
                owner = p;
                break;
            }
        }
        if (!owner)
            return;
        const nextPacks = new Map(st.packs);
        nextPacks.set(owner.id, {
            ...owner,
            atoms: owner.atoms.filter((a) => a.id !== atomId),
            manifest: owner.manifest
                ? {
                    ...owner.manifest,
                    atomOrder: (owner.manifest.atomOrder ?? []).filter((id) => id !== atomId),
                }
                : owner.manifest,
        });
        const genes = new Map(st.atomGeneValues);
        const params = new Map(st.atomParamValues);
        genes.delete(atomId);
        params.delete(atomId);
        // Salida completa del ecosistema: registro central + bookkeeping del
        // pool genético (población/fitness/índices). releaseGenomeAtom es
        // idempotente y barato para ids que no son mutación.
        getTheiaRegistry().unregister(atomId);
        releaseGenomeAtom(atomId);
        set({
            packs: nextPacks,
            atomGeneValues: genes,
            atomParamValues: params,
            armedAtomId: st.armedAtomId === atomId ? null : st.armedAtomId,
            activeAtomId: st.activeAtomId === atomId ? null : st.activeAtomId,
        });
    },
    setLivePack(packId) {
        if (packId !== null && !get().packs.has(packId)) {
            console.warn(`[useTheiaPackStore] setLivePack('${packId}') — pack desconocido`);
            return;
        }
        set({ livePackId: packId });
    },
    setExpandedPack(packId) {
        if (packId !== null && !get().packs.has(packId))
            return;
        set({ expandedPackId: packId });
    },
    setArmedAtom(atomId) {
        set({ armedAtomId: atomId });
    },
    setActiveAtom(atomId) {
        const { armedAtomId } = get();
        set({
            activeAtomId: atomId,
            // El átomo armado que ya está vivo en pantalla deja de ser "standby".
            armedAtomId: armedAtomId && armedAtomId === atomId ? null : armedAtomId,
        });
    },
    setAtomGeneValues(atomId, values) {
        const next = new Map(get().atomGeneValues);
        next.set(atomId, { ...values });
        set({ atomGeneValues: next });
        _scheduleOverridesWrite(get(), atomId, 'genes');
    },
    setAtomParamValues(atomId, values) {
        const next = new Map(get().atomParamValues);
        next.set(atomId, { ...values });
        set({ atomParamValues: next });
        _scheduleOverridesWrite(get(), atomId, 'params');
    },
    // ── Raw clips ────────────────────────────────────────────────────────────
    addRawClips(clips) {
        if (clips.length === 0)
            return;
        set({ rawClips: [...get().rawClips, ...clips] });
    },
    updateRawClip(clipId, patch) {
        const next = get().rawClips.map((c) => c.id === clipId ? { ...c, ...patch } : c);
        set({ rawClips: next });
    },
    removeRawClip(clipId) {
        set({ rawClips: get().rawClips.filter((c) => c.id !== clipId) });
    },
    clearRawClips() {
        // Importante: revocar URLs para no leakear blobs.
        for (const c of get().rawClips) {
            if (c.url.startsWith('blob:')) {
                try {
                    URL.revokeObjectURL(c.url);
                }
                catch { /* noop */ }
            }
        }
        set({ rawClips: [] });
    },
    // ── Atoms ────────────────────────────────────────────────────────────────
    updateAtomTrim(atomId, packId, endMs) {
        const pack = get().packs.get(packId);
        const atom = pack?.atoms.find((a) => a.id === atomId);
        if (!pack || !atom || !Number.isFinite(endMs) || endMs <= atom.trim.startMs)
            return;
        const nextAtom = { ...atom, trim: { ...atom.trim, endMs } };
        const nextPacks = new Map(get().packs);
        nextPacks.set(packId, {
            ...pack,
            atoms: pack.atoms.map((a) => (a.id === atomId ? nextAtom : a)),
        });
        set({ packs: nextPacks });
        getTheiaRegistry().register(nextAtom); // re-freeze con el trim real
    },
    // ── Bulk ingestion ───────────────────────────────────────────────────────
    async ingestFiles(files) {
        if (files.length === 0) {
            return { clips: [], atoms: [], packId: '' };
        }
        const state = get();
        const ts = Date.now();
        // Separar por familia: vídeo / .theia (átomo serializado) / .glsl (shader)
        const isExt = (f, ext) => f.name.toLowerCase().endsWith(ext);
        const videoFiles = files.filter((f) => !isExt(f, '.theia') && !isExt(f, '.glsl'));
        const theiaFiles = files.filter((f) => isExt(f, '.theia'));
        const glslFiles = files.filter((f) => isExt(f, '.glsl'));
        // STEP 1 — Determinar packId (carpeta) por archivo.
        const groupKeys = new Map(files.map((f) => [f, _packIdFromPath(f) ?? '']));
        const allEmpty = [...groupKeys.values()].every((k) => k === '');
        const autoPackId = allEmpty ? _nextAutoPackId(state.packs) : '';
        const packIdFor = (f, fallback = '') => groupKeys.get(f) || fallback || autoPackId;
        // STEP 2 — Construir clips + asegurar Packs `pending` para cada bucket.
        const nextPacks = new Map(state.packs);
        const clips = [];
        const atoms = [];
        const ensuredPacks = new Set();
        const registry = getTheiaRegistry();
        const ensurePack = (packId) => {
            if (ensuredPacks.has(packId))
                return;
            ensuredPacks.add(packId);
            if (!nextPacks.has(packId)) {
                nextPacks.set(packId, {
                    id: packId,
                    rootPath: '',
                    atoms: [],
                    manifest: null,
                    scannedAt: ts,
                    pending: true,
                });
            }
        };
        const attach = (atom) => {
            ensurePack(atom.packId);
            const pack = nextPacks.get(atom.packId);
            nextPacks.set(atom.packId, {
                ...pack,
                atoms: [...pack.atoms.filter((a) => a.id !== atom.id), atom],
                scannedAt: ts,
            });
            registry.register(atom); // resoluble por playAtom (clip/shader resolver)
            atoms.push(atom);
        };
        videoFiles.forEach((file, idx) => {
            const packId = packIdFor(file);
            const base = _safeBasename(file.name);
            const clipId = `${packId}__${base}__${ts}_${idx}`;
            const url = URL.createObjectURL(file);
            clips.push({
                id: clipId,
                name: file.name,
                filePath: file.path ??
                    file.webkitRelativePath ??
                    file.name,
                url,
                packId,
                state: 'queued',
                durationMs: 0,
                addedAt: ts + idx,
            });
            // 🎛️ U1 — el vídeo nace como átomo jugable: filePath = blob URL (el
            // clipUrlResolver lo pasa intacto a loadVideo). Genoma neutro — los
            // genes del shader no aplican a un medio decodificado.
            // trim nominal: la duración real se mide tras el primer loadVideo y se
            // parchea vía updateAtomTrim. `compatibleVibes:['generic']` — untagged
            // media no reclama vibes de Selene (el trigger manual es su vía).
            attach({
                id: clipId,
                packId,
                filePath: url,
                aggression: 0.5,
                chaos: 0.5,
                organicity: 0.5,
                energyZone: { min: 'gentle', max: 'peak' },
                validSections: ['verse', 'buildup', 'drop', 'breakdown', 'outro'],
                trim: { startMs: 0, endMs: NOMINAL_VIDEO_TRIM_MS },
                compatibleVibes: ['generic'],
                source: { kind: 'video' },
            });
        });
        // STEP 3 — Archivos .theia: átomo serializado directo al pack.
        for (const file of theiaFiles) {
            try {
                const text = await file.text();
                const parsed = JSON.parse(text);
                if (!_isValidTheiaAtom(parsed)) {
                    console.warn(`[PackStore] ingestFiles: .theia inválido (schema), ignorado: ${file.name}`);
                    continue;
                }
                const atom = parsed;
                attach({ ...atom, packId: _packIdFromPath(file) ?? atom.packId });
            }
            catch (err) {
                console.warn(`[PackStore] ingestFiles: error al parsear .theia: ${file.name}`, err);
            }
        }
        // STEP 4 — Archivos .glsl: leer texto → meta @euclid → átomo shader.
        for (const file of glslFiles) {
            try {
                const glsl = await file.text();
                attach(_buildGlslAtom(file.name, glsl, packIdFor(file, 'glsl_pool')));
            }
            catch (err) {
                console.warn(`[PackStore] ingestFiles: error al leer .glsl: ${file.name}`, err);
            }
        }
        set({
            packs: nextPacks,
            rawClips: [...state.rawClips, ...clips],
        });
        return { clips, atoms, packId: clips[0]?.packId ?? atoms[0]?.packId ?? autoPackId };
    },
    // ── Disk library (WAVE 8299) ─────────────────────────────────────────────
    async loadLibraryFromDisk() {
        const theia = typeof window !== 'undefined' ? window.lux?.theia : undefined;
        if (!theia?.scanLibrary)
            return 0;
        if (get().libraryScanning)
            return 0;
        set({ libraryScanning: true });
        try {
            const res = await theia.scanLibrary();
            if (!res?.success) {
                console.warn('[PackStore] loadLibraryFromDisk failed:', res?.error);
                return 0;
            }
            const registry = getTheiaRegistry();
            const ts = Date.now();
            const nextPacks = new Map(get().packs);
            const hydratedGenes = new Map(get().atomGeneValues);
            const hydratedParams = new Map(get().atomParamValues);
            // Remove disk-backed packs that vanished from the scan (file deleted
            // between runs). Session packs (pending / rootPath='') are untouched.
            const scannedIds = new Set(res.packs.map((p) => p.id));
            for (const [id, pack] of nextPacks) {
                if (pack.rootPath && !scannedIds.has(id))
                    nextPacks.delete(id);
            }
            let hydrated = 0;
            for (const scanned of res.packs) {
                const atoms = [];
                for (const file of scanned.files) {
                    const atom = _atomFromScannedFile(scanned, file);
                    if (!atom)
                        continue;
                    atoms.push(atom);
                    registry.register(atom);
                }
                // manifest.atomOrder reordena; los no listados quedan al final.
                const order = scanned.manifest?.atomOrder;
                if (order?.length) {
                    const rank = new Map(order.map((id, i) => [id, i]));
                    atoms.sort((a, b) => (rank.get(a.id) ?? 1e9) - (rank.get(b.id) ?? 1e9));
                }
                // Hydrate persisted Inspector overrides — session-tweaked values win
                // (el operador pudo afinar un átomo antes del rescan).
                for (const [atomId, o] of Object.entries(scanned.manifest?.atomOverrides ?? {})) {
                    if (o.genes && !hydratedGenes.has(atomId))
                        hydratedGenes.set(atomId, o.genes);
                    if (o.params && !hydratedParams.has(atomId))
                        hydratedParams.set(atomId, o.params);
                }
                // Merge con extras de sesión (átomos dropeados sobre un pack de disco
                // que no están en disco todavía).
                const existing = nextPacks.get(scanned.id);
                const incomingIds = new Set(atoms.map((a) => a.id));
                const extras = (existing?.atoms ?? []).filter((a) => !incomingIds.has(a.id));
                nextPacks.set(scanned.id, {
                    id: scanned.id,
                    rootPath: scanned.rootPath,
                    atoms: [...atoms, ...extras],
                    manifest: scanned.manifest,
                    scannedAt: ts,
                    pending: false,
                });
                hydrated++;
            }
            set({
                packs: nextPacks,
                atomGeneValues: hydratedGenes,
                atomParamValues: hydratedParams,
            });
            return hydrated;
        }
        finally {
            set({ libraryScanning: false });
        }
    },
}));
// ─── BULK HELPERS (free functions) ───────────────────────────────────────────
/** Zona de energía válida o fallback defensivo. */
function _toEnergyZone(s, fallback) {
    return s && s in ENERGY_ZONE_ORDINAL ? s : fallback;
}
/**
 * 🎛️ WAVE 8239 · U1 — construye un `ITheiaAtom` `source.kind='shader'`
 * desde un `.glsl` dropeado. El shader es su propio manifiesto: genoma y
 * zona se derivan del header `@euclid` (defaults neutros si ausente).
 * `id` estable por basename → re-dropear el mismo archivo reemplaza.
 */
export function buildGlslAtom(fileName, glsl, packId, filePath) {
    const meta = parseEuclidMeta(glsl);
    const base = _safeBasename(fileName);
    return {
        id: `glsl_${base}`,
        packId,
        // 🌊 WAVE 8299 — `filePath` real cuando el átomo viene del disco;
        // `file://name` queda como identidad simbólica para drag&drop de sesión.
        filePath: filePath ?? `file://${fileName}`,
        aggression: meta.genome.aggression ?? 0.5,
        chaos: meta.genome.chaos ?? 0.5,
        organicity: meta.genome.organicity ?? 0.5,
        energyZone: {
            min: _toEnergyZone(meta.zone?.from, 'gentle'),
            max: _toEnergyZone(meta.zone?.to, 'peak'),
        },
        validSections: ['verse', 'buildup', 'drop', 'breakdown', 'outro'],
        trim: { startMs: 0, endMs: 8000 }, // loop infinito — trim nominal
        // 🌊 WAVE 8300 — `@euclid vibes a+b` declara elegibilidad Selene;
        // sin header el átomo queda 'generic' (solo disparo manual).
        compatibleVibes: meta.vibes?.length ? [...meta.vibes] : ['generic'],
        source: { kind: 'shader', glsl },
    };
}
// alias interno usado por ingestFiles
const _buildGlslAtom = buildGlslAtom;
// ─── WAVE 8299 — DISK LIBRARY HELPERS ───────────────────────────────────────
/**
 * Convierte un archivo escaneado del disco en `ITheiaAtom` jugable.
 * `.glsl` → `source.kind='shader'` con GLSL embebido; `.theia` → JSON +
 * `_isValidTheiaAtom` (mismo gate que ingestFiles). Devuelve null en
 * archivo malformado (fail-silent WAVE 2483).
 */
function _atomFromScannedFile(pack, file) {
    try {
        if (file.kind === 'glsl') {
            return buildGlslAtom(file.fileName, file.text, pack.id, file.absPath);
        }
        const parsed = JSON.parse(file.text);
        const raw = parsed?.atom ?? parsed; // soporta wrapper v2 y flat
        if (!_isValidTheiaAtom(raw)) {
            console.warn(`[PackStore] .theia inválido en disco, ignorado: ${file.absPath}`);
            return null;
        }
        return { ...raw, packId: pack.id, filePath: file.absPath };
    }
    catch (err) {
        console.warn(`[PackStore] error materializando ${file.absPath}:`, err);
        return null;
    }
}
/** Escrituras debounced del manifest — clave `${packId}::${atomId}`. */
const _pendingOverrideWrites = new Map();
const MANIFEST_WRITE_DEBOUNCE_MS = 500;
/**
 * Persiste los ajustes del Inspector en `pack.theiapack.json` — SOLO para
 * átomos cuyo pack es disk-backed (`rootPath` no vacío, `pending` falso).
 * Los packs de sesión (pending) no tienen manifest donde escribir.
 * Debounced: arrastrar un fader coalescing a 1 write por 500ms de silencio.
 */
function _scheduleOverridesWrite(state, atomId, field) {
    const theia = typeof window !== 'undefined' ? window.lux?.theia : undefined;
    if (!theia?.saveAtomOverrides)
        return;
    // Localiza el pack del átomo.
    let packId = null;
    for (const pack of state.packs.values()) {
        if (pack.rootPath && pack.atoms.some((a) => a.id === atomId)) {
            packId = pack.id;
            break;
        }
    }
    if (!packId)
        return; // átomo de sesión — sin manifest donde persistir
    const key = `${packId}::${atomId}`;
    const pending = _pendingOverrideWrites.get(key);
    if (pending)
        clearTimeout(pending.timer);
    const latest = useTheiaPackStore.getState();
    const entry = {
        packId,
        atomId,
        genes: pending?.genes,
        params: pending?.params,
        timer: setTimeout(() => {
            _pendingOverrideWrites.delete(key);
            const patch = {
                genes: entry.genes,
                params: entry.params,
            };
            void theia.saveAtomOverrides(entry.packId, entry.atomId, patch).then((r) => {
                if (!r?.success)
                    console.warn(`[PackStore] manifest write failed for ${key}:`, r?.error);
            });
        }, MANIFEST_WRITE_DEBOUNCE_MS),
    };
    const snapshot = field === 'genes'
        ? latest.atomGeneValues.get(atomId)
        : latest.atomParamValues.get(atomId);
    if (snapshot)
        entry[field] = { ...snapshot };
    _pendingOverrideWrites.set(key, entry);
}
/**
 * Adjunta un átomo recién exportado a su Pack. Si el Pack no existe lo crea
 * (marcado como NO-pending, ya que ya hay un átomo materializado).
 */
export function attachAtomToPack(atom, rootPath) {
    const { packs, upsertPack } = useTheiaPackStore.getState();
    const existing = packs.get(atom.packId);
    if (existing) {
        const dedupAtoms = existing.atoms.filter((a) => a.id !== atom.id);
        upsertPack({
            ...existing,
            atoms: [...dedupAtoms, atom],
            scannedAt: Date.now(),
            pending: false,
        });
    }
    else {
        upsertPack({
            id: atom.packId,
            rootPath,
            atoms: [atom],
            manifest: null,
            scannedAt: Date.now(),
            pending: false,
        });
    }
}
