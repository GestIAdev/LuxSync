/**
 * 🏛️ WAVE 212: DMX DRIVER INTERFACE
 *
 * Contract for all DMX output drivers (USB, ArtNet, Mock, etc.)
 *
 * RESPONSIBILITIES:
 * - Define standard interface for DMX communication
 * - Abstract away transport layer (serial, UDP, etc.)
 * - Provide lifecycle methods (connect, send, close)
 * - Enable driver hot-swapping
 *
 * IMPLEMENTATIONS:
 * - USBDMXDriver: Serial/USB interfaces (FTDI, CH340, etc.)
 * - ArtNetDriver: UDP network protocol
 * - MockDriver: Logging-only for development
 */
export {};
