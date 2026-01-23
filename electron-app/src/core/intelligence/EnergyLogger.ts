/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧪 ENERGY LOGGER - THE FORENSIC LAB
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * 🔬 WAVE 978 - THE ENERGY LAB (PHASE 1)
 * 
 * PROPÓSITO:
 * Capturar datos CRUDOS de energía sin procesamiento para diagnosticar
 * la "ceguera" del sistema ante drops de percusión.
 * 
 * FILOSOFÍA:
 * - NO toca calibración
 * - NO toca umbrales
 * - SOLO observa y registra
 * 
 * OUTPUT:
 * CSV en: logs/energy_lab_[timestamp].csv
 * 
 * COLUMNAS:
 * - timestamp: Ms exacto
 * - raw_energy: Valor puro FFT/AGC (ANTES de suavizado)
 * - smoothed_energy: Valor que usa EnergyConsciousnessEngine
 * - zone_label: Zona decidida (silence/valley/active/peak)
 * - agc_gain: Ganancia AGC actual
 * - bass_band: Energía en banda de bajos
 * - spectral_flux: Diferencia entre frames (transitorios)
 * 
 * ACTIVACIÓN:
 * Solo cuando DEBUG_ENERGY = true
 * 
 * @module core/intelligence/EnergyLogger
 * @version WAVE 978 - Phase 1
 */

import * as fs from 'fs'
import * as path from 'path'
import type { EnergyZone } from '../protocol/MusicalContext'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface EnergyLogEntry {
  /** Timestamp en ms */
  timestamp: number
  
  /** Energía RAW (antes de suavizado) */
  raw: number
  
  /** Energía suavizada (la que usa el sistema) */
  smooth: number
  
  /** Zona energética decidida */
  zone: EnergyZone
  
  /** Ganancia AGC actual */
  gain: number
  
  /** Energía en banda de bajos */
  bass: number
  
  /** Spectral flux (transitorios) */
  spectralFlux?: number
  
  /** Mid band (opcional) */
  mid?: number
  
  /** Treble band (opcional) */
  treble?: number
  
  /** Percentil histórico (opcional) */
  percentile?: number
}

// ═══════════════════════════════════════════════════════════════════════════
// ENERGY LOGGER CLASS
// ═══════════════════════════════════════════════════════════════════════════

class EnergyLoggerClass {
  private enabled: boolean = false
  private logFilePath: string | null = null
  private writeStream: fs.WriteStream | null = null
  private buffer: string[] = []
  private lastFlush: number = 0
  private sessionStartTime: number = 0
  
  // Buffer config
  private readonly BUFFER_SIZE = 100  // Flush cada 100 entries
  private readonly FLUSH_INTERVAL_MS = 5000  // O cada 5 segundos
  
  /**
   * 🚀 INICIALIZAR LOGGER
   * 
   * Crea el archivo CSV y escribe el header.
   */
  initialize(): void {
    if (this.enabled) {
      console.warn('[🧪 ENERGY_LAB] Already initialized')
      return
    }
    
    // Crear directorio logs si no existe
    const logsDir = path.join(process.cwd(), 'logs')
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true })
    }
    
    // Generar nombre de archivo con timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    const filename = `energy_lab_${timestamp}.csv`
    this.logFilePath = path.join(logsDir, filename)
    
    // Crear write stream
    this.writeStream = fs.createWriteStream(this.logFilePath, { flags: 'w' })
    
    // Escribir header CSV
    const header = 'timestamp,raw_energy,smoothed_energy,zone_label,agc_gain,bass_band,spectral_flux,mid_band,treble_band,percentile\n'
    this.writeStream.write(header)
    
    this.enabled = true
    this.sessionStartTime = Date.now()
    this.lastFlush = Date.now()
    
    console.log(`[🧪 ENERGY_LAB] Initialized: ${this.logFilePath}`)
    console.log(`[🧪 ENERGY_LAB] 📊 CSV Columns: timestamp | raw | smooth | zone | gain | bass | flux | mid | treble | percentile`)
  }
  
  /**
   * 📝 LOG ENTRY
   * 
   * Registra una entrada en el buffer.
   * Se hace flush automático cuando buffer lleno o cada 5s.
   */
  log(entry: EnergyLogEntry): void {
    if (!this.enabled || !this.writeStream) {
      return
    }
    
    // Construir línea CSV
    const line = [
      entry.timestamp,
      entry.raw.toFixed(4),
      entry.smooth.toFixed(4),
      entry.zone,
      entry.gain.toFixed(3),
      entry.bass.toFixed(4),
      (entry.spectralFlux ?? 0).toFixed(4),
      (entry.mid ?? 0).toFixed(4),
      (entry.treble ?? 0).toFixed(4),
      (entry.percentile ?? 0).toFixed(0),
    ].join(',')
    
    // Agregar al buffer
    this.buffer.push(line + '\n')
    
    // Auto-flush si buffer lleno o tiempo transcurrido
    const now = Date.now()
    if (this.buffer.length >= this.BUFFER_SIZE || (now - this.lastFlush) >= this.FLUSH_INTERVAL_MS) {
      this.flush()
    }
  }
  
  /**
   * 💾 FLUSH BUFFER
   * 
   * Escribe el buffer acumulado al disco.
   */
  private flush(): void {
    if (!this.enabled || !this.writeStream || this.buffer.length === 0) {
      return
    }
    
    // Escribir todo el buffer
    const data = this.buffer.join('')
    this.writeStream.write(data)
    
    // Limpiar buffer
    this.buffer = []
    this.lastFlush = Date.now()
  }
  
  /**
   * 🛑 SHUTDOWN
   * 
   * Cierra el logger y hace flush final.
   */
  shutdown(): void {
    if (!this.enabled) {
      return
    }
    
    console.log('[🧪 ENERGY_LAB] Shutting down...')
    
    // Flush final
    this.flush()
    
    // Cerrar stream
    if (this.writeStream) {
      this.writeStream.end()
      this.writeStream = null
    }
    
    const duration = ((Date.now() - this.sessionStartTime) / 1000).toFixed(1)
    console.log(`[🧪 ENERGY_LAB] Session closed: ${duration}s recorded`)
    console.log(`[🧪 ENERGY_LAB] 📁 Data saved to: ${this.logFilePath}`)
    
    this.enabled = false
    this.logFilePath = null
  }
  
  /**
   * ❓ IS ENABLED
   */
  isEnabled(): boolean {
    return this.enabled
  }
  
  /**
   * 📂 GET LOG FILE PATH
   */
  getLogFilePath(): string | null {
    return this.logFilePath
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON EXPORT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🧪 ENERGY LOGGER - Singleton global
 * 
 * USAGE:
 * ```typescript
 * import { EnergyLogger } from './EnergyLogger'
 * 
 * // En init:
 * if (Config.DEBUG_ENERGY) {
 *   EnergyLogger.initialize()
 * }
 * 
 * // En cada frame:
 * if (EnergyLogger.isEnabled()) {
 *   EnergyLogger.log({
 *     timestamp: Date.now(),
 *     raw: rawEnergy,
 *     smooth: smoothedEnergy,
 *     zone: currentZone,
 *     gain: agcGain,
 *     bass: bassEnergy,
 *     spectralFlux: flux,
 *   })
 * }
 * 
 * // En shutdown:
 * EnergyLogger.shutdown()
 * ```
 */
export const EnergyLogger = new EnergyLoggerClass()
