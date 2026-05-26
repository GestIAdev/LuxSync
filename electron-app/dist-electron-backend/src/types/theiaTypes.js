/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🎬 THEIA TYPES — WAVE 4901 (Phase 1/3 of WAVE-4900-THEIADNA)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Tipos canónicos para el formato `.theia v1.0`. Este módulo es la fuente
 * de verdad estructural — paralelo a `core/arsenal/lfxTypes.ts` para `.lfx`.
 *
 * PRINCIPIO RECTOR (WAVE 4900):
 *   El `.theia` HEREDA el genoma cognitivo de `.lfx V3`. Selene no aprende
 *   dos vocabularios — aprende uno y lo aplica a dos dominios (luz / vídeo).
 *
 *   - `ITheiaGenome` ≡ shape de `FrozenGenome` (`lfxTypes.ts`).
 *   - `EnergyZone` reusado de `core/protocol/MusicalContext.ts`.
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
