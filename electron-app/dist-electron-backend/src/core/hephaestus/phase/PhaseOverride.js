/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚒️ PHASE OVERRIDE — Individual phase per-fixture manual overrides
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * P2#1 / Blueprint: Phase Canvas
 *
 * Permite override manual del offset de fase para fixtures individuales,
 * complementando el motor algorítmico de PhaseConfigPro.
 *
 * Diferenciadores vs MA3:
 *   - Hybrid overlay: delta sobre algoritmo, no either/or
 *   - Bake/Unbake: congelar/descongelar offsets algorítmicos
 *   - Pin: fixture inmune a cambios de spread/shuffle/wings
 *
 * @module core/hephaestus/phase/PhaseOverride
 */
import { resolvePro } from './PhaseConfigPro';
/**
 * Resolver offsets de fase aplicando overrides manuales sobre el baseline algorítmico.
 *
 * Pipeline:
 *   1. Calcular baseline con resolvePro() (blocks, shuffle, wings, symmetry, direction)
 *   2. Aplicar overrides (delta o absolute) fixture por fixture
 *   3. Re-ordenar ASC por offset (preserva cursor cache O(1) amortizado)
 *
 * @param fixtureIds IDs de fixtures en orden canónico
 * @param config Configuración algorítmica (PhaseConfigPro)
 * @param overrides Overrides manuales opcionales
 * @param durationMs Duración del clip en ms
 * @returns Array de FixturePhase ordenado ASC por phaseOffsetMs
 */
export function resolveWithOverrides(fixtureIds, config, overrides, durationMs) {
    const basePhases = resolvePro(fixtureIds, config, durationMs);
    if (!overrides || Object.keys(overrides).length === 0) {
        return basePhases;
    }
    const result = basePhases.map(fp => {
        const ov = overrides[fp.fixtureId];
        if (!ov)
            return fp;
        if (ov.mode === 'absolute') {
            return {
                ...fp,
                phaseOffsetMs: Math.max(0, Math.min(durationMs, ov.offsetMs)),
            };
        }
        // delta: sumar al offset algorítmico
        const final = fp.phaseOffsetMs + ov.offsetMs;
        return {
            ...fp,
            phaseOffsetMs: Math.max(0, Math.min(durationMs, final)),
        };
    });
    result.sort((a, b) => a.phaseOffsetMs - b.phaseOffsetMs);
    return result;
}
/**
 * Bake: convertir offsets algorítmicos actuales en overrides absolute.
 *
 * Toma el resultado de resolvePro() y crea un PhaseOverrideMap donde
 * cada fixture tiene mode='absolute' con su offset actual congelado.
 * Esto permite ajustar manualmente desde una base algorítmica conocida.
 */
export function bakeOverrides(fixtureIds, config, durationMs) {
    const basePhases = resolvePro(fixtureIds, config, durationMs);
    const map = {};
    for (const fp of basePhases) {
        map[fp.fixtureId] = {
            mode: 'absolute',
            offsetMs: fp.phaseOffsetMs,
        };
    }
    return map;
}
/**
 * Unbake: borrar todos los overrides (volver al algoritmo puro).
 * Simplemente retorna un mapa vacío.
 */
export function unbakeOverrides() {
    return {};
}
/**
 * Contar cuántos fixtures tienen override activo.
 */
export function countOverrides(overrides) {
    if (!overrides)
        return 0;
    return Object.keys(overrides).length;
}
