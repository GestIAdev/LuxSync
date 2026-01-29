/**
 * ═══════════════════════════════════════════════════════════════════════════
 * � WAVE 1033: THE FLUID MATRIX - Granular Flow
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * EVOLUCIÓN: De "Lámpara de Lava" (burbujas random) a "Corriente Termal".
 * 
 * 🔥 WAVE 1032: Sistema de Burbujas
 * - Burbujas spawn en zonas aleatorias
 * - Cada una tiene su lifecycle independiente
 * - Efecto hipnótico pero.    // Log cada 90 frames (~1.5 segundos) - FLUID MATRIX stats
    if (this.frameCount % 90 === 0) {
      console.log(
        `[🌊 FLUID MATRIX] Thermal:${(this.thermalEnergy * 100).toFixed(0)}% Packets:${this.activePackets.length} | ` +
        `F:${(finalFront * 100).toFixed(0)}% B:${(finalBack * 100).toFixed(0)}% ` +
        `ML:${(finalMoverL * 100).toFixed(0)}% MR:${(finalMoverR * 100).toFixed(0)}%`
      )
    }O
 * 
 * 🌊 WAVE 1033: Corriente Ascendente
 * - ThermalPacket: Objeto que VIAJA por zonas
 * - Secuencia: FRONT → BACK → MOVERS (suelo → pared → techo)
 * - Granularidad: Micro-textura según audio
 * - Tidal Breath: Onda sinusoidal global de fondo
 * 
 * COREOGRAFÍA DE UN THERMAL PACKET:
 * ┌────────────────────────────────────────────────────────────┐
 * │ T=0.0s     FRONT (Nacimiento)     Ámbar/Rojo suave        │
 * │ T=1.5s     BACK (Transferencia)   Energía sube pared      │
 * │ T=3.0s     MOVERS (Liberación)    Tilt UP + Flota techo   │
 * │ T=4.5s     Packet muere                                    │
 * └────────────────────────────────────────────────────────────┘
 * 
 * GRANULARIDAD POR TEXTURA:
 * - WARM: Micro-parpadeo 0.5Hz (vela/fuego)
 * - CLEAN: Intensidad sólida (medusa bioluminiscente)
 * 
 * TIDAL BREATH (Background):
 * - Onda sinusoidal global a 0.1Hz (10s ciclo)
 * - Amplitud ±5% (muy sutil)
 * - Aplica a zonas SIN packet activo
 * 
 * RESULTADO: La música "empuja" la luz desde el suelo hasta el techo.
 * 
 * @module hal/physics/ChillStereoPhysics
 * @version WAVE 1033 - THE FLUID MATRIX
 */

import type { ElementalModifiers } from '../../engine/physics/ElementalModifiers';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ChillPhysicsInput {
  bass: number
  mid: number
  treble: number
  energy: number
  isRealSilence: boolean
  isAGCTrap: boolean
  // 🍸 WAVE 1032: Spectral context for texture-aware viscosity
  texture?: 'clean' | 'warm' | 'harsh' | 'noisy'
  clarity?: number
  subBass?: number
  spectralCentroid?: number
}

export interface ChillPhysicsResult {
  frontParIntensity: number
  backParIntensity: number
  moverIntensity: number        // Legacy: promedio de L+R
  moverIntensityL: number       // 🫧 WAVE 1032.10: Burbuja izquierda
  moverIntensityR: number       // 🫧 WAVE 1032.10: Burbuja derecha
  moverActive: boolean
  physicsApplied: 'chill'
  // 🍸 WAVE 1032: Extended fluid physics metadata
  fluidState?: {
    viscosity: number        // 0=agua, 1=miel
    breathPhase: number      // Fase de respiración actual
    driftPhaseL: number      // Fase de drift izquierdo
    driftPhaseR: number      // Fase de drift derecho
    stereoOffset: number     // Offset estéreo actual (0-1)
  }
  // � WAVE 1033: Fluid Matrix Physics output
  lavaLamp?: {
    thermalEnergy: number    // 0-1: Energía acumulada
    activePackets: number    // Cantidad de thermal packets activos
    lighthousePan: number    // Offset de pan del faro (-1 a 1)
    lighthouseTilt: number   // Offset de tilt del faro (-1 a 1)
    bubbleTiltBoost: number  // Boost de tilt por packets activos
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 🌊 PERLIN NOISE - Para movimiento browniano orgánico
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Implementación simplificada de Perlin Noise 1D
 * Genera valores suaves pseudo-aleatorios basados en coordenada temporal
 * 
 * 🚫 NO usa Math.random() - AXIOMA ANTI-SIMULACIÓN
 * Usa hash determinista basado en la posición
 */
class PerlinNoise {
  private permutation: number[] = []
  
  constructor(seed: number = 42) {
    // Generar tabla de permutación determinista basada en seed
    for (let i = 0; i < 256; i++) {
      this.permutation[i] = i
    }
    // Fisher-Yates shuffle con seed determinista
    for (let i = 255; i > 0; i--) {
      // Hash determinista en lugar de Math.random()
      const j = Math.floor(this.seededRandom(seed + i) * (i + 1))
      ;[this.permutation[i], this.permutation[j]] = [this.permutation[j], this.permutation[i]]
    }
    // Duplicar para evitar overflow
    this.permutation = [...this.permutation, ...this.permutation]
  }
  
  /**
   * Generador determinista basado en seed
   * Retorna valor 0-1 basado en input
   */
  private seededRandom(x: number): number {
    const sin = Math.sin(x * 12.9898 + 78.233) * 43758.5453
    return sin - Math.floor(sin)
  }
  
  /**
   * Función de interpolación suave (smoothstep)
   */
  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10)
  }
  
  /**
   * Interpolación lineal
   */
  private lerp(a: number, b: number, t: number): number {
    return a + t * (b - a)
  }
  
  /**
   * Gradiente pseudo-aleatorio
   */
  private grad(hash: number, x: number): number {
    return (hash & 1) === 0 ? x : -x
  }
  
