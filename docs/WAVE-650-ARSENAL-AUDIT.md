# 🔫 WAVE 650: OPERATION ARSENAL AUDIT
## "Autopsia de los Motores Heredados"

**Fecha**: 16/01/2026  
**Autor**: PunkOpus (El Ejecutor)  
**Para**: Radwulf (El Arquitecto)

---

## 📊 TABLA MAESTRA DE MOTORES

### 🔊 Audio Layer (`src/engine/audio/`)

| Motor | Estado | Utilidad | Coste Refactor | ¿Conectado? | Veredicto |
|-------|--------|----------|----------------|-------------|-----------|
| **AutomaticGainControl.ts** | ✅ VIVO | ⭐⭐⭐⭐⭐ | 🟢 BAJO | ❓ LEGACY | **RESCATAR** - Normaliza audio de diferentes fuentes |
| **BeatDetector.ts** | ⚠️ ZOMBIE | ⭐⭐⭐ | 🟡 MEDIO | ❌ NO | **EVALUAR** - Funcionalidad duplicada en GAMMA/mind.ts |
| **PatternRecognizer.ts** | ⚠️ ZOMBIE | ⭐⭐ | 🔴 ALTO | ❌ NO | **DEPRECAR** - Usa conceptos legacy (notas zodiaco) |

### 🎵 Musical Analysis Layer (`src/engine/musical/analysis/`)

| Motor | Estado | Utilidad | Coste Refactor | ¿Conectado? | Veredicto |
|-------|--------|----------|----------------|-------------|-----------|
| **RhythmAnalyzer.ts** | ✅ VIVO | ⭐⭐⭐⭐⭐ | 🟢 BAJO | ✅ SÍ (via MusicalContextEngine) | **CORE** - Sincopación y drum detection |
| **HarmonyDetector.ts** | ✅ VIVO | ⭐⭐⭐⭐ | 🟡 MEDIO | ✅ SÍ (via MusicalContextEngine) | **CORE** - Key/Mode/Mood/Disonancia |
| **SectionTracker.ts** | ✅ VIVO | ⭐⭐⭐⭐⭐ | 🟢 BAJO | ✅ SÍ (via MusicalContextEngine) | **CORE** - Detección de secciones + predicción |
| **VibeSectionProfiles.ts** | ✅ VIVO | ⭐⭐⭐ | 🟢 BAJO | ✅ SÍ | **OK** - Perfiles de energía por género |

### 🎹 Musical Classification Layer (`src/engine/musical/classification/`)

| Motor | Estado | Utilidad | Coste Refactor | ¿Conectado? | Veredicto |
|-------|--------|----------|----------------|-------------|-----------|
| **ScaleIdentifier.ts** | ✅ VIVO | ⭐⭐⭐⭐ | 🟢 BAJO | ✅ SÍ (via HarmonyDetector) | **OK** - Chromagrama → Escala musical |

### 🧠 Musical Context Layer (`src/engine/musical/context/`)

| Motor | Estado | Utilidad | Coste Refactor | ¿Conectado? | Veredicto |
|-------|--------|----------|----------------|-------------|-----------|
| **MusicalContextEngine.ts** | ✅ VIVO | ⭐⭐⭐⭐⭐ | 🟢 BAJO | ✅ SÍ (via SeleneMusicalBrain) | **ORQUESTADOR** - Combina todos los analizadores |
| **PredictionMatrix.ts** | ⚠️ PARCIAL | ⭐⭐⭐⭐ | 🟡 MEDIO | ✅ SÍ pero subutilizado | **POTENCIAR** - Predicción de drops/transiciones |

### 📚 Learning Layer (`src/engine/musical/learning/`)

| Motor | Estado | Utilidad | Coste Refactor | ¿Conectado? | Veredicto |
|-------|--------|----------|----------------|-------------|-----------|
| **SeleneMemoryManager.ts** | ⚠️ DORMIDO | ⭐⭐⭐⭐⭐ | 🔴 ALTO | ❌ NO | **RESUCITAR** - SQLite memory, calibraciones, patrones |

### 📡 Telemetry Layer (`src/engine/musical/telemetry/`)

| Motor | Estado | Utilidad | Coste Refactor | ¿Conectado? | Veredicto |
|-------|--------|----------|----------------|-------------|-----------|
| **SeleneTelemetryCollector.ts** | ⚠️ PARCIAL | ⭐⭐⭐ | 🟢 BAJO | ⚠️ PARCIAL | **OK** - Debug UI, no crítico |

### 🧮 FFT Layer (`src/workers/`)

