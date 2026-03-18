# WAVE-2143 — SPAGHETTI ARCHITECTURE AUDIT
## BPM Data Flow: Lo Que Decía el Audit vs Lo Que Hace el Código Ahora

**Fecha:** 2025  
**Status:** DIAGNÓSTICO — Sin cambios en el código  
**Audiencia:** Radwulf + PunkOpus — decisión arquitectónica pendiente

---

## 1. LO QUE DECÍA EL SENSORY-LAYER-AUDIT (Era WAVE 2090.2)

```
Audio Hardware
     │
     ▼
Web Audio API (Main Thread)
     │  FFT Buffer
     ▼
Worker BETA (senses.ts)
  └─ analyzeSpectrum() → rawBassEnergy, bands, etc.
  └─ Sends AUDIO_ANALYSIS → ALPHA → TitanOrchestrator
           │
           │  rawBassEnergy, kickDetected (heurística)
           ▼
Main Thread — TitanOrchestrator.processFrame()
  └─ BeatDetector.process(rawBassEnergy, timestamp)
       ├─ Kick detection (ratio threshold)
       ├─ IOI interval collection
       ├─ Cluster analysis → dominant BPM
       ├─ Hysteresis (HYSTERESIS_FRAMES=30)
       ├─ PLL flywheel (phase lock)
       └─ Returns: { bpm, onBeat, beatPhase, pllPhase, pllLocked }
                       │
                       ▼
               context.bpm = beatState.bpm  ← AUTORIDAD ÚNICA
               context.beatPhase = beatState.pllPhase ?? beatState.phase
```

**BeatDetector era el ÚNICO motor BPM. Vivía en el Main Thread. Era el rey.**

---

## 2. LO QUE HACE EL CÓDIGO AHORA (Realidad 2025)

```
Audio Hardware
     │
     ▼
Web Audio API (Main Thread)
     │  Float32Array buffer (~21ms / frame)
     ▼
Worker BETA (senses.ts)
  └─ analyzeSpectrum() → rawSubBassEnergy, rawBassOnlyEnergy, bands, kickDetected
  │
  ├─ WAVE 2133: Spectral Flux
  │    deltaLows = max(0, currentLows - prevLows)
  │    deltaMids = max(0, currentMids - prevMids)
  │
  ├─ WAVE 2142: Bass Gate (Snare Killer)
  │    rhythmicPunch = deltaLows >= 0.015
  │                    ? deltaLows + deltaMids×0.20
  │                    : 0
  │
  └─ PacemakerV2.process(kickDetected, rhythmicPunch, deterministicTimestampMs)
       ├─ detectAdaptiveOnset()  ← P99 ceiling, energía adaptativa
       ├─ Interval collection (IOI)
       ├─ clusterIntervals() ±15ms tolerance
       ├─ WAVE 2140: Confidence Bleed (stableConf×0.95 si BPM diverge)
       ├─ WAVE 2141: Adaptive Debounce 80% (shield = expectedInterval×0.80)
       └─ Returns: { bpm, confidence, beatPhase, kickDetected, kickCount }
                         │
                         ▼
               AudioMetrics (state.currentBpm / bpmConfidence / beatPhase)
                         │
                         ▼
             AUDIO_ANALYSIS message → ALPHA → TitanOrchestrator

═══════════════════════════════════════════════════════════════════

Main Thread — TitanOrchestrator.lastAudioData
  workerBpm            ← bpm del Worker (sólo acepta > 0)
  workerBpmConfidence  ← confidence del Worker (sólo acepta > 0)
  workerOnBeat         ← kickDetected || spectrum.kickDetected
  workerBeatPhase      ← beatPhase del Worker
  workerBeatStrength   ← beatStrength del Worker
                         │
                         ▼
Main Thread — TitanOrchestrator.processFrame()

  ┌──────────────────────────────────────────────────┐
  │  ❌ ZOMBIE VIVO: BeatDetector                    │
  │                                                  │
  │  if (workerBpm > 0 && workerConfidence > 0.2):   │
  │    beatDetector.setBpm(workerBpm)  ← sync PLL    │
  │  beatState = beatDetector.tick()   ← PLL avanza  │
  │  if (workerOnBeat):                              │
  │    beatState.onBeat = true         ← override    │
  │    beatState.kickDetected = true   ← override    │
  └──────────────────────────────────────────────────┘
                         │
                         ▼
           DECISIÓN BPM:
             if workerBpm > 0 && workerConfidence > 0.2
               → context.bpm = workerBpm          ← PacemakerV2 GANA
             else
               → context.bpm = beatState.bpm      ← PLL freewheel fallback

           DECISIÓN PHASE (⚠️ TRES FUENTES):
             if pllLocked
               → context.beatPhase = beatState.pllPhase  ← BeatDetector PLL
             else
               → context.beatPhase = workerBeatPhase     ← PacemakerV2
             (beatState.phase existe como tercer fallback)

                         │
                         ▼
               Downstream: TitanEngine, Chromatic, Selene...
```

