/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 4709: ChillAmbientEngine — BEATFREQ PURGE — THE MANUAL OVERRIDE RESCUE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Motor de modulación de envelope para chill — DESPOJADO de generación de dimmer.
 *
 * FILOSOFÍA:
 *   Las ondas senoidales de intensidad bypasseaban L2 manual. FULMINADAS.
 *   Ahora: Solo morphFactor (control de decay en LiquidEngine) — nada de dimmer.
 *   Tu control L2 de faders manual RESPETADO por HTP.
 *
 * ARQUITECTURA:
 *   - Desconectado del audio. No lee bandas espectrales.
 *   - Usa performance.now() para generar UNA SOLA onda de 30s para morphFactor.
 *   - morphFactor ∈ [0.30, 0.70] modula envelopes en LiquidEngine71.
 *   - **CHANGE WAVE 4709**: Removidas ondas por zona (frontL, frontR, backL, backR).
 *   - Intensidades vienen del LiquidEngine normal → HTP aplica correctamente a L2.
 *
 * RESULTADO:
 *   - Pares OBEDECEN tu fader manual de dimmer.
 *   - Luz ambiental sigue "respirando" vía envelopes + morphFactor.
 *   - Sin beat-sync que ignora L2.
 *
 * USAGE:
 *   import { chillAmbientEngine } from './ChillAmbientEngine'
 *   const frame = chillAmbientEngine.tick()
 *   // frame.morphFactor en [0.30, 0.70]
 *   // (frontL, backL, etc. ELIMINADAS — usan LiquidEngine normal)
 *
 * @module hal/physics/ChillAmbientEngine
 * @version WAVE 4709 — BEATFREQ PURGE
 * @author PunkOpus
 */
// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Período de la onda de morphFactor en segundos.
 * WAVE 4709: Solo hay UN oscillador ahora (morphFactor).
 * Las intensidades de zona vienen del LiquidEngine normal.
 */
const MORPH_PERIOD_S = 30.0;
// ═══════════════════════════════════════════════════════════════════════════
// ENGINE CLASS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Motor de morphFactor para chill — 100% determinista, 0% FFT, 0% azar.
 * WAVE 4709: Despojado de generación de dimmer.
 * Solo genera morphFactor para modular envelopes en LiquidEngine71.
 */
export class ChillAmbientEngine {
    /**
     * Genera un frame con morphFactor basado únicamente en el tiempo.
     * Llamar una vez por frame de render (60fps → ~16ms).
     * Idempotente para el mismo t: si se llama dos veces en el mismo ms, retorna lo mismo.
     */
    tick() {
        const tMs = performance.now();
        const tSec = tMs / 1000;
        // ── MorphFactor — onda lenta de 30s → [0.30, 0.70] ──────────────────────
        // Oscilador única de modulación. Controla decay/sustain en LiquidEngine.
        const morphRaw = (Math.sin((2 * Math.PI * tSec) / MORPH_PERIOD_S) + 1) / 2; // [0, 1]
        const morphFactor = 0.30 + morphRaw * 0.40; // [0.30, 0.70]
        return { morphFactor, _ts: tMs };
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════
/** Singleton global — una sola instancia para todo el proceso. */
export const chillAmbientEngine = new ChillAmbientEngine();
