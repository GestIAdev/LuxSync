/**
 * ⚡ WAVE 3504-EXT.3 — GatedNeedlePipeline
 *
 * Puro. Sin estado. Sin side-effects.
 * Los 4 pasos del needle pipeline para detección de kicks de bajo.
 *
 * Extraído de senses.ts (WAVE 2160/2169/2170/2491).
 * El estado mutable (adaptiveFloor, prevEnergies) queda en el caller —
 * este módulo recibe todo por parámetro y devuelve un resultado inmutable.
 *
 * Sin dependencia de parentPort, IPC, SharedRingBuffer ni Worker Thread.
 *
 * ───── Historia ─────────────────────────────────────────────────────────────
 * WAVE 2159-2165: Cementerio de filtros — 7 intentos fallidos
 * WAVE 2160:      Raw low flux only → debounce comía offbeats
 * WAVE 2169 REV1: Centroid-based gate (reemplaza Bozal midFlux)
 * WAVE 2170:      Hardcoded floor 0.030 para Boris Brejcha
 * WAVE 2491:      Adaptive floor 40% de mediana — calibra con la fuente real
 * ────────────────────────────────────────────────────────────────────────────
 */
// ============================================
// IMPLEMENTACIÓN — PURA
// ============================================
/**
 * Ejecuta el pipeline completo de detección de kick en 4 pasos:
 *
 * 1. BRUTE FORCE FLUX — rising edges only (la cola de decay no pasa)
 * 2. CENTROID-BASED GATE — distingue kick (<800Hz) de hihat (>1500Hz)
 * 3. SNIPER GUARD — redundant bright-transient kill
 * 4. Shadow Logger hook data (devuelto para que el caller lo use)
 *
 * Invariantes:
 * - needle > 0 solo si rawBassFlux > currentFloor Y centroid < 1500Hz
 * - centroid > 1500Hz siempre produce needle = 0 (el sniper es redundante)
 * - no hay estado global — todo el estado entra por parámetro
 *
 * @param input  Energías del frame actual + estado previo + floor adaptativo
 * @returns      NeedleOutput con el needle limpio y los nuevos valores previos
 */
export function processNeedle(input) {
    const { rawSubBassEnergy, rawBassOnlyEnergy, rawMidEnergy, spectralCentroid, prevSubEnergy, prevBassOnlyEnergy, prevMidEnergy, currentFloor, } = input;
    // ── Step 1: BRUTE FORCE FLUX (onset energy — rising edges only) ────────
    // Sólo las subidas cuentan: Math.max(0, current - prev)
    // La cola de decay exponencial del kick queda en 0 → el tracker
    // ve pulsos de 1 frame de ancho, no las colas de 3-5 frames que
    // causaban jitter en el BPM (WAVE 2169).
    const rawLowFlux = Math.max(0, rawSubBassEnergy - prevSubEnergy);
    const bassOnlyFlux = Math.max(0, rawBassOnlyEnergy - prevBassOnlyEnergy);
    const rawMidFlux = Math.max(0, rawMidEnergy - prevMidEnergy);
    // Full bass flux = sub-bass flux + bass-only flux (20-250Hz onset)
    const rawBassFlux = rawLowFlux + bassOnlyFlux;
    // ── Step 2: CENTROID-BASED GATE (WAVE 2169 REV1) ───────────────────────
    //
    // El Bozal midFlux (WAVE 2170 original) mataba los kicks de minimal
    // techno (Boris Brejcha) porque son SUB-BASS PURE con centroid 60-200Hz
    // → midFlux ≈ 0 → Bozal los bloqueaba todos.
    //
    // Nueva lógica: el centroide espectral es un árbitro físico y determinista.
    //
    //   centroid < 800Hz     → transiente puro de sub/bass → PASS (es un kick)
    //   centroid 800-1500Hz  → zona gris → PASS solo si bassFlux significativo
    //   centroid > 1500Hz    → transiente brillante → SNIPE (hi-hat, platillo)
    //
    // El threshold de zona gris escala con el floor para ser proporcional
    // al rango dinámico de la fuente de audio.
    const greyZoneThreshold = currentFloor * 1.33;
    let needle = 0;
    if (rawBassFlux > currentFloor) {
        if (spectralCentroid < 800) {
            // Zona de kick puro: sub-bass/bass territory
            needle = rawBassFlux;
        }
        else if (spectralCentroid < 1500) {
            // Zona gris: kick + snare overlap o bajo guitarra
            if (rawBassFlux > greyZoneThreshold) {
                needle = rawBassFlux;
            }
        }
        // centroid >= 1500Hz → bright transient (hi-hat, platillo, snare top) → needle = 0
    }
    // ── Step 3: THE SNIPER (El Francotirador) — redundant bright guard ──────
    // Belt-and-suspenders: si un transiente brillante pasó la zona gris
    // por algún motivo (snare con mucho low-end empujando el centroid al borde),
    // lo matamos aquí si el centroid es claramente brillante.
    if (needle > 0.015 && spectralCentroid > 1500) {
        needle = 0; // SNIPED — bright transient, not a kick
    }
    return {
        needle,
        rawLowFlux,
        rawMidFlux,
        rawBassFlux,
        newPrevSubEnergy: rawSubBassEnergy,
        newPrevBassOnlyEnergy: rawBassOnlyEnergy,
        newPrevMidEnergy: rawMidEnergy,
    };
}
