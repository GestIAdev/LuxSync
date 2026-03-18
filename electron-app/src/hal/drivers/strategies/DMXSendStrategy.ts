/**
 * 🏛️ WAVE 3000: DMX SEND STRATEGY INTERFACE
 * 
 * Patrón Estrategia para el envío DMX.
 * Cada tipo de interfaz USB habla un protocolo diferente:
 * 
 * - Enttec Pro / Interfaces inteligentes: Protocolo empaquetado (Label 6)
 *   El microcontrolador genera BREAK+MAB internamente.
 * 
 * - Open DMX / FTDI genérico: Raw buffer con BREAK manual vía port.set()
 *   El chip es un cable tonto: nosotros controlamos el voltaje.
 */

import type { SerialPortInstance } from '../UniversalDMXDriver'

export interface DMXSendStrategy {
  /** Nombre humano de la estrategia (para logs) */
  readonly name: string

  /**
   * Envía un buffer DMX completo (513 bytes: start code + 512 canales)
   * a un puerto serial abierto.
   * 
   * @param port - Puerto serial abierto (serialport)
   * @param buffer - Buffer DMX de 513 bytes (buf[0]=start code, buf[1..512]=canales)
   * @param universe - Número de universo (para logging)
   * @param log - Función de logging del driver
   * @returns Promise que resuelve cuando el hardware terminó de transmitir
   */
  send(
    port: SerialPortInstance,
    buffer: Buffer,
    universe: number,
    log: (msg: string) => void,
  ): Promise<void>
}
