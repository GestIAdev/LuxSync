# 🐝 AUDITORÍA DE ARQUITECTURA SWARM
## Componentes Adaptables para LuxSync Trinity (Worker Threads)

**Fecha**: 4 Diciembre 2025  
**Auditor**: Opus  
**Objetivo**: Identificar y adaptar componentes del SeleneNuclearSwarm para arquitectura de 3 Worker Threads (Alpha, Beta, Gamma)

---

## 📋 RESUMEN EJECUTIVO

El SeleneNuclearSwarm es un **arsenal nuclear de código distribuido** diseñado para clusters de múltiples nodos con comunicación Redis/TCP. Sin embargo, contiene **lógica pura reutilizable** que puede portarse a Worker Threads con comunicación via `postMessage`.

### Veredicto: 🟢 ALTAMENTE REUTILIZABLE

| Componente | Dependencia Red | Lógica Pura | Prioridad Porteo |
|------------|-----------------|-------------|------------------|
| HarmonicConsensusEngine | Alta (Redis) | ⭐⭐⭐⭐⭐ | 🔴 CRÍTICO |
| PhoenixProtocol | Media (FS) | ⭐⭐⭐⭐ | 🟡 ALTO |
| ByzantineGuardian | Baja | ⭐⭐⭐⭐⭐ | 🟢 INMEDIATO |
| HeartbeatEngine | Alta (Redis) | ⭐⭐⭐⭐ | 🟡 ALTO |
| CircuitBreaker | Ninguna | ⭐⭐⭐⭐⭐ | 🟢 INMEDIATO |
| HealthOracle | Media | ⭐⭐⭐⭐ | 🟡 ALTO |
| QuantumImmuneSystem | Baja | ⭐⭐⭐⭐⭐ | 🟢 INMEDIATO |

---

## 🎵 1. HARMONIC CONSENSUS ENGINE

### Ubicación
`src/engines/selene/swarm/coordinator/HarmonicConsensusEngine.ts` (1182 líneas)

### Descripción
Sistema de votación democrática basado en **7 notas musicales** (Do-Re-Mi-Fa-Sol-La-Si). Implementa consenso distribuido con:

- **Quorum Protection**: Requiere >50% de votos para decisiones válidas
- **Split-Brain Prevention**: Modo read-only cuando no hay quorum
- **Veritas Authentication**: Firma criptográfica de votos
- **Beauty Factor**: Puntuación estética de nodos (¡perfecto para paletas!)

### Código Clave Reutilizable

```typescript
// ALGORITMO DE VOTACIÓN MUSICAL
interface ConsensusResult {
  leader_node_id: string;
  dominant_note: MusicalNote;      // Do, Re, Mi, Fa, Sol, La, Si
  harmonic_score: number;          // 0.0-1.0
  chord_stability: number;         // Estabilidad del acorde
  quorum_achieved: boolean;
  votes_received: number;
  read_only_mode: boolean;         // Split-brain protection
}

// SELECCIÓN DE LÍDER POR SALUD + BELLEZA
const selectLeader = (nodes) => {
  return nodes.reduce((best, current) => {
    const healthScore = calculateHealth(current);     // 70% peso
    const beautyFactor = calculateBeauty(current);    // 30% peso
    const finalScore = healthScore * 0.7 + beautyFactor * 0.3;
    return finalScore > best.score ? current : best;
  });
};
```

### Adaptación para LuxSync Trinity

**CASO DE USO**: Decidir qué Worker genera la paleta final cuando hay conflicto.

```typescript
// ANTES (Redis distributed)
const result = await consensusEngine.determineLeader();

// DESPUÉS (Worker Threads)
class WorkerConsensus {
  private votes: Map<WorkerId, PaletteVote> = new Map();
  
  // Cada Worker vota por su paleta candidata
  receiveVote(workerId: 'alpha' | 'beta' | 'gamma', vote: PaletteVote) {
    this.votes.set(workerId, vote);
    
    // Con 2 de 3 votos = quorum
    if (this.votes.size >= 2) {
      return this.calculateMusicalConsensus();
    }
  }
  
  // Algoritmo de 7 notas adaptado
  calculateMusicalConsensus(): PaletteDecision {
    const candidates = Array.from(this.votes.values());
    
    // Seleccionar por harmonic_score (beautyScore de paleta)
    return candidates.reduce((best, current) => 
      current.beautyScore > best.beautyScore ? current : best
    );
  }
}
```

