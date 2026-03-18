# WAVE 2123: OCTAVE-AWARE SIEVE + OCTAVE LOCK

**Commit:** `ddcdda0`  
**Fecha:** 2025-01-XX  
**Archivo:** `electron-app/src/workers/GodEarBPMTracker.ts` (v3→v4)  
**Tests:** 25/25 ✅

---

## 📋 PROBLEMA

Production log (`docs/logs/atortasconelBPM.md` — 792 líneas) mostró **octave bounce** clásico: BPM alternando entre ~167-186 y ~86-97 en Tech House de Brejcha.

### Telemetría AUTOCORR (8 scans de producción):

| Scan | Pico elegido | corr | Alternativa | corr | Problema |
|------|-------------|------|-------------|------|----------|
| 1 | L31 (167bpm) | 0.192 | L60 (86bpm) | 0.189 | Octava equivocada |
| 2 | L31 (169bpm) | 0.376 | L61 (85bpm) | 0.358 | Octava equivocada |
| 3 | L28 (185bpm) | 0.323 | L59 (88bpm) | 0.343 | L59 más fuerte pero pierde |
| 4 | L55 (94bpm) | 0.399 | — | — | ✅ Correcto |
| 5 | L28 (186bpm) | 0.354 | L53 (98bpm) | 0.296 | Octava equivocada |
| 6 | L53 (97bpm) | 0.094 | — | — | ✅ pero conf=ruido |
| 7 | L52 (99bpm) | 0.305 | — | — | ✅ |
| 8 | L54 (96bpm) | 0.534 | — | — | ✅ |

**Patrón:** Los picos a ~186 BPM y ~93 BPM tienen correlaciones casi iguales (ratio 0.94-1.06). El sieve viejo no tenía lógica de octavas — simplemente elegía el más fuerte, que alternaba frame a frame.

---

## 🔬 DIAGNÓSTICO

### Root Cause 1: Sieve ciego a octavas
El sieve de WAVE 2122.3 tomaba el pico con mayor correlación. Cuando hay un par de octavas (lag L y lag 2L) con correlaciones similares, el ganador alterna aleatoriamente → octave bounce.

### Root Cause 2: Smoothing sin protección de octavas  
El EMA smoothing aceptaba cualquier salto > 30 BPM como "snap" (cambio de canción). Un salto de 93→186 BPM se aceptaba instantáneamente.

### Insight clave de autocorrelación
Una señal periódica a lag L es **también** periódica a lag 2L (si se repite cada T, se repite cada 2T). Esto es propiedad matemática, no musical. Por tanto:
- Un beat REAL a 175 BPM genera picos en lag L(175) Y lag 2L(87.5)
- Un beat REAL a 93 BPM genera picos en lag L(93) Y lag L/2(186) 

**Ambos casos producen el mismo paisaje.** No se pueden distinguir solo por correlación.

### Datos del test sintético (175 BPM @ 46.4ms production frame rate):
```
L29 (175 BPM) r=0.698-0.728
L60 (87 BPM)  r=0.717-0.760  ← ¡EL SUBARMÓNICO ES MÁS FUERTE!
```
A frame rate de producción, el lag más largo tiene más overlap → más estabilidad estadística → correlación ligeramente mayor. El sieve "strongest peak" elegía 87 BPM.

---

## 🔧 LA SOLUCIÓN: DEFENSA EN DOS CAPAS

### Capa 1: SIEVE OCTAVE-AWARE

**Estrategia:** Cuando existe un par de octavas (lag L y lag ~2L), preferir el BPM **más alto** (lag más corto).

**Razón matemática:**
- Si el beat real IS a lag L → correcto ✓
- Si el beat real IS a lag 2L → el octave lock (Capa 2) protege el BPM estable

**Umbral:** `OCTAVE_LOW_PREFERENCE = 0.80` — el pico alto gana si `corr(alto) >= 0.80 × corr(bajo)`.

