/**
 * 🐋 WHALE SONG - Canto de Ballena en TWILIGHT (3000-6000m)
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 1073: OCEANIC CALIBRATION - De "estático aburrido" a "majestuoso"
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * CONCEPTO: Una ballena ENORME cruzando el espacio con PRESENCIA.
 * No es solo un cambio de color - es una SILUETA que se mueve.
 * El "canto" son pulsos de bioluminiscencia que viajan por su cuerpo.
 * 
 * MECÁNICA WAVE 1073:
 * - La ballena es ANCHA (ocupa varias zonas a la vez)
 * - PULSOS DE CANTO: Ondas que viajan de cola a cabeza
 * - COLORES CAMBIANTES: Índigo/violeta que varían con el canto
 * - MOVERS: Siguen la cabeza de la ballena, MUY LENTO
 * 
 * HSL FORMAT: h(0-360), s(0-100), l(0-100)
 */

import { BaseEffect } from '../../BaseEffect'
import { EffectTriggerConfig, EffectFrameOutput, EffectCategory } from '../../types'

interface WhaleSongConfig {
  durationMs: number
  peakIntensity: number
  whaleWidth: number
  songPulses: number      // 🌊 WAVE 1073: Número de "cantos" durante el cruce
}

const DEFAULT_CONFIG: WhaleSongConfig = {
  durationMs: 12000,        // 🌊 WAVE 1073: 12 segundos - evento MAJESTUOSO
  peakIntensity: 0.80,
  whaleWidth: 0.55,          // Ballena ancha
  songPulses: 3,             // 3 cantos durante el cruce
}

// 🐋 PALETA TWILIGHT BIOLUMINISCENTE
const TWILIGHT_COLORS = {
  // Color base de la ballena
  body: { h: 235, s: 72, l: 32 },      // Índigo profundo
  // Color del "canto" (pulso bioluminiscente)
  song: { h: 275, s: 85, l: 50 },      // Violeta brillante
  // Color de la cola (más oscuro)
  tail: { h: 250, s: 60, l: 25 },      // Azul medianoche
  // Color de la cabeza (más claro)
  head: { h: 265, s: 78, l: 42 },      // Lavanda brillante
}

export class WhaleSong extends BaseEffect {
  readonly effectType = 'whale_song'
  readonly name = 'Whale Song'
  readonly category: EffectCategory = 'physical'
  readonly priority = 72
  readonly mixBus = 'global' as const  // 🌊 WAVE 1073: Override completo
  
  private config: WhaleSongConfig
  private direction: 'LtoR' | 'RtoL' = 'LtoR'
  private verticalOffset: number = 0
  
  constructor(config?: Partial<WhaleSongConfig>) {
    super('whale_song')
    this.config = { ...DEFAULT_CONFIG, ...config }
  }
  
  trigger(triggerConfig: EffectTriggerConfig): void {
    super.trigger(triggerConfig)
    this.direction = Date.now() % 2 === 0 ? 'LtoR' : 'RtoL'
    this.verticalOffset = ((Date.now() % 100) / 100) * 0.2 - 0.1
    console.log(`[🐋 WHALE] Majestic crossing ${this.direction}, ${this.config.songPulses} songs`)
  }

  update(deltaMs: number): void {
    if (this.phase === 'idle' || this.phase === 'finished') return
    this.elapsedMs += deltaMs
    if (this.elapsedMs >= this.config.durationMs) {
      this.phase = 'finished'
    }
  }
  
  /**
   * 🎵 Calcula la intensidad del "canto" (pulso bioluminiscente)
   * Los cantos viajan de cola a cabeza
   */
  private getSongIntensity(progress: number, zonePosition: number): number {
    // Frecuencia de los cantos
    const songPhase = progress * this.config.songPulses * Math.PI * 2
    
    // El canto viaja como una onda
    const waveOffset = zonePosition * Math.PI * 0.5  // Desfase por posición
    const songWave = Math.sin(songPhase + waveOffset)
    
    // Solo pulsos positivos (cantos reales, no "anti-cantos")
    return Math.max(0, songWave) ** 2  // Cuadrado para más punch
  }
  
  /**
   * 🎨 Mezcla color de cuerpo con color de canto
   */
  private blendColors(
    bodyColor: { h: number; s: number; l: number },
    songColor: { h: number; s: number; l: number },
    songIntensity: number
  ): { h: number; s: number; l: number } {
    return {
      h: bodyColor.h + (songColor.h - bodyColor.h) * songIntensity,
      s: bodyColor.s + (songColor.s - bodyColor.s) * songIntensity * 0.5,
      l: bodyColor.l + (songColor.l - bodyColor.l) * songIntensity,
    }
  }
  