### Dependencias a Eliminar
- ❌ `Redis` - Reemplazar con `postMessage`
- ❌ `UnifiedCommunicationProtocol` - Reemplazar con MessageChannel
- ✅ `SystemVitals` - Mantener (métricas locales)
- ✅ `VeritasInterface` - Mantener (firmas opcionales)

---

## 🔥 2. PHOENIX PROTOCOL

### Ubicación
`src/engines/selene/swarm/coordinator/PhoenixProtocol.ts` (1609 líneas)

### Descripción
Sistema de **resurrección automática** con:

- **Snapshots Periódicos**: Cada 30 minutos (configurable)
- **Heap Anchoring Prevention**: Limpieza de memoria para evitar leaks
- **Recovery Operations**: Restauración de estado, rollback, resurrección completa
- **Failure Scenarios**: Detección de crash, partition, corruption, byzantine attack

### Código Clave Reutilizable

```typescript
// TIPOS DE SNAPSHOT
interface PhoenixSnapshot {
  snapshot_id: string;
  timestamp: number;
  swarm_state: SwarmState;
  consensus_state: ConsensusState;
  health_state: HealthState;
  integrity_hash: string;
  recovery_priority: number;
}

// ESCENARIOS DE FALLO
type FailureType = 
  | 'node_crash'           // Worker murió
  | 'network_partition'    // Comunicación rota
  | 'consensus_failure'    // No hay acuerdo
  | 'data_corruption'      // Estado corrupto
  | 'cascading_failure';   // Efecto dominó

// PLAN DE RESURRECCIÓN
interface ResurrectionPlan {
  plan_id: string;
  failure_scenario: FailureScenario;
  recovery_steps: RecoveryStep[];
  estimated_total_time: number;
  success_probability: number;
}
```

### Adaptación para Worker Threads

```typescript
// PHOENIX PARA WORKERS
class WorkerPhoenix {
  private snapshots: Map<WorkerId, WorkerSnapshot> = new Map();
  
  // Capturar estado antes de operaciones críticas
  async captureSnapshot(workerId: WorkerId): Promise<WorkerSnapshot> {
    const worker = this.workers.get(workerId);
    
    return {
      id: `phoenix-${Date.now()}`,
      workerId,
      state: await this.requestWorkerState(worker),
      timestamp: Date.now()
    };
  }
  
  // Resucitar Worker caído
  async resurrectWorker(workerId: WorkerId): Promise<void> {
    const lastSnapshot = this.snapshots.get(workerId);
    
    // 1. Terminar Worker zombie
    await this.terminateWorker(workerId);
    
    // 2. Crear nuevo Worker
    const newWorker = new Worker('./worker.js');
    
    // 3. Restaurar estado desde snapshot
    newWorker.postMessage({
      type: 'RESTORE_STATE',
      payload: lastSnapshot.state
    });
    
    // 4. Registrar resurrección
    this.emit('worker_resurrected', { workerId, fromSnapshot: lastSnapshot.id });
  }
  
  // Detectar Worker congelado (útil para audio analysis)
  detectFrozenWorker(workerId: WorkerId, maxSilence: number = 5000): boolean {
    const lastHeartbeat = this.heartbeats.get(workerId);
    return Date.now() - lastHeartbeat > maxSilence;
  }
}
```

### Dependencias a Eliminar
- ❌ `fs` (snapshots a disco) - Reemplazar con IPC al Main process
- ❌ `v8.getHeapStatistics()` - Mantener en Main process
- ✅ Lógica de recovery - 100% reutilizable

---

## 🛡️ 3. BYZANTINE GUARDIAN

### Ubicación
`src/engines/selene/swarm/coordinator/ByzantineGuardian.ts` (507 líneas)