| Motor | Estado | Utilidad | Coste Refactor | ¿Conectado? | Veredicto |
|-------|--------|----------|----------------|-------------|-----------|
| **FFT.ts** | ✅ VIVO | ⭐⭐⭐⭐⭐ | 🟢 BAJO | ✅ SÍ (via mind.ts worker) | **CORAZÓN** - Cooley-Tukey real FFT |
| **FFTAnalyzer (class)** | ✅ VIVO | ⭐⭐⭐⭐⭐ | 🟢 BAJO | ✅ SÍ | **CORAZÓN** - Transient detection, harshness, flatness |
| **mind.ts** | ✅ VIVO | ⭐⭐⭐⭐⭐ | 🟢 BAJO | ✅ SÍ | **GAMMA** - Worker thread principal |

### 🐱 Consciousness Layer (`src/engine/consciousness/`)

| Motor | Estado | Utilidad | Coste Refactor | ¿Conectado? | Veredicto |
|-------|--------|----------|----------------|-------------|-----------|
| **HuntOrchestrator.ts** | ⚠️ LEGACY | ⭐⭐⭐ | 🔴 ALTO | ❌ NO | **DEPRECAR** - Reemplazado por HuntEngine V2 |
| **StalkingEngine.ts** | ⚠️ LEGACY | ⭐⭐ | 🔴 ALTO | ❌ NO | **DEPRECAR** - Conceptos felinos legacy |
| **StrikeMomentEngine.ts** | ⚠️ PARCIAL | ⭐⭐⭐ | 🟡 MEDIO | ❌ NO | **RESCATAR CONCEPTOS** - Tiene buena matemática de consonancia |
| **PrecisionJumpEngine.ts** | ⚠️ LEGACY | ⭐⭐ | 🔴 ALTO | ❌ NO | **DEPRECAR** - Volatilidad system |
| **PreyRecognitionEngine.ts** | ⚠️ DORMIDO | ⭐⭐⭐⭐ | 🟡 MEDIO | ❌ NO | **EVALUAR** - Memoria de cacerías, podría ser útil |

---

## 🔬 HALLAZGOS CLAVE

### 🎉 SORPRESAS POSITIVAS

#### 1. **FFT.ts tiene HARSHNESS y SPECTRAL FLATNESS ocultos** ✨
```typescript
// ¡No sabíamos que teníamos esto!
interface BandEnergy {
  harshness: number;          // Ratio 2-5kHz vs total (synth sucio)
  spectralFlatness: number;   // 0=tonal, 1=ruido
}
```
**Potencial**: Detectar distorsión, ruido de línea, sintetizadores agresivos. **NADIE LO USA**.

#### 2. **AutomaticGainControl normaliza audio dinámicamente** 🎚️
```typescript
// Peak Tracker con decaimiento 0.995/frame
// Normalización: señal_normalizada = señal_cruda / maxPeak
```
**Potencial**: Resolver el problema de "MP3 silencioso" vs "WAV saturado". **PARECE DESCONECTADO**.

#### 3. **PredictionMatrix tiene predicción de DROPS** 🔮
```typescript
// Patrones conocidos:
// buildup + buildup → DROP (90% probabilidad)
// chorus + chorus → verse (70% probabilidad)
```
**Potencial**: Preparar luces ANTES del drop. **SUBUTILIZADO**.

#### 4. **SectionTracker tiene PERFILES POR GÉNERO** 📊
```typescript
// VibeSectionProfiles.ts tiene energyRange por sección:
drop: { energyRange: [0.8, 1.0], characteristics: ['bass_heavy', 'full_impact'] }
```
**Potencial**: Umbrales de sección adaptativos por Vibe. **ACTIVO pero poco explotado**.

#### 5. **SeleneMemoryManager - PERSISTENCIA SQLite COMPLETA** 🧠
```typescript
// ¡Tiene schema.sql, calibraciones, patrones aprendidos!
interface LearnedPattern {
  preferredStrategy?: string;
  preferredHueBase?: number;
  avgBeautyScore: number;
  positiveFeedback: number;
}
```
**Potencial**: Aprendizaje real entre sesiones. **COMPLETAMENTE DORMIDO**.

### ⚠️ PROBLEMAS ENCONTRADOS

#### 1. **SeleneMusicalBrain es CÓDIGO ZOMBIE**
- Tiene 1114 líneas de lógica sofisticada
- Orquesta RhythmAnalyzer + HarmonyDetector + SectionTracker + PredictionMatrix
- **NADIE LO INSTANCIA** en producción
- El flujo real va: `mind.ts (GAMMA)` → `TrinityBrain` → `TitanEngine`

#### 2. **Dos sistemas de "Hunt" en paralelo**
- `HuntOrchestrator.ts` (legacy, desconectado) - 724 líneas
- `HuntEngine.ts` (V2, activo) en `src/core/intelligence/think/`
- **DUPLICACIÓN** - Conceptos felinos mezclados

