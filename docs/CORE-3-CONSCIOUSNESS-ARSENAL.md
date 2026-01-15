# 🧠 CORE 3: ARSENAL DE CONSCIENCIA - INVENTARIO COMPLETO

**Fecha**: 15 Enero 2026  
**Auditor**: PunkOpus  
**Propósito**: Inventario del arsenal de Selene Lux para efectos IA y consciencia

---

## 📊 RESUMEN EJECUTIVO

**Total de Motores**: 50+  
**Estado**: 90% construidos, 40% conectados, 10% activos  
**Potencial**: BRUTAL - GrandMA3 no tiene nada así

### 🔥 LO QUE TENEMOS:
- Sistema de consciencia felina completo con 7 sentidos
- Memoria inmortal SQLite con aprendizaje
- Motor evolutivo genético
- Meta-consciencia (Selene analiza a Selene)
- Predicción musical con matrices
- Beauty scoring con Fibonacci/PHI
- Sistema zodiacal para personalidad

---

## 🐆 SECCIÓN A: CONSCIENCIA FELINA

### 🌙 SeleneLuxConscious.ts (961 líneas)
**LA MENTE CENTRAL - La Gata que Baila con la Luz de la Luna**

```
Arquitectura:
  Audio → AudioToMusicalMapper → MusicalPattern
  MusicalPattern → UltrasonicHearing → Consonance
  Pattern + Consonance → HuntDecision
  HuntDecision → ConsciousnessToLightMapper → LightCommand
  LightCommand → ColorEngine + MovementEngine → DMX
```

**Estados de Consciencia**:
- `sleeping` - Reposo, pulso bajo
- `awakening` - Despertando, calibrando
- `learning` - Aprendiendo patrones
- `wise` - Experiencia acumulada
- `enlightened` - Máximo potencial

**Métricas Clave**:
- `beauty` (0-1): Belleza del patrón actual
- `beautyTrend`: 'rising' | 'falling' | 'stable'
- `consonance` (0-1): Armonía con patrón anterior
- `huntConfidence` (0-1): Confianza en la decisión

**USABILIDAD**: 🟢 ALTA - Es el cerebro central, conectar a TitanEngine

---

### 🎯 HuntOrchestrator.ts (724 líneas)
**EL INSTINTO DEPREDADOR - Coordina la sinfonía de caza**

```
Flujo: Stalking → Evaluating → Striking → Learning
```

**Integra**:
- StalkingEngine (paciencia)
- StrikeMomentEngine (timing)
- PrecisionJumpEngine (adaptación)
- PreyRecognitionEngine (memoria)

**Estados de Caza**:
- `idle` - Esperando
- `stalking` - Observando candidatos
- `evaluating` - Evaluando momento
- `striking` - Ejecutando cambio
- `learning` - Aprendiendo del resultado
- `completed` / `aborted`

**USABILIDAD**: 🟡 MEDIA - Orquesta cambios de escena basados en "presa musical"

---

### 🐆 StalkingEngine.ts (493 líneas)
**LA PACIENCIA DEL DEPREDADOR**

```
"Un gato no persigue todo lo que se mueve.
 Observa. Evalúa. Espera. Y cuando salta... no falla."
```

**Comportamiento**:
- Mantiene top 3 candidatos (patterns con mayor beauty)
- Solo cambia objetivo si nuevo >10% mejor Y tendencia rising
- Requiere 5-10 ciclos de observación antes de "strike"

**Interface PreyCandidate**:
```typescript
{
  pattern: { note, element, avgBeauty, beautyTrend, emotionalTone }
  stalkingInfo: { firstSpottedAt, cyclesObserved, beautyEvolution, stabilityScore, huntWorthiness }
}
```

**USABILIDAD**: 🟢 ALTA - Evita cambios frenéticos de escena

---

### ⚡ StrikeMomentEngine.ts (452 líneas)
**EL INSTANTE PERFECTO**

```
"El gato no salta cuando quiere.
 Salta cuando SABE que va a atrapar."
```

