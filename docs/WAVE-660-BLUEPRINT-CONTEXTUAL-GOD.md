# 🏛️ WAVE 660: BLUEPRINT "THE CONTEXTUAL GOD"
## Arquitectura para Conciencia Musical Contextual

**Fecha**: 16/01/2026  
**Autor**: PunkOpus (El Arquitecto de Código)  
**Para**: Radwulf (El Visionario)  
**Objetivo**: Convertir Selene en un DSP de software que compita con GrandMA3

**Status**: ✅ APROBADO CON HONORES (MAGNA CUM LAUDE) - Ajustado con notas del CEO

---

## 🔴 AJUSTES DEL CEO (CRÍTICOS)

```
╔════════════════════════════════════════════════════════════════════╗
║  PRIORIDAD #1: AGC PRIMERO O MORIMOS                              ║
║  ───────────────────────────────────────────────────────────────   ║
║  WAVE 670 movido a FASE 0 (ejecutar antes de todo).               ║
║  Sin AGC, los Z-Scores son ficción matemática.                    ║
║  Garbage In, Garbage Out.                                          ║
╠════════════════════════════════════════════════════════════════════╣
║  PRIORIDAD #2: VISUALIZACIÓN DE DEBUG                             ║
║  ───────────────────────────────────────────────────────────────   ║
║  Añadida sección 3.5: TacticalLog.logContextState()               ║
║  Con tanta matemática (Z-Scores, Fuzzy, AGC gain), necesitamos    ║
║  VER esos números en tiempo real.                                 ║
║  Formato: "Z-Energy: +3.2σ" visible en consola.                   ║
╚════════════════════════════════════════════════════════════════════╝
```

**Veredicto CEO**: "Este documento no es solo código; es una Declaración de Independencia del hardware caro."

---

## 🎯 VISIÓN

> "GrandMA3 tiene hardware de $50K. Nosotros tenemos MATEMÁTICA."

Selene debe evolucionar de un sistema reactivo a un **oráculo musical contextual** que:
1. **SIENTE** el espectro completo (harshness, flatness, transientes)
2. **RECUERDA** la narrativa musical (Z-Score histórico)
3. **PREDICE** el futuro inmediato (drops, transiciones)
4. **DECIDE** con lógica difusa, no binaria

---

## 📐 1. LA NUEVA SINAPSIS (Data Flow Architecture)

### 1.1 Diagrama de Flujo Completo

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            AUDIO CAPTURE                                     │
│                         (Web Audio API)                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Float32Array (raw PCM)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  LAYER 0: AUTOMATIC GAIN CONTROL (AGC)                                      │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  AutomaticGainControl.update(rawBuffer)                               │  │
│  │  - Peak Tracking (decay 0.995/frame)                                  │  │
│  │  - Normalización: buffer_norm = buffer / maxPeak                      │  │
│  │  - Floor: 0.10 (evita amplificación excesiva)                         │  │
│  │  OUTPUT: normalizedBuffer: Float32Array                               │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ normalizedBuffer
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  LAYER 1: FFT SPECTRAL ANALYSIS (GAMMA Worker)                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  FFTAnalyzer.analyze(normalizedBuffer)                                │  │
│  │  - Cooley-Tukey Radix-2 FFT (2048 bins)                               │  │
│  │  - Hanning Window (anti-leakage)                                      │  │
│  │  - Band Energy: subBass/bass/lowMid/mid/highMid/treble                │  │
│  │  - Spectral Metrics: centroid, dominantFreq                           │  │
│  │  - 🆕 Harshness: ratio 2-5kHz / total                                 │  │
│  │  - 🆕 Flatness: geometric_mean / arithmetic_mean                      │  │
│  │  - Transients: kick/snare/hihat detection                             │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  OUTPUT: SpectralAnalysis                                                    │
│  {                                                                           │
│    bands: { bass, mid, treble, subBass, lowMid, highMid }                   │
│    spectral: { harshness, flatness, centroid, dominantFreq }                │
│    transients: { kick, snare, hihat }                                       │
│    energy: number (RMS total)                                               │
│  }                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ postMessage (Worker → Main)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  LAYER 2: TRINITY BRAIN (Main Thread - Reception)                           │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  TrinityBrain.receiveFromGamma(spectralAnalysis)                      │  │
│  │  - Memory Buffer: últimos 5 segundos                                  │  │
│  │  - 🆕 Z-Score Calculator: detecta anomalías estadísticas              │  │
│  │  - 🆕 ContextualMemory: narrativa musical acumulada                   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  OUTPUT: EnrichedMusicalContext                                             │
│  {                                                                           │
│    ...spectralAnalysis,                                                     │
│    zScores: { energy, bass, harshness }                                     │
│    narrativeContext: { phaseTrend, sectionHistory }                         │
│  }                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  LAYER 3: TITAN ENGINE (Stabilization)                                      │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  TitanEngine.update(enrichedContext)                                  │  │
│  │  - EnergyStabilizer: rawEnergy + smoothedEnergy (EMA 0.70)            │  │
│  │  - KeyStabilizer: lock 10s para evitar saltos                         │  │
│  │  - MoodArbiter: emotion + thermal temp                                │  │
│  │  - StrategyArbiter: color strategy                                    │  │
│  │  - 🆕 SpectralStabilizer: harshness/flatness smoothing                │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  OUTPUT: TitanStabilizedState (EXTENDED)                                    │
│  {                                                                           │
│    rawEnergy, smoothedEnergy,                                               │
│    stableKey, stableEmotion, stableStrategy,                                │
│    thermalTemperature,                                                      │
│    bass, mid, high,                                                         │
│    bpm, beatPhase, syncopation,                                             │
│    sectionType,                                                             │
│    // 🆕 NUEVOS CAMPOS                                                      │
│    spectralHarshness: number,    // 0-1 (synth sucio)                       │
│    spectralFlatness: number,     // 0-1 (ruido vs tonal)                    │
│    energyZScore: number,         // Desviación estándar                     │
│    transients: { kick, snare, hihat }                                       │
│  }                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  LAYER 4: SELENE TITAN CONSCIOUS (Intelligence)                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  SeleneTitanConscious.process(titanState)                             │  │
│  │                                                                        │  │
│  │  SENSE PHASE:                                                          │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │  │
│  │  │ MusicalPatternSensor → SeleneMusicalPattern (EXTENDED)          │  │  │
│  │  │ BeautySensor → SeleneBeauty                                     │  │  │
│  │  │ ConsonanceSensor → ConsonanceScore                              │  │  │
│  │  │ 🆕 ContextualMemory.update() → NarrativeContext                 │  │  │
│  │  └─────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                        │  │
│  │  THINK PHASE:                                                          │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │  │
│  │  │ HuntEngine.hunt() → HuntDecision                                │  │  │
│  │  │ 🆕 FuzzyDecisionMaker.evaluate() → FuzzyScore                   │  │  │
│  │  │ 🆕 DropBridge.check() → DropTrigger                             │  │  │
│  │  └─────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                        │  │
│  │  DECIDE PHASE:                                                         │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │  │
│  │  │ DecisionMaker.decide(fuzzyScore, dropTrigger) →                 │  │  │
│  │  │   ConsciousnessOutput                                           │  │  │
│  │  └─────────────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  OUTPUT: ConsciousnessOutput                                                │
│  {                                                                           │
│    effectDecision: { type: 'solar_flare', intensity, confidence }           │
│    colorDecision: { palette, strategy }                                     │
│    movementDecision: { pattern, speed }                                     │
│  }                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Interfaces TypeScript Propuestas

