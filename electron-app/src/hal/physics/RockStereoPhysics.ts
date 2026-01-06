/**
 * 🎸 WAVE 142: ROCK STEREO PHYSICS
 * 🔮 WAVE 273: ELEMENTAL MODIFIERS INJECTION
 * 🔥 WAVE 298: ROCK ZONE PHYSICS - GUITAR POWER
 * 🎯 WAVE 298.5: MID DIRECT - NO DEPENDER DE isSnareHit
 * 👑 WAVE 299: SEPARACIÓN DE RESPONSABILIDADES (POP-ROCK)
 * 🎙️ WAVE 300: DETECCIÓN DE TRANSIENTES (ANTI-VOZ)
 * ============================================================================
 * Módulo blindado para la lógica de reactividad del género Pop/Rock.
 * 
 * RESPONSABILIDAD ÚNICA:
 * - Detectar "hits" de SNARE (Medios) y KICK (Bajos)
 * - Aplicar FLASH TUNGSTENO en caja, GOLPE DE COLOR en bombo
 * - 🆕 WAVE 298: Control de zonas (Movers=Guitarra, Back=Snare, Front=Kick)
 * - 🆕 WAVE 298.5: Back PARs escuchan MID directo con gate alto
 * - 🆕 WAVE 299: Separación clara de responsabilidades:
 *     MOVERS = Melodía/Voz (flotar, NO pulsar)
 *     BACK PARs = SNARE puro (la bofetada)
 *     FRONT PARs = BOMBO puro (el corazón)
 * 
 * ORIGEN DE LA CALIBRACIÓN:
 * - WAVE 135: Portnoy Protocol (primera versión)
 * - WAVE 136: Stadium Separation (paleta de alto contraste)
 * - WAVE 137: Analog Gain (sweet spot thresholds: 0.32/0.35)
 * - WAVE 273: Elemental modulation (Fire=all hits, Water=epic only)
 * - WAVE 298-299: Zone physics + separación de responsabilidades
 * 
 * PRINCIPIO: "EXTRAER, NO MODIFICAR"
 * Todos los valores numéricos base son EXACTAMENTE los de Wave 137.
 * Los elementos ESCALAN estos valores, no los reemplazan.
 * ============================================================================
 */

import type { ElementalModifiers } from '../../engine/physics/ElementalModifiers';

/**
 * Tipo RGB para colores (definido localmente para evitar dependencias circulares)
 */
export interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * Interfaz para la paleta de colores que procesa esta física
 */
export interface RockPalette {
  primary: RGB;
  secondary: RGB;
  ambient: RGB;
  accent: RGB;
}

/**
 * Métricas de audio necesarias para el cálculo de física Rock
 */
export interface RockAudioMetrics {
  normalizedMid: number;    // 0.0 - 1.0 (Snare/Caja)
  normalizedBass: number;   // 0.0 - 1.0 (Kick/Bombo)
  avgNormEnergy: number;    // 0.0 - 1.0 (Energía promedio para piso dinámico)
}

/**
 * Resultado de la aplicación de física Rock
 */
export interface RockPhysicsResult {
  palette: RockPalette;
  isSnareHit: boolean;
  isKickHit: boolean;
  debugInfo: {
    midsPulse: number;
    bassPulse: number;
    avgMid: number;
    avgBass: number;
  };
}

/**
 * WAVE 298: Resultado de zonas para AGC TRUST
 * WAVE 300: Añadido debug de transientes
 * - MOVERS: Guitarra reactiva (MID)
 * - BACK_PARS: Blinders de snare (incandescent decay)
 * - FRONT_PARS: Kick natural
 */
export interface RockZonesResult {
  front: number;  // 0.0-1.0 FRONT PARS (kick-driven)
  back: number;   // 0.0-1.0 BACK PARS (snare blinders)
  mover: number;  // 0.0-1.0 MOVERS (guitar power)
  debug?: {       // WAVE 300: Info de transientes para log
    bassTransient: number;
    midTransient: number;
  };
}

/**
 * RockStereoPhysics - Módulo de Reactividad para Pop/Rock
 * 
 * Esta clase encapsula la lógica de detección de hits de batería
 * calibrada en las Waves 135-137 (Portnoy Protocol → Analog Gain).
 * 
 * WAVE 298: Añade applyZones() para control directo de fixtures.
 */
