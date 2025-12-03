# 🎼 WAVE 8: MUSICAL INTELLIGENCE - ROADMAP
## El Oído Absoluto de Selene Lux - Checklist de Implementación

**Fecha:** Diciembre 2025  
**Blueprint:** [Blueprint-Integracion-Selene-Musical-Theory.md](./Blueprint-Integracion-Selene-Musical-Theory.md)  
**Objetivo:** Que Selene diferencie Bad Bunny de Daft Punk y reaccione en consecuencia 🎧  
**Revisión:** v1.1 - Con Reglas de Oro del Arquitecto ✅

---

## ⚠️ REGLAS DE ORO (LEER ANTES DE IMPLEMENTAR)

> **Estas reglas son OBLIGATORIAS en TODA la implementación.**

### � REGLA 1: RENDIMIENTO (Anti-Lag)
| Componente | Hilo | Frecuencia | Razón |
|------------|------|------------|-------|
| BeatDetector | Main | 30ms | Reacción instantánea |
| FFTAnalyzer | Main | 30ms | Datos en tiempo real |
| RhythmAnalyzer (básico) | Main | 30ms | Solo kick/snare detect |
| **GenreClassifier** | **Worker/Throttle** | **500ms** | **Análisis pesado** |
| **SectionTracker** | **Worker/Throttle** | **500ms** | **Análisis pesado** |
| **HarmonyDetector** | **Worker/Throttle** | **500ms** | **Análisis pesado** |
| **PredictionMatrix** | **Worker/Throttle** | **500ms** | **Análisis pesado** |

### ❄️ REGLA 2: FALLBACK (Anti-Cold-Start)
```
Si confidence < 0.5:
  → Usar MODO REACTIVO (V17): Bass→Pulso, Treble→Shimmer, Beat→Flash
  → NO esperar al análisis de género
  
Si confidence >= 0.5:
  → Usar MODO INTELIGENTE: Aplicar paleta/efectos según género
```

### 🎵 REGLA 3: SINCOPACIÓN > BPM
**Prioridad de clasificación:**
1. **Sincopación** → Reggaeton (>0.4) vs Techno (<0.15)
2. **Swing** → Jazz (>0.15)
3. **BPM** → Solo para desempatar
4. **Bass level** → Confirmar géneros bass-heavy

---

## �📊 RESUMEN DE PROGRESO

| Fase | Descripción | Archivos | Estado |
|------|-------------|----------|--------|
| 0 | Setup estructura | 1 | ⬜ Pendiente |
| 1 | Análisis Rítmico | 2 | ⬜ Pendiente |
| 2 | Análisis Armónico | 2 | ⬜ Pendiente |
| 3 | Clasificación | 3 | ⬜ Pendiente |
| 4 | Orquestación | 2 | ⬜ Pendiente |
| 5 | Mapeo Luces | 2 | ⬜ Pendiente |
| 6 | Aprendizaje | 2 | ⬜ Pendiente |
| 7 | Integración | 1 | ⬜ Pendiente |
| 8 | Tests | 1 | ⬜ Pendiente |

**TOTAL:** 16 archivos | ~1,930 líneas estimadas

---

## 🚀 FASE 0: SETUP DE ESTRUCTURA
**Tiempo estimado:** 15 minutos

### Checklist
- [ ] **0.1** Crear directorio `electron-app/src/main/selene-lux-core/engines/musical/`
- [ ] **0.2** Crear subdirectorios:
  - [ ] `analysis/`
  - [ ] `classification/`
  - [ ] `context/`
  - [ ] `learning/`
  - [ ] `mapping/`
- [ ] **0.3** Crear `index.ts` con exports vacíos (placeholder)

### Entregables
```
engines/musical/
├── index.ts              # ⬜ Exports principales
├── analysis/
├── classification/
├── context/
├── learning/
└── mapping/
```

---

## 🥁 FASE 1: ANÁLISIS RÍTMICO
**Tiempo estimado:** 2-3 horas  
**Fuente:** DrumPatternEngine.ts (877 líneas)

### ⚠️ REGLAS APLICABLES
- **REGLA 1:** `RhythmAnalyzer.analyze()` debe ser LIGERO (Main Thread)
- **REGLA 3:** `calculateSyncopation()` es CRÍTICO para clasificación