#### 3. **PatternRecognizer usa conceptos ZODIACALES**
```typescript
// ¡Mezcla notas musicales con elementos del zodiaco!
note: MusicalNote;   // 'DO', 'RE', 'MI'...
element: ElementType; // 'fire', 'earth'...
```
**DEPRECAR** - No encaja con arquitectura Selene V2.

#### 4. **BeatDetector duplica lógica del FFTAnalyzer**
- FFTAnalyzer ya tiene `kickDetected`, `snareDetected`, `hihatDetected`
- BeatDetector tiene exactamente lo mismo pero en Main Thread
- **EVALUAR** - ¿Cuál es más confiable?

---

## 🔗 DIAGRAMA DE ARQUITECTURA ACTUAL

```
┌─────────────────────────────────────────────────────────────────────┐
│                         AUDIO INPUT                                  │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  WORKER THREAD (mind.ts = GAMMA)                                    │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ FFTAnalyzer (FFT.ts)                                         │   │
│  │ - computeFFT() → Cooley-Tukey                                │   │
│  │ - computeBandEnergies() → bass/mid/treble/harshness/flatness │   │
│  │ - detectTransient() → kick/snare/hihat                       │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                │                                     │
│                                ▼                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ MusicalAnalysis (internal)                                   │   │
│  │ - bpm, energy, key, mode, section                            │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 │ postMessage
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  MAIN THREAD                                                        │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ TrinityBrain                                                 │   │
│  │ - Recibe y cachea MusicalContext de GAMMA                    │   │
│  │ - Memoria de 5s para estabilidad                             │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                │                                     │
│                                ▼                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ TitanEngine                                                   │   │
│  │ - EnergyStabilizer (Smart Smooth WAVE 642)                   │   │
│  │ - KeyStabilizer                                               │   │
│  │ - MoodArbiter                                                 │   │
│  │ - StrategyArbiter                                             │   │
│  │ → TitanStabilizedState (rawEnergy + smoothedEnergy)          │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                │                                     │
│                                ▼                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ SeleneTitanConscious (V2)                                    │   │
│  │ - MusicalPatternSensor → SeleneMusicalPattern                │   │
│  │ - BeautySensor → SeleneBeauty                                │   │
│  │ - ConsonanceSensor                                           │   │
│  │ - HuntEngine → HuntDecision                                  │   │
│  │ - DecisionMaker → ConsciousnessOutput                        │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 🚫 CÓDIGO ZOMBIE (Desconectado del flujo)

```
┌─────────────────────────────────────────────────────────────────────┐
│  ZOMBIE LAND (No conectado, pero compilando)                        │
│                                                                      │
│  ┌────────────────────────────────────────┐                         │
│  │ SeleneMusicalBrain                     │ ← Orquestador legacy    │
│  │ - MusicalContextEngine                 │                          │
│  │   - RhythmAnalyzer ✓                   │ ← ¡Estos SÍ son útiles! │
│  │   - HarmonyDetector ✓                  │                          │
│  │   - SectionTracker ✓                   │                          │
│  │   - PredictionMatrix ✓                 │                          │
│  └────────────────────────────────────────┘                         │
│                                                                      │
│  ┌────────────────────────────────────────┐                         │
│  │ Hunt System Legacy                     │                          │
│  │ - HuntOrchestrator                     │ ← Reemplazado por V2    │
│  │ - StalkingEngine                       │                          │
│  │ - StrikeMomentEngine                   │ ← Tiene buena math      │
│  │ - PreyRecognitionEngine                │ ← Memoria de cacerías   │
│  └────────────────────────────────────────┘                         │
│                                                                      │
│  ┌────────────────────────────────────────┐                         │
│  │ Learning System                        │                          │
│  │ - SeleneMemoryManager                  │ ← ¡SQLite completo!     │
│  └────────────────────────────────────────┘                         │
│                                                                      │
│  ┌────────────────────────────────────────┐                         │
│  │ Audio Utilities                        │                          │
│  │ - AutomaticGainControl                 │ ← ¡Normalización PRO!   │
│  │ - BeatDetector                         │ ← Duplica FFTAnalyzer   │
│  │ - PatternRecognizer                    │ ← Legacy zodiacal       │
│  └────────────────────────────────────────┘                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 PROPUESTA DE INTEGRACIÓN

### FASE 1: RESCATE INMEDIATO (WAVE 651-655)

#### 1.1 Exponer harshness/spectralFlatness de FFT a TitanStabilizedState
```typescript
// En TitanStabilizedState añadir:
interface TitanStabilizedState {
  // ... existing
  spectralHarshness: number;   // 0-1 (synth sucio)
  spectralFlatness: number;    // 0-1 (ruido vs tonal)
}
```
**Beneficio**: HuntEngine puede detectar "momentos harsh" para Solar Flare más intenso.

