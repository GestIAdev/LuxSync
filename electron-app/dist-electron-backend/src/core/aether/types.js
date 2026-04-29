/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚛️  AETHER MATRIX — PRIMITIVE TYPES & ENUMS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 3505.1: Los átomos del nuevo universo.
 *
 * Este archivo define las unidades indivisibles del sistema de tipos Aether.
 * Ningún tipo aquí importa de ningún otro módulo — ni legacy, ni externo.
 * Cada símbolo exportado es un contrato inmutable que los sistemas superiores
 * (NodeGraph, IntentBus, Systems) consumen sin poder alterar.
 *
 * PRINCIPIO: "Si no puedes expresarlo como un tipo primitivo, un enum
 * o un type alias, no pertenece aquí."
 *
 * @module core/aether/types
 * @version WAVE 3509.1 — GOD EAR SYNC (7-Band Alignment)
 */
// ═══════════════════════════════════════════════════════════════════════════
// NODE FAMILY — Las cinco familias de capacidad
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Las cinco familias fundamentales de nodos de capacidad.
 *
 * Cada familia define un dominio físico de control que un System
 * del motor entiende nativamente. Un canal DMX pertenece a
 * **exactamente una familia** — no hay canales compartidos.
 *
 * - `COLOR`      → Dominio cromático (RGB, RGBW, CMY, rueda de colores)
 * - `IMPACT`     → Dominio de intensidad y ruptura de luz (dimmer, shutter, strobe)
 * - `KINETIC`    → Dominio de movimiento mecánico (pan, tilt, rotation)
 * - `BEAM`       → Dominio de conformación de haz (zoom, focus, gobo, prism, frost)
 * - `ATMOSPHERE` → Dominio de efectos ambientales no lumínicos (humo, chispas, ventiladores)
 */
export var NodeFamily;
(function (NodeFamily) {
    /** Dominio cromático: R, G, B, W, Amber, UV, CTO, CTB, CMY, color_wheel */
    NodeFamily["COLOR"] = "COLOR";
    /** Dominio de intensidad: dimmer, shutter, strobe — física reactiva al audio */
    NodeFamily["IMPACT"] = "IMPACT";
    /** Dominio cinético: pan, tilt, pan_fine, tilt_fine, speed, rotation */
    NodeFamily["KINETIC"] = "KINETIC";
    /** Dominio de conformación de haz: zoom, focus, iris, frost, gobo, prism */
    NodeFamily["BEAM"] = "BEAM";
    /** Dominio atmosférico: pump, fan, spark — controlado por cues, no por frame */
    NodeFamily["ATMOSPHERE"] = "ATMOSPHERE";
})(NodeFamily || (NodeFamily = {}));