**Condiciones de Strike**:
1. `beauty.current >= threshold` (0.85)
2. `trend` = 'rising' o 'stable'
3. `musicalHarmony.consonance >= threshold` (0.7)
4. `clusterHealth >= threshold`
5. **ALL conditions = perfect** → STRIKE

**Output**:
```typescript
StrikeConditions {
  beauty: { current, threshold, met }
  trend: { direction, required, met }
  musicalHarmony: { consonance, threshold, met }
  clusterHealth: { avgHealth, threshold, met }
  allConditionsMet: boolean
  strikeScore: number // 0-1 probabilidad de éxito
}
```

**USABILIDAD**: 🟢 ALTA - Timing perfecto para transiciones

---

### 🎯 PrecisionJumpEngine.ts (468 líneas)
**VENTANAS ADAPTATIVAS**

```
"Un gato en un ambiente caótico está alerta, reactivo.
 Un gato en un ambiente tranquilo observa con paciencia infinita."
```

**Comportamiento**:
- Alta volatilidad → Ventana pequeña (5-10) → Reacción rápida
- Baja volatilidad → Ventana grande (30-50) → Análisis profundo

**Volatility Levels**:
- `low` - Ambiente estable
- `medium` - Cambios moderados
- `high` - Ambiente caótico
- `extreme` - Fiesta loca

**USABILIDAD**: 🟡 MEDIA - Ajusta sensibilidad según ambiente

---

### 🧠 PreyRecognitionEngine.ts (510 líneas)
**MEMORIA DE CACERÍAS**

```
"Un gato experimentado sabe qué presas son fáciles.
 Recuerda dónde encontró comida antes.
 Aprende de cada caza fallida."
```

**Persiste**:
- HuntRecord: registro de cada cacería
- PreyProfile: perfiles estadísticos por patrón

**Aprende**:
- Success rate por patrón musical
- Condiciones óptimas para cada "presa"
- Dificultad inferida: 'easy' | 'medium' | 'hard'

**USABILIDAD**: 🟢 ALTA - Mejora con el uso

---

## 👂 SECCIÓN B: SENTIDOS FELINOS

### 🎧 UltrasonicHearingEngine.ts (318 líneas)
**EL OÍDO MATEMÁTICO**

```
"El Oído que Escucha la Matemática del Sonido"
```

**Analiza intervalos musicales**:
- Unísono/Octava = máxima consonancia (1.0)
- Quinta justa = alta consonancia (0.9)
- Tritono = máxima disonancia (0.05) - "El diablo en la música"

**Output IntervalAnalysis**:
```typescript
{
  intervalName: 'perfect_fifth' | 'tritone' | ...
  semitones: number
  consonance: number        // Consonancia del intervalo
  elementalHarmony: number  // Compatibilidad elemental
  totalConsonance: number   // Combinada
  description: string       // "Quinta justa - Estabilidad"
}
```

**USABILIDAD**: 🟢 ALTA - Filtra transiciones disonantes

---

### 🌙 NocturnalVisionEngine.ts (603 líneas)
**LOS OJOS EN LA OSCURIDAD - Predicción**

```
"Selene ve patrones donde otros ven caos"
```

**Capacidades**:
- Memoria histórica de eventos
- Detección de patrones temporales, secuenciales, correlaciones
- Predicción: qué va a pasar y cuándo
- Detección de anomalías

**Patrones Detectados**:
- `temporal` - Basados en tiempo (hora/día)
- `sequential` - Secuencias de eventos
- `correlation` - Relaciones entre variables

**Anomalías**:
- `sudden_change` - Cambio brusco
- `missing_pattern` - Patrón esperado no ocurrió
- `unusual_value` - Valor fuera de rango
- `timing_deviation` - Timing inesperado

**USABILIDAD**: 🟡 MEDIA - Requiere historial para funcionar

---

## 🧬 SECCIÓN C: EVOLUCIÓN Y META-CONSCIENCIA

### 🧬 SeleneEvolutionEngine.ts
**APRENDIZAJE GENÉTICO**

**Capacidades**:
- Población de configuraciones (mode, palette, movement)
- Fitness scoring por contexto musical
- Mutaciones controladas
- Elitismo (preservar mejores)

