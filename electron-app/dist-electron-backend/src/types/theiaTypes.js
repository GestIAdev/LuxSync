/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🎬 THEIA TYPES — WAVE 4921 (Atomic Paradigm · Fase 1)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Tipos canónicos para el formato `.theia v2.0`. Esta wave abandona el
 * modelo multi-cuepoint de v1 en favor del paradigma ATÓMICO descrito en
 * el blueprint WAVE 4920:
 *
 *   - Un `.theia` = un único loop visual con un único genoma cognitivo.
 *   - El genoma vive EN LA RAÍZ del átomo (sin anidar en cuepoints).
 *   - El recorte temporal se reduce a `trim: { startMs, endMs }`.
 *   - Los átomos se agrupan en `Pack`s (carpetas del filesystem).
 *
 * Importante: este archivo SOLO declara tipos. No expone runtime ni
 * dependencias. Puede ser consumido tanto por main como por renderer.
 * ════════════════════════════════════════════════════════════════════════════
 */
/**
 * Mapa ordinal de zonas energéticas para comparación rápida.
 *
 * `silence` < `valley` < `ambient` < `gentle` < `active` < `intense` < `peak`
 *
 * Usado por `TheiaRegistry.findBestMatch()` para validar
 * `range.min ≤ currentZone ≤ range.max` con O(1) lookup numérico.
 */
export const ENERGY_ZONE_ORDINAL = Object.freeze({
    silence: 0,
    valley: 1,
    ambient: 2,
    gentle: 3,
    active: 4,
    intense: 5,
    peak: 6,
});
// ─── TYPE GUARDS ─────────────────────────────────────────────────────────────
/** Validación runtime: ¿el objeto es un `ITheiaGenome` con valores en [0,1]? */
export function isValidGenome(g) {
    if (!g || typeof g !== 'object')
        return false;
    const x = g;
    return (_in01(x.aggression) &&
        _in01(x.chaos) &&
        _in01(x.organicity));
}
function _in01(n) {
    return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1;
}