export class RockStereoPhysics {
  // =========================================================================
  // 🔒 CONFIGURACIÓN INMUTABLE (Extraída de Wave 137 - NO TOCAR)
  // =========================================================================
  
  /**
   * Umbral de disparo para SNARE (Caja).
   * @wave 135: 0.20 (epilepsia)
   * @wave 136: 0.45 (muerto)
   * @wave 137: 0.32 (sweet spot)
   */
  private static readonly SNARE_THRESHOLD = 0.32;
  
  /**
   * Umbral de disparo para KICK (Bombo).
   * @wave 135: 0.25 (epilepsia)
   * @wave 136: 0.40 (muerto)
   * @wave 137: 0.35 (sweet spot)
   */
  private static readonly KICK_THRESHOLD = 0.35;
  
  /**
   * Factor de proxy para estimar promedio de Mids desde energía.
   */
  private static readonly AVG_MID_FACTOR = 0.8;
  
  /**
   * Factor de proxy para estimar promedio de Bass desde energía.
   */
  private static readonly AVG_BASS_FACTOR = 0.9;
  
  /**
   * Configuración de Flash Tungsteno (Snare Hit).
   * Hue 40 = Naranja/Amarillo cálido
   * Sat 20 = Casi blanco (desaturado)
   * Light 95 = Brightness Unchained
   */
  private static readonly TUNGSTEN_FLASH = { h: 40, s: 20, l: 95 };
  
  /**
   * Configuración de Kick Hit.
   * Light 80 = Punch visual elevado
   */
  private static readonly KICK_BRIGHTNESS = 80;
  
  // =========================================================================
  // 🎸 WAVE 299.6: AJUSTE FINO POP-ROCK (Billy Jean calibration)
  // =========================================================================
  // MOVERS = Melodía/Voz (flotar, NO pulsar)
  // BACK PARs = SNARE (flash en el crack)
  // FRONT PARs = BOMBO (corazón que late con pulso RÍGIDO)
  // =========================================================================
  
  /** MOVERS: Gate moderado - filtrar hi-hat y ruido, dejar pasar melodía */
  private static readonly MOVER_GATE = 0.30;
  /** MOVERS: Gain neutro - NO amplificar, solo seguir la melodía */
  private static readonly MOVER_GAIN = 1.0;
  /** MOVERS: Decay MUY lento - flotar con la música, NO marcar ritmo */
  private static readonly MOVER_DECAY = 0.92;
  
  // WAVE 299.6: Back PARs ajustados para Billy Jean (MID ~0.35-0.50)
  /** BACK PARs: Gate moderado - 0.40 captura snare sin captar voces bajas */
  private static readonly BACK_PAR_GATE = 0.40;
  /** BACK PARs: Gain neutro - el snare ya pega fuerte */
  private static readonly BACK_PAR_GAIN = 1.0;
  /** BACK PARs: Decay medio - flash que dura lo justo */
  private static readonly BACK_PAR_DECAY = 0.80;
  
  // WAVE 299.6: Front PARs con histéresis anti-temblor
  /** FRONT PARs: Gate ALTO - solo golpes de bombo reales */
  private static readonly FRONT_PAR_GATE = 0.50;
  /** FRONT PARs: Decay MUY rápido - pulso RÍGIDO, no fluido */
  private static readonly FRONT_PAR_DECAY = 0.65;
  /** FRONT PARs: Histéresis - el bass debe superar esto para re-trigger */
  private static readonly FRONT_PAR_HYSTERESIS = 0.15;
  
  // =========================================================================
  // � WAVE 301: ROCK REFINEMENT (GeminiPunk + PunkOpus Quorum)
  // =========================================================================
  // PROBLEMA: El bajo de MJ/Iron Maiden es CONTINUO (60-70%)
  // El bombo es un "pico sobre una montaña", no desde el suelo
  // 
  // SOLUCIÓN: Gate Relativo + Transiente Pequeño + Validación Espectral
  // 
  // KICK: Si bass > (avgBass * factor) Y transiente > 0.06 → DISPARA
  // SNARE: Si midTransient > X Y treble > 0.20 → DISPARA (anti-voz)
  // =========================================================================
  
  /** WAVE 301: Transiente BASS más permisivo (antes 0.10) */
  private static readonly BASS_TRANSIENT_THRESHOLD = 0.06;
  /** WAVE 301: Gate relativo - bass debe ser X% mayor que el promedio */
  private static readonly BASS_RELATIVE_FLOOR = 0.85;
  
