/**
 * 🧠 GAMMA WORKER - MIND (Selene Brain)
 * 
 * Worker Thread dedicado a la inteligencia de Selene.
 * 
 * TRINITY PHASE 1: Integrado con motores Wave 8 vía TrinityBridge
 * 
 * Procesa análisis de audio y genera decisiones de iluminación:
 * - REGLA 2: confidence < 0.5 → Modo Reactivo (V17 style)
 * - REGLA 3: Syncopation > BPM para selección de patrones
 * - Memory Management (patrones aprendidos)
 * - Predictive Engine
 * - Aesthetic Decision Making
 * - Personality System
 * 
 * Recibe AudioAnalysis+Wave8Data de ALPHA (via BETA).
 * Envía LightingDecisions a ALPHA para DMX.
 */

// 🔇 WAVE 37.0: Silencio Táctico - Solo logs de alto nivel
const DEBUG_VERBOSE = false;

import { parentPort, workerData } from 'worker_threads';
import {
  WorkerMessage,
  MessageType,
  MessagePriority,
  AudioAnalysis,
  LightingDecision,
  WorkerHealth,
  HeartbeatPayload,
  HeartbeatAckPayload,
  RGBColor,
  MovementPattern,
  createMessage,
  TrinityConfig,
  DEFAULT_CONFIG,
  isAudioAnalysis
} from './WorkerProtocol';

// Wave 8 Bridge imports
import {
  sectionToMovement,
  createReactiveDecision,
  RhythmOutput,
  HarmonyOutput,
  SectionOutput,
  GenreOutput,
} from './TrinityBridge';

// 🎨 WAVE 17.2: Selene Color Engine - Motor procedural determinista
import {
  SeleneColorEngine,
  type SelenePalette,
  type RGBColor as SeleneRGBColor,
  type ExtendedAudioAnalysis as SeleneExtendedAnalysis,
} from '../selene-lux-core/engines/visual/SeleneColorEngine';

// ⚓ WAVE 51: Key Stabilizer - Estabilización tonal para evitar parpadeo de color
import { KeyStabilizer } from '../selene-lux-core/engines/visual/KeyStabilizer';

// 🏎️ WAVE 52: Energy Stabilizer - Suavizado de energía y detección de silencio
import { EnergyStabilizer } from '../selene-lux-core/engines/visual/EnergyStabilizer';

// 🎭 WAVE 53: Mood Arbiter - Estabilización emocional para coherencia térmica
import { MoodArbiter, type MetaEmotion } from '../selene-lux-core/engines/visual/MoodArbiter';

// � WAVE 54: Strategy Arbiter - Estabilización de estrategia de color
import { StrategyArbiter, type ColorStrategy, type SectionType } from '../selene-lux-core/engines/visual/StrategyArbiter';

// �🎯 WAVE 16: Schmitt Triggers para efectos sin flicker
import { getEffectTriggers } from './utils/HysteresisTrigger';

// ============================================
// CONFIGURATION
// ============================================

const config: TrinityConfig = workerData?.config ?? DEFAULT_CONFIG;
const NODE_ID = 'gamma' as const;

// ============================================
// 🎨 WAVE 17.2: SeleneColorEngine (Static Class)
// ============================================
// Ya NO necesitamos instanciarlo - todos los métodos son estáticos
// El motor lee ExtendedAudioAnalysis y produce SelenePalette proceduralmente

// ============================================
// 🌊 WAVE 12.5: SELENE LIBRE - Sin Etiquetas
// ============================================
// FILOSOFÍA: El arte no necesita etiquetas de género.
// Los colores emergen PURAMENTE de la matemática musical:
//   - Energy → Saturación
//   - Syncopation → Contraste  
//   - Key → Tono (Hue)
//   - Density → Complejidad
// 
// El mismo Cyberpunk y la misma Cumbia producirán colores
// DIFERENTES porque su DNA musical es matemáticamente diferente.
// ============================================

// ============================================
// PERSONALITY & AESTHETIC SYSTEM
// ============================================

interface SelenePersonality {
  // Core traits (0-1)
  boldness: number;        // Preference for dramatic changes
  fluidity: number;        // Smooth vs sharp transitions
  colorfulness: number;    // Preference for saturated colors
  symmetry: number;        // Preference for symmetric patterns
  responsiveness: number;  // How quickly to react to music
  
  // Mood (influenced by music)
  currentMood: 'energetic' | 'calm' | 'dark' | 'playful';
}

const personality: SelenePersonality = {
  boldness: 0.6,
  fluidity: 0.7,
  colorfulness: 0.8,
  symmetry: 0.5,
  responsiveness: 0.75,
  currentMood: 'calm'
};

// ============================================
// NOTE: PALETTES eliminado en PHASE 1.5 (OPERATION PURGE)
// 🎨 WAVE 17.2: Ahora usamos ÚNICAMENTE SeleneColorEngine
// que genera colores proceduralmente basados en:
//   - Key (Círculo de Quintas → Cromático)
//   - Mode (temperature modifiers)
//   - Energy → saturación y brillo
//   - Syncopation → estrategia de contraste
//   - Macro-Género → subtle bias (NO forzado)
// ============================================

// ============================================
// STATE
// ============================================

/**
 * Extended AudioAnalysis with Wave 8 data (from BETA)
 * 🎨 WAVE 17.2: Compatible con SeleneColorEngine.ExtendedAudioAnalysis
 */
