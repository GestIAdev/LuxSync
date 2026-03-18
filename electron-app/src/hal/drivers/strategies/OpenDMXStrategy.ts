/**
 * 🔧 WAVE 3000+: ESTRATEGIA OPEN DMX (FTDI Genérico / Cable Tonto)
 *
 * Para interfaces SIN microcontrolador:
 * - Enttec Open DMX USB
 * - Clones chinos FTDI directos
 * - Cualquier cable USB-Serial con chip FTDI/CH340/PL2303
 *
 * PROTOCOLO: port.set({ brk }) + setTimeout fijo.
 *
 * El puerto abre y permanece SIEMPRE a 250000 baudios. No tocamos
 * el baudRate en runtime — ese era el origen del DMX Starvation
 * (el cambio constante de baudios a 30Hz saturaba el VCP de Windows
 * haciendo que el 2R entrara/saliera del modo Safety entre frames).
 *
 * TIMING:
 *   BREAK  = 2ms (estándar >88µs — usamos 2ms para máxima compatibilidad)
 *   MAB    = 1ms (Mark After Break, estándar >8µs)
 *
 * ADVERTENCIA FTDI Windows:
 *   Los callbacks de port.set() y port.drain() a menudo NO se disparan
 *   en drivers FTDI genéricos / clones bajo Windows VCP. Ignoramos sus
 *   callbacks y forzamos el timing con setTimeout nativo de Node.js
 *   para no bloquear el event loop.
 */

import type { DMXSendStrategy } from './DMXSendStrategy'
import type { SerialPortInstance } from '../UniversalDMXDriver'

export class OpenDMXStrategy implements DMXSendStrategy {
  readonly name = 'Open DMX (port.set BREAK)'

  async send(
    port: SerialPortInstance,
    buffer: Buffer,
    universe: number,
    log: (msg: string) => void,
  ): Promise<void> {
    const portAny = port as any

    // Si el puerto no expone port.set (driver muy básico), fallback sin BREAK
    if (typeof portAny.set !== 'function') {
      log(`⚠️ [Univ ${universe}] port.set() unavailable — sending raw (no BREAK)`)
      return this.sendRaw(port, buffer, universe, log)
    }

    return new Promise<void>((resolve) => {
      // PASO 1: Activar BREAK — línea LOW prolongada.
      // Ignoramos el callback: en FTDI Windows VCP suele causar deadlock.
      portAny.set({ brk: true }, () => {})

      // PASO 2: Mantener BREAK 2ms (protocolo DMX: mínimo 88µs, 2ms = muy seguro)
      setTimeout(() => {
        // PASO 3: Desactivar BREAK (MAB — Mark After Break).
        // Mismo motivo: ignoramos el callback.
        portAny.set({ brk: false }, () => {})

        // PASO 4: Esperar 1ms para el MAB, luego inyectar el buffer a 250k fijos
        setTimeout(() => {
          port.write(buffer, (err: any) => {
            if (err) {
              log(`❌ [Univ ${universe}] DMX write error: ${err.message}`)
            }
            // Resolvemos inmediatamente tras el write.
            // NO usamos port.drain() — causa bloqueos infinitos en clones FTDI.
            // Node/serialport gestiona la cola de salida internamente.
            resolve()
          })
        }, 1)
      }, 2)
    })
  }

  private sendRaw(
    port: SerialPortInstance,
    buffer: Buffer,
    universe: number,
    log: (msg: string) => void,
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      port.write(buffer, (err: Error | null | undefined) => {
        if (err) {
          log(`❌ [Univ ${universe}] raw write error: ${err.message}`)
        }
        resolve()
      })
    })
  }
}
