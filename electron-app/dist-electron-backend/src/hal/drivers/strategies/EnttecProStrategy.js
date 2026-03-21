/**
 * 🔥 WAVE 3000: ESTRATEGIA ENTTEC PRO (Interfaces Inteligentes)
 *
 * Para interfaces con microcontrolador embebido:
 * - Enttec DMX USB Pro (todas las versiones)
 * - DMXking ultraDMX Pro
 * - Interfaces que entienden el protocolo Enttec (Label 6)
 *
 * El microcontrolador se encarga del timing DMX512:
 * genera BREAK (>88µs) + MAB (>8µs) internamente.
 * Nosotros solo empaquetamos y enviamos.
 *
 * Protocolo:
 *   [0x7E] [Label] [Len LSB] [Len MSB] [Payload...] [0xE7]
 *
 * Labels por universo:
 *   Universo 0 → Label 0x06 (6)   — Send DMX Packet
 *   Universo 1 → Label 0xA9 (169) — Send DMX Packet Port 2
 *                                   (Enttec USB Pro Mk2 / Tornado / IMC UD 7S dual)
 */
/** Timeout de seguridad para port.drain() — evita deadlock si USB muere */
const DRAIN_TIMEOUT_MS = 100;
/** Mapping universo → Label del protocolo Enttec Pro */
const ENTTEC_LABEL = {
    0: 0x06, // Label 6: Send DMX Packet (universo 0)
    1: 0xA9, // Label 169: Send DMX Packet Port 2 (universo 1, Mk2/Tornado/IMC UD 7S)
};
const ENTTEC_LABEL_FALLBACK = 0x06; // cualquier universo mayor → Label 6 (best-effort)
export class EnttecProStrategy {
    constructor() {
        this.name = 'Enttec Pro (Label 6 / 0xA9)';
        this.selfManaged = false;
    }
    async send(port, buffer, universe, log) {
        if (!port) {
            log(`❌ [Univ ${universe}] EnttecPro requires a driver-managed port`);
            return;
        }
        const dataLen = buffer.length;
        const packet = new Uint8Array(dataLen + 5);
        const label = ENTTEC_LABEL[universe] ?? ENTTEC_LABEL_FALLBACK;
        packet[0] = 0x7E; // Start Code
        packet[1] = label; // Label: 0x06 (uni 0) | 0xA9 (uni 1)
        packet[2] = dataLen & 0xFF; // Length LSB
        packet[3] = (dataLen >> 8) & 0xFF; // Length MSB
        packet.set(buffer, 4); // Payload (start code DMX + 512 canales)
        packet[packet.length - 1] = 0xE7; // End Code
        return new Promise((resolve) => {
            port.write(packet, (err) => {
                if (err) {
                    log(`❌ [Univ ${universe}] Enttec write error: ${err.message}`);
                    resolve();
                    return;
                }
                // Esperar a que el buffer serial se vacíe al hardware.
                // Timeout de seguridad: si el USB muere mid-transmit, no bloqueamos.
                const safety = setTimeout(() => {
                    log(`⚠️ [Univ ${universe}] drain timeout (${DRAIN_TIMEOUT_MS}ms) — releasing`);
                    resolve();
                }, DRAIN_TIMEOUT_MS);
                port.drain(() => {
                    clearTimeout(safety);
                    resolve();
                });
            });
        });
    }
}