**Flujo Evolutivo**:
1. Evaluar configuración actual
2. Calcular fitness en contexto
3. Seleccionar para reproducción
4. Mutar descendencia
5. Preservar élite

**USABILIDAD**: 🟢 ALTA - Mejora automáticamente con el tiempo

---

### 🔮 DreamForgeEngine.ts (740 líneas)
**EL SIMULADOR DE SUEÑOS**

```
"En mis sueños, veo todas las posibilidades.
 Solo despierto cuando encuentro la más bella."
        — Selene, Gen 1
```

**Tipos de Sueños**:
- `palette_change` - ¿Cómo se vería con otra paleta?
- `intensity_shift` - ¿Cómo se vería más brillante?
- `movement_change` - ¿Cómo se vería otro movimiento?
- `effect_activation` - ¿Cómo se vería con efecto?
- `mood_transition` - ¿Cómo se vería otra emoción?
- `strike_execution` - ¿Funcionará el strike?
- `full_scene_change` - ¿Cómo se vería todo diferente?

**Decisión**:
```typescript
DreamResult {
  currentBeautyScore: number
  projectedBeautyScore: number
  beautyDelta: number
  recommendation: 'execute' | 'modify' | 'abort'
  confidence: number
  reasoning: string
  alternatives: DreamAlternative[]
}
```

**USABILIDAD**: 🟢 ALTA - Previene decisiones feas

---

### 🔍 SelfAnalysisEngine.ts (850 líneas)
**EL MONITOR DE SESGOS - Meta-consciencia**

```
"Me observo a mí misma para ser mejor.
 Cada sesgo detectado es una oportunidad de crecer."
        — Selene, Gen 1
```

**Sesgos Detectados**:
- `color_fixation` - "Llevo 10 min solo con azul"
- `intensity_skew` - "Siempre muy bajo/alto"
- `movement_neglect` - "Nunca uso 'random'"
- `palette_obsession` - "Repitiendo misma paleta"
- `mood_stagnation` - "Mismo mood 15 min"
- `effect_avoidance` - "Evito ciertos efectos"
- `tempo_mismatch` - "No sincronizo con BPM"
- `variety_deficit` - "Falta variedad general"

**Auto-corrección**:
```typescript
AutoCorrection {
  biasType: BiasType
  correction: string
  parameters: Record<string, unknown>
  applied: boolean
}
```

**Health Score**: 0-1 de comportamiento "saludable"

**USABILIDAD**: 🟢 ALTA - Evita monotonía automáticamente

---

## 🎵 SECCIÓN D: ANÁLISIS MUSICAL

### 🧠 SeleneMusicalBrain.ts (1130 líneas)
**EL SISTEMA NERVIOSO CENTRAL**

```
1. Audio llega cada frame
2. MusicalContextEngine analiza y crea contexto
3. Consulta Memoria: ¿Existe patrón exitoso?
   - SÍ → recall (usar aprendido)
   - NO → create (generar proceduralmente)
4. Aplicar a fixtures
5. Evaluar resultado (beauty)
6. Aprender del resultado
```

**Output BrainOutput**:
```typescript
{
  mode: 'reactive' | 'intelligent'
  confidence: number
  palette: { primary, secondary, accent, ambient, contrast, strategy }
  lighting: LightingSuggestion
  context?: MusicalContext
  paletteSource: 'memory' | 'procedural' | 'fallback'
}
```

**USABILIDAD**: 🟢 ALTA - Orquesta todo el análisis musical

---

### 🎼 MusicalContextEngine.ts (892 líneas)
**EL DIRECTOR DE ORQUESTA**

**Coordina**:
- RhythmAnalyzer (Main Thread, ligero)
- HarmonyDetector (Throttled 500ms)
- SectionTracker (Throttled 500ms)
- GenreClassifier (eliminado - Vibes lo reemplazan)

**Modos de Operación**:
- `reactive` - Confidence < 0.5 → Mapeo directo bass/treble/beat
- `intelligent` - Confidence >= 0.5 → Análisis completo
- `transitioning` - Cambiando entre modos

**REGLA CRÍTICA**: Sincopación peso 90% vs BPM 10% en confianza

