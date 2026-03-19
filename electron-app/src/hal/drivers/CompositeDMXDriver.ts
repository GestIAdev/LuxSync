/**
 * 🔥 WAVE 2100: COMPOSITE DMX DRIVER — DUAL OUTPUT (USB + ArtNet)
 * ============================================================================
 * 
 * El HAL solo soportaba UN driver. Este composite los fusiona:
 * → USB (UniversalDMX via Phantom Worker) para hardware serial
 * → ArtNet (UDP) para interfaces de red
 * 
 * Ambos reciben los MISMOS packets DMX en paralelo.
 * isConnected = true si CUALQUIERA de los dos está conectado.
 * 
 * ARQUITECTURA:
 * ┌─────────────────────────────────────────────┐
 * │         CompositeDMXDriver                   │
 * │  implements IDMXDriver                       │
 * │                                              │
 * │  ┌──────────────┐   ┌───────────────────┐   │
 * │  │ USBDMXDriver  │   │ ArtNetDriverAdapt │   │
 * │  │ (serial/FTDI) │   │ (UDP/Art-Net)     │   │
 * │  └──────────────┘   └───────────────────┘   │
 * │       ↑ send()            ↑ send()          │
 * │       └────────┬──────────┘                  │
 * │            send(packet) ← HAL               │
 * └─────────────────────────────────────────────┘
 * 
 * @layer HAL
 * @pattern COMPOSITE
 */

import type { DMXPacket } from '../../core/protocol'
import type { DriverState, DriverStatus, IDMXDriver } from './DMXDriver.interface'

export class CompositeDMXDriver implements IDMXDriver {
  private drivers: IDMXDriver[]

  constructor(...drivers: IDMXDriver[]) {
    this.drivers = drivers.filter(Boolean)
  }

  // ═══════════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════════

  async connect(): Promise<boolean> {
    const results = await Promise.allSettled(
      this.drivers.map(d => d.connect())
    )
    // Éxito si AL MENOS uno conecta
    return results.some(r => r.status === 'fulfilled' && r.value === true)
  }

  async close(): Promise<void> {
    await Promise.allSettled(this.drivers.map(d => d.close()))
  }

  // ═══════════════════════════════════════════════════════════════════════
  // DATA TRANSMISSION — Fan-out a todos los drivers activos
  // ═══════════════════════════════════════════════════════════════════════

  send(packet: DMXPacket): boolean {
    let sent = false
    for (const driver of this.drivers) {
      if (driver.isConnected) {
        const ok = driver.send(packet)
        if (ok) sent = true
      }
    }
    return sent
  }

  sendUniverse(universe: number, data: Uint8Array): boolean {
    let sent = false
    for (const driver of this.drivers) {
      if (driver.isConnected) {
        const ok = driver.sendUniverse(universe, data)
        if (ok) sent = true
      }
    }
    return sent
  }

  async sendAll(): Promise<boolean> {
    const results = await Promise.allSettled(
      this.drivers
        .filter(d => d.isConnected && d.sendAll)
        .map(d => d.sendAll!())
    )
    return results.some(r => r.status === 'fulfilled' && r.value === true)
  }

  blackout(): void {
    for (const driver of this.drivers) {
      if (driver.isConnected) {
        driver.blackout()
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STATUS — Conectado si CUALQUIERA está conectado
  // ═══════════════════════════════════════════════════════════════════════

  get isConnected(): boolean {
    return this.drivers.some(d => d.isConnected)
  }

  get state(): DriverState {
    if (this.drivers.some(d => d.state === 'connected')) return 'connected'
    if (this.drivers.some(d => d.state === 'connecting')) return 'connecting'
    if (this.drivers.some(d => d.state === 'reconnecting')) return 'reconnecting'
    if (this.drivers.some(d => d.state === 'error')) return 'error'
    return 'disconnected'
  }

  getStatus(): DriverStatus {
    // Priorizar el driver que esté conectado
    const active = this.drivers.find(d => d.isConnected)
    if (active) return active.getStatus()
    // Si ninguno conectado, devolver el status del primero
    if (this.drivers.length > 0) return this.drivers[0].getStatus()
    return {
      state: 'disconnected',
      type: 'usb',
      deviceName: 'Composite (no drivers)',
      framesSent: 0,
      lastSendTime: 0,
      errors: 0,
      avgLatency: 0,
    }
  }
}
