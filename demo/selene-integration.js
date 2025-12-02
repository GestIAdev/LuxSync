/**
 * 🌙 SELENE INTEGRATION MODULE FOR LUXSYNC DEMO
 * 
 * Este módulo conecta la inteligencia de Selene con el demo de canvas.
 * Es una versión "lite" de Selene que corre 100% en el browser.
 * 
 * Selene's Personality:
 * - 🎵 Entiende la música (notas musicales, no solo frecuencias)
 * - 🎨 Tiene sentido estético (beauty score)
 * - 🧠 Aprende patrones (pattern memory)
 * - 💫 Evoluciona su comportamiento
 * 
 * @author LuxSync Team + PunkClaude
 * @date 2025-11-30
 */

// ═══════════════════════════════════════════════════════════════════════════
// SELENE CONSCIOUSNESS LITE - Browser Edition
// ═══════════════════════════════════════════════════════════════════════════

class SeleneConsciousnessLite {
  constructor() {
    // 🎵 Escala cromática musical (7 notas = 7 colores)
    this.MUSICAL_NOTES = ['DO', 'RE', 'MI', 'FA', 'SOL', 'LA', 'SI'];
    
    // 🎨 Mapeo nota → color (basado en sinestesia musical)
    this.NOTE_COLORS = {
      DO:  { r: 255, g: 0,   b: 0,   name: 'Rojo',    hex: '#FF0000' },   // Bass profundo
      RE:  { r: 255, g: 127, b: 0,   name: 'Naranja', hex: '#FF7F00' },   // Bass cálido  
      MI:  { r: 255, g: 255, b: 0,   name: 'Amarillo',hex: '#FFFF00' },   // Mid brillante
      FA:  { r: 0,   g: 255, b: 0,   name: 'Verde',   hex: '#00FF00' },   // Mid equilibrado
      SOL: { r: 0,   g: 255, b: 255, name: 'Cyan',    hex: '#00FFFF' },   // Mid-Treble
      LA:  { r: 0,   g: 0,   b: 255, name: 'Azul',    hex: '#0000FF' },   // Treble puro
      SI:  { r: 127, g: 0,   b: 255, name: 'Violeta', hex: '#7F00FF' },   // Treble alto
    };

    // 🧠 Memoria de patrones (aprende del audio)
    this.patternMemory = {
      recentNotes: [],           // Últimas 16 notas
      recentBeauty: [],          // Últimos 16 beauty scores
      dominantNote: 'MI',        // Nota más frecuente actual
      energyTrend: 'stable',     // 'rising' | 'falling' | 'stable'
      beatConfidence: 0.5,       // Confianza en detección de beat
      musicalMood: 'chill',      // 'silence' | 'chill' | 'build' | 'drop' | 'break'
    };

    // 💫 Personalidad evolutiva
    this.personality = {
      creativity: 0.5,           // 0=predecible, 1=caótico
      sensitivity: 0.7,          // Reactividad al audio
      harmony: 0.8,              // Preferencia por transiciones suaves
      energy: 0.5,               // Nivel de energía actual
    };

    // ═══════════════════════════════════════════════════════════════════════
    // 🎨 SELENE V14 - LIVING PALETTES
    // ═══════════════════════════════════════════════════════════════════════
    // Solo definimos la IDENTIDAD de cada paleta, no colores fijos.
    // El color se calcula matemáticamente en tiempo real por getLivingColor()
    // 
    // Ventajas:
    // - Los colores "respiran" con drift temporal (no son estáticos)
    // - Cada zona (wash/spot) tiene su propio comportamiento
    // - Los acentos aparecen naturalmente en momentos de alta energía
    // - Menos código, más expresividad
    // ═══════════════════════════════════════════════════════════════════════
    this.PALETTES = {
      // 🔥 FUEGO: Latino, Reggaeton, Salsa - Cálido y apasionado
      fuego: { 
        name: 'Fuego Vivo', 
        icon: '🔥', 
        type: 'dynamic',
        // Personalidad: De brasa oscura a llama dorada, con sorpresas violeta
      },
      
      // ❄️ HIELO: Chill, Ambient, Downtempo - Elegante y etéreo
      hielo: { 
        name: 'Hielo Eterno', 
        icon: '❄️', 
        type: 'dynamic',
        minIntensity: 0.25, // Hielo nunca es negro total (elegante)
        // Personalidad: Abismo azul a blanco estroboscópico, auroras boreales
      },
      
      // 🌿 SELVA: Tropical House, Reggae, Summer - Natural y colorido
      selva: { 
        name: 'Selva Neón', 
        icon: '🌿', 
        type: 'dynamic',
        // Personalidad: Verde esmeralda con flores magenta/rosa en los spots
      },
      
      // ⚡ NEÓN: Techno, Cyberpunk, EDM - Agresivo y binario
      neon: { 
        name: 'Cyberpunk', 
        icon: '⚡', 
        type: 'binary', // Neón no es gradual, es on/off con colores duros
        allowBlackout: true,
        // Personalidad: Pares de colores complementarios que rotan cada 30s
      },
      
      // Legacy redirects (compatibilidad)
      latino: { redirect: 'fuego' },
      electronica: { redirect: 'neon' },
      techno: { redirect: 'neon' },
      cyberpunk: { redirect: 'neon' },
      trance: { redirect: 'hielo' },
      default: { redirect: 'fuego' },
    };

    // 🎨 Paleta activa (MANUAL - el usuario la elige)
    this.activePalette = 'fuego';
    this.paletteConfidence = 1.0;  // Siempre 100% - el usuario eligió

    // 📊 Estadísticas de sesión
    this.sessionStats = {
      framesProcessed: 0,
      notesPlayed: new Map(),    // Contador por nota
      peakBeauty: 0,
      averageBeauty: 0,
      moodChanges: 0,
    };

    // ⏱️ Throttling - 24 FPS (estándar cine/DMX suave)
    this.lastProcessTime = 0;
    this.targetFPS = 24;
    this.frameInterval = 1000 / this.targetFPS;
    this.lastDecision = null;

    // ═══════════════════════════════════════════════════════════════════════
    // 🌑 V13.1: SISTEMA DE BLACKOUTS Y SILENCIOS (AJUSTADO)
    // ═══════════════════════════════════════════════════════════════════════
    this.silenceSystem = {
      // Umbrales de detección
      UMBRAL_SILENCIO: 0.05,     // <5% = silencio real → BLACKOUT
      UMBRAL_BAJO: 0.20,         // <20% = casi silencio → FADE
      UMBRAL_SHAKERS: 0.10,      // <10% pero constante = shakers → ignorar
      
      // 🎯 V13.1: Tiempos MUCHO más rápidos (la música es rápida!)
      TIEMPO_BLACKOUT: 300,      // 300ms para blackout (era 1000ms)
      TIEMPO_FADE: 150,          // 150ms para empezar fade (era 500ms)
      TIEMPO_CORTE_DJ: 50,       // 50ms para cortes BRUSCOS de DJ
      
      // 🎯 V13.1: Detección de cortes bruscos
      UMBRAL_CORTE_BRUSCO: 0.4,  // Si la energía cae >40% de golpe = CORTE DJ
      ultimaEnergiaTotal: 0,     // Para comparar cambios bruscos
      
      // Estado actual
      tiempoEnSilencio: 0,       // ms acumulados en silencio
      tiempoEnBajo: 0,           // ms acumulados en nivel bajo
      ultimoNivelTotal: 0,       // para detectar cambios
      lastUpdateTime: Date.now(),
      
      // Historial para detectar picos vs ruido constante
      historialNivel: [],        // últimos N frames
      VENTANA_HISTORIAL: 15,     // frames para analizar
      UMBRAL_PICO: 0.25,         // 25% de cambio = pico real
      
      // Estado de salida
      modo: 'NORMAL',            // 'NORMAL' | 'FADE_DOWN' | 'BLACKOUT'
      intensidadMultiplier: 1.0, // 0.0 - 1.0
    };

    // ═══════════════════════════════════════════════════════════════════════
    // 🔀 V15: MOTOR DE ENTROPÍA DETERMINISTA
    // ═══════════════════════════════════════════════════════════════════════
    // Selene NO usa Math.random(). Selene REACCIONA al estado del sistema.
    // La "aleatoriedad" viene de fuentes deterministas:
    // - Date.now() decimales para drift temporal
    // - Audio energy decimales como semilla de ruido
    // - Fibonacci patterns para selección de colores
    // 
    // AXIOMA: Mismo tiempo + mismo audio = mismo resultado (reproducible)
    // ═══════════════════════════════════════════════════════════════════════
    this.entropyState = {
      lastEnergy: 0,             // Última energía total para semilla
      lastSpectralCentroid: 0.5, // Centroid espectral simulado
      timeSeed: 0,               // Semilla temporal actualizada cada frame
      audioSeed: 0,              // Semilla basada en audio
      hysteresis: {              // Estado para transiciones suaves
        selvaRosa: false,        // ¿Estamos en modo rosa en selva?
        lastPalette: 'fuego',    // Última paleta para transiciones
      },
    };

    // ═══════════════════════════════════════════════════════════════════════
    // 🎭 V16: MOTOR DE MOVIMIENTO ABSTRACTO
    // ═══════════════════════════════════════════════════════════════════════
    // Coordenadas abstractas (-1 a +1) → DMX físico
    // Patrones Lissajous, Perlin Noise, etc.
    // ═══════════════════════════════════════════════════════════════════════
    this.movementEngine = null;    // Se inicializa en initMovement()
    this.physicsDriver = null;     // Se inicializa en initMovement()
    this.lastFrameTime = Date.now();
    this.movementEnabled = true;   // Flag para habilitar/deshabilitar

    console.log('🌙 Selene V16 inicializada - Movement Engine + Deterministic Chaos');
  }

