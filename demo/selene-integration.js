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

    // 🎨 SELENE PALETTES - Paletas de color MANUALES
    // El usuario elige la paleta según el mood de la fiesta
    this.PALETTES = {
      // 🔥 FUEGO: Latino, Reggaeton, Salsa - Colores CÁLIDOS
      fuego: {
        name: 'Fuego',
        icon: '🔥',
        front:  { base: { r: 255, g: 0, b: 0 },    accent: { r: 255, g: 80, b: 0 } },    // Rojo → Naranja
        back:   { base: { r: 255, g: 150, b: 0 },  accent: { r: 255, g: 220, b: 0 } },   // Naranja → Amarillo
        left:   { base: { r: 255, g: 50, b: 0 },   accent: { r: 255, g: 120, b: 0 } },   // Rojo-naranja
        right:  { base: { r: 255, g: 0, b: 50 },   accent: { r: 255, g: 0, b: 120 } },   // Rojo-rosa
      },
      // ❄️ HIELO: Chill, Ambient, Downtempo - Colores FRÍOS
      hielo: {
        name: 'Hielo',
        icon: '❄️',
        front:  { base: { r: 0, g: 150, b: 255 },  accent: { r: 100, g: 200, b: 255 } }, // Azul cielo
        back:   { base: { r: 0, g: 255, b: 255 },  accent: { r: 150, g: 255, b: 255 } }, // Cyan
        left:   { base: { r: 50, g: 100, b: 200 }, accent: { r: 100, g: 150, b: 255 } }, // Azul profundo
        right:  { base: { r: 200, g: 220, b: 255 },accent: { r: 255, g: 255, b: 255 } }, // Blanco azulado
      },
      // 🌿 SELVA: Tropical House, Reggae, Summer - Colores NATURALES
      selva: {
        name: 'Selva',
        icon: '🌿',
        front:  { base: { r: 0, g: 200, b: 100 },  accent: { r: 50, g: 255, b: 100 } },  // Verde lima
        back:   { base: { r: 0, g: 150, b: 100 },  accent: { r: 0, g: 200, b: 150 } },   // Verde bosque
        left:   { base: { r: 0, g: 255, b: 180 },  accent: { r: 100, g: 255, b: 200 } }, // Turquesa
        right:  { base: { r: 180, g: 255, b: 0 },  accent: { r: 220, g: 255, b: 50 } },  // Lima brillante
      },
      // ⚡ NEÓN: Techno, Cyberpunk, EDM - Colores ELÉCTRICOS
      neon: {
        name: 'Neón',
        icon: '⚡',
        front:  { base: { r: 255, g: 0, b: 150 },  accent: { r: 255, g: 50, b: 200 } },  // Magenta
        back:   { base: { r: 0, g: 255, b: 255 },  accent: { r: 100, g: 255, b: 255 } }, // Cyan neón
        left:   { base: { r: 150, g: 0, b: 255 },  accent: { r: 200, g: 50, b: 255 } },  // Violeta
        right:  { base: { r: 255, g: 255, b: 0 },  accent: { r: 255, g: 255, b: 100 } }, // Amarillo neón
      },
      // Legacy mappings (para compatibilidad)
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

    console.log('🌙 Selene V12 inicializada - Paletas Manuales (🔥❄️🌿⚡)');
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
    };
  }

  /**
   * 🎨 COLORES POR ZONA - Teoría de Iluminación por Frecuencias
   * 
   * AHORA USA PALETAS DINÁMICAS (Selene decide!)
   * 
   * FRONT PARs = KICK/Bass directo → Color de paleta.front
   * BACK PARs = Snare/Claps + Reverb → Color de paleta.back
   * Moving Heads = Melodía/Pads/Voces → paleta.left y paleta.right
   * 
   * SENSIBILIDAD AJUSTADA:
   * - Umbral alto para evitar ruido (voces público, ambiente)
   * - Respeta upswings/downswings de DJ
   * - Oscuridad real en silencios para buildups dramáticos
   */
  calculateZoneColors(bass, mid, treble, beat, mood) {
    // === UMBRALES DE SENSIBILIDAD ===
    const BASS_THRESHOLD = 0.25;
    const SNARE_THRESHOLD = 0.20;
    const MELODY_THRESHOLD = 0.15;
    const SILENCE_THRESHOLD = 0.12;
    
    const totalEnergy = bass + mid + treble;
    const isSilence = totalEnergy < SILENCE_THRESHOLD;
    const isQuiet = totalEnergy < 0.25;
    
    // 🎨 OBTENER PALETA ACTIVA
    const palette = this.PALETTES[this.activePalette];
    
    // === ZONA FRONT PARS: KICK/BASS ===
    let frontColor, frontIntensity;
    
    if (bass < BASS_THRESHOLD) {
      frontColor = { r: 0, g: 0, b: 0 };
      frontIntensity = 0;
    } else if (bass > 0.7) {
      // KICK MUY fuerte: Color accent de la paleta
      frontColor = { ...palette.front.accent };
      frontIntensity = Math.round(200 + (bass - 0.7) * 183);
    } else if (bass > 0.5) {
      // KICK fuerte: Mezcla base-accent
      const t = (bass - 0.5) / 0.2;
      frontColor = this._lerpColor(palette.front.base, palette.front.accent, t);
      frontIntensity = Math.round(120 + (bass - 0.5) * 400);
    } else {
      // KICK suave: Color base tenue
      const fadeIn = (bass - BASS_THRESHOLD) / (0.5 - BASS_THRESHOLD);
      frontColor = { ...palette.front.base };
      frontIntensity = Math.round(fadeIn * 120);
    }
    
    // === ZONA BACK PARS: SNARE/CLAPS (MID-HIGH) ===
    // Usa colores de paleta.back
    let backColor, backIntensity;
    const snareEnergy = (mid * 0.4 + treble * 0.6);
    
    if (snareEnergy < SNARE_THRESHOLD) {
      backColor = { r: 0, g: 0, b: 0 };
      backIntensity = 0;
    } else if (snareEnergy > 0.6) {
      // Snare fuerte: Color accent
      backColor = { ...palette.back.accent };
      backIntensity = Math.round(200 + (snareEnergy - 0.6) * 137);
    } else if (snareEnergy > 0.4) {
      // Medio-alto: Mezcla
      const t = (snareEnergy - 0.4) / 0.2;
      backColor = this._lerpColor(palette.back.base, palette.back.accent, t);
      backIntensity = Math.round(130 + (snareEnergy - 0.4) * 350);
    } else {
      // Bajo: Base tenue
      const fadeIn = (snareEnergy - SNARE_THRESHOLD) / (0.4 - SNARE_THRESHOLD);
      backColor = { ...palette.back.base };
      backIntensity = Math.round(fadeIn * 130);
    }
    
    // === ZONA MOVING HEADS: MELODÍA ===
    // LEFT = Colores de paleta.left (fríos)
    // RIGHT = Colores de paleta.right (cálidos)
    
    const melodyEnergy = mid + treble;
    const isMelodySilence = melodyEnergy < MELODY_THRESHOLD;
    
    // Calcular ratio para determinar intensidad del interpolar
    const midRatio = mid / Math.max(0.01, melodyEnergy);
    const trebleRatio = treble / Math.max(0.01, melodyEnergy);
    
    let leftColor, rightColor, movingIntensity;
    
    if (isMelodySilence) {
      leftColor = { r: 0, g: 0, b: 0 };
      rightColor = { r: 0, g: 0, b: 0 };
      movingIntensity = 0;
    } else {
      // Interpolación basada en energía melódica
      const t = Math.min(1, melodyEnergy / 1.5); // 0-1 normalizado
      
      // LEFT: Colores fríos de la paleta
      leftColor = this._lerpColor(palette.left.base, palette.left.accent, t);
      
      // RIGHT: Colores cálidos de la paleta
      rightColor = this._lerpColor(palette.right.base, palette.right.accent, t);
      
      // Intensidad basada en energía
      movingIntensity = Math.round(60 + melodyEnergy * 195);
    }
    
    // === APLICAR SATURACIÓN EXTRA SEGÚN RATIO ===
    // Más MID = más saturado LEFT, Más TREBLE = más saturado RIGHT
    if (!isMelodySilence) {
      if (midRatio > 0.55) {
        // Boost LEFT
        leftColor.g = Math.min(255, Math.round(leftColor.g * 1.2));
      } else if (trebleRatio > 0.55) {
        // Boost RIGHT
        rightColor.r = Math.min(255, Math.round(rightColor.r * 1.1));
        rightColor.b = Math.min(255, Math.round(rightColor.b * 1.2));
      }
    }
    
    // === ZONA EFFECTS/STROBO: SOLO EN PEAKS ===
    let effectColor, effectIntensity;
    const isPeak = beat && treble > 0.6 && bass > 0.5;
    
    if (isPeak) {
      effectColor = { r: 255, g: 255, b: 255 };
      effectIntensity = 255;
    } else {
      effectColor = { r: 0, g: 0, b: 0 };
      effectIntensity = 0;
    }
    
    return {
      // FRONT = KICK
      front: {
        color: frontColor,
        intensity: Math.min(255, frontIntensity),
      },
      // BACK = SNARE  
      back: {
        color: backColor,
        intensity: Math.min(255, backIntensity),
      },
      // MOVING LEFT = Colores fríos (melodía)
      movingLeft: {
        color: leftColor,
        intensity: Math.min(255, movingIntensity),
      },
      // MOVING RIGHT = Colores cálidos (melodía)
      movingRight: {
        color: rightColor,
        intensity: Math.min(255, movingIntensity),
      },
      // EFFECTS = PEAKS
      effects: {
        color: effectColor,
        intensity: effectIntensity,
      },
      // Legacy compatibility
      mid: {
        color: leftColor, // Default to left
        intensity: Math.min(255, movingIntensity),
      },
      treble: {
        color: effectColor,
        intensity: effectIntensity,
      },
      bass: {
        color: frontColor,
        intensity: Math.min(255, frontIntensity),
      },
      ambient: {
        color: { r: 30, g: 20, b: 40 },
        intensity: isQuiet ? 30 : 60,
      },
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

  /**
   * 🎨 SELENE DECIDE: Devuelve la paleta activa (MANUAL)
   * 
   * ═══════════════════════════════════════════════════════════════════════
   * V12.0 "Paletas Manuales" - El DJ elige, Selene ejecuta
   * ═══════════════════════════════════════════════════════════════════════
   * 
   * Después de 11 versiones de autodetección fallida, la solución simple:
   * - El usuario elige la paleta con los 4 botones (🔥❄️🌿⚡)
   * - Selene aplica los colores según la intensidad del audio
   * 
   * RIP V1-V11: BPM, Varianza, Sustain, WarmthRatio... ninguno funcionó.
   * A veces la solución más simple es la mejor. 🎯
   * ═══════════════════════════════════════════════════════════════════════
   */
  detectPalette(bass, mid, treble, mood, beat, bpm = 0, bpmConfidence = 0) {
    // V12: Simplemente devolver la paleta manual activa
    // No hay magia, no hay autodetección, solo lo que el usuario eligió
    
    return {
      palette: this.activePalette,
      confidence: 1.0,  // Siempre 100% seguro - el usuario eligió
      manual: true,
    };
  }

  /**
   * 🎨 Obtiene colores de la paleta activa mezclados con intensidad
   */
  getPaletteColors(zone, intensity) {
    let palette = this.PALETTES[this.activePalette];
    
    // Manejar redirects (legacy palettes)
    if (palette && palette.redirect) {
      palette = this.PALETTES[palette.redirect];
    }
    
    if (!palette) {
      palette = this.PALETTES['fuego']; // Fallback
    }
    
    const zoneColors = palette[zone];
    
    if (!zoneColors) return { r: 0, g: 0, b: 0 };
    
    // Interpolar entre base y accent según intensidad
    const t = intensity / 255;
    return {
      r: Math.round(zoneColors.base.r + (zoneColors.accent.r - zoneColors.base.r) * t),
      g: Math.round(zoneColors.base.g + (zoneColors.accent.g - zoneColors.base.g) * t),
      b: Math.round(zoneColors.base.b + (zoneColors.accent.b - zoneColors.base.b) * t),
    };
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
  console.log('🌙✨ Selene lista para la fiesta! ✨🌙');
}