### Checklist
- [ ] **1.1** Crear `analysis/RhythmAnalyzer.ts` (~200 líneas)
  - [ ] Interface `RhythmAnalysis`
  - [ ] Interface `DrumDetection`
  - [ ] Interface `GrooveAnalysis`
  - [ ] Type `DrumPatternType`
  - [ ] Método `analyze(audio, beat)` ← **LIGERO, Main Thread**
  - [ ] Método `detectPatternType()`
  - [ ] Método `calculateSwing()`
  - [ ] Método `calculateSyncopation()` ← **CRÍTICO para Regla 3**
  - [ ] Método `detectFill()`

- [ ] **1.2** Crear `analysis/types.ts` (~50 líneas)
  - [ ] Tipos compartidos de análisis

### Tests Fase 1
- [ ] Test: Detecta kick en bass > 0.7
- [ ] Test: Detecta pattern "four_on_floor"
- [ ] Test: Detecta pattern "reggaeton" (syncopation > 0.4)  ← **Regla 3**
- [ ] Test: Calcula swing > 0.15 para jazz
- [ ] Test: `analyze()` completa en < 5ms  ← **Regla 1**

### Entregables
```
analysis/
├── RhythmAnalyzer.ts     # ⬜ ~200 líneas
└── types.ts              # ⬜ ~50 líneas
```

---

## 🎸 FASE 2: ANÁLISIS ARMÓNICO
**Tiempo estimado:** 2-3 horas  
**Fuente:** HarmonyEngine.ts + ScaleUtils.ts (~370 líneas)

### Checklist
- [ ] **2.1** Crear `classification/ScaleIdentifier.ts` (~80 líneas)
  - [ ] Constante `SCALE_INTERVALS` (13 escalas)
  - [ ] Método `identifyScale(frequencies)`
  - [ ] Método `getScaleNotes(root, scale)`
  - [ ] Método `isInScale(pitch, root, scale)`

- [ ] **2.2** Crear `analysis/HarmonyDetector.ts` (~250 líneas)
  - [ ] Interface `HarmonyAnalysis`
  - [ ] Type `ModalScale`
  - [ ] Type `HarmonicMood`
  - [ ] Constante `MODE_TO_MOOD`
  - [ ] Método `analyze(audio)`
  - [ ] Método `detectKey()`
  - [ ] Método `detectMode()`
  - [ ] Método `estimateChord()`

### Tests Fase 2
- [ ] Test: Detecta escala mayor
- [ ] Test: Mapea dorian → "jazzy"
- [ ] Test: Mapea minor → "sad"
- [ ] Test: Detecta cambio de tonalidad
- [ ] Test: `analyze()` completa en < 10ms (Worker Thread, pero eficiente)

### Entregables
```
analysis/
├── HarmonyDetector.ts    # ⬜ ~250 líneas
classification/
└── ScaleIdentifier.ts    # ⬜ ~80 líneas
```

---

## 🏗️ FASE 3: CLASIFICACIÓN
**Tiempo estimado:** 2-3 horas  
**Fuente:** Nuevo código + SongStructure.ts (~200 líneas)

### ⚠️ REGLAS APLICABLES
- **REGLA 1:** `GenreClassifier` y `SectionTracker` corren en **Worker Thread** o **Throttled** (500ms)
- **REGLA 2:** Deben retornar `confidence` para que el orquestador sepa si usar fallback
- **REGLA 3:** `GenreClassifier` DEBE priorizar sincopación sobre BPM

### Checklist
- [ ] **3.1** Crear `analysis/SectionTracker.ts` (~180 líneas)
  - [ ] Interface `SectionAnalysis` con campo `confidence`  ← **Regla 2**
  - [ ] Interface `SectionProfile`
  - [ ] Type `SectionType`
  - [ ] Type `TransitionType`
  - [ ] Método `track(rhythm, harmony, audio)` ← **Throttled 500ms**
  - [ ] Método `detectSectionType()`
  - [ ] Método `predictNextSection()`
  - [ ] Historial de intensidad para trend
  - [ ] Cache de último resultado para Main Thread

