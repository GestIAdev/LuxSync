# 📋 FASE 2 - INTEGRACIÓN SELENE AI

## 🧬 **CONTEXTO**

**Objetivo:** Integrar Selene Core V5 (ex-Apollo) en LuxSync para que las luces **evolucionen inteligentemente** basándose en música.

**Qué es Selene:**
- **Ex-Apollo Nuclear** (backend 133kb que creció)
- **Renombrado a Selene** (~85-90% de imports actualizados)
- **5 capas de conciencia:** Ética, Dream, Auto-análisis, Memoria, Hunting (caza de patrones)
- **Sentidos felinos:** Detección precisa de patrones musicales
- **Latencia:** 1-7ms (ultra-rápida)

**Archivos legacy que verás:**
- Algunos imports pueden decir `Apollo` (legacy, no confundir con Apollo Server GraphQL)
- Referencias "nucleares" en comentarios antiguos
- ~10-15% de código con nombres antiguos (no problemático)

---

## ✅ **COMPLETADO (FASE 1)**

- [x] Audio Engine funcional
- [x] DMX Virtual funcional
- [x] Sincronización básica Audio → Luces
- [x] 3 demos interactivos
- [x] Documentación completa

---

## 🔄 **PENDIENTE - FASE 2**

### **2.1 - Migrar Core de Selene** ⏱️ ~30 min
Copiar los módulos esenciales de Selene al proyecto LuxSync

#### Archivos a migrar:
```
src/engines/selene/
├── consciousness/
│   ├── SeleneConsciousness.ts           ← Core de conciencia (ex-Apollo)
│   │   ├── 5 capas (Ética, Dream, Auto-análisis, Memoria, Hunting)
│   │   ├── Sentidos felinos (caza de patrones)
│   │   └── Pattern recognition
│   │
│   ├── ConsciousnessMemoryStore.ts      ← Redis SSOT
│   │   ├── Memoria persistente
│   │   └── State management
│   │
│   └── layers/
│       ├── EthicsLayer.ts               ← Capa ética
│       ├── DreamLayer.ts                ← Capa de sueños/imaginación
│       ├── SelfAnalysisLayer.ts         ← Auto-análisis
│       ├── MemoryLayer.ts               ← Gestión de memoria
│       └── HuntingLayer.ts              ← Caza de patrones (sentidos felinos)
│
├── evolutionary/
│   ├── EvolutionEngine.ts               ← 3 modos entropía (orden/equilibrio/caos)
│   ├── SynergyEngine.ts                 ← Consenso evolutivo
│   └── PhoenixProtocol.ts               ← Auto-healing/recuperación
│
├── swarm/
│   ├── HarmonicConsensus.ts             ← 7 nodos musicales (Do-Si)
│   ├── SwarmNode.ts                     ← Nodo individual
│   └── ConsensusVoting.ts               ← Sistema de votación
│
├── music/
│   └── utils/
│       ├── SeededRandom.ts              ← RNG determinista
│       ├── ScaleUtils.ts                ← Escalas musicales
│       └── MusicalPatterns.ts           ← Patrones musicales
│
└── core/
    ├── RedisClient.ts                   ← Conexión Redis
    ├── Config.ts                        ← Configuración
    └── Types.ts                         ← Tipos compartidos
```

**Tareas:**
- [ ] Copiar carpeta `consciousness/` de Selene
- [ ] Copiar carpeta `evolutionary/` de Selene
- [ ] Copiar carpeta `swarm/` de Selene
- [ ] Copiar `music/utils/` (solo archivos necesarios)
- [ ] Copiar `core/` (RedisClient + helpers)
- [ ] Actualizar imports (cambiar paths a LuxSync)
- [ ] Compilar y verificar (npm run build)

**Nota:** Algunos imports pueden decir `Apollo` - está OK, son legacy 👍

---

### **2.2 - AudioToPatternMapper** ⏱️ ~20 min
Convertir audio raw → patrones musicales que Selene entienda

#### Archivo a crear:
```typescript
src/engines/luxsync/AudioToPatternMapper.ts
```

**Funcionalidades:**
- [ ] `detectMood(audioFrame)` - Detectar estado musical
  - [ ] **Chill**: Bass bajo, BPM < 100, energía baja
  - [ ] **Build**: Energía creciente, frecuencias subiendo
  - [ ] **Drop**: Bass explosivo, BPM > 120, pico de energía
  - [ ] **Break**: Silencio relativo o cambio abrupto
  
