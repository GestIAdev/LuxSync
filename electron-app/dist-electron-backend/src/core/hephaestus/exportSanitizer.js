/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 WAVE 8201 — EXPORT SANITIZER (The Diplomat)
 *
 * Middleware PURO pre-save: `AsteriaProject → tracks ast_*` producen curvas
 * V3-válidas, pero el clip hereda metadata inválida del template
 * (WAVE 8200 — Gap Analysis):
 *
 *   P1 · `track.zones` puede llevar zoneIds sub-canónicos del atlas
 *        ('front-left', 'back-right'…) — fuera de `ZoneTarget` y, peor,
 *        `resolveZone` los normaliza a 'unassigned' → targeting muerto.
 *        `clip.spatialZones` jamás se recomputa tras `injectAstTracks`
 *        (stale summary → pool de preview erróneo, useHephPreview:330).
 *
 *   P2 · `DEFAULT_COGNITIVE_DNA` (NewClipModal) declara
 *        `energyZone {ambient→peak}` = span 5 → **G4 fail** (máx. 2), y
 *        `compatibleVibes`/`validSections` vacíos → rechazo silencioso en
 *        `DynamicEffectRegistry.registerEffectV3` (G4: vibes ≠ ∅).
 *
 *   WAVE 8205 (M2) — Zero-Friction DNA: si el clip fue tocado por
 *   Asteria (`clip.asteria` o tracks `ast_*`) y carece de
 *   `cognitiveDNA`, el Diplomat le inyecta el pasaporte seguro
 *   ('chill-lounge' + 'manual_only' + ventana ≤2) en lugar de
 *   dejarlo invisible para Selene.
 *
 * Doctrina: patch-time, sin Electron, cero mutación del input. Nada que
 * no pase `evaluateGates` debe llegar al IPC `heph:save` ni a
 * `userData/arsenal`.
 *
 * @module core/hephaestus/exportSanitizer
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { CANONICAL_ZONES, normalizeZone, } from '../stage/ShowFileV2';
import { normalizeZoneId } from '../aether/adapters/zoneUtils';
import { ARCHETYPE_BIAS_MAP, ENERGY_ZONES, } from '../arsenal/LfxClipInstance';
import { DEFAULT_COGNITIVE_DNA } from './defaults';
// ─── HIGIENE ESPACIAL (M1) ──────────────────────────────────────────────────
/** Targets válidos del contrato V3: las 9 canónicas + helpers de grupo. */
const VALID_ZONE_TARGETS = new Set([
    ...CANONICAL_ZONES,
    'all',
    'all-pars',
    'all-movers',
]);
/**
 * Mapea un tag de zona arbitrario a un `ZoneTarget` estricto.
 *
 * Cadena: ya-válido → normalizeZoneId (aliases aether/legacy kebab) →
 * sufijo lateral ('front-left' → 'front') → normalizeZone (legacy V1/V2) →
 * 'unassigned' (zona muerta honesta — jamás 'all': una zona irreconocible
 * no debe inundar el rig entero).
 */
function sanitizeTrackZone(raw) {
    const z = String(raw).trim().toLowerCase();
    if (VALID_ZONE_TARGETS.has(z))
        return z;
    const n = normalizeZoneId(z);
    if (VALID_ZONE_TARGETS.has(n))
        return n;
    // Sub-zona lateral ('front-left', 'back-right'…) → padre canónico.
    // Mejor ensanchar al padre que caer al pool 'unassigned' (misroute vivo).
    const m = /^(.+)-(left|right)$/.exec(n);
    if (m && CANONICAL_ZONES.includes(m[1])) {
        return m[1];
    }
    const c = normalizeZone(n);
    if (c !== 'unassigned')
        return c;
    return 'unassigned';
}
/** Zonas de track saneadas + dedupe, preservando orden de aparición. */
function sanitizeTrackZones(zones) {
    const seen = new Set();
    const out = [];
    for (const raw of zones) {
        const z = sanitizeTrackZone(raw);
        if (!seen.has(z)) {
            seen.add(z);
            out.push(z);
        }
    }
    return out.length > 0 ? out : ['all'];
}
/**
 * Unión de zonas sobre todos los tracks, orden canónico
 * (CANONICAL_ZONES primero, helpers al final) — el resumen `spatialZones`
 * que el V3 declara y el preview consume.
 */