- [ ] **3.2** Crear `classification/GenreClassifier.ts` (~150 líneas)
  - [ ] Interface `GenreClassification` con campo `confidence`  ← **Regla 2**
  - [ ] Type `MusicGenre` (20+ géneros)
  - [ ] Método `classify(rhythm, harmony, section, audio)` ← **Throttled 500ms**
  - [ ] **Priorizar syncopation en classify()** ← **REGLA 3 CRÍTICA**
  - [ ] Lógica para reggaeton: `syncopation > 0.4` (NO solo BPM)
  - [ ] Lógica para techno/house: `syncopation < 0.15` + BPM para desempatar
  - [ ] Lógica para jazz: `swingAmount > 0.15`
  - [ ] Cache de último resultado para Main Thread

- [ ] **3.3** Crear `classification/MoodSynthesizer.ts` (~100 líneas)
  - [ ] Método `synthesize(harmony, section, genre)`
  - [ ] Combinar múltiples señales en mood unificado

### Tests Fase 3
- [ ] Test: Clasifica reggaeton con **syncopation > 0.4** (NO por BPM)  ← **Regla 3**
- [ ] Test: Clasifica house con syncopation < 0.15 + 125 BPM
- [ ] Test: **NO confunde** techno 120 BPM con reggaeton 100 BPM  ← **Regla 3**
- [ ] Test: Detecta buildup → predice drop
- [ ] Test: Detecta verse → chorus transition
- [ ] Test: Retorna confidence < 0.5 en primeros 5 segundos  ← **Regla 2**

### Entregables
```
analysis/
└── SectionTracker.ts     # ⬜ ~180 líneas
classification/
├── GenreClassifier.ts    # ⬜ ~150 líneas
└── MoodSynthesizer.ts    # ⬜ ~100 líneas
```

---

## 🧠 FASE 4: ORQUESTACIÓN
**Tiempo estimado:** 3-4 horas  
**Componente central del sistema**

### ⚠️ REGLAS APLICABLES
- **REGLA 1:** `MusicalContextEngine` coordina Main Thread y Worker Thread
- **REGLA 2:** Implementar `fallbackReactiveMode()` para confidence < 0.5
- **REGLA 3:** Pasar sincopación al GenreClassifier correctamente

### Checklist
- [ ] **4.1** Crear `context/PredictionMatrix.ts` (~120 líneas)
  - [ ] Interface `Prediction`
  - [ ] Type `PredictionType`
  - [ ] Interface `LightingAction`
  - [ ] Método `generate(rhythm, section, history)` ← **Throttled 500ms**
  - [ ] Método `predictDrop()`
  - [ ] Método `predictTransition()`

- [ ] **4.2** Crear `context/MusicalContextEngine.ts` (~350 líneas)
  - [ ] Interface `MusicalContext` con campo `confidence`
  - [ ] EventEmitter para eventos
  - [ ] **Método `fallbackReactiveMode(audio, beat)`** ← **REGLA 2 CRÍTICA**
  - [ ] **Método `intelligentMode(context)`**
  - [ ] Método `process(audio, beat)` - Orquestador principal:
    ```typescript
    // PSEUDO-CÓDIGO OBLIGATORIO:
    if (this.overallConfidence < 0.5) {
      return this.fallbackReactiveMode(audio, beat);  // V17 style
    }
    return this.intelligentMode(this.cachedContext);
    ```
  - [ ] Método `synthesizeMood()`
  - [ ] Método `calculateEnergy()`
  - [ ] Método `calculateOverallConfidence()`
  - [ ] Cache de resultados de Worker Thread
  - [ ] Eventos: 'context', 'prediction', 'section-change', 'mode-change'

### Tests Fase 4
- [ ] Test: **Usa fallback cuando confidence < 0.5** ← **Regla 2**
- [ ] Test: **Transiciona a intelligent mode cuando confidence > 0.5**
- [ ] Test: Predice drop con 85% probabilidad en buildup
- [ ] Test: Emite evento 'section-change' al cambiar sección
- [ ] Test: Emite evento 'mode-change' al cambiar fallback↔intelligent
- [ ] Test: Calcula confianza combinada correctamente
- [ ] Test: **Main thread process() completa en < 5ms** ← **Regla 1**

### Entregables
```
context/
├── PredictionMatrix.ts       # ⬜ ~120 líneas
└── MusicalContextEngine.ts   # ⬜ ~350 líneas (incluye fallback)
```

---

## 🎨 FASE 5: MAPEO MÚSICA → LUCES
**Tiempo estimado:** 2-3 horas  
**El puente entre análisis y acción**