### Descripción
**Detector de comportamiento malicioso** con:

- **Trust Metrics**: Puntuación de confianza por nodo
- **Attack Detection**: Vote manipulation, timing attacks, spam
- **Quarantine System**: Aislamiento de nodos sospechosos
- **Trust Decay**: La confianza decae con el tiempo (0.99 por ciclo)

### Código Clave 100% Reutilizable

```typescript
// NIVELES DE AMENAZA
enum ThreatLevel {
  UNKNOWN = "unknown",       // Nuevo, sin historial
  TRUSTED = "trusted",       // Confiable
  SUSPICIOUS = "suspicious", // Comportamiento raro
  COMPROMISED = "compromised", // Claramente malicioso
  QUARANTINED = "quarantined"  // Aislado
}

// TIPOS DE ATAQUE
enum ByzantineAttackType {
  VOTE_MANIPULATION = "vote_manipulation",     // Votos inconsistentes
  TIMING_ATTACK = "timing_attack",             // Delays estratégicos
  SPLIT_BRAIN = "split_brain",                 // Explota particiones
  SPAM_PROPOSALS = "spam_proposals",           // Flood de requests
  CONSENSUS_DISRUPTION = "consensus_disruption" // Sabotaje sistemático
}

// MÉTRICAS DE CONFIANZA
interface DetailedTrustMetrics {
  nodeId: string;
  overallTrust: number;           // 0.0 - 1.0
  reliabilityScore: number;       // Consistencia
  participationScore: number;     // Engagement
  byzantineRisk: number;          // Probabilidad de ser malicioso
  history: {
    votesParticipated: number;
    agreementRate: number;        // % coincide con mayoría
    responseTime: number;         // Velocidad de respuesta
    flipFlops: number;            // Cambios de opinión
    suspiciousPatterns: ByzantineAttackType[];
  };
}
```

### Adaptación para Audio Analysis Frozen

```typescript
// DETECTOR DE WORKER CONGELADO
class WorkerHealthGuard {
  private trustMetrics: Map<WorkerId, TrustMetrics> = new Map();
  
  // Detectar si el análisis de audio se congeló
  detectAudioFreeze(workerId: 'alpha'): boolean {
    const metrics = this.trustMetrics.get(workerId);
    
    // Si no hay BPM updates en 5 segundos = congelado
    if (metrics.lastBpmUpdate < Date.now() - 5000) {
      this.raiseAlert({
        workerId,
        type: ByzantineAttackType.TIMING_ATTACK, // Reusamos el tipo
        message: 'Audio analysis frozen - no BPM updates'
      });
      return true;
    }
    
    // Si BPM siempre es 0 = comportamiento sospechoso
    if (metrics.bpmHistory.every(bpm => bpm === 0)) {
      this.markSuspicious(workerId);
      return true;
    }
    
    return false;
  }
  
  // Trust decay - la confianza decae si no hay actividad
  applyTrustDecay(): void {
    for (const [id, metrics] of this.trustMetrics) {
      metrics.overallTrust *= 0.99; // Decay rate
      
      if (metrics.overallTrust < 0.3) {
        this.markSuspicious(id);
      }
    }
  }
}
```

### Dependencias a Eliminar
- ✅ **NINGUNA** - 100% lógica pura
- Solo usa `EventEmitter` (disponible en Workers)

---

## 💗 4. HEARTBEAT ENGINE

### Ubicación
`src/engines/selene/swarm/coordinator/HeartbeatEngine.ts` (532 líneas)

### Descripción
**Motor de latido** con patrones rítmicos musicales:

- **Rhythm Patterns**: STEADY, ACCELERANDO, RALLENTANDO, STACCATO, LEGATO
- **Synchronization**: Sincronización entre nodos
- **Dynamic Interval**: Heartbeat de 7 segundos (configurable según GENESIS_CONSTANTS)

### Código Clave

