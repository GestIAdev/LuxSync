/**
 * 
 *                      FIXTURE PHYSICS DRIVER V16.1                             
 *                   "Abstract Motion  Physical DMX"                            
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
 */

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

export interface FixtureConfig {
  installationType: string
  home: Position2D
  range: { pan: number; tilt: number }
  invert: { pan: boolean; tilt: boolean }
  limits: { tiltMin: number; tiltMax: number }
  maxSpeed: { pan: number; tilt: number }
  mirror: boolean
  tiltOffset?: number
}

export interface PhysicsConfig {
  maxAcceleration: number
  maxVelocity: number
  friction: number
  arrivalThreshold: number
  minTransitionTime: number
}

// ============================================================================
// FIXTURE PHYSICS DRIVER V16.1
// ============================================================================

export class FixturePhysicsDriver {
  private configs: Map<string, FixtureConfig> = new Map()
  private currentPositions: Map<string, Position2D> = new Map()
  private velocities: Map<string, Position2D> = new Map()
  private lastUpdate: number = Date.now()

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

  // Configuración de física (inercia)
  private physicsConfig: PhysicsConfig = {
    maxAcceleration: 800,
    maxVelocity: 400,
    friction: 0.15,
    arrivalThreshold: 1.0,
    minTransitionTime: 50,
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
    }

    this.configs.set(fixtureId, finalConfig)
    this.currentPositions.set(fixtureId, { pan: finalConfig.home.pan, tilt: finalConfig.home.tilt })
    this.velocities.set(fixtureId, { pan: 0, tilt: 0 })

    console.log(`[PhysicsDriver] Fixture "${fixtureId}" registrado:`, finalConfig.installationType)

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

    return {
      pan: Math.max(0, Math.min(255, targetDMX.pan)),
      tilt: Math.max(limits.tiltMin, Math.min(limits.tiltMax, targetDMX.tilt)),
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

    const axes: (keyof Position2D)[] = ['pan', 'tilt']

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
      const maxSpeed = config.maxSpeed[axis] || this.physicsConfig.maxVelocity
      const brakingDistance = (vel * vel) / (2 * this.physicsConfig.maxAcceleration)

      let acceleration: number

      if (absDistance <= brakingDistance + 5) {
        //  FASE DE FRENADO: Deceleración suave
        //  FIX V16.1: PROTECCIÓN CONTRA SINGULARIDAD
        const safeDistance = Math.max(0.5, absDistance)
        acceleration = -(vel * vel) / (2 * safeDistance) * direction
        acceleration = Math.max(-this.physicsConfig.maxAcceleration, 
                               Math.min(this.physicsConfig.maxAcceleration, acceleration))
      } else {
        //  FASE DE ACELERACIÓN
        acceleration = this.physicsConfig.maxAcceleration * direction
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
}