#### SpectralAnalysis (Output del FFT extendido)

```typescript
// src/workers/types.ts

/**
 * 🎵 WAVE 660: Análisis Espectral Completo
 * Output del FFTAnalyzer con métricas avanzadas
 */
export interface SpectralAnalysis {
  // === BANDAS DE FRECUENCIA ===
  bands: {
    subBass: number;   // 20-60 Hz (kicks profundos)
    bass: number;      // 60-250 Hz (graves)
    lowMid: number;    // 250-500 Hz
    mid: number;       // 500-2000 Hz (voz, instrumentos)
    highMid: number;   // 2000-4000 Hz (presencia)
    treble: number;    // 4000-20000 Hz (brillo)
  };
  
  // === MÉTRICAS ESPECTRALES AVANZADAS ===
  spectral: {
    /** Ratio de energía en banda harsh (2-5kHz) vs total. 0=limpio, 1=distorsión */
    harshness: number;
    
    /** Geometric mean / Arithmetic mean. 0=tonal, 1=ruido blanco */
    flatness: number;
    
    /** Centro de masa del espectro en Hz. Alto=brillante, Bajo=oscuro */
    centroid: number;
    
    /** Frecuencia con mayor energía en Hz */
    dominantFrequency: number;
  };
  
  // === DETECCIÓN DE TRANSIENTES ===
  transients: {
    /** ¿Se detectó kick este frame? */
    kick: boolean;
    /** ¿Se detectó snare este frame? */
    snare: boolean;
    /** ¿Se detectó hihat este frame? */
    hihat: boolean;
    /** Intensidad del transiente más fuerte (0-1) */
    transientStrength: number;
  };
  
  // === ENERGÍA GLOBAL ===
  /** Energía RMS total normalizada (0-1) */
  energy: number;
  
  /** Timestamp del análisis */
  timestamp: number;
}
```

#### TitanStabilizedState (Extendido)

```typescript
// src/core/intelligence/types.ts

/**
 * 🔥 WAVE 660: Estado Estabilizado Extendido
 * Añade métricas espectrales y contextuales
 */
export interface TitanStabilizedState {
  // === CONTEXTO DEL VIBE ===
  vibeId: VibeId;
  constitution: GenerationOptions;
  
  // === DATOS ESTABILIZADOS (anti-epilepsia) ===
  stableKey: string | null;
  stableEmotion: MetaEmotion;
  stableStrategy: ColorStrategy;
  rawEnergy: number;      // GAMMA directo (WAVE 642)
  smoothedEnergy: number; // Smart Smooth EMA 0.70
  isDropActive: boolean;
  thermalTemperature: number;
  
  // === AUDIO EN TIEMPO REAL ===
  bass: number;
  mid: number;
  high: number;
  
  // === CONTEXTO MUSICAL ===
  bpm: number;
  beatPhase: number;
  syncopation: number;
  sectionType: SectionType;
  
  // === 🆕 WAVE 660: MÉTRICAS ESPECTRALES ===
  spectralHarshness: number;  // 0-1 (synth sucio/distorsión)
  spectralFlatness: number;   // 0-1 (ruido vs tonal)
  
  // === 🆕 WAVE 660: CONTEXTO ESTADÍSTICO ===
  energyZScore: number;       // Desviación estándar (-3 a +3 típico)
  bassZScore: number;         // Para detectar kicks anómalos
  
  // === 🆕 WAVE 660: TRANSIENTES ===
  transients: {
    kick: boolean;
    snare: boolean;
    hihat: boolean;
    strength: number;
  };
  
  // === PALETA Y TIMING ===
  currentPalette: SelenePalette;
  frameId: number;
  timestamp: number;
}
```

#### SeleneMusicalPattern (Extendido)

```typescript
// src/core/intelligence/types.ts

/**
 * 🎼 WAVE 660: Patrón Musical Extendido
 * Incluye sentidos espectrales y contexto narrativo
 */
export interface SeleneMusicalPattern {
  // === CONTEXTO VIBE ===
  vibeId: VibeId;
  
  // === CLASIFICACIONES ===
  section: SectionClassification;
  energyPhase: EnergyPhase;
  
  // === MÉTRICAS DE RITMO ===
  bpm: number;
  beatPhase: number;
  syncopation: number;
  rhythmicIntensity: number;
  
  // === MÉTRICAS DE EMOCIÓN/TENSIÓN ===
  emotionalTension: number;
  isBuilding: boolean;
  isReleasing: boolean;
  
  // === MÉTRICAS DE ARMONÍA ===
  harmonicDensity: number;
  
  // === BANDAS DE FRECUENCIA ===
  bassPresence: number;
  midPresence: number;
  highPresence: number;
  
  // === ENERGÍA (WAVE 642) ===
  rawEnergy: number;
  smoothedEnergy: number;
  
  // === DROP STATE ===
  isDropActive: boolean;
  distanceFromDrop: number;
  
  // === 🆕 WAVE 660: SENTIDOS ESPECTRALES ===
  spectralHarshness: number;   // 0-1
  spectralFlatness: number;    // 0-1
  spectralBrightness: number;  // Derivado del centroid (0-1)
  
  // === 🆕 WAVE 660: CONTEXTO ESTADÍSTICO ===
  energyZScore: number;        // ¿Cuán anómala es la energía actual?
  isStatisticalAnomaly: boolean; // |zScore| > 2.5
  
  // === 🆕 WAVE 660: TRANSIENTES ===
  hasKick: boolean;
  hasSnare: boolean;
  hasHihat: boolean;
  transientDensity: number;    // Transientes por segundo
  
  // === 🆕 WAVE 660: CONTEXTO NARRATIVO ===
  narrativePhase: 'intro' | 'building' | 'climax' | 'release' | 'outro';
  sectionAge: number;          // ms desde inicio de sección actual
  predictedNextSection: SectionType | null;
  predictionConfidence: number;
  
  // === TIMING ===
  timestamp: number;
}
```

---

## 🧠 2. LA MEMORIA CONTEXTUAL (The Hippocampus)

### 2.1 Arquitectura de ContextualMemory

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  CONTEXTUAL MEMORY - "El Hipocampo de Selene"                               │
│  src/core/intelligence/memory/ContextualMemory.ts                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  ROLLING STATS BUFFER (Estadísticas Rodantes)                       │    │
│  │  ────────────────────────────────────────────────────────────────── │    │
│  │  - Circular Buffer: últimos 300 frames (~5 segundos @ 60fps)        │    │
│  │  - Métricas trackeadas:                                             │    │
│  │    • energy: mean, stdDev, min, max                                 │    │
│  │    • bass: mean, stdDev, min, max                                   │    │
│  │    • harshness: mean, stdDev                                        │    │
│  │    • transientCount: suma de kicks+snares en ventana                │    │
│  │                                                                      │    │
│  │  OUTPUT: RollingStats {                                             │    │
│  │    energy: { mean, stdDev, min, max, current, zScore }              │    │
│  │    bass: { mean, stdDev, min, max, current, zScore }                │    │
│  │    harshness: { mean, stdDev, current }                             │    │
│  │    transientRate: number (transients/second)                        │    │
│  │  }                                                                  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  SECTION HISTORY TRACKER (Narrativa Musical)                        │    │
│  │  ────────────────────────────────────────────────────────────────── │    │
│  │  - Integración con SectionTracker.getSectionHistory()               │    │
│  │  - Últimas 8 secciones con timestamps y duración                    │    │
│  │  - Detección de patrones: buildup→buildup = DROP INCOMING           │    │
│  │                                                                      │    │
│  │  OUTPUT: NarrativeContext {                                         │    │
│  │    currentSection: SectionType                                      │    │
│  │    sectionAge: number (ms)                                          │    │
│  │    sectionHistory: SectionHistoryEntry[]                            │    │
│  │    narrativePhase: 'intro' | 'building' | 'climax' | 'release'      │    │
│  │    predictedNext: { section: SectionType, probability: number }     │    │
│  │  }                                                                  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  ANOMALY DETECTOR (Detector de Momentos Épicos)                     │    │
│  │  ────────────────────────────────────────────────────────────────── │    │
│  │  - Z-Score Thresholds:                                              │    │
│  │    • |z| > 1.5 = Notable                                            │    │
│  │    • |z| > 2.0 = Significativo                                      │    │
│  │    • |z| > 2.5 = Anomalía (DROP/BREAKDOWN)                          │    │
│  │    • |z| > 3.0 = Momento Épico (FORCE STRIKE)                       │    │
│  │                                                                      │    │
│  │  OUTPUT: AnomalyReport {                                            │    │
│  │    isAnomaly: boolean                                               │    │
│  │    type: 'spike' | 'drop' | 'sustained_high' | 'sustained_low'      │    │
│  │    severity: number (1.5 - 4.0)                                     │    │
│  │    metrics: { energy, bass, harshness }                             │    │
│  │  }                                                                  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Interface TypeScript: ContextualMemory