```typescript
// PATRONES RÍTMICOS
const RHYTHM_PATTERNS = {
  STEADY: "steady",           // Ritmo constante
  ACCELERANDO: "accelerando", // Acelerando
  RALLENTANDO: "rallentando", // Desacelerando
  STACCATO: "staccato",       // Pulsos cortos
  LEGATO: "legato"            // Pulsos conectados
} as const;

// SINCRONIZACIÓN ENTRE CORAZONES
async synchronize(otherPulse: HeartbeatEngine): Promise<void> {
  const targetRhythm = (this._rhythm + otherPulse.rhythm) / 2;
  const rhythmDifference = Math.abs(this._rhythm - targetRhythm);
  
  // Ajuste gradual (10% por ciclo)
  if (rhythmDifference > 100) {
    this._rhythm += (targetRhythm - this._rhythm) * 0.1;
  } else {
    this._rhythm = targetRhythm;
  }
}
```

### Adaptación para Worker Threads

```typescript
// HEARTBEAT SIMPLIFICADO PARA WORKERS
class WorkerHeartbeat {
  private rhythm: number = 1000; // 1 segundo default
  private lastBeats: Map<WorkerId, number> = new Map();
  
  // Registrar latido de Worker
  registerBeat(workerId: WorkerId): void {
    this.lastBeats.set(workerId, Date.now());
  }
  
  // Verificar si Worker está vivo
  isAlive(workerId: WorkerId): boolean {
    const lastBeat = this.lastBeats.get(workerId) || 0;
    return Date.now() - lastBeat < this.rhythm * 3; // 3 latidos de gracia
  }
  
  // Detectar Workers muertos
  getDeadWorkers(): WorkerId[] {
    return Array.from(this.lastBeats.entries())
      .filter(([_, time]) => Date.now() - time > this.rhythm * 3)
      .map(([id, _]) => id);
  }
}
```

### Dependencias a Eliminar
- ❌ `Redis` - Reemplazar con `postMessage`
- ❌ `RedisOptimizer` - No necesario
- ✅ `EventEmitter` - Mantener
- ✅ `SystemVitals` - Mantener

---

## ⚡ 5. CIRCUIT BREAKER

### Ubicación
`src/engines/selene/swarm/core/CircuitBreaker.ts` (342 líneas)

### Descripción
**Patrón Circuit Breaker** con:

- **Estados**: CLOSED (normal) → OPEN (fallando) → HALF_OPEN (probando)
- **Exponential Backoff**: 30s → 60s → 120s → 300s (max)
- **Auto-Recovery**: Prueba automática de recuperación

### Código 100% Reutilizable

```typescript
enum CircuitBreakerState {
  CLOSED = "CLOSED",       // Operación normal
  OPEN = "OPEN",           // Rechaza requests
  HALF_OPEN = "HALF_OPEN"  // Probando recovery
}

interface CircuitBreakerConfig {
  failureThreshold: number;    // Fallos para abrir (default: 5)
  recoveryTimeout: number;     // Tiempo antes de retry (default: 30s)
  successThreshold: number;    // Éxitos para cerrar (default: 3)
  timeout: number;             // Timeout por request (default: 15s)
}

// EXPONENTIAL BACKOFF
private shouldAttemptRecovery(): boolean {
  const timeSinceLastFailure = Date.now() - this.metrics.lastFailureTime;
  
  // Backoff doubles each time
  this.currentBackoffTime = Math.min(
    this.currentBackoffTime * 2,
    300000  // Max 5 minutes
  );
  
  return timeSinceLastFailure >= this.currentBackoffTime;
}
```

### Uso en Worker Threads

```typescript
// PROTEGER LLAMADAS A WORKERS
const audioBreaker = new CircuitBreaker('audio-worker', {
  failureThreshold: 3,
  recoveryTimeout: 5000,
  timeout: 2000
});

async function getAudioMetrics(): Promise<AudioMetrics> {
  return audioBreaker.execute(async () => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject('Timeout'), 2000);
      
      worker.postMessage({ type: 'GET_METRICS' });
      worker.once('message', (msg) => {
        clearTimeout(timeout);
        resolve(msg.payload);
      });
    });
  });
}
```