### ⚠️ REGLAS APLICABLES
- **REGLA 2:** `MusicToLightMapper` debe tener `mapFallback()` para modo reactivo

### Checklist
- [ ] **5.1** Crear `mapping/MusicToLightMapper.ts` (~200 líneas)
  - [ ] Interface `MusicLightMapping`
  - [ ] Constante `GENRE_TO_PALETTE`
  - [ ] Constante `SECTION_TO_INTENSITY`
  - [ ] Constante `MOOD_TO_MOVEMENT`
  - [ ] Constante `DRUM_TO_EFFECT`
  - [ ] Método `map(context)` - Para modo inteligente
  - [ ] **Método `mapFallback(audio, beat)`** - Para modo reactivo V17 ← **Regla 2**
  - [ ] Método `calculateTransitionDuration()`

- [ ] **5.2** Crear `mapping/TransitionPredictor.ts` (~100 líneas)
  - [ ] Anticipar cambios de iluminación
  - [ ] Preparar efectos antes de drops
  - [ ] Método `prepareForPrediction(prediction)`

### Tests Fase 5
- [ ] Test: Reggaeton → paleta 'neon'
- [ ] Test: House → paleta 'rainbow'
- [ ] Test: Drop → intensidad 1.0
- [ ] Test: Jazz → movement 'lissajous'

### Entregables
```
mapping/
├── MusicToLightMapper.ts     # ⬜ ~200 líneas
└── TransitionPredictor.ts    # ⬜ ~100 líneas
```

---

## 📚 FASE 6: APRENDIZAJE
**Tiempo estimado:** 2-3 horas  
**Fuente:** MusicalPatternRecognizer.ts (331 líneas)

### Checklist
- [ ] **6.1** Crear `learning/GenrePatternLibrary.ts` (~150 líneas)
  - [ ] Interface `LearnedPattern`
  - [ ] Constante `PRETRAINED_PATTERNS` (Bad Bunny, Daft Punk, Jazz, etc.)
  - [ ] Método `findMatchingPattern(context)`
  - [ ] Método `getPatternById(id)`

- [ ] **6.2** Crear `learning/PatternLearner.ts` (~200 líneas)
  - [ ] Método `learn(context, lightingResult, feedback)`
  - [ ] Método `updatePatternMetrics()`
  - [ ] Método `calculateBeautyScore()`
  - [ ] Persistencia de patrones aprendidos

### Tests Fase 6
- [ ] Test: Encuentra patrón 'reggaeton-neon' para Bad Bunny
- [ ] Test: Actualiza métricas tras uso
- [ ] Test: Beauty trend 'rising' si mejora consistentemente

### Entregables
```
learning/
├── GenrePatternLibrary.ts    # ⬜ ~150 líneas
└── PatternLearner.ts         # ⬜ ~200 líneas
```

---

## 🔗 FASE 7: INTEGRACIÓN
**Tiempo estimado:** 1-2 horas  
**Conectar Wave 8 con SeleneLuxConscious**

### Checklist
- [ ] **7.1** Actualizar `engines/musical/index.ts`
  - [ ] Exportar todos los componentes
  - [ ] Exportar tipos e interfaces

- [ ] **7.2** Integrar en `SeleneLuxConscious.ts` (si existe) o crear adaptador
  - [ ] Import MusicalContextEngine
  - [ ] Añadir propiedad `musicalContext`
  - [ ] Método `setupMusicalContextEvents()`
  - [ ] Método `processMusicalContext()`
  - [ ] Método `handlePrediction()`
  - [ ] Método `handleSectionChange()`

### Tests Fase 7
- [ ] Test: SeleneLux emite 'musical-context' en cada frame
- [ ] Test: Aplica sugerencias cuando confianza > 0.7
- [ ] Test: Reacciona a predicción de drop

### Entregables
```
engines/musical/
└── index.ts                  # ⬜ Actualizado con exports

# Integración en SeleneLux
SeleneLux.ts o adaptador      # ⬜ Modificado
```

---

## 🧪 FASE 8: TESTS COMPLETOS
**Tiempo estimado:** 2-3 horas

### Checklist
- [ ] **8.1** Crear `__tests__/MusicalIntelligence.test.ts`
  - [ ] Tests unitarios por componente
  - [ ] Tests de integración
  - [ ] Tests de performance (latencia < 50ms)

