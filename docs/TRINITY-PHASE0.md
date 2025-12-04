# 🔺 TRINITY PHASE 0 - ARQUITECTURA IMPLEMENTADA

> **Fecha**: Phase 0 Complete
> **Objetivo**: Crear la estructura base de Worker Threads para LuxSync

---

## 📊 RESUMEN EJECUTIVO

Se ha implementado la arquitectura **LUX TRINITY** usando **Worker Threads nativos de Node.js**, adaptando los conceptos del Swarm de Selene Song Core para funcionar en Electron sin dependencias externas (PM2, Redis).

### Arquitectura Final

```
┌─────────────────────────────────────────────────────────────────┐
│                      ELECTRON MAIN PROCESS                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   🛡️ ALPHA (Orchestrator)                  │  │
│  │  ┌──────────────────────────────────────────────────────┐ │  │
│  │  │              TrinityOrchestrator.ts                  │ │  │
│  │  │  • Spawning & lifecycle de workers                   │ │  │
│  │  │  • Routing de mensajes (BETA ↔ GAMMA)               │ │  │
│  │  │  • Phoenix Protocol (resurrections)                  │ │  │
│  │  │  • Heartbeat monitoring                             │ │  │
│  │  │  • Circuit Breaker (fault tolerance)                │ │  │
│  │  │  • DMX Output (baja latencia a USB)                 │ │  │
│  │  └──────────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────┘  │
│                           │                                      │
│              postMessage  │  postMessage                        │
│                   ↓       ↓       ↓                             │
│  ┌─────────────────────┐     ┌─────────────────────┐           │
│  │   👂 BETA (Senses)   │     │   🧠 GAMMA (Mind)   │           │
│  │   Worker Thread     │     │   Worker Thread    │           │
│  │                     │     │                     │           │
│  │  • BeatDetector     │     │  • Mood Detection   │           │
│  │  • SpectrumAnalyzer │     │  • Palette Select   │           │
│  │  • RhythmAnalyzer   │     │  • Movement Engine  │           │
│  │  • ZeroCrossingRate │     │  • Decision Gen     │           │
│  │                     │     │  • Personality      │           │
│  │  INPUT: Float32Array│     │  INPUT: AudioAnalysis│          │
│  │  OUTPUT: AudioAnalysis    │  OUTPUT: LightingDecision       │
│  └─────────────────────┘     └─────────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 ARCHIVOS CREADOS

```
electron-app/src/main/workers/
├── index.ts              # Exports públicos
├── WorkerProtocol.ts     # Tipos y mensajes compartidos
├── senses.ts             # BETA worker (audio analysis)
├── mind.ts               # GAMMA worker (Selene brain)
└── TrinityOrchestrator.ts # ALPHA (main process coordinator)
```

### Líneas de Código

| Archivo | Líneas | Descripción |
|---------|--------|-------------|
| `WorkerProtocol.ts` | ~250 | Tipos, enums, factories |
| `senses.ts` | ~400 | Beat/Spectrum/Rhythm analysis |
| `mind.ts` | ~470 | Mood/Palette/Movement/Decision |
| `TrinityOrchestrator.ts` | ~530 | Orchestration + Phoenix |
| `index.ts` | ~45 | Exports |
| **TOTAL** | **~1695** | |

---

## 🔗 FLUJO DE DATOS

```
Audio Input (mic/file)
        │
        ▼
[ALPHA] feedAudioBuffer(Float32Array)
        │
        │ postMessage
        ▼
[BETA]  processAudioBuffer() ──────────────────┐
        │                                       │
        │ BeatDetector                         │
        │ SpectrumAnalyzer                     │
        │ RhythmAnalyzer                       │
        │                                       │
        ▼                                       │
    AudioAnalysis {                            │
      bpm, beatPhase, onBeat,                  │
      bass, mid, treble,                       │
      syncopation, groove,                     │
      energy, mood                             │
    }                                          │
        │                                       │
        │ postMessage                          │
        ▼                                       │
[ALPHA] handleWorkerMessage()                  │
        │                                       │
        │ postMessage (forward)                │
        ▼                                       │
[GAMMA] generateDecision() ◄───────────────────┘
        │
        │ Mood Detection
        │ Palette Selection
        │ Movement Selection
        │ Beauty Scoring
        │
        ▼
    LightingDecision {
      palette: { primary, secondary, accent },
      movement: { pattern, speed, range },
      effects: { strobe, fog, laser },
      confidence, beautyScore
    }
        │
        │ postMessage
        ▼
[ALPHA] processLightingDecision()
        │
        ▼
    DMX Output (USB/Serial)
```

---

## 🛡️ SISTEMAS DE PROTECCIÓN

### 1. Circuit Breaker (Adaptado del Swarm)

```typescript
enum CircuitState {
  CLOSED,     // Normal - todo funciona
  OPEN,       // Fallando - rechaza llamadas
  HALF_OPEN   // Probando recuperación
}

// Parámetros
CIRCUIT_THRESHOLD = 3        // Fallos antes de abrir
CIRCUIT_TIMEOUT = 5000ms     // Tiempo para probar half-open
CIRCUIT_HALF_OPEN_SUCCESS = 2 // Éxitos para cerrar
```

### 2. Phoenix Protocol

```typescript
// Auto-resurrección de workers caídos
config = {
  maxResurrections: 5,    // Máximo intentos
  resurrectionDelay: 500  // ms entre intentos
}

// Flujo:
// 1. Worker muere/falla
// 2. handleWorkerFailure() → Circuit breaker
// 3. Si resurrections < max → resurrectWorker()
// 4. Terminate viejo → Wait delay → Spawn nuevo
// 5. Restaurar state snapshot si existe
```

### 3. Heartbeat Monitoring

```typescript
config = {
  heartbeatInterval: 1000ms,  // Enviar cada segundo
  heartbeatTimeout: 3000ms    // Declarar muerto si no responde
}