  /**
   * 🌊 Noise 1D - El corazón del drift browniano
   * 
   * @param x - Coordenada temporal (avanza muy lento: x0.1)
   * @returns Valor entre -1 y 1
   */
  public noise1D(x: number): number {
    const X = Math.floor(x) & 255
    const xf = x - Math.floor(x)
    const u = this.fade(xf)
    
    const a = this.permutation[X]
    const b = this.permutation[X + 1]
    
    return this.lerp(
      this.grad(a, xf),
      this.grad(b, xf - 1),
      u
    )
  }
  
  /**
   * 🌊 Noise 2D - Para campos vectoriales Pan/Tilt
   */
  public noise2D(x: number, y: number): number {
    // Combinar dos ruidos 1D desfasados
    return (this.noise1D(x) + this.noise1D(y + 100)) * 0.5
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// � CHILL STEREO PHYSICS - THE FLUID MATRIX
// ═══════════════════════════════════════════════════════════════════════════

export class ChillStereoPhysics {
  // ═══════════════════════════════════════════════════════════════════════
  // CONSTANTES DE FLUIDO
  // ═══════════════════════════════════════════════════════════════════════
  
  // 💡 BIOLUMINISCENCIA: Pisos y techos
  private readonly AMBIENT_FLOOR = 0.12      // La sala NUNCA está oscura
  private readonly FRONT_FLOOR = 0.10        // Front más sutil
  private readonly BACK_FLOOR = 0.20         // Back siempre presente (ambiente)
  private readonly MOVER_FLOOR = 0.08        // Movers casi invisibles en reposo
  private readonly INTENSITY_CEILING = 0.75  // Nunca cegar en Chill
  
  // 🌊 VISCOSIDAD: Qué tan "espeso" es el fluido
  // 🌊 WAVE 1032.2: Reducida para permitir cambios más perceptibles
  // 🫧 WAVE 1032.3: Mínimo bajado a 0.60 para drift más inquieto
  // WARM (Jazz/Soul) = Alta viscosidad (miel, pero no melaza)
  // CLEAN (Deep House/Ambient) = Media-baja viscosidad (agua ligera)
  private readonly VISCOSITY_WARM = 0.75     // Miel ligera (era 0.80)
  private readonly VISCOSITY_CLEAN = 0.60    // Agua + movimiento (era 0.70)
  private readonly VISCOSITY_DEFAULT = 0.68  // Default intermedio (era 0.75)
  
  // ⏱️ LOW-PASS FILTER: Tiempos de respuesta
  // 🌊 WAVE 1032.2: Acelerado para ser perceptible sin perder fluidez
  // Attack: 0.5s → 0.2s (más responsive)
  // Decay: 2.0s → 0.8s (suave pero visible)
  private readonly ATTACK_TIME_SECONDS = 0.2   // 200ms para subir (era 500ms)
  private readonly DECAY_TIME_SECONDS = 0.8    // 800ms para bajar (era 2000ms)
  private readonly FRAMES_PER_SECOND = 60
  
  // Factores calculados (convertir tiempo a factor de convergencia)
  // Factor = 1 - e^(-1 / (time * fps))
  private readonly ATTACK_FACTOR = 1 - Math.exp(-1 / (this.ATTACK_TIME_SECONDS * this.FRAMES_PER_SECOND))
  private readonly DECAY_FACTOR = 1 - Math.exp(-1 / (this.DECAY_TIME_SECONDS * this.FRAMES_PER_SECOND))
  
  // 🍃 DRIFT BROWNIANO: Velocidad del ruido Perlin
  private readonly DRIFT_SPEED = 0.008        // MUY lento (como medusa)
  private readonly DRIFT_AMPLITUDE = 0.15     // ±15% de variación
  
  // 🎧 STEREO DRIFT: Desfase entre fixtures L/R
  private readonly STEREO_OFFSET_SECONDS = 0.5  // 500ms de desfase
  private readonly STEREO_OFFSET_FRAMES = this.STEREO_OFFSET_SECONDS * this.FRAMES_PER_SECOND
  
  // ✨ SPARKLE: Micro-brillos para CLEAN + alta clarity
  private readonly SPARKLE_CLARITY_THRESHOLD = 0.92
  private readonly SPARKLE_INTENSITY = 0.08   // Muy sutil
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🌋 WAVE 1033: THE FLUID MATRIX - Thermal Packets
  // ═══════════════════════════════════════════════════════════════════════
  
  // 🌡️ HEAT ACCUMULATOR - Acumulación térmica
  private readonly HEAT_CHARGE_RATE = 0.035     // Carga por frame con subBass
  private readonly HEAT_DECAY_RATE = 0.95       // 5% pérdida sin subBass
  private readonly PACKET_THRESHOLD = 0.50      // Umbral para disparar packet
  private readonly PACKET_COOLDOWN_FRAMES = 120 // ~2 segundos entre packets
  
  // 🌊 THERMAL PACKET - Corriente ascendente (FRONT → BACK → MOVERS)
  private readonly PACKET_TOTAL_DURATION = 4.5  // Segundos totales de viaje
  private readonly PACKET_FRONT_END = 1.5       // T=0 a T=1.5s en FRONT
  private readonly PACKET_BACK_START = 0.8      // Solapamiento: Back empieza T=0.8s
  private readonly PACKET_BACK_END = 3.0        // T=0.8s a T=3.0s en BACK
  private readonly PACKET_MOVER_START = 1.8     // Solapamiento: Movers empiezan T=1.8s
  private readonly PACKET_PEAK_INTENSITY = 0.70 // Intensidad máxima del packet
  private readonly PACKET_BYPASS_AGC = 0.6      // Bypass POST-AGC (60% directo)
  
  // 🧂 GRANULARITY - Textura micro
  private readonly GRAIN_LFO_WARM = 0.5         // 0.5Hz para WARM (vela)
  private readonly GRAIN_LFO_AMPLITUDE = 0.12   // ±12% de modulación
  
  // 💓 TIDAL BREATH - Onda global de fondo
  private readonly TIDAL_FREQUENCY = 0.1        // 0.1Hz = 10 segundos por ciclo
  private readonly TIDAL_AMPLITUDE = 0.05       // ±5% muy sutil
  
  // 🔦 LIGHTHOUSE - Faro constante (movimiento garantizado)
  private readonly LIGHTHOUSE_FREQUENCY = 0.08   // 0.08 Hz = ciclo de 12.5 segundos
  private readonly LIGHTHOUSE_AMPLITUDE = 0.25   // ±25% del rango de pan
  
  // ═══════════════════════════════════════════════════════════════════════
  // ESTADO INTERNO
  // ═══════════════════════════════════════════════════════════════════════
  
  private frameCount = 0
  
  // 💡 Valores actuales de intensidad (low-pass filtered)
  private frontVal = this.FRONT_FLOOR
  private backVal = this.BACK_FLOOR
  private moverValL = this.MOVER_FLOOR
  private moverValR = this.MOVER_FLOOR
  
  // 🌊 Target values (lo que la luz "quiere" ser)
  private targetFront = this.FRONT_FLOOR
  private targetBack = this.BACK_FLOOR
  private targetMoverL = this.MOVER_FLOOR
  private targetMoverR = this.MOVER_FLOOR
  
  // 🍃 Perlin Noise generator para drift browniano
  private perlin = new PerlinNoise(42)
  private driftTime = 0
  
  // 🎧 Buffer circular para stereo delay
  private stereoBuffer: number[] = []
  private stereoBufferIndex = 0
  
  // 📊 Smoothed inputs (ultra low-pass)
  private smoothBass = 0.1
  private smoothMid = 0.1
  private smoothTreble = 0.05
  private smoothEnergy = 0.1
  
  // 🌡️ Current viscosity (adapts to texture)
  private currentViscosity = this.VISCOSITY_DEFAULT
  
  // 💫 Breath phase for organic pulsing
  private breathPhase = 0
  private readonly BREATH_PERIOD_SECONDS = 8  // Respiración de 8 segundos
  
  // ═══════════════════════════════════════════════════════════════════════
  // � WAVE 1033: FLUID MATRIX STATE
  // ═══════════════════════════════════════════════════════════════════════
  
  // 🌡️ Heat Accumulator
  private thermalEnergy = 0.0           // 0.0 - 1.0
  private packetCooldown = 0            // Frames hasta poder disparar otro packet
  
  // 🌊 Active Thermal Packets (corrientes ascendentes)
  private activePackets: Array<{
    startFrame: number              // Cuando empezó
    side: 'L' | 'R'                 // Lado del escenario
    peakIntensity: number           // Intensidad máxima
  }> = []
  
  // 💓 Tidal Breath phase (onda global de fondo)
  private tidalPhase = 0
  
  // 🧂 Grain LFO phase (micro-textura)
  private grainPhase = 0
  
  // 🔦 Lighthouse phase (siempre activo)
  private lighthousePhase = 0
  
  constructor() {
    // Inicializar buffer de stereo delay
    for (let i = 0; i < this.STEREO_OFFSET_FRAMES; i++) {
      this.stereoBuffer.push(this.MOVER_FLOOR)
    }
    console.log('[ChillStereoPhysics] � WAVE 1033: THE FLUID MATRIX initialized')
    console.log(`[ChillStereoPhysics] 🔥 Packet Duration: ${this.PACKET_TOTAL_DURATION}s | Tidal: ${this.TIDAL_FREQUENCY}Hz | Grain: ${this.GRAIN_LFO_WARM}Hz`)
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // API PÚBLICA
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * 🍸 Procesa física de fluidos para ambiente Chill
   */
  public applyZones(input: ChillPhysicsInput): ChillPhysicsResult {
    this.frameCount++
    
    const { 
      bass, mid, treble, energy, 
      isRealSilence, isAGCTrap,
      texture = 'clean',
      clarity = 0.5,
      subBass,
      spectralCentroid
    } = input
    
    // ─────────────────────────────────────────────────────────────────────
    // 1. ADAPTAR VISCOSIDAD SEGÚN TEXTURA
    // ─────────────────────────────────────────────────────────────────────
    this.adaptViscosity(texture)
    
    // ─────────────────────────────────────────────────────────────────────
    // 2. ULTRA LOW-PASS FILTER EN INPUTS
    // ─────────────────────────────────────────────────────────────────────
    // La señal de entrada ya llega "viscosa" - esto es el SECRETO
    // La luz responde al PROMEDIO de la música, no a cada nota
    this.smoothInputs(bass, mid, treble, energy)
    
    // ─────────────────────────────────────────────────────────────────────
    // 3. CALCULAR TARGETS (hacia dónde "fluye" la luz)
    // ─────────────────────────────────────────────────────────────────────
    this.calculateTargets(texture, clarity, subBass, spectralCentroid)
    
    // ─────────────────────────────────────────────────────────────────────
    // 4. APLICAR LOW-PASS FILTER ASIMÉTRICO (MAREA)
    // ─────────────────────────────────────────────────────────────────────
    // Attack lento (0.5s), Decay MUY lento (2.0s)
    // La sala se "hincha" de luz y tarda en "exhalar"
    const silenceBoost = (isRealSilence || isAGCTrap) ? 3.0 : 1.0
    
    this.frontVal = this.tidalFilter(this.frontVal, this.targetFront, silenceBoost)
    this.backVal = this.tidalFilter(this.backVal, this.targetBack, silenceBoost)
    
    // ─────────────────────────────────────────────────────────────────────
    // 5. DRIFT BROWNIANO PARA MOVERS (Movimiento de medusa)
    // ─────────────────────────────────────────────────────────────────────
    this.applyBrownianDrift()
    
    // ─────────────────────────────────────────────────────────────────────
    // 6. STEREO DRIFT (Ola que viaja por la sala)
    // ─────────────────────────────────────────────────────────────────────
    this.applyStereoDelay()
    
    // ─────────────────────────────────────────────────────────────────────
    // 7. SPARKLES PARA CLEAN + ALTA CLARITY (+ Carbonatación fallback)
    // 🫧 WAVE 1032.3: Ahora busca vida en treble si no hay clarity
    // ─────────────────────────────────────────────────────────────────────
    const sparkleBoost = this.calculateSparkle(texture, clarity, input)
    
    // ─────────────────────────────────────────────────────────────────────
    // 8. RESPIRACIÓN ORGÁNICA (Modulación de fondo)
    // ─────────────────────────────────────────────────────────────────────
    const breathMod = this.calculateBreathing()
    
    // ─────────────────────────────────────────────────────────────────────
    // 🔥 8.5. EFECTO BRASAS (EMBER) - Para música oscura/WARM
    // 🫧 WAVE 1032.3: Micro-pulso en el bajo cuando no hay brillos
    // ─────────────────────────────────────────────────────────────────────
    let emberGlow = 0
    if (texture === 'warm' || (spectralCentroid && spectralCentroid < 1200)) {
      // Música oscura: modular con el bajo para dar vida
      const bassPulse = (subBass ?? bass) * 0.15
      const slowPulse = Math.sin(this.frameCount * 0.03) * 0.5 + 0.5
      emberGlow = bassPulse * slowPulse * 0.08  // Micro-pulso sutil
    }
    
    // ─────────────────────────────────────────────────────────────────────
    // 🌋 9. LAVA LAMP PHYSICS (WAVE 1032.4)
    // ─────────────────────────────────────────────────────────────────────
    
    // 🌡️ 9.1 Heat Accumulator - Cargar y disparar burbujas
    const highMid = (mid + treble) * 0.5  // HighMid para Deep House oscuro
    this.updateHeatAccumulator(subBass ?? bass, highMid)
    
    // 🌊 9.2 Process Thermal Packets - Corriente ascendente FRONT→BACK→MOVERS
    const packetContribution = this.processThermalPackets()
    
    // 🧂 9.3 Granularity - Micro-textura según audio
    const grainMod = this.processGranularity(texture)
    
    // 💓 9.4 Tidal Breath - Onda sinusoidal global de fondo
    const tidalMod = this.processTidalBreath()
    
    // 🔦 9.5 Lighthouse - Movimiento constante garantizado
    const lighthouse = this.updateLighthouse()
    
    // ─────────────────────────────────────────────────────────────────────
    // 10. CONSTRUIR OUTPUT FINAL
    // 🔥 WAVE 1032.2: BUBBLE BYPASS - Las burbujas se suman POST-AGC
    // Base respeta el Chill, burbujas rompen el límite
    // ─────────────────────────────────────────────────────────────────────
    
    // BASE (con AGC implícito via viscosidad) + TIDAL BREATH
    // Tidal solo aplica a zonas SIN packet activo
    const baseFront = Math.min(
      this.INTENSITY_CEILING, 
      this.frontVal + breathMod * 0.03 + emberGlow + (packetContribution.front < 0.1 ? tidalMod : 0)
    )
    const baseBack = Math.min(
      this.INTENSITY_CEILING, 
      this.backVal + sparkleBoost + breathMod * 0.05 + emberGlow * 0.5 + (packetContribution.back < 0.1 ? tidalMod : 0)
    )
    const baseMoverL = Math.min(
      this.INTENSITY_CEILING, 
      this.moverValL + breathMod * 0.02 + (packetContribution.moverL < 0.1 ? tidalMod : 0)
    )
    const baseMoverR = Math.min(
      this.INTENSITY_CEILING, 
      this.moverValR + breathMod * 0.02 + (packetContribution.moverR < 0.1 ? tidalMod : 0)
    )
    
    // PACKET BYPASS: Se suma por encima del AGC (con granularidad)
    const grainedFront = packetContribution.front * (1 + grainMod)
    const grainedBack = packetContribution.back * (1 + grainMod)
    const grainedMoverL = packetContribution.moverL * (1 + grainMod)
    const grainedMoverR = packetContribution.moverR * (1 + grainMod)
    
    const finalFront = Math.min(1.0, baseFront + (grainedFront * this.PACKET_BYPASS_AGC))
    const finalBack = Math.min(1.0, baseBack + (grainedBack * this.PACKET_BYPASS_AGC))
    const finalMoverL = Math.min(1.0, baseMoverL + (grainedMoverL * this.PACKET_BYPASS_AGC))
    const finalMoverR = Math.min(1.0, baseMoverR + (grainedMoverR * this.PACKET_BYPASS_AGC))
    
    // Intensidad promedio para legacy API
    const avgMover = (finalMoverL + finalMoverR) / 2
    
    // Log cada 90 frames (~1.5 segundos) - MEJORADO con Lava Lamp stats
    if (this.frameCount % 90 === 0) {
      console.log(
        `[� FLUID MATRIX] Thermal:${(this.thermalEnergy * 100).toFixed(0)}% Packets:${this.activePackets.length} | ` +
        `F:${(finalFront * 100).toFixed(0)}% B:${(finalBack * 100).toFixed(0)}% ` +
        `ML:${(finalMoverL * 100).toFixed(0)}% MR:${(finalMoverR * 100).toFixed(0)}% | ` +
        `🔦 Pan:${(lighthouse.panOffset * 100).toFixed(0)}% Tilt:${(lighthouse.tiltOffset * 100).toFixed(0)}%`
      )
    }
    
    return {
      frontParIntensity: finalFront,
      backParIntensity: finalBack,
      moverIntensity: avgMover,             // Legacy: promedio
      moverIntensityL: finalMoverL,         // 🫧 WAVE 1032.10: Individual L
      moverIntensityR: finalMoverR,         // 🫧 WAVE 1032.10: Individual R
      moverActive: avgMover > this.MOVER_FLOOR + 0.05,
      physicsApplied: 'chill',
      fluidState: {
        viscosity: this.currentViscosity,
        breathPhase: this.breathPhase,
        driftPhaseL: this.driftTime,
        driftPhaseR: this.driftTime + 0.5,
        stereoOffset: this.STEREO_OFFSET_SECONDS
      },
      // 🌊 FLUID MATRIX OUTPUT
      lavaLamp: {
        thermalEnergy: this.thermalEnergy,
        activePackets: this.activePackets.length,
        lighthousePan: lighthouse.panOffset,
        lighthouseTilt: lighthouse.tiltOffset + packetContribution.tiltBoost,
        bubbleTiltBoost: packetContribution.tiltBoost
      }
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // MÉTODOS PRIVADOS - FÍSICA DE FLUIDOS
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * 🌡️ Adapta la viscosidad según la textura del audio
   * WARM = Alta viscosidad (miel, Jazz/Soul)
   * CLEAN = Media viscosidad (agua, Deep House/Ambient)
   */
  private adaptViscosity(texture: string): void {
    let targetViscosity: number
    
    switch (texture) {
      case 'warm':
        // 🍯 WARM (Jazz, Soul): Miel
        // Movimientos pesados, ignorar agudos completamente
        targetViscosity = this.VISCOSITY_WARM
        break
        
      case 'clean':
        // 💧 CLEAN (Deep House, Ambient): Agua
        // Movimiento fluido, permite micro-brillos
        targetViscosity = this.VISCOSITY_CLEAN
        break
        
      case 'harsh':
      case 'noisy':
        // 🌫️ HARSH/NOISY: Más viscoso para suavizar
        targetViscosity = this.VISCOSITY_WARM * 1.05
        break
        
      default:
        targetViscosity = this.VISCOSITY_DEFAULT
    }
    
    // Transición suave de viscosidad (no cambiar bruscamente)
    this.currentViscosity = this.currentViscosity * 0.95 + targetViscosity * 0.05
  }
  
  /**
   * 🌊 Ultra Low-Pass Filter en las señales de entrada
   * La luz responde al PROMEDIO de la música, no a cada nota
   */
  private smoothInputs(bass: number, mid: number, treble: number, energy: number): void {
    // Factor de smoothing basado en viscosidad
    // Mayor viscosidad = más smoothing
    const smoothFactor = this.currentViscosity
    
    this.smoothBass = this.smoothBass * smoothFactor + bass * (1 - smoothFactor)
    this.smoothMid = this.smoothMid * smoothFactor + mid * (1 - smoothFactor)
    this.smoothTreble = this.smoothTreble * smoothFactor + treble * (1 - smoothFactor)
    this.smoothEnergy = this.smoothEnergy * smoothFactor + energy * (1 - smoothFactor)
  }
  
  /**
   * 🎯 Calcula los targets hacia donde "fluye" la luz
   * Basado en texture:
   * - WARM: Solo escuchar el bajo, ignorar agudos
   * - CLEAN: Permitir micro-brillos si clarity alta
   */
  private calculateTargets(
    texture: string, 
    clarity: number,
    subBass?: number,
    spectralCentroid?: number
  ): void {
    // ─────────────────────────────────────────────────────────────────────
    // FRONT: Basado en SubBass/Bass (presión de aire)
    // 🌊 WAVE 1032.2: Incrementados multiplicadores para mayor dynamic range
    // ─────────────────────────────────────────────────────────────────────
    const bassSource = subBass ?? this.smoothBass
    const frontRaw = bassSource * 0.6 + this.smoothEnergy * 0.35  // Era 0.4 + 0.2
    this.targetFront = Math.max(this.FRONT_FLOOR, Math.min(0.7, frontRaw))  // Era 0.5
    
    // ─────────────────────────────────────────────────────────────────────
    // BACK: Ambiente general + brillo tonal
    // ─────────────────────────────────────────────────────────────────────
    // El centroide espectral indica "brillo" - valores altos = más luz back
    const brightnessFromCentroid = spectralCentroid 
      ? Math.min(1, spectralCentroid / 4000) * 0.2   // Era 0.15
      : 0
    
    if (texture === 'warm') {
      // WARM: Ignorar agudos completamente, solo energía general
      this.targetBack = Math.max(
        this.BACK_FLOOR, 
        this.BACK_FLOOR + this.smoothEnergy * 0.4 + brightnessFromCentroid  // Era 0.25
      )
    } else {
      // CLEAN/DEFAULT: Permitir algo de treble influence
      const trebleInfluence = this.smoothTreble * 0.25  // Era 0.15
      this.targetBack = Math.max(
        this.BACK_FLOOR,
        this.BACK_FLOOR + this.smoothEnergy * 0.35 + trebleInfluence + brightnessFromCentroid  // Era 0.2
      )
    }
    
    // ─────────────────────────────────────────────────────────────────────
    // MOVERS: Basados en Mid (melodías) con rechazo de percusión
    // 🌊 WAVE 1032.2: Incrementado multiplicador para mayor presencia
    // ─────────────────────────────────────────────────────────────────────
    // Si hay mucho treble (snares, hi-hats), REDUCIR movers
    const percussionRejection = Math.max(0.3, 1 - this.smoothTreble * 2)
    
    const moverBase = this.smoothMid * 0.55 * percussionRejection  // Era 0.35
    this.targetMoverL = Math.max(this.MOVER_FLOOR, moverBase)
    this.targetMoverR = Math.max(this.MOVER_FLOOR, moverBase)
  }
  
  /**
   * 🌊 Filtro de Marea - Low-pass asimétrico
   * Attack lento (0.5s), Decay MUY lento (2.0s)
   * La sala se "hincha" de luz y tarda mucho en "exhalar"
   */
  private tidalFilter(current: number, target: number, silenceBoost: number): number {
    if (target > current) {
      // SUBIENDO (Inhalación): 0.5 segundos
      return current + (target - current) * this.ATTACK_FACTOR
    } else {
      // BAJANDO (Exhalación): 2.0 segundos (multiplicado por silenceBoost si hay silencio)
      return current + (target - current) * this.DECAY_FACTOR * silenceBoost
    }
  }
  
  /**
   * 🍃 Drift Browniano - Movimiento de medusa
   * Los movers nunca se paran, pero tampoco van a ningún sitio concreto
   * Usa Perlin Noise para movimiento orgánico
   */
  private applyBrownianDrift(): void {
    // Avanzar tiempo MUY lento
    this.driftTime += this.DRIFT_SPEED
    
    // Generar drift independiente para L y R usando Perlin Noise
    const driftL = this.perlin.noise1D(this.driftTime) * this.DRIFT_AMPLITUDE
    const driftR = this.perlin.noise1D(this.driftTime + 100) * this.DRIFT_AMPLITUDE
    
    // Aplicar drift al target de movers
    const targetWithDriftL = this.targetMoverL * (1 + driftL)
    const targetWithDriftR = this.targetMoverR * (1 + driftR)
    
    // Aplicar filtro tidal a los movers (muy suave)
    this.moverValL = this.tidalFilter(this.moverValL, targetWithDriftL, 1.0)
    this.moverValR = this.tidalFilter(this.moverValR, targetWithDriftR, 1.0)
    
    // Clamp a los floors
    this.moverValL = Math.max(this.MOVER_FLOOR, this.moverValL)
    this.moverValR = Math.max(this.MOVER_FLOOR, this.moverValR)
  }
  
  /**
   * 🎧 Stereo Drift - Ola que viaja por la sala
   * Fixture izquierdo brilla primero, el derecho 0.5s después
   * Crea profundidad espacial
   */
  private applyStereoDelay(): void {
    // Guardar valor actual de moverL en el buffer
    this.stereoBuffer[this.stereoBufferIndex] = this.moverValL
    
    // Obtener valor retrasado para moverR
    const delayedIndex = (this.stereoBufferIndex + 1) % this.stereoBuffer.length
    const delayedValue = this.stereoBuffer[delayedIndex]
    
    // Mezclar valor actual con valor retrasado (50% cada uno)
    this.moverValR = this.moverValR * 0.5 + delayedValue * 0.5
    
    // Avanzar índice del buffer circular
    this.stereoBufferIndex = (this.stereoBufferIndex + 1) % this.stereoBuffer.length
  }
  
  /**
   * ✨ Sparkles - Micro-brillos para CLEAN + alta clarity
   * 🫧 WAVE 1032.3 CARBONATACIÓN: Plan B cuando no hay UltraAir
   * 
   * ANTES: Sparkles solo para CLEAN + clarity alta (purismo)
   * AHORA: Buscar vida en ritmo/groove si no hay agudos cristalinos
   */
  private calculateSparkle(
    texture: string, 
    clarity: number,
    input?: ChillPhysicsInput
  ): number {
    // ─────────────────────────────────────────────────────────────────────
    // PLAN A: Sparkles tradicionales (CLEAN + clarity)
    // ─────────────────────────────────────────────────────────────────────
    if (texture === 'clean' && clarity >= this.SPARKLE_CLARITY_THRESHOLD) {
      // Sparkle basado en tiempo (determinista, no random)
      const sparklePhase = Math.sin(this.frameCount * 0.05) * 0.5 + 0.5
      const clarityBonus = (clarity - this.SPARKLE_CLARITY_THRESHOLD) * 5  // 0-0.4
      
      return sparklePhase * this.SPARKLE_INTENSITY * clarityBonus
    }
    
    // ─────────────────────────────────────────────────────────────────────
    // 🫧 PLAN B: CARBONATACIÓN - Buscar vida en el groove
    // ─────────────────────────────────────────────────────────────────────
    // Si no hay clarity, pero SÍ hay ritmo/treble, usar eso como "burbujas"
    if (!input) return 0
    
    const hasTreble = (input.treble || 0) > 0.3
    const hasEnergy = (input.energy || 0) > 0.3
    
    if (hasTreble && hasEnergy) {
      // Micro-burbujas basadas en treble (hi-hats, shakers)
      const bubbleIntensity = (input.treble || 0) * 0.15
      const rhythmMod = Math.sin(this.frameCount * 0.08) * 0.5 + 0.5
      return bubbleIntensity * rhythmMod
    }
    
    return 0
  }
  
  /**
   * 💫 Respiración orgánica - Modulación de fondo
   * Onda sinusoidal muy lenta (8 segundos de período)
   */
  private calculateBreathing(): number {
    // Avanzar fase de respiración
    const breathSpeed = (2 * Math.PI) / (this.BREATH_PERIOD_SECONDS * this.FRAMES_PER_SECOND)
    this.breathPhase += breathSpeed
    
    // Mantener fase en rango 0-2π
    if (this.breathPhase > 2 * Math.PI) {
      this.breathPhase -= 2 * Math.PI
    }
    
    // Onda sinusoidal: -1 a +1 → 0 a 1
    return (Math.sin(this.breathPhase) * 0.5 + 0.5) * 0.1  // ±10% de modulación
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // LEGACY API - Compatibilidad con SeleneLux
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Legacy API para SeleneLux
   */
  public apply(
    palette: any, 
    metrics: any, 
    _mods?: ElementalModifiers, 
    _bpm?: number
  ): any {
    const result = this.applyZones({
      bass: metrics.normalizedBass,
      mid: metrics.normalizedMid,
      treble: metrics.normalizedTreble,
      energy: metrics.normalizedEnergy,
      isRealSilence: false,
      isAGCTrap: false,
      // Pasar métricas espectrales si están disponibles
      texture: metrics.texture,
      clarity: metrics.clarity,
      subBass: metrics.subBass,
      spectralCentroid: metrics.spectralCentroid
    })

    return {
      palette,
      breathPhase: result.fluidState?.breathPhase ?? 0,
      isStrobe: false,  // NUNCA strobe en Chill
      dimmerModulation: 0,
      zoneIntensities: {
        front: result.frontParIntensity,
        back: result.backParIntensity,
        moverL: result.moverIntensityL,   // 🫧 WAVE 1032.10: Usar valores del result
        moverR: result.moverIntensityR    // 🫧 WAVE 1032.10: Usar valores del result
      },
      debugInfo: {
        bassHit: false,  // No hay "hits" en fluid physics
        midHit: false,
        padActive: result.moverActive,
        twilightPhase: this.breathPhase,
        crossFadeRatio: 0,
        viscosity: result.fluidState?.viscosity ?? this.currentViscosity
      }
    }
  }
  
  /**
   * Reset estado
   */
  public reset(): void {
    this.frontVal = this.FRONT_FLOOR
    this.backVal = this.BACK_FLOOR
    this.moverValL = this.MOVER_FLOOR
    this.moverValR = this.MOVER_FLOOR
    this.targetFront = this.FRONT_FLOOR
    this.targetBack = this.BACK_FLOOR
    this.targetMoverL = this.MOVER_FLOOR
    this.targetMoverR = this.MOVER_FLOOR
    this.smoothBass = 0.1
    this.smoothMid = 0.1
    this.smoothTreble = 0.05
    this.smoothEnergy = 0.1
    this.driftTime = 0
    this.breathPhase = 0
    this.stereoBufferIndex = 0
    for (let i = 0; i < this.stereoBuffer.length; i++) {
      this.stereoBuffer[i] = this.MOVER_FLOOR
    }
    // � Reset Fluid Matrix state
    this.thermalEnergy = 0
    this.packetCooldown = 0
    this.activePackets = []
    this.tidalPhase = 0
    this.grainPhase = 0
    this.lighthousePhase = 0
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // � WAVE 1033: FLUID MATRIX PHYSICS METHODS
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * 🌡️ HEAT ACCUMULATOR - Acumula energía del bajo y dispara thermal packets
   * 
   * No reacciona al bombo. Se CARGA con el ritmo y se libera como corriente ascendente.
   */
  private updateHeatAccumulator(subBass: number, highMid: number): void {
    // ─────────────────────────────────────────────────────────────────────
    // CARGAR CALOR
    // ─────────────────────────────────────────────────────────────────────
    const heatInput = Math.max(subBass, highMid * 0.7)
    this.thermalEnergy += heatInput * this.HEAT_CHARGE_RATE
    
    // ─────────────────────────────────────────────────────────────────────
    // ENFRIAMIENTO NATURAL
    // ─────────────────────────────────────────────────────────────────────
    this.thermalEnergy *= this.HEAT_DECAY_RATE
    this.thermalEnergy = Math.min(1.0, Math.max(0, this.thermalEnergy))
    
    // ─────────────────────────────────────────────────────────────────────
    // DISPARAR THERMAL PACKET SI HAY SUFICIENTE CALOR
    // ─────────────────────────────────────────────────────────────────────
    if (this.packetCooldown > 0) {
      this.packetCooldown--
    }
    
    if (this.thermalEnergy > this.PACKET_THRESHOLD && 
        this.packetCooldown === 0 && 
        this.activePackets.length < 2) {  // Máximo 2 packets simultáneos (L y R)
      this.spawnThermalPacket()
      // Descargar parte del calor al crear packet
      this.thermalEnergy *= 0.5
      this.packetCooldown = this.PACKET_COOLDOWN_FRAMES
    }
  }
  
  /**
   * 🌊 SPAWN THERMAL PACKET - Crea una corriente ascendente
   * Alterna entre lado L y R para crear movimiento estéreo
   */
  private spawnThermalPacket(): void {
    // Alternar lado (L→R→L→R...)
    const side: 'L' | 'R' = this.activePackets.length === 0 || 
                            this.activePackets[this.activePackets.length - 1]?.side === 'R' ? 'L' : 'R'
    
    // Varianza determinista basada en frame (AXIOMA ANTI-SIMULACIÓN)
    const intensityVariance = 0.85 + (this.frameCount % 30) / 100  // 0.85-1.15
    
    this.activePackets.push({
      startFrame: this.frameCount,
      side,
      peakIntensity: this.PACKET_PEAK_INTENSITY * intensityVariance
    })
    
    console.log(
      `[🌊 THERMAL] Packet spawned on ${side} | Thermal: ${(this.thermalEnergy * 100).toFixed(0)}% | ` +
      `Active: ${this.activePackets.length} | Intensity: ${(this.PACKET_PEAK_INTENSITY * intensityVariance * 100).toFixed(1)}%`
    )
  }
  
  /**
   * 🌊 PROCESS THERMAL PACKETS - Corriente ascendente FRONT → BACK → MOVERS
   * 
   * Coreografía:
   * - T=0.0s-1.5s: Energía en FRONT (nacimiento)
   * - T=0.8s-3.0s: Energía en BACK (transferencia, solapamiento)
   * - T=1.8s-4.5s: Energía en MOVERS + TILT UP (liberación, solapamiento)
   */
  private processThermalPackets(): { front: number; back: number; moverL: number; moverR: number; tiltBoost: number } {
    const result = { front: 0, back: 0, moverL: 0, moverR: 0, tiltBoost: 0 }
    
    // Filtrar packets muertos y procesar activos
    this.activePackets = this.activePackets.filter(packet => {
      const ageSeconds = (this.frameCount - packet.startFrame) / this.FRAMES_PER_SECOND
      
      if (ageSeconds >= this.PACKET_TOTAL_DURATION) {
        return false  // Packet muerto
      }
      
      const intensity = packet.peakIntensity
      const moverKey = packet.side === 'L' ? 'moverL' : 'moverR'
      
      // ─────────────────────────────────────────────────────────────────────
      // FRONT: T=0 a T=1.5s (nacimiento)
      // ─────────────────────────────────────────────────────────────────────
      if (ageSeconds < this.PACKET_FRONT_END) {
        // EaseInOutSine para attack/decay suave
        let frontIntensity: number
        if (ageSeconds < this.PACKET_FRONT_END * 0.5) {
          // Attack (0 → peak)
          const progress = ageSeconds / (this.PACKET_FRONT_END * 0.5)
          frontIntensity = Math.sin(progress * Math.PI / 2) * intensity
        } else {
          // Decay (peak → 0)
          const progress = (ageSeconds - this.PACKET_FRONT_END * 0.5) / (this.PACKET_FRONT_END * 0.5)
          frontIntensity = Math.cos(progress * Math.PI / 2) * intensity
        }
        result.front += frontIntensity
      }
      
      // ─────────────────────────────────────────────────────────────────────
      // BACK: T=0.8s a T=3.0s (transferencia)
      // ─────────────────────────────────────────────────────────────────────
      if (ageSeconds > this.PACKET_BACK_START && ageSeconds < this.PACKET_BACK_END) {
        const backAge = ageSeconds - this.PACKET_BACK_START
        const backDuration = this.PACKET_BACK_END - this.PACKET_BACK_START
        let backIntensity: number
        
        if (backAge < backDuration * 0.4) {
          // Attack
          const progress = backAge / (backDuration * 0.4)
          backIntensity = Math.sin(progress * Math.PI / 2) * intensity
        } else if (backAge < backDuration * 0.6) {
          // Peak
          backIntensity = intensity
        } else {
          // Decay
          const progress = (backAge - backDuration * 0.6) / (backDuration * 0.4)
          backIntensity = Math.cos(progress * Math.PI / 2) * intensity
        }
        result.back += backIntensity
      }
      
      // ─────────────────────────────────────────────────────────────────────
      // MOVERS: T=1.8s a T=4.5s (liberación) + TILT UP
      // ─────────────────────────────────────────────────────────────────────
      if (ageSeconds > this.PACKET_MOVER_START) {
        const moverAge = ageSeconds - this.PACKET_MOVER_START
        const moverDuration = this.PACKET_TOTAL_DURATION - this.PACKET_MOVER_START
        let moverIntensity: number
        let tiltBoost: number
        
        if (moverAge < moverDuration * 0.3) {
          // Attack + Tilt UP
          const progress = moverAge / (moverDuration * 0.3)
          moverIntensity = Math.sin(progress * Math.PI / 2) * intensity
          tiltBoost = progress * 0.2  // 20% tilt boost al máximo
        } else if (moverAge < moverDuration * 0.5) {
          // Peak + Max Tilt
          moverIntensity = intensity
          tiltBoost = 0.2
        } else {
          // Decay + Tilt DOWN
          const progress = (moverAge - moverDuration * 0.5) / (moverDuration * 0.5)
          moverIntensity = Math.cos(progress * Math.PI / 2) * intensity
          tiltBoost = (1 - progress) * 0.2
        }
        
        result[moverKey] += moverIntensity
        result.tiltBoost += tiltBoost
      }
      
      return true  // Packet sigue vivo
    })
    
    return result
  }
  
  /**
   * 🧂 PROCESS GRANULARITY - Micro-textura según audio
   * 
   * WARM: Micro-parpadeo 0.5Hz (vela/fuego)
   * CLEAN: Intensidad sólida (medusa bioluminiscente)
   */
  private processGranularity(texture: string): number {
    // Avanzar fase del LFO
    this.grainPhase += (2 * Math.PI * this.GRAIN_LFO_WARM) / this.FRAMES_PER_SECOND
    if (this.grainPhase > Math.PI * 2) this.grainPhase -= Math.PI * 2
    
    if (texture === 'warm') {
      // WARM: Micro-parpadeo (efecto vela)
      return Math.sin(this.grainPhase) * this.GRAIN_LFO_AMPLITUDE
    } else {
      // CLEAN: Sin modulación (medusa bioluminiscente)
      return 0
    }
  }
  
  /**
   * 💓 PROCESS TIDAL BREATH - Onda sinusoidal global de fondo
   * 
   * Muy lenta (0.1Hz = 10 segundos), muy sutil (±5%)
   * Aplica a zonas sin packet activo para que la sala "respire"
   */
  private processTidalBreath(): number {
    // Avanzar fase
    this.tidalPhase += (2 * Math.PI * this.TIDAL_FREQUENCY) / this.FRAMES_PER_SECOND
    if (this.tidalPhase > Math.PI * 2) this.tidalPhase -= Math.PI * 2
    
    // Onda sinusoidal muy sutil
    return Math.sin(this.tidalPhase) * this.TIDAL_AMPLITUDE
  }
  
  /**
   * 🔦 LIGHTHOUSE DRIFT - Movimiento constante garantizado
   * 
   * LFO muy lento que mueve el pan de todos los fixtures.
   * SIEMPRE activo, incluso sin música.
   * "Escaneando el horizonte" - hipnótico como lámpara de lava.
   */
  private updateLighthouse(): { panOffset: number; tiltOffset: number } {
    // Avanzar fase (0.08 Hz = ciclo de 12.5 segundos)
    this.lighthousePhase += (2 * Math.PI * this.LIGHTHOUSE_FREQUENCY) / this.FRAMES_PER_SECOND
    
    // Wrap phase
    if (this.lighthousePhase > 2 * Math.PI) {
      this.lighthousePhase -= 2 * Math.PI
    }
    
    // Pan: Onda sinusoidal principal
    const panOffset = Math.sin(this.lighthousePhase) * this.LIGHTHOUSE_AMPLITUDE
    
    // Tilt: Onda más lenta y menor amplitud (movimiento de "respiración" vertical)
    const tiltOffset = Math.sin(this.lighthousePhase * 0.7) * (this.LIGHTHOUSE_AMPLITUDE * 0.4)
    
    return { panOffset, tiltOffset }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════════

export const chillStereoPhysics = new ChillStereoPhysics()

