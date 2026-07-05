/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 6055: ChillAmbientEngine — OPERACIÓN OCÉANO (SIN SALTOS)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Motor continuo para chill. Cero EMA. Cero estado acumulado.
 * Base de tiempo absoluta: performance.now() / 1000 — función pura de t.
 *
 * ARQUITECTURA (WAVE 6055 — OPERACIÓN OCÉANO):
 *
 *   1. MORPH GLOBAL (El Pulso del Océano)
 *      Superposición de 2 senos: ciclo de 200s (rápido) y 600s (lento).
 *      morphFactor ∈ [0.20, 0.80] — suelo 0.20 para evitar blackout.
 *      Sin EMA: los senos son continuos por definición, no necesitan post-proceso.
 *
 *   2. LA OLA (Offsets Zonales de Intensidad)
 *      Ola que cruza la sala: frontL → frontR → backL → backR.
 *      Formula: zone = BASE + AMP × sin(t/vel + phaseOffset)
 *      Período base: 240 segundos (4 minutos). Paso de fase: 0.5 rad entre zonas.
 *      Intensidad zonal ∈ [BASE−AMP, BASE+AMP] = [0.10, 0.60].
 *      Enrutado a liquidStereoOverrides en SeleneLux (chill path).
 *
 *   3. MICRO-DRIFT BOREAL (Caústicas de Agua)
 *      WAVE 7129.3: Reemplaza el Lissajous amplio por un Micro-Drift sutil.
 *      Pan:  0.50 + sin(t / 120) × 0.015  → ±1.5% alrededor del centro
 *      Tilt: 0.70 + cos(t / 180) × 0.010  → ±1.0% alrededor del reposo elevado
 *      Períodos: 120s pan (2π×120 ≈ 754s), 180s tilt (2π×180 ≈ 1131s).
 *      Simula reflejos de agua — caústicas que se mueven imperceptiblemente.
 *      Mover R: offset +2/3 ciclo en pan, +1/2 ciclo en tilt.
 *      Salida normalizada [0, 1] para buildMechanicsBypassIntent (WAVE 1046).
 *      Enrutado a deepFieldMechanics en SeleneLux (chill path).
 *
 * ROUTING COMPLETO:
 *   morphFactor  → LiquidEngine71.morphFactorOverride  (SeleneLux)
 *   dimmer       → dimmerOverride                       (SeleneLux)
 *   frontL/R     → liquidStereoOverrides.frontL/R       (SeleneLux, post-liquid)
 *   backL/R      → liquidStereoOverrides.backL/R        (SeleneLux, post-liquid)
 *   moverL/R     → deepFieldMechanics                   (SeleneLux)
 *                  → buildMechanicsBypassIntent          (MovementGenerators)
 *                  → NodeArbiter @layer 'selene' (L0)
 *   L2 OPERADOR MANUAL: siempre domina sobre L0 (NodeArbiter WAVE 4829).
 *
 * @module hal/physics/ChillAmbientEngine
 * @version WAVE 7129 — BOREAL OCEAN
 */
// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════
const TWO_PI = 2 * Math.PI;
// ── 1. MORPH GLOBAL ────────────────────────────────────────────────────────
/** Período del seno rápido (s) — pulso principal del océano (WAVE 7129: 200s) */
const MORPH_FAST_PERIOD_S = 200.0;
/** Período del seno lento (s) — respiración profunda (WAVE 7129: 600s = 10 min) */
const MORPH_SLOW_PERIOD_S = 600.0;
/** Peso del seno rápido en la suma ponderada */
const MORPH_FAST_WEIGHT = 0.60;
/** Peso del seno lento en la suma ponderada */
const MORPH_SLOW_WEIGHT = 0.40;
/** Piso del dimmer — evita blackout total en el valle del seno */
const MORPH_FLOOR = 0.20;
/** Rango dinámico sobre el piso */
const MORPH_RANGE = 0.60; // → morphFactor ∈ [0.20, 0.80]
// ── 2. LA OLA — Offsets Zonales ────────────────────────────────────────────
/** Período de la ola (s) — tiempo en que la ola cruza la sala de front a back (WAVE 7129: 240s = 4 min) */
const TIDE_PERIOD_S = 240.0;
/**
 * Velocidad de fase: v = T / (2π) → sin(t / v) tiene período exactamente T.
 * v ≈ 9.55 s/rad → sin(t / 9.55) cruza un ciclo completo en 60 segundos.
 */
const TIDE_VELOCITY = TIDE_PERIOD_S / TWO_PI;
/** Intensidad base de cada zona: siempre visible, nunca en negro */
const WAVE_BASE = 0.35;
/** Amplitud de la ola sobre la base → zona ∈ [0.10, 0.60] */
const WAVE_AMPLITUDE = 0.25;
/** Offsets de fase por zona (rad) — La Ola va de front izq. a back der. */
const WAVE_PHASE_FRONT_L = 0.0;
const WAVE_PHASE_FRONT_R = 0.5;
const WAVE_PHASE_BACK_L = 1.0;
const WAVE_PHASE_BACK_R = 1.2;
// ── 3. MICRO-DRIFT BOREAL — Caústicas ─────────────────────────────────────
/**
 * Constante de tiempo del pan (s) — WAVE 7129: Micro-Drift.
 * sin(t / 120) → período = 2π × 120 ≈ 754 s (~12.6 min por ciclo completo).
 */