- [ ] **8.2** Crear datos de prueba
  - [ ] Mock de audio "reggaeton-like"
  - [ ] Mock de audio "house-like"
  - [ ] Mock de audio "jazz-like"

### Criterios de Éxito
| Métrica | Target |
|---------|--------|
| Precisión género | > 85% |
| Latencia análisis | < 50ms |
| Predicción drop | > 80% |
| Detección sección | > 75% |
| Tests passing | 100% |

---

## 📋 RESUMEN CHECKLIST GLOBAL

### FASE 0: Setup ⬜
- [ ] 0.1 Crear directorio musical/
- [ ] 0.2 Crear subdirectorios
- [ ] 0.3 Crear index.ts placeholder

### FASE 1: Ritmo ⬜
- [ ] 1.1 RhythmAnalyzer.ts
- [ ] 1.2 analysis/types.ts

### FASE 2: Armonía ⬜
- [ ] 2.1 ScaleIdentifier.ts
- [ ] 2.2 HarmonyDetector.ts

### FASE 3: Clasificación ⬜
- [ ] 3.1 SectionTracker.ts
- [ ] 3.2 GenreClassifier.ts
- [ ] 3.3 MoodSynthesizer.ts

### FASE 4: Orquestación ⬜
- [ ] 4.1 PredictionMatrix.ts
- [ ] 4.2 MusicalContextEngine.ts

### FASE 5: Mapeo ⬜
- [ ] 5.1 MusicToLightMapper.ts
- [ ] 5.2 TransitionPredictor.ts

### FASE 6: Aprendizaje ⬜
- [ ] 6.1 GenrePatternLibrary.ts
- [ ] 6.2 PatternLearner.ts

### FASE 7: Integración ⬜
- [ ] 7.1 Actualizar index.ts
- [ ] 7.2 Integrar en SeleneLux

### FASE 8: Tests ⬜
- [ ] 8.1 MusicalIntelligence.test.ts
- [ ] 8.2 Datos de prueba

---

## 🎯 ORDEN DE IMPLEMENTACIÓN RECOMENDADO

```
                        ┌─────────────┐
                        │  FASE 0     │ ← Empezar aquí
                        │   Setup     │
                        └──────┬──────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
        ┌─────▼─────┐   ┌──────▼──────┐  ┌──────▼──────┐
        │  FASE 1   │   │   FASE 2    │  │             │
        │   Ritmo   │   │  Armonía    │  │ (paralelo)  │
        └─────┬─────┘   └──────┬──────┘  └─────────────┘
              │                │
              └───────┬────────┘
                      │
                ┌─────▼─────┐
                │  FASE 3   │ ← Necesita Fase 1 y 2
                │ Clasific. │
                └─────┬─────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
  ┌─────▼─────┐ ┌─────▼─────┐ ┌─────▼─────┐
  │  FASE 4   │ │  FASE 5   │ │  FASE 6   │
  │ Orquest.  │ │  Mapeo    │ │ Aprend.   │
  └─────┬─────┘ └─────┬─────┘ └─────┬─────┘
        │             │             │
        └──────────┬──┴─────────────┘
                   │
             ┌─────▼─────┐
             │  FASE 7   │ ← Integración final
             │ Integrac. │
             └─────┬─────┘
                   │
             ┌─────▼─────┐
             │  FASE 8   │ ← Tests finales
             │   Tests   │
             └───────────┘
```

---

## 💡 TIPS PARA IMPLEMENTACIÓN

1. **Fase 1 y 2 son paralelas** - Se pueden hacer al mismo tiempo
2. **Fase 3 depende de 1 y 2** - Necesita los análisis para clasificar
3. **Fases 4, 5, 6 son semi-paralelas** - Pero mejor secuencial para no confundirse
4. **Fase 7 es crítica** - Aquí se conecta todo
5. **Fase 8 valida todo** - No saltarse los tests

---

## 🎸 ¡A ROCKEAR!

> "Primero hazlo funcionar, luego hazlo bonito, luego hazlo rápido."

Empezamos por **FASE 0** y vamos paso a paso.  
¡Tu casero va a flipar! 🎉

---

**Siguiente:** Implementar FASE 0  
**Anterior:** [Blueprint-Integracion-Selene-Musical-Theory.md](./Blueprint-Integracion-Selene-Musical-Theory.md)