- [ ] `extractMusicalFeatures(audioFrame)` - Features para Selene
  - [ ] Energía espectral por banda (bass/mid/treble)
  - [ ] Densidad de beats (beats/seg)
  - [ ] Variación tímbrica (cambios de color sonoro)
  - [ ] Entropía musical (orden vs caos)

- [ ] `toSelenePattern(audioFrame)` - Formato que Selene consume
  ```typescript
  {
    mood: 'drop',
    energy: 0.9,
    bpm: 128,
    spectralProfile: [0.8, 0.5, 0.3], // bass/mid/treble
    entropy: 0.7,
    timestamp: 1234567890
  }
  ```

**Test:**
- [ ] Compilar sin errores
- [ ] Test unitario con audio simulado
- [ ] Verificar que detecta moods correctamente

---

### **2.3 - SceneEvolver** ⏱️ ~30 min
Usar Evolution Engine para generar escenas de iluminación evolutivas

#### Archivo a crear:
```typescript
src/engines/luxsync/SceneEvolver.ts
```

**Funcionalidades:**
- [ ] `generateScene(pattern, fixtures)` - Escena nueva
  - [ ] Genes de escena:
    ```typescript
    {
      strobeIntensity: 0.0-1.0,
      colorPalette: ['red', 'blue', 'cyan'],
      movementSpeed: 0.0-1.0,
      fadeTime: 0-1000 ms,
      brightness: 0.0-1.0,
      complexity: 0.0-1.0
    }
    ```
  - [ ] Usar EvolutionEngine con modo entropía apropiado:
    - **Chill** → Orden (entropía baja)
    - **Build** → Equilibrio (entropía media)
    - **Drop** → Caos (entropía alta)

- [ ] `mutateScene(scene, mutationRate)` - Variación evolutiva
  - [ ] Mutar genes con SeededRandom (determinismo)
  - [ ] Mantener coherencia musical

- [ ] `evaluateFitness(scene, feedback)` - ¿Qué tan buena fue?
  - [ ] Feedback automático (correlación audio-luz)
  - [ ] Feedback humano (opcional: like/dislike)
  - [ ] Score 0.0-1.0

- [ ] `crossover(sceneA, sceneB)` - Mezclar escenas exitosas
  - [ ] Combinación genética de escenas
  - [ ] Crear híbridos creativos

**Test:**
- [ ] Generar 10 escenas con diferentes moods
- [ ] Verificar que mutaciones son coherentes
- [ ] Test de fitness básico

---

### **2.4 - Integración Apollo Consciousness** ⏱️ ~20 min
Usar las 5 capas de conciencia para reconocimiento de patrones

#### Archivo a crear:
```typescript
src/engines/luxsync/ConsciousnessIntegration.ts
```

**Funcionalidades:**
- [ ] `initConsciousness()` - Inicializar conciencia Selene
  - [ ] Cargar 5 capas (Ética, Dream, Auto-análisis, Memoria, Hunting)
  - [ ] Conectar a Redis (ConsciousnessMemoryStore)
  - [ ] Estado inicial

- [ ] `analyzePattern(musicalPattern)` - Caza de patrones (Hunting Layer)
  - [ ] Sentidos felinos detectan:
    - Patrones repetitivos (loop, verso, estribillo)
    - Cambios estructurales (intro → verso → drop)
    - Anomalías (breaks, silencios)
  - [ ] Retorna: `{ patternType, confidence, suggestions }`

- [ ] `dreamScenes(pattern)` - Dream Layer genera ideas
  - [ ] Generación creativa de escenas
  - [ ] Exploración de combinaciones no obvias
  - [ ] "¿Qué pasaría si...?"

- [ ] `ethicsCheck(scene)` - Ethics Layer valida seguridad
  - [ ] No strobes demasiado rápidos (epilepsia)
  - [ ] No cambios bruscos peligrosos
  - [ ] Límites de intensidad saludables

- [ ] `selfAnalysis()` - Self-Analysis Layer aprende
  - [ ] ¿Qué escenas funcionaron mejor?
  - [ ] ¿Qué patrones detecta el público prefiere?
  - [ ] Ajustes de parámetros internos