const MOVER_PAN_TAU = 120.0;
/**
 * Constante de tiempo del tilt (s) — WAVE 7129: Micro-Drift.
 * cos(t / 180) → período = 2π × 180 ≈ 1131 s (~18.8 min por ciclo completo).
 * Ratio pan/tilt = 180/120 = 3/2 → deriva lenta nunca repetitiva.
 */
const MOVER_TILT_TAU = 180.0;
/** Reposo elevado del pan — los beams apuntan ligeramente al centro-superior */
const MOVER_PAN_REST = 0.50;
/** Reposo elevado del tilt — caústicas desde arriba */
const MOVER_TILT_REST = 0.70;
/** Amplitud del micro-drift en pan: ±1.5% (reflejos de agua) */
const MOVER_PAN_AMPLITUDE = 0.015;
/** Amplitud del micro-drift en tilt: ±1.0% (reflejos de agua) */
const MOVER_TILT_AMPLITUDE = 0.010;
/**
 * Offset de fase del mover R respecto al mover L (rad).
 * TWO_PI × 0.667 ≈ 4.19 rad → los beams se cruzan en el aire dos veces
 * por ciclo pero nunca son imagen especular exacta (evita la simetría aburrida).
 */
const MOVER_R_PAN_OFFSET = TWO_PI * 0.667;
/** Offset tilt del mover R: π rad → media vuelta de desfase en tilt */
const MOVER_R_TILT_OFFSET = TWO_PI * 0.500;
// ═══════════════════════════════════════════════════════════════════════════
// ENGINE CLASS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * WAVE 6055 — Operación Océano.
 * Motor 100% continuo para chill. Cero estado acumulado. Cero EMA.
 * Cada tick es función pura de performance.now() — reproducible para el mismo t.
 */
export class ChillAmbientEngine {
    /**
     * Genera un frame completo: morph global, La Ola zonal, y Glaciar Movers.
     * Llamar una vez por frame (44–60 Hz). Idempotente para el mismo ms.
     */
    tick() {
        const tMs = performance.now();
        const t = tMs / 1000; // base de tiempo continua en segundos
        // ── 1. MORPH GLOBAL — 2 senos directos, sin EMA ─────────────────────────
        // Cada seno en [0, 1]; suma ponderada en [0, 1]; mapeada a [FLOOR, FLOOR+RANGE].
        const morph1 = (Math.sin((TWO_PI * t) / MORPH_FAST_PERIOD_S) + 1) / 2;
        const morph2 = (Math.sin((TWO_PI * t) / MORPH_SLOW_PERIOD_S) + 1) / 2;
        const combined = morph1 * MORPH_FAST_WEIGHT + morph2 * MORPH_SLOW_WEIGHT;
        const morphFactor = MORPH_FLOOR + combined * MORPH_RANGE;
        // ── 2. LA OLA — offsets de fase por zona ─────────────────────────────────
        // wavePh = t / TIDE_VELOCITY avanza a razón de 1 rad cada ~9.55s.
        // La ola empieza en frontL y llega a backR con 1.2 rad de desfase total
        // ≈ ~11.5 segundos de retraso de borde a borde de la sala.
        const wavePh = t / TIDE_VELOCITY;
        const frontL = WAVE_BASE + WAVE_AMPLITUDE * Math.sin(wavePh + WAVE_PHASE_FRONT_L);
        const frontR = WAVE_BASE + WAVE_AMPLITUDE * Math.sin(wavePh + WAVE_PHASE_FRONT_R);
        const backL = WAVE_BASE + WAVE_AMPLITUDE * Math.sin(wavePh + WAVE_PHASE_BACK_L);
        const backR = WAVE_BASE + WAVE_AMPLITUDE * Math.sin(wavePh + WAVE_PHASE_BACK_R);
        // ── 3. MICRO-DRIFT BOREAL — Caústicas de agua ───────────────────────────
        // WAVE 7129.3: Reposo elevado + micro-oscilación ±1.5% pan / ±1.0% tilt.
        // Simula reflejos de agua moviéndose imperceptiblemente.
        const panL_raw = Math.sin(t / MOVER_PAN_TAU);
        const tiltL_raw = Math.cos(t / MOVER_TILT_TAU);
        const panR_raw = Math.sin(t / MOVER_PAN_TAU + MOVER_R_PAN_OFFSET);
        const tiltR_raw = Math.cos(t / MOVER_TILT_TAU + MOVER_R_TILT_OFFSET);
        const moverL = {
            pan: MOVER_PAN_REST + panL_raw * MOVER_PAN_AMPLITUDE,
            tilt: MOVER_TILT_REST + tiltL_raw * MOVER_TILT_AMPLITUDE,
        };
        const moverR = {
            pan: MOVER_PAN_REST + panR_raw * MOVER_PAN_AMPLITUDE,
            tilt: MOVER_TILT_REST + tiltR_raw * MOVER_TILT_AMPLITUDE,
        };
        return {
            morphFactor,
            dimmer: morphFactor,
            frontL, frontR, backL, backR,
            moverL, moverR,
            _ts: tMs,
        };
    }
    /**
     * No-op. WAVE 6055 es stateless — no hay EMA que resetear.
     * Mantenido por compatibilidad con la API de WAVE 4750.
     */
    reset() {
        // Stateless por diseño — performance.now() es la única fuente de verdad.
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════
/** Singleton global — una sola instancia para todo el proceso. */
export const chillAmbientEngine = new ChillAmbientEngine();
