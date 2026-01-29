/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🍸 WAVE 1032: THE LIQUID LOUNGE - Chill Fluid Physics
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * FILOSOFÍA: Dejar de "bailar" el Chill Out y empezar a "pintarlo".
 * 
 * DIAGNÓSTICO DEL SISTEMA ANTERIOR:
 * - Attack/Decay lineales sobre volumen = luz "nerviosa"
 * - En cuanto entra un golpe suave, la luz SALTA
 * - Se siente "reactivo" cuando debería "fluir"
 * 
 * SOLUCIÓN WAVE 1032: Física de FLUIDOS
 * - Cambiar de "Impacto" a "Viscosidad"
 * - Movimiento Browniano (Perlin Noise) para drift orgánico
 * - Low-Pass Filter EXTREMO para dimmer bioluminiscente
 * - Stereo Drift con desfase temporal (ola que viaja por la sala)
 * - Texture-aware: WARM=miel, CLEAN=agua
 * 
 * RESULTADO:
 * - Los huecos se llenan con atmósfera
 * - El estrés visual baja a CERO
 * - La luz siempre va un milisegundo DETRÁS de la música (como un eco)
 * - Ese es el SECRETO de la relajación
 * 
 * @module hal/physics/ChillStereoPhysics
 * @version WAVE 1032 - THE LIQUID LOUNGE
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
  moverIntensity: number
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
// 🍸 CHILL STEREO PHYSICS - THE LIQUID LOUNGE
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
  // WARM (Jazz/Soul) = Alta viscosidad (miel, pero no melaza)
  // CLEAN (Deep House/Ambient) = Media viscosidad (agua, no aceite)
  private readonly VISCOSITY_WARM = 0.80     // Miel: cambios lentos pero visibles (era 0.92)
  private readonly VISCOSITY_CLEAN = 0.70    // Agua: cambios suaves y perceptibles (era 0.85)
  private readonly VISCOSITY_DEFAULT = 0.75  // Default intermedio (era 0.88)
  
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
  
  constructor() {
    // Inicializar buffer de stereo delay
    for (let i = 0; i < this.STEREO_OFFSET_FRAMES; i++) {
      this.stereoBuffer.push(this.MOVER_FLOOR)
    }
    console.log('[ChillStereoPhysics] 🍸 WAVE 1032: THE LIQUID LOUNGE initialized')
    console.log(`[ChillStereoPhysics] 🌊 Attack: ${(this.ATTACK_TIME_SECONDS * 1000).toFixed(0)}ms | Decay: ${(this.DECAY_TIME_SECONDS * 1000).toFixed(0)}ms`)
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
    // 7. SPARKLES PARA CLEAN + ALTA CLARITY
    // ─────────────────────────────────────────────────────────────────────
    const sparkleBoost = this.calculateSparkle(texture, clarity)
    
    // ─────────────────────────────────────────────────────────────────────
    // 8. RESPIRACIÓN ORGÁNICA (Modulación de fondo)
    // ─────────────────────────────────────────────────────────────────────
    const breathMod = this.calculateBreathing()
    
    // ─────────────────────────────────────────────────────────────────────
    // 9. CONSTRUIR OUTPUT
    // ─────────────────────────────────────────────────────────────────────
    const finalFront = Math.min(this.INTENSITY_CEILING, this.frontVal + breathMod * 0.03)
    const finalBack = Math.min(this.INTENSITY_CEILING, this.backVal + sparkleBoost + breathMod * 0.05)
    const finalMoverL = Math.min(this.INTENSITY_CEILING, this.moverValL + breathMod * 0.02)
    const finalMoverR = Math.min(this.INTENSITY_CEILING, this.moverValR + breathMod * 0.02)
    
    // Intensidad promedio para legacy API
    const avgMover = (finalMoverL + finalMoverR) / 2
    
    // Log cada 90 frames (~1.5 segundos)
    if (this.frameCount % 90 === 0) {
      console.log(
        `[🍸 LIQUID LOUNGE] Viscosity:${this.currentViscosity.toFixed(2)} | ` +
        `F:${(finalFront * 100).toFixed(0)}% B:${(finalBack * 100).toFixed(0)}% ` +
        `ML:${(finalMoverL * 100).toFixed(0)}% MR:${(finalMoverR * 100).toFixed(0)}% | ` +
        `Breath:${(breathMod * 100).toFixed(0)}% Sparkle:${(sparkleBoost * 100).toFixed(0)}%`
      )
    }
    
    return {
      frontParIntensity: finalFront,
      backParIntensity: finalBack,
      moverIntensity: avgMover,
      moverActive: avgMover > this.MOVER_FLOOR + 0.05,
      physicsApplied: 'chill',
      fluidState: {
        viscosity: this.currentViscosity,
        breathPhase: this.breathPhase,
        driftPhaseL: this.driftTime,
        driftPhaseR: this.driftTime + 0.5,
        stereoOffset: this.STEREO_OFFSET_SECONDS
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
   * Como estrellas que parpadean suavemente
   */
  private calculateSparkle(texture: string, clarity: number): number {
    // Solo sparkles para CLEAN con clarity muy alta
    if (texture !== 'clean' || clarity < this.SPARKLE_CLARITY_THRESHOLD) {
      return 0
    }
    
    // Sparkle basado en tiempo (determinista, no random)
    const sparklePhase = Math.sin(this.frameCount * 0.05) * 0.5 + 0.5
    const clarityBonus = (clarity - this.SPARKLE_CLARITY_THRESHOLD) * 5  // 0-0.4
    
    return sparklePhase * this.SPARKLE_INTENSITY * clarityBonus
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
        moverL: this.moverValL,
        moverR: this.moverValR
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
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════════

export const chillStereoPhysics = new ChillStereoPhysics()
