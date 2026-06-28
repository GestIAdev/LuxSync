/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚙️ HEPHAESTUS PRO PHASE ENGINE — WAVE 7001
 * Motor matemático de distribución de fase de grado militar.
 * Módulo puro: cero dependencias de Zustand, React, o UI.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export const DEFAULT_PHASE_CONFIG_PRO = {
    spreadDeg: 0,
    symmetry: 'linear',
    wings: 1,
    blocks: 1,
    shuffle: 0,
    shuffleSeed: 1,
    direction: 1,
};
// ═══════════════════════════════════════════════════════════════════════════
// FUNCIONES PURAS
// ═══════════════════════════════════════════════════════════════════════════
/** Hash determinista [0,1) — sin estado, reproducible. */
function hash01(seed, k) {
    const x = Math.sin(k * 127.1 + seed * 311.7) * 43758.5453;
    return x - Math.floor(x); // fract
}
function fract(x) {
    return x - Math.floor(x);
}
/** Simetría: [0,1] → [0,1] */
function applySymmetry(u, mode) {
    switch (mode) {
        case 'linear': return u;
        case 'mirror': return 1 - Math.abs(2 * u - 1); // pico al centro
        case 'center-out': return Math.abs(2 * u - 1); // valle al centro
        default: return u;
    }
}
/**
 * Calcula el offset de fase (en ms) para UNA fixture.
 * Función pura: mismos inputs → mismo output. Sin side-effects.
 *
 * @param index        Índice físico de la fixture (0-based) en el grupo resuelto.
 * @param totalFixtures Tamaño del grupo.
 * @param config       Configuración Pro.
 * @param durationMs   Duración del clip (1 ciclo de animación).
 */
export function computeOffsetPro(index, totalFixtures, config, durationMs) {
    if (totalFixtures <= 1 || config.spreadDeg === 0)
        return 0;
    const spreadDeg = Math.max(0, Math.min(1440, config.spreadDeg));
    const blocks = Math.max(1, Math.floor(config.blocks));
    const wings = Math.max(1, config.wings);
    const shuffle = Math.max(0, Math.min(1, config.shuffle));
    // ① BLOCKING — división entera cuantiza el índice
    const iBlock = Math.floor(index / blocks);
    const nBlock = Math.ceil(totalFixtures / blocks);
    if (nBlock <= 1)
        return 0; // un solo bloque → todos en fase
    // ② SHUFFLE — mezcla ordenado ↔ caótico determinista
    const iRandom = hash01(config.shuffleSeed, iBlock) * (nBlock - 1);
    const iEff = (1 - shuffle) * iBlock + shuffle * iRandom;
    // ③ NORMALIZE → [0,1]
    const u = iEff / (nBlock - 1);
    // ④ SYMMETRY
    const s = applySymmetry(u, config.symmetry);
    // ⑤ WINGS — frecuencia espacial, parte fraccionaria continua
    const w = wings === 1 ? s : fract(s * wings);
    // ⑥ DIRECTION
    const d = config.direction === -1 ? 1 - w : w;
    // ⑦ SPREAD → TIME (grados de ciclo → ms)
    return d * (spreadDeg / 360) * durationMs;
}
export function resolvePro(fixtureIds, config, durationMs) {
    const N = fixtureIds.length;
    const out = new Array(N);
    for (let i = 0; i < N; i++) {
        const offset = computeOffsetPro(i, N, config, durationMs);
        out[i] = {
            fixtureId: fixtureIds[i],
            phaseOffsetMs: offset,
            normalizedIndex: N > 1 ? i / (N - 1) : 0,
        };
    }
    // Orden ASC por offset → garantiza queries temporales monótonas
    out.sort((a, b) => a.phaseOffsetMs - b.phaseOffsetMs);
    return out;
}
