/**
 * 
 *                      FIXTURE PHYSICS DRIVER V16.2                             
 *                   "Abstract Motion → Physical DMX"                            
 * 
 *   Traduce coordenadas abstractas (-1 a +1) a valores DMX físicos (0-255)     
 *   considerando: orientación, inversiones, límites mecánicos, inercia         
 * 
 * 
 * Migrado desde: demo/fixture-physics-driver.js
 * 
 * Features:
 * - Installation Presets: ceiling, floor, truss_front, truss_back
 * - Physics Easing: Curva S con aceleración/deceleración
 * - safeDistance Fix V16.1: Protección contra singularidad
 * - Anti-Stuck Mechanism: Detecta fixtures pegados en límites
 * - NaN Guard: Nunca enviar basura al motor
 * - Anti-Jitter Filter: Evita micro-correcciones que calientan servos
 * - 🔧 WAVE 338: Vibe-aware physics (dynamic physics config per vibe)
 */

import { getMovementPhysics, type MovementPhysics } from './VibeMovementPresets'

// ============================================================================
// TYPES
// ============================================================================

export interface Position2D {
  pan: number
  tilt: number
}

export interface AbstractPosition {
  fixtureId: string
  x: number  // -1 a +1
  y: number  // -1 a +1
  intensity?: number
}

export interface DMXPosition {
  fixtureId: string
  panDMX: number    // 0-255
  tiltDMX: number   // 0-255
  panFine: number   // 0-255 (16-bit)
  tiltFine: number  // 0-255 (16-bit)
  _target?: Position2D
  _safe?: Position2D
  _current?: Position2D
}

export interface InstallationPreset {
  description: string
  defaultHome: Position2D
  invert: { pan: boolean; tilt: boolean }
  limits: { tiltMin: number; tiltMax: number }
  tiltOffset: number
}

// ═══════════════════════════════════════════════════════════════════════════
// 🏗️ WAVE 1105.2: PHYSICS PROFILE - Hardware capabilities from Fixture Forge
// 
// Cada fixture puede tener su propio perfil de física basado en las
// capacidades reales del hardware. Un mover chino de $50 tiene motores
// más lentos que un Clay Paky de $5000.
// 
// Estos valores vienen del JSON del fixture (Fixture Forge) y representan
// los LÍMITES FÍSICOS REALES del hardware.
// ═══════════════════════════════════════════════════════════════════════════
export interface PhysicsProfile {
  /** Motor type for logging/debugging */
  motorType?: 'stepper' | 'servo' | 'belt' | 'unknown'
  /** Maximum acceleration the hardware can handle (DMX units/s²) */
  maxAcceleration?: number
  /** Maximum velocity the hardware can achieve (DMX units/s) */
  maxVelocity?: number
  /** Pan speed multiplier (0-1, where 1 = fast motor) */
  panSpeedFactor?: number
  /** Tilt speed multiplier (0-1, where 1 = fast motor) */
  tiltSpeedFactor?: number
  /** Quality tier for auto-tuning (budget/mid/pro) */
  qualityTier?: 'budget' | 'mid' | 'pro'
}

export interface FixtureConfig {
  installationType: string
  home: Position2D
  range: { pan: number; tilt: number }
  invert: { pan: boolean; tilt: boolean }
  limits: { tiltMin: number; tiltMax: number }
  maxSpeed: { pan: number; tilt: number }
  mirror: boolean
  tiltOffset?: number
  /** 🏗️ WAVE 1105.2: Hardware physics profile from Fixture Forge JSON */
  physicsProfile?: PhysicsProfile
}

export interface PhysicsConfig {
  maxAcceleration: number
  maxVelocity: number
  friction: number
  arrivalThreshold: number
  minTransitionTime: number
}

// ============================================================================
// FIXTURE PHYSICS DRIVER V16.2
// ============================================================================

export class FixturePhysicsDriver {
  private configs: Map<string, FixtureConfig> = new Map()
  private currentPositions: Map<string, Position2D> = new Map()
  private velocities: Map<string, Position2D> = new Map()
  private lastUpdate: number = Date.now()
  
  // 🔧 WAVE 338: Current vibe for physics adaptation
  private currentVibeId: string = 'idle'

  // Presets de instalación
  private readonly INSTALLATION_PRESETS: Record<string, InstallationPreset> = {
    //  CEILING: Fixtures colgados del techo mirando hacia abajo
    ceiling: {
      description: 'Colgado del techo, mirando hacia abajo',
      defaultHome: { pan: 127, tilt: 40 },
      invert: { pan: false, tilt: true },
      limits: { tiltMin: 20, tiltMax: 200 },
      tiltOffset: -90,
    },

    //  FLOOR: Fixtures en el suelo mirando hacia arriba
    floor: {
      description: 'En el suelo, mirando hacia arriba',
      defaultHome: { pan: 127, tilt: 127 },
      invert: { pan: false, tilt: false },
      limits: { tiltMin: 0, tiltMax: 255 },
      tiltOffset: 0,
    },

    //  TRUSS_FRONT: En truss frontal (escenario típico)
    truss_front: {
      description: 'En truss frontal, iluminando hacia el público',
      defaultHome: { pan: 127, tilt: 100 },
      invert: { pan: false, tilt: false },
      limits: { tiltMin: 30, tiltMax: 220 },
      tiltOffset: -45,
    },

    //  TRUSS_BACK: En truss trasero (contraluz)
    truss_back: {
      description: 'En truss trasero, contraluz',
      defaultHome: { pan: 127, tilt: 60 },
      invert: { pan: true, tilt: false },
      limits: { tiltMin: 20, tiltMax: 180 },
      tiltOffset: -45,
    },
  }