interface ExtendedAudioAnalysis extends AudioAnalysis {
  wave8?: {
    rhythm: RhythmOutput;
    harmony: HarmonyOutput;
    section: SectionOutput;
    genre: GenreOutput;
  };
}

interface GammaState {
  isRunning: boolean;
  frameCount: number;
  decisionCount: number;
  startTime: number;
  lastHeartbeat: number;
  
  // Audio history for pattern detection
  audioHistory: ExtendedAudioAnalysis[];
  maxAudioHistory: number;
  
  // 🎨 WAVE 17.2: Current state con nuevo motor
  currentPalette: SelenePalette | null;  // SelenePalette del nuevo motor (o null inicial)
  currentMoodHint: string;               // From Wave 8 harmony
  currentMovement: MovementPattern;
  lastDecisionTime: number;
  
  // Wave 8 Operation Mode (REGLA 2)
  operationMode: 'intelligent' | 'reactive';
  combinedConfidence: number;
  
  // 🧠 WAVE 10: Brain forced mode (from main process Big Switch)
  brainForced: boolean;
  
  // 🌊 WAVE 23.4: Smoothed syncopation (EMA filter)
  smoothedSync: number;
  
  // 💫 WAVE 47.1.7: Mood hysteresis (evitar flickeo)
  lastStableMood: string;
  lastMoodChangeTime: number;
  
  // ⚓ WAVE 51: Key Stabilizer instance
  keyStabilizer: KeyStabilizer;
  
  // 🏎️ WAVE 52: Energy Stabilizer instance
  energyStabilizer: EnergyStabilizer;
  
  // 🎭 WAVE 53: Mood Arbiter instance
  moodArbiter: MoodArbiter;
  
  // 🎨 WAVE 54: Strategy Arbiter instance
  strategyArbiter: StrategyArbiter;
  
  // Memory (learned patterns)
  learnedPatterns: Map<string, LearnedPattern>;
  
  // Performance
  messagesProcessed: number;
  totalProcessingTime: number;
  errors: string[];
}

interface LearnedPattern {
  id: string;
  audioSignature: {
    bpmRange: [number, number];
    energyRange: [number, number];
    mood: string;
  };
  lightingResponse: {
    palette: string;
    movement: MovementPattern;
    intensity: number;
  };
  successScore: number;  // How well this pattern worked
  useCount: number;
}

const state: GammaState = {
  isRunning: false,
  frameCount: 0,
  decisionCount: 0,
  startTime: Date.now(),
  lastHeartbeat: Date.now(),
  
  audioHistory: [],
  maxAudioHistory: 60, // ~1 second at 60fps
  
  // 🎨 WAVE 17.2: Inicialización neutral (se genera en primer frame con audio real)
  currentPalette: null,  // Se genera dinámicamente con SeleneColorEngine
  currentMoodHint: 'neutral',
  currentMovement: 'sweep',
  lastDecisionTime: Date.now(),
  
  // Wave 8 defaults
  operationMode: 'reactive',
  combinedConfidence: 0,
  
  // 🧠 WAVE 10: Brain activation flag (from main process)
  brainForced: false,  // When true, ALWAYS use intelligent mode
  
  // 🌊 WAVE 23.4: Smoothed syncopation (inicializado en 0)
  smoothedSync: 0,
  
  // 💫 WAVE 47.1.7: Mood hysteresis (evitar flickeo)
  lastStableMood: 'dark',           // Default para electrónica
  lastMoodChangeTime: Date.now(),   // Timestamp del último cambio
  
  // ⚓ WAVE 51: Key Stabilizer - Evita cambios frenéticos de color
  keyStabilizer: new KeyStabilizer({
    bufferSize: 480,        // 8 segundos de historia @ 60fps
    lockingFrames: 180,     // 3 segundos para confirmar cambio de key
    dominanceThreshold: 0.35,  // Key debe tener >35% de votos
    useEnergyWeighting: true,  // Votos ponderados por energía
  }),
  
  // 🏎️ WAVE 52: Energy Stabilizer - Suavizado de energía + detección de silencio
  // NOTA: Se configura después de state para poder conectar el callback
  energyStabilizer: new EnergyStabilizer({
    smoothingWindowFrames: 120,  // 2 segundos @ 60fps
    silenceThreshold: 0.02,      // Prácticamente silencio
    silenceResetFrames: 180,     // 3 segundos = nueva canción
    emaFactor: 0.95,             // 95% histórico, 5% nuevo
  }),
  
  // 🎭 WAVE 53: Mood Arbiter - Estabilización emocional (temperatura térmica)
  moodArbiter: new MoodArbiter({
    bufferSize: 600,           // 10 segundos @ 60fps
    lockingFrames: 300,        // 5 segundos para confirmar cambio emocional
    dominanceThreshold: 0.60,  // 60% de dominancia requerida
    useEnergyWeighting: true,
    confidenceBonus: 1.5,
  }),
  
  // 🎨 WAVE 54: Strategy Arbiter - Estabilización de estrategia de color
  strategyArbiter: new StrategyArbiter({
    bufferSize: 900,           // 15 segundos @ 60fps
    lockingFrames: 900,        // 15 segundos de bloqueo
    lowSyncThreshold: 0.35,    // < 0.35 = ANALOGOUS (orden)
    highSyncThreshold: 0.55,   // > 0.55 = COMPLEMENTARY (caos)
    hysteresisBand: 0.05,
    dropOverrideEnergy: 0.85,
  }),
  
  learnedPatterns: new Map(),
  
  messagesProcessed: 0,
  totalProcessingTime: 0,
  errors: []
};