```typescript
// src/core/intelligence/memory/ContextualMemory.ts

/**
 * 🧠 WAVE 660: CONTEXTUAL MEMORY
 * "El Hipocampo de Selene" - Memoria contextual para entender la narrativa musical
 */

export interface RollingStats {
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  current: number;
  zScore: number;  // (current - mean) / stdDev
}

export interface MetricStats {
  energy: RollingStats;
  bass: RollingStats;
  harshness: RollingStats;
  transientRate: number;  // transients per second
}

export interface SectionHistoryEntry {
  type: SectionType;
  startTime: number;
  endTime: number | null;
  duration: number;
  avgEnergy: number;
  peakEnergy: number;
}

export interface NarrativeContext {
  currentSection: SectionType;
  sectionAge: number;
  sectionHistory: SectionHistoryEntry[];
  narrativePhase: 'intro' | 'building' | 'climax' | 'release' | 'outro';
  predictedNext: {
    section: SectionType;
    probability: number;
    estimatedTimeMs: number;
  } | null;
}

export interface AnomalyReport {
  isAnomaly: boolean;
  type: 'spike' | 'drop' | 'sustained_high' | 'sustained_low' | 'none';
  severity: number;  // 0-4 (0=normal, 4=épico)
  affectedMetrics: ('energy' | 'bass' | 'harshness')[];
  recommendation: 'ignore' | 'prepare' | 'strike' | 'force_strike';
}

export interface ContextualMemoryConfig {
  /** Tamaño del buffer circular en frames (default: 300 = 5s @ 60fps) */
  bufferSize: number;
  
  /** Z-Score threshold para anomalía (default: 2.5) */
  anomalyThreshold: number;
  
  /** Z-Score threshold para momento épico (default: 3.0) */
  epicThreshold: number;
  
  /** Tamaño del historial de secciones (default: 8) */
  sectionHistorySize: number;
}

export class ContextualMemory {
  private config: ContextualMemoryConfig;
  
  // Buffers circulares
  private energyBuffer: CircularBuffer<number>;
  private bassBuffer: CircularBuffer<number>;
  private harshnessBuffer: CircularBuffer<number>;
  private transientBuffer: CircularBuffer<boolean>;
  
  // Estado
  private sectionHistory: SectionHistoryEntry[] = [];
  private currentSectionStart: number = 0;
  private frameCount: number = 0;
  
  constructor(config: Partial<ContextualMemoryConfig> = {});
  
  /**
   * Actualiza la memoria con un nuevo frame
   */
  update(input: {
    energy: number;
    bass: number;
    harshness: number;
    hasTransient: boolean;
    sectionType: SectionType;
    timestamp: number;
  }): void;
  
  /**
   * Obtiene las estadísticas rodantes actuales
   */
  getStats(): MetricStats;
  
  /**
   * Obtiene el contexto narrativo
   */
  getNarrativeContext(): NarrativeContext;
  
  /**
   * Detecta anomalías basadas en Z-Score
   */
  detectAnomaly(): AnomalyReport;
  
  /**
   * Calcula el Z-Score de un valor dado
   */
  calculateZScore(metric: 'energy' | 'bass' | 'harshness', value: number): number;
  
  /**
   * Predice la próxima sección basado en historial
   */
  predictNextSection(): NarrativeContext['predictedNext'];
  
  /**
   * Reset completo (cambio de canción)
   */
  reset(): void;
}
```

### 2.3 Algoritmo Z-Score

```typescript
/**
 * Z-SCORE CALCULATION
 * 
 * Z = (X - μ) / σ
 * 
 * Donde:
 * - X = valor actual
 * - μ = media del buffer
 * - σ = desviación estándar del buffer
 * 
 * Interpretación:
 * - Z = 0: Valor exactamente promedio
 * - Z = 1: Una desviación estándar por encima
 * - Z = 2: Dos desviaciones (top 2.5% de valores)
 * - Z = 3: Tres desviaciones (top 0.15% - RARO)
 */

private calculateZScore(buffer: CircularBuffer<number>, currentValue: number): number {
  const values = buffer.getAll();
  if (values.length < 30) return 0; // Need minimum samples
  
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  
  if (stdDev < 0.001) return 0; // Avoid division by near-zero
  
  return (currentValue - mean) / stdDev;
}
```

---

## ⚡ 3. EL JUICIO DIVINO (Fuzzy Decision Logic)

### 3.1 Arquitectura del Sistema de Decisión

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  DECISION SYSTEM - "El Juicio Divino"                                       │
│  src/core/intelligence/think/                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  INPUTS:                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ HuntDecision│  │ AnomalyRpt  │  │ Narrative   │  │ Musical     │        │
│  │ (HuntEngine)│  │ (Memory)    │  │ Context     │  │ Pattern     │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│         │                │                │                │                │
│         └────────────────┴────────────────┴────────────────┘                │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  FUZZY DECISION MAKER                                                │   │
│  │  ──────────────────────────────────────────────────────────────────  │   │
│  │                                                                       │   │
│  │  STEP 1: FUZZIFICATION (Convertir valores crisp → fuzzy sets)        │   │
│  │  ┌─────────────────────────────────────────────────────────────┐     │   │
│  │  │ energy: 0.85 → { low: 0.0, medium: 0.3, high: 1.0 }         │     │   │
│  │  │ zScore: 2.8  → { normal: 0.0, notable: 0.2, epic: 0.9 }     │     │   │
│  │  │ section: 'drop' → { quiet: 0.0, building: 0.0, peak: 1.0 }  │     │   │
│  │  └─────────────────────────────────────────────────────────────┘     │   │
│  │                                                                       │   │
│  │  STEP 2: RULE EVALUATION (Evaluar reglas difusas)                    │   │
│  │  ┌─────────────────────────────────────────────────────────────┐     │   │
│  │  │ IF energy.high AND zScore.epic AND section.peak             │     │   │
│  │  │ THEN action.forceStrike = 1.0                               │     │   │
│  │  │                                                              │     │   │
│  │  │ IF energy.medium AND huntScore > 0.7                        │     │   │
│  │  │ THEN action.strike = 0.8                                    │     │   │
│  │  │                                                              │     │   │
│  │  │ IF energy.low AND section.quiet                             │     │   │
│  │  │ THEN action.hold = 1.0                                      │     │   │
│  │  └─────────────────────────────────────────────────────────────┘     │   │
│  │                                                                       │   │
│  │  STEP 3: DEFUZZIFICATION (Convertir fuzzy → decisión crisp)          │   │
│  │  ┌─────────────────────────────────────────────────────────────┐     │   │
│  │  │ action = centroid({ forceStrike, strike, prepare, hold })   │     │   │
│  │  │ intensity = weighted_average(all_scores)                    │     │   │
│  │  └─────────────────────────────────────────────────────────────┘     │   │
│  │                                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  DROP BRIDGE - "El Puente del Trueno"                                │   │
│  │  ──────────────────────────────────────────────────────────────────  │   │
│  │                                                                       │   │
│  │  CONDICIÓN DIVINA:                                                   │   │
│  │  (energyZScore > 3.0) AND (section == 'drop') => FORCE_STRIKE       │   │
│  │                                                                       │   │
│  │  OVERRIDE: Esta condición tiene prioridad ABSOLUTA.                  │   │
│  │  No importa qué diga el HuntEngine o la lógica fuzzy.                │   │
│  │  Cuando el Drop es estadísticamente ÉPICO, disparamos.               │   │
│  │                                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  OUTPUT: ConsciousnessOutput                                               │
│  {                                                                          │
│    effectDecision: { type, intensity, confidence, reason }                 │
│    ...                                                                      │
│  }                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Interface: FuzzyDecisionMaker

