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
 *   [0x7E] [Label=0x06] [Len LSB] [Len MSB] [Payload...] [0xE7]
 */

import type { DMXSendStrategy } from './DMXSendStrategy'
import type { SerialPortInstance } from '../UniversalDMXDriver'

/** Timeout de seguridad para port.drain() — evita deadlock si USB muere */
const DRAIN_TIMEOUT_MS = 100

export class EnttecProStrategy implements DMXSendStrategy {
  readonly name = 'Enttec Pro (Label 6)'

  async send(
    port: SerialPortInstance,
    buffer: Buffer,
    universe: number,
    log: (msg: string) => void,
  ): Promise<void> {
    const dataLen = buffer.length
    const packet = new Uint8Array(dataLen + 5)

    packet[0] = 0x7E        // Start Code
    packet[1] = 0x06        // Label 6: Send DMX Packet
    packet[2] = dataLen & 0xFF          // Length LSB
    packet[3] = (dataLen >> 8) & 0xFF   // Length MSB
    packet.set(buffer, 4)               // Payload (start code DMX + 512 canales)
    packet[packet.length - 1] = 0xE7    // End Code

    return new Promise<void>((resolve) => {
      port.write(packet, (err: Error | null | undefined) => {
        if (err) {
          log(`❌ [Univ ${universe}] Enttec write error: ${err.message}`)
          resolve()
          return
        }

        // Esperar a que el buffer serial se vacíe al hardware.
        // Timeout de seguridad: si el USB muere mid-transmit, no bloqueamos.
        const safety = setTimeout(() => {
          log(`⚠️ [Univ ${universe}] drain timeout (${DRAIN_TIMEOUT_MS}ms) — releasing`)
          resolve()
        }, DRAIN_TIMEOUT_MS)

        port.drain(() => {
          clearTimeout(safety)
          resolve()
        })
      })
    })
  }
}