// 🏎️ WAVE 52 + 🎭 WAVE 53 + 🎨 WAVE 54: Conectar cadena de reset COMPLETA
// Cuando EnergyStabilizer detecta silencio prolongado (entre canciones),
// reseteamos TODOS los estabilizadores para que la nueva canción empiece limpia.
state.energyStabilizer.onReset(() => {
  console.log('[GAMMA] 🏎️→⚓🎭🎨 SILENCE RESET: All stabilizers cleared for new song');
  state.keyStabilizer.reset();
  state.moodArbiter.reset();
  state.strategyArbiter.reset();
});

// ============================================
// COLOR UTILITIES (Pure functions - no legacy dependencies)
// ============================================

function adjustColorIntensity(color: RGBColor, intensity: number): RGBColor {
  return {
    r: Math.round(color.r * intensity),
    g: Math.round(color.g * intensity),
    b: Math.round(color.b * intensity)
  };
}

// ============================================
// DECISION GENERATION - WAVE 8 INTEGRATED
// ============================================

/**
 * Generate lighting decision using Wave 8 intelligence
 * 
 * REGLA 2: confidence < 0.5 → Modo Reactivo (V17 style)
 * REGLA 3: Syncopation > BPM para patrones
 */
function generateDecision(analysis: ExtendedAudioAnalysis): LightingDecision {
  const startTime = performance.now();
  state.frameCount++;
  state.decisionCount++;
  
  // 🏎️ WAVE 52: Procesar energía a través del stabilizer
  // Esto detecta silencio y suaviza la energía para evitar parpadeo
  const energyOutput = state.energyStabilizer.update(analysis.energy);
  
  // Add to history
  state.audioHistory.push(analysis);
  if (state.audioHistory.length > state.maxAudioHistory) {
    state.audioHistory.shift();
  }
  
  // === REGLA 2: Check confidence for mode selection ===
  // 🧠 WAVE 10: brainForced overrides REGLA 2 - si el usuario puso SELENE, ¡USAMOS EL BRAIN!
  const wave8 = analysis.wave8;
  if (wave8) {
    // Calculate combined confidence (REGLA 2)
    state.combinedConfidence = 
      wave8.rhythm.confidence * 0.35 +
      wave8.harmony.confidence * 0.20 +
      wave8.section.confidence * 0.20 +
      wave8.genre.confidence * 0.25;
    
    // 🧠 WAVE 10: brainForced ignora la confidence - SI EL USUARIO DIJO SELENE, SELENE ES
    if (state.brainForced) {
      state.operationMode = 'intelligent';
    } else {
      state.operationMode = state.combinedConfidence >= 0.5 ? 'intelligent' : 'reactive';
    }
  } else {
    // Sin wave8 data, pero si brainForced, intentamos intelligent anyway
    state.operationMode = state.brainForced ? 'intelligent' : 'reactive';
    state.combinedConfidence = state.brainForced ? 0.6 : 0.3;
  }
  
  // === REACTIVE MODE (V17 Style) ===
  // 🧠 WAVE 10: Solo si NO está forzado el brain
  if (state.operationMode === 'reactive' && !state.brainForced) {
    // Direct audio → light mapping (fast fallback)
    const reactiveDecision = createReactiveDecision(analysis, state.frameCount);
    state.totalProcessingTime += performance.now() - startTime;
    state.messagesProcessed++;
    state.lastDecisionTime = Date.now();
    return reactiveDecision;
  }
  
  // === INTELLIGENT MODE (Wave 8 Full Analysis) ===
  const { rhythm, harmony, section, genre } = wave8!;
  
  // 🌊 WAVE 23.4: SUAVIZADO DE SYNCOPATION (EMA Filter)
  // Evita parpadeo visual causado por cambios abruptos (0.90 → 0.10)
  // EMA: smoothed = (smoothed * alpha) + (new * (1 - alpha))
  // alpha = 0.8 (80% histórico, 20% nuevo) → suavizado agresivo
  state.smoothedSync = (state.smoothedSync * 0.8) + (rhythm.syncopation * 0.2);
  
  // � WAVE 17.2: SELENE COLOR ENGINE - Motor determinista procedural
  // Los colores emergen de la MATEMÁTICA MUSICAL:
  //   - Key → Hue (Círculo de Quintas = Círculo Cromático)
  //   - Mode → Temperature modifier (major +15°, minor -15°, etc.)
  //   - Energy → Saturación y Brillo (NUNCA cambia el hue)
  //   - Syncopation → Estrategia de contraste (analogous/complementary/triadic/split)
  //   - Macro-Género → Subtle bias (tempBias, satBoost, lightBoost)
  //   - Fibonacci rotation → Secondary color (φ × 360° = 222.5°)
  
  // Log informativo cada segundo
  if (DEBUG_VERBOSE && state.frameCount % 60 === 0) {
    // WAVE 18.3: genre is now GenreAnalysis (.genre) not GenreOutput (.primary)
    const gName = (genre as any).genre ?? (genre as any).primary ?? 'unknown';
    console.log(`[GAMMA] 🎨 WAVE 17.2: E=${analysis.energy.toFixed(2)} S=${rhythm.syncopation.toFixed(2)} K=${harmony.key ?? '?'} M=${harmony.mode} G=${gName}`);
  }
  
  // 💓 WAVE 44.0: HOLISTIC HEARTBEAT - Estado completo de GAMMA cada 5 segundos
  if (state.frameCount % 150 === 0) {
    const gName = (genre as any).genre ?? (genre as any).primary ?? 'unknown';
    console.log('[GAMMA HEARTBEAT] 💓🧠', JSON.stringify({
      frame: state.frameCount,
      mode: state.operationMode,
      brainForced: state.brainForced,
      confidence: {
        combined: state.combinedConfidence.toFixed(2),
        rhythm: rhythm.confidence.toFixed(2),
        harmony: harmony.confidence.toFixed(2),
        section: section.confidence.toFixed(2),
        genre: genre.confidence.toFixed(2),
      },
      rhythm: {
        syncRaw: rhythm.syncopation.toFixed(3),
        syncSmoothed: state.smoothedSync.toFixed(3),
        pattern: rhythm.pattern,
        bpm: analysis.bpm,
      },
      harmony: {
        key: harmony.key ?? 'NULL',
        mode: harmony.mode ?? 'NULL',
        mood: harmony.mood ?? 'NULL',
        temp: harmony.temperature ?? 'NULL',
      },
      section: {
        type: section.type,
        energy: section.energy.toFixed(2),
      },
      genre: {
        winner: gName,
        scores: (genre as any).scores ?? {},
        mood: (genre as any).mood ?? 'NULL',
      },
      consciousness: {
        mood: (analysis.wave8 as any)?.mood?.primary ?? 'NULL',  // 💫 WAVE 47.1: MoodSynthesizer output
        arousal: (analysis.wave8 as any)?.mood?.arousal?.toFixed(2) ?? 'NULL',
        valence: (analysis.wave8 as any)?.mood?.valence?.toFixed(2) ?? 'NULL',
        dominance: (analysis.wave8 as any)?.mood?.dominance?.toFixed(2) ?? 'NULL',
      },
      personality: {
        mood: personality.currentMood,
        boldness: personality.boldness,
      },
      colorEngine: {
        paletteGenerated: !!state.currentPalette,
        strategy: state.currentPalette?.meta?.strategy ?? 'NULL',
      },
      energyEngine: {  // 🏎️ WAVE 52: Energy Engine stats
        instant: energyOutput.instantEnergy.toFixed(2),
        smoothed: energyOutput.smoothedEnergy.toFixed(2),
        silence: energyOutput.isSilence,
        silenceFrames: energyOutput.silenceFrames,
        recentPeak: energyOutput.recentPeak.toFixed(2),
      },
      moodArbiter: {  // 🎭 WAVE 53: Mood Arbiter stats
        stable: state.moodArbiter.getStableEmotion(),
        stats: state.moodArbiter.getStats(),
      },
      strategyArbiter: {  // 🎨 WAVE 54: Strategy Arbiter stats
        stable: state.strategyArbiter.getStableStrategy(),
        stats: state.strategyArbiter.getStats(),
      },
      perf: {
        decisions: state.decisionCount,
        avgMs: (state.totalProcessingTime / Math.max(1, state.messagesProcessed)).toFixed(2),
      }
    }, null, 0));
  }
  
  // ⚓ WAVE 51: KEY STABILIZATION - Estabilizar la Key antes de generar colores
  // Esto evita que acordes de paso cambien el color de toda la sala
  const keyStabilizerOutput = state.keyStabilizer.update({
    key: harmony.key,
    confidence: harmony.confidence,
    energy: analysis.energy,
  });
  
  // � WAVE 53: MOOD ARBITRATION - Estabilizar estado emocional
  // Esto evita fluctuaciones térmicas (Cálido↔Frío) por acordes pasajeros
  const moodArbiterOutput = state.moodArbiter.update({
    mode: harmony.mode,
    mood: harmony.mood,
    confidence: harmony.confidence,
    energy: analysis.energy,
    key: keyStabilizerOutput.stableKey,  // 🌍 WAVE 55: Para Zodiac Affinity
  });
  
  // � WAVE 54: STRATEGY ARBITRATION - Estabilizar estrategia de color
  // Esto evita cambios de contraste por picos de sincopa momentaneos
  const strategyArbiterOutput = state.strategyArbiter.update({
    syncopation: rhythm.syncopation,
    sectionType: section.type as SectionType,
    energy: analysis.energy,
    confidence: rhythm.confidence,
    isRelativeDrop: energyOutput.isRelativeDrop, // WAVE 55: DROP relativo
  });
  
  // WAVE 52-54: Crear analisis FULL STABILIZED
  // - stableKey: evita cambio de color por acordes de paso
  // - smoothedEnergy: evita parpadeo por picos de kick
  // - stableEmotion: coherencia termica emocional
  // - stableStrategy: coherencia de contraste de color
  const stabilizedAnalysis = {
    ...analysis,
    energy: energyOutput.smoothedEnergy,
    wave8: {
      ...wave8,
      rhythm: {
        ...rhythm,
        syncopation: strategyArbiterOutput.averagedSyncopation,
      },
      harmony: {
        ...harmony,
        key: keyStabilizerOutput.stableKey,
        temperature: moodArbiterOutput.stableEmotion === 'BRIGHT' ? 'warm' :
                     moodArbiterOutput.stableEmotion === 'DARK' ? 'cold' : 'neutral',
      },
    },
  } as SeleneExtendedAnalysis;
  
  // 🎨 Generar paleta con nuevo motor determinista (usando key estabilizada)
  const selenePalette = SeleneColorEngine.generate(stabilizedAnalysis);
  const rgbPalette = SeleneColorEngine.generateRgb(stabilizedAnalysis);
  
  // Guardar en state
  state.currentPalette = selenePalette;
  
  // Calculate intensity
  const baseIntensity = section.energy;
  const beatBoost = analysis.onBeat ? 0.2 * analysis.beatStrength : 0;
  const intensity = Math.min(1, baseIntensity + beatBoost);
  
  // Select movement based on section (from Wave 8)
  const movementPattern = sectionToMovement(section, analysis.energy, rhythm.syncopation);
  state.currentMovement = movementPattern;
  
  // Build palette with intensity applied to RGB from SeleneColorEngine
  const palette = {
    primary: adjustColorIntensity(rgbPalette.primary, intensity),
    secondary: adjustColorIntensity(rgbPalette.secondary, intensity * 0.8),
    accent: adjustColorIntensity(rgbPalette.accent, intensity * 0.6),
    intensity
  };
  
  // Movement parameters (influenced by genre)
  // WAVE 18.3: genre is now GenreAnalysis (.genre) not GenreOutput (.primary)
  const genreValue = (genre as any).genre ?? (genre as any).primary ?? 'unknown';
  const genreSpeedMultiplier = genreValue === 'techno' ? 1.2 : 
                               genreValue === 'reggaeton' ? 0.9 :
                               genreValue === 'cumbia' ? 0.85 : 1.0;
  
  const movement = {
    pattern: movementPattern,
    speed: (0.3 + analysis.bpm / 300) * genreSpeedMultiplier,
    range: 0.5 + section.energy * 0.5,
    sync: (analysis.bpmConfidence > 0.7 ? 'beat' : 
           section.type === 'chorus' || section.type === 'drop' ? 'phrase' : 'free') as 'beat' | 'phrase' | 'free'
  };
  
  // Effects (section-aware) - 🎯 WAVE 16: Con Schmitt Triggers
  // Los triggers tienen histéresis para evitar flicker
  const effectTriggers = getEffectTriggers();
  const triggerStates = effectTriggers.processAll(analysis.energy);
  
  // Lógica mejorada: combina triggers con contexto musical
  const shouldStrobe = triggerStates.strobe && 
                       (section.type === 'drop' || section.type === 'chorus') && 
                       analysis.onBeat && 
                       personality.boldness > 0.5;
  
  const shouldChase = triggerStates.chase &&
                      (section.type === 'drop' || section.type === 'buildup');
  
  const shouldPulse = triggerStates.pulse &&
                      analysis.onBeat;
  
  const shouldLaser = triggerStates.laser &&
                      (harmony.mood === 'tense' || analysis.treble > 0.7);
  
  const shouldPrism = triggerStates.prism &&
                      (section.type === 'chorus' || harmony.mood === 'dreamy');
  
  const effects = {
    strobe: shouldStrobe,
    strobeRate: shouldStrobe && analysis.bpm > 140 ? analysis.bpm / 60 : undefined,
    fog: section.type === 'buildup' ? section.energy * 0.8 :
         section.type === 'breakdown' ? 0.3 : 0,
    laser: shouldLaser,
    // 🎯 WAVE 16: Nuevos efectos con triggers
    chase: shouldChase,
    pulse: shouldPulse,
    prism: shouldPrism,
  };
  
  // Calculate beauty score with Wave 8 data
  const beautyScore = calculateBeautyScore(analysis, palette, movement, wave8);
  
  // 💫 WAVE 47.1.3: MOOD ARBITRATION - Jerarquía de 4 niveles
  // Prioridad: genre.mood > harmony.mood > VAD.mood > fallback
  // Este es el "árbitro final" que consolida todas las fuentes de mood
  let finalMood: string = 'peaceful'; // 4️⃣ Default Fallback
  
  // Extraer VAD mood del MoodSynthesizer
  const vadMood = (analysis.wave8 as any)?.mood?.primary ?? 'peaceful';
  
  // Extraer genre mood (de GenreAnalysis)
  const genreMood = (genre as any).mood ?? null;
  const genreConfidence = genre.confidence;
  const genreName = (genre as any).genre ?? (genre as any).primary ?? 'unknown';
  
  // Extraer harmony mood
  const harmonyMood = harmony.mood ?? null;
  const harmonyConfidence = harmony.confidence;
  
  // 🔧 WAVE 47.1.6: ELECTRONIC GENRE OVERRIDE
  // Si el género detectado es ELECTRONIC (aunque confidence sea baja),
  // NO permitir que VAD "harmonious" gane - es incorrecto para techno
  const isElectronicGenre = genreName.startsWith('ELECTRONIC');
  const electronicMoodOverride = isElectronicGenre ? 
    (genreMood === 'chill' ? 'calm' : genreMood ?? 'dark') : null;
  
  // 1️⃣ PRIORIDAD MÁXIMA: Contexto de Género (The Senate)
  // Si el género está claro (>0.6) y tiene opinión fuerte (no neutral)
  if (genreConfidence > 0.6 && genreMood && genreMood !== 'chill') {
    finalMood = genreMood;
  }
  // 🔧 WAVE 47.1.6: Si es género electrónico pero confidence baja, usar override
  else if (isElectronicGenre && electronicMoodOverride) {
    finalMood = electronicMoodOverride;
  }
  // 2️⃣ PRIORIDAD MEDIA: Teoría Musical (Harmony)
  // Si no hay género fuerte, pero la tonalidad dicta emoción (ej: Minor -> Sad)
  else if (harmonyConfidence > 0.7 && harmonyMood) {
    // Mapear harmony.mood a finalMood (UI moods)
    if (harmonyMood === 'happy' || harmonyMood === 'bluesy') {
      finalMood = 'energetic';
    } else if (harmonyMood === 'sad' || harmonyMood === 'tense') {
      finalMood = 'dark';
    } else if (harmonyMood === 'dreamy' || harmonyMood === 'jazzy') {
      finalMood = 'calm';
    } else if (harmonyMood === 'spanish_exotic') {
      finalMood = 'playful';
    }
  }
  // 3️⃣ PRIORIDAD BAJA: VAD (Instinto Crudo del MoodSynthesizer)
  // Solo si los anteriores fallan o son neutros
  else {
    finalMood = vadMood;
  }
  
  // 💫 WAVE 47.1.7: MOOD HYSTERESIS
  // El mood de un DJ set no cambia 10 veces por segundo.
  // Solo permitir cambio si han pasado al menos 10 segundos.
  const MOOD_HYSTERESIS_MS = 10000; // 10 segundos mínimo entre cambios
  const now = Date.now();
  const timeSinceLastChange = now - state.lastMoodChangeTime;
  
  if (finalMood !== state.lastStableMood) {
    if (timeSinceLastChange >= MOOD_HYSTERESIS_MS) {
      // Suficiente tiempo ha pasado, permitir el cambio
      state.lastStableMood = finalMood;
      state.lastMoodChangeTime = now;
    } else {
      // No ha pasado suficiente tiempo, mantener el mood anterior
      finalMood = state.lastStableMood;
    }
  }
  
  // Update personality mood (ahora basado en finalMood arbitrado + hysteresis)
  // Mapear a los 4 moods permitidos por personality interface
  if (finalMood === 'energetic' || finalMood === 'dramatic' || finalMood === 'euphoric') {
    personality.currentMood = 'energetic';
  } else if (finalMood === 'dark') {
    personality.currentMood = 'dark';
  } else if (finalMood === 'calm' || finalMood === 'peaceful') {
    personality.currentMood = 'calm';
  } else if (finalMood === 'playful') {
    personality.currentMood = 'playful';
  }

  // 💫 WAVE 47.1.3: Log de arbitración cada 5 segundos
  if (state.frameCount % 150 === 0) {
    console.log('[MOOD ARBITRATION] 🎭', JSON.stringify({
      WINNER: finalMood,
      stable: state.lastStableMood,  // 💫 WAVE 47.1.7: Mood estable después de hysteresis
      hysteresis: { 
        timeSinceChange: Math.round(timeSinceLastChange / 1000) + 's',
        wasBlocked: finalMood === state.lastStableMood && timeSinceLastChange < MOOD_HYSTERESIS_MS
      },
      genre: genreName,
      sources: {
        '1_GENRE': { mood: genreMood ?? 'NULL', confidence: genreConfidence.toFixed(2), won: genreConfidence > 0.6 && genreMood && genreMood !== 'chill' },
        '1B_ELECTRONIC_OVERRIDE': { active: isElectronicGenre && !(genreConfidence > 0.6), override: electronicMoodOverride },
        '2_HARMONY': { mood: harmonyMood ?? 'NULL', confidence: harmonyConfidence.toFixed(2) },
        '3_VAD': { mood: vadMood }
      },
      personality_mapped: personality.currentMood
    }, null, 0));
  }
  
  // Track processing time
  state.totalProcessingTime += performance.now() - startTime;
  state.messagesProcessed++;
  state.lastDecisionTime = Date.now();
  
  return {
    timestamp: Date.now(),
    frameId: state.frameCount,
    decisionId: `decision-${state.decisionCount}-${Date.now()}`,
    
    confidence: state.combinedConfidence,
    beautyScore,
    source: 'procedural', // Could be 'memory' when using learned patterns
    
    palette,
    movement,
    effects,
    
    // 🎨 WAVE 17.2: Debug info from SeleneColorEngine
    // 🔥 WAVE 23.1 OPERATION TRUTH: Exponer paletteSource real (sin histéresis)
    // 🌊 WAVE 23.4: Syncopation suavizado (EMA) para DNA derivation
    // 💫 WAVE 47.1.3: MOOD ARBITRATION - Enviar finalMood (arbitrado) no VAD raw
    // 🎭 WAVE 53: Mood Arbiter - Meta-emoción estabilizada
    debugInfo: {
      macroGenre: selenePalette.meta.macroGenre,
      strategy: selenePalette.meta.strategy,
      temperature: selenePalette.meta.temperature,
      description: selenePalette.meta.description,
      key: keyStabilizerOutput.stableKey,  // ⚓ WAVE 51: Key ESTABILIZADA
      mode: harmony.mode,
      source: 'procedural' as const,  // 🔥 LA VERDAD CRUDA - mind.ts siempre es procedural (no usa Brain)
      syncopation: state.smoothedSync,  // 🌊 WAVE 23.4: Syncopation suavizado (EMA) para evitar flicker en DNA
      mood: {
        primary: finalMood,  // 💫 WAVE 47.1.3: Mood arbitrado (genre > harmony > VAD)
        stableEmotion: moodArbiterOutput.stableEmotion,  // 🎭 WAVE 53
        thermalTemperature: moodArbiterOutput.thermalTemperature,  // 🎭 WAVE 53
        // 🎨 WAVE 54: Strategy Arbiter output (dentro de mood porque debugInfo tiene tipos estrictos)
        colorStrategy: {
          stable: strategyArbiterOutput.stableStrategy,
          instant: strategyArbiterOutput.instantStrategy,
          avgSyncopation: strategyArbiterOutput.averagedSyncopation,
          contrastLevel: strategyArbiterOutput.contrastLevel,
          sectionOverride: strategyArbiterOutput.overrideType,
        },
        raw: (analysis.wave8 as any)?.mood,  // ⚠️ VAD raw preservado para debug
        sources: {
          genre: { mood: genreMood, confidence: genreConfidence },
          harmony: { mood: harmonyMood, confidence: harmonyConfidence },
          vad: { mood: vadMood }
        }
      },
      sectionDetail: section,  // 💫 WAVE 47.1: SectionTracker output completo
    }
  };
}

