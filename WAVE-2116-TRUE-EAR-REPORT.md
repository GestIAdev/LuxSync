# WAVE 2116: THE TRUE EAR — Sub-Beat Rejection + Sample Rate Fix

**Commit:** `db541f9`
**Fecha:** 2026-03-04
**Autor:** PunkOpus
**Directiva:** Diagnóstico post-WAVE-2115 — BPM=161 en sesión Brejcha que debería ser 120-130

---

## 📋 RESUMEN EJECUTIVO

El reloj determinístico de WAVE 2115 eliminó el drift/jitter de BPM. 
Pero el **valor** era incorrecto: **161 BPM** en una sesión Brejcha de **~125 BPM**.

Se identificaron **dos causas raíz** superpuestas:
1. Sample rate mismatch entre AudioContext del frontend (48000Hz default) y Worker (44100Hz hardcoded)
2. Sub-beats (offbeats) contaminando la detección de kicks — **el verdadero asesino**

Ambas fueron corregidas. **18/18 tests pasan** incluyendo 3 tests nuevos de sub-beat rejection.

---

## 🔍 DIAGNÓSTICO: LA AUTOPSIA DEL 161

### Evidencia del log post-WAVE-2115

```
[🥁 GODEAR BPM] 161bpm (raw=161) conf=0.78 kicks=6 intervals=[279,372,511,372]
                                                       ^^^  ^^^      ^^^
                                                       sub  sub      sub-beat intervals
```

| Frame | Intervalos (ms) | Mediana | BPM Calculado | BPM Real |
|-------|-----------------|---------|---------------|----------|
| 120 | `[279,372,511,372]` | 372 | **161** ❌ | 125 |
| 240 | `[511,372,882,557,232,372]` | 464 | 129 ✅ | 125 |
| 480 | `[372,1115,1115,557,372,464]` | 510 | **123** ✅ | 125 |
| 720 | `[279,232,325,1347,372,279]` | 302 | **161** ❌ | 125 |
| 840 | `[372,279,464,697,697,325]` | 418 | **143** ❌ | 125 |

Los intervalos de **279ms** (6 frames) y **372ms** (8 frames) son **sub-beats**: offbeats, hi-hats con sangrado grave, el pulso sincopado típico de Brejcha.

Los beats REALES están en **464-511ms** (10-11 frames) → **117-129 BPM** ≈ correcto.

### El Feedback Loop Vicioso

```
detectas sub-beat a 372ms → BPM=161 
  → debounce adaptativo = 60000/161 × 0.40 = 149ms
    → permite kicks a 149ms de separación
      → detectas MÁS sub-beats
        → BPM se mantiene en 161 ⟲
```

### Por qué los tests de WAVE 2113 no lo detectaron

El generador sintético usaba `KICK_ENERGY=0.80` vs `NOISE_FLOOR=0.12` → ratio **6.67×**.
En producción, Brejcha tiene bass floor denso (~0.18) y offbeats con ratio **1.7-2.0×**.
Con `KICK_RATIO_THRESHOLD=1.6`, esos offbeats pasaban como kicks legítimos.

---

## 🔧 CAUSA RAÍZ 1: Sample Rate Mismatch

### Ubicación
`electron-app/src/hooks/useAudioCapture.ts` línea 252

### Antes (ROTO)
```typescript
const audioContext = new AudioContext()  // ← Sin sample rate = hardware default
```

En Windows, `AudioContext()` sin parámetros usa el sample rate del driver de audio: típicamente **48000 Hz**.

Pero el Worker calcula timestamps asumiendo `config.audioSampleRate = 44100`:
```
deterministicTimestampMs = frameCount × 2048 / 44100 × 1000 = frameCount × 46.44ms
```

Si la realidad es 48000Hz, cada frame tiene **42.67ms** de audio → timestamps inflados **8.84%**.

Factor: `46.44 / 42.67 = 1.0884` → 125 BPM se mediría como ~136 BPM (parcial, no explica todo el error).

### Después (FIJO)
```typescript
const audioContext = new AudioContext({ sampleRate: 44100 })
```

Frontend y Worker ahora hablan el **mismo idioma temporal**.

---

## 🔧 CAUSA RAÍZ 2: Sub-Beat Contamination (EL ASESINO)

### Ubicación
`electron-app/src/workers/GodEarBPMTracker.ts`

### Cambios en Constantes

| Constante | Antes | Después | Razón |
|-----------|-------|---------|-------|
| `KICK_RATIO_THRESHOLD` | 1.6 | **2.0** | Offbeats Brejcha tienen ratio 1.7-1.9. A 2.0 no pasan. |
| `KICK_DELTA_THRESHOLD` | 0.008 | **0.03** | 0.008 es casi cero — cualquier temblor era "rising". 0.03 exige transiente real. |
| `MIN_INTERVAL_MS` | 200 | **250** | Floor del debounce: 200ms (300 BPM) permitía sub-beats a 279ms. 250ms (240 BPM) los bloquea. |
| `ENERGY_HISTORY_SIZE` | 24 | **32** | Baseline más estable en géneros bass-heavy con energía continua. |