  // Configuración de física (inercia) - Actualizada por vibe
  private physicsConfig: PhysicsConfig = {
    maxAcceleration: 800,
    maxVelocity: 400,
    friction: 0.15,
    arrivalThreshold: 1.0,
    minTransitionTime: 50,
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🔒 WAVE 343: SAFETY CAP - PROTECCIÓN ABSOLUTA DE HARDWARE
  // 
  // Este es el LÍMITE MÁXIMO FÍSICO que NUNCA se puede exceder.
  // Los movers chinos baratos no soportan aceleraciones extremas.
  // Sin importar lo que diga VibeMovementPresets, este cap protege el hardware.
  // 
  // 2500 = límite conservador para movers de $50-200
  // Si tienes movers de $1000+, puedes subirlo a 4000
  // ═══════════════════════════════════════════════════════════════════════
  private readonly SAFETY_CAP = {
    maxAcceleration: 2500,  // DMX units/s² - NUNCA exceder
    maxVelocity: 800,       // DMX units/s - NUNCA exceder
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 🛡️ WAVE 1101: PAN SAFETY MARGIN - EL AIRBAG HORIZONTAL
  // 
  // Margen de seguridad para PAN. El motor NUNCA llegará a 0 ni a 255.
  // Esto evita golpes mecánicos contra los topes físicos del mover.
  // 
  // 5 DMX units ≈ 2% del rango → suficiente para frenar antes del tope
  // ═══════════════════════════════════════════════════════════════════════
  private readonly PAN_SAFETY_MARGIN = 5

  // ═══════════════════════════════════════════════════════════════════════
  // 🔧 WAVE 338: VIBE-AWARE PHYSICS
  // ═══════════════════════════════════════════════════════════════════════

  /** Actualizar física según el vibe activo */
  setVibe(vibeId: string): this {
    if (this.currentVibeId === vibeId) return this
    
    this.currentVibeId = vibeId
    const vibePhysics: MovementPhysics = getMovementPhysics(vibeId)
    
    // 🔒 WAVE 343: Aplicar SAFETY CAP a la configuración del vibe
    // El vibe puede pedir lo que quiera, pero el hardware tiene límites
    this.physicsConfig.maxAcceleration = Math.min(
      vibePhysics.maxAcceleration,
      this.SAFETY_CAP.maxAcceleration
    )
    this.physicsConfig.maxVelocity = Math.min(
      vibePhysics.maxVelocity,
      this.SAFETY_CAP.maxVelocity
    )
    this.physicsConfig.friction = vibePhysics.friction
    this.physicsConfig.arrivalThreshold = vibePhysics.arrivalThreshold
    
    console.log(`[PhysicsDriver] 🎛️ WAVE 343: Vibe "${vibeId}" - Acc:${this.physicsConfig.maxAcceleration} (cap:${this.SAFETY_CAP.maxAcceleration}) Vel:${this.physicsConfig.maxVelocity} Fric:${vibePhysics.friction}`)
    
    return this
  }

  /** Obtener vibe actual */
  getCurrentVibe(): string {
    return this.currentVibeId
  }

  // 
  //  REGISTRO DE FIXTURES
  // 

  /** Registra un fixture con configuración personalizada */
  registerFixture(fixtureId: string, config: Partial<FixtureConfig> = {}): this {
    const defaultConfig: FixtureConfig = {
      installationType: 'ceiling',
      home: { pan: 127, tilt: 40 },
      range: { pan: 540, tilt: 270 },
      invert: { pan: false, tilt: true },
      limits: { tiltMin: 20, tiltMax: 200 },
      maxSpeed: { pan: 300, tilt: 200 },
      mirror: false,
    }

    const preset = this.INSTALLATION_PRESETS[config.installationType || 'ceiling']

    const finalConfig: FixtureConfig = {
      ...defaultConfig,
      ...preset,
      ...config,
      home: { ...defaultConfig.home, ...preset?.defaultHome, ...config.home },
      invert: { ...defaultConfig.invert, ...preset?.invert, ...config.invert },
      limits: { ...defaultConfig.limits, ...preset?.limits, ...config.limits },
      // 🏗️ WAVE 1105.2: Preserve physicsProfile if provided
      physicsProfile: config.physicsProfile,
    }

    this.configs.set(fixtureId, finalConfig)
    this.currentPositions.set(fixtureId, { pan: finalConfig.home.pan, tilt: finalConfig.home.tilt })
    this.velocities.set(fixtureId, { pan: 0, tilt: 0 })

    // 🏗️ WAVE 1105.2: Log physics profile if present
    if (finalConfig.physicsProfile) {
      const pp = finalConfig.physicsProfile
      console.log(`[PhysicsDriver] 🏗️ Fixture "${fixtureId}" has PhysicsProfile: ` +
        `${pp.motorType ?? 'unknown'} motor | ` +
        `maxAcc:${pp.maxAcceleration ?? 'default'} | ` +
        `maxVel:${pp.maxVelocity ?? 'default'} | ` +
        `tier:${pp.qualityTier ?? 'unknown'}`)
    } else {
      console.log(`[PhysicsDriver] Fixture "${fixtureId}" registrado:`, finalConfig.installationType)
    }

    return this
  }

  /** Aplica un preset de instalación a un fixture */
  applyPreset(fixtureId: string, presetName: string): this {
    const preset = this.INSTALLATION_PRESETS[presetName]
    if (!preset) {
      console.warn(`[PhysicsDriver] Preset "${presetName}" no encontrado`)
      return this
    }

    const config = this.configs.get(fixtureId)
    if (!config) {
      console.warn(`[PhysicsDriver] Fixture "${fixtureId}" no registrado`)
      return this
    }

    config.installationType = presetName
    config.home = { ...config.home, ...preset.defaultHome }
    config.invert = { ...config.invert, ...preset.invert }
    config.limits = { ...config.limits, ...preset.limits }

    console.log(`[PhysicsDriver] Preset "${presetName}" aplicado a "${fixtureId}"`)

    return this
  }

  // 
  //  TRADUCCIÓN ABSTRACTO  FÍSICO
  // 
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🔧 WAVE 340.6: MÉTODO DIRECTO DMX
  // Para cuando el caller YA tiene valores DMX (como HAL con TitanEngine)
  // Evita la doble conversión abstract→DMX→abstract→DMX
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Interpola hacia una posición DMX objetivo (sin conversión de coordenadas) */
  translateDMX(fixtureId: string, targetPanDMX: number, targetTiltDMX: number, deltaTime = 16): DMXPosition {
    const config = this.configs.get(fixtureId)
    if (!config) {
      console.warn(`[PhysicsDriver] Fixture "${fixtureId}" no configurado`)
      return { fixtureId, panDMX: 127, tiltDMX: 127, panFine: 0, tiltFine: 0 }
    }
    
    // Aplicar límites de seguridad directamente
    const safePan = Math.max(0, Math.min(255, targetPanDMX))
    const safeTilt = Math.max(config.limits.tiltMin, Math.min(config.limits.tiltMax, targetTiltDMX))
    
    const targetDMX: Position2D = { pan: safePan, tilt: safeTilt }
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🔧 WAVE 2040.2: PHANTOM MODE PROTECTION - THE MATH EXPLOSION FIX
    // 🚫 WAVE 2040.2b: ANTI-FREEZE TELEPORT MODE
    // 
    // Cuando Chronos está reproduciendo, el deltaTime puede ser errático:
    // - Pausado: deltaTime = 0 o Infinity
    // - Saltos pequeños: deltaTime 50-200ms (lag/pausa)
    // - Saltos grandes: deltaTime > 200ms (usuario saltó timeline de 0s → 2:00)
    // 
    // ESTRATEGIA TRIPLE:
    // 1. deltaTime < 50ms → Live Mode (single pass physics)
    // 2. 50ms < deltaTime < 200ms → Iterative Chunking (divide en 16ms)
    // 3. deltaTime > 200ms → TELEPORT MODE (skip physics, jump instantly)
    // 
    // ⚠️ CRÍTICO: Si deltaTime = 120,000ms (2 min), dividir en 7,500 chunks
    //    congelaría la UI de React. TELEPORT evita el bucle infinito.
    // ═══════════════════════════════════════════════════════════════════════
    let smoothedDMX: Position2D = targetDMX  // Inicializado con target safe
    
    if (deltaTime > 200) {
      // ═══════════════════════════════════════════════════════════════════
      // 🚫 TELEPORT MODE: Timeline jump detected (e.g., 0s → 2:00)
      // Skip physics entirely, jump to target position instantly
      // Force velocity to 0 to avoid math explosions
      // ═══════════════════════════════════════════════════════════════════
      smoothedDMX = targetDMX
      this.currentPositions.set(fixtureId, targetDMX)
      this.velocities.set(fixtureId, { pan: 0, tilt: 0 })
      
      // Debug log (low frequency to avoid spam)
      if (Math.random() < 0.05) {
        console.log(`[🚀 TELEPORT] ${fixtureId} | dt=${deltaTime.toFixed(0)}ms → instant jump (skip physics)`)
      }
    } else if (deltaTime > 50) {
      // ═══════════════════════════════════════════════════════════════════
      // 🎬 PHANTOM MODE: Iterative chunking for medium deltas (lag/pause)
      // Divide into 16ms chunks to keep velocity calculation stable
      // ═══════════════════════════════════════════════════════════════════
      const CHUNK_SIZE = 16  // ms per iteration
      const iterations = Math.ceil(deltaTime / CHUNK_SIZE)
      const actualChunk = deltaTime / iterations
      
      // Iterate physics in small steps
      let currentTarget = targetDMX
      for (let i = 0; i < iterations; i++) {
        smoothedDMX = this.applyPhysicsEasing(fixtureId, currentTarget, actualChunk)
        currentTarget = smoothedDMX
      }
      
      // Debug log (low frequency)
      if (Math.random() < 0.016) {
        console.log(`[🎬 PHANTOM] ${fixtureId} | dt=${deltaTime.toFixed(0)}ms → ${iterations} chunks`)
      }
    } else {
      // ═══════════════════════════════════════════════════════════════════
      // ✅ LIVE MODE: Normal deltaTime (< 50ms) - single pass physics
      // ═══════════════════════════════════════════════════════════════════
      smoothedDMX = this.applyPhysicsEasing(fixtureId, targetDMX, deltaTime)
    }
    
    // NaN guard
    const finalPan = Number.isFinite(smoothedDMX.pan) ? smoothedDMX.pan : config.home.pan
    const finalTilt = Number.isFinite(smoothedDMX.tilt) ? smoothedDMX.tilt : config.home.tilt
    
    if (!Number.isFinite(smoothedDMX.pan) || !Number.isFinite(smoothedDMX.tilt)) {
      console.error(`[PhysicsDriver] ⚠️ NaN/Infinity en "${fixtureId}"! Usando home position`)
    }
    
    // Redondear a valores DMX válidos
    const panDMX = Math.round(Math.max(0, Math.min(255, finalPan)))
    const tiltDMX = Math.round(Math.max(0, Math.min(255, finalTilt)))
    
    // Calcular valores Fine (16-bit)
    const panFine = Math.round((finalPan - panDMX) * 255)
    const tiltFine = Math.round((finalTilt - tiltDMX) * 255)
    
    return {
      fixtureId,
      panDMX,
      tiltDMX,
      panFine: Math.max(0, Math.min(255, panFine)),
      tiltFine: Math.max(0, Math.min(255, tiltFine)),
    }
  }

  /** Traduce posición abstracta a DMX físico */
  translate(abstractPos: AbstractPosition, deltaTime = 16): DMXPosition {
    const { fixtureId, x, y } = abstractPos

    const config = this.configs.get(fixtureId)
    if (!config) {
      console.warn(`[PhysicsDriver] Fixture "${fixtureId}" no configurado`)
      return { fixtureId, panDMX: 127, tiltDMX: 127, panFine: 0, tiltFine: 0 }
    }

    // 1. Convertir coordenadas abstractas (-1 a +1) a DMX objetivo
    const targetDMX = this.abstractToTargetDMX(x, y, config)

    // 2. Aplicar límites de seguridad (Safety Box)
    const safeDMX = this.applySafetyLimits(targetDMX, config)

    // 3. Aplicar física de inercia (Physics Easing - Curva S)
    const smoothedDMX = this.applyPhysicsEasing(fixtureId, safeDMX, deltaTime)

    // 
    //  NaN GUARD V16.1: SEGURO DE VIDA PARA HARDWARE
    // 
    const safePan = Number.isFinite(smoothedDMX.pan) ? smoothedDMX.pan : config.home.pan
    const safeTilt = Number.isFinite(smoothedDMX.tilt) ? smoothedDMX.tilt : config.home.tilt

    if (!Number.isFinite(smoothedDMX.pan) || !Number.isFinite(smoothedDMX.tilt)) {
      console.error(`[PhysicsDriver]  NaN/Infinity en "${fixtureId}"! Usando home position`)
    }

    // 4. Redondear a valores DMX válidos
    const panDMX = Math.round(Math.max(0, Math.min(255, safePan)))
    const tiltDMX = Math.round(Math.max(0, Math.min(255, safeTilt)))

    // 5. Calcular valores Fine (16-bit)
    const panFine = Math.round((safePan - panDMX) * 255)
    const tiltFine = Math.round((safeTilt - tiltDMX) * 255)

    return {
      fixtureId,
      panDMX,
      tiltDMX,
      panFine: Math.max(0, Math.min(255, panFine)),
      tiltFine: Math.max(0, Math.min(255, tiltFine)),
      _target: targetDMX,
      _safe: safeDMX,
      _current: this.currentPositions.get(fixtureId),
    }
  }

  /** Convierte coordenadas abstractas a DMX objetivo */
  private abstractToTargetDMX(x: number, y: number, config: FixtureConfig): Position2D {
    const { home, range, invert, mirror } = config

    const effectiveX = mirror ? -x : x

    let panOffset = effectiveX * (range.pan / 2) * (255 / 540)
    if (invert.pan) panOffset = -panOffset

    let tiltOffset = -y * (range.tilt / 2) * (255 / 270)
    if (invert.tilt) tiltOffset = -tiltOffset

    return {
      pan: home.pan + panOffset,
      tilt: home.tilt + tiltOffset,
    }
  }

  /** Aplica límites de seguridad (Safety Box) */
  private applySafetyLimits(targetDMX: Position2D, config: FixtureConfig): Position2D {
    const { limits } = config

    // 🛡️ WAVE 1101: PAN con AIRBAG - nunca toca los topes físicos
    return {
      pan: Math.max(this.PAN_SAFETY_MARGIN, Math.min(255 - this.PAN_SAFETY_MARGIN, targetDMX.pan)),
      tilt: Math.max(limits.tiltMin, Math.min(limits.tiltMax, targetDMX.tilt)),
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 🏗️ WAVE 1105.2: THE BOTTLENECK - Effective Physics Limits Calculator
  // 
  // Jerarquía de seguridad (de más restrictivo a menos):
  // 
  //   1. SAFETY_CAP (hardcoded) → Límite absoluto del sistema
  //   2. Vibe Request (physicsConfig) → Lo que pide el género musical
  //   3. Fixture Hardware Limit (physicsProfile) → Lo que aguanta el motor
  // 
  // La fórmula es: EffectiveLimit = Math.min(SafetyCap, VibeRequest, HardwareLimit)
  // 
  // Si el fixture no tiene physicsProfile, usa los defaults globales.
  // El hardware SIEMPRE manda - un mover lento seguirá siendo lento aunque
  // Techno pida velocidad Warp.
  // ═══════════════════════════════════════════════════════════════════════════
  private getEffectivePhysicsLimits(config: FixtureConfig): {
    maxAcceleration: number
    maxVelocity: number
    speedFactorPan: number
    speedFactorTilt: number
  } {
    const profile = config.physicsProfile
    
    // Nivel 1: SAFETY_CAP (siempre presente)
    let effectiveMaxAccel = this.SAFETY_CAP.maxAcceleration
    let effectiveMaxVel = this.SAFETY_CAP.maxVelocity
    
    // Nivel 2: Vibe Request (lo que pide el género)
    effectiveMaxAccel = Math.min(effectiveMaxAccel, this.physicsConfig.maxAcceleration)
    effectiveMaxVel = Math.min(effectiveMaxVel, this.physicsConfig.maxVelocity)
    
    // Nivel 3: Hardware Limit (lo que aguanta el fixture)
    // Solo aplica si el fixture tiene physicsProfile definido
    if (profile) {
      if (profile.maxAcceleration !== undefined) {
        effectiveMaxAccel = Math.min(effectiveMaxAccel, profile.maxAcceleration)
      }
      if (profile.maxVelocity !== undefined) {
        effectiveMaxVel = Math.min(effectiveMaxVel, profile.maxVelocity)
      }
      
      // 🏗️ Auto-tune basado en qualityTier si no hay valores explícitos
      if (profile.qualityTier && !profile.maxAcceleration && !profile.maxVelocity) {
        switch (profile.qualityTier) {
          case 'budget':
            // Movers chinos de $50-150 - motores lentos
            effectiveMaxAccel = Math.min(effectiveMaxAccel, 1200)
            effectiveMaxVel = Math.min(effectiveMaxVel, 400)
            break
          case 'mid':
            // Movers de $200-500 - motores decentes
            effectiveMaxAccel = Math.min(effectiveMaxAccel, 1800)
            effectiveMaxVel = Math.min(effectiveMaxVel, 600)
            break
          case 'pro':
            // Movers de $1000+ - motores rápidos
            // No limitamos más allá del SAFETY_CAP
            break
        }
      }
    }
    
    // Speed factors (1.0 = motor rápido, 0.5 = motor lento)
    const speedFactorPan = profile?.panSpeedFactor ?? 1.0
    const speedFactorTilt = profile?.tiltSpeedFactor ?? 1.0
    
    return {
      maxAcceleration: effectiveMaxAccel,
      maxVelocity: effectiveMaxVel,
      speedFactorPan,
      speedFactorTilt,
    }
  }

  /**
   *  PHYSICS EASING: Curva S con aceleración/deceleración
   * V16.1: Fix safeDistance para protección contra singularidad
   */
  private applyPhysicsEasing(fixtureId: string, targetDMX: Position2D, deltaTime: number): Position2D {
    const current = this.currentPositions.get(fixtureId)
    const velocity = this.velocities.get(fixtureId)
    const config = this.configs.get(fixtureId)

    if (!current || !velocity || !config) return targetDMX

    const dt = deltaTime / 1000
    const newPos: Position2D = { pan: current.pan, tilt: current.tilt }
    const newVel: Position2D = { pan: velocity.pan, tilt: velocity.tilt }

    // ═══════════════════════════════════════════════════════════════════════
    // 🏎️ WAVE 341 + 342: REV LIMITER PER-VIBE (Seguro de Vida para Correas)
    // 
    // Límite FÍSICO de cuánto puede moverse un motor paso a paso por frame.
    // Cada vibe tiene su propio límite según sus necesidades de movimiento:
    // 
    // - TECHNO: Movimientos bruscos, saltos rápidos → Límite estricto
    // - LATINO: Trayectorias suaves (circle, figure8) → MUY ALTA libertad
    // - ROCK: Posiciones fijas, cambios dramáticos → Medio
    // - CHILL: Glacial, usa física clásica → Sin límite (demasiado lento)
    // 
    // 🔧 WAVE 342: LATINO necesita seguir figure8 sin lag
    // Figure8 @ 0.1Hz con amplitud 216° = pico de ~13.5°/frame @ 30fps
    // Necesitamos REV_LIMIT ≥ 20 para seguirlo sin lag
    // ═══════════════════════════════════════════════════════════════════════
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🔧 WAVE 1105.2: FÍSICA HÍBRIDA - EL HARDWARE MANDA
    // 
    // Jerarquía de 3 niveles (el más restrictivo gana):
    // 1. SAFETY_CAP (hardcoded) - Nunca se viola
    // 2. Vibe Request (physicsConfig) - Dinámico por género
    // 3. Fixture Hardware Limit (physicsProfile) - El fixture real
    // 
    // "Si tu motor es un burro, se mueve como burro aunque la Vibe pida F1"
    // ═══════════════════════════════════════════════════════════════════════
    const effectiveLimits = this.getEffectivePhysicsLimits(config)
    const maxAccel = effectiveLimits.maxAcceleration
    const speedFactorPan = effectiveLimits.speedFactorPan
    const speedFactorTilt = effectiveLimits.speedFactorTilt
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🏎️ WAVE 342.5: REV LIMITER PER-VIBE (Seguro de Vida para Correas)
    // 🔧 WAVE 1105.2: Ahora modulado por speedFactor del fixture
    // 
    // Ahora que TODOS los patrones usan frecuencias FIJAS (sin saltos por BPM),
    // podemos ser más generosos con los límites. Los patrones son SUAVES.
    // 
    // El REV LIMITER protege contra:
    // - Cambios bruscos de patrón (ej: cambio de vibe)
    // - Errores de código que generen saltos
    // - Valores extremos inesperados
    // - 🔧 NUEVO: Motores lentos del fixture individual
    // ═══════════════════════════════════════════════════════════════════════
    
    // Determinar límites según aceleración del vibe
    let REV_LIMIT_PAN: number
    let REV_LIMIT_TILT: number
    
    if (maxAccel > 1400) {
      // 🔧 WAVE 347.5: TECHNO - VELOCITY LIBERATION
      // Los patterns como SWEEP se mueven CONTINUAMENTE, el target cambia cada frame.
      // Con REV_LIMIT bajo, el mover persigue un blanco que se mueve más rápido.
      // 
      // SOLUCIÓN: REV_LIMIT MUY ALTO + snapFactor alto = sigue el target sin lag
      // Riesgo: Motores baratos pueden sufrir, pero es la única forma de ver el rango completo
      // 
      // Si tus movers son de $50-200 y se rompen, baja esto a 60
      // Si tus movers son de $500+, puedes subir a 150
      REV_LIMIT_PAN = 120  // ~5040°/s - BRUTAL pero necesario para sweeps continuos
      REV_LIMIT_TILT = 60  // ~2520°/s - Suficiente para movimientos verticales
    } else if (maxAccel > 1100) {
      // LATINO - Alta libertad para seguir trayectorias curvas
      REV_LIMIT_PAN = 25   // ~1050°/s - Sigue figure8 sin lag
      REV_LIMIT_TILT = 18  // ~750°/s
    } else if (maxAccel > 1000) {
      // ROCK: Medio (dramático pero controlado)
      REV_LIMIT_PAN = 15   // ~630°/s
      REV_LIMIT_TILT = 10  // ~420°/s
    } else {
      // CHILL: Sin límite (usa física clásica, muy lento)
      REV_LIMIT_PAN = 255  // Sin límite práctico
      REV_LIMIT_TILT = 255
    }
    
    // 🔧 WAVE 1105.2: APLICAR SPEED FACTOR DEL FIXTURE
    // Un fixture con panSpeedFactor = 0.5 reduce su REV_LIMIT a la mitad
    // Esto hace que el hardware lento NO intente seguir el ritmo de Techno
    REV_LIMIT_PAN = Math.round(REV_LIMIT_PAN * speedFactorPan)
    REV_LIMIT_TILT = Math.round(REV_LIMIT_TILT * speedFactorTilt)

    // ═══════════════════════════════════════════════════════════════════════
    // 🔧 WAVE 342.5: UNIFIED SNAP MODE
    // Todos los vibes usan SNAP MODE ahora (excepto CHILL que usa física clásica)
    // INSTANT MODE ya no existe - era problemático con patrones BPM-dependientes
    // ═══════════════════════════════════════════════════════════════════════
    
    if (maxAccel > 1000) {
      // 🔥 SNAP MODE con REV LIMITER para todos los vibes rápidos
      // 
      // WAVE 347.7: TECHNO NEEDS INSTANT RESPONSE
      // Con patterns que se mueven continuamente (sweep), el snapFactor < 1.0
      // causa que el mover siempre quede atrás persiguiendo el target.
      // 
      // snapFactor = 1.0 significa respuesta instantánea (sin damping)
      // snapFactor < 1.0 significa "smooth" pero con lag
      // 
      // Para Techno: Necesitamos snapFactor = 1.0 (instant)
      // Para Latino/Rock: Podemos usar < 1.0 para suavidad
      const snapFactor = maxAccel > 1400 
        ? 1.0  // TECHNO: Respuesta instantánea, sin lag
        : Math.min(0.85, 0.4 + (maxAccel - 1000) / 800)  // OTROS: Suavizado
      
      let deltaPan = (targetDMX.pan - current.pan) * snapFactor
      let deltaTilt = (targetDMX.tilt - current.tilt) * snapFactor
      
      // Aplicar REV LIMITER (seguridad para motores)
      deltaPan = Math.max(-REV_LIMIT_PAN, Math.min(REV_LIMIT_PAN, deltaPan))
      deltaTilt = Math.max(-REV_LIMIT_TILT, Math.min(REV_LIMIT_TILT, deltaTilt))
      
      newPos.pan = current.pan + deltaPan
      newPos.tilt = current.tilt + deltaTilt
      
      // ═══════════════════════════════════════════════════════════════════════
      // 🔧 WAVE 2040.2: REINFORCED NaN GUARD - Velocity Explosion Protection
      // 
      // Si dt es muy pequeño (< 1ms) o deltaPan/deltaTilt son enormes (saltos square),
      // la división puede resultar en Infinity → NaN Guard debe resetear velocidad.
      // ═══════════════════════════════════════════════════════════════════════
      const safeVelPan = dt > 0.1 ? deltaPan / dt : 0
      const safeVelTilt = dt > 0.1 ? deltaTilt / dt : 0
      
      newVel.pan = Number.isFinite(safeVelPan) ? safeVelPan : 0
      newVel.tilt = Number.isFinite(safeVelTilt) ? safeVelTilt : 0
      
      // Debugging: alertar si se detectó explosión
      if (!Number.isFinite(safeVelPan) || !Number.isFinite(safeVelTilt)) {
        console.warn(`[PhysicsDriver] 🔧 WAVE 2040.2: Velocity explosion detected! dt=${dt.toFixed(2)}ms, deltaPan=${deltaPan.toFixed(1)}, deltaTilt=${deltaTilt.toFixed(1)} → velocity reset to 0`)
      }
      
      this.currentPositions.set(fixtureId, newPos)
      this.velocities.set(fixtureId, newVel)
      
      return newPos
    }

    // ═══════════════════════════════════════════════════════════════════════
    // MODO CLÁSICO: Física con aceleración/frenado (para vibes lentos)
    // Solo CHILL usa esto (maxAccel < 1000)
    // 🔧 WAVE 1105.2: Usa límites efectivos del fixture
    // ═══════════════════════════════════════════════════════════════════════
    const axes: (keyof Position2D)[] = ['pan', 'tilt']
    const effectiveMaxVel = effectiveLimits.maxVelocity

    for (const axis of axes) {
      const target = targetDMX[axis]
      const pos = current[axis]
      const vel = velocity[axis]

      const distance = target - pos
      const absDistance = Math.abs(distance)

      // Si ya llegamos, quedarse quieto
      if (absDistance < this.physicsConfig.arrivalThreshold) {
        newPos[axis] = target
        newVel[axis] = 0
        continue
      }

      const direction = Math.sign(distance)
      // 🔧 WAVE 1105.2: maxSpeed usa límite efectivo del fixture
      const maxSpeed = Math.min(config.maxSpeed[axis] || effectiveMaxVel, effectiveMaxVel)
      const brakingDistance = (vel * vel) / (2 * maxAccel)

      let acceleration: number

      if (absDistance <= brakingDistance + 5) {
        //  FASE DE FRENADO: Deceleración suave
        //  FIX V16.1: PROTECCIÓN CONTRA SINGULARIDAD
        const safeDistance = Math.max(0.5, absDistance)
        acceleration = -(vel * vel) / (2 * safeDistance) * direction
        // 🛡️ WAVE 1101: PARANOIA CLAMP - Usa SAFETY_CAP absoluto, no config dinámica
        acceleration = Math.max(-this.SAFETY_CAP.maxAcceleration, 
                               Math.min(this.SAFETY_CAP.maxAcceleration, acceleration))
      } else {
        //  FASE DE ACELERACIÓN - usa maxAccel efectivo
        acceleration = maxAccel * direction
      }

      // Aplicar física
      newVel[axis] = vel + acceleration * dt
      newVel[axis] = Math.max(-maxSpeed, Math.min(maxSpeed, newVel[axis]))
      newPos[axis] = pos + newVel[axis] * dt
      newPos[axis] = Math.max(0, Math.min(255, newPos[axis]))

      // Anti-overshoot
      if ((distance > 0 && newPos[axis] > target) || 
          (distance < 0 && newPos[axis] < target)) {
        newPos[axis] = target
        newVel[axis] = 0
      }

      // 
      //  FIX V16.4: ANTI-STUCK EN LÍMITES
      // 
      if ((newPos[axis] >= 254 || newPos[axis] <= 1) && absDistance > 20) {
        newVel[axis] = -Math.sign(newPos[axis] - 127) * maxSpeed * 0.3
        console.warn(`[PhysicsDriver]  Unstuck ${axis}: pos=${newPos[axis].toFixed(0)}, target=${target.toFixed(0)}`)
      }
    }

    // 
    //  FILTRO ANTI-JITTER V16.1
    // 
    if (Math.abs(newVel.pan) < 5) newVel.pan = 0
    if (Math.abs(newVel.tilt) < 5) newVel.tilt = 0

    this.currentPositions.set(fixtureId, newPos)
    this.velocities.set(fixtureId, newVel)

    return newPos
  }

  // 
  //  CALIBRACIÓN
  // 

  /** Calibrar posición HOME de un fixture */
  calibrateHome(fixtureId: string, panDMX: number, tiltDMX: number): this {
    const config = this.configs.get(fixtureId)
    if (!config) return this

    config.home = { pan: panDMX, tilt: tiltDMX }
    console.log(`[PhysicsDriver] Home calibrado para "${fixtureId}":`, config.home)

    return this
  }

  /** Calibrar límites de seguridad */
  calibrateLimits(fixtureId: string, tiltMin: number, tiltMax: number): this {
    const config = this.configs.get(fixtureId)
    if (!config) return this

    config.limits = { tiltMin, tiltMax }
    console.log(`[PhysicsDriver] Safety Box calibrado para "${fixtureId}":`, config.limits)

    return this
  }

  /** Establecer si un fixture es espejo del otro */
  setMirror(fixtureId: string, isMirror: boolean): this {
    const config = this.configs.get(fixtureId)
    if (!config) return this

    config.mirror = isMirror

    return this
  }

  // 
  //  UTILIDADES
  // 

  /** Obtener posición actual de un fixture */
  getCurrentPosition(fixtureId: string): Position2D {
    return this.currentPositions.get(fixtureId) || { pan: 127, tilt: 127 }
  }

  /** Forzar posición inmediata (sin suavizado) */
  forcePosition(fixtureId: string, panDMX: number, tiltDMX: number): DMXPosition {
    this.currentPositions.set(fixtureId, { pan: panDMX, tilt: tiltDMX })
    this.velocities.set(fixtureId, { pan: 0, tilt: 0 })

    return { fixtureId, panDMX, tiltDMX, panFine: 0, tiltFine: 0 }
  }

  /** Enviar fixture(s) a home */
  goHome(fixtureId: string | null = null): DMXPosition | DMXPosition[] {
    if (fixtureId) {
      const config = this.configs.get(fixtureId)
      if (config) {
        return this.translate({ fixtureId, x: 0, y: 0, intensity: 1 }, 16)
      }
      return { fixtureId, panDMX: 127, tiltDMX: 127, panFine: 0, tiltFine: 0 }
    } else {
      const results: DMXPosition[] = []
      this.configs.forEach((_config, id) => {
        results.push(this.translate({ fixtureId: id, x: 0, y: 0, intensity: 1 }, 16))
      })
      return results
    }
  }

  /** Obtener info de debug */
  getDebugInfo(): Record<string, { config: FixtureConfig; current: Position2D | undefined; velocity: Position2D | undefined }> {
    const info: Record<string, { config: FixtureConfig; current: Position2D | undefined; velocity: Position2D | undefined }> = {}
    this.configs.forEach((config, id) => {
      info[id] = {
        config,
        current: this.currentPositions.get(id),
        velocity: this.velocities.get(id),
      }
    })
    return info
  }

  /** Obtener lista de fixtures registrados */
  getRegisteredFixtures(): string[] {
    return Array.from(this.configs.keys())
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🎬 WAVE 339: PHYSICS STATE EXPORT
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * Get physical state for a fixture (interpolated position + velocity)
   * Used for broadcasting to frontend simulator
   * 
   * @param fixtureId - Fixture identifier
   * @returns Physics state or defaults if not found
   */
  getPhysicsState(fixtureId: string): {
    physicalPan: number     // 0-255 DMX (current interpolated position)
    physicalTilt: number    // 0-255 DMX (current interpolated position)
    panVelocity: number     // DMX/s (current velocity)
    tiltVelocity: number    // DMX/s (current velocity)
  } {
    const current = this.currentPositions.get(fixtureId)
    const velocity = this.velocities.get(fixtureId)
    
    return {
      physicalPan: current?.pan ?? 127,
      physicalTilt: current?.tilt ?? 127,
      panVelocity: velocity?.pan ?? 0,
      tiltVelocity: velocity?.tilt ?? 0,
    }
  }
  
  /**
   * Get physics states for all registered fixtures
   * @returns Map of fixtureId → physics state
   */
  getAllPhysicsStates(): Map<string, {
    physicalPan: number
    physicalTilt: number
    panVelocity: number
    tiltVelocity: number
  }> {
    const states = new Map<string, {
      physicalPan: number
      physicalTilt: number
      panVelocity: number
      tiltVelocity: number
    }>()
    
    this.configs.forEach((_, id) => {
      states.set(id, this.getPhysicsState(id))
    })
    
    return states
  }
}