#### 1.2 Conectar AutomaticGainControl al pipeline
```typescript
// En mind.ts, después del FFT:
const agc = new AutomaticGainControl();
const normalized = agc.update(rawEnergy, rawBass, rawMid, rawTreble);
// Usar normalized.normalizedEnergy como analysis.energy
```
**Beneficio**: Resuelve problema de MP3 silenciosos vs WAV saturados.

### FASE 2: PREDICCIÓN (WAVE 656-660)

#### 2.1 Alimentar PredictionMatrix con datos de SectionTracker
```typescript
// En SeleneTitanConscious.process():
const prediction = this.predictionMatrix.analyze(rhythm, section);
if (prediction.type === 'drop_incoming' && prediction.probability > 0.8) {
  // Preparar Solar Flare con anticipación
  this.prepareStrike(prediction.actions.preAction);
}
```
**Beneficio**: Luces preparadas ANTES del drop, no reaccionando tarde.

### FASE 3: MEMORIA (WAVE 661-670)

#### 3.1 Resucitar SeleneMemoryManager
```typescript
// Conectar al flujo principal:
// 1. Al iniciar sesión → cargar patrones aprendidos
// 2. Cada 5 minutos → guardar estadísticas
// 3. Al cerrar → persistir calibraciones
```
**Beneficio**: Selene aprende preferencias entre sesiones.

### FASE 4: LIMPIEZA (WAVE 671-675)

#### 4.1 Deprecar código zombie
- [ ] `PatternRecognizer.ts` → DELETE
- [ ] `HuntOrchestrator.ts` → DELETE
- [ ] `StalkingEngine.ts` → DELETE
- [ ] `PrecisionJumpEngine.ts` → DELETE
- [ ] `BeatDetector.ts` → MERGE con FFTAnalyzer o DELETE

#### 4.2 Extraer conceptos útiles antes de borrar
- `StrikeMomentEngine.ts` → Extraer función `calculateConsonance()`
- `PreyRecognitionEngine.ts` → Evaluar si vale rescatar memoria de patrones

---

## 📈 DIAGRAMA FUTURO (Post-Integración)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         AUDIO INPUT                                  │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  GAMMA (mind.ts + FFTAnalyzer + AGC)                                │
│  - FFT Real → bandEnergies + harshness + flatness                   │
│  - AGC → normalizedEnergy (uniforme entre fuentes)                  │
│  - Transient Detection → kick/snare/hihat                           │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  TrinityBrain + Memory                                              │
│  - MusicalContext cacheado con memory de 5s                         │
│  - SeleneMemoryManager para persistencia                            │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  TitanEngine (Stabilizers)                                          │
│  - rawEnergy (GAMMA directo)                                        │
│  - smoothedEnergy (Smart Smooth EMA 0.70)                           │
│  - spectralHarshness + spectralFlatness (NEW)                       │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  SeleneTitanConscious V2                                            │
│  - Sensors (Pattern, Beauty, Consonance)                            │
│  - HuntEngine (con PredictionMatrix integrado - NEW)                │
│  - DecisionMaker (Energy Veto usa rawEnergy - WAVE 642)             │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  OUTPUT: ConsciousnessOutput                                        │
│  - effectDecision (Solar Flare, etc.)                               │
│  - colorDecision (Paleta)                                           │
│  - movementDecision (Pan/Tilt)                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## ✅ CHECKLIST DE ACCIONES

### Inmediato (WAVE 651)
- [ ] Exponer `harshness` y `spectralFlatness` de FFT a analysis
- [ ] Añadir campos a `TitanStabilizedState`
- [ ] Propagar a `SeleneMusicalPattern`

### Corto Plazo (WAVE 652-655)
- [ ] Integrar `AutomaticGainControl` en `mind.ts`
- [ ] Conectar `PredictionMatrix` a `HuntEngine`
- [ ] Test de predicción de drops

### Medio Plazo (WAVE 656-670)
- [ ] Resucitar `SeleneMemoryManager`
- [ ] Implementar persistencia de calibraciones
- [ ] Test de aprendizaje entre sesiones

### Limpieza (WAVE 671-675)
- [ ] Deprecar código zombie
- [ ] Actualizar documentación
- [ ] Test de regresión completo

---

## 🎸 CONCLUSIÓN

> "El arsenal tiene más armas de las que sabíamos. El problema no es falta de código, es falta de CONEXIÓN entre los módulos."

**Resumen ejecutivo**:
1. **70% del código musical está VIVO** pero subutilizado
2. **AGC y PredictionMatrix** son joyas ocultas → INTEGRAR
3. **SeleneMusicalBrain** es zombie → DEPRECAR (pero rescatar submódulos)
4. **Hunt Legacy** duplica V2 → LIMPIAR

La arquitectura Selene V2 es sólida. Solo necesitamos tender puentes con el código legacy que realmente aporta valor.

---

*"No se trata de reescribir, se trata de CONECTAR."*  
— PunkOpus, 16/01/2026

