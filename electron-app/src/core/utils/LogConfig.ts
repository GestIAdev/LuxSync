/**
 * 🔧 WAVE 1177: LOG CONFIG
 * 
 * Archivo de configuración para el modo de logging.
 * Cambiar aquí para alternar entre modos de calibración.
 * 
 * OPCIONES:
 * - 'SILENT': Nada (producción)
 * - 'CALIBRATION': Solo efectos disparados/bloqueados (disco test)
 * - 'NORMAL': Estados, transiciones, predicciones
 * - 'DEBUG': Todo (desarrollo)
 */

import { setLogLevel, type LogLevel } from './CalibrationLogger'

// ═══════════════════════════════════════════════════════════════════════════
// 🔧 CONFIGURACIÓN - CAMBIAR AQUÍ
// ═══════════════════════════════════════════════════════════════════════════

export const LOG_MODE: LogLevel = 'CALIBRATION'

// Auto-aplicar al importar
setLogLevel(LOG_MODE)

// ═══════════════════════════════════════════════════════════════════════════
// PRESETS RÁPIDOS
// ═══════════════════════════════════════════════════════════════════════════

export function enableDiscoMode(): void {
  setLogLevel('CALIBRATION')
  console.log('🎪 [LOG CONFIG] DISCO MODE ENABLED - Solo efectos visibles')
}

export function enableDebugMode(): void {
  setLogLevel('DEBUG')
  console.log('🔬 [LOG CONFIG] DEBUG MODE ENABLED - Todo visible')
}

export function enableSilentMode(): void {
  setLogLevel('SILENT')
  console.log('🔇 [LOG CONFIG] SILENT MODE ENABLED - Nada visible')
}