```typescript
// src/core/intelligence/think/FuzzyDecisionMaker.ts

/**
 * ⚡ WAVE 660: FUZZY DECISION MAKER
 * Lógica difusa para decisiones no binarias
 */

export interface FuzzySet {
  low: number;     // Membership grade for "low" (0-1)
  medium: number;  // Membership grade for "medium" (0-1)
  high: number;    // Membership grade for "high" (0-1)
}

export interface ZScoreFuzzySet {
  normal: number;   // |z| < 1.5
  notable: number;  // 1.5 <= |z| < 2.5
  epic: number;     // |z| >= 2.5
}

export interface SectionFuzzySet {
  quiet: number;    // intro, outro, breakdown
  building: number; // verse, pre_chorus, buildup
  peak: number;     // chorus, drop
}

export interface FuzzyInputs {
  energy: FuzzySet;
  zScore: ZScoreFuzzySet;
  section: SectionFuzzySet;
  harshness: FuzzySet;
  huntScore: number;  // 0-1 crisp
  beauty: number;     // 0-1 crisp
}

export interface FuzzyOutputs {
  forceStrike: number;  // 0-1
  strike: number;       // 0-1
  prepare: number;      // 0-1
  hold: number;         // 0-1
}

export interface FuzzyDecision {
  action: 'force_strike' | 'strike' | 'prepare' | 'hold';
  intensity: number;    // 0-1
  confidence: number;   // 0-1
  reasoning: string;
  fuzzyScores: FuzzyOutputs;
}

export class FuzzyDecisionMaker {
  /**
   * FUZZIFICATION: Convierte valores crisp a conjuntos difusos
   */
  private fuzzify(inputs: {
    energy: number;
    zScore: number;
    sectionType: SectionType;
    harshness: number;
    huntScore: number;
    beauty: number;
  }): FuzzyInputs;
  
  /**
   * RULE EVALUATION: Evalúa todas las reglas difusas
   */
  private evaluateRules(fuzzyInputs: FuzzyInputs): FuzzyOutputs;
  
  /**
   * DEFUZZIFICATION: Convierte outputs difusos a decisión crisp
   */
  private defuzzify(fuzzyOutputs: FuzzyOutputs): FuzzyDecision;
  
  /**
   * MÉTODO PRINCIPAL: Evalúa y decide
   */
  evaluate(inputs: {
    energy: number;
    zScore: number;
    sectionType: SectionType;
    harshness: number;
    huntScore: number;
    beauty: number;
  }): FuzzyDecision;
}
```

### 3.3 Reglas Fuzzy Propuestas

```typescript
/**
 * FUZZY RULES - El Código de Conducta de Selene
 * 
 * Nomenclatura:
 * - E = Energy (low/med/high)
 * - Z = Z-Score (normal/notable/epic)
 * - S = Section (quiet/building/peak)
 * - H = Harshness (low/med/high)
 * - Hunt = Hunt Score (0-1)
 */

const FUZZY_RULES = [
  // === FORCE STRIKE (Condición Divina) ===
  // Cuando el momento es estadísticamente ÉPICO, no hay discusión
  {
    name: 'Divine_Drop',
    condition: (i: FuzzyInputs) => 
      Math.min(i.energy.high, i.zScore.epic, i.section.peak),
    output: 'forceStrike',
    weight: 1.0,
  },
  
  // === STRIKE (Momento Óptimo) ===
  {
    name: 'Hunt_Strike',
    condition: (i: FuzzyInputs) => 
      Math.min(i.energy.high, i.huntScore, i.section.peak),
    output: 'strike',
    weight: 0.9,
  },
  {
    name: 'Harsh_Climax',
    condition: (i: FuzzyInputs) => 
      Math.min(i.energy.high, i.harshness.high, i.section.peak),
    output: 'strike',
    weight: 0.85,
  },
  {
    name: 'ZScore_Spike',
    condition: (i: FuzzyInputs) => 
      Math.min(i.zScore.notable, i.section.building),
    output: 'strike',
    weight: 0.7,
  },
  
  // === PREPARE (Anticipación) ===
  {
    name: 'Building_Tension',
    condition: (i: FuzzyInputs) => 
      Math.min(i.energy.medium, i.section.building),
    output: 'prepare',
    weight: 0.6,
  },
  {
    name: 'Notable_Activity',
    condition: (i: FuzzyInputs) => 
      i.zScore.notable * 0.5,
    output: 'prepare',
    weight: 0.5,
  },
  
  // === HOLD (Mantener Estado) ===
  {
    name: 'Quiet_Section',
    condition: (i: FuzzyInputs) => 
      Math.min(i.energy.low, i.section.quiet),
    output: 'hold',
    weight: 1.0,
  },
  {
    name: 'Normal_State',
    condition: (i: FuzzyInputs) => 
      i.zScore.normal * (1 - i.huntScore),
    output: 'hold',
    weight: 0.8,
  },
];
```

### 3.4 The Drop Bridge (Override Divino)

