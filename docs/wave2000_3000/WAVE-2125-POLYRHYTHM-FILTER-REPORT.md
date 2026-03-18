# WAVE 2125: THE POLYRHYTHM FILTER & SILENCE PROTOCOL

**Fecha:** 2025-03-04  
**Commit:** `e6182e9`  
**Arquitecto:** PunkArchytect (GeminiPunk 3.1)  
**Ejecutor:** PunkOpus  
**Tests:** 29/29 ✅ (25 existentes + 4 nuevos)

---

## DIAGNÓSTICO (PunkArchytect)

### Problema 1: AUDIO STALE (Event Loop Choking)
Los `console.log` masivos (volcado AUTOCORR RAW 4× con decenas de valores, volcado de PEAKS) 
serializaban strings enormes cada ~186ms. Esto bloqueaba el GC de V8 y asfixiaba el puente IPC,
causando gaps de 500ms+ en el buffer temporal.

### Problema 2: El Espejismo del Tresillo (96 vs 128 BPM)
96 BPM = 75% de 128 BPM (relación 3/4, corchea con puntillo). Los bajos sincopados de Brejcha
generan un patrón fortísimo a 96 BPM. El sieve solo tenía Octave Lock (2×/0.5×), no sabía
defenderse de una relación de 1.333×.

---

## 3 ACCIONES IMPLEMENTADAS

### ACCIÓN 1: Protocolo de Silencio
- **Constante `VERBOSE_AUTOCORR_LOGS = false`** — Silencia los volcados AUTOCORR RAW y PEAKS
- Solo quedan activos: GODEAR BPM summary, SIEVE decision, cambios de estado (OCTAVE ACCEPT/BLOCK, TIME WARP, POLYRHYTHM)
- **Impacto:** Elimina el 90%+ del I/O de consola que estrangulaba el event loop

### ACCIÓN 2: Escudo Anti-Gap (Time Warp Protection)
- **Campo `lastFrameTimestamp`** — Trackea el timestamp del último `process()`
- **Constante `TIME_WARP_THRESHOLD_MS = 150`** — Si el gap > 150ms, el buffer es discontinuo
- **Acción:** Resetea `sampleCount = 0`, forzando un refill limpio del buffer
- **Log:** `[🥁 TIME WARP] 504ms gap detected. Buffer flushed`
- **Test 10** confirma: 128 BPM → gap 500ms → recovery a 128 BPM ✅

### ACCIÓN 3: Filtro de Polirritmia (El Asesino del 3/4)
- **Constantes:** `POLYRHYTHM_RATIO_MIN=1.30`, `POLYRHYTHM_RATIO_MAX=1.36`, `POLYRHYTHM_PREFERENCE=0.60`
- **Ubicación:** Pass 2 del Sieve (entre octave check y strongest-peak fallback)
- **Lógica:** Si el peak más fuerte es ~96 BPM y existe otro peak a ~128 BPM (ratio 1.33×), el 128 gana si su correlación ≥ 60% de la del 96
- **Log:** `[🥁 POLYRHYTHM] 95→128 BPM (ratio=1.343, corr 0.305 vs 0.458)`
- **Test 9** confirma: 128 BPM detectado incluso con syncopation energy MAYOR que kick energy (0.85 vs 0.70)

---

## SIEVE ORDER (v5)

```
Pass 1: OCTAVE PAIRS (2×/0.5×) → prefer high BPM if corr >= 80% of low
Pass 2: POLYRHYTHM (1.33×) → prefer 4/4 beat if corr >= 60% of syncopation  
Pass 3: STRONGEST PEAK fallback
```

---

## TESTS NUEVOS

| # | Test | Resultado |
|---|------|-----------|
| 9a | 128 vs 96 BPM syncopation @ 46.4ms | 128 BPM ✅ |
| 9b | 128 vs 96 BPM syncopation @ 21ms | 128 BPM ✅ |
| 9c | Estabilidad (no bounce 96↔128) | rango < 10 ✅ |
| 10 | Time warp recovery (500ms gap) | 128→gap→128 ✅ |

---

## ARCHIVOS MODIFICADOS

| Archivo | Cambios |
|---------|---------|
| `GodEarBPMTracker.ts` | v4→v5, +3 constantes polyrhythm, +2 constantes (TIME_WARP, VERBOSE), +field lastFrameTimestamp, time warp guard en process(), polyrhythm filter en sieve Pass 2, verbose gate en logs |
| `GodEarBPMTracker.test.ts` | +TEST 9 (3 subtests polyrhythm) + TEST 10 (time warp) = 29 total |

---

## EXPECTATIVA EN PRODUCCIÓN

1. **AUDIO STALE eliminado** — Sin los logs masivos, el event loop respira
2. **Time Warp** — Si queda algún gap residual, el buffer se auto-limpia
3. **96→128 BPM** — El filtro de polirritmia corrige la síncopa de Brejcha
4. **Combinado con WAVE 2124 (spectral flux):** La señal de onset + el filtro polyrhythm deberían converger en ~126-128 BPM real

**PRODUCCIÓN TEST PENDING** 🎯