---

## 3. EL MAPA DEL SPAGHETTI — Código Zombie y Conflictos

### 🧟 ZOMBIE #1: BeatDetector.process() — 600+ líneas nunca llamadas

`BeatDetector.ts` tiene **1022 líneas**. Aproximadamente **600 son código muerto**:

| Método | Línea | Estado |
|--------|-------|--------|
| `process()` | 356 | ❌ NUNCA llamado desde TitanOrchestrator |
| `updateBpmWithPacemaker()` | ~450 | ❌ Solo llamado por `process()` |
| `clusterIntervals()` | ~600 | ❌ Solo llamado por `updateBpmWithPacemaker()` |
| `findDominantCluster()` | ~680 | ❌ Solo llamado por `clusterIntervals()` |
| `isOctaveJump()` | ~750 | ❌ Solo llamado internamente |
| `calculateConfidence()` | ~800 | ❌ Solo llamado internamente |
| `setBpm()` | 932 | ✅ Llamado por processFrame() |
| `tick()` | 555 | ✅ Llamado por processFrame() |

**La trampa:** `process()` internamente llama `this.tick()`. Si alguien accidentalmente llama `process()` en el futuro, el PLL tarda **doble**. Bug en potencia.

### 🧟 ZOMBIE #2: SET_BPM — El Mensajero Sin Receptor

```typescript
// WorkerProtocol.ts
SET_BPM = 'set_bpm'  // ← Existe

// TrinityOrchestrator.ts
setBpm(bpm: number): void {
  this.sendToWorker('beta', MessageType.SET_BPM, { bpm }, ...)  // ← Existe
}

// senses.ts
case MessageType.SET_BPM:
  // 🔥 WAVE 2112: El Worker es la autoridad ahora. SET_BPM ignorado.
  break;  // ← Handler existe pero no hace NADA
```

Tres archivos coordinados para hacer absolutamente nada. El canal existe, el handler existe, la acción = vacío.

### ⚠️ CONFLICTO: Tres Fuentes de Phase Compitiendo

```typescript
// processFrame() — tres variables de fase en juego
beatState.pllPhase    // ← BeatDetector PLL (Main Thread)
workerBeatPhase       // ← PacemakerV2 (Worker)
beatState.phase       // ← BeatDetector legacy phase

// Decisión:
context.beatPhase = beatState.pllLocked
  ? (beatState.pllPhase ?? beatState.phase)  // ← PLL gana si está locked
  : workerBeatPhase                           // ← Worker fallback
```

El PLL de BeatDetector — que se alimenta de un BPM que viene del Worker — puede **bloquear y sustituir la fase del propio Worker que le dio el BPM**. El esclavo sobreescribiendo al amo.

### ⚠️ INCONSISTENCIA: BeatDetector inicializado con parámetros irrelevantes

```typescript
// TitanOrchestrator.ts — constructor
this.beatDetector = new BeatDetector({
  sampleRate: 44100,
  fftSize: 2048,
  smoothingTimeConstant: 0.8,
  minBpm: 60,
  maxBpm: 200,
})
```

`sampleRate`, `fftSize`, `smoothingTimeConstant` — todos parámetros para `process()`. Que nunca se llama. Son config para un sistema que no funciona.

### ⚠️ DUPLICACIÓN: Dos sistemas con la misma lógica

| Algoritmo | BeatDetector | PacemakerV2 |
|-----------|-------------|-------------|
| IOI interval collection | ✅ (muerto) | ✅ (activo) |
| Cluster analysis | ✅ (muerto) | ✅ (activo) |
| Hysteresis | ✅ (muerto) | ✅ (activo) |
| Confidence scoring | ✅ (muerto) | ✅ (activo) |
| PLL flywheel | ✅ (activo, residual) | ✅ (dentro de PacemakerV2) |
| Kick detection | ✅ (muerto, ratio-based) | ✅ (activo, spectral flux) |

**El mismo algoritmo existe dos veces.** Una instancia viva, una zombi.

---