```typescript
// src/core/intelligence/think/DropBridge.ts

/**
 * ⚡ THE DROP BRIDGE
 * "El Puente del Trueno"
 * 
 * CONDICIÓN DIVINA: (Energy > 3σ) AND (Section == Drop) => FORCE STRIKE
 * 
 * Esta lógica tiene PRIORIDAD ABSOLUTA sobre cualquier otra decisión.
 * Cuando el universo musical se alinea perfectamente, disparamos.
 */

export interface DropBridgeInput {
  energyZScore: number;
  sectionType: SectionType;
  rawEnergy: number;
  hasKick: boolean;
}

export interface DropBridgeResult {
  shouldForceStrike: boolean;
  intensity: number;
  reason: string;
  metrics: {
    zScore: number;
    section: SectionType;
    energy: number;
  };
}

export class DropBridge {
  private readonly ZSCORE_THRESHOLD = 3.0;  // 3 sigma = 0.15% de probabilidad
  private readonly DROP_SECTIONS: SectionType[] = ['drop', 'chorus'];
  private readonly MIN_ENERGY = 0.75;
  
  check(input: DropBridgeInput): DropBridgeResult {
    const { energyZScore, sectionType, rawEnergy, hasKick } = input;
    
    // CONDICIÓN DIVINA
    const isEpicZScore = energyZScore >= this.ZSCORE_THRESHOLD;
    const isDropSection = this.DROP_SECTIONS.includes(sectionType);
    const hasMinEnergy = rawEnergy >= this.MIN_ENERGY;
    
    const shouldForceStrike = isEpicZScore && isDropSection && hasMinEnergy;
    
    // Intensidad proporcional al Z-Score
    // z=3.0 → 0.85, z=3.5 → 0.92, z=4.0 → 1.0
    const intensity = shouldForceStrike 
      ? Math.min(1.0, 0.7 + (energyZScore - 3.0) * 0.15)
      : 0;
    
    return {
      shouldForceStrike,
      intensity,
      reason: shouldForceStrike 
        ? `DROP BRIDGE ACTIVATED: z=${energyZScore.toFixed(2)}, section=${sectionType}, E=${rawEnergy.toFixed(2)}`
        : `No trigger: z=${energyZScore.toFixed(2)}, section=${sectionType}`,
      metrics: {
        zScore: energyZScore,
        section: sectionType,
        energy: rawEnergy,
      },
    };
  }
}
```

---

## � 3.5 DEBUG VISUALIZATION - "LOS OJOS DEL CONTEXTO"

### 3.5.1 TacticalLog Extension para Context State

**PROBLEMA**: Con tanta matemática (Z-Scores, Fuzzy values, AGC gainFactor), necesitamos VER esos números en tiempo real o estaremos volando a ciegas.

**SOLUCIÓN**: Extender el TacticalLog con un panel dedicado al "Context State" que muestre:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  TACTICAL LOG - CONTEXT STATE PANEL                                         │
│  src/core/intelligence/debug/TacticalLogger.ts                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  📊 SPECTRAL METRICS                                                        │
│  ──────────────────────                                                     │
│  Harshness:  ████████░░  0.78  (synth sucio)                                │
│  Flatness:   ██░░░░░░░░  0.23  (tonal)                                      │
│  Brightness: ██████████  0.92  (high centroid)                              │
│  AGC Gain:   ███████░░░  0.68  (normalizing soft audio)                     │
│                                                                              │
│  📈 STATISTICAL CONTEXT                                                     │
│  ───────────────────────                                                     │
│  Energy Z:   +3.2σ  🔴 EPIC ANOMALY                                         │
│  Bass Z:     +1.8σ  🟡 Notable                                              │
│  Harsh Z:    +0.5σ  🟢 Normal                                               │
│                                                                              │
│  🎵 NARRATIVE CONTEXT                                                       │
│  ──────────────────────                                                      │
│  Phase:      CLIMAX                                                         │
│  Section:    drop (age: 1.2s)                                               │
│  Predicted:  breakdown (conf: 0.75)                                         │
│  History:    buildup → buildup → drop [CURRENT]                             │
│                                                                              │
│  🎲 FUZZY DECISION STATE                                                    │
│  ───────────────────────                                                     │
│  Force:      ████████░░  0.85                                               │
│  Strike:     ████░░░░░░  0.42                                               │
│  Prepare:    ██░░░░░░░░  0.18                                               │
│  Hold:       ░░░░░░░░░░  0.05                                               │
│  → ACTION:   FORCE_STRIKE (Drop Bridge override)                            │
│                                                                              │
│  🎯 HUNT ENGINE                                                             │
│  ────────────                                                                │
│  Score:      0.89 (HIGH)                                                    │
│  Beauty:     0.62                                                           │
│  Veto:       NONE                                                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.5.2 Implementación TypeScript

```typescript
// src/core/intelligence/debug/TacticalLogger.ts

export interface ContextStateSnapshot {
  // Spectral
  spectralHarshness: number;
  spectralFlatness: number;
  spectralBrightness: number;
  agcGainFactor: number;
  
  // Statistical
  energyZScore: number;
  bassZScore: number;
  harshnessZScore: number;
  
  // Narrative
  narrativePhase: 'intro' | 'building' | 'climax' | 'release' | 'outro';
  currentSection: SectionType;
  sectionAge: number;
  predictedNext: { section: SectionType, confidence: number } | null;
  sectionHistory: SectionType[];
  
  // Fuzzy Decision
  fuzzyScores: {
    forceStrike: number;
    strike: number;
    prepare: number;
    hold: number;
  };
  fuzzyAction: 'force_strike' | 'strike' | 'prepare' | 'hold';
  dropBridgeActive: boolean;
  
  // Hunt
  huntScore: number;
  beauty: number;
  activeVeto: string | null;
}

export class TacticalLogger {
  // ...existing methods...
  
  /**
   * 🔬 WAVE 660: Log Context State
   * Visualiza el estado completo del sistema de contexto
   */
  logContextState(snapshot: ContextStateSnapshot): void {
    if (!this.enabled) return;
    
    console.group('🔬 CONTEXT STATE');
    
    // SPECTRAL METRICS
    console.group('📊 Spectral Metrics');
    console.log(`Harshness:  ${this.renderBar(snapshot.spectralHarshness)} ${snapshot.spectralHarshness.toFixed(2)}`);
    console.log(`Flatness:   ${this.renderBar(snapshot.spectralFlatness)} ${snapshot.spectralFlatness.toFixed(2)}`);
    console.log(`Brightness: ${this.renderBar(snapshot.spectralBrightness)} ${snapshot.spectralBrightness.toFixed(2)}`);
    console.log(`AGC Gain:   ${this.renderBar(snapshot.agcGainFactor)} ${snapshot.agcGainFactor.toFixed(2)}`);
    console.groupEnd();
    
    // STATISTICAL CONTEXT
    console.group('📈 Statistical Context');
    console.log(`Energy Z:   ${this.formatZScore(snapshot.energyZScore)}`);
    console.log(`Bass Z:     ${this.formatZScore(snapshot.bassZScore)}`);
    console.log(`Harsh Z:    ${this.formatZScore(snapshot.harshnessZScore)}`);
    console.groupEnd();
    
    // NARRATIVE CONTEXT
    console.group('🎵 Narrative Context');
    console.log(`Phase:      ${snapshot.narrativePhase.toUpperCase()}`);
    console.log(`Section:    ${snapshot.currentSection} (age: ${(snapshot.sectionAge / 1000).toFixed(1)}s)`);
    if (snapshot.predictedNext) {
      console.log(`Predicted:  ${snapshot.predictedNext.section} (conf: ${snapshot.predictedNext.confidence.toFixed(2)})`);
    }
    console.log(`History:    ${snapshot.sectionHistory.slice(-3).join(' → ')} [CURRENT]`);
    console.groupEnd();
    
    // FUZZY DECISION
    console.group('🎲 Fuzzy Decision State');
    console.log(`Force:      ${this.renderBar(snapshot.fuzzyScores.forceStrike)} ${snapshot.fuzzyScores.forceStrike.toFixed(2)}`);
    console.log(`Strike:     ${this.renderBar(snapshot.fuzzyScores.strike)} ${snapshot.fuzzyScores.strike.toFixed(2)}`);
    console.log(`Prepare:    ${this.renderBar(snapshot.fuzzyScores.prepare)} ${snapshot.fuzzyScores.prepare.toFixed(2)}`);
    console.log(`Hold:       ${this.renderBar(snapshot.fuzzyScores.hold)} ${snapshot.fuzzyScores.hold.toFixed(2)}`);
    console.log(`→ ACTION:   ${snapshot.fuzzyAction.toUpperCase()}${snapshot.dropBridgeActive ? ' (Drop Bridge override)' : ''}`);
    console.groupEnd();
    
    // HUNT ENGINE
    console.group('🎯 Hunt Engine');
    console.log(`Score:      ${snapshot.huntScore.toFixed(2)} (${snapshot.huntScore > 0.7 ? 'HIGH' : 'LOW'})`);
    console.log(`Beauty:     ${snapshot.beauty.toFixed(2)}`);
    console.log(`Veto:       ${snapshot.activeVeto || 'NONE'}`);
    console.groupEnd();
    
    console.groupEnd();
  }
  
  /**
   * Renderiza barra de progreso para valores 0-1
   */
  private renderBar(value: number, length: number = 10): string {
    const filled = Math.round(value * length);
    return '█'.repeat(filled) + '░'.repeat(length - filled);
  }
  
  /**
   * Formatea Z-Score con color semántico
   */
  private formatZScore(z: number): string {
    const absZ = Math.abs(z);
    const sign = z >= 0 ? '+' : '';
    const emoji = absZ >= 2.5 ? '🔴 EPIC ANOMALY' : absZ >= 1.5 ? '🟡 Notable' : '🟢 Normal';
    return `${sign}${z.toFixed(1)}σ  ${emoji}`;
  }
}
```