function unionSpatialZones(tracks) {
    const seen = new Set();
    for (const t of tracks)
        for (const z of t.zones)
            seen.add(z);
    const order = (z) => {
        const i = CANONICAL_ZONES.indexOf(z);
        return i >= 0 ? i : CANONICAL_ZONES.length + (z === 'all' ? 0 : 1);
    };
    return [...seen].sort((a, b) => order(a) - order(b));
}
// ─── PASAPORTE SELENE (M2) ──────────────────────────────────────────────────
/** Ventana energética de emergencia cuando el arquetipo no guía. */
const FALLBACK_ENERGY_WINDOW = { min: 'active', max: 'intense' };
/** Vibe genérica para clips sin afinidad declarada (el bridged "ambiental"). */
const GENERIC_VIBE = 'chill-lounge';
/** Secciones musicales por zona energética (vocabulario de los builtins). */
const ZONE_SECTIONS = {
    silence: ['intro', 'breakdown', 'outro'],
    valley: ['intro', 'breakdown', 'outro'],
    ambient: ['intro', 'verse', 'breakdown'],
    gentle: ['verse', 'breakdown'],
    active: ['verse', 'build', 'chorus'],
    intense: ['build', 'drop', 'chorus'],
    peak: ['drop', 'chorus'],
};
/** Span del rango energético en el termómetro ENERGY_ZONES (−1 si inválido). */
function energyZoneSpan(dna) {
    const lo = ENERGY_ZONES.indexOf(dna.energyZone.min);
    const hi = ENERGY_ZONES.indexOf(dna.energyZone.max);
    if (lo < 0 || hi < 0 || hi < lo)
        return -1;
    return hi - lo + 1;
}
/**
 * Ventana ≤2 zonas para G4. Origen: `defaultZones` del arquetipo
 * (sesión bias — divine→[peak], ambient→[valley,ambient]…); si su rango
 * aún excede 2 (utility lleva 3), se toma la cola — la zona dominante
 * alta, donde el efecto realmente importa. Sin arquetipo → fallback.
 */
function clampEnergyWindow(dna) {
    const defaults = ARCHETYPE_BIAS_MAP[dna.archetype ?? 'utility']?.defaultZones ??
        ARCHETYPE_BIAS_MAP.utility.defaultZones;
    if (defaults && defaults.length > 0) {
        const tail = defaults.slice(-2); // dominante: la cola más energética
        return {
            min: tail[0],
            max: tail[tail.length - 1],
        };
    }
    return { ...FALLBACK_ENERGY_WINDOW };
}
/** Secciones derivadas de la ventana energética ya saneada. */
function sectionsForWindow(min, max) {
    const lo = ENERGY_ZONES.indexOf(min);
    const hi = ENERGY_ZONES.indexOf(max);
    const out = new Set();
    for (let i = lo; i <= hi && i < ENERGY_ZONES.length; i++) {
        for (const s of ZONE_SECTIONS[ENERGY_ZONES[i]])
            out.add(s);
    }
    return out.size > 0 ? [...out] : ['verse', 'chorus'];
}
/**
 * 🜨 WAVE 8205 (M2): "tocado por Asteria" = lleva el envelope de receta
 * (`clip.asteria`, serializado por types.ts) o tracks compilados `ast_*`.
 * El prefijo se duplica como literal — `core/` no importa de
 * `components/` (fuente: ASTERIA_TRACK_PREFIX en emissionPlan.ts).
 */
function isAsteriaTouched(clip) {
    return (clip.asteria !== undefined ||
        clip.tracks.some((t) => t.id.startsWith('ast_')));
}
/**
 * Sanea el `cognitiveDNA` existente para que pase G4 (renderer + registry):
 *   - `energyZone` span → ≤ 2 (Montecarlo).
 *   - `compatibleVibes` vacío → vibe genérica + `visibility:'manual_only'`
 *     (honesto: sin afinidad declarada, Selene lo cataloga pero jamás lo
 *     auto-selecciona — disparo manual/MIDI/Chronos sigue abierto).
 *   - `validSections` vacío → secciones derivadas de la ventana energética.
 */
