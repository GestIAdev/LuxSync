/**
 * 🏛️ WAVE 3000 + WAVE 2021.1: DMX SEND STRATEGY INTERFACE
 * 
 * Patrón Estrategia para el envío DMX.
 * Cada tipo de interfaz USB habla un protocolo diferente:
 * 
 * - Enttec Pro / Interfaces inteligentes: Protocolo empaquetado (Label 6)
 *   El microcontrolador genera BREAK+MAB internamente.
 *   Recibe el SerialPort del driver (driver-managed).
 * 
 * - Open DMX / FTDI genérico: Raw buffer con BREAK manual vía port.set()
 *   Corre en un worker_threads dedicado para no bloquear el Event Loop.
 *   Maneja su propio SerialPort (self-managed).
 */

import type { SerialPortInstance } from '../UniversalDMXDriver'

export interface DMXSendStrategy {
  /** Nombre humano de la estrategia (para logs) */
  readonly name: string

  /**
   * true = la estrategia abre/cierra su propio puerto serial.
   *        El driver NO debe crear SerialPort ni pasarlo a send().
   * false = el driver crea el SerialPort y lo pasa a send() como antes.
   */
  readonly selfManaged: boolean

  /**
   * Envía un buffer DMX completo (513 bytes: start code + 512 canales)
   * a un puerto serial abierto.
   * 
   * @param port - Puerto serial abierto (solo si selfManaged=false, null si selfManaged=true)
   * @param buffer - Buffer DMX de 513 bytes (buf[0]=start code, buf[1..512]=canales)
   * @param universe - Número de universo (para logging)
   * @param log - Función de logging del driver
   * @returns Promise que resuelve cuando el hardware terminó de transmitir
   */
  send(
    port: SerialPortInstance | null,
    buffer: Buffer,
    universe: number,
    log: (msg: string) => void,
  ): Promise<void>

  /**
   * Abre la conexión serial internamente (solo selfManaged=true).
   * El driver llama esto en lugar de crear su propio SerialPort.
   */
  connect?(portPath: string, universe: number, log: (msg: string) => void): Promise<boolean>

  /**
   * Cierra la conexión y libera recursos (worker, puerto, etc.).
   * El driver llama esto en disconnectUniverse.
   */
  destroy?(log: (msg: string) => void): Promise<void>

  /**
   * 🧹 WAVE 3080: Purga el buffer DMX interno a cero (cambio de show).
   * Solo implementado por estrategias self-managed (OpenDMX) que mantienen
   * buffer propio en un proceso/worker separado.
   * Nadie sobrevive al cambio de show.
   */
  resetBuffer?(log: (msg: string) => void): void
}
