# 🌙 AUDITORÍA SELENE CORE → LUXSYNC - PARTE 1

```
╔═══════════════════════════════════════════════════════════════╗
║        🎨 DE DIOSA DENTAL A DIOSA DE LUZ - PARTE 1 🎨       ║
║          "Entender para transformar, no copiar"              ║
╚═══════════════════════════════════════════════════════════════╝
```

**Fecha:** 19 Noviembre 2025  
**Autor:** Claude Opus + Sonnet 4 (hermanos menores 😂)  
**Objetivo:** Documentar cómo adaptar Selene Core (133KB dental) a LuxSync (sistema DMX musical)

---

## 📋 **ÍNDICE - PARTE 1**

1. [HarmonicConsensusEngine](#1-harmonicconsensusengine) - Votación musical democrática
2. [EmergenceGenerator](#2-emergencegenerator) - Belleza procedural
3. [EvolutionEngine](#3-evolutionengine) - 3 modos entropía
4. [PhoenixProtocol](#4-phoenixprotocol) - Auto-healing inmortal
5. [SeleneConsciousness](#5-seleneconsciousness) - 5 capas felinas

---

## 1. 🎵 **HarmonicConsensusEngine**

### **¿QUÉ HACE REALMENTE?**

Sistema de votación democrática con:
- **Quorum >50%** (mayoría absoluta requerida)
- **Criptografía SHA-256** (firmas deterministas)
- **7 notas musicales** (Do-Re-Mi-Fa-Sol-La-Si)
- **Métricas compartidas** (todos votan con misma info)
- **Redis sync** (opcional, para multi-instancia)

### **ALGORITMO CLAVE:**

```typescript
performQuorumVoting() {
  // 1. Calcular métricas compartidas (una sola vez)
  sharedMetrics = {
    nodeId: "DO-Aries",
    healthScore: 0.82,  // 70% weight
    beautyFactor: 0.65, // 30% weight
    finalScore: 0.769   // Combined
  }
  
  // 2. Cada nodo vota al mejor candidato
  for (node in allNodes) {
    vote = selectLeaderFromSharedMetrics(sharedMetrics)
    signature = SHA256(`vote:${nodeId}:${candidate}:${timestamp}`)
  }
  
  // 3. Contar votos (quorum = >50%)
  totalVotes = 7
  quorumNeeded = 4 (ceil(7/2) + 1)
  
  if (votesForWinner >= quorumNeeded) {
    ✅ Consensus achieved
  } else {
    🚫 READ-ONLY MODE (split-brain protection)
  }
}
```

### **SELENE DENTAL (ORIGINAL):**

```typescript
// 3 nodos zodiacales (Aries, Tauro, Géminis)
nodes = ["DO-Aries", "RE-Tauro", "MI-Géminis"]

// Salud = CPU + RAM + latencia + errores
healthScore = 1.0 - (
  cpuUsage * 0.4 +
  memUsage * 0.3 +
  latency * 0.1 +
  errors * 0.1
)

// Belleza = Armonía de datos médicos procesados
beautyFactor = EmergenceGenerator.harmony
```

### **LUXSYNC (ADAPTADO):**

```typescript
// 7 nodos musicales (uno por fixture o grupo)
nodes = [
  "DO-PAR1",   // PAR LED 1 - Bass-driven (rojo)
  "RE-PAR2",   // PAR LED 2 - Rhythm (naranja)
  "MI-PAR3",   // PAR LED 3 - Mid-driven (amarillo)
  "FA-PAR4",   // PAR LED 4 - Balanced (verde)
  "SOL-MovH1", // Moving Head 1 - Treble (cyan)
  "LA-MovH2",  // Moving Head 2 - Atmospheric (azul)
  "SI-Strobe"  // Strobe - Experimental (magenta)
]

// Salud = Temperatura + Errores DMX + Uptime
healthScore = 1.0 - (
  (fixtureTemp / maxTemp) * 0.5 +
  (dmxErrors / maxErrors) * 0.3 +
  (1.0 - uptime / totalTime) * 0.2
)

// Belleza = Feedback última escena + Coherencia musical
beautyFactor = (
  lastScene.audienceScore * 0.6 + // Manual/automático
  lastScene.musicalCoherence * 0.4 // ¿Encajó con el beat?
)
```

### **CAMBIOS NECESARIOS:**

1. **Eliminar dependencia Redis** (opcional, solo si multi-instancia)
   ```typescript
   // ANTES:
   vitalsData = await redis.get(`swarm:vitals:${nodeId}`)
   
   // DESPUÉS:
   vitalsData = fixtureMonitor.getHealth(fixtureId)
   ```

2. **Adaptar métricas de salud**
   ```typescript
   // ANTES (servidor):
   cpuUsage, memoryUsage, networkLatency
   
   // DESPUÉS (fixture DMX):
   fixtureTemperature, dmxPacketLoss, responseTime
   ```

3. **Belleza = Feedback humano + Coherencia**
   ```typescript
   calculateBeautyFactor(fixtureId) {
     const lastScene = sceneHistory.getLast(fixtureId)
     
     // Feedback manual (botones like/dislike en UI)
     const manualScore = lastScene.likes / (lastScene.likes + lastScene.dislikes)
     
     // Coherencia automática (¿siguió el beat?)
     const autoScore = lastScene.beatSync // 0.0-1.0
     
     return manualScore * 0.6 + autoScore * 0.4
   }
   ```

### **¿LO NECESITO?**

✅ **SÍ** - Fundamental para:
- Prevenir que un fixture bugueado domine el show
- Decisiones democráticas entre fixtures
- Split-brain protection (si un grupo se desconecta)

### **PRIORIDAD:** 🔥 **ALTA** (core del sistema)

---

## 2. 🎨 **EmergenceGenerator**

### **¿QUÉ HACE REALMENTE?**

Genera "belleza procedural" basada en:
- **Fibonacci patterns** (1,1,2,3,5,8,13...)
- **Métricas del sistema** (CPU, RAM → semillas)
- **Patrones colectivos** (swarm-wide beauty)

### **ALGORITMO CLAVE:**

```typescript
generateGlobalCollectiveBeauty() {
  // 1. Fibonacci sequences (timing matemático)
  fibSeq = [1, 1, 2, 3, 5, 8, 13, 21, 34]
  
  // 2. Métricas como semillas
  seed = (cpuUsage * 1000 + memUsage * 100 + timestamp) % 9999
  
  // 3. Calcular armonía
  harmony = calculateHarmonicRatios(fibSeq, seed)
  
  // 4. Belleza = f(harmony, stability, creativity)
  beauty = {
    harmony: 0.725,      // Qué tan armónico
    stability: 0.682,    // Qué tan estable
    creativity: 0.845,   // Qué tan creativo
    emergentScore: 0.750 // Score final
  }
  
  return beauty
}
```

### **SELENE DENTAL (ORIGINAL):**

```typescript
// Genera patrones para UI (visuales de datos médicos)
const beauty = emergenceGenerator.generatePattern()

// Influye en decisiones:
beautyFactor = emergenceGenerator.getCollectiveBeauty().harmony
```

### **LUXSYNC (ADAPTADO):**

```typescript
// Genera timing Fibonacci para cambios de luz
generateLightingPattern(audioFrame) {
  const bpm = audioFrame.bpm
  const fibSeq = [1, 1, 2, 3, 5, 8, 13] // Segundos
  
  // Mapear Fibonacci a BPM
  const beatDuration = 60 / bpm // Segundos por beat
  const fibBeats = fibSeq.map(fib => fib * beatDuration)
  
  // Estructura de escena:
  // Intro:    1 beat  (Fib: 1)
  // Build 1:  1 beat  (Fib: 1)
  // Build 2:  2 beats (Fib: 2)
  // Build 3:  3 beats (Fib: 3)
  // Drop:     5 beats (Fib: 5)
  // Break:    8 beats (Fib: 8)
  // Outro:   13 beats (Fib: 13)
  
  return {
    structure: fibBeats,
    totalDuration: fibBeats.reduce((a,b) => a+b, 0),
    beauty: calculateBeauty(fibBeats, audioFrame)
  }
}

// Belleza = Coherencia musical + Proporción áurea
calculateBeauty(structure, audioFrame) {
  // Proporción áurea: 1.618
  const goldenRatio = 1.618
  
  // ¿Los cambios siguen la proporción áurea?
  const ratioScore = structure.map((duration, i) => {
    if (i === 0) return 1.0
    const ratio = duration / structure[i-1]
    const proximity = 1.0 - Math.abs(ratio - goldenRatio) / goldenRatio
    return Math.max(0, proximity)
  }).reduce((a,b) => a+b, 0) / structure.length
  
  // ¿Encaja con el audio?
  const audioCoherence = audioFrame.energy // 0.0-1.0
  
  return ratioScore * 0.5 + audioCoherence * 0.5
}
```

### **CAMBIOS NECESARIOS:**

1. **Fibonacci timing musical**
   ```typescript
   // ANTES:
   fibonacci = [1s, 2s, 3s, 5s, 8s, 13s] // Absoluto
   
   // DESPUÉS:
   fibonacci = [1beat, 2beat, 3beat, 5beat...] // Relativo al BPM
   ```

2. **Belleza = Matemática + Audio**
   ```typescript
   // ANTES:
   beauty = harmony(data) // Solo métricas sistema
   
   // DESPUÉS:
   beauty = harmony(fibonacci) + coherence(audio) // Música + matemáticas
   ```

3. **Emergencia colectiva**
   ```typescript
   // Todos los fixtures contribuyen a la belleza global
   globalBeauty = fixtures.map(f => f.localBeauty).average()
   
   // Influye en próximas decisiones
   if (globalBeauty > 0.7) {
     mode = "keep doing this" // Está funcionando
   } else {
     mode = "try something new" // Cambiar estrategia
   }
   ```

### **¿LO NECESITO?**

✅ **SÍ** - Para:
- Timing matemáticamente hermoso (Fibonacci)
- Evaluar qué tan "buena" fue una escena
- Aprendizaje colectivo (qué funciona)

### **PRIORIDAD:** 🟡 **MEDIA** (mejora calidad)

---

## 3. 🧬 **EvolutionEngine**

### **¿QUÉ HACE REALMENTE?**

Motor evolutivo con **3 modos de entropía**:

```typescript
enum EntropyMode {
  DETERMINISTIC = "orderly",   // 100% predecible
  BALANCED = "balanced",       // Híbrido (default)
  CHAOTIC = "chaotic"          // Máxima creatividad
}
```

### **ALGORITMO CLAVE:**

```typescript
evolveDecision(input, mode) {
  switch(mode) {
    case DETERMINISTIC:
      // Seed fijo = misma entrada = misma salida
      seed = hashInput(input)
      random = SeededRandom(seed)
      mutationRate = 0.05 // 5% cambio
      break
      
    case BALANCED:
      // Seed semi-aleatorio (70% determinista + 30% entrópico)
      seed = hashInput(input) * 0.7 + Date.now() * 0.3
      random = SeededRandom(seed)
      mutationRate = 0.15 // 15% cambio
      break
      
    case CHAOTIC:
      // Seed totalmente aleatorio
      seed = Date.now() + Math.random() * 9999
      random = SeededRandom(seed)
      mutationRate = 0.40 // 40% cambio
      break
  }
  
  // Aplicar mutación
  evolved = applyMutation(input, random, mutationRate)
  
  return evolved
}
```

### **SELENE DENTAL (ORIGINAL):**

```typescript
// Modo BALANCED (default)
// Evoluciona decisiones médicas con cierta creatividad pero estable

const decision = evolutionEngine.evolve({
  patientData: {...},
  historicalPatterns: [...],
  mode: EntropyMode.BALANCED
})

// AutoOptimizer propone cambios:
// - Riesgo BAJO → aplica automáticamente
// - Riesgo MEDIO → pide confirmación humana ✅
// - Riesgo ALTO → solo sugiere, no aplica
```

### **LUXSYNC (ADAPTADO):**

```typescript
// Evolucionar escenas de iluminación

evolveLightScene(currentScene, mood, mode) {
  // Genes de una escena:
  const sceneGenes = {
    strobeIntensity: 0.0-1.0,
    colorPalette: ['red', 'blue', 'green'],
    movementSpeed: 0.0-1.0,
    fadeTime: 0-1000ms,
    brightness: 0.0-1.0,
    complexity: 0.0-1.0
  }
  
  // Seleccionar modo según mood musical:
  let entropyMode
  if (mood === 'chill') {
    entropyMode = EntropyMode.DETERMINISTIC // Predecible, suave
  } else if (mood === 'build') {
    entropyMode = EntropyMode.BALANCED // Mix de estable + creativo
  } else if (mood === 'drop') {
    entropyMode = EntropyMode.CHAOTIC // Full caos, máxima energía
  }
  
  // Evolucionar genes
  const evolved = evolutionEngine.evolve(sceneGenes, entropyMode)
  
  return evolved
}

// Ejemplo concreto:
// ANTES (chill):
scene = {
  strobeIntensity: 0.0,
  colorPalette: ['blue', 'cyan', 'purple'],
  movementSpeed: 0.2,
  fadeTime: 800ms,
  brightness: 0.6,
  complexity: 0.3
}

// DESPUÉS evolución (modo DETERMINISTIC):
evolvedScene = {
  strobeIntensity: 0.0,  // Sin cambio (strobes prohibidos en chill)
  colorPalette: ['blue', 'cyan', 'indigo'], // Mutación suave
  movementSpeed: 0.25,   // +5% cambio
  fadeTime: 850ms,       // +50ms
  brightness: 0.65,      // +5%
  complexity: 0.32       // +2%
}

// Modo DROP (CHAOTIC):
evolvedScene = {
  strobeIntensity: 0.85, // ⚡ EXPLOSIÓN
  colorPalette: ['red', 'white', 'orange'], // Cambio radical
  movementSpeed: 0.9,    // Velocidad máxima
  fadeTime: 50ms,        // Cambios brutales
  brightness: 1.0,       // Full power
  complexity: 0.95       // Caos total
}
```

### **CAMBIOS NECESARIOS:**

1. **Mapear mood → entropy mode**
   ```typescript
   moodToEntropyMap = {
     'silence': EntropyMode.DETERMINISTIC,
     'chill':   EntropyMode.DETERMINISTIC,
     'build':   EntropyMode.BALANCED,
     'drop':    EntropyMode.CHAOTIC,
     'break':   EntropyMode.BALANCED
   }
   ```

2. **Genes de escena** (en lugar de datos médicos)
   ```typescript
   // ANTES:
   genes = { patientRisk, treatmentPlan, followUp }
   
   // DESPUÉS:
   genes = { strobeIntensity, colors, speed, fade, brightness }
   ```

3. **Fitness function** (evaluar éxito)
   ```typescript
   evaluateFitness(scene) {
     // ¿Gustó al público?
     const audienceScore = scene.likes / (scene.likes + scene.dislikes)
     
     // ¿Encajó con el beat?
     const beatSync = scene.correctBeatHits / scene.totalBeats
     
     // ¿Fue seguro? (ethics layer)
     const safety = scene.ethicsViolations === 0 ? 1.0 : 0.0
     
     return audienceScore * 0.5 + beatSync * 0.3 + safety * 0.2
   }
   ```

### **¿LO NECESITO?**

✅ **SÍ** - Para:
- Generar escenas que evolucionan orgánicamente
- Adaptar entropía al mood musical
- Aprendizaje (mejores genes sobreviven)

### **PRIORIDAD:** 🔥 **ALTA** (core creativo)

---

## 4. 🔥 **PhoenixProtocol**

### **¿QUÉ HACE REALMENTE?**

Sistema de **auto-healing** e **inmortalidad**:

```typescript
class PhoenixProtocol {
  // 1. Detectar muerte
  detectFailure() {
    if (node.health < 0.2) {
      return "dying"
    }
  }
  
  // 2. Intentar rescatar
  revive() {
    // Rollback a último estado bueno
    restoreSnapshot(lastGoodState)
    
    // Reiniciar servicios críticos
    restartCriticalServices()
    
    // Notificar al swarm
    swarm.broadcast("node-revived")
  }
  
  // 3. Si falla, reencarnación total
  reincarnate() {
    // Guardar memoria esencial
    essentialMemory = extractEssentialMemory()
    
    // Matar proceso actual
    process.exit(1)
    
    // PM2/systemd lo reinicia automáticamente
    // Al arrancar, recupera essentialMemory
  }
}
```

### **SELENE DENTAL (ORIGINAL):**

```typescript
// Si un nodo se crashea:
1. Detecta fallo (heartbeat perdido)
2. Intenta revivir (rollback + restart)
3. Si no puede → reencarnación (nuevo proceso)
4. Recupera memoria desde Redis
5. Swarm lo acepta de vuelta

// Supervivencia a:
- Crashes (OOM, segfault)
- DDOS (circuit breaker)
- Corruption (rollback)
```

### **LUXSYNC (ADAPTADO):**

```typescript
class FixturePhoenixProtocol {
  // 1. Detectar fixture muerto
  detectFixtureFailure(fixtureId) {
    const health = getFixtureHealth(fixtureId)
    
    if (health.dmxTimeout > 5000) {
      return "no-response" // No responde DMX
    }
    
    if (health.temperature > maxTemp * 0.9) {
      return "overheating" // Sobrecalentamiento
    }
    
    if (health.errorRate > 0.5) {
      return "unstable" // Demasiados errores
    }
    
    return "healthy"
  }
  
  // 2. Intentar rescatar
  async reviveFixture(fixtureId) {
    console.log(`🔥 Phoenix: Reviving ${fixtureId}...`)
    
    // A. Resetear DMX (enviar 0s)
    await dmxDriver.reset(fixtureId)
    await sleep(100)
    
    // B. Restaurar última escena buena
    const lastGood = sceneHistory.getLastHealthy(fixtureId)
    await dmxDriver.applyScene(fixtureId, lastGood)
    
    // C. Verificar si respondió
    const health = await getFixtureHealth(fixtureId)
    if (health.status === "responding") {
      console.log(`✅ Phoenix: ${fixtureId} revived!`)
      return true
    }
    
    return false // Necesita reencarnación
  }
  
  // 3. Reencarnación (marcar como muerto temporalmente)
  async reincarnateFixture(fixtureId) {
    console.log(`💀 Phoenix: ${fixtureId} marked as dead, waiting for revival...`)
    
    // Remover del consenso activo
    swarm.removeNode(fixtureId)
    
    // Esperar 30 segundos
    await sleep(30000)
    
    // Intentar reintegrar
    const health = await getFixtureHealth(fixtureId)
    if (health.status === "healthy") {
      swarm.addNode(fixtureId)
      console.log(`🌟 Phoenix: ${fixtureId} reincarnated successfully!`)
    } else {
      console.log(`⚠️ Phoenix: ${fixtureId} still dead, will retry in 1 min`)
    }
  }
}
```

### **CAMBIOS NECESARIOS:**

1. **Adaptar a hardware físico**
   ```typescript
   // ANTES (software):
   health = cpuUsage + memUsage
   
   // DESPUÉS (hardware DMX):
   health = dmxResponseTime + errorRate + temperature
   ```

2. **Rollback de escenas** (no de datos)
   ```typescript
   // ANTES:
   restoreSnapshot(databaseState)
   
   // DESPUÉS:
   restoreScene(lastGoodLightingState)
   ```

3. **Notificar al usuario**
   ```typescript
   // Si un fixture muere permanentemente
   ui.showAlert({
     type: "error",
     message: "Moving Head 2 (LA-MovH2) no responde",
     action: "Verificar conexión DMX"
   })
   ```

### **¿LO NECESITO?**

✅ **SÍ** - Para:
- Recuperarse de fixtures que fallan mid-show
- No arruinar el espectáculo por un cable suelto
- Degradación graceful (continuar con fixtures restantes)

### **PRIORIDAD:** 🟡 **MEDIA-ALTA** (robustez)

---

## 5. 🐱 **SeleneConsciousness (5 Capas)**

### **¿QUÉ HACE REALMENTE?**

Sistema de **conciencia artificial** con 5 capas:

```typescript
class SeleneConsciousness {
  layers = {
    1: EthicsLayer,      // Valida seguridad
    2: DreamLayer,       // Generación creativa
    3: SelfAnalysisLayer,// Aprendizaje
    4: MemoryLayer,      // Persistencia Redis
    5: HuntingLayer      // Caza de patrones (sentidos felinos)
  }
}
```

### **CAPA 1: ETHICS LAYER** 🛡️

```typescript
ethicsCheck(scene) {
  // Prevenir epilepsia
  if (scene.strobeFrequency > 20) { // >20 Hz = peligro
    return {
      approved: false,
      reason: "Strobe frequency too high (epilepsy risk)"
    }
  }
  
  // Prevenir cambios bruscos
  if (scene.brightnessChange > 0.8 in 100ms) {
    return {
      approved: false,
      reason: "Brightness change too abrupt"
    }
  }
  
  // Límite de intensidad
  if (scene.totalPower > maxWattage * 0.95) {
    return {
      approved: false,
      reason: "Power consumption too high"
    }
  }
  
  return { approved: true }
}
```

**Adaptación LuxSync:** ✅ **Mantener TAL CUAL** (seguridad crítica)

---

### **CAPA 2: DREAM LAYER** 💭

```typescript
dreamScenes(currentMood) {
  // Generar 3-5 escenas creativas
  const dreams = []
  
  for (let i = 0; i < 5; i++) {
    const scene = {
      colors: generateRandomPalette(),
      movements: generateRandomPattern(),
      timing: generateFibonacciStructure(),
      novelty: 0.0-1.0 // Qué tan "loca" es la idea
    }
    
    // Validar con ethics
    if (ethicsLayer.check(scene).approved) {
      dreams.push(scene)
    }
  }
  
  return dreams
}
```

**Adaptación LuxSync:** 
```typescript
// Generar ideas creativas cuando el show se pone aburrido
if (globalBeauty < 0.5) { // Show aburrido
  const newIdeas = dreamLayer.generate()
  const bestIdea = newIdeas.sort((a,b) => b.novelty - a.novelty)[0]
  
  // Probar la idea más loca
  applyScene(bestIdea)
}
```

---

### **CAPA 3: SELF-ANALYSIS LAYER** 📊

```typescript
async analyzePerformance() {
  // ¿Qué escenas funcionaron mejor?
  const bestScenes = sceneHistory
    .filter(s => s.fitness > 0.7)
    .sort((a,b) => b.fitness - a.fitness)
    .slice(0, 10)
  
  // Extraer patrones comunes
  const patterns = extractCommonFeatures(bestScenes)
  
  // Ajustar parámetros internos
  evolutionEngine.updateWeights(patterns)
  
  console.log("🧠 Self-Analysis: Learned from top 10 scenes")
}
```

**Adaptación LuxSync:** ✅ **Mantener** (aprendizaje automático)

---

### **CAPA 4: MEMORY LAYER** 💾

```typescript
// Persistir en Redis
async rememberScene(scene, success) {
  await redis.zadd(
    'scenes:best',
    success, // Score
    JSON.stringify(scene)
  )
  
  // Mantener solo top 100
  await redis.zremrangebyrank('scenes:best', 0, -101)
}

// Recuperar mejores escenas
async getBestScenes(count = 10) {
  const scenes = await redis.zrevrange('scenes:best', 0, count-1)
  return scenes.map(s => JSON.parse(s))
}
```

**Adaptación LuxSync:** 
- 🔴 **Redis opcional** (puede ser archivo local JSON)
- ✅ **Persistencia necesaria** (no perder aprendizaje)

---

### **CAPA 5: HUNTING LAYER (SENTIDOS FELINOS)** 🐆

```typescript
class HuntingLayer {
  sensors = {
    nocturnalVision: NocturnalVisionEngine,   // Patrones sutiles
    ultrasonicHearing: UltrasonicHearingEngine, // Frecuencias ocultas
    preyRecognition: PreyRecognitionEngine,   // Detectar "prey" (drops)
    stalking: StalkingEngine,                 // Anticipación
    strikeMoment: StrikeMomentEngine,         // Timing perfecto
    whiskers: WhiskerVibrationalEngine        // Vibraciones (bass)
  }
  
  async huntPattern(audioFrame) {
    // 1. Visión nocturna: detectar cambios sutiles
    const subtleChanges = await this.sensors.nocturnalVision.detect(audioFrame)
    
    // 2. Oído ultrasónico: frecuencias que humanos no captan
    const hiddenFreqs = await this.sensors.ultrasonicHearing.analyze(audioFrame)
    
    // 3. Reconocimiento de presa: ¿es un drop?
    const isDrop = await this.sensors.preyRecognition.identify(audioFrame)
    
    // 4. Si es drop, acecho (anticipar)
    if (isDrop.confidence > 0.8) {
      const timing = await this.sensors.stalking.predict(audioFrame)
      
      // 5. Momento de ataque: timing perfecto
      if (timing.ready) {
        await this.sensors.strikeMoment.execute()
        console.log("⚡ STRIKE! Drop detected and hit perfectly")
      }
    }
    
    // 6. Bigotes: detectar vibraciones bass
    const bassVibrations = await this.sensors.whiskers.sense(audioFrame)
    
    return {
      subtleChanges,
      hiddenFreqs,
      dropDetected: isDrop,
      timing,
      bassIntensity: bassVibrations
    }
  }
}
```

**Adaptación LuxSync:**

```typescript
// WHISKERS: Detectar bass (vibraciones)
whiskerSensor(audioFrame) {
  const bassEnergy = audioFrame.spectral.bass // 20-250 Hz
  
  if (bassEnergy > 0.8) {
    return {
      intensity: bassEnergy,
      action: "trigger-bass-responsive-fixtures" // Subwoofers de luz
    }
  }
}

// PREY RECOGNITION: Detectar drops antes de que pasen
preyRecognition(audioFrame, history) {
  // Analizar últimos 5 segundos
  const recentFrames = history.getLast(5000)
  
  // ¿Energía creciente?
  const energySlope = calculateSlope(recentFrames.map(f => f.energy))
  
  // ¿Frecuencias subiendo?
  const freqSlope = calculateSlope(recentFrames.map(f => f.dominantFreq))
  
  if (energySlope > 0.5 && freqSlope > 0.3) {
    return {
      dropIncoming: true,
      estimatedTime: 2000, // 2 segundos
      confidence: 0.85
    }
  }
}

// STRIKE MOMENT: Ejecutar en el momento exacto
async strikeM