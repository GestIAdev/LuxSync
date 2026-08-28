/**
 * 🎨 SELENE COLOR ENGINE (WAVE 68.5)
 * ===================================
 * Motor procedural determinista para generación de paletas cromáticas
 * basado EXCLUSIVAMENTE en teoría musical y física del sonido.
 * 
 * FILOSOFÍA:
 * "Selene pinta MATEMÁTICA MUSICAL PURA.
 *  El VibeProfile es el único jefe que define restricciones."
 * 
 * FUNDAMENTOS:
 * - Círculo de Quintas → Círculo Cromático (KEY_TO_HUE)
 * - Modo → Temperatura emocional (MODE_MODIFIERS)
 * - Energía → Saturación y Brillo (NUNCA cambia el Hue)
 * - Syncopation → Estrategia de contraste (analogous/triadic/complementary)
 * - Rotación Fibonacci (φ × 360° ≈ 222.5°) → Color secundario
 * 
 * WAVE 68.5 - PURGA DE GÉNERO:
 * ✅ Eliminado: MACRO_GENRES, GENRE_MAP, GenreProfile, tempBias, satBoost, lightBoost
 * ✅ El motor genera colores PUROS - sin bias de género
 * ✅ El VibeManager aplica clamps DESPUÉS (temperatura/saturación min/max)
 * 
 * REGLA DE ORO:
 *   finalHue = KEY_TO_HUE[key] + MODE_MODIFIERS[mode].hueDelta
 *   energía SOLO afecta saturación y brillo, NUNCA el hue base
 * 
 * @see docs/JSON-ANALYZER-PROTOCOL.md - Protocolo de entrada
 * @see docs/WAVE-17-SELENE-COLOR-MIND-AUDIT.md - Arquitectura original
 * @see docs/Wave60_70/WAVE-68-5-GENRE-PURGE.md - Eliminación de lógica de género
 * 
 * @module engines/visual/SeleneColorEngine
 * @version 68.5.0
 */

// ============================================================
// 1. INTERFACES & TIPOS
// ============================================================

// 🎨 WAVE 2096.1: HSLColor y RGBColor unificados en types/color.ts (VULN-COLOR-07)
import { HSLColor, RGBColor } from '../../types/color'
export type { HSLColor, RGBColor }

/**
 * Paleta cromática completa generada por Selene
 */
export interface SelenePalette {
  /** Color principal - PARs, wash general */
  primary: HSLColor;
  /** Color secundario - Back PARs, Fibonacci rotation */
  secondary: HSLColor;
  /** Color de acento - Moving heads, beams, highlights */
  accent: HSLColor;
  /** Color de ambiente - Fills, backlighting suave */
  ambient: HSLColor;
  /** Color de contraste - Siluetas, sombras */
  contrast: HSLColor;
  /** Metadata de la paleta */
  meta: PaletteMeta;
}

/**
 * Metadata de la paleta generada
 * 🎨 WAVE 68.5: Sin macroGenre - solo matemática musical pura
 */
export interface PaletteMeta {
  /** Estrategia de contraste usada */
  strategy: 'analogous' | 'triadic' | 'complementary';
  /** Temperatura visual de la paleta */
  temperature: 'warm' | 'cool' | 'neutral';
  /** Descripción legible */
  description: string;
  /** Confianza en la paleta (0-1) */
  confidence: number;
  /** Velocidad de transición sugerida (ms) */
  transitionSpeed: number;
}

/**
 * Salida de armonía del analizador Wave 8
 */
export interface HarmonyOutput {
  /** Tonalidad: "C", "D#", "A", etc. o null */
  key: string | null;
  /** Modo/escala: "major", "minor", "dorian", etc. */
  mode: string;
  /** Mood detectado */
  mood: string;
  /** Temperatura emocional */
  temperature?: 'warm' | 'cool' | 'neutral';
  /** Nivel de disonancia (0-1) */
  dissonance?: number;
  /** Confianza (0-1) */
  confidence?: number;
}

/**
 * Salida de ritmo del analizador Wave 8
 */
export interface RhythmOutput {
  /** Patrón rítmico detectado */
  pattern?: string;
  /** Nivel de sincopación (0-1) - CRÍTICO para género */
  syncopation: number;
  /** Groove/feel (0-1) */
  groove?: number;
  /** Subdivisión del beat */
  subdivision?: 4 | 8 | 16;
  /** Confianza (0-1) */
  confidence?: number;
}

/**
 * Salida de género del analizador Wave 8
 */
export interface GenreOutput {
  /** Género primario detectado */
  primary: string;
  /** Género secundario (fusion) */
  secondary?: string | null;
  /** Confianza (0-1) */
  confidence?: number;
  /** Scores de todos los géneros */
  scores?: Record<string, number>;
}

/**
 * Salida de sección del analizador Wave 8
 */
export interface SectionOutput {
  /** Tipo de sección actual */
  type: string;
  /** Energía de la sección (0-1) */
  energy?: number;
  /** Probabilidad de transición (0-1) */
  transitionLikelihood?: number;
  /** Confianza (0-1) */
  confidence?: number;
}

/**
 * Análisis de audio extendido (entrada del motor)
 * Compatible con el protocolo JSON documentado
 */
export interface ExtendedAudioAnalysis {
  /** Timestamp del análisis */
  timestamp?: number;
  /** Frame ID */
  frameId?: number;
  
  // === TRINITY CORE ===
  /** BPM detectado (60-200) */
  bpm?: number;
  /** Confianza del BPM (0-1) */
  bpmConfidence?: number;
  /** Si estamos en un beat */
  onBeat?: boolean;
  /** Fase del beat (0-1) */
  beatPhase?: number;
  /** Fuerza del beat (0-1) */
  beatStrength?: number;
  
  // === SPECTRUM ===
  /** Energía de bajos (0-1) */
  bass?: number;
  /** Energía de medios (0-1) */
  mid?: number;
  /** Energía de agudos (0-1) */
  treble?: number;
  
  // === TOP-LEVEL (ACCESO RÁPIDO) ===
  /** Sincopación (0-1) - duplicado de wave8.rhythm.syncopation */
  syncopation?: number;
  /** Groove (0-1) */
  groove?: number;
  /** Subdivisión */
  subdivision?: 4 | 8 | 16;
  /** Mood simplificado */
  mood?: 'dark' | 'bright' | 'neutral';
  /** Key simplificada */
  key?: string;
  /** Energía normalizada (0-1) - CRÍTICO */
  energy: number;
  
  // === 🌴 WAVE 84: VIBE CONTEXT ===
  /** Vibe ID activo (para paletas contextuales) */
  vibeId?: string;
  
  // === WAVE 8 RICH DATA ===
  wave8?: {
    rhythm: RhythmOutput;
    harmony: HarmonyOutput;
    section: SectionOutput;
    genre: GenreOutput;
  };

  // 🎹 WAVE 7686 (URANUS PILLAR 0): 12-bin chromagram from GodEar Worker
  // (pitch classes C→B, normalized 0-1 by max). Consumed by the Chromagram
  // Gravity Engine via the zero-alloc _chromaMirror. Undefined when no audio.
  chroma?: number[];
}

/**
 * �️ WAVE 144: CONSTITUTIONAL GENERATION OPTIONS
 * ================================================
 * Estructura inmutable que define las restricciones cromáticas de un Vibe.
 * El VibeManager provee estas opciones, el ColorEngine las OBEDECE.
 * 
 * FILOSOFÍA: "RESTRINGIR, NO PINTAR"
 * - El ColorEngine sigue usando Fibonacci y Teoría Musical
 * - Pero respeta las LEYES impuestas por cada Constitución
 * 
 * @see docs/audits/WAVE-143-COLOR-CONSTITUTION.md
 */
export interface GenerationOptions {
  // ═══════════════════════════════════════════════════════════════════
  // SECCIÓN A: RESTRICCIONES DE HUE (El Círculo Cromático)
  // ═══════════════════════════════════════════════════════════════════
  
  /**
   * Rangos de Hue PROHIBIDOS (grados 0-360).
   * Si el color calculado cae aquí, aplicar Elastic Rotation.
   * @example [[30, 80], [330, 360]] // Prohibir naranjas y rojos cálidos
   */
  forbiddenHueRanges?: [number, number][];
  
  /**
   * Rangos de Hue PERMITIDOS (grados 0-360).
   * Si el color calculado cae FUERA, rotar al punto más cercano.
   * @example [[170, 302]] // Solo azules y violetas
   */
  allowedHueRanges?: [number, number][];
  
  /**
   * Grados de rotación para escapar de zonas prohibidas.
   * @default 15
   */
  elasticRotation?: number;
  
  /**
   * Mapeos forzados de hue.
   * Si el hue cae en [from, to], se reemplaza por 'target'.
   * @example [{ from: 80, to: 160, target: 0 }] // Verde → Rojo (Rock)
   */
  hueRemapping?: Array<{ from: number; to: number; target: number }>;
  
  // ═══════════════════════════════════════════════════════════════════
  // SECCIÓN B: RESTRICCIONES DE SATURACIÓN Y LUMINOSIDAD
  // ═══════════════════════════════════════════════════════════════════
  
  /**
   * Rango de saturación permitido (0-100).
   * @example [90, 100] para Techno neón
   */
  saturationRange?: [number, number];
  
  /**
   * Rango de luminosidad permitido (0-100).
   * @example [45, 60] para evitar whitewashing
   */
  lightnessRange?: [number, number];
  
  /**
   * Configuración Anti-Barro para vibes tropicales.
   * Evita que naranjas/amarillos se vean marrones.
   */
  mudGuard?: {
    enabled: boolean;
    swampZone: [number, number];  // Hue range peligroso
    minLightness: number;         // L mínimo en esa zona
    minSaturation: number;        // S mínimo en esa zona
  };
  
  /**
   * 🔥 WAVE 287: NEON PROTOCOL - "Neon or Nothing"
   * ═══════════════════════════════════════════════════════════════════
   * En lugar de prohibir colores, los TRANSFORMA en versiones extremas.
   * 
   * FILOSOFÍA: "Si vas a ser cálido, tienes que quemarme la retina.
   *             Si no puedes brillar así, te vas al blanco."
   * 
   * Si un color cae en dangerZone:
   * - Forzar minSaturation (ej: 90%) para neón puro
   * - Forzar minLightness (ej: 80%) para evitar marrones
   * - Si no puede cumplirlo → Colapsar a blanco (S=0, L=100)
   * 
   * APLICACIÓN: Se aplica a TODA la paleta (Primary, Secondary, Ambient, Accent)
   * para que ningún color escape.
   */
  neonProtocol?: {
    enabled: boolean;
    dangerZone: [number, number];  // Rango de hue peligroso (ej: [15, 80])
    minSaturation: number;         // Saturación mínima para neón (ej: 90)
    minLightness: number;          // Luminosidad mínima para evitar barro (ej: 75)
    fallbackToWhite: boolean;      // Si no puede cumplir, colapsar a blanco
  };

  // ═══════════════════════════════════════════════════════════════════
  // SECCIÓN C: ESTRATEGIA DE CONTRASTE
  // ═══════════════════════════════════════════════════════════════════
  
  /**
   * Estrategia de contraste forzada.
   * Si no se especifica, se calcula por syncopation.
   * - 'prism': Estrategia tetraédrica de Techno
   */
  forceStrategy?: 'analogous' | 'triadic' | 'complementary' | 'prism';
  
  /**
   * Activa el Tropical Mirror (Ambient = Secondary + 180°).
   * Usado en Fiesta Latina para máximo contraste.
   */
  tropicalMirror?: boolean;
  
  /**
   * Bloquea el Ambient en un color fijo.
   * Usado en Techno para el "suelo UV".
   */
  ambientLock?: { h: number; s: number; l: number };
  
  // ═══════════════════════════════════════════════════════════════════
  // SECCIÓN D: COMPORTAMIENTO DEL ACCENT
  // ═══════════════════════════════════════════════════════════════════
  
  /**
   * Modo de reactividad del Accent.
   * - 'strobe': Flash blanco instantáneo (Techno)
   * - 'drum-reactive': Flash en Snare/Kick (Rock)
   * - 'solar-flare': Flash dorado cálido (Latino)
   * - 'breathing': Pulso lento (Chill)
   * - 'quaternary': Color fijo derivado (Idle)
   */
  accentBehavior?: 'strobe' | 'drum-reactive' | 'solar-flare' | 'breathing' | 'quaternary';
  
  /**
   * Color del strobe (si accentBehavior = 'strobe').
   */
  strobeColor?: { r: number; g: number; b: number };
  
  /**
   * Configuración del Solar Flare (Latino).
   */
  solarFlareAccent?: { h: number; s: number; l: number };
  
  /**
   * Configuración del Snare Flash (Rock).
   */
  snareFlash?: { h: number; s: number; l: number };
  
  /**
   * Configuración del Kick Punch (Rock).
   */
  kickPunch?: { usesPrimary: boolean; l: number };
  
  /**
   * Configuración del Breathing Pulse (Chill).
   */
  pulseConfig?: { duration: number; amplitude: number };
  
  /**
   * Prohíbe strobes completamente (Chill).
   */
  strobeProhibited?: boolean;
  
  // ═══════════════════════════════════════════════════════════════════
  // SECCIÓN E: TRANSICIONES Y TIMING
  // ═══════════════════════════════════════════════════════════════════
  
  /**
   * 🌡️ WAVE 149.6: THERMAL GRAVITY - Temperatura Atmosférica
   * 
   * Define el "clima" del Vibe. Los hues generados serán arrastrados
   * físicamente hacia el polo térmico correspondiente:
   * 
   * - > 7000K: Polo Frío (240° Azul Rey) - Arrastra hacia azules
   * - < 5000K: Polo Cálido (40° Oro) - Arrastra hacia naranjas/rojos
   * - 5000-7000K: Neutro (sin gravedad) - Sin modificación
   * 
   * Cuanto más extrema la temperatura, más fuerte el arrastre.
   * Ejemplos:
   * - Techno (9500K) → Fuerza 0.83 hacia 240° (azul)
   * - Latino (3000K) → Fuerza 0.67 hacia 40° (oro)
   * - Idle (6500K) → Fuerza 0 (neutro)
   */
  atmosphericTemp?: number;  // 2000-10000K

  /**
   * 🌬️ WAVE 284: GRAVITATIONAL RELAXATION
   * 
   * Fuerza máxima de arrastre térmico (0.0 - 1.0).
   * Controla cuánto la temperatura atmosférica arrastra los colores hacia el polo.
   * 
   * - 0.35: Gravedad agresiva (colapsa diversidad hacia Cyan/Azul)
   * - 0.15: Gravedad suave (preserva Verdes, Magentas, Violetas)
   * - 0.0: Sin gravedad (colores puros del algoritmo musical)
   * 
   * @default 0.35 (legacy)
   */
  thermalGravityStrength?: number;
  
  /**
   * Configuración de transiciones de color.
   */
  transitionConfig?: {
    minDuration: number;           // Duración mínima en ms
    maxDuration?: number;          // Duración máxima en ms
    easing?: 'linear' | 'ease-in' | 'ease-out' | 'sine-inout';
  };
  
  /**
   * Configuración de dimming general.
   */
  dimmingConfig?: {
    floor: number;    // Mínimo (0-1)
    ceiling: number;  // Máximo (0-1)
  };
  
  // ═══════════════════════════════════════════════════════════════════
  // SECCIÓN F: OCEANIC MODULATION (WAVE 1072)
  // ═══════════════════════════════════════════════════════════════════
  
  /**
   * 🌊 WAVE 1072: THE OCEAN TRANSLATOR
   * 
   * Modulación oceánica para ChillLounge. En vez de bypasear el engine
   * con colorOverride hardcodeado, ahora el océano MODULA el color base.
   * 
   * El oceanicContext traduce profundidad→sugestión cromática que el engine
   * puede aplicar de forma natural junto con las reglas de la constitution.
   * 
   * @example
   * oceanicModulation: {
   *   enabled: true,
   *   hueInfluence: 180,        // Sugerir azul tropical
   *   hueInfluenceStrength: 0.7, // 70% de influencia
   *   saturationMod: -10,        // Ligeramente desaturado
   *   lightnessMod: -5,          // Ligeramente más oscuro
   *   breathingFactor: 1.05,     // 5% de modulación por audio
   * }
   */
  oceanicModulation?: {
    enabled: boolean;
    /** Hue sugerido por la profundidad (0-360 grados) */
    hueInfluence: number;
    /** Fuerza de la sugestión de hue (0-1) */
    hueInfluenceStrength: number;
    /** Modificador de saturación (-30 a +30) */
    saturationMod: number;
    /** Modificador de luminosidad (-20 a +20) */
    lightnessMod: number;
    /** Factor de "respiración" modulado por audio (0.85-1.15) */
    breathingFactor: number;
    /** Zona oceánica actual para logging */
    zone?: string;
    /** Profundidad actual para logging */
    depth?: number;
  };
  
  // ═══════════════════════════════════════════════════════════════════
  // SECCIÓN G: LEGACY COMPATIBILITY (WAVE 142)
  // ═══════════════════════════════════════════════════════════════════
  
  /**
   * @deprecated Use saturationRange/lightnessRange instead
   * Rango de temperatura de color permitido (Kelvin).
   */
  temperatureRange?: [number, number];