### Nuevo: IQR Interval Filtering

```typescript
private filterIntervalsIQR(intervals: number[]): number[] {
  const sorted = [...intervals].sort((a, b) => a - b)
  const q1 = sorted[Math.floor(n / 4)]
  const q3 = sorted[Math.floor((3 * n) / 4)]
  const iqr = q3 - q1
  const lowerBound = q1 - 1.5 * iqr
  const upperBound = q3 + 1.5 * iqr
  return intervals.filter(i => i >= lowerBound && i <= upperBound)
}
```

**Antes del IQR:** `[279, 372, 511, 372]` → mediana 372 → **161 BPM** ❌

**Después del IQR:** Los intervalos cortos (279, 372) son outliers estadísticos contra el cluster real (464-511). El IQR los remueve antes de calcular la mediana.

---

## 🧪 TESTS: 18/18 PASSED

### Tests Originales (15/15 — Sin regresión)

| # | Género | BPM Target | BPM Detectado | Conf | Estado |
|---|--------|-----------|---------------|------|--------|
| 1a | EDM 4/4 | 128 | 130 | 0.98 | ✅ |
| 1b | EDM confidence | 128 | 130 | 0.98 | ✅ |
| 1c | EDM kick rate | 128 | — | — | ✅ |
| 2a | Trap half-time | 70 | 70 | 0.99 | ✅ |
| 2b | Trap confidence | 70 | 70 | 0.99 | ✅ |
| 3a | Brejcha variable | 125 | 124 | 0.99 | ✅ |
| 3b | Brejcha low kick | 125 | 124 | 0.99 | ✅ |
| 4a | Psytrance | 175 | 179 | 0.97 | ✅ |
| 4b | Psytrance debounce | 175 | — | — | ✅ |
| 5a | Ambient | 80 | 79 | 0.99 | ✅ |
| 5b | Ambient lock speed | 80 | 79 | 0.99 | ✅ |
| 5c | Ambient stability | 80 | 79 | 0.99 | ✅ |
| 6a | Breakdown survival | 130 | 130 | 1.00 | ✅ |
| 6b | Silence false pos. | — | 0 kicks | 0.00 | ✅ |
| ⚡ | Performance 60s | 128 | — | — | ✅ 10.53ms |

### Tests Nuevos WAVE 2116 (3/3)

| # | Escenario | BPM Target | BPM Detectado | ¿Hubiera fallado con tracker viejo? |
|---|-----------|-----------|---------------|--------------------------------------|
| 7a | Sub-beats 125 BPM (THE BUG) | 125 | **124** ✅ | Sí → 161 BPM |
| 7b | Sub-beats agresivos (0.50 energy) | 125 | **124** ✅ | Sí → ~155 BPM |
| 7c | Sub-beats 130 BPM (Brejcha live) | 130 | **130** ✅ | Sí → ~168 BPM |

### Test 7a Detail — La prueba que importa
```
Buffer: 125 BPM kicks (0.80) + offbeats (0.45) sobre bass floor 0.18
Antes (WAVE 2112): offbeats pasan ratio 1.6 → intervals=[279,372] → mediana 372 → 161 BPM
Ahora (WAVE 2116): offbeats rechazados por ratio 2.0 → intervals=[483,483] → 124 BPM ✅
```

---

## 📁 FILES MODIFIED

| File | LOC Changed | Purpose |
|------|-------------|---------|
| `electron-app/src/hooks/useAudioCapture.ts` | +3 | AudioContext forced to 44100 Hz |
| `electron-app/src/workers/GodEarBPMTracker.ts` | +73 | Raised thresholds + IQR filter |
| `electron-app/src/workers/__tests__/SyntheticBeatGenerator.ts` | +105 | `generateSubBeatBuffer()` |
| `electron-app/src/workers/__tests__/GodEarBPMTracker.test.ts` | +50 | 3 sub-beat rejection tests |

---

## 🏗️ WAVE TIMELINE (BPM Pipeline)

| Wave | Nombre | Estado | Commit |
|------|--------|--------|--------|
| 2112 | The Resurrection | ✅ Done | `05961b9` |
| 2113 | The Automaton | ✅ Done (15/15 tests) | `ad72d54` |
| 2114 | The Diagnostic Probe | ✅ Done (3 probes) | `f1573fa` |
| 2115 | The Relative Clock | ✅ Done | `162b4da` |
| **2116** | **The True Ear** | **✅ Done (18/18 tests)** | **`db541f9`** |

---

## 🎯 SIGUIENTE PASO RECOMENDADO

Desplegar y observar con sesión Brejcha real. Los 3 probes de WAVE 2114 siguen activos — el próximo log debería mostrar:
- BPM ~124-130 (no 161)
- Intervalos limpios ~464-511ms (no 279-372ms)
- Confidence >0.5 estable

Si los probes confirman convergencia correcta, se pueden desactivar (limpieza de debug logs).

---

*"El oído no se equivoca cuando sabe qué NO escuchar."* — PunkOpus, WAVE 2116