function calculateBeautyScore(
  analysis: ExtendedAudioAnalysis,
  _palette: LightingDecision['palette'],
  movement: LightingDecision['movement'],
  wave8?: ExtendedAudioAnalysis['wave8']
): number {
  // Aesthetic heuristics
  let score = 0.5; // Base
  
  // Sync bonus
  if (movement.sync === 'beat' && analysis.bpmConfidence > 0.7) {
    score += 0.15;
  }
  
  // Energy matching
  const energyMatch = 1 - Math.abs(analysis.energy - movement.range);
  score += energyMatch * 0.1;
  
  // Groove bonus (REGLA 3: good groove = good vibes)
  score += analysis.groove * 0.15;
  
  // Wave 8 bonuses
  if (wave8) {
    // Genre confidence bonus
    if (wave8.genre.confidence > 0.7) score += 0.1;
    
    // Section-appropriate bonus
    if ((wave8.section.type === 'drop' || wave8.section.type === 'chorus') && analysis.energy > 0.7) {
      score += 0.1;
    }
    
    // Harmony coherence
    if (wave8.harmony.confidence > 0.6) score += 0.05;
  }
  
  return Math.min(1, score);
}

// ============================================
// HEALTH REPORTING
// ============================================

function generateHealthReport(): WorkerHealth {
  const uptime = Date.now() - state.startTime;
  const memUsage = process.memoryUsage();
  
  let status: WorkerHealth['status'] = 'healthy';
  if (memUsage.heapUsed / memUsage.heapTotal > 0.9) {
    status = 'critical';
  } else if (memUsage.heapUsed / memUsage.heapTotal > 0.7) {
    status = 'degraded';
  }
  
  return {
    nodeId: NODE_ID,
    timestamp: Date.now(),
    cpuUsage: 0,
    memoryUsage: memUsage.heapUsed / memUsage.heapTotal,
    heapUsed: memUsage.heapUsed,
    heapTotal: memUsage.heapTotal,
    messagesProcessed: state.messagesProcessed,
    messagesPerSecond: state.messagesProcessed / (uptime / 1000),
    avgProcessingTime: state.messagesProcessed > 0 
      ? state.totalProcessingTime / state.messagesProcessed 
      : 0,
    status,
    lastError: state.errors[state.errors.length - 1],
    uptime,
    decisionsGenerated: state.decisionCount
  };
}