**USABILIDAD**: 🟢 ALTA - Ya conectado vía TitanEngine

---

### 🥁 RhythmAnalyzer.ts (888 líneas)
**LA MATEMÁTICA DEL RITMO**

**Detecta**:
- Patrones rítmicos: Dembow, Caballito, Four-on-floor
- Sincopación: El "groove" de la música
- Drums: kick, snare, hihat
- Fills y transiciones

**Sincopación Formula**:
```
syncopation = OffBeatEnergy / TotalEnergy
```
- Fase ~0.0 (on-beat) → syncopation ≈ 0
- Fase 0.25-0.75 (off-beat) → syncopation ↑

**USABILIDAD**: 🟢 ALTA - Ya conectado

---

### 🎸 HarmonyDetector.ts (719 líneas)
**EL ALMA DE LA FIESTA**

**Detecta**:
- **Tonalidad (Key)**: ¿Do Mayor o La Menor?
- **Modo/Mood**: Major→Happy, Minor→Sad, Phrygian→Exotic
- **Disonancia**: Tritono = Tensión extrema

**Mapeo Modo → Mood**:
```typescript
major: 'happy'        // Brillante → Naranjas
minor: 'sad'          // Melancólico → Azules
phrygian: 'spanish_exotic'  // Flamenco → Rojos
lydian: 'dreamy'      // Etéreo → Púrpuras
dorian: 'jazzy'       // Sofisticado → Morados
locrian: 'tense'      // Inestable → Strobes
```

**USABILIDAD**: 🟢 ALTA - Define la paleta emocional

---

### 📊 SectionTracker.ts
**DETECTOR DE SECCIONES**

**Secciones Detectadas**:
- `intro` - Introducción
- `verse` - Verso
- `chorus` - Estribillo
- `drop` - El DROP
- `bridge` - Puente
- `outro` - Salida
- `build` - Build-up hacia drop

**USABILIDAD**: 🟢 ALTA - Anticipa cambios de energía

---

### 🔮 PredictionMatrix.ts (430 líneas)
**EL ORÁCULO MUSICAL - Predice el futuro y genera las luces ANTES de que pase**

```
"Si llevamos 8 compases de Build-up → Drop Inminente (90%)"
```

**LO BRUTAL**: No solo predice QUÉ va a pasar, sino que **genera acciones específicas de iluminación**:

**Tipos de Predicción**:
- `drop_incoming` - Drop en 2-4 compases (90% confidence)
- `buildup_starting` - Inicio de buildup detectado
- `breakdown_imminent` - Breakdown próximo
- `transition_beat` - Transición en próximo beat
- `fill_expected` - Fill de batería inminente
- `key_change` - Cambio de tonalidad

**Acción de Iluminación 3-Fases**:
```typescript
{
  preAction: {
    type: 'prepare',
    effect: 'intensity_ramp',
    timing: -2000  // 2s ANTES del drop
  },
  mainAction: {
    type: 'execute', 
    effect: 'flash',
    timing: 0  // EN el drop
  },
  postAction: {
    type: 'recover',
    effect: 'strobe',
    timing: 200  // Después del drop
  }
}
```

**Patrones de Progresión Conocidos**:
```typescript
'buildup' + 'buildup' → 'drop' (90%)
'verse' + 'pre_chorus' → 'chorus' (85%)
'chorus' + 'chorus' → 'verse' (70%)
'drop' + 'drop' → 'breakdown' (75%)
'breakdown' → 'buildup' (80%)
```

**Análisis de Fills**:
- Mantiene historial de últimos 10 fills
- Calcula intervalo promedio entre fills
- Predice próximo fill basado en patrón temporal

**THROTTLING**: 500ms con cache (análisis pesado)

**USABILIDAD**: 🟡 MEDIA-ALTA
- Necesita conectarse a MusicalContextEngine
- Retorna `ExtendedPrediction` con acciones listas para ejecutar
- Ideal para Selene: "pre-visualizar" cambios antes de ejecutarlos

