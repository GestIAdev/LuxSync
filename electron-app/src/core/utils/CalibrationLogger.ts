/**
 * 🔧 WAVE 1177: CALIBRATION LOGGER
 * 
 * Sistema de logging centralizado para calibración de Selene.
 * Los humanos solo pueden procesar ~10-12 logs por segundo.
 * Este logger filtra el ruido y muestra solo lo relevante.
 * 
 * NIVELES:
 * - CALIBRATION: Solo lo esencial para calibrar (efectos disparados, decisiones)
 * - NORMAL: Incluye transiciones de estado, predicciones
 * - DEBUG: Todo el ruido (IPC, frames, etc.)
 * - SILENT: Nada
 * 
 * @author PunkOpus
 * @wave 1177
 */

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN GLOBAL
// ═══════════════════════════════════════════════════════════════════════════

export type LogLevel = 'SILENT' | 'CALIBRATION' | 'NORMAL' | 'DEBUG'

// 🔧 CAMBIAR ESTO PARA MODO CALIBRACIÓN
let currentLevel: LogLevel = 'CALIBRATION'

// Debounce para evitar spam de zonas
let lastZoneLog: { zone: string; timestamp: number } = { zone: '', timestamp: 0 }
const ZONE_DEBOUNCE_MS = 500 // Solo loggear si la zona persiste 500ms

// Throttle para logs periódicos
const throttleTimestamps: Record<string, number> = {}

// ═══════════════════════════════════════════════════════════════════════════
// API PÚBLICA
// ═══════════════════════════════════════════════════════════════════════════

export function setLogLevel(level: LogLevel): void {
  currentLevel = level
  console.log(`[CalibrationLogger] 🔧 Log level set to: ${level}`)
}

export function getLogLevel(): LogLevel {
  return currentLevel
}

/**
 * 🔥 Log de efecto DISPARADO - Siempre visible en CALIBRATION
 */
export function logEffectFired(
  effectName: string, 
  source: string, 
  vibe: string, 
  intensity: number, 
  zScore: number
): void {
  if (currentLevel === 'SILENT') return
  
  const emoji = zScore > 3.5 ? '🌩️' : '🔥'
  console.log(
    `${emoji} [EFFECT FIRED] ${effectName} | ` +
    `Source: ${source} | Vibe: ${vibe} | ` +
    `I: ${intensity.toFixed(2)} | Z: ${zScore.toFixed(1)}σ`
  )
}

/**
 * 🔒 Log de efecto BLOQUEADO - Siempre visible en CALIBRATION
 */
export function logEffectBlocked(
  effectName: string, 
  reason: string
): void {
  if (currentLevel === 'SILENT') return
  
  console.log(`🔒 [BLOCKED] ${effectName} | ${reason}`)
}

/**
 * 🎯 Log de decisión DIVINE - Solo si se va a ejecutar realmente
 * @param willExecute - true si el efecto se va a ejecutar, false si hay LOCK
 */
export function logDivineDecision(
  zScore: number, 
  zone: string, 
  willExecute: boolean,
  arsenal: string[]
): void {
  if (currentLevel === 'SILENT') return
  
  if (willExecute) {
    console.log(
      `🌩️ [DIVINE STRIKE] Z=${zScore.toFixed(2)}σ | ` +
      `Zone: ${zone} | Arsenal: [${arsenal.join(', ')}]`
    )
  } else if (currentLevel === 'DEBUG') {
    // Solo en DEBUG mostramos intentos fallidos
    console.log(
      `🌩️ [DIVINE BLOCKED] Z=${zScore.toFixed(2)}σ | ` +
      `Zone: ${zone} (not executed due to LOCK)`
    )
  }
}

/**
 * 🔋 Log de transición de zona - Con debounce de 500ms
 */
export function logZoneTransition(
  fromZone: string, 
  toZone: string, 
  energy: number
): void {
  if (currentLevel === 'SILENT' || currentLevel === 'CALIBRATION') return
  
  const now = Date.now()
  
  // Debounce: solo loggear si la zona cambió Y pasaron 500ms
  if (toZone === lastZoneLog.zone && now - lastZoneLog.timestamp < ZONE_DEBOUNCE_MS) {
    return // Ignorar, la zona está "rebotando"
  }
  
  lastZoneLog = { zone: toZone, timestamp: now }
  console.log(`🔋 [ZONE] ${fromZone} → ${toZone} (E=${energy.toFixed(2)})`)
}

/**
 * 🧠 Log de estado de Hunt/Fuzzy - Throttled a 1/segundo
 */
export function logHuntState(
  huntState: string,
  fuzzyAction: string,
  zScore: number,
  alert: string,
  confidence: number
): void {
  if (currentLevel === 'SILENT' || currentLevel === 'CALIBRATION') return
  
  const key = 'huntState'
  const now = Date.now()
  
  if (throttleTimestamps[key] && now - throttleTimestamps[key] < 1000) {
    return // Throttle: max 1 por segundo
  }
  throttleTimestamps[key] = now
  
  const alertEmoji = alert === 'imminent' ? '⚠️' : alert === 'watching' ? '👀' : ''
  console.log(
    `🧠 [HUNT] ${huntState} | Fuzzy: ${fuzzyAction} | ` +
    `Z: ${zScore.toFixed(1)}σ | Conf: ${confidence.toFixed(2)} ${alertEmoji}`
  )
}

