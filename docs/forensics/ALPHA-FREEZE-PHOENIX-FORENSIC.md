# FORENSE: ALPHA Event-Loop Freeze → Falso Phoenix de BETA + GAMMA

**Fecha:** 2026-08-20
**Severidad:** Media (recuperación automática en ~1.5s, sin pérdida de show)
**Frecuencia:** 2 ocurrencias en días distintos (intermitente)
**Sistema:** Trinity Orchestrator — ALPHA / BETA / GAMMA

---

## 1. SÍNTOMA OBSERVADO

Durante un show en runtime, ambos workers (BETA "Senses" y GAMMA "Mind") son
declarados muertos simultáneamente y resucitados por el protocolo Phoenix:

```
[ALPHA] beta missed heartbeat (4918ms)
[ALPHA] gamma missed heartbeat (4926ms)
[ALPHA] Worker gamma exited with code 1
[ALPHA] 💀 🧠 GAMMA (Mind) died unexpectedly
[ALPHA] 🔥 PHOENIX: Resurrecting 🧠 GAMMA (Mind) (attempt 1)
[ALPHA] 🔥 PHOENIX: Resurrecting 🧠 GAMMA (Mind) (attempt 2)
[ALPHA] Worker beta exited with code 1
[ALPHA] 💀 👂 BETA (Senses) died unexpectedly
[ALPHA] 🔥 PHOENIX: Resurrecting 👂 BETA (Senses) (attempt 1)
[ALPHA] 🔥 PHOENIX: Resurrecting 👂 BETA (Senses) (attempt 2)
```

**Observaciones clave del log:**

1. **MSST sigue logueando secciones** (`verse → breakdown → chorus`) hasta
   instantes antes del "missed heartbeat" → BETA estaba vivo y procesando audio.
2. **CHOREO y TitanOrchestrator siguen emitiendo** → el pipeline de output
   no se detuvo.
3. **Los dos heartbeats fallan a 8ms de diferencia** — eso es el tiempo entre
   dos iteraciones del `for (const [nodeId, node] of this.nodes)` dentro del
   `setInterval` del heartbeat, no dos muertes independientes.
4. Tras ~1.5s el sistema recupera contexto y sigue disparando efectos con
   normalidad. El "Brain" pierde contexto temporalmente pero el show no se
   interrumpe visualmente.

---

## 2. DIAGNÓSTICO: LOS WORKERS NO MURIERON

### 2.1 Los handlers de uncaughtException NO llaman `process.exit()`

**`senses.ts` (BETA):**
```typescript
(process as NodeJS.EventEmitter).on('uncaughtException', (error: Error) => {
  console.error('[BETA] Uncaught exception:', error);
  sendMessage(MessageType.WORKER_ERROR, 'alpha',
    { nodeId: NODE_ID, error: error.message, fatal: true },
    MessagePriority.CRITICAL);
});
```

**`mind.ts` (GAMMA):** estructura idéntica.

Si un uncaughtException hubiera matado a un worker, el handler lo capturaría,
enviaría `WORKER_ERROR` a ALPHA, y **el worker seguiría vivo**. El `exit code 1`
no viene de un error fatal del worker — viene de `worker.terminate()` invocado
por el propio Phoenix.

### 2.2 Cronología real reconstruida

```
T+0      ALGO bloquea el event loop de ALPHA por ~5 segundos
         (los workers siguen vivos y procesando)
T+~5s    ALPHA despierta → el setInterval del heartbeat dispara
         Detecta lastHeartbeat stale (4918ms / 4926ms)
         → "missed heartbeat"
         → handleWorkerFailure()
         → resurrectWorker()
         → worker.terminate()  ← AQUÍ mueren los workers
T+~5s    Exit event con code 1 dispara
         → handleWorkerDeath()
         → handleWorkerFailure() OTRA VEZ  ← bug de doble resurrección
         → "attempt 1" + "attempt 2"
T+~6.5s  Workers re-spawneados, sistema recuperado
```

**Conclusión:** los workers estaban sanos. ALPHA dejó de escuchar sus
heartbeats porque su event loop estaba congelado. Al despertar, los mató
por "no responder" y los resucitó.

---

## 3. CAUSA RAÍZ: BLOQUEO DEL EVENT LOOP DE ALPHA

El candado de 4 gates (`ThermodynamicVetoEngine`) protege contra falsos
positivos de detección de secciones — **no protege contra bloqueos del event
loop**. Son sistemas ortogonales. El candado es correcto para su propósito,
pero este incidente no es un falso positivo de sección; es un freeze del
main thread.

### 3.1 Sospechosos principales: I/O síncrono en el main thread

En `IPCHandlers.ts` existen operaciones síncronas en el hot path de IPC:

- `fs.existsSync()`
- `fs.statSync()`
- `fs.readFileSync()`
- `fs.readdirSync()`
- `fs.writeFileSync()`
- `JSON.parse()` sobre payloads potencialmente grandes
- `JSON.stringify(definition, null, 2)` al guardar fixtures

