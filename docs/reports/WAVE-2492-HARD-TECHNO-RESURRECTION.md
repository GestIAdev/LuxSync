# WAVE 2492 — HARD TECHNO RESURRECTION

**Fecha**: 2025-02-06  
**Contexto**: Hadtechnominimal.md log — 900+ frames, solo 3 efectos disparados  
**Compilación**: ✅ LIMPIA — 0 errores  

---

## DIAGNÓSTICO: LA CADENA LETAL

El log mostró 6 anomalías letales. Selene estaba MUDA en hard techno:
- **INTEGRATOR_GATE bloqueaba ~95% de momentos dignos**
- **BPM conf=0.000 permanente** — nunca alcanzó lock
- **Drops de 1500ms** — se morían antes de empezar
- **GatlingRaid: balas fantasma** — ~25% invisibles por el while-loop

### ANOMALÍA PRINCIPAL: INTEGRATOR_GATE + balanced mode math

```
raw=0.66 → effective = 0.66/1.20 = 0.55 → BLOCKED (< 0.55, strict less-than)
```

La mayoría de momentos dignos en hard techno producen raw 0.50-0.66.
Con balanced thresholdMultiplier=1.20, TODOS mueren. Para pasar:
raw > 0.66 → solo ~5% de momentos.

Cuando INTEGRATOR_GATE bloquea → devuelve `approved: false` →
DecisionMaker recibe `dreamIntegration.approved = false` →
THE SILENCE RULE (WAVE 975): "DNA or silence. That's it." → **MUDO**.

---

## FIX 1: INTEGRATOR_GATE — balanced thresholdMultiplier 1.20 → 1.10

**Archivo**: `src/core/mood/MoodController.ts`

**Matemática nueva**:
- raw=0.61 → effective=0.61/1.10=0.555 → **PASA** ✅
- raw=0.66 → effective=0.66/1.10=0.60 → **PASA** ✅
- raw=0.55 → effective=0.55/1.10=0.50 → BLOCKED (correcto)
- raw=0.50 → effective=0.50/1.10=0.455 → BLOCKED (correcto)

**Antes** (1.20): necesitabas raw > 0.66 → ~5% de momentos pasaban  
**Ahora** (1.10): necesitas raw > 0.605 → ~40% pasan  

El control de calidad real sigue en `ethicsThreshold: 1.20` del DreamSimulator.

---

## FIX 2: BPM Purge Ratio Tightened — 0.50/2.00 → 0.65/1.55

**Archivo**: `src/workers/IntervalBPMTracker.ts`

**Problema**: Purga de WAVE 2177 tenía ratio `< 0.50 || > 2.00`.
Valores sub-armónicos como 81, 86, 92, 108 (cuando mediana=161)
tenían ratios 0.50-0.67 → NO se purgaban → spread enorme → conf=0.000 FOREVER.

```
bpmBuf=[161,92,161,161,161,161,86,81]
81/161 = 0.503 → NO se purgaba (> 0.50)
spread = 161-81 = 80 → conf = 1 - 80/60 = NEGATIVO → 0.000
```

**Fix**: Apretar a `< 0.65 || > 1.55` (mismo rango que el outlier rejection).

```
Ahora: 81/161 = 0.503 < 0.65 → SE PURGA ✅
       86/161 = 0.534 < 0.65 → SE PURGA ✅
       92/161 = 0.571 < 0.65 → SE PURGA ✅
      108/161 = 0.671 → pasa (cercano, aceptable)
      185/161 = 1.149 → pasa (armónico válido)
spread después: 185-108 = 77 → conf = 1 - 77/60 = 0.0... todavía bajo
Pero con más kicks legítimos entrando: bpmBuf=[161,161,161,161,185,161,161,161]
spread = 24 → conf = 1 - 24/60 = 0.60 ✅
```

---

## FIX 3: DROP HOLD TIME — 1500ms → 4000ms

**Archivo**: `src/workers/TrinityBridge.ts`

**Problema**: TODOS los drops en el log duraban exactamente ~1522ms.
El killSwitch mataba el drop 22ms después de que el hold de 1500ms expiraba.
En hard techno minimal, la energía cae entre kicks (gaps de 58ms) →
`weightedEnergy < dropEnergyKillThreshold` → killSwitch = true.

Un drop real en techno dura 16-32 compases (29-58 segundos a 130 BPM).
1500ms = ~3 beats. Absurdo.

**Fix**: 4000ms (~8 beats a 120BPM). El drop tiene un mínimo de 4 segundos
para establecerse antes de que el killSwitch pueda actuar.
`maxDropDuration` (del perfil de vibe) sigue como techo de seguridad.

---

## FIX 4: GatlingRaid — MINIMUM-1-FRAME VISIBILITY

**Archivo**: `src/core/effects/library/techno/GatlingRaid.ts`

**Problema**: El while-loop de WAVE 2490 podía consumir un gap+flash completo
en una sola iteración del loop. `isFlashOn` pasaba true→false sin que
`getOutput()` la viera → bala invisible (~25% de balas perdidas).

```
Frame 4: bulletTimer=65
  → gap (65≥35): bulletTimer=30, isFlashOn=true (NUEVA BALA)
  → flash (30≥30): bulletTimer=0, isFlashOn=false (BALA CONSUMIDA)
  → getOutput() ve isFlashOn=false → NEGRO (bala fantasma)
```

**Fix**: `break` inmediato después de cada transición gap→flash.
`getOutput()` SIEMPRE ve al menos 1 frame con `isFlashOn=true`.
El timer residual se procesa en el frame siguiente.

El GatlingRaid ahora tardará ~2-3 frames más en completarse (por las
pausas de visibilidad), pero TODAS las balas serán visibles.

---

## ARCHIVOS MODIFICADOS

| Archivo | Cambio |
|---------|--------|
| `src/core/mood/MoodController.ts` | balanced.thresholdMultiplier: 1.20 → 1.10 |
| `src/workers/IntervalBPMTracker.ts` | Purge ratio: 0.50/2.00 → 0.65/1.55 |
| `src/workers/TrinityBridge.ts` | DROP_HOLD_TIME_MS: 1500 → 4000 |
| `src/core/effects/library/techno/GatlingRaid.ts` | break after gap→flash transition |

---

## IMPACTO ESPERADO

1. **Arsenal completo activado**: Con thresholdMultiplier=1.10, el DREAM_RANKING
   de 14 candidatos (surgical_strike, neon_blinder, seismic_snap, digital_rain,
   binary_glitch, sonar_ping, ghost_chase, abyssal_rise...) podrá ejecutarse.

2. **BPM confidence > 0**: La purga más agresiva limpiará los sub-armónicos
   más rápido, permitiendo que conf alcance 0.60+ y active el outlier rejection
   para mantener la estabilidad.

3. **Drops que duran**: 4 segundos de hold dan tiempo al section tracker
   para acumular evidencia energética antes de que el killSwitch pueda actuar.

4. **GatlingRaid con balas visibles**: Todas las balas tendrán al menos 1 frame
   de renderizado DMX. La metralleta ahora brilla como debe.
