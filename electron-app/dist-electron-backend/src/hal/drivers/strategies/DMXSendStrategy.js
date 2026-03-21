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
export {};
