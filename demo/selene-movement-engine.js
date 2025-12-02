/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                     SELENE MOVEMENT ENGINE V16.0                             ║
 * ║                  "Abstract Patterns for Organic Motion"                      ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  Genera coordenadas abstractas (-1 a +1) usando patrones matemáticos:       ║
 * ║  Lissajous, Perlin Noise, ondas triangulares, etc.                          ║
 * ║  La amplitud "respira" con la música (Nota de Gemini: Amplitude Modulation) ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

class SeleneMovementEngine {
  constructor(personality = {}) {
    // Referencia a personalidad de Selene
    this.personality = {
      creativity: 0.7,
      energy: 0.5,
      ...personality,
    };
    
    // Estado del motor
    this.phase = 0;              // Fase actual del patrón (0 a 2π)
    this.activePattern = 'circle';
    this.targetBPM = 120;
    this.intensity = 0.5;        // Modula la amplitud (0-1)
    this.baseAmplitude = 0.6;    // Amplitud base del patrón
    
    // Estado por fixture (para patrones con offset de fase)
    this.fixtureStates = new Map();
    
    // Perlin noise state (para pattern 'cloud')
    this.noiseTime = 0;
    this.noiseSeeds = { x: Math.random() * 1000, y: Math.random() * 1000 };
    
    // Transición entre patrones
    this.transition = {
      active: false,
      from: null,
      to: null,
      progress: 0,
      duration: 1000,  // ms
    };
    
    // Eventos especiales (drops, breaks)
    this.activeEvent = null;
    this.eventStartTime = 0;
    
    // Definición de patrones
    this._initPatterns();
    
    // Mapeo mood → patrón
    this.moodPatternMap = {
      fuego: 'infinity',
      hielo: 'cloud',
      selva: 'waves',
      neon: 'sweep',
      oceano: 'waves',
      techno: 'circle',
      house: 'circle',
      ambient: 'cloud',
      latin: 'infinity',
      cyberpunk: 'sweep',
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 🎨 DEFINICIÓN DE PATRONES
  // ═══════════════════════════════════════════════════════════════════════════

  _initPatterns() {
    this.patterns = {
      // ═══════════════════════════════════════════════════════════════════════
      // ⭕ CIRCLE: Movimiento circular/elíptico
      // Uso: Techno, House, ritmos 4/4 constantes
      // ═══════════════════════════════════════════════════════════════════════
      circle: {
        name: 'circle',
        description: 'Movimiento circular suave',
        // Lissajous: a=1, b=1, delta=π/2 = círculo perfecto
        calculate: (phase, amplitude, intensity) => {
          // 🫁 Amplitude Modulation: La amplitud crece con la energía
          const intensityMod = 0.3 + intensity * 0.7;
          const effectiveAmp = {
            x: amplitude.x * intensityMod,
            y: amplitude.y * intensityMod,
          };
          
          return {
            x: Math.cos(phase) * effectiveAmp.x,
            y: Math.sin(phase) * effectiveAmp.y,
          };
        },
        baseAmplitude: { x: 0.6, y: 0.4 },  // Elipse horizontal
        speedMultiplier: 1.0,
        moods: ['techno', 'house', 'trance'],
      },
      
      // ═══════════════════════════════════════════════════════════════════════
      // ♾️ INFINITY: Figura de 8 (movimiento de caderas)
      // Uso: Latino, Fuego, Reggaeton
      // ═══════════════════════════════════════════════════════════════════════
      infinity: {
        name: 'infinity',
        description: 'Figura de 8 sensual',
        // Lissajous: a=1, b=2 = figura de 8
        calculate: (phase, amplitude, intensity) => {
          const effectiveAmp = {
            x: amplitude.x * (0.4 + intensity * 0.6),
            y: amplitude.y * (0.3 + intensity * 0.7),
          };
          
          return {
            x: Math.sin(phase) * effectiveAmp.x,
            y: Math.sin(phase * 2) * effectiveAmp.y,
          };
        },
        baseAmplitude: { x: 0.7, y: 0.35 },
        speedMultiplier: 0.8,  // Más lento, sensual
        moods: ['fuego', 'latin', 'reggaeton'],
      },
      
      // ═══════════════════════════════════════════════════════════════════════
      // ⚡ SWEEP: Barrido horizontal (zigzag suavizado)
      // Uso: Neón, Cyberpunk, builds intensos
      // V17.1 FIX: Cambio de triángulo a seno achatado para evitar picos de
      //            aceleración infinita que causaban "Unstuck" excesivos
      // ═══════════════════════════════════════════════════════════════════════
      sweep: {
        name: 'sweep',
        description: 'Barrido lineal horizontal (suavizado)',
        calculate: (phase, amplitude, intensity) => {
          // V17.1 FIX: Seno saturado en lugar de triángulo
          // Parece lineal en el centro pero tiene transiciones suaves en los extremos
          // pow(0.7) achata la curva para que parezca más lineal
          const rawSine = Math.sin(phase);
          const sweepX = Math.sign(rawSine) * Math.pow(Math.abs(rawSine), 0.7);
          
          const effectiveAmp = amplitude.x * (0.5 + intensity * 0.5);
          
          return {
            x: sweepX * effectiveAmp,
            y: Math.sin(phase * 0.5) * amplitude.y * 0.1 * intensity,  // Ligera ondulación
          };
        },
        baseAmplitude: { x: 0.9, y: 0.15 },
        speedMultiplier: 1.5,  // Rápido
        moods: ['neon', 'cyberpunk', 'edm'],
      },
      
      // ═══════════════════════════════════════════════════════════════════════
      // ☁️ CLOUD: Movimiento Browniano (Perlin Noise)
      // Uso: Hielo, Ambient, Chill
      // ═══════════════════════════════════════════════════════════════════════
      cloud: {
        name: 'cloud',
        description: 'Flotación orgánica impredecible',
        calculate: (phase, amplitude, intensity, engine) => {
          // Perlin-like noise simplificado
          const noise = (t, seed) => {
            // Suma de senos con frecuencias irracionales (pseudo-random)
            return (
              Math.sin(t * 0.7 + seed) * 0.5 +
              Math.sin(t * 1.3 + seed * 1.5) * 0.3 +
              Math.sin(t * 2.1 + seed * 0.8) * 0.2
            );
          };
          
          // Muy poca amplitud en chill, crece con intensidad
          const effectiveAmp = {
            x: amplitude.x * (0.2 + intensity * 0.4),
            y: amplitude.y * (0.2 + intensity * 0.4),
          };
          
          return {
            x: noise(engine.noiseTime, engine.noiseSeeds.x) * effectiveAmp.x,
            y: noise(engine.noiseTime + 100, engine.noiseSeeds.y) * effectiveAmp.y,
          };
        },
        baseAmplitude: { x: 0.4, y: 0.3 },
        speedMultiplier: 0.3,  // Muy lento
        noiseSpeed: 0.001,     // Velocidad del noise
        moods: ['hielo', 'ambient', 'chill'],
      },
      
      // ═══════════════════════════════════════════════════════════════════════
      // 🌊 WAVES: Ondulación orgánica (Lissajous 3:2)
      // Uso: Selva, Océano
      // ═══════════════════════════════════════════════════════════════════════
      waves: {
        name: 'waves',
        description: 'Ondulación orgánica compleja',
        // Lissajous: a=3, b=2, delta=π/4
        calculate: (phase, amplitude, intensity) => {
          const delta = Math.PI / 4;
          const effectiveAmp = {
            x: amplitude.x * (0.3 + intensity * 0.7),
            y: amplitude.y * (0.3 + intensity * 0.7),
          };
          
          return {
            x: Math.sin(phase * 3 + delta) * effectiveAmp.x,
            y: Math.sin(phase * 2) * effectiveAmp.y,
          };
        },
        baseAmplitude: { x: 0.5, y: 0.5 },
        speedMultiplier: 0.6,
        moods: ['selva', 'oceano', 'organic'],
      },
      
      // ═══════════════════════════════════════════════════════════════════════
      // 🎯 STATIC: Posición fija con micro-movimiento
      // Uso: Momentos dramáticos, spotlight
      // ═══════════════════════════════════════════════════════════════════════
      static: {
        name: 'static',
        description: 'Posición fija con vida sutil',
        calculate: (phase, amplitude, intensity, engine, params = {}) => {
          const target = params.target || { x: 0, y: 0 };
          const microMovement = params.microMovement || 0.02;
          
          // Micro-vibración para que parezca "vivo"
          const micro = {
            x: Math.sin(phase * 5) * microMovement * intensity,
            y: Math.cos(phase * 7) * microMovement * intensity,
          };
          
          return {
            x: target.x + micro.x,
            y: target.y + micro.y,
          };
        },
        baseAmplitude: { x: 0.02, y: 0.02 },
        speedMultiplier: 0.5,
        moods: ['ballad', 'speech', 'focus'],
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 🔄 TICK: Actualización por frame
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Actualiza el motor y retorna posiciones abstractas para todos los fixtures
   * @param {Object} audioData - { bass, mid, treble, beat, bpm }
   * @param {number} deltaTime - Tiempo desde último frame (ms)
   * @param {string[]} fixtureIds - IDs de los fixtures a calcular
   * @returns {Object[]} - Array de { fixtureId, x, y, intensity }
   */
  tick(audioData, deltaTime, fixtureIds = ['moving_left', 'moving_right']) {
    const { bass = 0, mid = 0, treble = 0, beat = false, bpm = 120 } = audioData;
    
    // Actualizar BPM target
    if (bpm > 0) this.targetBPM = bpm;
    
    // Calcular velocidad de fase basada en BPM
    // 1 vuelta completa (2π) cada 2 beats a 120 BPM
    const beatsPerSecond = this.targetBPM / 60;
    const pattern = this.patterns[this.activePattern];
    const speedMult = pattern?.speedMultiplier || 1.0;
    
    // deltaTime en segundos, ajustado por velocidad del patrón
    const dt = (deltaTime / 1000) * speedMult;
    
    // Avanzar fase (velocidad base: 1 vuelta cada 2 segundos a 120 BPM)
    const phaseSpeed = beatsPerSecond * Math.PI * this.personality.creativity;
    this.phase += phaseSpeed * dt;
    
    // Mantener fase en rango 0-2π
    if (this.phase > Math.PI * 2) this.phase -= Math.PI * 2;
    
    // Actualizar noise time para pattern 'cloud'
    const noiseSpeed = pattern?.noiseSpeed || 0.001;
    this.noiseTime += deltaTime * noiseSpeed;
    
    // 🫁 Amplitude Modulation (Nota de Gemini)
    // La intensidad se deriva de la energía del audio
    const energy = (bass * 0.5 + mid * 0.3 + treble * 0.2);
    this.intensity = this._smoothValue(this.intensity, energy, 0.1);
    
    // Boost en beats
    if (beat && bass > 0.6) {
      this.intensity = Math.min(1, this.intensity + 0.2);
    }
    
    // Calcular posición para cada fixture
    const positions = fixtureIds.map((fixtureId, index) => {
      // Offset de fase para lateralidad (LEFT y RIGHT no van exactamente igual)
      const phaseOffset = index * (Math.PI / 4); // 45° de desfase
      const fixturePhase = this.phase + phaseOffset;
      
      // Calcular posición abstracta
      const pos = this._calculatePosition(fixturePhase, fixtureId);
      
      return {
        fixtureId,
        x: pos.x,
        y: pos.y,
        intensity: this.intensity,
      };
    });
    
    return positions;
  }

  /**
   * Calcula la posición para un fixture específico
   * @private
   */
  _calculatePosition(phase, fixtureId) {
    const pattern = this.patterns[this.activePattern];
    if (!pattern) return { x: 0, y: 0 };
    
    // Si hay evento activo, usar lógica de evento
    if (this.activeEvent) {
      return this._calculateEventPosition(phase, fixtureId);
    }
    
    // Si hay transición activa, interpolar entre patrones
    if (this.transition.active) {
      return this._calculateTransitionPosition(phase, fixtureId);
    }
    
    // Calcular posición normal del patrón
    const amplitude = pattern.baseAmplitude;
    return pattern.calculate(phase, amplitude, this.intensity, this);
  }

  /**
   * Interpola entre dos patrones durante transición
   * @private
   */
  _calculateTransitionPosition(phase, fixtureId) {
    const fromPattern = this.patterns[this.transition.from];
    const toPattern = this.patterns[this.transition.to];
    
    if (!fromPattern || !toPattern) {
      this.transition.active = false;
      return { x: 0, y: 0 };
    }
    
    const t = this.transition.progress;
    
    // Posición del patrón origen
    const fromPos = fromPattern.calculate(
      phase, 
      fromPattern.baseAmplitude, 
      this.intensity, 
      this
    );
    
    // Posición del patrón destino
    const toPos = toPattern.calculate(
      phase, 
      toPattern.baseAmplitude, 
      this.intensity, 
      this
    );
    
    // Interpolación suave (ease-in-out)
    const easeT = t < 0.5 
      ? 2 * t * t 
      : 1 - Math.pow(-2 * t + 2, 2) / 2;
    
    return {
      x: fromPos.x + (toPos.x - fromPos.x) * easeT,
      y: fromPos.y + (toPos.y - fromPos.y) * easeT,
    };
  }

  /**
   * Calcula posición durante eventos especiales
   * @private
   */
  _calculateEventPosition(phase, fixtureId) {
    const event = this.activeEvent;
    const elapsed = Date.now() - this.eventStartTime;
    
    switch (event.type) {
      case 'drop':
        // Pre-drop: Converger al centro
        if (elapsed < event.preDuration) {
          const t = elapsed / event.preDuration;
          return {
            x: this._lerp(this.lastPos?.x || 0, 0, t),
            y: this._lerp(this.lastPos?.y || 0, 0, t),
          };
        }
        // Post-drop: Explosión (máxima amplitud)
        this.intensity = 1.0;
        this.activeEvent = null;
        break;
        
      case 'break':
        // Mirar arriba durante el break
        if (elapsed < event.duration) {
          const target = event.target || { x: 0, y: 0.9 };
          return {
            x: target.x + Math.sin(phase * 3) * 0.05,  // Ligera vibración
            y: target.y,
          };
        }
        this.activeEvent = null;
        break;
        
      case 'rest':
        // Posición de reposo
        const target = event.target || { x: 0, y: -0.3 };
        const micro = event.microMovement || 0.01;
        return {
          x: target.x + Math.sin(phase * 2) * micro,
          y: target.y + Math.cos(phase * 3) * micro,
        };
    }
    
    // Fallback al patrón normal
    return this._calculatePosition(phase, fixtureId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 🎛️ CONTROL
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Cambiar patrón activo
   * @param {string} patternName - Nombre del patrón
   * @param {number} transitionTime - Tiempo de transición en ms (0 = inmediato)
   */
  setPattern(patternName, transitionTime = 500) {
    if (!this.patterns[patternName]) {
      console.warn(`[MovementEngine] Patrón "${patternName}" no existe`);
      return this;
    }
    
    if (patternName === this.activePattern) return this;
    
    if (transitionTime > 0) {
      // Iniciar transición suave
      this.transition = {
        active: true,
        from: this.activePattern,
        to: patternName,
        progress: 0,
        duration: transitionTime,
        startTime: Date.now(),
      };
      
      // Actualizar progreso de transición en cada tick
      this._scheduleTransitionUpdate();
    } else {
      // Cambio inmediato
      this.activePattern = patternName;
    }
    
    console.log(`[MovementEngine] Patrón → ${patternName}`);
    return this;
  }

  /**
   * Actualiza el progreso de la transición
   * @private
   */
  _scheduleTransitionUpdate() {
    const update = () => {
      if (!this.transition.active) return;
      
      const elapsed = Date.now() - this.transition.startTime;
      this.transition.progress = Math.min(1, elapsed / this.transition.duration);
      
      if (this.transition.progress >= 1) {
        // Transición completada
        this.activePattern = this.transition.to;
        this.transition.active = false;
      } else {
        requestAnimationFrame(update);
      }
    };
    
    requestAnimationFrame(update);
  }

  /**
   * Ajustar velocidad basada en BPM
   * @param {number} bpm 
   */
  setSpeed(bpm) {
    this.targetBPM = Math.max(60, Math.min(200, bpm));
    return this;
  }

  /**
   * Ajustar intensidad/amplitud manualmente
   * @param {number} intensity - 0 a 1
   */
  setIntensity(intensity) {
    this.intensity = Math.max(0, Math.min(1, intensity));
    return this;
  }

  /**
   * Sugerir patrón basado en mood/paleta
   * @param {string} mood 
   * @returns {string} - Nombre del patrón sugerido
   */
  suggestPatternFromMood(mood) {
    return this.moodPatternMap[mood.toLowerCase()] || 'circle';
  }

  /**
   * Disparar evento especial
   * @param {string} eventType - 'drop' | 'break' | 'rest'
   * @param {Object} params 
   */
  triggerEvent(eventType, params = {}) {
    this.activeEvent = { type: eventType, ...params };
    this.eventStartTime = Date.now();
    this.lastPos = this._calculatePosition(this.phase, 'any');
    
    console.log(`[MovementEngine] Evento: ${eventType}`, params);
    return this;
  }

  /**
   * Cancelar evento activo
   */
  cancelEvent() {
    this.activeEvent = null;
    return this;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 🔧 UTILIDADES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Interpolación lineal
   * @private
   */
  _lerp(a, b, t) {
    return a + (b - a) * t;
  }

  /**
   * Suavizado exponencial
   * @private
   */
  _smoothValue(current, target, smoothing) {
    return current + (target - current) * smoothing;
  }

  /**
   * Obtener info del patrón actual
   */
  getCurrentPatternInfo() {
    const pattern = this.patterns[this.activePattern];
    return {
      name: this.activePattern,
      description: pattern?.description || '',
      phase: this.phase,
      intensity: this.intensity,
      bpm: this.targetBPM,
      transition: this.transition.active ? {
        from: this.transition.from,
        to: this.transition.to,
        progress: this.transition.progress,
      } : null,
    };
  }

  /**
   * Obtener lista de patrones disponibles
   */
  getAvailablePatterns() {
    return Object.keys(this.patterns).map(name => ({
      name,
      description: this.patterns[name].description,
      moods: this.patterns[name].moods,
    }));
  }

  /**
   * Debug: Obtener posición actual sin avanzar fase
   */
  getDebugPosition(fixtureId = 'debug') {
    return this._calculatePosition(this.phase, fixtureId);
  }
}

// Exportar para uso en browser y Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SeleneMovementEngine };
} else if (typeof window !== 'undefined') {
  window.SeleneMovementEngine = SeleneMovementEngine;
}