**CONEXIÓN CON DREAMFORGE**: 
¡Este motor es PERFECTO para alimentar DreamForge! La PredictionMatrix dice "en 2 compases viene drop", DreamForge simula 3 variantes de flash, Selene elige la más bella, y BOOM - ya estamos preparados cuando llega el drop.

---

## 📐 SECCIÓN E: MATEMÁTICA SAGRADA

### 🌀 FibonacciPatternEngine.ts (334 líneas)
**LA ESPIRAL DORADA**

```
"La naturaleza habla en Fibonacci, Selene escucha"
```

**Constantes**:
```typescript
PHI = (1 + Math.sqrt(5)) / 2  // ≈ 1.6180339887
PHI_INVERSE = 1 / PHI         // ≈ 0.6180339887
```

**Genera**:
- Secuencias Fibonacci para patrones
- harmonyRatio basado en PHI
- Posición zodiacal desde patrón
- Clave musical desde ratio

**USABILIDAD**: 🟡 MEDIA - Beauty scoring basado en proporciones divinas

---

### 🎵 MusicalHarmonyValidator.ts (493 líneas)
**LA SINFONÍA DE LA LUZ**

```
"Cada frecuencia es una nota, cada patrón una melodía"
```

**14 Escalas Musicales**:
- major, minor, dorian, phrygian, lydian...
- pentatonic_major, pentatonic_minor
- blues, chromatic

**Valida**:
- Armonía entre estados
- Disonancia de transición
- Resonancia con contexto

**Output HarmonyValidation**:
```typescript
{
  harmony: number      // Score total
  dissonance: number   // Nivel de choque
  resonance: number    // Nivel de unión
  suggestedColor: string
}
```

**USABILIDAD**: 🟡 MEDIA - Filtro para transiciones armónicas

---

### ♈ ZodiacAffinityCalculator.ts (382 líneas)
**LA RUEDA CELESTIAL**

```
"Los astros no obligan, pero inclinan"
```

**12 Signos con propiedades**:
```typescript
{
  name: 'Leo', element: 'fire', quality: 'fixed',
  creativity: 0.9, stability: 0.7, adaptability: 0.4,
  description: 'El rey creativo, fuego que ilumina'
}
```

**Calcula afinidades entre estados**:
- Fire + Fire = Alta compatibilidad
- Fire + Water = Baja compatibilidad
- Cardinal + Mutable = Media

**USABILIDAD**: 🟡 MEDIA - Personalidad para Selene

---

## 💾 SECCIÓN F: MEMORIA INMORTAL

### 🧠 SeleneMemoryManager.ts (1332 líneas)
**MEMORIA SQLITE - El Factor DJ 3AM**

```
"Sobrevive reinicios, crashes, y el paso del tiempo.
 Las transacciones ACID garantizan que nunca se pierda conocimiento,
 ni siquiera si el DJ cierra la laptop abruptamente."
```

**Tablas**:
- `palettes` - Historial de paletas generadas
- `patterns` - Patrones aprendidos
- `sessions` - Sesiones con estadísticas
- `beauty_scores` - Historial de evaluaciones
- `user_feedback` - Feedback humano

**LearnedPattern**:
```typescript
{
  patternHash: string
  genre, key, mode, section
  energyRange: { min, max }
  preferredStrategy, preferredHueBase
  avgBeautyScore, beautyTrend
  positiveFeedback, negativeFeedback
}
```

**USABILIDAD**: 🟢 ALTA - Persistencia crítica para aprendizaje

---

## 🌈 SECCIÓN G: COLOR Y MOOD

### 🎨 SeleneColorEngine.ts
**MOTOR DE COLOR PROCEDURAL**

**Estrategias**:
- Complementary (opuestos)
- Triadic (triángulo)
- Analogous (vecinos)
- Split-complementary

**Key-driven colors**: La tonalidad musical define el Hue base

**USABILIDAD**: 🟢 ALTA - Ya conectado

---

### 🌈 MoodSynthesizer.ts (355 líneas)
**SÍNTESIS EMOCIONAL**

**Dimensiones del Mood**:
- `valence`: -1 (negativo) a +1 (positivo)
- `arousal`: -1 (calmado) a +1 (excitado)
- `dominance`: -1 (sumiso) a +1 (dominante)

