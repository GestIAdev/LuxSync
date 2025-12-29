/**
 * 🏛️ WAVE 212: MOCK DMX DRIVER
 * 
 * A fake DMX driver for development without physical hardware.
 * Logs all operations instead of sending actual DMX data.
 * 
 * USE CASES:
 * - Development on machines without DMX interfaces
 * - Unit/integration testing
 * - Demo mode
 * - Debugging DMX output values
 */

import type { DMXPacket } from '../../core/protocol'
import type { 
  IDMXDriver, 
  DriverState, 
  DriverStatus, 
  DriverConfig 
} from './DMXDriver.interface'

// ═══════════════════════════════════════════════════════════════════════════
// MOCK DRIVER
// ═══════════════════════════════════════════════════════════════════════════

export class MockDMXDriver implements IDMXDriver {
  private _state: DriverState = 'disconnected'
  private config: DriverConfig
  private framesSent = 0
  private lastSendTime = 0
  private universeBuffers = new Map<number, Uint8Array>()
  private logEnabled = true
  private logSampleRate = 0.05  // Log 5% of frames to avoid spam
  
  constructor(config: Partial<DriverConfig> = {}) {
    this.config = {
      refreshRate: config.refreshRate ?? 30,
      autoReconnect: config.autoReconnect ?? true,
      reconnectDelay: config.reconnectDelay ?? 2000,
      debug: config.debug ?? true,
    }
    
    // Initialize with one universe
    this.universeBuffers.set(1, new Uint8Array(512))
    
    console.log('[MockDMX] 🎭 Mock DMX Driver initialized (WAVE 212)')
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────────────────────────────────
  
  async connect(): Promise<boolean> {
    this._state = 'connecting'
    console.log('[MockDMX] 🔌 Connecting to virtual DMX device...')
    
    // Simulate connection delay
    await this.sleep(100)
    
    this._state = 'connected'
    console.log('[MockDMX] ✅ Connected to virtual DMX universe')
    return true
  }
  
  async close(): Promise<void> {
    console.log('[MockDMX] 🛑 Closing virtual connection...')
    this._state = 'disconnected'
    this.universeBuffers.clear()
    console.log('[MockDMX] ✅ Disconnected')
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // DATA TRANSMISSION
  // ─────────────────────────────────────────────────────────────────────────
  
  send(packet: DMXPacket): boolean {
    if (this._state !== 'connected') {
      if (this.config.debug) {
        console.warn('[MockDMX] ⚠️ Cannot send - not connected')
      }
      return false
    }
    
    const universe = packet.universe || 1
    let buffer = this.universeBuffers.get(universe)
    
    if (!buffer) {
      buffer = new Uint8Array(512)
      this.universeBuffers.set(universe, buffer)
    }
    
    // Apply packet to buffer
    const startAddr = packet.address - 1  // Convert 1-based to 0-based
    for (let i = 0; i < packet.channels.length && startAddr + i < 512; i++) {
      buffer[startAddr + i] = Math.max(0, Math.min(255, packet.channels[i]))
    }
    
    this.framesSent++
    this.lastSendTime = Date.now()
    
    // Sample logging (avoid spam)
    if (this.logEnabled && Math.random() < this.logSampleRate) {
      const activeChannels = packet.channels.filter(v => v > 0).length
      console.log(
        `[MockDMX] 📤 Packet #${this.framesSent} | ` +
        `Univ:${universe} Addr:${packet.address} Ch:${packet.channels.length} ` +
        `Active:${activeChannels} | Sample: [${packet.channels.slice(0, 6).join(',')}...]`
      )
    }
    
    return true
  }
  
  sendUniverse(universe: number, data: Uint8Array): boolean {
    if (this._state !== 'connected') return false
    
    // Store the buffer
    this.universeBuffers.set(universe, new Uint8Array(data))
    
    this.framesSent++
    this.lastSendTime = Date.now()
    
    // Calculate active channels for logging
    if (this.logEnabled && Math.random() < this.logSampleRate) {
      const activeCount = Array.from(data).filter(v => v > 0).length
      console.log(
        `[MockDMX] 📤 Universe ${universe} | ` +
        `Active:${activeCount}/512 | Frame:${this.framesSent}`
      )
    }
    
    return true
  }
  
  blackout(): void {
    console.log('[MockDMX] ⬛ BLACKOUT - All channels to 0')
    
    this.universeBuffers.forEach((buffer) => {
      buffer.fill(0)
    })
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // STATUS
  // ─────────────────────────────────────────────────────────────────────────
  
  get isConnected(): boolean {
    return this._state === 'connected'
  }
  
  get state(): DriverState {
    return this._state
  }
  
  getStatus(): DriverStatus {
    return {
      state: this._state,
      type: 'mock',
      deviceName: 'Virtual DMX (Mock)',
      framesSent: this.framesSent,
      lastSendTime: this.lastSendTime,
      errors: 0,
      avgLatency: 0.1,  // Simulated latency
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // MOCK-SPECIFIC METHODS
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Get current buffer state for a universe (for testing/debugging).
   */
  getUniverseBuffer(universe: number): Uint8Array | undefined {
    return this.universeBuffers.get(universe)
  }
  
  /**
   * Get specific channel value.
   */
  getChannelValue(universe: number, channel: number): number {
    const buffer = this.universeBuffers.get(universe)
    if (!buffer || channel < 1 || channel > 512) return 0
    return buffer[channel - 1]
  }
  
  /**
   * Enable/disable logging.
   */
  setLogging(enabled: boolean, sampleRate?: number): void {
    this.logEnabled = enabled
    if (sampleRate !== undefined) {
      this.logSampleRate = Math.max(0, Math.min(1, sampleRate))
    }
  }
  
  /**
   * Simulate a connection error (for testing).
   */
  simulateError(): void {
    this._state = 'error'
    console.error('[MockDMX] 🔥 Simulated connection error!')
  }
  
  /**
   * Reset stats.
   */
  resetStats(): void {
    this.framesSent = 0
    this.lastSendTime = 0
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Export singleton for easy use
export const mockDMXDriver = new MockDMXDriver()