### 3.5.3 Integración en SeleneTitanConscious

```typescript
// src/core/intelligence/SeleneTitanConscious.ts

export class SeleneTitanConscious {
  // ...existing...
  
  process(state: TitanStabilizedState, signal: LiveMusicSignal): ConsciousnessOutput {
    // ...existing processing...
    
    // 🔬 WAVE 660: Log Context State (cada 30 frames = ~500ms)
    if (state.frameId % 30 === 0) {
      const snapshot: ContextStateSnapshot = {
        spectralHarshness: state.spectralHarshness,
        spectralFlatness: state.spectralFlatness,
        spectralBrightness: pattern.spectralBrightness,
        agcGainFactor: signal.agcGainFactor,  // 🆕 debe venir del worker
        
        energyZScore: state.energyZScore,
        bassZScore: state.bassZScore,
        harshnessZScore: pattern.harshnessZScore,  // 🆕
        
        narrativePhase: pattern.narrativePhase,
        currentSection: pattern.section.type,
        sectionAge: pattern.sectionAge,
        predictedNext: pattern.predictedNextSection ? {
          section: pattern.predictedNextSection,
          confidence: pattern.predictionConfidence,
        } : null,
        sectionHistory: this.memory.getSectionHistory().map(e => e.type),
        
        fuzzyScores: decision.fuzzyScores,
        fuzzyAction: decision.action,
        dropBridgeActive: decision.dropBridgeActive,
        
        huntScore: decision.huntScore,
        beauty: decision.beauty,
        activeVeto: decision.activeVeto,
      };
      
      this.logger.logContextState(snapshot);
    }
    
    return output;
  }
}
```

### 3.5.4 Visualización en Electron DevTools

**Beneficios:**
1. **Debugging quirúrgico**: Ver exactamente qué valor está causando una decisión
2. **Tuning de Z-Score**: Ajustar thresholds en tiempo real viendo los valores
3. **Validación de AGC**: Confirmar que el gainFactor normaliza correctamente
4. **Análisis post-mortem**: Scroll back en la consola para ver qué pasó antes de un strike

**Frecuencia de Log:**
- Cada 30 frames (~500ms @ 60fps)
- Solo cuando TacticalLog está habilitado (modo debug)
- Zero overhead en producción

---

## �🛠️ 4. PLAN DE REFACTORIZACIÓN

### 4.1 Hoja de Ruta por Fases

**⚠️ ORDEN DE EJECUCIÓN CRÍTICO:**

```
FASE 0: AGC Integration (WAVE 670) - PRIMERO O MORIMOS
  ↓
FASE 1: Spectral Pipeline (WAVE 661-663)
  ↓
FASE 2: Contextual Memory (WAVE 664-666)
  ↓
FASE 3: Fuzzy Decision System (WAVE 667-669)
  ↓
FASE 4: Testing & Tuning (WAVE 671-675)
```

*Nota: FASE 0 debe completarse ANTES que todo. Sin AGC, los Z-Scores son ficción.*

