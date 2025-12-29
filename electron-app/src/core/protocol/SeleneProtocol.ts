/**
 * 🏛️ WAVE 201: SELENE PROTOCOL
 * 
 * ARCHIVO ÍNDICE DEL PROTOCOLO TITAN.
 * 
 * Este archivo define TODOS los tipos que cruzan límites de módulo.
 * Si un tipo no está aquí, NO PUEDE usarse para comunicación inter-módulo.
 * 
 * "SELENEPROTOCOL ES LA BIBLIA" - Mandamiento #4
 * 
 * @version TITAN 2.0
 * @wave 201
 */

// ═══════════════════════════════════════════════════════════════════════════
// RE-EXPORTAR PROTOCOLOS DE CAPAS
// ═══════════════════════════════════════════════════════════════════════════

// CEREBRO → MOTOR
export * from './MusicalContext'

// MOTOR → HAL
export * from './LightingIntent'

// HAL → HARDWARE
export * from './DMXPacket'

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS COMUNES DEL SISTEMA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Modos de operación de Selene
 */
export type SeleneMode = 
  | 'off'             // Sistema apagado
  | 'manual'          // Control manual completo
  | 'reactive'        // Reactivo a audio (Flow)
  | 'selene'          // Modo Selene completo (Brain activo)

/**
 * IDs de Vibes predefinidos
 */
export type VibeId = 
  | 'techno-club'
  | 'latin-party'
  | 'rock-concert'
  | 'pop-show'
  | 'chill-lounge'
  | 'custom'

/**
 * Niveles de audio en tiempo real
 */
export interface AudioLevels {
  /** Nivel general (0-1) */
  overall: number
  /** Nivel de bajos (0-1) */
  bass: number
  /** Nivel de medios (0-1) */
  mid: number
  /** Nivel de agudos (0-1) */
  treble: number
  /** ¿Hay beat activo? */
  isBeat: boolean
}

// ═══════════════════════════════════════════════════════════════════════════
// UI ↔ BACKEND (IPC)
// ═══════════════════════════════════════════════════════════════════════════

import type { MusicalContext } from './MusicalContext'
import type { LightingIntent } from './LightingIntent'

/**
 * Estado de un fixture para el frontend
 */
export interface FixtureState {
  /** ID único del fixture */
  id: string
  /** Nombre del fixture */
  name: string
  /** Tipo de fixture */
  type: string
  /** Zona asignada */
  zone: string
  /** Dirección DMX */
  dmxAddress: number
  /** Universo DMX */
  universe: number
  /** Intensidad actual (0-255) */
  dimmer: number
  /** RGB actual */
  color: { r: number; g: number; b: number }
  /** Pan actual (0-255) */
  pan: number
  /** Tilt actual (0-255) */
  tilt: number
  /** ¿Está online/conectado? */
  online: boolean
}

/**
 * 📡 SELENE TRUTH
 * 
 * La "Verdad Única" del sistema que se envía al Frontend @ 30fps.
 * Contiene todo el estado necesario para renderizar la UI.
 * 
 * Canal IPC: 'selene:truth'
 */
export interface SeleneTruth {
  // ═══════════════════════════════════════════════════════════════════════
  // ESTADO MUSICAL (del Brain)
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Contexto musical actual */
  context: MusicalContext

  // ═══════════════════════════════════════════════════════════════════════
  // ESTADO DE ILUMINACIÓN (del Engine)
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Intent de iluminación actual */
  intent: LightingIntent

  // ═══════════════════════════════════════════════════════════════════════
  // ESTADO DE HARDWARE
  // ═══════════════════════════════════════════════════════════════════════
  
  hardware: {
    /** ¿Hay conexión DMX activa? */
    dmxConnected: boolean
    /** Driver DMX activo */
    dmxDriver: 'usb' | 'artnet' | 'none'
    /** Estado de los fixtures */
    fixtures: FixtureState[]
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ESTADO DE AUDIO
  // ═══════════════════════════════════════════════════════════════════════
  
  audio: {
    /** Fuente de audio activa */
    source: string
    /** ¿Está recibiendo audio? */
    isActive: boolean
    /** Niveles de audio actuales */
    levels: AudioLevels
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ESTADO DEL SISTEMA
  // ═══════════════════════════════════════════════════════════════════════
  
  system: {
    /** Modo actual */
    mode: SeleneMode
    /** Vibe activo */
    vibe: VibeId
    /** FPS actual del loop principal */
    fps: number
    /** Uptime en ms */
    uptime: number
    /** ¿TITAN activo? */
    titanEnabled: boolean
  }

  // ═══════════════════════════════════════════════════════════════════════
  // META
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Timestamp de esta verdad */
  timestamp: number
}

// ═══════════════════════════════════════════════════════════════════════════
// COMANDOS (Frontend → Backend)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Tipos de comandos que el Frontend puede enviar
 */
export type SeleneCommandType = 
  | 'setMode'
  | 'setVibe'
  | 'setManualColor'
  | 'setManualIntensity'
  | 'triggerEffect'
  | 'blackout'
  | 'panic'

/**
 * 🎮 SELENE COMMAND
 * 
 * Comandos que el Frontend envía al Backend.
 * 
 * Canal IPC: 'selene:command'
 */
export interface SeleneCommand {
  /** Tipo de comando */
  type: SeleneCommandType
  /** Payload del comando (varía según el tipo) */
  payload: unknown
  /** Timestamp del comando */
  timestamp: number
}

// ═══════════════════════════════════════════════════════════════════════════
// CANALES IPC DEFINIDOS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Definición de canales IPC oficiales de TITAN
 */
export const TITAN_IPC_CHANNELS = {
  /** Backend → Frontend: Estado completo @ 30fps */
  TRUTH: 'selene:truth',
  
  /** Frontend → Backend: Comandos de usuario */
  COMMAND: 'selene:command',
  
  /** Bidireccional: Configuración */
  CONFIG: 'selene:config',
  
  /** Backend → Frontend: Estado de fixtures */
  FIXTURES: 'selene:fixtures',
  
  /** Backend → Frontend: Logs del sistema */
  LOGS: 'selene:logs',
} as const

// ═══════════════════════════════════════════════════════════════════════════
// TYPE GUARDS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Verifica si un objeto es un MusicalContext válido
 */
export function isMusicalContext(obj: unknown): obj is MusicalContext {
  if (!obj || typeof obj !== 'object') return false
  const ctx = obj as MusicalContext
  return (
    typeof ctx.bpm === 'number' &&
    typeof ctx.energy === 'number' &&
    typeof ctx.confidence === 'number' &&
    typeof ctx.timestamp === 'number'
  )
}

/**
 * Verifica si un objeto es un LightingIntent válido
 */
export function isLightingIntent(obj: unknown): obj is LightingIntent {
  if (!obj || typeof obj !== 'object') return false
  const intent = obj as LightingIntent
  return (
    intent.palette !== undefined &&
    typeof intent.masterIntensity === 'number' &&
    typeof intent.timestamp === 'number'
  )
}