// ============================================
// STATE SNAPSHOT (For Phoenix Protocol)
// ============================================

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function createStateSnapshot(): unknown {
  return {
    frameCount: state.frameCount,
    decisionCount: state.decisionCount,
    // Wave 8 Pure - save generated palette (can be regenerated on restore)
    currentPalette: state.currentPalette,
    currentMoodHint: state.currentMoodHint,
    currentMovement: state.currentMovement,
    operationMode: state.operationMode,
    combinedConfidence: state.combinedConfidence,
    personality: { ...personality },
    learnedPatterns: Array.from(state.learnedPatterns.entries())
  };
}

function restoreStateSnapshot(snapshot: unknown): void {
  if (typeof snapshot === 'object' && snapshot !== null) {
    const s = snapshot as Record<string, unknown>;
    if (typeof s.frameCount === 'number') state.frameCount = s.frameCount;
    if (typeof s.decisionCount === 'number') state.decisionCount = s.decisionCount;
    if (typeof s.currentMoodHint === 'string') {
      state.currentMoodHint = s.currentMoodHint;
      // 🎨 WAVE 17.2: Palette se genera dinámicamente en el próximo frame
      // No necesitamos regenerar aquí - será null hasta que llegue audio real
      state.currentPalette = null;
    }
    if (s.personality && typeof s.personality === 'object') {
      Object.assign(personality, s.personality);
    }
    if (Array.isArray(s.learnedPatterns)) {
      state.learnedPatterns = new Map(s.learnedPatterns);
    }
  }
  if (DEBUG_VERBOSE) console.log(`[GAMMA] State restored: ${state.decisionCount} decisions, mood: ${personality.currentMood}`);
}

