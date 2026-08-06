/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧬 CustomVibe.ts — THE GENOME TYPINGS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Contrato de datos del formato `.luxvibe`: una **capa de mutación sparse**
 * sobre uno de los 4 ADN canónicos (techno-club, fiesta-latina, pop-rock,
 * chill-lounge).
 *
 * ── FILOSOFÍA ──────────────────────────────────────────────────────────────
 * Un vibe custom NO es una entidad nueva en el sistema. Es una clave más en
 * Records que los motores ya sabían leer. Este archivo describe únicamente
 * las DIFERENCIAS respecto al ADN base; el `VibeFusionResolver` reconstruye
 * las 7 configs de motor haciendo deep-merge de base + esta capa.
 *
 * ── INVARIANTES DEL TIPADO ─────────────────────────────────────────────────
 * 1. TODO override es opcional. Ausente = heredado del baseDNA.
 * 2. Los parámetros SELLADOS (seguridad de hardware / anti-epilepsia) NO
 *    existen en estos tipos. Es imposible escribirlos por accidente.
 *    Ver `engine/vibe/custom/SEALED_PARAMS.ts`.
 * 3. Cero `any`. Cero índices laxos. Todo primitivo es estricto.
 * 4. Los rangos físicos viven en `engine/vibe/custom/GENE_RANGES.ts` (SSOT
 *    compartida por el resolver y la UI). Aquí sólo se documentan en JSDoc.
 * 5. `readonly` en identidad y esquema; mutable en lo que la UI edita.
 *
 * ── ADVERTENCIA DE ACOPLAMIENTO ────────────────────────────────────────────
 * Los nombres de campo de las capas `physics` / `color` / `movement` son
 * espejo EXACTO de los contratos de motor:
 *   - physics  → `hal/physics/profiles/ILiquidProfile.ts` + `LiquidEnvelope.ts`
 *   - color    → `engine/color/SeleneColorEngine.ts` (GenerationOptions)
 *   - movement → `engine/movement/VibeMovementManager.ts` + `VibeMovementPresets.ts`
 * Si un contrato de motor cambia, este archivo debe seguirlo. Los tests de
 * `VibeFusionResolver` fallarán si divergen.
 *
 * @module types/CustomVibe
 * @version FASE 1A — The Genome Typings
 */
// ═══════════════════════════════════════════════════════════════════════════
// IDENTIDAD Y ESQUEMA
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Versión del esquema `.luxvibe`.
 * Incrementar SÓLO ante cambios incompatibles. Al ser un formato sparse, la
 * mayoría de adiciones de genes son retrocompatibles sin migración: un gen
 * nuevo ausente simplemente se hereda del ADN base.
 */
export const LUXVIBE_SCHEMA_VERSION = 1;
/** Lista runtime de los ADN válidos (para validación y UI). */
export const BASE_DNA_IDS = [
    'techno-club',
    'fiesta-latina',
    'pop-rock',
    'chill-lounge',
];
/** Type guard de `BaseDNA`. */
export function isBaseDNA(value) {
    return BASE_DNA_IDS.includes(value);
}
/** Type guard de `CustomVibeKey`. */
export function isCustomVibeKey(value) {
    return value.startsWith('custom:') && value.length > 'custom:'.length;
}
/** Lista runtime de las 6 cámaras (orden de UI). */
export const ENVELOPE_SLOTS = [
    'envelopeSubBass',
    'envelopeKick',
    'envelopeVocal',
    'envelopeSnare',
    'envelopeHighMid',
    'envelopeTreble',
];
/** Lista runtime de los 22 patrones, agrupada por familia (orden de UI). */
export const GOLDEN_PATTERN_IDS = [
    'scan_x', 'square', 'diamond', 'botstep', 'darkspin', 'laser_grid', 'industrial_pendulum',
    'figure8', 'wave_y', 'ballyhoo', 'cadera_libre', 'espiral_conga',
    'circle_big', 'cancan', 'dual_sweep',
    'drift', 'sway', 'breath',
    'slow_pan', 'tilt_nod', 'figure_of_4', 'chase_position',
];
/** Mapa patrón → familia. */
export const PATTERN_FAMILY = {
    scan_x: 'techno', square: 'techno', diamond: 'techno', botstep: 'techno',
    darkspin: 'techno', laser_grid: 'techno', industrial_pendulum: 'techno',
    figure8: 'latino', wave_y: 'latino', ballyhoo: 'latino',
    cadera_libre: 'latino', espiral_conga: 'latino',
    circle_big: 'poprock', cancan: 'poprock', dual_sweep: 'poprock',
    drift: 'chill', sway: 'chill', breath: 'chill',
    slow_pan: 'noble', tilt_nod: 'noble', figure_of_4: 'noble', chase_position: 'noble',
};
// ═══════════════════════════════════════════════════════════════════════════
// HELPERS DE VALIDACIÓN DE DOCUMENTO
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Type guard estructural de un `.luxvibe` recién parseado de disco.
 * Valida forma y esquema; NO valida rangos (eso es del resolver).
 */
export function isCustomVibeOverride(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const doc = value;
    if (doc.kind !== 'luxvibe')
        return false;
    if (doc.schemaVersion !== LUXVIBE_SCHEMA_VERSION)
        return false;
    if (typeof doc.baseDNA !== 'string' || !isBaseDNA(doc.baseDNA))
        return false;
    if (typeof doc.meta !== 'object' || doc.meta === null)
        return false;
    const meta = doc.meta;
    if (typeof meta.key !== 'string' || !isCustomVibeKey(meta.key))
        return false;
    if (typeof meta.name !== 'string')
        return false;
    return true;
}
/** Crea un documento vacío (sin mutaciones) para un ADN dado. */
export function createEmptyCustomVibe(key, baseDNA, name, author = '') {
    const now = Date.now();
    return {
        schemaVersion: LUXVIBE_SCHEMA_VERSION,
        kind: 'luxvibe',
        baseDNA,
        meta: {
            key,
            name,
            description: '',
            icon: 'Dna',
            author,
            createdAt: now,
            updatedAt: now,
            tags: [],
            accentHex: '#00e5ff',
        },
    };
}
