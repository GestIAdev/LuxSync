# WAVE 2181: rBPM Lifecycle Audit + Dead Code Purge

**Commit**: `fd69fb4`  
**Fecha**: 2025-01-XX  
**Tests**: 63 GREEN | 0 FAIL  
**Líneas destruidas**: ~3,384  

---

## 🔬 FASE 1: Pipeline Audit — Single Source of Truth

### La Variable: `context.bpm` (el rBPM)

El rBPM no es un tipo, no es una clase, no es un módulo. Es un **dato artístico** — un BPM musicalmente corregido que fluye desde el detector de kicks hasta cada pixel que se mueve en pantalla.

### El Pipeline Completo

```
🎤 Audio Input (mic/loopback)
    │
    ▼
┌─────────────────────────────────┐
│  Worker: senses.ts              │
│  IntervalBPMTracker             │
│    .process(kickEnergy, dt)     │
│    .getMusicalBpm(min, max)     │  ← getPocketBounds() por género
│         │                       │
│  state.currentBpm = musicalBpm  │  ← BIRTH POINT del rBPM
└────────────┬────────────────────┘
             │ postMessage({ bpm: state.currentBpm })
             ▼
┌─────────────────────────────────┐
│  TitanOrchestrator              │
│  3-Priority Chain:              │
│                                 │
│  P1: Worker activo (conf>0.2)   │  → context.bpm = workerBpm
│  P2: Freewheel (≤300 frames)    │  → context.bpm = lastStableWorkerBpm
│  P3: Pacemaker interno          │  → context.bpm = beatState.bpm
│                                 │
│  context.bpm = resultado final  │  ← SINGLE SOURCE OF TRUTH
└────────────┬────────────────────┘
             │
    ┌────────┼────────┬───────────┬──────────┬──────────┐
    ▼        ▼        ▼           ▼          ▼          ▼
 VMM     Movement  MoodSynth  BaseEffect  Selene   TrinityBrain
 .bpm     .bpm      .bpm       .bpm       .bpm      .bpm
```

### Consumidores Verificados ✅

| Consumidor | Archivo | Cómo bebe | Línea |
|------------|---------|-----------|-------|
| **VibeMovementManager** | VibeMovementManager.ts | `getSafeBPM(audio.bpm)` → `smoothedBPM` → phase accumulator | L632 |
| **MovementEngine** | MovementEngine.ts | `beatState.bpm / 120` como bpmFactor | L229 |
| **MoodSynthesizer** | MoodSynthesizer.ts | `beatState.bpm` para mood scores + VAD arousal | L148, L274 |
| **BaseEffect** + efectos | BaseEffect.ts | `this.musicalContext.bpm` → `60000/bpm` para msPerBeat | varies |
| **SeleneLux** | SeleneLux.ts | `vibeContext.bpm` propagado desde TitanEngine | L1896 |
| **TrinityBrain (Cassandra)** | TrinityBridge.ts | `analysis.bpm` del Worker | varies |
| **SimpleSectionTracker** | TrinityBridge.ts | `audioMetrics.bpm` (solo lectura, NO computa BPM) | varies |
| **truthStore** | truthStore.ts | `selectBPM = state.truth.context.bpm` | selector |
| **audioStore** | audioStore.ts | `selectHephBpm = state.bpm` | selector |

**Veredicto**: ✅ **TODOS** los consumidores beben exclusivamente de `context.bpm`. No hay fuentes paralelas, no hay cálculos alternativos, no hay atajos. El rBPM es un río con una única fuente.

---

## 💀 FASE 2: The Purge — Dead Code Destruction

### Archivos Eliminados

| Archivo | Líneas | Razón de Muerte |
|---------|--------|-----------------|
| `GodEarBPMTracker.ts` | 887 | Reemplazado por IntervalBPMTracker (WAVE 2168) |
| `PacemakerV2.ts` | 1,023 | Reemplazado por BeatDetector PLL (WAVE 2097) |
| `HarmonicGearbox.ts` | 207 | Integrado en `getMusicalBpm()` fold ratios (WAVE 2174) |
| `GodEarBPMTracker.test.ts` | 934 | Tests del muerto |
| `PacemakerV2.test.ts` | 333 | Tests del muerto |
| `dist/.../GodEarBPMTracker.js` | compiled | Artefacto compilado del muerto |
| `dist/.../PacemakerV2.js` | compiled | Artefacto compilado del muerto |
| **TOTAL** | **~3,384** | **PURGED** |

