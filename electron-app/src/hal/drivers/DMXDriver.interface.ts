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

import type { DMXPacket, DMXOutput } from '../../core/protocol'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Driver connection state */
export type DriverState = 
  | 'disconnected'    // Not connected
  | 'connecting'      // Connection in progress
  | 'connected'       // Ready to send
  | 'error'           // Connection failed
  | 'reconnecting'    // Auto-reconnect in progress

/** Driver configuration common to all implementations */
export interface DriverConfig {
  /** Refresh rate in Hz (typically 30-44) */
  refreshRate: number
  /** Enable auto-reconnect on disconnect */
  autoReconnect: boolean
  /** Delay between reconnect attempts in ms */
  reconnectDelay: number
  /** Enable debug logging */
  debug: boolean
}

/** Status information for UI display */
export interface DriverStatus {
  state: DriverState
  type: 'usb' | 'artnet' | 'mock'
  deviceName: string
  framesSent: number
  lastSendTime: number
  errors: number
  avgLatency: number
}

/** Events emitted by drivers */
export interface DriverEvents {
  'connected': (deviceName: string) => void
  'disconnected': (reason: string) => void
  'error': (error: Error) => void
  'frame-sent': (universe: number, channels: number) => void
  'reconnecting': (attempt: number) => void
}

// ═══════════════════════════════════════════════════════════════════════════
// INTERFACE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Standard interface for all DMX drivers.
 * 
 * Usage:
 * ```typescript
 * const driver = new USBDMXDriver()
 * await driver.connect()
 * driver.send({ universe: 1, address: 1, channels: [255, 128, 64] })
 * await driver.close()
 * ```
 */
export interface IDMXDriver {
  // ─────────────────────────────────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Connect to the DMX device.
   * 
   * @returns Promise resolving to true if connected successfully
   * @throws Error if connection fails and autoReconnect is disabled
   */
  connect(): Promise<boolean>
  
  /**
   * Close the connection and cleanup resources.
   * 
   * @returns Promise that resolves when fully closed
   */
  close(): Promise<void>
  
  // ─────────────────────────────────────────────────────────────────────────
  // DATA TRANSMISSION
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Send a DMX packet to the device.
   * 
   * @param packet - The DMX packet containing universe, address, and channels
   * @returns true if sent successfully, false otherwise
   */
  send(packet: DMXPacket): boolean
  
  /**
   * Send complete universe data (512 channels).
   * 
   * @param universe - Universe number (1-based)
   * @param data - Uint8Array of 512 channel values
   * @returns true if sent successfully
   */
  sendUniverse(universe: number, data: Uint8Array): boolean
  
  /**
   * 🌊 WAVE 2020.2b: Send ALL active universes in parallel.
   * This is the high-performance method for 50+ universes.
   * 
   * @returns Promise<boolean> - true if all universes sent successfully
   */
  sendAll?(): Promise<boolean>
  
  /**
   * Blackout all channels (set to 0).
   */
  blackout(): void
  
  // ─────────────────────────────────────────────────────────────────────────
  // STATUS
  // ─────────────────────────────────────────────────────────────────────────
  
  /** Check if driver is connected and ready */
  readonly isConnected: boolean
  
  /** Get current driver state */
  readonly state: DriverState
  
  /** Get detailed status for UI */
  getStatus(): DriverStatus
  
  // ─────────────────────────────────────────────────────────────────────────
  // EVENTS (Optional - drivers may extend EventEmitter)
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Subscribe to driver events.
   * Not all drivers may implement this.
   */
  on?<K extends keyof DriverEvents>(event: K, listener: DriverEvents[K]): this
  off?<K extends keyof DriverEvents>(event: K, listener: DriverEvents[K]): this
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Device discovery result (for USB drivers) */
export interface DiscoveredDevice {
  path: string
  manufacturer?: string
  vendorId?: string
  productId?: string
  deviceType: string
  friendlyName: string
  confidence: number  // 0-100% likelihood of being DMX
}

/** ArtNet-specific configuration */
export interface ArtNetConfig extends DriverConfig {
  ip: string
  port: number
  universe: number
  nodeName: string
}

/** USB-specific configuration */
export interface USBConfig extends DriverConfig {
  port?: string  // If null, auto-detect
  baudRate: number
  promiscuousMode: boolean  // Try any serial port
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════

/** Available driver types */
export type DriverType = 'usb' | 'artnet' | 'mock'

/**
 * Create a driver instance by type.
 * Allows runtime driver selection.
 */
export type DriverFactory = (type: DriverType, config?: Partial<DriverConfig>) => IDMXDriver