  /** WAVE 301: Transiente MID para snare */
  private static readonly MID_TRANSIENT_THRESHOLD = 0.10;
  /** WAVE 301: El SNARE necesita TREBLE (el crack de la bordonera) */
  private static readonly SNARE_TREBLE_VALIDATION = 0.15;
  
  /** WAVE 300.7: Factor de suavizado más RÁPIDO (0.85) para "olvidar" golpes antes */
  private static readonly SMOOTHING_FACTOR = 0.85;
  
  // =========================================================================
  // 📊 ESTADO INTERNO (WAVE 298 + WAVE 301)
  // =========================================================================
  
  /** Intensidad actual de Movers (con decay) */
  private currentMoverIntensity = 0;
  /** Intensidad actual de Back PARs (con decay) */
  private currentBackParIntensity = 0;
  /** Intensidad actual de Front PARs (con decay) */
  private currentFrontParIntensity = 0;
  
  // WAVE 300: Promedios móviles para detección de transientes
  /** Promedio móvil de BASS (para detectar transientes de kick) */
  private avgBass = 0.3;
  /** Promedio móvil de MID (para detectar transientes de snare) */
  private avgMid = 0.3;
  
  /**
   * Brillo base del accent cuando no hay hit.
   */
  private static readonly DEFAULT_ACCENT_BRIGHTNESS = 50;

  // =========================================================================
  // 🎯 API PÚBLICA
  // =========================================================================

  /**
   * Aplica la física de Rock sobre la paleta actual.
   * 
   * Detecta hits de Snare y Kick, aplicando:
   * - FLASH TUNGSTENO (Snare): Casi blanco cálido
   * - GOLPE DE COLOR (Kick): Primary amplificado
   * 
   * WAVE 273: Inyección Elemental - Los modificadores zodiacales modulan
   * thresholds (sensibilidad) y brightness (intensidad del flash)
   * 
   * @param palette - Paleta actual con primary, secondary, ambient, accent
   * @param audio - Métricas de audio con mid, bass y energía normalizados
   * @param primaryHue - El hue del primary (para golpes de color en kick)
   * @param mods - Modificadores elementales opcionales (Fuego/Tierra/Aire/Agua)
   * @returns Paleta procesada + metadata de debug
   */
  public static apply(
    palette: RockPalette,
    audio: RockAudioMetrics,
    primaryHue: number = 0,
    mods?: ElementalModifiers
  ): RockPhysicsResult {
    // WAVE 273: Multiplicadores elementales (default = 1.0 = sin modificación)
    const thresholdMod = mods?.thresholdMultiplier ?? 1.0;
    const brightnessMod = mods?.brightnessMultiplier ?? 1.0;

    const normalizedMid = audio.normalizedMid ?? 0.0;
    const normalizedBass = audio.normalizedBass ?? 0.0;
    const avgEnergy = audio.avgNormEnergy ?? 0.4;

    // WAVE 299: FLOOR mínimo para promedios - evita false positives en canciones tranquilas
    // Sin floor, avgEnergy=0.1 → avgBass=0.09 → cualquier bass=0.5 dispara kick (MALO)
    // Con floor 0.25, avgBass mínimo = 0.225 → bass necesita >0.57 para kick (MEJOR)
    const AVG_FLOOR = 0.25;
    const clampedAvgEnergy = Math.max(AVG_FLOOR, avgEnergy);
    
    // Calcular promedios proxy con floor
    const avgMid = clampedAvgEnergy * this.AVG_MID_FACTOR;
    const avgBass = clampedAvgEnergy * this.AVG_BASS_FACTOR;

    // Calcular pulsos relativos
    const midsPulse = Math.max(0, normalizedMid - avgMid);
    const bassPulse = Math.max(0, normalizedBass - avgBass);

    // Detectar hits - WAVE 273: thresholds modulados por elemento
    const effectiveSnareThreshold = this.SNARE_THRESHOLD * thresholdMod;
    const effectiveKickThreshold = this.KICK_THRESHOLD * thresholdMod;
    const isSnareHit = midsPulse > effectiveSnareThreshold;
    const isKickHit = bassPulse > effectiveKickThreshold;

    // Procesar accent según detección
    let processedPalette: RockPalette;

    if (isSnareHit) {
      // ⚡ FLASH TUNGSTENO (Wave 137) - WAVE 273: brightness modulado
      const modulatedLightness = Math.min(100, this.TUNGSTEN_FLASH.l * brightnessMod);
      const tungstenRgb = this.hslToRgb(
        this.TUNGSTEN_FLASH.h,
        this.TUNGSTEN_FLASH.s,
        modulatedLightness
      );
      processedPalette = {
        ...palette,
        accent: tungstenRgb
      };
    } else if (isKickHit) {
      // 🔴 GOLPE DE COLOR (Wave 137) - WAVE 273: brightness modulado
      const modulatedKickBrightness = Math.min(100, this.KICK_BRIGHTNESS * brightnessMod);
      const kickRgb = this.hslToRgb(primaryHue, 100, modulatedKickBrightness);
      processedPalette = {
        ...palette,
        accent: kickRgb
      };
    } else {
      // Sin hit - mantener paleta original
      processedPalette = palette;
    }

    return {
      palette: processedPalette,
      isSnareHit,
      isKickHit,
      debugInfo: {
        midsPulse,
        bassPulse,
        avgMid,
        avgBass
      }
    };
  }

