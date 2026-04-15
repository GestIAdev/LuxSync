/**
 * 🏛️ WAVE 201: DMX PACKET
 * 
 * Define la salida del HAL (HardwareAbstraction).
 * El HAL recibe LightingIntent y produce SOLO estos tipos.
 * 
 * REGLA: El HAL es el ÚNICO que conoce direcciones DMX y canales específicos.
 *        Traduce intenciones abstractas a valores concretos de hardware.
 * 
 * @layer HAL → HARDWARE
 * @version TITAN 2.0
 */

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTES DMX
// ═══════════════════════════════════════════════════════════════════════════

/** Número de canales por universo DMX */
export const DMX_CHANNELS_PER_UNIVERSE = 512

/** Valor mínimo DMX */
export const DMX_MIN_VALUE = 0

/** Valor máximo DMX */
export const DMX_MAX_VALUE = 255

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS DE CANAL
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Tipos de canales DMX estándar
 */
export type DMXChannelType = 
  | 'dimmer'          // Intensidad
  | 'red'             // Rojo
  | 'green'           // Verde
  | 'blue'            // Azul
  | 'white'           // Blanco
  | 'amber'           // Ámbar
  | 'uv'              // Ultravioleta
  | 'pan'             // Pan (horizontal)
  | 'pan_fine'        // Pan fino (16-bit low byte)
  | 'tilt'            // Tilt (vertical)
  | 'tilt_fine'       // Tilt fino (16-bit low byte)
  | 'speed'           // Velocidad de movimiento
  | 'strobe'          // Estroboscopio
  | 'gobo'            // Rueda de gobos
  | 'color_wheel'     // Rueda de colores
  | 'prism'           // Prisma
  | 'focus'           // Foco
  | 'zoom'            // Zoom
  | 'shutter'         // Obturador
  | 'control'         // Control/Reset
  | 'custom'          // Personalizado

/**
 * Definición de un canal DMX
 */
export interface DMXChannelDefinition {
  /** Offset desde la dirección base (0-indexed) */
  offset: number
  /** Tipo de canal */
  type: DMXChannelType
  /** Valor por defecto (0-255) */
  defaultValue: number
  /** Descripción opcional */
  label?: string
}

// ═══════════════════════════════════════════════════════════════════════════
// INTERFAZ PRINCIPAL: DMX PACKET
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🔧 DMX PACKET
 * 
 * Un paquete DMX representa los valores a enviar a un fixture específico.
 * 
 * @example
 * ```typescript
 * const packet: DMXPacket = {
 *   universe: 1,
 *   address: 1,
 *   channels: [255, 255, 0, 0, 0, 128, 64],  // Dimmer, R, G, B, W, Pan, Tilt
 *   fixtureId: 'par-front-1'
 * }
 * ```
 */
export interface DMXPacket {
  /** Universo DMX (1-based) */
  universe: number
  
  /** Dirección base del fixture (1-512) */
  address: number
  
  /** Valores de los canales (0-255 cada uno) */
  channels: number[]
  
  /** ID del fixture asociado (para debugging) */
  fixtureId?: string
}

// ═══════════════════════════════════════════════════════════════════════════
// DMX OUTPUT (Universo completo)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Estado completo de un universo DMX (512 canales)
 */
export interface DMXUniverse {
  /** Número del universo (1-based) */
  number: number
  
  /** 512 canales (índice 0-511) */
  channels: Uint8Array
  
  /** Timestamp de la última actualización */
  lastUpdate: number
}

/**
 * 📡 DMX OUTPUT
 * 
 * Salida final del HAL. Contiene todos los universos DMX
 * listos para enviar al hardware.
 * 
 * @example
 * ```typescript
 * const output: DMXOutput = {
 *   universes: new Map([
 *     [1, new Uint8Array(512)],  // Universo 1
 *     [2, new Uint8Array(512)],  // Universo 2
 *   ]),
 *   timestamp: Date.now()
 * }
 * ```
 */
export interface DMXOutput {
  /** Mapa de universos (número → 512 canales) */
  universes: Map<number, Uint8Array>
  
  /** Timestamp de esta salida */
  timestamp: number
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY / HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Crea un universo DMX vacío (todos los canales en 0)
 */
export function createEmptyUniverse(universeNumber: number): DMXUniverse {
  return {
    number: universeNumber,
    channels: new Uint8Array(DMX_CHANNELS_PER_UNIVERSE),
    lastUpdate: Date.now(),
  }
}

/**
 * Crea un DMXOutput vacío
 */
export function createEmptyDMXOutput(): DMXOutput {
  return {
    universes: new Map(),
    timestamp: Date.now(),
  }
}

/**
 * Aplica un DMXPacket a un universo
 */
export function applyPacketToUniverse(
  universe: Uint8Array,
  packet: DMXPacket
): void {
  const startIndex = packet.address - 1 // Convertir a 0-indexed
  
  for (let i = 0; i < packet.channels.length; i++) {
    const channelIndex = startIndex + i
    if (channelIndex >= 0 && channelIndex < DMX_CHANNELS_PER_UNIVERSE) {
      universe[channelIndex] = Math.max(
        DMX_MIN_VALUE,
        Math.min(DMX_MAX_VALUE, Math.round(packet.channels[i]))
      )
    }
  }
}

/**
 * Clamp de valor DMX
 * ⚡ WAVE 2750: NaN BOMB SHIELD — NaN/Infinity ya no pasan.
 */
export function clampDMX(value: number): number {
  if (!Number.isFinite(value)) return DMX_MIN_VALUE
  return Math.max(DMX_MIN_VALUE, Math.min(DMX_MAX_VALUE, Math.round(value)))
}