/**
 * 🎛️ Log de textura - Solo cuando cambia significativamente
 */
let lastTexture = { harsh: 0, centroid: 0 }
export function logTextureChange(
  textureType: string,
  harshness: number,
  flatness: number,
  centroid: number
): void {
  if (currentLevel !== 'DEBUG') return
  
  // Solo loggear si cambia significativamente
  const harshDelta = Math.abs(harshness - lastTexture.harsh)
  const centroidDelta = Math.abs(centroid - lastTexture.centroid)
  
  if (harshDelta < 0.1 && centroidDelta < 200) {
    return // Sin cambio significativo
  }
  
  lastTexture = { harsh: harshness, centroid }
  console.log(
    `🎛️ [TEXTURE] ${textureType} | ` +
    `Harsh: ${harshness.toFixed(2)} | Flat: ${flatness.toFixed(2)} | ` +
    `Centroid: ${centroid.toFixed(0)}Hz`
  )
}

/**
 * 🩻 Log de God Ear - Throttled a cada 5 segundos
 */
export function logGodEar(
  clarity: number,
  flatness: number,
  centroid: number,
  crestFactor: number
): void {
  if (currentLevel !== 'DEBUG') return
  
  const key = 'godEar'
  const now = Date.now()
  
  if (throttleTimestamps[key] && now - throttleTimestamps[key] < 5000) {
    return // Throttle: max 1 cada 5s
  }
  throttleTimestamps[key] = now
  
  console.log(
    `🩻 [GOD EAR] Clarity: ${clarity.toFixed(3)} | ` +
    `Flatness: ${flatness.toFixed(3)} | ` +
    `Centroid: ${centroid.toFixed(0)}Hz | ` +
    `Crest: ${crestFactor.toFixed(2)}`
  )
}

/**
 * 🎵 Log de cambio de BPM - Solo cuando cambia
 */
let lastBPM = 0
export function logBPMChange(source: string, bpm: number): void {
  if (currentLevel === 'SILENT') return
  
  if (Math.abs(bpm - lastBPM) < 2) {
    return // No cambió significativamente
  }
  
  lastBPM = bpm
  console.log(`🎵 [BPM] ${source}: ${bpm}`)
}

/**
 * 📊 Log de diversidad - Solo cuando hay problema
 */
export function logDiversityWarning(
  effectName: string,
  usageCount: number,
  historyEffects: string[]
): void {
  if (currentLevel === 'SILENT') return
  
  if (usageCount >= 3) {
    // Contar cuántas veces aparece en el historial reciente
    const recentCount = historyEffects.filter(e => e === effectName).length
    if (recentCount >= 3) {
      console.warn(
        `⚠️ [DIVERSITY] ${effectName} aparece ${recentCount}x en historial! ` +
        `Consider forcing variety.`
      )
    }
  }
}

/**
 * 🔇 Log de silencio detectado - Throttled
 */
export function logSilence(vibe: string, energy: number, zScore: number): void {
  if (currentLevel !== 'DEBUG') return
  
  const key = 'silence'
  const now = Date.now()
  
  if (throttleTimestamps[key] && now - throttleTimestamps[key] < 5000) {
    return
  }
  throttleTimestamps[key] = now
  
  console.log(`🧘 [SILENCE] vibe=${vibe} | E=${energy.toFixed(2)} | Z=${zScore.toFixed(2)}σ`)
}

/**
 * 🔧 Log genérico de DEBUG - Solo en modo DEBUG
 */
export function logDebug(component: string, message: string): void {
  if (currentLevel !== 'DEBUG') return
  console.log(`[${component}] ${message}`)
}

// ═══════════════════════════════════════════════════════════════════════════
// RESUMEN DE SESIÓN
// ═══════════════════════════════════════════════════════════════════════════

interface SessionStats {
  effectsFired: number
  effectsBlocked: number
  divineStrikes: number
  zoneTransitions: number
  startTime: number
}

const sessionStats: SessionStats = {
  effectsFired: 0,
  effectsBlocked: 0,
  divineStrikes: 0,
  zoneTransitions: 0,
  startTime: Date.now()
}

export function incrementStat(stat: keyof Omit<SessionStats, 'startTime'>): void {
  sessionStats[stat]++
}

export function printSessionSummary(): void {
  const duration = Math.round((Date.now() - sessionStats.startTime) / 1000)
  console.log('\n' + '═'.repeat(60))
  console.log('📊 SESSION SUMMARY')
  console.log('═'.repeat(60))
  console.log(`⏱️  Duration: ${duration}s`)
  console.log(`🔥 Effects Fired: ${sessionStats.effectsFired}`)
  console.log(`🔒 Effects Blocked: ${sessionStats.effectsBlocked}`)
  console.log(`🌩️ Divine Strikes: ${sessionStats.divineStrikes}`)
  console.log(`🔋 Zone Transitions: ${sessionStats.zoneTransitions}`)
  console.log(`📈 Effects/min: ${(sessionStats.effectsFired / (duration / 60)).toFixed(2)}`)
  console.log('═'.repeat(60) + '\n')
}

// Reset stats on import
export function resetSessionStats(): void {
  sessionStats.effectsFired = 0
  sessionStats.effectsBlocked = 0
  sessionStats.divineStrikes = 0
  sessionStats.zoneTransitions = 0
  sessionStats.startTime = Date.now()
}
