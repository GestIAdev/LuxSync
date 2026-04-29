/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚛️  AETHER MATRIX — DEVICE DEFINITION CONTRACTS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 3505.1: La carcasa física — el contenedor inerte.
 *
 * Un Device es la representación de un aparato físico (fixture) en
 * el Aether. Pero a diferencia del modelo legacy donde el fixture
 * era la entidad principal, aquí el Device es solo un empaquetado:
 * agrupa N CapabilityNodes que comparten dirección DMX base y universo.
 *
 * El Device solo existe en dos momentos:
 * 1. PATCH TIME  — La Forja define el Device y genera sus nodos.
 * 2. FLUSH TIME  — El NodeResolver reagrupa nodos por DeviceId
 *                  para ensamblar paquetes DMX.
 *
 * Entre patch y flush, el motor solo ve nodos.
 *
 * @module core/aether/device
 * @version WAVE 3505.1
 */
export {};