### Lo que NO se tocó (y por qué)

| Archivo | Razón de Supervivencia |
|---------|----------------------|
| `GodEarFFT.ts` | Analizador espectral (FFT bands). NO es BPM. Está vivo y en uso por `senses.ts` |
| `test-god-ear.ts` | Tests de GodEarFFT (espectral), no de BPM |
| `BeatDetector.ts` | Pacemaker PLL activo — Prioridad 3 en la cadena del TitanOrchestrator |

### Limpieza de Comentarios

**`senses.ts`**:
- Bloque lápida de 23 líneas → 3 líneas limpias
- 3 imports comentados eliminados (`GodEarBPMTracker`, `PacemakerV2`, `GearboxStabilizer`)
- ~6 referencias "GodEarBPMTracker" → "IntervalBPMTracker" / "rBPM"
- Handler SET_BPM: comentario actualizado

**`TitanOrchestrator.ts`**:
- Puente muerto `trinity.setBpm()` eliminado (6 líneas comentadas)
- Header de inyección BPM: "WAVE 2112 + 2179" → "rBPM INJECTION"

---

## 📊 Métricas Post-Purga

### getPocketBounds() — Rangos por Género

```typescript
function getPocketBounds(): [number, number] {
  const v = currentVibeId.toLowerCase()
  if (v === 'techno-club' || v === 'techno' || v === 'minimal' || v === 'hard-techno')
    return [120, 135]    // Techno estricto
  if (v === 'fiesta-latina' || v === 'reggaeton' || v === 'latin')
    return [85, 105]     // Latin pocket
  return [90, 135]       // Generic dance
}
```

### getMusicalBpm() — Arsenal de Fold Ratios (WAVE 2180)

```
FOLD DOWN (prioridad):
  1. ×0.75  (dotted quarter — ratio 4:3)
  2. ÷1.5   (tresillo fold)
  3. ÷2.0   (double-time fold)

FOLD UP:
  4. ×1.5   (tresillo inverso)
  5. ×2.0   (half-time fold)

Si ningún ratio aterriza en el pocket → raw passthrough
```

### Tests: 63 GREEN

- 35 unit tests (IntervalBPMTracker.test.ts)
- 28 data-driven tests (IntervalBPMTracker.livedata.test.ts)
  - 7 dumps parametrizados × 3 tests cada uno (Mode A, Mode B, A/B convergence)
  - 4 legacy tests (Mode A, Mode B, convergence, diagnostics)
  - 3 Brejcha-specific tests

---

## 🏛️ Arquitectura Post-2181

```
electron-app/src/workers/
├── senses.ts                        ← Worker principal (audio pipeline)
├── IntervalBPMTracker.ts            ← rBPM engine (interval-based, kick detection)
├── BeatDetector.ts                  ← Pacemaker PLL (Priority 3 backup)
├── GodEarFFT.ts                     ← Spectral analyzer (FFT, NOT BPM)
├── AutocorrelationBPM.ts            ← Autocorrelation engine
└── __tests__/
    ├── IntervalBPMTracker.test.ts    ← 35 unit tests
    └── IntervalBPMTracker.livedata.test.ts  ← 28 data-driven tests

ELIMINADOS ☠️:
├── GodEarBPMTracker.ts              ← 887 líneas → /dev/null
├── PacemakerV2.ts                   ← 1023 líneas → /dev/null
├── HarmonicGearbox.ts               ← 207 líneas → /dev/null
└── __tests__/
    ├── GodEarBPMTracker.test.ts      ← 934 líneas → /dev/null
    └── PacemakerV2.test.ts           ← 333 líneas → /dev/null
```

---

*"El código muerto es como los fantasmas: no hacen daño hasta que te tropiezas con ellos en la oscuridad. Hoy encendimos la luz y los exorcizamos."* — PunkOpus, WAVE 2181