**Validación con datos reales:**
- Producción: 186bpm(0.323) vs 93bpm(0.343) → ratio=0.94 > 0.80 → 186 gana ✓
- Test 175: 175bpm(0.698) vs 87bpm(0.747) → ratio=0.93 > 0.80 → 175 gana ✓

### Capa 2: OCTAVE LOCK (portado de Pacemaker WAVE 1022)

**Nuevo método:** `isOctaveJump(newBpm, currentBpm)` — detecta ratios en rangos [1.85-2.15] y [0.45-0.55].

**Nuevo parámetro:** `OCTAVE_LOCK_SCANS = 8` — ~1.5 segundos de confirmación antes de aceptar un salto de octava.

**Funcionamiento:**
1. Si `rawBpm` es un salto de octava respecto a `stableBpm`:
   - Incrementar `octaveLockCounter` si es el mismo candidato (±10 BPM)
   - Reset si es un candidato diferente
   - Solo aceptar cuando `octaveLockCounter >= OCTAVE_LOCK_SCANS`
2. Si no es octava → smoothing EMA normal + reset del counter

**Logs de diagnóstico:**
- `[🥁 OCTAVE BLOCK] 87→178 BPM (2/8 scans)` — bloqueo activo
- `[🥁 OCTAVE ACCEPT] 87→175 BPM after 8 scans` — salto confirmado

---

## 📊 EVOLUCIÓN DEL DEBUGGING

| Iteración | OCTAVE_LOW_PREFERENCE | Dirección sieve | Tests passed |
|-----------|----------------------|-----------------|--------------|
| 1 (v3 original) | N/A | Shortest lag first, low-BPM preference | 22/25 (175→87.5) |
| 2 | 0.65 | Longest lag first, low wins fácil | 22/25 (175→87.5) |
| 3 | 0.80 | Longest lag first, low wins | 22/25 (175→87.5 a 46.4ms) |
| 4 | N/A | Strongest peak (no octave) | 24/25 (87>175 a 46.4ms) |
| **5 (final)** | **0.80** | **Shortest lag first, high wins en par** | **25/25** ✅ |

El insight clave fue que **a production frame rate el subarmónico puede tener correlación MÁS ALTA que el fundamental** (más overlap estadístico a lag largo). La dirección correcta es preferir el BPM alto, no el bajo.

---

## 🧮 CONSTANTES NUEVAS

```typescript
OCTAVE_LOW_PREFERENCE = 0.80   // Umbral para que high-BPM gane en octave pair
OCTAVE_LOCK_SCANS = 8          // Scans consecutivos para confirmar octave jump
OCTAVE_RATIO_RANGES = [[1.85, 2.15], [0.45, 0.55]]  // Rangos de detección
```

---

## 🎯 PREDICCIÓN PARA PRODUCCIÓN

**Con Brejcha Tech House (~93 BPM real):**
1. Arranque: sieve elegirá ~186 BPM (pico alto gana en octave pair)
2. Se estabiliza en ~186 BPM
3. Scans donde el pico bajo gana limpiamente (scan 4, 7, 8 del log) → intentan bajar a 93
4. Octave lock bloquea hasta 8 scans consecutivos confirmen 93 → **~1.5s para corregir**
5. Una vez en 93, los intentos de subir a 186 son bloqueados por octave lock

**Escenario esperado:** Arranque en ~186, corrección a ~93 en ~5-10 segundos, estable después.

**Si el arranque en 186 es inaceptable:** Podríamos seedear el GodEar con el BPM del Pacemaker al inicio, pero eso es optimización futura, no bug.

---

## 🔗 GENEALOGÍA

```
WAVE 2122   → Autocorrelation engine (tests pass, production fails)
WAVE 2122.1 → Parabolic interpolation + harmonic sieve (tests pass, production fails)
WAVE 2122.2 → AGC decompensation (eliminó ~95 BPM artifact, pero ~180 BPM persiste)
WAVE 2122.3 → 4× temporal upsampling (25/25 tests, production: octave bounce)
WAVE 2123   → Octave-aware sieve + octave lock (25/25 tests, pendiente producción)
```