// Flujo:
// ALPHA → HEARTBEAT (timestamp, sequence) → BETA/GAMMA
// BETA/GAMMA → HEARTBEAT_ACK (latency) → ALPHA
// Si latency > timeout → handleWorkerFailure()
```

---

## 🎨 SISTEMA DE DECISIONES (GAMMA)

### Personality System

```typescript
interface SelenePersonality {
  boldness: number;       // 0-1 Cambios dramáticos
  fluidity: number;       // 0-1 Transiciones suaves
  colorfulness: number;   // 0-1 Saturación
  symmetry: number;       // 0-1 Patrones simétricos
  responsiveness: number; // 0-1 Velocidad de reacción
  currentMood: 'energetic' | 'calm' | 'dark' | 'playful';
}
```

### Palettes Incluidas

| Nombre | Moods | Primary | Secondary | Accent |
|--------|-------|---------|-----------|--------|
| Cyberpunk | dark, energetic | Hot Pink | Cyan | Purple |
| Fire | energetic | Orange | Red | Yellow |
| Ocean | calm | Blue | Teal | Light Blue |
| Forest | calm, dark | Green | Lime | Dark Green |
| Sunset | playful | Coral | Peach | Rose |
| Monochrome | dark | White | Gray | Light Gray |
| Rainbow | playful, energetic | Red | Green | Blue |

### Movement Patterns

```typescript
type MovementPattern = 
  | 'static'    // Sin movimiento
  | 'sweep'     // Barrido horizontal
  | 'circle'    // Movimiento circular
  | 'figure8'   // Figura 8
  | 'random'    // Aleatorio
  | 'mirror'    // Espejado
  | 'chase';    // Persecución
```

---

## 📡 PROTOCOLO DE MENSAJES

### Tipos de Mensaje

```typescript
enum MessageType {
  // Lifecycle
  INIT, READY, SHUTDOWN,
  
  // Heartbeat
  HEARTBEAT, HEARTBEAT_ACK,
  
  // Health
  HEALTH_REPORT, HEALTH_REQUEST,
  
  // Data Pipeline
  AUDIO_BUFFER,        // Alpha → Beta
  AUDIO_ANALYSIS,      // Beta → Alpha → Gamma
  LIGHTING_DECISION,   // Gamma → Alpha → DMX
  
  // State (Phoenix)
  STATE_SNAPSHOT, STATE_RESTORE,
  
  // Errors
  WORKER_ERROR, WORKER_RESURRECTING,
  
  // Config
  CONFIG_UPDATE
}
```

### Prioridades

```typescript
enum MessagePriority {
  LOW = 0,      // Background tasks
  NORMAL = 1,   // Standard messages
  HIGH = 2,     // Beat events, heartbeats
  CRITICAL = 3  // Errors, shutdowns
}
```

---

## 🔧 USO BÁSICO

```typescript
import { createTrinity, getTrinity } from './workers';

// Crear e iniciar
const trinity = createTrinity({
  heartbeatInterval: 1000,
  targetFps: 60
});

await trinity.start();

// Eventos
trinity.on('ready', () => console.log('Trinity LIVE'));
trinity.on('lighting-decision', (decision) => {
  // Enviar a DMX
  dmxDriver.send(decision);
});

// Alimentar audio
function onAudioFrame(buffer: Float32Array) {
  trinity.feedAudioBuffer(buffer);
}

// Estado
const status = trinity.getStatus();
// { isRunning, uptime, nodes: { beta: {...}, gamma: {...} } }

// Parar
await trinity.stop();
```

---

## ⏳ SIGUIENTE FASE: PHASE 1 - INTEGRACIÓN

### Tareas Pendientes

1. **Compilar Workers para JS**
   - Configurar `tsconfig.json` para compilar workers
   - Resolver paths relativos en producción

2. **Integrar en main.ts de Electron**
   ```typescript
   // electron/main.ts
   import { createTrinity } from './workers';
   
   app.whenReady().then(async () => {
     const trinity = createTrinity();
     await trinity.start();
     // ...
   });
   ```

3. **Conectar Audio Input**
   - Captura de micrófono (Web Audio API en renderer)
   - IPC al main process → feedAudioBuffer()

4. **Conectar DMX Output**
   - Integrar con driver USB-DMX (Tornado, etc)
   - Mapear LightingDecision → DMX channels

5. **UI de Status**
   - Dashboard de health de workers
   - Visualizar latencias y resurrections

---

## 📊 COMPONENTES SWARM ADAPTADOS

| Swarm Original | Trinity Adaptación | Status |
|----------------|-------------------|--------|
| CircuitBreaker | TrinityOrchestrator.circuit | ✅ Integrado |
| PhoenixProtocol | resurrectWorker() | ✅ Simplificado |
| HeartbeatEngine | startHeartbeat() | ✅ Integrado |
| HarmonicConsensus | N/A | ❌ No aplica (solo 2 workers) |
| ByzantineGuardian | Circuit breaker | ⚠️ Parcial |
| QuantumImmuneSystem | Health checks | ⚠️ Parcial |

---

## 🏁 CONCLUSIÓN

La **arquitectura LUX TRINITY** está lista para:

- ✅ Ejecutar análisis de audio en paralelo (BETA)
- ✅ Generar decisiones estéticas en paralelo (GAMMA)
- ✅ Orquestar desde Main Process (ALPHA)
- ✅ Auto-recuperarse de fallos (Phoenix)
- ✅ Protegerse de cascadas de errores (Circuit Breaker)

**Próximo paso recomendado**: Compilar workers y probar integración básica.

---

*Generated by LuxSync Trinity System - Phase 0*