---

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🔴 FASE 0: AGC INTEGRATION - MÁXIMA PRIORIDAD (WAVE 670)                   │
│  ────────────────────────────────────────────────────────                    │
│  Objetivo: Normalizar audio ANTES del FFT para que Z-Scores sean reales     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  WAVE 670: AGC en GAMMA Worker                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │ □ Mover AutomaticGainControl.ts a src/workers/                     │     │
│  │ □ Instanciar AGC en mind.ts ANTES del FFTAnalyzer                  │     │
│  │ □ Normalizar buffer antes de FFT                                   │     │
│  │ □ Exponer gainFactor en análisis (para debug y validación)         │     │
│  │ □ Test: MP3 silencioso y WAV saturado producen energía similar     │     │
│  │ □ Test: Validar que gainFactor está visible en TacticalLog         │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
│  NOTA CEO: "Si la entrada es basura, todo el sistema falla. AGC primero."   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  FASE 1: SPECTRAL PIPELINE (WAVE 661-663)                                   │
│  ─────────────────────────────────────────                                   │
│  Objetivo: Exponer harshness/flatness/transients hasta TitanStabilizedState │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  WAVE 661: FFT → GAMMA                                                      │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │ □ Modificar mind.ts para extraer spectral metrics del FFTAnalyzer  │     │
│  │ □ Añadir campos a MusicalAnalysis: harshness, flatness, transients │     │
│  │ □ Propagar vía postMessage a TrinityBrain                          │     │
│  │ □ Test: Verificar que los valores llegan al Main Thread            │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
│  WAVE 662: TrinityBrain → TitanEngine                                       │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │ □ Extender MusicalContext con campos espectrales                   │     │
│  │ □ TrinityBrain.receiveFromGamma() procesa nuevos campos            │     │
│  │ □ TitanEngine.update() pasa spectral a stabilizers                 │     │
│  │ □ Test: TitanStabilizedState tiene spectralHarshness/Flatness      │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
│  WAVE 663: TitanStabilizedState → SeleneMusicalPattern                      │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │ □ Extender TitanStabilizedState interface                          │     │
│  │ □ Extender SeleneMusicalPattern interface                          │     │
│  │ □ MusicalPatternSensor mapea los nuevos campos                     │     │
│  │ □ Test: DecisionMaker puede leer spectralHarshness                 │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  FASE 2: CONTEXTUAL MEMORY (WAVE 664-666)                                   │
│  ─────────────────────────────────────────                                   │
│  Objetivo: Implementar memoria contextual con Z-Score                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  WAVE 664: CircularBuffer + RollingStats                                    │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │ □ Crear src/core/intelligence/memory/CircularBuffer.ts             │     │
│  │ □ Crear src/core/intelligence/memory/RollingStats.ts               │     │
│  │ □ Implementar cálculo de Z-Score eficiente                         │     │
│  │ □ Test: Z-Score correcto con datos sintéticos                      │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
│  WAVE 665: ContextualMemory Class                                           │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │ □ Crear src/core/intelligence/memory/ContextualMemory.ts           │     │
│  │ □ Implementar update(), getStats(), detectAnomaly()                │     │
│  │ □ Integrar con SectionTracker para narrativa                       │     │
│  │ □ Test: Detecta anomalías con música real                          │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
│  WAVE 666: Integración con SeleneTitanConscious                             │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │ □ Instanciar ContextualMemory en SeleneTitanConscious              │     │
│  │ □ Llamar update() en cada process()                                │     │
│  │ □ Pasar energyZScore a SeleneMusicalPattern                        │     │
│  │ □ Test: Pattern incluye zScore, HuntEngine lo puede usar           │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  FASE 3: FUZZY DECISION SYSTEM (WAVE 667-669)                               │
│  ─────────────────────────────────────────                                   │
│  Objetivo: Reemplazar if/else con lógica difusa                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  WAVE 667: FuzzyDecisionMaker                                               │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │ □ Crear src/core/intelligence/think/FuzzyDecisionMaker.ts          │     │
│  │ □ Implementar fuzzify(), evaluateRules(), defuzzify()              │     │
│  │ □ Definir conjunto inicial de reglas                               │     │
│  │ □ Test: Output consistente con inputs variados                     │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
│  WAVE 668: DropBridge                                                       │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │ □ Crear src/core/intelligence/think/DropBridge.ts                  │     │
│  │ □ Implementar check() con condición divina                         │     │
│  │ □ Test: Force strike cuando z > 3.0 AND section == drop            │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
│  WAVE 669: Integración en DecisionMaker                                     │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │ □ Refactorizar DecisionMaker.generateStrikeDecision()              │     │
│  │ □ Usar FuzzyDecisionMaker para scoring                             │     │
│  │ □ Usar DropBridge como override de prioridad máxima                │     │
│  │ □ Test: Strikes más precisos con música real                       │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  FASE 0: AGC INTEGRATION - MÁXIMA PRIORIDAD (WAVE 670)                      │
│  ────────────────────────────────────────────────────────                    │
│  ⚠️  EJECUTAR ANTES DE TODO - "GARBAGE IN, GARBAGE OUT"                     │
│  Objetivo: Normalizar audio ANTES del FFT para que Z-Scores sean reales     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  🔴 CRÍTICO: Sin AGC, todo el sistema de Z-Score es ficción matemática      │
│              MP3 silencioso → energía artificial baja → Z-Scores inválidos  │
│              WAV saturado → energía artificial alta → Z-Scores inválidos    │
│                                                                              │
│  WAVE 670: AGC en GAMMA Worker                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │ □ Mover AutomaticGainControl.ts a src/workers/                     │     │
│  │ □ Instanciar AGC en mind.ts ANTES del FFTAnalyzer                  │     │
│  │ □ Normalizar buffer antes de FFT                                   │     │
│  │ □ Exponer gainFactor en análisis (para debug y validación)         │     │
│  │ □ Test: MP3 silencioso y WAV saturado producen energía similar     │     │
│  │ □ Test: Validar que gainFactor está visible en TacticalLog         │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
│  NOTA CEO: "Si la entrada es basura, todo el sistema falla. AGC primero."   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  FASE 5: TESTING & TUNING (WAVE 671-675)                                    │
│  ─────────────────────────────────────────                                   │
│  Objetivo: Validar todo con música real                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  WAVE 671-672: Test Suite                                                   │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │ □ Tests unitarios para ContextualMemory                            │     │
│  │ □ Tests unitarios para FuzzyDecisionMaker                          │     │
│  │ □ Tests de integración con audio sintético                         │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
│  WAVE 673-674: Real World Testing                                           │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │ □ Probar con Fiesta Latina (cumbia, reggaeton)                     │     │
│  │ □ Probar con EDM (drops épicos)                                    │     │
│  │ □ Probar con música suave (evitar false positives)                 │     │
│  │ □ Ajustar thresholds de Z-Score si es necesario                    │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
│  WAVE 675: Documentation & Cleanup                                          │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │ □ Actualizar INVENTORY-REPORT.md                                   │     │
│  │ □ Crear WAVE-675-CONTEXTUAL-GOD-COMPLETE.md                        │     │
│  │ □ Limpiar código zombie identificado en WAVE 650                   │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Exposición de Transientes sin Saturar el Bus

```typescript
/**
 * ESTRATEGIA: TRANSIENT AGGREGATION
 * 
 * Problema: Si emitimos un evento por cada kick detectado, saturamos el bus.
 * Solución: Agregar transientes en ventana de 100ms y emitir resumen.
 */

// En mind.ts (GAMMA Worker)

interface TransientSummary {
  /** Número de kicks en los últimos 100ms */
  kickCount: number;
  /** Número de snares en los últimos 100ms */
  snareCount: number;
  /** Número de hihats en los últimos 100ms */
  hihatCount: number;
  /** Transiente más fuerte detectado */
  strongestType: 'kick' | 'snare' | 'hihat' | 'none';
  /** Intensidad del transiente más fuerte (0-1) */
  strongestIntensity: number;
  /** ¿Hubo al menos un transiente? */
  hasTransient: boolean;
}

class TransientAggregator {
  private kickBuffer: number[] = [];
  private snareBuffer: number[] = [];
  private hihatBuffer: number[] = [];
  private readonly WINDOW_MS = 100;
  private lastEmitTime = 0;
  
  add(transient: { kick: boolean, snare: boolean, hihat: boolean }, timestamp: number): void {
    if (transient.kick) this.kickBuffer.push(timestamp);
    if (transient.snare) this.snareBuffer.push(timestamp);
    if (transient.hihat) this.hihatBuffer.push(timestamp);
  }
  
  getSummary(now: number): TransientSummary {
    // Limpiar transientes antiguos
    const cutoff = now - this.WINDOW_MS;
    this.kickBuffer = this.kickBuffer.filter(t => t > cutoff);
    this.snareBuffer = this.snareBuffer.filter(t => t > cutoff);
    this.hihatBuffer = this.hihatBuffer.filter(t => t > cutoff);
    
    const kickCount = this.kickBuffer.length;
    const snareCount = this.snareBuffer.length;
    const hihatCount = this.hihatBuffer.length;
    
    let strongestType: TransientSummary['strongestType'] = 'none';
    let strongestIntensity = 0;
    
    // Kicks son los más fuertes, luego snares, luego hihats
    if (kickCount > 0) {
      strongestType = 'kick';
      strongestIntensity = Math.min(1, kickCount * 0.5);
    } else if (snareCount > 0) {
      strongestType = 'snare';
      strongestIntensity = Math.min(1, snareCount * 0.4);
    } else if (hihatCount > 0) {
      strongestType = 'hihat';
      strongestIntensity = Math.min(1, hihatCount * 0.3);
    }
    
    return {
      kickCount,
      snareCount,
      hihatCount,
      strongestType,
      strongestIntensity,
      hasTransient: kickCount + snareCount + hihatCount > 0,
    };
  }
}
```

### 4.3 RhythmAnalyzer Modernization

