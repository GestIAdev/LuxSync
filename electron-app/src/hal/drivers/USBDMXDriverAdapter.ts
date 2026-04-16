/**
 * 🔌 USBDMXDriverAdapter.ts — WAVE: ADAPTADOR HYDRA USB (DEUDA TÉCNICA SALDADA)
 *
 * Implementa la interfaz estricta `IDMXDriver` (idioma del HAL)
 * envolviendo `universalDMX` (idioma de la Hydra: buffers + universos).
 */

import * as fs from 'fs'
import * as path from 'path'
import type { DMXPacket } from '../../core/protocol'
import type { DriverState, DriverStatus, IDMXDriver } from './DMXDriver.interface'
import { universalDMX } from './UniversalDMXDriver'

// ═══════════════════════════════════════════════════════════════════════
// 🔬 WAVE 2960 v2: RATE-LIMIT logger — máx 1 log por fixture por segundo.
// El one-shot anterior bloqueaba los espasmos reales porque registraba
// los ceros de boot y luego se silenciaba para siempre.
// Ahora: cooldown de 1000ms por clave → boot se loggea, pero 1s después
// el espasmo real también se loggea.
// ═══════════════════════════════════════════════════════════════════════
const _w2960LogPath = path.join(process.cwd(), 'logs', 'w2960-last-mile.log')
const _w2960LastLogTime = new Map<string, number>()  // key → timestamp última escritura
const _W2960_COOLDOWN_MS = 1000  // cooldown por clave: 1 segundo
try { fs.mkdirSync(path.dirname(_w2960LogPath), { recursive: true }) } catch { /* ok */ }
function _w2960Log(key: string, msg: string): void {
  const now = Date.now()
  const last = _w2960LastLogTime.get(key) ?? 0
  if (now - last < _W2960_COOLDOWN_MS) return  // dentro del cooldown — ignorar
  _w2960LastLogTime.set(key, now)
  const line = `[${new Date().toISOString()}] ${msg}\n`
  try { fs.appendFileSync(_w2960LogPath, line, 'utf-8') } catch { /* nunca bloquear */ }
}

export class USBDMXDriverAdapter implements IDMXDriver {
  get isConnected(): boolean {
    return universalDMX.isConnected
  }

  get state(): DriverState {
    return this.isConnected ? 'connected' : 'disconnected'
  }

  getStatus(): DriverStatus {
    return {
      state: this.state,
      type: 'usb',
      deviceName: this.isConnected ? 'UniversalDMX (USB)' : 'UniversalDMX (disconnected)',
      framesSent: 0,
      lastSendTime: 0,
      errors: 0,
      avgLatency: 0,
    }
  }

  /**
   * UniversalDMX tiene autoConnect en backend; si HAL lo llama, forzamos autoConnect.
   */
  async connect(): Promise<boolean> {
    if (!this.isConnected) {
      await universalDMX.autoConnect()
    }
    return this.isConnected
  }

  async close(): Promise<void> {
    await universalDMX.disconnect()
  }

  /**
   * 🔥 TRADUCTOR OFICIAL: DMXPacket -> Hydra
   */
  // 🔬 WAVE 2960 v2: contador de frames para guard post-boot
  private static _w2960FrameCount = 0
  private static readonly _W2960_BOOT_GRACE = 180 // ~3s a 60fps

  send(packet: DMXPacket): boolean {
    try {
      USBDMXDriverAdapter._w2960FrameCount++

      // 🔬 WAVE 2960 v2: RATE-LIMIT — registra ceros post-boot con cooldown 1s.
      // El one-shot anterior capturaba boot y luego bloqueaba espasmos reales.
      // Con rate-limit: boot se loggea, y 1s después el primer espasmo real
      // también se loggea porque el cooldown ya expiró.
      if (USBDMXDriverAdapter._w2960FrameCount > USBDMXDriverAdapter._W2960_BOOT_GRACE) {
        if (packet.channels.length > 0 && packet.channels.every(v => v === 0)) {
          const key = `zero:${packet.fixtureId ?? packet.address}:${packet.universe}`
          _w2960Log(key,
            `[LAST MILE TRAP W2960] BUFFER TODO-CEROS\n` +
            `  fixture=${packet.fixtureId ?? '?'}  addr=${packet.address}  universe=${packet.universe}\n` +
            `  channels[${packet.channels.length}]: [${packet.channels.slice(0, 12).join(',')}...]\n` +
            `  frame=${USBDMXDriverAdapter._w2960FrameCount}\n` +
            `  stack=${new Error().stack?.split('\n').slice(1, 6).join(' | ')}`
          )
        }
      }

      // DMXPacket representa canales de un fixture desde su address base.
      // Enviar como escritura parcial al buffer del universo (no machacar desde canal 1).
      universalDMX.setChannels(packet.address, packet.channels, packet.universe)
      return true
    } catch {
      return false
    }
  }

  sendUniverse(universe: number, data: Uint8Array): boolean {
    try {
      universalDMX.setUniverse(data, universe)
      return true
    } catch {
      return false
    }
  }

  async sendAll(): Promise<boolean> {
    return await universalDMX.sendAll()
  }

  blackout(): void {
    universalDMX.blackout()
  }
}