### Dependencias a Eliminar
- ✅ **NINGUNA** - 100% lógica pura

---

## 🛡️ 6. QUANTUM IMMUNE SYSTEM

### Ubicación
`src/engines/selene/swarm/coordinator/QuantumImmuneSystem.ts` (1166 líneas)

### Descripción
**Sistema inmune adaptativo** con:

- **Threat Signatures**: Patrones de amenazas conocidas
- **Immune Memory**: Recuerda amenazas pasadas
- **Quarantine Zones**: Aislamiento de entidades sospechosas
- **Adaptive Defenses**: Defensas que aprenden y evolucionan

### Código Clave Reutilizable

```typescript
// FIRMAS DE AMENAZAS
interface ThreatSignature {
  signature_id: string;
  threat_pattern: string;
  severity_level: "low" | "medium" | "high" | "critical";
  detection_confidence: number;
  mutation_resistance: number;  // Resistencia a mutaciones
}

// ZONA DE CUARENTENA
interface QuarantineZone {
  zone_id: string;
  isolated_entities: IsolatedEntity[];
  containment_level: "observation" | "isolation" | "complete_quarantine";
  auto_release_time: number | null;  // Release automático
}

// DEFENSA ADAPTATIVA
interface AdaptiveDefense {
  defense_id: string;
  target_threat_types: string[];
  learning_capability: LearningCapability;
  current_effectiveness: number;  // Se mejora con el tiempo
}
```

### Adaptación para Worker Health

```typescript
// SISTEMA INMUNE SIMPLIFICADO PARA WORKERS
class WorkerImmuneSystem {
  private threatMemory: Map<string, ThreatSignature> = new Map();
  private quarantine: Set<WorkerId> = new Set();
  
  // Detectar patrón de amenaza
  detectThreat(workerId: WorkerId, metrics: WorkerMetrics): ThreatSignature | null {
    // Memory leak detection
    if (metrics.memoryUsage > 0.9) {
      return {
        signature_id: 'memory_leak',
        threat_pattern: 'excessive_memory',
        severity_level: 'high',
        detection_confidence: 0.95
      };
    }
    
    // CPU burn detection
    if (metrics.cpuUsage > 0.95 && metrics.outputRate < 0.1) {
      return {
        signature_id: 'cpu_burn',
        threat_pattern: 'high_cpu_low_output',
        severity_level: 'critical',
        detection_confidence: 0.9
      };
    }
    
    return null;
  }
  
  // Poner en cuarentena
  quarantineWorker(workerId: WorkerId): void {
    this.quarantine.add(workerId);
    // Reducir prioridad de mensajes de este Worker
  }
}
```

---

## 🏗️ PROPUESTA DE ARQUITECTURA: LUX TRINITY

### Comunicación via postMessage (Reemplaza Redis/TCP)

```typescript
// PROTOCOLO DE MENSAJES UNIFICADO
interface WorkerMessage {
  id: string;
  type: MessageType;
  source: 'main' | 'alpha' | 'beta' | 'gamma';
  target: 'main' | 'alpha' | 'beta' | 'gamma' | 'broadcast';
  timestamp: number;
  payload: any;
  priority: 'low' | 'normal' | 'high' | 'critical';
}

enum MessageType {
  // Heartbeat
  HEARTBEAT = 'heartbeat',
  HEARTBEAT_ACK = 'heartbeat_ack',
  
  // Consensus
  VOTE_REQUEST = 'vote_request',
  VOTE_RESPONSE = 'vote_response',
  CONSENSUS_RESULT = 'consensus_result',
  
  // State
  STATE_SNAPSHOT = 'state_snapshot',
  STATE_RESTORE = 'state_restore',
  
  // Health
  HEALTH_REPORT = 'health_report',
  QUARANTINE = 'quarantine',
  
  // Phoenix
  WORKER_DIED = 'worker_died',
  WORKER_RESURRECTED = 'worker_resurrected'
}
```

### Orquestador Principal (Main Process)