  getOutput(): EffectFrameOutput | null {
    if (this.phase === 'idle' || this.phase === 'finished') return null
    const progress = this.elapsedMs / this.config.durationMs
    
    // Envelope MUY suave (ballena = gracia)
    let envelope: number
    if (progress < 0.20) { 
      envelope = (progress / 0.20) ** 2  // Entrada suave
    } else if (progress < 0.75) { 
      envelope = 1.0 
    } else { 
      envelope = ((1 - progress) / 0.25) ** 2  // Salida suave
    }
    
    // 🐋 Posición de la ballena con ondulación natural
    let basePosition = progress * 1.2 - 0.1
    // Ondulación S sutil (la ballena "nada")
    const swimWave = Math.sin(progress * Math.PI * 1.5) * 0.08
    let whaleCenter = basePosition + swimWave + this.verticalOffset
    if (this.direction === 'RtoL') { whaleCenter = 1 - whaleCenter }
    
    // Respiración profunda (la ballena respira cada ~4 segundos)
    const breathCycle = Math.sin(progress * Math.PI * 3) * 0.12 + 0.88
    
    // 🌊 WAVE 1073: Zonas con partes del cuerpo de la ballena
    // La ballena tiene: COLA --- CUERPO --- CABEZA
    // Mapeo: Las zonas más alejadas del centro = cola, cercanas = cuerpo, delante = cabeza
    const zonePositions: Record<string, { pos: number; bodyPart: 'tail' | 'body' | 'head' }> = {
      frontL:       { pos: 0.0,  bodyPart: this.direction === 'LtoR' ? 'head' : 'tail' },
      backL:        { pos: 0.18, bodyPart: 'body' },
      movers_left:  { pos: 0.35, bodyPart: 'body' },
      movers_right: { pos: 0.65, bodyPart: 'body' },
      backR:        { pos: 0.82, bodyPart: 'body' },
      frontR:       { pos: 1.0,  bodyPart: this.direction === 'LtoR' ? 'tail' : 'head' },
    }
    
    // Función para calcular presencia de la ballena en una zona
    const getWhalePresence = (zonePos: number): number => {
      const distance = Math.abs(zonePos - whaleCenter)
      if (distance > this.config.whaleWidth) return 0
      const normalized = distance / this.config.whaleWidth
      // Curva suave (ballena = masa suave, no afilada)
      return Math.exp(-normalized * normalized * 1.5) * breathCycle
    }
    
    // 🐋 Movimiento de movers siguiendo la CABEZA de la ballena
    // Muy lento, muy suave
    const headPosition = this.direction === 'LtoR' 
      ? whaleCenter + this.config.whaleWidth * 0.4
      : whaleCenter - this.config.whaleWidth * 0.4
    const moverPan = (headPosition - 0.5) * 40  // Rango reducido
    const moverTilt = Math.sin(progress * Math.PI * 0.6) * 5 - 5  // Mirando ligeramente abajo
    
    const output: EffectFrameOutput = {
      effectId: this.id,
      category: this.category,
      phase: this.phase,
      progress,
      zones: ['frontL', 'frontR', 'backL', 'backR', 'movers_left', 'movers_right'],
      intensity: this.triggerIntensity * envelope * this.config.peakIntensity,
      zoneOverrides: {},
    }

    // 🎨 Aplicar cada zona con su color de parte del cuerpo + canto
    for (const [zoneName, zoneData] of Object.entries(zonePositions)) {
      const presence = getWhalePresence(zoneData.pos)
      if (presence < 0.01) {
        // Zona fuera de la ballena = oscuro
        output.zoneOverrides![zoneName] = {
          dimmer: 0,
          color: TWILIGHT_COLORS.body,
          blendMode: 'replace' as const,
        }
        continue
      }
      
      // Color base según parte del cuerpo
      const bodyColor = TWILIGHT_COLORS[zoneData.bodyPart]
      
      // Intensidad del canto en esta zona
      const songIntensity = this.getSongIntensity(progress, zoneData.pos)
      
      // Mezclar color de cuerpo con canto
      const finalColor = this.blendColors(bodyColor, TWILIGHT_COLORS.song, songIntensity)
      
      // Atenuación por parte del cuerpo
      const partAttenuation = zoneData.bodyPart === 'head' ? 1.0 
        : zoneData.bodyPart === 'body' ? 0.85 
        : 0.65  // Cola más tenue
      
      output.zoneOverrides![zoneName] = {
        dimmer: presence * envelope * this.config.peakIntensity * partAttenuation,
        color: finalColor,
        blendMode: 'replace' as const,
      }
    }
    
    // 🐋 Movers con movimiento ULTRA LENTO
    output.zoneOverrides!['movers_left'] = {
      ...output.zoneOverrides!['movers_left'],
      movement: { 
        pan: moverPan - 12, 
        tilt: moverTilt,
        isAbsolute: false,
        speed: 0.12,  // 🌊 WAVE 1073: ULTRA LENTO
      },
    }
    output.zoneOverrides!['movers_right'] = {
      ...output.zoneOverrides!['movers_right'],
      movement: { 
        pan: moverPan + 12, 
        tilt: moverTilt,
        isAbsolute: false,
        speed: 0.12,
      },
    }
    
    return output
  }
  
  isFinished(): boolean { return this.phase === 'finished' }
  abort(): void { this.phase = 'finished' }
}