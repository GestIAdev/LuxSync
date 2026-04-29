/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚛️  AETHER MATRIX — INTENT BUS CONTRACTS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 3505.1: El bus de alta velocidad — cero allocations.
 *
 * El IntentBus es el canal de comunicación entre los 5 Systems y
 * el NodeArbiter. Los Systems escriben NodeIntents en el bus;
 * el Arbiter los lee y resuelve conflictos multicapa.
 *
 * DISEÑO ZERO-ALLOC:
 * El bus es un array pre-allocated de MAX_INTENTS_PER_FRAME slots.
 * `clear()` resetea el write pointer a 0 sin desalocar.
 * `push()` escribe en la siguiente posición.
 * `getIntentsForNode()` usa un índice auxiliar reconstruido in-place.
 *
 * Costo de un frame: 0 allocations, 0 GC pressure.
 * Solo escrituras en arrays pre-existentes.
 *
 * @module core/aether/intent-bus
 * @version WAVE 3505.1
 */
export {};
