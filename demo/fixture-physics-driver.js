/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                     FIXTURE PHYSICS DRIVER V16.0                             ║
 * ║                  "Abstract Motion → Physical DMX"                            ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  Traduce coordenadas abstractas (-1 a +1) a valores DMX físicos (0-255)     ║
 * ║  considerando: orientación, inversiones, límites mecánicos, inercia         ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

class FixturePhysicsDriver {
  constructor() {
    // Configuraciones por fixture
    this.configs = new Map();
    
    // Estado actual (para suavizado/inercia)
    this.currentPositions = new Map();
    
    // Velocidades actuales (para physics easing)
    this.velocities = new Map();
    
    // Timestamps para deltaTime
    this.lastUpdate = Date.now();
    
    // Presets de instalación
    this.INSTALLATION_PRESETS = {
      // ═══════════════════════════════════════════════════════════════════════
      // 🔽 CEILING: Fixtures colgados del techo mirando hacia abajo
      // ═══════════════════════════════════════════════════════════════════════
      ceiling: {
        description: 'Colgado del techo, mirando hacia abajo',
        defaultHome: { pan: 127, tilt: 40 },  // Levantado para mirar a pista
        invert: { pan: false, tilt: true },   // Tilt invertido (boca abajo)
        limits: { 
          tiltMin: 20,   // 🚧 Safety Box: No mirar al techo/cables
          tiltMax: 200   // No bajar demasiado
        },
        tiltOffset: -90,  // Rotación del sistema de referencia
      },
      
      // ═══════════════════════════════════════════════════════════════════════
      // 🔼 FLOOR: Fixtures en el suelo mirando hacia arriba
      // ═══════════════════════════════════════════════════════════════════════
      floor: {
        description: 'En el suelo, mirando hacia arriba',
        defaultHome: { pan: 127, tilt: 127 },
        invert: { pan: false, tilt: false },
        limits: { tiltMin: 0, tiltMax: 255 },
        tiltOffset: 0,
      },
      
      // ═══════════════════════════════════════════════════════════════════════
      // 🎭 TRUSS_FRONT: En truss frontal (escenario típico)
      // ═══════════════════════════════════════════════════════════════════════
      truss_front: {
        description: 'En truss frontal, iluminando hacia el público',
        defaultHome: { pan: 127, tilt: 100 },
        invert: { pan: false, tilt: false },
        limits: { tiltMin: 30, tiltMax: 220 },
        tiltOffset: -45,
      },
      
      // ═══════════════════════════════════════════════════════════════════════
      // 🎭 TRUSS_BACK: En truss trasero (contraluz)
      // ═══════════════════════════════════════════════════════════════════════
      truss_back: {
        description: 'En truss trasero, contraluz',
        defaultHome: { pan: 127, tilt: 60 },
        invert: { pan: true, tilt: false },  // Pan espejado
        limits: { tiltMin: 20, tiltMax: 180 },
        tiltOffset: -45,
      },
    };
    
    // Configuración de física (inercia)
    this.physicsConfig = {
      // Aceleración máxima (grados DMX por segundo²)
      maxAcceleration: 800,
      // Velocidad máxima (grados DMX por segundo)
      maxVelocity: 400,
      // Factor de fricción (0-1, más alto = más suave)
      friction: 0.15,
      // Umbral de "llegada" (cuando consideramos que llegó)
      arrivalThreshold: 1.0,
      // Tiempo mínimo de transición (ms)
      minTransitionTime: 50,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 📝 REGISTRO DE FIXTURES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Registra un fixture con configuración personalizada
   * @param {string} fixtureId - ID único del fixture
   * @param {Object} config - Configuración física
   */
  registerFixture(fixtureId, config = {}) {
    const defaultConfig = {
      installationType: 'ceiling',
      home: { pan: 127, tilt: 40 },
      range: { pan: 540, tilt: 270 },  // Rangos típicos de moving head
      invert: { pan: false, tilt: true },
      limits: { tiltMin: 20, tiltMax: 200 },
      // Velocidad máxima del motor (DMX units por segundo)
      maxSpeed: { pan: 300, tilt: 200 },
      // ¿Es espejo del otro lado? (para lateralidad)
      mirror: false,
    };
    
    // Merge con preset si se especifica installationType
    const preset = this.INSTALLATION_PRESETS[config.installationType || 'ceiling'];
    
    const finalConfig = {
      ...defaultConfig,
      ...preset,
      ...config,
      home: { ...defaultConfig.home, ...preset?.defaultHome, ...config.home },
      invert: { ...defaultConfig.invert, ...preset?.invert, ...config.invert },
      limits: { ...defaultConfig.limits, ...preset?.limits, ...config.limits },
    };
    
    this.configs.set(fixtureId, finalConfig);
    
    // Inicializar posición actual en home
    this.currentPositions.set(fixtureId, {
      pan: finalConfig.home.pan,
      tilt: finalConfig.home.tilt,
    });
    
    // Inicializar velocidades en 0
    this.velocities.set(fixtureId, {
      pan: 0,
      tilt: 0,
    });
    
    console.log(`[PhysicsDriver] Fixture "${fixtureId}" registrado:`, finalConfig);
    
    return this;
  }

  /**
   * Aplica un preset de instalación a un fixture
   * @param {string} fixtureId 
   * @param {string} presetName - 'ceiling' | 'floor' | 'truss_front' | 'truss_back'
   */
  applyPreset(fixtureId, presetName) {
    const preset = this.INSTALLATION_PRESETS[presetName];
    if (!preset) {
      console.warn(`[PhysicsDriver] Preset "${presetName}" no encontrado`);
      return this;
    }
    
    const config = this.configs.get(fixtureId);
    if (!config) {
      console.warn(`[PhysicsDriver] Fixture "${fixtureId}" no registrado`);
      return this;
    }
    
    // Actualizar config con preset
    config.installationType = presetName;
    config.home = { ...config.home, ...preset.defaultHome };
    config.invert = { ...config.invert, ...preset.invert };
    config.limits = { ...config.limits, ...preset.limits };
    
    console.log(`[PhysicsDriver] Preset "${presetName}" aplicado a "${fixtureId}"`);
    
    return this;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 🎯 TRADUCCIÓN ABSTRACTO → FÍSICO
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Traduce posición abstracta a DMX físico
   * @param {Object} abstractPos - { fixtureId, x, y, intensity }
   * @param {number} deltaTime - Tiempo desde último frame (ms)
   * @returns {Object} - { fixtureId, panDMX, tiltDMX, panFine, tiltFine }
   */
  translate(abstractPos, deltaTime = 16) {
    const { fixtureId, x, y, intensity = 1.0 } = abstractPos;
    
    const config = this.configs.get(fixtureId);
    if (!config) {
      console.warn(`[PhysicsDriver] Fixture "${fixtureId}" no configurado`);
      return { fixtureId, panDMX: 127, tiltDMX: 127 };
    }
    
    // 1. Convertir coordenadas abstractas (-1 a +1) a DMX objetivo
    const targetDMX = this._abstractToTargetDMX(x, y, config);
    
    // 2. Aplicar límites de seguridad (Safety Box)
    const safeDMX = this._applySafetyLimits(targetDMX, config);
    
    // 3. Aplicar física de inercia (Physics Easing - Curva S)
    const smoothedDMX = this._applyPhysicsEasing(fixtureId, safeDMX, deltaTime);
    
    // ═══════════════════════════════════════════════════════════════════════════
    // 🛡️ NaN GUARD V16.1: SEGURO DE VIDA PARA HARDWARE
    // Si las matemáticas explotan, NUNCA enviar basura al motor
    // ═══════════════════════════════════════════════════════════════════════════
    const safePan = Number.isFinite(smoothedDMX.pan) ? smoothedDMX.pan : config.home.pan;
    const safeTilt = Number.isFinite(smoothedDMX.tilt) ? smoothedDMX.tilt : config.home.tilt;
    
    if (!Number.isFinite(smoothedDMX.pan) || !Number.isFinite(smoothedDMX.tilt)) {
      console.error(`[PhysicsDriver] ⚠️ NaN/Infinity detectado en "${fixtureId}"! Usando home position`);
    }
    
    // 4. Redondear a valores DMX válidos (CLAMP FINAL DE SEGURIDAD)
    const panDMX = Math.round(Math.max(0, Math.min(255, safePan)));
    const tiltDMX = Math.round(Math.max(0, Math.min(255, safeTilt)));
    
    // 5. Calcular valores Fine (16-bit) para suavidad extra
    const panFine = Math.round((safePan - panDMX) * 255);
    const tiltFine = Math.round((safeTilt - tiltDMX) * 255);
    
    return {
      fixtureId,
      panDMX,
      tiltDMX,
      panFine: Math.max(0, Math.min(255, panFine)),
      tiltFine: Math.max(0, Math.min(255, tiltFine)),
      // Debug info
      _target: targetDMX,
      _safe: safeDMX,
      _current: this.currentPositions.get(fixtureId),
    };
  }

  /**
   * Convierte coordenadas abstractas a DMX objetivo
   * @private
   */
  _abstractToTargetDMX(x, y, config) {
    const { home, range, invert, mirror } = config;
    
    // Si es espejo, invertir X
    const effectiveX = mirror ? -x : x;
    
    // Mapear X (-1 a +1) a Pan (home ± range/2)
    // X = -1 → home - range/2
    // X = 0  → home
    // X = +1 → home + range/2
    let panOffset = effectiveX * (range.pan / 2) * (255 / 540); // Normalizar a DMX
    if (invert.pan) panOffset = -panOffset;
    
    // Mapear Y (-1 a +1) a Tilt
    // Y = -1 (abajo) → tilt más alto (mirando abajo)
    // Y = 0  → home
    // Y = +1 (arriba) → tilt más bajo (mirando arriba)
    let tiltOffset = -y * (range.tilt / 2) * (255 / 270); // Normalizar a DMX
    if (invert.tilt) tiltOffset = -tiltOffset;
    
    return {
      pan: home.pan + panOffset,
      tilt: home.tilt + tiltOffset,
    };
  }

  /**
   * Aplica límites de seguridad (Safety Box)
   * @private
   */
  _applySafetyLimits(targetDMX, config) {
    const { limits } = config;
    
    return {
      pan: Math.max(0, Math.min(255, targetDMX.pan)),
      tilt: Math.max(limits.tiltMin, Math.min(limits.tiltMax, targetDMX.tilt)),
    };
  }

  /**
   * 🏎️ PHYSICS EASING: Curva S con aceleración/deceleración
   * Nota de Gemini: "Si el objetivo está lejos, usar curva S"
   * @private
   */
  _applyPhysicsEasing(fixtureId, targetDMX, deltaTime) {
    const current = this.currentPositions.get(fixtureId);
    const velocity = this.velocities.get(fixtureId);
    const config = this.configs.get(fixtureId);
    
    if (!current || !velocity) return targetDMX;
    
    // Convertir deltaTime a segundos
    const dt = deltaTime / 1000;
    
    // Calcular nueva posición para cada eje
    const newPos = { pan: current.pan, tilt: current.tilt };
    const newVel = { pan: velocity.pan, tilt: velocity.tilt };
    
    ['pan', 'tilt'].forEach(axis => {
      const target = targetDMX[axis];
      const pos = current[axis];
      const vel = velocity[axis];
      
      // Distancia al objetivo
      const distance = target - pos;
      const absDistance = Math.abs(distance);
      
      // Si ya llegamos, quedarse quieto
      if (absDistance < this.physicsConfig.arrivalThreshold) {
        newPos[axis] = target;
        newVel[axis] = 0;
        return;
      }
      
      // Dirección del movimiento
      const direction = Math.sign(distance);
      
      // ═══════════════════════════════════════════════════════════════════════
      // 🎢 CURVA S: Aceleración al inicio, deceleración al final
      // ═══════════════════════════════════════════════════════════════════════
      
      // Velocidad máxima permitida por el motor
      const maxSpeed = config.maxSpeed[axis] || this.physicsConfig.maxVelocity;
      
      // Distancia de frenado (cuánto necesito para frenar desde vel actual)
      const brakingDistance = (vel * vel) / (2 * this.physicsConfig.maxAcceleration);
      
      // Decidir si acelerar o frenar
      let acceleration;
      
      if (absDistance <= brakingDistance + 5) {
        // 🛑 FASE DE FRENADO: Deceleración suave
        // ⚠️ FIX V16.1: PROTECCIÓN CONTRA SINGULARIDAD
        // Si absDistance es muy pequeño, la división tiende a infinito → latigazo
        const safeDistance = Math.max(0.5, absDistance); // Mínimo 0.5 unidades DMX
        
        // Calcular aceleración necesaria para llegar a velocidad 0 justo en el objetivo
        acceleration = -(vel * vel) / (2 * safeDistance) * direction;
        
        // Limitar la deceleración (nunca frenar más fuerte que el motor permite)
        acceleration = Math.max(-this.physicsConfig.maxAcceleration, 
                               Math.min(this.physicsConfig.maxAcceleration, acceleration));
      } else {
        // 🚀 FASE DE ACELERACIÓN: Acelerar hacia el objetivo
        acceleration = this.physicsConfig.maxAcceleration * direction;
      }
      
      // Aplicar física: v = v0 + a*t, x = x0 + v*t
      newVel[axis] = vel + acceleration * dt;
      
      // Limitar velocidad máxima
      newVel[axis] = Math.max(-maxSpeed, Math.min(maxSpeed, newVel[axis]));
      
      // Calcular nueva posición
      newPos[axis] = pos + newVel[axis] * dt;
      
      // Anti-overshoot: Si pasamos el objetivo, quedarnos ahí
      if ((distance > 0 && newPos[axis] > target) || 
          (distance < 0 && newPos[axis] < target)) {
        newPos[axis] = target;
        newVel[axis] = 0;
      }
    });
    
    // ═══════════════════════════════════════════════════════════════════════════
    // 🛡️ FILTRO ANTI-JITTER V16.1
    // Si la velocidad es ridículamente baja, forzar parada para que el motor descanse
    // Los servos baratos sufren con micro-correcciones constantes (se calientan)
    // ═══════════════════════════════════════════════════════════════════════════
    if (Math.abs(newVel.pan) < 5) newVel.pan = 0;
    if (Math.abs(newVel.tilt) < 5) newVel.tilt = 0;
    
    // Actualizar estado
    this.currentPositions.set(fixtureId, newPos);
    this.velocities.set(fixtureId, newVel);
    
    return newPos;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 🔧 CALIBRACIÓN
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Calibrar posición HOME de un fixture
   * @param {string} fixtureId 
   * @param {number} panDMX - Valor DMX cuando mira al centro
   * @param {number} tiltDMX - Valor DMX cuando mira al centro
   */
  calibrateHome(fixtureId, panDMX, tiltDMX) {
    const config = this.configs.get(fixtureId);
    if (!config) return this;
    
    config.home = { pan: panDMX, tilt: tiltDMX };
    console.log(`[PhysicsDriver] Home calibrado para "${fixtureId}":`, config.home);
    
    return this;
  }

  /**
   * Calibrar límites de seguridad
   * @param {string} fixtureId 
   * @param {number} tiltMin - Límite superior (no mirar al techo)
   * @param {number} tiltMax - Límite inferior
   */
  calibrateLimits(fixtureId, tiltMin, tiltMax) {
    const config = this.configs.get(fixtureId);
    if (!config) return this;
    
    config.limits = { tiltMin, tiltMax };
    console.log(`[PhysicsDriver] Safety Box calibrado para "${fixtureId}":`, config.limits);
    
    return this;
  }

  /**
   * Establecer si un fixture es espejo del otro
   * @param {string} fixtureId 
   * @param {boolean} isMirror 
   */
  setMirror(fixtureId, isMirror) {
    const config = this.configs.get(fixtureId);
    if (!config) return this;
    
    config.mirror = isMirror;
    
    return this;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 🔍 UTILIDADES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Obtener posición actual de un fixture
   */
  getCurrentPosition(fixtureId) {
    return this.currentPositions.get(fixtureId) || { pan: 127, tilt: 127 };
  }

  /**
   * Forzar posición inmediata (sin suavizado)
   * Útil para reset o calibración
   */
  forcePosition(fixtureId, panDMX, tiltDMX) {
    this.currentPositions.set(fixtureId, { pan: panDMX, tilt: tiltDMX });
    this.velocities.set(fixtureId, { pan: 0, tilt: 0 });
    
    return { fixtureId, panDMX, tiltDMX };
  }

  /**
   * Enviar todos los fixtures a home
   */
  goHome(fixtureId = null) {
    if (fixtureId) {
      const config = this.configs.get(fixtureId);
      if (config) {
        return this.translate({ 
          fixtureId, 
          x: 0, 
          y: 0, 
          intensity: 1 
        }, 16);
      }
    } else {
      // Todos los fixtures a home
      const results = [];
      this.configs.forEach((config, id) => {
        results.push(this.translate({ fixtureId: id, x: 0, y: 0, intensity: 1 }, 16));
      });
      return results;
    }
  }

  /**
   * Obtener info de debug
   */
  getDebugInfo() {
    const info = {};
    this.configs.forEach((config, id) => {
      info[id] = {
        config,
        current: this.currentPositions.get(id),
        velocity: this.velocities.get(id),
      };
    });
    return info;
  }
}

// Exportar para uso en browser y Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FixturePhysicsDriver };
} else if (typeof window !== 'undefined') {
  window.FixturePhysicsDriver = FixturePhysicsDriver;
}