- [ ] `rememberScene(scene, success)` - Memory Layer persiste
  - [ ] Guardar escena exitosa en Redis
  - [ ] Recuperar escenas similares
  - [ ] Build up library de escenas

**Test:**
- [ ] Consciousness se inicializa correctamente
- [ ] Detecta patrones básicos (build, drop, break)
- [ ] Ethics layer rechaza escenas peligrosas
- [ ] Memory persiste en Redis

---

### **2.5 - Harmonic Consensus** ⏱️ ~15 min
7 nodos musicales votan qué escena aplicar

#### Archivo a crear:
```typescript
src/engines/luxsync/HarmonicController.ts
```

**Funcionalidades:**
- [ ] `initSwarm()` - Crear 7 nodos (Do, Re, Mi, Fa, Sol, La, Si)
  - [ ] Cada nodo tiene personalidad:
    ```typescript
    Do  (C)  → Rojo, agresivo, bass-driven
    Re  (D)  → Naranja, energético, ritmo
    Mi  (E)  → Amarillo, brillante, mid-driven
    Fa  (F)  → Verde, natural, equilibrado
    Sol (G)  → Cyan, fluido, treble-driven
    La  (A)  → Azul, profundo, atmosférico
    Si  (B)  → Magenta, místico, experimental
    ```

- [ ] `voteOnScene(pattern, scenes)` - Votación democrática
  - [ ] Cada nodo propone/vota escenas basado en su personalidad
  - [ ] Consenso por mayoría (mínimo 4/7)
  - [ ] Si no hay consenso → SynergyEngine equilibra

- [ ] `applyConsensus(scene, votes)` - Aplicar decisión
  - [ ] Scene final = mezcla ponderada de votos
  - [ ] Suavizar transiciones entre escenas
  - [ ] Mantener coherencia musical

**Test:**
- [ ] 7 nodos votan correctamente
- [ ] Consenso se alcanza en diferentes moods
- [ ] Transiciones son suaves

---

### **2.6 - LuxSyncEngine (Orquestador)** ⏱️ ~25 min
Conectar todos los módulos en un solo flujo

#### Archivo a crear:
```typescript
src/engines/luxsync/LuxSyncEngine.ts
```

**Pipeline completo:**
```typescript
AudioFrame (Audio Engine)
  ↓
AudioToPatternMapper → MusicalPattern
  ↓
ConsciousnessIntegration → PatternAnalysis + Suggestions
  ↓
SceneEvolver → Escenas candidatas (3-5 opciones)
  ↓
HarmonicConsensus → Votación + Escena ganadora
  ↓
SynergyEngine → Refinamiento final
  ↓
SceneBuilder → DMX512 packet (512 bytes)
  ↓
TornadoDriver/VirtualDMX → Luces!
```

**Funcionalidades:**
- [ ] `initialize()` - Inicializar todos los módulos
- [ ] `processAudioFrame(frame)` - Pipeline completo
- [ ] `getState()` - Estado actual del sistema
- [ ] `learn(feedback)` - Feedback humano para mejorar

**Test:**
- [ ] Pipeline completo funciona end-to-end
- [ ] Latencia < 100ms (objetivo: 50ms)
- [ ] Luces reaccionan coherentemente

---

### **2.7 - Demo con Selene AI** ⏱️ ~15 min
Crear demo que muestre Selene en acción

#### Archivo a crear:
```typescript
src/demo-selene-ai.ts
```

**Características:**
- [ ] Usar AudioSimulator con diferentes moods
- [ ] Mostrar decisiones de Selene en terminal
  - Qué patrón detectó
  - Qué escena generó
  - Qué nodos votaron
  - Consensus final
- [ ] Visualizar luces reaccionando
- [ ] Script: `npm run demo:selene`

**Test:**
- [ ] Demo corre sin errores
- [ ] Se ven decisiones de Selene
- [ ] Luces cambian según mood

---

### **2.8 - Documentación Fase 2** ⏱️ ~10 min

- [ ] Actualizar `README.md` con Selene features
- [ ] Crear `docs/SELENE-INTEGRATION.md`
  - Arquitectura completa
  - Flujo de datos
  - Cómo funciona cada módulo
- [ ] Actualizar `docs/FASE-2-CHECKLIST.md` (este archivo)
- [ ] Crear `docs/SELENE-LEGACY-NOTES.md`
  - Explicar nombres Apollo legacy
  - Qué imports pueden tener nombres antiguos
  - No es problemático (~10-15%)