  // ═══════════════════════════════════════════════════════════════════
  // SECCIÓN H: SIDEREAL CLOCK (WAVE 3490)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * WAVE 3490 — SIDEREAL CLOCK
   *
   * Carrusel temporal de zonas cromáticas. Cada slot define
   * allowedHueRanges y lightnessRange que sobreescriben los de la
   * constitución base durante ese período de tiempo.
   *
   * El slot activo se determina por:
   *   Math.floor(Date.now() / slotDurationMs) % slots.length
   *
   * Función pura y determinista: mismo timestamp → mismo slot siempre.
   * Compatible con cualquier constitución. Si siderealClock es undefined,
   * el motor funciona exactamente igual que antes.
   */
  siderealClock?: {
    /** Duración de cada slot en milisegundos. */
    slotDurationMs: number;
    slots: Array<{
      /** Rangos de hue permitidos durante este slot. */
      allowedHueRanges: [number, number][];
      /** Rango de lightness durante este slot. */
      lightnessRange: [number, number];
      /** Etiqueta para debug/logging. */
      label?: string;
    }>;
  };

  /**
   * WAVE 3490 — Suprime el Tropical Bias (WAVE 162).
   *
   * Cuando es true, las keys en zona fría (150-270°) NO se rotan
   * automáticamente a naranja/magenta en vibes latinos.
   * Útil cuando el Sidereal Clock ya gestiona la zona cromática activa.
   */
  suppressTropicalBias?: boolean;

  /**
   * 🎹 WAVE 7687 (URANUS PILLAR I): Chromagram Gravity Engine feature flag.
   *
   * When true, the primary hue is derived from the barycentric center of mass
   * of the 12-bin chromagram (Circle of Fifths topology) instead of the
   * discrete KEY_TO_HUE[key] lookup. Mode modifiers, mood drift, thermal
   * gravity, and all constitutional enforcement still apply downstream.
   *
   * When false (default), the legacy KEY_TO_HUE path is used — zero behaviour
   * change. This flag enables A/B testing during the Uranus rollout.
   *
   * @default false
   */
  useChromagramGravity?: boolean;

  /**
   * WAVE 4760 — Ángulo de rotación Fibonacci para el color secundario.
   *
   * Reemplaza el hardcoding de 137.5° para fiesta-latina.
   * - undefined / 0 → usa PHI_ROTATION (≈222.5°, Golden Angle B, default)
   * - 137.5 → Golden Angle A (vibes tropicales)
   *
   * @default PHI_ROTATION (≈222.5°)
   */
  fibonacciRotationDeg?: number;

  /**
   * WAVE 4760 — Salt cromático por key root para el color secundario.
   *
   * Map de root numérico (0-11) a delta de rotación en grados.
   * Reemplaza el hardcoding F/A-Major (root 5/-35°, root 9/+35°) de fiesta-latina.
   *
   * @example { 5: -35, 9: 35 }  // F→Lima, A→Miami Pink
   */
  saltChromaticKeys?: Record<number, number>;

  /**
   * WAVE 4760 — Luxury signature overrides para el color secundario.
   *
   * Map de root numérico a hue fijo y saturación máxima opcionales.
   * Reemplaza el hardcoding Mint/Navy de fiesta-latina.
   *
   * @example { 5: { h: 160, maxS: 85 }, 9: { h: 230 } }
   */
  luxurySignatures?: Record<number, { h: number; maxS?: number }>;

  /**
   * WAVE 4760 — Activa el Tropical Ambient Bias (WAVE 84).
   *
   * Cuando es true, el Ambient se empuja hacia zona fría (verde/turquesa/magenta)
   * si el Primary es cálido, creando el contraste Tierra/Selva.
   * Reemplaza la detección por nombre de vibe ('latin', 'fiesta', etc.).
   */
  tropicalAmbientBias?: boolean;
}

// ============================================================
// 2. CONSTANTES - EL CORAZÓN DE LA FÓRMULA CROMÁTICA
// ============================================================

/**
 * 🌀 ROTACIÓN FIBONACCI (Proporción Áurea)
 * φ × 360° ≈ 222.492° → Rotación para color secundario
 * Garantiza variedad infinita sin repetición visual
 */
const PHI = 1.618033988749895;
const PHI_ROTATION = (PHI * 360) % 360; // ≈ 222.5°

/**
 * ⏳ WAVE 7680: SIDEREAL SESSION OFFSET — Safe clock randomization.
 *
 * PROBLEM: The Sidereal Clock uses `performance.now()` as its time base.
 * `performance.now()` starts at ~0 on every app launch, so the active slot
 * always defaults to slot 0. Every session begins in the same "act".
 *
 * FIX: Add a one-time random offset (up to 24h) computed at module load.
 * This shifts the slot index deterministically per session without touching
 * the physics engine's time base.
 *
 * WHY NOT Date.now(): Date.now() is epoch-based and causes the "Woodstock"
 * bug — the physics oscillators (ChillAmbientEngine, LiquidEngine71) use
 * performance.now() and would desync from the color engine if we mixed
 * clocks. performance.now() + offset keeps a single clock domain.
 */
const SIDEREAL_SESSION_OFFSET = Math.random() * 86_400_000; // Random ms up to 24h

/**
 * 🎵 CÍRCULO DE QUINTAS → CÍRCULO CROMÁTICO
 * 
 * Mapeo sinestésico de notas musicales a ángulos HSL.
 * Basado en psicoacústica y sinestesia cromática.
 * 
 * Do (C) = Rojo (0°) - Fundamental, primario
 * La (A) = Índigo (270°) - 440Hz, referencia
 */
const KEY_TO_HUE: Record<string, number> = {
  // Naturales
  'C': 0,       // Do - Rojo
  'D': 60,      // Re - Naranja
  'E': 120,     // Mi - Amarillo
  'F': 150,     // Fa - Verde-Amarillo
  'G': 210,     // Sol - Cyan
  'A': 270,     // La - Índigo
  'B': 330,     // Si - Magenta
  
  // Sostenidos
  'C#': 30,     // Do# - Rojo-Naranja
  'D#': 90,     // Re# - Amarillo-Naranja
  'F#': 180,    // Fa# - Verde (tritono de C)
  'G#': 240,    // Sol# - Azul
  'A#': 300,    // La# - Violeta
  
  // Bemoles (equivalentes enarmónicos)
  'Db': 30,
  'Eb': 90,
  'Gb': 180,
  'Ab': 240,
  'Bb': 300,
};

/**
 * � WAVE 89: MAPEO DE KEY → ROOT (nota raíz numérica 0-11)
 * Usado para cálculos de variación dentro de rangos de color
 */
const KEY_TO_ROOT: Record<string, number> = {
  'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11,
  'C#': 1, 'D#': 3, 'F#': 6, 'G#': 8, 'A#': 10,
  'Db': 1, 'Eb': 3, 'Gb': 6, 'Ab': 8, 'Bb': 10,
};

/**
 * �🎭 MAPEO DE MOOD → HUE BASE
 * Usado cuando la key no está disponible
 */
const MOOD_HUES: Record<string, number> = {
  'happy': 50,          // Amarillo-Naranja (alegría)
  'sad': 240,           // Azul (tristeza)
  'tense': 0,           // Rojo (tensión)
  'dreamy': 280,        // Violeta (ensueño)
  'bluesy': 30,         // Naranja oscuro (blues)
  'jazzy': 260,         // Índigo (jazz)
  'spanish_exotic': 15, // Rojo-Naranja (flamenco)
  'universal': 120,     // Verde (neutro)
  
  // Moods simples del top-level
  'dark': 240,          // Azul oscuro
  'bright': 50,         // Amarillo
  'neutral': 120,       // Verde
};

/**
 * 🌡️ MODIFICADORES DE MODO MUSICAL
 * 
 * Cada modo tiene una "temperatura" emocional que modifica
 * la saturación, luminosidad y hue del color base.
 */
interface ModeModifier {
  /** Delta de Hue en grados */
  hue: number;
  /** Delta de Saturación en % */
  sat: number;
  /** Delta de Luminosidad en % */
  light: number;
  /** Descripción del mood */
  description: string;
}

const MODE_MODIFIERS: Record<string, ModeModifier> = {
  // Modos Mayores - Cálidos y brillantes
  'major': { 
    hue: 15, sat: 10, light: 10,
    description: 'Alegre y brillante'
  },
  'ionian': { 
    hue: 15, sat: 10, light: 10,
    description: 'Alegre y brillante'
  },
  'lydian': { 
    hue: 20, sat: 15, light: 15,
    description: 'Etéreo y soñador'
  },
  'mixolydian': { 
    hue: 10, sat: 10, light: 5,
    description: 'Funky y cálido'
  },
  
  // Modos Menores - Fríos y profundos
  'minor': { 
    hue: -15, sat: -10, light: -10,
    description: 'Triste y melancólico'
  },
  'aeolian': { 
    hue: -15, sat: -10, light: -10,
    description: 'Triste y melancólico'
  },
  'dorian': { 
    hue: -5, sat: 0, light: 0,
    description: 'Jazzy y sofisticado'
  },
  'phrygian': { 
    hue: -20, sat: 5, light: -10,
    description: 'Español y tenso'
  },
  'locrian': { 
    hue: -30, sat: -15, light: -20,
    description: 'Oscuro y disonante'
  },
  
  // Escalas Especiales
  'harmonic_minor': { 
    hue: -10, sat: -5, light: -10,
    description: 'Dramático y exótico'
  },
  'melodic_minor': { 
    hue: -5, sat: 0, light: -5,
    description: 'Jazz avanzado'
  },
  'pentatonic_major': { 
    hue: 10, sat: 10, light: 5,
    description: 'Simple y folk'
  },
  'pentatonic_minor': { 
    hue: 0, sat: 5, light: -5,
    description: 'Blues y rock'
  },
  'blues': { 
    hue: -10, sat: 5, light: -10,
    description: 'Bluesy y soul'
  },
};

// ============================================================
// 3. SISTEMA DE MACRO-GÉNEROS
// ============================================================

// ============================================================
// 4. UTILIDADES
// ============================================================

/**
 * Normaliza un valor de hue al rango 0-360
 */
function normalizeHue(h: number): number {
  return ((h % 360) + 360) % 360;
}

/**
 * Clamp un valor entre min y max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * 🎯 WAVE 7684: GAMUT MAPPING — Proportional hue projection.
 *
 * PROBLEM: The old snap-to-nearest-border logic (findNearestAllowedHue)
 * acted as a hard wall. Any out-of-bound hue was clamped to the exact same
 * border degree (e.g., 350°), so completely different audio keys (C minor
 * vs A minor) produced identical output — zero audio-reactivity inside the
 * slot's bounds.
 *
 * SOLUTION: Map the raw audio-derived hue proportionally into the target
 * range. The raw hue's position within the full 0-360 circle is preserved
 * as a ratio, then projected into the slot's [min, max] window. This
 * guarantees that every distinct audio key yields a mathematically
 * distinct shade within the active Act.
 *
 * If the hue is already inside one of the allowed ranges, it passes
 * through unchanged. If not, the nearest range is found and the hue is
 * gamut-mapped into it.
 *
 * @param rawHue - The audio-derived hue (0-360, will be normalized)
 * @param ranges - Array of [min, max] allowed hue ranges
 * @returns The gamut-mapped hue, guaranteed to fall within an allowed range
 */
function gamutMapHue(rawHue: number, ranges: [number, number][]): number {
  const normalizedHue = normalizeHue(rawHue);

  // 1. Already inside a range → pass through unchanged
  for (const [min, max] of ranges) {
    const nMin = normalizeHue(min);
    const nMax = normalizeHue(max);
    const inRange = nMin <= nMax
      ? (normalizedHue >= nMin && normalizedHue <= nMax)
      : (normalizedHue >= nMin || normalizedHue <= nMax);
    if (inRange) return normalizedHue;
  }

  // 2. Not in any range → find the nearest range
  let nearestMin = 0;
  let nearestMax = 0;
  let minDistance = Infinity;

  for (const [min, max] of ranges) {
    const nMin = normalizeHue(min);
    const nMax = normalizeHue(max);

    const distToMin = Math.min(
      Math.abs(normalizedHue - nMin),
      360 - Math.abs(normalizedHue - nMin),
    );
    const distToMax = Math.min(
      Math.abs(normalizedHue - nMax),
      360 - Math.abs(normalizedHue - nMax),
    );
    const dist = Math.min(distToMin, distToMax);

    if (dist < minDistance) {
      minDistance = dist;
      nearestMin = nMin;
      nearestMax = nMax;
    }
  }

  // 3. Gamut-map proportionally into the nearest range
  //    Range size (handles circular wrap-around, e.g. [340, 20])
  let rangeSize: number;
  if (nearestMax >= nearestMin) {
    rangeSize = nearestMax - nearestMin;
  } else {
    rangeSize = (360 - nearestMin) + nearestMax;
  }

  if (rangeSize <= 0) return nearestMin;

  // Proportional projection: rawHue's position in [0, 360) → position in [nearestMin, nearestMin + rangeSize)
  const normalizedRaw = normalizedHue / 360;
  let mappedHue = nearestMin + normalizedRaw * rangeSize;

  return normalizeHue(mappedHue);
}

/**
 * 🔥 WAVE 287: NEON PROTOCOL - "Neon or Nothing"
 * ═══════════════════════════════════════════════════════════════════════════
 * Transforma colores en la "danger zone" a versiones EXTREMAS.
 * 
 * FILOSOFÍA: "Si vas a ser cálido, tienes que quemarme la retina.
 *             Si no puedes brillar así, te vas al blanco hielo."
 * 
 * @param hsl - Color a sanitizar
 * @param options - Configuración del Neon Protocol
 * @returns Color transformado (neón extremo o blanco hielo)
 */
function applyNeonProtocol(
  hsl: HSLColor,
  options?: GenerationOptions
): HSLColor {
  const protocol = options?.neonProtocol;
  
  // Si no hay protocolo o está desactivado, devolver color original
  if (!protocol || !protocol.enabled) {
    return hsl;
  }
  
  const [dangerMin, dangerMax] = protocol.dangerZone;
  const hue = normalizeHue(hsl.h);
  
  // Verificar si el hue está en la danger zone
  // Soportar wrap-around (ej: [350, 20] = 350-360 y 0-20)
  const isInDanger = dangerMin <= dangerMax
    ? (hue >= dangerMin && hue <= dangerMax)
    : (hue >= dangerMin || hue <= dangerMax);
  
  if (!isInDanger) {
    return hsl;  // Fuera de peligro, devolver original
  }
  
  // ═══════════════════════════════════════════════════════════════════
  // DENTRO DE LA DANGER ZONE: Aplicar reglas de transformación (IN-PLACE)
  // ═══════════════════════════════════════════════════════════════════
  // 
  // WAVE 287.2: COLD ESCAPE ALWAYS - En Techno, SIEMPRE rotar a frío
  // El Arquitecto decidió: "Amarillo neón sigue siendo amarillo feo".
  // Para Techno, no hay excepciones: danger zone = zona fría.
  //
  // Filosofía: "En el bunker no hay sol. Solo neón frío."
  // ═══════════════════════════════════════════════════════════════════
  
  // 🧊 COLD ESCAPE: Rotar a cyan/turquesa/verde-frío
  // Distribuimos el rango [15-80] en el rango frío [170-210]
  // para mantener variedad cromática
  const dangerRange = dangerMax - dangerMin;  // 80 - 15 = 65
  const positionInDanger = (hue - dangerMin) / dangerRange;  // 0.0 - 1.0
  const coldHue = 170 + positionInDanger * 40;  // 170° - 210° (cyan-turquesa)
  
  // WAVE 0-ALLOC: Mutate hsl in place instead of returning new object
  hsl.h = normalizeHue(coldHue);
  hsl.s = Math.max(hsl.s, 85);  // Asegurar saturación neón
  // hsl.l unchanged — keep original luminosity
  return hsl;
}

/**
 * Mapea un valor de un rango a otro
 */
function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number {
  return outMin + ((value - inMin) * (outMax - outMin)) / (inMax - inMin);
}

/**
 * WAVE 0-ALLOC: Hoisted hue2rgb — eliminates per-call closure allocation.
 * Module-level function, no captured variables.
 */
function _hue2rgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1/6) return p + (q - p) * 6 * t;
  if (t < 1/2) return q;
  if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
  return p;
}

/**
 * Convierte HSL a RGB (zero-alloc variant)
 * Writes directly into `out` — no object or closure allocation.
 * @see https://www.w3.org/TR/css-color-4/#hsl-to-rgb
 */
export function hslToRgbMutate(hsl: HSLColor, out: RGBColor): RGBColor {
  const h = hsl.h / 360;
  const s = hsl.s / 100;
  const l = hsl.l / 100;

  if (s === 0) {
    out.r = Math.round(l * 255);
    out.g = out.r;
    out.b = out.r;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    out.r = Math.round(_hue2rgb(p, q, h + 1/3) * 255);
    out.g = Math.round(_hue2rgb(p, q, h) * 255);
    out.b = Math.round(_hue2rgb(p, q, h - 1/3) * 255);
  }
  return out;
}

/**
 * Convierte HSL a RGB (allocating — use hslToRgbMutate in hot paths)
 * @see https://www.w3.org/TR/css-color-4/#hsl-to-rgb
 */
export function hslToRgb(hsl: HSLColor): RGBColor {
  return hslToRgbMutate(hsl, { r: 0, g: 0, b: 0 });
}

/**
 * Convierte RGB a HSL
 */
