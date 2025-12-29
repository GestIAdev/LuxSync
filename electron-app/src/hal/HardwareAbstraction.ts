/**
 * 🏛️ WAVE 202: HARDWARE ABSTRACTION (Stub)
 * 
 * CAPA HAL - Traducción a Hardware Real
 * 
 * El HAL recibe LightingIntent y produce DMXPackets.
 * Es el ÚNICO que conoce direcciones DMX y canales específicos.
 * Traduce intenciones abstractas a valores concretos de hardware.
 * 
 * @layer HAL
 * @version TITAN 2.0 (Stub)
 */

import {
  type LightingIntent,
  type DMXOutput,
  type DMXPacket,
  hslToRgb,
  createEmptyDMXOutput,
} from '../core/protocol'

/**
 * 🔧 HARDWARE ABSTRACTION
 * 
 * Capa de abstracción de hardware. Traduce LightingIntent
 * a valores DMX concretos para los fixtures configurados.
 * 
 * STUB: Por ahora solo hace logs mostrando lo que haría.
 */
export class HardwareAbstraction {
  private frameCount: number = 0
  private lastOutput: DMXOutput
  
  constructor() {
    this.lastOutput = createEmptyDMXOutput()
    console.log('[HAL] 🔧 HardwareAbstraction initialized (STUB)')
  }

  /**
   * Renderiza un LightingIntent a hardware DMX.
   * 
   * @param intent - Intent de iluminación del Engine
   */
  public render(intent: LightingIntent): void {
    this.frameCount++
    
    // Extraer información del intent para el log
    const primaryRGB = hslToRgb(intent.palette.primary)
    const intensity = (intent.masterIntensity * 100).toFixed(0)
    const zoneCount = Object.keys(intent.zones).length
    const effectCount = intent.effects.length
    
    // Simular generación de DMX
    const packets = this.generateDMXPackets(intent)
    
    console.log(
      `[HAL] 🔧 Rendering DMX | ` +
      `Intensity: ${intensity}% | ` +
      `Color: RGB(${primaryRGB.r},${primaryRGB.g},${primaryRGB.b}) | ` +
      `Zones: ${zoneCount} | ` +
      `Effects: ${effectCount} | ` +
      `Packets: ${packets.length}`
    )
    
    // En la versión real, aquí enviaríamos a los drivers DMX
    // this.usbDriver.send(packets)
    // this.artnetDriver.send(packets)
  }

  /**
   * Genera paquetes DMX a partir del intent.
   * STUB: Genera paquetes simulados.
   */
  private generateDMXPackets(intent: LightingIntent): DMXPacket[] {
    const packets: DMXPacket[] = []
    
    // Simular algunos fixtures
    const mockFixtures = [
      { id: 'par-front-1', address: 1, universe: 1, zone: 'front' },
      { id: 'par-front-2', address: 8, universe: 1, zone: 'front' },
      { id: 'par-back-1', address: 15, universe: 1, zone: 'back' },
      { id: 'mover-left', address: 22, universe: 1, zone: 'left' },
      { id: 'mover-right', address: 42, universe: 1, zone: 'right' },
    ]
    
    for (const fixture of mockFixtures) {
      const zoneIntent = intent.zones[fixture.zone as keyof typeof intent.zones]
      
      if (!zoneIntent) continue
      
      // Obtener color de la paleta según el rol
      const color = intent.palette[zoneIntent.paletteRole]
      const rgb = hslToRgb(color)
      
      // Calcular intensidad
      const dimmer = Math.round(intent.masterIntensity * zoneIntent.intensity * 255)
      
      // Generar paquete DMX simulado (7 canales: Dim, R, G, B, W, Pan, Tilt)
      packets.push({
        universe: fixture.universe,
        address: fixture.address,
        channels: [
          dimmer,
          rgb.r,
          rgb.g,
          rgb.b,
          0, // White
          Math.round(intent.movement.centerX * 255), // Pan
          Math.round(intent.movement.centerY * 255), // Tilt
        ],
        fixtureId: fixture.id,
      })
    }
    
    return packets
  }

  /**
   * Obtener el último output
   */
  public getLastOutput(): DMXOutput {
    return this.lastOutput
  }

  /**
   * Destruir recursos y desconectar hardware
   */
  public destroy(): void {
    console.log('[HAL] 🔧 HardwareAbstraction destroyed')
    // TODO: Cerrar conexiones USB/ArtNet
  }
}