Estas operaciones se ejecutan en el main thread de Electron (ALPHA). Si la UI
dispara un handler que escanea un directorio grande o lee/escribe un archivo
grande, ALPHA se congela durante esa operación.

### 3.2 Recargas en caliente identificadas por el usuario

El sistema realiza recargas en caliente que podrían disparar I/O síncrono:

1. **Apertura de Hephaestus FX** — el sistema precarga todos los efectos.
2. **Apertura de Genesis** — idem, recarga completa.
3. **Guardado de efecto en vivo durante el show** — hot reload directo al
   runtime para ver cambios al instante.

Cualquiera de estas operaciones, si toca handlers con `fs.readFileSync` o
`fs.readdirSync` sobre directorios con muchos archivos, puede congelar ALPHA
el tiempo suficiente para disparar el falso Phoenix.

### 3.3 Causa alternativa: presión de memoria del sistema

El usuario reportó estar "haciendo cosas en la compu" durante el incidente.
Si el sistema operativo entró en swap thrashing, un GC stop-the-world de V8
en ALPHA podría durar varios segundos — suficiente para disparar el timeout
de heartbeat (3000ms por defecto).

Esta hipótesis es consistente con la naturaleza intermitente del bug
(2 ocurrencias en días distintos, sin patrón claro).

### 3.4 Configuración actual del heartbeat

```typescript
// WorkerProtocol.ts
export const DEFAULT_CONFIG: TrinityConfig = {
  heartbeatInterval: 1000,   // cada 1s
  heartbeatTimeout: 3000,    // timeout a 3s
  maxResurrections: 5,
  resurrectionDelay: 500,
  ...
};
```

Un freeze de ALPHA de >3s es suficiente para disparar el timeout. Con
`heartbeatTimeout: 3000`, el margen es estrecho.

---

## 4. BUG SECUNDARIO: DOBLE RESURRECCIÓN

### 4.1 Flujo defectuoso

```
heartbeat timeout
  → handleWorkerFailure()
    → resurrectWorker()
      → worker.terminate()
        → exit event (code 1)
          → handleWorkerDeath()
            → handleWorkerFailure()  ← SEGUNDA LLAMADA
              → resurrectWorker()    ← SEGUNDA RESURRECCIÓN
```

### 4.2 Código afectado

**`TrinityOrchestrator.ts`:**

```typescript
private handleWorkerFailure(nodeId: NodeId, _reason: string): void {
  const node = this.nodes.get(nodeId);
  if (!node) return;
  if (nodeId === 'alpha') return;

  node.circuit.failures++;
  node.circuit.lastFailure = Date.now();

  if (node.circuit.failures >= CIRCUIT_THRESHOLD) {
    node.circuit.state = CircuitState.OPEN;
  }

  // ❌ No hay guard contra doble resurrección
  if (node.resurrections < this.config.maxResurrections) {
    this.resurrectWorker(nodeId as 'beta' | 'gamma');
  }
}

private handleWorkerDeath(nodeId: NodeId): void {
  const node = this.nodes.get(nodeId);
  if (!node) return;
  console.log(`[ALPHA] 💀 ${NODE_NAMES[nodeId]} died unexpectedly`);
  node.worker = null;
  node.isReady = false;
  this.handleWorkerFailure(nodeId, 'Unexpected death');  // ← re-entra
}
```

No existe flag `isResurrecting` en `WorkerNode` que prevenga la segunda
llamada. Por eso se ven "attempt 1" y "attempt 2" para cada worker.

### 4.3 `WorkerNode` actual (sin guard)

```typescript
interface WorkerNode {
  id: NodeId;
  worker: Worker | null;
  health: WorkerHealth | null;
  circuit: CircuitBreaker;
  resurrections: number;
  lastHeartbeat: number;
  lastHeartbeatLatency: number;
  heartbeatSequence: number;
  isReady: boolean;
  stateSnapshot: unknown;
  // ❌ falta: isResurrecting: boolean
}
```

---

## 5. CONFIGURACIÓN DE WORKERS: AUSENCIA DE `resourceLimits`

**`TrinityOrchestrator.ts`:**

```typescript
const worker = new Worker(workerPath, {
  workerData: {
    config: this.config,
    ...(nodeId === 'beta' && this.sharedAudioBuffer
      ? { sharedAudioBuffer: this.sharedAudioBuffer }
      : {})
  }
  // ❌ Sin resourceLimits
});
```

No se especifican `resourceLimits` (heap size, stack size, etc.). Los workers
heredan los límites por defecto de Node.js, que pueden ser generosos. BETA
(FFT + ring buffers + MSST con ventanas de 1800 frames) es el candidato más
propenso a presión de memoria.

---

## 6. IMPACTO

| Aspecto | Impacto |
|---|---|
| Show visual | No interrumpido (DMX sigue saliendo) |
| Detección de secciones | Pausada ~1.5s durante el freeze |
| Brain (GAMMA) | Pierde contexto temporalmente |
| Efectos | Siguen disparándose con última decisión |
| Recurrencia | Intermitente, sin patrón claro |
| Riesgo real | Si ocurre en un momento crítico (drop), la detección se pierde |