```typescript
// TRINITY ORCHESTRATOR
class TrinityOrchestrator {
  // Componentes adaptados del Swarm
  private consensus: WorkerConsensus;      // De HarmonicConsensusEngine
  private phoenix: WorkerPhoenix;          // De PhoenixProtocol
  private guardian: WorkerHealthGuard;     // De ByzantineGuardian
  private heartbeat: WorkerHeartbeat;      // De HeartbeatEngine
  private immune: WorkerImmuneSystem;      // De QuantumImmuneSystem
  
  // Circuit Breakers por Worker
  private breakers: Map<WorkerId, CircuitBreaker>;
  
  // Workers
  private workers: Map<WorkerId, Worker> = new Map();
  
  constructor() {
    this.initializeWorkers();
    this.setupMessageHandlers();
    this.startHeartbeatLoop();
    this.startHealthMonitoring();
  }
  
  private startHeartbeatLoop(): void {
    setInterval(() => {
      // Enviar heartbeat a todos los Workers
      this.broadcast({ type: MessageType.HEARTBEAT });
      
      // Verificar Workers muertos
      const dead = this.heartbeat.getDeadWorkers();
      for (const workerId of dead) {
        this.phoenix.resurrectWorker(workerId);
      }
    }, 1000); // 1 segundo
  }
}
```

---

## 📊 MATRIZ DE PRIORIDADES DE PORTEO

### Fase 1: Inmediato (Sin dependencias de red)

| Componente | Líneas | Esfuerzo | Valor |
|------------|--------|----------|-------|
| CircuitBreaker | 342 | Bajo | ⭐⭐⭐⭐⭐ |
| ByzantineGuardian | 507 | Medio | ⭐⭐⭐⭐⭐ |
| TrustMetrics | ~100 | Bajo | ⭐⭐⭐⭐ |

### Fase 2: Adaptar comunicación

| Componente | Líneas | Cambios Necesarios |
|------------|--------|-------------------|
| HeartbeatEngine | 532 | Redis → postMessage |
| HarmonicConsensus | 1182 | Redis → postMessage, simplificar |
| HealthOracle | 990 | Extraer métricas locales |

### Fase 3: Resurrección

| Componente | Líneas | Cambios Necesarios |
|------------|--------|-------------------|
| PhoenixProtocol | 1609 | FS → IPC, simplificar snapshots |
| QuantumImmuneSystem | 1166 | Adaptar a Worker context |

---

## 🎯 RECOMENDACIONES FINALES

### 1. **Empezar por CircuitBreaker + ByzantineGuardian**
Son 100% lógica pura, sin dependencias. Copiar y usar directamente.

### 2. **Crear WorkerMessageProtocol**
Reemplazar Redis pub/sub con un protocolo basado en `postMessage`:

```typescript
// En Main Process
worker.postMessage(message);

// En Worker
self.onmessage = (e) => handleMessage(e.data);
self.postMessage(response);
```

### 3. **Simplificar HarmonicConsensus**
Con solo 3 Workers, el consenso es trivial:
- 2 de 3 votos = quorum
- No necesitas 7 notas musicales (pero puedes mantenerlo por estética 🎵)

### 4. **PhoenixProtocol Lite**
Para Workers, los snapshots pueden ser más simples:
- Guardar en memoria del Main Process
- No necesitas persistencia a disco (el Main Process sobrevive)

### 5. **Heartbeat cada 1 segundo**
En vez de 7 segundos dinámicos:
- Workers más rápidos de detectar
- Overhead mínimo con postMessage

---

## 📝 CONCLUSIÓN

El SeleneNuclearSwarm es **oro puro** para LuxSync. La lógica de:
- **Consenso musical** → Decidir paletas
- **Trust metrics** → Detectar Workers congelados
- **Circuit breakers** → Proteger contra cascadas
- **Phoenix resurrection** → Auto-healing

...es 100% aplicable a Worker Threads. Solo hay que **reemplazar Redis por postMessage**.

**Estimación de trabajo**: 2-3 días para portar los componentes esenciales.

---

*"What is dead may never die, but rises again, harder and stronger"*  
— Phoenix Protocol Manifesto