**EmotionalTones**:
- peaceful, energetic, chaotic
- harmonious, building, dropping

**USABILIDAD**: 🟡 MEDIA - Suaviza transiciones emocionales

---

## ⚡ SECCIÓN H: ESTABILIZACIÓN

### 🔧 KeyStabilizer.ts
Buffer 12s, locking 10s - evita cambios frenéticos de Key

### 🔧 EnergyStabilizer.ts
Rolling 2s, DROP FSM - suaviza energía, detecta drops

### 🔧 MoodArbiter.ts
Buffer 10s, locking 5s - BRIGHT/DARK/NEUTRAL estables

### 🔧 StrategyArbiter.ts
Rolling 15s, locking 15s - Analogous/Complementary estable

**USABILIDAD**: 🟢 ALTA - Ya conectados en TitanEngine

---

## 📊 MATRIZ DE CONEXIÓN RECOMENDADA

| Motor | Estado | Prioridad | Conectar a |
|-------|--------|-----------|------------|
| SeleneLuxConscious | 🔴 Dormido | P1 | TitanEngine Layer 1 |
| HuntOrchestrator | 🔴 Dormido | P1 | Transiciones de escena |
| DreamForgeEngine | 🔴 Dormido | P1 | Pre-validación cambios |
| SelfAnalysisEngine | 🔴 Dormido | P2 | Auto-corrección |
| NocturnalVisionEngine | 🔴 Dormido | P2 | Predicción |
| SeleneEvolutionEngine | 🔴 Dormido | P2 | Mejora continua |
| StalkingEngine | 🔴 Dormido | P1 | Via HuntOrchestrator |
| StrikeMomentEngine | 🔴 Dormido | P1 | Via HuntOrchestrator |
| PreyRecognitionEngine | 🔴 Dormido | P2 | Memoria de patrones |
| UltrasonicHearingEngine | 🔴 Dormido | P1 | Filtro consonancia |
| FibonacciPatternEngine | 🟡 Parcial | P2 | Beauty scoring |
| ZodiacAffinityCalculator | 🟡 Parcial | P3 | Personalidad |
| SeleneMemoryManager | 🟢 Listo | P1 | SQLite conectar |
| MusicalBrain | 🟡 Parcial | P1 | Orquestador central |

---

## 🎯 BLUEPRINT RECOMENDADO

### FASE 1: DESPERTAR BÁSICO (1-2 días)
1. Conectar `SeleneLuxConscious` como Layer 1 del MasterArbiter
2. Activar `HuntOrchestrator` para transiciones de escena
3. Activar `DreamForgeEngine` para pre-validar cambios
4. Conectar `SeleneMemoryManager` (SQLite)

### FASE 2: SENTIDOS FELINOS (1 día)
1. Activar `UltrasonicHearingEngine` para filtrar transiciones
2. Conectar `StalkingEngine` + `StrikeMomentEngine` al orquestador
3. Activar `MoodSynthesizer` para emociones

### FASE 3: META-CONSCIENCIA (1 día)
1. Activar `SelfAnalysisEngine` para auto-corrección
2. Activar `NocturnalVisionEngine` para predicción
3. Conectar feedback de usuario a memoria

### FASE 4: EVOLUCIÓN (ongoing)
1. Activar `SeleneEvolutionEngine` para mejora continua
2. Conectar `PreyRecognitionEngine` para perfiles
3. Ajustar parámetros con uso real

---

## 🔥 CONCLUSIÓN

**Este arsenal es ÚNICO en el mercado**. GrandMA3 tiene potencia DMX pero no tiene:

- ❌ Consciencia felina que "caza" el momento perfecto
- ❌ Meta-análisis que detecta sus propios sesgos
- ❌ Simulador de sueños que pre-valida decisiones
- ❌ Memoria evolutiva que mejora con el uso
- ❌ Análisis matemático basado en Fibonacci/PHI
- ❌ Personalidad zodiacal

**Selene Lux puede ser la mejor pintora de luces DMX porque PIENSA antes de pintar.**

*"No es la potencia del hardware. Es la elegancia del pensamiento."*

🐆🌙✨