---

## 7. RECOMENDACIONES PARA EL ARQUITECTO

### 7.1 P0 — Guard de doble resurrección

Añadir flag `isResurrecting: boolean` a `WorkerNode`. En `handleWorkerFailure`,
verificar y setear el flag antes de llamar `resurrectWorker()`. Limpiar el
flag cuando la resurrección complete (éxito o fallo).

### 7.2 P0 — Eliminar I/O síncrono del main thread

Reemplazar en `IPCHandlers.ts`:
- `fs.readFileSync` → `fs.promises.readFile`
- `fs.readdirSync` → `fs.promises.readdir`
- `fs.writeFileSync` → `fs.promises.writeFile`
- `fs.existsSync` → `fs.promises.access` (o mantener con try/catch si es no-bloqueante en la práctica)
- `fs.statSync` → `fs.promises.stat`

Especial atención a los handlers disparados por:
- Apertura de Hephaestus FX (precarga de efectos)
- Apertura de Genesis (recarga completa)
- Guardado de efecto en vivo (hot reload)

### 7.3 P1 — `resourceLimits` explícitos en workers

```typescript
const worker = new Worker(workerPath, {
  workerData: { ... },
  resourceLimits: {
    maxOldGenerationSizeMb: 256,   // BETA: FFT + ring buffers + MSST
    maxYoungGenerationSizeMb: 32,
    stackSizeMb: 8,
  }
});
```

BETA y GAMMA pueden tener perfiles distintos. BETA necesita más heap por
los buffers de FFT y las ventanas de MSST (1800 frames × 4 bandas × 4 bytes).

### 7.4 P1 — Distinguir "heartbeat timeout" de "exit code 1"

Actualmente `handleWorkerFailure` trata ambos igual: termina el worker y
resucita. Para un heartbeat timeout donde el worker sigue vivo:

**Opción A (conservadora):** enviar `HEALTH_REQUEST` antes de terminar. Si
responde, resetear `lastHeartbeat` y no terminar.

**Opción B (simple):** aumentar `heartbeatTimeout` a 5000ms o 6000ms para
tolerar GC pauses y micro-freezes del main thread.

**Opción C (robusta):** separar el path de "timeout" del path de "exit".
Un timeout no debería matar al worker — solo marcarlo como degradado y
esperar recuperación.

### 7.5 P2 — Telemetría de event-loop lag

Instrumentar ALPHA con un watchdog que mida el lag real del event loop:

```typescript
let lastTick = Date.now();
setInterval(() => {
  const now = Date.now();
  const lag = now - lastTick - 100;  // esperado ~100ms
  if (lag > 500) {
    console.warn(`[ALPHA] Event loop lag: ${lag}ms`);
  }
  lastTick = now;
}, 100);
```

Esto permitiría correlacionar freezes del event loop con los falsos Phoenix
y confirmar la hipótesis del I/O síncrono.

### 7.6 P2 — Audit completo de hot reload

Mapear todos los paths de hot reload (Hephaestus, Genesis, guardado en vivo)
y verificar cuáles tocan I/O síncrono en el main thread. Los que lo hagan,
moverlos a un worker pool o usar `fs.promises`.

---

## 8. NOTA SOBRE EL CANDADO DE 4 GATES

El `ThermodynamicVetoEngine` (6 gates en realidad: Silence, Climax,
Textural Drop, Buildup, Breakdown, Verse Upgrade) funciona correctamente
para su propósito: validar hipótesis de sección contra evidencia acústica.

**Este incidente no es un fallo del candado.** El candado opera sobre la
decisión de sección, no sobre la salud del event loop. El freeze de ALPHA
es un problema de infraestructura (I/O síncrono / GC pressure), no de
lógica de detección.

No se recomienda modificar el candado para este issue.

---

## 9. RESUMEN EJECUTIVO

- **Qué pasó:** ALPHA se congeló ~5s (I/O síncrono o GC pressure), los
  workers seguían vivos, pero ALPHA los declaró muertos por heartbeat
  timeout y los terminó.
- **Por qué se duplicó:** bug de doble resurrección (sin flag
  `isResurrecting`).
- **Impacto:** show no interrumpido, detección pausada ~1.5s.
- **Causa raíz probable:** `fs.readFileSync` / `fs.readdirSync` /
  `fs.writeFileSync` en `IPCHandlers.ts` disparados por recargas en caliente
  (Hephaestus, Genesis, guardado en vivo).
- **Causa alternativa:** presión de memoria del sistema → GC stop-the-world.
- **Fix mínimo:** guard de doble resurrección + eliminar I/O síncrono del
  main thread.
- **Fix robusto:** + `resourceLimits` + separar path de timeout de path de
  exit + telemetría de event-loop lag.

---

*Generado por análisis forense de logs de runtime — 2026-08-20*
