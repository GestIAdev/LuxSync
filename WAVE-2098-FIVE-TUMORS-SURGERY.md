# WAVE 2098: LA CIRUGÍA DE LOS 5 TUMORES

## 🔬 DIAGNÓSTICO POST-WAVE 2097

WAVE 2097 logró un avance REAL: kicks detectados (15-21 vs 0), BPM=128 detectado (no 120 default).
Pero el sistema seguía sin drops. Análisis de 1361 líneas de log reveló **5 tumores encadenados**.

---

## TUMOR 1: 🔴 EL THRESHOLD ASESINO (BeatDetector)

**Síntoma**: `kicks=20` congelado durante toda la sesión. Intervalos IDÉNTICOS frame tras frame:
```
[💓 LAST 8] 989ms, 460ms, 511ms, 479ms, 523ms, 464ms, 958ms, 593ms
```
Este pattern EXACTO se repite en CADA impresión desde frame 780 hasta frame 1680+.

**Causa raíz**: WAVE 2097 calibró threshold para señal "normalizada" con BASE=0.06 + MULT=0.10.
Con `bassAvg=0.70` → `threshold=0.13`. Pero AGC COMPRIME la dinámica: los transientes reales
de kicks son **0.02-0.05**, NO 0.10+. Solo los primeros 20 kicks (durante warmup, con bassAvg bajo)
cruzaron el threshold. Después, ZERO kicks detectados.

**Fix**: Recalibrado para transientes AGC-compressed:
- `KICK_THRESHOLD_BASE`: 0.06 → **0.035**
- `KICK_THRESHOLD_MULTIPLIER`: 0.10 → **0.025**
- bassAvg=0.70 → threshold=**0.052** (transientes de 0.03-0.06 PASAN)

---

## TUMOR 2: 🔴 PLL ETERNAMENTE FREEWHEEL (BeatDetector)

**Síntoma**: `PLL=FREEWHEEL` en el 99% del log. Brevemente `LOCKED` al final.

**Causa raíz**: `PLL_SOFT_CORRECTION_WINDOW_MS = 80ms` era demasiado estrecho.
A 128 BPM (469ms/beat), los kicks llegan con ±100ms de jitter por latencia AGC + frames.
Casi TODOS los kicks caían fuera de 80ms → HARD RESET → PLL nunca convergía.

**Fix**: Ventana ampliada de 80ms → **150ms** — permite soft correction sin perder precision.

---

## TUMOR 3: 🔴 INTERVALOS FÓSILES (BeatDetector)

**Síntoma**: Los mismos 8 intervalos exactos (989ms, 460ms, 511ms...) se repiten 30+ veces.

**Causa raíz**: `peakHistory` acumulaba kicks de los primeros segundos y NUNCA los purgaba.
Los 20 kicks iniciales generaban intervalos fijos. Sin kicks nuevos → clustering siempre idéntico.
`maxPeakHistory = 64` solo limitaba TAMAÑO pero no EDAD de los datos.

**Fix**: Añadido **PEAK HISTORY DECAY** — purga kicks con más de 10 segundos de edad.
Solo kicks frescos participan en el clustering. BPM se actualiza con datos RECIENTES.

---

## TUMOR 4: 🔴 SECTION PING-PONG (TrinityBridge)

**Síntoma**: `Section=breakdown` el 95% del tiempo, con un fugaz `Section=verse` en frame ~980.

**Causa raíz**: La energía oscila violentamente (E=0.06 → E=0.89 → E=0.09).
La condición `energyDelta < -0.20` se cumplía inmediatamente después de CUALQUIER transición.
Resultado: breakdown → verse → breakdown en 1-2 frames (invisible al log).

**Fix**: **SECTION HYSTERESIS** — Una vez que la sección cambia, debe permanecer al menos
**45 frames (~1.5s)** antes de que cualquier nueva transición sea posible.
Excepción: DROP ENTER siempre pasa (nunca queremos perder un drop).

---

## TUMOR 5: 🔴 DROP ENTER IMPOSIBLE (TrinityBridge)

**Síntoma**: Drop diagnostic muestra `bassR=1.50/1.4 ✅` pero `wE=0.05/0.75 ❌ kick=false ❌`

**Causa raíz dual**:
1. `hasKick` siempre `false` → porque el Pacemaker dejó de detectar kicks (Tumor 1)
2. `weightedEnergy > 0.75` casi inalcanzable → bass-heavy techno pasa por weighted average
   con mid/treble bajos, diluyendo la energía ponderada a 0.03-0.15

**Fix**: Condición de DROP relajada:
- `weightedEnergy > 0.75` → **`weightedEnergy > 0.30`** (la weighted es siempre baja en techno)
- `hasKick` → **`hasKick || audio.bass > 0.65`** (bass alta directa como proxy de kick)
- `bassRatio > 1.40` se mantiene como señal primaria (FUNCIONA — ya pasaba en el log)

---

## CASSANDRA DESCONGELADA (efecto cascada)

**Síntoma**: `timeToEvent=1870.6157443491813ms` — MISMO decimal exacto en cada frame.

**Causa raíz**: 60000 / 128.3 * 4 = 1870.6157... Sección=breakdown + BPM fijo = cálculo inmutable.

**Fix indirecto**: No necesita código propio. Con las secciones transicionando (Tumor 4 fixed),
la función `predict()` match diferentes patterns → `estimatedTimeMs` VARÍA → CASSANDRA se desbloquea.

---

## ARCHIVOS MODIFICADOS

| Archivo | Cambios |
|---------|---------|
| `src/engine/audio/BeatDetector.ts` | Threshold recalibrado (BASE=0.035, MULT=0.025), PLL window 80→150ms, Peak History Decay 10s |
| `src/workers/TrinityBridge.ts` | Section hysteresis (45 frames min), DROP conditions relajadas (wE>0.30, bass>0.65 proxy) |

---

## CADENA CAUSAL COMPLETA

```
Threshold demasiado alto (0.13)
  → Kicks mueren después del warmup (20 y stop)
    → Intervalos fósiles (mismos 8 por siempre)
      → BPM=128.3 congelado
        → PLL nunca converge (FREEWHEEL)
          → onBeat errático → Worker no recibe beats
            → Section breakdown permanente (sin hysteresis, ping-pong invisible)
              → predict() siempre matchea [breakdown]→buildup_starting
                → estimatedTimeMs = 60000/128.3*4 = 1870.6157... (FROZEN CASSANDRA)
                  → DROP ENTER imposible (kick=false + wE=0.05 < 0.75)
                    → ZERO DROPS DETECTADOS
```

**WAVE 2098 CORTA LA CADENA EN 3 PUNTOS SIMULTÁNEAMENTE.**

---

## RESULTADO ESPERADO

1. **Kicks continuos**: threshold ~0.045-0.055 → transientes de 0.03+ detectados constantemente
2. **Intervalos frescos**: peakHistory purgado cada 10s → clustering con datos RECIENTES
3. **PLL LOCKED**: ventana 150ms → soft corrections → fase estable → onBeat predice el beat
4. **Secciones variadas**: hysteresis 1.5s → breakdown, verse, buildup, verse alternando normalmente
5. **CASSANDRA viva**: diferentes secciones → diferentes patterns → timeToEvent varía
6. **DROPS DETECTADOS**: bassRatio>1.40 + (kick OR bass>0.65) + wE>0.30 → condición alcanzable