## 4. FLUJO REAL RESUMIDO (Diagrama Limpio)

```
senses.ts (Worker BETA)
  │
  ├─ Spectral Flux → rhythmicPunch
  ├─ PacemakerV2.process() → { bpm, confidence, beatPhase, kickDetected }
  └─ AudioMetrics → AUDIO_ANALYSIS → TitanOrchestrator.lastAudioData
                                            │
                                            ▼
                               TitanOrchestrator.processFrame()
                                            │
                              ┌─────────────┴──────────────┐
                              │                            │
                    BeatDetector (PLL)              PacemakerV2 result
                    setBpm(workerBpm)               workerBpm (authority)
                    tick() → pllPhase               workerBeatPhase
                              │                            │
                              └─────────────┬──────────────┘
                                            │
                                     Decision tree
                                   context.bpm / .beatPhase
                                            │
                                            ▼
                                     Downstream engines
```

**Autoridad real:** PacemakerV2 (Worker BETA)  
**Rol real de BeatDetector:** PLL de fase, con 600+ líneas de kit de detección muerto colgando

---

## 5. RESUMEN DE HERENCIA EVOLUTIVA

| WAVE | Cambio | Estado Actual |
|------|--------|---------------|
| 1022 | BeatDetector creado — kick detection + clustering | 🧟 Código presente, nunca llamado |
| 1153 | BeatDetector conectado a TitanOrchestrator | 🧟 Código presente, desconectado |
| 2090.2 | BeatDetector = único motor BPM (Main Thread) | 🧟 La era que describe el audit viejo |
| 2090.3 | PLL añadido a BeatDetector | ✅ PLL activo como residual |
| 2096.1 | SET_BPM: Main→Worker intento de puente | 🧟 Canal vacío, handler no-op |
| 2112 | Worker es autoridad, BeatDetector demoted | ✅ Arquitectura actual base |
| 2130 | PacemakerV2 reemplaza GodEarBPMTracker en Worker | ✅ Motor actual |
| 2133 | Spectral Flux en senses.ts (Bass Gate) | ✅ Activo |
| 2140 | Confidence Bleed + Amnesia Protocol | ✅ Activo |
| 2141 | Debounce 80% shield | ✅ Activo |
| 2142 | Snare Killer (Bass Gate v3) | ✅ Activo |

---

## 6. DEUDA TÉCNICA — QUÉ HABRÍA QUE OPERAR

Si en el futuro se quiere cirugía limpia, estas son las opciones:

### Opción A — Lobotomía de BeatDetector (mínima invasión)
- Eliminar `process()`, `updateBpmWithPacemaker()`, `clusterIntervals()`, `findDominantCluster()`, `isOctaveJump()`, `calculateConfidence()`
- Renombrar clase a `PllFlywheel` o similar
- Eliminar parámetros `sampleRate/fftSize/smoothingTimeConstant` del constructor
- Limpiar SET_BPM (handler + tipo + método en Trinity)
- **Resultado:** BeatDetector pasa de 1022 → ~200 líneas. Solo PLL puro.

### Opción B — Integrar PLL dentro de PacemakerV2 (cirugía total)
- PacemakerV2 ya tiene `beatPhase` interno
- Migrar lógica PLL de BeatDetector a PacemakerV2
- Eliminar BeatDetector por completo
- Simplificar processFrame() — una sola fuente de verdad: Worker
- **Resultado:** Arquitectura limpia single-source. Todo el BPM en Worker.

### Opción C — Status Quo (no operar)
- Dejar el spaghetti. Funciona.
- **Riesgo:** Si alguien llama `process()` por error → double-tick → bugs de fase.
- **Riesgo:** Tres fuentes de phase → difícil debuggear derivas.

---

## 7. VEREDICTO

**El sistema funciona correctamente a pesar del spaghetti.** PacemakerV2 es el motor real y lo hace bien. BeatDetector es un cadáver bien portado que hace una sola cosa útil (PLL de fase) con 800 líneas de kit muerto encima.

**El problema del BPM pegado en 161 BPM no era spaghetti arquitectónico — era un algoritmo sin olvido (Confidence Bleed resuelto en WAVE 2140) y sin escudo anti-síncopa (WAVE 2141).** La arquitectura caótica no causaba bugs, solo dificultaba el diagnóstico.

**Prioridad de limpieza: BAJA** — No hay urgencia operacional. Operar cuando haya una razón concreta (nuevo feature de fase, refactor de Worker, etc.).

---

*PunkOpus para Radwulf — WAVE 2143*