  // =========================================================================
  // 🔧 MÉTODOS AUXILIARES
  // =========================================================================

  /**
   * Obtiene los umbrales actuales de configuración.
   */
  public static getThresholds(): {
    snareThreshold: number;
    kickThreshold: number;
  } {
    return {
      snareThreshold: this.SNARE_THRESHOLD,
      kickThreshold: this.KICK_THRESHOLD
    };
  }

  /**
   * Evalúa si un par de valores triggearía hits (sin aplicar).
   */
  public static wouldTrigger(
    mid: number,
    bass: number,
    avgEnergy: number
  ): { snare: boolean; kick: boolean } {
    const avgMid = avgEnergy * this.AVG_MID_FACTOR;
    const avgBass = avgEnergy * this.AVG_BASS_FACTOR;
    const midsPulse = Math.max(0, mid - avgMid);
    const bassPulse = Math.max(0, bass - avgBass);
    
    return {
      snare: midsPulse > this.SNARE_THRESHOLD,
      kick: bassPulse > this.KICK_THRESHOLD
    };
  }

  /**
   * Helper interno: HSL → RGB
   */
  private static hslToRgb(h: number, s: number, l: number): RGB {
    s /= 100;
    l /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    
    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    
    return {
      r: Math.round((r + m) * 255),
      g: Math.round((g + m) * 255),
      b: Math.round((b + m) * 255)
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WAVE 300: DETECCIÓN DE TRANSIENTES (ANTI-VOZ)
  // ═══════════════════════════════════════════════════════════════════════════
  /**
   * applyZones() - Control por zona para AGC TRUST
   * 
   * WAVE 300: DETECCIÓN DE TRANSIENTES
   * 🎸 WAVE 301: ROCK REFINEMENT (GeminiPunk + PunkOpus Quorum)
   * 
   * PROBLEMA: El bajo de MJ/Iron Maiden es CONTINUO (60-70%)
   * El bombo es un "pico sobre una montaña", no desde el suelo
   * La voz tiene MID pero NO tiene TREBLE (el snare SÍ)
   * 
   * KICK (Front PARs):
   *   - Gate RELATIVO: bass > (avgBass * 0.85)
   *   - Transiente PEQUEÑO: > 0.06 (antes 0.10)
   *   - Combina ambos = detecta "picos sobre montañas"
   * 
   * SNARE (Back PARs):
   *   - Transiente MID > 0.10
   *   - VALIDACIÓN ESPECTRAL: treble > 0.15 (el crack de la bordonera)
   *   - La voz NO tiene treble = queda filtrada
   * 
   * MOVERS: Sin cambios - flotan con MID
   */
  public applyZones(
    audio: { bass: number; mid: number; treble: number },
    mods?: { isSnareHit?: boolean; isKickHit?: boolean }
  ): RockZonesResult {
    const midNormalized = Math.min(1.0, audio.mid);
    const bassNormalized = Math.min(1.0, audio.bass);
    const trebleNormalized = Math.min(1.0, audio.treble);

    // ═══════════════════════════════════════════════════════════════════════
    // WAVE 301: Calcular TRANSIENTES (diferencia con promedio móvil)
    // ═══════════════════════════════════════════════════════════════════════
    const bassTransient = bassNormalized - this.avgBass;
    const midTransient = midNormalized - this.avgMid;
    
    // Actualizar promedios móviles (exponential moving average)
    this.avgBass = this.avgBass * RockStereoPhysics.SMOOTHING_FACTOR + 
                   bassNormalized * (1 - RockStereoPhysics.SMOOTHING_FACTOR);
    this.avgMid = this.avgMid * RockStereoPhysics.SMOOTHING_FACTOR + 
                  midNormalized * (1 - RockStereoPhysics.SMOOTHING_FACTOR);

    // ═══════════════════════════════════════════════════════════════════════
    // MOVERS: La guitarra/melodía vive en MID
    // NO requiere transiente - la voz DEBE flotar aquí suavemente
    // Gate + Gain + Decay = headbanging sin epilepsia
    // ═══════════════════════════════════════════════════════════════════════
    const gatedMid = midNormalized > RockStereoPhysics.MOVER_GATE ? midNormalized : 0;
    const guitarIntensity = Math.min(1.0, gatedMid * RockStereoPhysics.MOVER_GAIN);
    
    if (guitarIntensity > this.currentMoverIntensity) {
      this.currentMoverIntensity = guitarIntensity;
    } else {
      this.currentMoverIntensity *= RockStereoPhysics.MOVER_DECAY;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // WAVE 301: BACK PARS - SNARE con VALIDACIÓN ESPECTRAL
    // La VOZ tiene MID alto pero casi CERO treble → no activa
    // El SNARE tiene MID (golpe) + TREBLE (crack bordonera) → SÍ activa
    // ═══════════════════════════════════════════════════════════════════════
    const hasMidTransient = midTransient > RockStereoPhysics.MID_TRANSIENT_THRESHOLD;
    const hasSnareCrack = trebleNormalized > RockStereoPhysics.SNARE_TREBLE_VALIDATION;
    
    // ANTI-VOZ: Necesita AMBOS - transiente MID Y treble presente
    const isRealSnare = hasMidTransient && hasSnareCrack;
    const backGatedMid = (midNormalized > RockStereoPhysics.BACK_PAR_GATE && isRealSnare) 
                         ? midNormalized : 0;
    const backTarget = Math.min(1.0, backGatedMid * RockStereoPhysics.BACK_PAR_GAIN);
    
    if (backTarget > this.currentBackParIntensity) {
      this.currentBackParIntensity = backTarget;
    } else {
      this.currentBackParIntensity *= RockStereoPhysics.BACK_PAR_DECAY;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // WAVE 301: FRONT PARS - KICK con GATE RELATIVO
    // El bajo de MJ/Maiden es CONTINUO (60-70%), el bombo es un PICO encima
    // Gate RELATIVO: bass debe superar (avgBass * 0.85)
    // Transiente PEQUEÑO: > 0.06 (detecta picos sobre montañas)
    // ═══════════════════════════════════════════════════════════════════════
    const relativeFloor = this.avgBass * RockStereoPhysics.BASS_RELATIVE_FLOOR;
    const isAboveFloor = bassNormalized > relativeFloor;
    const hasBassTransient = bassTransient > RockStereoPhysics.BASS_TRANSIENT_THRESHOLD;
    
    // COMBINA: Sobre el suelo relativo Y con transiente positivo
    const isRealKick = isAboveFloor && hasBassTransient && 
                       bassNormalized > RockStereoPhysics.FRONT_PAR_GATE;
    const frontGatedBass = isRealKick ? bassNormalized : 0;
    
    // Histéresis anti-temblor
    const hysteresisThreshold = this.currentFrontParIntensity + RockStereoPhysics.FRONT_PAR_HYSTERESIS;
    
    if (frontGatedBass > hysteresisThreshold) {
      this.currentFrontParIntensity = frontGatedBass;
    } else {
      this.currentFrontParIntensity *= RockStereoPhysics.FRONT_PAR_DECAY;
    }
    
    // Kill pequeños residuos
    if (this.currentFrontParIntensity < 0.05) {
      this.currentFrontParIntensity = 0;
    }
    if (this.currentBackParIntensity < 0.05) {
      this.currentBackParIntensity = 0;
    }

    // Clamp final + debug info
    return {
      front: Math.min(0.95, this.currentFrontParIntensity),
      back: Math.min(0.95, this.currentBackParIntensity),
      mover: Math.min(1.0, this.currentMoverIntensity),
      debug: {
        bassTransient,
        midTransient
      }
    };
  }
}