// ============================================
// MESSAGE HANDLER
// ============================================

function handleMessage(message: WorkerMessage): void {
  try {
    switch (message.type) {
      case MessageType.INIT:
        state.isRunning = true;
        state.startTime = Date.now();
        console.log('[GAMMA] 🧠 Mind initialized');  // Keep - startup only
        sendMessage(MessageType.READY, 'alpha', { nodeId: NODE_ID });
        break;
        
      case MessageType.SHUTDOWN:
        console.log('[GAMMA] Shutting down...');  // Keep - shutdown only
        state.isRunning = false;
        sendMessage(MessageType.HEALTH_REPORT, 'alpha', generateHealthReport());
        process.exit(0);
        break;
        
      case MessageType.HEARTBEAT:
        const hbPayload = message.payload as HeartbeatPayload;
        const ackPayload: HeartbeatAckPayload = {
          originalTimestamp: hbPayload.timestamp,
          ackTimestamp: Date.now(),
          sequence: hbPayload.sequence,
          latency: Date.now() - hbPayload.timestamp
        };
        sendMessage(MessageType.HEARTBEAT_ACK, 'alpha', ackPayload, MessagePriority.HIGH);
        state.lastHeartbeat = Date.now();
        break;
        
      case MessageType.HEALTH_REQUEST:
        sendMessage(MessageType.HEALTH_REPORT, 'alpha', generateHealthReport());
        break;
        
      case MessageType.AUDIO_ANALYSIS:
        if (!state.isRunning) break;
        const analysis = message.payload;
        
        // 🔍 WAVE 15.3 DIAGNOSTIC: Log audio reception cada 60 frames
        state.frameCount = (state.frameCount || 0) + 1;
        if (state.frameCount % 60 === 0) {
          const a = analysis as { spectrum?: { bass?: number; mid?: number; treble?: number }; dynamics?: { energy?: number } };
          console.log(`[GAMMA 🎵] Audio frame ${state.frameCount}: bass=${a.spectrum?.bass?.toFixed(2) || '?'}, mid=${a.spectrum?.mid?.toFixed(2) || '?'}, energy=${a.dynamics?.energy?.toFixed(2) || '?'}`);
        }
        
        if (isAudioAnalysis(analysis)) {
          const decision = generateDecision(analysis);
          sendMessage(
            MessageType.LIGHTING_DECISION,
            'alpha',
            decision,
            analysis.onBeat ? MessagePriority.HIGH : MessagePriority.NORMAL
          );
        }
        break;
        
      case MessageType.STATE_RESTORE:
        const snapshot = message.payload as { state: unknown };
        restoreStateSnapshot(snapshot.state);
        break;
        
      case MessageType.CONFIG_UPDATE:
        Object.assign(config, message.payload);
        if (DEBUG_VERBOSE) console.log('[GAMMA] Config updated');
        break;
      
      // 🧠 WAVE 10: Brain Control Messages
      case MessageType.SET_MODE: {
        const modePayload = message.payload as { mode: 'reactive' | 'intelligent' | 'forced' };
        if (modePayload.mode === 'intelligent' || modePayload.mode === 'forced') {
          state.brainForced = true;
          state.operationMode = 'intelligent';
          console.log('[GAMMA] 🧠 BRAIN MODE ACTIVATED');  // Keep - high level
        } else {
          state.brainForced = false;
          state.operationMode = 'reactive';
          console.log('[GAMMA] 🔄 REACTIVE MODE');  // Keep - high level
        }
        break;
      }
      
      case MessageType.ENABLE_BRAIN:
        state.brainForced = true;
        state.operationMode = 'intelligent';
        console.log('[GAMMA] ⚡ BRAIN ENABLED');  // Keep - one clean log
        break;
      
      case MessageType.DISABLE_BRAIN:
        state.brainForced = false;
        state.operationMode = 'reactive';
        console.log('[GAMMA] 💤 BRAIN DISABLED');  // Keep - one clean log
        break;
        
      default:
        console.warn(`[GAMMA] Unknown message type: ${message.type}`);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    state.errors.push(errorMsg);
    console.error(`[GAMMA] Error handling ${message.type}:`, errorMsg);
    
    sendMessage(MessageType.WORKER_ERROR, 'alpha', {
      nodeId: NODE_ID,
      error: errorMsg,
      messageType: message.type
    }, MessagePriority.CRITICAL);
  }
}

// ============================================
// SEND MESSAGE
// ============================================

function sendMessage<T>(
  type: MessageType,
  target: 'alpha' | 'beta' | 'broadcast',
  payload: T,
  priority: MessagePriority = MessagePriority.NORMAL
): void {
  const message = createMessage(type, NODE_ID, target, payload, priority);
  parentPort?.postMessage(message);
}

// ============================================
// MAIN LISTENER
// ============================================

if (parentPort) {
  parentPort.on('message', handleMessage);
  
  console.log('[GAMMA] 🧠 Worker ready');  // Keep - startup only
  
  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    console.error('[GAMMA] Uncaught exception:', error);
    sendMessage(MessageType.WORKER_ERROR, 'alpha', {
      nodeId: NODE_ID,
      error: error.message,
      fatal: true
    }, MessagePriority.CRITICAL);
  });
  
  process.on('unhandledRejection', (reason) => {
    console.error('[GAMMA] Unhandled rejection:', reason);
    sendMessage(MessageType.WORKER_ERROR, 'alpha', {
      nodeId: NODE_ID,
      error: String(reason),
      fatal: false
    }, MessagePriority.CRITICAL);
  });
} else {
  console.error('[GAMMA] No parentPort - not running as worker thread!');
  process.exit(1);
}

// ============================================
// PERIODIC HEALTH REPORT
// ============================================

setInterval(() => {
  if (state.isRunning) {
    sendMessage(MessageType.HEALTH_REPORT, 'alpha', generateHealthReport());
  }
}, 5000);