export function rgbToHsl(rgb: RGBColor): HSLColor {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  
  let h = 0;
  let s = 0;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/** Pre-allocated RGB palette for zero-alloc paletteToRgbMutate */
const _rgbPaletteScratch: {
  primary: RGBColor; secondary: RGBColor; accent: RGBColor;
  ambient: RGBColor; contrast: RGBColor;
} = {
  primary: { r: 0, g: 0, b: 0 }, secondary: { r: 0, g: 0, b: 0 },
  accent: { r: 0, g: 0, b: 0 }, ambient: { r: 0, g: 0, b: 0 },
  contrast: { r: 0, g: 0, b: 0 },
};

/**
 * Convierte paleta HSL completa a RGB (zero-alloc — mutates pre-allocated scratch)
 */
export function paletteToRgbMutate(palette: SelenePalette): {
  primary: RGBColor; secondary: RGBColor; accent: RGBColor;
  ambient: RGBColor; contrast: RGBColor;
} {
  hslToRgbMutate(palette.primary,   _rgbPaletteScratch.primary);
  hslToRgbMutate(palette.secondary, _rgbPaletteScratch.secondary);
  hslToRgbMutate(palette.accent,    _rgbPaletteScratch.accent);
  hslToRgbMutate(palette.ambient,   _rgbPaletteScratch.ambient);
  hslToRgbMutate(palette.contrast,  _rgbPaletteScratch.contrast);
  return _rgbPaletteScratch;
}

/**
 * Convierte paleta HSL completa a RGB (allocating — use paletteToRgbMutate in hot paths)
 */
export function paletteToRgb(palette: SelenePalette): {
  primary: RGBColor;
  secondary: RGBColor;
  accent: RGBColor;
  ambient: RGBColor;
  contrast: RGBColor;
} {
  return {
    primary: hslToRgb(palette.primary),
    secondary: hslToRgb(palette.secondary),
    accent: hslToRgb(palette.accent),
    ambient: hslToRgb(palette.ambient),
    contrast: hslToRgb(palette.contrast),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 🌡️ WAVE 149.6: THERMAL GRAVITY - Motor de Física Cromática
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Aplica gravedad térmica a un hue, arrastrándolo hacia el polo
 * correspondiente a la temperatura atmosférica del Vibe.
 * 
 * FÍSICA:
 * - > 7000K: Polo Frío (240° Azul Rey)
 * - < 5000K: Polo Cálido (40° Oro)
 * - 5000-7000K: Zona Neutra (sin gravedad)
 * 
 * La fuerza de arrastre es proporcional a la distancia del polo neutral (6000K).
 * 
 * @param hue - Hue original (0-360)
 * @param atmosphericTemp - Temperatura atmosférica en Kelvin (2000-10000)
 * @param maxForce - Fuerza máxima de arrastre (0.0-1.0). Default: 0.35
 * @returns Hue modificado por la gravedad térmica
 * 
 * @example
 * // Techno (9500K) arrastra amarillo 60° hacia verde/cian
 * applyThermalGravity(60, 9500) → ~140° (Verde Cian)
 * 
 * // Latino (3000K) arrastra azul 240° hacia magenta/rojo
 * applyThermalGravity(240, 3000) → ~160° (Cian/Turquesa, menos frío)
 */
export function applyThermalGravity(hue: number, atmosphericTemp?: number, maxForce?: number): number {
  // Sin temperatura definida = sin gravedad
  if (!atmosphericTemp) return hue;
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🌡️ WAVE 162.5: THERMAL GRAVITY AMPLIFICADA
  // 🌬️ WAVE 284: GRAVITATIONAL RELAXATION - maxForce ahora es configurable
  // ═══════════════════════════════════════════════════════════════════════
  // WAVE 284: El problema era que 35% de gravedad colapsaba diversidad
  // Verdes (135°) se convertían en Cyan (172°) - ¡37° de migración!
  //
  // SOLUCIÓN: Cada Vibe puede definir su thermalGravityStrength
  // - Techno: 0.15 (suave, preserva Verdes/Magentas/Violetas)
  // - Latino: 0.35 (agresivo, arrastra hacia el Oro)
  // ═══════════════════════════════════════════════════════════════════════
  
  // Zona neutral más estrecha: daylight verdadero (5800K-6200K)
  if (atmosphericTemp >= 5800 && atmosphericTemp <= 6200) {
    return hue;
  }
  
  // 🌬️ WAVE 284: Fuerza máxima configurable (default 0.35 para legacy)
  const MAX_THERMAL_FORCE = maxForce ?? 0.35;
  
  // Definir polo de atracción
  let pole: number;
  let rawForce: number;
  
  if (atmosphericTemp > 6200) {
    // POLO FRÍO: Azul Rey (240°)
    pole = 240;
    // Fuerza bruta: 6200K → 0, 9000K → 1
    rawForce = Math.min((atmosphericTemp - 6200) / 2800, 1.0);
  } else {
    // POLO CÁLIDO: Oro (40°)
    pole = 40;
    // Fuerza bruta: 5800K → 0, 3000K → 1
    rawForce = Math.min((5800 - atmosphericTemp) / 2800, 1.0);
  }
  
  // Limitar la fuerza al máximo permitido
  const force = rawForce * MAX_THERMAL_FORCE;
  
  // Calcular distancia más corta en el círculo cromático
  let delta = pole - hue;
  
  // Normalizar a camino más corto (-180 a 180)
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🛡️ WAVE 285: ESCAPE VELOCITY - Forzar dirección de escape para zona cálida
  // ═══════════════════════════════════════════════════════════════════════
  // PROBLEMA: Hue 45° con polo 240° tiene camino corto HACIA ATRÁS (45→0→360→240)
  // Esto EMPUJA el color hacia más naranja (45° → 20°) en vez de hacia cyan.
  //
  // SOLUCIÓN: Si el hue está en zona naranja (0-85°) y el polo es frío (240°),
  // forzar la dirección HACIA ADELANTE para escapar hacia cyan/verde.
  // Esto significa usar delta positivo (ir por 45→90→180→240).
  // ═══════════════════════════════════════════════════════════════════════
  if (pole === 240 && hue >= 0 && hue <= 85) {
    // Forzar escape hacia adelante: delta debe ser positivo
    // Distancia "hacia adelante" = 240 - hue (siempre positivo)
    delta = Math.abs(pole - hue);  // Ir hacia cyan/verde/azul
    // Nota: Con hue=45, delta=195 → newHue = 45 + 195*0.15 = 74° (verde-amarillo, escapando)
  }
  
  // Aplicar vector de arrastre (ahora moderado)
  const newHue = hue + (delta * force);
  const resultHue = normalizeHue(newHue);
  
  // 🧹 WAVE 671.5: Commented ThermalGravity log (useful for future debug - Radwulf request)
  // 🔌 WAVE 150: DEBUG LOG (Chivato) - Ver si el aire acondicionado está encendido
  // if (Math.random() < 0.01) {  // Solo 1% de frames para no saturar consola
  //   console.log(`[ThermalGravity] 🌡️ VibeTemp=${atmosphericTemp}K | Pole=${pole}° | Force=${(force * 100).toFixed(0)}% | Hue: ${hue.toFixed(0)}° → ${resultHue.toFixed(0)}°`);
  // }
  
  return resultHue;
}

// ============================================================
// 5. LA CLASE PRINCIPAL - SELENE COLOR ENGINE
// ============================================================

/**
 * 🎨 SELENE COLOR ENGINE
 * 
 * Motor procedural determinista para generación de paletas cromáticas.
 * Convierte análisis musical en colores coherentes.
 * 
 * @example
 * ```typescript
 * const palette = SeleneColorEngine.generate({
 *   energy: 0.34,
 *   wave8: {
 *     harmony: { key: 'A', mode: 'minor', mood: 'tense' },
 *     rhythm: { syncopation: 0.27 },
 *     genre: { primary: 'techno' },
 *     section: { type: 'drop' }
 *   }
 * });
 * 
 * console.log(palette.primary); // { h: 255, s: 57, l: 40 }
 * console.log(palette.meta.macroGenre); // 'ELECTRONIC_4X4'
 * ```
 */

// ═══════════════════════════════════════════════════════════════════════════
// 🎹 WAVE 7686 (URANUS PILLAR 0): ZERO-ALLOC CHROMAGRAM MIRROR
// ═══════════════════════════════════════════════════════════════════════════
// Module-level pre-allocated 12-bin buffer. The producer (TitanEngine) passes
// chroma as a number[] reference; generate() copies INTO this Float64Array
// once per frame (12 float stores, zero allocation). All downstream Uranus
// math (Pillar I barycenter, Pillar III repulsion) reads from this mirror.
//
// Float64Array is chosen over Float32Array for double-precision accumulation
// in the barycentric mass sums (Pillar I §1.3) — prevents catastrophic
// cancellation when subtracting near-equal circular vectors.
//
// Normalization contract: GodEarFFT.computeChromaFromSpectrum normalizes by
// the MAX bin (sup-norm), NOT by the sum. Therefore Σ c_i ∈ [1, 12], and
// Pillar I formulas must divide by the explicit weight sum W = Σ w_i.
const _chromaMirror = new Float64Array(12);

// ═══════════════════════════════════════════════════════════════════════════
// 🌌 WAVE 7687 (URANUS PILLAR I): BARYCENTRIC CHROMATIC MASS — LUTs & STATE
// ═══════════════════════════════════════════════════════════════════════════
// Circle of Fifths topology: θ_i = ((7*i) % 12) * 30°
// 7 is a generator of Z_12 (gcd(7,12)=1) → bijection, no collisions.
// Harmonically proximate notes become chromatically proximate.
//
// Verified mapping (i: pitch → θ):
//   0:C→0°  1:C#→210°  2:D→60°  3:D#→270°  4:E→120°  5:F→330°
//   6:F#→180°  7:G→30°  8:G#→240°  9:A→90°  10:A#→300°  11:B→150°
//
// The three classical color strategies emerge exactly from the three most
// structurally important musical intervals:
//   Perfect fifth (7 semitones)  → 30°  (analogous)
//   Major third (4 semitones)    → 120° (triadic)
//   Tritone (6 semitones)        → 180° (complementary)
//
// Pre-computed as compile-time constants. Values drawn from
// {0, ±0.5, ±0.8660254037844387, ±1} — the exact trig values at
// multiples of 30°. No runtime Math.cos/sin calls.
const COS_THETA = new Float64Array([
  1.0,                   // C  →   0°
 -0.8660254037844387,    // C# → 210°
  0.5,                   // D  →  60°
  0.0,                   // D# → 270°
 -0.5,                   // E  → 120°
  0.8660254037844387,    // F  → 330°
 -1.0,                   // F# → 180°
  0.8660254037844387,    // G  →  30°
 -0.5,                   // G# → 240°
  0.0,                   // A  →  90°
  0.5,                   // A# → 300°
 -0.8660254037844387,    // B  → 150°
]);

const SIN_THETA = new Float64Array([
  0.0,                   // C  →   0°
 -0.5,                   // C# → 210°
  0.8660254037844387,    // D  →  60°
 -1.0,                   // D# → 270°
  0.8660254037844387,    // E  → 120°
 -0.5,                   // F  → 330°
  0.0,                   // F# → 180°
  0.5,                   // G  →  30°
 -0.8660254037844387,    // G# → 240°
  1.0,                   // A  →  90°
 -0.8660254037844387,    // A# → 300°
  0.5,                   // B  → 150°
]);

// ── EMA accumulators (vector domain — never smooth the angle) ──────────────
// Dual-rate architecture per blueprint §1.5:
//   _slow* (α=0.005, τ≈4.5s) — key-level structure, drives primary hue
//   _fast* (α=0.15,  τ≈150ms) — chord-level reactivity, reserved for WAVE 7690
//
// Smoothing in the vector domain is strictly superior to angle smoothing:
//   - No wraparound pathology (EMA on angle crossing 359°→1° swings through 180°)
//   - Destructive interference is physically correct: when harmony changes
//     rapidly, successive M vectors cancel → |M̄| drops → R drops → system
//     desaturates while "uncertain" and re-saturates when settled.
//     This emergent hesitation requires no extra code.
let _slowMx = 0, _slowMy = 0, _slowW = 0;
let _fastMx = 0, _fastMy = 0, _fastW = 0;

// ── Tuning constants ───────────────────────────────────────────────────────
// GAMMA: sharpness exponent. w_i = c_i^γ.
//   γ=1 → democratic, mushy. γ=2 → dominant-note emphasis (blueprint default).
//   γ=3 → near-discrete (mimics KEY_TO_HUE, safe for initial A/B testing).
//   γ→∞ → degenerates to argmax (back to discrete lookup).
// γ is a continuous dial between "continuous field" and "discrete lookup",
// making migration risk-free: ship at high γ, lower to unlock the field.
const GRAVITY_GAMMA = 3;
const GRAVITY_ALPHA_SLOW = 0.005;
const GRAVITY_ALPHA_FAST = 0.15;
// R_min: below this circular resultant length, hue is noise. Hold previous.
const GRAVITY_R_MIN = 0.08;

// ── Hue hold state ─────────────────────────────────────────────────────────
// When R < R_min (atonal/noise/silence), the hue is mathematically undefined
// (atan2(0,0)). Hold the last valid gravity hue to prevent flicker.
let _lastValidGravityHue = 0;

// ── WAVE 7690: Fast accumulator hue/confidence (for accent derivation) ─────
// H_fast is the chord-level reactive center (α=0.15, τ≈150ms).
// R_fast is its confidence. Both are derived per-frame and consumed by the
// Uranus override block for the accent color.
let _gravityHueFast = 0;
let _gravityRFast = 0;
// Φ(t) stored per-frame for the Uranus override block (secondary/accent/ambient)
let _siderealPhi = 0;

// ═══════════════════════════════════════════════════════════════════════════
// 🌑 WAVE 7688 (URANUS PILLAR III): THE REPULSIVE VOID — Anti-Yellow Forcefield
// ═══════════════════════════════════════════════════════════════════════════
// Under the Circle of Fifths topology (Pillar I), common diatonic material
// lands INSIDE the banned yellow/brown zone [25°, 80°]:
//   C major  → 45°  ⛔ INSIDE
//   A minor  → 75°  ⛔ INSIDE
//   E minor  → 105° ✅ outside
// Two of the three most common triads in popular music sit in the void.
// Without Pillar III, Uranus would emit yellow constantly.
//
// The void is evacuated in two stages:
//   1. RIGID-BODY ROTATION (§3.4): find a single ψ applied to ALL palette
//      colors that minimizes void occupancy. Preserves intervals EXACTLY
//      (rotation is an isometry) — the palette stays genuinely triadic/
//      complementary while escaping the void.
//   2. SOFTPLUS REPULSION (§3.2): per-color smooth-max cleanup for any
//      residual stragglers the rigid rotation couldn't evacuate.
//
// The softplus kernel m(x) = w + s·ln(1 + exp((x−w)/s)) is:
//   - Strictly monotone (derivative = sigmoid > 0 everywhere) ⇒ INJECTIVE
//     (distinct inputs stay distinct — preserves reactivity, unlike hard clamp)
//   - C¹ smooth (no visible snapping)
//   - Exactly the identity far from the void (gain > 0.95 beyond ~43° from center)
//
// Verified numerically (blueprint §3.2):
//   H=45° → 24.91°  (C major escapes downward into red)
//   H=75° → 81.57°  (A minor escapes upward into green)
//   H=90° → 90.63°  (nearly untouched)
//   H=100°→ 100.09° (identity)
// ═══════════════════════════════════════════════════════════════════════════

// ── Void constants ─────────────────────────────────────────────────────────
const VOID_CENTER = 52.5;       // center of [25, 80]
const VOID_HALF_WIDTH = 27.5;   // half-width
const VOID_SOFTNESS = 5;        // softplus softness (degrees)
const VOID_LOW = 25;            // void lower edge
const VOID_HIGH = 80;           // void upper edge

// ── Momentum state for tie-break at exact void center (d=0) ────────────────
// Exit in the direction the hue was already travelling (C⁰ in time, no flicker).
let _prevEscapeSign = 1;

// ── Rigid-body hysteresis state ─────────────────────────────────────────────
// Without hysteresis, the per-frame argmin chatters between equally-good
// rotations. Apply a deadband: accept a new ψ only if it improves J by a
// margin, plus an EMA for smooth transitions.
let _rigidPsiEMA = 0;

/**
 * 🌑 WAVE 7688: Softplus Repulsion Kernel — evacuates a single hue from [25°, 80°].
 *
 * m(x) = w + s·ln(1 + exp((x−w)/s))  lifts the magnitude to at least w,
 * with a smooth transition whose derivative is the logistic sigmoid.
 * Strictly monotone ⇒ injective ⇒ distinct inputs stay distinct.
 *
 * @param h - input hue in degrees [0, 360)
 * @returns hue evacuated outside the void, C¹ smooth, injective
 */
function softplusRepel(h: number): number {
  // Shortest signed angular distance from void center (-180 to 180)
  let d = ((h - VOID_CENTER + 540) % 360) - 180;
  // Softplus magnitude — always ≥ VOID_HALF_WIDTH
  let absD = Math.abs(d);
  let m = VOID_HALF_WIDTH + VOID_SOFTNESS * Math.log(1 + Math.exp((absD - VOID_HALF_WIDTH) / VOID_SOFTNESS));
  // Escape direction: tie-break d=0 with momentum (C⁰ in time)
  let sign = d > 0 ? 1 : (d < 0 ? -1 : _prevEscapeSign);
  _prevEscapeSign = sign;
  return (VOID_CENTER + sign * m + 360) % 360;
}

/**
 * 🌑 WAVE 7688: Void penalty — depth of a hue inside [25°, 80°].
 * Returns 0 if outside the void, positive if inside (deeper = larger).
 * Used by the rigid-body solver to score candidate rotations.
 */
function _voidPenalty(h: number): number {
  // Shortest signed distance from center
  let d = ((h - VOID_CENTER + 540) % 360) - 180;
  let absD = Math.abs(d);
  if (absD >= VOID_HALF_WIDTH) return 0;  // outside void
  // Penalty = depth inside the void (0 at edge, VOID_HALF_WIDTH at center)
  return VOID_HALF_WIDTH - absD;
}

/**
 * 🌑 WAVE 7688: Rigid-Body Palette Evacuation — find a single rotation ψ
 * applied to ALL 4 palette colors that minimizes total void occupancy.
 *
 * Because rotation is an isometry, all pairwise angular distances are
 * preserved EXACTLY — the palette remains genuinely triadic/complementary
 * while evacuating the forbidden zone.
 *
 * Exact cheap solution (blueprint §3.4): J(ψ) is piecewise smooth, minima
 * occur where some color sits exactly on a void edge. Candidate set:
 *   ψ ∈ { edge − h_i : i ∈ {primary,secondary,accent,ambient}, edge ∈ {25, 80} } ∪ {0}
 * = 4 colors × 2 edges + 1 = 9 candidates. Evaluate J at each, take argmin.
 *
 * Hysteresis: accept new ψ only if it improves J by a margin, plus EMA
 * smoothing to prevent chatter.
 *
 * Mutates pal.primary.h, pal.secondary.h, pal.accent.h, pal.ambient.h in place.
 * Zero allocation — all locals are stack scalars.
 */
function _evacuatePaletteRigid(pal: SelenePalette): void {
  const colors = [pal.primary.h, pal.secondary.h, pal.accent.h, pal.ambient.h];

  // ── Build 9 candidate ψ values ──
  // Pre-allocated static array (zero alloc)
  _rigidCandidates[0] = 0;  // ψ=0 (no rotation — always test as baseline)
  let ncand = 1;
  for (let ci = 0; ci < 4; ci++) {
    _rigidCandidates[ncand++] = (VOID_LOW - colors[ci] + 360) % 360;
    _rigidCandidates[ncand++] = (VOID_HIGH - colors[ci] + 360) % 360;
  }

  // ── Evaluate J(ψ) for each candidate ──
  let bestPsi = 0;
  let bestJ = Infinity;
  for (let ci = 0; ci < ncand; ci++) {
    const psi = _rigidCandidates[ci];
    let J = 0;
    for (let ki = 0; ki < 4; ki++) {
      J += _voidPenalty((colors[ki] + psi + 360) % 360);
    }
    // Tie-break toward ψ=0 (smallest disturbance): if J is equal, prefer
    // the candidate closer to 0
    if (J < bestJ - 0.01 || (Math.abs(J - bestJ) < 0.01 && Math.abs(psi) < Math.abs(bestPsi))) {
      bestJ = J;
      bestPsi = psi;
    }
  }

  // ── Hysteresis + EMA ──
  // Only accept a new ψ if it meaningfully improves J, otherwise hold.
  // This prevents chatter between equally-good rotations frame to frame.
  const currentJ = _voidPenalty((pal.primary.h + _rigidPsiEMA + 360) % 360)
    + _voidPenalty((pal.secondary.h + _rigidPsiEMA + 360) % 360)
    + _voidPenalty((pal.accent.h + _rigidPsiEMA + 360) % 360)
    + _voidPenalty((pal.ambient.h + _rigidPsiEMA + 360) % 360);

  if (bestJ < currentJ - 1.0) {
    // Significant improvement — update target ψ
    // EMA the ψ for smooth transition (avoid sudden palette jumps)
    // Handle circular wrap: shortest path
    let delta = bestPsi - _rigidPsiEMA;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    _rigidPsiEMA += delta * 0.3;  // α=0.3, smooth over ~3 frames
    if (_rigidPsiEMA < 0) _rigidPsiEMA += 360;
    if (_rigidPsiEMA >= 360) _rigidPsiEMA -= 360;
  }

  // ── Apply the smoothed ψ to all 4 colors ──
  if (Math.abs(_rigidPsiEMA) > 0.01) {
    pal.primary.h   = (pal.primary.h   + _rigidPsiEMA + 360) % 360;
    pal.secondary.h = (pal.secondary.h + _rigidPsiEMA + 360) % 360;
    pal.accent.h    = (pal.accent.h    + _rigidPsiEMA + 360) % 360;
    pal.ambient.h   = (pal.ambient.h   + _rigidPsiEMA + 360) % 360;
  }
}

// Pre-allocated candidate array for _evacuatePaletteRigid (zero alloc)
const _rigidCandidates = new Float64Array(9);

export class SeleneColorEngine {
  
  // 🎯 WAVE 2096.1: Deterministic frame counter for throttled logging (replaces Math.random)
  private static generateCallCount = 0;
  
  // 🔌 WAVE 65: Smart Logging - Tracking para evitar logs repetitivos
  private static lastLoggedKey: string | null = null;
  private static lastLoggedStrategy: string | null = null;
  private static lastLoggedVibe: string | null = null;
  private static logCooldownFrames = 0;
  private static readonly LOG_COOLDOWN = 180;  // 3 segundos entre logs similares

  // ═══════════════════════════════════════════════════════════════════
  // WAVE 0-ALLOC: Static pre-allocated scratch objects for generate()
  // ═══════════════════════════════════════════════════════════════════
  private static _scratchPalette: SelenePalette = {
    primary:   { h: 0, s: 0, l: 0 },
    secondary: { h: 0, s: 0, l: 0 },
    accent:    { h: 0, s: 0, l: 0 },
    ambient:   { h: 0, s: 0, l: 0 },
    contrast:  { h: 0, s: 0, l: 0 },
    meta: {
      strategy: 'analogous',
      temperature: 'neutral',
      description: '',
      confidence: 1.0,
      transitionSpeed: 1200,
    },
  };

  private static _effectiveOptions: GenerationOptions = {};

  private static _wave8Fallback: {
    harmony: { key: string | null; mode: string; mood: string };
    rhythm: { syncopation: number };
    genre: { primary: string };
    section: { type: string };
  } = {
    harmony: { key: null, mode: 'minor', mood: 'universal' },
    rhythm: { syncopation: 0 },
    genre: { primary: 'unknown' },
    section: { type: 'unknown' },
  };
  
  /**
   * 🔬 WAVE 65: CHROMATIC AUDIT LOG
   * 
   * Log compacto en formato JSON que se dispara SOLO cuando:
   * - Cambia la key musical
   * - Cambia la estrategia de color
   * - Cambia el vibe activo
   * - O han pasado 3 segundos desde el último log
   * 
   * @param data - Datos del análisis actual
   * @param palette - Paleta generada
   * @param vibeId - ID del vibe activo
   * @param overrideReason - Razón del override si aplica
   */
  static logChromaticAudit(
    data: { key: string | null; mood: string | null; energy: number },
    palette: SelenePalette,
    vibeId: string = 'unknown',
    overrideReason: string | null = null
  ): void {
    const currentKey = data.key || 'null';
    const currentStrategy = palette.meta.strategy;
    
    // Decrementar cooldown
    if (this.logCooldownFrames > 0) {
      this.logCooldownFrames--;
    }
    
    // Solo loguear si algo cambió O pasó el cooldown
    const keyChanged = currentKey !== this.lastLoggedKey;
    const strategyChanged = currentStrategy !== this.lastLoggedStrategy;
    const vibeChanged = vibeId !== this.lastLoggedVibe;
    const cooldownExpired = this.logCooldownFrames === 0;
    
    if (keyChanged || strategyChanged || vibeChanged || cooldownExpired) {
      // Calcular temperatura en Kelvin aproximada
      // Warm = 2700-3500K, Neutral = 4000-5000K, Cool = 5500-6500K
      let tempKelvin = 4500;
      
      const effectiveTemp = palette.meta.temperature;
      
      if (effectiveTemp === 'warm') {
        tempKelvin = 3000 + Math.floor(palette.primary.h / 360 * 500);
      } else if (effectiveTemp === 'cool') {
        tempKelvin = 5500 + Math.floor((360 - palette.primary.h) / 360 * 1000);
      }
      
      const audit = {
        vibe: vibeId,
        key: currentKey,
        strategy: currentStrategy,
        reason: overrideReason || 'vibe_optimal',
        temp: tempKelvin,
        mood: data.mood || 'neutral',
        hue: Math.round(palette.primary.h),
        sat: Math.round(palette.primary.s),
        light: Math.round(palette.primary.l),  // 🛡️ WAVE 83: Añadido L para diagnóstico completo
        energy: Math.round(data.energy * 100)
      };
      
      // 🔇 WAVE 982.5: Silenciado (arqueología del día 2)
      // console.log(`[COLOR_AUDIT] 🎨 ${JSON.stringify(audit)}`);
      
      // Actualizar tracking
      this.lastLoggedKey = currentKey;
      this.lastLoggedStrategy = currentStrategy;
      this.lastLoggedVibe = vibeId;
      this.logCooldownFrames = this.LOG_COOLDOWN;
    }
  }
  
  /**
   * Genera una paleta cromática completa a partir del análisis de audio
   * 
   * @param data - Análisis de audio extendido (ExtendedAudioAnalysis)
   * @param options - Opciones de generación (WAVE 142: Vibe Constraints)
   * @returns Paleta de 5 colores HSL con metadata
   */
  static generate(data: ExtendedAudioAnalysis, options?: GenerationOptions): SelenePalette {
    // 🎯 WAVE 2096.1: Deterministic frame counter (replaces Math.random for log throttling)
    this.generateCallCount++;

    // ══════════════════════════════════════════════════════════════════════
    // 🎹 WAVE 7686 (URANUS PILLAR 0): ZERO-ALLOC CHROMAGRAM MIRROR
    // Copy incoming 12-bin chroma into the module-level Float64Array.
    // 12 float stores, zero allocation. Falls back to zeros when no audio
    // (silence, Chronos phantom mode, or pre-audio initialization).
    // Downstream Uranus math (Pillar I/III) reads exclusively from this mirror.
    // ══════════════════════════════════════════════════════════════════════
    if (data.chroma && data.chroma.length === 12) {
      for (let i = 0; i < 12; i++) {
        _chromaMirror[i] = data.chroma[i];
      }
    } else {
      _chromaMirror.fill(0);
    }

    // ══════════════════════════════════════════════════════════════════════
    // 🌌 WAVE 7687 (URANUS PILLAR I): BARYCENTRIC CHROMATIC MASS
    // ══════════════════════════════════════════════════════════════════════
    // Compute the circular first moment of the chroma energy vector over the
    // Circle of Fifths basis. The hue is atan2(M_y, M_x); the confidence R
    // (Rayleigh's resultant length) arrives free and measures tonal purity.
    //
    // Weighting: w_i = c_i^γ (γ=3 for initial stability — near-discrete).
    // Smoothing: EMA in the VECTOR domain (never the angle) — dual-rate.
    //
    // Cost: 12 × (1 pow + 2 mul + 3 add) + 2 EMA updates ≈ 80 flops.
    // Zero allocation — all state is module-level.
    // ══════════════════════════════════════════════════════════════════════
    let rawMx = 0, rawMy = 0, rawW = 0;
    for (let i = 0; i < 12; i++) {
      const c = _chromaMirror[i];
      if (c <= 0) continue;  // skip silent bins — pow(0,γ)=0 anyway
      const w = Math.pow(c, GRAVITY_GAMMA);
      rawMx += w * COS_THETA[i];
      rawMy += w * SIN_THETA[i];
      rawW  += w;
    }
    // EMA the vector (not the angle) — dual-rate accumulators
    _slowMx = (1 - GRAVITY_ALPHA_SLOW) * _slowMx + GRAVITY_ALPHA_SLOW * rawMx;
    _slowMy = (1 - GRAVITY_ALPHA_SLOW) * _slowMy + GRAVITY_ALPHA_SLOW * rawMy;
    _slowW  = (1 - GRAVITY_ALPHA_SLOW) * _slowW  + GRAVITY_ALPHA_SLOW * rawW;
    _fastMx = (1 - GRAVITY_ALPHA_FAST) * _fastMx + GRAVITY_ALPHA_FAST * rawMx;
    _fastMy = (1 - GRAVITY_ALPHA_FAST) * _fastMy + GRAVITY_ALPHA_FAST * rawMy;
    _fastW  = (1 - GRAVITY_ALPHA_FAST) * _fastW  + GRAVITY_ALPHA_FAST * rawW;

    // Derive hue and confidence from the SLOW (structural) accumulators
    const _gravityHueRaw = (Math.atan2(_slowMy, _slowMx) * 180 / Math.PI + 360) % 360;
    const _gravityR   = _slowW > 0
      ? Math.sqrt(_slowMx * _slowMx + _slowMy * _slowMy) / _slowW
      : 0;

    // Derive hue and confidence from the FAST (chord-level) accumulators
    // Used by WAVE 7690 for the accent color (reactive chord-level center)
    const _gravityHueFastRaw = (Math.atan2(_fastMy, _fastMx) * 180 / Math.PI + 360) % 360;
    _gravityRFast = _fastW > 0
      ? Math.sqrt(_fastMx * _fastMx + _fastMy * _fastMy) / _fastW
      : 0;

    // ══════════════════════════════════════════════════════════════════════
    // 🌌 WAVE 7689 (URANUS PILLAR II): RELATIVISTIC SIDEREAL RING — Φ(t)
    // ══════════════════════════════════════════════════════════════════════
    // Quasi-periodic global angular precession applied to the barycentric hue.
    // Rotation is an ISOMETRY of the circle: preserves all pairwise angular
    // distances exactly → the 30°/120°/180° interval structure (analogous/
    // triadic/complementary) is invariant under the drift. Only the absolute
    // anchoring moves.
    //
    // Reactivity gain theorem (blueprint §2.1):
    //   G_clamp      = 0        (dead — non-injective)
    //   G_gamut(7684)= 40/360   (11.1% — compressed)
    //   G_rotation   = 1        (100% — isometry, bijective)
    //
    // Φ(t) = Φ₀ + ω₁·t + A₂·sin(ω₂·t) + A₃·sin(ω₃·t)
    //   T₁ = 45 min  (primary revolution, 8°/min)
    //   T₂ = 27.8 min (T₁/φ, golden ratio → irrational → never closes)
    //   T₃ = 17.2 min (T₂/φ)
    // The golden-ratio period relationship makes the trajectory aperiodic —
    // the combination of primary hue and act character never exactly recurs
    // within a realistic set length (Lissajous on a torus, irrational winding).
    //
    // Timescale separation: |dΦ/dt| ≈ 0.13°/s vs |dH_audio/dt| ≈ 1-10°/s
    // → 1-2 orders of magnitude separation. Audio response is instantaneous,
    // the ring is invisible-but-cumulative (8°/min, below JND for short windows,
    // full revolution per 45 min).
    //
    // Only active when useChromagramGravity is true (gated with Pillar I).
    // Cost: 3 sin + ~5 mul/add per frame. Zero allocation.
    // ══════════════════════════════════════════════════════════════════════
    let _gravityHue = _gravityHueRaw;
    _siderealPhi = 0;  // reset per frame (0 when gravity is off)
    _gravityHueFast = _gravityHueFastRaw;  // unrotated fast hue (updated below if gravity on)
    if (options?.useChromagramGravity) {
      const tMin = performance.now() / 60000;
      // Φ₀ seeded from SIDEREAL_SESSION_OFFSET (WAVE 7680) — no two sessions
      // start at the same angle. Scale ms to degrees: mod 360000 → /1000.
      const Phi0 = (SIDEREAL_SESSION_OFFSET % 360000) / 1000;
      // Angular frequencies (radians per minute) — golden ratio periods
      const w2_rad = (2 * Math.PI) / 27.8;
      const w3_rad = (2 * Math.PI) / 17.2;
      // Φ(t) in degrees: linear drift (8°/min) + two incommensurable harmonics
      const Phi = Phi0 + (8 * tMin) + 25 * Math.sin(w2_rad * tMin) + 10 * Math.sin(w3_rad * tMin);
      // Store Φ for the WAVE 7690 override block (secondary/accent/ambient)
      _siderealPhi = Phi;
      // Apply the isometry: rotate the barycentric hue by Φ
      // Large modulo (360000) handles negative Phi safely before final % 360
      _gravityHue = (_gravityHueRaw + Phi + 360000) % 360;
      // Also rotate the fast hue — same isometry applies to both rates
      _gravityHueFast = (_gravityHueFastRaw + Phi + 360000) % 360;
    }

    // === A. EXTRAER DATOS CON FALLBACKS ===
    // WAVE 0-ALLOC: Use static _wave8Fallback instead of creating new object
    const wave8 = data.wave8 || SeleneColorEngine._wave8Fallback;
    
    const key = wave8.harmony.key || data.key || null;
    const mode = wave8.harmony.mode || 'minor';
    // 🎭 WAVE 2204: PURGA LEGACY — data.mood (MoodArbiter, ventana 2s) tiene prioridad absoluta
    // wave8.harmony.mood era el crudo del HarmonyDetector (cambia cada frame, sin histéresis)
    // Ahora usamos el meta-estado estabilizado que viaja en la raíz del objeto
    // 🔒 WAVE 2204.1: .toLowerCase() defensivo — TitanEngine ya convierte BRIGHT→'bright',
    // pero por si algún path futuro inyecta el enum en mayúsculas, blindamos la comparación.
    const activeMood = String(data.mood || 'neutral').toLowerCase();
    const syncopation = wave8.rhythm.syncopation ?? data.syncopation ?? 0;
    const energy = Number.isFinite(data.energy) ? clamp(data.energy, 0, 1) : 0.5;
    
    // 🎨 WAVE 90: Detectar vibeId temprano (necesario para Golden Reversal)
    const vibeId = data.vibeId || 'idle';
    
    // === B. DETERMINAR HUE BASE (Matemática Pura) ===
    // 🎨 WAVE 68.5: PURE COLOR - Solo Key, Mode y Mood
    // NO género, NO bias, solo matemática musical pura
    // 🔥 WAVE 74: MOOD OVERRIDE - Si mood es 'bright', forzar Hue cálido
    // 🎯 WAVE 161.5: LATINO EXCEPTION - No restringir hue para permitir triadic
    let baseHue = 120; // Default: Verde (neutro)
    // WAVE 0-ALLOC: hueSource as numeric code instead of template literal
    // 0=default, 1=key, 2=key(tropical-bias), 3=mood
    let hueSourceCode = 0;
    
    // 🎯 WAVE 161.5 / WAVE 4760: Hue libre cuando la constitución suprime el tropical bias
    // (o cuando el Sidereal Clock gestiona la zona cromática).
    // Se deriva de la constitución, no del nombre del vibe.
    const isLatinoHueFree = options?.suppressTropicalBias !== undefined || options?.tropicalAmbientBias === true;
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🔓 WAVE 285.5: KEY IDENTITY LIBERATION
    // ═══════════════════════════════════════════════════════════════════════
    // ANTES (WAVE 74): mood 'bright' → keyHue % 60 → DESTRUÍA la identidad de Key
    //   - D major (60°) → 0° (rojo)
    //   - E major (120°) → 0° (rojo)
    //   - A major (270°) → 30° (naranja)
    //   ¡TODAS las keys major colapsaban a solo 2 valores!
    //
    // AHORA: La Key SIEMPRE determina el Hue base. El mood y la constitución
    // (thermalGravity + hueRemapping + forbiddenHueRanges) ajustan el resultado
    // SIN destruir la identidad cromática de la Key.
    //
    // La temperatura y la estrategia son FILTROS, no DICTADORES.
    // ═══════════════════════════════════════════════════════════════════════
    
    if (key && KEY_TO_HUE[key] !== undefined) {
      // Comportamiento original: Key determina Hue
      // 🎯 WAVE 161.5: Latino SIEMPRE usa este path (Key completa)
      baseHue = KEY_TO_HUE[key];
      
      // 🌴 WAVE 162: TROPICAL BIAS - Latino rota keys frías hacia cálidos
      // Problema: A=270°, E=120°, F=150° son fríos, pero Latino quiere fiesta
      // Solución: Keys en zona fría (150-270°) rotan hacia zona cálida
      // 🚫 WAVE 3490: suppressTropicalBias desactiva esto cuando el Sidereal Clock gestiona la zona
      if (isLatinoHueFree && !options?.suppressTropicalBias && baseHue >= 150 && baseHue <= 270) {
        // Rotar hacia zona tropical: 0-60° (rojos/naranjas) o 300-360° (magentas)
        // Alternar según paridad del root para variedad
        const root = KEY_TO_ROOT[key] ?? 0;
        if (root % 2 === 0) {
          // Par: Rotar hacia naranjas (30-50°)
          baseHue = 30 + (baseHue % 30);  // 30-59°
        } else {
          // Impar: Rotar hacia magentas (300-330°)
          baseHue = 300 + (baseHue % 30); // 300-329°
        }
      }
      hueSourceCode = isLatinoHueFree ? 2 : 1;
    } else if (activeMood && MOOD_HUES[activeMood] !== undefined) {
      baseHue = MOOD_HUES[activeMood];
      hueSourceCode = 3;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 🌌 WAVE 7687 (URANUS PILLAR I): GRAVITY HUE OVERRIDE
    // ═══════════════════════════════════════════════════════════════════════
    // When useChromagramGravity is enabled, override baseHue with the
    // barycentric hue from the chroma vector. Mode modifiers, mood drift,
    // thermal gravity, and all constitutional enforcement still apply
    // downstream — the gravity hue IS the new "key hue".
    //
    // R (Rayleigh's resultant length) gates the output:
    //   R > R_min → tonal content present, use gravity hue
    //   R ≤ R_min → atonal/noise/silence, hold last valid hue to prevent
    //               flicker (atan2(0,0) is undefined and numerically unstable)
    //
    // When the flag is OFF (default), the legacy KEY_TO_HUE path above is
    // untouched — zero behaviour change, enabling safe A/B testing.
    // ═══════════════════════════════════════════════════════════════════════
    if (options?.useChromagramGravity) {
      if (_gravityR > GRAVITY_R_MIN) {
        baseHue = _gravityHue;
        _lastValidGravityHue = _gravityHue;
        hueSourceCode = 1;  // treat as key-derived for logging
      } else {
        // Atonal/silence: hold the last valid gravity hue
        baseHue = _lastValidGravityHue;
        hueSourceCode = 1;
      }
    }

    // === C. APLICAR MODIFICADORES DE MODO ===
    const modeMod = MODE_MODIFIERS[mode] || MODE_MODIFIERS['minor'];
    
    // 🎲 WAVE 2204: CHROMATIC DRIFT (El Desestancador)
    // El 'activeMood' ya viene purificado y estabilizado (ventana 2s) desde el MoodArbiter.
    // Resuelve el "congelamiento cromático" del Harmonic Mixing: misma Key durante minutos
    // → el color ahora respira según la tensión emocional de la pista.
    let moodDrift = 0;
    
    if (activeMood === 'bright') {
      moodDrift = 30;   // Empuje hacia análogos cálidos/brillantes (Tensión/Euforia)
    } else if (activeMood === 'dark') {
      moodDrift = -30;  // Empuje hacia análogos fríos/profundos (Valle/Oscuridad)
    }
    // Si es 'neutral', moodDrift es 0 (Se mantiene el color puro de la Key)

    // El Hue final es: Base + Modo + Deriva Emocional (SIN GÉNERO)
    let finalHue = normalizeHue(baseHue + modeMod.hue + moodDrift);

    // 📡 WAVE 2204.1: DRIFT RADAR — Chivato de consola para confirmar que el Arbiter late
    // ⛔ WAVE 2791: Comentado — mood forzado a 'neutral', siempre muestra Drift: 0° (spam inútil)
    // Re-enable cuando se reactive la inyección de mood en TitanEngine.
    // if (this.generateCallCount % 60 === 0) {
    //   console.log(`[DRIFT RADAR] In: '${data.mood}' -> Act: '${activeMood}' | Drift: ${moodDrift > 0 ? '+' : ''}${moodDrift}° | BaseHue: ${baseHue}° | FinalHue: ${finalHue.toFixed(0)}°`);
    // }

    // 🌡️ WAVE 149.6: THERMAL GRAVITY - Aplicar Gravedad Térmica
    // Antes de restricciones constitucionales, el hue se aclimata al clima del Vibe.
    // Techno (9500K) → arrastra hacia Azul Rey (240°)
    // Latino (3000K) → arrastra hacia Oro (40°)
    // Idle (6500K) → sin gravedad (neutro)
    // 🌬️ WAVE 284: Ahora usa thermalGravityStrength configurable
    finalHue = applyThermalGravity(finalHue, options?.atmosphericTemp, options?.thermalGravityStrength);
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🏛️ WAVE 144: CONSTITUTIONAL HUE ENFORCEMENT
    // ═══════════════════════════════════════════════════════════════════════
    // Aplicar las restricciones de hue según la Constitución del Vibe activo.
    // Orden de aplicación:
    //   1. hueRemapping (mapeos forzados)
    //   2. forbiddenHueRanges (Elastic Rotation)
    //   3. allowedHueRanges (snap to nearest)
    // ═══════════════════════════════════════════════════════════════════════
    
    // 1️⃣ HUE REMAPPING: Mapeos forzados de zonas cromáticas
    // Ejemplo: Rock mapea verde (80-160) → rojo (0)
    let remapApplied = false;
    if (options?.hueRemapping) {
      for (const mapping of options.hueRemapping) {
        const { from, to, target } = mapping;
        const isInRange = from <= to
          ? (finalHue >= from && finalHue <= to)
          : (finalHue >= from || finalHue <= to);  // wrap-around
        
        if (isInRange) {
          finalHue = normalizeHue(target);
          remapApplied = true;
          break;  // Solo aplicar el primer match
        }
      }
    }
    
    // 2️⃣ FORBIDDEN HUE RANGES: Softplus Repulsion (WAVE 7688 — Uranus Pillar III)
    // ═══════════════════════════════════════════════════════════════════════
    // ANTES (WAVE 144): Elastic Rotation — iteratively +elasticStep until
    // escaping the forbidden zone. Non-injective (many inputs → same border),
    // quantized to elasticStep granularity, up to 24 iterations per color.
    //
    // AHORA (WAVE 7688): Softplus Repulsion Kernel — smooth, monotone, injective.
    // m(x) = w + s·ln(1 + exp((x−w)/s)) lifts the hue outside the void with
    // a C¹ transition whose derivative is the logistic sigmoid. Distinct
    // inputs stay distinct (preserves audio reactivity). Gain > 0.95 beyond
    // ~43° from void center — effectively the identity outside [10°, 95°].
    //
    // The [25°, 80°] void is the hardcoded anti-yellow zone. Constitutions
    // may declare additional forbiddenHueRanges — those are still handled
    // by the palette-wide enforcement block (WAVE 149.5, now using the
    // rigid-body + softplus pipeline).
    // ═══════════════════════════════════════════════════════════════════════
    finalHue = softplusRepel(finalHue);

    // 3️⃣ ALLOWED HUE RANGES: Gamut Mapping (WAVE 7684)
    // Si el hue cae fuera de todos los rangos permitidos, mapearlo
    // proporcionalmente al rango más cercano en vez de clavarlo al borde.
    // ⚠️ WAVE 286 BUG FIX: [0, 360] debe significar "todo permitido"
    // 🌌 WAVE 7689: BYPASS cuando useChromagramGravity — Φ(t) ya rotó el hue,
    // clavarlo a un rango destruiría la isometría (G=1 → G<<1).
    if (!options?.useChromagramGravity && options?.allowedHueRanges && options.allowedHueRanges.length > 0) {
      // 🛡️ CHECK: Si el rango es [0, 360] o similar (abarca todo), skip
      const isFullCircle = options.allowedHueRanges.some(([min, max]) => {
        return (max - min) >= 359 || (min === 0 && max >= 359);
      });

      if (!isFullCircle) {
        finalHue = gamutMapHue(finalHue, options.allowedHueRanges);
      }
    }
    
    // === D. ENERGÍA → SATURACIÓN Y BRILLO ===
    // ═══════════════════════════════════════════════════════════════════════
    // 🛡️ WAVE 87: SATURATION GUARD - Evitar "whitewashing"
    // ═══════════════════════════════════════════════════════════════════════
    // PROBLEMA: baseLight llegaba a 95% con alta energía, lavando los colores.
    // SOLUCIÓN: Mantener L cerca del 50% (color puro). La "fuerza" visual
    // vendrá del canal DIMMER (Intensity), no de HSL Lightness.
    // ═══════════════════════════════════════════════════════════════════════
    
    // 🌴 WAVE 87: Nuevo cálculo de Lightness (más conservador)
    // - Base: 50% (color puro)
    // - Influencia de energía: máximo +10% (antes era +70%)
    // - Rango final: 50-60% (antes 25-95%)
    const baseSat = 85 + (energy * 15);   // 🛡️ WAVE 87: Siempre >85%, máx 100%
    const baseLight = 50 + (energy * 10); // 🛡️ WAVE 87: 50-60% (antes 25-95%)
    
    // Aplicar solo modifiers de modo (SIN GÉNERO BOOST)
    const primarySat = clamp(
      baseSat + modeMod.sat,
      70,   // 🛡️ WAVE 87: Mínimo 70% (antes 20%)
      100
    );
    
    const primaryLight = clamp(
      baseLight + modeMod.light,
      35,  // Mínimo absoluto
      60   // 🛡️ WAVE 87: Máximo 60% (antes 95%) - ANTI-WHITEWASH
    );
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🛡️ WAVE 81: ANTI-MUD PROTOCOL (VIBRANCY ENFORCEMENT)
    // Evitar que la baja energía cree colores marrones/sucios en contextos festivos.
    // ═══════════════════════════════════════════════════════════════════════
    
    // Variables mutables para permitir corrección Anti-Mud
    let correctedSat = primarySat;
    let correctedLight = primaryLight;
    
    // Detectar si el contexto requiere pureza de color (mood festivo)
    // 🎭 WAVE 2204: activeMood solo tiene 3 estados (bright/dark/neutral)
    const isFestiveContext = activeMood === 'bright';
    
    // Detectar contexto oscuro (Techno, Dark, etc)
    const isDarkContext = activeMood === 'dark';
    
    if (isFestiveContext) {
      // 1. Detección de "Zona de Peligro Marrón" (Naranjas/Amarillos oscuros)
      // Hue 20-55 es naranja/amarillo. Si L < 0.45, se ve marrón/sucio.
      const isDangerZone = finalHue > 20 && finalHue < 55;
      
      if (isDangerZone) {
        // 🎨 FORZAR LUMINOSIDAD MÍNIMA:
        // Mantenemos el pigmento vivo. Si la energía baja, que baje el DIMMER,
        // pero NO la luminosidad del color HSL.
        correctedLight = Math.max(correctedLight, 45);
        
        // 🎨 BOOST DE SATURACIÓN:
        // Los amarillos/naranjas necesitan mucha saturación para no parecer beige.
        correctedSat = Math.max(correctedSat, 80);
      } else {
        // Suelo general para vibes festivas (evitar grises en cualquier hue)
        correctedLight = Math.max(correctedLight, 30);
        correctedSat = Math.max(correctedSat, 60);
      }
    }
    
    if (isDarkContext) {
      // 2. TECHNO / DARK CONTEXT (Permitir oscuridad, pero evitar lavado)
      // Permitir L bajo (deep colors), pero mantener S alta para colores "neón"
      correctedSat = Math.max(correctedSat, 70);
    }
    
    // Aplicar clamps finales
    // 🛡️ WAVE 87: Límites más estrictos para evitar whitewashing
    // 🎛️ WAVE 142: GenerationOptions pueden sobrescribir estos límites
    // ⏱️ WAVE 3490: SIDEREAL CLOCK — override de allowedHueRanges y lightnessRange
    // Se resuelve aquí, justo antes de los clamps, para que el slot activo
    // determine el espacio cromático real sin tocar el resto del pipeline.
    // WAVE 0-ALLOC: Mutate static _effectiveOptions instead of spread
    let effectiveOptions = options;
    if (options?.siderealClock) {
      const clock = options.siderealClock;
      if (clock.slots && clock.slots.length > 0) {
        const slotIndex = Math.floor((performance.now() + SIDEREAL_SESSION_OFFSET) / clock.slotDurationMs) % clock.slots.length;
        const slot = clock.slots[slotIndex];
        // Copy all fields from options into _effectiveOptions without spread
        const eo = SeleneColorEngine._effectiveOptions;
        eo.forbiddenHueRanges = options.forbiddenHueRanges;
        eo.saturationRange = options.saturationRange;
        eo.lightnessRange = slot.lightnessRange;
        eo.atmosphericTemp = options.atmosphericTemp;
        eo.thermalGravityStrength = options.thermalGravityStrength;
        eo.elasticRotation = options.elasticRotation;
        eo.hueRemapping = options.hueRemapping;
        eo.forceStrategy = options.forceStrategy;
        eo.neonProtocol = options.neonProtocol;
        eo.mudGuard = options.mudGuard;
        eo.ambientLock = options.ambientLock;
        eo.tropicalMirror = options.tropicalMirror;
        eo.tropicalAmbientBias = options.tropicalAmbientBias;
        eo.suppressTropicalBias = options.suppressTropicalBias;
        eo.fibonacciRotationDeg = options.fibonacciRotationDeg;
        eo.saltChromaticKeys = options.saltChromaticKeys;
        eo.luxurySignatures = options.luxurySignatures;
        eo.oceanicModulation = options.oceanicModulation;
        eo.transitionConfig = options.transitionConfig;
        // 🌌 WAVE 7689 (URANUS PILLAR II): DESTROY THE WALL
        // When useChromagramGravity is active, the Relativistic Sidereal Ring
        // (Φ(t) rotation, applied above to _gravityHue) replaces the slot-based
        // hue clamping. Slots now ONLY modulate lightness, saturation, and
        // drift rate — NEVER restrict hue boundaries.
        //
        // Reactivity gain: G_rotation = 1 (isometry, 100% reactivity) vs
        // G_gamutMap = (max-min)/360 (compressed, e.g. 11% for BUNKER [170,210]).
        // The window itself was the problem — rotation eliminates it.
        //
        // When the flag is OFF, legacy behaviour is preserved: slots still
        // impose allowedHueRanges via gamutMapHue (WAVE 7684).
        if (options?.useChromagramGravity) {
          // Uranus mode: no hue boundaries from slots. Φ(t) handles drift.
          eo.allowedHueRanges = undefined;
          eo.useChromagramGravity = true;
        } else {
          // Legacy mode: slots constrain hue via allowedHueRanges
          eo.allowedHueRanges = slot.allowedHueRanges;
          eo.useChromagramGravity = undefined;
        }
        effectiveOptions = eo;
        // 🎯 WAVE 7684: GAMUT MAPPING para el Sidereal Clock (LEGACY path only).
        // ANTES: snap al CENTRO del rango más cercano → todas las keys
        // caían en el mismo grado (ej: 190°) sin importar la música.
        // AHORA: mapeo proporcional → cada key audio-derivada produce un
        // grado distinto dentro del slot, preservando la reactividad musical.
        //
        // 🌌 WAVE 7689: BYPASS total cuando useChromagramGravity está activo.
        // Φ(t) ya rotó el hue — clavarlo al slot destruiría la isometría.
        if (!options?.useChromagramGravity && slot.allowedHueRanges && slot.allowedHueRanges.length > 0) {
          const isFullCircle = slot.allowedHueRanges.some(([mn, mx]) => (mx - mn) >= 359 || (mn === 0 && mx >= 359));
          if (!isFullCircle) {
            finalHue = gamutMapHue(finalHue, slot.allowedHueRanges);
          }
        }
      }
    }
    const satMin = effectiveOptions?.saturationRange?.[0] ?? 70;
    const satMax = effectiveOptions?.saturationRange?.[1] ?? 100;
    const lightMin = effectiveOptions?.lightnessRange?.[0] ?? 35;
    const lightMax = effectiveOptions?.lightnessRange?.[1] ?? 60;
    
    correctedSat = clamp(correctedSat, satMin, satMax);
    correctedLight = clamp(correctedLight, lightMin, lightMax);
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🌊 WAVE 1072: THE OCEAN TRANSLATOR - Oceanic Modulation
    // ═══════════════════════════════════════════════════════════════════════
    // Si oceanicModulation está activo, modulamos el hue, sat y light
    // basándonos en la profundidad oceánica traducida a contexto musical.
    // Esto reemplaza el viejo "colorOverride" que bypaseaba el engine.
    // ═══════════════════════════════════════════════════════════════════════
    if (options?.oceanicModulation?.enabled) {
      const ocean = options.oceanicModulation;
      
      // 1. HUE BLEND: Mezclar hue actual con influencia oceánica
      // La fuerza determina cuánto "arrastra" el océano el color hacia su sugestión
      const hueDiff = ocean.hueInfluence - finalHue;
      // Normalizar la diferencia para el camino más corto en el círculo
      const normalizedDiff = ((hueDiff + 180) % 360) - 180;
      finalHue = normalizeHue(finalHue + normalizedDiff * ocean.hueInfluenceStrength);
      
      // 2. SATURATION MOD: Aplicar modificador oceánico
      correctedSat = clamp(correctedSat + ocean.saturationMod, satMin, satMax);
      
      // 3. LIGHTNESS MOD: Aplicar modificador oceánico
      correctedLight = clamp(correctedLight + ocean.lightnessMod, lightMin, lightMax);
      
      // 4. BREATHING: Modulación sutil por audio (±15%)
      // Afecta tanto saturación como luminosidad para "pulso vital"
      const breathDelta = (ocean.breathingFactor - 1.0) * 10; // ±1.5 aprox
      correctedSat = clamp(correctedSat + breathDelta, satMin, satMax);
      correctedLight = clamp(correctedLight + breathDelta * 0.5, lightMin, lightMax);
      
      // Log de modulación oceánica (deterministic throttle — ~1% of frames)
      // 🎯 WAVE 2096.1: Replaced Math.random() with deterministic counter (Axiom Anti-Simulación)
      if (this.generateCallCount % 100 === 0) {
        console.log(
          `[🌊 OCEAN→COLOR] Zone:${ocean.zone ?? '?'} Depth:${ocean.depth?.toFixed(0) ?? '?'}m | ` +
          `Hue:${finalHue.toFixed(0)}° (influence:${ocean.hueInfluence.toFixed(0)}° @${(ocean.hueInfluenceStrength*100).toFixed(0)}%) | ` +
          `S:${correctedSat.toFixed(0)} L:${correctedLight.toFixed(0)}`
        );
      }
    }
    
    // === E. COLOR PRIMARIO ===
    // 🛡️ WAVE 81: Usar valores corregidos por Anti-Mud Protocol
    // WAVE 0-ALLOC: Mutate scratch palette in place
    const pal = SeleneColorEngine._scratchPalette;
    pal.primary.h = finalHue;
    pal.primary.s = correctedSat;
    pal.primary.l = correctedLight;
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🎯 WAVE 7684: STRATEGY-FIRST PALETTE DERIVATION
    // ═══════════════════════════════════════════════════════════════════════
    // PROBLEMA: El secondary SIEMPRE usaba Fibonacci (≈222.5°) sin importar
    // la estrategia. Cuando el UI decía "Analogous", el secondary estaba a
    // 222.5° del primary — matemáticamente near-complementary. El label
    // solo describía el accent, no la paleta completa.
    //
    // SOLUCIÓN: Resolver la estrategia PRIMERO, luego derivar el secondary
    // según la estrategia:
    //   - Analogous:    secondary = primary + 15°  (cluster adyacente tight)
    //   - Triadic:      secondary = primary + Fibonacci (contraste dorado)
    //   - Complementary: secondary = primary + Fibonacci (contraste dorado)
    //
    // El Fibonacci se reserva para estrategias de ALTO contraste donde la
    // variedad infinita es deseable. En Analogous, la paleta forma un
    // cluster verdadero: Primary + Secondary(+15°) + Accent(+30°) + Ambient(-30°).
    // ═══════════════════════════════════════════════════════════════════════

    // === F1. CONSTANTES (Fibonacci + Salt) ===
    // 🎨 WAVE 90 / WAVE 4760: Rotación configurable vía constitución.
    const fibonacciRotation = options?.fibonacciRotationDeg ?? PHI_ROTATION;

    // 🧂 WAVE 94.2 / WAVE 4760: Salt cromático configurable vía constitución.
    let saltRotation = 0;
    if (key && options?.saltChromaticKeys) {
      const keyIndex = KEY_TO_ROOT[key];
      if (keyIndex !== undefined) {
        saltRotation = options.saltChromaticKeys[keyIndex] ?? 0;
      }
    }

    // === F2. RESOLVER ESTRATEGIA (movido arriba, antes del secondary) ===
    // 🎨 WAVE 91: STRATEGY THRESHOLDS - Alineado con StrategyArbiter (0.40-0.65)
    // 🎛️ WAVE 142: forceStrategy puede sobrescribir la decisión
    let accentHue: number;
    let strategy: 'analogous' | 'triadic' | 'complementary';

    if (options?.forceStrategy && options.forceStrategy !== 'prism') {
      strategy = options.forceStrategy;
      switch (strategy) {
        case 'analogous':
          accentHue = finalHue + 30;
          break;
        case 'triadic':
          accentHue = finalHue + 120;
          break;
        case 'complementary':
          accentHue = finalHue + 180;
          break;
      }
    } else if (options?.forceStrategy === 'prism') {
      // 🔮 PRISM: Estrategia especial de Techno (Tetraédrica)
      strategy = 'complementary';  // Label para metadata
      accentHue = finalHue + 180;
    } else {
      // Decisión basada solo en syncopation
      if (syncopation < 0.40) {
        strategy = 'analogous';
        accentHue = finalHue + 30;   // Vecino
      } else if (syncopation < 0.65) {
        strategy = 'triadic';
        accentHue = finalHue + 120;  // Triángulo
      } else {
        strategy = 'complementary';
        accentHue = finalHue + 180;  // Opuesto
      }
    }

    // === F3. COLOR SECUNDARIO (Strategy-Obedient) ===
    // WAVE 7684: El secondary ahora obedece la estrategia.
    //   - Analogous: +15° del primary → cluster monochromatic/adjacent tight
    //   - Triadic/Complementary: Fibonacci (≈222.5°) + salt → contraste dorado
    let secondaryHue: number;
    if (strategy === 'analogous') {
      // 🎯 Tight cluster: Secondary se mantiene adyacente al primary.
      // El salt cromático sigue aplicándose para variedad entre keys,
      // pero la rotación base es 15° (no 222.5°).
      secondaryHue = normalizeHue(finalHue + 15 + saltRotation);
    } else {
      // Triadic / Complementary: Fibonacci unleashed — máxima variedad
      // y contraste dorado entre primary y secondary.
      secondaryHue = normalizeHue(finalHue + fibonacciRotation + saltRotation);
    }

    // WAVE 0-ALLOC: Mutate scratch palette
    pal.secondary.h = secondaryHue;
    pal.secondary.s = clamp(correctedSat + 5, 20, 100);  // Ligeramente más saturado
    pal.secondary.l = clamp(correctedLight - 10, 20, 80); // Ligeramente más oscuro

    // 🏛️ WAVE 94.3 / WAVE 4760: Luxury Signature Overrides configurables vía constitución.
    // luxurySignatures es un Record<rootIndex, {h, maxS?}> — sin detección por nombre de vibe.
    if (key && options?.luxurySignatures) {
      const keyIndex = KEY_TO_ROOT[key];
      if (keyIndex !== undefined) {
        const sig = options.luxurySignatures[keyIndex];
        if (sig !== undefined) {
          pal.secondary.h = sig.h;
          if (sig.maxS !== undefined) {
            pal.secondary.s = Math.min(pal.secondary.s, sig.maxS);
          }
        }
      }
    }

    // === G. COLOR DE ACENTO (usa estrategia ya resuelta) ===
    pal.accent.h = normalizeHue(accentHue);
    pal.accent.s = 100;  // Beams siempre a máxima saturación
    pal.accent.l = Math.max(70, primaryLight + 20); // Siempre brillante
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🌴 WAVE 84: AMBIENT STEREO MODE + PALETA CARIBEÑA
    // ═══════════════════════════════════════════════════════════════════════
    // ANTES: Ambient era una copia desaturada del Primary (aburrido)
    // AHORA: Ambient es un COLOR INDEPENDIENTE según la estrategia:
    //   - Triadic: 3er punto del triángulo cromático
    //   - Complementary: Split-Complementary (+30° del secondary)
    //   - Analogous: -30° del primary
    //
    // PALETA CARIBEÑA: En vibes latinas, permitir Secondary/Ambient FRÍOS
    // (Verde/Turquesa/Magenta) mientras Primary se mantiene cálido.
    // ═══════════════════════════════════════════════════════════════════════
    
    // 🌴 WAVE 84 / WAVE 4760: Tropical Ambient Bias activado vía constitución (tropicalAmbientBias).
    // Sin detección por nombre de vibe — el vibeId no importa aquí.
    const isTropicalVibe = options?.tropicalAmbientBias === true;
    
    // 🌴 WAVE 84: Calcular Ambient Hue según estrategia
    let ambientHue: number;
    switch (strategy) {
      case 'triadic':
        // 3er punto del triángulo: +240° (o -120°) del primary
        ambientHue = normalizeHue(finalHue + 240);
        break;
      case 'complementary':
        // Split-Complementary: Secondary +30°
        ambientHue = normalizeHue(secondaryHue + 30);
        break;
      case 'analogous':
      default:
        // Vecino opuesto: -30° del primary
        ambientHue = normalizeHue(finalHue - 30);
        break;
    }
    
    // 🌴 WAVE 84: Para vibes tropicales, empujar Ambient hacia gama fría
    // si el Primary es cálido (para crear contraste Tierra/Selva)
    if (isTropicalVibe) {
      const isPrimaryWarm = (finalHue >= 0 && finalHue <= 60) || finalHue >= 300;
      
      if (isPrimaryWarm) {
        // Primary es cálido (naranja/rojo) → Ambient va a VERDE/TURQUESA/MAGENTA
        // Rotar hacia zona fría (150°-200° = verde/turquesa) o (280°-320° = magenta)
        // WAVE 0-ALLOC: Inline if/else instead of array allocation
        if (energy > 0.7) {
          ambientHue = normalizeHue(finalHue + 270);  // Hacia magenta
        } else if (energy > 0.4) {
          ambientHue = normalizeHue(finalHue + 180);  // Hacia turquesa
        } else {
          ambientHue = normalizeHue(finalHue + 150);  // Hacia verde
        }
      }
    }
    
    // WAVE 0-ALLOC: Mutate scratch palette
    pal.ambient.h = ambientHue;
    pal.ambient.s = clamp(correctedSat - 10, 40, 90);  // Saturación media-alta (no lavado)
    pal.ambient.l = clamp(correctedLight - 5, 30, 70); // Luminosidad media
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🏛️ WAVE 144: SMART PRISM LOGIC (4th Color Algorithm)
    // ═══════════════════════════════════════════════════════════════════════
    // El Ambient debe ser DISTINTO del Secondary y respetar la Constitución.
    // Si cae en zona prohibida, aplicar Elastic Rotation hasta encontrar hueco.
    // ═══════════════════════════════════════════════════════════════════════
    
    // 1️⃣ PRISM MODE: Si strategy es 'prism', recalcular ambient como tetraédrico
    if (options?.forceStrategy === 'prism') {
      // Tetraedro cromático: Primary → +90° → +180° → +270°
      pal.ambient.h = normalizeHue(finalHue + 90);  // 90° del primary (no del secondary)
      pal.ambient.s = 100;  // Saturación máxima para prisma
      pal.ambient.l = 35;   // Oscuro para "suelo UV"
    }
    
    // 2️⃣ AMBIENT LOCK: Bloquear ambient en color fijo (UV Floor de Techno)
    if (options?.ambientLock) {
      pal.ambient.h = options.ambientLock.h;
      pal.ambient.s = options.ambientLock.s;
      pal.ambient.l = options.ambientLock.l;
    }
    
    // 3️⃣ TROPICAL MIRROR: Ambient = Secondary + 180° (máximo contraste Latino)
    if (options?.tropicalMirror) {
      pal.ambient.h = normalizeHue(pal.secondary.h + 180);
      pal.ambient.s = Math.max(pal.secondary.s, 70);  // Mantener saturado
      pal.ambient.l = clamp(pal.secondary.l * 1.1, 40, 60);  // Variación sutil
    }
    
    // 4️⃣ SOFTPLUS REPULSION para Ambient (WAVE 7688 — Uranus Pillar III)
    // Replaces the old elastic rotation with the smooth, injective softplus kernel.
    // The [25°, 80°] void is always evacuated; constitution forbiddenHueRanges
    // are handled by the palette-wide rigid-body + softplus block below.
    if (!options?.ambientLock) {
      pal.ambient.h = softplusRepel(pal.ambient.h);
    }

    // 5️⃣ MINIMUM SEPARATION: Ambient debe estar a mínimo 30° del Secondary
    const hueDistance = Math.abs(pal.ambient.h - pal.secondary.h);
    const shortestDistance = Math.min(hueDistance, 360 - hueDistance);
    if (shortestDistance < 30 && !options?.ambientLock && !options?.tropicalMirror) {
      // Rotar ambient +45° para separarse
      pal.ambient.h = normalizeHue(pal.ambient.h + 45);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 🌌 WAVE 7690 (URANUS — TRUE HARMONY): DERIVE PALETTE FROM HARMONIC MASS
    // ═══════════════════════════════════════════════════════════════════════
    // Closes WAVE 7681: the strategy label and derived colors now come from
    // the SAME source — the chroma vector's harmonic mass. No more fixed
    // Fibonacci offsets or syncopation-threshold labels that disagree with
    // the actual colors.
    //
    // Primary:   already set from _gravityHue (H_slow + Φ) via the override
    //            block in section B. finalHue carries it through the pipeline.
    // Accent:    H_fast + Φ — the reactive chord-level center (α=0.15, τ≈150ms).
    //            Responds to chord changes in real-time, distinct from the
    //            structural primary.
    // Ambient:   anti-mass direction (primary + 180°) — "the color of the
    //            notes that are NOT being played." Maximum chromatic contrast.
    // Secondary: RESIDUAL MASS — subtract the primary's contribution from the
    //            slow vector and re-take atan2. Yields the second harmonic
    //            center (the genuine secondary tonal region), replacing the
    //            golden-angle constant entirely.
    //
    // Strategy:  MEASURED from the angular distance between primary and
    //            secondary. The label now reflects the actual interval content
    //            of the harmony, not a syncopation threshold.
    //            ~30° → analogous, ~120° → triadic, ~180° → complementary.
    //
    // All overrides are gated behind useChromagramGravity. When OFF, the
    // legacy Fibonacci/syncopation derivation above is untouched.
    // ═══════════════════════════════════════════════════════════════════════
    let _measuredStrategy: 'analogous' | 'triadic' | 'complementary' | null = null;
    if (options?.useChromagramGravity) {
      const Phi = _siderealPhi;

      // ── Accent: H_fast (chord-level reactive center, already Φ-rotated) ──
      if (_gravityRFast > GRAVITY_R_MIN) {
        pal.accent.h = _gravityHueFast;
      } else {
        // Fast accumulator uncertain — fall back to primary (no chord change detected)
        pal.accent.h = pal.primary.h;
      }

      // ── Ambient: anti-mass direction (primary + 180°) ──
      pal.ambient.h = (pal.primary.h + 180) % 360;

      // ── Secondary: RESIDUAL MASS ──
      // Subtract the DOMINANT BIN's contribution from the slow mass vector,
      // then re-take atan2 of the residual. This yields the second harmonic
      // center — the genuine secondary tonal region, not a fixed rotation.
      //
      // NOTE: The original blueprint formula (R*W*û(H)) is a mathematical
      // identity: R = |M|/W ⇒ R*W = |M|, and û(H) = M/|M|, so R*W*û(H) = M
      // exactly. Subtracting it always yields zero. The correct approach is
      // to subtract the DOMINANT pitch class's weighted contribution:
      //   M_dominant = w_max * û(θ_max)
      // where w_max = c_max^γ and θ_max is the dominant bin's angle.
      // The residual M_res = M - M_dominant points toward the second-strongest
      // harmonic region.
      //
      // We then re-apply Φ to the residual hue to maintain the isometry.
      let dominantIdx = 0;
      let dominantC = 0;
      for (let i = 0; i < 12; i++) {
        if (_chromaMirror[i] > dominantC) {
          dominantC = _chromaMirror[i];
          dominantIdx = i;
        }
      }
      const dominantW = Math.pow(dominantC, GRAVITY_GAMMA);
      let resMx = _slowMx - dominantW * COS_THETA[dominantIdx];
      let resMy = _slowMy - dominantW * SIN_THETA[dominantIdx];

      // Check residual magnitude — if near zero, primary dominates entirely
      // (monophonic content). Fall back to primary + 30° (analogous default).
      const resMag = Math.sqrt(resMx * resMx + resMy * resMy);
      if (resMag > 0.001) {
        const resHueRaw = (Math.atan2(resMy, resMx) * 180 / Math.PI + 360) % 360;
        pal.secondary.h = (resHueRaw + Phi + 360000) % 360;
      } else {
        // Residual is zero — primary is the only harmonic center.
        // Use analogous default (+30°) for visual variety.
        pal.secondary.h = (pal.primary.h + 30) % 360;
      }

      // ── Measure Strategy from interval content ──
      // The angular distance between primary and secondary IS the strategy.
      // This is the structural fix for WAVE 7681: the label and the colors
      // derive from one source.
      let delta = Math.abs(pal.primary.h - pal.secondary.h);
      if (delta > 180) delta = 360 - delta;
      if (delta > 135) {
        _measuredStrategy = 'complementary';
      } else if (delta > 75) {
        _measuredStrategy = 'triadic';
      } else {
        _measuredStrategy = 'analogous';
      }
    }

    // === I. COLOR CONTRASTE (Siluetas, muy oscuro) ===
    // WAVE 0-ALLOC: Mutate scratch palette
    pal.contrast.h = normalizeHue(finalHue + 180);
    pal.contrast.s = 30;
    pal.contrast.l = 10;
    
    // === J. DETERMINAR TEMPERATURA VISUAL ===
    // 🌡️ WAVE 68.5: Temperatura PURA basada solo en HUE
    // Hue 0-60 y 300-360 = warm (reds, oranges, magentas)
    // Hue 180-300 = cool (cyans, blues, purples)
    // Hue 60-180 = neutral/warm (yellows, greens)
    let temperature: 'warm' | 'cool' | 'neutral';
    if ((finalHue >= 0 && finalHue <= 60) || finalHue >= 300) {
      temperature = 'warm';
    } else if (finalHue >= 180 && finalHue < 300) {
      temperature = 'cool';
    } else {
      temperature = 'neutral';
    }
    
    // === K. CALCULAR VELOCIDAD DE TRANSICIÓN ===
    // Alta energía = transiciones rápidas
    // Baja energía = transiciones lentas
    const baseTransitionSpeed = 1200; // ms (default moderado)
    const transitionSpeed = mapRange(
      energy,
      0, 1,
      baseTransitionSpeed * 1.5,  // Lento (1800ms)
      baseTransitionSpeed * 0.5   // Rápido (600ms)
    );
    
    // === L. CONSTRUIR DESCRIPCIÓN ===
    // 🎨 WAVE 68.5: Descripción PURA sin género
    // WAVE 0-ALLOC: String concatenation instead of array+join
    const description = (key ? key + ' ' + mode : activeMood) + ' ' +
      temperature + ' E=' + (energy * 100).toFixed(0) + '% S=' + (syncopation * 100).toFixed(0) + '%';
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🌴 WAVE 85 / WAVE 4760: TROPICAL PRO - Post-procesamiento constitucional
    // Activado por mudGuard.enabled + tropicalMirror en GenerationOptions.
    // Sin detección por nombre de vibe.
    // ═══════════════════════════════════════════════════════════════════════
    const hasMudGuard    = options?.mudGuard?.enabled === true;
    const hasTropicalMirror = options?.tropicalMirror === true;
    
    if (hasMudGuard || hasTropicalMirror) {
      // 🛡️ 1. ANTI-CIENO PROTOCOL — solo si mudGuard.enabled
      if (hasMudGuard) {
        const mg = options!.mudGuard!;
        const [swampMin, swampMax] = mg.swampZone;
        const fixDirtyColor = (c: HSLColor): void => {
          const inSwamp = c.h >= swampMin && c.h <= swampMax;
          if (inSwamp) {
            c.l = Math.max(c.l, mg.minLightness);
            c.s = Math.max(c.s, mg.minSaturation);
          }
        };
        fixDirtyColor(pal.primary);
        fixDirtyColor(pal.secondary);
        fixDirtyColor(pal.ambient);
      }
      
      // 🪞 2. TROPICAL MIRROR — solo si tropicalMirror: true
      if (hasTropicalMirror) {
        // Ambient = Complementario exacto del Secondary
        // Garantiza Verde↔Magenta, Turquesa↔Coral, Azul↔Naranja
        pal.ambient.h = normalizeHue(pal.secondary.h + 180);
        pal.ambient.l = clamp(pal.secondary.l * 1.1, 40, 60);
        pal.ambient.s = Math.max(pal.secondary.s, 70);
        
        // ☀️ WAVE 288.9: ACCENT = COLOR VIBRANTE (no blanco)
        pal.accent.h = normalizeHue(pal.primary.h + 30);
        pal.accent.s = Math.max(80, pal.primary.s);
        pal.accent.l = clamp(pal.primary.l * 1.1, 55, 75);
      }
    }
    // ═══════════════════════════════════════════════════════════════════════
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🗑️ WAVE 149: THE SECOND PURGE - TECHNO DICTATORSHIP REMOVED
    // ═══════════════════════════════════════════════════════════════════════
    // PROBLEMA: Bloque "TECHNO DICTATORSHIP" (Wave 96.5) sobrescribía TODA la paleta
    // ignorando completamente la Constitution (TECHNO_CONSTITUTION) definida en
    // colorConstitutions.ts.
    //
    // SÍNTOMAS:
    //   - Ambient FIJO en 275° (Violeta UV) → No reaccionaba al beat
    //   - Accent FIJO en h:190 s:20 l:100 → Blanco nuclear permanente
    //   - Primary FORZADO a Cold Spectrum → Ignoraba Key detection
    //
    // RAZÓN DEL PURGE:
    //   - Contradecía la arquitectura WAVE 147 (Great Purge): 
    //     VibeManager → Constitution → ColorEngine → Physics
    //   - El ColorEngine NO debe tomar decisiones por Vibe, debe RESPETAR
    //     las GenerationOptions que recibe.
    //   - La lógica de "Cold Spectrum" ya está en TECHNO_CONSTITUTION con:
    //     * forbiddenHueRanges: [[0, 75], [330, 360]] (bloquea warm)
    //     * allowedHueRanges: [[110, 302]] (permite cold)
    //   - El strobe del accent debe venir de TechnoStereoPhysics.apply(),
    //     no estar hardcoded.
    //
    // SOLUCIÓN:
    //   - ELIMINAR todo el bloque if(isTechnoVibe)
    //   - Dejar que la Constitution aplique las reglas (forbiddenHueRanges, etc.)
    //   - Dejar que TechnoStereoPhysics controle el strobe del accent
    //   - El ambient ahora fluye con la música dentro del cold spectrum
    //
    // CÓDIGO PURGADO (67 líneas):
    //   ❌ if (isTechnoVibe) { ambient.h=275; primary.h=coldHue; accent.l=100; ... }
    // ═══════════════════════════════════════════════════════════════════════
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🌑 WAVE 7688 (URANUS PILLAR III): RIGID-BODY EVACUATION + SOFTPLUS REPULSION
    // ═══════════════════════════════════════════════════════════════════════
    // Replaces WAVE 149.5's per-color elastic rotation (non-injective, up to
    // 24 iterations × 4 colors = 96 while-loop iterations per frame) with a
    // two-stage isometry-preserving pipeline:
    //
    // STAGE 1 — RIGID-BODY ROTATION (blueprint §3.4):
    //   Find a single ψ applied to ALL 4 colors that minimizes void occupancy.
    //   Because rotation is an isometry, all pairwise angular distances are
    //   preserved EXACTLY — the palette stays genuinely triadic/complementary
    //   while escaping [25°, 80°]. Exact solution via 9 candidates (4 colors ×
    //   2 void edges + ψ=0), ~150 flops. Hysteresis + EMA prevent chatter.
    //
    // STAGE 2 — SOFTPLUS REPULSION (blueprint §3.2):
    //   Per-color smooth-max cleanup for any residual stragglers the rigid
    //   rotation couldn't fully evacuate (possible with wide palettes).
    //   Injective, C¹ smooth, gain > 0.95 beyond ~43° from void center.
    //
    // The [25°, 80°] anti-yellow void is always active (hardcoded). Additional
    // forbiddenHueRanges from the constitution are still respected — the
    // softplus kernel handles the primary void; constitution ranges that
    // differ from [25, 80] are handled by the legacy _enforceForbiddenHue
    // as a fallback for non-standard ranges.
    // ═══════════════════════════════════════════════════════════════════════

    // STAGE 1: Rigid-body palette evacuation (always active — anti-yellow)
    _evacuatePaletteRigid(pal);

    // STAGE 2: Softplus repulsion cleanup on all 4 colors
    pal.primary.h   = softplusRepel(pal.primary.h);
    pal.secondary.h = softplusRepel(pal.secondary.h);
    pal.accent.h    = softplusRepel(pal.accent.h);
    pal.ambient.h   = softplusRepel(pal.ambient.h);

    // STAGE 3: Constitution-specific forbidden ranges (non-[25,80] zones)
    // The softplus kernel handles the universal [25, 80] void. Constitutions
    // may declare additional forbiddenHueRanges (e.g. Techno: [[0, 75], [330, 360]])
    // that need the legacy elastic rotation for non-standard zones.
    if (options?.forbiddenHueRanges) {
      const elasticStep = options.elasticRotation ?? 15;
      const maxIterations = Math.ceil(360 / elasticStep);

      // Check if constitution ranges differ from the standard [25, 80] void
      const hasNonStandardRanges = options.forbiddenHueRanges.some(
        ([min, max]) => !(min === 25 && max === 80) && !(min === 0 && max === 80)
      );

      if (hasNonStandardRanges) {
        this._enforceForbiddenHue(pal.primary, options.forbiddenHueRanges, elasticStep, maxIterations);
        this._enforceForbiddenHue(pal.secondary, options.forbiddenHueRanges, elasticStep, maxIterations);
        this._enforceForbiddenHue(pal.ambient, options.forbiddenHueRanges, elasticStep, maxIterations);
        this._enforceForbiddenHue(pal.accent, options.forbiddenHueRanges, elasticStep, maxIterations);
      }

      // Collision resolution: if Ambient is too close to Secondary (< 30°), separate
      const minDistance = 30;
      let ambientSecondaryDiff = Math.abs(pal.ambient.h - pal.secondary.h);
      if (ambientSecondaryDiff > 180) ambientSecondaryDiff = 360 - ambientSecondaryDiff;

      if (ambientSecondaryDiff < minDistance) {
        pal.ambient.h = normalizeHue(pal.ambient.h + 60);
        if (hasNonStandardRanges) {
          this._enforceForbiddenHue(pal.ambient, options.forbiddenHueRanges, elasticStep, maxIterations);
        } else {
          pal.ambient.h = softplusRepel(pal.ambient.h);
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 🔌 WAVE 150.5 / WAVE 7680: ALLOW-LIST ENFORCEMENT — Primary only
    // ═══════════════════════════════════════════════════════════════════════
    // PROBLEMA: forbiddenHueRanges bloquea [0,80] pero allowedHueRanges=[110,302]
    // significa que 86° y 98° deberían ser ILEGALES (están fuera de allowed).
    //
    // SOLUCIÓN ORIGINAL (WAVE 150.5): Si hay allowedHueRanges, todo lo que esté
    // FUERA es ilegal. Empujar hacia el borde más cercano del rango permitido.
    //
    // 🎯 WAVE 7680: CHROMA UNLOCK — Anti-Yellow Sniper.
    // El allow-list se aplicaba a TODA la paleta (primary, secondary, ambient,
    // accent). Cuando el Sidereal Clock activa un slot estrecho (ej: [170, 210]),
    // un accent triádico en 290° o complementary en 350° era snappeado de vuelta
    // al rango del slot → la matemática procedural (triadic/complementary) moría.
    //
    // FIX: El allow-list ahora solo constríe al PRIMARY. Los colores derivados
    // (secondary, ambient, accent) se rigen ÚNICAMENTE por forbiddenHueRanges
    // (el ban duro de [25, 80] = amarillo/naranja/marrón). Esto permite que
    // la armonía musical (triadic +120°, complementary +180°) sobreviva el
    // pipeline mientras el ban cromático sigue siendo letal.
    //
    // 🎯 WAVE 7684: GAMUT MAPPING reemplaza findNearestAllowedHue.
    // El primary se mapea proporcionalmente al rango del slot, no se clava
    // al borde. Cada key audio-derivada produce un grado distinto.
    // 🌌 WAVE 7689: BYPASS cuando useChromagramGravity — Φ(t) ya rotó el hue,
    // gamut-mapping destruiría la isometría.
    // ═══════════════════════════════════════════════════════════════════════
    if (!options?.useChromagramGravity && options?.allowedHueRanges && options.allowedHueRanges.length > 0) {
      // 🛡️ Skip si el rango es [0, 360] (todo permitido)
      const isFullCircle = options.allowedHueRanges.some(([min, max]) =>
        (max - min) >= 359 || (min === 0 && max >= 359)
      );
      if (!isFullCircle) {
        pal.primary.h = gamutMapHue(pal.primary.h, options.allowedHueRanges);
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🗺️ WAVE 150.5: HUE REMAPPING - Transformación de zonas
    // ═══════════════════════════════════════════════════════════════════════
    // PROBLEMA: hueRemapping: [{ from: 90, to: 110, target: 130 }] no se aplicaba.
    // Cualquier verde césped (90-110) debería transformarse en verde láser (130).
    // ═══════════════════════════════════════════════════════════════════════
    if (options?.hueRemapping && options.hueRemapping.length > 0) {
      // WAVE 0-ALLOC: Inline enforcement instead of [array].forEach()
      this._applyHueRemap(pal.primary, options.hueRemapping);
      this._applyHueRemap(pal.secondary, options.hueRemapping);
      this._applyHueRemap(pal.ambient, options.hueRemapping);
      this._applyHueRemap(pal.accent, options.hueRemapping);
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🌡️ WAVE 150.5: THERMAL GRAVITY PARA TODOS
    // 🌬️ WAVE 284: GRAVITATIONAL RELAXATION - Fuerza configurable
    // ═══════════════════════════════════════════════════════════════════════
    // PROBLEMA: applyThermalGravity solo se aplicaba al PRIMARY (finalHue).
    // Los colores derivados (secondary, ambient, accent) nunca sentían el frío.
    //
    // SOLUCIÓN: Aplicar Thermal Gravity a TODOS los colores de la paleta.
    // WAVE 284: Ahora con thermalGravityStrength configurable por vibe.
    // ═══════════════════════════════════════════════════════════════════════
    if (options?.atmosphericTemp) {
      const gravityStrength = options.thermalGravityStrength;
      pal.secondary.h = applyThermalGravity(pal.secondary.h, options.atmosphericTemp, gravityStrength);
      pal.ambient.h   = applyThermalGravity(pal.ambient.h,   options.atmosphericTemp, gravityStrength);
      pal.accent.h    = applyThermalGravity(pal.accent.h,    options.atmosphericTemp, gravityStrength);
    }
    // ═══════════════════════════════════════════════════════════════════════
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🔥 WAVE 287: NEON PROTOCOL - "Neon or Nothing"
    // ═══════════════════════════════════════════════════════════════════════
    // Aplicar el protocolo a TODA la paleta para eliminar marrones/mostazas.
    // Los colores en la danger zone se transforman en:
    //   1. NEÓN EXTREMO (alta saturación + luminosidad)
    //   2. BLANCO HIELO (si no pueden ser neón)
    // ═══════════════════════════════════════════════════════════════════════
    // WAVE 0-ALLOC: applyNeonProtocol mutates in place — no new objects
    applyNeonProtocol(pal.primary, options);
    applyNeonProtocol(pal.secondary, options);
    applyNeonProtocol(pal.ambient, options);
    applyNeonProtocol(pal.accent, options);
    // ═══════════════════════════════════════════════════════════════════════
    
    // === M. RETORNAR PALETA COMPLETA ===
    // WAVE 0-ALLOC: Return the scratch palette directly — no new object
    // 🌌 WAVE 7690: When useChromagramGravity is active, the strategy label
    // is MEASURED from the actual interval content (primary↔secondary angular
    // distance), not declared from a syncopation threshold. This closes
    // WAVE 7681: the UI label and the colors now derive from one source.
    pal.meta.strategy = _measuredStrategy ?? strategy as 'analogous' | 'triadic' | 'complementary';
    pal.meta.temperature = temperature;
    pal.meta.description = description;
    pal.meta.confidence = 1.0;
    pal.meta.transitionSpeed = Math.round(transitionSpeed);
    return pal;
  }

  // ═══════════════════════════════════════════════════════════════════
  // WAVE 0-ALLOC: Inline enforcement helpers (replace .forEach() arrays)
  // ═══════════════════════════════════════════════════════════════════

  /** Elastic rotation away from forbidden hue zones — mutates color in place */
  private static _enforceForbiddenHue(
    color: HSLColor,
    forbiddenRanges: [number, number][],
    elasticStep: number,
    maxIterations: number,
  ): void {
    let iterations = 0;
    let isInForbidden = true;
    while (isInForbidden && iterations < maxIterations) {
      isInForbidden = false;
      for (const [min, max] of forbiddenRanges) {
        const normalizedMin = normalizeHue(min);
        const normalizedMax = normalizeHue(max);
        const isInRange = normalizedMin <= normalizedMax
          ? (color.h >= normalizedMin && color.h <= normalizedMax)
          : (color.h >= normalizedMin || color.h <= normalizedMax);
        if (isInRange) {
          color.h = normalizeHue(color.h + elasticStep);
          isInForbidden = true;
          iterations++;
          break;
        }
      }
    }
  }

  /** Apply hue remapping to a single color — mutates in place */
  private static _applyHueRemap(
    color: HSLColor,
    remappings: { from: number; to: number; target: number }[],
  ): void {
    for (const mapping of remappings) {
      if (color.h >= mapping.from && color.h <= mapping.to) {
        color.h = mapping.target;
        break;
      }
    }
  }

  /**
   * Genera paleta y convierte a RGB en un solo paso
   * @param data - Análisis de audio extendido
   * @param options - Opciones de generación (WAVE 142)
   */
  static generateRgb(data: ExtendedAudioAnalysis, options?: GenerationOptions): {
    primary: RGBColor;
    secondary: RGBColor;
    accent: RGBColor;
    ambient: RGBColor;
    contrast: RGBColor;
    meta: PaletteMeta;
  } {
    const palette = this.generate(data, options);
    // WAVE 0-ALLOC: Use paletteToRgbMutate + mutate meta in place
    const rgb = paletteToRgbMutate(palette);
    return {
      primary: rgb.primary,
      secondary: rgb.secondary,
      accent: rgb.accent,
      ambient: rgb.ambient,
      contrast: rgb.contrast,
      meta: palette.meta,
    };
  }
  
  /**
   * Obtiene el hue base para una key musical
   */
  static getKeyHue(key: string): number | undefined {
    return KEY_TO_HUE[key];
  }
  
  /**
   * Obtiene el modificador de un modo musical
   */
  static getModeModifier(mode: string): ModeModifier | undefined {
    return MODE_MODIFIERS[mode];
  }
}

// ============================================================
// 6. EXPORTS
// ============================================================

export {
  KEY_TO_HUE,
  MOOD_HUES,
  MODE_MODIFIERS,
  PHI_ROTATION,
  normalizeHue,
  clamp,
  mapRange,
};

// ============================================================
// 7. WAVE 49: COLOR INTERPOLATOR (Smooth Transitions)
// ============================================================

/**
 * 🎨 WAVE 49: SELENE COLOR INTERPOLATOR
 * ====================================
 * Wrapper con estado para interpolación suave de colores.
 * Evita "epilepsia cromática" cuando cambia Key o Mood.
 * 
 * REGLAS:
 * - Transición normal: 4 beats (~2 segundos a 120 BPM)
 * - Transición DROP: 0.5 segundos (rápido pero no instantáneo)
 * - NUNCA cambio instantáneo (0 frames)
 * - Reset en nueva canción
 */
export class SeleneColorInterpolator {
  // Estado actual (lo que se envía a fixtures)
  private currentPalette: SelenePalette | null = null;
  
  // Estado objetivo (hacia donde interpolamos)
  private targetPalette: SelenePalette | null = null;
  
  // WAVE 0-ALLOC: Pre-allocated scratch palette for lerpPalette output
  private _lerpScratch: SelenePalette = {
    primary:   { h: 0, s: 0, l: 0 },
    secondary: { h: 0, s: 0, l: 0 },
    accent:    { h: 0, s: 0, l: 0 },
    ambient:   { h: 0, s: 0, l: 0 },
    contrast:  { h: 0, s: 0, l: 0 },
    meta: { strategy: 'analogous', temperature: 'neutral', description: '', confidence: 1.0, transitionSpeed: 1200 },
  };
  
  // Progreso de interpolación (0 = inicio, 1 = completado)
  private transitionProgress = 1.0;
  
  // Velocidad de transición (incremento por frame)
  private transitionSpeed = 0.02;  // ~50 frames = ~0.8s default
  
  // Configuración
  // WAVE 55: Transiciones lentas para evitar parpadeo en Cumbia
  private readonly NORMAL_TRANSITION_FRAMES = 240;  // 8 beats @ 120bpm @ 60fps ≈ 4s
  private readonly DROP_TRANSITION_FRAMES = 30;     // 0.5 segundos
  private readonly MIN_TRANSITION_FRAMES = 6;       // Mínimo 0.1s (nunca instantáneo)
  
  // Frame counter para logging
  private frameCount = 0;
  private lastLogFrame = 0;
  
  /**
   * Actualiza el color interpolado cada frame
   * 
   * @param targetData - Datos de análisis de audio
   * @param isDrop - Si estamos en un DROP (transición rápida)
   * @param options - GenerationOptions de la Constitución del Vibe activo (WAVE 148)
   * @returns Paleta interpolada para enviar a fixtures
   * 
   * 🌊 WAVE 70.5: Tolerancia de jitter - solo resetear transición si cambio > 15°
   * ⚡ WAVE 148: Ahora acepta GenerationOptions para aplicar Constitution
   * 🌊 WAVE 4755: Si la constitución define transitionConfig.minDuration, se usa
   *   directamente para calcular transitionFrames a 60fps. El isDrop es IGNORADO
   *   cuando hay minDuration constitucional — en el océano no hay drops musicales.
   */
  update(targetData: ExtendedAudioAnalysis, isDrop: boolean = false, options?: GenerationOptions): SelenePalette {
    this.frameCount++;
    
    // ⚡ WAVE 148: Generar paleta CON las restricciones de la Constitution
    const newTarget = SeleneColorEngine.generate(targetData, options);
    
    // Si no hay paleta actual, inicializar sin transición
    if (!this.currentPalette) {
      this.currentPalette = newTarget;
      this.targetPalette = newTarget;
      this.transitionProgress = 1.0;
      return newTarget;
    }
    
    // 🌊 WAVE 4755: DESACOPLE MUSICAL DEL CHILL
    // Si la constitución define transitionConfig.minDuration, overrideamos la
    // velocidad de transición con ese valor fijo y BLOQUEAMOS el isDrop.
    // Razón: en el océano no hay drops musicales. Las paletas mutan como
    // corrientes submarinas — imperceptibles en tiempo real, transformadoras.
    const constitutionalMinDuration = options?.transitionConfig?.minDuration;
    const constitutionalMaxDuration = options?.transitionConfig?.maxDuration;
    const isChillConstitution = constitutionalMinDuration !== undefined && constitutionalMinDuration >= 10000;

    // 🛡️ WAVE 3454: FULL PALETTE DIFF GATE
    // La transición ya no depende solo del hue primario:
    // si cualquier canal H/S/L cambia de forma significativa, se transiciona.
    // WAVE 4755: En modo chill el umbral de "cambio significativo" se eleva a
    // 30° (vs 15° normal) para evitar rotaciones por micro-variaciones de audio.
    const isRealChange = isChillConstitution
      ? this.hasSignificantPaletteDifferenceChill(this.currentPalette, newTarget)
      : this.hasSignificantPaletteDifference(this.currentPalette, newTarget);
    const hasAnyPaletteDelta = this.hasAnyPaletteDifference(this.targetPalette ?? this.currentPalette, newTarget);

    if (isRealChange) {
      // Cambio significativo en cualquier canal de la paleta - iniciar transición
      this.targetPalette = newTarget;
      this.transitionProgress = 0;
      
      // 🌊 WAVE 4755: Velocidad según constitución o contexto
      let transitionFrames: number;
      if (isChillConstitution) {
        // Duración glaciar desde la constitución (en ms → frames a ~60fps).
        // isDrop se IGNORA — en el océano no hay drops.
        const durationMs = constitutionalMaxDuration ?? constitutionalMinDuration!;
        transitionFrames = Math.round((durationMs / 1000) * 60);
      } else {
        transitionFrames = isDrop ? this.DROP_TRANSITION_FRAMES : this.NORMAL_TRANSITION_FRAMES;
      }
      this.transitionSpeed = 1.0 / Math.max(transitionFrames, this.MIN_TRANSITION_FRAMES);
    } else if (hasAnyPaletteDelta) {
      // Cambios menores: actualizar target sin reiniciar transición
      this.targetPalette = newTarget;
    }
    
    // Avanzar transición
    if (this.transitionProgress < 1.0) {
      this.transitionProgress = Math.min(1.0, this.transitionProgress + this.transitionSpeed);
      
      // ⚡ WAVE 3440: MOVER FAST-TRACK
      // primary/accent/contrast → LERP suave (rampa normal para PARs/wash)
      // secondary/ambient       → Snap inmediato a targetPalette (t=1.0)
      // Razón: los Movers (secondary/ambient) tienen ruedas de color mecánicas.
      // Un LERP de 4s produce 4-5 colores intermedios en el HarmonicQuantizer,
      // que el DarkSpinFilter revela como arcoíris en ventanas entre blackouts.
      // El snap genera exactamente 1 cambio → 1 blackout → color destino limpio.
      this.currentPalette = this.lerpPalette(
        this.currentPalette!,
        this.targetPalette!,
        this.transitionProgress
      );
    } else if (hasAnyPaletteDelta && this.targetPalette) {
      // ⚡ WAVE 3455: MOVER LIVE-TRACK — transición completa pero la paleta sigue cambiando.
      // secondary/ambient usan snap (t=1.0) en lerpPalette, así que aplicar el newTarget
      // directamente para esos canales. primary/accent/contrast no cambian (isRealChange=false).
      // WAVE 0-ALLOC: Mutate currentPalette in place instead of spread
      this.currentPalette!.secondary = this.targetPalette.secondary;
      this.currentPalette!.ambient   = this.targetPalette.ambient;
    }
    
    return this.currentPalette;
  }
  
  /**
   * Interpola entre dos paletas completas.
   *
   * ⚡ WAVE 3440: MOVER FAST-TRACK
   * secondary y ambient usan t=1.0 siempre (snap inmediato al color destino).
   * primary, accent y contrast mantienen el LERP progresivo normal.
   *
   * Motivación: secondary/ambient son los roles asignados a los Movers (ruedas
   * de color mecánicas). Si reciben una rampa de 240 frames, el HarmonicQuantizer
   * deja pasar 4-5 colores intermedios y el DarkSpinFilter dispara múltiples
   * blackouts, revelando el arcoíris físico entre ventanas de tránsito.
   * Con snap, el Quantizer muestrea siempre el color destino → 1 blackout → limpio.
   */
  private lerpPalette(from: SelenePalette, to: SelenePalette, t: number): SelenePalette {
    // WAVE 0-ALLOC: Mutate pre-allocated _lerpScratch in place
    const out = this._lerpScratch;
    this.lerpHSL(from.primary,   to.primary,   t, out.primary);    // Rampa suave
    this.lerpHSL(from.secondary, to.secondary, 1.0, out.secondary); // ⚡ Snap Mover
    this.lerpHSL(from.accent,    to.accent,    t, out.accent);    // Rampa suave
    this.lerpHSL(from.ambient,   to.ambient,   1.0, out.ambient); // ⚡ Snap Mover
    this.lerpHSL(from.contrast,  to.contrast,  t, out.contrast);  // Rampa suave
    out.meta = t >= 0.5 ? to.meta : from.meta; // Metadata cambia a mitad de transición
    return out;
  }

  private hasSignificantPaletteDifference(from: SelenePalette, to: SelenePalette): boolean {
    return this.hasSignificantColorDifference(from.primary, to.primary)
      || this.hasSignificantColorDifference(from.secondary, to.secondary)
      || this.hasSignificantColorDifference(from.accent, to.accent)
      || this.hasSignificantColorDifference(from.ambient, to.ambient)
      || this.hasSignificantColorDifference(from.contrast, to.contrast);
  }

  /**
   * 🌊 WAVE 4755: Variante chill del diff gate.
   * Umbral de hue elevado a 30° (vs 15° normal) para que micro-variaciones
   * de audio no disparen rotaciones cromáticas en modo océano.
   * S/L mantienen tolerancia estándar de 3 puntos.
   */
  private hasSignificantPaletteDifferenceChill(from: SelenePalette, to: SelenePalette): boolean {
    return this.hasSignificantColorDifferenceChill(from.primary, to.primary)
      || this.hasSignificantColorDifferenceChill(from.secondary, to.secondary)
      || this.hasSignificantColorDifferenceChill(from.accent, to.accent)
      || this.hasSignificantColorDifferenceChill(from.ambient, to.ambient)
      || this.hasSignificantColorDifferenceChill(from.contrast, to.contrast);
  }

  private hasSignificantColorDifferenceChill(from: HSLColor, to: HSLColor): boolean {
    if (!Number.isFinite(from.h) || !Number.isFinite(from.s) || !Number.isFinite(from.l)
      || !Number.isFinite(to.h) || !Number.isFinite(to.s) || !Number.isFinite(to.l)) {
      return true;
    }
    const fromHue = normalizeHue(from.h);
    const toHue = normalizeHue(to.h);
    let hueDiff = Math.abs(fromHue - toHue);
    if (hueDiff > 180) hueDiff = 360 - hueDiff;
    return hueDiff > 30
      || Math.abs(from.s - to.s) > 3
      || Math.abs(from.l - to.l) > 3;
  }

  private hasAnyPaletteDifference(from: SelenePalette, to: SelenePalette): boolean {
    return this.hasAnyColorDifference(from.primary, to.primary)
      || this.hasAnyColorDifference(from.secondary, to.secondary)
      || this.hasAnyColorDifference(from.accent, to.accent)
      || this.hasAnyColorDifference(from.ambient, to.ambient)
      || this.hasAnyColorDifference(from.contrast, to.contrast);
  }

  private hasSignificantColorDifference(from: HSLColor, to: HSLColor): boolean {
    if (!Number.isFinite(from.h) || !Number.isFinite(from.s) || !Number.isFinite(from.l)
      || !Number.isFinite(to.h) || !Number.isFinite(to.s) || !Number.isFinite(to.l)) {
      return true;
    }

    const fromHue = normalizeHue(from.h);
    const toHue = normalizeHue(to.h);
    let hueDiff = Math.abs(fromHue - toHue);
    if (hueDiff > 180) hueDiff = 360 - hueDiff;

    return hueDiff > 15
      || Math.abs(from.s - to.s) > 3
      || Math.abs(from.l - to.l) > 3;
  }

  private hasAnyColorDifference(from: HSLColor, to: HSLColor): boolean {
    const epsilon = 0.001;
    return Math.abs(from.h - to.h) > epsilon
      || Math.abs(from.s - to.s) > epsilon
      || Math.abs(from.l - to.l) > epsilon;
  }
  
  /**
   * Interpola entre dos colores HSL
   * Usa el camino más corto en el círculo de hue (evita saltos de 350° a 10°)
   * 
   * 🔥 WAVE 67.5: DESATURATION DIP
   * Si la diferencia de Hue es > 60°, desaturamos en el punto medio (t ≈ 0.5)
   * Esto crea un efecto de 'lavado' (blanco/gris) en el cruce, evitando el efecto arcoíris sucio
   */
  private lerpHSL(from: HSLColor, to: HSLColor, t: number, out: HSLColor): HSLColor {
    // Hue: usar el camino más corto en el círculo
    let hueDiff = to.h - from.h;
    if (hueDiff > 180) hueDiff -= 360;
    if (hueDiff < -180) hueDiff += 360;
    out.h = normalizeHue(from.h + hueDiff * t);
    
    // S y L: interpolación lineal simple
    let s = from.s + (to.s - from.s) * t;
    out.l = from.l + (to.l - from.l) * t;
    
    // 🔥 WAVE 67.5: DESATURATION DIP
    // Si el salto de hue es grande (> 60°), desaturar en el punto medio
    // Esto evita ver "todos los colores intermedios" (arcoíris sucio)
    const absHueDiff = Math.abs(hueDiff);
    if (absHueDiff > 60) {
      // Curva de desaturación: máximo en t=0.5, mínimo en t=0 y t=1
      // Usamos una función gaussiana centrada en 0.5
      const dipCenter = 0.5;
      const dipWidth = 0.25;  // Ancho de la "zona de lavado"
      const distanceFromCenter = Math.abs(t - dipCenter);
      
      // Si estamos cerca del centro, aplicar desaturación
      if (distanceFromCenter < dipWidth) {
        // Factor de desaturación: 1.0 (sin efecto) → 0.3 (máximo lavado) en el centro
        // Curva suave: 1 - (1 - 0.3) * cos²(...)
        const dipStrength = 0.3;  // Saturación mínima en el dip (30% de la original)
        const normalizedDist = distanceFromCenter / dipWidth;  // 0 en centro, 1 en bordes
        const dipFactor = dipStrength + (1 - dipStrength) * (normalizedDist * normalizedDist);
        
        s = s * dipFactor;
      }
    }
    
    out.s = s;
    return out;
  }
  
  /**
   * 🧹 WAVE 49: HARD RESET - Limpiar estado para nueva canción
   */
  reset(): void {
    console.log('[ColorInterpolator] 🧹 RESET: Estado limpiado para nueva canción');
    this.currentPalette = null;
    this.targetPalette = null;
    this.transitionProgress = 1.0;
    this.frameCount = 0;
    this.lastLogFrame = 0;
  }
  
  /**
   * Obtiene el progreso actual de la transición (0-1)
   */
  getTransitionProgress(): number {
    return this.transitionProgress;
  }
  
  /**
   * Comprueba si hay una transición en curso
   */
  isTransitioning(): boolean {
    return this.transitionProgress < 1.0;
  }
  
  /**
   * Fuerza una transición inmediata (para casos especiales)
   * ⚠️ Usar con precaución - puede causar saltos visuales
   */
  forceImmediate(palette: SelenePalette): void {
    this.currentPalette = palette;
    this.targetPalette = palette;
    this.transitionProgress = 1.0;
  }
}

// Default export
export default SeleneColorEngine;