  /**
   * 🎯 MÉTODO PRINCIPAL: Procesa audio y devuelve decisión de iluminación
   * 
   * @param {Object} audioMetrics - { bass: 0-1, mid: 0-1, treble: 0-1, rms: 0-1, beat: bool }
   * @returns {Object} - { note, color, intensity, effect, poem }
   */
  process(audioMetrics) {
    // ⏱️ THROTTLE: Limitar a 60 FPS
    const now = performance.now();
    if (now - this.lastProcessTime < this.frameInterval) {
      // Devolver última decisión sin procesar de nuevo
      return this.lastDecision || this._processInternal(audioMetrics);
    }
    this.lastProcessTime = now;
    
    // Procesar y guardar
    this.lastDecision = this._processInternal(audioMetrics);
    return this.lastDecision;
  }

  /**
   * 🎯 PROCESAMIENTO INTERNO (sin throttle)
   */
  _processInternal(audioMetrics) {
    const { bass, mid, treble, rms, beat, bpm, bpmConfidence } = audioMetrics;
    
    // 1. Detectar nota musical dominante
    const note = this.detectMusicalNote(bass, mid, treble);
    
    // 2. Calcular beauty score (calidad estética)
    const beauty = this.calculateBeauty(bass, mid, treble, rms);
    
    // 3. Determinar mood musical
    const mood = this.detectMood(bass, mid, treble, beat);
    
    // 4. Obtener color base de la nota
    const baseColor = this.NOTE_COLORS[note];
    
    // 5. Aplicar modificaciones según mood y beauty
    const finalColor = this.modifyColorByMood(baseColor, mood, beauty);
    
    // 6. Calcular intensidad (dimmer)
    const intensity = this.calculateIntensity(beauty, beat, mood);
    
    // 7. Sugerir efecto visual
    const effect = this.suggestEffect(mood, beat, beauty);
    
    // 8. Generar "poema" (texto decorativo de Selene)
    const poem = this.generatePoem(note, mood, beauty);
    
    // 9. Actualizar memoria y estadísticas
    this.updateMemory(note, beauty, mood);
    
    // 🎨 10. SELENE DECIDE QUÉ PALETA USAR (ahora por BPM!)
    const paletteInfo = this.detectPalette(bass, mid, treble, mood, beat, bpm, bpmConfidence);
    
    // 🎨 11. COLORES POR ZONA (usando la paleta elegida)
    const zoneColors = this.calculateZoneColors(bass, mid, treble, beat, mood);
    
    return {
      note,
      color: finalColor,
      intensity: Math.round(intensity * 255),
      beauty,
      mood,
      effect,
      poem,
      timestamp: Date.now(),
      // 🆕 Colores específicos por zona
      zones: zoneColors,
      // 🆕 Info de paleta para debug
      palette: this.activePalette,
      paletteName: this.PALETTES[this.activePalette].name,
      paletteConfidence: this.paletteConfidence,
      // 🌑 V13: Info de sistema de silencios
      silenceMode: zoneColors.silenceMode || 'NORMAL',
      silenceMultiplier: zoneColors.silenceMultiplier || 1.0,
    };
  }

