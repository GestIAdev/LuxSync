/**
 * 🏛️ WAVE 201: DMX PACKET
 *
 * Define la salida del HAL (HardwareAbstraction).
 * El HAL recibe LightingIntent y produce SOLO estos tipos.
 *
 * REGLA: El HAL es el ÚNICO que conoce direcciones DMX y canales específicos.
 *        Traduce intenciones abstractas a valores concretos de hardware.
 *
 * @layer HAL → HARDWARE
 * @version TITAN 2.0
 */
// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTES DMX
// ═══════════════════════════════════════════════════════════════════════════
/** Número de canales por universo DMX */
export const DMX_CHANNELS_PER_UNIVERSE = 512;
/** Valor mínimo DMX */
export const DMX_MIN_VALUE = 0;
/** Valor máximo DMX */
export const DMX_MAX_VALUE = 255;
// ═══════════════════════════════════════════════════════════════════════════
// FACTORY / HELPERS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Crea un universo DMX vacío (todos los canales en 0)
 */
export function createEmptyUniverse(universeNumber) {
    return {
        number: universeNumber,
        channels: new Uint8Array(DMX_CHANNELS_PER_UNIVERSE),
        lastUpdate: Date.now(),
    };
}
/**
 * Crea un DMXOutput vacío
 */
export function createEmptyDMXOutput() {
    return {
        universes: new Map(),
        timestamp: Date.now(),
    };
}
/**
 * Aplica un DMXPacket a un universo
 */
export function applyPacketToUniverse(universe, packet) {
    const startIndex = packet.address - 1; // Convertir a 0-indexed
    for (let i = 0; i < packet.channels.length; i++) {
        const channelIndex = startIndex + i;
        if (channelIndex >= 0 && channelIndex < DMX_CHANNELS_PER_UNIVERSE) {
            universe[channelIndex] = Math.max(DMX_MIN_VALUE, Math.min(DMX_MAX_VALUE, Math.round(packet.channels[i])));
        }
    }
}
/**
 * Clamp de valor DMX
 * ⚡ WAVE 2750: NaN BOMB SHIELD — NaN/Infinity ya no pasan.
 */
export function clampDMX(value) {
    if (!Number.isFinite(value))
        return DMX_MIN_VALUE;
    return Math.max(DMX_MIN_VALUE, Math.min(DMX_MAX_VALUE, Math.round(value)));
}