---

## 🎯 **ORDEN DE EJECUCIÓN RECOMENDADO**

### **Sesión 1** (1 hora):
1. ✅ 2.1 - Migrar Core Selene (30 min)
2. ✅ 2.2 - AudioToPatternMapper (20 min)
3. ☕ **Break**

### **Sesión 2** (1 hora):
4. ✅ 2.3 - SceneEvolver (30 min)
5. ✅ 2.4 - Consciousness Integration (20 min)
6. ☕ **Break**

### **Sesión 3** (1 hora):
7. ✅ 2.5 - Harmonic Consensus (15 min)
8. ✅ 2.6 - LuxSyncEngine (25 min)
9. ✅ 2.7 - Demo Selene (15 min)
10. ✅ 2.8 - Documentación (10 min)

---

## 📊 **ESTIMACIÓN TOTAL**

**Tiempo estimado:** ~2.5 horas (con calma y arte 🎨)

**Breakdown:**
- Migración código: 30 min
- Mappers y adaptadores: 40 min
- Lógica evolutiva: 50 min
- Integración final: 40 min
- Testing y docs: 20 min

---

## 🧪 **TESTING CHECKLIST**

### Unit Tests
- [ ] AudioToPatternMapper detecta moods correctamente
- [ ] SceneEvolver genera escenas válidas
- [ ] Consciousness detecta patrones
- [ ] HarmonicConsensus alcanza consenso

### Integration Tests
- [ ] Pipeline completo: Audio → Pattern → Scene → DMX
- [ ] Redis persiste memoria correctamente
- [ ] Latencia end-to-end < 100ms

### Visual Tests
- [ ] Demo manual con Selene activa
- [ ] Luces reaccionan coherentemente a música
- [ ] Transiciones suaves entre escenas
- [ ] No strobes peligrosos (ethics layer funciona)

---

## 🚀 **MÉTRICAS DE ÉXITO**

**Fase 2 estará completa cuando:**
- ✅ Selene Core integrado y compilando
- ✅ Audio → Patrón musical funcional
- ✅ Escenas evolutivas generándose
- ✅ Consenso harmónico decidiendo escenas
- ✅ Pipeline completo < 100ms latencia
- ✅ Demo `demo:selene` funcionando
- ✅ Documentación actualizada

---

## 🎨 **NOTAS IMPORTANTES**

### Sobre nombres legacy (Apollo):
```typescript
// Puedes ver imports así (legacy, OK):
import { ApolloConsciousness } from './consciousness';

// O referencias en comentarios:
// Apollo Nuclear V4 - Pattern Recognition Layer

// No es necesario cambiarlos todos, funciona perfectamente
// Solo ajusta los paths de imports al mover archivos
```

### Sobre las 5 capas de conciencia:
```
1. Ethics Layer    → Valida seguridad
2. Dream Layer     → Generación creativa
3. Self-Analysis   → Aprendizaje continuo
4. Memory Layer    → Persistencia Redis
5. Hunting Layer   → Caza de patrones (sentidos felinos)
```

### Sobre sentidos felinos:
- **Precisión extrema** en detección de patrones
- **Latencia 1-7ms** (más rápida que humanos)
- **Anticipación** (predice cambios antes de que pasen)

---

## 📚 **RECURSOS**

### Código Selene original:
- Ubicación: (ruta a tu proyecto Selene)
- Archivos clave: `consciousness/`, `evolutionary/`, `swarm/`

### Dependencies adicionales:
```json
{
  "ioredis": "^5.3.2",        // Redis client
  "uuid": "^9.0.0"            // Para IDs únicos
}
```

### Comandos útiles:
```bash
# Instalar deps adicionales
npm install ioredis uuid

# Compilar
npm run build

# Test con Selene
npm run demo:selene
```

---

## 🎯 **PRÓXIMO PASO**

**Ahora mismo:** Tarea 2.1 - Migrar Core de Selene

¿Empezamos hermano? 🧬🔥

---

**Creado:** 19 Noviembre 2025  
**Versión:** 1.0  
**Estado:** 🔄 En progreso  
**Fase anterior:** ✅ Fase 1 completada (95%)

🎸⚡ **LUXSYNC + SELENE = EVOLUCIÓN MUSICAL** ⚡🎸