  /**
   * 🎨 COLORES POR ZONA - Teoría de Iluminación por Frecuencias
   * 
   * V13: AHORA CON BLACKOUTS INTELIGENTES
   * 
   * FRONT PARs = KICK/Bass directo → Color de paleta.front
   * BACK PARs = Snare/Claps + Reverb → Color de paleta.back
   * Moving Heads = Melodía/Pads/Voces → paleta.left y paleta.right
   * 
   * SENSIBILIDAD AJUSTADA:
   * - Umbral alto para evitar ruido (voces público, ambiente)
   * - Respeta upswings/downswings de DJ
   * - 🌑 BLACKOUT REAL en silencios (>1 segundo)
   * - 🌑 FADE en niveles bajos (>500ms)
   * - 🎯 Móviles ignoran shakers (ruido constante)
   */
  calculateZoneColors(bass, mid, treble, beat, mood) {
    // === 🌑 V13: ACTUALIZAR SISTEMA DE SILENCIOS ===
    const silenceState = this.updateSilenceState(bass, mid, treble);
    const { modo: silenceMode, intensidadMultiplier, esPico } = silenceState;
    
    // === Si estamos en BLACKOUT TOTAL, devolver todo negro ===
    if (silenceMode === 'BLACKOUT') {
      const black = { r: 0, g: 0, b: 0 };
      return {
        front: { color: black, intensity: 0 },
        back: { color: black, intensity: 0 },
        movingLeft: { color: black, intensity: 0 },
        movingRight: { color: black, intensity: 0 },
        effects: { color: black, intensity: 0 },
        mid: { color: black, intensity: 0 },
        treble: { color: black, intensity: 0 },
        bass: { color: black, intensity: 0 },
        ambient: { color: black, intensity: 0 },
        // 🌑 Info de debug
        silenceMode: 'BLACKOUT',
        silenceMultiplier: 0,
      };
    }
    
    // === UMBRALES DE SENSIBILIDAD ===
    const BASS_THRESHOLD = 0.25;
    const SNARE_THRESHOLD = 0.20;
    const MELODY_THRESHOLD = 0.15;
    const SILENCE_THRESHOLD = 0.12;
    
    const totalEnergy = bass + mid + treble;
    const isSilence = totalEnergy < SILENCE_THRESHOLD;
    const isQuiet = totalEnergy < 0.25;
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🎨 V15: HUMAN TOUCH & DETERMINISTIC CHAOS
    // - Living Palettes (V14) + Lateralidad + Depth
    // - getSystemEntropy() en lugar de Math.random()
    // - RIGHT: +30° hue offset (asimetría artística)
    // - BACK: -15° hue offset (profundidad visual)
    // ═══════════════════════════════════════════════════════════════════════
    
    // === ZONA FRONT PARS: KICK/BASS ===
    let frontColor, frontIntensity;
    
    if (bass < BASS_THRESHOLD) {
      frontColor = { r: 0, g: 0, b: 0 };
      frontIntensity = 0;
    } else {
      // 🎨 V15: Generar color procedural + lateralidad (front = sin offset)
      const bassNormalized = Math.min(1, (bass - BASS_THRESHOLD) / (1 - BASS_THRESHOLD));
      frontColor = this.getLivingColor(this.activePalette, bassNormalized, 'wash', 'front');
      
      if (bass > 0.7) {
        // KICK MUY fuerte
        frontIntensity = Math.round(200 + (bass - 0.7) * 183);
      } else if (bass > 0.5) {
        // KICK fuerte
        frontIntensity = Math.round(120 + (bass - 0.5) * 400);
      } else {
        // KICK suave
        const fadeIn = (bass - BASS_THRESHOLD) / (0.5 - BASS_THRESHOLD);
        frontIntensity = Math.round(fadeIn * 120);
      }
    }
    
    // === ZONA BACK PARS: SNARE/CLAPS (TREBLE-FOCUSED) ===
    // V13.2: Más treble (80%), menos mid (20%) para evitar capturar voces
    let backColor, backIntensity;
    const snareEnergy = (mid * 0.2 + treble * 0.8);
    
    // V13.2: Filtro de bass rumble a back pars
    const backBassDominante = bass > 0.7 && treble < 0.15;
    
    if (snareEnergy < SNARE_THRESHOLD || backBassDominante) {
      backColor = { r: 0, g: 0, b: 0 };
      backIntensity = 0;
    } else {
      // 🎨 V15: Generar color procedural + depth (back = -15° offset para profundidad)
      const snareNormalized = Math.min(1, (snareEnergy - SNARE_THRESHOLD) / (1 - SNARE_THRESHOLD));
      backColor = this.getLivingColor(this.activePalette, snareNormalized, 'wash', 'back');
      
      if (snareEnergy > 0.6) {
        backIntensity = Math.round(200 + (snareEnergy - 0.6) * 137);
      } else if (snareEnergy > 0.4) {
        backIntensity = Math.round(130 + (snareEnergy - 0.4) * 350);
      } else {
        const fadeIn = (snareEnergy - SNARE_THRESHOLD) / (0.4 - SNARE_THRESHOLD);
        backIntensity = Math.round(fadeIn * 130);
      }
    }
    
    // === ZONA MOVING HEADS: MELODÍA ===
    // 🎨 V14: Los spots usan getLivingColor con zoneType='spot'
    // Esto les da comportamientos únicos (flores en selva, violeta en fuego, etc.)
    
    const melodyEnergy = mid + treble;
    const isMelodySilence = melodyEnergy < MELODY_THRESHOLD;
    
    // 🎯 V13.2: Consultar si los móviles deben responder
    const movingResponse = this.shouldMovingHeadsRespond(mid, treble, bass);
    
    let leftColor, rightColor, movingIntensity;
    
    if (isMelodySilence || !movingResponse.respond) {
      leftColor = { r: 0, g: 0, b: 0 };
      rightColor = { r: 0, g: 0, b: 0 };
      movingIntensity = 0;
    } else {
      // 🎨 V15: Los spots obtienen colores especiales + LATERALIDAD
      // LEFT = sin offset, RIGHT = +30° (asimetría artística)
      const melodyNormalized = Math.min(1, melodyEnergy / 1.5);
      
      // LEFT: colores puros de paleta
      leftColor = this.getLivingColor(this.activePalette, melodyNormalized, 'spot', 'left');
      
      // RIGHT: +30° hue offset escalado por creatividad (asimetría determinista)
      const rightIntensity = Math.min(1, melodyNormalized * 1.1);
      rightColor = this.getLivingColor(this.activePalette, rightIntensity, 'spot', 'right');
      
      // Intensidad aumentada V13.1
      movingIntensity = Math.round(100 + movingResponse.intensity * 200);
      
      // Boost en picos
      if (movingResponse.reason === 'pico') {
        movingIntensity = Math.min(255, Math.round(movingIntensity * 1.3));
      }
    }
    
    // === ZONA EFFECTS/STROBO: SOLO EN PEAKS ===
    let effectColor, effectIntensity;
    const isPeak = beat && treble > 0.6 && bass > 0.5;
    
    if (isPeak && silenceMode === 'NORMAL') {
      effectColor = { r: 255, g: 255, b: 255 };
      effectIntensity = 255;
    } else {
      effectColor = { r: 0, g: 0, b: 0 };
      effectIntensity = 0;
    }
    
    // === 🌑 V13: APLICAR MULTIPLICADOR DE SILENCIO ===
    // En FADE_DOWN o FADE_TO_BLACK, reducir todas las intensidades
    const applyMultiplier = (intensity) => 
      Math.round(Math.min(255, intensity * intensidadMultiplier));
    
    return {
      // FRONT = KICK
      front: {
        color: frontColor,
        intensity: applyMultiplier(frontIntensity),
      },
      // BACK = SNARE  
      back: {
        color: backColor,
        intensity: applyMultiplier(backIntensity),
      },
      // MOVING LEFT = Colores fríos (melodía)
      movingLeft: {
        color: leftColor,
        intensity: applyMultiplier(movingIntensity),
      },
      // MOVING RIGHT = Colores cálidos (melodía)
      movingRight: {
        color: rightColor,
        intensity: applyMultiplier(movingIntensity),
      },
      // EFFECTS = PEAKS
      effects: {
        color: effectColor,
        intensity: effectIntensity, // Effects no se reducen
      },
      // Legacy compatibility
      mid: {
        color: leftColor,
        intensity: applyMultiplier(movingIntensity),
      },
      treble: {
        color: effectColor,
        intensity: effectIntensity,
      },
      bass: {
        color: frontColor,
        intensity: applyMultiplier(frontIntensity),
      },
      ambient: {
        color: { r: 30, g: 20, b: 40 },
        intensity: isQuiet ? 30 : Math.round(60 * intensidadMultiplier),
      },
      // 🌑 V13: Info de debug del sistema de silencios
      silenceMode,
      silenceMultiplier: intensidadMultiplier,
      movingReason: movingResponse.reason || 'normal',
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // � V16: MOTOR DE MOVIMIENTO ABSTRACTO
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * 🎭 Inicializa los motores de movimiento
   * Llamar después de que las clases estén disponibles (window.loaded)
   */
  initMovement() {
    // Verificar que las clases están disponibles
    if (typeof SeleneMovementEngine === 'undefined') {
      console.warn('[Selene] SeleneMovementEngine no disponible. Movimiento deshabilitado.');
      this.movementEnabled = false;
      return this;
    }
    
    if (typeof FixturePhysicsDriver === 'undefined') {
      console.warn('[Selene] FixturePhysicsDriver no disponible. Movimiento deshabilitado.');
      this.movementEnabled = false;
      return this;
    }
    
    // Crear motor de movimiento abstracto
    this.movementEngine = new SeleneMovementEngine(this.personality);
    
    // Crear driver físico
    this.physicsDriver = new FixturePhysicsDriver();
    
    // Registrar fixtures con configuración de TECHO (tu sala)
    this.physicsDriver.registerFixture('moving_left', {
      installationType: 'ceiling',
      home: { pan: 127, tilt: 40 },      // Mirando a la pista
      invert: { pan: false, tilt: true }, // Tilt invertido (colgado)
      limits: { tiltMin: 20, tiltMax: 200 }, // Safety Box
      mirror: false,
    });
    
    this.physicsDriver.registerFixture('moving_right', {
      installationType: 'ceiling',
      home: { pan: 127, tilt: 40 },
      invert: { pan: true, tilt: true },  // Pan también invertido (espejo)
      limits: { tiltMin: 20, tiltMax: 200 },
      mirror: true,  // Es espejo del izquierdo
    });
    
    this.movementEnabled = true;
    console.log('🎭 [Selene V16] Motor de movimiento inicializado - Ceiling mode');
    
    return this;
  }

  /**
   * 🎭 Actualiza el movimiento basado en audio
   * Llamar cada frame después de process()
   * 
   * @param {Object} audioData - { bass, mid, treble, beat, bpm }
   * @returns {Object} - { moving_left: {pan, tilt}, moving_right: {pan, tilt} }
   */
  updateMovement(audioData) {
    if (!this.movementEnabled || !this.movementEngine || !this.physicsDriver) {
      return null;
    }
    
    const now = Date.now();
    const deltaTime = now - this.lastFrameTime;
    this.lastFrameTime = now;
    
    // 1. Sugerir patrón basado en paleta activa
    const suggestedPattern = this.movementEngine.suggestPatternFromMood(this.activePalette);
    
    // 2. Cambiar patrón en beats fuertes (transición natural)
    if (audioData.beat && audioData.bass > 0.7) {
      if (suggestedPattern !== this.movementEngine.activePattern) {
        this.movementEngine.setPattern(suggestedPattern, 500); // Transición 500ms
      }
    }
    
    // 3. Ajustar velocidad con BPM
    if (audioData.bpm > 0) {
      this.movementEngine.setSpeed(audioData.bpm);
    }
    
    // 4. Tick del motor (obtener posiciones abstractas)
    const abstractPositions = this.movementEngine.tick(
      audioData, 
      deltaTime, 
      ['moving_left', 'moving_right']
    );
    
    // 5. Traducir a DMX físico
    const physicalOutputs = {};
    
    abstractPositions.forEach(pos => {
      const physical = this.physicsDriver.translate(pos, deltaTime);
      physicalOutputs[pos.fixtureId] = {
        pan: physical.panDMX,
        tilt: physical.tiltDMX,
        panFine: physical.panFine,
        tiltFine: physical.tiltFine,
      };
    });
    
    return physicalOutputs;
  }

  /**
   * 🎭 Cambiar patrón de movimiento manualmente
   * @param {string} patternName - 'circle' | 'infinity' | 'sweep' | 'cloud' | 'waves' | 'static'
   */
  setMovementPattern(patternName) {
    if (this.movementEngine) {
      this.movementEngine.setPattern(patternName, 500);
    }
    return this;
  }

  /**
   * 🎭 Disparar evento especial de movimiento
   * @param {string} eventType - 'drop' | 'break' | 'rest'
   * @param {Object} params - Parámetros del evento
   */
  triggerMovementEvent(eventType, params = {}) {
    if (this.movementEngine) {
      this.movementEngine.triggerEvent(eventType, params);
    }
    return this;
  }

  /**
   * 🎭 Obtener info de debug del movimiento
   */
  getMovementDebugInfo() {
    if (!this.movementEngine || !this.physicsDriver) {
      return { enabled: false };
    }
    
    return {
      enabled: this.movementEnabled,
      pattern: this.movementEngine.getCurrentPatternInfo(),
      physics: this.physicsDriver.getDebugInfo(),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // �🌑 V13: SISTEMA DE BLACKOUTS Y SILENCIOS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * 🌑 Actualiza el estado del sistema de silencios
   * Detecta silencios reales vs ruido constante (shakers)
   * 
   * @param {number} bass - Nivel de graves 0-1
   * @param {number} mid - Nivel de medios 0-1
   * @param {number} treble - Nivel de agudos 0-1
   * @returns {Object} - { modo, intensidadMultiplier, esPico }
   */
  updateSilenceState(bass, mid, treble) {
    const ss = this.silenceSystem;
    const now = Date.now();
    const deltaTime = now - ss.lastUpdateTime;
    ss.lastUpdateTime = now;
    
    // Calcular nivel total de energía
    const nivelTotal = (bass + mid + treble) / 3;
    
    // === HISTORIAL PARA DETECTAR PICOS VS RUIDO CONSTANTE ===
    ss.historialNivel.push(nivelTotal);
    if (ss.historialNivel.length > ss.VENTANA_HISTORIAL) {
      ss.historialNivel.shift();
    }
    
    // Calcular promedio y detectar si hay pico
    const promedio = ss.historialNivel.reduce((a, b) => a + b, 0) / ss.historialNivel.length;
    const diferencia = nivelTotal - promedio;
    const esPico = diferencia > ss.UMBRAL_PICO;
    const esRuidoConstante = Math.abs(diferencia) < 0.05 && nivelTotal < ss.UMBRAL_BAJO;
    
    // === 🎯 V13.1: DETECCIÓN DE CORTE BRUSCO DE DJ ===
    const cambioEnergia = ss.ultimaEnergiaTotal - nivelTotal;
    const esCortesBrusco = cambioEnergia > ss.UMBRAL_CORTE_BRUSCO && nivelTotal < ss.UMBRAL_BAJO;
    ss.ultimaEnergiaTotal = nivelTotal; // Guardar para siguiente frame
    
    // Si es corte brusco de DJ → BLACKOUT CASI INSTANTÁNEO
    if (esCortesBrusco) {
      ss.tiempoEnSilencio = ss.TIEMPO_BLACKOUT; // Forzar blackout inmediato
      ss.modo = 'BLACKOUT';
      ss.intensidadMultiplier = 0;
      console.log('🎧 CORTE DJ detectado! Blackout instantáneo');
      return { modo: 'BLACKOUT', intensidadMultiplier: 0, esPico: false, corteDJ: true };
    }
    
    // === LÓGICA DE DETECCIÓN DE SILENCIOS ===
    
    // 1. SILENCIO REAL (<5% energía)
    if (nivelTotal < ss.UMBRAL_SILENCIO) {
      ss.tiempoEnSilencio += deltaTime;
      ss.tiempoEnBajo = 0; // Reset
      
      if (ss.tiempoEnSilencio >= ss.TIEMPO_BLACKOUT) {
        // ¡BLACKOUT TOTAL!
        ss.modo = 'BLACKOUT';
        ss.intensidadMultiplier = 0;
        return { modo: 'BLACKOUT', intensidadMultiplier: 0, esPico: false };
      } else {
        // Fade hacia blackout - RÁPIDO
        const progreso = ss.tiempoEnSilencio / ss.TIEMPO_BLACKOUT;
        ss.modo = 'FADE_TO_BLACK';
        // V13.1: Fade más agresivo (cuadrático en vez de lineal)
        ss.intensidadMultiplier = Math.pow(1 - progreso, 2);
        return { modo: 'FADE_TO_BLACK', intensidadMultiplier: ss.intensidadMultiplier, esPico: false };
      }
    }
    
    // 2. NIVEL BAJO (5-20% energía)
    if (nivelTotal < ss.UMBRAL_BAJO) {
      ss.tiempoEnSilencio = 0; // Reset silencio
      ss.tiempoEnBajo += deltaTime;
      
      if (ss.tiempoEnBajo >= ss.TIEMPO_FADE) {
        // Fade sostenido
        ss.modo = 'FADE_DOWN';
        // Multiplicador proporcional al nivel (más bajo = más oscuro)
        ss.intensidadMultiplier = 0.2 + (nivelTotal / ss.UMBRAL_BAJO) * 0.4; // V13.1: más oscuro
        return { modo: 'FADE_DOWN', intensidadMultiplier: ss.intensidadMultiplier, esPico };
      } else {
        // Transición hacia fade - más rápida
        const progreso = ss.tiempoEnBajo / ss.TIEMPO_FADE;
        ss.intensidadMultiplier = 1 - (progreso * 0.5); // V13.1: fade más notable
        return { modo: 'TRANSITIONING', intensidadMultiplier: ss.intensidadMultiplier, esPico };
      }
    }
    
    // 3. NIVEL NORMAL/ALTO (>20%)
    ss.tiempoEnSilencio = 0;
    ss.tiempoEnBajo = 0;
    ss.modo = 'NORMAL';
    ss.intensidadMultiplier = 1.0;
    
    // 🎯 V13.1: Si hay pico, dar boost MÁS FUERTE
    if (esPico && nivelTotal > 0.4) {
      ss.intensidadMultiplier = Math.min(1.5, 1 + diferencia * 1.5); // Boost más agresivo
    }
    
    return { modo: 'NORMAL', intensidadMultiplier: ss.intensidadMultiplier, esPico };
  }

  /**
   * 🎯 Detecta si los móviles deberían responder (filtra shakers)
   * Los móviles responden a PICOS (melodía), no a ruido constante
   * 
   * V13.2: También filtra "retumbar de bass" - cuando bass domina y mid es solo reverb
   */
  shouldMovingHeadsRespond(mid, treble, bass = 0) {
    const ss = this.silenceSystem;
    const melodyEnergy = (mid + treble) / 2;
    
    // Si estamos en blackout o fade, no responder
    if (ss.modo === 'BLACKOUT') return { respond: false, intensity: 0 };
    
    // === 🎯 V13.2: FILTRO DE RETUMBAR DE BASS ===
    // Si bass > 0.6 Y treble < 0.20 → El mid es solo reverb del bass, NO melodía
    // Típico de drops de electrónica: bass=0.85, mid=0.55, treble=0.10
    const bassRatio = bass / Math.max(0.01, bass + mid + treble);
    const trebleMuyBajo = treble < 0.20;
    const bassDominante = bass > 0.6 && bassRatio > 0.45;
    
    if (bassDominante && trebleMuyBajo) {
      // El "mid" es solo la reverb del subgrave, no hay melodía real
      return { respond: false, intensity: 0, reason: 'bass_rumble' };
    }
    
    // Calcular promedio reciente de melodía
    const promedioReciente = ss.historialNivel.length > 0 
      ? ss.historialNivel.slice(-5).reduce((a, b) => a + b, 0) / Math.min(5, ss.historialNivel.length)
      : melodyEnergy;
    
    const diferencia = melodyEnergy - promedioReciente;
    const esPicoMelodia = diferencia > 0.15;
    
    // Si es ruido constante bajo (shakers), no responder
    // V13.2: Subir umbral de 0.25 a 0.35
    if (melodyEnergy < 0.35 && Math.abs(diferencia) < 0.08) {
      return { respond: false, intensity: 0, reason: 'shakers' };
    }
    
    // Si hay pico melódico, responder con fuerza
    if (esPicoMelodia) {
      return { respond: true, intensity: Math.min(1, melodyEnergy * 1.2), reason: 'pico' };
    }
    
    // Respuesta normal basada en energía
    // V13.2: Subir umbral de respuesta de 0.20 a 0.30
    return { 
      respond: melodyEnergy > 0.30, 
      intensity: melodyEnergy * ss.intensidadMultiplier,
      reason: 'normal'
    };
  }

  /**
   * 🎨 Convierte HSL a RGB
   */
  hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
  }

  /**
   * � Interpola linealmente entre dos colores
   */
  _lerpColor(color1, color2, t) {
    return {
      r: Math.round(color1.r + (color2.r - color1.r) * t),
      g: Math.round(color1.g + (color2.g - color1.g) * t),
      b: Math.round(color1.b + (color2.b - color1.b) * t),
    };
  }

  /**
   * �🎵 Detecta la nota musical según las frecuencias
   * Sistema RELATIVO - compara proporciones, no valores absolutos
   */
  detectMusicalNote(bass, mid, treble) {
    // Normalizar valores
    const b = Math.max(0.01, Math.min(1, bass));
    const m = Math.max(0.01, Math.min(1, mid));
    const t = Math.max(0.01, Math.min(1, treble));
    
    // Total para calcular proporciones
    const total = b + m + t;
    const bRatio = b / total;  // 0-1, proporción de bass
    const mRatio = m / total;  // 0-1, proporción de mid
    const tRatio = t / total;  // 0-1, proporción de treble

    // 🔴 DO (Rojo): Bass dominante (>50% del espectro es bass)
    if (bRatio > 0.50 && b > 0.3) return 'DO';
    
    // 🟠 RE (Naranja): Bass + Mid equilibrados, bass ligeramente mayor
    if (bRatio > 0.35 && mRatio > 0.25 && bRatio > tRatio) return 'RE';
    
    // 🟡 MI (Amarillo): Mid dominante puro
    if (mRatio > 0.45 && mRatio > bRatio && mRatio > tRatio) return 'MI';
    
    // 🟢 FA (Verde): Mid + Treble, mid ligeramente mayor
    if (mRatio > 0.30 && tRatio > 0.30 && mRatio >= tRatio) return 'FA';
    
    // 🔵 SOL (Cyan): Treble + Mid, treble ligeramente mayor
    if (tRatio > 0.30 && mRatio > 0.25 && tRatio > mRatio) return 'SOL';
    
    // 💙 LA (Azul): Treble dominante
    if (tRatio > 0.45 && tRatio > mRatio) return 'LA';
    
    // 💜 SI (Violeta): Treble muy dominante (>55%)
    if (tRatio > 0.55) return 'SI';
    
    // Fallback inteligente basado en la frecuencia más fuerte
    if (bRatio >= mRatio && bRatio >= tRatio) return 'DO';
    if (tRatio >= mRatio && tRatio >= bRatio) return 'LA';
    return 'MI';  // Mid es el fallback neutral
  }

  /**
   * 🎨 Calcula el beauty score (0-1) usando PROPORCIONES FIBONACCI
   * 
   * La "belleza" musical se basa en:
   * 1. Ratio Áureo (φ = 1.618) entre frecuencias
   * 2. Variación temporal (no monótono)
   * 3. Consonancia armónica
   * 
   * Igual que en Dentiagest, pero aplicado a audio.
   */
  calculateBeauty(bass, mid, treble, rms) {
    const PHI = 1.618033988749895; // Ratio áureo
    const PHI_INV = 0.618033988749895; // 1/φ
    
    // === 1. FIBONACCI RATIOS ===
    // La belleza está en las proporciones, no en los valores absolutos
    const bassMidRatio = bass / Math.max(0.01, mid);
    const midTrebleRatio = mid / Math.max(0.01, treble);
    
    // ¿Qué tan cerca están los ratios del ratio áureo?
    // Distancia normalizada al PHI o PHI_INV (ambos son "bellos")
    const distToPhi1 = Math.min(
      Math.abs(bassMidRatio - PHI),
      Math.abs(bassMidRatio - PHI_INV),
      Math.abs(bassMidRatio - 1) // 1:1 también es armónico
    );
    const distToPhi2 = Math.min(
      Math.abs(midTrebleRatio - PHI),
      Math.abs(midTrebleRatio - PHI_INV),
      Math.abs(midTrebleRatio - 1)
    );
    
    // Convertir distancia a score (0-1, más cerca = mejor)
    const fibonacciScore = 1 - Math.min(1, (distToPhi1 + distToPhi2) / 2);
    
    // === 2. VARIACIÓN TEMPORAL ===
    // Guardar energía reciente para medir variación
    const currentEnergy = (bass + mid + treble) / 3;
    this._beautyHistory = this._beautyHistory || [];
    this._beautyHistory.push(currentEnergy);
    if (this._beautyHistory.length > 12) this._beautyHistory.shift(); // ~0.5 seg
    
    // Calcular variación (desviación estándar simplificada)
    let variation = 0;
    if (this._beautyHistory.length > 2) {
      const avg = this._beautyHistory.reduce((a, b) => a + b, 0) / this._beautyHistory.length;
      const variance = this._beautyHistory.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / this._beautyHistory.length;
      variation = Math.sqrt(variance);
    }
    // Variación óptima: ni monótono (0) ni caótico (>0.3)
    const variationScore = variation < 0.05 ? variation * 10 : // Muy monótono = bajo score
                          variation > 0.3 ? 0.5 :              // Muy caótico = score medio
                          0.5 + variation;                      // Rango óptimo
    
    // === 3. PRESENCIA ARMÓNICA ===
    // ¿Están todas las frecuencias presentes? (no huecos)
    const minFreq = Math.min(bass, mid, treble);
    const maxFreq = Math.max(bass, mid, treble);
    const presence = minFreq / Math.max(0.1, maxFreq); // 0-1, más cerca de 1 = más completo
    const presenceScore = 0.3 + presence * 0.7; // Nunca menos de 0.3
    
    // === 4. ENERGÍA (RMS) ===
    const energyScore = Math.pow(rms, 0.7); // Curva suave
    
    // === COMBINAR CON PESOS ===
    let beauty = (
      fibonacciScore * 0.35 +    // Proporciones áureas
      variationScore * 0.25 +    // Variación temporal
      presenceScore * 0.20 +     // Presencia armónica
      energyScore * 0.20         // Energía general
    );
    
    // Clamp y mínimo
    beauty = Math.max(0.15, Math.min(1, beauty));
    
    return beauty;
  }

  /**
   * 🎭 Detecta el mood musical actual
   */
  detectMood(bass, mid, treble, beat) {
    const energy = (bass + mid + treble) / 3;
    const previousEnergy = this.personality.energy;
    
    // Actualizar trend de energía
    if (energy > previousEnergy + 0.08) {  // Más sensible
      this.patternMemory.energyTrend = 'rising';
    } else if (energy < previousEnergy - 0.08) {
      this.patternMemory.energyTrend = 'falling';
    } else {
      this.patternMemory.energyTrend = 'stable';
    }
    
    this.personality.energy = energy;

    // 🔥 DROP: Energía muy alta + bass dominante
    if (energy > 0.65 && bass > 0.5 && beat) {  // Más sensible
      return 'drop';
    }
    
    // 📈 BUILD: Energía subiendo + treble creciente
    if (this.patternMemory.energyTrend === 'rising' && treble > 0.4) {
      return 'build';
    }
    
    // ⏸️ BREAK: Silencio o casi silencio
    if (energy < 0.15) {
      return 'silence';
    }
    
    // 🌊 BREAK (breakdown): Energía media-baja, melodía presente
    if (energy < 0.4 && mid > bass && mid > treble) {
      return 'break';
    }
    
    // 😌 CHILL: Todo lo demás
    return 'chill';
  }

  /**
   * 🎨 Modifica el color según el mood
   */
  modifyColorByMood(baseColor, mood, beauty) {
    let { r, g, b } = baseColor;
    
    switch (mood) {
      case 'drop':
        // Más saturado, más brillante
        r = Math.min(255, r * 1.2);
        g = Math.min(255, g * 1.2);
        b = Math.min(255, b * 1.2);
        break;
        
      case 'build':
        // Añade blanco progresivamente
        const whiteMix = beauty * 0.3;
        r = Math.min(255, r + 255 * whiteMix);
        g = Math.min(255, g + 255 * whiteMix);
        b = Math.min(255, b + 255 * whiteMix);
        break;
        
      case 'break':
        // Más oscuro, más púrpura
        r = r * 0.6;
        g = g * 0.4;
        b = Math.min(255, b * 1.3);
        break;
        
      case 'silence':
        // Casi negro con tinte azul
        r = r * 0.1;
        g = g * 0.1;
        b = Math.max(30, b * 0.3);
        break;
        
      case 'chill':
      default:
        // Sin modificación
        break;
    }
    
    return {
      r: Math.round(Math.max(0, Math.min(255, r))),
      g: Math.round(Math.max(0, Math.min(255, g))),
      b: Math.round(Math.max(0, Math.min(255, b))),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 🔀 V15: MOTOR DE ENTROPÍA DETERMINISTA
  // ═══════════════════════════════════════════════════════════════════════════
  // Selene NO usa Math.random(). Selene REACCIONA al estado del sistema.
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 🔀 V15: Genera valor pseudo-caótico (0-1) basado en el estado actual.
   * 
   * DETERMINISTA: Mismo tiempo + mismo audio = mismo "caos".
   * Inspirado en fibonacci-pattern-engine.ts del core de Selene.
   * 
   * @param {number} seedOffset - Offset para generar diferentes valores en la misma llamada
   * @returns {number} - Valor 0-1 determinista basado en estado del sistema
   */
  getSystemEntropy(seedOffset = 0) {
    const time = Date.now();
    
    // Usar los decimales del audio como semilla de ruido
    const audioNoise = (this.personality.energy * 1000) % 1;
    
    // Combinar tiempo + audio + offset para entropía determinista
    // Fórmula inspirada en deterministicNoise() de shared/deterministic-utils.ts
    const combinedSeed = time * 0.001 + audioNoise * 100 + seedOffset * 7.3;
    
    // Función de hash determinista (sin Math.random)
    const entropy = (Math.sin(combinedSeed) + Math.cos(combinedSeed * 0.7) + 2) / 4;
    
    // Actualizar estado de entropía
    this.entropyState.timeSeed = (time % 100000) / 100000;
    this.entropyState.audioSeed = audioNoise;
    
    return Math.max(0, Math.min(1, entropy)); // Clamp 0-1
  }

  /**
   * 🔀 V15: Genera valor determinista con semilla específica
   * 
   * Útil para selecciones que deben ser consistentes dentro del mismo frame.
   * Inspirado en seededRandom() de MusicalConsensusRecorder.ts
   * 
   * @param {number} seed - Semilla numérica
   * @returns {number} - Valor 0-1 determinista
   */
  seededDeterministic(seed) {
    // Linear Congruential Generator (LCG) - igual que deterministic-utils.ts
    const a = 1664525;
    const c = 1013904223;
    const m = 4294967296; // 2^32
    
    const state = (a * Math.abs(seed) + c) % m;
    return state / m;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 🎨 SELENE V15 - LIVING PALETTES - MOTOR DE COLOR PROCEDURAL
  // ═══════════════════════════════════════════════════════════════════════════
  // En lugar de arrays estáticos de RGB, generamos colores matemáticamente.
  // El color "respira" con el tiempo (timeDrift) y reacciona a la música.
  // 
  // V15 CAMBIOS:
  // - Añadido parámetro 'side' para lateralidad (rompe simetría)
  // - Eliminado Math.random() → getSystemEntropy()
  // - Hysteresis para transiciones suaves (selva rosa)
  // - Offset cromático para profundidad 3D
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 🎨 V15: MOTOR LIVING PALETTES CON LATERALIDAD
   * 
   * Genera colores proceduralmente usando HSL.
   * El color evoluciona con el tiempo (no es estático) y reacciona a la música.
   * 
   * @param {string} paletteName - Nombre de la paleta (fuego, hielo, selva, neon)
   * @param {number} intensity - Intensidad normalizada 0-1
   * @param {string} zoneType - 'wash' (pars) o 'spot' (moving heads)
   * @param {string} side - 'left' | 'right' | 'front' | 'back' (V15: lateralidad)
   * @returns {Object} - { r, g, b } (0-255)
   */
  getLivingColor(paletteName, intensity, zoneType = 'wash', side = 'left') {
    // 🎨 V15.2: FIXED NEON (Cumbia Safe) & FREED FUEGO
    const creativityBoost = 0.5 + (this.personality.creativity * 0.5); 
    const driftSpeed = 15000 / creativityBoost; 
    const timeDrift = (Date.now() / driftSpeed) % 1; 
    
    // Resolver redirects
    let palette = this.PALETTES[paletteName];
    if (palette && palette.redirect) {
      paletteName = palette.redirect;
    }
    if (!palette) paletteName = 'fuego';
    
    // 🔀 Semilla determinista
    const frameSeed = Date.now() + intensity * 1000 + (side === 'right' ? 500 : 0);
    const entropy = this.getSystemEntropy(frameSeed);
    
    let h = 0, s = 100, l = 50;

    switch (paletteName) {
      // ═══════════════════════════════════════════════════════════════════════
      // 🔥 FUEGO V15.2: Más rango de respiración, Left liberado
      // ═══════════════════════════════════════════════════════════════════════
      case 'fuego': {
        // 1. PARS (Wash): Más "respiración". 
        // Oscila entre Carmesí (340/-20) y Naranja (30)
        // Antes era muy estático (5-25)
        const baseDrift = Math.sin(timeDrift * Math.PI * 2) * 25; // +/- 25 grados
        let baseHue = 5 + baseDrift + (intensity * 20); 
        
        // 2. MOVING LEFT: Acento Dorado/Magenta (liberado del rojo)
        if (zoneType === 'spot' && side === 'left') {
          // Si hay intensidad, vete al Oro (50) o al Magenta Oscuro (330)
          if (intensity > 0.6) {
            // Usar entropy para decidir dirección
            baseHue = entropy > 0.5 ? 50 : 330; 
          }
        }

        h = baseHue;
        
        // Clamp suave para mantener la esencia roja
        // Si se pasa de 55 (amarillo feo) y no es magenta (300+), forzar a 20
        const normH = ((h % 360) + 360) % 360;
        if (normH > 55 && normH < 280) h = 20;

        s = 90 + (intensity * 10); 
        l = 25 + (intensity * 40); // Más rango de luz

        // MOVING RIGHT (Espejo): Violeta en picos (se mantiene, funciona bien)
        if (zoneType === 'spot' && side === 'right' && intensity > 0.7) {
          h = 280; s = 85; l = 50;
        }
        break;
      }
      
      // ═══════════════════════════════════════════════════════════════════════
      // ❄️ HIELO V15: Sin cambios (funciona bien)
      // ═══════════════════════════════════════════════════════════════════════
      case 'hielo': {
        const minIntensity = this.PALETTES.hielo?.minIntensity || 0.25;
        intensity = Math.max(intensity, minIntensity);
        h = 200 + (timeDrift * 20) + (intensity * 10);
        s = 90 - (intensity * 20); 
        l = 40 + (intensity * 45);
        
        // Rosa chicle en Moving Right
        if (zoneType === 'spot' && side === 'right' && intensity > 0.5) {
          h = 330; s = 80; l = 55 + (intensity * 15);
        }
        
        // Aurora determinista
        if (zoneType === 'wash' && intensity > 0.6 && entropy > 0.7) {
          h = 170 + (entropy * 20); s = 70;
        }
        break;
      }
      
      // ═══════════════════════════════════════════════════════════════════════
      // 🌿 SELVA V15.1: Sol Dorado + Hysteresis Rosa
      // ═══════════════════════════════════════════════════════════════════════
      case 'selva': {
        // Curva agresiva hacia ORO SOLAR
        h = 140 - (intensity * 95) + (timeDrift * 10);
        
        // Boost de luminosidad para godrays
        if (h < 60) {
          l = 45 + (intensity * 30); 
        } else {
          l = 30 + (intensity * 25);
        }
        s = 80 + (intensity * 20);
        
        // Hysteresis Rosa (anti-parpadeo)
        if (zoneType === 'spot' && intensity > 0.75) {
          h = 320 + (entropy * 30); s = 90; l = 50;
        }
        break;
      }
      
      // ═══════════════════════════════════════════════════════════════════════
      // ⚡ NEÓN V15.2: ESTABILIZADO (Cumbia Safe) - Adiós epilepsia
      // ═══════════════════════════════════════════════════════════════════════
      case 'neon': {
        if (intensity < 0.3) return { r: 0, g: 0, b: 0 };
        
        // 🎯 V15.2 FIX: Usar TIEMPO para elegir el par, NO entropía instantánea
        // Cambia de par cada ~10 segundos (estable con cumbia)
        const cycle = Math.floor(Date.now() / 10000) % 4;
        
        // Pares definidos (ADIÓS NARANJA - más Blade Runner)
        const colorPairs = [
          { primary: 120, secondary: 280 },  // Verde Ácido ↔ Violeta
          { primary: 310, secondary: 180 },  // Magenta ↔ Cyan
          { primary: 270, secondary: 110 },  // Violeta ↔ Verde Tóxico
          { primary: 220, secondary: 250 },  // Azul Eléctrico ↔ Azul Puro (Hielo Negro)
        ];
        
        const pair = colorPairs[cycle];
        
        // Usar entropía solo para decidir primario/secundario
        // (Parpadeo reactivo, pero dentro de los mismos 2 colores)
        const isSecondary = (side === 'right' || zoneType === 'spot') 
          ? entropy > 0.3 
          : entropy > 0.7;
        
        h = isSecondary ? pair.secondary : pair.primary;
        s = 100;
        l = 50 + (intensity * 15);
        
        // Strobe blanco en picos extremos
        if (intensity > 0.95) l = 100;
        break;
      }
      
      default: 
        h = 20; s = 90; l = 50;
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🎯 V15: OFFSETS GLOBALES (Profundidad 3D)
    // ═══════════════════════════════════════════════════════════════════════
    if (side === 'back') {
      h = (h - 15 + 360) % 360;
    }
    
    // Normalizar HSL
    h = ((h % 360) + 360) % 360;
    s = Math.max(0, Math.min(100, s));
    l = Math.max(0, Math.min(100, l));
    
    return this.hslToRgb(h / 360, s / 100, l / 100);
  }

  /**
   * 🎨 SELENE DECIDE: Devuelve la paleta activa (MANUAL)
   */
  detectPalette(bass, mid, treble, mood, beat, bpm = 0, bpmConfidence = 0) {
    return {
      palette: this.activePalette,
      confidence: 1.0,
      manual: true,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 🔧 MÉTODOS LEGACY (compatibilidad temporal)
  // Estos métodos llaman al nuevo getLivingColor() para compatibilidad
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * @deprecated Use getLivingColor() instead
   */
  getPaletteColors(zone, intensity) {
    const normalizedIntensity = intensity / 255;
    const zoneType = (zone === 'front' || zone === 'back') ? 'wash' : 'spot';
    const side = zone; // Usar zone como side para lateralidad
    return this.getLivingColor(this.activePalette, normalizedIntensity, zoneType, side);
  }

  /**
   * @deprecated Use getLivingColor() instead - wraps getLivingColor for compatibility
   */
  getGradientColor(zone, intensity, bass, mid, treble, isPeak = false) {
    const normalizedIntensity = intensity / 255;
    const zoneType = (zone === 'front' || zone === 'back') ? 'wash' : 'spot';
    const adjustedIntensity = isPeak ? Math.min(1, normalizedIntensity * 1.2) : normalizedIntensity;
    const side = zone;
    return this.getLivingColor(this.activePalette, adjustedIntensity, zoneType, side);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 🔧 MÉTODOS LEGACY (compatibilidad temporal)
  // Estos métodos llaman al nuevo getLivingColor() para compatibilidad
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * @deprecated Use getLivingColor() instead
   */
  getPaletteColors(zone, intensity) {
    const normalizedIntensity = intensity / 255;
    const zoneType = (zone === 'front' || zone === 'back') ? 'wash' : 'spot';
    return this.getLivingColor(this.activePalette, normalizedIntensity, zoneType);
  }

  /**
   * @deprecated Use getLivingColor() instead - wraps getLivingColor for compatibility
   */
  getGradientColor(zone, intensity, bass, mid, treble, isPeak = false) {
    const normalizedIntensity = intensity / 255;
    const zoneType = (zone === 'front' || zone === 'back') ? 'wash' : 'spot';
    // isPeak aumenta ligeramente la intensidad para acentos
    const adjustedIntensity = isPeak ? Math.min(1, normalizedIntensity * 1.2) : normalizedIntensity;
    return this.getLivingColor(this.activePalette, adjustedIntensity, zoneType);
  }

  /**
   * 🎨 Cambia la paleta manualmente
   */
  setPalette(paletteName) {
    if (this.PALETTES[paletteName]) {
      const oldPalette = this.activePalette;
      this.activePalette = paletteName;
      
      // Resolver redirect si existe
      let palette = this.PALETTES[paletteName];
      if (palette.redirect) {
        this.activePalette = palette.redirect;
        palette = this.PALETTES[palette.redirect];
      }
      
      console.log(`🎨 Paleta cambiada: ${oldPalette} → ${this.activePalette} (${palette.icon || '🎨'} ${palette.name})`);
      return { success: true, palette: this.activePalette, name: palette.name, icon: palette.icon };
    }
    return { success: false, error: 'Paleta no encontrada' };
  }

  /**
   * 🎨 Obtiene info de la paleta activa
   */
  getActivePaletteInfo() {
    let palette = this.PALETTES[this.activePalette];
    if (palette && palette.redirect) {
      palette = this.PALETTES[palette.redirect];
    }
    return {
      id: this.activePalette,
      name: palette?.name || 'Desconocida',
      icon: palette?.icon || '🎨',
    };
  }

  /**
   * 💡 Calcula intensidad del dimmer
   */
  calculateIntensity(beauty, beat, mood) {
    let intensity = beauty;
    
    // Flash en beat
    if (beat) {
      intensity = Math.min(1, intensity + 0.3);
    }
    
    // Ajustes por mood
    switch (mood) {
      case 'drop':
        intensity = Math.min(1, intensity * 1.3);
        break;
      case 'build':
        intensity = Math.min(1, intensity * 1.1);
        break;
      case 'break':
        intensity = intensity * 0.7;
        break;
      case 'silence':
        intensity = intensity * 0.2;
        break;
    }
    
    // Nunca completamente apagado
    return Math.max(0.05, Math.min(1, intensity));
  }

  /**
   * ✨ Sugiere efecto visual
   */
  suggestEffect(mood, beat, beauty) {
    if (mood === 'drop' && beat) {
      return { type: 'strobe', speed: 'fast', sync: 'beat' };
    }
    
    if (mood === 'build') {
      return { type: 'chase', direction: 'outward', speed: 'medium' };
    }
    
    if (mood === 'break') {
      return { type: 'breathe', speed: 'slow', color: 'purple' };
    }
    
    if (beauty > 0.8) {
      return { type: 'rainbow', speed: 'medium', sync: 'beat' };
    }
    
    return { type: 'static', sync: 'audio' };
  }

  /**
   * 📝 Genera un "poema" decorativo
   */
  generatePoem(note, mood, beauty) {
    const poems = {
      drop: [
        "💥 ¡BOOM! La tierra tiembla",
        "🔥 Fuego en la pista",
        "⚡ La energía explota",
      ],
      build: [
        "📈 Subiendo al cielo...",
        "✨ El momento se acerca",
        "🌊 La ola crece",
      ],
      break: [
        "🌙 Respira...",
        "💜 Melodía suave",
        "🎹 Piano en la noche",
      ],
      silence: [
        "🤫 Silencio...",
        "⏸️ Pausa dramática",
        "🌑 La calma antes...",
      ],
      chill: [
        "😎 Groove suave",
        "🎵 Flow constante",
        "💫 Vibes perfectas",
      ],
    };
    
    const options = poems[mood] || poems.chill;
    return options[Math.floor(Math.random() * options.length)];
  }

  /**
   * 🧠 Actualiza la memoria de patrones
   */
  updateMemory(note, beauty, mood) {
    // Añadir a historial
    this.patternMemory.recentNotes.push(note);
    this.patternMemory.recentBeauty.push(beauty);
    
    // Mantener tamaño de buffer
    if (this.patternMemory.recentNotes.length > 16) {
      this.patternMemory.recentNotes.shift();
      this.patternMemory.recentBeauty.shift();
    }
    
    // Calcular nota dominante
    const noteCounts = {};
    this.patternMemory.recentNotes.forEach(n => {
      noteCounts[n] = (noteCounts[n] || 0) + 1;
    });
    this.patternMemory.dominantNote = Object.entries(noteCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'MI';
    
    // Actualizar mood
    if (this.patternMemory.musicalMood !== mood) {
      this.patternMemory.musicalMood = mood;
      this.sessionStats.moodChanges++;
    }
    
    // Estadísticas
    this.sessionStats.framesProcessed++;
    this.sessionStats.notesPlayed.set(
      note, 
      (this.sessionStats.notesPlayed.get(note) || 0) + 1
    );
    this.sessionStats.peakBeauty = Math.max(this.sessionStats.peakBeauty, beauty);
    
    // Running average
    const total = Array.from(this.sessionStats.notesPlayed.values())
      .reduce((a, b) => a + b, 0);
    const beautySum = this.patternMemory.recentBeauty.reduce((a, b) => a + b, 0);
    this.sessionStats.averageBeauty = beautySum / this.patternMemory.recentBeauty.length;
  }

  /**
   * 📊 Obtiene estadísticas de la sesión
   */
  getStats() {
    return {
      ...this.sessionStats,
      notesPlayed: Object.fromEntries(this.sessionStats.notesPlayed),
      currentMood: this.patternMemory.musicalMood,
      dominantNote: this.patternMemory.dominantNote,
      energyTrend: this.patternMemory.energyTrend,
      personality: { ...this.personality },
    };
  }

  /**
   * 🔄 Reset para nueva sesión
   */
  reset() {
    this.patternMemory = {
      recentNotes: [],
      recentBeauty: [],
      dominantNote: 'MI',
      energyTrend: 'stable',
      beatConfidence: 0.5,
      musicalMood: 'chill',
    };
    
    this.sessionStats = {
      framesProcessed: 0,
      notesPlayed: new Map(),
      peakBeauty: 0,
      averageBeauty: 0,
      moodChanges: 0,
    };
    
    console.log('🔄 Selene reset - Nueva sesión iniciada');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ZONE INTELLIGENCE - Selene asigna colores por zona
// ═══════════════════════════════════════════════════════════════════════════

class SeleneZoneController {
  constructor(selene) {
    this.selene = selene;
    
    // Mapeo de zonas → tipo de respuesta
    this.zoneMapping = {
      'FRONT_PARS': { primary: 'bass', behavior: 'pulse' },
      'BACK_PARS':  { primary: 'bass', behavior: 'pulse', delay: 50 },
      'MOVING_LEFT': { primary: 'mid', behavior: 'sweep' },
      'MOVING_RIGHT': { primary: 'mid', behavior: 'mirror' },
    };
  }

  /**
   * 🎯 Procesa todas las zonas y devuelve colores específicos
   */
  processZones(audioMetrics, zones) {
    const mainDecision = this.selene.process(audioMetrics);
    const zoneColors = {};
    
    for (const [zoneName, zoneConfig] of Object.entries(zones)) {
      const mapping = this.zoneMapping[zoneName] || { primary: 'mid', behavior: 'static' };
      
      // Color específico por zona según su frecuencia asignada
      const zoneColor = this.getZoneColor(
        audioMetrics, 
        mapping.primary, 
        mainDecision
      );
      
      zoneColors[zoneName] = {
        color: zoneColor,
        intensity: this.getZoneIntensity(audioMetrics, mapping.primary, mainDecision),
        behavior: mapping.behavior,
        delay: mapping.delay || 0,
      };
    }
    
    return {
      mainDecision,
      zoneColors,
    };
  }

  /**
   * 🎨 Obtiene color específico para una zona
   */
  getZoneColor(audio, freqType, mainDecision) {
    const { bass, mid, treble } = audio;
    
    let note;
    switch (freqType) {
      case 'bass':
        note = bass > 0.6 ? 'DO' : bass > 0.4 ? 'RE' : 'MI';
        break;
      case 'mid':
        note = mid > 0.6 ? 'FA' : mid > 0.4 ? 'MI' : 'SOL';
        break;
      case 'treble':
        note = treble > 0.6 ? 'SI' : treble > 0.4 ? 'LA' : 'SOL';
        break;
      default:
        note = mainDecision.note;
    }
    
    return this.selene.NOTE_COLORS[note];
  }

  /**
   * 💡 Intensidad específica por zona
   */
  getZoneIntensity(audio, freqType, mainDecision) {
    const value = audio[freqType] || 0.5;
    
    // Base del beauty principal
    let intensity = mainDecision.beauty * 0.5;
    
    // Añadir contribución de la frecuencia específica
    intensity += value * 0.5;
    
    return Math.max(0.1, Math.min(1, intensity));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTAR PARA USO EN EL DEMO
// ═══════════════════════════════════════════════════════════════════════════

// Crear instancia global de Selene
window.SeleneConsciousnessLite = SeleneConsciousnessLite;
window.SeleneZoneController = SeleneZoneController;

// Auto-instanciar si no existe
if (!window.selene) {
  window.selene = new SeleneConsciousnessLite();
  window.seleneZones = new SeleneZoneController(window.selene);
  
  // 🎭 V16: Inicializar motor de movimiento
  // (Solo si las clases de movimiento están disponibles)
  if (typeof SeleneMovementEngine !== 'undefined' && typeof FixturePhysicsDriver !== 'undefined') {
    window.selene.initMovement();
    console.log('�✨ Selene V16 con Motor de Movimiento! ✨🎭');
  } else {
    console.log('�🌙✨ Selene lista para la fiesta! (Sin motor de movimiento) ✨🌙');
  }
}