function sanitizeCognitiveDNA(dna, notes) {
    let energyZone = dna.energyZone;
    const span = energyZoneSpan(dna);
    if (span < 0 || span > 2) {
        energyZone = clampEnergyWindow(dna);
        notes.push(`G4: energyZone ${dna.energyZone.min}→${dna.energyZone.max} ` +
            `(span ${span < 0 ? 'inválido' : span}) → ${energyZone.min}→${energyZone.max}`);
    }
    let compatibleVibes = dna.compatibleVibes;
    let visibility = dna.visibility;
    if (compatibleVibes.length === 0) {
        compatibleVibes = [GENERIC_VIBE];
        if (visibility === undefined) {
            visibility = 'manual_only';
            notes.push(`G4: compatibleVibes vacío → '${GENERIC_VIBE}' + visibility 'manual_only'`);
        }
        else {
            notes.push(`G4: compatibleVibes vacío → '${GENERIC_VIBE}'`);
        }
    }
    let validSections = dna.validSections;
    if (validSections.length === 0) {
        validSections = sectionsForWindow(energyZone.min, energyZone.max);
        notes.push(`G4: validSections vacío → [${validSections.join(', ')}]`);
    }
    if (energyZone === dna.energyZone &&
        compatibleVibes === dna.compatibleVibes &&
        validSections === dna.validSections) {
        return dna;
    }
    return {
        ...dna,
        energyZone,
        compatibleVibes,
        validSections,
        visibility,
    };
}
// ─── API ────────────────────────────────────────────────────────────────────
/**
 * Sanea un clip para exportación `.lfx` V3-estricta. Función pura:
 * el input jamás muta; el output comparte estructura intacta.
 *
 * NO toca curvas/keyframes (P1 confirmó que son V3-válidas) ni el
 * envelope `clip.asteria` (la receta viaja intacta — D-4).
 */
export function prepareClipForExport(clip) {
    const notes = [];
    // ── M1 · Higiene espacial ──────────────────────────────────────────────
    let zonesChanged = false;
    const tracks = clip.tracks.map((t) => {
        const zones = sanitizeTrackZones(t.zones);
        if (zones.length !== t.zones.length ||
            zones.some((z, i) => z !== t.zones[i])) {
            zonesChanged = true;
            return { ...t, zones };
        }
        return t;
    });
    if (zonesChanged) {
        notes.push('zones: zoneIds no-canónicos mapeados a ZoneTarget estricto');
    }
    const spatialZones = unionSpatialZones(tracks);
    if (spatialZones.length !== clip.spatialZones.length ||
        spatialZones.some((z, i) => z !== clip.spatialZones[i])) {
        zonesChanged = true;
        notes.push(`spatialZones: recomputado → [${spatialZones.join(', ')}]`);
    }
    // ── M2 · Pasaporte Selene ──────────────────────────────────────────────
    let cognitiveDNA = clip.cognitiveDNA;
    let vibeCompat = clip.vibeCompat;
    if (cognitiveDNA) {
        const clean = sanitizeCognitiveDNA(cognitiveDNA, notes);
        if (clean !== cognitiveDNA) {
            cognitiveDNA = clean;
            // Espejo de serializeHephClip: vibeCompat = dna.compatibleVibes.
            vibeCompat = [...clean.compatibleVibes];
        }
    }
    else if (isAsteriaTouched(clip)) {
        // 🜨 WAVE 8205 (M2): la regla "DNA ausente → no se inventa" ya no
        // aplica a clips Asteria — el operador diseña y guarda sin pasar
        // por Laboratory. Pasaporte seguro: vibe genérica + manual_only
        // (Selene cataloga, jamás auto-selecciona) y el propio pipeline
        // de saneamiento clampea energyZone a ≤2 zonas (G4).
        const injected = {
            ...DEFAULT_COGNITIVE_DNA,
            compatibleVibes: [GENERIC_VIBE],
            visibility: 'manual_only',
        };
        cognitiveDNA = sanitizeCognitiveDNA(injected, notes);
        vibeCompat = [...cognitiveDNA.compatibleVibes];
        notes.push('DNA: inyectado — clip Asteria sin cognitiveDNA');
    }
    else {
        notes.push('NO_DNA — clip Hephaestus-only (invisible para Selene)');
    }
    if (!zonesChanged && cognitiveDNA === clip.cognitiveDNA) {
        return { clip, notes };
    }
    return {
        clip: {
            ...clip,
            tracks,
            spatialZones,
            cognitiveDNA,
            vibeCompat,
        },
        notes,
    };
}