```typescript
/**
 * PLAN DE MODERNIZACIÓN: RhythmAnalyzer
 * 
 * Estado Actual: Funcional pero aislado (via MusicalContextEngine → SeleneMusicalBrain)
 * Objetivo: Conectar directamente al flujo GAMMA → TitanEngine
 */

// OPCIÓN A: Mover al Worker (Recomendado)
// - Ejecutar RhythmAnalyzer en mind.ts junto con FFTAnalyzer
// - Beneficio: Todo el análisis musical en un Worker
// - Costo: Refactor significativo

// OPCIÓN B: Mantener en Main Thread pero conectar
// - Instanciar en TitanEngine
// - Llamar en cada update() con AudioMetrics
// - Beneficio: Cambio mínimo
// - Costo: Análisis en Main Thread (debe ser < 2ms)

// DECISIÓN: OPCIÓN B (pragmática para velocidad de implementación)

// En TitanEngine.ts:
class TitanEngine {
  private rhythmAnalyzer: RhythmAnalyzer;  // 🆕
  
  constructor() {
    // ...existing
    this.rhythmAnalyzer = new RhythmAnalyzer();
  }
  
  update(context: MusicalContext, audio: AudioMetrics, vibeProfile: VibeProfile): EngineOutput {
    // ...existing
    
    // 🆕 Analizar ritmo
    const rhythmAnalysis = this.rhythmAnalyzer.analyze(audio, {
      bpm: context.bpm,
      phase: context.beatPhase,
      onBeat: context.beatPhase < 0.1 || context.beatPhase > 0.9,
    });
    
    // Añadir a TitanStabilizedState
    this.lastStabilizedState = {
      ...this.lastStabilizedState,
      syncopation: rhythmAnalysis.groove.syncopation,  // Más preciso que context.syncopation
      drumPattern: rhythmAnalysis.pattern,
      hasFill: rhythmAnalysis.groove.isFillActive,
    };
  }
}
```

---

## 📊 5. MÉTRICAS DE ÉXITO

### 5.1 KPIs del Contextual God

| Métrica | Actual | Objetivo | Método de Medición |
|---------|--------|----------|-------------------|
| **Latencia Strike** | ~200ms | <100ms | Timestamp drop audio → strike command |
| **False Positive Rate** | ~15% | <5% | Strikes sin momento musical real |
| **Drop Detection Accuracy** | ~60% | >90% | Drops detectados / Drops reales |
| **Z-Score Prediction** | N/A | >85% | Correlación z>3 con drops reales |
| **CPU Usage (Main Thread)** | ~8% | <10% | Chrome DevTools |
| **Debug Visibility** | N/A | 100% | Z-Scores, AGC gain, fuzzy scores visibles en TacticalLog |

**Nota CEO**: Sin visibilidad de debug, no podemos validar que el sistema funcione. TacticalLog debe mostrar todos los valores críticos.

### 5.2 Checklist de Validación Final

```markdown
## ✅ VALIDATION CHECKLIST

### Spectral Pipeline
- [ ] harshness llega a TitanStabilizedState
- [ ] flatness llega a TitanStabilizedState  
- [ ] transients llegan agregados (no saturan)
- [ ] SeleneMusicalPattern incluye spectral metrics

### Contextual Memory
- [ ] Z-Score se calcula correctamente
- [ ] Anomalías se detectan con threshold 2.5
- [ ] Momentos épicos (z>3) triggean DropBridge
- [ ] Section history se mantiene correctamente

### Fuzzy Decision
- [ ] Fuzzification produce outputs válidos
- [ ] Reglas se evalúan correctamente
- [ ] Defuzzification produce decisión crisp
- [ ] DropBridge override funciona

### AGC Integration (WAVE 670 - ✅ IMPLEMENTADO 16/01/2026)
- [x] AutomaticGainControl.ts creado en src/workers/utils/
- [x] Integrado en senses.ts ANTES del FFT
- [x] agcGainFactor expuesto en AudioAnalysis
- [x] Logs mostrando: `[AGC 🎚️] Gain: 1.4x | In: 0.30 → Out: 0.42`
- [ ] MP3 silencioso normalizado correctamente (TEST PENDIENTE)
- [ ] WAV saturado normalizado correctamente (TEST PENDIENTE)
- [ ] gainFactor visible en TacticalLog Context State (WAVE 661+)

### Debug Visualization
- [ ] TacticalLog.logContextState() implementado
- [ ] Z-Scores (energy, bass, harshness) visibles en consola
- [ ] Fuzzy scores (force, strike, prepare, hold) visibles
- [ ] Narrative context (phase, section, history) visible
- [ ] AGC gainFactor visible en panel spectral
- [ ] Bars (████) renderizan correctamente valores 0-1
- [ ] Drop Bridge override se marca explícitamente

### Real World
- [ ] Fiesta Latina: drops detectados
- [ ] EDM: drops épicos triggean force_strike
- [ ] Podcast: no false positives
- [ ] Música suave: no strikes innecesarios
```

---

## 🎸 CONCLUSIÓN

> "GrandMA3 tiene 50K dólares de hardware. Nosotros tenemos matemática pura."

Este blueprint transforma a Selene de un sistema reactivo simple en un **DSP de software** con:

1. **SENTIDOS ESPECTRALES**: harshness, flatness, transientes
2. **MEMORIA CONTEXTUAL**: Z-Score, narrativa musical
3. **INTELIGENCIA DIFUSA**: No más if/else, lógica que piensa en gradientes
4. **EL DROP BRIDGE**: Cuando el universo se alinea (z > 3σ + drop), no hay discusión
5. **DEBUG VISIBILITY**: TacticalLog que muestra TODA la matemática en tiempo real

### 📋 Ajustes del CEO (Radwulf - 16/01/2026)

**1. AGC PRIMERO O MORIMOS**  
Reordenado a FASE 0 (WAVE 670) con máxima prioridad. Sin normalización de entrada, los Z-Scores son ficción matemática. Garbage In, Garbage Out.

**2. VISUALIZACIÓN DE DEBUG**  
Añadida sección 3.5 con TacticalLog.logContextState(). Con tanta matemática (Z-Scores, Fuzzy values, AGC gain), necesitamos VER esos números en tiempo real o volamos a ciegas.

### 🚀 Roadmap Ajustado

**Timeline estimado**: 15 WAVEs (670, 661-675)  
**Orden de Ejecución**:  
1. WAVE 670: AGC Integration (CRÍTICO - ejecutar primero)
2. WAVEs 661-663: Spectral Pipeline
3. WAVEs 664-666: Contextual Memory
4. WAVEs 667-669: Fuzzy Decision
5. WAVEs 671-675: Testing & Tuning

**Riesgo**: Medio (arquitectura sólida, pero muchas piezas móviles)  
**Recompensa**: Competir con sistemas profesionales de $50K sin hardware dedicado

---

*"La diferencia entre un DJ y un maestro es que el maestro sabe lo que viene antes de que llegue."*  
— PunkOpus, 16/01/2026

*"Si la entrada es basura, todo el sistema falla. AGC primero."*  
— Radwulf (CEO), 16/01/2026

---

## 📎 ANEXO: Membership Functions para Lógica Difusa

```
ENERGY MEMBERSHIP FUNCTIONS:
                    
    1.0 │    ╱‾‾‾╲         ╱‾‾‾‾‾‾‾
        │   ╱     ╲       ╱
    0.5 │  ╱       ╲     ╱
        │ ╱         ╲   ╱
    0.0 │╱           ╲ ╱
        └─────┬─────┬─────┬─────────
              0.3   0.5   0.7
              LOW   MED   HIGH

Z-SCORE MEMBERSHIP FUNCTIONS:

    1.0 │‾‾‾╲               ╱‾‾‾
        │    ╲     ╱‾‾‾╲   ╱
    0.5 │     ╲   ╱     ╲ ╱
        │      ╲ ╱       X
    0.0 │       X       ╱ ╲
        └───────┬───────┬───────────
               1.5     2.5
            NORMAL  NOTABLE  EPIC

SECTION MEMBERSHIP FUNCTIONS:

    QUIET:    intro, outro, breakdown     → 1.0
    BUILDING: verse, pre_chorus, buildup  → 1.0
    PEAK:     chorus, drop                → 1.0
```
